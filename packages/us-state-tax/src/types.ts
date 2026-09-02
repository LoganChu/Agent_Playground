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
  | 'PA'
  | 'SD'
  | 'TN'
  | 'TX'
  | 'UT'
  | 'WA'
  | 'WY';

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
  /** Dependents claimed on the state return. Defaults to 0. */
  readonly dependents?: number;
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
  /** True when any figure used was carried forward rather than published. */
  readonly provisional: boolean;
  /** Things a caller — or a language model reading this — would otherwise get wrong. */
  readonly notes: readonly string[];
  readonly citations: readonly Citation[];
}
