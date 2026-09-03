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
import type { StateIncomeTaxDefinition } from '../definition.js';
import { byStatus } from './helpers.js';
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
];

const UT_NOTES: readonly string[] = [
  "Utah's statutory rate is not its marginal rate for most working filers. The Taxpayer Tax Credit is 6% of the federal standard or itemized deduction plus $2,111 per dependent, reduced by 1.3 cents for each dollar of Utah taxable income above $18,213 ($36,426 joint). Inside that band the true marginal rate is the statutory rate plus 1.3 points — 5.75% in 2026 against a headline 4.45%.",
  'The credit depends on the FEDERAL deduction, so Utah is a federal-AGI state whose credit is nonetheless sensitive to changes below AGI. The OBBBA standard deduction increase raised the Utah credit by 6% of the increase — about $69 for a single filer in 2025 — cutting Utah tax with no Utah legislation.',
  'Utah cut its rate twice in two years: 4.55% for 2024, 4.5% for 2025 (HB 106), and 4.45% for 2026 (SB 60).',
  'Not modelled: the Utah credits for Social Security benefits, retirement income, at-home parents, and 529 contributions, and the Utah child tax credit. A retiree or a family return computed here will be too high.',
  "Utah's earned income credit is 20% of the federal credit and is NON-REFUNDABLE — Utah Code § 59-10-1044 sits in Part 10, the Nonrefundable Tax Credit Act. It is the only state credit in this package that is a share of the federal credit and cannot be paid out, and the difference is the whole point of the credit for the filers it is aimed at: a Utah single parent whose Taxpayer Tax Credit already wipes out their tax receives nothing from it.",
];

function utah(year: number): StateIncomeTaxDefinition | undefined {
  if (year !== 2025 && year !== 2026) return undefined;
  return {
    code: 'UT',
    name: 'Utah',
    year,
    status: year === 2025 ? 'published' : 'provisional',
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
    notes:
      year === 2026
        ? [
            'PROVISIONAL: the $2,111 per-dependent exemption amount and the $18,213/$36,426/$27,320 phase-out thresholds are the published 2025 figures carried forward. Utah indexes them annually and had not published the 2026 amounts when this was written. The 4.45% rate is set by SB 60 (2026) and is correct.',
            ...UT_NOTES,
          ]
        : UT_NOTES,
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
