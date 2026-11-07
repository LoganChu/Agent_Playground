# Verification audit

Input: `tools/audit/demo-synthetic.csv` — **12 households**.

Produced by `tools/audit/audit.mjs` in the `us-state-tax` repository. Every figure below was computed on the machine that ran it; nothing was sent anywhere.

## What the run found

```text
  households audited                         12
  agree to the cent                           1
  disagree                                   11
  total of the gaps, absolute        $12,110.95
  largest single gap                  $4,942.94   payroll-006
  disagreements this tool explains           10
  disagreements it does NOT                   1
```

The last line is the one worth reading twice. **A tool that explains every disagreement has a catch-all in it**, and this one is built to report the residue rather than absorb it. An unexplained gap is where a human has to read the statute and decide which of the two engines is wrong — which is what the paid audit is for, and is the only part of it that is not arithmetic.

### By what it is

| finding | households |
| --- | --- |
| `stale-parameters` | 1 |
| `local-tax-omitted` | 1 |
| `credits-not-applied` | 1 |
| `credit-omitted` | 1 |
| `surtax-omitted` | 1 |
| `top-rate-on-whole-base` | 1 |
| `no-income-tax-state` | 1 |
| `rounding` | 1 |
| `filing-status` | 1 |
| `supplied-figure-not-spent` | 1 |

### By how strong the evidence is

- **3** household(s) — RECOMPUTED — the engine was re-run with one thing changed and returned your figure
- **7** household(s) — ARITHMETIC — your figure equals a line item this return reports, exactly

## Every disagreement

| household | state | year | yours | this engine | gap | what explains it |
| --- | --- | --- | --- | --- | --- | --- |
| `payroll-006` | CA | 2025 | $164,634.77 | $169,577.71 | -$4,942.94 | `surtax-omitted` |
| `payroll-003` | NY | 2025 | $4,070.00 | $6,697.49 | -$2,627.49 | `local-tax-omitted` |
| `payroll-004` | NY | 2025 | $1,390.38 | -$13.94 | $1,404.32 | `credits-not-applied` |
| `payroll-005` | NY | 2025 | $986.06 | -$13.94 | $1,000.00 | `credit-omitted` |
| `payroll-010` | VA | 2025 | $2,869.93 | $2,366.80 | $503.13 | `filing-status` |
| `payroll-008` | TX | 2025 | $500.00 | $0.00 | $500.00 | `no-income-tax-state` |
| `payroll-012` | IL | 2025 | $2,828.93 | $3,323.93 | -$495.00 | `supplied-figure-not-spent` |
| `payroll-007` | VA | 2025 | $3,180.90 | $2,923.40 | $257.50 | `top-rate-on-whole-base` |
| `payroll-002` | GA | 2026 | $2,491.20 | $2,245.50 | $245.70 | `stale-parameters` |
| `payroll-011` | MO | 2025 | $3,100.00 | $3,234.50 | -$134.50 | **nothing — see below** |
| `payroll-009` | MD | 2025 | $5,786.41 | $5,786.78 | -$0.37 | `rounding` |

## Each one, with the provision named

### `payroll-006` — CA 2025, -$4,942.94

```text
  your figure             $164,634.77
  this engine             $169,577.71
  gap                      -$4,942.94
  the household        single, age 40, $1,500,000.00 wages
```

**1. Mental Health Services Tax — $4,942.94, not charged**  
*ARITHMETIC* — $164,634.77 is this engine's answer less exactly $4,942.94, which is this return's Mental Health Services Tax. A rate table with one row per state does not have this rate in it.

*This return carries 13 note(s) from the engine about things a caller would otherwise get wrong. They are omitted here because the gap is explained above; `--json` carries them.*

*This harness defaulted 4 field(s) on this row — pension treated as 0; socialSecurity treated as 0; longTermCapitalGains treated as 0; taxExemptInterest treated as 0. Where that matters the gap is this harness's silence rather than your engine's answer.*

<details><summary>The documents behind this state-year</summary>

