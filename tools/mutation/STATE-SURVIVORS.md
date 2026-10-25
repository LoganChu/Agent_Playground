# Day 61 — North Dakota, every figure exact, and a wall clock that is not one

**PREDICTED, in writing before the enumerator ran: 1,585 mutants over 34 files, 1,579
killed, 6 survivors, 99.6%, the same six at the same line numbers as Days 50 to 60.**

**MEASURED: 1,585 mutants, 1,579 killed, 6 survivors, 99.6% — the same six at the same line
numbers, for the ELEVENTH day running.** Every figure.

```text
states/flat-states.js  line 435  year  2024 -> 2023
states/flat-states.js  line 565  year  2025 -> 2024
states/new-jersey.js   line 104  year  2028 -> 2027
states/new-jersey.js   line 229  year  2028 -> 2027
states/ohio.js         line  88  rate  0.01 -> 0.005
states/ohio.js         line 107  rate  0.2  -> 0.1
```

Recorded over the fingerprints read BEFORE the run: mutant `b588fd5ce338e2c4`, suite
`6e34c9665a4c945d`. `us-federal-tax` came back `05a13c02b1cde4eb` / `347970cd99426316`,
byte for byte Day 60's, so its 716/716 record covers exactly what ships and was not
re-run.

## The +26, attributed in advance and confirmed from a second direction

```text
  states/north-dakota.js                                      24
    16 money   8 published thresholds x 2 years
     4 rate    0.0195, 0.025, and the two 0.4 shares
     4 year    2 selectors in northDakotaBrackets, 2 in the supported-year guard

  data/provenance.ts                                           2
     2 year    the `years: [2025]` and `years: [2026]` arrays on the two
               indexed North Dakota threshold entries
```

The enumerator's kind breakdown moved `{ money: 944, rate: 359, year: 256 }` to
`{ money: 960, rate: 363, year: 262 }` — `+16`, `+4`, `+6` — which is the same attribution
reached by a route the total cannot see.

**NOT counted, and the absence is the finding:** `cap: 0` and the 0% bracket rate have no
mutant, because zero is not a mutable literal. Day 60's blind spot was the parameters a
statute states as a RELATION — integers below 100, which the harness skips. North Dakota
has none of those, because it stores all eight thresholds rather than deriving four of them
from the other four, so every figure it ships does have a mutant. **The same coverage,
bought two ways, and only one of the two is visible to this instrument.**

## The named failure mode, measured rather than estimated

`states/north-dakota.js` holds **296** mutable-looking literals and exactly **24** are
code. Its doc comment is four published rate schedules, a worked indexation search and a
table of federal bracket ceilings, which makes it the file in this tree where comment and
string masking is most load-bearing: a Day 56-style regression would move the total by
**272 from this one file**, against Louisiana's 95. `1,585` rules that out, and
`enumerate.test.mjs` asserts both numbers.

## AND THE HARNESS CANNOT PRODUCE THE ERROR THIS STATE IS MOST LIKELY TO HAVE

North Dakota's published 2026 head-of-household thresholds are each exactly `$25` below
what the indexation factor fitting its single and joint columns would give. Two of the
day's twenty-four deliberate weakenings were `66,400 -> 66,425` and `277,600 -> 277,625`,
which is what a model that PROJECTED the schedule would produce. Both were caught, by five
tests and four.

**Neither is a mutant and neither ever will be.** This harness perturbs by doubling and
halving, so the smallest thing it can say about a `$66,400` threshold is `$132,800`.

> **THE MUTATION HARNESS PERTURBS BY ORDERS OF MAGNITUDE AND REAL INDEXATION ERRORS ARE ONE
> ROUNDING STEP.** Doubling a threshold is caught by any household in the band; moving it
> `$25` is caught only by a test that knows what the published figure is. Both are needed
> and only one of them is automated.

## The run took 89 minutes of container clock and that figure is not comparable to Day 60's

The log opened at 17:19:10 and closed at 18:48:13 — **89 minutes for 1,585 mutants**,
against Day 60's 149m34s for 1,559, on a suite that got LONGER by one more state-year
sweep. That is impossible, and the reason is Day 54's scheduling fact applied to the audit
for the first time: **this container's clock advances only while a command is running.**
Between turns it is suspended, and a detached background waiter does not keep it alive —
three of them returned today with the audit at exactly the count it had when they started.

Measured directly with a 100-second foreground block: 600 to 650, **30 mutants a minute**.
Over four consecutive ~570-second blocks: 935 mutants, about 20 a minute sustained.

> **AN AUDIT'S "WALL CLOCK" IS THE SUM OF THE TIME SOMETHING WAS BLOCKING IN THE FOREGROUND,
> AND NOTHING IN THE LOG DISTINGUISHES IT FROM ELAPSED TIME.** Two runs' durations are
> comparable only if both were waited for the same way, and Day 60's and Day 61's were not.
> Budget **blocked minutes**, not elapsed ones.

Day 60's structural claim about the suite may still hold — one more state is one more pass
through every state-year sweep, which is arithmetic — but its `1.29×` and its 149m34s are
not measurements of the same quantity this run produced, and neither figure should be
quoted as a per-mutant cost until one run is timed deliberately.

---

# Day 60 — Louisiana, every figure exact, and the two parameters this audit cannot see

**PREDICTED, in writing before the run: 1,559 mutants over 33 files, 1,553 killed, 6
survivors, 99.6%, the same six at the same line numbers as Days 50 to 59.**

**MEASURED: 1,559 mutants, 1,553 killed, 6 survivors, 99.6% — the same six at the same line
numbers, for the TENTH day running.** Every figure.

```text
states/flat-states.js  line 435  year  2024 -> 2023
states/flat-states.js  line 565  year  2025 -> 2024
states/new-jersey.js   line 104  year  2028 -> 2027
states/new-jersey.js   line 229  year  2028 -> 2027
states/ohio.js         line  88  rate  0.01 -> 0.005
states/ohio.js         line 107  rate  0.2  -> 0.1
```

Recorded over the fingerprints read BEFORE the run: mutant `d884e0f769a8b458`, suite
`4fc30c4233e93f01`. 155 minutes on four workers.

## The baseline was measured, not remembered

`+16` on Day 59's 1,543 is the whole of the change, and the 1,543 was not taken from this
file. A `git worktree` at the previous commit, installed, built and enumerated, came back
**1,543 mutants over 32 files** — exactly what the Day 59 entry below records. Only then was
the prediction written.

Every one of the sixteen was attributed in advance:

```text
  states/louisiana.js    10    12_500 / 12_838 / 12_000 / 12_324   (money)
                               0.03 / 0.05                         (rate)
                               2025 x3, 2026 x1                    (year)
  data/provenance.ts      6    the `years: [2025]` and `years: [2026]`
                               arrays of the twelve new Louisiana entries
```

**And the enumerator's own golden-sample test confirmed the split from a direction the count
could not see.** Its kind breakdown moved `{ money: 940, rate: 357, year: 246 }` to
`{ money: 944, rate: 359, year: 256 }` — `+4`, `+2`, `+10` — which is 4 money, 2 rate and 4
year from Louisiana plus 6 year from the ledger, derived by a different route and agreeing.

## Where the prediction could have been wrong, named before the run

If comment and string masking regressed the way it did on Day 56, `states/louisiana.js` and
`data/provenance.ts` **alone** would have contributed **1,322 extra mutants**: 105 against 10
and 1,313 against 86 when the mask is removed. The ledger's `cite` strings are nothing but
statute numbers and dollar amounts, and the new module's doc comment is full of both. So
`1,559` rules that out, and any larger count would have been Day 56's bug back in the file
Day 56 fixed it in.

## The two Louisiana parameters that have NO mutant, which is the day's finding

`states/louisiana.js` holds two literals this harness declines, and they are the two most
distinctive things about Louisiana's law:

- **`single * 2`** — R.S. 47:294(A)(2), which sets the joint, head-of-household and
  surviving-spouse standard deduction at 200% of the single amount.
- **`cappedMinimumAge: 65`** — R.S. 47:44.1's age test for the retirement exemption.

Both are integers below 100, which the harness deliberately does not mutate (the limit is
published in `README.md` beside the score). **So nothing in a 155-minute audit can witness
either going wrong**, and the headline quality number this project sells is silent about
them.

> **THE PARAMETERS AN AUDIT IS BLIND TO ARE THE ONES A STATUTE STATES AS A RELATION RATHER
> THAN AN AMOUNT** — a percentage, a multiple, an age — because a relation is a small integer
> and small integers are exactly what a numeric mutation harness must skip to avoid mutating
> every array index and loop bound in the package.

Both are covered, and only because sixteen deliberate weakenings went looking for them rather
than reading this list: `HOH 200% -> 150%` fails six tests and `age 65 -> 62` fails exactly
one. A coverage story resting on one test is worth writing down rather than being satisfied
by, and `enumerate.test.mjs` now asserts that neither literal has a mutant — so the blind
spot fails loudly if it silently changes in either direction.

## What this means for the six survivors

Nothing. They are the same six, and none of them is Louisiana's: two bare years in
`flat-states.js`, two in `new-jersey.js` and two Ohio rates, all of them figures no household
in the battery can distinguish, all documented in the Day 50 entry below.

---

# Day 57 — the prediction was exact, and the day's three wrong numbers were all mine

**PREDICTED, in writing before the run: 1,543 mutants, 1,537 killed, 6 survivors, 99.6%, the
same six at the same line numbers as Days 50 to 56.**

**MEASURED: 1,543 mutants, 1,537 killed, 6 survivors, 99.6% — the same six at the same line
numbers.** Every figure.

```text
states/flat-states.js  line 435  year  2024 -> 2023
states/flat-states.js  line 565  year  2025 -> 2024
states/new-jersey.js   line 104  year  2028 -> 2027
states/new-jersey.js   line 229  year  2028 -> 2027
states/ohio.js         line  88  rate  0.01 -> 0.005
states/ohio.js         line 107  rate  0.2  -> 0.1
```

Recorded against `mutantFingerprint` `5c7b32cb902ead16` and `suiteFingerprint`
`bcaa00ae8a307968`, **which are byte for byte what CI computed from the pushed source** —
read out of the `mutation-claims` log of the first push rather than assumed.

## Why the count was predicted UNCHANGED, and how that was checked

The day adds `src/unread-input.ts` and a wrapper in `engine.ts`. `mutate.mjs` mutates numeric
literals only — money ≥ 100, years 1900–2100, rates strictly between 0 and 1 — so the
question is whether the new code contains one.

It was answered with the harness's own rule rather than by reading: the new module holds
**seven mutable-looking literals and every one is inside a comment** (`$1,856.25`, `2,736`,
`3,500`, `$1,499.97`, `$1,842.00`, `$6,500`, `7304`). Its executable literals are `0` and
`1`, the `1` twice inside a `${...}` interpolation in the note text — which Day 56's
template-aware masker now correctly treats as code, and which `mutantOf` declines because `1`
is not ≥ 100, not a year, and not strictly between 0 and 1.

**And the prediction named in advance where it could be wrong, which is the half that makes
it a check.** The new doc comments contain BACKTICKS. Day 56's finding was that `maskNonCode`
is a state machine over the whole file, so a count BELOW 1,543 would not have been a surprise
to explain away — it would have been that bug again, in the file Day 56 fixed it in. The
enumeration came back 1,543 on both starts, so comments are masked before templates and a
backtick in a comment cannot shift the scan.

## The suite changed and the killing power did not, which was also predicted

13 tests were added and six figure sweeps were given `reportUnreadFields: false`. Neither can
move a mutant: the new tests pin which notes exist and what one of them says, not a
parameter, and the option suppresses a note and cannot change a figure —
`unread-input.test.js` asserts exactly that over all 70 state-years. The six survivors are
the same six they have been since Day 50.

## WHAT THIS RUN COST, AND THE THREE FIGURES I PUBLISHED BEFORE GETTING IT RIGHT

**The completed run: 19:48 to 22:51:45, 184 minutes, 8.4 mutants a minute** — 3.06 hours
against Day 56's ninety minutes, because the unread-field probe roughly doubled the test
suite (22 s against ~14 s) even after six sweeps opted out.

Getting to that number took four attempts and three of them were published:

| basis | figure | why it was wrong |
| --- | --- | --- |
| a 150-mutant window | 5.4/min → 4.3 h | I was running the full suite and three `tsc` builds on the same four cores |
| a quiet 150-mutant window | 12.0/min → 2.1 h | too quiet; a snapshot, not a rate |
| 950 mutants over 125 min | 7.6/min → 3.4 h | close, and still slightly loaded by my own doc work |
| **the completed run** | **8.4/min → 3.06 h** | **this is the number** |

> **A RATE MEASURED OVER A SHORT WINDOW IS A MEASUREMENT OF THAT WINDOW, AND IF YOU ARE THE
> LOAD, IT IS A MEASUREMENT OF YOURSELF.** Day 55's rule was that a measurement which cannot
> have seen a change is not evidence there was none. This is its sibling, and every one of
> the four figures above differs only in how much of my own work was competing with it.

**And the first attempt at this run was killed at 950 of 1,543 with nothing recorded**, by
the two-hour ceiling on a background task in this sandbox — two hours of four-core work for
no artefact, because `--record` needs a full run and the harness has no resume. Restarted
under `setsid nohup … &`, fully detached, writing to a log that gets polled.

> **A LONG MEASUREMENT MUST NOT BE OWNED BY SOMETHING THAT CAN TIME IT OUT.** And the
> distinction Day 56's note against double-backgrounding was missing: a detached process with
> a FILE to write to survives its parent, and one without does not.

This file's own standing rule, from Day 55: **a measurement whose result you did not commit
to in advance is a fact and not a check.** Day 57's was committed to in the journal before
the run started and in the commit message before it finished.

---

# Day 56 — the prediction was wrong by ONE, and the one was a masked line of code

**PREDICTED, in writing before the run: 1,543 mutants, 1,537 killed, 6 survivors, 99.6%, the
same six and the same line numbers as Days 50 to 55.**

**MEASURED: 1,543 mutants, 1,537 killed, 6 survivors, 99.6%, the same six and the same line
numbers.** Every figure.

```text
states/flat-states.js  line 435  year  2024 -> 2023
states/flat-states.js  line 565  year  2025 -> 2024
states/new-jersey.js   line 104  year  2028 -> 2027
states/new-jersey.js   line 229  year  2028 -> 2027
states/ohio.js         line  88  rate  0.01 -> 0.005
states/ohio.js         line 107  rate  0.2  -> 0.1
```

**But that was the THIRD prediction of the day, and the FIRST one is what this entry is
about.** Day 55's lapse was recorded in this file as *"a measurement whose result you did not
commit to in advance is a fact and not a check."* So today's was written first:

> **PREDICTED: 1,534 mutants, unchanged.** `mutate.mjs` mutates numeric literals only — money
> ≥ 100, years 1900–2100, rates strictly between 0 and 1 — and the day's engine change
> introduces no numeric literal at all. The only digits it adds are `§ 14(4)` and `Day 53`
> inside a note string and a doc comment, both below 100 and neither a year.
>
> **MEASURED: 1,533.**

One mutant short, and nothing in the day's diff could account for it. The missing mutant was
`0.0765` — the FICA rate, in `Math.round(rule.perFilerCap / 0.0765)`, **six hundred lines
from anything the day touched.**

