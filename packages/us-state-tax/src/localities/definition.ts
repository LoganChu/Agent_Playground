/**
 * The declarative shape a *local* income tax is described in.
 *
 * A city income tax is not a smaller state income tax. The three structural facts
 * that a state definition cannot express, and that this file exists for:
 *
 * 1. **A local tax starts from a state figure, not a federal one.** New York City
 *    taxes New York taxable income; Yonkers taxes the New York *tax*. So a
 *    locality has to be computed after its state and told which of the state's
 *    intermediate figures it begins from — {@link LocalBase}.
 * 2. **"A percentage of the state tax" is a real rate structure**, and it is the
 *    one most cities that piggyback on a state return use. It behaves nothing like
 *    a rate on income: every state credit, every state deduction and the whole
 *    state rate schedule are already inside it.
 * 3. **Residence and workplace are different taxes.** Yonkers charges residents a
 *    surcharge on their state tax and non-residents 0.5% of the wages they earn
 *    inside the city, and a filer can owe a resident tax to one locality and an
 *    earnings tax to another in the same year. That is why the result carries a
 *    *list* of local taxes rather than one.
 *
 * The shape is deliberately built for more than New York. Indiana's 92 counties,
 * Michigan's 24 cities, Kentucky's occupational taxes and Maryland's counties are
 * all one of these three patterns, and each of them is a rate on a state figure.
 */
import type { CreditStep, RateRule } from '../definition.js';
import type {
  ByStatus,
  Citation,
  LocalityCode,
  ParameterStatus,
  StateCode,
} from '../types.js';

/**
 * Which figure from the state return a locality applies its rate to.
 *
 * This is the local analogue of {@link ConformityBase}, and it matters for the
 * same reason: it decides which state changes flow through to the city. A
 * locality on `stateNetTax` inherits every state rate cut and every state credit
 * automatically; one on `stateTaxableIncome` inherits the state's deductions but
 * none of its credits or rates.
 */
export type LocalBase =
  /** New York City: the state's taxable income, with the state's own rates replaced. */
  | 'stateTaxableIncome'
  /** Indiana counties and most Maryland counties: the state's AGI measure. */
  | 'stateAdjustedGrossIncome'
  /**
   * Yonkers: the state tax itself, after the state's non-refundable credits and
   * before its refundable ones.
   *
   * The ordering is the whole point. Refundable state credits are claimed in the
   * payments section of the return, *after* the surcharge line, so they cannot
   * reduce it — and a model that nets them first hands a Yonkers family with a
   * refundable state credit larger than their state tax a **negative** city tax.
   */
  | 'stateNetTax';

/**
 * A credit that is a flat dollar amount per person, stepped by income.
 *
 * New York City's household credit. Unlike the state credit of the same name it
 * has no base-plus-additional structure: every counted person is worth the same
 * amount, and a single filer gets a flat amount instead.
 */
export interface LocalPerPersonCreditRule {
  readonly name: string;
  /** Steps for a single filer — a flat amount, not multiplied by anything. */
  readonly single: readonly CreditStep[];
  /** The per-person amount for every other filing status, stepped by income. */
  readonly perPerson: readonly CreditStep[];
  /**
   * Married filing separately takes half the per-person amount, **rounded to the
   * nearest dollar**.
   *
   * The instructions print this as its own table — $15 / $13 / $8 / $5 against
   * the joint table's $30 / $25 / $15 / $10 — and all four fall out of halving
   * with round-half-up. Deriving it rather than transcribing it is one fewer
   * table to re-key when the amounts move.
   */
  readonly halvedForSeparate: boolean;
}

/**
 * New York City's school tax credit, N.Y.C. Admin. Code § 11-1706(e) and (g).
 *
 * Two credits with one name, different eligibility tests and different income
 * measures, both refundable:
 *
 * - a **fixed amount** — $63, or $125 on a joint return — for filers whose
 *   (recomputed federal) income is at or below $250,000; and
 * - a **rate reduction amount**, a small percentage of New York City taxable
 *   income, for filers whose city taxable income is at or below $500,000.
 *
 * Both limits are cliffs rather than phase-outs. One dollar of city taxable
 * income over $500,000 costs a single filer the entire $1,133.64 rate reduction
 * amount, which is the largest single-dollar cliff anywhere in this package.
 */
export interface SchoolTaxCreditRule {
  readonly name: string;
  readonly fixed: {
    readonly amounts: ByStatus;
    /** Measured on recomputed federal AGI, less IRA distributions. A cliff. */
    readonly incomeLimit: number;
  };
  readonly rateReduction: {
    /** Applied to city taxable income up to {@link threshold}. */
    readonly lowerRate: number;
    /** Applied to city taxable income above it. */
    readonly upperRate: number;
    readonly threshold: ByStatus;
    /** Measured on city taxable income. A cliff. */
    readonly incomeLimit: number;
  };
}

/**
 * An earned income credit that is a *sliding* share of the federal credit.
 *
 * New York City's, and the reason it needs its own shape rather than
 * {@link EarnedIncomeCreditRule}: since 2022 the city's match is not one number.
 * It starts at 30% of the federal credit and falls to 10% across four windows,
 * and the Department of Taxation and Finance publishes it as a long table of
 * income ranges and decimals in the Form IT-215 instructions.
 *
 * The table is an identity. The match sheds {@link stepDown} percentage points
 * at {@link reductionRate} per dollar starting at each of {@link windowStarts},
 * so each window is `stepDown / reductionRate` dollars wide and the whole
 * schedule is continuous. Six numbers reproduce every row.
 *
 * The consequence nobody models: inside a window the city takes back
 * `reductionRate` of the federal credit per dollar of income. For a family with
 * a $7,800 federal credit that is **15.6 percentage points** of marginal rate,
 * from a city whose top statutory rate is 3.876%.
 */
export interface SlidingEarnedIncomeCreditRule {
  readonly name: string;
  /** The match below the first window. */
  readonly topMatch: number;
  /** Percentage points of match lost in each window. */
  readonly stepDown: number;
  /** Match lost per dollar of income inside a window. */
  readonly reductionRate: number;
  /** Income at which each window begins. */
  readonly windowStarts: readonly number[];
  /**
   * Decimal places the computed match is rounded to.
   *
   * The worksheet says so in as many words — "multiply line 3 by .00002 (round
   * the result to four decimal places)" — and it is load-bearing: without it the
   * match at $21,000 of income is 0.17998 rather than the 0.18 the form gives.
   */
  readonly matchDecimals: number;
}

/**
 * One locality's income tax for one year.
 *
 * A locality is always attached to a state and is only ever computed as part of
 * that state's return, because every base it can use is a figure from it.
 */
export interface LocalIncomeTaxDefinition {
  readonly code: LocalityCode;
  readonly name: string;
  readonly state: StateCode;
  readonly year: number;
  readonly status: ParameterStatus;
  readonly base: LocalBase;
  readonly rate: RateRule;
  readonly householdCredit?: LocalPerPersonCreditRule;
  readonly schoolTaxCredit?: SchoolTaxCreditRule;
  readonly earnedIncomeCredit?: SlidingEarnedIncomeCreditRule;
  /**
   * Rate charged on wages earned inside the locality by someone who lives
   * elsewhere. Residents pay the resident tax above instead, never both.
   */
  readonly nonresidentEarningsRate?: number;
  readonly notes: readonly string[];
  readonly citations: readonly Citation[];
}
