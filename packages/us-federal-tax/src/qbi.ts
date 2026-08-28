/**
 * Section 199A — the qualified business income deduction.
 *
 * Broadly, 20% of qualified business income. The whole difficulty is in the
 * three limitations, which interact in an order that is easy to get wrong:
 *
 * 1. **The SSTB phase-out.** A specified service trade or business is fully
 *    qualified below the threshold, partially qualified across the phase-in
 *    range, and not a qualified trade or business at all above it. The
 *    applicable percentage reduces the business's QBI, its W-2 wages *and* its
 *    UBIA — not just the income.
 * 2. **The W-2 wage and qualified property cap.** Above the threshold each
 *    business's deduction is capped at the greater of 50% of its W-2 wages or
 *    25% of wages plus 2.5% of UBIA. The cap phases in linearly across the same
 *    range, so a filer in the middle of it is limited by half of the excess.
 * 3. **The taxable income limit.** The whole deduction is capped at 20% of
 *    taxable income less net capital gain.
 *
 * Everything keys off **taxable income figured without this deduction**, which
 * is AGI less the standard or itemized deduction *and* less the Schedule 1-A
 * total on Form 1040 line 13b. That last subtraction is new with the OBBBA
 * deductions and the IRS had to reissue the 2025 Form 8995-A instructions to say
 * it — see the citation in `data/2026.ts`. Getting it wrong pushes a filer with
 * tips or overtime income up into a phase-out they are not actually in.
 *
 * Two things are new for 2026 and both come from OBBBA § 70105:
 *
 * - The phase-in range widened from $50,000/$100,000 to $75,000/$150,000.
 * - A new § 199A(i) floor gives at least $400 to a filer with at least $1,000 of
 *   QBI from a business they materially participate in.
 */

import { getYearParameters, nonNegative, roundCents } from './core.js';
import type {
  FilingStatus,
  QbiBusinessDetail,
  QbiDeductionResult,
  QualifiedBusiness,
  Section199AParameters,
} from './types.js';

export interface QbiDeductionInput {
  readonly filingStatus: FilingStatus;
  readonly year?: number;
  /**
   * Taxable income figured **without** this deduction: AGI, less the standard or
   * itemized deduction, less the Schedule 1-A total. May be negative.
   */
  readonly taxableIncomeBeforeQbiDeduction: number;
  /** Each trade or business separately. Losses in one offset income in another. */
  readonly businesses?: readonly QualifiedBusiness[];
  /**
   * Net capital gain, which for this purpose includes qualified dividends
   * (§ 1(h)(11)). Subtracted before the 20%-of-taxable-income limit, since
   * preferentially taxed income does not support the deduction.
   */
  readonly netCapitalGain?: number;
  /** Qualified REIT dividends. Deductible at 20% with no wage or UBIA cap. */
  readonly qualifiedReitDividends?: number;
  /** Qualified publicly traded partnership income, which may be negative. */
  readonly qualifiedPtpIncome?: number;
  /**
   * Prior-year qualified business net loss carryforward, supplied as a negative
   * number (or a positive one, which is treated as the same loss). Form 8995
   * line 3.
   */
  readonly qualifiedBusinessNetLossCarryforward?: number;
  /** Prior-year REIT/PTP loss carryforward. Form 8995 line 7. */
  readonly reitPtpLossCarryforward?: number;
}

/** The § 199A parameters for a year. */
export function section199AParameters(year?: number): Section199AParameters {
  return getYearParameters(year).section199A;
}

