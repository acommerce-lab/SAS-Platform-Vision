#!/usr/bin/env python3
"""A fairer test of the ORIGINAL routing design (semantic child -> its contextual child).

The first run tested one arbitrary configuration (K = 20 children, one global tax, near-uniform weights, children
chosen by symmetric-window similarity).  This script keeps the design and varies only how it is instantiated:

  children      sym   cosine in the SVD of the symmetric +-5 window PPMI matrix (the first run's "distrib")
                succ  tokens with similar SUCCESSOR profiles (what follows them)
                pred  tokens with similar PREDECESSOR profiles (what precedes them)
                both  similar in both profiles (one distributional class)
  K             number of children used (1, 5, 10, 20, 40)
  gamma         sharpening exponent on the similarity weight (1 ... 32)
  tax           one global tau, or one tau per bucket of how often the n-gram history was seen in training
                (routes can then act only where the contextual evidence is thin, as in Dagan, Lee & Pereira 1999)

Everything stays count-based and exact; tuning on validation, test scored once.  Substitution route, no glow.
Writes results/routes.json and results/routes.md.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time

import numpy as np
import scipy.sparse as sp

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from run_extras import article_blocks, paired_bootstrap  # noqa: E402
from tglm import semantic as S  # noqa: E402
from tglm.data import Corpus  # noqa: E402
from tglm.model import GlowLM  # noqa: E402
from tglm.ngram import KNLM, perplexity  # noqa: E402

T0 = time.time()


def log(msg: str) -> None:
    print(f"[{time.time() - T0:7.1f}s] {msg}", flush=True)


class KNTop:
    """A fitted KNLM seen as a model of a lower top order (GlowLM reads ``N``)."""

    def __init__(self, kn: KNLM, top: int):
        self.kn, self.N, self.V = kn, top, kn.V
        self.stats, self.uniq = kn.stats, kn.uniq

    def stream_history(self, ids, top=None):
        return self.kn.stream_history(ids, top or self.N)

    def prob(self, top, hist, w):
        return self.kn.prob(top, hist, w)

    def _lookup(self, n, keys):
        return self.kn._lookup(n, keys)


def successor_counts(ids: np.ndarray, M: int, chunk: int = 25_000_000) -> sp.csr_matrix:
    """R[w, v] = number of times v immediately follows w (both among the top-M tokens)."""
    ids = np.asarray(ids, dtype=np.int64)
    total = sp.csr_matrix((M, M), dtype=np.float32)
    for s0 in range(0, len(ids) - 1, chunk):
        a, b = ids[s0:s0 + chunk], ids[s0 + 1:s0 + chunk + 1]
        a = a[:len(b)]
        keep = (a < M) & (b < M)
        total = total + sp.coo_matrix((np.ones(int(keep.sum()), dtype=np.float32), (a[keep], b[keep])), shape=(M, M)).tocsr()
    return total


def unit(E):
    return E / np.maximum(np.linalg.norm(E, axis=1, keepdims=True), 1e-8)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default=os.path.join(os.path.dirname(__file__), "data", "wikitext-103-v1"))
    ap.add_argument("--out-dir", default=os.path.join(os.path.dirname(__file__), "results"))
    ap.add_argument("--max-train-tokens", type=int, default=None)
    ap.add_argument("--M", type=int, default=30000)
    ap.add_argument("--window", type=int, default=5)
    ap.add_argument("--dim", type=int, default=200)
    ap.add_argument("--bootstrap", type=int, default=2000)
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()
    rng = np.random.default_rng(args.seed)
    R: dict = {"args": vars(args)}
    KMAX = 40

    corpus = Corpus(args.data_dir, max_train_tokens=args.max_train_tokens)
    V = corpus.V
    M = min(args.M, V)
    kn = KNLM(4).fit(corpus.train, V)
    log("KN-4 fitted")

    # ------------------------------------------------------------ children
    C = S.cooccurrence(corpus.train, M, args.window)
    E_sym = unit(S.svd_embed(S.ppmi(C), args.dim, seed=args.seed))
    del C
    Rm = successor_counts(corpus.train, M)
    E_succ = unit(S.svd_embed(S.ppmi(Rm), args.dim, seed=args.seed))
    E_pred = unit(S.svd_embed(S.ppmi(Rm.T.tocsr()), args.dim, seed=args.seed))
    del Rm
    corpus.train = None
    embeds = {"sym": E_sym, "succ": E_succ, "pred": E_pred, "both": np.concatenate([E_succ, E_pred], axis=1)}
    nbrs = {name: S.cosine_neighbors(E, KMAX) for name, E in embeds.items()}
    probes = ["king", "river", "said", "doctor", "the", "in", "football"]
    R["children_examples"] = {}
    for w in probes:
        if w in corpus.word2id and corpus.word2id[w] < M:
            i = corpus.word2id[w]
            R["children_examples"][w] = {name: [corpus.vocab[j] for j in nb[0][i][:8]] for name, nb in nbrs.items()}
            log(f"{w!r}: " + " | ".join(f"{name}: {', '.join(R['children_examples'][w][name][:6])}" for name in nbrs))
    overlap = {a + "/" + b: float(np.mean([len(set(nbrs[a][0][i]) & set(nbrs[b][0][i])) / KMAX for i in range(0, M, 7)]))
               for a, b in [("sym", "succ"), ("sym", "pred"), ("succ", "pred")]}
    R["children_overlap"] = overlap
    log(f"mean overlap of the {KMAX} children: {overlap}")
    dummy_labels = np.zeros(M, dtype=np.int32)
    dummy_A = np.zeros((1, 1), dtype=np.float32)

    streams = {"valid": (corpus.valid, corpus.valid_starts), "test": (corpus.test, corpus.test_starts)}
    blocks = article_blocks(len(corpus.test), corpus.test_starts)
    taus = [-3.0, -2.0, -1.0, 0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 8.0, 10.0, 12.0, 30.0]   # 30 = route closed
    gammas = [1.0, 2.0, 4.0, 8.0, 16.0, 32.0]
    Ks = [1, 5, 10, 20, 40]
    edges = [1, 3, 10, 100]                      # history-count buckets: unseen | 1-2 | 3-9 | 10-99 | >=100
    bucket_names = ["unseen", "1-2", "3-9", "10-99", ">=100"]
    R["experiments"] = {}
    R["baseline"] = {}
    for order in (3, 4):
        knv = KNTop(kn, order)
        hist = {name: knv.stream_history(ids) for name, (ids, _) in streams.items()}
        # bucket of each position by the training count of its full n-gram history
        bucket = {}
        for name in streams:
            h = hist[name][order]
            cnt = np.where(h >= 0, kn.stats[(order, "raw")]["total"][np.maximum(h, 0)], 0.0)
            bucket[name] = np.where(h < 0, 0, 1 + np.searchsorted(np.asarray(edges[1:]), cnt, side="right")).astype(np.int64)
        lp_kn = {name: np.log(knv.prob(order, hist[name], ids)) for name, (ids, _) in streams.items()}
        R["baseline"][f"KN-{order}"] = {"valid_ppl": perplexity(lp_kn["valid"]), "test_ppl": perplexity(lp_kn["test"]),
                                         "test_bucket_share": {bucket_names[b]: float(np.mean(bucket["test"] == b)) for b in range(5)},
                                         "test_bucket_ppl": {bucket_names[b]: float(np.exp(-lp_kn["test"][bucket["test"] == b].mean())) for b in range(5)}}
        log(f"KN-{order}: valid {perplexity(lp_kn['valid']):.2f} test {perplexity(lp_kn['test']):.2f} buckets {R['baseline'][f'KN-{order}']['test_bucket_share']}")
        for cname, (nbr, wgt) in nbrs.items():
            sem = S.SemanticGraph(V, M, nbr, wgt, dummy_labels, dummy_A)
            model = GlowLM(knv, sem, "sub")
            prep = {name: model.prepare_stream(ids, hist[name]) for name, (ids, _) in streams.items()}

            def score(name, K, gamma, tau_vec):
                """log P with per-position tax tau_vec (array) using the first K children and weights^gamma."""
                sw = prep[name]["sw"][:, :K].astype(np.float64) ** gamma
                om = sw * np.exp(-tau_vec)[:, None]
                return np.log((prep[name]["p_direct"] + (om * prep[name]["qs"][:, :K]).sum(axis=1)) / (1.0 + om.sum(axis=1)))

            best, best_g = None, None
            nv = len(corpus.valid)
            for K in Ks:
                for gamma in gammas:
                    # per-bucket log-likelihood for every tau: buckets are independent, so each is tuned separately
                    ll = np.zeros((len(taus), 5))
                    for ti, tau in enumerate(taus):
                        lp = score("valid", K, gamma, np.full(nv, tau))
                        ll[ti] = np.bincount(bucket["valid"], weights=lp, minlength=5)
                    g = int(np.argmax(ll.sum(axis=1)))
                    pg = float(np.exp(-ll[g].sum() / nv))
                    pb = float(np.exp(-ll.max(axis=0).sum() / nv))
                    if best_g is None or pg < best_g["valid_ppl_global"]:
                        best_g = {"K": K, "gamma": gamma, "tau_global": taus[g], "valid_ppl_global": pg}
                    if best is None or pb < best["valid_ppl_bucket"]:
                        best = {"K": K, "gamma": gamma, "tau_bucket": [taus[int(i)] for i in np.argmax(ll, axis=0)], "valid_ppl_bucket": pb}
            nt = len(corpus.test)
            bg = best_g
            lp_g = score("test", bg["K"], bg["gamma"], np.full(nt, bg["tau_global"]))
            lp_b = score("test", best["K"], best["gamma"], np.asarray(best["tau_bucket"])[bucket["test"]])
            res = {"global": {**bg, "test_ppl": perplexity(lp_g), "vs_kn": paired_bootstrap(lp_g, lp_kn["test"], blocks, args.bootstrap, rng)},
                   "bucketed": {"K": best["K"], "gamma": best["gamma"], "tau_bucket": dict(zip(bucket_names, best["tau_bucket"])),
                                "valid_ppl": best["valid_ppl_bucket"], "test_ppl": perplexity(lp_b),
                                "vs_kn": paired_bootstrap(lp_b, lp_kn["test"], blocks, args.bootstrap, rng),
                                "test_ppl_by_bucket": {bucket_names[b]: float(np.exp(-lp_b[bucket["test"] == b].mean())) for b in range(5)}}}
            R["experiments"][f"KN-{order} | {cname}"] = res
            log(f"KN-{order} children={cname}: global K={bg['K']} gamma={bg['gamma']} tau={bg['tau_global']} test {res['global']['test_ppl']:.2f} "
                f"| bucketed K={best['K']} gamma={best['gamma']} tau={best['tau_bucket']} test {res['bucketed']['test_ppl']:.2f} "
                f"(ratio {res['bucketed']['vs_kn']['ppl_ratio']:.4f})")
            del prep, model
    R["runtime_sec"] = time.time() - T0
    json.dump(R, open(os.path.join(args.out_dir, "routes.json"), "w"), indent=1, default=float)

    L = ["# The original routing design under fairer instantiations\n",
         f"Substitution route, no glow, count-based only. Runtime {R['runtime_sec'] / 60:.1f} min. PPL ratio is against the Kneser-Ney base of the same order (paired bootstrap, 95% CI).\n",
         "| base | children | tax | K | gamma | tuned tau | test PPL | PPL ratio vs base |", "|---|---|---|---|---|---|---|---|"]
    for order in (3, 4):
        b = R["baseline"][f"KN-{order}"]
        L.append(f"| KN-{order} | - | - | - | - | - | {b['test_ppl']:.2f} | 1 |")
        for cname in nbrs:
            e = R["experiments"][f"KN-{order} | {cname}"]
            g, k = e["global"], e["bucketed"]
            L.append(f"| KN-{order} | {cname} | global | {g['K']} | {g['gamma']} | {g['tau_global']} | {g['test_ppl']:.2f} | {g['vs_kn']['ppl_ratio']:.4f} [{g['vs_kn']['ci95'][0]:.4f}, {g['vs_kn']['ci95'][1]:.4f}] |")
            L.append(f"| KN-{order} | {cname} | per history-count bucket | {k['K']} | {k['gamma']} | {' / '.join(str(v) for v in k['tau_bucket'].values())} | {k['test_ppl']:.2f} | {k['vs_kn']['ppl_ratio']:.4f} [{k['vs_kn']['ci95'][0]:.4f}, {k['vs_kn']['ci95'][1]:.4f}] |")
    L.append("\nBuckets (training count of the n-gram history): " + " / ".join(bucket_names) + ". tau = 30 means the route is closed in that bucket.\n")
    for order in (3, 4):
        b = R["baseline"][f"KN-{order}"]
        L.append(f"KN-{order} test positions per bucket: " + ", ".join(f"{k} {100 * v:.1f}% (PPL {b['test_bucket_ppl'][k]:.0f})" for k, v in b["test_bucket_share"].items()))
    L.append("\n## Children examples\n")
    for w, d in R["children_examples"].items():
        L.append(f"- **{w}**: " + "; ".join(f"{name}: {', '.join(v[:6])}" for name, v in d.items()))
    L.append(f"\nMean overlap between the {KMAX} children of a token under two definitions: " + ", ".join(f"{k} {v:.2f}" for k, v in R["children_overlap"].items()))
    open(os.path.join(args.out_dir, "routes.md"), "w").write("\n".join(L) + "\n")
    log("done")


if __name__ == "__main__":
    main()
