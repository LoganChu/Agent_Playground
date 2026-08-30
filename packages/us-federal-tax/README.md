# us-federal-tax

A dependency-free US federal tax engine for JavaScript and TypeScript.

Income tax brackets, self-employment tax, FICA, Additional Medicare Tax, long-term
capital gains, net investment income tax, the child tax credit, the earned income
credit, the Section 199A qualified business income deduction, the SALT cap and its
phase-down, the four OBBBA deductions on Schedule 1-A, and quarterly estimated
payments — with every published figure traceable to the IRS release it came from.

**Tax years 2024, 2025 and 2026.**

```bash
npm install us-federal-tax
```

- **Zero dependencies.** Runs in Node, the browser, Bun, Deno, and edge runtimes.
- **Pure functions.** No network, no I/O, no global state. Same inputs, same answer.
- **Cited data.** `getYearParameters(2026).sources` returns the Revenue Procedure
  each number came from.
- **Ships ESM and CommonJS**, with TypeScript types.

## Quick start

```js
import { estimateFederalTax, quarterlyEstimatedPayments } from 'us-federal-tax';

const estimate = estimateFederalTax({
  filingStatus: 'single',
  year: 2026,
  selfEmploymentNetProfit: 120_000,
});

estimate.totalTax; // 32660.36
estimate.marginalRate; // 0.22
estimate.selfEmployment.total; // 16955.46
estimate.adjustedGrossIncome; // 111522.27

const plan = quarterlyEstimatedPayments(estimate, {
  priorYearTotalTax: 20_000,
  priorYearAdjustedGrossIncome: 100_000,
});

plan.basis; // 'priorYearSafeHarbor'
plan.requiredAnnualPayment; // 20000
plan.installments; // four dated installments
```

## Tax years

```js
import { SUPPORTED_YEARS, estimateFederalTax } from 'us-federal-tax';

SUPPORTED_YEARS; // [2024, 2025, 2026]

const household = {
  filingStatus: 'marriedFilingJointly',
  w2Wages: 120_000,
  qualifyingChildren: 2,
  stateAndLocalTaxesPaid: 25_000,
  otherItemizedDeductions: 8_000,
};

SUPPORTED_YEARS.map((year) => estimateFederalTax({ ...household, year }).totalTax);
// [6432, 5563, 5544]
```

An unsupported year **throws** `UnsupportedYearError` rather than falling back to
the nearest one. Quietly computing 2027 tax on 2026 brackets is the kind of bug
that stays invisible until it is expensive.

### 2025 is not the year you can interpolate

The One Big Beautiful Bill Act was enacted on 4 July 2025 and **changed 2025
retroactively**, after the IRS had already published that year's inflation
adjustments in Rev. Proc. 2024-40. A 2025 parameter set built from the Revenue
Procedure alone is wrong in four places, all in the direction of overstating tax:

| | Rev. Proc. 2024-40 | Actual 2025 |
| --- | --- | --- |
| Standard deduction (single / joint / HoH) | `$15,000` / `$30,000` / `$22,500` | **`$15,750` / `$31,500` / `$23,625`** |
| Schedule 1-A deductions | did not exist | **all four are live** |
| SALT cap | `$10,000` | **`$40,000`**, phasing down above `$500,000` |
| Child tax credit | `$2,000` | **`$2,200`** |

And two OBBBA changes are **not** retroactive, which is the mistake in the other
direction — carrying 2026 rules back into 2025:

- The § 199A phase-in range is still `$50,000` / `$100,000` in 2025. It widens to
  `$75,000` / `$150,000` only for years beginning after 2025, so using the wider
  range phases the wage/UBIA cap in half as fast as the statute allows.
- The § 199A(i) `$400` minimum deduction does not exist in 2025 at all.

### 2024 is the clean pre-OBBBA baseline

`scheduleOneA` is `null`, `section199A.minimumDeduction` is `null`, the SALT cap
is the flat `$10,000` with no phase-down, the child tax credit is `$2,000`, and
only the *child* needs a work-authorized SSN. The same call sites work across all
three years — `additionalDeductions()` returns a zeroed result for 2024 rather
than throwing, so a caller can compute either side of the sunset without a branch.

