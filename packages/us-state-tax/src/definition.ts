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
  StateDefinedBaseField,
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
   * An additional exemption for each filer at or above {@link seniorAge}.
   *
   * New Jersey's, N.J.S.A. 54A:3-1(b)(3). It is claimed **per person**, so a
   * joint return where both spouses are 65 gets two, and it needs the filer's
   * age — which no federal figure carries.
   */
  readonly perSeniorFiler?: number;
  readonly seniorAge?: number;
  /** An additional exemption for each blind or disabled filer or spouse. */
  readonly perBlindOrDisabledFiler?: number;
  /**
   * An additional exemption for each dependent under 22 attending an accredited
   * post-secondary institution full time — New Jersey's, N.J.S.A. 54A:3-1.1.
   * It stacks with {@link perDependent} rather than replacing it.
   */
  readonly perCollegeDependent?: number;
  /**
   * An additional exemption for each **dependent** at or above {@link seniorAge}
   * — Maryland's, Md. Code, Tax-Gen. § 10-211(b). Worth the same `$3,200` as the
   * dependent exemption it doubles, and claimable for a dependent parent or
   * grandparent, which is the case it exists for.
   *
   * It needs {@link StateIncomeTaxInput.dependentAges}: a count cannot tell a
   * dependent child from a dependent parent, and here the two differ by `$3,200`
   * of exemption.
   */
  readonly perSeniorDependent?: number;
  /**
   * The amount **each** exemption is worth, as a step function of federal AGI —
   * Maryland's, Md. Code, Tax-Gen. § 10-211(c).
   *
   * When present it replaces {@link perFiler} and {@link perDependent} for the
   * base exemption: the amount is the step for this filer's federal AGI, times
   * the number of exemptions claimed (the filer, the spouse on a joint return,
   * and each dependent). `perFiler` and `perDependent` still hold the top-step
   * figures, and `test/maryland.test.js` asserts that the two agree, so the
   * stored table cannot drift away from the steps that generate it.
   *
   * It is a **staircase, not a phase-out**, and that is the whole of what makes
   * it expensive. Maryland's `$3,200` exemption drops to `$1,600` above
   * `$100,000` of federal AGI, `$800` above `$125,000` and nothing above
   * `$150,000` — each of them arriving on one dollar, and each of them
   * multiplied by every exemption on the return. A joint return with four
   * dependents loses `$9,600` of exemption on the dollar that crosses
   * `$150,000`, which at 4.75% state plus a 3.20% county rate is **`$763.28` of
   * tax on one dollar of income**.
   *
   * The additions above — senior, blind, senior dependent — are *not* stepped.
   * The Form 502 exemption boxes multiply them by a flat `$1,000` (or `$3,200`)
   * regardless of income, and only box A carries the chart.
   */
  readonly perExemptionSteps?: ByStatus<readonly CreditStep[]>;
  /**
   * How many personal exemptions the filer or filers themselves claim, where it
   * is not the number of people on the return.
   *
   * A qualifying surviving spouse is the case. This package counts that status as
   * two filers everywhere else, because it files on the joint rate schedule — but
   * there is no spouse to claim an exemption for, and the Form 502 exemption box
   * has a line for "Yourself" and a line for "Spouse". Maryland is the first
   * state here where the two counts have to differ.
   */
  readonly filersClaimed?: ByStatus;
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
  | { readonly kind: 'brackets'; readonly byStatus: ByStatus<readonly Bracket[]> }
  /**
   * **One rate, chosen by a bracket, applied to the whole income** — Frederick
   * County, Maryland.
   *
   * This is not a graduated schedule and the difference is the whole point. A
   * `brackets` rule taxes each band at its own rate, so crossing a threshold
   * costs the rate difference on *one dollar*. This rule looks the bracket up and
   * charges that rate on **every** dollar, so crossing a threshold costs the rate
   * difference on the *whole income*.
   *
   * Frederick and Anne Arundel are the only two Maryland counties with more than
   * one rate; both appear as multi-row entries in the same local tax rate chart
   * in the Maryland instructions, and only one of them is marginal. A model that
   * reads the chart and assumes brackets gets Frederick wrong by up to `$360.03` at
   * `$150,000` of Maryland taxable income — where the rate steps from 2.96% to
   * 3.20% and the county collects the difference on all of it.
   */
  | { readonly kind: 'rateByBracket'; readonly byStatus: ByStatus<readonly Bracket[]> };

