# The cliff finder

A state income tax ought to be **continuous** in income: one more cent of wages
should never cost more than a cent of tax. Where it does, the law has a *notch*,
and a filer somewhere has a reason to turn down a raise.

```sh
node tools/cliffs/find-cliffs.mjs                 # the sweep, the inventory and the report
node tools/cliffs/find-cliffs.mjs --states OR,NY  # one or more states
node tools/cliffs/find-cliffs.mjs --check         # fail if the inventory moved
node tools/cliffs/self-check.mjs                  # the instrument, against known answers
```

Output: [`CLIFFS.md`](CLIFFS.md) is the report, `out/cliffs.json` is the
committed inventory, and `--check` is the gate.

## Why this exists, and what the two older harnesses could not do

`tools/differential` compares this engine to `policyengine-us` over 2,904
households. `tools/audit` compares it to a buyer's own figures. **Both compare
answers at points.** On Day 75 this repository found a defect in
`policyengine-us` that neither could have found — their Indiana earned income
credit is refused by a gate evaluated at a frozen year, so one cent of extra
wages can cost a filer `$111.09` — and wrote down why:

> Finding that needs two households a cent apart, and this grid samples incomes
> in round thousands — so does their own test suite.

A discontinuity is a property of the tax *function*, not of any household in it.
Day 75's worklist asked for the instrument that walks the function; this is it,
pointed at this engine first.

## How it works

1. **Sweep.** For each household shape × 42 states × 2 years × **axis**, walk
   that axis's variable over its committed bands — wages from `$0` to
   `$150,000` in `$100` steps and on to `$1,050,000` in `$2,500` steps, and
   four more variables over their own. 1,512 sweeps, about 2.3 million
   evaluations, about eight minutes on four cores.

   An **axis** is the one variable that moves while the rest of the household
   stands still. Until Day 78 there was one, `wages`, and everything else was
   held at zero — which meant **a means test keyed on a component of income
   could not bind at all.** The case that forced the other four: § 32(i) bars
   the federal earned income credit outright above about `$12,000` of
   investment income, one cent takes the whole of it, nineteen states match it,
   and no wage in any band reaches it. The cost of an axis is linear, not
   multiplicative — four axes is four sweeps, not four dimensions — and
   `shapes.mjs` holds the list with the argument for each entry.
2. **Flag.** A piecewise-linear function has a second difference of zero where
   it is linear and `|dr| × h` at a kink, so at `h = $100` a one-point bracket
   change contributes about `$1` and a notch contributes its whole size. A
   second difference over `$3` raises a flag.
3. **Refine.** Two rounds of tenfold subdivision following the largest second
   difference, then a binary search on the secant slope. It ends either on two
   incomes **one cent apart** with a jump between them, or on the conclusion
   that the flag was a kink. **A false positive costs thirty evaluations and
   produces no line in the report**, which is the whole design: the detector is
   tuned noisy and the refinement is tuned exact.
4. **Attribute.** Diff the engine's own result objects at the two incomes. This
   is the part that turns a finding into one worth having — `exemptions: 8600 ->
   7600` has named the provision, and the provision is one grep from its statute
   in `provenance.ts`.
5. **Classify.** Match the package's own shipped `notes` against the provision
   that moved and against the notch's dollar figures.

## The four classes, and which one is the queue

```text
  declared        a note names the provision AND says it steps, or quotes the
                  step's own dollar figure.  Nothing is owed.
  named           a note names the provision and never says it is a notch.
                  THIS IS THE QUEUE.
  not named       no note mentions the provision at all.  Rarer and worse.
  unattributable  the notch is in the rate schedule itself, so nothing in the
                  result object names a provision and a text classifier has no
                  label to match.  Needs a reader.
```

**None of the four is an arithmetic defect.** Every notch in the report is a
figure this engine computes correctly from a table it transcribed out of a
statute or a form. What the classes measure is what the package *tells a caller
about the shape of the provision*, which this repository treats as the same kind
of obligation as the figure: a provision that can cost a filer `$1,052` on one
cent of income has a shape worth a sentence, and a caller who reads the notes
and finds no sentence will build a taper.

## What it cannot see, which is the honest content of the report

