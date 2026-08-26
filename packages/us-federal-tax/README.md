# us-federal-tax

A dependency-free US federal tax engine for JavaScript and TypeScript.

Income tax brackets, self-employment tax, FICA, Additional Medicare Tax, long-term
capital gains, net investment income tax, and quarterly estimated payments — with
every published figure traceable to the IRS release it came from.

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
| `getYearParameters(year)` | Raw parameters and their citations |

Filing statuses are `'single'`, `'marriedFilingJointly'`, `'marriedFilingSeparately'`,
`'headOfHousehold'`, and `'qualifyingSurvivingSpouse'`.

## What this does not do

Stated plainly, because a tax library that hides its gaps is worse than useless:

- **No credits.** Child tax credit, EITC, education and energy credits are not modeled.
- **No Section 199A computation.** You can pass `qualifiedBusinessIncomeDeduction`,
  but the phase-outs and specified-service-trade rules are not implemented.
- **No AMT**, no state or local tax, no payroll withholding tables (Publication 15-T).
- **No OBBBA temporary deductions** (tips, overtime, senior, car loan interest) yet.
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