/**
 * A state itemized deduction, taken instead of the standard one — Maryland's,
 * Md. Code, Tax-Gen. § 10-218.
 *
 * Two facts make this a rule rather than a number the caller passes in as a
 * deduction:
 *
 * 1. **It is gated on the federal election.** Maryland allows itemizing only if
 *    the filer itemized federally. So the OBBBA's larger federal standard
 *    deduction removed the Maryland itemized deduction from filers whose
 *    Maryland deductions did not change at all — the conformity story of this
 *    package, arriving one level down.
 * 2. **From tax year 2025 it phases out, and the phase-out has no federal
 *    twin.** The 2025 Budget Reconciliation and Financing Act (HB 352) reduces
 *    Maryland itemized deductions by {@link phaseOutRate} of federal AGI above
 *    {@link phaseOutThreshold}, which is § 68 ("Pease") reinvented by a state
 *    seven years after Congress suspended the federal version.
 *
 * The phase-out is worth more than it looks. At 7.5% of AGI, every dollar of
 * income above the threshold removes 7.5 cents of deduction, which adds
 * `7.5% x (state rate + county rate)` to the marginal rate — about **0.67
 * points** for a filer in the 5.75% bracket in a 3.20% county. It runs until the
 * itemized deduction falls to the standard one, so the band is
 * `(itemized - standard) / 0.075` dollars wide: for `$50,000` of Maryland
 * itemized deductions, more than half a million dollars of income.
 *
 * And the threshold is **not doubled for a joint return** — `$200,000` for a
 * couple and `$200,000` for each of two single filers — while married filing
 * separately gets exactly half.
 */
export interface ItemizedDeductionRule {
  readonly name: string;
  /** True where the state allows itemizing only if the filer itemized federally. */
  readonly requiresFederalItemizing: boolean;
  /** Share of federal AGI above the threshold subtracted from the deduction. */
  readonly phaseOutRate: number;
  readonly phaseOutThreshold: ByStatus;
}

/**
 * A surtax on capital gains, gated on income — Maryland's 2% surtax, new in tax
 * year 2025 under HB 352.
 *
 * The distinction from {@link SurtaxRule} is what the rate applies to. That one
 * layers a rate on the same taxable income the main schedule already taxed. This
 * one asks two different questions of two different figures: **is federal AGI
 * over the threshold**, and if so, **how much of the income was capital gain**.
 *
 * It is the sharpest cliff in this package. The threshold is a **test, not a
 * floor**: below it the surtax is nothing and above it the *whole* gain is taxed,
 * so the dollar that crosses `$350,000` of federal AGI costs 2% of everything
 * that reached taxable income. For a single filer whose `$350,000` is all
 * capital gain that is **`$6,933.08` on one dollar** — larger than any other
 * single-dollar step here, against `$4,528.82` for the CalEITC investment-income
 * cliff and `$1,381` for New Jersey's retirement exclusion wall. Higher up it
 * stops being a cliff and is simply 2%: `$20,000` on a `$1,000,000` gain.
 *
 * The threshold is also per **return**, not per person, so two spouses with
 * `$300,000` each pay it and two single filers with the same income do not.
 */
export interface CapitalGainsSurtaxRule {
  readonly name: string;
  readonly rate: number;
  /** Federal AGI **above** which the surtax applies to the whole gain. */
  readonly agiThreshold: number;
  /** True when the threshold is per return regardless of filing status. */
  readonly thresholdNotDoubledForJoint: boolean;
}