One thing worth knowing about 2024: the IRS corrected page 109 of the 2024
Instructions for Form 1040 on 8 January 2025. For married filing separately with
taxable income over `$365,600`, the tax is `$98,334.75` + 37%, **not** the
`$99,334.75` originally printed. Any implementation that transcribed the base-tax
column from a copy downloaded before 6 January 2025 overstates every top-bracket
separate filer by exactly `$1,000`. This library stores no base-tax column — it
walks the bands — so the error is not expressible here, and the derivation agrees
with the correction to the cent. There is a test for it.

## Why another tax library

Most JavaScript tax code is a bracket array copied off a blog post. The parts that
are actually hard get quietly skipped, and the result is wrong in ways that only
show up on a real return. This library exists to get those parts right:

**The Social Security wage base is shared.** Someone with $170,000 of W-2 wages and
a side business does not get a fresh $184,500 of base for their self-employment
income — they get the $14,500 that is left.

```js
selfEmploymentTax({ netProfit: 80_000, w2SocialSecurityWages: 170_000, year: 2026 })
  .socialSecurity; // 1798.00, not 9161.12
```

**Capital gains stack on top of ordinary income.** The 0%/15%/20% thresholds apply
to total taxable income, so a $20,000 gain is not simply "in the 0% bracket".

```js
longTermCapitalGainsTax({
  ordinaryTaxableIncome: 40_000,
  longTermGains: 20_000,
  filingStatus: 'single',
  year: 2026,
}).tax; // 1582.50 — only 9,450 of the gain fits under the 0% ceiling
```

**Half of SE tax is deductible, but Additional Medicare Tax is not.** They are
different forms (Schedule SE and Form 8959) and this library keeps them apart, so
`deductibleHalf` is never inflated by the 0.9%.

**Filing statuses genuinely differ.** Head of household tops out $25 below single at
the 24% and 32% ceilings. Married filing separately caps the 35% band at exactly
half the joint figure. A qualifying surviving spouse uses a $200,000 Form 8959
threshold but a $250,000 NIIT threshold. All modeled.

**Unknown years throw.** Asking for a year that has not been published raises
`UnsupportedYearError` rather than silently computing with the wrong brackets.

## The OBBBA deductions (Schedule 1-A)

The One Big Beautiful Bill Act created four temporary deductions for 2025–2028:
qualified tips (§ 224), qualified overtime compensation (§ 225), an enhanced
deduction for seniors, and qualified passenger vehicle loan interest (§ 163(h)(4)).
All four are available whether or not you itemize.

They are also easy to get wrong, because **their phase-outs do not agree with each
other**:

| Deduction | Cap | Phase-out starts | Reduction | Partial `$1,000` |
| --- | --- | --- | --- | --- |
| Tips | `$25,000` per return | `$150,000` / `$300,000` | `$100` per `$1,000` | dropped |
| Overtime | `$12,500` / `$25,000` joint | `$150,000` / `$300,000` | `$100` per `$1,000` | dropped |
| Vehicle loan interest | `$10,000` | `$100,000` / `$200,000` | `$200` per `$1,000` | **rounded up** |
| Senior | `$6,000` per eligible person | `$75,000` / `$150,000` | 6% of the excess | n/a |

So a filer $999 over the tips threshold loses nothing, while a filer **one dollar**
over the vehicle-interest threshold loses a full `$200`:

```js
qualifiedTipsDeduction({
  qualifiedTips: 10_000,
  modifiedAdjustedGrossIncome: 150_999,
  filingStatus: 'single',
}).deduction; // 10000 — $999 of excess is not a full increment

vehicleLoanInterestDeduction({
  qualifiedInterest: 10_000,
  modifiedAdjustedGrossIncome: 100_001,
  filingStatus: 'single',
}).deduction; // 9800 — "$200 for each $1,000 or portion thereof"
```

Three more details worth knowing:

- The **tips cap is not doubled** on a joint return; the overtime cap is.
- The **senior phase-out runs per person**, so a joint return with two 65-year-olds
  and `$200,000` of MAGI gets `$6,000`, not `$12,000 − $3,000 = $9,000`.
- **Married filing separately gets none of the four.** § 224(f) and § 225(e) require
  a joint return from a married filer, and the other two carry the same restriction.

`estimateFederalTax` computes all of this for you and returns the breakdown:

```js
const estimate = estimateFederalTax({
  filingStatus: 'single',
  year: 2026,
  w2Wages: 52_000,
  qualifiedTips: 18_000, // already included in w2Wages; the deduction subtracts it back out
});

estimate.additionalDeductions.total; // 18000
estimate.taxableIncome; // 17900
estimate.ordinaryIncomeTax; // 1900
```

Note the inputs are the *qualified* amounts, which this library cannot verify for
you: qualified overtime is the **FLSA premium portion only** (the extra half of
"time and a half", not the whole overtime paycheck), and qualified tips exclude
service charges, mandatory gratuities, and any specified service trade or business.

Because these deductions sit below AGI on Form 1040 line 13b, they reduce taxable
income without changing AGI — so they never move the NIIT threshold or feed back
into their own phase-outs. That is modeled correctly.

## The SALT cap and its phase-down

OBBBA § 70120 raised the § 164(b)(6) cap on state and local taxes from `$10,000`
to `$40,400` for 2026 — and attached a phase-down the old cap never had. Above
`$505,000` of modified AGI the cap falls by **30 cents per dollar**, stopping at a
`$10,000` floor.

```js
import { stateAndLocalTaxDeduction } from 'us-federal-tax';

stateAndLocalTaxDeduction({
  filingStatus: 'marriedFilingJointly',
  year: 2026,
  stateAndLocalTaxesPaid: 60_000,
  adjustedGrossIncome: 545_000,
}).cap; // 28400 — 40,400 less 30% of the 40,000 excess
```

**That phase-down makes the marginal rate non-monotonic**, which is the reason to
compute it rather than assume a flat cap. Inside the band, a dollar of income is
taxed *and* destroys 30 cents of deduction:

| Where | Ordinary bracket | Actual marginal rate |
| --- | --- | --- |
| Below `$505,000` | 35% | 35% |
| Inside the band | 35% | **45.5%** |
| Above `$606,333` | 35% | 35% |

The rate goes up and then back down. `test/salt.test.js` pins all three figures.

A separate return halves everything together — cap `$20,200`, threshold
`$252,500`, floor `$5,000` — and the phase-down runs on **modified** AGI, meaning
AGI increased by income excluded under § 911, § 931 or § 933.

`estimateFederalTax` applies the cap when you give it the components rather than a
finished total, and reports the working either way:

```js
const estimate = estimateFederalTax({
  filingStatus: 'marriedFilingJointly',
  year: 2026,
  w2Wages: 300_000,
  stateAndLocalTaxesPaid: 55_000,
  otherItemizedDeductions: 18_000,
});

estimate.stateAndLocalTax.deduction; // 40400 — capped, not 55,000
estimate.deduction; // 58400
estimate.deductionKind; // 'itemized'
```

`stateAndLocalTax` is reported even when the standard deduction wins, so you can
see how near the decision was.

## Credits: the child tax credit and the EITC

These are the two credits that decide most ordinary returns, and the distinction
between the two *kinds* of credit matters more than the amounts:

- A **non-refundable** credit reduces income tax, and only to zero.
- A **refundable** credit is paid out whether or not any tax is due.

```js
const estimate = estimateFederalTax({
  filingStatus: 'headOfHousehold',
  year: 2026,
  w2Wages: 28_000,
  qualifyingChildren: 2,
});

estimate.credits.earnedIncomeCredit.credit; // 6450.43
estimate.credits.childTaxCredit.nonRefundableCredit; // 385 — all the income tax there was
estimate.credits.childTaxCredit.refundableCredit; // 3400
estimate.totalTax; // 0
estimate.balanceDue; // -9850.43 — a refund
```

