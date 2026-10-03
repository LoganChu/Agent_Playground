/**
 * Connecticut — the state whose published rate table describes the smallest
 * share of what its filers actually pay.
 *
 * Every state's rate table leaves something out. Connecticut's leaves out four
 * separate staircases, three of which are built from the same four words of
 * statute — "**or fraction thereof**" — and all four of which are invisible in
 * any table of Connecticut's seven marginal rates.
 *
 * **1. There is no continuous stretch of the Connecticut income tax above
 * `$30,000`.** The personal exemption is withdrawn `$1,000` at a time for each
 * `$1,000` of Connecticut AGI "or fraction thereof", so one dollar over
 * `$30,000` costs a single filer `$1,000` of exemption and `$45` of tax. It
 * happens again at `$31,000`, and at every thousand to `$45,000`. The 2% phase-
 * out add-back then does it in `$5,000` steps of `$25` from `$56,500`, the
 * personal tax credit does it in `$500` steps from `$15,000`, and the tax
 * recapture does it in `$5,000` steps of `$25`, `$90` and `$50` from
 * `$105,000`, `$200,000` and `$500,000`. A Connecticut filer anywhere between
 * `$15,000` and `$540,000` of income is standing on one staircase or another.
 *
 * **2. The marginal rate in the exemption band is exactly double the statutory
 * rate.** The withdrawal is dollar for dollar, so each `$1,000` of income adds
 * `$2,000` of Connecticut taxable income. A single filer between `$30,000` and
 * `$45,000` is in the 4.5% bracket and pays 9% on the margin — a figure that
 * appears nowhere, because it is two rules meeting.
 *
 * **3. Half of Connecticut's tables scale between filing statuses and half do
 * not, and the two halves look identical.** The rate schedule is one table
 * scaled: single is exactly half of joint, head of household exactly four
 * fifths, separate exactly half. The recapture scales too, with one exception
 * below. The exemption, the add-back's thresholds and the personal credit do
 * not. A single filer's exemption is `$15,000` where half of joint would be
 * `$12,000` — which is the SEPARATE figure — and the add-back starts at
 * `$56,500` where half of joint would be `$50,250`, which is also the separate
 * figure. So the tables that do not scale are the ones where a model that
 * scales them lands on a real Connecticut number belonging to a different
 * filing status, and is therefore wrong without ever looking wrong.
 *
 * The exception is a single row and this file did not have it right until a
 * test written from the statute disagreed with this comment. § 12-700(b)
 * charges a head of household **`$140` for each `$8,000`** in the middle
 * recapture tier, to a maximum of **`$4,200`**, where four fifths of the joint
 * `$180` and `$5,400` would be `$144` and `$4,320`. The first and third tiers
 * do scale, so it is one row rather than a column drafted on a different basis,
 * and it is worth `$120` to a head of household above `$345,000`. The whole
 * recapture such a filer can pay is `$5,320`, not the `$5,440` four fifths of
 * the joint `$6,800` would give. `test/connecticut.test.js` asserts the scaling
 * where it holds and the exact disagreement where it does not.
 *
 * **4. The add-back and the personal tax credit overlap for a single filer and
 * for nobody else.** The credit runs out at `$64,500` of Connecticut AGI and the
 * add-back begins above `$56,500`, so an `$8,000` band of single filers pays
 * both — and because the credit is a percentage of the tax *after* the add-back
 * (CT-1040 Tax Calculation Schedule line 7 adds lines 4, 5 and 6; line 8 applies
 * the Table E decimal to the sum), the add-back is itself discounted by the
 * credit for exactly those filers. For a joint filer the credit ends at
 * `$100,500` and the add-back begins above `$100,500`: the two meet and never
 * overlap. For a head of household they meet at `$78,500`. Only single
 * (`$56,500`–`$64,500`) and separate (`$50,250`–`$52,500`) overlap at all.
 *
 * And **5**, which is the one with a date on it: Connecticut's IRA subtraction
 * is phasing in over four tax years — 25%, 50%, 75%, 100% — so **2026 is the
 * first year a Connecticut retiree's traditional IRA is treated the same as
 * their pension.** The two years this package covers sit on either side of that
 * line, and it is the only Connecticut figure that moves between them.
 *
 * Connecticut has no local income tax of any kind, so unlike Ohio, Maryland,
 * Indiana, Michigan and New York there is nothing below the state here.
 */
