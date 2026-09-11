/**
 * Virginia — a graduated income tax whose graduation is worth `$257.50`, to
 * everybody, forever.
 *
 * Every table of state income tax rates prints Virginia as four brackets: 2%,
 * 3%, 5% and 5.75%. All four are real and all four are in Va. Code § 58.1-320.
 * What the table cannot show is that **the thresholds are the same for every
 * filing status and have not moved since 1990**, so the top rate begins at
 * `$17,000` of taxable income for a single filer and at `$17,000` on a joint
 * return. A Virginia couple with two average incomes is in the top bracket on
 * the return's third line.
 *
 * That makes the whole value of Virginia's rate graduation a constant, and a
 * small one:
 *
 * ```text
 * tax on the first $17,000, graduated   $720.00
 * tax on the first $17,000, at 5.75%    $977.50
 * the entire benefit of four brackets   $257.50
 * ```
 *
 * `$257.50` is the most the schedule can ever save anybody, at any income, in
 * any year since 1990. **Virginia is a 5.75% flat tax with a `$257.50` discount**,
 * and three separate things in this file are that same number in disguise.
 *
 * **The spouse tax adjustment is the discount, handed back once.** Because the
 * brackets are not doubled, marrying costs a two-earner couple one trip up the
 * low bands — so Form 760 line 17 gives it back by splitting the return in two.
 * Virginia publishes the adjustment as "up to `$259`". The worksheet's output is
 * exactly the difference above, so **`$257.50` is the most it can produce and the
 * `$259` ceiling has never once bound**. `test/virginia.test.js` asserts it.
 *
 * **The age deduction is the number nobody prints.** § 58.1-322.03(5) gives a
 * filer 65 or over `$12,000` and takes it back at **a dollar a dollar** above
 * `$50,000` of adjusted federal AGI — `$75,000` on a joint return. A 100%
 * withdrawal rate on top of a 5.75% tax is a **11.5% marginal rate**, twice
 * Virginia's top published rate, and on a joint return where both spouses are 65
 * it runs for the whole `$24,000` it takes to exhaust two deductions. There is no
 * 11.5% in any table of Virginia rates because 11.5% is not a rate; it is two
 * rules meeting.
 *
 * **And Virginia has two floors, set by two different governments, so the cliff
 * moves with family size.** § 58.1-321 exempts a filer whose Virginia AGI is
 * below `$11,950` — `$23,900` joint — from the tax entirely, and the Credit for
 * Low Income Individuals zeroes it up to the **federal poverty guideline**, which
 * rises `$5,500` a head while the threshold does not move at all. For a single
 * filer the guideline is `$3,700` higher, so the statutory cliff produces nothing
 * and the real one costs `$168.55`; for a childless couple the threshold is
 * higher and the cliff is `$106.23`; for a family of four the guideline is higher
 * again and the cliff is `$416.55`, which is their whole Virginia tax.
 *
 * And whether that last cliff exists is decided on the **federal** return. The
 * `$300`-a-head credit and the 20% earned income match are alternatives, and only
 * the match is refundable — so the same family of four with a `$4,000` federal
 * earned income credit takes the `$800` match, is in refund on both sides of the
 * guideline, and walks over the discontinuity without noticing it.
 *
 * One more thing worth saying out loud in a package built around local income
 * taxes: **Virginia has none.** No county, city or town in the Commonwealth
 * levies an income tax — localities are funded by the BPOL licence tax, the
 * machinery and tools tax and the personal property tax, none of which touch a
 * return. Virginia sits between Maryland, where every resident owes a county
 * income tax of 2.25% to 3.30%, and Kentucky, where 87 counties levy an
 * occupational tax on gross wages. It is the largest state in this package with
 * a single layer.
 */
import type { StateIncomeTaxDefinition } from '../definition.js';
import { byStatus } from './helpers.js';
import type { Bracket, Citation } from '../types.js';