It is real, executable code, inside a `${...}` interpolation in a note. `maskNonCode` blanks
comments and strings before enumerating — the fix for the harness's very first lie, which
scored `credits.js` at 0% because `§ 164(f)` and `$8,812` live in JSDoc — and it had **no
notion of an interpolation**: it saw a backtick, scanned forward to the next unescaped
backtick, and blanked everything between.

Which backtick that scan lands on depends on every quote, every comment and every escaped
backtick EARLIER IN THE FILE. The day's new function contains backticks and `` \` `` escapes,
so it shifted the scanner's parse downstream and a literal in a different function stopped
being mutated.

> **THE RULE: A MASK WITH A STATE MACHINE IS A GLOBAL PROPERTY OF THE FILE, SO A LOCAL EDIT
> CAN DELETE A CHECK SOMEWHERE ELSE.** And it fails in the direction that LOOKS fine: a mutant
> that stops existing cannot survive, so the score goes up while the coverage goes down.

The old comment on that function called over-masking *"the safe direction"* and stopped
there. It is the safe direction and it is not harmless. **Fewer mutants is fewer checks,
reported as a better number.**

## The arithmetic of the `+9`, which does not decompose the way it looks

```text
Day 55's code, old masker   1,534
Day 56's code, old masker   1,533    one literal flipped from code to MASKED
Day 56's code, new masker   1,543    ten literals recovered from ${...} interpolations
```

Ten recovered in `us-state-tax`'s `engine.js` and **zero** in `us-federal-tax`, which has no
numeric literal inside an interpolation anywhere — so the federal record's 716 was never
stale and that package was not re-measured.

## The second prediction, and the mechanism was right where the number was not

> **PREDICTED: 1,543 mutants, 11 survivors (the known 6 plus 5 of the 10), 99.3%.** All ten
> are in NOTE TEXT — eight `× 100` percentage conversions plus `0.0765` and `0.025` — so none
> can change a tax and each changes a figure PRINTED in prose. `notes.test.js` pins the first
> 72 characters of every note, so a recovered literal dies if its figure falls inside that
> prefix and survives otherwise. About half.
>
> **MEASURED on a targeted `--only engine.js` run: 6 of the 10 survived.**

Off by one, and the cause is sharper than the prediction had it. Every one of the six is a
percentage printed **mid-sentence in a DYNAMIC note**:

```text
engine.ts  Maryland's poverty level credit     "is 5% of EARNED income"
engine.ts  Oregon's surplus kicker             "it is 9.863% of the filer's OWN"
engine.ts  a state earned income credit        "worth 50% of the federal one"
engine.ts  the marginalRate caveat             "by 50% of the federal phase-out rate"
engine.ts  Ohio with no city and no wages      "at 0.45% to 3.00%"   (two mutants)
```

I had predicted the first of those would DIE, because its percentage sits at about character
50 and the prefix pin should have reached it. It did not, and that is the finding:

> **A PIN OVER THE PREFIX OF A NOTE CHECKS WHICH NOTES EXIST AND NOT WHAT THEY SAY — AND A
> FIXTURE OVER ONE HOUSEHOLD CANNOT REACH A NOTE WHOSE WHOLE TRIGGER IS AN ABSENCE.** A
> dynamic note fires when the caller OMITS a field. `notes.test.js` runs a standard household
> that supplies a consistent set, so it never sees these notes at any character offset.

Doubling any of those six `100`s makes this package print a percentage twice the rate it
actually used, in the prose `STRATEGY.md` has named as the differentiator since Day 8, and all
893 tests stayed green.

`test/dynamic-note-figures.test.js` closes all six in five tests, asserting the rendered
percentage string and NOT re-deriving the rate — the rate is pinned where it lives, and what
was unchecked anywhere is the step BETWEEN the stored rate and the sentence: the conversion,
the decimal places, and whether the sentence is about that rate at all. The Ohio one needed a
household the suite had never built: that note has a with-wages branch and a without-wages
branch, every Ohio test gave the filer wages, and a pension-only retiree is the only household
that reaches the second. Verified by re-running the subset — `engine.js` went from 8 of 14
killed to **14 of 14**.

**So the score is the same 99.6% as yesterday over nine more mutants, which is the only honest
way for a score to stay still.**

## And four audit starts, three abandoned, every abandonment right

1. Stopped two minutes in, on realising `suiteFingerprint` covers `test/**` as well — so a
   TEST edit after the audit starts invalidates the record exactly as a reworded comment does,
   and the day went on to add a whole test file.
2. Stopped because the new function had landed BETWEEN `relevantNotes`'s doc comment and
   `relevantNotes`, so that comment documented the wrong function. Found by reading the diff,
   since nothing here can fail on a misattached JSDoc — and fixing it moved `dist` again.
3. Stopped because the masker finding changed the enumeration itself.
4. Recorded.

> **DAY 42'S RULE IS WIDER THAN DAY 42 STATED IT:** make every documentation **and test** edit
> before the recorded audit. There are TWO fingerprints and the second one is over the suite.

---

# Day 55 — the same six survivors, three new mutants all dead, and NO PREDICTION WRITTEN

**MEASURED: 1,534 mutants, 1,528 killed, 6 survivors, 99.6%, the same six and the same line
numbers as Days 50, 51 and 52.**

```text
states/flat-states.js  line 435  year  2024 -> 2023
states/flat-states.js  line 565  year  2025 -> 2024
states/new-jersey.js   line 104  year  2028 -> 2027
states/new-jersey.js   line 229  year  2028 -> 2027
states/ohio.js         line  88  rate  0.01 -> 0.005
states/ohio.js         line 107  rate  0.2  -> 0.1
```

## PREDICTED: nothing, and that is this file's finding

Day 27's rule is that a prediction goes in writing BEFORE the measurement runs, and Days 50,
51 and 52 each recorded one and each came back exact. **Today's audit was started without
one.** The run was already ninety minutes of blocked foreground time and I treated it as a
cost to pay rather than as an instrument to point, which is precisely the failure Day 51's
version of this file warns about: a measurement you are only waiting for is a measurement you
have stopped reading.

What the prediction would have been, written now and therefore worth nothing as a prediction:
three new mutants — `0.09863` and the two `years: [2025]` literals the provenance entry
needed, since **the harness mutates years as well as rates and money**, which is Day 52's own
lesson from this file — all three killed, and the same six survivors.

The count came back at exactly 1,534, three more than Day 52's 1,531. **It is the right
answer and it is not evidence of anything, because it was not written down first.** The whole
value of the practice is that an exact prediction is falsifiable and a retrospective one is
not.

> **THE RULE: A MEASUREMENT WHOSE RESULT YOU DID NOT COMMIT TO IN ADVANCE IS A FACT AND NOT A
> CHECK** — and ninety minutes of waiting is the most expensive place to discover you forgot
> to make it one.

## 1,534 is also Day 49's number, and means something different

Day 49's first South Carolina run was 1,534 mutants with **fourteen** survivors; eight of them
lived in two `byStatus` tables that had been hoisted out of the declaration, exported "for
the tests", and then read by nothing. Deleting the tables took the count to 1,526. Oregon's
kicker brings it back to 1,534 with six.

**A mutant count is a property of the diff and two diffs can produce the same one.** The
collision is worth recording so that a future run reading the history table does not read the
repeat as a regression to a known state.

## Why the rate was predictable-killed, and what killed it

`surplusCredit.rate` is `0.09863`, and three figures are in circulation for this credit: the
certified `9.863%`, the rounded `9.86%` a secondary source prints, and `9.9%` — which is also
Oregon's top marginal rate, so a transposition between the two is a live possibility rather
than a theoretical one. `oregon.test.js` pins the credit on two bases that separate all
three:

```text
  base $5,678.00    9.863% -> $560.02    9.86% -> $559.85    9.9% -> $562.12
  base $1,234.56    9.863% -> $121.76    9.86% -> $121.73    9.9% -> $122.22
```

