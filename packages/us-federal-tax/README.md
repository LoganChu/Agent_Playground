# us-federal-tax

A dependency-free US federal tax engine for JavaScript and TypeScript.

Income tax brackets, self-employment tax, FICA, Additional Medicare Tax, long-term
capital gains, net investment income tax, the four OBBBA deductions on Schedule 1-A,
and quarterly estimated payments — with every published figure traceable to the IRS
release it came from.

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
- **No Section 199A computation.** You can pass `qualifiedBusinessIncomeDeduction`,
  but the phase-outs and specified-service-trade rules are not implemented.
- **No AMT**, no state or local tax, no payroll withholding tables (Publication 15-T).
- **No eligibility checking for the OBBBA deductions.** The arithmetic is complete,
  but you must supply amounts that already qualify — this library cannot tell whether
  an occupation is on the Treasury tip list, whether overtime is FLSA-required, or
  whether a vehicle's final assembly was in the United States.
- **No SALT cap** and no itemized-deduction limitation, so `itemizedDeductions` is
  taken at face value.
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
