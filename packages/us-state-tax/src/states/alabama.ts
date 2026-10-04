/**
 * Alabama — the one state in this package whose tax base contains the FEDERAL
 * TAX BILL, so that a federal tax cut is an Alabama tax increase.
 *
 * Six states here match the federal earned income credit, and when Congress
 * raises it their tax falls. Alabama is wired the other way round and to
 * everything at once. Form 40 line 12 deducts the federal income tax paid —
 * Ala. Code § 40-18-15(a)(3) allows "taxes paid or accrued within the taxable
 * year, including income taxes ... imposed by authority of the United States" —
 * so every dollar the federal government stops charging is a dollar more of
 * Alabama taxable income, at 5% for anybody above `$3,000` of it.
 *
 * Nothing in Alabama has to happen for that. No Alabama form changes, no
 * Alabama rate moves and no Alabama legislature sits. The OBBBA tips and
 * overtime deductions cut federal tax for a waiter in Mobile and raised his
 * Alabama tax by 5% of the cut; the `$2,200` child tax credit costs an Alabama
 * family `$110` of state tax; and the federal earned income credit — the one
 * figure in `FederalBasis` that six other states read to CUT a filer's tax —
 * raises Alabama's, because Alabama's worksheet subtracts the refundable
 * credits from the deduction. **The same input moves the answer in opposite
 * directions in two states and nothing in its name says which.**
 *
 * ## Four more things no rate table shows
 *
 * **The 5% top rate begins at `$3,000`.** § 40-18-5's schedule — 2% on the
 * first `$500`, 4% on the next `$2,500`, 5% above `$3,000`, doubled for a joint
 * return — has not moved since 1935. The tax on the first `$3,000` is
 * `$110` whatever the filer earns, and the whole graduated part is worth `$40`
 * against a flat 5% — `$80` on a joint return. Alabama is a flat 5% state with
 * a `$40` discount, and the three-row table every guide prints is a table of
 * that discount.
 *
 * **The standard deduction is a staircase, and it rounds the opposite way from
 * Connecticut's.** § 40-18-15(b) reduces it by `$25` per `$500` of Alabama AGI
 * above `$25,500` for a single filer, to a floor of `$2,500`. There is no "or
 * fraction thereof", so the first `$499` above the threshold cost nothing —
 * where Connecticut's § 12-702, which has the clause, charges the whole step on
 * the first dollar. Two states, one shape, opposite conventions.
 *
 * **The dependent exemption is a cliff chart with one column for five filing
 * statuses.** `$1,000` a dependent at or below `$50,000` of Alabama AGI, `$500`
 * to `$100,000`, `$300` above it — and because there is one column, two single
 * parents at `$50,000` each claim `$1,000` a child and the same two people
 * filing jointly on `$100,000` claim `$500`. The rate schedule doubles for a
 * joint return; this does not.
 *
 * **Retirement is decided by the TYPE OF PLAN, which no federal figure
 * records.** A defined benefit payment is exempt in full, at any age, with no
 * cap — Ala. Admin. Code r. 810-3-19-.04 reads IRC § 414(j) and reaches
 * non-qualified plans, SERPs and excess benefit plans too — while a defined
 * contribution distribution is taxable above `$6,000` and only at 65. A 1099-R
 * from a pension plan and one from a 401(k) land on the same line of the same
 * federal form; in Alabama they are `$2,760` a year apart on `$60,000`.
 *
 * ## And overtime, three different ways in three years
 *
 * Alabama exempted overtime before Congress did and stopped the month Congress
 * started.
 *
 * | when | what is exempt | how much |
 * | --- | --- | --- |
 * | 2024 – 30 Jun 2025 | the WHOLE overtime wage, from gross income (Act 2023-421) | uncapped |
 * | 1 Jul – 31 Dec 2025 | nothing in Alabama | — |
 * | 2026 – 2028 | the PREMIUM only, as a deduction (Act 2026 HB 527) | `$1,000` |
 *
 * The 2023 act excluded the entire wage paid for hours over 40; HB 527 adopts
 * the federal definition — overtime "that exceeds an employee's regular rate of
 * pay" — which is the half in time-and-a-half. So the same ten hours of
 * overtime at `$30` against a `$20` regular rate are `$300` of Alabama
 * exclusion in 2025 and `$100` of Alabama deduction in 2026, and the federal
 * § 225 cap on the same `$100` is `$12,500`.
 */
