# The original routing design under fairer instantiations

Substitution route, no glow, count-based only. Runtime 13.1 min. PPL ratio is against the Kneser-Ney base of the same order (paired bootstrap, 95% CI).

| base | children | tax | K | gamma | tuned tau | test PPL | PPL ratio vs base |
|---|---|---|---|---|---|---|---|
| KN-3 | - | - | - | - | - | 149.21 | 1 |
| KN-3 | sym | global | 40 | 8.0 | 4.0 | 148.19 | 0.9932 [0.9910, 0.9957] |
| KN-3 | sym | per history-count bucket | 40 | 8.0 | 3.0 / 3.0 / 3.0 / 4.0 / 5.0 | 148.04 | 0.9922 [0.9900, 0.9944] |
| KN-3 | succ | global | 40 | 4.0 | 5.0 | 147.32 | 0.9873 [0.9842, 0.9909] |
| KN-3 | succ | per history-count bucket | 40 | 2.0 | 4.0 / 4.0 / 5.0 / 5.0 / 6.0 | 146.99 | 0.9852 [0.9809, 0.9902] |
| KN-3 | pred | global | 20 | 2.0 | 6.0 | 148.33 | 0.9941 [0.9925, 0.9959] |
| KN-3 | pred | per history-count bucket | 40 | 4.0 | 4.0 / 4.0 / 4.0 / 5.0 / 8.0 | 147.89 | 0.9912 [0.9889, 0.9938] |
| KN-3 | both | global | 40 | 4.0 | 4.0 | 146.41 | 0.9813 [0.9774, 0.9859] |
| KN-3 | both | per history-count bucket | 40 | 4.0 | 3.0 / 3.0 / 3.0 / 3.0 / 4.0 | 146.00 | 0.9785 [0.9727, 0.9852] |
| KN-4 | - | - | - | - | - | 123.12 | 1 |
| KN-4 | sym | global | 40 | 8.0 | 4.0 | 122.06 | 0.9913 [0.9888, 0.9942] |
| KN-4 | sym | per history-count bucket | 40 | 8.0 | 3.0 / 4.0 / 4.0 / 4.0 / 5.0 | 121.86 | 0.9898 [0.9871, 0.9925] |
| KN-4 | succ | global | 20 | 2.0 | 5.0 | 121.26 | 0.9849 [0.9806, 0.9898] |
| KN-4 | succ | per history-count bucket | 40 | 4.0 | 4.0 / 5.0 / 5.0 / 5.0 / 6.0 | 120.95 | 0.9824 [0.9789, 0.9867] |
| KN-4 | pred | global | 10 | 2.0 | 5.0 | 122.15 | 0.9921 [0.9898, 0.9948] |
| KN-4 | pred | per history-count bucket | 20 | 4.0 | 4.0 / 5.0 / 5.0 / 5.0 / 8.0 | 121.85 | 0.9897 [0.9872, 0.9922] |
| KN-4 | both | global | 20 | 4.0 | 3.0 | 120.41 | 0.9779 [0.9715, 0.9855] |
| KN-4 | both | per history-count bucket | 40 | 4.0 | 3.0 / 4.0 / 4.0 / 4.0 / 5.0 | 119.96 | 0.9743 [0.9695, 0.9797] |

Buckets (training count of the n-gram history): unseen / 1-2 / 3-9 / 10-99 / >=100. tau = 30 means the route is closed in that bucket.

KN-3 test positions per bucket: unseen 6.9% (PPL 222), 1-2 4.9% (PPL 103), 3-9 7.0% (PPL 105), 10-99 18.7% (PPL 111), >=100 62.5% (PPL 167)
KN-4 test positions per bucket: unseen 31.2% (PPL 204), 1-2 12.8% (PPL 79), 3-9 12.1% (PPL 90), 10-99 20.2% (PPL 96), >=100 23.7% (PPL 117)

## Children examples

- **king**: sym: throne, kings, King, overlord, kingship, kingdom; succ: emperor, Emperor, prince, Stalin, bishop, Hitler; pred: prince, kings, monarch, ruler, queen, emperor; both: emperor, prince, ruler, Emperor, monarch, queen
- **river**: sym: rivers, upstream, downstream, creek, River, stream; succ: stream, creek, lake, canal, River, lava; pred: valley, lake, rivers, creek, canyon, valleys; both: creek, stream, lake, valley, canyon, rivers
- **said**: sym: stated, commented, remarked, joked, felt, opined; succ: says, saying, thought, stated, stating, believed; pred: stated, commented, described, wrote, noted, remarked; both: stated, commented, thought, explained, remarked, opined
- **doctor**: sym: doctors, hospital, surgeon, physician, patient, nurse; succ: priest, officer, soldier, teacher, sailor, lawyer; pred: physician, surgeon, psychiatrist, nurse, lawyer, doctors; both: physician, surgeon, psychiatrist, lawyer, priest, nurse
- **the**: sym: of, and, ., end, time, first; succ: The, entire, whole, eponymous, original, defunct; pred: its, these, his, their, this, certain; both: its, this, his, their, each, our
- **in**: sym: In, January, December, March, February, April; succ: From, In, Throughout, between, from, Between; pred: at, on, elsewhere, outside, alongside, during; both: throughout, until, at, outside, between, since
- **football**: sym: soccer, rugby, basketball, lacrosse, varsity, collegiate; succ: basketball, hockey, baseball, soccer, tennis, rugby; pred: basketball, baseball, hockey, rugby, athletics, lacrosse; both: basketball, hockey, baseball, rugby, soccer, lacrosse

Mean overlap between the 40 children of a token under two definitions: sym/succ 0.18, sym/pred 0.18, succ/pred 0.16
