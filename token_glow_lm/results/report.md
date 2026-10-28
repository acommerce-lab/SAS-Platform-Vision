# Results: token-cluster glow LM on WikiText-103

Train tokens 103,227,021, vocab 267,735, test tokens 245,569. KN order 3, M=30000, window=5, K=20 semantic children, 500 clusters. Runtime 13.2 min.

## 1. Perplexity (lower is better)

| model | neighbours | route | tau | beta | rho | valid PPL | test PPL | mean mass on semantic routes (test) |
|---|---|---|---|---|---|---|---|---|
| KN-2 | - | - | - | - | - | 257.71 | 261.53 | 0 |
| KN-3 | - | - | - | - | - | 145.62 | 149.21 | 0 |
| static semantic (beta=0) | cooc | bigram | 10.0 | 0 | - | 145.59 | 149.15 | 0.002 |
| glow | cooc | bigram | 10.0 | 2.0 | 0.97 | 145.55 | 149.11 | 0.003 |
| static semantic (beta=0) | cooc | sub | 10.0 | 0 | - | 145.51 | 149.05 | 0.002 |
| glow | cooc | sub | 10.0 | 2.0 | 0.9 | 145.44 | 149.00 | 0.004 |
| static semantic (beta=0) | distrib | bigram | 8.0 | 0 | - | 145.47 | 149.02 | 0.004 |
| glow | distrib | bigram | 8.0 | 2.0 | 0.97 | 145.41 | 148.95 | 0.005 |
| static semantic (beta=0) | distrib | sub | 6.0 | 0 | - | 144.91 | 148.42 | 0.028 |
| glow | distrib | sub | 6.0 | 1.0 | 0.997 | 144.84 | 148.32 | 0.028 |
| best glow + in-context successor table | distrib/sub | | 6.0 | 1.0 | 0.997 (kappa=-1.0, decay=0.999) | 110.47 | 111.61 | - |

## 2. Cloze (fill-in-the-blank), content-word targets, candidates = top-M vocabulary

| model | left acc@1 | left acc@10 | left MRR | bidir acc@1 | bidir acc@10 | bidir MRR |
|---|---|---|---|---|---|---|
| KN-3 | 0.086 | 0.225 | 0.134 | 0.261 | 0.490 | 0.337 |
| static semantic | 0.086 | 0.223 | 0.134 | 0.259 | 0.491 | 0.336 |
| glow | 0.086 | 0.224 | 0.134 | 0.259 | 0.490 | 0.337 |
| glow + induction table | 0.121 | 0.291 | 0.179 | 0.292 | 0.532 | 0.373 |

n = 2000 items. The bidirectional score adds the same order-3 KN right-context term to every model.

## 3. Generation (top-k=40 sampling, same seeds for every model)

| model | distinct-1 | distinct-2 | distinct-3 | repeated 4-grams | prompt-copy rate | PMI coherence of novel content words with prompt |
|---|---|---|---|---|---|---|
| KN-3 | 0.492 | 0.869 | 0.974 | 0.000 | 0.000 | 0.105 |
| glow | 0.465 | 0.871 | 0.987 | 0.000 | 0.000 | 0.092 |
| glow + induction table | 0.456 | 0.797 | 0.933 | 0.026 | 0.098 | 0.139 |

PMI coherence uses the training co-occurrence statistics that the glow model itself exploits, so it favours the glow model by construction; it measures topical stickiness, not grammaticality.

### Samples: KN-3

- **prompt:** = Du Fu = <eos> <eos> Du Fu ( Wade – Giles : Tu Fu ; Chinese : <unk> ; 712 – 770 ) was a prominent Chinese poet of
  **continuation:** King George V , to get rid of her body " . They were initially considered mounted infantry . <eos> <eos> = = <eos> <eos> = French army to join a band of cilia round the neck are Isaac and Miria appear to be " The first episode of SmackDown , Orton to win the game . However , the

- **prompt:** = Kiss You ( One Direction song ) = <eos> <eos> " Kiss You " is a song recorded by English @-@ Irish boy band One Direction for their second
  **continuation:** @-@ level circulation ; however , with a more " realistic " . " <eos> The episode received mixed reviews , with a capacity to allow him to the final version of the world of New York . He was elected mayor and a high school and , in turn replaced with a half @-@ life experience — were used

- **prompt:** = Dick <unk> = <eos> <eos> Richard Gale " Dick " <unk> ( August 21 , 1926 – December 5 , 1994 ) was an American football player and a
  **continuation:** new version . <eos> The city is also the site , and in January 2012 . <unk> . The film was the site for the band , a former member of his most powerful state . In June 2002 , there is nothing like a real documentary — depicts the story . I feel that one can still be seen

### Samples: glow

- **prompt:** = Du Fu = <eos> <eos> Du Fu ( Wade – Giles : Tu Fu ; Chinese : <unk> ; 712 – 770 ) was a prominent Chinese poet of
  **continuation:** King George V , to produce an atomic bomb could not be completed by May . They also noted that the " New Wave . In 2003 . He played with the first , he was able to win the gold medal game . The only known for his next six years with the <unk> , the highway . The

- **prompt:** = Kiss You ( One Direction song ) = <eos> <eos> " Kiss You " is a song recorded by English @-@ Irish boy band One Direction for their second
  **continuation:** @-@ level circulation ; however , with a more " human being , was the most popular , and the French Navy and that an area of the most populous of the American Music Awards ; the rest of the British squadron of the town 's largest exporter of lettuce and 11 @,@ 400 km ) wide by Steve Lillywhite

