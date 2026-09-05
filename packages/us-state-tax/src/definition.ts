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

/**
 * A state earned income credit expressed as a share of the federal § 32 credit.
 *
 * Six of the fourteen taxing states in this package have one, and "a percentage
 * of the federal credit" is the single most misleading sentence in state tax.
 * Three of the six are not that:
 *
 * - **Utah's is non-refundable.** A filer with no Utah tax gets nothing, which is
 *   most of the population the federal credit is aimed at. Utah Code § 59-10-1044
 *   sits in Part 10, the Nonrefundable Tax Credit Act.
 * - **New York's is reduced by the state household credit** before it is paid —
 *   Tax Law § 606(d)(1). The two credits are not additive.
 * - **Indiana's is a percentage of a federal credit the filer never claimed.**
 *   Indiana computes its own § 32 figure under the Internal Revenue Code as of a
 *   frozen date, with its own investment-income limit — see `flat-states.ts`.
 *
 * And the match rate is legislated, not indexed, so it moves in whole steps:
 * Colorado's was 25% in 2023, 50% in 2024 and 2025, and reverts to 25% in 2026.
 */
export interface EarnedIncomeCreditRule {
  readonly name: string;
  /** Share of the federal credit. */
  readonly matchRate: number;
  /** False means a filer with no state tax gets nothing. Utah. */
  readonly refundable: boolean;
  /**
   * New York: the state credit is the match **less** the household credit, so a
   * filer who gets both keeps only the larger. N.Y. Tax Law § 606(d)(1).
   */
  readonly reducedByHouseholdCredit?: boolean;
}

/** One step of a step-function credit: the amount for income at or below `upTo`. */
export interface CreditStep {
  readonly upTo: number;
  readonly amount: number;
}

/**
 * A credit that is a step function of state AGI — New York's household credit,
 * N.Y. Tax Law § 606(b).
 *
 * It is a staircase and not a phase-out, which makes it another instance of the
 * Illinois pattern: crossing $28,000 of AGI as a single New Yorker costs $20 of
 * credit on one dollar of income.
 *
 * The amounts have not moved since 1986.
 */
export interface HouseholdCreditRule {
  readonly name: string;
  /** Steps for a one-person household, by filing status. */
  readonly base: ByStatus<readonly CreditStep[]>;
  /** Added for each household member after the first. */
  readonly perAdditionalPerson: readonly CreditStep[];
  /**
   * Statuses whose credit is computed on the couple's combined income and then
   * split. New York requires this of married filing separately, and this package
   * has only the one filer's figures — see the state's notes.
   */
  readonly halvedForSeparate: boolean;
}

/**
 * A credit worth a fixed amount per dependent, banded by the dependent's age and
 * phased out against income on the whole return rather than per child.
 *
 * New York's Empire State child credit, N.Y. Tax Law § 606(c-1)(1-A) as enacted
 * by the FY2026 budget (S.3009-C, Part C). It is the largest credit on a New
 * York family return: `$1,000` for each child under 4 in 2025 and 2026, and
 * `$330` (2025) or `$500` (2026) for each child aged 4 to 16.
 *
 * Two things about it are routinely got wrong, and both follow from the
 * phase-out being on the **return** rather than on each child:
 *
 * - **`$16.50` per `$1,000` is one third of the federal `$50`.** New York's
 *   Empire State child credit was 33% of the federal § 24 credit from 2018 to
 *   2024. The FY2026 budget replaced the amount with flat dollar figures and
 *   kept the phase-out at exactly a third of the federal rate, so the credit's
 *   old shape is still visible in the one parameter nobody quotes.
 * - **"Phases out above `$110,000`" ends nowhere near `$110,000`.** At `$16.50`
 *   per `$1,000` a `$1,000` credit survives another `$60,000` of income, and a
 *   joint return with three children under 4 keeps some of it to `$291,000`. A
 *   model that treats the threshold as a cliff, or that phases the credit out per
 *   child, is wrong across a `$180,000` band.
 *
 * The reduction is per increment "or fraction thereof", so it is a staircase:
 * the dollar that crosses each `$1,000` boundary costs `$16.50` at once.
 */
export interface ChildCreditRule {
  readonly name: string;
  /**
   * Amount per dependent, by the oldest age that gets it. Bands are matched in
   * order, so `[{ maxAge: 3, amount: 1000 }, { maxAge: 16, amount: 500 }]` pays
   * `$1,000` up to and including age 3 and `$500` from 4 to 16.
   */
  readonly amountByAge: readonly { readonly maxAge: number; readonly amount: number }[];
  readonly phaseOut: {
    readonly threshold: ByStatus;
    /** Subtracted from the whole credit per increment, or fraction of one. */
    readonly amountPerIncrement: number;
    readonly increment: number;
  };
  readonly refundable: boolean;
}