Neither base is a round number, for the reason this file keeps finding: a rate test on
`$10,000` of base cannot tell `9.863%` from `9.86%`, because the two answers differ by three
tenths of a cent and the engine rounds.

## The six survivors, unchanged and still triaged

All six remain what Days 50 to 52 recorded them as: four year literals whose mutants select a
cohort or a sunset that no household in the battery sits on either side of, and two Ohio rates
inside a staircase where the step above absorbs the change. Each is a household the battery
does not contain rather than a parameter nothing reads. See the Day 52 analysis below for the
derivation of each.

---

# Day 52 — the prediction, the result beside it, and two runs thrown away

**PREDICTED, in writing before the run: 1,531 mutants, 1,525 killed, 6 survivors, 99.6%,
the same six and the same line numbers as Days 50 and 51.**

**MEASURED: 1,531 mutants, 1,525 killed, 6 survivors, 99.6%, the same six and the same
line numbers.** Every figure, for the THIRD day running.

```text
states/flat-states.js  line 435  year  2024 -> 2023
states/flat-states.js  line 565  year  2025 -> 2024
states/new-jersey.js   line 104  year  2028 -> 2027
states/new-jersey.js   line 229  year  2028 -> 2027
states/ohio.js         line  88  rate  0.01 -> 0.005
states/ohio.js         line 107  rate  0.2  -> 0.1
```

## The count was predicted TWICE and the first one was wrong by one

The first prediction said **1,530**: four money literals in South Carolina's new
`OBBBA_STANDARD_DEDUCTION_INCREASE` — `750`, `750`, `1,125`, `1,500`, four by POSITION
rather than three by value, all clearing the harness's `$100` floor. The harness
announced 1,531 within twenty seconds of starting, and the fifth literal is not money:
`data/provenance.ts` gained an entry for `recognizedStandardDeduction.increase.*` with
`years: [2025]`, **and the harness mutates years as well as rates and money.**

**THE RULE: A MUTANT COUNT IS A PROPERTY OF THE DIFF, NOT OF THE FEATURE.** Predicting it
from what the change is ABOUT misses every literal the change needed on the way — and the
provenance ledger is `src`, it compiles to `dist`, and a year in it is as mutable as a
year in a rate table.

The corrected prediction was written at 60/1,531 and was exact.

## All four new mutants were predicted KILLED, and the reason was already proved

The add-back is capped by the increase, and **the cap only binds where the federal
deduction exceeds the state's recognized amount by MORE than the increase** — which is
every filer of 65 and no filer under it. So the four cells were reachable only once the
status battery's five aged shapes got their § 63(f) addition:

```text
  single              17,750 - 15,000 = 2,750 >   750
  separate            17,350 - 15,000 = 2,350 >   750
  headOfHousehold     25,625 - 22,500 = 3,125 > 1,125
  joint (two aged)    34,700 - 30,000 = 4,700 > 1,500
```

**The status sweep's own reachability check is what said so, before the audit ran.** It
refused the new parameter with *"could be wrong and no pinned household would notice. Add
a household that sits between the value and twice it"* — and it was right, in a battery
that already had five households over 65 in it. **A reachability check on a new parameter
is a question about the BATTERIES, not about the parameter.**

## TWO RUNS WERE THROWN AWAY, and the second one is the one worth recording

The first was killed deliberately at 50/1,531: `test/aged-standard-deduction.test.js` was
written while it was in flight, and a score measured over a suite that is not the shipped
suite is a score of nothing (Day 37's rule, Day 51's restart). Fifteen minutes, spent on
purpose.

**The second was killed at 200/1,531 because I had corrupted it.** Day 51's process note —
written into Day 52's own journal entry that morning — says no rebuild may happen while
the audit runs, because it mutates `packages/us-state-tax/dist`. I then ran
`node tools/test-counts.mjs` three times. That tool runs `npm test` in all four
directories, and `npm test` in the state package is `npm run build && node --test`, which
is `rm -rf dist && tsc`.

**The run kept progressing, which is the dangerous part.** A suite that fails because its
`dist` has just been deleted reports every mutant in that window as KILLED, so the
corruption INFLATES the score and HIDES survivors. A measurement that is wrong in the
flattering direction and still looks healthy is the worst of the four possibilities, and
nothing in this harness's output would have said so.

Grepping `tools/` afterwards found a second instance: **`check-scores.mjs` — the tool
whose whole job is verifying a score was measured over this build — runs `npm run build`
itself.** Three of this repository's own tools contain a build.

**THE RULE BEHIND THE RULE: "DO NOT REBUILD" IS NOT A CONSTRAINT ON BUILD COMMANDS, IT IS
A CONSTRAINT ON EVERY COMMAND THAT CONTAINS ONE.** The fix is not a better note:
`fingerprint.mjs` already hashes the paths and bytes of exactly what the harness mutates,
so the harness can fingerprint at start-up, re-check every N mutants, and abort with the
reason. Worklist item 22.

**The clean run took about 104 minutes on four cores**, against Day 51's 115 for 1,526 —
so the three new tests cost nothing measurable, which was the other thing worth knowing
after Day 51's twenty-three-minute sweep.

---

# Day 51 — the prediction, and the result beside it

**PREDICTED, in writing before the run: 1,526 mutants, 1,520 killed, 6 survivors, 99.6%,
the same six and the same line numbers as Day 50.**

**MEASURED: 1,526 mutants, 1,520 killed, 6 survivors, 99.6%, the same six and the same
line numbers.** Every figure, for the SECOND day running — and the named risk below did
not bite, for a reason the prediction half-guessed: the two `states/ohio.js` rates
survive the new absolute Ohio pins because the household behind them is a SINGLE filer,
so the 20% joint filing credit of line 107 is unreachable, and line 107's sibling at
line 88 is not observable in a `$90,000` return either.

```text
states/flat-states.js  line 435  year  2024 -> 2023
states/flat-states.js  line 565  year  2025 -> 2024
states/new-jersey.js   line 104  year  2028 -> 2027
states/new-jersey.js   line 229  year  2028 -> 2027
states/ohio.js         line  88  rate  0.01 -> 0.005
states/ohio.js         line 107  rate  0.2  -> 0.1
```

**THE RUN TOOK ABOUT 115 MINUTES ON FOUR CORES against Day 50's 92, and the extra
twenty-three minutes are mine.** Day 51 added two cross-state sweeps — 8,400 comparisons
and 1,680 more — and the audit runs the whole suite once per mutant, so a sweep costs
its own runtime times 1,526. **A test that is cheap in CI can be expensive in the
audit**, which moves worklist item 18 (select test files per mutant) up on cost grounds
for the second day running. It is worth stating plainly rather than hiding in a
timestamp: neither sweep can ever kill a mutant, because each compares two runs of the
SAME build and a mutated parameter moves both sides equally. **Twenty-three minutes of
audit for zero kills is the clearest case this harness has produced for selecting test
files per mutant.**

---

## The original prediction, kept as written

**1,526 mutants, 1,520 killed, 6 survivors, 99.6% — the same six and the same line
numbers as Day 50.**

The count is a DERIVATION and not a guess, which is Day 49's rule: the harness
mutates rates (`0 < v < 1`), years (`1900 <= v <= 2100`) and money (`v >= 100`),
and Day 51 added not one literal in any of those ranges to
`packages/us-state-tax/src`. The surviving-spouse work added two income fields, an
age field, a `survivorClaim` of two STRINGS, and a `RETIREMENT_READING_RULES` list
of fourteen more strings. The only numbers in any of it are the `0` of an
accumulator and the `0` of a `Math.max` floor, both below the money floor.

