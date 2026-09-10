/**
 * Ohio — the state whose rate schedule is not a function.
 *
 * Every other state in this package charges a tax that rises continuously with
 * income. Ohio's does not. O.R.C. § 5747.02(A)(3) prints three rows for 2025:
 *
 * ```text
 * $0 - $26,050         0.000%
 * $26,050 - $100,000   $342.00 plus 2.750% of the excess over $26,050
 * over $100,000        $2,394.32 plus 3.125% of the excess over $100,000
 * ```
 *
 * and the constants in the second and third rows are charged **in full on the
 * first dollar of the band**. A filer with `$26,050` of Ohio taxable nonbusiness
 * income owes nothing; one with `$26,050.01` owes `$342.00`. That is a **`$342`
 * tax on one cent of income** — the largest step an ordinary Ohio wage earner
 * can walk into, and it sits at an income two thirds of the way down the
 * distribution, not at the top of it.
 *
 * The `$342` is a fossil. Before 2019 Ohio taxed the bottom of its schedule at
 * 0.495% and up; when the legislature zeroed those bands it kept the constants
 * they had accumulated, and the accumulation has been re-based twice since —
 * `$360.69` for 2024, `$342.00` for 2025, `$332.00` from 2026.
 *
 * ## The second discontinuity is three months old and nobody re-based it
 *
 * HB 96 (signed 30 June 2025) cut the top rate from 3.5% to 3.125% for 2025 and
 * lowered the `$26,050` constant from `$360.69` to `$342.00` — but left the
 * `$100,000` constant at `$2,394.32`, which is exactly what `$360.69` chained
 * to: `$360.69 + 2.75% x $73,950 = $2,394.32`. Against the new constant the
 * same arithmetic gives `$2,375.63`. So the printed 2025 table steps a **second**
 * time, by `$18.69`, at `$100,000`:
 *
 * ```text
 * $100,000.00   $342.00 + 2.75% x $73,950      =  $2,375.63
 * $100,000.01   $2,394.32 + 3.125% x $0.01     =  $2,394.32
 * ```
 *
 * Four independent transcriptions of the 2025 booklet agree on both constants,
 * which is what settles it: this package implements the table as printed rather
 * than the smooth schedule the drafter probably meant. Modelling the three rows
 * as ordinary marginal brackets — which is what every rate table that reports
 * "Ohio: 0% / 2.75% / 3.125%" invites — understates a filer at `$60,000` by the
 * whole `$342`.
 *
 * ## 2026 is a flat tax with a cliff in it
 *
 * HB 96 finished the flattening: from 2026 there is one rate above `$26,050` and
 * no `$100,000` step. The constant is re-based to `$332.00` and stays.
 * "Ohio is a flat 2.75% state" is now true of the rate and still false of the
 * tax: the schedule is `$0` up to `$26,050` and `$332 + 2.75%` above it.
 *
 * ## Two taxes on one return, at two unrelated rates
 *
 * Ohio splits its own tax base in half. **Business income** — Schedule C,
 * Schedule F and active Schedule E — is deducted up to `$250,000`
 * (`$125,000` married filing separately) and the excess is taxed at a **flat 3%**,
 * while everything else runs up the schedule above. The consequences run both
 * ways and neither is visible in a rate table:
 *
 * ```text
 * $250,000 of business income and nothing else   Ohio tax:      $0.00
 * $250,000 of wages, single filer                Ohio tax:  $7,022.45
 * ```
 *
 * That is the largest gap between two filers with identical incomes anywhere in
 * this package, and it is deliberate policy rather than an artifact.
 *
 * ## The exemption is a staircase, and it is measured on a figure Ohio invented
 *
 * `$2,400` per exemption up to `$40,000`, `$2,150` to `$80,000`, `$1,900` above
 * it, and **nothing at all** from `$750,000` (2025) or `$500,000` (2026) — a
 * cliff HB 96 added. The income it is read against is Ohio **modified** AGI:
 * Ohio AGI with the business income deduction added back. So the pass-through
 * owner above, whose Ohio AGI is zero, is tested at `$250,000` and gets the
 * `$1,900` step rather than the `$2,400` one.
 *
 * ## What the rate table leaves out is bigger than what it contains
 *
 * 679 Ohio municipalities levy an income tax of their own, on a base with no
 * line on the IT 1040 behind it. A Columbus resident earning `$60,000` owes
 * Ohio `$1,216.50` and Columbus `$1,500.00`: **the municipal tax is 23% larger
 * than the state one**, and it is the larger of the two at every income below
 * `$126,408.32`. Pass `city` and `qualifyingWages` — see `localities/ohio.ts`.
 */