/**
 * A state earned income credit with its own schedule rather than a share of the
 * federal one — California's CalEITC, R&TC § 17052.
 *
 * This is the shape {@link EarnedIncomeCreditRule} cannot express, and the reason
 * this package refused to compute California's credit until it existed. CalEITC
 * is not a percentage of anything federal: it has its own phase-in ceiling, its
 * own income cap, and a phase-out in two stages.
 *
 * **The table is a rendering, and here is the renderer.** The FTB publishes
 * CalEITC as a lookup table running to `$30,000` in `$50` income bands. It is
 * generated by five facts:
 *
 * 1. **The phase-in rate is the *federal* § 32 credit percentage** — 7.65% with
 *    no children, 34%, 40%, 45% — which California never restates because
 *    § 17052(a) adopts § 32 by reference and then overrides the amounts.
 * 2. **The phase-in ceiling is half the federal 2015 ceiling, indexed.** The
 *    statutory table is `$3,290` / `$4,940` / `$6,935`, which is exactly half of
 *    the federal 2015 earned income amounts of `$6,580` / `$9,880` / `$13,870`.
 *    California froze the federal *structure* at 2015 and has indexed it by the
 *    California CPI ever since, so a single factor reproduces all three of any
 *    year's amounts — the test in `test/california.test.js` checks that it does.
 * 3. **The plateau is zero wide.** The federal credit holds its maximum across
 *    roughly `$10,000` of income. California's phase-out threshold *is* its
 *    phase-in ceiling — {@link ByChildCount.earnedIncomeAmount} is both — so the
 *    credit peaks at a single dollar of income and starts falling at the next.
 *    It is a triangle where the federal credit is a trapezoid.
 * 4. **The descent is the same rate as the climb**, which is what makes it a
 *    triangle: § 17052 sets the phaseout percentage equal to the credit
 *    percentage. A two-child filer gains 34 cents on the dollar up to `$9,823`
 *    and loses 34 cents on the dollar after it — a 68-point swing across one
 *    dollar of income.
 * 5. **Then it stops descending and crawls.** Once the credit falls to
 *    {@link ByChildCount.finalPhaseOutStartCredit} the remainder is spread in a
 *    straight line to zero at {@link finalPhaseOutEnd}, which is how a credit
 *    whose triangle ends near `$18,000` reaches the `$30,000`-indexed cap the
 *    legislature wrote in 2019. The tail is long and nearly flat: 4.2 cents on
 *    the dollar for a two-child filer, 0.9 cents for a childless one.
 *
 * Every figure but one is either statutory or published. The exception is
 * {@link ByChildCount.finalPhaseOutStartCredit}, which no California release
 * states in words — it is read off the kink in the published table. The twelve
 * FTB table values in `test/california.test.js` are what pin it, and the model
 * above reproduces all twelve to within 64 cents.
 */
export interface OwnEarnedIncomeCreditRule {
  readonly name: string;
  /**
   * R&TC § 17052(a)(2)(B): the credit computed under the section is multiplied
   * by an adjustment factor set each year in the Budget Act, and it has been
   * **85%** for every year since 2015.
   *
   * It is stored separately rather than folded into the rates because it is the
   * one number in CalEITC that a single budget can change, and because folding
   * it in would hide that the phase-in rates are the federal ones. It means the
   * effective subsidy on a one-child filer's first `$6,998` is 28.9%, not the
   * 34% the schedule appears to say — on top of the federal 34%.
   */
  readonly adjustmentFactor: number;
  /**
   * One entry per qualifying-child count, ascending. The last entry covers that
   * count and every larger one, which is how "3 or more" is expressed.
   */
  readonly byChildCount: readonly ByChildCount[];
  /**
   * California earned income at which the credit reaches zero, and also the
   * federal AGI above which no credit is allowed at all — `$30,000` when the
   * 2019 expansion set it, indexed since.
   */
  readonly finalPhaseOutEnd: number;
  /** Investment income above which no credit is allowed. § 17052(i). */
  readonly investmentIncomeLimit: number;
  /**
   * Minimum age for a filer with no qualifying children.
   *
   * California's is **18 with no upper limit**, where the federal childless
   * credit runs from 25 to 64. A nineteen-year-old and a seventy-year-old are
   * both excluded from the federal credit and both eligible for this one, which
   * is a case where "a percentage of the federal credit" would return zero and
   * the right answer is not zero.
   */
  readonly minimumAgeWithoutChildren: number;
  /** Oldest age a dependent can be and still count as a qualifying child. */
  readonly qualifyingChildMaxAge: number;
}

