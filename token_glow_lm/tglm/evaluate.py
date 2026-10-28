"""Evaluation routines: hyper-parameter tuning, cloze, generation and synthetic induction."""
from __future__ import annotations

import numpy as np

from .model import GlowLM, GlowState, InductionTable
from .ngram import KNLM, perplexity


# ----------------------------------------------------------------- tuning
def tune(model: GlowLM, prep: dict, U_by_rho: dict[float, np.ndarray], taus, betas) -> dict:
    """Grid search over tau (static, beta=0) and (rho, beta, tau) (glow). Returns all rows + bests."""
    rows = []
    for tau in taus:
        rows.append({"family": "static", "tau": tau, "beta": 0.0, "rho": None,
                     "ppl": perplexity(model.combine(prep, None, tau, 0.0))})
    for rho, U in U_by_rho.items():
        for beta in betas:
            for tau in taus:
                rows.append({"family": "glow", "tau": tau, "beta": beta, "rho": rho,
                             "ppl": perplexity(model.combine(prep, U, tau, beta))})
    best_static = min((r for r in rows if r["family"] == "static"), key=lambda r: r["ppl"])
    best_glow = min((r for r in rows if r["family"] == "glow"), key=lambda r: r["ppl"])
    return {"rows": rows, "best_static": best_static, "best_glow": best_glow}


def tune_induction(model: GlowLM, prep: dict, U: np.ndarray | None, tau: float, beta: float,
                   ids, starts, kappas, decays) -> dict:
    rows = []
    for decay in decays:
        q, has = model.induction_route(ids, starts, decay)
        for kappa in kappas:
            rows.append({"decay": decay, "kappa": kappa,
                         "ppl": perplexity(model.combine(prep, U, tau, beta, q, has, kappa))})
    return {"rows": rows, "best": min(rows, key=lambda r: r["ppl"])}


# ------------------------------------------------------------------ cloze
def select_cloze_positions(content_mask: np.ndarray, ids: np.ndarray, n: int, rng, margin: int = 3) -> np.ndarray:
    ok = content_mask[ids]
    pos = np.where(ok)[0]
    pos = pos[(pos >= margin) & (pos < len(ids) - 2)]
    if len(pos) > n:
        pos = rng.choice(pos, size=n, replace=False)
    return np.sort(pos)


def right_context_scores(kn: KNLM, cands: np.ndarray, w_prev: int, w_next1: int, w_next2: int) -> np.ndarray:
    """log P(w_next1 | w_prev, x) + log P(w_next2 | x, w_next1) for all candidates x (order <= 3)."""
    top = min(kn.N, 3)
    V = kn.V
    n = len(cands)
    hist = {2: cands}
    if top >= 3:
        hist[3] = kn._lookup(2, w_prev * V + cands)
    t1 = kn.prob(top, hist, np.full(n, w_next1))
    hist = {2: np.full(n, w_next1)}
    if top >= 3:
        hist[3] = kn._lookup(2, cands * V + w_next1)
    t2 = kn.prob(top, hist, np.full(n, w_next2))
    return np.log(t1) + np.log(t2)


def _rank(scores: np.ndarray, truth: int) -> int:
    return int(np.count_nonzero(scores > scores[truth])) + 1


