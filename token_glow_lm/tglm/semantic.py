"""Semantic relations, token clusters and the glow affinity field.

* ``cooccurrence``   symmetric windowed co-occurrence counts for the ``M`` most
                     frequent tokens (first-order / syntagmatic statistics).
* ``ppmi``           positive pointwise mutual information with context
                     distribution smoothing (Levy, Goldberg & Dagan 2015).
* ``cooc_neighbors`` first-order neighbours: tokens that co-occur with ``t``
                     (the relation described in the original proposal).
* ``svd_embed`` +    second-order neighbours: tokens whose *contexts* resemble
  ``cosine_neighbors`` those of ``t`` (distributional / paradigmatic similarity).
* ``kmeans``         spherical k-means on the SVD embeddings -> token clusters.
* ``cluster_affinity`` cluster-level PMI matrix; positive entries are
                     attraction, negative entries repulsion between clusters.
"""
from __future__ import annotations

import numpy as np
import scipy.sparse as sp
from scipy.sparse.linalg import svds


def cooccurrence(ids: np.ndarray, M: int, window: int, chunk: int = 20_000_000) -> sp.csr_matrix:
    ids = np.asarray(ids, dtype=np.int64)
    total = sp.csr_matrix((M, M), dtype=np.float32)
    for start in range(0, len(ids), chunk):
        seg = ids[start : start + chunk + window]
        acc = sp.csr_matrix((M, M), dtype=np.float32)
        for d in range(1, window + 1):
            a, b = seg[:-d], seg[d:]
            keep = (a < M) & (b < M)
            a, b = a[keep], b[keep]
            m = sp.coo_matrix((np.ones(len(a), dtype=np.float32), (a, b)), shape=(M, M)).tocsr()
            acc = acc + m + m.T
        total = total + acc
    total.sum_duplicates()
    return total.tocsr()


def ppmi(C: sp.csr_matrix, alpha: float = 0.75) -> sp.csr_matrix:
    C = C.tocoo()
    row_sum = np.asarray(C.sum(axis=1)).ravel().astype(np.float64)
    col_sum = np.asarray(C.sum(axis=0)).ravel().astype(np.float64)
    col_alpha = col_sum**alpha
    col_alpha /= col_alpha.sum()
    N = row_sum.sum()
    # PMI = log( #(w,c) / N  /  ( #(w)/N * P_alpha(c) ) )
    val = np.log(C.data.astype(np.float64) * N / (row_sum[C.row] * N * col_alpha[C.col]))
    keep = val > 0
    P = sp.coo_matrix((val[keep].astype(np.float32), (C.row[keep], C.col[keep])), shape=C.shape).tocsr()
    return P


def _topk_rows(mat: sp.csr_matrix, K: int) -> tuple[np.ndarray, np.ndarray]:
    """Top-K entries of each CSR row (self excluded). Pads with -1 / 0."""
    M = mat.shape[0]
    nbr = np.full((M, K), -1, dtype=np.int32)
    wgt = np.zeros((M, K), dtype=np.float32)
    indptr, indices, data = mat.indptr, mat.indices, mat.data
    for r in range(M):
        lo, hi = indptr[r], indptr[r + 1]
        if hi <= lo:
            continue
        cols = indices[lo:hi]
        vals = data[lo:hi]
        mask = cols != r
        cols, vals = cols[mask], vals[mask]
        if len(vals) > K:
            sel = np.argpartition(-vals, K - 1)[:K]
            cols, vals = cols[sel], vals[sel]
        order = np.argsort(-vals)
        cols, vals = cols[order], vals[order]
        nbr[r, : len(cols)] = cols
        wgt[r, : len(cols)] = vals
    return nbr, wgt


def cooc_neighbors(P: sp.csr_matrix, K: int) -> tuple[np.ndarray, np.ndarray]:
    """First-order neighbours ranked by PPMI (weights are the PPMI values)."""
    return _topk_rows(P, K)


def svd_embed(P: sp.csr_matrix, dim: int = 200, p: float = 0.5, seed: int = 0) -> np.ndarray:
    rng = np.random.default_rng(seed)
    v0 = rng.standard_normal(P.shape[0])
    U, S, _ = svds(P.astype(np.float64), k=dim, v0=v0)
    E = U * (S**p)
    return E.astype(np.float32)