**THE NAMED RISK, and it is a real one this time rather than a formality.** Two of
the six survivors are rates in `states/ohio.js` — line 88 (`0.01 -> 0.005`) and
line 107 (`0.2 -> 0.1`) — and today's new `survivor-retirement.test.js` pins TWO
ABSOLUTE OHIO FIGURES for the first time: a tax of `$1,838.38` and a retirement
income credit of `$200.00`, for a single filer of 60 at `$90,000`. If either rate
is observable in that household, the survivor is killed and the count comes back
at 5 or 4. The household is single, so the 20% joint filing credit should not
reach it; the `0.01` is the one I cannot place from reading.

A survival is a measurement and only the count can be reasoned to. If the figure
comes back at 5, the prediction was wrong in the direction that means a new test
earned something nobody asked it for.

**AND THE RUN WAS RESTARTED 100 MUTANTS IN, ON PURPOSE.** Reading my own diff
adversarially while the first attempt was in flight found a latent double count:
the survivor fields are pooled into the filer's own income and taken back out by
the one rule with a survivor claim, which is complete only for the readers that
read the POOLED person — and two readers do not. `retirementIncomeOf` (Ohio's
credit) reads the caller's input, and `planTypeRetirement` (Alabama) reads
`definedBenefit`, which `split()` does not adjust. Both are correct today purely
because `survivorClaim` is South Carolina's, `retirementIncomeCredit` is Ohio's
and `planTypeRetirement` is Alabama's, and no state has two of them. **A
declaration that is right by coincidence of which states exist is a defect with a
commit date in the future**, so there is now a test that fails the day any of the
three lists overlaps, and a second that pins two decedents on one joint return
(`$13,000` of deduction, which is neither `2 x $10,000` nor `2 x $3,000` nor one
shared cap).

Killing a run at 100/1,526 to add two tests costs twelve minutes. Recording a score
for a suite that is not the shipped suite costs the score's whole meaning, which is
Day 37's rule: **a measurement is only a measurement of something, and the something
has to be the thing that ships.** The two new tests also give South Carolina's
`$3,000` and `$10,000` bands a second observer each, which is the one thing that
could move the survivor count down.

# `us-state-tax` — the survivors, triaged

Generated by `tools/mutation/mutate.mjs` against `us-state-tax`, over the **rule**
files only. The locality registries are excluded: one of 1,033 Ohio municipal rates
cannot have its own test, and counting them would measure the registry's size
rather than the suite's reach.

| run | mutants | survivors | killed |
| --- | --- | --- | --- |
| Day 33, before any fix | 705 | 140 | 80.1% |
| Day 33, after `test/bracket-pins.test.js` | 705 | 102 | 85.5% |
| Day 33, after the Virginia sibling statuses | 705 | 100 | 85.8% |
| Day 34, after `test/status-sweep.test.js` | 702 | 26 | 96.3% |
| **Day 35, after `test/step-probes.test.js` and `test/notes.test.js`** | **702** | **9** | **98.7%** |
| **Day 35, after the three that run then exposed** | **702** | **6** | **99.1%** |
| **Day 37, after the provenance ledger** | **740** | **6** | **99.2%** |
| Day 39, Connecticut's first run | 1,090 | 10 | 99.1% |
| **Day 39, after the duplicated threshold was hoisted** | **1,086** | **6** | **99.4%** |
| **Day 40, after Alabama** | **1,130** | **6** | **99.5%** |
| **Day 41, after Missouri** | **1,185** | **6** | **99.5%** |
| **Day 42, after Oregon** | **1,267** | **6** | **99.5%** |
| **Day 43, Wisconsin's first run** | **1,358** | **11** | **99.2%** |
| **Day 43, after the five Wisconsin fixes** | **1,357** | **6** | **99.6%** |
| **Day 45, after Minnesota** | **1,456** | **6** | **99.6%** |
| **Day 46, after the conformity declarations** | **1,458** | **6** | **99.6%** |
| **Day 47, after Arizona's own deduction table** | **1,470** | **6** | **99.6%** |
| **Day 48, after Arizona's capital gain rule** | **1,471** | **6** | **99.6%** |
| **Day 49, South Carolina's first run** | **1,534** | **14** | **99.1%** |
| **Day 49, after the two dead SCIAD tables were deleted** | **1,526** | **6** | **99.6%** |
| **Day 50, after § 12-6-1170(C)(1) and the detail split** | **1,526** | **6** | **99.6%** |
| **Day 51, after the surviving-spouse claim** | **1,526** | **6** | **99.6%** |


**Day 50 is the first row where the figures did not move and the reason they did not is
the interesting part.** The run changed the engine's control flow, deleted a boolean flag,
added a string field and two notes, and added no mutable number — so 1,526 was a
*derivation* rather than a hope, and the prediction (written before the run, in the Day 50
journal entry) got the count, the kill count, the survivor count, the score, the identity
of all six survivors and all six line numbers exactly right.

**What was at risk, and the reason to read this row at all: South Carolina's `$10,000`
cap nearly became a seventh survivor.** After § 12-6-1170(C)(1), a 65-year-old's total
subtraction is `max($15,000, military + min(other, max($0, $10,000 - military)))`, and the
`$15,000` floor dominates that expression for every household — with no military pay the
capped part cannot exceed `$10,000`, and with military pay above `$15,000` the cap term is
already zero. **So no tax figure in this package can observe that parameter any more.**
Before Day 50 the military household was its only tax-visible observer and the fix removed
it.

It is killed by the DETAIL LINES instead. Setting the cap to `5_000` fails exactly three
tests, all three of them Day 50's: the two that assert `computedSubtractions` line by line
(`[4,000; 6,000; 5,000]` against `[4,000; 1,000; 10,000]` — the same total, a different
decomposition) and the prose-figure instrument, whose derivation reads the cap.

**THE RULE: A SPLIT DETAIL LINE IS A MEASUREMENT, NOT A LABEL.** Fixing the arithmetic
without splitting the line would have created a survivor; the two halves of that day's
work hold each other up. And the parameter is unobservable only *in this engine's input
shape* — in the statute the decedent's `$10,000` is neither reduced by the military
deduction nor charged against the `$15,000`, so a surviving-spouse input would make it
move an answer again.

**Day 49's eight were three hours old and they are the reason this table has two rows for
one day.** `SCIAD_PHASE_OUT_START` and `SCIAD_PHASE_OUT_DENOMINATOR` were hoisted into two
named `byStatus` tables and exported as `SCIAD_PARAMETERS` "for the test" — and then
`south-carolina.test.js` was written from its own literals, which is Day 27's rule applied
correctly. So eight shipped figures had no reader at all. It is Day 43's Wisconsin defect
("a shipped constant that nothing read") in a module written the same afternoon, and the
audit found every one. **THE RULE: A CONSTANT HOISTED FOR A TEST THAT THE TEST DOES NOT
READ IS A SECOND COPY OF THE REGISTRY.** The tables are deleted; the proportionality they
were hoisted for is asserted against the definition.

**And the prediction for that run was six.** The count (1,534) and its +63 decomposition
were exact; the survivor count, the score and the stated failure mode were all wrong. What
the prediction had no model of was *is this figure read by anything* — which is the
question this audit exists to answer, so the miss is the instrument earning its keep rather
than a reason to predict less.

Each survivor is a number the package could ship with a wrong value for.

**Day 41's row is Day 37's twice over, and the second time was a surprise.** Missouri
added 55 mutants and only 49 of them are in `missouri.ts`; the other six are the
`years: [2025]`, `years: [2026]` and `carriedForwardFrom: 2025` on the four provenance
entries its two carried-forward figures needed. **The ledger that says where every
figure came from is a file full of year literals and the audit reads it like any
other** — which was predicted for Day 37 and forgotten by Day 41, so the package's
mutant count came in six above a hand count that was itself exactly right. All 55
were killed.