import type { CreditStep, StateIncomeTaxDefinition } from '../definition.js';
import type { BaseAmountBand } from '../definition.js';
import { byStatus, byStatusOf, uniform } from './helpers.js';
import type { Citation } from '../types.js';

const CITATIONS: readonly Citation[] = [
  {
    title: 'O.R.C. § 5747.02 — rates, the $26,050 zero band and the base amounts above it',
    url: 'https://codes.ohio.gov/ohio-revised-code/section-5747.02',
  },
  {
    title: 'O.R.C. § 5747.025 — personal and dependent exemptions, stepped by modified adjusted gross income',
    url: 'https://codes.ohio.gov/ohio-revised-code/section-5747.025',
  },
  {
    title: 'O.R.C. § 5747.022 — the $20 income-based exemption credit',
    url: 'https://codes.ohio.gov/ohio-revised-code/section-5747.022',
  },
  {
    title: 'O.R.C. § 5747.05 — the joint filing credit and the senior citizen credit',
    url: 'https://codes.ohio.gov/ohio-revised-code/section-5747.05',
  },
  {
    title: 'O.R.C. § 5747.055 — the retirement income credit',
    url: 'https://codes.ohio.gov/ohio-revised-code/section-5747.055',
  },
  {
    title: 'O.R.C. § 5747.71 — the Ohio earned income credit, 30% of the federal credit',
    url: 'https://codes.ohio.gov/ohio-revised-code/section-5747.71',
  },
  {
    title: 'Am. Sub. H.B. 96 of the 136th General Assembly — the 2025 rate cut and the 2026 flat rate',
    url: 'https://www.legislature.ohio.gov/legislation/136/hb96',
  },
  {
    title: 'Ohio IT 1040 / SD 100 instruction booklet — the rate table, the exemption chart and the Schedule of Credits',
    url: 'https://tax.ohio.gov/individual/resources/annual-tax-rates',
  },
];

/**
 * The zero band's ceiling, and the constant charged the moment it is crossed.
 *
 * Both are exported because the cliff they describe is the single most
 * surprising number this package produces and the tests assert it directly.
 */
export const OH_ZERO_BAND_CEILING = 26_050;

/** The base amount at the top of the zero band, by year. */
export const OH_BASE_AMOUNT: ReadonlyMap<number, number> = new Map([
  [2024, 360.69],
  [2025, 342],
  [2026, 332],
]);

/**
 * The `$100,000` constant, unchanged since 2023 and no longer chained to the row
 * below it. `$360.69 + 2.75% x $73,950` is `$2,394.315`, which is where it came
 * from; `$342.00 + 2.75% x $73,950` is `$2,375.63`, which is what it would be if
 * HB 96 had re-based it.
 */
export const OH_TOP_BASE_AMOUNT_2025 = 2_394.32;

/** What the 2025 top constant would be if it had been re-based with the lower one. */
export const OH_TOP_BASE_AMOUNT_CHAINED_2025 = 342 + 0.0275 * (100_000 - 26_050);

function bands(year: number): readonly BaseAmountBand[] {
  const base = OH_BASE_AMOUNT.get(year) ?? 0;
  if (year >= 2026) {
    // HB 96's flat rate: one row above the zero band, no $100,000 step.
    return [
      { upTo: OH_ZERO_BAND_CEILING, base: 0, rate: 0 },
      { upTo: Infinity, base, rate: 0.0275 },
    ];
  }
  return [
    { upTo: OH_ZERO_BAND_CEILING, base: 0, rate: 0 },
    { upTo: 100_000, base, rate: 0.0275 },
    { upTo: Infinity, base: OH_TOP_BASE_AMOUNT_2025, rate: 0.03125 },
  ];
}

