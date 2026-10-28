#!/usr/bin/env python3
"""Extra experiments on top of ``run_experiments.py``:

1. **Direct glow**: the glow field acts on *all* candidates instead of only on the semantic children,
   P'(x | h) ∝ P_KN(x | h) · exp(beta · u_i[cl(x)]).  Exact normalisation uses the per-position mass of every
   cluster under P_KN (computed once per stream).  This tests whether routing the field through semantic children
   is the bottleneck.
2. **Paired bootstrap** over test articles for the perplexity differences between the models.

Writes ``results/extras.json`` and ``results/extras.md``.
"""
from __future__ import annotations

import argparse
import json
import multiprocessing as mp
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tglm import semantic as S  # noqa: E402
from tglm.data import Corpus  # noqa: E402
from tglm.evaluate import cloze_eval, select_cloze_positions  # noqa: E402
from tglm.model import GlowLM  # noqa: E402
from tglm.ngram import KNLM, perplexity  # noqa: E402

T0 = time.time()


def log(msg: str) -> None:
    print(f"[{time.time() - T0:7.1f}s] {msg}", flush=True)


_G: dict = {}


def _mass_chunk(rng_: tuple[int, int]) -> np.ndarray:
    kn, hist, cl_ext, kcl = _G["kn"], _G["hist"], _G["cl_ext"], _G["kcl"]
    lo, hi = rng_
    out = np.zeros((hi - lo, kcl + 1), dtype=np.float32)
    for j, i in enumerate(range(lo, hi)):
        h = {n: int(hist[n][i]) for n in range(2, kn.N + 1)}
        out[j] = np.bincount(cl_ext, weights=kn.dist(kn.N, h), minlength=kcl + 1)
    return out


def cluster_mass_stream(kn: KNLM, hist: dict, cluster: np.ndarray, kcl: int, procs: int, chunk: int = 4000) -> np.ndarray:
    """P_c[i, c] = sum_{x in cluster c} P_KN(x | h_i); column kcl collects tokens without a cluster."""
    T = len(hist[2])
    _G.update(kn=kn, hist=hist, cl_ext=np.where(cluster >= 0, cluster, kcl).astype(np.int64), kcl=kcl)
    ranges = [(lo, min(lo + chunk, T)) for lo in range(0, T, chunk)]
    with mp.get_context("fork").Pool(procs) as pool:
        parts = pool.map(_mass_chunk, ranges)
    return np.concatenate(parts, axis=0)


def direct_logprob(lp_kn: np.ndarray, ids: np.ndarray, u_all: np.ndarray, Pc: np.ndarray, cluster: np.ndarray, beta: float) -> np.ndarray:
    kcl = u_all.shape[1]
    cl = cluster[ids]
    boost_true = np.where(cl >= 0, beta * u_all[np.arange(len(ids)), np.maximum(cl, 0)], 0.0)
    Z = (Pc[:, :kcl].astype(np.float64) * np.exp(beta * u_all.astype(np.float64))).sum(axis=1) + Pc[:, kcl]
    return lp_kn + boost_true - np.log(Z)


def article_blocks(T: int, starts) -> list[tuple[int, int]]:
    s = sorted(set([0] + [int(x) for x in starts if 0 < x < T])) + [T]
    return [(s[i], s[i + 1]) for i in range(len(s) - 1) if s[i + 1] > s[i]]


