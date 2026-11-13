# Controls: identity versus order, the affinity field, and a stronger baseline

Runtime 22.8 min. Hyper-parameters tuned on validation; test scored once. `edge` marks an optimum on the border of its grid.

## 1. Caches on top of Kneser-Ney (test perplexity)

| contextual base | addition | test PPL | change vs base | tuned (decay_u, kappa_u, decay_b, kappa_b) |
|---|---|---|---|---|
| KN-3 | - | 149.21 | - | - |
| KN-3 | unigram cache | 114.32 | -23.4% | (0.997, -2.0, None, None) |
| KN-3 | successor table | 112.62 | -24.5% | (None, None, 0.999, -2.0) |
| KN-3 | unigram cache + successor table | 96.98 | -35.0% | (0.997, -2.0, 0.999, -1.0) |
| KN-4 | - | 123.12 | - | - |
| KN-4 | unigram cache | 95.15 | -22.7% | (0.997, -2.0, None, None) |
| KN-4 | successor table | 94.52 | -23.2% | (None, None, 0.999, -2.0) |
| KN-4 | unigram cache + successor table | 82.85 | -32.7% | (0.997, -3.0, 0.999, -2.0) |

## 2. Direct glow: which part of the affinity matrix carries the gain?

| contextual base | affinity | rho | beta | test PPL | change vs base | edge |
|---|---|---|---|---|---|---|
| KN-3 | full PMI field | 0.97 | 3.0 | 133.47 | -10.5% |  |
| KN-4 | full PMI field | 0.97 | 3.0 | 111.54 | -9.4% |  |
| KN-3 | diagonal only (self-attraction) | 0.99 | 6.0 | 142.30 | -4.6% |  |
| KN-4 | diagonal only (self-attraction) | 0.99 | 6.0 | 117.88 | -4.3% |  |
| KN-3 | off-diagonal only | 0.97 | 3.0 | 138.13 | -7.4% |  |
| KN-4 | off-diagonal only | 0.97 | 3.0 | 115.03 | -6.6% |  |
| KN-3 | attraction only (A>0) | 0.99 | 4.0 | 136.55 | -8.5% |  |
| KN-4 | attraction only (A>0) | 0.99 | 4.0 | 114.00 | -7.4% |  |
| KN-3 | repulsion only (A<0) | 0.9 | 2.0 | 144.85 | -2.9% | yes |
| KN-4 | repulsion only (A<0) | 0.9 | 2.0 | 119.83 | -2.7% | yes |
| KN-3 | identity (plain cluster cache) | 0.97 | 1.0 | 148.55 | -0.4% |  |
| KN-4 | identity (plain cluster cache) | 0.97 | 1.0 | 122.44 | -0.6% |  |
| KN-3 | prior-normalised cluster cache (log-ratio, no PMI matrix) | 0.997 | 1.0 | 120.98 | -18.9% | yes |
| KN-4 | prior-normalised cluster cache (log-ratio, no PMI matrix) | 0.997 | 1.0 | 102.24 | -17.0% | yes |
| KN-3 | full PMI field on RANDOM clusters (frequency-matched shuffle of the labels) | 0.97 | 4.0 | 147.70 | -1.0% |  |

## 3. Direct glow combined with token-level caches

| contextual base | model | test PPL | change vs base |
|---|---|---|---|
| KN-3 | direct glow (full PMI field) | 133.47 | -10.5% |
| KN-3 | direct glow + unigram cache | 105.80 | -29.1% |
| KN-3 | direct glow + successor table | 103.36 | -30.7% |
| KN-3 | direct glow + unigram cache + successor table | 91.04 | -39.0% |
| KN-4 | direct glow (full PMI field) | 111.54 | -9.4% |
| KN-4 | direct glow + unigram cache | 88.86 | -27.8% |
| KN-4 | direct glow + successor table | 87.40 | -29.0% |
| KN-4 | direct glow + unigram cache + successor table | 77.74 | -36.9% |

## 4. Paired bootstrap over 63 test blocks (PPL ratio < 1 means the first model is better)

