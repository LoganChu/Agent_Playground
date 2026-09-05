/**
 * Core types for the US state income tax engine.
 *
 * The organising idea of this package is that **the rate is the easy part**. What
 * separates a state income tax engine that works from one that returns a plausible
 * number is the *starting point*: every state begins its computation from a
 * different federal figure, and that choice decides whether a federal change flows
 * through to the state return or not.
 *
 * Arizona, Colorado and Idaho all had their 2025 tax cut by the One Big Beautiful
 * Bill Act without their legislatures doing anything, because their starting points
 * are downstream of the federal standard deduction. Illinois and Michigan did not,
 * because theirs is federal AGI, which sits above it. An engine that stores "the
 * state standard deduction" as a number cannot express that difference.
 */

/** Filing status, using the same five values as the federal engine. */
export type FilingStatus =
  | 'single'
  | 'marriedFilingJointly'
  | 'marriedFilingSeparately'
  | 'headOfHousehold'
  | 'qualifyingSurvivingSpouse';

export const FILING_STATUSES: readonly FilingStatus[] = [
  'single',
  'marriedFilingJointly',
  'marriedFilingSeparately',
  'headOfHousehold',
  'qualifyingSurvivingSpouse',
];

/** Two-letter postal code for a state this package knows something about. */
export type StateCode =
  | 'AK'
  | 'AZ'
  | 'CA'
  | 'CO'
  | 'FL'
  | 'GA'
  | 'ID'
  | 'IL'
  | 'IN'
  | 'KY'
  | 'MI'
  | 'MS'
  | 'NC'
  | 'NH'
  | 'NV'
  | 'NY'
  | 'PA'
  | 'SD'
  | 'TN'
  | 'TX'
  | 'UT'
  | 'WA'
  | 'WY';

/**
 * A locality that levies its own income tax on a state return this package knows.
 *
 * A local income tax is not a rounding error. New York City's costs a resident
 * more than the entire state income tax of twelve of the twenty-three states here
 * — every one of the nine with no income tax, plus Arizona, Indiana and
 * Pennsylvania — and it appears in no table of state tax rates because it is not
 * one.
 */
export type LocalityCode = 'NYC' | 'YONKERS';

/** A value that differs by filing status. */
export type ByStatus<T = number> = Readonly<Record<FilingStatus, T>>;

/**
 * Where a state's income tax computation starts.
 *
 * This is the single most consequential fact about a state income tax and the one
 * most often left implicit. It decides which federal changes the state inherits.
 */
export type ConformityBase =
  /**
   * Federal adjusted gross income — line 11 of Form 1040. The most common choice.
   * A state on this base inherits federal *above-the-line* rules (the HSA
   * deduction, half of self-employment tax, the student loan interest deduction)
   * but **not** the federal standard deduction, personal exemptions, the QBI
   * deduction, or anything else below AGI.
   */
  | 'federalAdjustedGrossIncome'
  /**
   * Federal taxable income — line 15 of Form 1040. Colorado and Idaho.
   *
   * A state on this base inherits the federal standard-or-itemized deduction, the
   * § 199A QBI deduction, and — in Idaho, by an explicit 2025 add-back that
   * Colorado does not have — would otherwise inherit the four OBBBA Schedule 1-A
   * deductions too. This is why a Colorado return got cheaper in 2025 with no
   * Colorado legislation.
   */
  | 'federalTaxableIncome'
  /**
   * The state defines its own tax base with no federal starting line.
   * Pennsylvania: eight classes of income, no federal AGI anywhere on the form.
   */
  | 'stateDefined';

/** One marginal rate band. `upTo` is the top of the band; the last band uses `Infinity`. */
export interface Bracket {
  readonly rate: number;
  readonly upTo: number;
}

/** Per-band detail returned alongside a bracket computation. */
export interface BracketDetail {
  readonly rate: number;
  readonly incomeInBracket: number;
  readonly tax: number;
}

/** A citation, so every number is traceable to the state release it came from. */
export interface Citation {
  readonly title: string;
  readonly url: string;
}

/**
 * How confident this package is in a given state-year's figures.
 *
 * Most state parameters are indexed for inflation and published in the autumn
 * *of* the tax year, which means a package built in the middle of a year is
 * necessarily working with some figures that do not exist yet. Every competitor
 * carries the previous year forward silently. This one says so.
 */