def cosine_neighbors(E: np.ndarray, K: int, chunk: int = 2048) -> tuple[np.ndarray, np.ndarray]:
    """Second-order neighbours: cosine similarity between embedding rows (weights = cos, clipped at 0)."""
    En = E / np.maximum(np.linalg.norm(E, axis=1, keepdims=True), 1e-8)
    M = En.shape[0]
    nbr = np.full((M, K), -1, dtype=np.int32)
    wgt = np.zeros((M, K), dtype=np.float32)
    for s in range(0, M, chunk):
        sims = En[s : s + chunk] @ En.T
        rows = np.arange(s, min(s + chunk, M))
        sims[np.arange(len(rows)), rows] = -np.inf
        top = np.argpartition(-sims, K - 1, axis=1)[:, :K]
        vals = np.take_along_axis(sims, top, axis=1)
        order = np.argsort(-vals, axis=1)
        top = np.take_along_axis(top, order, axis=1)
        vals = np.take_along_axis(vals, order, axis=1)
        nbr[s : s + len(rows)] = top
        wgt[s : s + len(rows)] = np.maximum(vals, 0.0)
    return nbr, wgt


def kmeans(E: np.ndarray, k: int, iters: int = 30, seed: int = 0) -> np.ndarray:
    """Spherical k-means with k-means++ seeding; returns a label per row."""
    rng = np.random.default_rng(seed)
    X = E / np.maximum(np.linalg.norm(E, axis=1, keepdims=True), 1e-8)
    n = X.shape[0]
    centers = np.empty((k, X.shape[1]), dtype=np.float32)
    centers[0] = X[rng.integers(n)]
    d2 = np.full(n, np.inf)
    for j in range(1, k):
        d2 = np.minimum(d2, 1.0 - X @ centers[j - 1])
        probs = np.maximum(d2, 1e-12)
        centers[j] = X[rng.choice(n, p=probs / probs.sum())]
    labels = np.zeros(n, dtype=np.int32)
    for _ in range(iters):
        new_labels = np.argmax(X @ centers.T, axis=1).astype(np.int32)
        if np.array_equal(new_labels, labels):
            break
        labels = new_labels
        for j in range(k):
            members = X[labels == j]
            if len(members):
                c = members.sum(axis=0)
                centers[j] = c / max(np.linalg.norm(c), 1e-8)
    return labels


def cluster_affinity(C: sp.csr_matrix, labels: np.ndarray, k: int, clip: float = 4.0) -> np.ndarray:
    """Cluster-level PMI (add-one smoothed): attraction (>0) and repulsion (<0) between clusters."""
    M = C.shape[0]
    Z = sp.csr_matrix((np.ones(M, dtype=np.float32), (np.arange(M), labels)), shape=(M, k))
    Ccl = (Z.T @ C @ Z).toarray().astype(np.float64) + 1.0
    N = Ccl.sum()
    row = Ccl.sum(axis=1, keepdims=True)
    col = Ccl.sum(axis=0, keepdims=True)
    A = np.log(Ccl * N / (row * col))
    return np.clip(A, -clip, clip).astype(np.float32)


class SemanticGraph:
    """Bundle of neighbour tables, clusters and affinity used by the glow model."""

    def __init__(self, V: int, M: int, nbr: np.ndarray, wgt: np.ndarray, labels: np.ndarray, A: np.ndarray):
        self.V, self.M = V, M
        self.K = nbr.shape[1]
        self.nbr, self.wgt = nbr, wgt
        self.cluster = np.full(V, -1, dtype=np.int32)
        self.cluster[:M] = labels
        self.A = A
        self.k = A.shape[0]

    def neighbors_of(self, t: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """Neighbour ids and weights for an array of tokens (rows of -1/0 for tokens outside top-M)."""
        t = np.asarray(t, dtype=np.int64)
        inside = t < self.M
        tc = np.where(inside, t, 0)
        nbr = np.where(inside[:, None], self.nbr[tc], -1)
        wgt = np.where(inside[:, None], self.wgt[tc], 0.0).astype(np.float32)
        return nbr, wgt
