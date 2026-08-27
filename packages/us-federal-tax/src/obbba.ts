/**
 * The four temporary deductions created by the One Big Beautiful Bill Act
 * (Pub. L. 119-21, enacted 2025-07-04) and claimed on Schedule 1-A (Form 1040):
 *
 * - qualified tips (26 U.S.C. § 224)
 * - qualified overtime compensation (26 U.S.C. § 225)
 * - the enhanced deduction for seniors (OBBBA § 70103, amending § 151)
 * - qualified passenger vehicle loan interest (26 U.S.C. § 163(h)(4))
 *
 * All four run from tax year 2025 through 2028 and are available whether or not
 * the filer itemizes. None of them is an adjustment to income: they are claimed
 * *below* AGI on Form 1040 line 13b, so they reduce taxable income without
 * touching AGI, the MAGI that drives their own phase-outs, or the NIIT.
 *
 * The interesting part is that the phase-outs do not agree with each other, and
 * the disagreements are worth real money:
 *
 * | Deduction        | Reduction               | Partial increment |
 * | ---------------- | ----------------------- | ----------------- |
 * | Tips             | $100 per $1,000          | dropped          |
 * | Overtime         | $100 per $1,000          | dropped          |
 * | Vehicle interest | $200 per $1,000          | **rounded up**   |
 * | Senior           | 6% of the excess         | n/a — continuous |
 *
 * A filer $1 over the vehicle-interest threshold loses $200. A filer $999 over
 * the tips threshold loses nothing. Implementations that model both as a flat
 * percentage of the excess get both wrong.
 */

import { getYearParameters, nonNegative, roundCents } from './core.js';
import type {
  AdditionalDeductionPart,
  AdditionalDeductionsResult,
  FilingStatus,
  ScheduleOneAParameters,
  SteppedPhaseOut,
} from './types.js';

const NO_DEDUCTION: AdditionalDeductionPart = {
  deduction: 0,
  cappedAmount: 0,
  phaseOutReduction: 0,
  excessIncome: 0,
  ineligible: true,
};

/**
 * The parameters for a year's Schedule 1-A deductions, or `null` when the year
 * has none in effect.
 *
 * Returns `null` rather than throwing for a supported year that is past the 2028
 * sunset, so callers can distinguish "these deductions expired" from "this year
 * is unknown" — the latter still throws {@link UnsupportedYearError}.
 */
export function scheduleOneAParameters(year?: number): ScheduleOneAParameters | null {
  const params = getYearParameters(year);
  const schedule = params.scheduleOneA;
  if (!schedule) return null;
  return params.year <= schedule.finalYear ? schedule : null;
}

function isEligible(schedule: ScheduleOneAParameters, filingStatus: FilingStatus): boolean {
  return !schedule.ineligibleFilingStatuses.includes(filingStatus);
}

/**
 * Reduction produced by a stepped phase-out.
 *
 * Note the increments are counted, not prorated: `rounding` decides whether a
 * partial increment is dropped (tips, overtime) or counted in full (vehicle
 * loan interest).
 */
function steppedReduction(excess: number, phaseOut: SteppedPhaseOut): number {
  if (excess <= 0) return 0;
  const raw = excess / phaseOut.increment;
  const increments = phaseOut.rounding === 'up' ? Math.ceil(raw) : Math.floor(raw);
  return increments * phaseOut.amountPerIncrement;
}

function part(
  cappedAmount: number,
  excessIncome: number,
  reduction: number,
): AdditionalDeductionPart {
  return {
    deduction: roundCents(Math.max(0, cappedAmount - reduction)),
    cappedAmount: roundCents(cappedAmount),
    phaseOutReduction: roundCents(reduction),
    excessIncome: roundCents(excessIncome),
    ineligible: false,
  };
}

function threshold(
  thresholds: Readonly<Record<FilingStatus, number>>,
  filingStatus: FilingStatus,
): number {
  const value = thresholds[filingStatus];
  if (value === undefined) {
    throw new TypeError(`Unknown filing status: ${String(filingStatus)}`);
  }
  return value;
}

/**
 * Qualified tips deduction (26 U.S.C. § 224).
 *
 * Capped at $25,000 **per return** — the cap is not doubled on a joint return,
 * which is the opposite of how the overtime cap behaves.
 *
 * `qualifiedTips` must already be limited to tips that actually qualify. The
 * statute and the final regulations exclude a great deal: only cash tips paid
 * voluntarily, only in an occupation on the Treasury list of occupations that
 * customarily and regularly received tips on or before 2024-12-31, and never
 * from a specified service trade or business under § 199A(d)(2). Service
 * charges and mandatory gratuities are not tips. This function cannot check any
 * of that for you, and does not pretend to.
 *
 * For a self-employed filer the deduction may not exceed net income from the
 * trade or business in which the tips were earned — pass that ceiling as
 * `selfEmploymentIncomeLimit`.
 */
