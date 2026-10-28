"""Interpolated modified Kneser-Ney n-gram language model on sorted integer tables.

Every n-gram (n >= 2) is stored as a 64-bit key ``prefix_index * V + word`` where
``prefix_index`` is the dense index of the (n-1)-gram preceding the word in the
order-(n-1) table (for n == 2 the prefix index is the word id itself).  Because
the keys are sorted, all successors of a history occupy one contiguous block,
which makes both point lookups (``searchsorted``) and full next-token
distributions cheap.

Discounting follows Chen & Goodman (1999): raw counts at the top order,
continuation counts (number of distinct left extensions) at lower orders, three
discounts D1/D2/D3+ per order estimated from counts-of-counts, and a uniform
distribution as the final back-off below the unigram.
"""
from __future__ import annotations

import numpy as np


def _discounts(counts: np.ndarray) -> tuple[float, float, float]:
    n1 = float(np.count_nonzero(counts == 1))
    n2 = float(np.count_nonzero(counts == 2))
    n3 = float(np.count_nonzero(counts == 3))
    n4 = float(np.count_nonzero(counts == 4))
    if n1 == 0 or n2 == 0:
        return 0.5, 1.0, 1.5
    y = n1 / (n1 + 2.0 * n2)
    d1 = 1.0 - 2.0 * y * n2 / n1
    d2 = 2.0 - 3.0 * y * n3 / n2 if n2 > 0 else 1.0
    d3 = 3.0 - 4.0 * y * n4 / n3 if n3 > 0 else 1.5
    clip = lambda d, lo, hi: float(min(max(d, lo), hi))
    return clip(d1, 0.0, 1.0), clip(d2, 0.0, 2.0), clip(d3, 0.0, 3.0)