export type ParameterStatus =
  /** Every figure below is taken from a published state release for this year. */
  | 'published'
  /**
   * At least one figure is carried forward from the prior year because the state
   * has not released the indexed amount yet. The statutory rate is still correct;
   * bracket thresholds and deductions may be understated. `notes` says which.
   */
  | 'provisional';

/**
 * The federal figures a state return is computed from.
 *
 * Deliberately structural rather than a class, and named to match the fields of
 * `EstimateResult` in `us-federal-tax`, so the output of that package's
 * `estimateFederalTax()` can be passed straight in without this package taking a
 * dependency on it.
 */
export interface FederalBasis {
  /** Form 1040 line 11. */
  readonly adjustedGrossIncome: number;
  /** Form 1040 line 15. */
  readonly taxableIncome: number;
  /** The standard-or-itemized deduction actually taken federally — line 12. */
  readonly deduction: number;
  readonly deductionKind: 'standard' | 'itemized';
  /**
   * The federal § 32 earned income credit, Form 1040 line 27.
   *
   * Six of the fourteen taxing states in this package set their own earned
   * income credit as a flat percentage of this figure, so without it their
   * returns come out too high for exactly the filers who can least afford it.
   * From `us-federal-tax` this is `credits.earnedIncomeCredit.credit` — it is
   * nested there, so spreading an `EstimateResult` into this object does **not**
   * populate it and it has to be passed explicitly.
   *
   * Omitting it is treated as "no federal credit", which is the right default
   * for the great majority of filers but is silently wrong for a filer who has
   * one. {@link StateIncomeTaxResult.notes} says so in every state that has a
   * credit.
   */
  readonly earnedIncomeCredit?: number;
}

/**
 * Federal deductions taken *below* AGI, which a state starting from federal
 * taxable income has inherited whether it wanted to or not.
 *
 * Several states that conform to federal taxable income then add specific federal
 * deductions back, one statute at a time, and the list changes every year the
 * federal government creates a new deduction. Colorado has added back the § 199A
 * qualified business income deduction since 2021, and from 2026 adds back the
 * OBBBA overtime deduction as well (HB25-1296) — while still allowing the tips
 * deduction sitting right beside it on the same federal schedule.
 *
 * A state engine that treats "starts from federal taxable income" as "pass it
 * through" gets a Colorado pass-through owner's tax wrong by 4.4% of the whole
 * QBI deduction, every year.
 *
 * Every field is optional; a missing field is treated as zero, which is the right
 * default for the great majority of filers who took none of these.
 */
export interface FederalDeductionsTaken {
  /** § 199A qualified business income deduction — Form 1040 line 13. */
  readonly qualifiedBusinessIncome?: number;
  /** § 224 deduction for qualified tips — Schedule 1-A. */
  readonly tips?: number;
  /** § 225 deduction for qualified overtime — Schedule 1-A. */
  readonly overtime?: number;
  /** § 151(d)(5) additional senior deduction — Schedule 1-A. */
  readonly senior?: number;
  /** § 163(h)(4) deduction for new-vehicle loan interest — Schedule 1-A. */
  readonly carLoanInterest?: number;
}

/** The federal deductions a state may add back, as a discriminator. */
export type FederalDeductionKey = keyof FederalDeductionsTaken;