def cloze_eval(model: GlowLM, ids: np.ndarray, starts, positions: np.ndarray, configs: list[dict], M: int) -> dict:
    """configs: dicts with name, tau (None = KN only), beta, rho (None = no glow), kappa, decay.

    Left-only ranking uses each model's own distribution; the bidirectional score
    adds the same order-3 KN right-context term for every model.
    """
    kn = model.kn
    cands = np.arange(M, dtype=np.int64)
    glows = {c["rho"]: GlowState(model.sem, c["rho"]) for c in configs if c.get("rho") is not None}
    tables = {c["decay"]: InductionTable(c["decay"]) for c in configs if c.get("kappa") is not None}
    ranks = {c["name"]: {"left": [], "bidir": []} for c in configs}
    starts = set(int(s) for s in starts)
    pos_set = set(int(p) for p in positions)
    N = model.N
    for i in range(len(ids)):
        if i in starts:
            for g in glows.values():
                g.reset()
            for t in tables.values():
                t.reset()
        if i in pos_set:
            truth = int(ids[i])
            context = ids[max(0, i - N):i]
            right = right_context_scores(kn, cands, int(ids[i - 1]), int(ids[i + 1]), int(ids[i + 2]))
            p_kn = None
            for c in configs:
                if c["tau"] is None:
                    if p_kn is None:
                        p_kn = kn.dist(N, kn.history_from_context(context, N))
                    P = p_kn
                else:
                    P = model.full_dist(context, glows.get(c.get("rho")), c["tau"], c.get("beta", 0.0),
                                        tables.get(c.get("decay")) if c.get("kappa") is not None else None, c.get("kappa"))
                left = np.log(np.maximum(P[:M], 1e-300))
                ranks[c["name"]]["left"].append(_rank(left, truth))
                ranks[c["name"]]["bidir"].append(_rank(left + right, truth))
        tok = int(ids[i])
        for g in glows.values():
            g.update(tok)
        if i > 0:
            for t in tables.values():
                t.update(int(ids[i - 1]), tok)
    out = {}
    for name, d in ranks.items():
        out[name] = {}
        for side, r in d.items():
            r = np.asarray(r, dtype=np.float64)
            out[name][side] = {"acc@1": float(np.mean(r <= 1)), "acc@10": float(np.mean(r <= 10)),
                               "mrr": float(np.mean(1.0 / r)), "n": int(len(r))}
    return out


# ------------------------------------------------------------- generation
def distinct_n(seqs: list[np.ndarray], n: int) -> float:
    grams, total = set(), 0
    for s in seqs:
        for i in range(len(s) - n + 1):
            grams.add(tuple(s[i:i + n])); total += 1
    return len(grams) / max(total, 1)


def repeated_4grams(seq: np.ndarray) -> float:
    seen, rep, total = set(), 0, 0
    for i in range(len(seq) - 3):
        g = tuple(seq[i:i + 4]); total += 1
        if g in seen:
            rep += 1
        seen.add(g)
    return rep / max(total, 1)


def pmi_coherence(P, prompt: np.ndarray, gen: np.ndarray, content_mask: np.ndarray, M: int) -> tuple[float, float]:
    """(mean PPMI between *novel* generated content words and prompt content words, prompt-copy rate).

    Novel = generated content words that do not occur in the prompt; copy rate = share of generated
    content words that do occur in the prompt.
    """
    pw = [int(w) for w in prompt if w < M and content_mask[w]]
    gw_all = [int(w) for w in gen if w < M and content_mask[w]]
    if not pw or not gw_all:
        return float("nan"), float("nan")
    pset = set(pw)
    copy_rate = float(np.mean([w in pset for w in gw_all]))
    gw = [w for w in gw_all if w not in pset]
    if not gw:
        return float("nan"), copy_rate
    sub = P[gw][:, pw].toarray()
    return float(sub.mean()), copy_rate