export function qualifiedTipsDeduction(options: {
  qualifiedTips: number;
  modifiedAdjustedGrossIncome: number;
  filingStatus: FilingStatus;
  year?: number;
  /** Net income from the trade or business in which the tips were earned. */
  selfEmploymentIncomeLimit?: number;
}): AdditionalDeductionPart {
  const schedule = scheduleOneAParameters(options.year);
  if (!schedule || !isEligible(schedule, options.filingStatus)) return NO_DEDUCTION;

  const tips = nonNegative(options.qualifiedTips, 'qualifiedTips');
  const magi = nonNegative(options.modifiedAdjustedGrossIncome, 'modifiedAdjustedGrossIncome');

  let capped = Math.min(tips, schedule.tips.cap);
  if (options.selfEmploymentIncomeLimit !== undefined) {
    capped = Math.min(
      capped,
      nonNegative(options.selfEmploymentIncomeLimit, 'selfEmploymentIncomeLimit'),
    );
  }

  const excess = Math.max(
    0,
    magi - threshold(schedule.tips.phaseOut.thresholds, options.filingStatus),
  );
  return part(capped, excess, steppedReduction(excess, schedule.tips.phaseOut));
}

/**
 * Qualified overtime compensation deduction (26 U.S.C. § 225).
 *
 * `qualifiedOvertimeCompensation` is the **premium portion only** — the half of
 * "time and a half" that exceeds the regular rate, and only overtime required by
 * section 7 of the Fair Labor Standards Act. A worker paid $30/hour who works
 * 10 overtime hours at $45 has $150 of qualified overtime, not $450. Confusing
 * total overtime pay with the premium is the single most common error with this
 * deduction, and it overstates it threefold.
 */
export function qualifiedOvertimeDeduction(options: {
  /** The FLSA premium portion of overtime pay, not total overtime wages. */
  qualifiedOvertimeCompensation: number;
  modifiedAdjustedGrossIncome: number;
  filingStatus: FilingStatus;
  year?: number;
}): AdditionalDeductionPart {
  const schedule = scheduleOneAParameters(options.year);
  if (!schedule || !isEligible(schedule, options.filingStatus)) return NO_DEDUCTION;

  const overtime = nonNegative(
    options.qualifiedOvertimeCompensation,
    'qualifiedOvertimeCompensation',
  );
  const magi = nonNegative(options.modifiedAdjustedGrossIncome, 'modifiedAdjustedGrossIncome');

  const cap = threshold(schedule.overtime.cap, options.filingStatus);
  const capped = Math.min(overtime, cap);
  const excess = Math.max(
    0,
    magi - threshold(schedule.overtime.phaseOut.thresholds, options.filingStatus),
  );

  return part(capped, excess, steppedReduction(excess, schedule.overtime.phaseOut));
}

/**
 * Enhanced deduction for seniors (OBBBA § 70103, amending 26 U.S.C. § 151).
 *
 * $6,000 for each eligible individual — the filer, plus the spouse on a joint
 * return — so a joint return where both spouses are 65 or older starts at
 * $12,000. This is *in addition to* the long-standing extra standard deduction
 * for age, which is unaffected; see {@link standardDeduction}.
 *
 * The phase-out is applied to each individual's $6,000 separately and then
 * summed, which is how Schedule 1-A works it. Because the rate is 6% of the
 * whole excess with no rounding, the deduction is gone entirely at $175,000 of
 * MAGI (single) or $250,000 (joint), regardless of how many eligible
 * individuals there are.
 */
export function seniorDeduction(options: {
  modifiedAdjustedGrossIncome: number;
  filingStatus: FilingStatus;
  year?: number;
  age65OrOlder?: boolean;
  spouseAge65OrOlder?: boolean;
}): AdditionalDeductionPart {
  const schedule = scheduleOneAParameters(options.year);
  if (!schedule || !isEligible(schedule, options.filingStatus)) return NO_DEDUCTION;

  let eligibleIndividuals = options.age65OrOlder ? 1 : 0;
  // Only a joint return has a second eligible individual. A qualifying surviving
  // spouse files with the joint standard deduction but the spouse is deceased,
  // so there is no second person to count.
  if (options.filingStatus === 'marriedFilingJointly' && options.spouseAge65OrOlder) {
    eligibleIndividuals += 1;
  }
  if (eligibleIndividuals === 0) return NO_DEDUCTION;

  const magi = nonNegative(options.modifiedAdjustedGrossIncome, 'modifiedAdjustedGrossIncome');
  const excess = Math.max(
    0,
    magi - threshold(schedule.senior.phaseOutThreshold, options.filingStatus),
  );

  const perIndividualReduction = excess * schedule.senior.phaseOutRate;
  const capped = schedule.senior.amountPerEligibleIndividual * eligibleIndividuals;
  // Reduce each individual's amount before summing, so the total floors at zero
  // per person rather than in aggregate. With a uniform per-person amount the
  // two orderings agree, but the per-person form is what the form prescribes.
  const allowed =
    Math.max(0, schedule.senior.amountPerEligibleIndividual - perIndividualReduction) *
    eligibleIndividuals;

  return part(capped, excess, capped - allowed);
}

