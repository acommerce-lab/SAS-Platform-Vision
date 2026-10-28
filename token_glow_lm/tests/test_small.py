"""Sanity checks on a tiny synthetic corpus (run: python3 tests/test_small.py  or  pytest tests/)."""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from tglm import semantic as S  # noqa: E402
from tglm.model import GlowLM, GlowState, InductionTable  # noqa: E402
from tglm.ngram import KNLM, perplexity  # noqa: E402


def _corpus(seed=1):
    rng = np.random.default_rng(seed)
    V, M = 60, 40
    ids = []
    for _ in range(600):  # two topics of 20 tokens each, plus a tail of rare tokens
        base = 20 * rng.integers(2)
        ids.extend((base + rng.integers(0, 20, size=25)).tolist())
    ids = np.array(ids + rng.integers(40, 60, size=500).tolist())
    return ids, V, M


def test_kn_is_a_distribution():
    ids, V, _ = _corpus()
    for order in (2, 3, 4):
        kn = KNLM(order).fit(ids[:12000], V)
        test = ids[12000:12100]
        hist = kn.stream_history(test)
        for i in range(5, 100):
            h = {n: int(hist[n][i]) for n in range(2, order + 1)}
            d = kn.dist(order, h)
            assert abs(d.sum() - 1.0) < 1e-9
            pw = kn.prob(order, {n: np.array([hist[n][i]]) for n in range(2, order + 1)}, np.array([test[i]]))[0]
            assert abs(d[test[i]] - pw) < 1e-12
        assert perplexity(kn.logprob_stream(ids[12000:])) < V


def test_glow_model_consistency():
    ids, V, M = _corpus()
    kn = KNLM(3).fit(ids, V)
    C = S.cooccurrence(ids, M, 3)
    P = S.ppmi(C)
    nbr, w = S.cooc_neighbors(P, 5)
    E = S.svd_embed(P, 8)
    labels = S.kmeans(E, 4)
    A = S.cluster_affinity(C, labels, 4)
    sem = S.SemanticGraph(V, M, nbr, w, labels, A)
    test = ids[:2000]
    for route in ("bigram", "sub"):
        m = GlowLM(kn, sem, route)
        prep = m.prepare_stream(test)
        U = m.glow_features(test, [0], 0.9, prep["cl"])
        q, has = m.induction_route(test, [0], 0.99)
        for tau, beta, kappa in [(0.0, 0.0, None), (1.0, 2.0, None), (1.0, 2.0, 0.0)]:
            lp = m.combine(prep, U, tau, beta, q, has, kappa)
            for i in (3, 900, 1999):
                g, tab = GlowState(sem, 0.9), InductionTable(0.99)
                for j in range(i):
                    g.update(int(test[j]))
                    if j > 0:
                        tab.update(int(test[j - 1]), int(test[j]))
                d = m.full_dist(test[max(0, i - 2):i], g, tau, beta, tab if kappa is not None else None, kappa)
                assert abs(d.sum() - 1.0) < 1e-9
                assert abs(np.log(d[test[i]]) - lp[i]) < 1e-6
        # tau -> inf must reduce to Kneser-Ney exactly
        assert np.allclose(m.combine(prep, None, 1e9, 0.0), np.log(prep["p_direct"]))


def test_clusters_follow_topics():
    ids, V, M = _corpus()
    C = S.cooccurrence(ids, M, 3)
    E = S.svd_embed(S.ppmi(C), 8)
    labels = S.kmeans(E[:40], 2)
    assert len(set(labels[:20])) == 1 and len(set(labels[20:40])) == 1 and labels[0] != labels[20]
    A = S.cluster_affinity(C, S.kmeans(E, 2), 2)
    assert A[0, 0] > A[0, 1] and A[1, 1] > A[1, 0]  # attraction within, repulsion across


if __name__ == "__main__":
    test_kn_is_a_distribution()
    test_glow_model_consistency()
    test_clusters_follow_topics()
    print("all sanity tests passed")
