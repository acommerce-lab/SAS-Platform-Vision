"""The token-cluster glow language model.

Next-token distribution at position i (t = previous token, h = n-gram history):

    direct route      P_KN(x | h)
    semantic routes   for every semantic child s of t:
                          omega_s = S[t,s] * exp(beta * u_i[cl(s)] - tau)
                          Q_s(x)  = P_KN(x | s)            ("bigram" route)
                                  = P_KN(x | h with t->s)  ("sub" route)
    glow field        u_i = A . hbar_i,  hbar_i = normalised decayed cluster
                      histogram of the tokens seen so far (rho = decay)
    optional          in-context successor table (what followed t earlier in the
    extension         same document), weight exp(kappa)

    P(x) = [ P_KN(x|h) + sum_s omega_s Q_s(x) + e^kappa Q_ind(x) ] / [ 1 + sum_s omega_s + e^kappa ]

All routes are proper distributions, so P is proper and the normaliser is
O(K) per position.  tau is the transition tax, beta the glow gain; with
beta = 0 the model reduces to similarity-based smoothing (Dagan, Lee & Pereira
1999) and with tau -> inf to plain Kneser-Ney.
"""
from __future__ import annotations

import numpy as np

from .ngram import KNLM
from .semantic import SemanticGraph


class GlowState:
    """Decayed cluster histogram (the glow centres) for one document."""

    def __init__(self, sem: SemanticGraph, rho: float):
        self.sem, self.rho = sem, rho
        self.h = np.zeros(sem.k, dtype=np.float64)

    def reset(self) -> None:
        self.h[:] = 0.0

    def update(self, token: int) -> None:
        self.h *= self.rho
        c = self.sem.cluster[token]
        if c >= 0:
            self.h[c] += 1.0

    def field(self) -> np.ndarray:
        """u = A . hbar  (one value per cluster; zero before any token)."""
        s = self.h.sum()
        if s <= 0:
            return np.zeros(self.sem.k, dtype=np.float64)
        return self.sem.A @ (self.h / s)


class InductionTable:
    """In-context successor counts with exponential decay (the proposed extension)."""

    def __init__(self, decay: float):
        self.decay = decay
        self.table: dict[int, dict[int, float]] = {}
        self.total: dict[int, float] = {}
        self.stamp: dict[int, int] = {}
        self.t = 0

    def reset(self) -> None:
        self.table.clear(); self.total.clear(); self.stamp.clear(); self.t = 0

    def _decay(self, prev: int) -> None:
        age = self.t - self.stamp.get(prev, self.t)
        if age > 0:
            f = self.decay**age
            row = self.table[prev]
            for k in row:
                row[k] *= f
            self.total[prev] *= f
        self.stamp[prev] = self.t

    def score(self, prev: int, nxt: int) -> tuple[float, bool]:
        if prev not in self.table:
            return 0.0, False
        self._decay(prev)
        return self.table[prev].get(nxt, 0.0) / self.total[prev], True

    def dist(self, prev: int, V: int) -> np.ndarray | None:
        if prev not in self.table:
            return None
        self._decay(prev)
        q = np.zeros(V)
        for k, v in self.table[prev].items():
            q[k] = v
        return q / self.total[prev]

    def update(self, prev: int, nxt: int) -> None:
        if prev in self.table:
            self._decay(prev)
            self.table[prev][nxt] = self.table[prev].get(nxt, 0.0) + 1.0
            self.total[prev] += 1.0
        else:
            self.table[prev] = {nxt: 1.0}
            self.total[prev] = 1.0
            self.stamp[prev] = self.t
        self.t += 1