export interface StateIncomeTaxInput {
  readonly state: StateCode;
  readonly year: number;
  readonly filingStatus: FilingStatus;
  readonly federal: FederalBasis;
  /**
   * Dependents claimed on the state return. Defaults to
   * {@link dependentAges}`.length` when that is supplied, and 0 otherwise.
   */
  readonly dependents?: number;
  /**
   * The age of each dependent at the end of the tax year.
   *
   * Required by any credit banded on a dependent's age, of which New York's
   * Empire State child credit is the largest: `$1,000` for a child under 4 and
   * `$330` (2025) or `$500` (2026) for one aged 4 to 16, refundable. Supplying
   * `dependents` without ages computes that credit as zero, and the result says
   * so, because a count cannot tell a toddler from a nineteen-year-old and the
   * two are worth `$1,000` and nothing.
   *
   * Supply every dependent's age, not only the children's: a dependent parent is
   * a dependent for the exemption and worth nothing here, and leaving them out
   * of the list would understate {@link dependents}.
   */
  readonly dependentAges?: readonly number[];
  /**
   * Earned income for the tax year — wages, salary, tips and net self-employment
   * earnings — as the state measures it.
   *
   * Needed by any credit computed on earnings rather than on a federal figure,
   * and California's are the ones that matter: CalEITC and the Young Child Tax
   * Credit are both functions of California earned income and of nothing else on
   * the return. Neither can be recovered from {@link FederalBasis}, because AGI
   * contains investment and retirement income the credits ignore and is net of
   * above-the-line deductions they do not allow.
   *
   * Omitting it in California computes both credits as zero and says so, with
   * the amount at stake — a single parent of two young children at `$25,000` is
   * owed `$331.76` of CalEITC and `$1,189` of Young Child Tax Credit against a
   * California tax of `$135.88`, so the whole return turns from zero into a
   * refund of `$1,520.76`.
   *
   * For the great majority of filers this is simply gross wages. It is *not*
   * reduced by a 401(k) deferral for the federal credit's purposes and is not
   * here either.
   */
  readonly earnedIncome?: number;
  /**
   * Investment income — taxable and tax-exempt interest, dividends, capital gain
   * net income and net rent and royalty income.
   *
   * Consulted only by an earned income credit with an investment-income limit.
   * California's is `$4,814` for 2025 and it is a **cliff**: one dollar over it
   * costs the whole CalEITC and, with it, the whole Young Child Tax Credit —
   * `$4,528.82` at the worst point — a single parent of two young children with
   * `$9,823` of earnings, which is exactly where CalEITC peaks.
   * Treated as zero when absent, which is right for most filers and is the only
   * safe default, since the alternative is denying a credit nobody said was
   * disqualified.
   */
  readonly investmentIncome?: number;
  /**
   * State-specific additions to the base — most commonly interest on another
   * state's municipal bonds, and in most states the state income tax itself when
   * it was deducted federally as an itemized deduction.
   *
   * This package does not enumerate them: they are a long, state-specific and
   * mostly unbounded list, and inventing a partial one would be worse than asking.
   */
  readonly additions?: number;
  /**
   * State-specific subtractions — US government interest (which no state may tax),
   * Social Security benefits in the many states that exempt them, state 529
   * contributions, military pay, and so on. Same reasoning as `additions`.
   */
  readonly subtractions?: number;
  /**
   * Pennsylvania only, and required there: PA-taxable compensation and other
   * PA-class income. Pennsylvania's base has no relationship to federal AGI —
   * see {@link ConformityBase}.
   */
  readonly pennsylvaniaTaxableIncome?: number;
  /**
   * Pennsylvania only: eligibility income for the Special Tax Forgiveness credit,
   * which includes several things Pennsylvania does not tax — non-taxable
   * interest, gifts and awards over $300, and support from someone else.
   * Defaults to {@link pennsylvaniaTaxableIncome}, which is right for a filer
   * with none of them.
   */
  readonly pennsylvaniaEligibilityIncome?: number;
  /**
   * Federal below-AGI deductions the filer took. Only consulted by states that
   * start from federal taxable income and add specific ones back — see
   * {@link FederalDeductionsTaken}.
   */
  readonly federalDeductions?: FederalDeductionsTaken;
  /**
   * The same federal figures recomputed with one more dollar of income.
   *
   * Supply this to get an exact {@link StateIncomeTaxResult.marginalRate}. The
   * marginal rate is measured by running the whole state computation a dollar
   * higher, and a state figure that is a function of a *federal* figure can only
   * move if the federal figure does.
   *
   * When it is absent the engine adds one dollar to federal AGI and federal
   * taxable income and holds everything else constant — which is right for the
   * deduction but wrong inside the federal earned income credit's phase-out,
   * where a state matching 30% of a credit falling at 21.06 cents on the dollar
   * is itself charging 6.3 points that the reported marginal rate will not show.
   */
  readonly federalOneDollarHigher?: FederalBasis;
  /**
   * The locality the filer **lives in**, if it levies an income tax.
   *
   * Omitting it for a New York City resident is not a small error: the city tax
   * runs to 3.876% of taxable income — $3,174.69 for a single filer at $100,000,
   * which is more than the entire state income tax of twelve of the twenty-three
   * states in this package at the same income. When the state is New York and this is absent,
   * {@link StateIncomeTaxResult.notes} says so and says what it would cost.
   *
   * The locality must sit in {@link StateIncomeTaxInput.state}; passing one that
   * does not is an error rather than a silently ignored field.
   */
  readonly locality?: LocalityCode;
  /**
   * Wages earned inside Yonkers by a filer who does **not** live there, Form
   * Y-203. Yonkers charges non-residents 0.5% of Yonkers-source earnings.
   *
   * Ignored when `locality` is `YONKERS`: a resident pays the surcharge instead,
   * never both. Living in New York City and working in Yonkers means owing both
   * the city resident tax and this one, which is why the result carries a list of
   * local taxes rather than one.
   */
  readonly yonkersNonresidentEarnings?: number;
}

