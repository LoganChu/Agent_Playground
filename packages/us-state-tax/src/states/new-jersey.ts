/**
 * New Jersey — the second state in this package with no federal starting line,
 * and the one where that fact costs the most.
 *
 * Pennsylvania is the famous example of a state that does not begin from federal
 * AGI. New Jersey is the larger one, and its gross income tax differs from the
 * federal base in both directions at once: it ignores Social Security and
 * unemployment compensation, and it taxes 403(b) deferrals and traditional IRA
 * contributions that the federal return never saw. Handing it federal AGI is not
 * an approximation; it is a different number.
 *
 * Three things here are not visible in any table of New Jersey rates.
 *
 * **1. The published rate schedules are generated.** New Jersey prints its tax
 * as "multiply by .05525 and subtract $1,492.50" — fourteen subtraction
 * constants across the two schedules. Every one of them is
 * `rate x threshold - cumulative tax below the threshold`, which is to say they
 * are the marginal schedule written down differently. This file stores the
 * marginal schedule and `test/new-jersey.test.js` regenerates all fourteen.
 *
 * **2. Below the filing threshold there is no tax at all.** `$10,000` of gross
 * income single, `$20,000` joint — and one dollar more brings the entire first
 * bracket with it. It is a threshold on *gross* income triggering a tax on
 * *taxable* income, so how far a filer falls depends on their exemptions.
 *
 * **3. The retirement income exclusion ends in a wall.** A joint return excludes
 * up to `$100,000` of pension and IRA income at `$150,000` of total income and
 * nothing at all at `$150,001`. That single dollar is worth more than four
 * thousand dollars of New Jersey tax — the largest cliff anywhere in this
 * package, and it is created by a statute that contains no phase-out at all.
 */
import type { StateIncomeTaxDefinition } from '../definition.js';
import { byStatus, byStatusOf } from './helpers.js';
import type { Bracket, ByStatus, Citation } from '../types.js';

const CITATIONS: readonly Citation[] = [
  {
    title: 'N.J.S.A. 54A:2-1 — imposition of the New Jersey gross income tax',
    url: 'https://law.justia.com/codes/new-jersey/title-54a/section-54a-2-1/',
  },
  {
    title: 'N.J.S.A. 54A:5-1 — the categories of gross income',
    url: 'https://law.justia.com/codes/new-jersey/title-54a/section-54a-5-1/',
  },
  {
    title: 'N.J.S.A. 54A:3-1 — personal exemptions',
    url: 'https://law.justia.com/codes/new-jersey/title-54a/section-54a-3-1/',
  },
  {
    title: 'N.J.S.A. 54A:6-10 — pension and retirement income exclusion',
    url: 'https://law.justia.com/codes/new-jersey/title-54a/section-54a-6-10/',
  },
  {
    title: 'N.J.S.A. 54A:8-3.1 — the gross income filing threshold',
    url: 'https://law.justia.com/codes/new-jersey/title-54a/section-54a-8-3-1/',
  },
  {
    title: 'N.J.S.A. 54A:4-7 — New Jersey earned income tax credit',
    url: 'https://law.justia.com/codes/new-jersey/title-54a/section-54a-4-7/',
  },
  {
    title: 'N.J.S.A. 54A:4-17 — New Jersey child tax credit',
    url: 'https://law.justia.com/codes/new-jersey/title-54a/section-54a-4-17/',
  },
  {
    title: 'N.J.S.A. 54A:3A-16 to 54A:3A-20 — property tax deduction or credit',
    url: 'https://law.justia.com/codes/new-jersey/title-54a/section-54a-3a-20/',
  },
  {
    title: 'New Jersey Division of Taxation — NJ-1040 instructions and tax rate schedules',
    url: 'https://www.nj.gov/treasury/taxation/pdf/current/1040i.pdf',
  },
  {
    title:
      'P.L. 2026, c.26 (S-4531) — child tax credit amounts increased 25% for tax years 2026-2028',
    url: 'https://legiscan.com/NJ/bill/S4531/2026',
  },
];

/**
 * Schedule I of the NJ-1040 — single and married filing separately.
 *
 * Unchanged since the 10.75% top rate was extended down to $1,000,000 for tax
 * year 2020 (P.L. 2020, c.95). None of it is indexed for inflation: the $20,000
 * bottom bracket has been $20,000 since 1991, so New Jersey's bracket creep is
 * pure and continuous.
 */
const SCHEDULE_I: readonly Bracket[] = [
  { upTo: 20_000, rate: 0.014 },
  { upTo: 35_000, rate: 0.0175 },
  { upTo: 40_000, rate: 0.035 },
  { upTo: 75_000, rate: 0.05525 },
  { upTo: 500_000, rate: 0.0637 },
  { upTo: 1_000_000, rate: 0.0897 },
  { upTo: Infinity, rate: 0.1075 },
];