import type { ConditionalNote, StateIncomeTaxDefinition } from '../definition.js';
import { byStatus, byStatusOf } from './helpers.js';
import type { Bracket, Citation } from '../types.js';

/**
 * § 40-18-5. The single column is also the separate and head-of-family column;
 * the joint column is exactly twice it, and a qualifying surviving spouse files
 * on the joint schedule.
 *
 * **Alabama has four filing statuses, not five.** Form 40's boxes are single,
 * married filing jointly, married filing separately and head of family — the
 * ADOR rejection-code specification lists lines 1 to 4 and no more — so a
 * federal qualifying surviving spouse has no Alabama column of their own. This
 * package answers for the status on the joint schedule, which is the package's
 * convention and PolicyEngine-US's too, and says so in a note.
 */
const SINGLE_BANDS: readonly Bracket[] = [
  { rate: 0.02, upTo: 500 },
  { rate: 0.04, upTo: 3_000 },
  { rate: 0.05, upTo: Infinity },
];

const JOINT_BANDS: readonly Bracket[] = [
  { rate: 0.02, upTo: 1_000 },
  { rate: 0.04, upTo: 6_000 },
  { rate: 0.05, upTo: Infinity },
];

const SCHEDULES = byStatusOf<readonly Bracket[]>({
  single: SINGLE_BANDS,
  joint: JOINT_BANDS,
  separate: SINGLE_BANDS,
  headOfHousehold: SINGLE_BANDS,
});

const CITATIONS: readonly Citation[] = [
  {
    title: 'Ala. Code § 40-18-5 — the rate schedule, 2%/4%/5%, unchanged since 1935',
    url: 'https://law.justia.com/codes/alabama/title-40/chapter-18/article-1/section-40-18-5/',
  },
  {
    title:
      'Ala. Code § 40-18-15 — deductions for individuals: subsection (a)(3) allows federal income tax, FICA and self-employment tax as taxes paid; subsection (b) is the optional standard deduction and its staircase',
    url: 'https://law.justia.com/codes/alabama/title-40/chapter-18/article-1/section-40-18-15/',
  },
  {
    title:
      'Ala. Code § 40-18-19 — exemptions: (a)(8) the personal exemption, (a)(9) the dependent exemption chart, (a)(13) the $6,000 defined contribution exclusion at 65',
    url: 'https://law.justia.com/codes/alabama/title-40/chapter-18/article-1/section-40-18-19/',
  },
  {
    title:
      'Ala. Admin. Code r. 810-3-19-.04 — Defined Benefit Plans: a payment under a plan as IRC § 414(j) defines one is exempt in full, non-qualified plans and SERPs included',
    url: 'https://www.revenue.alabama.gov/wp-content/uploads/2021/12/810-3-19-.04.pdf',
  },
  {
    title:
      'Alabama Act 2022-292 (SB 19) — the 2022 increases: +$1,000 joint and +$500 single, head of family and separate on the standard deduction, and the dependent exemption threshold from $20,000 to $50,000',
    url: 'https://legiscan.com/AL/text/SB19/2022',
  },
  {
    title:
      'Alabama Act 2023-421 (HB 217), as amended by Act 2024-437 — overtime pay excluded from gross income for overtime paid from 1 January 2024 and before 30 June 2025',
    url: 'https://comptroller.alabama.gov/wp-content/uploads/2024/01/Overtime-Exemption-Legislation-House-Bill-217.pdf',
  },
  {
    title:
      'Alabama HB 527 (2026), signed April 2026 — a deduction for up to $1,000 of qualified overtime compensation for tax years 2026 through 2028, on the federal definition of the premium above the regular rate',
    url: 'https://governor.alabama.gov/newsroom/2026/04/governor-ivey-signs-bill-to-provide-tax-relief-to-hardworking-alabamians/',
  },
  {
    title:
      'Alabama Department of Revenue — Form 40 individual income tax return and instructions: line 11 is the standard-or-itemized choice, line 12 the federal income tax deduction, line 13 the personal exemption and line 14 the dependent exemption',
    url: 'https://www.revenue.alabama.gov/wp-content/uploads/2026/01/25f40bk.pdf',
  },
  {
    title:
      'Alabama Department of Revenue — 2025 Form 40 rejection codes: the personal exemption must equal $1,500 (single or separate) or $3,000 (joint or head of family), for filing statuses 1 to 4',
    url: 'https://www.revenue.alabama.gov/wp-content/uploads/2026/01/2025F40RejectionCodes.pdf',
  },
];

