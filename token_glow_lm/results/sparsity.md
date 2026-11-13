# Counting versus data size on WikiText-103

| train tokens | KN-2 PPL | KN-3 PPL | KN-4 PPL | KN-4 PPL on the fixed subset | test tokens whose type is absent from the prefix | previous token seen | 2-token history seen | 3-token history seen | KN-3 PPL, seen 2-token history | KN-3 PPL, unseen | unique bigrams | unique trigrams | unique 4-grams |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1,000,000 | 618.6 | 549.7 | 539.3 | 345.4 | 4.50% | 0.955 | 0.641 | 0.273 | 511.5 | 625.2 | 384,914 | 741,834 | 902,014 |
| 3,000,000 | 465.7 | 384.9 | 373.6 | 249.1 | 2.33% | 0.977 | 0.738 | 0.368 | 357.3 | 474.4 | 913,317 | 2,023,095 | 2,616,378 |
| 10,000,000 | 370.0 | 278.9 | 264.8 | 182.3 | 1.04% | 0.990 | 0.820 | 0.472 | 263.2 | 362.6 | 2,234,155 | 5,852,018 | 8,215,610 |
| 30,000,000 | 305.7 | 203.6 | 184.2 | 132.2 | 0.26% | 0.997 | 0.882 | 0.577 | 195.0 | 280.9 | 4,855,901 | 14,927,297 | 22,852,469 |
| 103,227,021 | 261.5 | 149.2 | 123.1 | 92.2 | 0.00% | 1.000 | 0.931 | 0.688 | 144.9 | 222.3 | 11,040,793 | 40,790,054 | 69,457,980 |

Every prefix model is scored with the full 267,735-word vocabulary, so part of the improvement with data is vocabulary acquisition; the fixed-subset column scores, at every size, only the test positions whose target type already occurs in the smallest prefix, which removes that part.

Share of test positions whose preceding n tokens occur as a sequence in the full training set:

| n | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|
| share | 0.931 | 0.688 | 0.412 | 0.239 | 0.158 |

## Log-log fits of perplexity against training size

| curve | fitted slope | local slopes between successive sizes | tokens at which the fitted line reaches PPL 18.3 | range using the steepest and shallowest local slope |
|---|---|---|---|---|
| KN-2 | -0.185 | -0.258, -0.191, -0.174, -0.126 | 1.44e+14 | 3.1e+12 to 1.5e+17 |
| KN-3 | -0.280 | -0.324, -0.268, -0.286, -0.252 | 1.72e+11 | 6.7e+10 to 4.3e+11 |
| KN-4 | -0.316 | -0.334, -0.286, -0.331, -0.326 | 4.39e+10 | 3.1e+10 to 8.2e+10 |
| KN-4, fixed subset | -0.283 | -0.298, -0.259, -0.293, -0.292 | 3.21e+10 | 2.4e+10 to 5.3e+10 |

The extrapolations assume a power law with no floor, 2.6 decades beyond the measured range. KN-2 and KN-3 visibly flatten in range; KN-4 does not, so these data do not locate its floor. A fixed-order model is bounded below by the order-n conditional entropy, and the usable order grows only like log(N)/H.

