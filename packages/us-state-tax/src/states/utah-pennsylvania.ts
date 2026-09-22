/**
 * Utah and Pennsylvania — the two states in this package whose flat rate is a
 * label rather than a description.
 *
 * Both are widely listed as flat-tax states. Both have a marginal rate that is
 * nowhere near their statutory rate across a wide band of ordinary incomes,
 * because both hand back a credit and then take it away as income rises.
 *
 * - **Utah** charges 4.45% in 2026 and a working single filer faces **5.75%**,
 *   because the Taxpayer Tax Credit phases out at 1.3 cents on the dollar
 *   underneath the tax. The band runs from about $18,000 of income to about
 *   $36,000 — which is to say, across most of the state's lower-paid workers.
 *   A **retiree** faces **15.26%**, because a second credit is withdrawn at 2.5
 *   cents over the same income and § 86 puts `$1.85` of taxable income behind
 *   each dollar they draw: `1.85 × (4.45 + 2.5 + 1.3)`. Three rules, no
 *   brackets, and 3.4 times the rate the state advertises.
 * - **Pennsylvania** charges 3.07%, and across the Special Tax Forgiveness band a
 *   single filer faces about **11%** and a single parent of two about **34%** —
 *   because forgiveness falls by ten percentage points of the *whole* tax for each
 *   $250 step, so the more tax a household would otherwise owe, the more each step
 *   costs. It arrives as ten discrete jumps rather than a rate, which is why it is
 *   invisible to anything that reads a rate schedule.
 *
 * Neither number can be read off a rate schedule. Both fall out of running the
 * whole computation one dollar higher, which is what this package's
 * `marginalRate` does.
 */
import type { ConditionalNote, StateIncomeTaxDefinition } from '../definition.js';
import { byStatus, whenAgedAtLeast, whenMilitaryRetirement } from './helpers.js';
import type { Citation } from '../types.js';

const UT_CITATIONS: readonly Citation[] = [
  {
    title: 'Utah Code § 59-10-104 — individual income tax rate',
    url: 'https://le.utah.gov/xcode/Title59/Chapter10/59-10-S104.html',
  },
  {
    title: 'Utah Code § 59-10-1018 — Taxpayer Tax Credit and its phase-out',
    url: 'https://le.utah.gov/xcode/Title59/Chapter10/59-10-S1018.html',
  },
  {
    title: 'Utah HB 106 (2025) — rate reduced to 4.5% for tax year 2025',
    url: 'https://le.utah.gov/~2025/bills/static/HB0106.html',
  },
  {
    title: 'Utah SB 60 (2026) — rate reduced to 4.45%',
    url: 'https://le.utah.gov/~2026/bills/static/SB0060.html',
  },
  {
    title: 'Utah State Tax Commission — Form TC-40 instructions, Taxpayer Tax Credit',
    url: 'https://incometax.utah.gov/credits/taxpayer-tax-credit',
  },
  {
    title: 'Utah Code § 59-10-1019 — Retirement Credit (code 18)',
    url: 'https://le.utah.gov/xcode/Title59/Chapter10/59-10-S1019.html',
  },
  {
    title: 'Utah Code § 59-10-1042 — Social Security Benefits Credit (code AH)',
    url: 'https://le.utah.gov/xcode/Title59/Chapter10/59-10-S1042.html',
  },
  {
    title: 'Utah Code § 59-10-1043 — Military Retirement Credit (code AJ)',
    url: 'https://le.utah.gov/xcode/Title59/Chapter10/59-10-S1043.html',
  },
  {
    title: 'Utah SB 71 (2025) — Social Security Tax Revisions, thresholds raised 20%',
    url: 'https://le.utah.gov/~2025/bills/static/SB0071.html',
  },
  {
    title: 'Utah Code § 59-10-1047 — child tax credit',
    url: 'https://le.utah.gov/xcode/Title59/Chapter10/59-10-S1047.html',
  },
  {
    title: 'Utah HB 106 (2025) — child tax credit extended to children under 6',
    url: 'https://le.utah.gov/~2025/bills/static/HB0106.html',
  },
  {
    title: 'Utah HB 290 (2026) — Child Tax Credit Amendments, thresholds raised',
    url: 'https://le.utah.gov/~2026/bills/static/HB0290.html',
  },
  {
    title: 'Utah State Tax Commission — Child Tax Credit',
    url: 'https://incometax.utah.gov/credits/child-tax-credit',
  },
  {
    title: 'Utah State Tax Commission — Retirement Credit (code 18)',
    url: 'https://incometax.utah.gov/credits/retirement-credit',
  },
  {
    title: 'Utah State Tax Commission — Social Security Benefits Credit (code AH)',
    url: 'https://incometax.utah.gov/credits/ss-benefits',
  },
];