const NOTES: readonly string[] = [
  'ALABAMA IS A FUNCTION OF THE FEDERAL BILL. Form 40 line 12 deducts the federal income tax paid, and it is deducted by EVERY filer rather than only by itemizers. So a federal tax cut is an Alabama tax increase of 5% of the cut, with no Alabama legislation involved: a $2,200 child tax credit costs an Alabama family $110 of state tax, and the OBBBA tips and overtime deductions cost 5% of whatever they save. Pass `federal.incomeTaxBeforeRefundableCredits` — Form 1040 line 22 plus the Form 8960 net investment income tax. Omitting it makes the Alabama answer TOO HIGH by 5% of the whole federal bill.',
  "AND THE FEDERAL REFUNDABLE CREDITS COME BACK OFF IT. Alabama's Federal Income Tax Deduction Worksheet subtracts the earned income credit, the refundable child tax credit and the refundable part of the American Opportunity credit, because they are money received rather than tax paid. So `federal.earnedIncomeCredit` RAISES Alabama tax, where the six states here that match the federal credit read the same field to lower theirs. Pass `federal.additionalChildTaxCredit` and `federal.refundableAmericanOpportunityCredit` with it; a filer whose refundable credits exceed their tax gets a deduction of zero, never a negative one.",
  'ONE THING I COULD NOT READ, AND WHAT IT WOULD COST. § 40-18-15 places the federal income tax inside subsection (a)(3) — the paragraph for "taxes paid or accrued", with FICA and self-employment tax — and subsection (b) grants the optional standard deduction "in lieu of" subsection (a). Form 40 nevertheless prints the federal income tax on line 12, below the line 11 standard-or-itemized choice and additional to it, with its own instruction to attach the federal return. This package follows the form, as PolicyEngine-US does. If the statutory reading is the right one, every Alabama filer modelled here who takes the standard deduction is too LOW by 5% of their federal income tax. The Form 40 instructions for line 12 would settle it.',
  'THE 5% RATE BEGINS AT $3,000 OF TAXABLE INCOME ($6,000 joint), and § 40-18-5 has said so since 1935. The tax on that first $3,000 is $110, and on the first $6,000 of a joint return $220, at every income above it, forever — but measured against a flat 5% the whole graduated schedule is worth only $40 to a single, separate or head-of-family filer and $80 to a joint return. Alabama is a flat 5% state with a $40 discount.',
  'THE STANDARD DEDUCTION IS A STAIRCASE THAT ROUNDS DOWN. § 40-18-15(b) reduces it by $25 for each $500 of Alabama AGI above $25,500 for a single filer — $175 per $500 joint, $135 per $500 head of family, $88 per $250 separate — to a floor of $2,500 ($5,000 joint). There is no "or fraction thereof" clause, so the first $499 above the threshold cost nothing and the step arrives on the five-hundredth dollar. Connecticut has the clause and charges the whole step on the first dollar: the two conventions are a step of deduction apart at every boundary of either chart.',
  'EVERY COLUMN REACHES ITS FLOOR AT $35,500 OF ALABAMA AGI ($17,750 separate), in exactly twenty steps, which is the arithmetic that makes the five columns one provision. The separate column is the exception that proves it: its threshold and increment are half the joint figures but its reduction is $88 where half of $175 is $87.50, so nineteen steps have withdrawn $1,672 of a $1,750 range and the twentieth is worth $78 rather than $88. The floor absorbs the difference, which is why no published chart shows it.',
  'THE DEPENDENT EXEMPTION IS ONE CHART FOR FIVE FILING STATUSES: $1,000 each at or below $50,000 of Alabama AGI, $500 above $50,000 and at or below $100,000, $300 above $100,000 — § 40-18-19(a)(9), on thresholds Act 2022-292 raised from $20,000. Both boundaries are inclusive in the statute’s own words ("equal to or less than"), so a filer at exactly $50,000 keeps the $1,000. And because there is one chart, two single parents at $50,000 each claim $1,000 a child where the same two people filing jointly on $100,000 claim $500.',
  'RETIREMENT TURNS ON THE PLAN, NOT THE PERSON OR THE MONEY. A defined benefit payment is exempt IN FULL at any age with no cap — Ala. Admin. Code r. 810-3-19-.04, which reads IRC § 414(j) and reaches non-qualified plans, SERPs and excess benefit plans — while a defined contribution distribution is taxed above $6,000 per person and only from age 65. So at 62 a $60,000 pension is free and a $60,000 401(k) draw costs $2,760.00, and at 65 the same draw costs $2,460.00 — the $6,000 exclusion is worth exactly $300. Nothing on a federal return tells the two apart: both arrive on a 1099-R and both land on line 5b. Pass the pension as `retirement.filer.employerPlanPension` and the 401(k), 403(b) or 457(b) draw as `retirement.filer.definedContributionPlan`.',
  'ALABAMA DOES NOT TAX SOCIAL SECURITY AT ALL, and unlike Maryland it does not charge the benefit against anything else either: pass `taxableSocialSecurity` and it is subtracted outright. A retiree’s exempt income is also outside ALABAMA AGI, which is the figure the standard deduction staircase and the dependent chart are read against — so a retiree on a $60,000 pension keeps the maximum standard deduction and the $1,000 dependent exemption that a wage earner on the same money has lost.',
  'ALMOST EVERY ALABAMA WAGE EARNER SHOULD ITEMIZE, because § 40-18-15(a)(3) allows the FICA and self-employment taxes they paid. Social Security and Medicare on $32,680 of wages is $2,500, which is the single filer’s standard deduction floor, so above roughly that wage the Alabama Schedule A beats the standard deduction on payroll tax alone — before any mortgage interest, property tax or charity. Supply the Schedule A total through `stateItemizedDeductions`; this package takes the larger of the two and adds the federal income tax deduction to whichever it takes.',
  'NOT MODELLED: the 2025 half-year overtime exclusion. Act 2023-421 excluded the WHOLE overtime wage of a full-time hourly employee from Alabama gross income for overtime paid before 30 June 2025 (from 1 October 2024 for salaried non-exempt employees), and it was not renewed. For tax year 2025 that is a figure only the payroll records contain — overtime paid in the first half of the year — so supply it through `subtractions`. From 2026 Alabama’s own overtime relief is the HB 527 deduction modelled here, which is a different and much smaller thing: the PREMIUM above the regular rate rather than the whole wage, and capped at $1,000.',
  'NOT MODELLED: Alabama’s municipal occupational licence taxes. Birmingham charges 1% of gross wages, Gadsden 2%, and about two dozen other municipalities something in between — on gross compensation, with no deduction, no exemption and no reference to this return. An Alabama city worker computed here is too low by the whole of it. They are not in this package’s locality registry yet.',
  'THIS PACKAGE STARTS ALABAMA FROM FEDERAL AGI. Ala. Code § 40-18-14.2 builds Alabama AGI from its own list of income sources and its own list of deductions, and the exclusions that make the difference — Social Security, defined benefit pensions, the $6,000 at 65 — are modelled here explicitly. Where a filer has a federal above-the-line deduction Alabama’s list does not contain, the Alabama figure here is too low by it; supply the difference through `additions`.',
];