/**
 * A flat credit for an older filer, cut off by an income limit — Maryland's
 * senior tax credit, Md. Code, Tax-Gen. § 10-754.
 *
 * `$1,000` for one filer aged 65 or over and `$1,750` where a joint return has
 * two, and the income limit is a cliff rather than a phase-out: `$100,000` of
 * federal AGI for a single filer, `$150,000` on a joint return. One dollar over
 * costs the whole credit, which makes it the second-largest single-dollar cliff
 * in the Maryland return after the capital gains surtax.
 */
export interface SeniorCreditRule {
  readonly name: string;
  readonly minimumAge: number;
  /** Amount where one filer qualifies, and where two do. */
  readonly amount: ByStatus;
  readonly amountBothSpouses: ByStatus;
  /** Federal AGI at or below which the credit is allowed at all. A cliff. */
  readonly incomeLimit: ByStatus;
}

/**
 * Income the state pulls out of the main schedule and taxes at its own rate.
 *
 * **This is the shape a table of state income tax rates cannot hold**, and
 * Massachusetts is the state that proves it. Massachusetts appears in every such
 * table as a single row reading 5%. Its statute, M.G.L. c. 62 § 4(a), sets three
 * rates: 5% on Part B income and on the Part A interest and dividends and Part C
 * long-term gains that are taxed alongside it, **8.5%** on short-term capital
 * gains, and **12%** on long-term gains from collectibles. A day trader's
 * Massachusetts rate is 70% higher than the one every rate table reports, and a
 * coin dealer's is 140% higher before the {@link deductionShare} halves it.
 *
 * The distinction from {@link SurtaxRule} is which question decides the rate. A
 * surtax asks how much income there is; a class asks what kind it is.
 *
 * Deductions and exemptions are applied to the main schedule first. Whatever
 * exemption is left over cascades through these classes in order — see
 * {@link StateIncomeTaxDefinition.separatelyRatedIncome}.
 */
export interface IncomeClassRule {
  readonly name: string;
  /** Which input field carries this class's income. */
  readonly field: 'shortTermCapitalGains' | 'collectiblesGains';
  readonly rate: number;
  /**
   * The share of the gain the state deducts before applying {@link rate}.
   *
   * Massachusetts deducts 50% of a long-term collectibles gain (M.G.L. c. 62
   * § 2(c)(3)), so the 12% statutory rate is an effective 6%. Storing the two
   * separately rather than as a single 6% rate is what makes the surtax right:
   * the 4% surtax applies to *taxable* income, which is the amount after the
   * deduction, so folding the deduction into the rate would apply the surtax to
   * twice the correct base.
   */
  readonly deductionShare?: number;
}