function finite(value: number | undefined, name: string): number {
  if (value === undefined) return 0;
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new TypeError(`${name} must be a number, received ${String(value)}`);
  }
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite, received ${value}`);
  }
  return value;
}

/** Carryforwards are losses however they are signed, so normalise to <= 0. */
function asLoss(value: number | undefined, name: string): number {
  return -Math.abs(finite(value, name));
}

/**
 * Compute the § 199A deduction.
 *
 * The result carries every intermediate figure — per business, and for the
 * return as a whole — because a QBI number nobody can explain is a QBI number
 * nobody will trust.
 *
 * Not modelled: the § 199A(g) domestic production activities deduction for
 * agricultural and horticultural cooperatives, the patron reduction under
 * § 199A(b)(7), and the elective aggregation of multiple trades or businesses
 * under Reg. § 1.199A-4 (aggregate before calling if you have made that
 * election, by passing the group as a single business).
 */
export function qbiDeduction(input: QbiDeductionInput): QbiDeductionResult {
  const params = getYearParameters(input.year);
  const year = params.year;
  const p = params.section199A;
  const { filingStatus } = input;

  const threshold = p.thresholdAmount[filingStatus];
  if (threshold === undefined) {
    throw new TypeError(`Unknown filing status: ${String(filingStatus)}`);
  }
  const range = p.phaseInRange[filingStatus];

  const taxableIncomeBefore = finite(
    input.taxableIncomeBeforeQbiDeduction,
    'taxableIncomeBeforeQbiDeduction',
  );

  const excess = Math.max(0, taxableIncomeBefore - threshold);
  // A zero-width range would make every dollar of excess fully phased in; the
  // clamp keeps that well defined rather than producing Infinity or NaN.
  const reductionRatio = range > 0 ? Math.min(1, excess / range) : excess > 0 ? 1 : 0;
  const applicablePercentage = 1 - reductionRatio;

  // --- Per business: SSTB applicable percentage, then loss netting, then the cap.

  const businesses = input.businesses ?? [];
  const included = businesses.map((business, i) => {
    const name = business.name ?? `Business ${i + 1}`;
    const qbi = finite(business.qualifiedBusinessIncome, `${name}.qualifiedBusinessIncome`);
    const wages = nonNegative(business.w2Wages, `${name}.w2Wages`);
    const ubia = nonNegative(
      business.unadjustedBasisOfQualifiedProperty,
      `${name}.unadjustedBasisOfQualifiedProperty`,
    );
    const isSstb = business.isSpecifiedServiceTradeOrBusiness === true;
    // Schedule A (Form 8995-A) applies the applicable percentage to all three
    // amounts, so an SSTB halfway through the range keeps half its wages too.
    const pct = isSstb ? applicablePercentage : 1;
    return {
      name,
      qbi,
      isSstb,
      pct,
      includedQbi: qbi * pct,
      includedWages: wages * pct,
      includedUbia: ubia * pct,
      materiallyParticipates: business.materiallyParticipates !== false,
    };
  });

  // Reg. § 1.199A-1(d)(2)(iii): a prior-year loss is carried in as if it were a
  // separate trade or business with no W-2 wages and no qualified property.
  const carriedLoss = asLoss(
    input.qualifiedBusinessNetLossCarryforward,
    'qualifiedBusinessNetLossCarryforward',
  );

  const positiveTotal = included.reduce((sum, b) => sum + Math.max(0, b.includedQbi), 0);
  const negativeTotal =
    included.reduce((sum, b) => sum + Math.min(0, b.includedQbi), 0) + carriedLoss;
  const netTotal = positiveTotal + negativeTotal;

  // A net loss zeroes the QBI component and rolls forward; otherwise the loss is
  // spread across the profitable businesses in proportion to their income.
  const survivingShare = netTotal <= 0 || positiveTotal <= 0 ? 0 : netTotal / positiveTotal;
  const qualifiedBusinessNetLossCarryforward = netTotal < 0 ? netTotal : 0;

  const details: QbiBusinessDetail[] = included.map((b) => {
    const netQbi = b.includedQbi > 0 ? b.includedQbi * survivingShare : 0;
    const tentative = p.deductionRate * netQbi;
    // A business whose QBI was wiped out contributes no wages or property either.
    const contributes = netQbi > 0;
    const wageOnly = contributes ? p.w2WageRate * b.includedWages : 0;
    const wagePlusProperty = contributes
      ? p.w2WageAlternativeRate * b.includedWages + p.qualifiedPropertyRate * b.includedUbia
      : 0;
    const cap = Math.max(wageOnly, wagePlusProperty);

    // Form 8995-A Part II line 13 / Part III line 26. Below the threshold
    // `reductionRatio` is 0, so the cap does not bind at all.
    const overCap = Math.max(0, tentative - cap);
    const phaseInReduction = reductionRatio * overCap;
    const component = Math.max(0, tentative - phaseInReduction);

    return {
      name: b.name,
      qualifiedBusinessIncome: roundCents(b.qbi),
      isSpecifiedServiceTradeOrBusiness: b.isSstb,
      applicablePercentage: b.pct,
      includedQualifiedBusinessIncome: roundCents(b.includedQbi),
      includedW2Wages: roundCents(b.includedWages),
      includedQualifiedProperty: roundCents(b.includedUbia),
      netQualifiedBusinessIncome: roundCents(netQbi),
      tentativeDeduction: roundCents(tentative),
      wageAndPropertyLimit: roundCents(cap),
      phaseInReduction: roundCents(phaseInReduction),
      component: roundCents(component),
    };
  });

  const qbiComponent = details.reduce((sum, d) => sum + d.component, 0);

  // --- REIT and PTP income: 20%, with no wage or property cap of its own.

  const reitPtpTotal =
    nonNegative(input.qualifiedReitDividends, 'qualifiedReitDividends') +
    finite(input.qualifiedPtpIncome, 'qualifiedPtpIncome') +
    asLoss(input.reitPtpLossCarryforward, 'reitPtpLossCarryforward');
  const reitPtpComponent = p.deductionRate * Math.max(0, reitPtpTotal);
  const reitPtpLossCarryforward = reitPtpTotal < 0 ? reitPtpTotal : 0;

  const combined = qbiComponent + reitPtpComponent;

  // --- The taxable income limit.

  const netCapitalGain = nonNegative(input.netCapitalGain, 'netCapitalGain');
  const taxableIncomeLimit =
    p.deductionRate * Math.max(0, taxableIncomeBefore - netCapitalGain);
  const beforeMinimum = Math.min(combined, taxableIncomeLimit);

  // --- § 199A(i), new for 2026.

  // "Aggregate qualified business income from active qualified trades or
  // businesses" — so the test runs on QBI *after* the SSTB applicable
  // percentage, not before it. Above the phase-in range an SSTB is not a
  // qualified trade or business at all under § 199A(d)(1)(A), and a consultant
  // earning $500,000 does not get $400 back through this door.
  //
  // The prior-year loss carryforward is deliberately not netted here: it is not
  // this year's qualified business income.
  const activeQbi = included.reduce(
    (sum, b) => (b.materiallyParticipates ? sum + b.includedQbi : sum),
    0,
  );
  const floor =
    p.minimumDeduction !== null &&
    activeQbi >= p.minimumDeduction.activeQualifiedBusinessIncomeFloor
      ? p.minimumDeduction.amount
      : 0;
  // The floor is a floor under the deduction itself, so it survives the taxable
  // income limit — which is the point of it, since the filers it is aimed at are
  // exactly the ones whose taxable income is small.
  const deduction = Math.max(beforeMinimum, floor);

  return {
    year,
    filingStatus,
    taxableIncomeBeforeDeduction: roundCents(taxableIncomeBefore),
    thresholdAmount: threshold,
    phaseInRange: range,
    excessOverThreshold: roundCents(excess),
    reductionRatio,
    applicablePercentage,
    businesses: details,
    qbiComponent: roundCents(qbiComponent),
    reitPtpComponent: roundCents(reitPtpComponent),
    combinedQualifiedBusinessIncomeAmount: roundCents(combined),
    taxableIncomeLimit: roundCents(taxableIncomeLimit),
    limitedByTaxableIncome: taxableIncomeLimit < combined,
    minimumDeduction: floor,
    appliedMinimumDeduction: floor > beforeMinimum,
    deduction: roundCents(deduction),
    qualifiedBusinessNetLossCarryforward: roundCents(qualifiedBusinessNetLossCarryforward),
    reitPtpLossCarryforward: roundCents(reitPtpLossCarryforward),
  };
}