def paired_bootstrap(lp_a: np.ndarray, lp_b: np.ndarray, blocks, B: int, rng) -> dict:
    """PPL(a) / PPL(b) over article-level resamples; p = share of resamples where a is not better than b."""
    sa = np.array([lp_a[lo:hi].sum() for lo, hi in blocks])
    sb = np.array([lp_b[lo:hi].sum() for lo, hi in blocks])
    n = np.array([hi - lo for lo, hi in blocks], dtype=np.float64)
    ratios = np.empty(B)
    for b in range(B):
        idx = rng.integers(len(blocks), size=len(blocks))
        tot = n[idx].sum()
        ratios[b] = np.exp(-(sa[idx].sum() - sb[idx].sum()) / tot)
    return {"ppl_ratio": float(np.exp(-(sa.sum() - sb.sum()) / n.sum())),
            "ci95": [float(np.quantile(ratios, 0.025)), float(np.quantile(ratios, 0.975))],
            "p_not_better": float(np.mean(ratios >= 1.0)), "blocks": len(blocks)}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default=os.path.join(os.path.dirname(__file__), "data", "wikitext-103-v1"))
    ap.add_argument("--out-dir", default=os.path.join(os.path.dirname(__file__), "results"))
    ap.add_argument("--order", type=int, default=3)
    ap.add_argument("--max-train-tokens", type=int, default=None)
    ap.add_argument("--M", type=int, default=30000)
    ap.add_argument("--window", type=int, default=5)
    ap.add_argument("--K", type=int, default=20)
    ap.add_argument("--kcl", type=int, default=500)
    ap.add_argument("--dim", type=int, default=200)
    ap.add_argument("--procs", type=int, default=4)
    ap.add_argument("--bootstrap", type=int, default=2000)
    ap.add_argument("--cloze-n", type=int, default=2000)
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()
    rng = np.random.default_rng(args.seed)
    main_results = json.load(open(os.path.join(args.out_dir, "results.json")))
    best = main_results["best_glow"]
    sem_mode, route = best["key"].split("/")
    static_tau = main_results["experiments"][best["key"]]["static"]["tau"]
    ind = main_results["induction_extension"]
    R: dict = {"args": vars(args), "from_main_run": {"best_glow": best, "static_tau": static_tau,
                                                      "induction": {"kappa": ind["kappa"], "decay": ind["decay"]}}}

    corpus = Corpus(args.data_dir, max_train_tokens=args.max_train_tokens)
    V = corpus.V
    kn = KNLM(args.order).fit(corpus.train, V)
    log("KN fitted")
    M = min(args.M, V)
    C = S.cooccurrence(corpus.train, M, args.window)
    Pp = S.ppmi(C)
    E = S.svd_embed(Pp, args.dim, seed=args.seed)
    if sem_mode == "cooc":
        nbr, w = S.cooc_neighbors(Pp, args.K)
    else:
        nbr, w = S.cosine_neighbors(E, args.K)
    labels = S.kmeans(E, args.kcl, seed=args.seed)
    A = S.cluster_affinity(C, labels, args.kcl)
    sem = S.SemanticGraph(V, M, nbr, w, labels, A)
    model = GlowLM(kn, sem, route)
    log("semantic graph rebuilt")

    streams = {"valid": (corpus.valid, corpus.valid_starts), "test": (corpus.test, corpus.test_starts)}
    lp: dict[str, dict[str, np.ndarray]] = {k: {} for k in streams}
    hist, prep, Pc = {}, {}, {}
    for name, (ids, starts) in streams.items():
        hist[name] = kn.stream_history(ids)
        prep[name] = model.prepare_stream(ids, hist[name])
        lp[name]["KN"] = np.log(prep[name]["p_direct"])
        lp[name]["static"] = model.combine(prep[name], None, static_tau, 0.0)
        U = model.glow_features(ids, starts, best["rho"], prep[name]["cl"])
        lp[name]["glow"] = model.combine(prep[name], U, best["tau"], best["beta"])
        q, has = model.induction_route(ids, starts, ind["decay"])
        lp[name]["glow+table"] = model.combine(prep[name], U, best["tau"], best["beta"], q, has, ind["kappa"])
        prep[name]["q_ind"], prep[name]["has_ind"] = q, has
        cache = os.path.join(args.out_dir, "cache", f"cluster_mass_{name}_{args.kcl}_{args.order}_{args.max_train_tokens}.npy")
        os.makedirs(os.path.dirname(cache), exist_ok=True)
        if os.path.exists(cache):
            Pc[name] = np.load(cache)
        else:
            Pc[name] = cluster_mass_stream(kn, hist[name], sem.cluster, args.kcl, args.procs)
            np.save(cache, Pc[name])
        log(f"{name}: baseline log-probs and cluster masses ready")

    # ------------------------------------------------ direct glow tuning (valid)
    rhos = [0.9, 0.97, 0.99, 0.997]
    betas = [0.25, 0.5, 1.0, 1.5, 2.0, 3.0, 4.0]
    rows, best_direct = [], None
    u_cache = {}
    for rho in rhos:
        u_cache[("valid", rho)] = model.glow_field_stream(corpus.valid, corpus.valid_starts, rho)
        for beta in betas:
            l = direct_logprob(lp["valid"]["KN"], corpus.valid, u_cache[("valid", rho)], Pc["valid"], sem.cluster, beta)
            rows.append({"rho": rho, "beta": beta, "valid_ppl": perplexity(l)})
            if best_direct is None or rows[-1]["valid_ppl"] < best_direct["valid_ppl"]:
                best_direct = dict(rows[-1])
    u_test = model.glow_field_stream(corpus.test, corpus.test_starts, best_direct["rho"])
    for name, ids, u in (("valid", corpus.valid, u_cache[("valid", best_direct["rho"])]), ("test", corpus.test, u_test)):
        lp[name]["direct"] = direct_logprob(lp[name]["KN"], ids, u, Pc[name], sem.cluster, best_direct["beta"])
    best_direct["test_ppl"] = perplexity(lp["test"]["direct"])
    log(f"direct glow: rho={best_direct['rho']} beta={best_direct['beta']} valid {best_direct['valid_ppl']:.2f} test {best_direct['test_ppl']:.2f}")
    # direct glow + in-context table: P = [P' + e^kappa Q_ind] / (1 + e^kappa), kappa tuned on valid
    kap_rows = []
    for kappa in [-3.0, -2.0, -1.0, 0.0, 1.0]:
        q, has = prep["valid"]["q_ind"], prep["valid"]["has_ind"]
        wgt = np.exp(kappa) * has
        l = np.log((np.exp(lp["valid"]["direct"]) + wgt * q) / (1.0 + wgt))
        kap_rows.append({"kappa": kappa, "valid_ppl": perplexity(l)})
    bk = min(kap_rows, key=lambda r: r["valid_ppl"])
    for name in streams:
        q, has = prep[name]["q_ind"], prep[name]["has_ind"]
        wgt = np.exp(bk["kappa"]) * has
        lp[name]["direct+table"] = np.log((np.exp(lp[name]["direct"]) + wgt * q) / (1.0 + wgt))
    bk["test_ppl"] = perplexity(lp["test"]["direct+table"])
    log(f"direct glow + table: kappa={bk['kappa']} valid {bk['valid_ppl']:.2f} test {bk['test_ppl']:.2f}")
    R["direct_glow"] = {"best": best_direct, "grid_valid": rows, "with_table": {**bk, "grid_valid": kap_rows}}
    R["test_ppl"] = {k: perplexity(v) for k, v in lp["test"].items()}
    R["valid_ppl"] = {k: perplexity(v) for k, v in lp["valid"].items()}

    # ------------------------------------------------------- bootstrap
    blocks = article_blocks(len(corpus.test), corpus.test_starts)
    pairs = [("static", "KN"), ("glow", "static"), ("glow", "KN"), ("direct", "KN"), ("direct", "glow"),
             ("glow+table", "KN"), ("glow+table", "glow"), ("direct+table", "glow+table")]
    R["bootstrap"] = {f"{a} vs {b}": paired_bootstrap(lp["test"][a], lp["test"][b], blocks, args.bootstrap, rng) for a, b in pairs}
    for k, v in R["bootstrap"].items():
        log(f"bootstrap {k}: ratio {v['ppl_ratio']:.4f} CI95 [{v['ci95'][0]:.4f}, {v['ci95'][1]:.4f}] p(not better)={v['p_not_better']:.3f}")

    # ------------------------------------------------------- cloze for direct glow
    content_mask = np.zeros(V, dtype=bool)
    content_mask[:M] = [corpus.is_content_word(i) for i in range(M)]
    positions = select_cloze_positions(content_mask, corpus.test, args.cloze_n, np.random.default_rng(args.seed))
    configs = [{"name": "KN", "tau": None},
               {"name": "direct glow", "tau": None, "direct": True, "beta": best_direct["beta"], "rho": best_direct["rho"]}]
    R["cloze"] = cloze_eval(model, corpus.test, corpus.test_starts, positions, configs, M)
    for name, d in R["cloze"].items():
        log(f"cloze {name}: left acc@1 {d['left']['acc@1']:.3f} acc@10 {d['left']['acc@10']:.3f} mrr {d['left']['mrr']:.3f} | "
            f"bidir acc@1 {d['bidir']['acc@1']:.3f} acc@10 {d['bidir']['acc@10']:.3f} mrr {d['bidir']['mrr']:.3f}")

    R["runtime_sec"] = time.time() - T0
    json.dump(R, open(os.path.join(args.out_dir, "extras.json"), "w"), indent=1, default=float)
    L = ["# Extras: direct glow field and significance tests\n",
         f"Same data and hyper-parameters as the main run (`results/report.md`). Runtime {R['runtime_sec']/60:.1f} min.\n",
         "## Test perplexity\n", "| model | valid PPL | test PPL |", "|---|---|---|"]
    names = {"KN": f"Kneser-Ney {args.order}-gram", "static": "static semantic routes", "glow": "glow via semantic routes (original design)",
             "glow+table": "glow + in-context successor table", "direct": f"direct glow on all candidates (rho={best_direct['rho']}, beta={best_direct['beta']})",
             "direct+table": f"direct glow + in-context successor table (kappa={bk['kappa']})"}
    for k in ["KN", "static", "glow", "direct", "glow+table", "direct+table"]:
        L.append(f"| {names[k]} | {R['valid_ppl'][k]:.2f} | {R['test_ppl'][k]:.2f} |")
    L += ["", f"## Paired bootstrap over {len(blocks)} test articles ({args.bootstrap} resamples)\n",
          "| comparison | PPL ratio | 95% CI | p(not better) |", "|---|---|---|---|"]
    for k, v in R["bootstrap"].items():
        L.append(f"| {k} | {v['ppl_ratio']:.4f} | [{v['ci95'][0]:.4f}, {v['ci95'][1]:.4f}] | {v['p_not_better']:.3f} |")
    L += ["", "## Cloze with the direct glow field\n", "| model | left acc@1 | left acc@10 | left MRR | bidir acc@1 | bidir acc@10 | bidir MRR |", "|---|---|---|---|---|---|---|"]
    for name, d in R["cloze"].items():
        l, b = d["left"], d["bidir"]
        L.append(f"| {name} | {l['acc@1']:.3f} | {l['acc@10']:.3f} | {l['mrr']:.3f} | {b['acc@1']:.3f} | {b['acc@10']:.3f} | {b['mrr']:.3f} |")
    L += ["", "## Direct glow validation grid\n", "| rho | beta | valid PPL |", "|---|---|---|"]
    L += [f"| {r['rho']} | {r['beta']} | {r['valid_ppl']:.2f} |" for r in rows]
    open(os.path.join(args.out_dir, "extras.md"), "w").write("\n".join(L) + "\n")
    log("done")


if __name__ == "__main__":
    main()