**A non-refundable credit cannot touch self-employment tax.** The § 26(a) ceiling
is the *regular tax liability* — ordinary income tax plus tax on capital gains.
Self-employment tax, NIIT and Additional Medicare Tax sit outside it. Subtracting
credits from a single "total tax" figure gets this wrong in the filer's favour:

```js
const freelancer = estimateFederalTax({
  filingStatus: 'headOfHousehold',
  year: 2026,
  selfEmploymentNetProfit: 30_000,
  qualifyingChildren: 1,
});

freelancer.incomeTaxBeforeCredits; // 373.06 — the whole ceiling
freelancer.selfEmployment.total; // 4238.87
freelancer.totalTax; // 4238.87 — the credit erased the income tax and nothing else
```

`estimate.incomeTaxBeforeCredits` is that ceiling, and
`estimate.totalTaxBeforeCredits` is what `totalTax` used to be.

### Three things that are easy to get wrong

**The § 24 phase-out rounds up.** "$50 for each $1,000 (**or fraction thereof**)",
and Schedule 8812 line 10 says to increase a partial excess to the next whole
$1,000. A joint filer one dollar over $400,000 loses a full $50, not five cents.
Modelling it as a flat 5% of the excess is wrong for everyone inside the range.

```js
childTaxCredit({
  filingStatus: 'marriedFilingJointly',
  qualifyingChildren: 2,
  adjustedGrossIncome: 400_001,
  incomeTaxBeforeCredits: 50_000,
}).creditAfterPhaseOut; // 4350, not 4399.95
```

**Earned income is net of half of self-employment tax.** § 32(c)(2)(A)(ii) defines
net earnings from self-employment "determined with regard to the deduction allowed
by section 164(f)". $30,000 of Schedule C profit is $25,585.57 of earned income,
not $30,000 — and the same definition drives the § 24(d) refundable phase-in. Using
gross profit overstates the credit while it is phasing in and *understates* it
after the phase-out begins, so the error is hard to catch by sampling.

**The § 32 phase-out runs on the greater of earned income and AGI.**
§ 32(a)(2)(B) says "adjusted gross income (or, if greater, the earned income)", so
a filer cannot phase the credit back in with above-the-line deductions.

### Details this library models that most do not

- **§ 24(d)(1)(B)(ii), the social security alternative.** With three or more
  children the refundable credit may instead be social security taxes paid less
  the EITC. For a large family earning little, payroll tax exceeds 15% of earnings
  over $2,500 — this is the provision that actually reaches them.
- **The child credit and the $500 credit for other dependents phase out
  together**, on the combined figure, not separately.
- **The § 32(i) investment income limit is a cliff.** One dollar over $12,200 and
  the entire credit is gone. `ineligibleReason` says so rather than silently
  returning zero.
- **The EITC joint-filer add-on is not a constant.** § 32(b)(2)(B) adds an indexed
  amount and the IRS rounds the *sum* to the nearest $10, so in 2026 the effective
  add-on is $7,280 with no children but $7,270 with children — and in 2025 the
  split ran the other way. Storing one add-on misplaces one of the two tables.
- **Rev. Proc. 2025-32 was corrected on 2025-10-17.** The completed phase-out for a
  joint return with three or more children became $70,244, up from the $70,224 in
  the 2025-10-09 release. This library derives that figure from its parameters and
  `test/credits.test.js` pins it against the corrected published value.
- **OBBBA § 70104(c)'s taxpayer SSN requirement**, new for 2025: without a
  work-authorized SSN the child credit is lost but the $500 credit survives.
- **The § 24 phase-out runs on modified AGI** — AGI plus income excluded under
  § 911, § 931 or § 933, which is Schedule 8812 line 3 — not on plain AGI.

### Credit phase-outs raise the real marginal rate

Both credits are withdrawn on income, which means the rate a filer actually faces
has little to do with their bracket:

| Filer | Bracket | What another $1,000 costs |
| --- | --- | --- |
| Head of household, 2 children, $30,000 | 10% | **21.06%** — the CTC shelters the bracket entirely, so the cost is pure EITC withdrawal |
| Head of household, 1 child, $45,000 | 12% | **27.98%** — 12% bracket plus 15.98% EITC withdrawal |
| Joint, 2 children, $411,000 | 24% | 24% inside each $1,000 band, then **$50 at the boundary** — a $2 raise costs $50.48 |

