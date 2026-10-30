# Differential test against PolicyEngine-US

Twenty-two days of this project used [PolicyEngine-US](https://github.com/PolicyEngine/policyengine-us)
as a **parameter** reference: clone it, read the YAML, check a figure against a
statute cite. This runs it as a **model** instead — the same households through
both engines, every answer compared to the dollar.

The difference is the whole point. A parameter check tells you the number you
stored is the number they stored. Running both models tells you whether the two
*computations* agree, which is where every interesting error lives: the ordering
of credits, which income a phase-out reads, what a state does with a figure it
inherits from a federal return. Nothing in a parameter file has an opinion about
any of that.

## What it is

Four pieces, deliberately separate so that a disagreement can never be a
disagreement about the question:

| file | what it does |
| --- | --- |
| `cases.mjs` | generates the households — the single source of the grid |
| `ours.mjs` | runs `us-federal-tax` and `us-state-tax` over them |
| `theirs.py` | runs PolicyEngine-US over the same JSON |
| `compare.mjs` | joins the two and reports every difference over a dollar |
| `known-divergences.json` | the differences that have a recorded reason |
| `out/theirs.cases.sha256` | the fingerprint of the grid PolicyEngine last answered |

Both runners read the **same** `out/cases.json`, so neither side can quietly
answer a different question from the one the other was asked.

A case may contain only facts that map onto a PolicyEngine variable without
interpretation — a wage, a pension distribution, a Social Security benefit, a
long-term gain, tax-exempt interest, and the ages of the people in the house.
Itemised deductions, businesses and localities are left out: a disagreement
about one of those would be a disagreement about this harness.

## The grid, and why it was widened on Day 26

The first grid was 23 household shapes across 19 states, 437 cases, and by
Day 25 every difference it produced had a written reason. **That is not the same
as the two engines agreeing** — it means the grid has stopped finding things.

So Day 26 added ten shapes, each one a case an existing shape was a special case
of: a married couple with no children (the grid had a couple only *with* them),
dependents at three different ages in one household (every per-child credit here
bands on age and the only children in the grid were 3 and 8), a single parent of
a teenager, a separate return *with* a child, a **qualifying surviving spouse**
— the fifth filing status, which no case had ever used — an early retiree and an
early-retired couple below every age test in the package, and a blind worker and
a blind senior, because **no case in the grid had ever been blind**.

The last of those is the reason three states' aged and blind allowances went
unmodelled for twenty-five days. California's senior and blind exemption
*credits*, Michigan's `$3,400` special exemption and Mississippi's two `$1,500`
exemptions were all missing, and the grid could not see any of them: it had no
blind filer at all, and its only 65-year-olds were retirees in states that
exempt retirement income, where the tax is zero either way and an exemption
cannot show.

**The lesson is about coverage rather than about tax.** A differential test finds
a difference between two answers to a question somebody asked. A question nobody
asks has no answer to differ from, and a report of zero unexplained differences
says nothing whatever about it.

## And why Day 27 widened it again, in the one direction that was missing

Day 26's surviving spouse found four defects. She earns **`$45,000`**, and on
Day 27 the same filing status turned out to be wrong in two more places that
**begin at `$200,000`** — the § 24 child tax credit threshold and the § 199A
threshold. She could not have found either, however long the grid ran.

**THE RULE: adding a filing status to a grid tests that status only at the
incomes the grid already had.** A case reaches a threshold or it does not; what
the case is *called* decides nothing. Three shapes were added at `$250,000`,
`$300,000` and `$450,000` — inside the § 24 phase-out band, past its end for one
child, and past the *joint* threshold as well, which is the case that separates
"this package now uses `$200,000`" from "this package lost the credit for some
other reason". 703 cases.

And the sharper half, which came from CI rather than from reasoning: when the
Day 27 fixes were pushed against the **old** 646-case grid, the golden report
came back **byte-identical**. Three defects across three tax years, and not one
of 4,522 compared figures moved. § 199A is unreachable from this harness *in
principle* — a case may contain only facts that map onto a PolicyEngine variable
without interpretation, and a business is not one of them — and PolicyEngine
carries the joint `$400,000` for § 24 as well, so even a case that reached the
threshold would have agreed on the wrong answer.

**A differential test is bounded by the vocabulary of its cases, and that bound
is invisible from inside the report.** It is the best tool there is for finding
where two readings diverge, and it is worth nothing where both readings are the
same and both are wrong. That is what a parameter-versus-statute audit is for,
and `packages/us-federal-tax/test/surviving-spouse.test.js` is the first one
here.

## And why Day 29 widened it DOWNWARD, which is the same rule's other edge

Day 27's rule — *adding a filing status to a grid tests that status only at the incomes
the grid already had* — was acted on by widening **upward**, to `$250,000`, `$300,000` and
`$450,000`, because the two provisions then in hand began at `$200,000`. The rule is
symmetric and the correction was not.

v0.27.0 found fourteen more defects in that same filing status and **four of them live in
credits that switch off before `$30,000`**: Pennsylvania's tax forgiveness, Virginia's
Credit for Low Income Individuals, Maryland's poverty level credit and New York's household
credit. The grid's cheapest widow earned `$45,000` and every one of them was dark to her.

**THE RULE: a credit that switches OFF as income rises is invisible from above in exactly
the way a threshold is invisible from below.** The grid now files this status at `$18,000`
and `$26,000` as well — 741 cases — and `$26,000` was picked because it is above the
two-person federal poverty guideline and below the three-person one, which is the case that
separates "the household is counted correctly" from "the credit is gone".

The widening earned its keep in an unexpected way. The new Georgia case is the first that
could show that **`$748.50` is not the constant two divergence entries called it**: above
`$30,000` the whole `$15,000` of disputed deduction is in use and the gap is `$748.50` at
every income, and at `$26,000` it is `$299.40`, because the widow has not got `$30,000` of
income for the larger deduction to come off. A deduction disagreement is a constant only
above the deduction.

## And why widening by income is only half of widening (Day 30)

Day 27 widened this grid upward and Day 29 downward, and both are the same move: find what
an *income* reaches. There is a second axis and this status is the one that shows it.

**The grid has filed `marriedFilingSeparately` since the first day and had never once given
that return a spouse.** Both cases were a lone person who ticks the separate box — which is
the shape a grid author writes when the status is understood as "half of joint", because the
half has no other half in it.

**THE RULE: a status also has to be widened by the FACTS it is the only status to read.**
Married filing separately is the one status in the Code whose answer turns on a person who
is not on the return: § 63(c)(6)(A) on whether the other spouse itemizes, § 63(f)(1)(B) via
§ 151(b) on whether they had gross income, § 86(c)(1)(C) on whether they shared a house. A
separate return with nobody else in it cannot ask any of the three, at any income.

Two shapes were added — 779 cases — a separate filer at 68 with a 68-year-old spouse and no
Social Security, and the identical household at 61 so the pair isolates § 63(f) exactly.
`ours.mjs` passes `spouseHasNoGrossIncomeAndIsNotADependent` for any case with a spouse,
because **the harness can answer a question the engine cannot**: it built the household and
puts every dollar on the primary, where a tax return does not say what the other return
holds. Leaving it off would have made the two sides answer different questions and then
reported the difference as a divergence.

## And why a reason has to be checked against the other model, not just against this one

Day 24's rule was that a stale reason hides defects behind it. Day 29 found the shape
underneath that: **a reason can be wrong about the OTHER model, and then it is not hiding a
defect, it is manufacturing one.**

This entry stood for days:

> NOT MODELLED THERE. The New York household credit (Tax Law § 606(b)) … PolicyEngine-US
> models neither the credit nor the offset.

PolicyEngine-US models both. `ny_household_credit` has been in its non-refundable credit
list since 2007 and `ny_eitc` subtracts it under § 606(d)(1). Reading its source to check
that sentence found **two defects in this package**, both now fixed: the credit was measured
on New York AGI where § 606(b) names federal AGI, and the § 606(d)(1) offset subtracted the
whole household credit where Form IT-215 line 15 subtracts *the smaller of* the credit and
the tax it could be used against. Closing them closed every New York difference the entry
claimed to explain, and what is left under it is a different fact with a `$2` bound.

**THE RULE: a divergence entry makes a claim about two models, and only one of them is in
this repository.** The half that is about the other model is the half nobody re-reads, and
it is the half that decides whether a difference is *theirs* — which is the same as deciding
not to look.

## The reference side does not move (Day 32)

`out/theirs.json` was answered by **policyengine-us 2.10.0** and had been for six
days, which is a debt in exactly Day 28's sense: the reason the answers were
trusted was that nothing had been checked. Day 31 queued the version bump as its
own day, on the grounds that bumping it and changing this package on the same day
would leave a report that could not say which side had moved.

So it was run as a **controlled** bump: 2.15.3 against the **unchanged** grid,
before touching anything here. Five minor versions and about a month of upstream
development, and the output is **byte-identical** — same SHA-256, all 779
households, all 5,740 figures.

Two things worth taking from that, and they point in opposite directions:

1. **A divergence that appears tomorrow is this package's news.** The reference
   side has been stable across five releases on every figure this grid compares,
   so a count that moves after a change here is about the change here. That is
   what makes a one-figure improvement readable at all.
2. **It is also a statement about the GRID, not only about PolicyEngine.**
   Fourteen releases of a model that covers benefits, state credits, payroll and
   fifty states cannot really have changed nothing; what is true is that nothing
   they changed is *visible from these 946 households and five metrics*. Day 27's
   rule one level up: a differential test is bounded by the vocabulary of its
   cases, and a stable reference is evidence about the vocabulary as much as about
   the reference.

The cheap discipline that makes this checkable at all is `out/theirs.meta.json`,
which names the version that answered. It now says 2.15.3.

## An entry with no bound absorbs the next difference in its state (Day 32)

`compare.mjs` matched each difference with `known.find(...)` for a month: the
first entry in file order won, and nothing said a second entry had also matched.
That is not a bug in the matcher so much as a hole in the accounting, and Ohio is
the specimen.

The Ohio entry read *"NOT MODELLED HERE. Ohio's `$20`-per-exemption credit for a
filer with Ohio AGI of `$30,000` or less"* and had **no `maxAbs`**, so it was the
first match for every Ohio `state.tax` difference in the grid. It was carrying
four it cannot explain:

| difference | what it actually is |
| --- | --- |
| `$20.00` | the `$20`-per-exemption credit — the one the entry is about |
| `$275.00` | Ohio's addition for other states' municipal interest, added here in v0.29.0 |
| `$100.08` and `$59.12` | the separate-return spouse question, which has its own entry |
| `$316.09` | Ohio's earned income credit following the federal § 32(d) disagreement |

The last one is the sharpest, because it made a *written* claim false. The entry
for the § 32(d) knock-on says "**six** states in this grid set their earned income
credit as a flat percentage of the federal one" and names six. Ohio is the
**seventh**, at 30% under R.C. 5747.71, and the report could not show it because
the Ohio entry matched first. A reason was wrong in a way the harness was
structurally unable to print.

**THE RULE: a divergence entry with no bound absorbs the next difference in its
state, and the report that says "0 unexplained" is the last place that will tell
you.** It is Day 31's *a bound that covers two provisions is a bound on nothing*
at the other edge: an entry with no bound covers everything.

Two changes, and the second is the one that generalises:

1. The Ohio entry is bounded at `$100` — `$20` an exemption and four exemptions in
   the largest household here — and the bound is **derived from the rule rather
   than from the measurement**, per Day 31's ratchet lesson.
2. `compare.mjs` collects **every** matching entry, not the first, and prints a
   new section: **Claimed by more than one reason**. Forty-six of 407 differences
   land in it.

Forty-six is not forty-six bugs, and saying so is the point. Two different things
land there:

- **Genuinely multi-causal.** One state figure nets several disagreements, so a
  separate return in Arizona differs by an Arizona credit *and* by § 32(d) at
  once. Both entries are true of it, and the per-reason counts below the table are
  therefore **not a partition** — which is now stated in the report instead of
  being assumed away.
- **Mis-credited.** An unbounded entry sitting earlier in the file. The tell is an
  entry whose reason names a figure smaller than the difference it is credited
  with, which is exactly how Ohio was found.

Bounding the remaining unbounded entries is the obvious next pass and was not done
today: a bound has to come from the rule, and writing twenty of them from the
measurements would build twenty ratchets.

## Day 40: a case standing exactly on a boundary, and a state that magnifies the federal column

Alabama took the grid from 820 households to 903 — 43 of its own, and 42 from a
new shape every state now gets.

**The new shape is one case standing EXACTLY on a round number.** Day 39
predicted that this grid would disagree with PolicyEngine-US about which step of
Connecticut's Table E owns its boundary, ran, and found nothing: in 779
households nobody was standing on a boundary. `on-the-boundary` is a single
filer with one dependent at exactly `$50,000` and exactly `$100,000` of wages,
which are the two steps of Alabama's dependent exemption chart, Maryland's
`$100,000` exemption step and Virginia's `$50,000` age-deduction threshold.

It found the Alabama convention immediately, and it is **the first divergence in
this harness that was predicted before it was measured**: § 40-18-19(a)(9) reads
"equal to or less than fifty thousand dollars", so the lower step owns both
edges, and PolicyEngine-US stores the chart as thresholds read the other way.
`$25` of tax at `$50,000`, `$10` at `$100,000`.

It also found that a household already in the grid had been standing on the same
boundary for 39 days: `couple-two-children` at exactly `$100,000`. A convention
nobody could see was inside a case nobody had asked that question of.

**And Alabama magnifies the federal column into the state one.** Form 40 line 12
deducts the federal income tax, so a disagreement about the FEDERAL bill becomes
a disagreement about the STATE bill at 5% of itself. The § 24(b)(2) child credit
threshold for a qualifying surviving spouse — a federal divergence this file has
recorded since Day 27, worth `$2,200` — now shows up a second time as `$110` of
Alabama tax on the same two households.

**THE RULE: a state that deducts the federal tax turns every federal
disagreement into a state disagreement at its own rate.** One consequence is
pleasant and one is a warning. The federal side of this grid is now checked from
two directions, because an error in the federal engine moves an Alabama answer.
And no future Alabama column can be right while the federal one is wrong, which
makes the 42 federal differences in this report load-bearing for a state.

One harness change went with it, and it is the kind this file exists to avoid
needing. Ala. Code § 40-18-15(a)(3) makes the FICA a filer paid an ITEMISED
DEDUCTION of Alabama — PolicyEngine infers it from the wage it was given — so
until the harness passed `socialSecurityAndMedicarePaid`, the two sides differed
on every Alabama wage earner by 5% of their payroll tax and the difference would
have been about this harness. It is a fact about the household the harness BUILT,
not an itemised deduction added to a case, and it is computed with `ficaTax()`
from the federal package so that it is exactly PolicyEngine's own
`employee_payroll_tax`: Social Security, Medicare and the Additional Medicare
Tax. Massachusetts reads the same figure for its own `$2,000` deduction and had
never been given it either.

## Day 50: the one income type this grid cannot carry, and it is the reference model's fault

**Every case in this grid has a wage, a pension, a Social Security benefit, a
long-term gain or tax-exempt interest, and not one of the 2,288 has military
retired pay.** That is not an oversight about households. It is a property of
the reference model, and it was found by a defect the grid could therefore never
have caught: South Carolina's § 12-6-1170(C)(1), which charges the § 12-6-1171
military deduction against the ordinary `$3,000`/`$10,000` retirement cap. This
package got it wrong for a day and the differential had nothing to say, because
the question cannot be asked.

In `policyengine-us` 2.41.3, `military_retirement_pay` is **not** one of
`gov.irs.gross_income.sources`. Measured rather than inferred, in a virtualenv,
on a single filer of 70 in SC for 2025:

```text
military_retirement_pay = 60_000
  adjusted_gross_income            0.0
  taxable_income                   0.0
  state_income_tax                 0.0
  sc_military_deduction_indv       60000.0
```

Federal AGI is **zero** on `$60,000` of income that the Internal Revenue Code
taxes as ordinary income — only VA disability compensation is excluded, and this
is retired pay — and the state then deducts `$60,000` from a base that never
contained it. So a grid case with military retired pay in it would put the two
models a whole pension apart on the FEDERAL column, and the report would be
measuring the harness rather than either engine. That is the one thing this
harness exists not to do (see "A reason has to be checked against the other
model" above).

**And it is not a property of the version this grid is NOT pinned to, which is
the sharpest version of the point.** The pinned 2.15.3 — the version
`out/theirs.json` was measured on — has the same hole in
`gov/irs/gross_income/sources.yaml` AND already models § 12-6-1170(C)(1)
correctly in `sc_retirement_deduction_indv.py`. So the reference model held the
right answer to today's question, in the version this harness runs, for as long
as this harness has existed. **The only thing between the two was that the
question could not be put to it.** A reference model that is right and
unaskable is worth exactly as much as one that is wrong.

**THE RULE: A DIFFERENTIAL GRID'S COVERAGE IS BOUNDED BY THE REFERENCE MODEL'S
INPUT SURFACE, AND THAT BOUND IS INVISIBLE UNTIL SOMETHING FALLS THROUGH IT.**
The honest statement of this instrument's reach is therefore narrower than
"2,288 households across 26 states" — 2,376 across 27 since Day 60: it is that
many households built from five
income types, and a sixth that six states in this package have special rules for
is outside it. Six — Arizona, Maryland, New York, North Carolina, South Carolina
and Michigan — all carry military-specific provisions that no row here touches.

What to do about it, in order of what each costs:

1. **A unit test per state against the reference model's own published test
   fixtures**, which is what `south-carolina.test.js` Part 11 now does: their
   `sc_retirement_deduction_indv.yaml` case 3 and this package's three detail
   lines, compared by hand. Cheap, exact, and it does not need federal AGI to
   agree, because it compares the SUBTRACTION rather than the tax.
2. **Set both `military_retirement_pay` and a pension variable** for the same
   dollars, so the pay reaches federal AGI. Rejected for now: the state rules
   read the pension variables too, so the same dollars would be deducted twice
   in the reference model and the grid would be comparing against a double
   count. Their own SC fixtures set the two as separate dollars, which is
   evidence that this is not the intended wiring.
3. **Report it upstream.** Outside what this project does on its own — see
   `NOTES-FOR-HUMAN.md`.

## Day 54: the grid had one year in it, and a selector written for the other one

For fifty-three days every household in this grid was a 2026 household. The
generator always took the year — `export function cases(year = 2026)` — and no
caller ever passed one, so the parameter read like a dimension and behaved like a
constant. The grid is now `YEARS = [2025, 2026]` deep: **2,288 households**, the
same 44 shapes across the same 26 states, twice.

Every earlier widening of this grid moved along an axis somebody had chosen and
then under-used: Day 26 by household SHAPE, Day 27 upward by INCOME, Day 29
downward by income, Day 30 by the FACTS a status is the only one to read, Day 40
onto a BOUNDARY. **The year is the axis that was never chosen at all** — it was
in the generator's signature from the first commit, and nothing ever passed it.

2025 is not 2026 with different numbers. It is the year OBBBA changed
retroactively in July 2025 after the IRS had already published it; it is the only
year in which South Carolina's § 12-6-40(A)(1)(a) conformity date leaves the
state riding a federal standard deduction the federal return no longer uses; and
**exactly three state definition rules in `us-state-tax` exist in 2025 and not in
2026, all three South Carolina's.** No case in this grid could reach any of them.

### And the reason it was worth doing is what was already written here

`known-divergences.json` had **six entries carrying `"year": 2026"`** — Oregon's
two and Wisconsin's four — and the word `year` did not appear anywhere in
`compare.mjs`. The key was accepted, stored, and consulted by nothing.

While the grid was one year deep that cost nothing, because a selector that
selects every household is indistinguishable from one that is read. It is worse
than inert, though, because **Oregon's entry argues its case ON THE YEAR**:

> *"Every one of these is tax year 2026 and none is 2025, which is the signature
> of the disagreement rather than a symptom of it."*

A claim about 2025 households, in a grid that contained none, expressed through a
key nothing read. Three ways to be wrong at once, and all three invisible until
the grid gained a second year.

> **THE RULE: A SELECTOR THAT NOTHING READS IS NOT A NARROW RULE, IT IS A BROAD
> ONE WITH A NARROW DESCRIPTION** — and the description is what the next reader
> believes.

`match` now reads `rule.year`, and `requireKnownSelectors` is the general form of
the fix: **a key this matcher does not consult is a hard failure**, not a comment
nobody contradicted. `known-divergences.json` is hand-written JSON with no
schema, and the likelier version of this mistake is a misspelling — `states:
['OR']` for `state: 'OR'`, or `maxAbsolute` for `maxAbs`. An entry whose BOUND is
spelled wrong has no bound and `requireEveryReasonBounded` catches it; an entry
whose SCOPE is spelled wrong keeps its bound and quietly becomes the catch-all
Day 47 is about, while reading to a human exactly like the narrow entry it was
meant to be.

### The certificate was written before the work it certifies

`theirs.py` used to write `out/theirs.cases.sha256` and `out/theirs.meta.json` as
the first thing it did, before answering a single household. So a run that died
in the middle, or was killed, or had its stdout pointed somewhere else — all
three happened on Day 54 — left behind a certificate asserting that the committed
`theirs.json` answers the current grid, for a file the run never touched.
**`requireFreshTheirs` exists to catch exactly that state, and that state is the
one that defeated it**, because the guard and the thing it guards were written by
the same script in the wrong order.

> **THE RULE: A CERTIFICATE WRITTEN BEFORE THE WORK IT CERTIFIES IS A PLAN, NOT A
> RECEIPT.**

Both writes now happen after the answers are flushed, and the metadata carries an
`answers` count — a number that cannot be produced without having produced the
answers — which `requireEveryCaseAnswered` checks against the file in front of
it. A half-written reference is not a smaller reference; it is a different one.

### The id carries the year FIRST, and that is not cosmetic

Four entries select households by an AMOUNT inside the id — `"-400000-"`,
`"-450000-"`, `"surviving-spouse-high-MN-300000"` — relying on the dashes either
side of it. A trailing `-2026` would leave the last amount with a dash on one
side only, so a later entry written as `idIncludes: "-2025-"` would match nothing
and report that by matching nothing, which is the quietest failure this file has.
Leading, every amount keeps both delimiters and every existing selector keeps
matching exactly what it matched when it was written.

## Day 60: Louisiana, and the hour that re-verified the pin

The grid is **2,376 households across 27 states** — 44 shapes, two tax years, with
Louisiana's 88 cases added the day the state shipped.

**Running the whole pass rather than only the new rows bought a result worth more
than the hour it cost.** The 88 Louisiana cases could have been answered on their
own and merged, because `theirs.json` is keyed by a content-derived id
(`2025-single-worker-AL-15000-0-0-0-0`) and not by position, so a merge was
available and sound. The full run was chosen instead, and of the **2,288 answers
that were already committed, 0 differ** on a fresh install of the pinned 2.15.3.
**The version pin is now a verified claim rather than a hope** — until Day 60 the
record said which version answered and nothing had ever checked that the same
version answers the same way.

**And the five Louisiana differences are a parameter-vintage disagreement that
closes to the cent, which is the most useful shape a divergence can have.** Both
are 2026 figures, and 2026 is the first year Louisiana has one: R.S. 47:294(B)
first indexes the standard deduction on 1 January 2026, so 2025 is a statutory
amount both models hold identically.

The standard deduction is `$12,838` here and `$12,835` there, and **the `$3` is
two honest readings of the same four words.** The statute adjusts by "the
percentage increase in the Consumer Price Index". RIB 26-019 uses the *published
percentage* — the 2.7% BLS printed for the twelve months ending December 2025 —
giving `12,500 × 1.027 = 12,837.50`. policyengine-us uses the *ratio of the two
index levels*, `324.054 / 315.605 = 1.0267706`, giving `12,834.63`. Its own
parameter comment says so. The published figure is the one a return is filed on.

The retirement exemption is `$12,324` here and `$12,000` there, and that one **is
a carry-forward rather than a reading**: 2.15.3 has no 2026 value for it, because
its `uprating` metadata sits on the standard deduction and not on this parameter.
Its own later releases agree with this package — 2.62.8 carries `$12,324`, citing
the same bulletin. So it is the vintage of the pin, not a defect in their model,
and it is exactly the distinction `STATE_FIGURE_PROVENANCE` was built to draw.

`known-divergences.json` bounds the entry at `$10` from the mechanism rather than
from the observations: `$324` per person over 65 plus `$3` or `$6` of deduction at
3% is `$9.81` single, `$9.90` for a couple whose pension is in one name, `$19.62`
for a couple who split it — a shape this grid does not have, because it puts a
couple's pension on the primary.

## Day 61: North Dakota, the first state to produce no difference at all, and a merge

**All 88 North Dakota households agree with PolicyEngine-US on every figure, in both
years.** Not one `state.tax` difference, explained or unexplained — the first state added
to this grid for which that is true. The 2,464-household report gains six differences over
Day 60's 2,376 and every one of them is FEDERAL: four surviving-spouse child tax credit
rows and two § 32(d) rows, both already-explained entries that simply have more households
to match now.

Two things that result rests on, and the second is worth more than the first.

**The pinned reference already knew North Dakota's 2026 schedule.** `policyengine-us`
2.15.3 — the version this grid is pinned to, many releases old — carries the 2026
thresholds as hardcoded values rather than projecting them, and they are the same eight
figures 2.63.3 carries today and the same eight this package ships. So the pin is not
merely a stable yardstick here; it is a **second, temporally separated reading of a form
this sandbox could not open**. That has not happened before: on every earlier state the pin
could only be compared against, never consulted.

**It also means the $25 head-of-household anomaly is not a transcription error of mine.**
`states/north-dakota.ts` records that no single indexation factor reaches all eight
published 2026 thresholds, and that the obstruction is the head-of-household pair, each
`$25` below what the single and joint columns fix. Both PolicyEngine snapshots carry the
same two figures, from a parameter file citing the Tax Commissioner's own Form ND-1ES. Two
independent snapshots of the reference and two commercial tables agree on the anomaly, so
it is the published table rather than a typo in this package.

### The 88 rows were answered alone and merged, and Day 60 decided the other way

Day 60 ran the whole grid rather than the new rows, and bought a result with the extra
hour: of the 2,288 already-committed answers, zero differed on a fresh install of the pin.
**That check does not need repeating, and a slower option with no second deliverable is
just a slower option.** The mutation audit owned all four cores today, so a full pass would
have been slower still and would have slowed the audit with it.

The merge is sound for the reason Day 60 established: `theirs.json` is keyed by a
content-derived id (`2025-single-worker-ND-15000-0-0-0-0`), so position means nothing and
two files cannot be misaligned. The merge script asserted all three properties before
writing — 2,376 existing keys, 88 new ones, **no overlap**, and the union exactly equal to
the id set of the current `cases.json`.

**What is weaker, stated plainly: the certificate now covers two runs.** `theirs.cases.sha256`
and `theirs.meta.json` assert that the committed answers are answers to the current grid.
After a merge they assert it of 2,376 rows written on Day 60 and 88 written on Day 61,
under the same pinned version. That is a real difference from a single pass and it is the
thing a reader should know; it is also exactly the shape of the hazard this file's Day 54
section describes, which is why the merge is recorded here rather than left to the diff.

### And the grid's own state list was a literal, which fails SILENTLY

`cases.mjs` carried `STATES` as a hand-written array of 27 codes. Louisiana was added to it
by hand on Day 60 and North Dakota would have been missed on Day 61 — and **nothing would
have failed.** No refusal, no wrong number, no test: the grid would simply have been the
same 2,376 households it was yesterday, with the new state never compared to anything.

> **A LIST THAT GOES STALE BY REFUSING SOMETHING GETS FOUND. A LIST THAT GOES STALE BY NOT
> ASKING DOES NOT.** Every other stale list this repository has found announced itself —
> the README's gap bullet printed a wrong count, the MCP server's gates refused a field
> that moves a state's tax, the OBBBA table dropped a row the cross-package check demanded.
> This one would have been found only by somebody who noticed the case count had not moved.

It is now derived from `SUPPORTED_STATES` and each state's own `rate.kind`.

## Running it

```bash
# Build both engines first — the harness imports the compiled ESM.
(cd packages/us-federal-tax && npm ci && npm run build)
(cd packages/us-state-tax   && npm ci && npm run build)

python3 -m venv .pe && .pe/bin/pip install policyengine-us==2.15.3   # ~2 min, offline after
#   THE VERSION IS PINNED AND IT IS NOT THE VERSION TO READ PARAMETERS FROM.
#   Day 67 ran the whole hour-long pass on 2.87.0 — the version it had already
#   downloaded to read New Mexico's parameter files — and `compare.mjs` refused
#   the output. Two jobs want two versions of one package: the parameter route
#   wants the NEWEST figures and this harness wants a FROZEN model, because every
#   entry in known-divergences.json is a statement about a particular version.
#   If both jobs are being done in one run, install them into separate venvs
#   (.pe for this and .pe2 or similar for the other) rather than trusting that
#   the right one is on disk.
#   (.pe/ and .venv/ are both gitignored; a `git add -A` over an unignored venv
#    stages three thousand files of numpy, which is how that line got written)

node   tools/differential/cases-to-json.mjs > tools/differential/out/cases.json
node   tools/differential/ours.mjs          > tools/differential/out/ours.json
.pe/bin/python tools/differential/theirs.py tools/differential/out/cases.json \
                                            > tools/differential/out/theirs.json
node   tools/differential/compare.mjs       > tools/differential/REPORT.md
```

The PolicyEngine pass is the slow one — about a second and a half a household
with the machine to itself, so roughly an hour for the 2,376-household grid.
(Measured again on Day 60, on the 27-state grid: **54 minutes for 2,376
households**, about 1.4 s each — redirect opened at 16:54 and the sidecar written
at 17:47:54 — on a container that was running a short build and two fast suites
alongside it. Day 54's warning holds and this is the figure to budget against.)
(An earlier note here said "a second a household, so eleven minutes"; it was
measured on a smaller grid and a faster runner, and believing it cost an
afternoon of bad scheduling. Start this pass FIRST and do the engine work while
it runs.) It needs no network once installed: a `Simulation` built from a
situation dict downloads nothing.

**Two scheduling facts from Day 54, both of which cost hours.** The pass wants
the CPU to itself: it ran at a third of its speed for half an hour while
`test-counts.mjs` and a test suite shared the one core with it, and nothing in
its output said so — `ps` did. And in an agent sandbox whose clock advances only
while a command is running, POLLING a background job from one turn to the next
advances it by a couple of dozen households, where blocking in the foreground on
`until ! pgrep -f "[d]ifferential/theirs.py"; do sleep 15; done` advances it by
five hundred. Start it first, then block on it; do not poll it.

## The version is pinned, and that is not caution

`compare.mjs` refuses a report produced by any PolicyEngine-US but **2.15.3**, and
the pin is in the `pip install` line above for the same reason.

Day 39 installed the harness fresh and got **2.23.3**, eight minor versions on. Every
one of the grid's 29 Maryland households then disagreed by thousands of dollars —
`$12,695.68` on a single worker at `$400,000`, where that case's recorded divergence
is `$678.70`. Nothing was wrong with Maryland. **PolicyEngine had moved the Maryland
county income tax out of `state_income_tax`**, the way Indiana's county tax has
always been outside it; `LOCAL_OUTSIDE_STATE_TAX` in `theirs.py` is a map of exactly
that case, and Maryland has now joined Indiana on the other side of the line.

**THE RULE: a differential test has TWO inputs — the question and the model being
compared against — and this harness guarded only the question.** The cases
fingerprint has refused a stale grid since Day 26. The PolicyEngine version has been
*recorded* in `out/theirs.meta.json` since the same day and nothing read it, so a
reference that moved underneath presented as a wall of unexplained differences in one
state rather than as "the reference moved".

Upgrading is a deliberate act and not a chore, because **every entry in
`known-divergences.json` is a statement about a particular version of a model that is
still being developed**, and a version bump re-opens all of them. What it takes, with
the diagnosis already done: add `"MD": ("md_local_income_tax_before_refundable_credits",)`
to `LOCAL_OUTSIDE_STATE_TAX`, raise `EXPECTED_POLICYENGINE`, re-run both passes, and
re-read the whole explained list rather than only the unexplained one.

**It is also the half that can go stale, and until Day 26 nothing said so.**
`out/theirs.json` is committed so CI can run the cheap half on every push; the
price is that widening or editing `cases.mjs` leaves those answers attached to a
grid that no longer exists — every surviving id still resolves and every changed
case is then compared against the answer to a different question. `theirs.py`
now writes the SHA-256 of the cases file it read to `out/theirs.cases.sha256`,
and `compare.mjs` refuses to produce a report when it does not match. So the
rule is simply: **if `cases.mjs` changed, re-run the PolicyEngine pass**, and the
harness will tell you if you forgot.

`out/` holds the two models' raw answers and is committed, so a future run can
diff today's report against yesterday's without re-running either side.

## Reading the report

Every difference is either **explained** — matched by an entry in
`known-divergences.json`, which has to give a reason — or **unexplained**, and
unexplained differences are printed first and largest-first.

An unexplained difference is not a bug in this project. It is a question, and it
has three possible answers: this package is wrong, PolicyEngine is wrong, or the
statute is ambiguous and the two readings are both defensible. All three have
happened here. What the harness buys is that the question gets **asked**, on 646
households at a time, instead of waiting for someone to notice.

When one is resolved, it moves into `known-divergences.json` with the reason, so
the next run's report is about what is new rather than about what is known.

## A reason has to state its size

An entry may carry `maxAbs`, and from Day 24 most of them do. A difference
larger than that is reported as **unexplained** however well the rest of the
entry matches.

This is not tidiness. On the morning of Day 24 four entries here said, in
effect, "the caller has to supply the pension" — and the engine had started
supplying it itself the hour before, so what those entries were actually
matching was everything ELSE that disagreed in those four states. Behind one
sentence about pensions sat an Illinois child tax credit nobody on this project
had heard of, a Michigan exemption figure, a New York credit PolicyEngine does
not model, and a North Carolina child deduction. The report called all four
**explained**.

So a reason now claims a size as well as a cause, and the report fails loudly in
the one direction that matters: a known small gap growing into an unknown large
one. **A divergence entry matched on a state alone is a licence to be wrong
about that state in any way at all.**

### And the size is not always a number of dollars

Day 25 found the first reason `maxAbs` could not hold. The two models disagree
about **one Maryland county's 2026 rate** by 0.17 of a point, and that single
fact is `$43.76` on a `$30,000` household and `$678.70` on a `$400,000` one — the
same cause, fifteen times the size. A `maxAbs` wide enough for the second admits
any Maryland defect under `$700`, which is exactly the licence `maxAbs` was
written to withdraw.

So an entry may also carry **`maxShareOfIncome`**, and the two bounds add: it is
allowed `maxAbs` dollars plus that share of the household's own income, read off
the case rather than off either model's answer. Maryland's entry is `$6` plus
0.17%, which is the shape of the cause — one rate differs, and one fixed figure
does.

**The shape of a bound has to match the shape of the cause.** A missing credit is
a dollar figure. A rate disagreement is a rate. A bound in the wrong units is
either useless or a licence.

### An entry that matches nothing is printed too

A stale reason that still matches hides defects behind it; a stale reason that
matches nothing is a claim about this project that stopped being true and that
nobody will notice, because a report only ever lists what it found. `compare.mjs`
lists them under **Dead reasons**. Entries are ordered narrow before wide, because
`find()` takes the first match and a wide reason listed ahead of a narrow one
kills the narrow one silently.

### Two more bounds, and the third is not about size at all (Day 45)

Minnesota's arrival needed both, and each is a lesson rather than a convenience.

**`minAbs`.** Minnesota produces three classes of divergence that differ by two
orders of magnitude and by nothing else a rule can see: an unmodelled refundable
credit worth up to `$5,640`, an unmodelled alternative minimum tax worth `$602`,
and a stale 2026 parameter worth `$2.67` to `$10.20`. They land on *overlapping*
sets of households, so `state`, `kind` and `idIncludes` cannot separate them, and
with only a ceiling the credit entry absorbed the parameter differences.

That is **Day 32's lesson pointed the other way**. `maxAbs` stops a broad reason
claiming a difference bigger than the figure it names; nothing stopped it
claiming one far smaller. A reason now states a BAND, and a difference outside
every band is unexplained — which is what the report is for.

**`direction`.** Even a band could not separate Minnesota's credit from its AMT:
the credit differences run `$105.33` to `$5,640` and the AMT one is `$602.78`,
straight through the middle. What separates them is the SIGN, and the sign is
part of each claim rather than a property of the data: **a credit this package
does not model can only make the other model's answer lower; a tax it does not
model can only make it higher.** An entry matching a difference that points the
wrong way is wrong about its own mechanism whatever its size, so `direction` is a
check on the reason and not a filter on the data.

**`notStates`, and this one is a defect that was already there.** Three entries
in this file are scoped by `kind` with no state, and the day the grid gained
Minnesota all three began claiming Minnesota differences:

| entry | what it claims | could it reach Minnesota? |
| --- | --- | --- |
| the `$400,000` federal itemiser | PolicyEngine itemises federally and Virginia and Georgia follow the election | **No.** Minnesota starts from federal AGI, so a federal itemised deduction is outside its base entirely |
| the § 32(d) earned income credit | a federal credit difference multiplied by seven states' flat match rates | **No.** Minnesota's analogue is the working family credit half of § 290.0661, which is not a percentage of the federal credit and is not modelled here at all |
| the § 151(b) / § 63(f) spouse | a no-income spouse counted on a separate return | **Yes** — and Minnesota's version is its additional standard DEDUCTION rather than an exemption, so it was given an entry of its own naming § 290.0123, subd. 2 |

**THE RULE: an entry scoped by `kind` claims every state the grid is ever given,
including the ones added after the reason was written.** `maxAbs` guards the size
of a claim and says nothing about its reach. Two of the three mechanisms above
cannot touch a Minnesota return at any income, and both were silently credited
with one.

A whitelist frozen to whatever matched on the day it was written would be the
ratchet this file warns about elsewhere, so the fix is an explicit exclusion that
has to be argued in the reason — which is what the three entries now do.

### And the grid priced an open question, which is a use for it nobody planned

Minnesota ships with one claim resting on an ABSENCE: nobody has read whether
§ 290.0123, subd. 2's additional standard deduction for the aged follows a
separate filer's spouse who has no gross income, the way 26 U.S.C. § 63(f)(1)(B)
does federally. The package counts only the people on the return and says so.

PolicyEngine-US takes the other side, so the grid reports the difference: `$1,600`
of deduction and **`$108.80`** of tax on one household, `$98.61` after the stale
parameters net against it.

**A differential test is the cheapest way to put a number on a question nobody
has answered, because the other model has already taken the other side of it.**
Every previous use of this harness was to find a disagreement where one of the
two readings is wrong. This is a disagreement where nobody here knows which is.


## When the right answer is the thing in the way (Day 56)

`known-divergences.json` is the discipline this harness rests on: every difference
gets a written reason, every reason a bound, every bound derived from the provision
rather than from the measurement. Day 24 found that a STALE reason hides defects
behind it. Day 29 found that a reason can be wrong about the OTHER model, and then
it manufactures a defect instead of hiding one.

Day 55's Oregon entry was the best reason in this file. It named the mechanism,
cited the constitution, quoted PolicyEngine's own source for the substitution it
makes, bounded itself as a RATE rather than a dollar figure because the credit is a
rate on a liability, and then verified itself: of the 44 Oregon 2025 households, 43
differed by a dollar or more and 41 of those 43 were `0.09863 ×` a figure both
models agree about, to within a cent.

It was right. **And being right is what made it a blindfold**, because a reason that
correctly accounts for a `$3,993.89` difference also absorbs, in silence, every
smaller difference in the same state-year. Nothing in the report can show that. A
report lists what it found.

> **THE RULE: AN EXPLAINED DIVERGENCE IS A RECORD AND ALSO A BLINDFOLD, AND THE CURE
> IS NOT A BETTER REASON. It is to stop the two models answering different questions,
> so that there is nothing left to explain.**

### What the shared fact is, and why its amounts go the wrong way

`or_tax_before_credits_in_prior_year` is an ordinary PolicyEngine input despite
having a formula, so setting it overrides the proxy. `cases.mjs` now carries
`oregonPriorYearTaxBeforeCredits` — Oregon-only, following `county`'s precedent, and
deliberately NOT part of the case id, because the id is the household and this is a
fact about a return from a year the household is not in.

The amounts are **anti-correlated with income on purpose**: `$4,000` at or above
`$100,000` and `$24,000` below it. The figure PolicyEngine substitutes when nobody
supplies one IS this year's own liability, so a basis that rose with income would be
approximately the proxy, and the grid would be measuring the proxy's best case while
reporting agreement.

> **A SHARED FACT CHOSEN TO RESEMBLE THE OTHER MODEL'S GUESS TESTS NOTHING. It has to
> be chosen where the guess is worst.**

It is also the truthful shape rather than a contrivance. A filer's 2024 liability is
a fact about 2024 and need not resemble 2025 at all: somebody who earned `$400,000`
in 2024 and `$15,000` in 2025 is a retirement, a redundancy, or a business that had
one good year.

Four properties were wanted and the ladder has all four — non-zero, unequal to the
household's own figure, not one constant, and **larger than the household's own tax
on some households, because the kicker is REFUNDABLE and a credit exceeding the tax
is the only case that separates refundable from capped.** That last one paid better
than expected: **18 of the 44 Oregon 2025 households now have a NEGATIVE state tax**
and the two models agree to the cent on every one. The `$15,000` single worker goes
from `$470.18` of Oregon tax to `-$1,896.94` in both engines independently.

It is supplied in **2026** too, where it must buy nothing — this package declares no
rule and PolicyEngine carries `kicker.percent` of `0`. Passing it anyway turns that
agreement into something the grid can SEE.

### What it measured, against a prediction written first

| claim | predicted | measured |
| --- | --- | --- |
| non-Oregon answers move | none | **none**, all 2,200 byte-identical |
| Oregon 2026 answers move | none | **none**, all 44 byte-identical |
| Oregon 2025 `state.tax` differences | 43 → 2 | **43 → 2** |
| Oregon 2026 `state.tax` differences | 42, unchanged | **42** |
| figures agreeing to the dollar | +41 | **14,946 → 14,987** |

The two survivors are `separate-with-spouse` at `$87.50` and `separate-with-child` at
`$78.15`, and both now belong to entries that were already in the file.

**`separate-with-child` is not an Oregon reading at all.** ORS 315.266 matches the
federal earned income credit at 9%, and the federal § 32(d) difference on that
household is `$868.33`: `868.33 × 0.09 = 78.15`, exactly the measured figure. Which
exposed a count that had been wrong for days — the § 32(d) flow-through entry said
**eight** states and named eight, omitting Oregon, while carrying no `state` and no
`year` and therefore claiming Oregon in both years all along. It is nine now, and
Oregon is the only one of the nine whose match rate CHANGES between the grid's two
years (SB 1507 raises it to 14% for 2026).

> **A COUNT IN A REASON IS A CLAIM, AND THIS FILE'S STATE LISTS ARE STILL
> HAND-WRITTEN** — which is the thing `us-tax-mcp`'s derived lists exist to prevent
> one layer up.

### And the residual arithmetic was distorted by the proxy it was measuring

Day 55 priced the two survivors at `$78.15` and `$78.87` by subtracting
`0.09863 × our tax before credits` from each observed difference. Today's pure
figures are `$78.15` and `$87.50`.

The first is identical, and the second is off by exactly `0.09863 × $87.50 = $8.63`.
That is not a coincidence and not an error in either model: their proxy is **their
own** tax before credits, which on this household differs from ours by the whole
`$87.50`, so an estimate built on OUR figure understates the gap by the rate times
the gap. `$87.50 − $8.63 = $78.87`, to the cent.

> **AN ESTIMATE THAT SUBTRACTS A MODELLED QUANTITY USING YOUR OWN INPUTS IS WRONG BY
> THE RATE TIMES THE DISAGREEMENT, exactly where the two models disagree** — which is
> the only place anybody is looking. Day 55's own rule was that a figure reconstructed
> from a result is not the figure; this is the same rule one level in, for a figure
> reconstructed from the OTHER model's result.

The entry that recorded all of this is **deleted** rather than kept under "Reasons
that matched nothing", and that is deliberate. Its bound is a share of income, so it
still matched both survivors — meaning a closed entry would have gone on absorbing
two differences it cannot explain, which is Day 24's defect with a fixed mechanism
behind it. **An entry whose mechanism is closed but whose bound still matches is not
a record, it is a catch-all.** The story lives here instead, where nothing is matching
on it.
