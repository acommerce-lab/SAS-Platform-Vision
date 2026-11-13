# What should a glow centre compute?

Runtime 10.7 min. Field applied to all candidates: P'(x|h) ~ P_KN(x|h) exp(beta u[cl(x)]), normalised exactly. `edge` marks an optimum on the border of its grid.

## 1. Field definitions (test perplexity)

| base | field | tuned | test PPL | change vs base | edge |
|---|---|---|---|---|---|
| KN-3 | none | - | 149.21 | - | |
| KN-3 | linear cluster-PMI field u = A.hbar (from controls.md) | rho 0.97, beta 3.0 | 133.47 | -10.5% | |
| KN-3 | self-activation relative to the cluster's prior, u = log((hbar+p)/2p) | rho 0.997, beta 1.0 | 120.98 | -18.9% |  |
| KN-3 | self-activation + lam x off-diagonal PMI forces | lam 2.0, rho_cross 0.97, beta 0.75 | 119.59 | -19.9% |  |
| KN-4 | none | - | 123.12 | - | |
| KN-4 | linear cluster-PMI field u = A.hbar (from controls.md) | rho 0.97, beta 3.0 | 111.54 | -9.4% | |
| KN-4 | self-activation relative to the cluster's prior, u = log((hbar+p)/2p) | rho 0.997, beta 0.75 | 102.09 | -17.1% |  |
| KN-4 | self-activation + lam x off-diagonal PMI forces | lam 1.0, rho_cross 0.97, beta 0.75 | 101.01 | -18.0% |  |
| KN-3 | self-activation on RANDOM clusters (frequency-matched shuffle) | rho 0.997, beta 0.75 | 135.57 | -9.1% | |

## 2. Count-only stacks (test perplexity)

| model | test PPL | change vs its Kneser-Ney base |
|---|---|---|
| KN-3 | 149.21 | +0.0% |
| KN-3 + self field | 120.98 | -18.9% |
| KN-3 + self field + cross-cluster forces | 119.59 | -19.9% |
| KN-3 + unigram cache | 114.32 | -23.4% |
| KN-3 + unigram cache + successor table | 96.98 | -35.0% |
| KN-3 + self field + unigram cache | 103.01 | -31.0% |
| KN-3 + self field + unigram cache + successor table | 90.61 | -39.3% |
| KN-3 + self field + cross-cluster forces + unigram cache | 100.86 | -32.4% |
| KN-3 + self field + cross-cluster forces + unigram cache + successor table | 88.53 | -40.7% |
| KN-4 | 123.12 | +0.0% |
| KN-4 + self field | 102.09 | -17.1% |
| KN-4 + self field + cross-cluster forces | 101.01 | -18.0% |
| KN-4 + unigram cache | 95.15 | -22.7% |
| KN-4 + unigram cache + successor table | 82.85 | -32.7% |
| KN-4 + self field + unigram cache | 85.98 | -30.2% |
| KN-4 + self field + unigram cache + successor table | 75.96 | -38.3% |
| KN-4 + self field + cross-cluster forces + unigram cache | 85.27 | -30.7% |
| KN-4 + self field + cross-cluster forces + unigram cache + successor table | 75.38 | -38.8% |

## 3. Paired bootstrap over 63 test blocks (ratio < 1: first model better)

| comparison | PPL ratio | 95% CI |
|---|---|---|
| KN-3 | self field vs KN | 0.8108 | [0.8008, 0.8212] |
| KN-3 | adding cross-cluster forces to the self field | 0.9885 | [0.9862, 0.9907] |
| KN-3 | adding the self field to the unigram cache | 0.9010 | [0.8904, 0.9106] |
| KN-3 | adding the unigram cache to the self field | 0.8515 | [0.8291, 0.8738] |
| KN-3 | adding the self field to both caches | 0.9344 | [0.9232, 0.9461] |
| KN-3 | adding the successor table to self field + unigram cache (value of order) | 0.8797 | [0.8610, 0.8948] |
| KN-4 | self field vs KN | 0.8292 | [0.8204, 0.8382] |
| KN-4 | adding cross-cluster forces to the self field | 0.9895 | [0.9882, 0.9907] |
| KN-4 | adding the self field to the unigram cache | 0.9036 | [0.8958, 0.9101] |
| KN-4 | adding the unigram cache to the self field | 0.8422 | [0.8195, 0.8678] |
| KN-4 | adding the self field to both caches | 0.9168 | [0.9103, 0.9229] |
| KN-4 | adding the successor table to self field + unigram cache (value of order) | 0.8835 | [0.8642, 0.8980] |
| KN-3 | self field: semantic clusters vs random clusters | 0.8924 | [0.8852, 0.8992] |
| KN-3 | random-cluster self field vs KN | 0.9086 | [0.8988, 0.9182] |

## 4. Cloze, left context only (same 2,000 blanks)

| model | acc@1 | acc@10 | MRR |
|---|---|---|---|
| KN-3 | 0.086 | 0.225 | 0.134 |
| KN-3 + self field | 0.115 | 0.271 | 0.170 |

Paired MRR difference: +0.0360 (95% CI +0.0285 to +0.0439).