const CITATIONS: readonly Citation[] = [
  {
    title: 'Va. Code § 58.1-320 — imposition of tax; the rate schedule, unchanged since 1990',
    url: 'https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-320/',
  },
  {
    title: 'Va. Code § 58.1-321 — exemptions and exclusions; the filing threshold',
    url: 'https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-321/',
  },
  {
    title:
      'Va. Code § 58.1-322.03 — Virginia taxable income: the standard deduction, the personal and aged/blind exemptions, and the age deduction',
    url: 'https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-322.03/',
  },
  {
    title:
      'Va. Code § 58.1-339.8 — the Credit for Low Income Individuals and the Virginia earned income credit',
    url: 'https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-339.8/',
  },
  {
    title: '2025 Form 760 Resident Individual Income Tax Instructions',
    url: 'https://www.tax.virginia.gov/sites/default/files/vatax-pdf/2025-760-instructions.pdf',
  },
  {
    title: 'Virginia Tax — Filing Status, and the spouse tax adjustment of up to $259',
    url: 'https://www.tax.virginia.gov/filing-status',
  },
  {
    title:
      'Virginia Tax — the refundable earned income tax credit, raised from 15% to 20% for tax years 2025 and 2026',
    url: 'https://www.tax.virginia.gov/news/virginias-new-refundable-earned-income-tax-credit-what-you-need-know',
  },
  {
    title:
      'House Bill 1600 (2025 Appropriation Act), Item 4-14 — the standard deduction amounts and the 20% refundable earned income credit',
    url: 'https://budget.lis.virginia.gov/amendment/2025/1/HB1600/Introduced/CR/4-14/3c/',
  },
  {
    title: 'HHS poverty guidelines — the cliff the Credit for Low Income Individuals sits on',
    url: 'https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines',
  },
];

/**
 * § 58.1-320, and the same four rows for every filing status.
 *
 * No state in this package other than Virginia applies one schedule to single
 * and joint filers alike. The thresholds are nominal 1990 dollars: `$17,000`
 * then is about `$42,000` now, so the top bracket has moved down the income
 * distribution by a factor of two and a half without a vote.
 */
const SCHEDULE: readonly Bracket[] = [
  { upTo: 3_000, rate: 0.02 },
  { upTo: 5_000, rate: 0.03 },
  { upTo: 17_000, rate: 0.05 },
  { upTo: Infinity, rate: 0.0575 },
];

/**
 * The HHS poverty guidelines for the contiguous states, which Virginia's Credit
 * for Low Income Individuals is a cliff at.
 *
 * Kept per tax year because the guideline is republished every January and the
 * credit is tested against the one in force for the taxable year.
 */
function guideline(year: number): { firstPerson: number; additionalPerson: number; year: number } {
  return year >= 2026
    ? { firstPerson: 15_960, additionalPerson: 5_680, year: 2026 }
    : { firstPerson: 15_650, additionalPerson: 5_500, year: 2025 };
}