class GlowLM:
    def __init__(self, kn: KNLM, sem: SemanticGraph, route: str = "bigram"):
        assert route in ("bigram", "sub")
        self.kn, self.sem, self.route = kn, sem, route
        self.N = kn.N
        self.V = kn.V

    # ------------------------------------------------------ static per-stream
    def prepare_stream(self, ids: np.ndarray, kn_hist: dict[int, np.ndarray] | None = None) -> dict:
        ids = np.asarray(ids, dtype=np.int64)
        T, K, V = len(ids), self.sem.K, self.V
        kn_hist = kn_hist or self.kn.stream_history(ids)
        p_direct = self.kn.prob(self.N, kn_hist, ids)
        nbr = np.full((T, K), -1, dtype=np.int64)
        sw = np.zeros((T, K), dtype=np.float32)
        n1, w1 = self.sem.neighbors_of(ids[:-1])
        nbr[1:], sw[1:] = n1, w1
        flat_s = nbr.ravel()
        flat_w = np.repeat(ids, K)
        valid = flat_s >= 0
        s_ok = np.where(valid, flat_s, 0)
        if self.route == "bigram":
            q = self.kn.prob(2, {2: s_ok}, flat_w)
        else:
            hist = {2: s_ok}
            for n in range(3, self.N + 1):
                # (n-2)-gram ending at i-2 is kn_hist[n-1][i-1]; extend it with s
                prev = np.repeat(np.concatenate([[-1], kn_hist[n - 1][:-1]]), K)
                ok = prev >= 0
                h = np.full(len(prev), -1, dtype=np.int64)
                h[ok] = self.kn._lookup(n - 1, prev[ok] * V + s_ok[ok])
                hist[n] = h
            q = self.kn.prob(self.N, hist, flat_w)
        qs = np.where(valid, q, 0.0).reshape(T, K)
        cl = np.where(nbr >= 0, self.sem.cluster[np.maximum(nbr, 0)], -1)
        return {"ids": ids, "p_direct": p_direct, "nbr": nbr, "sw": sw, "qs": qs, "cl": cl}

    def glow_field_stream(self, ids: np.ndarray, article_starts, rho: float, reset: bool = True) -> np.ndarray:
        """u_i = A . hbar_i for every position i (T x k), hbar_i built from tokens before i."""
        T, kcl = len(ids), self.sem.k
        H = np.zeros((T, kcl), dtype=np.float32)
        h = np.zeros(kcl, dtype=np.float64)
        starts = set(int(s) for s in article_starts)
        tok_cl = self.sem.cluster[ids]
        for i in range(T):
            if reset and i in starts:
                h[:] = 0.0
            H[i] = h
            h *= rho
            c = tok_cl[i]
            if c >= 0:
                h[c] += 1.0
        H /= np.maximum(H.sum(axis=1, keepdims=True), 1e-9)
        return (H @ self.sem.A.T).astype(np.float32)

    @staticmethod
    def gather_field(u_all: np.ndarray, cl: np.ndarray) -> np.ndarray:
        """U[i, k] = u_all[i, cl[i, k]] (0 where the neighbour has no cluster)."""
        rows = np.arange(len(cl))[:, None]
        return np.where(cl >= 0, u_all[rows, np.maximum(cl, 0)], 0.0).astype(np.float32)

    def glow_features(self, ids: np.ndarray, article_starts, rho: float, cl: np.ndarray, reset: bool = True) -> np.ndarray:
        return self.gather_field(self.glow_field_stream(ids, article_starts, rho, reset), cl)

    def induction_route(self, ids: np.ndarray, article_starts, decay: float, reset: bool = True):
        T = len(ids)
        q = np.zeros(T)
        has = np.zeros(T, dtype=bool)
        table = InductionTable(decay)
        starts = set(int(s) for s in article_starts)
        for i in range(1, T):
            if reset and i in starts:
                table.reset()
            prev, nxt = int(ids[i - 1]), int(ids[i])
            q[i], has[i] = table.score(prev, nxt)
            table.update(prev, nxt)
        return q, has

    @staticmethod
    def combine(prep: dict, U: np.ndarray | None, tau: float, beta: float,
                q_ind: np.ndarray | None = None, has_ind: np.ndarray | None = None, kappa: float | None = None) -> np.ndarray:
        """Per-position log P for given hyper-parameters (vectorised)."""
        sw = prep["sw"].astype(np.float64)
        boost = -tau if U is None else beta * U.astype(np.float64) - tau
        omega = sw * np.exp(boost)
        num = prep["p_direct"] + (omega * prep["qs"]).sum(axis=1)
        Z = 1.0 + omega.sum(axis=1)
        if kappa is not None and q_ind is not None:
            w = np.exp(kappa) * has_ind
            num = num + w * q_ind
            Z = Z + w
        return np.log(num / Z)

    @staticmethod
    def route_mass(prep: dict, U: np.ndarray | None, tau: float, beta: float) -> float:
        """Mean probability mass routed through semantic children: E[ sum_s omega_s / (1 + sum_s omega_s) ]."""
        sw = prep["sw"].astype(np.float64)
        boost = -tau if U is None else beta * U.astype(np.float64) - tau
        tot = (sw * np.exp(boost)).sum(axis=1)
        return float(np.mean(tot / (1.0 + tot)))

    # ------------------------------------------------------- dense scoring
    def full_dist(self, context: np.ndarray, glow: GlowState | None, tau: float, beta: float,
                  table: InductionTable | None = None, kappa: float | None = None) -> np.ndarray:
        """Dense next-token distribution after ``context`` (used for cloze and generation)."""
        context = np.asarray(context, dtype=np.int64)
        kn = self.kn
        P = kn.dist(self.N, kn.history_from_context(context, self.N))
        Z = 1.0
        if len(context):
            t = int(context[-1])
            if t < self.sem.M:
                u = glow.field() if glow is not None else None
                for s, w in zip(self.sem.nbr[t], self.sem.wgt[t]):
                    if s < 0 or w <= 0:
                        continue
                    c = self.sem.cluster[s]
                    boost = beta * u[c] if (u is not None and c >= 0) else 0.0
                    omega = float(w) * np.exp(boost - tau)
                    if self.route == "bigram":
                        Q = kn.dist(2, {2: int(s)})
                    else:
                        ctx_s = np.append(context[:-1], s)
                        Q = kn.dist(self.N, kn.history_from_context(ctx_s, self.N))
                    P += omega * Q
                    Z += omega
            if table is not None and kappa is not None:
                q = table.dist(t, self.V)
                if q is not None:
                    w = np.exp(kappa)
                    P += w * q
                    Z += w
        return P / Z

    def generate(self, prompt: np.ndarray, n_tokens: int, tau: float, beta: float, rho: float | None,
                 kappa: float | None = None, ind_decay: float = 0.995, top_k: int = 40,
                 temperature: float = 1.0, seed: int = 0, use_glow: bool = True) -> np.ndarray:
        rng = np.random.default_rng(seed)
        glow = GlowState(self.sem, rho) if (use_glow and rho is not None) else None
        table = InductionTable(ind_decay) if kappa is not None else None
        context = list(int(x) for x in prompt)
        for j, tok in enumerate(context):
            if glow is not None:
                glow.update(tok)
            if table is not None and j > 0:
                table.update(context[j - 1], tok)
        out = []
        for _ in range(n_tokens):
            P = self.full_dist(np.array(context[-(self.N + 1):]), glow, tau, beta, table, kappa)
            if top_k and top_k < len(P):
                idx = np.argpartition(-P, top_k - 1)[:top_k]
                p = P[idx]
            else:
                idx = np.arange(len(P)); p = P
            if temperature != 1.0:
                p = p ** (1.0 / temperature)
            p = p / p.sum()
            nxt = int(idx[rng.choice(len(idx), p=p)])
            out.append(nxt)
            if glow is not None:
                glow.update(nxt)
            if table is not None:
                table.update(context[-1], nxt)
            context.append(nxt)
        return np.array(out, dtype=np.int64)
