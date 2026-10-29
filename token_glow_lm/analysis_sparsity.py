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
    corpus = Corpus(data_dir)
    V, test = corpus.V, corpus.test
    sizes = [1_000_000, 3_000_000, 10_000_000, 30_000_000, len(corpus.train)]
    rows = []
    for N in sizes:
        kn = KNLM(4).fit(corpus.train[:N], V)
        hist = kn.stream_history(test, 4)
        row = {"train_tokens": N}
        for top in (2, 3, 4):
            row[f"ppl_kn{top}"] = perplexity(np.log(kn.prob(top, hist, test)))
        for n in (2, 3, 4):
            row[f"seen_hist_len{n-1}"] = float(np.mean(hist[n] >= 0))
        lp3 = np.log(kn.prob(3, hist, test)); m = hist[3] >= 0
        row["ppl_kn3_seen_trigram_hist"] = float(np.exp(-lp3[m].mean()))
        row["ppl_kn3_unseen_trigram_hist"] = float(np.exp(-lp3[~m].mean()))
        row["unique_bigrams"] = int(len(kn.uniq[2])); row["unique_trigrams"] = int(len(kn.uniq[3])); row["unique_4grams"] = int(len(kn.uniq[4]))
        rows.append(row)
        log(" ".join(f"{k}={v:.4g}" if isinstance(v, float) else f"{k}={v}" for k, v in row.items()))
        del kn, hist
    long_seen = seen_long_histories(corpus.train, test, V, 6)
    log(f"seen histories (full data): {long_seen}")
    # naive log-log fit of KN-4 perplexity against data size
    x = np.log([r["train_tokens"] for r in rows]); y = np.log([r["ppl_kn4"] for r in rows])
    slope, intercept = np.polyfit(x, y, 1)
    extrap = {f"{int(n):.0e}": float(np.exp(intercept + slope * np.log(n))) for n in (1e9, 1e10, 1e11, 1e12)}
    R = {"rows": rows, "seen_history_full_data": long_seen, "loglog_slope_kn4": float(slope), "naive_extrapolation_kn4": extrap}
    json.dump(R, open(os.path.join(out_dir, "sparsity.json"), "w"), indent=1)
    L = ["# Counting versus data size on WikiText-103\n",
         "| train tokens | KN-2 PPL | KN-3 PPL | KN-4 PPL | seen history len 1 | len 2 | len 3 | KN-3 PPL, seen trigram history | KN-3 PPL, unseen | unique bigrams | unique trigrams | unique 4-grams |",
         "|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for r in rows:
        L.append(f"| {r['train_tokens']:,} | {r['ppl_kn2']:.1f} | {r['ppl_kn3']:.1f} | {r['ppl_kn4']:.1f} | {r['seen_hist_len1']:.3f} | {r['seen_hist_len2']:.3f} | {r['seen_hist_len3']:.3f} | {r['ppl_kn3_seen_trigram_hist']:.1f} | {r['ppl_kn3_unseen_trigram_hist']:.1f} | {r['unique_bigrams']:,} | {r['unique_trigrams']:,} | {r['unique_4grams']:,} |")
    L.append("\nShare of test positions whose preceding n tokens occur as a sequence in the full training set:\n")
    L.append("| n | " + " | ".join(str(n) for n in long_seen) + " |")
    L.append("|---|" + "---|" * len(long_seen))
    L.append("| share | " + " | ".join(f"{v:.3f}" for v in long_seen.values()) + " |")
    L.append(f"\nLog-log slope of KN-4 perplexity against training size: {slope:.3f}. Naive power-law extrapolation of KN-4: "
             + ", ".join(f"{k} tokens -> {v:.1f}" for k, v in extrap.items()) + " (the true curve flattens because order-4 contexts cannot carry longer dependencies).\n")
    open(os.path.join(out_dir, "sparsity.md"), "w").write("\n".join(L) + "\n")
    log("done")


if __name__ == "__main__":
    main()