import type { StateIncomeTaxDefinition, TaxFractionStep } from '../definition.js';
import { byStatus, byStatusOf } from './helpers.js';
import type { ConditionalNote } from '../definition.js';
import type { Bracket, ByStatus, Citation } from '../types.js';

const CITATIONS: readonly Citation[] = [
  {
    title: 'Conn. Gen. Stat. § 12-700 — imposition of the income tax, rates, and the tax recapture',
    url: 'https://law.justia.com/codes/connecticut/title-12/chapter-229/section-12-700/',
  },
  {
    title: 'Conn. Gen. Stat. § 12-701 — definitions, including Connecticut adjusted gross income and its modifications',
    url: 'https://law.justia.com/codes/connecticut/title-12/chapter-229/section-12-701/',
  },
  {
    title: 'Conn. Gen. Stat. § 12-702 — personal exemption and its withdrawal',
    url: 'https://law.justia.com/codes/connecticut/title-12/chapter-229/section-12-702/',
  },
  {
    title: 'Conn. Gen. Stat. § 12-703 — personal tax credits',
    url: 'https://law.justia.com/codes/connecticut/title-12/chapter-229/section-12-703/',
  },
  {
    title: 'Conn. Gen. Stat. § 12-704e — Connecticut earned income tax credit',
    url: 'https://law.justia.com/codes/connecticut/title-12/chapter-229/section-12-704e/',
  },
  {
    title: 'Form CT-1040 TCS — Tax Calculation Schedule, Tables A to E',
    url: 'https://portal.ct.gov/-/media/drs/forms/2025/income/ct-1040-tcs_1225.pdf',
  },
  {
    title: 'Form CT-1040 instructions — Tax Calculation Schedule line order and Schedule 1 modifications',
    url: 'https://portal.ct.gov/-/media/drs/forms/2025/income/2025-ct-1040-instructions_1225.pdf',
  },
  {
    title: 'Public Act 23-204 § 93 — the pension, annuity and IRA phase-out replacing the former cliff, for tax years from 2024',
    url: 'https://www.cga.ct.gov/2023/act/pa/pdf/2023PA-00204-R00HB-06941-PA.PDF',
  },
  {
    title: 'OLR Report 2025-R-0152 — the IRA subtraction phase-in: 25% in 2023, 50% in 2024, 75% in 2025, 100% from 2026',
    url: 'https://www.cga.ct.gov/2025/rpt/pdf/2025-R-0152.pdf',
  },
];

/**
 * The one schedule, scaled.
 *
 * Conn. Gen. Stat. § 12-700(a)(10) writes the four filing statuses out
 * separately, and every threshold in them is the joint figure times one half
 * (single and separate) or four fifths (head of household). Nothing else in the
 * Connecticut computation scales that cleanly, which is the trap: see the
 * module header and the scaling tests.
 */
const JOINT_THRESHOLDS: readonly number[] = [20_000, 100_000, 200_000, 400_000, 500_000, 1_000_000];
const RATES: readonly number[] = [0.02, 0.045, 0.055, 0.06, 0.065, 0.069, 0.0699];

function schedule(scale: number): readonly Bracket[] {
  return [
    ...JOINT_THRESHOLDS.map((t, i) => ({ upTo: t * scale, rate: RATES[i]! })),
    { upTo: Infinity, rate: RATES[RATES.length - 1]! },
  ];
}

const SCHEDULES: ByStatus<readonly Bracket[]> = byStatusOf<readonly Bracket[]>({
  single: schedule(0.5),
  joint: schedule(1),
  separate: schedule(0.5),
  headOfHousehold: schedule(0.8),
});

/**
 * Table E — the personal tax credit, as a fraction of the tax.
 *
 * Written as the joint column plus a scale, because the four columns are the
 * same 28 rows at four different widths — but the scale here is NOT the rate
 * schedule's. Joint to single is 0.625 at the top of the table (`$24,000` to
 * `$15,000`) and 0.6417 at the bottom (`$100,500` to `$64,500`), so there is no
 * single factor and the columns are stored in full.
 */
function creditSteps(rows: readonly (readonly [number, number])[]): readonly TaxFractionStep[] {
  return rows.map(([from, fraction]) => ({ from, fraction }));
}

