# Token-cluster glow language model — prototype

A self-contained Python prototype of a next-token model built from three ingredients:

1. **Contextual relation** — a Kneser-Ney smoothed n-gram model that preserves the order of tokens in the
   training data (the *contextual children* of a token are its successors).
2. **Semantic relation** — for every token, K *semantic children* obtained from co-occurrence statistics.
   Two variants are evaluated: first-order neighbours (tokens that co-occur with it, ranked by PPMI — the
   relation described in the original idea) and second-order neighbours (tokens with similar
   co-occurrence profiles, cosine on an SVD of the PPMI matrix).
3. **Glow centres** — token clusters (spherical k-means on the SVD embeddings) carrying a decayed activation
   that accumulates while a document is read; a cluster-level PMI matrix turns that activation into
   *attraction* (positive) or *repulsion* (negative) forces acting on the semantic children.

At inference the model mixes the direct contextual route with routes that go **semantic child → its
contextual child**, paying a *transition tax* that the glow field can offset.

```
direct route            P_KN(x | h)
semantic route via s    omega_s = S[t,s] · exp(beta · u_i[cl(s)] − tau)
                        Q_s(x)  = P_KN(x | s)                 ("bigram" route)
                                = P_KN(x | h with t -> s)     ("sub" route)
glow field              u_i = A · hbar_i      hbar_i = normalised, decayed (rho) cluster histogram of the document so far
optional extension      in-context successor table (what followed t earlier in this document), weight e^kappa

P(x) = [ P_KN(x|h) + Σ_s omega_s Q_s(x) + e^kappa Q_ind(x) ] / [ 1 + Σ_s omega_s + e^kappa ]
      (the e^kappa terms are present only when t has already occurred in the document)
```

Every route is a proper distribution, so the normaliser costs O(K) per position and the whole model is
evaluated exactly (no sampling, no approximation). With `beta = 0` the model has the form of the similarity-weighted
estimate of Dagan, Lee & Pereira (1999), applied as a mixture at every position rather than only to unseen bigrams;
with `tau → ∞` it is plain Kneser-Ney. The in-context successor table is **not**
part of the original idea: it is the extension proposed in the discussion (an ordered glow memory, i.e. an
induction-head-like mechanism) and is reported separately.

## Layout

| file | content |
|---|---|
| `tglm/data.py` | WikiText-103 download (Hugging Face parquet), tokenisation, vocabulary, article boundaries |
| `tglm/ngram.py` | interpolated modified Kneser-Ney on sorted integer tables (point lookups, full distributions) |
| `tglm/semantic.py` | windowed co-occurrence, PPMI, first/second-order neighbours, SVD, k-means, cluster affinity |
| `tglm/model.py` | the glow model: routes, glow state, in-context table, vectorised and dense scoring, generation |
| `tglm/evaluate.py` | hyper-parameter tuning, cloze test, generation metrics, synthetic induction test |
| `run_experiments.py` | end-to-end experiment; writes `results/results.json` and `results/report.md` |
| `run_extras.py` | direct glow field on all candidates, paired article bootstraps; writes `results/extras.md` and `results/extras.json` |
| `analysis_controls.py` | controls: unigram cache versus successor table, affinity variants, random clusters, KN-4 base; writes `results/controls.*` |
| `analysis_routes.py` | the original routing design with predecessor/successor-similarity children, sharpening and per-bucket tax; writes `results/routes.*` |
| `analysis_field.py` | self-activation field versus cross-cluster forces, best count-only stacks; writes `results/field.*` |
| `analysis_sparsity.py` | Kneser-Ney perplexity and seen-context shares against training size; writes `results/sparsity.*` |
| `tests/test_small.py` | sanity tests (distributions sum to one, vectorised == dense scoring, clusters follow topics) |

## Running

```
pip install -r requirements.txt
python3 tests/test_small.py
python3 run_experiments.py                      # full WikiText-103 (≈10 GB RAM, ~15 min on 4 cores)
python3 run_extras.py                           # direct-field variant + significance tests (~15 min)
python3 analysis_controls.py                    # controls (~23 min; run after run_experiments.py)
python3 analysis_routes.py                      # routing design, fairer instantiations (~13 min)
python3 analysis_field.py                       # field definitions and best stacks (~11 min; reuses caches of the controls)
python3 analysis_sparsity.py                    # scaling analysis (~8 min)
python3 run_experiments.py --max-train-tokens 3000000 --M 8000 --kcl 100 --dim 64 --cloze-n 200   # quick run
```

The dataset (`wikitext-103-v1`, ~310 MB of parquet) is downloaded automatically into `data/` and encoded once
into `data/cache/`. Both directories are git-ignored.

