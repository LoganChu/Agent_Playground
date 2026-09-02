/**
 * The declarative shape a state income tax is described in.
 *
 * Every supported state is one of these plus a year. There is deliberately no
 * per-state code: a state whose rules cannot be expressed here is not supported,
 * and saying so is better than a special case that only its author understands.
 */
import type {
  Bracket,
  ByStatus,
  Citation,
  ConformityBase,
  FederalDeductionKey,
  ParameterStatus,
  StateCode,
} from './types.js';

/** How a state's own deduction is determined. */
export type DeductionRule =
  /** A fixed table of amounts by filing status. */
  | { readonly kind: 'table'; readonly amounts: ByStatus }
  /**
   * The state's deduction *is* the federal one. Arizona sets its standard
   * deduction equal to the federal amount by statute (A.R.S. § 43-1041(A)), which
   * is why the OBBBA increase cut Arizona tax in 2025 with no Arizona legislation.
   */
  | { readonly kind: 'federal' }
  /**
   * No deduction at all. Illinois, Indiana, Michigan and Pennsylvania give none;
   * Colorado and Idaho give none *of their own* because the federal one is already
   * inside their starting point.
   */
  | { readonly kind: 'none' };

/** Exemptions subtracted from income, as distinct from exemption *credits*. */
export interface ExemptionRule {
  /** Amount for the filer(s). Joint returns generally get two. */
  readonly perFiler: ByStatus;
  readonly perDependent: number;
  /**
   * Income at or above which the exemption is lost **entirely**, not phased out.
   *
   * Illinois is the only supported state that does this, and it is a genuine
   * cliff: one dollar of extra AGI at $250,000 costs a single filer the whole
   * $2,850 exemption. 35 IL Comp. Stat. 5/204(g).
   */
  readonly cliff?: ByStatus;
}

/** The rate structure applied to state taxable income. */
export type RateRule =
  | { readonly kind: 'none' }
  | { readonly kind: 'flat'; readonly rate: number }
  | { readonly kind: 'brackets'; readonly byStatus: ByStatus<readonly Bracket[]> };

/**
 * A tax layered on the same taxable income as the main schedule.
 *
 * California's Mental Health Services Tax is the supported case: an extra 1% on
 * taxable income over $1,000,000, and — the part that surprises people — the
 * threshold is **not** doubled for a joint return even though every bracket in the
 * main schedule is.
 */
export interface SurtaxRule {
  readonly name: string;
  readonly brackets: readonly Bracket[];
  /** True when the threshold is per return regardless of filing status. */
  readonly thresholdNotDoubledForJoint: boolean;
}

/**
 * A per-person credit that reduces tax directly rather than income.
 *
 * California's is the important one. Because it is a *credit*, its value does not
 * depend on the filer's bracket — worth the same $153 to a 1% filer and a 12.3%
 * one — and because it phases out in whole increments, the phase-out is a small
 * staircase rather than a smooth rate.
 */
export interface ExemptionCreditRule {
  readonly name: string;
  /** Credit per filer — one for single, two for joint. */
  readonly perFiler: ByStatus;
  readonly perDependent: number;
  readonly phaseOut: {
    /** Reduction per counted increment, per exemption claimed. */
    readonly amountPerIncrement: number;
    readonly increment: ByStatus;
    readonly start: ByStatus;
  };
}

/**
 * A credit computed from deductions and exemptions and then phased out against
 * income — Utah's Taxpayer Tax Credit, Utah Code § 59-10-1018.
 *
 * It is what makes Utah's "flat tax" not flat. The credit is 6% of the federal
 * deduction plus 75% of the federal personal exemption amount per dependent, and
 * it falls by 1.3 cents for every dollar of income above the threshold. Inside
 * that band the true marginal rate is the statutory rate plus 1.3 points.
 */
export interface TaxpayerCreditRule {
  readonly name: string;
  readonly rate: number;
  readonly personalExemption: number;
  readonly phaseOutRate: number;
  readonly phaseOutThreshold: ByStatus;
}

/**
 * Pennsylvania's Special Tax Forgiveness — 72 Pa. Stat. § 7304, Schedule SP.
 *
 * Pennsylvania has no standard deduction and no personal exemption, so a single
 * parent earning $20,000 would otherwise pay the same 3.07% on every dollar as a
 * millionaire. Forgiveness is how the state fixes that, and it is a *staircase*:
 * full forgiveness up to the allowance, then ten percentage points less for each
 * $250 of eligibility income above it, reaching zero $2,500 later.
 *
 * The consequence is a marginal rate of roughly 30% across that $2,500 band —
 * ten times the statutory rate — which is the single most surprising number this
 * package produces and the reason a "flat tax" label is misleading here too.
 */
export interface ForgivenessRule {
  readonly name: string;
  /** Allowance for the filer; a joint return gets two. */
  readonly base: number;
  readonly perDependent: number;
  /** Eligibility income step at which forgiveness drops. */
  readonly increment: number;
  /** Percentage points of forgiveness lost per step. */
  readonly reductionPerIncrement: number;
}

export interface StateIncomeTaxDefinition {
  readonly code: StateCode;
  readonly name: string;
  readonly year: number;
  readonly status: ParameterStatus;
  readonly base: ConformityBase;
  readonly rate: RateRule;
  readonly deduction: DeductionRule;
  readonly exemption?: ExemptionRule;
  readonly surtax?: SurtaxRule;
  readonly exemptionCredit?: ExemptionCreditRule;
  readonly taxpayerCredit?: TaxpayerCreditRule;
  readonly forgiveness?: ForgivenessRule;
  /**
   * Federal below-AGI deductions this state adds back to its base. Only ever
   * populated for a state whose {@link ConformityBase} is `federalTaxableIncome`,
   * because those deductions never entered a federal-AGI base in the first place.
   */
  readonly addBacks?: readonly FederalDeductionKey[];
  /** Facts a caller would otherwise get wrong. Surfaced in every result. */
  readonly notes: readonly string[];
  readonly citations: readonly Citation[];
}

/** Number of filers a status implies, for per-person amounts. */
export function filerCount(status: string): number {
  return status === 'marriedFilingJointly' || status === 'qualifyingSurvivingSpouse' ? 2 : 1;
}