const UT_NOTES: readonly string[] = [
  "Utah's statutory rate is not its marginal rate for most working filers. The Taxpayer Tax Credit is 6% of the federal standard or itemized deduction plus $2,111 per dependent, reduced by 1.3 cents for each dollar of Utah taxable income above $18,213 ($36,426 joint). Inside that band the true marginal rate is the statutory rate plus 1.3 points — 5.75% in 2026 against a headline 4.45%.",
  'The credit depends on the FEDERAL deduction, so Utah is a federal-AGI state whose credit is nonetheless sensitive to changes below AGI. The OBBBA standard deduction increase raised the Utah credit by 6% of the increase — about $69 for a single filer in 2025 — cutting Utah tax with no Utah legislation.',
  'Utah cut its rate twice in two years: 4.55% for 2024, 4.5% for 2025 (HB 106), and 4.45% for 2026 (SB 60).',
  "Utah's child tax credit is withdrawn at TEN cents on the dollar — 2.2 times the state's own tax rate, so the withdrawal is a larger marginal tax than the tax is. $1,000 for each child under 6, gone by $59,000 of income for a single filer with one child and $71,000 for a couple ($49,000/$61,000 in 2026 after HB 290, $43,000/$54,000 in 2025). Inside the band a Utah family faces about 14.75% on the next dollar against a headline 4.45%, and 16.05% where the Taxpayer Tax Credit is being withdrawn at the same time.",
  "The child tax credit is withdrawn against a DIFFERENT income figure from Utah's retirement credits, on the same return. TC-40 line 9 — state taxable income, after every Utah subtraction — plus tax-exempt interest, where the Retirement and Social Security Benefits credits use line 6, before them. A Utah subtraction therefore buys back child credit and does nothing for a retiree's.",
  'The credit is per child under 6 and ends the year the child turns 6, so a Utah family loses $1,000 on a birthday and nothing on the return says why. HB 106 (2025) widened it from the 1-to-3 band it had in 2024, where a newborn did not qualify at all.',
  'Not modelled: the Utah credits for at-home parents and 529 contributions. A family claiming either will compute too high here.',
  "Utah's earned income credit is 20% of the federal credit and is NON-REFUNDABLE — Utah Code § 59-10-1044 sits in Part 10, the Nonrefundable Tax Credit Act. It is the only state credit in this package that is a share of the federal credit and cannot be paid out, and the difference is the whole point of the credit for the filers it is aimed at: a Utah single parent whose Taxpayer Tax Credit already wipes out their tax receives nothing from it.",
  "Utah taxes Social Security and then hands the tax back. The Social Security Benefits Credit (code AH, § 59-10-1042) is the state's own rate applied to the part of the benefit § 86 made taxable, so below $90,000 of modified AGI ($54,000 single, $45,000 separate) the benefit costs a Utah retiree nothing — and above it the credit is withdrawn at 2.5 cents on the dollar. SB 71 (2025) raised those thresholds 20% from $75,000/$45,000/$37,500 and they are NOT indexed.",
  'A retiree may claim only ONE side of Utah\'s retirement credits: the Retirement Credit (code 18) on one side, or the Social Security Benefits Credit (code AH) together with the Military Retirement Credit (code AJ) on the other — § 59-10-1019(5). This engine computes both sides and takes the larger, which is always optimal because a non-refundable credit is worth min(itself, tax remaining) and min is monotone. The result names the side that was taken.',
  "Utah's real marginal rate on a retiree reaches 15.26% — 3.4 times the 4.45% statutory rate — and it is three rules compounding, none of which is a bracket. A dollar of pension drags 85 cents of Social Security into federal AGI under § 86; Utah taxes all $1.85 at 4.45%, withdraws 2.5 cents of AH per dollar of it and 1.3 cents of Taxpayer Tax Credit per dollar of it. 1.85 x 8.25%. For a couple with a $70,000 benefit the rate runs 10.64% -> 15.26% -> 8.25% as income rises, peaking at $90,387.50 of federal AGI and FALLING after it, so the highest-taxed next dollar in Utah belongs to a household in the 12% federal bracket.",
  'Tax-exempt interest is added back for both credits (§ 59-10-1019(1)(b), § 59-10-1042(1)(b)), so a municipal bond is taxed at 2.5% in Utah while appearing on no line of Utah income. For a couple with $40,000 of benefits and $60,000 of pension, $10,000 of exempt interest costs exactly $250.00 of Utah tax and $0.00 of federal tax. Pass it as `taxExemptInterest`; leaving it out understates a bondholding retiree.',
];