| comparison | PPL ratio | 95% CI |
|---|---|---|
| KN-3 | unigram cache vs KN | 0.7662 | [0.7417, 0.7944] |
| KN-3 | successor table vs KN | 0.7548 | [0.7257, 0.7800] |
| KN-3 | successor table vs unigram cache | 0.9851 | [0.9550, 1.0111] |
| KN-3 | adding the table to the unigram cache (value of order) | 0.8483 | [0.8195, 0.8698] |
| KN-3 | adding the unigram cache to the table | 0.8611 | [0.8430, 0.8801] |
| KN-3 | direct glow vs KN | 0.8945 | [0.8838, 0.9042] |
| KN-3 | adding direct glow to the unigram cache | 0.9254 | [0.9181, 0.9326] |
| KN-3 | adding direct glow to both caches | 0.9388 | [0.9340, 0.9431] |
| KN-3 | full PMI field vs identity (plain cluster cache) | 0.8985 | [0.8883, 0.9080] |
| KN-3 | full PMI field vs diagonal only | 0.9380 | [0.9334, 0.9423] |
| KN-3 | full PMI field vs prior-normalised cluster cache | 1.1032 | [1.0935, 1.1144] |
| KN-4 | unigram cache vs KN | 0.7728 | [0.7463, 0.8035] |
| KN-4 | successor table vs KN | 0.7677 | [0.7361, 0.7972] |
| KN-4 | successor table vs unigram cache | 0.9933 | [0.9678, 1.0186] |
| KN-4 | adding the table to the unigram cache (value of order) | 0.8708 | [0.8489, 0.8874] |
| KN-4 | adding the unigram cache to the table | 0.8766 | [0.8629, 0.8916] |
| KN-4 | direct glow vs KN | 0.9059 | [0.8979, 0.9137] |
| KN-4 | adding direct glow to the unigram cache | 0.9339 | [0.9288, 0.9392] |
| KN-4 | adding direct glow to both caches | 0.9383 | [0.9343, 0.9425] |
| KN-4 | full PMI field vs identity (plain cluster cache) | 0.9110 | [0.9031, 0.9182] |
| KN-4 | full PMI field vs diagonal only | 0.9462 | [0.9419, 0.9499] |
| KN-4 | full PMI field vs prior-normalised cluster cache | 1.0909 | [1.0798, 1.1022] |
| KN-3 | full PMI field: semantic clusters vs random clusters | 0.9037 | [0.8942, 0.9128] |
| KN-3 | random-cluster field vs KN | 0.9899 | [0.9882, 0.9917] |
| KN-4 vs KN-3 (one more token of context) | 0.8252 | [0.7648, 0.8754] |

## 5. Cloze (same 2,000 blanks as the main run; order-3 base)

| model | left acc@1 | left acc@10 | left MRR | bidir acc@1 | bidir acc@10 | bidir MRR |
|---|---|---|---|---|---|---|
| KN-3 | 0.086 | 0.225 | 0.134 | 0.261 | 0.490 | 0.337 |
| KN-3 + unigram cache | 0.087 | 0.219 | 0.135 | 0.269 | 0.518 | 0.351 |
| KN-3 + successor table | 0.106 | 0.278 | 0.166 | 0.280 | 0.527 | 0.365 |
| KN-3 + unigram cache + successor table | 0.120 | 0.288 | 0.179 | 0.296 | 0.544 | 0.379 |
| KN-3 + direct glow | 0.107 | 0.249 | 0.156 | 0.273 | 0.507 | 0.349 |
| KN-3 + direct glow + both caches | 0.128 | 0.307 | 0.191 | 0.300 | 0.551 | 0.385 |

- left MRR, successor table minus unigram cache: +0.0303 (95% CI +0.0243 to +0.0367)
- left MRR, both caches minus unigram cache: +0.0437 (95% CI +0.0352 to +0.0525)
- left MRR, unigram cache minus KN: +0.0011 (95% CI +0.0004 to +0.0018)
- left MRR, direct glow minus KN: +0.0222 (95% CI +0.0175 to +0.0270)

## 6. Synthetic induction (12 random content tokens repeated twice; order-3 base)

| model | PPL first copy | PPL second copy | top-1 acc second copy |
|---|---|---|---|
| KN-3 | 273304.7 | 273369.6 | 0.000 |
| KN-3 + unigram cache | 310292.5 | 149.5 | 0.000 |
| KN-3 + successor table | 273304.7 | 8.4 | 0.715 |
| KN-3 + unigram cache + successor table | 310292.5 | 4.0 | 0.965 |
| KN-3 + direct glow | 1240668.9 | 401963.1 | 0.000 |
| KN-3 + direct glow + both caches | 1408575.2 | 4.0 | 0.947 |