const CREDIT_SINGLE = creditSteps([
  [15_000, 0.75], [18_800, 0.7], [19_300, 0.65], [19_800, 0.6], [20_300, 0.55],
  [20_800, 0.5], [21_300, 0.45], [21_800, 0.4], [22_300, 0.35], [25_000, 0.3],
  [25_500, 0.25], [26_000, 0.2], [26_500, 0.15], [31_300, 0.14], [31_800, 0.13],
  [32_300, 0.12], [32_800, 0.11], [33_300, 0.1], [60_000, 0.09], [60_500, 0.08],
  [61_000, 0.07], [61_500, 0.06], [62_000, 0.05], [62_500, 0.04], [63_000, 0.03],
  [63_500, 0.02], [64_000, 0.01], [64_500, 0],
]);

const CREDIT_JOINT = creditSteps([
  [24_000, 0.75], [30_000, 0.7], [30_500, 0.65], [31_000, 0.6], [31_500, 0.55],
  [32_000, 0.5], [32_500, 0.45], [33_000, 0.4], [33_500, 0.35], [40_000, 0.3],
  [40_500, 0.25], [41_000, 0.2], [41_500, 0.15], [50_000, 0.14], [50_500, 0.13],
  [51_000, 0.12], [51_500, 0.11], [52_000, 0.1], [96_000, 0.09], [96_500, 0.08],
  [97_000, 0.07], [97_500, 0.06], [98_000, 0.05], [98_500, 0.04], [99_000, 0.03],
  [99_500, 0.02], [100_000, 0.01], [100_500, 0],
]);

const CREDIT_HEAD_OF_HOUSEHOLD = creditSteps([
  [19_000, 0.75], [24_000, 0.7], [24_500, 0.65], [25_000, 0.6], [25_500, 0.55],
  [26_000, 0.5], [26_500, 0.45], [27_000, 0.4], [27_500, 0.35], [34_000, 0.3],
  [34_500, 0.25], [35_000, 0.2], [35_500, 0.15], [44_000, 0.14], [44_500, 0.13],
  [45_000, 0.12], [45_500, 0.11], [46_000, 0.1], [74_000, 0.09], [74_500, 0.08],
  [75_000, 0.07], [75_500, 0.06], [76_000, 0.05], [76_500, 0.04], [77_000, 0.03],
  [77_500, 0.02], [78_000, 0.01], [78_500, 0],
]);

const CREDIT_SEPARATE = creditSteps([
  [12_000, 0.75], [15_000, 0.7], [15_500, 0.65], [16_000, 0.6], [16_500, 0.55],
  [17_000, 0.5], [17_500, 0.45], [18_000, 0.4], [18_500, 0.35], [20_000, 0.3],
  [20_500, 0.25], [21_000, 0.2], [21_500, 0.15], [25_000, 0.14], [25_500, 0.13],
  [26_000, 0.12], [26_500, 0.11], [27_000, 0.1], [48_000, 0.09], [48_500, 0.08],
  [49_000, 0.07], [49_500, 0.06], [50_000, 0.05], [50_500, 0.04], [51_000, 0.03],
  [51_500, 0.02], [52_000, 0.01], [52_500, 0],
]);

/**
 * The pension, annuity and IRA subtraction staircase — Public Act 23-204 § 93.
 *
 * Before 2024 this was a cliff at the same thresholds: 100% of the subtraction
 * at `$74,999` of federal AGI and none at all at `$75,000`. The Act replaced the
 * cliff with nine steps, which is a genuine improvement and still a staircase —
 * `$2,500` of income at `$77,500` costs a single retiree 15 percentage points of
 * their whole pension subtraction.
 */
const PENSION_NON_JOINT = creditSteps([
  [0, 1], [75_000, 0.85], [77_500, 0.7], [80_000, 0.55], [82_500, 0.4],
  [85_000, 0.25], [87_500, 0.1], [90_000, 0.05], [95_000, 0.025], [100_000, 0],
]);

const PENSION_JOINT = creditSteps([
  [0, 1], [100_000, 0.85], [105_000, 0.7], [110_000, 0.55], [115_000, 0.4],
  [120_000, 0.25], [125_000, 0.1], [130_000, 0.05], [140_000, 0.025], [150_000, 0],
]);

/**
 * The statutory phase-in: 25% for 2023, 50% for 2024, 75% for 2025 and 100%
 * from 2026.
 *
 * Written as the two years this package supports and not as the whole schedule,
 * which the first draft was. The 2023 and 2024 branches are unreachable —
 * `connecticut()` returns `undefined` for every year but 2025 and 2026 — and
 * four numbers nothing can execute are four numbers no test can be wrong about:
 * the mutation audit would have reported every one of them as a survivor, which
 * is exactly what a survivor is for. The full schedule is in the provenance
 * ledger's cite, where it is prose and does not pretend to be code.
 */