const NOTES: readonly string[] = [
  'Virginia has NO local income tax. No county, city or town in the Commonwealth levies one — localities are funded by the BPOL licence tax, the machinery and tools tax and the personal property "car tax", none of which appear on an individual return. A Virginia result carries one tax, not two, and that is the law rather than a gap in this package.',
  'The rate schedule is the same for every filing status and the thresholds have not moved since 1990: 5.75% begins at $17,000 of taxable income whether one person earned it or two. The whole benefit of Virginia\'s four brackets is therefore a constant $257.50 — the tax on the first $17,000 at 5.75% less the tax on it at the graduated rates — for every filer at every income.',
  'The spouse tax adjustment gives a two-earner couple back the trip up the low brackets that marrying cost them, and it is the same $257.50. Virginia publishes it as "up to $259"; $257.50 is the most the worksheet can produce, so the published ceiling is $1.50 above anything that can reach it and has never bound since the 5.75% bracket was set at $17,000 in 1990. It is claimed only where BOTH spouses had income: pass bothSpousesHaveQualifyingIncome, and lesserSpouseIncome (line 5 of the worksheet) where the second earner is small.',
  'The age deduction is withdrawn DOLLAR FOR DOLLAR, not tapered. A filer 65 or over has $12,000 of deduction and loses all of it across $12,000 of adjusted federal AGI above $50,000 ($75,000 joint), which puts the marginal rate inside the band at 11.5% — twice Virginia\'s top statutory rate, and the highest non-cliff marginal rate anywhere in this package. It is per person, so a joint return where both spouses are 65 faces 11.5% across a $24,000 band from $75,000 to $99,000.',
  'The age deduction\'s income test reads ADJUSTED federal AGI — federal AGI less the taxable Social Security and Tier 1 railroad benefits inside it — while the deduction itself comes off Virginia AGI. Pass taxableSocialSecurity: it moves the test and the base in the same direction and is worth up to $1,380 of tax on a joint return. Do not also include it in `subtractions`.',
  'A filer born on or before 1 January 1939 takes the full $12,000 with NO income test at all, at any income. The statute has never moved that date, so the untested group is closed and shrinking by mortality — a tax provision that sunsets by attrition. This package reads the cohort from the tax year less the age, which puts a filer born exactly on 1 January 1939 into the tested group and understates that one day of births.',
  'Below the filing threshold Virginia charges nothing at all: $11,950 of Virginia AGI for every status but joint, $23,900 joint (§ 58.1-321). It is a cliff, and it has not moved since 2021 while the standard deduction nearly doubled, so it now sits above the point where tax would otherwise begin.',
  'Virginia has TWO floors and they are set by different governments, so which one bites depends on family size. The filing threshold is fixed at $11,950 / $23,900; the Credit for Low Income Individuals zeroes the tax up to the federal poverty guideline, which rises $5,500 a head. For a single filer the guideline ($15,650 in 2025) is the higher of the two, so the statutory cliff at $11,950 produces nothing at all and the real one sits $3,700 further up and costs $168.55 — nearly four times the $45.42 the filing threshold would have cost. For a childless couple the guideline ($21,150) is BELOW the joint threshold, so the filing threshold binds instead and the cliff is $106.23. For a family of four the guideline ($32,150) binds again and the cliff is $416.55, which is their entire Virginia tax.',
  'Whether that cliff exists at all depends on a FEDERAL fact. The Credit for Low Income Individuals and the 20% earned income match are alternatives, and the match is refundable: a family of four at the poverty guideline with a $4,000 federal earned income credit takes the $800 match rather than the $1,200 credit, is $383 in refund on both sides of the guideline, and faces no cliff — while the identical family that does not claim the federal credit loses $416.55 on one dollar. Two Virginia returns with the same Virginia income, and the discontinuity is in one of them only.',
  'The standard deduction of $8,750 ($17,500 joint) is TEMPORARY. It reverts by its own terms to the $3,000 and $6,000 written in § 58.1-322.03(1)(b), which for a joint filer is $11,500 of deduction and $661.25 of tax. The Appropriation Act has moved the reversion date at every budget since 2022 and legislation to make the higher amounts permanent has been introduced; treat a year beyond those this package covers as unknown rather than as a continuation.',
  'Itemizing is not a choice in Virginia. § 58.1-322.03(1)(a) compels a filer who itemized federally to itemize here too — even where the Virginia standard deduction is larger — and the Virginia itemized figure is the federal one LESS the state and local income tax inside it, which is the largest line on most schedules. This package applies the compulsion when stateItemizedDeductions is supplied and falls back to the standard deduction, with this note, when it is not.',
  'The Credit for Low Income Individuals ($300 per exemption) and the Virginia earned income credit (20% of the federal one) are ALTERNATIVES, not additions: § 58.1-339.8 allows exactly one. This package computes both and takes whichever leaves the filer better off, which turns on refundability rather than size — $300 a head is capped at the Virginia tax, the 20% match is refundable, so a family under the poverty guideline with no tax is better off with the smaller number.',
  'Since tax year 2025 Virginia\'s refundable earned income credit has been 20% of the federal credit — the same rate as the non-refundable one in § 58.1-339.8.B.2 — which leaves the non-refundable option dominated at every income and never the right election. It is still on the return. Both are scheduled at 20% for 2025 and 2026 by the Appropriation Act rather than by the Code.',
  'A filer who claims the age deduction, the aged or blind exemption, the military benefit subtraction or the federal/state employee subtraction may not claim the Credit for Low Income Individuals (§ 58.1-339.8.D). This package enforces the first two, which it can see; the other two are subtractions a caller nets themselves, so a filer claiming one of those should pass federalPovertyGuideline: 0 to switch the credit off.',
  'Virginia does not tax Social Security or Tier 1 railroad retirement benefits, and subtracts them here from taxableSocialSecurity. Not modelled and to be passed through `subtractions`: the military benefits subtraction (up to $40,000 for a recipient aged 55 or over), the disability income subtraction, the up-to-$15,000 subtraction for a state or federal employee whose salary is $15,000 or less, National Guard pay, the Virginia529 contribution deduction, and the child and dependent care and educator expense deductions, which are deductions rather than subtractions and reduce Virginia taxable income by the same amount.',
  'Not modelled: the reduction of itemized deductions under § 58.1-322.03(1)(a)(2) — 3% of federal AGI above $332,700 (single) or $399,200 (joint) for 2025, capped at 80% of the affected deductions. It reaches only filers above those thresholds, and the 2026 figures are uprated federally and are not published at the time of writing.',
  'There is no Virginia rebate for tax year 2025 or 2026. The one-time rebates of $200 ($400 joint) were authorised for 2022 and 2023 returns by the Appropriation Act and were not renewed.',
];

