/**
 * The two credits that decide most ordinary returns: the § 24 child tax credit
 * and the § 32 earned income credit.
 *
 * Everything else in this package computes tax. This file computes what comes
 * off it, and the distinction between the two kinds matters more than the
 * amounts do:
 *
 * - A **non-refundable** credit can only reduce *income tax*, and only to zero.
 *   The limit is the § 26(a) regular tax liability — ordinary income tax plus
 *   the tax on long-term capital gains. Self-employment tax, Net Investment
 *   Income Tax and Additional Medicare Tax are not chapter 1 subchapter A
 *   liabilities, and a non-refundable credit cannot touch them. A freelancer
 *   with two children and $30,000 of profit owes SE tax that the child tax
 *   credit does not reduce by one cent; subtracting credits from a single
 *   "total tax" figure gets that wrong in the filer's favour, which is the
 *   expensive direction.
 * - A **refundable** credit is paid out whether or not any tax is due. The EITC
 *   is fully refundable; the child tax credit is refundable only up to $1,700
 *   per child and only to the extent earned income phases it in.
 *
 * Three details in here are worth more than the rest put together:
 *
 * 1. **The § 24(b)(1) phase-out rounds up.** "$50 for each $1,000 (or fraction
 *    thereof)" means the excess is rounded up to a whole $1,000 first. A joint
 *    filer at $400,001 loses $50, not five cents.
 * 2. **Earned income is net of half of self-employment tax.** § 32(c)(2)(A)(ii)
 *    defines net earnings from self-employment "determined with regard to the
 *    deduction allowed to the taxpayer by section 164(f)". Using gross Schedule C
 *    profit overstates the EITC for anyone self-employed, and the same definition
 *    drives the § 24(d)(1)(B)(i) refundable phase-in.
 * 3. **The § 32 phase-out runs on the greater of earned income and AGI.**
 *    § 32(a)(2)(B) says "adjusted gross income (or, if greater, the earned
 *    income)", so a filer cannot phase the credit back in with above-the-line
 *    deductions.
 */

import { getYearParameters, nonNegative, roundCents } from './core.js';
import type {
  ChildTaxCreditParameters,
  ChildTaxCreditResult,
  EarnedIncomeCreditParameters,
  EarnedIncomeCreditResult,
  EarnedIncomeCreditRow,
  FilingStatus,
  SteppedPhaseOut,
} from './types.js';

/** § 24 parameters for a year. */
export function childTaxCreditParameters(year?: number): ChildTaxCreditParameters {
  return getYearParameters(year).childTaxCredit;
}

/** § 32 parameters for a year. */
export function earnedIncomeCreditParameters(year?: number): EarnedIncomeCreditParameters {
  return getYearParameters(year).earnedIncomeCredit;
}

/**
 * The § 32(b) table row for a number of qualifying children.
 *
 * Three and thirteen children get the same row: § 32(b)(1) tops out at "3 or
 * more", so the table is not extended past its last entry.
 */
export function earnedIncomeCreditRow(
  qualifyingChildren: number,
  year?: number,
): EarnedIncomeCreditRow {
  const table = earnedIncomeCreditParameters(year).table;
  const index = Math.min(Math.max(0, Math.floor(qualifyingChildren)), table.length - 1);
  const row = table[index];
  if (row === undefined) {
    throw new RangeError(`No earned income credit table row for ${qualifyingChildren} children`);
  }
  return row;
}

/**
 * Reduction from a "$X for each $Y (or fraction thereof)" phase-out.
 *
 * Shared in shape with the Schedule 1-A phase-outs but not in direction: § 24
 * always rounds up, so a partial increment costs the full amount.
 */
function steppedReduction(excess: number, phaseOut: SteppedPhaseOut): number {
  if (excess <= 0) return 0;
  const raw = excess / phaseOut.increment;
  const increments = phaseOut.rounding === 'up' ? Math.ceil(raw) : Math.floor(raw);
  return increments * phaseOut.amountPerIncrement;
}

/**
 * Earned income as § 32(c)(2) defines it, which is *not* gross business income.
 *
 * Wages count in full. Self-employment counts as net earnings from
 * self-employment reduced by the § 164(f) deduction — one half of the
 * self-employment tax. For a sole proprietor with $30,000 of Schedule C profit
 * that is $27,705 of net earnings less $2,119 of deduction, so $25,586 of earned
 * income rather than $30,000. At the 45% phase-in rate for three children the
 * difference is nearly $2,000 of credit.
 */