`test/credits.test.js` pins every figure in that table by running the whole
estimator.

### Turning the credits on

The child tax credit is computed when you pass `qualifyingChildren` or
`otherDependents`. The EITC is computed when there are qualifying children, or
when you pass `age` — with neither, the childless credit's 25-to-64 age test
cannot be evaluated, so the credit is reported as `null` rather than guessed at.
Passing no dependents and no age leaves every figure exactly as it was before
credits existed.

Two inputs need care. `disqualifiedInvestmentIncome` defaults to
`longTermCapitalGains`, which is the only component this library can identify with
certainty — **if you have substantial interest or dividends inside
`otherOrdinaryIncome`, supply it explicitly**. And `separatedFromSpouse` defaults
to `false`, barring a married-filing-separately filer from the EITC unless you
assert the § 32(d)(2) conditions.

## Section 199A (the QBI deduction)

Twenty percent of qualified business income — and then three limitations that
interact, all of them keyed to **taxable income figured without this deduction**
rather than to AGI.

```js
import { qbiDeduction } from 'us-federal-tax';

qbiDeduction({
  filingStatus: 'single',
  year: 2026,
  taxableIncomeBeforeQbiDeduction: 239_250, // exactly halfway through the range
  businesses: [{ qualifiedBusinessIncome: 150_000, w2Wages: 20_000 }],
}).deduction; // 20000 — 30,000 tentative, less half the 20,000 excess over the wage cap
```

Below the threshold (`$201,750` single, `$403,500` joint for 2026) none of the
limitations applies. Across the phase-in range above it, the W-2 wage and property
cap phases **in** while a specified service trade or business phases **out**. Above
the range the cap binds in full and an SSTB is worth nothing.

**Two things changed for 2026, and code written for 2025 gets both wrong.**

OBBBA § 70105 widened the phase-in range from `$50,000`/`$100,000` to
`$75,000`/`$150,000`. Carrying the old range forward phases the limitations in
twice as fast:

```js
qbiDeduction({
  filingStatus: 'marriedFilingJointly',
  year: 2026,
  taxableIncomeBeforeQbiDeduction: 478_500,
  businesses: [{ qualifiedBusinessIncome: 200_000 }],
}).deduction; // 20000 under the 2026 range; 10000 under the old one
```

And § 199A(i) is new: at least `$1,000` of QBI from a business you materially
participate in guarantees a `$400` deduction, even when 20% of taxable income is
less than that.

```js
qbiDeduction({
  filingStatus: 'single',
  year: 2026,
  taxableIncomeBeforeQbiDeduction: 800,
  businesses: [{ qualifiedBusinessIncome: 1_200 }],
}).deduction; // 400, not 160
```

Four more details that are easy to get backwards:

- **The threshold for a separate return is `$201,775`, `$25` *above* single.** That
  looks like a typo and is not: § 1(f)(7) rounds the inflation adjustment down to a
  multiple of `$50` in general but to a multiple of `$25` on a separate return, and
  the 2026 figure lands between the two. The same split shows up in 2021
  (`$164,900` / `$164,925`). A separate return also gets the `$75,000` phase-in
  range, not half the joint range.
- **The SSTB applicable percentage reduces wages and property too**, not just
  income — Schedule A (Form 8995-A). Halving an SSTB's QBI but leaving its wage cap
  intact overstates the deduction.
- **Losses are netted across businesses in proportion to income** (Reg.
  § 1.199A-1(d)(2)(iii)), and a business whose QBI is wiped out contributes no wages
  or property to the cap. Which business absorbs a loss changes the answer whenever
  the wage cap binds. A prior-year `qualifiedBusinessNetLossCarryforward` nets in the
  same way, but carries no wages or property with it.
