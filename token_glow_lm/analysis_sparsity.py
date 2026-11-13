#!/usr/bin/env python3
"""How counting-based estimation scales with data on WikiText-103.

For growing training prefixes: Kneser-Ney perplexity (orders 2-4), the share of test positions whose history
of length 1/2/3 occurs in training, and perplexity split by whether the trigram history was seen.  At full
size also the share of seen histories of length 4 and 5.  Writes results/sparsity.md and results/sparsity.json.
"""
from __future__ import annotations

import json
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tglm.data import Corpus  # noqa: E402
from tglm.ngram import KNLM, perplexity  # noqa: E402

T0 = time.time()


def log(m):
    print(f"[{time.time()-T0:7.1f}s] {m}", flush=True)


def seen_long_histories(train: np.ndarray, test: np.ndarray, V: int, max_len: int) -> dict[int, float]:
    """Share of test positions whose preceding n tokens (n = 4..max_len) occur as a sequence in training."""
    train = train.astype(np.int64); test = test.astype(np.int64)
    out = {}
    prev_tr = train.copy()                       # index of the n-gram ending at each training position
    prev_te = test.copy()
    for n in range(2, max_len + 1):
        valid = prev_tr[:-1] >= 0
        keys = prev_tr[:-1][valid] * V + train[1:][valid]
        uniq, inverse = np.unique(keys, return_inverse=True)
        cur_tr = np.full(len(train), -1, np.int64); cur_tr[1:][valid] = inverse
        del keys, inverse
        v2 = prev_te[:-1] >= 0
        k2 = prev_te[:-1][v2] * V + test[1:][v2]
        j = np.searchsorted(uniq, k2); jc = np.minimum(j, len(uniq) - 1)
        found = uniq[jc] == k2
        cur_te = np.full(len(test), -1, np.int64); cur_te[1:][v2] = np.where(found, jc, -1)
        # history of length n for position i+1 is the n-gram ending at i
        out[n] = float(np.mean(cur_te[:-1] >= 0))
        prev_tr, prev_te = cur_tr, cur_te
        del uniq
    return out