/**
 * The two notes that are about THIS return rather than about Alabama.
 *
 * Both exist because of the same hazard, and it is the one Alabama introduces to
 * this package: two inputs that no other state reads, each worth thousands of
 * dollars, and a missing one looks exactly like a zero.
 *
 * The engine does not reject an unknown key on `federal`, deliberately — the
 * object is documented as a structural subset of `estimateFederalTax()`'s whole
 * result, so every extra key on it is a federal field the caller spread in
 * rather than a figure this package dropped. That decision is right and it
 * leaves a gap: a caller who writes `incomeTax` for
 * `incomeTaxBeforeRefundableCredits` is told nothing by the guard. So the
 * warning is on the RETURN THAT WOULD BE WRONG instead, which is the only place
 * that can see it.
 */
const CONDITIONAL_NOTES: readonly ConditionalNote[] = [
  {
    relevantWhen: (input) => (input.federal.incomeTaxBeforeRefundableCredits ?? 0) <= 0,
    text:
      'NO FEDERAL INCOME TAX WAS SUPPLIED, so Form 40 line 12 was taken as zero and this Alabama figure is TOO HIGH by 5% of the federal income tax this household owes — $200.80 on a $4,016 federal bill. Pass `federal.incomeTaxBeforeRefundableCredits`: Form 1040 line 22, the tax after non-refundable credits, plus the Form 8960 net investment income tax. A filer who genuinely owes no federal tax can ignore this note; there is no way for the engine to tell the two apart, which is why it is printed whenever the figure is absent or zero.',
  },
  {
    relevantWhen: (input) =>
      (input.retirement?.filer?.employerPlanPension ?? 0) > 0 ||
      (input.retirement?.spouse?.employerPlanPension ?? 0) > 0 ||
      (input.retirementIncome ?? 0) > 0,
    text:
      'A PLAN TYPE WAS ASSUMED. Alabama exempts a DEFINED BENEFIT payment in full at any age and taxes a DEFINED CONTRIBUTION distribution above $6,000 and only from 65, so the two differ by $2,760 a year on $60,000. `employerPlanPension` is read here as defined benefit and `definedContributionPlan` as defined contribution; `retirementIncome` is a household total that cannot say which, so Alabama reads NEITHER half of it and the income stays taxable — the answer that does not flatter the filer. Split it into `retirement.filer` to be told the truth instead of the safe answer.',
  },
];

