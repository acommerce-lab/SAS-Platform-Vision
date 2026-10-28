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

The full WikiText-103 run writes `results/report.md` and `results/results.json`; the summary of that run is added to this section once it completes.