class KNLM:
    """Modified Kneser-Ney model of a given maximum order."""

    def __init__(self, order: int):
        assert order >= 2
        self.N = order

    # ------------------------------------------------------------------ fit
    def fit(self, ids: np.ndarray, V: int) -> "KNLM":
        ids = np.asarray(ids, dtype=np.int64)
        T = len(ids)
        self.V = V
        self.T = T
        self.uniq: dict[int, np.ndarray] = {}
        self.counts: dict[tuple[int, str], np.ndarray] = {}
        self.stats: dict[tuple[int, str], dict[str, np.ndarray]] = {}
        self.D: dict[tuple[int, str], tuple[float, float, float]] = {}

        self.counts[(1, "raw")] = np.bincount(ids, minlength=V).astype(np.int64)
        prev_idx = ids.copy()  # dense index of the (n-1)-gram ending at each position
        for n in range(2, self.N + 1):
            valid = prev_idx[:-1] >= 0
            keys = prev_idx[:-1][valid] * V + ids[1:][valid]
            uniq, inverse, cnt = np.unique(keys, return_inverse=True, return_counts=True)
            del keys
            self.uniq[n] = uniq
            self.counts[(n, "raw")] = cnt.astype(np.int64)
            # continuation counts of order n-1: distinct left extensions of each (n-1)-gram
            suffix = np.empty(len(uniq), dtype=np.int64)
            suffix[inverse] = prev_idx[1:][valid]  # (n-1)-gram ending at the same position
            size_prev = V if n == 2 else len(self.uniq[n - 1])
            self.counts[(n - 1, "cc")] = np.bincount(suffix, minlength=size_prev).astype(np.int64)
            del suffix
            cur_idx = np.full(T, -1, dtype=np.int64)
            cur_idx[1:][valid] = inverse
            del inverse
            prev_idx = cur_idx
        del prev_idx

        # history statistics for every (order, count mode)
        for (n, mode), cnt in list(self.counts.items()):
            if n == 1:
                self.D[(n, mode)] = _discounts(cnt)
                continue
            prefix = self.uniq[n] // V
            size_prev = V if n == 2 else len(self.uniq[n - 1])
            st = {
                "total": np.bincount(prefix, weights=cnt, minlength=size_prev),
                "n1": np.bincount(prefix[cnt == 1], minlength=size_prev).astype(np.float64),
                "n2": np.bincount(prefix[cnt == 2], minlength=size_prev).astype(np.float64),
                "n3": np.bincount(prefix[cnt >= 3], minlength=size_prev).astype(np.float64),
            }
            self.stats[(n, mode)] = st
            self.D[(n, mode)] = _discounts(cnt)
        # unigram distributions
        raw1 = self.counts[(1, "raw")].astype(np.float64)
        self.p1_raw = raw1 / raw1.sum()
        cc1 = self.counts[(1, "cc")].astype(np.float64)
        d1, d2, d3 = self.D[(1, "cc")]
        disc = np.where(cc1 >= 3, d3, np.where(cc1 == 2, d2, np.where(cc1 == 1, d1, 0.0)))
        s = cc1.sum()
        gamma = (d1 * (cc1 == 1).sum() + d2 * (cc1 == 2).sum() + d3 * (cc1 >= 3).sum()) / s
        self.p1_cc = np.maximum(cc1 - disc, 0.0) / s + gamma / V
        return self

    # ------------------------------------------------------------ utilities
    def _lookup(self, n: int, keys: np.ndarray) -> np.ndarray:
        """Dense index of each key in table n, or -1 when absent."""
        uniq = self.uniq[n]
        j = np.searchsorted(uniq, keys)
        jc = np.minimum(j, len(uniq) - 1)
        found = uniq[jc] == keys
        return np.where(found, jc, -1)

    def stream_history(self, ids: np.ndarray, top: int | None = None) -> dict[int, np.ndarray]:
        """For each position i and order n, the index of the (n-1)-gram ending at i-1.

        Returns ``hist[n][i]`` (-1 when the history is unseen or too short), which
        is exactly what :meth:`prob` needs to score ``ids[i]`` at order ``n``.
        """
        top = top or self.N
        ids = np.asarray(ids, dtype=np.int64)
        T = len(ids)
        idx = {1: ids}
        for m in range(2, top):
            prev = idx[m - 1]
            cur = np.full(T, -1, dtype=np.int64)
            valid = prev[:-1] >= 0
            cur[1:][valid] = self._lookup(m, prev[:-1][valid] * self.V + ids[1:][valid])
            idx[m] = cur
        hist = {}
        for n in range(2, top + 1):
            h = np.full(T, -1, dtype=np.int64)
            h[1:] = idx[n - 1][:-1]
            hist[n] = h
        return hist

    def history_from_context(self, context: np.ndarray, top: int | None = None) -> dict[int, int]:
        """History indices (scalar per order) for the token following ``context``."""
        top = top or self.N
        context = np.asarray(context, dtype=np.int64)
        hist = {}
        for n in range(2, top + 1):
            need = n - 1
            if len(context) < need:
                hist[n] = -1
                continue
            ctx = context[-need:]
            p = int(ctx[0])
            for m in range(2, need + 1):
                p = int(self._lookup(m, np.array([p * self.V + ctx[m - 1]]))[0])
                if p < 0:
                    break
            hist[n] = p
        return hist

    # ------------------------------------------------------------- scoring
    def prob(self, top: int, hist: dict[int, np.ndarray], w: np.ndarray) -> np.ndarray:
        """P(w | history) with raw counts at order ``top`` and continuation counts below."""
        w = np.asarray(w, dtype=np.int64)
        P = (self.p1_raw if top == 1 else self.p1_cc)[w]
        for n in range(2, top + 1):
            mode = "raw" if n == top else "cc"
            st = self.stats[(n, mode)]
            d1, d2, d3 = self.D[(n, mode)]
            p = np.asarray(hist[n], dtype=np.int64)
            ok = p >= 0
            pc = np.where(ok, p, 0)
            tot = np.where(ok, st["total"][pc], 0.0)
            ok = ok & (tot > 0)
            j = self._lookup(n, pc * self.V + w)
            c = np.where((j >= 0) & ok, self.counts[(n, mode)][np.maximum(j, 0)], 0).astype(np.float64)
            disc = np.where(c >= 3, d3, np.where(c == 2, d2, np.where(c == 1, d1, 0.0)))
            safe_tot = np.where(ok, tot, 1.0)
            num = np.where(ok, np.maximum(c - disc, 0.0) / safe_tot, 0.0)
            gamma = np.where(ok, (d1 * st["n1"][pc] + d2 * st["n2"][pc] + d3 * st["n3"][pc]) / safe_tot, 1.0)
            P = num + gamma * P
        return P

    def dist(self, top: int, hist: dict[int, int]) -> np.ndarray:
        """Full next-token distribution (dense, length V) for scalar history indices."""
        P = (self.p1_raw if top == 1 else self.p1_cc).copy()
        for n in range(2, top + 1):
            p = int(hist[n])
            if p < 0:
                continue
            mode = "raw" if n == top else "cc"
            st = self.stats[(n, mode)]
            tot = st["total"][p]
            if tot <= 0:
                continue
            d1, d2, d3 = self.D[(n, mode)]
            uniq = self.uniq[n]
            lo, hi = np.searchsorted(uniq, [p * self.V, (p + 1) * self.V])
            ws = uniq[lo:hi] % self.V
            c = self.counts[(n, mode)][lo:hi].astype(np.float64)
            disc = np.where(c >= 3, d3, np.where(c == 2, d2, np.where(c == 1, d1, 0.0)))
            gamma = (d1 * st["n1"][p] + d2 * st["n2"][p] + d3 * st["n3"][p]) / tot
            P *= gamma
            P[ws] += np.maximum(c - disc, 0.0) / tot
        return P

    def logprob_stream(self, ids: np.ndarray, top: int | None = None) -> np.ndarray:
        top = top or self.N
        hist = self.stream_history(ids, top)
        return np.log(self.prob(top, hist, ids))


def perplexity(logp: np.ndarray) -> float:
    return float(np.exp(-np.mean(logp)))
