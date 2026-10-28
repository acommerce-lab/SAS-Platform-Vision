#!/usr/bin/env python3
"""End-to-end experiment: WikiText-103, Kneser-Ney baseline, semantic routes, glow centres.

Outputs ``results/results.json`` and ``results/report.md``.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tglm import semantic as S  # noqa: E402
from tglm.data import Corpus  # noqa: E402
from tglm.evaluate import (cloze_eval, generation_eval, induction_eval, select_cloze_positions, tune,  # noqa: E402
                           tune_induction)
from tglm.model import GlowLM  # noqa: E402
from tglm.ngram import KNLM, perplexity  # noqa: E402

T0 = time.time()


def log(msg: str) -> None:
    print(f"[{time.time() - T0:7.1f}s] {msg}", flush=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default=os.path.join(os.path.dirname(__file__), "data", "wikitext-103-v1"))
    ap.add_argument("--out-dir", default=os.path.join(os.path.dirname(__file__), "results"))
    ap.add_argument("--order", type=int, default=3)
    ap.add_argument("--max-train-tokens", type=int, default=None)
    ap.add_argument("--M", type=int, default=30000, help="tokens with semantic relations (top-M by frequency)")
    ap.add_argument("--window", type=int, default=5)
    ap.add_argument("--K", type=int, default=20, help="semantic children per token")
    ap.add_argument("--kcl", type=int, default=500, help="number of token clusters (glow centres)")
    ap.add_argument("--dim", type=int, default=200)
    ap.add_argument("--cloze-n", type=int, default=2000)
    ap.add_argument("--gen-prompts", type=int, default=8)
    ap.add_argument("--gen-len", type=int, default=60)
    ap.add_argument("--induction-seqs", type=int, default=100)
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()
    os.makedirs(args.out_dir, exist_ok=True)
    rng = np.random.default_rng(args.seed)
    R: dict = {"args": vars(args)}

    corpus = Corpus(args.data_dir, max_train_tokens=args.max_train_tokens)
    V = corpus.V
    log(f"data: V={V} train={len(corpus.train)} valid={len(corpus.valid)} test={len(corpus.test)} "
        f"articles(test)={len(corpus.test_starts)}")
    R["data"] = {"V": V, "train_tokens": int(len(corpus.train)), "valid_tokens": int(len(corpus.valid)),
                 "test_tokens": int(len(corpus.test)), "test_articles": int(len(corpus.test_starts))}

    # ------------------------------------------------------------ baseline
    kn = KNLM(args.order).fit(corpus.train, V)
    log(f"KN-{args.order} fitted; table sizes " + ", ".join(f"{n}:{len(u)}" for n, u in kn.uniq.items()))
    R["baseline"] = {}
    for top in sorted({2, args.order}):
        pv = perplexity(kn.logprob_stream(corpus.valid, top))
        pt = perplexity(kn.logprob_stream(corpus.test, top))
        R["baseline"][f"KN-{top}"] = {"valid_ppl": pv, "test_ppl": pt}
        log(f"KN-{top}: valid ppl {pv:.2f}  test ppl {pt:.2f}")

    # ------------------------------------------------------------ semantic
    M = min(args.M, V)
    C = S.cooccurrence(corpus.train, M, args.window)
    log(f"co-occurrence: M={M} window={args.window} nnz={C.nnz}")
    Pp = S.ppmi(C)
    log(f"PPMI nnz={Pp.nnz}")
    nbr_c, w_c = S.cooc_neighbors(Pp, args.K)
    E = S.svd_embed(Pp, args.dim, seed=args.seed)
    log("SVD done")
    nbr_d, w_d = S.cosine_neighbors(E, args.K)
    labels = S.kmeans(E, args.kcl, seed=args.seed)
    A = S.cluster_affinity(C, labels, args.kcl)
    log(f"clusters: k={args.kcl}, affinity range [{A.min():.2f}, {A.max():.2f}]")

    def show(word: str, nbr, w):
        if word not in corpus.word2id or corpus.word2id[word] >= M:
            return None
        i = corpus.word2id[word]
        return [(corpus.vocab[j], round(float(x), 2)) for j, x in zip(nbr[i], w[i]) if j >= 0][:8]

    probes = ["king", "river", "football", "the", "doctor", "music", "war", "said"]
    R["neighbors"] = {w: {"cooc": show(w, nbr_c, w_c), "distrib": show(w, nbr_d, w_d)} for w in probes}
    for w in probes:
        log(f"{w!r}: cooc={R['neighbors'][w]['cooc']}  distrib={R['neighbors'][w]['distrib']}")
    cl_examples = {}
    for w in probes:
        if w in corpus.word2id and corpus.word2id[w] < M:
            c = int(labels[corpus.word2id[w]])
            members = np.where(labels == c)[0][:12]
            cl_examples[w] = [corpus.vocab[j] for j in members]
    R["cluster_examples"] = cl_examples
    content_mask = np.zeros(V, dtype=bool)
    content_mask[:M] = [corpus.is_content_word(i) for i in range(M)]

    # ------------------------------------------------- routes + glow tuning
    taus = [-2.0, -1.0, 0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 8.0, 10.0, 12.0]
    betas = [0.5, 1.0, 2.0, 3.0, 4.0, 6.0, 8.0]
    rhos = [0.9, 0.97, 0.99, 0.997]
    sems = {"cooc": S.SemanticGraph(V, M, nbr_c, w_c, labels, A),
            "distrib": S.SemanticGraph(V, M, nbr_d, w_d, labels, A)}
    streams = {"valid": (corpus.valid, corpus.valid_starts), "test": (corpus.test, corpus.test_starts)}
    kn_hist = {name: kn.stream_history(ids) for name, (ids, _) in streams.items()}
    # glow field per (stream, rho) is independent of the neighbour mode -> compute once
    any_model = GlowLM(kn, sems["cooc"])
    u_all = {(name, rho): any_model.glow_field_stream(ids, starts, rho)
             for name, (ids, starts) in streams.items() for rho in rhos}
    log("glow fields computed")
    R["experiments"] = {}
    best_overall = None
    models = {}
    for sem_mode, sem in sems.items():
        for route in ("bigram", "sub"):
            key = f"{sem_mode}/{route}"
            model = GlowLM(kn, sem, route)
            models[key] = model
            prep = {name: model.prepare_stream(ids, kn_hist[name]) for name, (ids, _) in streams.items()}
            U = {name: {rho: GlowLM.gather_field(u_all[(name, rho)], prep[name]["cl"]) for rho in rhos}
                 for name in streams}
            tv = tune(model, prep["valid"], U["valid"], taus, betas)
            bs, bg = tv["best_static"], tv["best_glow"]
            bs_test = perplexity(model.combine(prep["test"], None, bs["tau"], 0.0))
            bg_test = perplexity(model.combine(prep["test"], U["test"][bg["rho"]], bg["tau"], bg["beta"]))
            R["experiments"][key] = {
                "static": {**bs, "test_ppl": bs_test,
                           "route_mass_test": model.route_mass(prep["test"], None, bs["tau"], 0.0)},
                "glow": {**bg, "test_ppl": bg_test,
                         "route_mass_test": model.route_mass(prep["test"], U["test"][bg["rho"]], bg["tau"], bg["beta"])},
                "grid_valid": tv["rows"],
            }
            ex = R["experiments"][key]
            log(f"{key}: static tau={bs['tau']} valid {bs['ppl']:.2f} test {bs_test:.2f} mass {ex['static']['route_mass_test']:.3f} | "
                f"glow tau={bg['tau']} beta={bg['beta']} rho={bg['rho']} valid {bg['ppl']:.2f} test {bg_test:.2f} mass {ex['glow']['route_mass_test']:.3f}")
            if best_overall is None or bg["ppl"] < best_overall["valid_ppl"]:
                best_overall = {"key": key, "valid_ppl": bg["ppl"], "cfg": bg, "prep": prep, "U": U}
            # free memory of per-route arrays we no longer need
            if best_overall["key"] != key:
                del prep, U
    R["best_glow"] = {"key": best_overall["key"], **{k: v for k, v in best_overall["cfg"].items()}}
    log(f"best glow configuration: {R['best_glow']}")
    best_model = models[best_overall["key"]]
    bcfg = best_overall["cfg"]
    bprep, bU = best_overall["prep"], best_overall["U"]
    best_static_cfg = R["experiments"][best_overall["key"]]["static"]

    # --------------------------------------------- induction extension (ours)
    ti = tune_induction(best_model, bprep["valid"], bU["valid"][bcfg["rho"]], bcfg["tau"], bcfg["beta"],
                        corpus.valid, corpus.valid_starts, kappas=[-3.0, -2.0, -1.0, 0.0, 1.0, 2.0], decays=[0.99, 0.999])
    bi = ti["best"]
    qt, ht = best_model.induction_route(corpus.test, corpus.test_starts, bi["decay"])
    bi_test = perplexity(best_model.combine(bprep["test"], bU["test"][bcfg["rho"]], bcfg["tau"], bcfg["beta"], qt, ht, bi["kappa"]))
    R["induction_extension"] = {**bi, "test_ppl": bi_test, "grid_valid": ti["rows"]}
    log(f"glow + in-context successor table: kappa={bi['kappa']} decay={bi['decay']} valid {bi['ppl']:.2f} test {bi_test:.2f}")

    configs = [
        {"name": f"KN-{args.order}", "tau": None},
        {"name": "static semantic", "tau": best_static_cfg["tau"], "beta": 0.0, "rho": None},
        {"name": "glow", "tau": bcfg["tau"], "beta": bcfg["beta"], "rho": bcfg["rho"]},
        {"name": "glow + induction table", "tau": bcfg["tau"], "beta": bcfg["beta"], "rho": bcfg["rho"],
         "kappa": bi["kappa"], "decay": bi["decay"]},
    ]
    R["configs"] = configs

    # ------------------------------------------------------------- cloze
    positions = select_cloze_positions(content_mask, corpus.test, args.cloze_n, rng)
    R["cloze"] = cloze_eval(best_model, corpus.test, corpus.test_starts, positions, configs, M)
    for name, d in R["cloze"].items():
        log(f"cloze {name}: left acc@1 {d['left']['acc@1']:.3f} acc@10 {d['left']['acc@10']:.3f} mrr {d['left']['mrr']:.3f} | "
            f"bidir acc@1 {d['bidir']['acc@1']:.3f} acc@10 {d['bidir']['acc@10']:.3f} mrr {d['bidir']['mrr']:.3f}")

    # -------------------------------------------------------- generation
    gen_cfgs = [c for c in configs if c["name"] != "static semantic"]
    R["generation"] = generation_eval(best_model, corpus.test, corpus.test_starts, gen_cfgs, args.gen_prompts, 30,
                                      args.gen_len, 40, args.seed, Pp, content_mask, M, corpus.vocab)
    for name, d in R["generation"].items():
        log(f"gen {name}: distinct1 {d['distinct1']:.3f} distinct2 {d['distinct2']:.3f} rep4 {d['rep4']:.3f} copy {d['copy_rate']:.3f} coherence {d['pmi_coherence']:.3f}")

    # ------------------------------------------------- synthetic induction
    R["synthetic_induction"] = induction_eval(best_model, configs, M, args.induction_seqs, 12, rng)
    for name, d in R["synthetic_induction"].items():
        log(f"induction {name}: ppl first {d['ppl_first_copy']:.1f} second {d['ppl_second_copy']:.1f} acc second {d['acc_second_copy']:.3f}")

    R["runtime_sec"] = time.time() - T0
    with open(os.path.join(args.out_dir, "results.json"), "w") as fh:
        json.dump(R, fh, indent=1, default=float)
    write_report(R, os.path.join(args.out_dir, "report.md"))
    log("done")


def write_report(R: dict, path: str) -> None:
    L = []
    a = R["args"]
    L.append(f"# Results: token-cluster glow LM on WikiText-103\n")
    L.append(f"Train tokens {R['data']['train_tokens']:,}, vocab {R['data']['V']:,}, test tokens {R['data']['test_tokens']:,}. "
             f"KN order {a['order']}, M={a['M']}, window={a['window']}, K={a['K']} semantic children, {a['kcl']} clusters. "
             f"Runtime {R['runtime_sec']/60:.1f} min.\n")
    L.append("## 1. Perplexity (lower is better)\n")
    L.append("| model | neighbours | route | tau | beta | rho | valid PPL | test PPL | mean mass on semantic routes (test) |")
    L.append("|---|---|---|---|---|---|---|---|---|")
    for name, d in R["baseline"].items():
        L.append(f"| {name} | - | - | - | - | - | {d['valid_ppl']:.2f} | {d['test_ppl']:.2f} | 0 |")
    for key, ex in R["experiments"].items():
        sem_mode, route = key.split("/")
        s, g = ex["static"], ex["glow"]
        L.append(f"| static semantic (beta=0) | {sem_mode} | {route} | {s['tau']} | 0 | - | {s['ppl']:.2f} | {s['test_ppl']:.2f} | {s['route_mass_test']:.3f} |")
        L.append(f"| glow | {sem_mode} | {route} | {g['tau']} | {g['beta']} | {g['rho']} | {g['ppl']:.2f} | {g['test_ppl']:.2f} | {g['route_mass_test']:.3f} |")
    ie = R["induction_extension"]
    L.append(f"| best glow + in-context successor table | {R['best_glow']['key']} | | {R['best_glow']['tau']} | {R['best_glow']['beta']} | {R['best_glow']['rho']} (kappa={ie['kappa']}, decay={ie['decay']}) | {ie['ppl']:.2f} | {ie['test_ppl']:.2f} | - |")
    L.append("")
    L.append("## 2. Cloze (fill-in-the-blank), content-word targets, candidates = top-M vocabulary\n")
    L.append("| model | left acc@1 | left acc@10 | left MRR | bidir acc@1 | bidir acc@10 | bidir MRR |")
    L.append("|---|---|---|---|---|---|---|")
    for name, d in R["cloze"].items():
        l, b = d["left"], d["bidir"]
        L.append(f"| {name} | {l['acc@1']:.3f} | {l['acc@10']:.3f} | {l['mrr']:.3f} | {b['acc@1']:.3f} | {b['acc@10']:.3f} | {b['mrr']:.3f} |")
    L.append(f"\nn = {next(iter(R['cloze'].values()))['left']['n']} items. The bidirectional score adds the same order-3 KN right-context term to every model.\n")
    L.append("## 3. Generation (top-k=40 sampling, same seeds for every model)\n")
    L.append("| model | distinct-1 | distinct-2 | distinct-3 | repeated 4-grams | prompt-copy rate | PMI coherence of novel content words with prompt |")
    L.append("|---|---|---|---|---|---|---|")
    for name, d in R["generation"].items():
        L.append(f"| {name} | {d['distinct1']:.3f} | {d['distinct2']:.3f} | {d['distinct3']:.3f} | {d['rep4']:.3f} | {d['copy_rate']:.3f} | {d['pmi_coherence']:.3f} |")
    L.append("\nPMI coherence uses the training co-occurrence statistics that the glow model itself exploits, so it favours the glow model by construction; it measures topical stickiness, not grammaticality.\n")
    for name, d in R["generation"].items():
        L.append(f"### Samples: {name}\n")
        for smp in d["samples"]:
            L.append(f"- **prompt:** {smp['prompt']}\n  **continuation:** {smp['generated']}\n")
    L.append("## 4. Synthetic induction test (random content-token sequence repeated twice)\n")
    L.append("| model | PPL first copy | PPL second copy | top-1 acc second copy |")
    L.append("|---|---|---|---|")
    for name, d in R["synthetic_induction"].items():
        L.append(f"| {name} | {d['ppl_first_copy']:.1f} | {d['ppl_second_copy']:.1f} | {d['acc_second_copy']:.3f} |")
    L.append("")
    L.append("## 5. Semantic children examples\n")
    for w, d in R["neighbors"].items():
        if d["cooc"] is None:
            continue
        L.append(f"- **{w}** — cooc: {', '.join(f'{x}({s})' for x, s in d['cooc'])}")
        L.append(f"  distrib: {', '.join(f'{x}({s})' for x, s in d['distrib'])}")
    L.append("\n## 6. Cluster examples (glow centres)\n")
    for w, members in R["cluster_examples"].items():
        L.append(f"- cluster of **{w}**: {', '.join(members)}")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(L) + "\n")


if __name__ == "__main__":
    main()