def main():
    data_dir = os.path.join(os.path.dirname(__file__), "data", "wikitext-103-v1")
    out_dir = os.path.join(os.path.dirname(__file__), "results")
    quick = "--quick" in sys.argv                      # smoke test on tiny prefixes
    corpus = Corpus(data_dir, max_train_tokens=600_000 if quick else None)
    V, test = corpus.V, corpus.test
    sizes = [200_000, 400_000, 600_000] if quick else [1_000_000, 3_000_000, 10_000_000, 30_000_000, len(corpus.train)]
    if quick:
        out_dir = os.path.join(out_dir, "smoke"); os.makedirs(out_dir, exist_ok=True)
    rows = []
    fixed_mask = None
    for N in sizes:
        kn = KNLM(4).fit(corpus.train[:N], V)
        hist = kn.stream_history(test, 4)
        row = {"train_tokens": N}
        for top in (2, 3, 4):
            row[f"ppl_kn{top}"] = perplexity(np.log(kn.prob(top, hist, test)))
        seen_type = kn.counts[(1, "raw")] > 0                      # token types that occur in this prefix
        prev_seen = np.concatenate([[False], seen_type[test[:-1]]])
        row["seen_hist_len1"] = float(np.mean(prev_seen))          # previous token occurs in the prefix
        for n in (3, 4):
            row[f"seen_hist_len{n-1}"] = float(np.mean(hist[n] >= 0))
        # closed-vocabulary effect: test tokens whose TYPE never occurs in the prefix fall to the uniform floor
        tgt_seen = seen_type[test]
        row["share_target_type_unseen"] = float(1.0 - tgt_seen.mean())
        lp4 = np.log(kn.prob(4, hist, test))
        if fixed_mask is None:
            fixed_mask = tgt_seen.copy()               # positions whose target type occurs in the SMALLEST prefix
        row["fixed_subset_share"] = float(fixed_mask.mean())
        row["ppl_kn4_fixed_subset"] = float(np.exp(-lp4[fixed_mask].mean()))
        lp3 = np.log(kn.prob(3, hist, test)); m = hist[3] >= 0
        row["ppl_kn3_seen_trigram_hist"] = float(np.exp(-lp3[m].mean()))
        row["ppl_kn3_unseen_trigram_hist"] = float(np.exp(-lp3[~m].mean()))
        row["unique_bigrams"] = int(len(kn.uniq[2])); row["unique_trigrams"] = int(len(kn.uniq[3])); row["unique_4grams"] = int(len(kn.uniq[4]))
        rows.append(row)
        log(" ".join(f"{k}={v:.4g}" if isinstance(v, float) else f"{k}={v}" for k, v in row.items()))
        del kn, hist
    prev_path = os.path.join(out_dir, "sparsity.json")
    if os.path.exists(prev_path) and "seen_history_full_data" in json.load(open(prev_path)):
        long_seen = {int(k): v for k, v in json.load(open(prev_path))["seen_history_full_data"].items()}   # unchanged, reuse
    else:
        long_seen = seen_long_histories(corpus.train, test, V, 6)
    log(f"seen histories (full data): {long_seen}")
    Ns = np.array([r["train_tokens"] for r in rows], dtype=np.float64)

    def fit(key):
        y = np.log([r[key] for r in rows])
        slope, intercept = np.polyfit(np.log(Ns), y, 1)
        local = [float((y[i + 1] - y[i]) / (np.log(Ns[i + 1]) - np.log(Ns[i]))) for i in range(len(Ns) - 1)]
        cross = float(np.exp((np.log(18.3) - intercept) / slope))            # tokens at which the fitted line reaches 18.3
        last = (float(Ns[-1]), float(np.exp(y[-1])))
        rng_ = [float(last[0] * (18.3 / last[1]) ** (1.0 / sl)) for sl in (min(local), max(local))]
        return {"slope": float(slope), "local_slopes": local, "tokens_for_ppl_18.3": cross, "range_from_local_slopes": sorted(rng_),
                "extrapolation": {f"{int(n):.0e}": float(np.exp(intercept + slope * np.log(n))) for n in (1e9, 1e10, 1e11, 1e12)}}

    fits = {k: fit(k) for k in ("ppl_kn2", "ppl_kn3", "ppl_kn4", "ppl_kn4_fixed_subset")}
    slope = fits["ppl_kn4"]["slope"]
    extrap = fits["ppl_kn4"]["extrapolation"]
    R = {"rows": rows, "seen_history_full_data": long_seen, "loglog_slope_kn4": float(slope), "naive_extrapolation_kn4": extrap, "fits": fits}
    json.dump(R, open(os.path.join(out_dir, "sparsity.json"), "w"), indent=1)
    L = ["# Counting versus data size on WikiText-103\n",
         "| train tokens | KN-2 PPL | KN-3 PPL | KN-4 PPL | KN-4 PPL on the fixed subset | test tokens whose type is absent from the prefix | previous token seen | 2-token history seen | 3-token history seen | KN-3 PPL, seen 2-token history | KN-3 PPL, unseen | unique bigrams | unique trigrams | unique 4-grams |",
         "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for r in rows:
        L.append(f"| {r['train_tokens']:,} | {r['ppl_kn2']:.1f} | {r['ppl_kn3']:.1f} | {r['ppl_kn4']:.1f} | {r['ppl_kn4_fixed_subset']:.1f} | {100 * r['share_target_type_unseen']:.2f}% | {r['seen_hist_len1']:.3f} | {r['seen_hist_len2']:.3f} | {r['seen_hist_len3']:.3f} | {r['ppl_kn3_seen_trigram_hist']:.1f} | {r['ppl_kn3_unseen_trigram_hist']:.1f} | {r['unique_bigrams']:,} | {r['unique_trigrams']:,} | {r['unique_4grams']:,} |")
    L.append("\nEvery prefix model is scored with the full 267,735-word vocabulary, so part of the improvement with data is vocabulary acquisition; the fixed-subset column scores, at every size, only the test positions whose target type already occurs in the smallest prefix, which removes that part.\n")
    L.append("Share of test positions whose preceding n tokens occur as a sequence in the full training set:\n")
    L.append("| n | " + " | ".join(str(n) for n in long_seen) + " |")
    L.append("|---|" + "---|" * len(long_seen))
    L.append("| share | " + " | ".join(f"{v:.3f}" for v in long_seen.values()) + " |")
    L.append("\n## Log-log fits of perplexity against training size\n")
    L.append("| curve | fitted slope | local slopes between successive sizes | tokens at which the fitted line reaches PPL 18.3 | range using the steepest and shallowest local slope |")
    L.append("|---|---|---|---|---|")
    names = {"ppl_kn2": "KN-2", "ppl_kn3": "KN-3", "ppl_kn4": "KN-4", "ppl_kn4_fixed_subset": "KN-4, fixed subset"}
    for k, f in fits.items():
        L.append(f"| {names[k]} | {f['slope']:.3f} | {', '.join(f'{x:.3f}' for x in f['local_slopes'])} | {f['tokens_for_ppl_18.3']:.2e} | {f['range_from_local_slopes'][0]:.1e} to {f['range_from_local_slopes'][1]:.1e} |")
    L.append("\nThe extrapolations assume a power law with no floor, 2.6 decades beyond the measured range. KN-2 and KN-3 visibly flatten in range; KN-4 does not, so these data do not locate its floor. A fixed-order model is bounded below by the order-n conditional entropy, and the usable order grows only like log(N)/H.\n")
    open(os.path.join(out_dir, "sparsity.md"), "w").write("\n".join(L) + "\n")
    log("done")


if __name__ == "__main__":
    main()