/**
 * The qualified overtime deduction HB 527 created for 2026 through 2028.
 *
 * It is read off the federal § 225 deduction, which is the only figure a
 * federal-AGI base has for the same dollars — and that is an approximation in
 * one direction: § 225 phases out above `$150,000` of modified AGI and HB 527
 * has no phase-out, so a high-income Alabama filer whose federal deduction was
 * reduced is too high here by 5% of up to `$1,000`. Fifty dollars, named rather
 * than hidden.
 */
const OVERTIME_DEDUCTION_CAP = 1_000;

export function alabama(year: number): StateIncomeTaxDefinition | undefined {
  if (year !== 2025 && year !== 2026) return undefined;
  return {
    code: 'AL',
    name: 'Alabama',
    // Alabama indexes nothing at all. The rate schedule is from 1935; the
    // personal exemption, the standard deduction figures and the dependent
    // exemption chart are where Act 2022-292 left them; the defined benefit
    // exemption is a regulation reading a federal definition. The ONE
    // difference between 2025 and 2026 is the overtime provision, and it
    // differs because one act expired and another was signed.
    status: 'published',
    year,
    base: 'federalAdjustedGrossIncome',
    rate: { kind: 'brackets', byStatus: SCHEDULES },
    deduction: {
      kind: 'phaseOutStaircase',
      maximum: byStatus({ single: 3_000, joint: 8_500, separate: 4_250, headOfHousehold: 5_200 }),
      min: byStatus({ single: 2_500, joint: 5_000, separate: 2_500, headOfHousehold: 2_500 }),
      threshold: byStatus({
        single: 25_500,
        joint: 25_500,
        separate: 12_750,
        headOfHousehold: 25_500,
      }),
      increment: byStatus({ single: 500, joint: 500, separate: 250, headOfHousehold: 500 }),
      reduction: byStatus({ single: 25, joint: 175, separate: 88, headOfHousehold: 135 }),
      cite: 'Ala. Code § 40-18-15(b) — the optional standard deduction, reduced "for each $500" ($250 separate) of adjusted gross income above the threshold, to a figure it may not fall below. There is no "or fraction thereof" clause, so the reduction is taken on whole steps and the first $499 above the threshold cost nothing. Act 2022-292 raised every figure in the subsection in 2022.',
    },
    itemizedDeduction: {
      name: 'Alabama itemized deductions (Schedule A)',
      // Alabama's election is its own: § 40-18-15(b) offers the optional
      // standard deduction "in lieu of" subsection (a)'s deductions and says
      // nothing about what the filer did federally. So a filer who took the
      // federal standard deduction may still itemize in Alabama — which is the
      // common case rather than an edge case, because § 40-18-15(a)(3) allows
      // the FICA and self-employment taxes they paid.
      requiresFederalItemizing: false,
      phaseOutRate: 0,
      phaseOutThreshold: byStatus({
        single: Infinity,
        joint: Infinity,
        separate: Infinity,
        headOfHousehold: Infinity,
      }),
    },
    federalIncomeTaxDeduction: {
      name: 'Federal income tax deduction',
      cite: 'Ala. Code § 40-18-15(a)(3) allows "taxes paid or accrued within the taxable year, including income taxes ... imposed by authority of the United States", and Form 40 line 12 prints it below the line 11 standard-or-itemized choice and additional to it.',
      refundableCreditsCite:
        "Alabama's Federal Income Tax Deduction Worksheet subtracts the refundable federal credits from the federal tax — the earned income credit, the refundable child tax credit and the refundable part of the American Opportunity credit — and floors the result at zero.",
    },
    exemption: {
      // § 40-18-19(a)(8) grants the exemption by filing status and has no
      // § 151(b)-shaped clause for a spouse with no gross income on a separate
      // return: the separate figure is $1,500 and nothing adds to it. Alabama
      // has no aged or blind addition at all, so there is nothing for one to
      // follow.
      separateReturnSpouse: {
        spouse: 'notClaimed',
        agedAndBlind: 'notApplicable',
        cite: 'Ala. Code § 40-18-19(a)(8) grants a flat exemption by filing status — $1,500 single or separate, $3,000 joint or head of family — with no provision adding a spouse to a separate return. Alabama has no aged or blind exemption addition.',
      },
      // Head of family takes the SINGLE rate schedule and the JOINT personal
      // exemption, with a standard deduction of its own between the two. Three
      // different treatments of one filing status on one return.
      perFiler: byStatus({ single: 1_500, joint: 3_000, separate: 1_500, headOfHousehold: 3_000 }),
      // The top step of the chart below, kept to be checked against it by
      // `registry.test.js` rather than by whoever remembered.
      perDependent: 1_000,
      perDependentSteps: [
        { upTo: 50_000, amount: 1_000 },
        { upTo: 100_000, amount: 500 },
        { upTo: Infinity, amount: 300 },
      ],
    },
    planTypeRetirement: {
      name: 'Defined benefit plan payments',
      definedBenefitCite:
        'Ala. Admin. Code r. 810-3-19-.04 — a payment to a retiree or beneficiary under a defined benefit plan as IRC § 414(j) defines one is exempt from Alabama income tax to the extent it is taxable federally, with no cap and no age test; non-qualified defined benefit plans, excess benefit plans and SERPs are included. Government and military retired pay are defined benefit payments.',
      definedContributionName: 'Defined contribution distributions at 65',
      definedContributionCap: 6_000,
      definedContributionAge: 65,
      definedContributionCite:
        'Ala. Code § 40-18-19(a)(13), claimed on Schedule RS — up to $6,000 per person of otherwise taxable distributions from a defined contribution plan, for a person who has reached 65, from tax year 2023.',
    },
    subtractsTaxableSocialSecurity: true,
    // 2025 has no Alabama overtime provision to model: Act 2023-421's exclusion
    // covered only overtime paid before 30 June 2025 and is a payroll figure
    // rather than a return figure, and HB 527's deduction begins in 2026. The
    // field is absent rather than empty, so nothing claims a rule exists.
    ...(year >= 2026
      ? {
          compensationExclusions: [
            { name: 'Qualified overtime compensation', source: 'overtime' as const, cap: OVERTIME_DEDUCTION_CAP },
          ],
        }
      : {}),
    notes: NOTES,
    conditionalNotes: CONDITIONAL_NOTES,
    citations: CITATIONS,
  };
}
