#!/usr/bin/env python3
"""Control experiments for conclusions drawn earlier in README.md.

Questions:
 Q1  Is the gain of the in-context successor table due to ORDER, or to token IDENTITY (granularity)?
     -> token-level unigram cache (identity, no order) vs successor table (identity + order), alone and combined.
 Q2  Is the direct glow gain due to the attraction/repulsion (cluster PMI) field, or would a plain cluster
     self-cache do the same?  -> affinity variants: full, diagonal only, off-diagonal only, attraction only,
     repulsion only, identity matrix.
 Q3  Do the gains survive a stronger contextual baseline?  -> everything on Kneser-Ney order 3 and order 4.
 Q4  Does the cluster-level field add anything once a token-level cache is present?

All models are exact, properly normalised distributions; hyper-parameters are tuned on validation, test is
scored once.  Writes results/controls.json and results/controls.md.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from run_extras import article_blocks, cluster_mass_stream, direct_logprob, paired_bootstrap  # noqa: E402
from tglm import semantic as S  # noqa: E402
from tglm.data import Corpus  # noqa: E402
from tglm.evaluate import right_context_scores, select_cloze_positions  # noqa: E402
from tglm.model import InductionTable  # noqa: E402
from tglm.ngram import KNLM, perplexity  # noqa: E402

T0 = time.time()


def log(msg: str) -> None:
    print(f"[{time.time() - T0:7.1f}s] {msg}", flush=True)


class UnigramCache:
    """Decayed token histogram of the current document (identity, no order)."""

    def __init__(self, decay: float):
        self.decay = decay
        self.reset()

    def reset(self) -> None:
        self.cnt: dict[int, tuple[float, int]] = {}
        self.total = 0.0
        self.n = 0

    def score(self, x: int) -> tuple[float, bool]:
        if self.n == 0:
            return 0.0, False
        e = self.cnt.get(x)
        if e is None:
            return 0.0, True
        return e[0] * self.decay ** (self.n - e[1]) / self.total, True

    def dist(self, V: int) -> np.ndarray | None:
        if self.n == 0:
            return None
        q = np.zeros(V)
        for x, (v, s) in self.cnt.items():
            q[x] = v * self.decay ** (self.n - s)
        return q / self.total

    def update(self, x: int) -> None:
        e = self.cnt.get(x)
        v = e[0] * self.decay ** (self.n - e[1]) if e is not None else 0.0
        self.cnt[x] = (v * self.decay + 1.0, self.n + 1)
        self.total = self.total * self.decay + 1.0
        self.n += 1


def unigram_route(ids, starts, decay):
    T = len(ids)
    q = np.zeros(T); has = np.zeros(T, dtype=bool)
    cache = UnigramCache(decay)
    starts = set(int(s) for s in starts)
    for i in range(T):
        if i in starts:
            cache.reset()
        x = int(ids[i])
        q[i], has[i] = cache.score(x)
        cache.update(x)
    return q, has


def table_route(ids, starts, decay):
    T = len(ids)
    q = np.zeros(T); has = np.zeros(T, dtype=bool)
    table = InductionTable(decay)
    starts = set(int(s) for s in starts)
    for i in range(1, T):
        if i in starts:
            table.reset()
        q[i], has[i] = table.score(int(ids[i - 1]), int(ids[i]))
        table.update(int(ids[i - 1]), int(ids[i]))
    return q, has


def glow_hist(ids, starts, cluster, kcl, rho):
    """Normalised decayed cluster histogram of the tokens before each position (T x kcl, float32)."""
    T = len(ids)
    H = np.zeros((T, kcl), dtype=np.float32)
    h = np.zeros(kcl)
    starts = set(int(s) for s in starts)
    tok_cl = cluster[ids]
    for i in range(T):
        if i in starts:
            h[:] = 0.0
        H[i] = h
        h *= rho
        c = tok_cl[i]
        if c >= 0:
            h[c] += 1.0
    H /= np.maximum(H.sum(axis=1, keepdims=True), 1e-9)
    return H


def mix(lp0, comps):
    """log[(P0 + sum_j w_j q_j) / (1 + sum_j w_j)] with w_j = exp(kappa_j) * has_j."""
    num = np.exp(lp0)
    Z = np.ones(len(lp0))
    for kappa, q, has in comps:
        w = np.exp(kappa) * has
        num = num + w * q
        Z = Z + w
    return np.log(num / Z)


def tune_caches(lp0, U, B, use_u, use_b, kappas):
    best = None
    for du in (list(U) if use_u else [None]):
        for db in (list(B) if use_b else [None]):
            for ku in (kappas if use_u else [None]):
                for kb in (kappas if use_b else [None]):
                    comps = []
                    if use_u:
                        comps.append((ku, *U[du]))
                    if use_b:
                        comps.append((kb, *B[db]))
                    p = perplexity(mix(lp0, comps))
                    if best is None or p < best["valid_ppl"]:
                        best = {"decay_u": du, "decay_b": db, "kappa_u": ku, "kappa_b": kb, "valid_ppl": p}
    return best


def apply_caches(lp0, U, B, cfg):
    comps = []
    if cfg["decay_u"] is not None:
        comps.append((cfg["kappa_u"], *U[cfg["decay_u"]]))
    if cfg["decay_b"] is not None:
        comps.append((cfg["kappa_b"], *B[cfg["decay_b"]]))
    return mix(lp0, comps)


def affinity_variants(A):
    d = np.diag(np.diag(A))
    return {"full PMI field": A, "diagonal only (self-attraction)": d, "off-diagonal only": A - d,
            "attraction only (A>0)": np.maximum(A, 0.0), "repulsion only (A<0)": np.minimum(A, 0.0),
            "identity (plain cluster cache)": np.eye(A.shape[0], dtype=A.dtype)}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default=os.path.join(os.path.dirname(__file__), "data", "wikitext-103-v1"))
    ap.add_argument("--out-dir", default=os.path.join(os.path.dirname(__file__), "results"))
    ap.add_argument("--max-train-tokens", type=int, default=None)
    ap.add_argument("--M", type=int, default=30000)
    ap.add_argument("--window", type=int, default=5)
    ap.add_argument("--kcl", type=int, default=500)
    ap.add_argument("--dim", type=int, default=200)
    ap.add_argument("--procs", type=int, default=4)
    ap.add_argument("--bootstrap", type=int, default=2000)
    ap.add_argument("--cloze-n", type=int, default=2000)
    ap.add_argument("--induction-seqs", type=int, default=100)
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()
    rng = np.random.default_rng(args.seed)
    R: dict = {"args": vars(args)}
    orders = (3, 4)

    corpus = Corpus(args.data_dir, max_train_tokens=args.max_train_tokens)
    V = corpus.V
    kn = KNLM(4).fit(corpus.train, V)
    log("KN-4 fitted")
    streams = {"valid": (corpus.valid, corpus.valid_starts), "test": (corpus.test, corpus.test_starts)}
    hist = {name: kn.stream_history(ids, 4) for name, (ids, _) in streams.items()}
    lp_kn = {o: {name: np.log(kn.prob(o, hist[name], ids)) for name, (ids, _) in streams.items()} for o in orders}
    for o in orders:
        log(f"KN-{o}: valid {perplexity(lp_kn[o]['valid']):.2f} test {perplexity(lp_kn[o]['test']):.2f}")

    M = min(args.M, V)
    C = S.cooccurrence(corpus.train, M, args.window)
    Pp = S.ppmi(C)
    E = S.svd_embed(Pp, args.dim, seed=args.seed)
    labels = S.kmeans(E, args.kcl, seed=args.seed)
    A = S.cluster_affinity(C, labels, args.kcl)
    # control: destroy the semantics of the clusters but keep their sizes and frequency profile
    perm_labels = labels.copy()
    prng = np.random.default_rng(args.seed + 1)
    for s0 in range(0, M, 500):
        prng.shuffle(perm_labels[s0:s0 + 500])
    A_perm = S.cluster_affinity(C, perm_labels, args.kcl)
    del C, Pp, E
    cluster = np.full(V, -1, dtype=np.int32)
    cluster[:M] = labels
    cluster_perm = np.full(V, -1, dtype=np.int32)
    cluster_perm[:M] = perm_labels
    uni = kn.counts[(1, "raw")].astype(np.float64)
    prior = np.bincount(labels, weights=uni[:M], minlength=args.kcl)
    prior = (prior / prior.sum()).astype(np.float32)          # training frequency of each cluster
    log("clusters and affinity rebuilt")

    # ---------------------------------------------------------- cache routes
    decays_u = [0.99, 0.997, 0.999, 1.0]
    decays_b = [0.99, 0.999, 1.0]
    kappas = [-4.0, -3.0, -2.0, -1.0, 0.0, 1.0]
    U = {name: {d: unigram_route(ids, st, d) for d in decays_u} for name, (ids, st) in streams.items()}
    B = {name: {d: table_route(ids, st, d) for d in decays_b} for name, (ids, st) in streams.items()}
    log("cache routes computed")

    # ------------------------------------------------- cluster masses (direct glow)
    Pc = {}
    for o in orders:
        for name in streams:
            cache = os.path.join(args.out_dir, "cache", f"cluster_mass_{name}_{args.kcl}_{o}_{args.max_train_tokens}.npy")
            os.makedirs(os.path.dirname(cache), exist_ok=True)
            if os.path.exists(cache):
                Pc[(o, name)] = np.load(cache)
            else:
                sub = KNView(kn, o)
                Pc[(o, name)] = cluster_mass_stream(sub, {n: hist[name][n] for n in range(2, o + 1)}, cluster, args.kcl, args.procs)
                np.save(cache, Pc[(o, name)])
            log(f"cluster masses ready: order {o} {name}")

    Pc_perm = {}
    for name in streams:
        cache = os.path.join(args.out_dir, "cache", f"cluster_mass_perm{args.seed + 1}_{name}_{args.kcl}_3_{args.max_train_tokens}.npy")
        if os.path.exists(cache):
            Pc_perm[name] = np.load(cache)
        else:
            Pc_perm[name] = cluster_mass_stream(KNView(kn, 3), {n: hist[name][n] for n in range(2, 4)}, cluster_perm, args.kcl, args.procs)
            np.save(cache, Pc_perm[name])
        log(f"cluster masses ready: permuted clusters {name}")

    # ------------------------------------------------- direct glow, affinity variants
    # memory: drop what is no longer needed (order-4 tables are only used for the scores computed above)
    corpus.train = None
    for key in [(4, "raw"), (3, "cc")]:
        kn.counts.pop(key, None); kn.stats.pop(key, None)
    kn.uniq.pop(4, None)
    del hist
    import gc; gc.collect()

    rhos = [0.9, 0.97, 0.99, 0.997]
    betas = [0.25, 0.5, 1.0, 1.5, 2.0, 3.0, 4.0, 6.0, 8.0, 12.0]
    kcl = args.kcl
    LOGRATIO = "prior-normalised cluster cache (log-ratio, no PMI matrix)"
    variants = {name: (lambda H, Av=Av: H @ Av.T) for name, Av in affinity_variants(A).items()}
    variants[LOGRATIO] = lambda H: np.log((H + prior) / (2.0 * prior))

    def direct_scores(name, u_all, beta):
        """log P for both orders under P'(x) ~ P_KN(x) exp(beta u[cl(x)]), exact, chunked in float64."""
        ids_ = streams[name][0]
        T = len(ids_)
        cl = cluster[ids_]
        boost = np.where(cl >= 0, beta * u_all[np.arange(T), np.maximum(cl, 0)].astype(np.float64), 0.0)
        Z = {o: np.empty(T) for o in orders}
        for s0 in range(0, T, 20000):
            e = np.exp(beta * u_all[s0:s0 + 20000].astype(np.float64))
            for o in orders:
                pc = Pc[(o, name)][s0:s0 + 20000]
                Z[o][s0:s0 + 20000] = (pc[:, :kcl] * e).sum(axis=1) + pc[:, kcl]
        return {o: lp_kn[o][name] + boost - np.log(Z[o]) for o in orders}

    best = {(o, v): None for o in orders for v in variants}
    for rho in rhos:
        Hv = glow_hist(corpus.valid, corpus.valid_starts, cluster, kcl, rho)
        for vname, fn in variants.items():
            u = fn(Hv)
            for beta in betas:
                sc = direct_scores("valid", u, beta)
                for o in orders:
                    p = perplexity(sc[o])
                    if best[(o, vname)] is None or p < best[(o, vname)]["valid_ppl"]:
                        best[(o, vname)] = {"rho": rho, "beta": beta, "valid_ppl": p}
            del u
        del Hv
        log(f"direct glow grid done for rho={rho}")
    R["direct_glow"] = {}
    lp_direct = {}
    for rho in rhos:
        need = [(o, v) for (o, v), bst in best.items() if bst["rho"] == rho]
        if not need:
            continue
        H = {name: glow_hist(ids_, st_, cluster, kcl, rho) for name, (ids_, st_) in streams.items()}
        for vname in sorted({v for _, v in need}):
            u = {name: variants[vname](H[name]) for name in streams}
            for o in [o for o, v in need if v == vname]:
                bst = best[(o, vname)]
                for name in streams:
                    lp_direct[(o, vname, name)] = direct_scores(name, u[name], bst["beta"])[o]
                bst["test_ppl"] = perplexity(lp_direct[(o, vname, "test")])
                bst["edge"] = bst["beta"] in (betas[0], betas[-1]) or bst["rho"] in (rhos[0], rhos[-1])
            del u
        del H
    for vname in variants:
        for o in orders:
            bst = best[(o, vname)]
            R["direct_glow"][f"KN-{o} | {vname}"] = bst
            log(f"direct glow KN-{o} [{vname}]: rho={bst['rho']} beta={bst['beta']} valid {bst['valid_ppl']:.2f} test {bst['test_ppl']:.2f}")

    # control: same pipeline on frequency-matched RANDOM clusters (order 3)
    def direct_perm(name, u_all, beta):
        ids_ = streams[name][0]
        T = len(ids_)
        cl = cluster_perm[ids_]
        boost = np.where(cl >= 0, beta * u_all[np.arange(T), np.maximum(cl, 0)].astype(np.float64), 0.0)
        Z = np.empty(T)
        for s0 in range(0, T, 20000):
            e = np.exp(beta * u_all[s0:s0 + 20000].astype(np.float64))
            pc = Pc_perm[name][s0:s0 + 20000]
            Z[s0:s0 + 20000] = (pc[:, :kcl] * e).sum(axis=1) + pc[:, kcl]
        return lp_kn[3][name] + boost - np.log(Z)

    bp = None
    for rho in rhos:
        u = glow_hist(corpus.valid, corpus.valid_starts, cluster_perm, kcl, rho) @ A_perm.T
        for beta in betas:
            pv = perplexity(direct_perm("valid", u, beta))
            if bp is None or pv < bp["valid_ppl"]:
                bp = {"rho": rho, "beta": beta, "valid_ppl": pv}
        del u
    u = glow_hist(corpus.test, corpus.test_starts, cluster_perm, kcl, bp["rho"]) @ A_perm.T
    lp_perm_test = direct_perm("test", u, bp["beta"])
    del u
    bp["test_ppl"] = perplexity(lp_perm_test)
    bp["edge"] = bp["beta"] in (betas[0], betas[-1]) or bp["rho"] in (rhos[0], rhos[-1])
    RANDOM = "full PMI field on RANDOM clusters (frequency-matched shuffle of the labels)"
    R["direct_glow"][f"KN-3 | {RANDOM}"] = bp
    log(f"direct glow KN-3 [random clusters]: rho={bp['rho']} beta={bp['beta']} valid {bp['valid_ppl']:.2f} test {bp['test_ppl']:.2f}")
    del Pc_perm

    # ------------------------------------------------- caches on top of KN and of direct glow
    R["caches"] = {}
    lp_final = {}
    FULL = "full PMI field"
    for o in orders:
        bases = {"KN": lp_kn[o], "direct glow": {n: lp_direct[(o, FULL, n)] for n in streams}}
        for bname, base in bases.items():
            lp_final[(o, bname, "none")] = base["test"]
            for cname, (uu, ub) in {"unigram cache": (True, False), "successor table": (False, True), "unigram cache + successor table": (True, True)}.items():
                cfg = tune_caches(base["valid"], U["valid"], B["valid"], uu, ub, kappas)
                lt = apply_caches(base["test"], U["test"], B["test"], cfg)
                cfg["test_ppl"] = perplexity(lt)
                R["caches"][f"KN-{o} | {bname} + {cname}"] = cfg
                lp_final[(o, bname, cname)] = lt
                log(f"KN-{o} {bname} + {cname}: {cfg}")
    R["baseline"] = {f"KN-{o}": {"valid_ppl": perplexity(lp_kn[o]["valid"]), "test_ppl": perplexity(lp_kn[o]["test"])} for o in orders}

    # ------------------------------------------------- bootstrap
    blocks = article_blocks(len(corpus.test), corpus.test_starts)
    R["bootstrap"] = {}
    for o in orders:
        pairs = [
            (("KN", "unigram cache"), ("KN", "none"), "unigram cache vs KN"),
            (("KN", "successor table"), ("KN", "none"), "successor table vs KN"),
            (("KN", "successor table"), ("KN", "unigram cache"), "successor table vs unigram cache"),
            (("KN", "unigram cache + successor table"), ("KN", "unigram cache"), "adding the table to the unigram cache (value of order)"),
            (("KN", "unigram cache + successor table"), ("KN", "successor table"), "adding the unigram cache to the table"),
            (("direct glow", "none"), ("KN", "none"), "direct glow vs KN"),
            (("direct glow", "unigram cache"), ("KN", "unigram cache"), "adding direct glow to the unigram cache"),
            (("direct glow", "unigram cache + successor table"), ("KN", "unigram cache + successor table"), "adding direct glow to both caches"),
        ]
        for a, b, label in pairs:
            R["bootstrap"][f"KN-{o} | {label}"] = paired_bootstrap(lp_final[(o, *a)], lp_final[(o, *b)], blocks, args.bootstrap, rng)
        R["bootstrap"][f"KN-{o} | full PMI field vs identity (plain cluster cache)"] = paired_bootstrap(
            lp_direct[(o, FULL, "test")], lp_direct[(o, "identity (plain cluster cache)", "test")], blocks, args.bootstrap, rng)
        R["bootstrap"][f"KN-{o} | full PMI field vs diagonal only"] = paired_bootstrap(
            lp_direct[(o, FULL, "test")], lp_direct[(o, "diagonal only (self-attraction)", "test")], blocks, args.bootstrap, rng)
        R["bootstrap"][f"KN-{o} | full PMI field vs prior-normalised cluster cache"] = paired_bootstrap(
            lp_direct[(o, FULL, "test")], lp_direct[(o, LOGRATIO, "test")], blocks, args.bootstrap, rng)
    R["bootstrap"]["KN-3 | full PMI field: semantic clusters vs random clusters"] = paired_bootstrap(
        lp_direct[(3, FULL, "test")], lp_perm_test, blocks, args.bootstrap, rng)
    R["bootstrap"]["KN-3 | random-cluster field vs KN"] = paired_bootstrap(lp_perm_test, lp_kn[3]["test"], blocks, args.bootstrap, rng)
    R["bootstrap"]["KN-4 vs KN-3 (one more token of context)"] = paired_bootstrap(lp_kn[4]["test"], lp_kn[3]["test"], blocks, args.bootstrap, rng)
    for k, v in R["bootstrap"].items():
        log(f"bootstrap {k}: ratio {v['ppl_ratio']:.4f} [{v['ci95'][0]:.4f}, {v['ci95'][1]:.4f}]")

    # ------------------------------------------------- dense helpers (order 3) for cloze and induction
    o = 3
    dg = R["direct_glow"][f"KN-{o} | {FULL}"]
    cfgs = {name: R["caches"][f"KN-{o} | {name}"] for name in
            ["KN + unigram cache", "KN + successor table", "KN + unigram cache + successor table",
             "direct glow + unigram cache + successor table"]}
    model_specs = {
        "KN-3": {"direct": False, "cfg": None},
        "KN-3 + unigram cache": {"direct": False, "cfg": cfgs["KN + unigram cache"]},
        "KN-3 + successor table": {"direct": False, "cfg": cfgs["KN + successor table"]},
        "KN-3 + unigram cache + successor table": {"direct": False, "cfg": cfgs["KN + unigram cache + successor table"]},
        "KN-3 + direct glow": {"direct": True, "cfg": None},
        "KN-3 + direct glow + both caches": {"direct": True, "cfg": cfgs["direct glow + unigram cache + successor table"]},
    }

    class State:
        def __init__(self):
            self.h = np.zeros(args.kcl)
            self.uc = {d: UnigramCache(d) for d in decays_u}
            self.tb = {d: InductionTable(d) for d in decays_b}

        def reset(self):
            self.h[:] = 0.0
            for c in self.uc.values():
                c.reset()
            for t in self.tb.values():
                t.reset()

        def update(self, prev, tok):
            self.h *= dg["rho"]
            c = cluster[tok]
            if c >= 0:
                self.h[c] += 1.0
            for cch in self.uc.values():
                cch.update(tok)
            if prev is not None:
                for t in self.tb.values():
                    t.update(prev, tok)

    def dense(spec, context, st, p_kn=None):
        P = kn.dist(o, kn.history_from_context(context, o)) if p_kn is None else p_kn
        if spec["direct"]:
            s = st.h.sum()
            u = A @ (st.h / s) if s > 0 else np.zeros(args.kcl)
            P = P * np.exp(dg["beta"] * np.where(cluster >= 0, u[np.maximum(cluster, 0)], 0.0))
            P = P / P.sum()
        cfg = spec["cfg"]
        if cfg is None:
            return P
        num, Z = P.copy(), 1.0
        if cfg["decay_u"] is not None:
            q = st.uc[cfg["decay_u"]].dist(V)
            if q is not None:
                w = np.exp(cfg["kappa_u"]); num += w * q; Z += w
        if cfg["decay_b"] is not None and len(context):
            q = st.tb[cfg["decay_b"]].dist(int(context[-1]), V)
            if q is not None:
                w = np.exp(cfg["kappa_b"]); num += w * q; Z += w
        return num / Z

    # ------------------------------------------------- cloze (same 2,000 positions as the main run)
    content_mask = np.zeros(V, dtype=bool)
    content_mask[:M] = [corpus.is_content_word(i) for i in range(M)]
    ids = corpus.test
    positions = set(int(p) for p in select_cloze_positions(content_mask, ids, args.cloze_n, np.random.default_rng(args.seed)))
    starts = set(int(s) for s in corpus.test_starts)
    cands = np.arange(M, dtype=np.int64)
    ranks = {m: {"left": [], "bidir": []} for m in model_specs}
    st = State()
    for i in range(len(ids)):
        if i in starts:
            st.reset()
        if i in positions:
            truth = int(ids[i])
            ctx = ids[max(0, i - o):i]
            p_kn = kn.dist(o, kn.history_from_context(ctx, o))
            right = right_context_scores(kn, cands, int(ids[i - 1]), int(ids[i + 1]), int(ids[i + 2]))
            for m, spec in model_specs.items():
                left = np.log(np.maximum(dense(spec, ctx, st, p_kn)[:M], 1e-300))
                ranks[m]["left"].append(int(np.count_nonzero(left > left[truth])) + 1)
                both = left + right
                ranks[m]["bidir"].append(int(np.count_nonzero(both > both[truth])) + 1)
        st.update(int(ids[i - 1]) if i > 0 else None, int(ids[i]))
    R["cloze"] = {}
    for m, d in ranks.items():
        R["cloze"][m] = {}
        for side, r in d.items():
            r = np.asarray(r, dtype=np.float64)
            R["cloze"][m][side] = {"acc@1": float(np.mean(r <= 1)), "acc@10": float(np.mean(r <= 10)), "mrr": float(np.mean(1.0 / r)), "n": int(len(r))}
        log(f"cloze {m}: left acc@1 {R['cloze'][m]['left']['acc@1']:.3f} acc@10 {R['cloze'][m]['left']['acc@10']:.3f} mrr {R['cloze'][m]['left']['mrr']:.3f} | bidir acc@1 {R['cloze'][m]['bidir']['acc@1']:.3f}")
    # paired bootstrap on cloze left reciprocal ranks: table vs unigram cache
    def rr_diff(a, b, n_boot=2000):
        ra = 1.0 / np.asarray(ranks[a]["left"], float); rb = 1.0 / np.asarray(ranks[b]["left"], float)
        d = ra - rb
        idx = rng.integers(len(d), size=(n_boot, len(d)))
        means = d[idx].mean(axis=1)
        return {"mrr_diff": float(d.mean()), "ci95": [float(np.quantile(means, 0.025)), float(np.quantile(means, 0.975))]}
    R["cloze_paired"] = {
        "successor table minus unigram cache": rr_diff("KN-3 + successor table", "KN-3 + unigram cache"),
        "both caches minus unigram cache": rr_diff("KN-3 + unigram cache + successor table", "KN-3 + unigram cache"),
        "unigram cache minus KN": rr_diff("KN-3 + unigram cache", "KN-3"),
        "direct glow minus KN": rr_diff("KN-3 + direct glow", "KN-3"),
    }

    # ------------------------------------------------- synthetic induction
    L = 12
    res = {m: {"lp1": [], "lp2": [], "acc2": []} for m in model_specs}
    for _ in range(args.induction_seqs):
        seq = rng.choice(np.arange(1000, M), size=L, replace=False)
        stream = np.concatenate([seq, seq]).astype(np.int64)
        st = State()
        lps = {m: [] for m in model_specs}; hit = {m: 0 for m in model_specs}
        for i in range(2 * L):
            ctx = stream[max(0, i - o):i]
            p_kn = kn.dist(o, kn.history_from_context(ctx, o))
            for m, spec in model_specs.items():
                P = dense(spec, ctx, st, p_kn)
                lps[m].append(float(np.log(P[stream[i]])))
                if i > L:
                    hit[m] += int(np.argmax(P) == stream[i])
            st.update(int(stream[i - 1]) if i > 0 else None, int(stream[i]))
        for m in model_specs:
            res[m]["lp1"].append(np.mean(lps[m][1:L])); res[m]["lp2"].append(np.mean(lps[m][L + 1:])); res[m]["acc2"].append(hit[m] / (L - 1))
    R["synthetic_induction"] = {m: {"ppl_first_copy": float(np.exp(-np.mean(d["lp1"]))), "ppl_second_copy": float(np.exp(-np.mean(d["lp2"]))),
                                    "acc_second_copy": float(np.mean(d["acc2"]))} for m, d in res.items()}
    for m, d in R["synthetic_induction"].items():
        log(f"induction {m}: ppl first {d['ppl_first_copy']:.1f} second {d['ppl_second_copy']:.1f} acc {d['acc_second_copy']:.3f}")

    R["runtime_sec"] = time.time() - T0
    json.dump(R, open(os.path.join(args.out_dir, "controls.json"), "w"), indent=1, default=float)
    write_report(R, os.path.join(args.out_dir, "controls.md"), len(blocks))
    log("done")