- **prompt:** = Dick <unk> = <eos> <eos> Richard Gale " Dick " <unk> ( August 21 , 1926 – December 5 , 1994 ) was an American football player and a
  **continuation:** new record with a 1 @.@ 5 million ( 2003 ) . The route heads northward around the same time , but no serious damage ; it has been described as having the advantage in the country , were tuned into it with the main line at the time of 1 @,@ 050 @-@ 2 <unk> . A large number

### Samples: glow + induction table

- **prompt:** = Du Fu = <eos> <eos> Du Fu ( Wade – Giles : Tu Fu ; Chinese : <unk> ; 712 – 770 ) was a prominent Chinese poet of
  **continuation:** King George V , to produce an atomic bomb could not be completed by May . They also noted that the " New Wave . They do in an interview that the " , " New York University Medical Center . They were married on 28 June 2008 , which became the largest of King George V of King George

- **prompt:** = Kiss You ( One Direction song ) = <eos> <eos> " Kiss You " is a song recorded by English @-@ Irish boy band One Direction for their second
  **continuation:** @-@ leading to severe damage . One Direction performed " and that he will be used to severe damage . After the first one as it would be used until the first to make sure of the first one as the only major change of heart and mind @-@ numbing assaults in the country . <eos> On 18 January 1916

- **prompt:** = Dick <unk> = <eos> <eos> Richard Gale " Dick " <unk> ( August 21 , 1926 – December 5 , 1994 ) was an American football player and a
  **continuation:** new record with a new and a new and different ways . " The episode features were inspired by the <unk> , where she is actually the one @-@ year @-@ end " of " of the one thing . A week after the release of " of the one hand and head and neck for a number of the

## 4. Synthetic induction test (random content-token sequence repeated twice)

| model | PPL first copy | PPL second copy | top-1 acc second copy |
|---|---|---|---|
| KN-3 | 265910.1 | 265910.1 | 0.000 |
| static semantic | 263040.4 | 263040.5 | 0.000 |
| glow | 262186.6 | 263013.3 | 0.000 |
| glow + induction table | 262186.6 | 3.8 | 0.976 |

## 5. Semantic children examples

- **king** — cooc: crowned(4.02), Chola(3.91), Angles(3.82), vulture(3.66), queen(3.62), Picts(3.47), Copán(3.43), overlord(3.37)
  distrib: throne(0.76), kings(0.75), King(0.73), overlord(0.72), kingship(0.72), kingdom(0.7), Æthelred(0.7), overlordship(0.68)
- **river** — cooc: otter(4.38), valleys(4.17), otters(4.12), banks(3.96), navigable(3.93), martin(3.93), bend(3.91), bank(3.76)
  distrib: rivers(0.85), upstream(0.83), downstream(0.82), creek(0.8), River(0.8), stream(0.79), navigable(0.79), Parrett(0.78)
- **football** — cooc: FBS(4.47), Wolverines(4.23), college(4.1), tier(4.01), association(3.79), varsity(3.74), professional(3.73), soccer(3.69)
  distrib: soccer(0.81), rugby(0.8), basketball(0.78), lacrosse(0.77), varsity(0.77), collegiate(0.73), teams(0.73), athletics(0.73)
- **the** — cooc: of(1.68), ,(1.29), in(1.23), to(1.19), .(1.17), and(1.1), end(1.07), on(0.98)
  distrib: of(0.7), and(0.64), .(0.61), end(0.59), time(0.56), first(0.54), The(0.53), ,(0.52)
- **doctor** — cooc: Mengele(4.18), dentist(4.08), prescription(3.97), witch(3.89), medical(3.86), diagnosed(3.72), prescribed(3.69), Fenton(3.5)
  distrib: doctors(0.76), hospital(0.73), surgeon(0.71), physician(0.71), patient(0.68), nurse(0.68), psychiatrist(0.67), clinic(0.66)
- **music** — cooc: Musicnotes.com(4.06), video(3.86), accompanying(3.82), videos(3.79), incidental(3.78), sheet(3.58), critics(3.33), classical(3.31)
  distrib: musical(0.75), jazz(0.74), electronica(0.73), orchestral(0.71), influences(0.69), techno(0.69), symphonic(0.68), pop(0.68)
- **war** — cooc: civil(3.77), waged(3.44), crimes(3.44), prisoner(3.41), prisoners(3.34), outbreak(3.29), declaration(3.21), post(3.11)
  distrib: War(0.75), hostilities(0.73), occupation(0.66), wars(0.65), armistice(0.62), Armistice(0.62), outbreak(0.6), conflict(0.6)
- **said** — cooc: Schur(3.04), spokesman(2.7), interview(2.69), "(2.55), that(2.51), he(2.34), spokesperson(2.28), We(2.28)
  distrib: stated(0.91), commented(0.87), remarked(0.83), joked(0.77), felt(0.77), opined(0.75), explained(0.74), told(0.73)

## 6. Cluster examples (glow centres)

- cluster of **king**: II, King, king, III, V, reign, IV, throne, crown, VII, VI, succession
- cluster of **river**: River, river, Creek, mouth, flow, lake, valley, rivers, Water, Run, basin, watershed
- cluster of **football**: national, playing, international, football, teams, professional, currently, sports, stadium, youth, clubs, basketball
- cluster of **the**: the, ,, ., of, and, a, was, as, with, by, is, he
- cluster of **doctor**: health, medical, care, hospital, Hospital, treated, doctor, patients, recovery, patient, doctors, specialist
- cluster of **music**: music, B, rock, sound, elements, pop, dance, influenced, R, alternative, genre, incorporated
- cluster of **war**: War, war, battle, action, Battle, participated, Civil, fought, Revolution, Wars, battles, engagement
- cluster of **said**: said, called, wrote, described, gave, stated, felt, noted, writing, praised, review, compared