function iraPhaseInShare(year: number): number {
  return year >= 2026 ? 1 : 0.75;
}

const NOTES: readonly string[] = [
  'Connecticut has no continuous stretch of income tax above $30,000. Four separate staircases overlap: the personal exemption is withdrawn $1,000 for each $1,000 of Connecticut AGI "or fraction thereof" above $30,000 (single), the personal tax credit steps down in $500 bands, the 2% phase-out add-back steps up $25 per $5,000 above $56,500, and the tax recapture steps up above $105,000. Every one of them is reached by ONE DOLLAR of extra income, not by a proportion of it.',
  'The exemption withdrawal is dollar for dollar, so the marginal rate inside it is exactly double the statutory rate: a single filer between $30,000 and $45,000 of Connecticut AGI is in the 4.5% bracket and pays 9% on the next dollar. A joint filer between $48,000 and $72,000 pays 9% in the same way. This figure appears in no Connecticut table because it is two rules meeting.',
  'Connecticut\'s rate schedule scales exactly between filing statuses — single and separate are half the joint figures, head of household four fifths — and so does the tax recapture, except that a head of household\'s MIDDLE tier is $140 per $8,000 to a maximum of $4,200 where four fifths would be $144 and $4,320. The personal exemption, the add-back thresholds and the personal tax credit do not scale at all, and the single-filer figures a scaling model produces ($12,000 of exemption, a $50,250 add-back threshold) are real Connecticut numbers belonging to a SEPARATE filer. The error therefore survives a plausibility check.',
  'The personal tax credit is a percentage of the tax AFTER the phase-out add-back and the recapture: CT-1040 Tax Calculation Schedule line 7 adds lines 4, 5 and 6, and line 8 applies the Table E decimal to that sum. For the recapture the order is unobservable, because the credit reaches zero far below the income at which recapture begins. For the add-back it is observable for a single filer between $56,500 and $64,500 of Connecticut AGI and for a separate filer between $50,250 and $52,500, and for nobody else: a joint filer\'s credit ends at exactly the income where their add-back begins.',
  'Form CT-1040 TCS calls Table C the "2% Tax Rate Phase-Out Add-Back", and this package does not, because the add-back is not 2% of anything: it is a flat dollar staircase on Connecticut AGI, and the only thing the 2% names is the rate band whose benefit it is withdrawing. It is computed from Connecticut AGI alone and owes nothing to how much of the filer\'s income actually fell in the 2% band. It is a line on the tax, so a filer whose exemptions leave them with no Connecticut taxable income has an add-back computed and nothing to add it to.',
  'The IRA subtraction phases in over four tax years and 2026 is the last of them: 25% of a non-Roth IRA distribution in 2023, 50% in 2024, 75% in 2025 and 100% from 2026. It is the only Connecticut figure that differs between the two years this package covers, and it means 2026 is the first year in which a Connecticut retiree\'s IRA and their pension are treated identically.',
  'Both the pension and annuity subtraction and the IRA subtraction are then multiplied by an income staircase on FEDERAL adjusted gross income — 100% below $75,000 ($100,000 joint), then 85%, 70%, 55%, 40%, 25%, 10%, 5%, 2.5% and nothing at $100,000 ($150,000 joint). Public Act 23-204 put that staircase in place of a cliff at the same threshold for tax years from 2024.',
  'The Social Security benefit adjustment is a cliff and remains one. Below $75,000 of federal AGI ($100,000 for a joint return or a qualifying surviving spouse) Connecticut subtracts the whole federally taxable benefit, so Social Security is untaxed. At the threshold the subtraction is replaced, not tapered, by: taxable benefit less 25% of the lesser of gross benefits and the § 86 combined income excess.',
  'Connecticut has no local income tax of any kind: no county, city, town or school district levies one. A Connecticut return is the whole of a Connecticut resident\'s income tax.',
  'Not modelled: the property tax credit (up to $300 against Connecticut tax for a filer 65 or older or claiming dependants, itself on an income staircase), the Connecticut alternative minimum tax, the teachers\' retirement 50% subtraction (an alternative to the pension and annuity subtraction rather than an addition to it), the 100% military retirement subtraction, the credit for income taxes paid to other jurisdictions, the student loan payment and child tax rebates, the 20% refundable farm and corporation investment tax credit and the $500 family childcare home credit added for 2026, and the Connecticut higher education trust contribution subtraction. Pass any of these through `subtractions`.',
  'New for tax year 2025: a filer eligible for the Connecticut earned income tax credit with at least one qualifying child gets a FLAT $250 on top of the 40% match, once per return however many children there are (CT-1040 line 20a, Schedule CT-EITC). It is not a percentage, so it does not taper with the federal credit: it is a cliff at the income where the Connecticut credit reaches zero, and it is worth the same to a parent at $20,000 of earnings and one at $55,000. This package tests the qualifying child by AGE alone, at 18 or under, because that is what it is given; a household whose only qualifying child is a full-time student under 24 or permanently disabled at any age also qualifies federally and is understated here by $250.',
  'The Connecticut earned income tax credit is 40% of the federal credit and refundable — the joint largest state match in this package alongside New Jersey\'s. It is measured on the federal credit actually allowed, so pass federal.earnedIncomeCredit; omitting it returns no Connecticut credit for a filer who has one.',
];

