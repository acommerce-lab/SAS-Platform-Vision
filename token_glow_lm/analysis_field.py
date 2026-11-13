#!/usr/bin/env python3
"""What exactly should a glow centre compute?

analysis_controls.py showed that a prior-normalised self-activation of each cluster,
    u_c = log( (hbar_c + p_c) / (2 p_c) )           (p_c = training frequency of cluster c)
beats the linear cluster-PMI field u = A . hbar.  This script asks the remaining questions:

 F1  With a properly bracketed decay, how good is the self-activation field?
 F2  Do forces BETWEEN different clusters (off-diagonal PMI) add anything on top of self-activation?
 F3  Does the semantic content of the clusters matter for the self-activation field (random-cluster control)?
 F4  What is the best count-only model: field + token-level unigram cache + successor table, on KN-3 and KN-4?

Exact normalised models, validation-tuned, test scored once.  Writes results/field.json and results/field.md.
"""
from __future__ import annotations

import argparse
import gc
import json
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from analysis_controls import KNView, apply_caches, glow_hist, table_route, tune_caches, unigram_route  # noqa: E402
from run_extras import article_blocks, cluster_mass_stream, paired_bootstrap  # noqa: E402
from tglm import semantic as S  # noqa: E402
from tglm.data import Corpus  # noqa: E402
from tglm.evaluate import select_cloze_positions  # noqa: E402
from tglm.ngram import KNLM, perplexity  # noqa: E402

T0 = time.time()