export function earnedIncomeForCredits(options: {
  /** W-2 wages, plus any other compensation for services. */
  readonly wages?: number;
  /** Net earnings from self-employment — 92.35% of Schedule C profit. */
  readonly selfEmploymentNetEarnings?: number;
  /** The § 164(f) deduction: one half of self-employment tax. */
  readonly deductibleHalfOfSelfEmploymentTax?: number;
}): number {
  const wages = nonNegative(options.wages, 'wages');
  const netEarnings = nonNegative(
    options.selfEmploymentNetEarnings,
    'selfEmploymentNetEarnings',
  );
  const deduction = nonNegative(
    options.deductibleHalfOfSelfEmploymentTax,
    'deductibleHalfOfSelfEmploymentTax',
  );
  return Math.max(0, wages + netEarnings - deduction);
}

export interface EarnedIncomeCreditInput {
  readonly filingStatus: FilingStatus;
  readonly year?: number;
  /** Earned income under § 32(c)(2) — see {@link earnedIncomeForCredits}. */
  readonly earnedIncome: number;
  readonly adjustedGrossIncome: number;
  /** Children meeting the § 32(c)(3) relationship, residency and age tests. */
  readonly qualifyingChildren?: number;
  /**
   * § 32(i) disqualified income: taxable and tax-exempt interest, dividends, net
   * capital gain, net rental and royalty income, and net passive income. One
   * dollar over the limit disallows the whole credit.
   */
  readonly investmentIncome?: number;
  /**
   * Age of the filer, required only when there are no qualifying children —
   * § 32(c)(1)(A)(ii)(II) restricts the childless credit to ages 25 to 64. On a
   * joint return, pass the age of whichever spouse qualifies.
   */
  readonly age?: number;
  /**
   * Whether a married filer who is filing separately satisfies § 32(d)(2): they
   * lived with a qualifying child for more than half the year and either did not
   * share a residence with their spouse for the last six months, or are legally
   * separated and not members of the same household.
   *
   * Defaults to `false`, which bars the credit. This is the one § 32 condition
   * that cannot be inferred from any other input, and getting it wrong in the
   * permissive direction hands the credit to filers who are not entitled to it.
   */
  readonly separatedFromSpouse?: boolean;
}

/**
 * The § 32 earned income credit.
 *
 * The shape of the credit is a trapezoid: it rises at the credit percentage,
 * plateaus at the maximum, and falls at the phase-out percentage. § 32(a) states
 * that as `min(phased-in amount, maximum - reduction)` rather than as a piecewise
 * function, and the two differ for a filer whose AGI exceeds their earned income
 * while still on the way up.
 */
export function earnedIncomeCredit(input: EarnedIncomeCreditInput): EarnedIncomeCreditResult {
  const params = getYearParameters(input.year);
  const year = params.year;
  const p = params.earnedIncomeCredit;
  const { filingStatus } = input;

  const children = Math.max(0, Math.floor(input.qualifyingChildren ?? 0));
  const row = earnedIncomeCreditRow(children, year);
  const phaseOutStart = row.phaseOutStart[filingStatus];
  if (phaseOutStart === undefined) {
    throw new TypeError(`Unknown filing status: ${String(filingStatus)}`);
  }

  const earnedIncome = nonNegative(input.earnedIncome, 'earnedIncome');
  const agi = nonNegative(input.adjustedGrossIncome, 'adjustedGrossIncome');
  const investmentIncome = nonNegative(input.investmentIncome, 'investmentIncome');

  // The whole trapezoid, computed even when the filer turns out to be
  // ineligible, so the result explains what they would have received.
  const phasedInCredit = Math.min(row.maximumCredit, row.creditRate * earnedIncome);
  const phaseOutIncome = Math.max(earnedIncome, agi);
  const phaseOutReduction = Math.max(0, row.phaseOutRate * (phaseOutIncome - phaseOutStart));
  const limitation = Math.max(0, row.maximumCredit - phaseOutReduction);
  // Where the two lines cross zero. Published by the IRS as the "completed
  // phaseout amount"; derived here so the two can be checked against each other.
  const completedPhaseOut = phaseOutStart + row.maximumCredit / row.phaseOutRate;

  const ineligibleReason = eitcIneligibleReason({
    filingStatus,
    children,
    earnedIncome,
    investmentIncome,
    limit: p.maximumInvestmentIncome,
    age: input.age,
    ageRange: p.childlessAgeRange,
    separatedFromSpouse: input.separatedFromSpouse === true,
  });

  const credit = ineligibleReason === null ? Math.min(phasedInCredit, limitation) : 0;

  return {
    year,
    filingStatus,
    qualifyingChildren: children,
    earnedIncome: roundCents(earnedIncome),
    adjustedGrossIncome: roundCents(agi),
    creditRate: row.creditRate,
    phaseOutRate: row.phaseOutRate,
    maximumCredit: row.maximumCredit,
    phasedInCredit: roundCents(phasedInCredit),
    phaseOutStart,
    phaseOutIncome: roundCents(phaseOutIncome),
    phaseOutReduction: roundCents(phaseOutReduction),
    completedPhaseOut: roundCents(completedPhaseOut),
    investmentIncome: roundCents(investmentIncome),
    investmentIncomeLimit: p.maximumInvestmentIncome,
    ineligibleReason,
    credit: roundCents(credit),
  };
}