const UT_RETIREMENT_NOTES: readonly ConditionalNote[] = [
  {
    text: "The Retirement Credit (code 18) is all but dead law and the arithmetic says so. Its $450 a head is withdrawn at 2.5 cents against thresholds of $25,000 single and $32,000 joint that have not moved since the credit was written, so it is gone by $42,900 of modified AGI for a single filer and $67,900 for a couple — and below about $45,300 the Taxpayer Tax Credit has already reduced the tax to zero, leaving nothing for it to offset. Its whole live band for a couple is $45,300 to $67,900 of modified AGI, where it is worth at most $395.00, and only for a household with no Social Security at all, because any benefit makes code AH the larger side. Utah's own guidance says as much.",
    relevantWhen: whenAgedAtLeast(70),
  },
  {
    text: 'Code 18 also has a closed birth cohort: only a filer born on or before 31 December 1952 qualifies, a date that has never moved, so the eligible population shrinks every year and the credit sunsets by attrition rather than by repeal. It is the third such provision in this package after Virginia\'s 1939 age deduction and Kentucky\'s 1998 service cutoff. In 2026 it reaches a couple aged 74 and over: at $50,000 of modified AGI a couple born in 1951 pays $0.00 and the same couple born in 1953 pays $271.46.',
    relevantWhen: whenAgedAtLeast(70),
  },
  {
    text: "The Military Retirement Credit (code AJ, § 59-10-1043) is the state's own rate applied to military retired pay included in AGI, with NO phase-out of any kind — the only one of the three a high-income Utah retiree keeps. Because Utah has no deduction of its own, the credit exactly cancels the tax on that pay: $45,000 of retired pay is worth $2,002.50 of credit against $2,002.50 of tax. It may be claimed alongside code AH and not alongside code 18. The credit is DEFINED as the rate — § 59-10-1043(2)(a) cross-references § 59-10-104(2) — so this package reads it off the state's rate rather than storing a second copy; PolicyEngine-US stores the copy and its 2026 value is still 4.5% against its own 2026 rate of 4.45%, which overstates the credit on $45,000 of retired pay by $2.25.",
    relevantWhen: whenMilitaryRetirement,
  },
];