/**
 * A tax layered on the same taxable income as the main schedule.
 *
 * Two states here have one, and both put the threshold on the *return* rather
 * than on the filer:
 *
 * - **California's Mental Health Services Tax** — 1% on taxable income over
 *   `$1,000,000`, and the threshold is not doubled for a joint return even
 *   though every bracket in the main schedule is. A `$2,000` marriage penalty
 *   invisible in the brackets.
 * - **Massachusetts's 4% surtax**, the "millionaires tax" of Article XLIV of the
 *   Amendments. Same shape and a much sharper edge, because Massachusetts
 *   *closed* the obvious escape: since tax year 2024 a couple filing a joint
 *   federal return must file jointly in Massachusetts too (M.G.L. c. 62 § 4(d)),
 *   so two spouses with `$700,000` each cannot take two thresholds the way they
 *   could in 2023. The base is total taxable income across every income class,
 *   which is why a once-in-a-lifetime capital gain reaches it.
 *
 * The surtax is applied to the sum of the main schedule's taxable income and
 * every {@link IncomeClassRule}'s, which for a single-class state is just the
 * main schedule.
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
  /**
   * A **second, lower match that is paid out** where {@link matchRate} is capped
   * at the tax — Maryland's, Md. Code, Tax-Gen. § 10-704(c).
   *
   * Maryland is published everywhere as having two earned income credits: a
   * non-refundable one worth 50% of the federal credit and a refundable one
   * worth 45%. They are one credit with a floor. The non-refundable half is
   * `min(50% x federal, Maryland tax)` and the refundable half is
   * `max(45% x federal - Maryland tax, 0)`, so the two never overlap and the
   * total is
   *
   * ```text
   * tax = 0            ->  45% of the federal credit
   * tax >= 50% of it   ->  50% of the federal credit
   * in between         ->  the tax itself
   * ```
   *
   * — a match that **rises from 45% to 50% as the filer's tax rises**, which is
   * the opposite of how a phase-out behaves and is invisible if the two credits
   * are read as separate programmes. Adding 50% and 45% to get 95%, which a model
   * that treats them as two credits does, is wrong by roughly the whole state tax.
   */
  readonly refundableMatchRate?: number;
  /**
   * The match for a filer who is unmarried and has no qualifying child, where it
   * differs — Maryland's is **100%**, § 10-704(c)(3).
   *
   * The largest state match of the federal childless credit in the country, and
   * paid in full: the non-refundable half is capped at the tax and the remainder
   * is refunded, so the total is the whole 100% however small the tax.
   *
   * Maryland also computes it on a federal credit the filer may not have got.
   * § 10-704(c)(3) disregards the § 32 minimum age of 25, so a 21-year-old whose
   * federal childless credit is **zero because of their age** has a Maryland
   * credit of up to `$649`. This package cannot recompute the federal credit, so
   * such a filer must pass the pro forma figure as
   * {@link FederalBasis.earnedIncomeCredit} — the state's notes say so.
   */
  readonly childlessMatchRate?: number;
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
 *
 * Massachusetts's Child and Family Tax Credit is the same rule with the two
 * hardest parts removed and one added. There is **no phase-out at all** — a
 * household earning `$40,000` and one earning `$400,000` get the same `$440` per
 * dependent — and since tax year 2024 there is **no cap on the number of
 * dependents**, where the credit it replaced stopped at two. What it adds is a
 * band at the *other end of life*: a dependent aged 65 or over qualifies exactly
 * as a child under 13 does, which is why {@link AgeBand} takes a `minAge` as well
 * as a `maxAge`.
 */
export interface ChildCreditRule {
  readonly name: string;
  /**
   * Amount per dependent by age. Bands are matched in order and the first match
   * wins, so `[{ maxAge: 3, amount: 1000 }, { maxAge: 16, amount: 500 }]` pays
   * `$1,000` up to and including age 3 and `$500` from 4 to 16, and
   * `[{ maxAge: 12, amount: 440 }, { minAge: 65, amount: 440 }]` pays `$440` at
   * either end of life and nothing in between.
   */
  readonly amountByAge: readonly AgeBand[];
  /**
   * Absent where the credit does not phase out. Massachusetts's does not, which
   * is rarer than it sounds: it is the only credit in this package worth the
   * same to a household at `$400,000` as at `$40,000`.
   */
  readonly phaseOut?: {
    readonly threshold: ByStatus;
    /** Subtracted from the whole credit per increment, or fraction of one. */
    readonly amountPerIncrement: number;
    readonly increment: number;
  };
  readonly refundable: boolean;
}