function eitcIneligibleReason(options: {
  filingStatus: FilingStatus;
  children: number;
  earnedIncome: number;
  investmentIncome: number;
  limit: number;
  age: number | undefined;
  ageRange: { readonly minimum: number; readonly maximum: number };
  separatedFromSpouse: boolean;
}): EarnedIncomeCreditResult['ineligibleReason'] {
  // § 32(i) is a cliff and it is tested before anything else.
  if (options.investmentIncome > options.limit) return 'investmentIncomeTooHigh';

  // § 32(d): a married filer must file jointly, unless § 32(d)(2) applies — and
  // that exception itself requires a qualifying child.
  if (options.filingStatus === 'marriedFilingSeparately') {
    if (!options.separatedFromSpouse || options.children === 0) return 'filingSeparately';
  }

  // § 32(c)(1)(A)(ii)(II) applies only to a filer with no qualifying children.
  if (options.children === 0 && options.age !== undefined) {
    if (options.age < options.ageRange.minimum || options.age > options.ageRange.maximum) {
      return 'ageOutsideChildlessRange';
    }
  }

  if (options.earnedIncome <= 0) return 'noEarnedIncome';
  return null;
}

export interface ChildTaxCreditInput {
  readonly filingStatus: FilingStatus;
  readonly year?: number;
  /** Children under 17 at year end with a work-authorized SSN — § 24(c), § 24(h)(7). */
  readonly qualifyingChildren?: number;
  /**
   * Dependents who are not qualifying children: children who turned 17, and
   * dependent parents or other relatives under § 152. Worth $500 each and never
   * refundable.
   */
  readonly otherDependents?: number;
  readonly adjustedGrossIncome: number;
  /** Income excluded under § 911, § 931 or § 933, added back to reach MAGI. */
  readonly foreignEarnedIncomeExclusion?: number;
  /**
   * The § 26(a) regular tax liability: income tax on ordinary income plus tax on
   * long-term capital gains, after any other non-refundable credits. **Not** the
   * total tax — see the note at the top of this file.
   *
   * § 26(a) also adds the § 55 alternative minimum tax to the ceiling. This
   * package does not model AMT, so a filer who owes it has a slightly larger
   * ceiling than computed here — which shifts credit from the refundable column
   * to the non-refundable one without changing the total. That is the safe
   * direction to be wrong in, and it is stated in the README.
   */
  readonly incomeTaxBeforeCredits: number;
  /** Earned income under § 32(c)(2) — see {@link earnedIncomeForCredits}. */
  readonly earnedIncome?: number;
  /**
   * Social security taxes under § 24(d)(2): the employee share of OASDI and
   * Medicare withheld, plus Additional Medicare Tax, plus one half of
   * self-employment tax, less any excess OASDI withheld by two employers.
   *
   * Only consulted with three or more qualifying children.
   */
  readonly socialSecurityTaxes?: number;
  /** The earned income credit, which the § 24(d)(1)(B)(ii) alternative subtracts. */
  readonly earnedIncomeCredit?: number;
  /**
   * Whether the taxpayer (or, on a joint return, at least one spouse) has a
   * social security number valid for employment.
   *
   * OBBBA § 70104(c) added this for 2025 and later: before then only the child
   * needed one. Defaults to `true`.
   */
  readonly taxpayerHasWorkAuthorizedSocialSecurityNumber?: boolean;
}

/**
 * Schedule 8812 — the child tax credit, the credit for other dependents, and the
 * additional child tax credit.
 *
 * The order is fixed by the form and each step depends on the one before it:
 * the two credits are added together, the combined figure is phased out on MAGI,
 * what survives is applied against income tax, and only what is *left over*
 * after that can be refunded — capped at $1,700 per child and at 15% of earned
 * income above $2,500.
 *
 * That ordering is why a family can lose credit at both ends: too little tax to
 * absorb the non-refundable part and too little earned income to phase in the
 * refundable part. {@link ChildTaxCreditResult.unusedCredit} reports it.
 */