**Day 37's row is the interesting one for what did NOT change.** The provenance ledger
added 38 mutants — it ships bare years, in the `years: [...]` scope on an entry and in
`carriedForwardFrom` — and **all 38 were killed.** The journal predicted that before
the run on the mechanism rather than the count: mutate a year in an entry's scope and
the entry stops applying to that year, so a figure it used to claim goes unclaimed and
the coverage assertion in `test/provenance.test.js` fails; mutate a
`carriedForwardFrom` and it stops agreeing with the one in `provisionalFigures`, which
is cross-checked in both directions. The prediction naming the mechanism is why this
was worth saying in advance; the run is what makes it true.

The survivors are the *same six*, which is the other half of the result. Nothing the
ledger added is a new blind spot, and nothing it added covered an old one — the six
below were unreachable in principle on Day 35 and are unreachable in principle now.

This row and the 99.2% are recorded in `scores.json` beside a fingerprint of the build
they were measured on, which is new today — see *A score is a score OF something* in
`README.md` beside this file.

**Day 39's two rows are the first time this file has recorded a survivor that was
FIXED rather than triaged.** Connecticut took the audit from 740 mutants to 1,090 —
a third of the package arriving in one state — and four of them survived. All four
were one figure: Connecticut's Social Security threshold, present in the build
**twice**, because a `ConditionalNote` predicate is handed the caller's input and
cannot reach the definition it belongs to, so the cheap way to write "above the
threshold" is to write the threshold again. Setting the note's copy wrong moves no
answer, so two copies of one figure sat there with nothing comparing them.

The lesson generalises past Connecticut: **a predicate that cannot see the data it
is a predicate about will be written with a copy of the data in it.** Every
`conditionalNotes` entry in this package is a candidate, and this is the instrument
that finds them — the status sweep probes the same cell and reports it covered,
correctly, because it probes the cell the engine reads.

Hoisted to one copy; the re-run's four numbers were predicted before it started and
all four held.

Both Day 35 rows are measured, by two full runs. The first read 98.7% and named nine
survivors; three were closed, and the second run read 99.1% with exactly the six
below. The intermediate 693 + 3 = 696 was predicted before the second run and is what
it found, which is the outcome that makes the prediction worth nothing and the run
worth the hour and three quarters — **a score inferred from a fix is a score nobody
measured**, and this package's whole pitch is that its quality claim is checkable.

---

## Where it stands: every remaining survivor is unreachable in principle

This is the first run where that sentence is true, and it is the reason to read the
list below rather than the number above. **Six survivors, and not one of them is a
missing test.** Four are windows on a tax year outside the two this package
supports; one is an epsilon used as notation; one is arithmetic no return can reach
and has a direct assertion saying so.

The consequence for the weekly job is in `## How to work this list`.

## Day 35 closed Group A, and the instrument generalises

Group A was ten rows of a **staircase** — Ohio's retirement income credit, Maryland's
itemized limit, CalEITC — and no larger household battery would have reached them.

**A battery of households is a ladder in one dimension of a return, and a staircase
is a second ladder inside one rule.** Ohio's steps sit between `$500` and `$8,000` of
pension income; the shared battery's rungs are `$3,000`, `$6,000`, `$12,000` and up,
because they also have to reach a millionaire. Catching that one credit costs five
more households in every state's run, and then five more for New York's household
credit, until the battery is linear in the number of charts — which is exactly what
Day 34 proved it did not have to be.

**THE RULE: a chart of steps needs a probe inside each step, not a household for each
step.**

`test/step-probes.test.js` finds every staircase in the package **by shape** — any
array whose entries carry an `upTo`, a `maxAge` or a `minAge` — and requires each
either to have a probe driver or to name the file that owns it. It then perturbs
**every number in every one of them**, 627 in all, against every pinned answer in the
package: its own probes, the status sweep's 4,180 households and `bracket-pins.json`.
So a claim that another file covers a chart is checked rather than believed.

### Where the probe sits, which is the whole instrument

Against the step's **floor**, at `upTo[i-1] + 1`. A mutation doubles the ceiling
below, and a probe just above that ceiling falls back into the step below it, is paid
that step's amount, and the pinned answer moves. A probe in the MIDDLE of a wide step
survives the same mutation: Ohio's `$1,500` doubled is `$3,001`, and a probe at
`$2,250` is still inside the step it started in.

**THE RULE: a probe tests the boundary it sits against, so a probe placed for
readability tests nothing.**

Age bands are the same in the other unit, and Massachusetts's is banded at both ends
of life — under 13, or 65 and over — so the probes are the boundary ages and the
years either side. The age one past the top band is the only probe that can catch the
top band's ceiling: with a single band of `maxAge: 5`, a dependent aged 5 is paid
under any wider band as well.

### And the filter is deliberately not the harness's

`status-sweep.test.js` borrows this harness's filter — integers `>= 100`, decimals in
(0,1) — so that passing it MEANS no `byStatus` cell survives here. `step-probes`
does not, because a staircase is mostly small integers: this harness never touches
Ohio's `25`, `50` and `80`, New York's `$75` household credit or any `maxAge` in the
package, and those are the numbers a staircase is made of.

**THE RULE: a filter chosen to make two instruments agree is only honest where the
two instruments are looking at the same thing.**

## Day 35 closed Group B by pinning the notes, and that is the part about the product

Five survivors were `notes: year >= 2026 ? [...NOTES_2026, ...NOTES] : NOTES` and one
was a rule `name` reading "75% for 2025".

All **462** notes every state-year can emit are now pinned by their first 72
characters, in order (`test/notes.test.js`, `test/note-pins.json`). 72 and not the
whole note: the prose is edited often, and **a generated fixture that churns on every
clause stops being read before it is regenerated.**

Three more claims came with it, and none is a restatement:

- **The year table.** Nine states, fourteen notes that 2026 has and 2025 does not,
  none the other way, written by hand as a table a reader can check against the
  statutes — because a generated version would be the year selector describing itself.
- **Reachability.** A `conditionalNote` is a predicate, and all 16 are now required to
  fire for SOME household in the battery and NOT for all of them. One that never fires
  is dead; one that always fires is `notes` with extra steps, and every note costs the
  caller context on every call.
- **The outer boundary.** The notes exist so a model reads a limitation in the ANSWER
  rather than in a README it never sees, and the model reads a text block built by
  `us-tax-mcp`. Nothing asserted the text block carried them. It does, and a test in
  that package now says so across twelve states.

And a rule `name` travels in the result object, so a `%` or `$` figure printed in one
is a claim: all 15 are now required to equal a figure the rule actually holds. Only
`%` and `$` tokens are read, because a name may carry a bare number that is a LABEL —
"Worksheet 13A", "code 18", "born before 1946" — and **the sigil is what marks a
number as a quantity rather than a name.**

## Day 35 closed Group D with a relation, as Group D itself predicted

Day 34's finding was that a household battery catches a MONEY mutation and not a YEAR
mutation, because a year selector swaps one table for another and the two can be
arbitrarily close. Both instances are now direct assertions on the branches:

- **The federal poverty guideline** (Virginia and Maryland, 2% apart) is asserted per
  branch, per state, with the block's own `year` label. The cross-state half is worth
  more than the levels: two states read one federal table, so a branch that swapped in
  one of them would make the two disagree, and **a disagreement is checkable without
  knowing which of them is right.**
- **Michigan's pre-1946 cohort.** `minimumAge: year === 2025 ? 80 : 81` survived because
  the battery's oldest retiree is 82. Making that retiree 80 is the obvious fix and is
  wrong — an 80-year-old does not qualify in 2026, so the household that catches the
  mutant in one year stops reaching the rule in the other. MCL 206.30(1)(f) gates the
  deduction on being born before 1946, a **closed cohort**, so the minimum age is
  exactly `year - 1945` and is asserted as that relation.

## The three the 98.7% run then exposed, which were not on any earlier list

Closing 17 survivors left nine, and three of them were real gaps that the larger
groups had been hiding.