/** One age band of a per-dependent credit. Bounds are inclusive. */
export interface AgeBand {
  readonly maxAge?: number;
  readonly minAge?: number;
  readonly amount: number;
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

/**
 * Income at or below which the state charges **no tax at all** — New Jersey's
 * filing threshold, N.J.S.A. 54A:8-3.1.
 *
 * This is not a zero bracket and not an exemption. It is a statement about the
 * whole return: "if your New Jersey gross income was $10,000 or less ($20,000
 * for a joint return), you pay no New Jersey tax". Below it the tax is zero
 * however many exemptions the filer has; one dollar above it the tax is computed
 * from the first dollar of taxable income, so the whole first bracket arrives at
 * once.
 *
 * That makes it the sharpest kind of cliff there is: **the threshold is measured
 * on gross income and the tax it triggers is measured on taxable income**, so
 * the size of the cliff depends on the exemptions of the filer standing on it,
 * and a filer with fewer exemptions falls further.
 *
 * It is measured on gross income **after** any {@link RetirementExclusionRule},
 * because New Jersey's is line 29 of the NJ-1040 and the exclusion is line 28.
 *
 * **Massachusetts has the same rule and prints it as a different kind of
 * object.** No Tax Status is a table — `$8,000` single, `$16,400` joint,
 * `$14,400` head of household, plus `$1,000` per dependent — and the table is
 * generated. Two of its three rows are `$7,600` plus that status's own personal
 * exemption:
 *
 * ```text
 * 7,600 + 8,800 (joint)             = 16,400
 * 7,600 + 6,800 (head of household)  = 14,400
 * 1,000 per dependent                = the dependent exemption, unchanged
 * ```
 *
 * Two for two, and the `$1,000` is the dependent exemption itself. So this rule
 * stores one constant and reuses the {@link ExemptionRule} beside it rather than
 * a table that can drift away from the exemptions it is made of. The single row
 * is the exception and is stored: `$8,000` is not `$7,600 + $4,400`, and a single
 * filer adds nothing for dependents either.
 */
export interface ZeroTaxThresholdRule {
  readonly name: string;
  /**
   * The threshold, or — where {@link addsPersonalExemption} is true for the
   * status — the constant the exemptions are added to.
   */
  readonly threshold: ByStatus;
  /** Added to the threshold for each dependent claimed. Massachusetts: $1,000. */
  readonly perDependent?: number;
  /**
   * Statuses whose own personal exemption is added to {@link threshold}. False
   * for a single filer in Massachusetts, which is why `$8,000` is stored whole.
   */
  readonly addsPersonalExemption?: ByStatus<boolean>;
  /**
   * Statuses that cannot claim the threshold at all. Massachusetts bars married
   * filing separately from No Tax Status and from the credit below.
   */
  readonly ineligibleFilingStatuses?: readonly string[];
  /**
   * The credit that keeps the threshold from being a cliff — Massachusetts's
   * Limited Income Credit, M.G.L. c. 62 § 5(b).
   *
   * New Jersey's threshold is a wall: `$252` of tax arrives on one dollar of
   * income. Massachusetts saw the same problem and solved it, and the solution
   * is more interesting than the problem. Just above No Tax Status the tax is
   * limited to **10% of the income above the threshold**, which is not a
   * softening of the 5% rate — it is **double** it. Massachusetts buys the
   * absence of a cliff by charging twice the statutory rate across the band, and
   * that band is the single largest departure from "5%" that an ordinary
   * Massachusetts wage earner will ever see.
   *
   * The published eligibility ceiling is `175%` of the threshold, and it is not
   * where the credit stops being worth anything: the credit is the excess of the
   * tax over that 10%, so it reaches zero where the two lines cross. For a
   * single filer with no dependents that is `$11,600`, not the `$14,000` the
   * instructions print — see {@link ceilingMultiple}.
   */
  readonly limitedIncomeCredit?: {
    readonly name: string;
    /** The share of income above the threshold the tax is limited to. 10%. */
    readonly rate: number;
    /**
     * Eligibility ceiling as a multiple of the threshold — `1.75`.
     *
     * It is a statutory eligibility test and not the end of the credit. Which of
     * the two binds depends on the filer: for a single filer the credit runs out
     * first, and for a joint return with several dependents the ceiling does.
     */
    readonly ceilingMultiple: number;
  };
}

/**
 * A deduction for rent paid on a principal residence in the state.
 *
 * Massachusetts's, M.G.L. c. 62 § 3(B)(a)(9) — half the rent, capped. It is
 * distinct from {@link PropertyTaxReliefRule}, which offers a tenant the *choice*
 * of a deduction or a credit and has to compute the return both ways; this is a
 * deduction and nothing else.
 *
 * The cap is what makes it uninteresting to model as a function of rent and
 * interesting to model at all: at `$4,000` it binds at `$8,000` of annual rent,
 * which is `$667` a month and below the rent of anywhere in Massachusetts. So in
 * practice it is a flat `$4,000` deduction that every Massachusetts tenant gets
 * and no Massachusetts owner does — worth `$200`, and missing from any model that
 * has no way to know the filer rents.
 */
export interface RentDeductionRule {
  readonly name: string;
  /** Share of rent paid that is deductible. 50%. */
  readonly share: number;
  readonly cap: ByStatus;
}

/**
 * A deduction for payroll and public-retirement contributions the filer paid.
 *
 * Massachusetts's, M.G.L. c. 62 § 3(B)(a)(4) — Social Security, Medicare,
 * railroad retirement, and contributions to a United States or Massachusetts
 * public employee retirement system, up to `$2,000` **per filer**. There is no
 * federal analogue at all: the employee half of FICA is not deductible federally,
 * so this figure appears nowhere on a federal return and cannot be derived from
 * one.
 *
 * It binds at `$26,144` of wages (`$2,000 ÷ 7.65%`), so almost every full-time
 * Massachusetts wage earner takes the full `$2,000` and almost every part-time one
 * does not.
 */
export interface PayrollTaxDeductionRule {
  readonly name: string;
  /** The most one filer may deduct. A joint return with two earners gets two. */
  readonly perFilerCap: number;
}

/**
 * An exclusion of retirement income, tiered by total income and gated on age —
 * New Jersey's pension and retirement income exclusion, N.J.S.A. 54A:6-10.
 *
 * The largest single deduction in this package and the largest cliff in it. A
 * joint return with a `$100,000` pension excludes `$25,000` of it at a total
 * income of `$150,000` and **zero** at `$150,001` — about `$1,381` of tax on one
 * dollar of income. There is no taper: the statute's three tiers exclude 100%,
 * 50% and 25% of the pension, capped at the maximum, and then stop dead.
 *
 * Two things about the shape are worth storing rather than transcribing:
 *
 * - **The tier percentages for the other filing statuses are derived.** The
 *   published table gives 37.5% and 18.75% for a single filer and 25% and 12.5%
 *   for a separate one. Each is the joint percentage scaled by that status's
 *   share of the joint maximum — `0.5 x (75,000/100,000) = 0.375`,
 *   `0.25 x (50,000/100,000) = 0.125` — four for four, so this rule stores two
 *   percentages and four maxima instead of ten numbers that can drift apart. In
 *   the full tier every status excludes 100% and the maximum enforces the same
 *   ratio, which is why the scaling applies only below 100%.
 * - **A qualifying surviving spouse takes the *single* maximum**, `$75,000`,
 *   while filing on the *joint* rate schedule. New Jersey is the only state in
 *   this package that splits the status between the two tables, and a model that
 *   maps the status once, at the top, gets one of the two wrong.
 *
 * The tier test is on **total income** — line 27, before the exclusion itself —
 * while the {@link ZeroTaxThresholdRule} that follows it is on line 29, after.
 * Applying either to the other figure is a wrong answer at the margin.
 */
export interface RetirementExclusionRule {
  readonly name: string;
  /** The most that can be excluded, by filing status. */
  readonly maximum: ByStatus;
  /**
   * Tiers by total income, in order. `percentageOfJointMaximum` is scaled to the
   * filer's own maximum by `maximum[status] / maximum.marriedFilingJointly`.
   */
  readonly tiers: readonly { readonly upTo: number; readonly jointPercentage: number }[];
  /** Minimum age of the filer (or, on a joint return, of either spouse). */
  readonly minimumAge: number;
  /**
   * Part II of the worksheet: when earned income is at or below this, the part
   * of the maximum the pension did not use may be applied to *other* income.
   *
   * Another cliff, and a much less visible one: `$3,001` of wages costs a
   * retiree with a small pension the whole unused exclusion.
   */
  readonly otherIncomeEarnedIncomeLimit: number;
}

/**
 * A per-child credit whose amount is a **step function of state taxable income**
 * — New Jersey's child tax credit, N.J.S.A. 54A:4-17.
 *
 * Not a phase-out. The credit is `$1,000` per child under 6 at `$30,000` of New
 * Jersey taxable income and `$800` at `$30,001`, so a family with three young
 * children loses `$600` on one dollar of income, and again at `$40,000`,
 * `$50,000`, `$60,000` and `$80,000`. Five cliffs in one credit, each of them
 * larger the larger the family — the opposite of how a phase-out behaves.
 *
 * Modelling it as a phase-out, or as a single income limit, is wrong across the
 * whole `$30,000`–`$80,000` band, which is most of the families it is aimed at.
 */
export interface SteppedChildCreditRule {
  readonly name: string;
  /** The credit is claimed for each dependent whose age is at or below this. */
  readonly maxAge: number;
  /** Per-child amount for state taxable income at or below each `upTo`. */
  readonly steps: readonly CreditStep[];
  readonly refundable: boolean;
  /**
   * Statuses barred from the credit entirely. New Jersey excludes married
   * filing separately — N.J.S.A. 54A:4-17(c) — which is easy to miss because
   * the income steps are *not* halved for it, so a naive model quietly pays a
   * separate filer the full joint-schedule credit.
   */
  readonly ineligibleFilingStatuses: readonly string[];
}

/**
 * A deduction for property tax paid, with a flat refundable credit as the
 * alternative — New Jersey's, N.J.S.A. 54A:3A-16 through 54A:3A-20.
 *
 * The part that makes it worth a rule of its own: **the filer takes whichever is
 * worth more, and which one that is depends on the whole rest of the return.**
 * The NJ-1040 says so in as many words — compute the tax both ways and use the
 * lower. At the 1.4% bottom rate a `$15,000` deduction is worth `$210` and beats
 * the credit; at `$3,000` of property tax and the same rate it is worth `$42`
 * and loses to it. A model that always deducts is wrong for exactly the filers
 * the credit exists for.
 *
 * A tenant's rent counts at {@link rentFraction} — 18% of rent paid is treated
 * as property tax — which is why a renter is in this computation at all.
 */
export interface PropertyTaxReliefRule {
  readonly deductionName: string;
  readonly creditName: string;
  /** The most property tax that may be deducted. */
  readonly limit: number;
  /** The share of rent paid that counts as property tax. */
  readonly rentFraction: number;
  /** The flat credit taken instead of the deduction, by filing status. */
  readonly credit: ByStatus;
}

export interface StateIncomeTaxDefinition {
  readonly code: StateCode;
  readonly name: string;
  readonly year: number;
  readonly status: ParameterStatus;
  readonly base: ConformityBase;
  readonly rate: RateRule;
  /**
   * Income taken out of {@link rate} and taxed at a rate of its own, in the
   * order any leftover exemption cascades through them. Massachusetts only.
   */
  readonly separatelyRatedIncome?: readonly IncomeClassRule[];
  readonly deduction: DeductionRule;
  /**
   * A state itemized deduction taken instead of {@link deduction} when it is
   * worth more. Maryland only — see {@link ItemizedDeductionRule}.
   */
  readonly itemizedDeduction?: ItemizedDeductionRule;
  readonly rentDeduction?: RentDeductionRule;
  readonly payrollTaxDeduction?: PayrollTaxDeductionRule;
  readonly exemption?: ExemptionRule;
  readonly surtax?: SurtaxRule;
  /** A surtax on capital gains alone, gated on federal AGI. Maryland only. */
  readonly capitalGainsSurtax?: CapitalGainsSurtaxRule;
  readonly seniorCredit?: SeniorCreditRule;
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
  readonly steppedChildCredit?: SteppedChildCreditRule;
  readonly recapture?: RecaptureRule;
  readonly zeroTaxThreshold?: ZeroTaxThresholdRule;
  readonly retirementExclusion?: RetirementExclusionRule;
  readonly propertyTaxRelief?: PropertyTaxReliefRule;
  /**
   * Required when {@link base} is `stateDefined`: which input field carries the
   * state's own measure of income, and why no federal figure can stand in.
   */
  readonly stateDefinedBase?: {
    readonly field: StateDefinedBaseField;
    readonly why: string;
  };
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