/**
 * The exemption chart of § 5747.025(A), as the staircase it is. The same steps
 * apply on every filing status — Ohio does not double a threshold for a joint
 * return anywhere on this form — so the joint amount comes from *counting two
 * exemptions*, not from a wider band.
 */
function exemptionSteps(year: number): readonly CreditStep[] {
  return [
    { upTo: 40_000, amount: 2_400 },
    { upTo: 80_000, amount: 2_150 },
    // HB 96 added the top step; before 2025 the $1,900 ran to infinity. The
    // statute reads "$750,000 or more", so the band below it ends one cent
    // short rather than one dollar short — a return is filed in whole dollars,
    // but the engine is not told that and $749,999.50 is not "or more".
    { upTo: (year >= 2026 ? 500_000 : 750_000) - 0.01, amount: 1_900 },
    { upTo: Infinity, amount: 0 },
  ];
}

/** § 5747.055(B) Table 2 — the retirement income credit, six steps to $200. */
const RETIREMENT_CREDIT_STEPS: readonly CreditStep[] = [
  { upTo: 500, amount: 0 },
  { upTo: 1_500, amount: 25 },
  { upTo: 3_000, amount: 50 },
  { upTo: 5_000, amount: 80 },
  { upTo: 8_000, amount: 130 },
  { upTo: Infinity, amount: 200 },
];

/**
 * § 5747.05(E)(1) — the joint filing credit percentage, banded on Ohio modified
 * AGI **less exemptions**, which is IT 1040 line 5 with the business income
 * deduction added back.
 */
const JOINT_FILING_STEPS: readonly CreditStep[] = [
  { upTo: 25_000, amount: 0.2 },
  { upTo: 50_000, amount: 0.15 },
  { upTo: 75_000, amount: 0.1 },
  { upTo: Infinity, amount: 0.05 },
];