def generation_eval(model: GlowLM, ids: np.ndarray, starts, configs: list[dict], n_prompts: int, prompt_len: int,
                    gen_len: int, top_k: int, seed: int, P_ppmi, content_mask: np.ndarray, M: int, vocab: list[str]) -> dict:
    kn = model.kn
    starts = [int(s) for s in starts if s + prompt_len + 2 < len(ids)]
    rng = np.random.default_rng(seed)
    chosen = sorted(rng.choice(starts, size=min(n_prompts, len(starts)), replace=False))
    out = {c["name"]: {"samples": [], "seqs": [], "rep4": [], "coh": [], "copy": []} for c in configs}
    for j, s in enumerate(chosen):
        prompt = ids[s:s + prompt_len]
        for c in configs:
            if c["tau"] is None:
                gen = model.generate(prompt, gen_len, tau=np.inf, beta=0.0, rho=None, top_k=top_k, seed=seed + j, use_glow=False)
            else:
                gen = model.generate(prompt, gen_len, tau=c["tau"], beta=c.get("beta", 0.0), rho=c.get("rho"),
                                     kappa=c.get("kappa"), ind_decay=c.get("decay", 0.995), top_k=top_k,
                                     seed=seed + j, use_glow=c.get("rho") is not None)
            d = out[c["name"]]
            d["seqs"].append(gen)
            d["rep4"].append(repeated_4grams(gen))
            coh, cp = pmi_coherence(P_ppmi, prompt, gen, content_mask, M)
            d["coh"].append(coh); d["copy"].append(cp)
            if j < 3:
                d["samples"].append({"prompt": " ".join(vocab[w] for w in prompt), "generated": " ".join(vocab[w] for w in gen)})
    res = {}
    for name, d in out.items():
        res[name] = {"distinct1": distinct_n(d["seqs"], 1), "distinct2": distinct_n(d["seqs"], 2),
                     "distinct3": distinct_n(d["seqs"], 3), "rep4": float(np.mean(d["rep4"])),
                     "pmi_coherence": float(np.nanmean(d["coh"])), "copy_rate": float(np.nanmean(d["copy"])),
                     "samples": d["samples"]}
    return res


# -------------------------------------------------------------- induction
def induction_eval(model: GlowLM, configs: list[dict], M: int, n_seq: int, L: int, rng, min_id: int = 1000,
                   n_dense: int = 30) -> dict:
    """Random content-token sequence repeated twice; score the second copy."""
    res = {c["name"]: {"lp_first": [], "lp_second": [], "acc_second": []} for c in configs}
    for q in range(n_seq):
        seq = rng.choice(np.arange(min_id, M), size=L, replace=False)
        stream = np.concatenate([seq, seq]).astype(np.int64)
        prep = model.prepare_stream(stream)
        second = np.arange(L + 1, 2 * L)
        first = np.arange(1, L)
        for c in configs:
            if c["tau"] is None:
                lp = np.log(prep["p_direct"])
            else:
                U = model.glow_features(stream, [0], c["rho"], prep["cl"]) if c.get("rho") is not None else None
                if c.get("kappa") is not None:
                    qi, has = model.induction_route(stream, [0], c["decay"])
                    lp = model.combine(prep, U, c["tau"], c.get("beta", 0.0), qi, has, c["kappa"])
                else:
                    lp = model.combine(prep, U, c["tau"], c.get("beta", 0.0))
            res[c["name"]]["lp_first"].append(float(lp[first].mean()))
            res[c["name"]]["lp_second"].append(float(lp[second].mean()))
            if q < n_dense:
                glow = GlowState(model.sem, c["rho"]) if c.get("rho") is not None else None
                table = InductionTable(c["decay"]) if c.get("kappa") is not None else None
                hits = 0
                for i in range(2 * L):
                    if i in second:
                        ctx = stream[max(0, i - model.N):i]
                        if c["tau"] is None:
                            P = model.kn.dist(model.N, model.kn.history_from_context(ctx, model.N))
                        else:
                            P = model.full_dist(ctx, glow, c["tau"], c.get("beta", 0.0), table, c.get("kappa"))
                        hits += int(np.argmax(P) == stream[i])
                    if glow is not None:
                        glow.update(int(stream[i]))
                    if table is not None and i > 0:
                        table.update(int(stream[i - 1]), int(stream[i]))
                res[c["name"]]["acc_second"].append(hits / len(second))
    out = {}
    for name, d in res.items():
        out[name] = {"ppl_first_copy": float(np.exp(-np.mean(d["lp_first"]))),
                     "ppl_second_copy": float(np.exp(-np.mean(d["lp_second"]))),
                     "acc_second_copy": float(np.mean(d["acc_second"]))}
    return out