- **A notch inside a credit-absorbed region.** The sweep measures `totalTax`,
  which is floored at zero. Ohio's `$342` constant at `$26,050` of taxable
  income is invisible to every shape here *with children*, because Ohio's earned
  income credit covers the whole bill there — which is why `shapes.mjs` carries
  a childless shape whose only job is to have no credit to hide behind.
- **A notch on an axis that is not here.** Itemised deductions, property tax,
  rent, and the number and ages of dependents are held fixed. Investment income,
  pension income, Social Security benefits and municipal interest were on this
  list until Day 78 and are now four of the five axes.
- **A notch that needs two variables to move at once.** Every axis holds the
  rest of the household still, so a threshold written on a ratio, or a combined
  limit with a separate cap on each component, is only partly reached. A second
  *simultaneously* swept variable costs the product of the bands rather than the
  sum, which is why there is not one.
- **Where a notch sits on a held axis is a sample.** An axis other than wages
  has to decide what wages are, and there is no neutral answer: a means test on
  investment income binds only where there is earned income to lose. Each axis
  names its held values and the report prints them. What is *not* a sample is
  that the notch exists and how big it is.
- **A notch smaller than the step can separate from a kink**, about `$3` below
  `$150,000` and about `$50` above it.
- **Local income tax.** No county, city or school district is supplied, so
  Maryland and Indiana figures are the state tax alone.

## The classifier is a text match, and it was wrong in the dangerous direction

Its first version matched only the notch's dollar figures against the notes and
called **555** notches undisclosed. Almost all of them were Connecticut's four
overlapping staircases, Pennsylvania's tax forgiveness chart and Kentucky's
family size credit — every one of them described in the notes, in detail, with
the statute. The second version matched the provision *name* and called 64
Kentucky notches undisclosed because the engine labels the credit
`"Kentucky family size tax credit"` and KRS 141.066's note, inside Kentucky's own
file, calls it `"the family size tax credit"`.

> **BOTH VERSIONS FAILED TOWARDS MANUFACTURING FINDINGS, WHICH IS THE EXPENSIVE
> DIRECTION FOR A TOOL WHOSE OUTPUT IS SOLD AS A DEFECT LIST.** A classifier that
> misses a disclosure gap costs a sentence; one that invents 555 of them costs
> the reader's trust in the other 1,517 lines. The report prints the matching
> note beside each group so a reader checks the match rather than taking it.

### Version 4 failed the same way, and it was found by reading all six groups

Day 77 read every one of the 46 notches version 3 left in the `named` column.
**Three of the six provisions were already disclosed**, and all three failed for
the same structural reason: *the test is applied to one note at a time*, so a
single string has to carry both the provision's name and a step word, while the
notes are authored as a sequence of paragraphs.

```text
  IL  exemption allowance   "not phased out - it is lost entirely at the first
                            dollar" - a complete disclosure, and not one word of
                            it is in NOTCH_WORDS
  AR  low income tables     named in one note; called staircases in the note two
                            below, which opens "THE TABLES ARE STAIRCASES TOO"
  NY  child credit          four sentences declare the $16.50 staircase and every
                            one of them says "Its" or "The phase-out"
```

The fix was in the **notes**, not here: each of the three was reworded to name its
own subject, which is what this package claims of its notes anyway — they are
shipped in a result object and quoted one at a time, so a note that needs its
neighbour is a note that fails where it is actually read. The classifier was left
alone deliberately. Widening `NOTCH_WORDS` to admit *"lost entirely"* would have
fixed Illinois and loosened the test for all 1,569 rows on the strength of one
case, and the remaining failure mode — over-reporting — is the cheap one.

> **FOUR VERSIONS, FOUR ERRORS, ALL IN THE SAME DIRECTION.** 555, then 187, then
> 52, then 46 of which 3 groups were false. Every time, the instrument invented
> disclosure defects against a package that already disclosed them. The count in
> `CLIFFS.md`'s header is therefore an **upper bound on what is owed**, and the
> report says so in its own prose.

## `--check` is the gate, and what it is really guarding

`out/cliffs.json` is committed. `--check` re-runs the sweep and fails if the
inventory differs by a byte.

A notch appearing, vanishing or changing size is **never nothing**. It is either
a parameter this repository just shipped — a new bracket, an indexed threshold, a
credit table — or a defect it just introduced, and the two are indistinguishable
from the engine's test suite, which samples incomes in round numbers like
everybody else's. The gate forces the question to be answered in `CLIFFS.md`
before the inventory is committed again.