function utah(year: number): StateIncomeTaxDefinition | undefined {
  if (year !== 2025 && year !== 2026) return undefined;
  return {
    code: 'UT',
    name: 'Utah',
    year,
    status: year === 2025 ? 'published' : 'provisional',
    provisionalFigures:
      year === 2026
        ? // Canonical FilingStatus keys, not the `byStatus` shorthand the line
          // below is written in: the helper emits `marriedFilingJointly` where
          // its argument says `joint`, and a path is read against the built
          // definition rather than against the source.
          [
            'taxpayerCredit.personalExemption',
            'taxpayerCredit.phaseOutThreshold.single',
            'taxpayerCredit.phaseOutThreshold.marriedFilingJointly',
            'taxpayerCredit.phaseOutThreshold.marriedFilingSeparately',
            'taxpayerCredit.phaseOutThreshold.headOfHousehold',
            'taxpayerCredit.phaseOutThreshold.qualifyingSurvivingSpouse',
          ].map((path) => ({
            path,
            reason: 'awaiting-publication' as const,
            carriedForwardFrom: 2025,
            resolvedBy:
              'the 2026 Utah TC-40 instructions, published by the Tax Commission in January 2027',
          }))
        : undefined,
    base: 'federalAdjustedGrossIncome',
    rate: { kind: 'flat', rate: year === 2025 ? 0.045 : 0.0445 },
    // Utah has no deduction of its own; the federal deduction enters through the
    // credit instead, which is why it is worth 6 cents on the dollar rather than
    // the full marginal rate.
    deduction: { kind: 'none' },
    earnedIncomeCredit: {
      name: 'Utah earned income tax credit',
      matchRate: 0.2,
      refundable: false,
    },
    taxpayerCredit: {
      name: 'Taxpayer Tax Credit',
      rate: 0.06,
      personalExemption: 2111,
      phaseOutRate: 0.013,
      phaseOutThreshold: byStatus({
        single: 18213,
        joint: 36426,
        separate: 18213,
        headOfHousehold: 27320,
      }),
    },
    exclusiveRetirementCredits: {
      why:
        'Utah Code § 59-10-1019(5): a filer may not claim the Retirement Credit (code 18) ' +
        'if the filer or the filer\'s spouse claims the Social Security Benefits Credit ' +
        '(code AH) or the Military Retirement Credit (code AJ), and may not claim either ' +
        'of those if the filer claims the Retirement Credit. AH and AJ may be claimed ' +
        'together. This engine takes whichever side is worth more.',
      retirement: {
        name: 'Utah retirement credit (code 18)',
        perPerson: 450,
        bornOnOrBefore: 1952,
        phaseOutRate: 0.025,
        phaseOutThreshold: byStatus({
          single: 25_000,
          joint: 32_000,
          separate: 16_000,
          headOfHousehold: 32_000,
        }),
      },
      socialSecurity: {
        name: 'Utah Social Security benefits credit (code AH)',
        phaseOutRate: 0.025,
        phaseOutThreshold: byStatus({
          single: 54_000,
          joint: 90_000,
          separate: 45_000,
          headOfHousehold: 90_000,
        }),
      },
      militaryRetirement: { name: 'Utah military retirement credit (code AJ)' },
    },
    childCredit: {
      name: 'Utah child tax credit',
      // Under 6, both years. HB 106 (2025) replaced the original "at least one
      // and under four" band, which excluded a newborn, with this one.
      amountByAge: [{ maxAge: 5, amount: 1_000 }],
      phaseOut: {
        // Ten cents on the dollar with no step — § 59-10-1047(4) reduces the
        // credit by "$.10 for each $1", not by a fixed amount per band.
        kind: 'rate',
        rate: 0.1,
        income: 'stateTaxableIncomePlusTaxExemptInterest',
        threshold: byStatus(
          year === 2026
            ? { single: 49_000, joint: 61_000, separate: 30_500, headOfHousehold: 49_000 }
            : { single: 43_000, joint: 54_000, separate: 27_000, headOfHousehold: 43_000 },
        ),
      },
      // Part 10 of Chapter 10 is the Nonrefundable Tax Credit Act, and
      // § 59-10-1047 sits in it. A Utah family with no tax gets nothing.
      refundable: false,
    },
    notes:
      year === 2026
        ? [
            'PROVISIONAL, six figures: the $2,111 per-dependent exemption amount and the $18,213/$36,426/$27,320 phase-out thresholds are the published 2025 figures carried forward. Utah indexes them annually and publishes the result with the TC-40 instructions in January AFTER the tax year, so this one cannot be resolved by searching during 2026 — it was checked again on Day 28 and the 2026 amounts do not yet exist. The 4.45% rate is set by SB 60 (2026) and is correct. The retirement-credit figures are NOT provisional and are not carried forward for the same reason: $450, 1952, $25,000/$32,000/$16,000 and $54,000/$90,000/$45,000 are all set in statute with no indexing mechanism, so 2026 equals 2025 because the law says so and not because this package guessed.',
            ...UT_NOTES,
          ]
        : UT_NOTES,
    // Three notes about a credit almost nobody can claim and one about military
    // pay, on a state where most returns have neither. Code 18's two are gated
    // on age rather than on a field, because their whole subject is who is too
    // young for it.
    conditionalNotes: UT_RETIREMENT_NOTES,
    citations: UT_CITATIONS,
  };
}