- **Schedule 1-A comes out first.** Taxable income before the QBI deduction is AGI
  less the standard or itemized deduction **and less the Schedule 1-A total on
  Form 1040 line 13b** — the IRS reissued the 2025 Form 8995-A instructions in
  January 2026 to say so. Skipping that subtraction pushes a filer with tips or
  overtime income into a phase-out they are not in. `estimateFederalTax` does it in
  the right order and returns the whole Form 8995 in `estimate.section199A`.

Not modelled: the § 199A(g) deduction for agricultural and horticultural
cooperatives, the § 199A(b)(7) patron reduction, and the elective aggregation of
multiple businesses under Reg. § 1.199A-4 (pass an aggregated group as one entry if
you have made that election).

## API

| Function | Purpose |
| --- | --- |
| `estimateFederalTax(input)` | Full household picture: AGI, deduction, taxable income, total liability |
| `quarterlyEstimatedPayments(estimate, opts)` | IRC § 6654 safe harbors and four dated installments |
| `federalIncomeTax({ taxableIncome, filingStatus, year })` | Ordinary income tax with per-bracket detail |
| `selfEmploymentTax({ netProfit, w2SocialSecurityWages, year })` | Schedule SE, wage-base aware |
| `additionalMedicareTax({ filingStatus, wages, selfEmploymentEarnings })` | Form 8959, 0.9% |
| `ficaTax({ wages, filingStatus, year })` | Employee and employer sides |
| `longTermCapitalGainsTax({ ordinaryTaxableIncome, longTermGains, ... })` | Correctly stacked |
| `netInvestmentIncomeTax({ modifiedAdjustedGrossIncome, netInvestmentIncome, ... })` | Form 8960, 3.8% |
| `standardDeduction({ filingStatus, age65OrOlder, blind, ... })` | Including age and blindness additions |
| `childTaxCredit(input)` | Schedule 8812: CTC, the $500 other-dependent credit, phase-out, and the refundable ACTC |
| `earnedIncomeCredit(input)` | § 32 in full, with `ineligibleReason` when the credit is zero |
| `earnedIncomeForCredits({ wages, selfEmploymentNetEarnings, ... })` | § 32(c)(2) earned income, net of the § 164(f) deduction |
| `childTaxCreditParameters(year)` / `earnedIncomeCreditParameters(year)` | Credit amounts, thresholds and rates for a year |
| `qbiDeduction(input)` | § 199A in full: SSTB phase-out, wage/UBIA cap, taxable income limit, § 199A(i) floor |
| `section199AParameters(year)` | Thresholds, phase-in ranges and rates for a year |
| `stateAndLocalTaxDeduction({ stateAndLocalTaxesPaid, adjustedGrossIncome, ... })` | § 164(b)(6) cap with its phase-down |
| `saltCapParameters(year)` | Cap, threshold, rate and floor for a year |
| `additionalDeductions(input)` | All of Schedule 1-A, with a breakdown per part |
| `qualifiedTipsDeduction({ qualifiedTips, modifiedAdjustedGrossIncome, ... })` | § 224 |
| `qualifiedOvertimeDeduction({ qualifiedOvertimeCompensation, ... })` | § 225, FLSA premium only |
| `seniorDeduction({ modifiedAdjustedGrossIncome, age65OrOlder, ... })` | Per eligible individual |
| `vehicleLoanInterestDeduction({ qualifiedInterest, ... })` | § 163(h)(4) |
| `getYearParameters(year)` | Raw parameters and their citations |
| `SUPPORTED_YEARS` | `[2024, 2025, 2026]`, ascending |

Filing statuses are `'single'`, `'marriedFilingJointly'`, `'marriedFilingSeparately'`,
`'headOfHousehold'`, and `'qualifyingSurvivingSpouse'`.

## What this does not do

Stated plainly, because a tax library that hides its gaps is worse than useless:

- **Only two credits.** The child tax credit (with the credit for other dependents
  and the refundable ACTC) and the earned income credit are modeled in full.
  Education, energy, retirement-saver, premium tax, foreign tax and dependent-care
  credits are not. Nor is eligibility itself: you must decide who is a qualifying
  child, and the § 32(c)(3) test for the EITC genuinely differs from the § 24(c)
  test for the child credit — pass `eitcQualifyingChildren` when they diverge.