## Experimental protocol

* **Baselines**: Kneser-Ney bigram and trigram (the "contextual relation" alone).
* **Hyper-parameters** (tax `tau`, glow gain `beta`, decay `rho`, extension weight `kappa`) are selected by
  grid search on the validation split; the test split is scored once per selected configuration.
* **Perplexity** on the full test stream (245,569 tokens, `<eos>` included). The glow state resets at article
  boundaries.
* **Cloze**: 2,000 test positions whose target is an alphabetic content word (frequency rank ≥ 300) within the
  top-M vocabulary; candidates are the top-M vocabulary. *Left* ranking uses the model's own distribution; the
  *bidirectional* score adds the same order-3 Kneser-Ney right-context term for every model.
* **Generation**: 8 test articles, 30-token prompt, 60 sampled tokens (top-k = 40), identical seeds per model.
  Reported: distinct-n, repeated 4-grams, prompt-copy rate and PMI coherence between novel generated content
  words and the prompt (this last metric uses the same statistics the glow model exploits, so it is a measure of
  topical stickiness, not quality).
* **Synthetic induction**: a random sequence of 12 content tokens repeated twice; the second copy is scored.
  This isolates the *match → shift by one* ability that induction heads give transformers.

## Results

### Where things stand after the audit and the controls (read this first)

The first run below was followed by an independent audit and four control experiments
(`analysis_controls.py`, `analysis_routes.py`, `analysis_field.py`, `analysis_sparsity.py`; reports in
`results/controls.md`, `results/routes.md`, `results/field.md`, `results/sparsity.md`). The audit found no error in
the numbers: the Kneser-Ney implementation matches a brute-force reference, every model is a normalised
distribution over the full vocabulary, nothing scored at position i uses token i or later (one exception of no practical size is listed under
bookkeeping), and all tuning used the validation split only. Several *interpretations* of the first run did not
survive the controls. They are corrected here, and this section supersedes the readings further down wherever they differ.

**Test perplexity. Every model is count-based: no value is trained by gradient descent.**

| model (each row adds only the named components to the Kneser-Ney base) | on KN-3 | on KN-4 |
|---|---|---|
| Kneser-Ney, the contextual relation alone | 149.21 | 123.12 |
| + original routing (semantic child → its contextual child), first run: 20 symmetric-window children, one tax | 148.42 | – |
| + original routing, children similar in predecessors **and** successors, weights sharpened, tax per history count | 146.00 | 119.96 |
| + glow field on all candidates, linear cluster-PMI form `u = A·hbar` | 133.47 | 111.54 |
| + glow field, self-activation of each cluster relative to its prior, `u = log((hbar+p)/2p)` | 120.98 | 102.09 |
| + self-activation plus forces between different clusters (off-diagonal PMI) | 119.59 | 101.01 |
| + token-level unigram cache of the document (identity, no order) | 114.32 | 95.15 |
| + in-context successor table (identity and order) | 112.62 | 94.52 |
| + unigram cache + successor table | 96.98 | 82.85 |
| + glow field (self + cross) + unigram cache + successor table | **88.53** | **75.38** |

Published results trained on the same 103M tokens, for scale: KenLM 5-gram 116.4 (Li et al. 2022), LSTM 48.7
(Grave et al. 2017), Transformer-XL 18.3 (Dai et al. 2019). The best count-only model here is at 4.1 times the
Transformer-XL perplexity and, starting from the trigram, has closed about a third of the gap in bits per token.

**Corrected reading**

1. **Identity versus order.** The first run credited the successor table's gain to *order*. A token-level
   unigram cache, which has no order, does about as well: -23.4 % against -24.5 %, paired ratio
   0.985 (95 % CI 0.955–1.011). Order is a separate, complementary component: adding the table to the cache
   gives a further ratio of 0.848 (95 % CI 0.819–0.870). What needs order is exact copying: on the synthetic
   induction test the unigram cache lowers second-copy perplexity from 273,370 to 150 with top-1 accuracy
   0.000, the table reaches 8.4 and 0.715, both together 4.0 and 0.965. That test is a unit test of
   the table, not independent evidence about attention heads. On cloze the unigram cache adds +0.001 MRR and the
   table adds +0.030 beyond it (95 % CI +0.024 to +0.037).