/**
 * The caveat that applies only above the Social Security threshold.
 *
 * Below it the whole taxable benefit comes out and nothing in the computation
 * reads the combined income excess, so the reconstruction cannot be wrong for
 * those filers and the note would be noise on the majority of returns. The
 * predicate is the same comparison the engine makes.
 */
const SOCIAL_SECURITY_THRESHOLD: ByStatus = byStatus({
  single: 75_000,
  joint: 100_000,
  separate: 75_000,
  headOfHousehold: 75_000,
});

const CONDITIONAL_NOTES: readonly ConditionalNote[] = [
  {
    relevantWhen: (input) =>
      (input.taxableSocialSecurity ?? 0) > 0 &&
      input.federal.adjustedGrossIncome >= SOCIAL_SECURITY_THRESHOLD[input.filingStatus],
    text:
      'Above the Social Security threshold Connecticut charges 25% of the lesser of gross benefits and the \u00a7 86 combined income excess. This package reconstructs that excess from federal AGI, the taxable benefit, the gross benefit and any taxExemptInterest supplied \u2014 it cannot see federally tax-exempt interest the caller did not pass, which belongs in provisional income. Omitting it understates the excess, so it understates Connecticut tax, by at most 25% of the interest. Below the threshold the figure is not read at all.',
  },
];