class KNView:
    """Expose a lower top order of a fitted KNLM to cluster_mass_stream (which reads ``kn.N``)."""

    def __init__(self, kn: KNLM, order: int):
        self._kn, self.N = kn, order

    def dist(self, top, h):
        return self._kn.dist(top, h)


def write_report(R, path, n_blocks):
    L = ["# Controls: identity versus order, the affinity field, and a stronger baseline\n",
         f"Runtime {R['runtime_sec'] / 60:.1f} min. Hyper-parameters tuned on validation; test scored once. `edge` marks an optimum on the border of its grid.\n",
         "## 1. Caches on top of Kneser-Ney (test perplexity)\n",
         "| contextual base | addition | test PPL | change vs base | tuned (decay_u, kappa_u, decay_b, kappa_b) |", "|---|---|---|---|---|"]
    for o in (3, 4):
        base = R["baseline"][f"KN-{o}"]["test_ppl"]
        L.append(f"| KN-{o} | - | {base:.2f} | - | - |")
        for key, c in R["caches"].items():
            if key.startswith(f"KN-{o} | KN + "):
                L.append(f"| KN-{o} | {key.split(' + ', 1)[1]} | {c['test_ppl']:.2f} | {100 * (c['test_ppl'] / base - 1):+.1f}% | ({c['decay_u']}, {c['kappa_u']}, {c['decay_b']}, {c['kappa_b']}) |")
    L += ["", "## 2. Direct glow: which part of the affinity matrix carries the gain?\n",
          "| contextual base | affinity | rho | beta | test PPL | change vs base | edge |", "|---|---|---|---|---|---|---|"]
    for key, d in R["direct_glow"].items():
        o = int(key[3]); base = R["baseline"][f"KN-{o}"]["test_ppl"]
        L.append(f"| KN-{o} | {key.split(' | ')[1]} | {d['rho']} | {d['beta']} | {d['test_ppl']:.2f} | {100 * (d['test_ppl'] / base - 1):+.1f}% | {'yes' if d['edge'] else ''} |")
    L += ["", "## 3. Direct glow combined with token-level caches\n", "| contextual base | model | test PPL | change vs base |", "|---|---|---|---|"]
    for o in (3, 4):
        base = R["baseline"][f"KN-{o}"]["test_ppl"]
        L.append(f"| KN-{o} | direct glow (full PMI field) | {R['direct_glow'][f'KN-{o} | full PMI field']['test_ppl']:.2f} | {100 * (R['direct_glow'][f'KN-{o} | full PMI field']['test_ppl'] / base - 1):+.1f}% |")
        for key, c in R["caches"].items():
            if key.startswith(f"KN-{o} | direct glow + "):
                L.append(f"| KN-{o} | direct glow + {key.split(' + ', 1)[1]} | {c['test_ppl']:.2f} | {100 * (c['test_ppl'] / base - 1):+.1f}% |")
    L += ["", f"## 4. Paired bootstrap over {n_blocks} test blocks (PPL ratio < 1 means the first model is better)\n",
          "| comparison | PPL ratio | 95% CI |", "|---|---|---|"]
    for k, v in R["bootstrap"].items():
        L.append(f"| {k} | {v['ppl_ratio']:.4f} | [{v['ci95'][0]:.4f}, {v['ci95'][1]:.4f}] |")
    L += ["", "## 5. Cloze (same 2,000 blanks as the main run; order-3 base)\n",
          "| model | left acc@1 | left acc@10 | left MRR | bidir acc@1 | bidir acc@10 | bidir MRR |", "|---|---|---|---|---|---|---|"]
    for m, d in R["cloze"].items():
        l, b = d["left"], d["bidir"]
        L.append(f"| {m} | {l['acc@1']:.3f} | {l['acc@10']:.3f} | {l['mrr']:.3f} | {b['acc@1']:.3f} | {b['acc@10']:.3f} | {b['mrr']:.3f} |")
    L.append("")
    for k, v in R["cloze_paired"].items():
        L.append(f"- left MRR, {k}: {v['mrr_diff']:+.4f} (95% CI {v['ci95'][0]:+.4f} to {v['ci95'][1]:+.4f})")
    L += ["", "## 6. Synthetic induction (12 random content tokens repeated twice; order-3 base)\n",
          "| model | PPL first copy | PPL second copy | top-1 acc second copy |", "|---|---|---|---|"]
    for m, d in R["synthetic_induction"].items():
        L.append(f"| {m} | {d['ppl_first_copy']:.1f} | {d['ppl_second_copy']:.1f} | {d['acc_second_copy']:.3f} |")
    open(path, "w").write("\n".join(L) + "\n")


if __name__ == "__main__":
    main()