def log(msg: str) -> None:
    print(f"[{time.time() - T0:7.1f}s] {msg}", flush=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default=os.path.join(os.path.dirname(__file__), "data", "wikitext-103-v1"))
    ap.add_argument("--out-dir", default=os.path.join(os.path.dirname(__file__), "results"))
    ap.add_argument("--max-train-tokens", type=int, default=None)
    ap.add_argument("--max-eval-tokens", type=int, default=None, help="truncate valid/test (smoke tests only)")
    ap.add_argument("--M", type=int, default=30000)
    ap.add_argument("--window", type=int, default=5)
    ap.add_argument("--kcl", type=int, default=500)
    ap.add_argument("--dim", type=int, default=200)
    ap.add_argument("--procs", type=int, default=4)
    ap.add_argument("--bootstrap", type=int, default=2000)
    ap.add_argument("--cloze-n", type=int, default=2000)
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()
    rng = np.random.default_rng(args.seed)
    R: dict = {"args": vars(args)}
    orders = (3, 4)
    kcl = args.kcl

    corpus = Corpus(args.data_dir, max_train_tokens=args.max_train_tokens)
    if args.max_eval_tokens:
        n = args.max_eval_tokens
        corpus.valid, corpus.test = corpus.valid[:n], corpus.test[:n]
        corpus.valid_starts = corpus.valid_starts[corpus.valid_starts < n]
        corpus.test_starts = corpus.test_starts[corpus.test_starts < n]
    V = corpus.V
    kn = KNLM(4).fit(corpus.train, V)
    log("KN-4 fitted")
    streams = {"valid": (corpus.valid, corpus.valid_starts), "test": (corpus.test, corpus.test_starts)}
    hist = {name: kn.stream_history(ids, 4) for name, (ids, _) in streams.items()}
    lp_kn = {o: {name: np.log(kn.prob(o, hist[name], ids)) for name, (ids, _) in streams.items()} for o in orders}

    M = min(args.M, V)
    C = S.cooccurrence(corpus.train, M, args.window)
    Pp = S.ppmi(C)
    E = S.svd_embed(Pp, args.dim, seed=args.seed)
    labels = S.kmeans(E, kcl, seed=args.seed)
    A = S.cluster_affinity(C, labels, kcl)
    perm_labels = labels.copy()                       # same frequency-matched shuffle as analysis_controls.py
    prng = np.random.default_rng(args.seed + 1)
    for s0 in range(0, M, 500):
        prng.shuffle(perm_labels[s0:s0 + 500])
    del C, Pp, E
    uni = kn.counts[(1, "raw")].astype(np.float64)

    def cluster_map(lab):
        cm = np.full(V, -1, dtype=np.int32)
        cm[:M] = lab
        pr = np.bincount(lab, weights=uni[:M], minlength=kcl)
        return cm, (pr / pr.sum()).astype(np.float32)

    cluster, prior = cluster_map(labels)
    cluster_perm, prior_perm = cluster_map(perm_labels)
    A_off = A - np.diag(np.diag(A))
    log("clusters rebuilt")

    tag = f"{kcl}_{{o}}_{args.max_train_tokens}" + (f"_e{args.max_eval_tokens}" if args.max_eval_tokens else "")

    def masses(prefix, o, name, cmap):
        path = os.path.join(args.out_dir, "cache", f"{prefix}_{name}_{tag.format(o=o)}.npy")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        if os.path.exists(path):
            return np.load(path)
        pc = cluster_mass_stream(KNView(kn, o), {n: hist[name][n] for n in range(2, o + 1)}, cmap, kcl, args.procs)
        np.save(path, pc)
        return pc

    Pc = {(o, name): masses("cluster_mass", o, name, cluster) for o in orders for name in streams}
    Pc_perm = {name: masses(f"cluster_mass_perm{args.seed + 1}", 3, name, cluster_perm) for name in streams}
    for o in orders:      # guard against a stale cache: the masses must be a distribution over clusters + rest
        assert abs(float(Pc[(o, "valid")][:200].sum(axis=1).mean()) - 1.0) < 1e-3
    log("cluster masses ready")

    decays_u, decays_b, kappas = [0.99, 0.997, 0.999, 1.0], [0.99, 0.999, 1.0], [-4.0, -3.0, -2.0, -1.0, 0.0, 1.0]
    U = {name: {d: unigram_route(ids, st, d) for d in decays_u} for name, (ids, st) in streams.items()}
    B = {name: {d: table_route(ids, st, d) for d in decays_b} for name, (ids, st) in streams.items()}
    corpus.train = None
    for key in [(4, "raw"), (3, "cc")]:
        kn.counts.pop(key, None); kn.stats.pop(key, None)
    kn.uniq.pop(4, None)
    del hist
    gc.collect()

    def scores(name, u_all, beta, pcs, cmap, which):
        """Exact log P under P'(x) ~ P_KN(x) exp(beta u[cl(x)]) for each order in `which`."""
        ids_ = streams[name][0]
        T = len(ids_)
        cl = cmap[ids_]
        boost = np.where(cl >= 0, beta * u_all[np.arange(T), np.maximum(cl, 0)].astype(np.float64), 0.0)
        Z = {o: np.empty(T) for o in which}
        for s0 in range(0, T, 20000):
            e = np.exp(beta * u_all[s0:s0 + 20000].astype(np.float64))
            for o in which:
                pc = pcs[o][s0:s0 + 20000]
                Z[o][s0:s0 + 20000] = (pc[:, :kcl] * e).sum(axis=1) + pc[:, kcl]
        return {o: lp_kn[o][name] + boost - np.log(Z[o]) for o in which}

    def self_field(H, pr):
        u = np.log((H + pr) / (2.0 * pr))
        u[H.sum(axis=1) <= 0] = 0.0                    # no evidence yet -> no field
        return u.astype(np.float32)

    def hists(cmap, rho):
        return {name: glow_hist(ids, st, cmap, kcl, rho) for name, (ids, st) in streams.items()}

    # ------------------------------------------------------------ F1: self-activation field
    rhos_self = [0.99, 0.997, 0.999, 0.9997, 1.0]
    betas_self = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]
    grid_self = {o: [] for o in orders}
    for rho in rhos_self:
        Hv = glow_hist(corpus.valid, corpus.valid_starts, cluster, kcl, rho)
        u = self_field(Hv, prior); del Hv
        for beta in betas_self:
            sc = scores("valid", u, beta, {o: Pc[(o, "valid")] for o in orders}, cluster, orders)
            for o in orders:
                grid_self[o].append({"rho": rho, "beta": beta, "valid_ppl": perplexity(sc[o])})
        del u
        log(f"self field grid done for rho={rho}")
    best_self = {o: dict(min(grid_self[o], key=lambda r: r["valid_ppl"])) for o in orders}
    lp = {}
    for o in orders:
        b = best_self[o]
        H = hists(cluster, b["rho"])
        for name in streams:
            lp[(o, "self", name)] = scores(name, self_field(H[name], prior), b["beta"], {o: Pc[(o, name)]}, cluster, (o,))[o]
        del H
        b["test_ppl"] = perplexity(lp[(o, "self", "test")])
        b["edge"] = b["rho"] in (rhos_self[0], rhos_self[-1]) or b["beta"] in (betas_self[0], betas_self[-1])
        log(f"F1 self field KN-{o}: {b}")
    R["self_field"] = {f"KN-{o}": best_self[o] for o in orders}
    R["self_field_grid"] = {f"KN-{o}": grid_self[o] for o in orders}

    # ------------------------------------------------------------ F2: add forces between clusters
    rhos_cross = [0.97, 0.99]
    lams = [-1.0, -0.5, 0.25, 0.5, 1.0, 2.0, 4.0]
    best_comb = {}
    for o in orders:
        b = best_self[o]
        betas_c = sorted({b["beta"], b["beta"] * 0.75, b["beta"] * 1.25})
        Hs = glow_hist(corpus.valid, corpus.valid_starts, cluster, kcl, b["rho"])
        u_self = self_field(Hs, prior); del Hs
        best = {"lam": 0.0, "rho_cross": None, "beta": b["beta"], "valid_ppl": b["valid_ppl"]}
        for rc in rhos_cross:
            cross = glow_hist(corpus.valid, corpus.valid_starts, cluster, kcl, rc) @ A_off.T
            for lam in lams:
                u = u_self + lam * cross
                for beta in betas_c:
                    p = perplexity(scores("valid", u, beta, {o: Pc[(o, "valid")]}, cluster, (o,))[o])
                    if p < best["valid_ppl"]:
                        best = {"lam": lam, "rho_cross": rc, "beta": beta, "valid_ppl": p}
                del u
            del cross
        del u_self
        if best["rho_cross"] is None:
            for name in streams:
                lp[(o, "self+cross", name)] = lp[(o, "self", name)]
        else:
            Hs, Hc = hists(cluster, b["rho"]), hists(cluster, best["rho_cross"])
            for name in streams:
                u = self_field(Hs[name], prior) + best["lam"] * (Hc[name] @ A_off.T)
                lp[(o, "self+cross", name)] = scores(name, u, best["beta"], {o: Pc[(o, name)]}, cluster, (o,))[o]
            del Hs, Hc
        best["test_ppl"] = perplexity(lp[(o, "self+cross", "test")])
        best["edge"] = best["lam"] in (lams[0], lams[-1])
        best_comb[o] = best
        log(f"F2 self + cross-cluster forces KN-{o}: {best}")
    R["self_plus_cross"] = {f"KN-{o}": best_comb[o] for o in orders}

    # ------------------------------------------------------------ F3: random clusters (order 3)
    bp = None
    for rho in rhos_self:
        u = self_field(glow_hist(corpus.valid, corpus.valid_starts, cluster_perm, kcl, rho), prior_perm)
        for beta in betas_self:
            p = perplexity(scores("valid", u, beta, {3: Pc_perm["valid"]}, cluster_perm, (3,))[3])
            if bp is None or p < bp["valid_ppl"]:
                bp = {"rho": rho, "beta": beta, "valid_ppl": p}
        del u
    u = self_field(glow_hist(corpus.test, corpus.test_starts, cluster_perm, kcl, bp["rho"]), prior_perm)
    lp_perm = scores("test", u, bp["beta"], {3: Pc_perm["test"]}, cluster_perm, (3,))[3]
    del u, Pc_perm
    bp["test_ppl"] = perplexity(lp_perm)
    R["self_field_random_clusters"] = {"KN-3": bp}
    log(f"F3 self field on random clusters KN-3: {bp}")

    # ------------------------------------------------------------ F4: best count-only stacks
    R["stacks"] = {}
    final = {}
    for o in orders:
        base_ppl = perplexity(lp_kn[o]["test"])
        R["stacks"][f"KN-{o}"] = {"test_ppl": base_ppl}
        final[(o, "KN")] = lp_kn[o]["test"]
        for fname, key in [("self field", "self"), ("self field + cross-cluster forces", "self+cross")]:
            R["stacks"][f"KN-{o} + {fname}"] = {"test_ppl": perplexity(lp[(o, key, "test")])}
            final[(o, fname)] = lp[(o, key, "test")]
        for bname, base in [("KN", lp_kn[o]), ("self field", {nm: lp[(o, "self", nm)] for nm in streams}),
                            ("self field + cross-cluster forces", {nm: lp[(o, "self+cross", nm)] for nm in streams})]:
            for cname, (uu, ub) in {"unigram cache": (True, False), "unigram cache + successor table": (True, True)}.items():
                cfg = tune_caches(base["valid"], U["valid"], B["valid"], uu, ub, kappas)
                lt = apply_caches(base["test"], U["test"], B["test"], cfg)
                cfg["test_ppl"] = perplexity(lt)
                label = f"KN-{o} + {cname}" if bname == "KN" else f"KN-{o} + {bname} + {cname}"
                R["stacks"][label] = cfg
                final[(o, bname + " + " + cname)] = lt
                log(f"F4 {label}: test {cfg['test_ppl']:.2f}")

    blocks = article_blocks(len(corpus.test), corpus.test_starts)
    bs = lambda a, b: paired_bootstrap(a, b, blocks, args.bootstrap, rng)
    R["bootstrap"] = {}
    for o in orders:
        R["bootstrap"][f"KN-{o} | self field vs KN"] = bs(final[(o, "self field")], final[(o, "KN")])
        R["bootstrap"][f"KN-{o} | adding cross-cluster forces to the self field"] = bs(final[(o, "self field + cross-cluster forces")], final[(o, "self field")])
        R["bootstrap"][f"KN-{o} | adding the self field to the unigram cache"] = bs(final[(o, "self field + unigram cache")], final[(o, "KN + unigram cache")])
        R["bootstrap"][f"KN-{o} | adding the unigram cache to the self field"] = bs(final[(o, "self field + unigram cache")], final[(o, "self field")])
        R["bootstrap"][f"KN-{o} | adding the self field to both caches"] = bs(final[(o, "self field + unigram cache + successor table")], final[(o, "KN + unigram cache + successor table")])
        R["bootstrap"][f"KN-{o} | adding the successor table to self field + unigram cache (value of order)"] = bs(
            final[(o, "self field + unigram cache + successor table")], final[(o, "self field + unigram cache")])
    R["bootstrap"]["KN-3 | self field: semantic clusters vs random clusters"] = bs(final[(3, "self field")], lp_perm)
    R["bootstrap"]["KN-3 | random-cluster self field vs KN"] = bs(lp_perm, final[(3, "KN")])
    for k, v in R["bootstrap"].items():
        log(f"bootstrap {k}: ratio {v['ppl_ratio']:.4f} [{v['ci95'][0]:.4f}, {v['ci95'][1]:.4f}]")

    # ------------------------------------------------------------ cloze with the self field (order 3, left context)
    o = 3
    b = best_self[o]
    content_mask = np.zeros(V, dtype=bool)
    content_mask[:M] = [corpus.is_content_word(i) for i in range(M)]
    ids = corpus.test
    positions = set(int(p) for p in select_cloze_positions(content_mask, ids, args.cloze_n, np.random.default_rng(args.seed)))
    starts = set(int(s) for s in corpus.test_starts)
    h = np.zeros(kcl)
    rk = {"KN-3": [], "KN-3 + self field": []}
    for i in range(len(ids)):
        if i in starts:
            h[:] = 0.0
        if i in positions:
            truth = int(ids[i])
            P = kn.dist(o, kn.history_from_context(ids[max(0, i - o):i], o))
            left = np.log(np.maximum(P[:M], 1e-300))
            rk["KN-3"].append(int(np.count_nonzero(left > left[truth])) + 1)
            s = h.sum()
            if s > 0:
                u = np.log((h / s + prior) / (2.0 * prior))
                left = left + b["beta"] * u[cluster[:M]]            # all candidates are clustered; ranking is unaffected by Z
            rk["KN-3 + self field"].append(int(np.count_nonzero(left > left[truth])) + 1)
        h *= b["rho"]
        c = cluster[ids[i]]
        if c >= 0:
            h[c] += 1.0
    R["cloze_left"] = {}
    for m, r in rk.items():
        r = np.asarray(r, dtype=np.float64)
        R["cloze_left"][m] = {"acc@1": float(np.mean(r <= 1)), "acc@10": float(np.mean(r <= 10)), "mrr": float(np.mean(1.0 / r)), "n": int(len(r))}
    d = 1.0 / np.asarray(rk["KN-3 + self field"], float) - 1.0 / np.asarray(rk["KN-3"], float)
    means = d[rng.integers(len(d), size=(2000, len(d)))].mean(axis=1)
    R["cloze_left"]["mrr_diff"] = {"diff": float(d.mean()), "ci95": [float(np.quantile(means, 0.025)), float(np.quantile(means, 0.975))]}
    log(f"cloze: {R['cloze_left']}")

    R["runtime_sec"] = time.time() - T0
    json.dump(R, open(os.path.join(args.out_dir, "field.json"), "w"), indent=1, default=float)
    L = ["# What should a glow centre compute?\n",
         f"Runtime {R['runtime_sec'] / 60:.1f} min. Field applied to all candidates: P'(x|h) ~ P_KN(x|h) exp(beta u[cl(x)]), normalised exactly. `edge` marks an optimum on the border of its grid.\n",
         "## 1. Field definitions (test perplexity)\n", "| base | field | tuned | test PPL | change vs base | edge |", "|---|---|---|---|---|---|"]
    ctl = json.load(open(os.path.join(args.out_dir, "controls.json")))["direct_glow"] if os.path.exists(os.path.join(args.out_dir, "controls.json")) else {}
    for o in orders:
        base = R["stacks"][f"KN-{o}"]["test_ppl"]
        L.append(f"| KN-{o} | none | - | {base:.2f} | - | |")
        k = f"KN-{o} | full PMI field"
        if k in ctl:
            L.append(f"| KN-{o} | linear cluster-PMI field u = A.hbar (from controls.md) | rho {ctl[k]['rho']}, beta {ctl[k]['beta']} | {ctl[k]['test_ppl']:.2f} | {100 * (ctl[k]['test_ppl'] / base - 1):+.1f}% | |")
        s_ = R["self_field"][f"KN-{o}"]
        L.append(f"| KN-{o} | self-activation relative to the cluster's prior, u = log((hbar+p)/2p) | rho {s_['rho']}, beta {s_['beta']} | {s_['test_ppl']:.2f} | {100 * (s_['test_ppl'] / base - 1):+.1f}% | {'yes' if s_['edge'] else ''} |")
        c_ = R["self_plus_cross"][f"KN-{o}"]
        L.append(f"| KN-{o} | self-activation + lam x off-diagonal PMI forces | lam {c_['lam']}, rho_cross {c_['rho_cross']}, beta {c_['beta']} | {c_['test_ppl']:.2f} | {100 * (c_['test_ppl'] / base - 1):+.1f}% | {'yes' if c_['edge'] else ''} |")
    r_ = R["self_field_random_clusters"]["KN-3"]
    base3 = R["stacks"]["KN-3"]["test_ppl"]
    L.append(f"| KN-3 | self-activation on RANDOM clusters (frequency-matched shuffle) | rho {r_['rho']}, beta {r_['beta']} | {r_['test_ppl']:.2f} | {100 * (r_['test_ppl'] / base3 - 1):+.1f}% | |")
    L += ["", "## 2. Count-only stacks (test perplexity)\n", "| model | test PPL | change vs its Kneser-Ney base |", "|---|---|---|"]
    for k, v in R["stacks"].items():
        base = R["stacks"][k[:4]]["test_ppl"]
        L.append(f"| {k} | {v['test_ppl']:.2f} | {100 * (v['test_ppl'] / base - 1):+.1f}% |")
    L += ["", f"## 3. Paired bootstrap over {len(blocks)} test blocks (ratio < 1: first model better)\n", "| comparison | PPL ratio | 95% CI |", "|---|---|---|"]
    for k, v in R["bootstrap"].items():
        L.append(f"| {k} | {v['ppl_ratio']:.4f} | [{v['ci95'][0]:.4f}, {v['ci95'][1]:.4f}] |")
    cz = R["cloze_left"]
    L += ["", "## 4. Cloze, left context only (same 2,000 blanks)\n", "| model | acc@1 | acc@10 | MRR |", "|---|---|---|---|"]
    for m in ("KN-3", "KN-3 + self field"):
        L.append(f"| {m} | {cz[m]['acc@1']:.3f} | {cz[m]['acc@10']:.3f} | {cz[m]['mrr']:.3f} |")
    L.append(f"\nPaired MRR difference: {cz['mrr_diff']['diff']:+.4f} (95% CI {cz['mrr_diff']['ci95'][0]:+.4f} to {cz['mrr_diff']['ci95'][1]:+.4f}).")
    open(os.path.join(args.out_dir, "field.md"), "w").write("\n".join(L) + "\n")
    log("done")


if __name__ == "__main__":
    main()