export function virginia(year: number): StateIncomeTaxDefinition | undefined {
  if (year !== 2025 && year !== 2026) return undefined;
  return {
    code: 'VA',
    name: 'Virginia',
    // The rate schedule is 1990 law, the personal exemption has been $930 since
    // 2008 and the aged/blind exemption $800 for longer than that. The standard
    // deduction is the only figure that moves, and the Appropriation Act fixed
    // 2026 at the 2025 amount — so nothing here is a carry-forward.
    status: 'published',
    year,
    base: 'federalAdjustedGrossIncome',
    rate: { kind: 'brackets', byStatus: {
      single: SCHEDULE,
      marriedFilingJointly: SCHEDULE,
      marriedFilingSeparately: SCHEDULE,
      headOfHousehold: SCHEDULE,
      qualifyingSurvivingSpouse: SCHEDULE,
    } },
    deduction: {
      kind: 'table',
      amounts: byStatus({
        single: 8_750,
        joint: 17_500,
        // Married filing separately takes the single amount, not half the joint
        // one — and half of $17,500 is $8,750, so the two agree here by
        // coincidence rather than by rule.
        separate: 8_750,
        headOfHousehold: 8_750,
      }),
    },
    itemizedDeduction: {
      name: 'Virginia itemized deductions',
      requiresFederalItemizing: true,
      forcedWhenFederalItemizing: true,
      // The § 58.1-322.03(1)(a)(2) reduction is not modelled — see the notes.
      phaseOutRate: 0,
      phaseOutThreshold: byStatus({
        single: Infinity,
        joint: Infinity,
        separate: Infinity,
        headOfHousehold: Infinity,
      }),
    },
    exemption: {
      perFiler: byStatus({ single: 930, joint: 1_860, separate: 930, headOfHousehold: 930 }),
      perDependent: 930,
      // § 58.1-322.03(2)(b). Claimed for age AND for blindness, so a blind filer
      // of 65 claims both — which this package's one-per-condition shape cannot
      // express; such a filer is $800 of exemption, $46 of tax, too high.
      perSeniorFiler: 800,
      seniorAge: 65,
      perBlindOrDisabledFiler: 800,
    },
    ageDeduction: {
      name: 'Age deduction',
      amount: 12_000,
      minimumAge: 65,
      fullAmountIfBornBefore: 1939,
      threshold: byStatus({
        single: 50_000,
        joint: 75_000,
        // § 58.1-322.03(5)(b) gives a separate filer the joint threshold, which
        // is the opposite of the usual halving and the one place in Virginia
        // where filing separately is treated more generously than filing single.
        separate: 75_000,
        headOfHousehold: 50_000,
        qualifyingSurvivingSpouse: 50_000,
      }),
      reductionRate: 1,
    },
    subtractsTaxableSocialSecurity: true,
    spouseTaxAdjustment: {
      name: 'Spouse tax adjustment',
      cap: 259,
      divisor: 2,
    },
    zeroTaxThreshold: {
      name: 'Virginia filing threshold',
      threshold: byStatus({
        single: 11_950,
        joint: 23_900,
        separate: 11_950,
        headOfHousehold: 11_950,
        qualifyingSurvivingSpouse: 11_950,
      }),
    },
    earnedIncomeCredit: {
      name: 'Virginia earned income tax credit (refundable, 20% of the federal credit)',
      matchRate: 0.2,
      refundable: true,
    },
    lowIncomeCredit: {
      name: 'Credit for Low Income Individuals',
      perExemption: 300,
      povertyGuideline: guideline(year),
    },
    notes: NOTES,
    citations: CITATIONS,
  };
}