**CalEITC's one-child `finalPhaseOutStartCredit`.** The two- and three-child bands
were covered by the shared battery and the one-child band was not, because the figure
sets the slope of the long tail and no household sits in it. The twelve published FTB
values at the top of `california-earned-income.test.js` cannot help: they drive the
**2021** parameters, which is the right test of the mechanism and reads no shipped
figure at all. Twenty-eight frozen probes now walk the whole shipped curve in both
years, with an assertion that the four child counts pay four different credits in the
tail — or a probe in one band proves nothing about the others.

**CalEITC's `investmentIncomeLimit` had a test and the test was blind.** It built the
household by reading `CALEITC.investmentIncomeLimit`, so doubling the limit moved the
household with it. That is Day 33's rule — **a test whose household is read out of the
parameter is blind to the parameter** — still live in a file written after it. A
frozen `$6,000` catches it, and the relation test stays beside it because where the
cliff is and whether a cliff exists are two different claims.

**Ohio's `perSpouseIncomeThreshold: 500` is not a missing household. Nothing reads
it.** Ohio allows the joint filing credit only where each spouse has at least `$500`
of qualifying income, and no federal figure splits a joint return between the two
people on it — so the engine asks the caller for `bothSpousesHaveQualifyingIncome` and
the `$500` is theirs to apply. That is the right design, and it leaves the figure in
Day 34's worst category: a value nothing reads is free to drift away from the number
the caller is actually told, which is the `$500` the note holds as literal prose.

**THE RULE: a parameter the engine cannot apply is a parameter the CALLER has to
apply, so it earns its place only if it reaches them. The test is that the note quotes
it.**

---

## The 6 that remain, and why each is not work

The second run's own listing, unedited:

```
### states/wisconsin.js — 5 of 82 survived on the first run, ALL FIXED the same day

```text
  line   98  money  225_000 -> 450000
  line   99  money  300_000 -> 600000
  line  100  money  150_000 -> 300000
  line  101  money  225_000 -> 450000
  line  321  year   2025 -> 2024
```

**These were the first survivors in this file that were WORK rather than
unreachable arithmetic**, and they were in code written the same day. The six
below are unreachable in principle and say why; these four plus one were not, so
they were fixed rather than triaged and the re-run came back at 1,357 mutants and
the same six. `--only wisconsin.js` after the fixes: **81 mutants, 81 killed,
100%**. The entry is kept because the diagnosis is the useful part.

**Lines 98 to 101: `WI_TOP_BRACKET_BASE` has no reader.** It holds the
`$225,000` / `$300,000` / `$150,000` statutory bases that the whole 2026
standard deduction derivation rests on, and its doc comment says "see
`test/wisconsin-indexation.test.js`". That test writes its OWN copy of those
three figures rather than importing them — deliberately, and the comment in the
test says why: *a test that calls the code it is checking checks nothing.* Both
halves are defensible and together they leave the shipped constant unconstrained.

**It is Day 42's Ohio defect one day later.** Ohio's unread `perFiler` table
carried a wrong figure for 33 days "on the strength of a comment claiming a test
that did not exist"; here the test exists and does not read the value the comment
points at, which is the same failure with better paperwork.

**THE RULE: a comment that names a test is a claim about that test, and "see
`foo.test.js`" has to mean `foo.test.js` reads THIS value.**

The fix is a cross-check rather than a rewrite: the test keeps its own copy as
the authority for the arithmetic AND asserts that the package's exported constant
equals it. That is the one relationship which both kills the mutants and keeps the
test independent of the thing it checks.

**Line 321: a conditional that can never be false.**
`retirementIncomeExclusionElection: year >= 2025 ? {...} : undefined`, inside a
`wisconsin(year)` that already returns `undefined` for every year but 2025 and
2026. Unlike the six below it is not unreachable in principle — it is
REMOVABLE, and removing it is better than triaging it.

### states/flat-states.js — 2 of 161 survived
  line  368  year   2024 -> 2023
  line  498  year   2025 -> 2024
### states/new-jersey.js — 2 of 71 survived
  line  104  year   2028 -> 2027
  line  229  year   2028 -> 2027
### states/ohio.js — 2 of 64 survived
  line   88  rate   0.01 -> 0.005
  line  107  rate   0.2 -> 0.1
```

> **Day 44: the same six mutants, and four of the LINE NUMBERS moved.**
> `flat-states.js` went 157 and 287 to **179** and **309**, and `ohio.js` 87 and
> 106 to **88** and **107**, because Day 44 added comments to Arizona and
> Mississippi in `flat-states.ts` and one line to `ohio.ts`'s neighbourhood — and
> `removeComments: false` puts them in the built `.js` the harness reads. The
> MUTANTS are identical: same files, same operators, same values, same reasons.
>
> **THE RULE: a survivor identified by a line number is identified by something a
> comment can move, so a ledger of line numbers goes stale without anything it
> describes having changed.** It is the same defect as the byte fingerprint, in
> the document rather than in the digest, and the fix is the same one: name the
> mutant by what it is — file, operator, from, to — which the table above already
> does in its other three columns. The line number is the one column that is not
> about the mutant.

> **Day 46: the two `flat-states.js` numbers moved AGAIN, and this time the rule was
> tested rather than restated.** 179 and 309 became **234** and **364** — `+55` each —
> because Day 46 added a `federalConformity` declaration to Arizona, at the top of the
> file. `new-jersey.js` 104/229 and `ohio.js` 88/107 did not move, because neither file
> was touched.
>
> **The prediction written before that run named all six survivors, said new-jersey's
> and ohio's four numbers would be unchanged, and explicitly DECLINED to predict the
> two flat-states numbers** — on the grounds that the built-file offset is not
> derivable from the source diff. That refusal turned out to be the only part of the
> prediction that could have been wrong: `flat-states.ts` gained **+65** source lines,
> all above both survivors, so a derived guess would have said 244 and 374. **Wrong by
> ten, twice.** Ten of the added lines are TypeScript that emits nothing — the field's
> type annotations and the JSDoc on the interface — and a source diff cannot tell those
> from lines that emit.
>
> So the rule now has a measurement behind it: across a 55-line shift the PARAMETER
> identity held exactly and the line number was unrecoverable. A prediction is worth
> something when it says which of its parts it cannot compute.

> **Day 47: 234 and 364 became 368 and 498, and I PREDICTED 367 and 497 — off by one,
> twice. The reason is better than the error.**
>
> Day 46's refusal to predict these two looked too weak, because the offset is not
> DERIVABLE but it is MEASURABLE: one `grep -n` of the built artefact. So Day 47
> measured them and wrote them into the prediction, with the derivation shown —
> `flat-states.ts` shifted `+139` source lines and the built file `+133`, six of the
> added lines being JSDoc and type positions that emit nothing, so a source-derived
> guess would have said 373 and 503 and been **wrong by six, twice**. Measuring beat
> deriving by a factor of six.
>
> **It was still wrong, and not because measuring is the wrong idea. The measurement
> went STALE.** After the grep, one more `src` line was added above both guards — the
> Arizona long-term capital gains note, a single string in the `notes` array — and the
> package was rebuilt. Both numbers moved by exactly one. The prediction quoted a
> measurement of a build that no longer existed.
>
> **THE RULE: A MEASUREMENT HAS A TIMESTAMP, and quoting one after the thing it measured
> changed is a derivation again.** This is what the `mutantFingerprint` in `scores.json`
> exists to make checkable for the SCORE — and the score was fine, because the audit was
> correctly restarted against the new build. It was the prediction that was not
> re-measured. The instrument guarded the number it was built to guard and nothing
> guarded the prose beside it.
>
> **And Day 46's rule survives both attempts on it.** Across every run — 157/287,
> 179/309, 234/364, 368/498 — the PARAMETER identity has been exactly right every time
> and the line number has been wrong every time it was stated, whether derived (out by
> ten, then six) or measured (out by one). Measuring is strictly better than guessing.
> It does not make a fragile identifier robust. **Read the other three columns.**
>
> **DAY 48 BROKE THE SECOND HALF OF THAT SENTENCE, which is why it is left standing rather
> than edited.** 435/565 came back exact, so "wrong every time it was stated" is now false
> — and it was a claim about a SERIES, which is the one shape nothing in this repository
> asserts. Day 46 found this very file stale for that reason. The note below says what
> changed and it was not the identifier: the measurement was taken last instead of first.
> **A sentence that counts a streak is a sentence that expires without being touched.**

