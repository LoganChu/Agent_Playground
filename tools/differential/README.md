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

## Running it

```bash
# Build both engines first — the harness imports the compiled ESM.
(cd packages/us-federal-tax && npm ci && npm run build)
(cd packages/us-state-tax   && npm ci && npm run build)

python3 -m venv .pe && .pe/bin/pip install policyengine-us==2.15.3   # ~2 min, offline after
#   (.pe/ and .venv/ are both gitignored; a `git add -A` over an unignored venv
#    stages three thousand files of numpy, which is how that line got written)

node   tools/differential/cases-to-json.mjs > tools/differential/out/cases.json
node   tools/differential/ours.mjs          > tools/differential/out/ours.json
.pe/bin/python tools/differential/theirs.py tools/differential/out/cases.json \
                                            > tools/differential/out/theirs.json
node   tools/differential/compare.mjs       > tools/differential/REPORT.md
```

The PolicyEngine pass is the slow one — about two and a half seconds a
household, so roughly half an hour for the grid. (An earlier note here said "a
second a household, so eleven minutes"; it was measured on a smaller grid and a
faster runner, and believing it cost an afternoon of bad scheduling. Start this
pass FIRST and do the engine work while it runs.) It needs no network once installed: a `Simulation` built
from a situation dict downloads nothing.

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