2. **What a glow centre should compute.** The first run tested one form of the field, the linear cluster-PMI
   average, and described its gain as attraction and repulsion between clusters. The self-activation of each
   cluster relative to its training frequency is better: ratio 0.811 (95 % CI 0.801–0.821) against Kneser-Ney, where the
   linear PMI field gave 0.895 (95 % CI 0.884–0.904). Forces between different clusters improve it further by a ratio of 0.989
   (95 % CI 0.986–0.991). The semantic content of the clusters matters: the same field on frequency-matched random clusters
   gives 135.57 (it then acts as a hashed token cache), and semantic clusters improve on that by a ratio of
   0.892 (95 % CI 0.885–0.899). On top of a token-level unigram cache the field still improves perplexity by a
   ratio of 0.901 (95 % CI 0.890–0.911):
   this is the part that no identity memory can supply, tokens not yet seen in the document whose cluster is
   active. Cloze, left context: MRR 0.134 → 0.170, acc@1 0.086 → 0.115.
3. **The original routing design.** The first run's −0.5 % came from one arbitrary instantiation. With children
   chosen by similarity of both predecessor and successor profiles the route gives a ratio of 0.979 (95 % CI 0.973–0.985) on KN-3 and
   0.974 on KN-4; successor-similarity alone gives 0.985, predecessor-similarity 0.991, symmetric-window
   neighbours 0.992. The effect is real and small. The earlier remark that −0.5 % is "in line with" Dagan, Lee &
   Pereira (1999) is withdrawn: they apply the similarity estimate only to unseen bigrams inside Katz back-off
   and report 2.4 % overall, a different scheme on a different baseline.
4. **Baseline.** Order 3 was a script default, not part of the idea. One more token of context is worth a
   ratio of 0.825 (95 % CI 0.765–0.875), as much as the best field. All additions keep nearly the same relative gain on KN-4.
5. **Generation.** Eight prompts support only two statements: the in-context table copies about 10 % of its
   content words from the prompt and repeats a few 4-grams. The claim that it raised topical coherence is
   withdrawn; the field models were not used for generation.
6. **Bookkeeping.** The bootstrap resamples 63 blocks that cover the 60 test articles: the heading pattern also
   matches two formula lines inside one article, and one block is the single leading token. The glow state is
   therefore reset twice inside that article. The reset at an article start is decided from the heading line,
   a look-ahead that touches 0.05 % of positions. The effect on every reported number is negligible.
7. **Scaling.** KN-4 perplexity falls with a log-log slope of -0.316 from 1M to 103M tokens, -0.283 once
   vocabulary acquisition is removed. A floor-less extrapolation reaches perplexity 18.3 at about 4.4e+10
   tokens (range 3e+10 to 8e+10). KN-4 shows no flattening in the measured range, so these data do not
   locate its floor. Exact-match contexts cover 69 %, 41 %, 24 % and 16 % of test positions for 3, 4, 5 and 6
   preceding tokens, consistent with a usable context of about log2(N)/H ≈ 3.8 tokens at this corpus size.

Not measured: a stack that includes the routing together with the field and caches, generation from the field
models, other cluster counts, SVD dimensions and seeds.

### First run

Full WikiText-103 run (103,227,021 training tokens, vocabulary 267,735, test 245,569 tokens; `results/report.md`,
`results/results.json`, `results/run.log`; 13 min on 4 cores).

### Perplexity (test split; hyper-parameters chosen on validation)

| model | test PPL | mass on semantic routes |
|---|---|---|
| Kneser-Ney bigram (contextual relation only) | 261.53 | – |
| Kneser-Ney trigram (contextual relation only) | **149.21** | – |
| + co-occurrence children, bigram route, tuned tax (original design, static) | 149.15 | 0.2 % |
| + co-occurrence children + glow centres (original design, full) | 149.00–149.11 | 0.3–0.4 % |
| + distributional children, substitution route (static) | 148.42 | 2.8 % |
| + distributional children, substitution route + glow centres | **148.32** | 2.8 % |
| best glow model + in-context successor table (proposed extension) | **111.61** | – |

Tuned values: tax `tau = 6`, glow gain `beta = 1`, decay `rho = 0.997` for the best glow model; `kappa = −1`,
decay `0.999` for the in-context table. With co-occurrence children the tuned tax (`tau = 10`) all but switches
the semantic routes off.

### Cloze (2,000 content-word blanks, 30,000 candidates)

| model | left acc@1 | left acc@10 | left MRR | bidirectional acc@1 | bidirectional MRR |
|---|---|---|---|---|---|
| Kneser-Ney trigram | 0.086 | 0.225 | 0.134 | 0.261 | 0.337 |
| static semantic routes | 0.086 | 0.223 | 0.134 | 0.259 | 0.336 |
| glow centres | 0.086 | 0.224 | 0.134 | 0.259 | 0.337 |
| glow + in-context successor table | **0.121** | **0.291** | **0.179** | **0.292** | **0.373** |