/**
 * Schedule II — married filing jointly, head of household, and qualifying
 * surviving spouse.
 *
 * New Jersey gives a head of household the *joint* schedule, which almost no
 * other state does: in New York, California and every bracketed state in this
 * package a head of household sits on a third schedule of its own. And note the
 * 2.45% band, which exists only here — Schedule I jumps straight from 1.75% to
 * 3.5%, so the two schedules have different numbers of brackets.
 */
const SCHEDULE_II: readonly Bracket[] = [
  { upTo: 20_000, rate: 0.014 },
  { upTo: 50_000, rate: 0.0175 },
  { upTo: 70_000, rate: 0.0245 },
  { upTo: 80_000, rate: 0.035 },
  { upTo: 150_000, rate: 0.05525 },
  { upTo: 500_000, rate: 0.0637 },
  { upTo: 1_000_000, rate: 0.0897 },
  { upTo: Infinity, rate: 0.1075 },
];

const RATES: ByStatus<readonly Bracket[]> = byStatusOf<readonly Bracket[]>({
  single: SCHEDULE_I,
  joint: SCHEDULE_II,
  separate: SCHEDULE_I,
  headOfHousehold: SCHEDULE_II,
});

/**
 * The child tax credit steps, by tax year.
 *
 * P.L. 2026, c.26 raised every amount by exactly 25% for tax years 2026, 2027
 * and 2028, reverting in 2029 — so the 2026 column is the 2025 one times 1.25,
 * which `test/new-jersey.test.js` asserts rather than trusting two transcribed
 * tables to agree.
 */
function childCreditSteps(year: number): readonly { upTo: number; amount: number }[] {
  const base = [
    { upTo: 30_000, amount: 1_000 },
    { upTo: 40_000, amount: 800 },
    { upTo: 50_000, amount: 600 },
    { upTo: 60_000, amount: 400 },
    { upTo: 80_000, amount: 200 },
    { upTo: Infinity, amount: 0 },
  ];
  const factor = year >= 2026 && year <= 2028 ? 1.25 : 1;
  return base.map((s) => ({ upTo: s.upTo, amount: s.amount * factor }));
}

const NOTES: readonly string[] = [
  'New Jersey does not start from federal AGI. Its gross income tax enumerates its own categories, and the differences run both ways: Social Security benefits, unemployment compensation and New Jersey municipal bond interest are not taxed, while 403(b) elective deferrals and traditional IRA contributions ARE — a 401(k) deferral is excluded but a 403(b) one is not, which is the single most common New Jersey error. Pass newJerseyGrossIncome; federal AGI is a different figure, not an approximation of this one.',
  'Losses in one New Jersey income category cannot offset income in another, and there is no capital loss carryforward. A filer with a $20,000 business loss and $80,000 of wages pays New Jersey tax on the full $80,000.',
  'Below the filing threshold — $10,000 of New Jersey gross income for a single or separate filer, $20,000 for every other status — there is no New Jersey tax at all, whatever the exemptions. One dollar above it the whole first bracket applies at once, so the threshold is a cliff whose size depends on the filer standing on it: about $126 for a single filer with one exemption and about $252 for a joint couple with two.',
  'A qualifying surviving spouse gets three different mappings on the same return: the JOINT rate schedule, the SINGLE retirement exclusion maximum of $75,000, and ONE $1,000 personal exemption rather than two. No other state in this package splits a filing status across the tables like that, and a model that maps the status once at the top of the computation gets two of the three wrong.',
  'New Jersey gives a head of household the joint rate schedule. Almost every other bracketed state puts a head of household on a schedule of its own, so a rate table transcribed from another state\'s shape will overstate a New Jersey head of household across the 2.45% band.',
  'The retirement income exclusion is a wall, not a phase-out: 100% of the maximum up to $100,000 of total income, then 50% (joint) to $125,000, then 25% to $150,000, and nothing at $150,001. For a joint return with $100,000 of pension income that single dollar is worth more than $4,000 of New Jersey tax — the largest one-dollar cliff in this package.',
  'The exclusion is tested on TOTAL income (NJ-1040 line 27, before the exclusion) while the filing threshold is tested on GROSS income (line 29, after it). Applying either test to the other figure is a wrong answer at the margin.',
  'The New Jersey earned income tax credit is 40% of the federal credit — the largest state match in the country — and it is refundable. It also reaches filers the federal credit does not: a childless resident aged 18 to 24, or one over the federal maximum age, qualifies for the New Jersey credit computed as 40% of the federal credit they WOULD have received. This package matches whatever federal credit it is given, so for such a filer pass the notional federal amount rather than zero.',
  'The child tax credit is a staircase, not a phase-out: $1,000 per child under 6 at $30,000 of New Jersey taxable income and $800 at $30,001. A family with three young children loses $600 on that one dollar, and again at $40,000, $50,000 and $60,000. Married filing separately gets nothing at all, and the income steps are not halved for it.',
  'The property tax deduction and the $50 property tax credit are alternatives, and the NJ-1040 says to compute the tax both ways and take the lower. This package does exactly that and reports which one it used. A model that always deducts is wrong for the low-income filers the credit exists for.',
  'Not modelled: the medical expense deduction (amounts above 2% of gross income), the alimony, Archer MSA, self-employed health insurance and qualified conservation deductions, the NJBEST 529 contribution deduction ($10,000, gross income up to $200,000), the alternative business calculation adjustment, the child and dependent care credit (a refundable 10%-50% share of the federal credit, taxable income up to $150,000), the $6,000/$3,000 special exclusion for filers ineligible for Social Security, and the ANCHOR and Senior Freeze property tax relief programs, which are not part of the income tax return. Pass any of these through `subtractions` if you have them.',
  'Married filing separately who maintained the SAME principal residence as their spouse may each claim half the property tax paid and a $25 credit rather than $50. This package applies the full $50 to a separate filer, so halve propertyTaxPaid and treat the credit as $25 for that case.',
  'Not modelled: the New Jersey property tax credit paid as a refund to a filer aged 65 or older, or blind or disabled, whose gross income is below the filing threshold. Such a filer owes no tax here and this package returns zero rather than the $50 refund.',
];

