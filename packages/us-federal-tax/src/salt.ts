/**
 * The state and local tax deduction and its § 164(b)(6) cap.
 *
 * OBBBA § 70120 raised the cap from $10,000 to $40,000 for 2025, rising 1% a year
 * through 2029 and reverting to $10,000 in 2030. The headline is the bigger
 * number; the part that changes answers is the **phase-down** that came with it.
 *
 * Above $505,000 of modified AGI (2026; half that on a separate return) the cap
 * falls by 30 cents per dollar of income, stopping at a $10,000 floor. That
 * creates a band — $505,000 to $606,333.33 for most filers — in which each extra
 * dollar of income also destroys 30 cents of deduction. At a 35% bracket rate
 * that is an effective marginal rate of about 45.5%, higher than the 37% band
 * above it. The marginal rate goes up, and then back down.
 *
 * Nothing about that is visible if `itemizedDeductions` is taken at face value,
 * which is why this is worth computing rather than assuming.
 */

import { getYearParameters, nonNegative, roundCents } from './core.js';
import type { FilingStatus, SaltCapParameters, SaltDeductionResult } from './types.js';

export interface SaltDeductionInput {
  readonly filingStatus: FilingStatus;
  readonly year?: number;
  /**
   * State and local taxes actually paid: income tax **or** general sales tax
   * (not both), plus real property tax and personal property tax.
   */
  readonly stateAndLocalTaxesPaid: number;
  /** Adjusted gross income, before the § 911/931/933 add-back below. */
  readonly adjustedGrossIncome: number;
  /**
   * Income excluded under § 911, § 931 or § 933, added back to reach the
   * modified AGI the phase-down runs on. Same definition Schedule 1-A uses.
   */
  readonly foreignEarnedIncomeExclusion?: number;
}

/** The SALT cap parameters for a year. */
export function saltCapParameters(year?: number): SaltCapParameters {
  return getYearParameters(year).saltCap;
}

/**
 * The deductible amount of state and local taxes.
 *
 * Note this is the cap only. Whether it is worth claiming at all depends on
 * whether total itemized deductions beat the standard deduction, which
 * {@link estimateFederalTax} decides.
 */
export function stateAndLocalTaxDeduction(input: SaltDeductionInput): SaltDeductionResult {
  const params = getYearParameters(input.year);
  const year = params.year;
  const p = params.saltCap;
  const { filingStatus } = input;

  const statutoryCap = p.cap[filingStatus];
  if (statutoryCap === undefined) {
    throw new TypeError(`Unknown filing status: ${String(filingStatus)}`);
  }
  const threshold = p.phaseDownThreshold[filingStatus];
  const floor = p.floor[filingStatus];

  const paid = nonNegative(input.stateAndLocalTaxesPaid, 'stateAndLocalTaxesPaid');
  const magi =
    nonNegative(input.adjustedGrossIncome, 'adjustedGrossIncome') +
    nonNegative(input.foreignEarnedIncomeExclusion, 'foreignEarnedIncomeExclusion');

  const excess = Math.max(0, magi - threshold);
  // The reduction is continuous — no increments, no rounding. Unlike the
  // Schedule 1-A phase-outs, a single dollar of excess costs exactly 30 cents.
  const uncappedReduction = p.phaseDownRate * excess;
  const cap = Math.max(floor, statutoryCap - uncappedReduction);
  const reduction = statutoryCap - cap;

  const deduction = Math.min(paid, cap);

  return {
    year,
    filingStatus,
    stateAndLocalTaxesPaid: roundCents(paid),
    modifiedAdjustedGrossIncome: roundCents(magi),
    statutoryCap,
    phaseDownThreshold: threshold,
    excessIncome: roundCents(excess),
    phaseDownReduction: roundCents(reduction),
    floor,
    cap: roundCents(cap),
    deduction: roundCents(deduction),
    limitedByCap: paid > cap,
  };
}