const PA_CITATIONS: readonly Citation[] = [
  {
    title: '72 Pa. Stat. § 7302 — 3.07% personal income tax rate',
    url: 'https://www.legis.state.pa.us/cfdocs/legis/LI/uconsCheck.cfm?txtType=HTM&yr=1971&sessInd=0&smthLwInd=0&act=2&chpt=3',
  },
  {
    title: '72 Pa. Stat. § 7304 — Special Tax Forgiveness',
    url: 'https://www.legis.state.pa.us/cfdocs/legis/LI/uconsCheck.cfm?txtType=HTM&yr=1971&sessInd=0&smthLwInd=0&act=2&chpt=3',
  },
  {
    title: 'Pennsylvania Department of Revenue — PA-40 Schedule SP, Special Tax Forgiveness',
    url: 'https://www.pa.gov/agencies/revenue/forms-and-publications/pa-personal-income-tax-guide/tax-forgiveness.html',
  },
];

function pennsylvania(year: number): StateIncomeTaxDefinition | undefined {
  if (year !== 2025 && year !== 2026) return undefined;
  return {
    code: 'PA',
    name: 'Pennsylvania',
    year,
    // Nothing in the Pennsylvania computation is indexed. The rate has been
    // 3.07% since 2004 and the forgiveness table since 2003.
    status: 'published',
    base: 'stateDefined',
    stateDefinedBase: {
      field: 'pennsylvaniaTaxableIncome',
      why:
        'Pennsylvania taxes eight classes of income with no standard deduction, no personal ' +
        'exemption, and no deduction for 401(k) elective deferrals, so federal AGI is not a ' +
        'usable substitute.',
    },
    rate: { kind: 'flat', rate: 0.0307 },
    deduction: { kind: 'none' },
    forgiveness: {
      name: 'Special Tax Forgiveness',
      base: 6500,
      perDependent: 9500,
      increment: 250,
      reductionPerIncrement: 0.1,
    },
    notes: [
      'Pennsylvania does not start from federal AGI. It taxes eight classes of income separately, with no standard deduction, no personal exemption, and no deduction for 401(k) or 403(b) elective deferrals — those are taxable in Pennsylvania in the year contributed. Passing federal AGI in as the Pennsylvania base understates the tax for anyone contributing to a retirement plan.',
      'Losses in one Pennsylvania income class cannot offset gains in another. A filer with a $20,000 business loss and $80,000 of wages pays Pennsylvania tax on the full $80,000.',
      'Special Tax Forgiveness is a staircase, not a phase-out: full forgiveness up to the allowance, then ten percentage points less for each $250 of eligibility income above it, reaching zero $2,500 later. Because each step forgives ten points less of the WHOLE tax, the cost of a step grows with the household. Across the band a single filer faces about 11% and a single parent of two about 34%, against a statutory 3.07%.',
      'Eligibility income for forgiveness is broader than Pennsylvania taxable income: it adds non-taxable interest, gifts and awards over $300, and support received from others. This package defaults it to taxable income; pass `pennsylvaniaEligibilityIncome` when they differ.',
      'Pennsylvania is not the whole bill. Almost every Pennsylvania municipality and school district levies a local earned income tax, typically 1% and 3.75%+ in Philadelphia. This package computes the state tax only.',
      'Pennsylvania does not tax Social Security benefits or distributions from qualified retirement plans taken after retirement age.',
    ],
    citations: PA_CITATIONS,
  };
}

export function utahAndPennsylvania(year: number): StateIncomeTaxDefinition[] {
  return [utah(year), pennsylvania(year)].filter(
    (d): d is StateIncomeTaxDefinition => d !== undefined,
  );
}
