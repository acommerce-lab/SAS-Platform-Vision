# Counting versus data size on WikiText-103

| train tokens | KN-2 PPL | KN-3 PPL | KN-4 PPL | seen history len 1 | len 2 | len 3 | KN-3 PPL, seen trigram history | KN-3 PPL, unseen | unique bigrams | unique trigrams | unique 4-grams |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1,000,000 | 618.6 | 549.7 | 539.3 | 1.000 | 0.641 | 0.273 | 511.5 | 625.2 | 384,914 | 741,834 | 902,014 |
| 3,000,000 | 465.7 | 384.9 | 373.6 | 1.000 | 0.738 | 0.368 | 357.3 | 474.4 | 913,317 | 2,023,095 | 2,616,378 |
| 10,000,000 | 370.0 | 278.9 | 264.8 | 1.000 | 0.820 | 0.472 | 263.2 | 362.6 | 2,234,155 | 5,852,018 | 8,215,610 |
| 30,000,000 | 305.7 | 203.6 | 184.2 | 1.000 | 0.882 | 0.577 | 195.0 | 280.9 | 4,855,901 | 14,927,297 | 22,852,469 |
| 103,227,021 | 261.5 | 149.2 | 123.1 | 1.000 | 0.931 | 0.688 | 144.9 | 222.3 | 11,040,793 | 40,790,054 | 69,457,980 |

Share of test positions whose preceding n tokens occur as a sequence in the full training set:

| n | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|
| share | 0.931 | 0.688 | 0.412 | 0.239 | 0.158 |

Log-log slope of KN-4 perplexity against training size: -0.316. Naive power-law extrapolation of KN-4: 1e+09 tokens -> 60.5, 1e+10 tokens -> 29.2, 1e+11 tokens -> 14.1, 1e+12 tokens -> 6.8 (the true curve flattens because order-4 contexts cannot carry longer dependencies).

