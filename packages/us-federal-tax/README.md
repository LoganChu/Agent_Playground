# us-federal-tax

A dependency-free US federal tax engine for JavaScript and TypeScript.

Income tax brackets, self-employment tax, FICA, Additional Medicare Tax, long-term
capital gains, net investment income tax, the Section 199A qualified business income
deduction, the SALT cap and its phase-down, the four OBBBA deductions on Schedule
1-A, and quarterly estimated payments — with every published figure traceable to the
IRS release it came from.

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

Filing statuses are `'single'`, `'marriedFilingJointly'`, `'marriedFilingSeparately'`,
`'headOfHousehold'`, and `'qualifyingSurvivingSpouse'`.

## What this does not do

Stated plainly, because a tax library that hides its gaps is worse than useless:

- **No credits.** Child tax credit, EITC, education and energy credits are not modeled.
- **No AMT**, no state or local tax, no payroll withholding tables (Publication 15-T).
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
- **2026 only.** Earlier years are not yet included.

## Accuracy and provenance

2026 figures come from the IRS inflation-adjustment release for tax year 2026
(Rev. Proc. 2025-32, published 2025-10-09) and the SSA wage base announcement. Every
figure was cross-checked against a second independent source before being committed,
and the test suite pins hand-computed expected values rather than snapshots of the
code's own output.

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
