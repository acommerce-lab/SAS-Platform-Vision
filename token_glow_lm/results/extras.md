# Extras: direct glow field and significance tests

Same data and hyper-parameters as the main run (`results/report.md`). Runtime 14.8 min.

## Test perplexity

| model | valid PPL | test PPL |
|---|---|---|
| Kneser-Ney 3-gram | 145.62 | 149.21 |
| static semantic routes | 144.91 | 148.42 |
| glow via semantic routes (original design) | 144.84 | 148.32 |
| direct glow on all candidates (rho=0.97, beta=3.0) | 130.61 | 133.47 |
| glow + in-context successor table | 110.47 | 111.61 |
| direct glow + in-context successor table (kappa=-2.0) | 101.91 | 103.36 |

## Paired bootstrap over 63 test articles (2000 resamples)

| comparison | PPL ratio | 95% CI | p(not better) |
|---|---|---|---|
| static vs KN | 0.9947 | [0.9927, 0.9971] | 0.000 |
| glow vs static | 0.9994 | [0.9992, 0.9996] | 0.000 |
| glow vs KN | 0.9941 | [0.9920, 0.9965] | 0.000 |
| direct vs KN | 0.8945 | [0.8835, 0.9043] | 0.000 |
| direct vs glow | 0.8999 | [0.8887, 0.9100] | 0.000 |
| glow+table vs KN | 0.7480 | [0.7152, 0.7782] | 0.000 |
| glow+table vs glow | 0.7525 | [0.7197, 0.7828] | 0.000 |
| direct+table vs glow+table | 0.9261 | [0.9180, 0.9362] | 0.000 |

## Cloze with the direct glow field

| model | left acc@1 | left acc@10 | left MRR | bidir acc@1 | bidir acc@10 | bidir MRR |
|---|---|---|---|---|---|---|
| KN | 0.086 | 0.225 | 0.134 | 0.261 | 0.490 | 0.337 |
| direct glow | 0.107 | 0.249 | 0.156 | 0.273 | 0.507 | 0.349 |

## Direct glow validation grid

| rho | beta | valid PPL |
|---|---|---|
| 0.9 | 0.25 | 143.12 |
| 0.9 | 0.5 | 140.98 |
| 0.9 | 1.0 | 137.74 |
| 0.9 | 1.5 | 135.75 |
| 0.9 | 2.0 | 134.94 |
| 0.9 | 3.0 | 136.75 |
| 0.9 | 4.0 | 143.27 |
| 0.97 | 0.25 | 143.20 |
| 0.97 | 0.5 | 141.02 |
| 0.97 | 1.0 | 137.37 |
| 0.97 | 1.5 | 134.56 |
| 0.97 | 2.0 | 132.52 |
| 0.97 | 3.0 | 130.61 |
| 0.97 | 4.0 | 131.41 |
| 0.99 | 0.25 | 143.43 |
| 0.99 | 0.5 | 141.44 |
| 0.99 | 1.0 | 138.04 |
| 0.99 | 1.5 | 135.35 |
| 0.99 | 2.0 | 133.31 |
| 0.99 | 3.0 | 131.03 |
| 0.99 | 4.0 | 130.98 |
| 0.997 | 0.25 | 143.66 |
| 0.997 | 0.5 | 141.88 |
| 0.997 | 1.0 | 138.84 |
| 0.997 | 1.5 | 136.44 |
| 0.997 | 2.0 | 134.62 |
| 0.997 | 3.0 | 132.64 |
| 0.997 | 4.0 | 132.70 |