- **No AMT**, no state or local tax, no payroll withholding tables (Publication 15-T).
  Because § 26(a) adds AMT to the ceiling on non-refundable credits, a filer who
  owes AMT has a slightly larger ceiling than this library computes. That shifts
  credit from the refundable column to the non-refundable one without changing the
  total.
- **Section 199A stops short of three corners:** the § 199A(g) cooperative deduction,
  the § 199A(b)(7) patron reduction, and elective aggregation under Reg. § 1.199A-4.
  You must also decide yourself whether a business is a specified service trade or
  business and what its QBI, W-2 wages and UBIA are.
- **No eligibility checking for the OBBBA deductions.** The arithmetic is complete,
  but you must supply amounts that already qualify — this library cannot tell whether
  an occupation is on the Treasury tip list, whether overtime is FLSA-required, or
  whether a vehicle's final assembly was in the United States.
- **No § 68 overall limitation on itemized deductions.** OBBBA § 70111 replaced the
  old Pease limitation with a new one effective in 2026: itemized deductions are
  cut by 2/37 of the lesser of total itemized deductions or the taxable income
  above the 37% bracket threshold. It is not implemented because its second prong
  is defined in terms of taxable income, which depends on the § 199A deduction,
  which in turn depends on itemized deductions — a circularity the statute does
  not resolve on its own, and the IRS worksheet that does resolve it is not
  something this library's author could reach. **If your income is above `$640,600`
  (`$768,700` filing jointly) and you itemize, this library overstates your
  deduction by up to 5.4% of it.** Everyone below those figures is unaffected.
- **No 0.5%-of-AGI charitable floor**, also new for 2026 under OBBBA § 70425.
  Pass `otherItemizedDeductions` already net of it.
- **No medical-expense floor.** `otherItemizedDeductions` is taken as given, so
  subtract the 7.5%-of-AGI floor yourself.
- **2024 through 2026 only.** 2023 and earlier are not included. Note also that
  the § 68 gap above is a 2026-only provision — 2024 and 2025 are unaffected by
  it, since the old Pease limitation was suspended through 2025.

## Accuracy and provenance

Figures come from the IRS inflation-adjustment release for each year — Rev. Proc.
2023-34 (2024), Rev. Proc. 2024-40 (2025, **as amended retroactively by OBBBA**),
and Rev. Proc. 2025-32 (2026, published 2025-10-09 and **reissued 2025-10-17**
with a correction to the earned income credit table) — plus the SSA wage base
announcements. Every figure was cross-checked against a second independent source
before being committed, and the test suite pins hand-computed expected values
rather than snapshots of the code's own output.

Two structural checks run over every year, which is what makes adding a year safe:

- **The published EITC endpoints are derived, not stored.** The IRS publishes a
  "completed phase-out amount" for each of eight combinations of filing status
  and child count. This library stores the phase-out start and the maximum credit
  and computes the endpoint as `start + maximumCredit / phaseOutRate`. All
  twenty-four across the three years reproduce the published figure exactly, so
  each one is an independent test of two stored parameters rather than a second
  copy of them.
- **Status relationships are asserted generically.** A qualifying surviving
  spouse uses the joint rate schedule but a `$200,000` Form 8959 threshold and a
  `$250,000` NIIT threshold; married filing separately caps the 35% band at
  exactly half the joint figure; head of household is never above single and
  never differs by anything other than `$0` or `$25`. These run against every
  year in the registry, so a mistyped figure in a future year fails on the day
  it is added.

```js
getYearParameters(2026).sources;
// [{ title: 'IRS Rev. Proc. 2025-32 ...', url: 'https://www.irs.gov/pub/irs-drop/rp-25-32.pdf' }, ...]
```

If you find a number that disagrees with the IRS, that is a bug — please open an
issue with the citation.

## Disclaimer

This library performs arithmetic described by the Internal Revenue Code. It is not
tax advice, it is not a substitute for a tax professional, and it comes with no
warranty. Verify anything that matters.

## License

MIT