const NOTES: readonly string[] = [
  'Ohio\'s rate schedule is DISCONTINUOUS and this is not a rounding artifact. O.R.C. § 5747.02(A)(3) charges a flat constant the moment Ohio taxable nonbusiness income clears $26,050 — $342.00 for 2025, $332.00 from 2026 — on top of 2.75% of the excess. A filer at $26,050 owes $0 and a filer at $26,050.01 owes $342.00. Reading the printed table as ordinary marginal brackets, which is what "Ohio: 0% / 2.75% / 3.125%" invites, understates every Ohio filer above the threshold by the whole constant.',
  'For 2025 the table steps a SECOND time. HB 96 lowered the $26,050 constant from $360.69 to $342.00 but left the $100,000 constant at $2,394.32, which is what $360.69 chained to. $342.00 + 2.75% x $73,950 is $2,375.63, so crossing $100,000 costs a further $18.69 on one cent of income. This package implements the constants as printed rather than the smooth schedule they were probably meant to describe.',
  'Ohio taxes business income separately and at a flat rate. The first $250,000 ($125,000 married filing separately) of Ohio business income is DEDUCTED from Ohio AGI under § 5747.01(A)(31) and the excess is taxed at a flat 3% — so a filer with $250,000 of business income and nothing else owes no Ohio income tax at all, where a wage earner with the same $250,000 owes $7,022.45. Pass businessIncome (Schedule IT BUS line 10, before the deduction); it is treated as zero when absent, which overstates the tax for anyone with Schedule C, Schedule F or active Schedule E income.',
  'The personal exemption is a staircase on Ohio MODIFIED adjusted gross income — Ohio AGI with the business income deduction added back, § 5747.01(JJ) — not on federal AGI and not on Ohio AGI. $2,400 per exemption to $40,000, $2,150 to $80,000, $1,900 above it, and nothing from $750,000 (2025) or $500,000 (2026), a cliff HB 96 added. The add-back is what makes the measure worth naming: a pass-through owner whose whole business income is deducted has an Ohio AGI near zero and is still tested at the full amount.',
  'Ohio has NO standard deduction and no state itemized deduction. The exemption above is the only thing between Ohio AGI and the tax base, which is why a $26,050 threshold that sounds generous reaches an ordinary wage: a single filer with no dependents crosses it at $28,450 of Ohio AGI.',
  'The $20 exemption credit is worth $20 to almost nobody. § 5747.022 allows it per exemption below $30,000 of modified AGI, and § 5747.02 charges nothing on the first $26,050 of taxable income — which IS modified AGI less exemptions for a filer with no business income. So the credit needs modified AGI above $28,450 and below $30,000, a window $1,550 wide, and a SECOND exemption moves the lower end to $30,850 and closes it. A childless single filer in that band keeps $20; a joint return, a head of household with a child, or anyone with a dependent never keeps a cent of it.',
  'The joint filing credit is a percentage of the tax AFTER every other non-refundable credit (20% below $25,000 of modified AGI less exemptions, then 15%, 10% and 5%), capped at $650, and it is allowed only where EACH spouse has at least $500 of qualifying income — Ohio AGI less interest, dividends, capital gains and rental income, per spouse. No federal figure splits a joint return between the two people on it, so pass bothSpousesHaveQualifyingIncome; absent, the credit is computed as zero, which is right for a single-earner couple and wrong for most joint returns.',
  'The 20% row of that credit is unreachable. It needs modified AGI less exemptions at or below $25,000, which for a couple with no business income IS their taxable nonbusiness income — below the $26,050 zero band, so the tax the 20% would be a share of is zero. Business income cannot rescue it either: the flat 3% only reaches income above the $250,000 deduction, so any couple with business tax has a modified AGI ten times the row\'s ceiling. The highest share this credit is ever actually paid at is 15%.',
  'The Ohio earned income credit is 30% of the federal credit and it is NON-REFUNDABLE, which is the whole of what is wrong with quoting the 30%: a filer whose Ohio tax is already zero — which is every filer with the credit\'s own income and no business income, because $26,050 of the base is untaxed — gets nothing from it. Ohio\'s 30% is the second largest published state match in the country and one of the least often paid.',
  'Ohio does not tax Social Security or railroad retirement benefits at all, and deducts them on the Schedule of Adjustments. Not modelled here: pass them through `subtractions`. The retirement income credit that IS modelled is worth at most $200 and is gone above $100,000 of modified AGI less exemptions.',
  '679 Ohio municipalities levy an income tax of their own, on qualifying wages rather than on any line of this return, at 0.45% to 3.00%. For most Ohio filers it is LARGER than the state tax: a Columbus resident on $60,000 owes Ohio $1,216.50 and Columbus $1,500.00, and the state tax does not overtake a 2.5% municipal one until $126,408.32 of income. Pass `city` and `qualifyingWages`. Omitting them computes the state half of an Ohio return.',
  '214 of Ohio\'s 600-odd school districts levy an income tax of their own at 0.25% to 2.00%, on a separate SD 100 return and on top of everything else. Pass `schoolDistrict` — the four-digit number. The base is one of two and they are not variations of each other: a TRADITIONAL district (146) taxes modified AGI less exemptions, which ADDS THE BUSINESS INCOME DEDUCTION BACK, so it reaches income the Ohio return itself does not; an EARNED INCOME district (68) taxes wages and self-employment earnings alone with no deductions and no exemptions at all. So Ohio taxes one paycheck on three different bases, and a 401(k) deferral is inside the municipal one (box 5) and outside the school district one (box 1).',
  'Not modelled: the child care and dependent care credit, the lump sum retirement and lump sum distribution credits, the adoption credit, the nonchartered school and scholarship donation credits, the campaign contribution credit, the displaced worker training credit, the resident credit for tax paid to another STATE (§ 5747.05(B)), and the Ohio 529 contribution deduction. Also not modelled: part-year and nonresident returns, which apportion on the IT NRC rather than computing the full-year figure here.',
];