export function newJersey(year: number): StateIncomeTaxDefinition | undefined {
  if (year !== 2025 && year !== 2026) return undefined;
  return {
    code: 'NJ',
    name: 'New Jersey',
    // Nothing in the New Jersey computation is indexed for inflation. The rate
    // schedules have stood since 2020, the exemptions since 1994 and the
    // retirement exclusion maxima since 2020, so the 2026 figures are the 2025
    // ones as a matter of statute rather than as a carry-forward — the one
    // exception being the child tax credit, which P.L. 2026, c.26 raised.
    status: 'published',
    year,
    base: 'stateDefined',
    stateDefinedBase: {
      field: 'newJerseyGrossIncome',
      why:
        'New Jersey enumerates its own categories of income. It does not tax Social Security ' +
        'benefits or unemployment compensation, and it DOES tax 403(b) elective deferrals and ' +
        'traditional IRA contributions, which never appear in federal AGI. Supply line 27 of ' +
        'the NJ-1040 — total income, before the retirement exclusion and before every deduction.',
    },
    rate: { kind: 'brackets', byStatus: RATES },
    deduction: { kind: 'none' },
    exemption: {
      perFiler: byStatus({
        single: 1_000,
        joint: 2_000,
        separate: 1_000,
        headOfHousehold: 1_000,
        // One person, one exemption. This package's usual default sends a
        // qualifying surviving spouse to the joint amount, and in New Jersey
        // that would be wrong — see the note about the three different mappings
        // this status gets.
        qualifyingSurvivingSpouse: 1_000,
      }),
      perDependent: 1_500,
      perSeniorFiler: 1_000,
      seniorAge: 65,
      perBlindOrDisabledFiler: 1_000,
      perCollegeDependent: 1_000,
    },
    zeroTaxThreshold: {
      name: 'New Jersey filing threshold',
      threshold: byStatus({
        single: 10_000,
        joint: 20_000,
        separate: 10_000,
        headOfHousehold: 20_000,
      }),
    },
    retirementExclusion: {
      name: 'Pension and retirement income exclusion',
      maximum: byStatus({
        single: 75_000,
        joint: 100_000,
        separate: 50_000,
        headOfHousehold: 75_000,
        // A qualifying surviving spouse takes the single maximum while filing on
        // the joint rate schedule — the one place this package's usual default
        // of "surviving spouse follows joint" is wrong.
        qualifyingSurvivingSpouse: 75_000,
      }),
      tiers: [
        { upTo: 100_000, jointPercentage: 1 },
        { upTo: 125_000, jointPercentage: 0.5 },
        { upTo: 150_000, jointPercentage: 0.25 },
        { upTo: Infinity, jointPercentage: 0 },
      ],
      minimumAge: 62,
      otherIncomeEarnedIncomeLimit: 3_000,
    },
    propertyTaxRelief: {
      deductionName: 'Property tax deduction',
      creditName: 'Property tax credit',
      limit: 15_000,
      rentFraction: 0.18,
      credit: byStatus({ single: 50, joint: 50, separate: 50, headOfHousehold: 50 }),
    },
    earnedIncomeCredit: {
      name: 'New Jersey earned income tax credit',
      matchRate: 0.4,
      refundable: true,
    },
    steppedChildCredit: {
      name: 'New Jersey child tax credit',
      maxAge: 5,
      steps: childCreditSteps(year),
      refundable: true,
      ineligibleFilingStatuses: ['marriedFilingSeparately'],
    },
    notes:
      year >= 2026 && year <= 2028
        ? [
            'The child tax credit amounts are 25% higher for tax years 2026 through 2028 under P.L. 2026, c.26 — $1,250 per child under 6 at the bottom step, against $1,000 in 2025 — and revert to the 2025 amounts in 2029.',
            ...NOTES,
          ]
        : NOTES,
    citations: CITATIONS,
  };
}