/** CalEITC's parameters for one qualifying-child count. */
export interface ByChildCount {
  /** Qualifying children; the largest entry means "this many or more". */
  readonly children: number;
  /** The federal § 32 credit percentage, before the adjustment factor. */
  readonly phaseInRate: number;
  /**
   * Where the phase-in stops **and** the phase-out starts — the two are the same
   * figure, which is why CalEITC has no plateau.
   */
  readonly earnedIncomeAmount: number;
  /**
   * The credit level at which the steep phase-out stops and the long straight
   * line to {@link OwnEarnedIncomeCreditRule.finalPhaseOutEnd} begins.
   *
   * The one CalEITC figure not stated in any California release. See
   * {@link OwnEarnedIncomeCreditRule}.
   */
  readonly finalPhaseOutStartCredit: number;
}

/**
 * California's Young Child Tax Credit, R&TC § 17052.1 — and, on identical
 * numbers, the Foster Youth Tax Credit of § 17052.2.
 *
 * Refundable, worth `$1,189` in 2025, and three things about it are routinely
 * got wrong:
 *
 * - **It is one credit per return, not one per child.** A family with one child
 *   under 6 and a family with three get exactly the same `$1,189`. Every other
 *   child credit in this package scales with the family.
 * - **It is gated on CalEITC.** A filer who is over the CalEITC income cap, or
 *   over its investment-income limit, gets no Young Child Tax Credit either,
 *   however young their child is. The gate is what makes the `$32,901` CalEITC
 *   cap worth `$1,189` more than it looks.
 * - **The phase-out rate is not a parameter.** `$21.71` per `$100` in 2025 is
 *   `amount ÷ ((CalEITC cap − threshold) ÷ $100)`, truncated to the cent: the
 *   rate is *defined* as whatever runs the credit to exactly zero at the CalEITC
 *   income cap. It reproduces the published figure in 2021 (`$20.00`), 2022
 *   (`$21.66`), 2024 (`$21.67`) and 2025 (`$21.71`) — and `test/california.test.js`
 *   asserts it, so a future year's rate can be checked rather than trusted.
 *
 * And the reduction is per increment "or fraction thereof" (§ 17052.1(a)(2)(C)(i)),
 * so it is a staircase like New York's: 99 dollars in 100 cost nothing and the
 * hundredth costs `$21.71`.
 */
export interface YoungChildCreditRule {
  readonly name: string;
  readonly amount: number;
  /** A dependent this age or older is not a qualifying young child. 6. */
  readonly ineligibleAge: number;
  readonly phaseOut: {
    /** California earned income above which the credit falls. */
    readonly start: number;
    readonly increment: number;
    /** Per increment "or fraction thereof" — see the derivation above. */
    readonly amountPerIncrement: number;
  };
}

/**
 * New York's supplemental tax — the "tax table benefit recapture" of
 * N.Y. Tax Law § 601(d).
 *
 * Above an AGI threshold New York claws back the benefit of every bracket below
 * the filer's top one, so a high earner pays their top rate on their *whole*
 * income rather than on the last band of it. An engine that walks the brackets
 * and stops is confidently wrong for every New Yorker over $107,650, and the
 * error grows to $215,071 for a single filer over $25,050,000.
 *
 * The statute prints the recapture as a table of dollar amounts. This package
 * stores none of them, because they are an identity over the rate schedule that
 * appears three subsections earlier:
 *
 * ```text
 * recapture(threshold T of bracket k) = rate(k) x T - bracketTax(T)
 * ```
 *
 * which is precisely "what the top rate would have collected on the income below
 * the top rate, less what the graduated rates actually collected". Deriving it
 * reproduces all thirteen distinct published 2025 figures — twenty-two across the
 * five filing statuses — exactly, and supplies the over-$25,000,000 tier that the tables in every
 * reference dataset checked here omit.
 */
export interface RecaptureRule {
  readonly name: string;
  /** AGI above which the recapture applies at all. */
  readonly minAgi: number;
  /** Each step of the recapture phases in over this much AGI. */
  readonly phaseInLength: number;
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
  readonly earnedIncomeCredit?: EarnedIncomeCreditRule;
  /**
   * A state earned income credit on its own schedule. Mutually exclusive with
   * {@link earnedIncomeCredit}: a state either matches the federal credit or
   * computes its own, and California is the only supported state that does the
   * second.
   */
  readonly ownEarnedIncomeCredit?: OwnEarnedIncomeCreditRule;
  readonly householdCredit?: HouseholdCreditRule;
  readonly childCredit?: ChildCreditRule;
  /** Gated on {@link ownEarnedIncomeCredit}; never present without it. */
  readonly youngChildCredit?: YoungChildCreditRule;
  readonly recapture?: RecaptureRule;
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