const NOTES_2026: readonly string[] = [
  'PROVISIONAL: for 2026 the rate schedule below is statutory — HB 96 wrote "$332.00 plus 2.75% of the amount in excess of $26,050" into § 5747.02(A)(3) — but the $26,050 zero band and the exemption chart are indexed by the tax commissioner each August under § 5747.02(A)(5) and § 5747.025(A), and the 2026 IT 1040 booklet carrying the indexed figures is not published yet. Both have held since 2022, so the carried-forward figures are the most likely ones; if the band moves, the $332.00 constant will be restated with it, because the constant exists to keep the schedule continuous with the band below.',
];

export function ohio(year: number): StateIncomeTaxDefinition | undefined {
  if (year !== 2025 && year !== 2026) return undefined;
  const steps = exemptionSteps(year);
  return {
    code: 'OH',
    name: 'Ohio',
    year,
    status: year >= 2026 ? 'provisional' : 'published',
    base: 'federalAdjustedGrossIncome',
    rate: {
      kind: 'baseAmountSchedule',
      name: 'Ohio nonbusiness income tax',
      bands: bands(year),
    },
    // § 5747.01 gives no standard deduction and no state itemized deduction.
    // The exemption below is the only subtraction between Ohio AGI and the base.
    deduction: { kind: 'none' },
    exemption: {
      // The top-step figures, kept so a test can check them against the chart
      // that generates them; `perExemptionSteps` is what the engine reads.
      perFiler: byStatus({ single: 2_400, joint: 4_800, separate: 2_400, headOfHousehold: 2_400 }),
      perDependent: 2_400,
      perExemptionSteps: byStatusOf<readonly CreditStep[]>({
        single: steps,
        joint: steps,
        separate: steps,
        headOfHousehold: steps,
      }),
      stepsMeasuredOn: 'stateModifiedAdjustedGrossIncome',
      // A qualifying surviving spouse files on the joint schedule but has no
      // spouse to claim an exemption for — the same rule Maryland has.
      filersClaimed: byStatus({
        single: 1,
        joint: 2,
        separate: 1,
        headOfHousehold: 1,
        qualifyingSurvivingSpouse: 1,
      }),
    },
    businessIncome: {
      name: 'Ohio business income tax (flat 3% above the business income deduction)',
      deductionCap: byStatus({
        single: 250_000,
        joint: 250_000,
        separate: 125_000,
        headOfHousehold: 250_000,
      }),
      rate: 0.03,
    },
    retirementIncomeCredit: {
      name: 'Retirement income credit',
      steps: RETIREMENT_CREDIT_STEPS,
      incomeLimit: 100_000,
    },
    seniorCredit: {
      name: 'Senior citizen credit',
      minimumAge: 65,
      amount: uniform(50),
      // § 5747.05(C) allows one $50 per return however many filers are 65.
      amountBothSpouses: uniform(50),
      onePerReturn: true,
      incomeLimit: uniform(100_000),
      incomeMeasure: 'stateModifiedAdjustedGrossIncomeLessExemptions',
    },
    exemptionCredit: {
      name: 'Exemption credit',
      perFiler: byStatus({ single: 20, joint: 40, separate: 20, headOfHousehold: 20 }),
      perDependent: 20,
      incomeLimit: 30_000,
      incomeMeasure: 'stateModifiedAdjustedGrossIncome',
    },
    jointFilingCredit: {
      name: 'Joint filing credit',
      steps: JOINT_FILING_STEPS,
      cap: 650,
      perSpouseIncomeThreshold: 500,
      // HB 96 disallows it above the same modified AGI at which the personal
      // exemption disappears.
      incomeLimit: year >= 2026 ? 500_000 : 750_000,
    },
    earnedIncomeCredit: {
      name: 'Ohio earned income credit',
      matchRate: 0.3,
      refundable: false,
    },
    notes: year >= 2026 ? [...NOTES_2026, ...NOTES] : NOTES,
    citations: CITATIONS,
  };
}
