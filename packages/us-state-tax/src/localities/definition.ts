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
  LocalTaxJurisdiction,
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
  | 'stateNetTax'
  /**
   * Michigan's 24 cities: **a base of the city's own**, with no line on the
   * state return behind it.
   *
   * The three above are all rates on something the state already computed, which
   * is why a state change flows through to them. This one is not, and the
   * consequence is the reverse: a Michigan city's tax is untouched by every
   * Michigan deduction, exemption and credit, and the city's own exclusions
   * — pensions, annuities and IRA distributions, Social Security, unemployment
   * compensation and military pay, all excluded entirely under the Uniform City
   * Income Tax Ordinance — have no state analogue either.
   *
   * So the caller supplies the figure, the same way Pennsylvania, New Jersey and
   * Massachusetts supply theirs, and the engine subtracts the city's own
   * exemptions from it. When it is absent the engine derives it from federal AGI
   * less any retirement income supplied, and the result says so — see
   * {@link LocalIncomeTaxDefinition.exemptionAmount}.
   */
  | 'cityIncome';

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
  readonly code: LocalTaxJurisdiction;
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
   * A local earned income credit that is **a multiple of the locality's own rate
   * times the federal credit**, capped at the local tax — Maryland's, Md. Code,
   * Tax-Gen. § 10-704(d), where the multiple is 10.
   *
   * This is the most economical credit in the package: twenty-four counties have
   * twenty-four different local earned income credits and there is not one number
   * per county anywhere in this file, because each credit *is* that county's rate
   * times ten. Worcester at 2.25% matches 22.5% of the federal credit and
   * Dorchester at 3.30% matches 33%, and when a county council changes its rate
   * next October its earned income credit changes with it, in the same line of
   * data.
   *
   * The one place the derivation stops being obvious is a county with more than
   * one rate — see {@link LocalIncomeTaxDefinition.notes} for Anne Arundel and
   * Frederick, where this package follows PolicyEngine-US's reading and says so.
   */
  readonly earnedIncomeCreditRateMultiple?: number;
  /**
   * A flat deduction the locality allows for each personal and dependency
   * exemption — the filer, a spouse on a joint return, and every dependent.
   *
   * Only Michigan's cities have one, and it is the smallest meaningful number in
   * this package: MCL 141.631(1) fixed the floor at `$600` in 1964 and never
   * indexed it, so sixteen of the twenty-four cities still allow exactly that.
   * Against Michigan's own indexed `$5,800` state exemption it is 10.3%, and at
   * Detroit's 2.4% it is worth **`$14.40` of tax per person per year**.
   *
   * It is subtracted from {@link LocalIncomeTaxDefinition.base}, floored at
   * zero, on the resident and the nonresident return alike — a nonresident
   * claims the same exemptions against the income the city may reach.
   */
  readonly exemptionAmount?: number;
  /**
   * Rate charged on wages earned inside the locality by someone who lives
   * elsewhere. Residents pay the resident tax above instead, never both.
   */
  readonly nonresidentEarningsRate?: number;
  /**
   * Whether a resident of this locality may credit tax paid to another locality
   * of the same kind, and at what rate the credit is capped.
   *
   * Michigan's is the only one, and the cap is the locality's **own nonresident
   * rate**: a home city will absorb another city's tax only up to what it would
   * have charged a commuter coming the other way. So the credit is complete for
   * a Detroit resident working in Grand Rapids (1.2% cap against a 0.75% tax)
   * and short for a Lansing resident working in Detroit (0.5% cap against a 1.2%
   * tax), which is the direction people actually commute.
   */
  readonly creditsTaxPaidToPeerLocality?: boolean;
  readonly notes: readonly string[];
  readonly citations: readonly Citation[];
}
