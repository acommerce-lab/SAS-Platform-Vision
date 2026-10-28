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
```

Every route is a proper distribution, so the normaliser costs O(K) per position and the whole model is
evaluated exactly (no sampling, no approximation). With `beta = 0` the model is similarity-based smoothing
(Dagan, Lee & Pereira 1999); with `tau → ∞` it is plain Kneser-Ney. The in-context successor table is **not**
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
| `tests/test_small.py` | sanity tests (distributions sum to one, vectorised == dense scoring, clusters follow topics) |

## Running

```
pip install -r requirements.txt
python3 tests/test_small.py
python3 run_experiments.py                      # full WikiText-103 (≈15 GB RAM, ~1 h on 4 cores)
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

### Reading the numbers

1. **First-order (co-occurrence) children do not help prediction.** The tokens that co-occur with `river`
   (`otter`, `banks`, `navigable`) are topical associates, not substitutes, so their successor distributions
   are poor proxies for the successors of `river`. Validation tuning pushes the tax up until the routes carry
   0.2 % of the mass, and perplexity is unchanged.
2. **Second-order (distributional) children help a little.** Substitutable neighbours (`river → rivers,
   upstream, …`; `said → stated, commented, …`) with the substitution route give 149.21 → 148.42 (−0.5 %). This
   is the similarity-based smoothing of Dagan, Lee & Pereira (1999); its size is in line with that literature
   once the baseline is well smoothed.
3. **Glow centres add 0.1 PPL on top (0.07 %).** The field can only act through the semantic routes, which carry
   under 3 % of the probability mass, so it has almost no leverage. The effect is too small to be separated
   from noise without a paired test (see `run_extras.py`, which also evaluates a variant where the field acts
   directly on all candidates).
4. **An ordered in-context memory is what moves the needle.** Recording what followed each token earlier in the
   same document (the extension proposed in the discussion, an induction-head-like mechanism) cuts perplexity
   by 25 %, raises cloze accuracy by 40 % relative, and solves the synthetic induction test that every
   bag-of-activations variant fails completely (0.976 vs 0.000). This is the empirical form of the argument
   that glow centres, as a bag, are not equivalent to attention heads: the match-then-shift operation needs
   positional (ordered) memory.
5. Generation: the semantic routes and glow did not change topical coherence with the prompt within the noise of
   8 prompts; the in-context table raised it, at the cost of copying 10 % of its content words from the prompt
   and a small amount of 4-gram repetition. Samples are in `results/report.md`.

Caveats: a trigram baseline is weaker than a 4- or 5-gram; the glow field has one scalar per cluster; the
semantic relations are static corpus statistics; no parameter is learned by gradient descent. These are
properties of the idea as specified, not of the data.