### C — a year window outside `SUPPORTED_YEARS` (4). Unreachable in principle.

`new-jersey.js` 104 and 229 (`year >= 2026 && year <= 2028`), `flat-states.js` **435**
(`year >= 2024`) and **565** (`year >= 2025`) — the two flat-states numbers were 157 and
287 before Day 44, 179 and 309 before Day 46, 234 and 364 before Day 47, 368 and 498
before Day 48, and have now moved FOUR times without anything they describe having
changed, which is the note above this one. **Read the other three columns, not this one.**

> **Day 48: 368 and 498 became 435 and 565, AND ALL SIX LINE NUMBERS WERE PREDICTED
> CORRECTLY FOR THE FIRST TIME.**
>
> Day 46 declined to predict the two moving numbers and Day 47 predicted them by measuring
> the built artefact, which beat deriving by a factor of six and was still off by one —
> because one `src` line was added above both guards *after* the measurement was taken, so
> the prediction quoted a build that no longer existed.
>
> Day 48 took the same `grep -n` and took it **last**: after the final `src` change of the
> day (a validation reorder found by re-reading the diff), after the rebuild, and after
> every instrument in the repository had run green. The Arizona capital gains work added 67
> emitting lines above both guards, 368 and 498 became **435** and **565**, and both came
> back exactly — as did the four this file has been calling unchanged.
>
> **THE RULE: A MEASUREMENT IS NOT WRONG BECAUSE IT IS A MEASUREMENT; IT IS WRONG BECAUSE
> IT IS TAKEN TOO EARLY.** Day 47 blamed the identifier and concluded that a line number is
> fragile. It is — and the fragility is entirely about ORDER. Measured after the last
> change, the fragile identifier is exact; measured before it, no amount of precision helps.
>
> This does not promote the line number back to being an identity. `new-jersey.js` 104 and
> 229 and `ohio.js` 88 and 107 came back unchanged for the fifth run running **because
> those two files were not touched** — which is the point: the number tracks the file's
> history and not the parameter's. The Day 44 advice stands, *read the other three
> columns*; what Day 48 adds is that the fourth column is predictable when the prediction
> is the last thing written rather than the first.

The package supports 2025 and 2026. Both are inside every one of these windows, so
moving an edge changes nothing that can be asked for. These are Day 29's category —
an unreachable figure cannot be wrong — and they become reachable only when the
package gains a year on the far side. **New Jersey's `2028` is the one to remember:
it is a real cliff with a real date, and it will start mattering the day 2029 is
added.**

### E — an epsilon (1).

`ohio.js` 88 (87 before Day 44): `(year >= 2026 ? 500_000 : 750_000) - 0.01`, mutated to `- 0.005`. The
`0.01` exists to express "just below the next band" and any small value does the same
job, so no household can tell. **A representation detail is not a parameter**, and
counting it as one is the harness measuring its own notation.

### F — arithmetic no return can reach (1), now asserted rather than left.

`ohio.js` 107 (106 before Day 44): the joint filing credit's `0.2` row. It applies below `$25,000` of
modified AGI less exemptions, and O.R.C. 5747.02(A)(3) charges an Ohio return nothing
at all until `$26,050` of taxable income — the exemption is subtracted from the
credit's income figure and not from the tax's, so the window where the first test
passes and the second does not is empty. A nonrefundable share of zero is zero at
every rate.

`step-probes.test.js` carries the direct assertion, priced on the richest return that
can still be inside the step, in the shape `virginia-age-deduction.test.js` uses for
§ 58.1-321. **Asserting it is the right output, because a probe there would be
claiming the row matters.**

### The one the harness cannot see about itself

Not in the six, because it is not among the 702: **Ohio's zero band charges a base
amount of `$0`, and `2 x 0 + 1` is one dollar.** One dollar of Ohio tax inside that
band is absorbed by the `$20` nonrefundable exemption credit every return there
carries, so no household in the package can see it move — and `0` is below this
harness's `>= 100` filter, so it is never mutated either. `step-probes.test.js` finds
it because it perturbs every number in a staircase, and records it as unreachable with
the reason.

**THE RULE: a doubling mutation cannot perturb a ZERO by more than a dollar, so a
parameter whose correct value is zero is only testable where a dollar survives to the
bottom line.**

The row matters enormously — charging nothing below `$26,050` is half of why Ohio's
schedule is discontinuous — and a `$1` error in it is genuinely harmless. Both are
true. **What is testable there is the band's WIDTH, not the zero at the bottom of it.**

---

## How to work this list

There is no work on it. Every entry above is unreachable in principle and says why,
which changes what the weekly job should do.

```sh
node tools/mutation/mutate.mjs packages/us-state-tax --workers 4
```

The `--skip` list that used to be on that line is a harness default now, keyed on
the package name, and the mode in force is announced at start-up. Day 43 started a
two-hour recorded run without it, because the invocation lived in a README and
nowhere the program could read, and enumerated 1,626 mutants instead of 1,358.

**Gate at the measured number, not at zero.** `us-federal-tax` runs at
`--max-survivors 0` because 0 is the only value with an argument behind it there. The
state package's argument is different and now just as complete: six survivors, each
with a written reason, none of them reachable by any question a caller can ask. A gate
at 6 fails on a regression and passes on the known set, which is what a gate is for —
and raising it would be a deliberate edit to `.github/workflows/mutation.yml`, which
is the point.

Do **not** drive the number to zero by asserting the remaining parameters back to
themselves. That is Day 27's rule and the reason `## Reading the score` in the harness
README says the score is not a target. Four of the six become reachable the day this
package gains a third tax year, and on that day they should be closed by the year that
reaches them, not by a test written to make a number look better.

### The fast proxies are the instrument of record now

The harness takes about an hour and three quarters; the two coverage proofs in
`status-sweep.test.js` and `step-probes.test.js` perturb 1,125 parameters between them
and run in about a second and a half, on every push. **Every defect found since Day 33
came from a proxy, and the harness confirms a number for the README.** That trade is
why the weekly job's timeout went from 45 minutes to 120 rather than the suite getting
faster.

The proxies' own limits are stated where they are made: `status-sweep` perturbs one
number per `byStatus` cell and says what covers the rest; `step-probes` covers
staircases and names the file that owns every chart it does not drive.

## Day 45: Minnesota added 99 mutants and no survivors

The twenty-fifth state contributed **99 mutants, all of them killed**, measured
on its own with `mutate.mjs --only minnesota.js` before the full audit ran. Every
number in Minnesota moves a test, so the six below are unchanged and the package
total went from 1,357 to **1,456** with the score steady at **99.6%**.

The six are the same six at the same six line numbers, which was predicted: Day
45 touched `definition.ts`, `engine.ts`, `types.ts`, `data/provenance.ts` and the
new `states/minnesota.ts`, and none of `flat-states.ts`, `new-jersey.ts` or
`ohio.ts`. Day 44's rule — *a survivor identified by a LINE NUMBER is identified
by something a comment can move* — is why the prediction named the line numbers
explicitly rather than assuming them.

One thing was stated in advance as the way the prediction could fail, and it did
not: `test/status-households.mjs` gained a thirty-first household (`family300k`,
two dependents at `$300,000`), and a new household can kill a mutant no previous
one reached. The two Ohio rate survivors were the likeliest candidates, being
arithmetic rather than out-of-range years. It killed neither, so both remain
asserted-unreachable rather than merely unreached.