### Generation (8 prompts × 60 tokens, top-k 40)

| model | distinct-1 | distinct-2 | repeated 4-grams | prompt-copy rate | PMI coherence with prompt |
|---|---|---|---|---|---|
| Kneser-Ney trigram | 0.492 | 0.869 | 0.000 | 0.000 | 0.105 |
| glow centres | 0.465 | 0.871 | 0.000 | 0.000 | 0.092 |
| glow + in-context successor table | 0.456 | 0.797 | 0.026 | 0.098 | 0.139 |

### Synthetic induction (12 random content tokens, repeated)

| model | PPL on the second copy | top-1 accuracy on the second copy |
|---|---|---|
| Kneser-Ney trigram | 265,910 | 0.000 |
| static semantic routes | 263,040 | 0.000 |
| glow centres | 263,013 | 0.000 |
| glow + in-context successor table | **3.8** | **0.976** |

### Reading of the first run

Items 2, 4 and 5 were revised after the controls; the summary at the top of this section is the current reading.

1. **First-order (co-occurrence) children do not help prediction in this instantiation.** The tokens that
   co-occur with `river` (`otter`, `banks`, `navigable`) are topical associates, not substitutes, so their
   successor distributions are poor proxies for the successors of `river`. Validation tuning pushes the tax up
   until the routes carry 0.2 % of the mass, and perplexity is unchanged.
2. **Second-order (distributional) children help a little.** Substitutable neighbours (`river → rivers,
   upstream, …`; `said → stated, commented, …`) with the substitution route give 149.21 → 148.42 (−0.5 %) with
   20 children and one tax. A fairer instantiation of the same design reaches −2.2 % (summary, item 3).
3. **Glow centres acting through the semantic routes add 0.1 PPL (0.06 %).** The paired bootstrap shows the
   effect is real (PPL ratio 0.9994, 95 % CI 0.9992–0.9996) but negligible: the field can only act through
   routes that carry under 3 % of the probability mass, so it has almost no leverage.
4. **In-context memory moves the needle, and order is one part of it.** The successor table cuts perplexity by
   25 % and solves the synthetic induction test. The first version of this item credited the whole gain to
   order; the controls show that a token-level unigram cache without order gives about the same perplexity gain
   and that order adds a further 15 % (summary, item 1).
5. **Generation.** With 8 prompts only the increase in prompt copying and 4-gram repetition under the in-context
   table is supported. Coherence differences are within noise. Samples are in `results/report.md`.

### Extras: the field acting directly on all candidates, and significance tests

`run_extras.py` (results in `results/extras.md`, `results/extras.json`) evaluates a variant in which the glow field
is applied to **every** candidate instead of only to the semantic children:
`P'(x | h) ∝ P_KN(x | h) · exp(beta · u[cl(x)])`, normalised exactly through the per-cluster mass of the
Kneser-Ney distribution. This is the same accumulated attraction/repulsion field, with the semantic-child
routing removed.

| model | test PPL | PPL ratio vs KN trigram (95 % CI, paired bootstrap over 63 blocks covering the 60 test articles) |
|---|---|---|
| Kneser-Ney trigram | 149.21 | – |
| static semantic routes | 148.42 | 0.9947 (0.9927–0.9971) |
| glow via semantic routes (original design) | 148.32 | 0.9941 (0.9920–0.9965) |
| **direct glow field on all candidates** (`rho = 0.97`, `beta = 3`) | **133.47** | **0.8945 (0.8835–0.9043)** |
| glow via routes + in-context successor table | 111.61 | 0.7480 (0.7152–0.7782) |
| **direct glow field + in-context successor table** (`kappa = −2`) | **103.36** | 0.6927 |

Cloze with the direct field: left acc@1 0.086 → **0.107**, left MRR 0.134 → **0.156**, bidirectional acc@1
0.261 → 0.273 (same 2,000 blanks).

Reading: a decayed, cluster-level activation of the document so far carries real signal when it is allowed to act
on all candidates, and routing it exclusively through "semantic child → its contextual child" gives it almost no
leverage. This linear cluster-PMI form is not the best form of the field: the self-activation of each cluster
relative to its prior does better, and forces between clusters add about 1 % on top (summary, item 2). In the
literature the direct variant is a topic- or cache-adapted n-gram model (Kuhn & De Mori 1990; Gildea & Hofmann
1999), and the self-activation form is cluster-level unigram rescaling.

Caveats: the first run used a trigram base, which is a script default and not part of the idea; the glow field has
one scalar per cluster; the semantic relations are static corpus statistics; no parameter is learned by gradient
descent; cluster count, SVD dimension, window and seed were fixed, not tuned.