/**
 * Qualified passenger vehicle loan interest deduction (26 U.S.C. § 163(h)(4)).
 *
 * Up to $10,000 of interest on a loan taken out after 2024-12-31 to buy a new
 * personal-use vehicle whose final assembly happened in the United States, where
 * the loan is secured by a first lien on that vehicle. Leases, used vehicles,
 * refinancing of pre-2025 debt, and business-use vehicles do not qualify —
 * `qualifiedInterest` is assumed to be already filtered.
 *
 * Watch the phase-out: it reduces the deduction by $200 for each $1,000 of MAGI
 * excess **or portion thereof**. A single dollar over the threshold costs $200,
 * and the deduction is gone by $150,000 ($250,000 joint).
 */
export function vehicleLoanInterestDeduction(options: {
  qualifiedInterest: number;
  modifiedAdjustedGrossIncome: number;
  filingStatus: FilingStatus;
  year?: number;
}): AdditionalDeductionPart {
  const schedule = scheduleOneAParameters(options.year);
  if (!schedule || !isEligible(schedule, options.filingStatus)) return NO_DEDUCTION;

  const interest = nonNegative(options.qualifiedInterest, 'qualifiedInterest');
  const magi = nonNegative(options.modifiedAdjustedGrossIncome, 'modifiedAdjustedGrossIncome');

  const capped = Math.min(interest, schedule.vehicleLoanInterest.cap);
  const excess = Math.max(
    0,
    magi - threshold(schedule.vehicleLoanInterest.phaseOut.thresholds, options.filingStatus),
  );

  return part(capped, excess, steppedReduction(excess, schedule.vehicleLoanInterest.phaseOut));
}

export interface AdditionalDeductionsInput {
  filingStatus: FilingStatus;
  year?: number;
  /**
   * Adjusted gross income, *before* any of these deductions.
   *
   * These are below-the-line deductions, so they never feed back into the MAGI
   * used for their own phase-outs.
   */
  adjustedGrossIncome: number;
  /** Income excluded under § 911, § 931, or § 933, which MAGI adds back. */
  foreignEarnedIncomeExclusion?: number;
  qualifiedTips?: number;
  /** Net income from the trade or business in which self-employed tips were earned. */
  qualifiedTipsBusinessIncomeLimit?: number;
  /** FLSA premium portion of overtime pay only — not total overtime wages. */
  qualifiedOvertimeCompensation?: number;
  qualifiedVehicleLoanInterest?: number;
  age65OrOlder?: boolean;
  spouseAge65OrOlder?: boolean;
}

/**
 * The whole of Schedule 1-A: all four OBBBA deductions plus the line 13b total.
 *
 * Each part is returned separately with its cap, its phase-out reduction, and
 * whether the filer was ineligible outright, so a caller can show a filer why
 * their number is what it is.
 */
export function additionalDeductions(
  input: AdditionalDeductionsInput,
): AdditionalDeductionsResult {
  const params = getYearParameters(input.year);
  const { filingStatus } = input;
  const year = params.year;

  const agi = nonNegative(input.adjustedGrossIncome, 'adjustedGrossIncome');
  const excluded = nonNegative(
    input.foreignEarnedIncomeExclusion,
    'foreignEarnedIncomeExclusion',
  );
  const magi = agi + excluded;

  const tips = qualifiedTipsDeduction({
    qualifiedTips: nonNegative(input.qualifiedTips, 'qualifiedTips'),
    modifiedAdjustedGrossIncome: magi,
    filingStatus,
    year,
    selfEmploymentIncomeLimit: input.qualifiedTipsBusinessIncomeLimit,
  });

  const overtime = qualifiedOvertimeDeduction({
    qualifiedOvertimeCompensation: nonNegative(
      input.qualifiedOvertimeCompensation,
      'qualifiedOvertimeCompensation',
    ),
    modifiedAdjustedGrossIncome: magi,
    filingStatus,
    year,
  });

  const senior = seniorDeduction({
    modifiedAdjustedGrossIncome: magi,
    filingStatus,
    year,
    age65OrOlder: input.age65OrOlder,
    spouseAge65OrOlder: input.spouseAge65OrOlder,
  });

  const vehicleLoanInterest = vehicleLoanInterestDeduction({
    qualifiedInterest: nonNegative(
      input.qualifiedVehicleLoanInterest,
      'qualifiedVehicleLoanInterest',
    ),
    modifiedAdjustedGrossIncome: magi,
    filingStatus,
    year,
  });

  return {
    year,
    modifiedAdjustedGrossIncome: roundCents(magi),
    tips,
    overtime,
    senior,
    vehicleLoanInterest,
    total: roundCents(
      tips.deduction + overtime.deduction + senior.deduction + vehicleLoanInterest.deduction,
    ),
  };
}