- [Cal. Rev. & Tax. Code § 17041 — rates and the joint-schedule doubling rule](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=RTC&sectionNum=17041)
- [Cal. Rev. & Tax. Code § 17043 — 1% Mental Health Services Tax over $1,000,000](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=RTC&sectionNum=17043)
- [Cal. Rev. & Tax. Code § 17054 — personal and dependent exemption credits](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=RTC&sectionNum=17054)
- [FTB 2025 California Tax Rate Schedules and indexing](https://www.ftb.ca.gov/forms/2025/2025-california-tax-rate-schedules.html)
- [Cal. Rev. & Tax. Code § 17052 — California Earned Income Tax Credit](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=RTC&sectionNum=17052)
- [Cal. Rev. & Tax. Code § 17052.1 — Young Child Tax Credit](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=RTC&sectionNum=17052.1)
- [FTB Form 3514 — California Earned Income Tax Credit, and its instructions](https://www.ftb.ca.gov/forms/2025/2025-3514-booklet.html)

</details>

### `payroll-003` — NY 2025, -$2,627.49

```text
  your figure               $4,070.00
  this engine               $6,697.49
  gap                      -$2,627.49
  the household        single, age 40, $85,000.00 wages, NYC
```

**1. the state tax exactly, with the local income tax missing**  
*ARITHMETIC* — $4,070.00 is this engine's state figure to the cent. What is absent is New York City (resident, on stateTaxableIncome) $2,627.49. A state return is not a filer's bill where a locality taxes income too.

*This return carries 19 note(s) from the engine about things a caller would otherwise get wrong. They are omitted here because the gap is explained above; `--json` carries them.*

*This harness defaulted 4 field(s) on this row — pension treated as 0; socialSecurity treated as 0; longTermCapitalGains treated as 0; taxExemptInterest treated as 0. Where that matters the gap is this harness's silence rather than your engine's answer.*

<details><summary>The documents behind this state-year</summary>

- [N.Y. Tax Law § 601 — imposition of tax, and (d) the tax table benefit recapture](https://www.nysenate.gov/legislation/laws/TAX/601)
- [N.Y. Tax Law § 606(b) — household credit; § 606(d) — earned income credit](https://www.nysenate.gov/legislation/laws/TAX/606)
- [N.Y. Tax Law § 606(c-1) — the Empire State child credit, as amended by S.3009-C, Part C, § 2](https://www.nysenate.gov/legislation/laws/TAX/606)
- [Form IT-213, Claim for Empire State Child Credit, and its instructions](https://www.tax.ny.gov/pdf/current_forms/it/it213i.pdf)
- [N.Y. Tax Law § 614 — standard deduction; § 616 — New York exemptions](https://www.nysenate.gov/legislation/laws/TAX/614)
- [N.Y. Tax Law § 612(c)(3) — government pensions excluded in full; § 612(c)(3-a) — the $20,000 pension and annuity exclusion](https://www.nysenate.gov/legislation/laws/TAX/612)
- [Form IT-201-I, Instructions for Form IT-201, line 29](https://www.tax.ny.gov/pdf/current_forms/it/it201i.pdf)
- [New York FY2026 Enacted Budget, S.3009-C — rate reductions for 2026 and 2027](https://legislation.nysenate.gov/pdf/bills/2025/S3009C)
- [Form IT-201-I, Instructions for Form IT-201 — rate schedules and the tax computation worksheets](https://www.tax.ny.gov/pdf/current_forms/it/it201i.pdf)

</details>

### `payroll-004` — NY 2025, $1,404.32

```text
  your figure               $1,390.38
  this engine                 -$13.94
  gap                       $1,404.32
  the household        headOfHousehold, age 35, children aged 3, $42,000.00 wages
```

**1. the state tax before credits — every credit on this return was dropped**  
*ARITHMETIC* — $1,390.38 is exactly the state tax before credits on this return. The 2 credit(s) worth $1,404.32 together are: New York earned income credit $404.32; Empire State child credit $1,000.00

**2. the state tax before credits, plus local tax — every credit on this return was dropped**  
*ARITHMETIC* — $1,390.38 is exactly the state tax before credits, plus local tax on this return. The 2 credit(s) worth $1,404.32 together are: New York earned income credit $404.32; Empire State child credit $1,000.00

*2 explanations match this gap arithmetically. They are listed strongest-evidence first and are not mutually exclusive; which one is the cause is a question about your code, not about this number.*

*This return carries 21 note(s) from the engine about things a caller would otherwise get wrong. They are omitted here because the gap is explained above; `--json` carries them.*

*This harness defaulted 4 field(s) on this row — pension treated as 0; socialSecurity treated as 0; longTermCapitalGains treated as 0; taxExemptInterest treated as 0. Where that matters the gap is this harness's silence rather than your engine's answer.*

<details><summary>The documents behind this state-year</summary>

- [N.Y. Tax Law § 601 — imposition of tax, and (d) the tax table benefit recapture](https://www.nysenate.gov/legislation/laws/TAX/601)
- [N.Y. Tax Law § 606(b) — household credit; § 606(d) — earned income credit](https://www.nysenate.gov/legislation/laws/TAX/606)
- [N.Y. Tax Law § 606(c-1) — the Empire State child credit, as amended by S.3009-C, Part C, § 2](https://www.nysenate.gov/legislation/laws/TAX/606)
- [Form IT-213, Claim for Empire State Child Credit, and its instructions](https://www.tax.ny.gov/pdf/current_forms/it/it213i.pdf)
- [N.Y. Tax Law § 614 — standard deduction; § 616 — New York exemptions](https://www.nysenate.gov/legislation/laws/TAX/614)
- [N.Y. Tax Law § 612(c)(3) — government pensions excluded in full; § 612(c)(3-a) — the $20,000 pension and annuity exclusion](https://www.nysenate.gov/legislation/laws/TAX/612)
- [Form IT-201-I, Instructions for Form IT-201, line 29](https://www.tax.ny.gov/pdf/current_forms/it/it201i.pdf)
- [New York FY2026 Enacted Budget, S.3009-C — rate reductions for 2026 and 2027](https://legislation.nysenate.gov/pdf/bills/2025/S3009C)
- [Form IT-201-I, Instructions for Form IT-201 — rate schedules and the tax computation worksheets](https://www.tax.ny.gov/pdf/current_forms/it/it201i.pdf)

</details>

### `payroll-005` — NY 2025, $1,000.00

```text
  your figure                 $986.06
  this engine                 -$13.94
  gap                       $1,000.00
  the household        headOfHousehold, age 35, children aged 3, $42,000.00 wages
```

**1. Empire State child credit — $1,000.00, not taken**  
*ARITHMETIC* — $986.06 is this engine's answer plus exactly $1,000.00, which is this return's Empire State child credit. It is refundable, so it is not capped at the tax.

*This return carries 21 note(s) from the engine about things a caller would otherwise get wrong. They are omitted here because the gap is explained above; `--json` carries them.*

*This harness defaulted 4 field(s) on this row — pension treated as 0; socialSecurity treated as 0; longTermCapitalGains treated as 0; taxExemptInterest treated as 0. Where that matters the gap is this harness's silence rather than your engine's answer.*

<details><summary>The documents behind this state-year</summary>

- [N.Y. Tax Law § 601 — imposition of tax, and (d) the tax table benefit recapture](https://www.nysenate.gov/legislation/laws/TAX/601)
- [N.Y. Tax Law § 606(b) — household credit; § 606(d) — earned income credit](https://www.nysenate.gov/legislation/laws/TAX/606)
- [N.Y. Tax Law § 606(c-1) — the Empire State child credit, as amended by S.3009-C, Part C, § 2](https://www.nysenate.gov/legislation/laws/TAX/606)
- [Form IT-213, Claim for Empire State Child Credit, and its instructions](https://www.tax.ny.gov/pdf/current_forms/it/it213i.pdf)
- [N.Y. Tax Law § 614 — standard deduction; § 616 — New York exemptions](https://www.nysenate.gov/legislation/laws/TAX/614)
- [N.Y. Tax Law § 612(c)(3) — government pensions excluded in full; § 612(c)(3-a) — the $20,000 pension and annuity exclusion](https://www.nysenate.gov/legislation/laws/TAX/612)
- [Form IT-201-I, Instructions for Form IT-201, line 29](https://www.tax.ny.gov/pdf/current_forms/it/it201i.pdf)
- [New York FY2026 Enacted Budget, S.3009-C — rate reductions for 2026 and 2027](https://legislation.nysenate.gov/pdf/bills/2025/S3009C)
- [Form IT-201-I, Instructions for Form IT-201 — rate schedules and the tax computation worksheets](https://www.tax.ny.gov/pdf/current_forms/it/it201i.pdf)

</details>

### `payroll-010` — VA 2025, $503.13

```text
  your figure               $2,869.93
  this engine               $2,366.80
  gap                         $503.13
  the household        marriedFilingJointly, age 40, spouse 41, $65,000.00 wages
```

**1. this engine's answer for marriedFilingSeparately, not marriedFilingJointly**  
*RECOMPUTED* — The same household filed as marriedFilingSeparately owes $2,869.93, which is the figure supplied. Both answers are correct computations; they are answers to different questions.

*This return carries 20 note(s) from the engine about things a caller would otherwise get wrong. They are omitted here because the gap is explained above; `--json` carries them.*

*This harness defaulted 4 field(s) on this row — pension treated as 0; socialSecurity treated as 0; longTermCapitalGains treated as 0; taxExemptInterest treated as 0. Where that matters the gap is this harness's silence rather than your engine's answer.*

<details><summary>The documents behind this state-year</summary>

- [Va. Code § 58.1-320 — imposition of tax; the rate schedule, unchanged since 1990](https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-320/)
- [Va. Code § 58.1-321 — exemptions and exclusions; the filing threshold](https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-321/)
- [Va. Code § 58.1-322.03 — Virginia taxable income: the standard deduction, the personal and aged/blind exemptions, and the age deduction](https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-322.03/)
- [Va. Code § 58.1-339.8 — the Credit for Low Income Individuals and the Virginia earned income credit](https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-339.8/)
- [2025 Form 760 Resident Individual Income Tax Instructions](https://www.tax.virginia.gov/sites/default/files/vatax-pdf/2025-760-instructions.pdf)
- [Virginia Tax — Filing Status, and the spouse tax adjustment of up to $259](https://www.tax.virginia.gov/filing-status)
- [Virginia Tax — the refundable earned income tax credit, raised from 15% to 20% for tax years 2025 and 2026](https://www.tax.virginia.gov/news/virginias-new-refundable-earned-income-tax-credit-what-you-need-know)
- [House Bill 1600 (2025 Appropriation Act), Item 4-14 — the standard deduction amounts and the 20% refundable earned income credit](https://budget.lis.virginia.gov/amendment/2025/1/HB1600/Introduced/CR/4-14/3c/)
- [HHS poverty guidelines — the cliff the Credit for Low Income Individuals sits on](https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines)

</details>

### `payroll-008` — TX 2025, $500.00

```text
  your figure                 $500.00
  this engine                   $0.00
  gap                         $500.00
  the household        single, age 40, $60,000.00 wages
```

**1. Texas does not tax this income, and $500.00 was charged**  
*ARITHMETIC* — Texas levies no individual income tax on wage income for 2025. The whole of $500.00 is charged to a filer who does not owe it.

*This return carries 2 note(s) from the engine about things a caller would otherwise get wrong. They are omitted here because the gap is explained above; `--json` carries them.*

*This harness defaulted 4 field(s) on this row — pension treated as 0; socialSecurity treated as 0; longTermCapitalGains treated as 0; taxExemptInterest treated as 0. Where that matters the gap is this harness's silence rather than your engine's answer.*

<details><summary>The documents behind this state-year</summary>

- [Tex. Const. art. VIII, § 24-a](https://statutes.capitol.texas.gov/Docs/CN/htm/CN.8.htm)

</details>

### `payroll-012` — IL 2025, -$495.00

```text
  your figure               $2,828.93
  this engine               $3,323.93
  gap                        -$495.00
  the household        single, age 40, $60,000.00 wages, $10,000.00 tax-exempt interest
```

**1. Illinois addition for other states' municipal interest — not applied**  
*RECOMPUTED* — Setting taxExemptInterest to 0 and running the whole return again returns $2,828.93, which is the figure supplied. With the $10,000.00 of tax-exempt interest it is $3,323.93, and the line item it moves is Illinois addition for other states' municipal interest $10,000.00. This is a re-run of the engine rather than a rate times an amount, so a graduated schedule and any credit phase-out underneath it are already in it.

*This return carries 10 note(s) from the engine about things a caller would otherwise get wrong. They are omitted here because the gap is explained above; `--json` carries them.*

*This harness defaulted 3 field(s) on this row — pension treated as 0; socialSecurity treated as 0; longTermCapitalGains treated as 0. Where that matters the gap is this harness's silence rather than your engine's answer.*

<details><summary>The documents behind this state-year</summary>

- [35 Ill. Comp. Stat. 5/201(b) — 4.95% individual rate](https://www.ilga.gov/legislation/ilcs/fulltext.asp?DocName=003500050K201)
- [35 Ill. Comp. Stat. 5/204 — exemption allowance and its income limitation](https://www.ilga.gov/legislation/ilcs/fulltext.asp?DocName=003500050K204)
- [Illinois Department of Revenue — Form IL-1040 instructions](https://tax.illinois.gov/forms/incometax/individual.html)
- [35 Ill. Comp. Stat. 5/203(a)(2)(F) — the subtraction for retirement income](https://www.ilga.gov/legislation/ilcs/fulltext.asp?DocName=003500050K203)
- [Illinois Department of Revenue Publication 120 — Retirement Income](https://tax.illinois.gov/research/publications.html)
- [35 Ill. Comp. Stat. 5/244 — child tax credit, added by Public Act 103-0592](https://www.ilga.gov/legislation/ilcs/fulltext.asp?DocName=003500050K244)

</details>

### `payroll-007` — VA 2025, $257.50

```text
  your figure               $3,180.90
  this engine               $2,923.40
  gap                         $257.50
  the household        single, age 40, $65,000.00 wages
```

**1. the top rate of 5.75% applied to all taxable income**  
*ARITHMETIC* — $3,180.90 is 5.75% of the whole $55,320.00 of taxable income. The schedule has 4 bands and charges $2,923.40 before credits. A single rate per state is the commonest way to be wrong about a graduated state.

*This return carries 19 note(s) from the engine about things a caller would otherwise get wrong. They are omitted here because the gap is explained above; `--json` carries them.*

*This harness defaulted 4 field(s) on this row — pension treated as 0; socialSecurity treated as 0; longTermCapitalGains treated as 0; taxExemptInterest treated as 0. Where that matters the gap is this harness's silence rather than your engine's answer.*

<details><summary>The documents behind this state-year</summary>

- [Va. Code § 58.1-320 — imposition of tax; the rate schedule, unchanged since 1990](https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-320/)
- [Va. Code § 58.1-321 — exemptions and exclusions; the filing threshold](https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-321/)
- [Va. Code § 58.1-322.03 — Virginia taxable income: the standard deduction, the personal and aged/blind exemptions, and the age deduction](https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-322.03/)
- [Va. Code § 58.1-339.8 — the Credit for Low Income Individuals and the Virginia earned income credit](https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-339.8/)
- [2025 Form 760 Resident Individual Income Tax Instructions](https://www.tax.virginia.gov/sites/default/files/vatax-pdf/2025-760-instructions.pdf)
- [Virginia Tax — Filing Status, and the spouse tax adjustment of up to $259](https://www.tax.virginia.gov/filing-status)
- [Virginia Tax — the refundable earned income tax credit, raised from 15% to 20% for tax years 2025 and 2026](https://www.tax.virginia.gov/news/virginias-new-refundable-earned-income-tax-credit-what-you-need-know)
- [House Bill 1600 (2025 Appropriation Act), Item 4-14 — the standard deduction amounts and the 20% refundable earned income credit](https://budget.lis.virginia.gov/amendment/2025/1/HB1600/Introduced/CR/4-14/3c/)
- [HHS poverty guidelines — the cliff the Credit for Low Income Individuals sits on](https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines)

</details>

### `payroll-002` — GA 2026, $245.70

```text
  your figure               $2,491.20
  this engine               $2,245.50
  gap                         $245.70
  the household        single, age 40, $60,000.00 wages
```

**1. this engine's answer for tax year 2025, not 2026**  
*RECOMPUTED* — Running the same household at year 2025 returns $2,491.20, which is the figure supplied. The 2026 answer is $2,245.50. A parameter that did not get re-read is not a reading of the law; it is last year's reading, and the law moved.

*This return carries 14 note(s) from the engine about things a caller would otherwise get wrong. They are omitted here because the gap is explained above; `--json` carries them.*

*This harness defaulted 4 field(s) on this row — pension treated as 0; socialSecurity treated as 0; longTermCapitalGains treated as 0; taxExemptInterest treated as 0. Where that matters the gap is this harness's silence rather than your engine's answer.*

<details><summary>The documents behind this state-year</summary>

- [O.C.G.A. § 48-7-20(a.1) — flat rate and its scheduled reductions](https://law.justia.com/codes/georgia/title-48/chapter-7/article-2/section-48-7-20/)
- [Georgia HB 1437 (2022) — the flat tax, standard deduction, and repeal of the personal exemption](https://www.legis.ga.gov/legislation/61207)
- [Georgia Department of Revenue — tax tables and rate schedule](https://dor.georgia.gov/tax-tables-georgia-tax-rate-schedule)
- [O.C.G.A. § 48-7-27(a)(5) and (a)(5.1) — the retirement income exclusion and the military retirement exclusion](https://law.justia.com/codes/georgia/title-48/chapter-7/article-2/section-48-7-27/)
- [Georgia Department of Revenue — Retirement Income Exclusion, and the IT-511 Schedule 1 worksheets](https://dor.georgia.gov/retirement-income-exclusion)
- [Georgia HB 463 (2026) — 4.99% for 2026 and annual cuts to 3.99%, the $70,000 exclusion from 2027, and the 2026-2028 overtime and cash tip exclusions](https://www.legis.ga.gov/legislation/70350)
- [O.C.G.A. § 48-7-27.1 — eligible itemizer defined, and the $300-per-taxpayer credit, for tax years from 2024](https://law.justia.com/codes/georgia/title-48/chapter-7/article-2/section-48-7-27-1/)
- [Georgia Department of Revenue — IT-511 Individual Income Tax Booklet, the eligible itemizer tax credit at Form 500 line 19](https://dor.georgia.gov/document/document/2025-it-511-individual-income-tax-booklet/download)

</details>

### `payroll-011` — MO 2025, -$134.50

```text
  your figure               $3,100.00
  this engine               $3,234.50
  gap                        -$134.50
  the household        single, age 45, $90,000.00 wages
```

**UNEXPLAINED.** Nothing in this engine's own output accounts for this gap: it is not a credit, a surtax, a local tax, a filing status, an earlier year's parameters, the top rate on the whole base, or a rounding difference. This is the kind of disagreement that needs the statute read, and it is the kind most likely to be a real defect in one of the two engines.

<details open><summary>What this engine said about the return itself — all 24 notes, because nothing above explained the gap</summary>

- MISSOURI DEDUCTS A SHARE OF THE FEDERAL BILL AND THE CHART IS A CLIFF. § 143.171.2 gives 35% of the federal income tax at $25,000 or less of MISSOURI adjusted gross income, 25% to $50,000, 15% to $100,000, 5% to $125,000 and nothing above — one percentage for the whole bill, chosen by one number. So one dollar of income at a boundary moves the entire deduction down a step: at $100,000 the deduction falls by 10% of a federal bill of about $13,000, which is $61.94 OF MISSOURI TAX ON ONE DOLLAR. Pass `federal.incomeTaxBeforeRefundableCredits` — Form 1040 line 22 plus the Form 8960 net investment income tax. Omitting it makes the Missouri answer too HIGH by the whole deduction.
- AND THE FEDERAL REFUNDABLE CREDITS COME BACK OFF IT, as they do in Alabama. The MO-1040 line 9 worksheet starts from the federal tax and subtracts the earned income credit, the refundable American Opportunity credit and the net premium tax credit, floored at zero. So `federal.earnedIncomeCredit` RAISES Missouri tax — by the credit times the step times the Missouri rate, which is at most about 1.6 cents in the dollar against Alabama’s 5 — where the six states here that match the federal credit read the same field to lower theirs.
- ONE THING I COULD NOT READ, AND WHAT IT WOULD COST. § 143.171.2’s own table says "If the Missouri GROSS income on the return is", and chapter 143 defines Missouri ADJUSTED gross income (§ 143.121) and never defines Missouri gross income. The Form MO-1040 line 13 worksheet and its instructions read the chart against Missouri adjusted gross income, and PolicyEngine-US does the same; this package follows the form. The two figures differ only where a Missouri modification is large, which from 2025 means a capital gain: a single filer with $90,000 of wages and $60,000 of gain is in the 15% step on Missouri AGI of $90,000 and would be in the 0% step on a gross figure of $150,000, so the other reading would cost them $2,995.50 of deduction and $140.79 of tax. The worksheet lines would settle it and I could not reach them.
- THE WORKING FAMILY TAX CREDIT IS 20% OF THE FEDERAL EARNED INCOME CREDIT AND IT ZEROES MOST LOW-INCOME MISSOURI RETURNS. § 143.177, Form MO-WFTC, non-refundable and capped at the Missouri tax: a head of household with one teenager on $35,000 of wages owes $264.22 before it and nothing after. It is barred to a separate return, barred to a filer claimed as a dependent elsewhere, and lost ENTIRELY above $4,400 of investment income — which is a conformity date rather than a figure Missouri chose, because § 143.177.3(1) reads § 32 as it stood on 1 January 2021 and the pre-ARPA disqualified income limit is several times lower than today’s. A Missouri filer with $5,000 of investment income keeps the whole federal credit and loses the whole state one, and the figure that does it appears in no statute: the Department of Revenue indexes it and prints it on the form.
- SO THE FEDERAL EARNED INCOME CREDIT IS READ TWICE, IN OPPOSITE DIRECTIONS, AND MISSOURI IS THE ONLY STATE HERE THAT DOES THAT. The MO-1040 line 9 worksheet subtracts it from the federal income tax deduction, which raises Missouri tax by the share times 4.7%; § 143.177 then matches 20% of the same credit, which lowers it by four or five times as much. The net is a cut. A model that found only the first half would have the sign right and the size wrong by a factor of five.
- THE BOUNDARY BELONGS TO THE STEP BELOW IT. § 143.171.2 reads "twenty-five thousand dollars or less" and then "in excess of twenty-five thousand dollars", so a filer standing exactly on $25,000, $50,000, $100,000 or $125,000 of Missouri AGI keeps the HIGHER share. That is Connecticut’s § 12-703 convention and the opposite of the one Connecticut’s own pension phase-out uses on the same return; this package reads the words rather than the chart in both states.
- THE CAP WAS DEAD LAW UNTIL 2025 AND THE CAPITAL GAINS EXEMPTION REVIVED IT. The deduction may not exceed $5,000 on a single taxpayer’s return or $10,000 on a combined one, and the chart above had made that unreachable: 35% of a federal bill is $5,000 only when the bill is $14,286, which no filer with $25,000 or less of Missouri AGI pays, and the other steps need $40,000, $66,667 or $200,000 of federal tax against lower Missouri income still. HB 594 then took capital gains out of MISSOURI AGI — the very figure the chart reads — so a filer with $4,000,000 of gain and $20,000 of wages now sits in the 35% step with a federal bill near $900,000. The cap is the only thing between them and $315,000 of deduction.
- MISSOURI IS THE FIRST STATE TO EXEMPT CAPITAL GAINS OUTRIGHT, AND IT REACHES SHORT-TERM GAIN. § 143.121.3(14), added by HB 594 and retroactive to 1 January 2025, subtracts "one hundred percent of all income reported as a capital gain for federal income tax purposes". Pass the whole of Form 1040 line 7 as `netCapitalGain`, short-term included — the same field Maryland reads for its 2% surtax, where the classes that state exempts have to be removed first. A $1,000,000 long-term gain costs a Missouri resident $0 of state tax and a Massachusetts resident $50,000.
- AND THE EXEMPTION IS WORTH MORE THAN THE GAIN, because it is a subtraction in arriving at MISSOURI AGI rather than a deduction from it. Missouri AGI is what the federal income tax deduction’s chart is read against, so taking the gain out can move the filer down a step and hand them a larger share of a federal bill the gain itself made bigger. A single filer with $90,000 of wages and $60,000 of gain goes from no federal tax deduction at $150,000 to 15% of one at $90,000.
- THE EIGHT BRACKETS ARE ONE NUMBER. § 143.011.5 indexes the schedule as a block, so the bands are the first-bracket width times one through seven — $1,313 for 2025 and $1,348 for 2026 — the first band is taxed at ZERO, and 4.7% begins at $9,436. The tax on everything below that is $262.86 at every income, where a flat 4.7% would be $443.49: THE WHOLE GRADUATED SCHEDULE IS WORTH $180.63, which is Virginia’s $257.50 and Alabama’s $40 in a third state. $175.94 for 2025.
- THE BRACKETS DO NOT DOUBLE ON A JOINT RETURN. They do not change at all — § 143.011 sets one schedule for every filing status, so the $180.63 discount is the same figure for a couple as for a single filer where Alabama’s $40 becomes $80. Missouri’s combined return (§ 143.031) computes each spouse’s tax on their own share and would run the schedule twice; this package applies it once to the return’s taxable income, which is the lower-allowance reading and is what PolicyEngine-US does. A two-earner couple who split their income evenly on a combined return may therefore be up to $180.63 better off than this figure.
- THE STANDARD DEDUCTION IS THE FEDERAL ONE, by § 143.131 and not by coincidence — $16,100, $24,150 and $32,200 for 2026, the additional amounts for age and blindness included. So the OBBBA’s increase cut Missouri tax with no Missouri legislation, exactly as it did in Arizona. The OBBBA senior, tips, overtime and car-loan deductions are NOT part of it: they are below-the-line deductions outside § 63(c), Missouri has not adopted any of them, and a Missouri filer keeps the whole of that income in the state base.
- MISSOURI HAS NO PERSONAL OR DEPENDENT EXEMPTION LEFT. § 143.161 defines both by reference to the federal exemption, which § 151(d)(5) set to zero and the OBBBA made permanent — so they are zero and a dependent is worth nothing on a Missouri return. The ONE survivor is the $1,400 addition for a head of household or a qualifying surviving spouse, which is written in Missouri’s own words and appears on MO-1040 line 15.
- A RETIREE’S SOCIAL SECURITY EATS THEIR PUBLIC PENSION EXEMPTION. Form MO-A Part 3 Section A caps the public pension deduction at the maximum Social Security benefit — $47,633 for 2025 — and then SUBTRACTS the Social Security deduction the same person took in Section C. So $70,000 of public pension alone deducts $47,633, and the same $70,000 as $40,000 of pension plus $30,000 of taxable benefit deducts $40,000: $7,633 less, on identical income, in a state that taxes neither kind of it. That is Maryland’s construction from the other direction — Maryland charges the GROSS benefit against its exclusion, Missouri charges the deduction actually taken. Pass public retired pay as `retirement.filer.governmentPension`.
- THE PRIVATE PENSION DEDUCTION DISAGREES WITH IT ABOUT THE SAME DOLLARS. Section B gives $6,000 a person and withdraws it DOLLAR FOR DOLLAR as Missouri AGI LESS the taxable Social Security rises above $25,000 ($32,000 joint, $16,000 separate) — so the benefit that destroyed the public pension exemption protects the private one, on one form. Dollar for dollar is Virginia’s age deduction shape and has the same consequence: inside the band the marginal rate is DOUBLE the statutory one, 9.4% in a 4.7% state, and the deduction is gone by $31,000 for a single filer with one $6,000 pension. Pass pensions, 401(k) and 403(b) draws as `retirement.filer.employerPlanPension` or `definedContributionPlan` and IRA distributions as `iraDistributions`; all three are Section B income.
- SOCIAL SECURITY IS EXEMPT FROM 62 AND THE INCOME TEST IS GONE. § 143.125, as SB 190 (2023) left it, deducts the whole taxable benefit for a person who has reached 62 by 31 December, with no income limit from tax year 2024 — and Social Security DISABILITY has no age test at all. Below 62 an ordinary retirement benefit is fully taxable in Missouri. Pass `taxableSocialSecurity` with the ages; where the two people on a return differ in age the taxable part is split in proportion to the gross benefits each received, which is the only split a return carries.
- MILITARY RETIRED PAY IS EXEMPT IN FULL, at any age, with no cap, and OUTSIDE the public pension ceiling that federal, state and local retired pay share. § 143.124.9. Pass it as `retirement.filer.militaryRetirement` and not as `governmentPension`, which would cap it at $47,633 and charge Social Security against it.
- A FIFTH OF BUSINESS INCOME COMES OFF. § 143.022 deducts 20% of the income from a sole proprietorship or a share of a partnership or S corporation, at every income, with no cap — which is the opposite shape from Ohio’s, where the first $250,000 is deducted in full and the excess is charged a flat 3%. $250,000 of Schedule C profit deducts $50,000 in Missouri and all of it in Ohio. Pass it as `businessIncome`.
- NOT MODELLED: the Kansas City and St. Louis earnings taxes, 1% each. Both cities charge 1% of gross earnings — of every resident wherever they work, and of every non-resident for work performed inside the city — with no deduction, no exemption and no reference to this return. For a Kansas City resident earning $60,000 that is $600 a year against about $2,050 of Missouri tax, so a model that omits it is low by nearly a quarter of the total. They are not in this package’s locality registry yet.
- NOT MODELLED: the Missouri property tax credit (§ 135.010), the long-term care insurance deduction, the health care sharing ministry deduction, the qualified health insurance premium subtraction and the $8,000 MOST 529 subtraction. The property tax credit is the largest and is worth up to $1,100 to an elderly or disabled filer; supply it yourself, and put the 529 and health premium figures in `subtractions`. Also not modelled: the NET PREMIUM TAX CREDIT, which the MO-1040 line 9 worksheet subtracts from the federal tax alongside the earned income credit and the refundable American Opportunity credit — a filer with marketplace coverage who received more premium tax credit than they were entitled to is too LOW here by the share times that excess.
- THE ZERO BRACKET AND § 143.021 ARE TWO COPIES OF ONE THRESHOLD. § 143.021 says there is no tax where taxable income falls below the first bracket, and § 143.011 taxes that first bracket at 0% — so the statute states the same rule twice and this engine implements the bracket, which is the one that also produces the right answer one dollar above it. The two cannot disagree while the first rate is zero, and if a future General Assembly makes it positive they will.
- THE TOP RATE IS 4.7% FOR BOTH YEARS AND IT WAS NOT A FORECAST. § 143.011.4 allows up to ten further 0.1-point reductions, one a year, each conditioned on general revenue growth of $175,000,000 over the highest of the three preceding fiscal years. The condition was not met for 2026: the Department of Revenue’s 2026 withholding formula, published 1 November 2025, carries 4.7%. A flat-tax replacement for the whole schedule has been introduced repeatedly and, as of this package’s publication, has not been enacted — the live proposal is a constitutional amendment for the ballot rather than a statute.
- THIS PACKAGE STARTS MISSOURI FROM FEDERAL AGI, which is what MO-1040 line 1 asks for. Missouri’s own additions and subtractions live on Form MO-A Part 1 — out-of-state municipal bond interest and state tax refunds up, United States obligation interest and the items listed above down. Supply the ones this package does not compute through `additions` and `subtractions`.
- 5 figures were supplied and spent on nothing: `federalDeductions`, `filerAge`, `socialSecurityAndMedicarePaid`, `earnedIncome`, `retirement`. Every figure in this result — and every other note in it — is identical to the one this return would have had without them. That is MEASURED rather than looked up: the 2025 Missouri return was computed again without each field and the answers compared. It does NOT mean Missouri has no rule that reads the field, because a rule can need two fields together and the other one may be the one that is missing — Ohio reads `earnedIncome` only once `city` is supplied as well. It means nothing on THIS return moved, so a caller who went and looked the figures up bought no change in the answer by it.

</details>

*This harness defaulted 4 field(s) on this row — pension treated as 0; socialSecurity treated as 0; longTermCapitalGains treated as 0; taxExemptInterest treated as 0. Where that matters the gap is this harness's silence rather than your engine's answer.*

<details><summary>The documents behind this state-year</summary>

- [Mo. Rev. Stat. § 143.091 — terms used in the Missouri income tax have the same meaning as in the Internal Revenue Code: ROLLING conformity, and the reason § 143.177’s separate January 1, 2021 reference to § 32 has to be written out](https://revisor.mo.gov/main/OneSection.aspx?section=143.091)
- [Mo. Rev. Stat. § 143.011 — the rate schedule and its top-rate reductions: 4.95% for 2023, 4.8% for 2024 and 4.7% from 2025, with further 0.1-point cuts conditioned on general revenue growth](https://revisor.mo.gov/main/OneSection.aspx?section=143.011)
- [Mo. Rev. Stat. § 143.021 — "no tax on taxable income, when": the tax is zero below the first bracket, which the 0% first band already produces](https://revisor.mo.gov/main/OneSection.aspx?section=143.021)
- [Mo. Rev. Stat. § 143.171 — the federal income tax deduction: a percentage of the federal bill chosen by Missouri adjusted gross income, capped at $5,000 on a single taxpayer’s return and $10,000 on a combined return](https://revisor.mo.gov/main/OneSection.aspx?section=143.171)
- [Mo. Rev. Stat. § 143.121 — Missouri adjusted gross income; subsection 3(14), added by HB 594 (2025), subtracts 100% of all income reported as a capital gain for federal income tax purposes](https://www.revisor.mo.gov/main/OneSection.aspx?section=143.121&bid=57543)
- [Missouri HB 594 (2025), signed 10 July 2025 — the capital gains exemption for individuals, retroactive to tax year 2025, with a trigger extending it to corporations once the top individual rate reaches 4.5%](https://www.senate.mo.gov/BillTracking/Bills/BillInformation?year=2025&billid=4957943)
- [Mo. Rev. Stat. § 143.124 — the pension and Social Security deductions: the public pension ceiling is the maximum Social Security benefit, the private pension deduction is $6,000 per person withdrawn against an income allowance, and military retired pay is exempt in full](https://revisor.mo.gov/main/OneSection.aspx?section=143.124)
- [Mo. Rev. Stat. § 143.125 — the Social Security deduction; SB 190 (2023) removed the income test from tax year 2024](https://revisor.mo.gov/main/OneSection.aspx?section=143.125)
- [Mo. Rev. Stat. § 143.131 — the Missouri standard deduction IS the federal one, so every federal change to it is a Missouri change with no Missouri legislation](https://revisor.mo.gov/main/OneSection.aspx?section=143.131)
- [Mo. Rev. Stat. § 143.161 — exemptions: the personal and dependent exemptions are defined by reference to the federal ones and are therefore zero, and the $1,400 addition for a head of household or qualifying surviving spouse is not](https://www.revisor.mo.gov/main/OneSection.aspx?section=143.161)
- [Mo. Rev. Stat. § 143.177 — the Missouri working family tax credit: 20% of the federal earned income credit from tax year 2024, non-refundable, barred to a separate return, and computed under § 32 as it stood on 1 January 2021, which is what makes its investment income limit a pre-ARPA figure the Department of Revenue prints on Form MO-WFTC and nowhere else](https://revisor.mo.gov/main/OneSection.aspx?section=143.177)
- [Missouri Department of Revenue — Working Family Tax Credit FAQ: the match, the qualifications and the investment income limit, $4,400 for 2025](https://dor.mo.gov/faq/taxation/individual/missouri-working-family-tax-credit.html)
- [Mo. Rev. Stat. § 143.022 — the business income deduction, 20% from 2023](https://revisor.mo.gov/main/OneSection.aspx?section=143.022)
- [Missouri Department of Revenue — 2026 Missouri Withholding Tax Formula: the bracket table ($1,348 steps to $9,436, then 4.7%) and the standard deductions of $16,100, $24,150 and $32,200](https://dor.mo.gov/forms/Withholding%20Formula_2026.pdf)
- [Missouri Department of Revenue — Pension FAQs: the public pension exemption is capped at the maximum Social Security benefit, $47,633 for 2025, and is REDUCED by any Social Security or Social Security disability deduction claimed](https://dor.mo.gov/faq/taxation/individual/pension.html)
- [Missouri Department of Revenue — Form MO-A, Individual Income Tax Adjustments: Part 3 Section A public pensions, Section B private pensions, Section C Social Security](https://dor.mo.gov/forms/MO-A_2025.pdf)

</details>

### `payroll-009` — MD 2025, -$0.37

```text
  your figure               $5,786.41
  this engine               $5,786.78
  gap                          -$0.37
  the household        single, age 40, $80,000.00 wages, Howard County
```

**1. $0.37 — a rounding difference, not a reading of the law**  
*ARITHMETIC* — The two figures differ by less than a dollar. States differ on whether the filer rounds to the dollar, at which line, and in which direction; New Mexico's Department changed its own rule after 2023. Worth settling once, and not worth settling per household.

*This return carries 20 note(s) from the engine about things a caller would otherwise get wrong. They are omitted here because the gap is explained above; `--json` carries them.*

*This harness defaulted 4 field(s) on this row — pension treated as 0; socialSecurity treated as 0; longTermCapitalGains treated as 0; taxExemptInterest treated as 0. Where that matters the gap is this harness's silence rather than your engine's answer.*

<details><summary>The documents behind this state-year</summary>

- [Md. Code, Tax-Gen. § 10-105 — state income tax rates, including the 6.25% and 6.5% brackets added by HB 352](https://law.justia.com/codes/maryland/tax-general/title-10/subtitle-1/section-10-105/)
- [2026 Maryland Employer Withholding Guide — the $3,350 / $6,700 standard deduction for tax year 2026](https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/instructions/withholding/2026/withholding-guide.pdf)
- [Maryland HB 411 (2026) fiscal note — would have raised the deduction to $4,100; died in committee, and states current law as $3,350](https://mgaleg.maryland.gov/2026RS/fnotes/bil_0001/hb0411.pdf)
- [Md. Code, Tax-Gen. § 10-211 — exemptions, and § 10-211(c), the exemption amount chart by federal AGI](https://law.justia.com/codes/maryland/tax-general/title-10/subtitle-2/part-iii/section-10-211/)
- [Md. Code, Tax-Gen. § 10-217 — the standard deduction, flat and indexed from tax year 2025](https://law.justia.com/codes/maryland/tax-general/title-10/subtitle-2/part-iv/section-10-217/)
- [Md. Code, Tax-Gen. § 10-209 — the pension exclusion: the definition of "employee retirement system", the age and disability tests, and the dollar-for-dollar reduction for Social Security and railroad retirement benefits](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gtg&section=10-209&enactments=false)
- [Maryland Pension Exclusion Computation Worksheet (13A) — line 3 is the total benefits received, Tier I and Tier II, whether or not any part reached federal AGI](https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/forms/worksheets/Pension-Exclusion-Worksheet.pdf)
- [Md. Code, Tax-Gen. § 10-207(q) — the military retirement income subtraction, and (nn), the centenarian subtraction](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gtg&section=10-207&enactments=false)
- [Comptroller of Maryland — Technical Bulletin No. 51, senior citizens and Maryland income tax](https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/legal-publications/technical-bulletins/tb-51.pdf)
- [Md. Code, Tax-Gen. § 10-704 — the earned income credit, state and county](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gtg&section=10-704&enactments=false)
- [Md. Code, Tax-Gen. § 10-754 — the senior tax credit](https://law.justia.com/codes/maryland/tax-general/title-10/subtitle-7/section-10-754/)
- [Chapter 604 of the 2025 Laws of Maryland (HB 352) — new brackets, the capital gains surtax, the itemized deduction limit and the flat standard deduction](https://mgaleg.maryland.gov/2025RS/Chapters_noln/CH_604_hb0352e.pdf)
- [Comptroller of Maryland — tax alert on the 2025 changes to the standard and itemized deductions and to state and local rates](https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/legal-publications/alerts/tax-alert-changes-to-standard-and-itemized-deductions-and-to-state-and-local-income-tax-rates-from-the-2025-legislative-session.pdf)
- [HHS poverty guidelines — the cliff the Maryland poverty level credit sits on](https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines)
- [Maryland 2025 Resident Tax Forms and Instructions — Form 502, the exemption chart, the local rate chart and the credit worksheets](https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/instructions/2025/resident-booklet.pdf)

</details>

## Where the two engines agree

**1 of 12 households agree to the cent.** Listed because an audit that reports only disagreements tells a buyer nothing about how much of their product it actually exercised.

- `payroll-001` — VA 2025, $2,923.40

## What this tool cannot do

- **It cannot tell you which engine is right.** It names what explains a gap, not who is wrong. Several findings above are statements about which of two correct computations answers the question you asked.
- **Its input schema is narrow on purpose.** Sixteen columns, four required. A household whose income this schema cannot express is answered on the income it can, and every defaulted field is named on the row it affected.
- **It explains a gap; it does not find every gap.** It looks for the ways a tax engine is wrong that leave an arithmetic trace. A product that is wrong in a way that happens to land on no line item of this return is reported as unexplained, which is the right answer and not a useful one.
- **Nine states levy no individual income tax on wage income** and are correct at zero. A row for one of them that agrees proves nothing about the other 42.

---

Engine: `us-state-tax`, 42 states and 1,033 local income taxes, every figure mapped to the document it came from. The written audit — the half that reads the statute on the gaps this tool could not explain, and says which engine is wrong — is priced in `OFFER.md`.