export interface CreditDetail {
  readonly name: string;
  readonly amount: number;
  /** Non-refundable credits are capped at the tax; refundable ones are not. */
  readonly refundable: boolean;
}

export interface SurtaxDetail {
  readonly name: string;
  readonly amount: number;
}

/**
 * One locality's income tax, computed as part of the state return it sits on.
 *
 * There is a list of these rather than one because residence and workplace are
 * different taxes: a filer who lives in New York City and works in Yonkers owes
 * the city's resident tax and the Yonkers nonresident earnings tax in the same
 * year, and the same pattern is the norm in Ohio, Michigan and Kentucky.
 */
export interface LocalIncomeTaxResult {
  readonly locality: LocalityCode;
  readonly localityName: string;
  /** Whether this is the tax on living there or the tax on earning there. */
  readonly basis: 'resident' | 'nonresidentEarnings';
  /** Which figure from the state return the locality applied its rate to. */
  readonly base: 'stateTaxableIncome' | 'stateAdjustedGrossIncome' | 'stateNetTax' | 'wages';
  readonly baseAmount: number;
  readonly taxBeforeCredits: number;
  readonly credits: readonly CreditDetail[];
  /** After credits. Negative when a refundable local credit exceeds the tax. */
  readonly tax: number;
  readonly brackets: readonly BracketDetail[];
  /**
   * The locality's own share of the rate on the next dollar of income, measured
   * the same way the state's is — by running the whole computation a dollar
   * higher. Zero for a nonresident earnings tax, whose base is a wage figure this
   * engine does not vary.
   */
  readonly marginalRate: number;
  readonly provisional: boolean;
  readonly notes: readonly string[];
  readonly citations: readonly Citation[];
}

export interface StateIncomeTaxResult {
  readonly state: StateCode;
  readonly stateName: string;
  readonly year: number;
  readonly filingStatus: FilingStatus;
  /** False for the nine states that do not tax wage income at all. */
  readonly hasIncomeTax: boolean;
  /** Which federal figure this state starts from, and what it was. */
  readonly conformity: {
    readonly base: ConformityBase;
    readonly amount: number;
  };
  readonly additions: number;
  /**
   * The part of {@link additions} this package computed itself: federal
   * deductions the state adds back. Zero for every state that starts from
   * federal AGI, because those deductions are below AGI and were never in the
   * state's base to begin with.
   */
  readonly addBacks: readonly { readonly name: string; readonly amount: number }[];
  readonly subtractions: number;
  /** The state's own standard or itemized deduction. */
  readonly deduction: number;
  /** Exemptions taken as a *deduction* from income, not as a credit. */
  readonly exemptions: number;
  readonly taxableIncome: number;
  readonly taxBeforeCredits: number;
  /** Additional taxes layered on the same base — California's 1% over $1,000,000. */
  readonly surtaxes: readonly SurtaxDetail[];
  readonly credits: readonly CreditDetail[];
  /** Tax after credits, floored at zero unless a refundable credit takes it below. */
  readonly tax: number;
  readonly brackets: readonly BracketDetail[];
  /**
   * The rate on the next dollar of income, measured by running the whole
   * computation one dollar higher rather than by reading a rate schedule.
   *
   * This is the only way to see what a flat-rate state actually costs at the
   * margin. Utah's rate is 4.45%; a single filer at $25,000 faces 5.75%, because
   * the taxpayer tax credit phases out at 1.3 cents on the dollar underneath it.
   */
  readonly marginalRate: number;
  readonly effectiveRate: number;
  /**
   * The local income taxes owed alongside this state return. Empty for most
   * filers, and never populated unless {@link StateIncomeTaxInput.locality} or
   * {@link StateIncomeTaxInput.yonkersNonresidentEarnings} was supplied.
   */
  readonly localTaxes: readonly LocalIncomeTaxResult[];
  /** {@link tax} plus every local tax. Equal to {@link tax} when there are none. */
  readonly totalTax: number;
  /**
   * {@link marginalRate} plus every local marginal rate — what the next dollar
   * of income actually costs this filer at state and local level together.
   */
  readonly totalMarginalRate: number;
  /** True when any figure used was carried forward rather than published. */
  readonly provisional: boolean;
  /** Things a caller — or a language model reading this — would otherwise get wrong. */
  readonly notes: readonly string[];
  readonly citations: readonly Citation[];
}