export function childTaxCredit(input: ChildTaxCreditInput): ChildTaxCreditResult {
  const params = getYearParameters(input.year);
  const year = params.year;
  const p = params.childTaxCredit;
  const { filingStatus } = input;

  const threshold = p.phaseOut.thresholds[filingStatus];
  if (threshold === undefined) {
    throw new TypeError(`Unknown filing status: ${String(filingStatus)}`);
  }

  const children = Math.max(0, Math.floor(input.qualifyingChildren ?? 0));
  const otherDependents = Math.max(0, Math.floor(input.otherDependents ?? 0));

  // § 24(h)(7), as amended: without a work-authorized SSN for the taxpayer the
  // *child* credit is disallowed. The $500 credit for other dependents is not
  // conditioned on it and survives.
  const hasSsn = input.taxpayerHasWorkAuthorizedSocialSecurityNumber ?? true;
  const creditedChildren = p.requiresTaxpayerSocialSecurityNumber && !hasSsn ? 0 : children;

  const magi =
    nonNegative(input.adjustedGrossIncome, 'adjustedGrossIncome') +
    nonNegative(input.foreignEarnedIncomeExclusion, 'foreignEarnedIncomeExclusion');

  const childCredit = creditedChildren * p.amountPerChild;
  const otherDependentCredit = otherDependents * p.amountPerOtherDependent;
  // Schedule 8812 line 8: the phase-out runs on the two together, not on each
  // separately, so a $500 dependent credit is eroded by the same income that
  // erodes the child credit.
  const maximumCredit = childCredit + otherDependentCredit;

  const excessIncome = Math.max(0, magi - threshold);
  const phaseOutReduction = Math.min(maximumCredit, steppedReduction(excessIncome, p.phaseOut));
  const creditAfterPhaseOut = Math.max(0, maximumCredit - phaseOutReduction);

  const limitingTaxLiability = nonNegative(
    input.incomeTaxBeforeCredits,
    'incomeTaxBeforeCredits',
  );
  const nonRefundableCredit = Math.min(creditAfterPhaseOut, limitingTaxLiability);

  // Schedule 8812 line 16a: only the credit that income tax could not absorb is
  // a candidate for refund.
  const refundableCandidate = creditAfterPhaseOut - nonRefundableCredit;
  const refundableCap = creditedChildren * p.refundable.maximumPerChild;

  const earnedIncome = nonNegative(input.earnedIncome, 'earnedIncome');
  const refundablePhaseIn =
    p.refundable.phaseInRate * Math.max(0, earnedIncome - p.refundable.phaseInThreshold);

  // § 24(d)(1)(B)(ii): with three or more children the filer may substitute
  // social security taxes paid less the EITC. For a large family earning little,
  // payroll tax paid can exceed 15% of earnings above $2,500 — this is the
  // provision that makes the credit reach them, and it is routinely omitted.
  const usesAlternative =
    creditedChildren >= p.refundable.minimumChildrenForSocialSecurityAlternative;
  const socialSecurityAlternative = usesAlternative
    ? Math.max(
        0,
        nonNegative(input.socialSecurityTaxes, 'socialSecurityTaxes') -
          nonNegative(input.earnedIncomeCredit, 'earnedIncomeCredit'),
      )
    : null;

  const phaseIn =
    socialSecurityAlternative === null
      ? refundablePhaseIn
      : Math.max(refundablePhaseIn, socialSecurityAlternative);

  const refundableCredit = Math.min(refundableCandidate, refundableCap, phaseIn);

  return {
    year,
    filingStatus,
    qualifyingChildren: creditedChildren,
    otherDependents,
    modifiedAdjustedGrossIncome: roundCents(magi),
    childCredit: roundCents(childCredit),
    otherDependentCredit: roundCents(otherDependentCredit),
    maximumCredit: roundCents(maximumCredit),
    phaseOutThreshold: threshold,
    excessIncome: roundCents(excessIncome),
    phaseOutReduction: roundCents(phaseOutReduction),
    creditAfterPhaseOut: roundCents(creditAfterPhaseOut),
    limitingTaxLiability: roundCents(limitingTaxLiability),
    nonRefundableCredit: roundCents(nonRefundableCredit),
    earnedIncome: roundCents(earnedIncome),
    refundablePhaseIn: roundCents(refundablePhaseIn),
    socialSecurityAlternative:
      socialSecurityAlternative === null ? null : roundCents(socialSecurityAlternative),
    refundableCap: roundCents(refundableCap),
    refundableCredit: roundCents(refundableCredit),
    unusedCredit: roundCents(creditAfterPhaseOut - nonRefundableCredit - refundableCredit),
  };
}