export function connecticut(year: number): StateIncomeTaxDefinition | undefined {
  if (year !== 2025 && year !== 2026) return undefined;
  return {
    code: 'CT',
    name: 'Connecticut',
    // Connecticut indexes nothing. The rate schedule has stood since the 2024
    // cut to the two lowest rates, the exemption since 2016, the personal
    // credit table since 2016 and the recapture since 2024, all as statute
    // rather than as a carry-forward. The one figure that moves between 2025
    // and 2026 is the IRA phase-in share, and it moves because the statute
    // says it does.
    status: 'published',
    year,
    base: 'federalAdjustedGrossIncome',
    rate: { kind: 'brackets', byStatus: SCHEDULES },
    deduction: { kind: 'none' },
    exemption: {
      // Conn. Gen. Stat. § 12-702 grants the exemption by filing status and says
      // nothing about a spouse with no gross income on a separate return. There
      // is no § 151(b)-shaped clause in the section and no aged or blind
      // addition for it to follow, because Connecticut has neither.
      separateReturnSpouse: {
        spouse: 'notClaimed',
        agedAndBlind: 'notApplicable',
        cite: 'Conn. Gen. Stat. § 12-702(a)(1) grants a flat exemption by filing status, with a separate filer\'s set at $12,000 and no provision adding a spouse to it. Connecticut has no aged or blind exemption addition at all.',
      },
      perFiler: byStatus({ single: 15_000, joint: 24_000, separate: 12_000, headOfHousehold: 19_000 }),
      // Connecticut gives nothing for a dependant on the exemption line. The
      // dependant shows up in the property tax credit, which this package does
      // not model, and in the federal credit the Connecticut EITC matches.
      perDependent: 0,
      stepPhaseOut: {
        start: byStatus({ single: 30_000, joint: 48_000, separate: 24_000, headOfHousehold: 38_000 }),
        increment: 1_000,
        reduction: 1_000,
        cite: 'Conn. Gen. Stat. § 12-702(a)(1) — the exemption is reduced by $1,000 "for each one thousand dollars, or fraction thereof," by which Connecticut adjusted gross income exceeds the threshold. Form CT-1040 TCS Table A prints the resulting staircase.',
      },
    },
    phaseOutAddBack: {
      name: 'Tax rate phase-out add-back',
      staircase: {
        start: byStatus({ single: 56_500, joint: 100_500, separate: 50_250, headOfHousehold: 78_500 }),
        increment: byStatus({ single: 5_000, joint: 5_000, separate: 2_500, headOfHousehold: 4_000 }),
        amount: byStatus({ single: 25, joint: 50, separate: 25, headOfHousehold: 40 }),
        maximum: byStatus({ single: 250, joint: 500, separate: 250, headOfHousehold: 400 }),
      },
    },
    steppedRecapture: {
      name: 'Tax recapture',
      tiers: [
        {
          start: byStatus({ single: 105_000, joint: 210_000, separate: 105_000, headOfHousehold: 168_000 }),
          increment: byStatus({ single: 5_000, joint: 10_000, separate: 5_000, headOfHousehold: 8_000 }),
          amount: byStatus({ single: 25, joint: 50, separate: 25, headOfHousehold: 40 }),
          maximum: byStatus({ single: 250, joint: 500, separate: 250, headOfHousehold: 400 }),
        },
        {
          start: byStatus({ single: 200_000, joint: 400_000, separate: 200_000, headOfHousehold: 320_000 }),
          increment: byStatus({ single: 5_000, joint: 10_000, separate: 5_000, headOfHousehold: 8_000 }),
          amount: byStatus({ single: 90, joint: 180, separate: 90, headOfHousehold: 140 }),
          maximum: byStatus({ single: 2_700, joint: 5_400, separate: 2_700, headOfHousehold: 4_200 }),
        },
        {
          start: byStatus({ single: 500_000, joint: 1_000_000, separate: 500_000, headOfHousehold: 800_000 }),
          increment: byStatus({ single: 5_000, joint: 10_000, separate: 5_000, headOfHousehold: 8_000 }),
          amount: byStatus({ single: 50, joint: 100, separate: 50, headOfHousehold: 80 }),
          maximum: byStatus({ single: 450, joint: 900, separate: 450, headOfHousehold: 720 }),
        },
      ],
    },
    personalTaxCredit: {
      name: 'Personal tax credit',
      steps: byStatusOf<readonly TaxFractionStep[]>({
        single: CREDIT_SINGLE,
        joint: CREDIT_JOINT,
        separate: CREDIT_SEPARATE,
        headOfHousehold: CREDIT_HEAD_OF_HOUSEHOLD,
      }),
    },
    socialSecurityBenefitAdjustment: {
      name: 'Social Security benefit adjustment',
      fullSubtractionBelow: byStatus({
        single: 75_000,
        joint: 100_000,
        separate: 75_000,
        headOfHousehold: 75_000,
      }),
      rate: 0.25,
      // § 86(c)(1). A separate filer who lived with their spouse at any time in
      // the year has a base amount of zero federally, which this package does
      // not ask about and therefore does not apply; the $25,000 here is the
      // lived-apart figure and it understates Connecticut tax for the other
      // case, by at most 25% of $25,000 of benefits.
      combinedIncomeBase: byStatus({
        single: 25_000,
        joint: 32_000,
        separate: 25_000,
        headOfHousehold: 25_000,
      }),
    },
    retirementSubtractionSchedule: {
      name: 'Pension, annuity and IRA subtraction',
      schedule: byStatusOf<readonly TaxFractionStep[]>({
        single: PENSION_NON_JOINT,
        joint: PENSION_JOINT,
        separate: PENSION_NON_JOINT,
        headOfHousehold: PENSION_NON_JOINT,
      }),
      iraPhaseInShare: iraPhaseInShare(year),
    },
    earnedIncomeCredit: {
      name: 'Connecticut earned income tax credit',
      matchRate: 0.4,
      refundable: true,
    },
    // New for tax year 2025, and found by the differential grid rather than by
    // reading: ten Connecticut households with children came back exactly $250
    // apart from PolicyEngine-US on the first run of the harness against this
    // state. It is a FLAT amount once per return, not a percentage and not per
    // child, so it is a cliff at the point the Connecticut credit reaches zero
    // rather than something that tapers with § 32.
    earnedIncomeCreditChildBonus: {
      name: 'Connecticut earned income tax credit child bonus',
      amount: 250,
      // A qualifying child for federal purposes, which is under 19, or under 24
      // and a student, or permanently disabled at any age. This package has
      // only ages, so it counts the first of the three and says so in a note:
      // the figure is understated for a household whose only qualifying child
      // is a student or disabled.
      maxChildAge: 18,
      refundable: true,
    },
    notes: NOTES,
    conditionalNotes: CONDITIONAL_NOTES,
    citations: CITATIONS,
  };
}
