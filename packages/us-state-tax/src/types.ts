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
  | 'MA'
  | 'MD'
  | 'MI'
  | 'MS'
  | 'NC'
  | 'NH'
  | 'NJ'
  | 'NV'
  | 'NY'
  | 'OH'
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
 * more than the entire state income tax of twelve of the twenty-six states here
 * — every one of the nine with no income tax, plus Arizona, Indiana and
 * Pennsylvania — and it appears in no table of state tax rates because it is not
 * one.
 */
export type LocalityCode = 'NYC' | 'YONKERS';

/**
 * A locality identified by name rather than by code — every Maryland county and
 * Baltimore City.
 *
 * Two kinds of local income tax live in this package and they are named
 * differently on purpose. New York City and Yonkers are **named things a filer
 * knows they live in**, there are two of them, and their rates move rarely: an
 * enum is right. Maryland's twenty-four jurisdictions are a *lookup table*. Every
 * one of them sets its own rate, they may revise it every year — five did for
 * 2025 and two for 2026 — and `LocalityCode` is a published type, so each county
 * added to it would be a breaking change to anything that switches on it
 * exhaustively.
 *
 * So a county is a string validated at runtime against the year's table, with the
 * rates in data rather than in the type, and the same decision covers Indiana's
 * 92 counties and Michigan's 24 cities when they arrive.
 *
 * `(string & {})` rather than plain `string` keeps `'NYC'` and `'YONKERS'`
 * offered by an editor's autocomplete instead of being swallowed by the wider
 * type.
 */
export type LocalTaxJurisdiction = LocalityCode | (string & {});

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

/**
 * Which input field carries a `stateDefined` state's own measure of income.
 *
 * Three states in this package have no federal starting line, and each needs a
 * different figure. Naming them in a union rather than accepting a generic
 * `stateIncome` keeps the error message specific — a caller who passes
 * Pennsylvania's figure to Massachusetts is told which line of which form the
 * state actually wants.
 */
export type StateDefinedBaseField =
  | 'pennsylvaniaTaxableIncome'
  | 'newJerseyGrossIncome'
  | 'massachusettsFivePercentIncome';

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
   * New Jersey only, and required there: total income as New Jersey measures it
   * — line 27 of the NJ-1040, **before** the pension and retirement income
   * exclusion and before every deduction.
   *
   * New Jersey has no federal starting line. Its gross income tax enumerates its
   * own categories in N.J.S.A. 54A:5-1 and the differences run both ways:
   *
   * - **Not taxed by New Jersey but in federal AGI**: Social Security benefits,
   *   unemployment compensation, New Jersey municipal bond interest, most
   *   gambling winnings from the New Jersey Lottery up to `$10,000`, and
   *   temporary disability benefits paid by the state plan.
   * - **Taxed by New Jersey but not in federal AGI**: elective deferrals to a
   *   403(b) plan (a 401(k) deferral *is* excluded, a 403(b) one is not — the
   *   single most common New Jersey error), contributions to a traditional IRA,
   *   and interest on another state's municipal bonds.
   * - **Netted differently**: a loss in one New Jersey income category cannot
   *   offset income in another, and there is no capital loss carryforward.
   *
   * So federal AGI is not an approximation of this figure, it is a different
   * one, and this package asks rather than guesses.
   */
  readonly newJerseyGrossIncome?: number;
  /**
   * Massachusetts only, and required there: total 5.0% income — Form 1 line 21.
   *
   * Massachusetts has no federal starting line either, and the divergences are
   * not the same ones New Jersey has:
   *
   * - **Not taxed by Massachusetts but in federal AGI**: Social Security and
   *   railroad retirement benefits (entirely, not 15% of them), contributory
   *   pensions paid by the United States or by Massachusetts and its political
   *   subdivisions, and interest on Massachusetts municipal bonds.
   * - **Taxed by Massachusetts but not in federal AGI**: the amount of any
   *   traditional IRA deduction, the deductible half of self-employment tax, and
   *   the early-withdrawal penalty — Massachusetts disallows all three of those
   *   federal above-the-line deductions under M.G.L. c. 62 § 2(d)(1)(A), so each
   *   one has to be added back to federal AGI to reach this figure.
   * - **Interest and dividends belong here**, even though they are Part A income
   *   rather than Part B: since 2020 they are taxed at the same 5% and Form 1
   *   line 21 adds them in. So do long-term capital gains, which are Part C and
   *   also taxed at 5%.
   *
   * What does *not* belong here is anything taxed at a rate other than 5% —
   * {@link shortTermCapitalGains} and {@link collectiblesGains}, which are
   * separate inputs because they are separate rates.
   *
   * Supply the figure after the federal above-the-line deductions Massachusetts
   * does allow and before the Form 1 line 11–15 deductions this package models
   * from {@link socialSecurityAndMedicarePaid} and {@link rentPaid}.
   */
  readonly massachusettsFivePercentIncome?: number;
  /**
   * Net short-term capital gains — gains on assets held one year or less.
   *
   * Massachusetts taxes these at **8.5%**, not at the 5% every "Massachusetts is
   * a 5% flat tax state" summary reports. It is the only state in this package
   * whose base is split by the *kind* of income rather than by its size, and the
   * gap is 70% of the headline rate. M.G.L. c. 62 § 4(a).
   *
   * Net of losses, and not below zero: Massachusetts allows a net capital loss
   * to offset only up to `$2,000` of interest and dividend income, and this
   * package does not model that offset — see the state's notes.
   */
  readonly shortTermCapitalGains?: number;
  /**
   * Long-term capital gains on collectibles and pre-1996 installment sales,
   * before the 50% deduction.
   *
   * Massachusetts taxes these at **12%** — the highest rate in the state — on
   * half the gain, for an effective 6%. Pass the whole gain; the deduction is
   * applied here. M.G.L. c. 62 § 4(a) and § 2(c)(3).
   */
  readonly collectiblesGains?: number;
  /**
   * Social Security, Medicare, railroad, US or Massachusetts public retirement
   * contributions paid during the year, per return.
   *
   * Massachusetts deducts them, up to `$2,000` **per filer** — Form 1 line 11.
   * Almost every Massachusetts wage earner has one and it is worth `$100` of
   * tax at the 5% rate, `$200` on a joint return where both spouses work. There
   * is no federal equivalent, so it cannot be recovered from any federal figure
   * and is treated as zero when absent, which overstates the tax.
   *
   * Medicare premiums withheld from a Social Security payment are **not**
   * deductible and should not be included.
   */
  readonly socialSecurityAndMedicarePaid?: number;
  /**
   * Age of the filer at the end of the tax year.
   *
   * Consulted by any rule banded on the filer's own age rather than a
   * dependent's. New Jersey has two: the `$1,000` senior exemption at 65, and
   * the retirement income exclusion at 62 — which is worth up to `$100,000` of
   * excluded income and is therefore the single largest thing in this package
   * that cannot be computed without it.
   */
  readonly filerAge?: number;
  /** Age of the spouse at the end of the tax year, on a joint return. */
  readonly spouseAge?: number;
  /**
   * Filer and spouse who are blind or permanently disabled — 0, 1 or 2.
   *
   * Worth `$1,000` each in New Jersey, N.J.S.A. 54A:3-1(b)(5)-(6). Dependents do
   * not count: New Jersey gives no additional exemption for a blind dependent.
   */
  readonly blindOrDisabled?: number;
  /**
   * Dependents under 22 attending an accredited post-secondary institution full
   * time, who are also counted in {@link dependents}. New Jersey gives them a
   * second `$1,000` exemption on top of the `$1,500` dependent one.
   */
  readonly dependentsAttendingCollege?: number;
  /**
   * Taxable pension, annuity and IRA withdrawals, as the state measures them.
   *
   * Consulted by {@link StateIncomeTaxInput.state}s with a retirement income
   * exclusion. In New Jersey the exclusion is up to `$100,000` on a joint return
   * and it vanishes entirely one dollar above `$150,000` of total income, so
   * omitting this understates a retiree's exclusion to zero and supplying it
   * near the limit is the difference between the two largest answers this
   * package can give for the same filer.
   */
  readonly retirementIncome?: number;
  /**
   * Property tax paid in the year on a principal residence in the state.
   *
   * New Jersey allows a deduction of up to `$15,000` of it, **or** a flat `$50`
   * refundable credit, whichever leaves the filer better off — and which one
   * that is depends on the rest of the return, so the engine computes both.
   */
  readonly propertyTaxPaid?: number;
  /**
   * Rent paid in the year on a principal residence in the state. New Jersey
   * treats 18% of it as property tax, so a tenant is eligible for the same
   * deduction or credit as an owner. Ignored when {@link propertyTaxPaid} is
   * supplied; a filer who both owned and rented in the same year should add the
   * two into {@link propertyTaxPaid} themselves.
   *
   * Massachusetts reads the same field for a different rule: half the rent, up
   * to `$4,000` per return (`$2,000` married filing separately), is deducted
   * outright — Form 1 line 14. There the cap binds at `$8,000` of annual rent,
   * which is below the market rent of anywhere in the state, so for a
   * Massachusetts tenant this field is worth a flat `$200` of tax.
   */
  readonly rentPaid?: number;
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
   * which is more than the entire state income tax of twelve of the twenty-six
   * states in this package at the same income. When the state is New York and this is absent,
   * {@link StateIncomeTaxResult.notes} says so and says what it would cost.
   *
   * The locality must sit in {@link StateIncomeTaxInput.state}; passing one that
   * does not is an error rather than a silently ignored field.
   */
  readonly locality?: LocalityCode;
  /**
   * The Maryland county — or Baltimore City — the filer lived in on the last day
   * of the tax year.
   *
   * **Not optional in practice.** Every Maryland resident owes a county income
   * tax; there is no county-free jurisdiction. It runs from 2.25% (Worcester,
   * which is exactly the statutory floor) to 3.30% (Dorchester and Kent) of
   * Maryland taxable income, and for a middle-income filer it is roughly a third
   * of the whole Maryland bill — more than the entire state income tax of nine
   * of the states in this package. Omitting it computes the state half of a
   * Maryland return, and {@link StateIncomeTaxResult.notes} then says what the
   * cheapest and dearest counties would have cost this exact filer.
   *
   * Names are matched case-insensitively and the word "County" is optional, so
   * `'Montgomery'`, `'montgomery county'` and `'Montgomery County'` are the same
   * jurisdiction. `'Baltimore'` alone is an error rather than a guess: Baltimore
   * City and Baltimore County are different jurisdictions that set their own
   * rates.
   */
  readonly county?: string;
  /**
   * Maryland itemized deductions — the federal Schedule A total less the state
   * and local **income** taxes inside it, which Maryland does not allow.
   *
   * Supplied rather than derived because no figure on a federal return carries
   * it: `federal.deduction` is the whole Schedule A total including the state
   * income tax that has to come out. Maryland also allows itemizing **only** if
   * the filer itemized federally (Md. Code, Tax-Gen. § 10-218(b)), so this field
   * is ignored unless {@link FederalBasis.deductionKind} is `itemized`.
   *
   * From tax year 2025 the amount is then reduced by 7.5% of federal AGI over
   * `$200,000` (`$100,000` married filing separately) — a limit with no federal
   * analogue since § 68 lapsed, and one that adds about two thirds of a point to
   * the marginal rate of every Maryland itemizer above the threshold.
   */
  readonly stateItemizedDeductions?: number;
  /**
   * Net capital gain included in the state's taxable income, for a state that
   * charges a surtax on it — Maryland's 2% surtax, new for tax year 2025.
   *
   * Maryland exempts several classes of gain from the surtax: the sale of a
   * principal residence for `$1.5 million` or less, property expensed under IRC
   * § 179, and gains inside 401(k), 403(b), § 408 IRA and Roth accounts. Pass
   * the net gain **after** removing those; this package cannot tell one gain from
   * another.
   *
   * Treated as zero when absent, which is right for the great majority of filers
   * and understates the tax for a filer with a large gain — the surtax is 2% of
   * the whole gain, and it arrives on the single dollar of federal AGI that
   * crosses `$350,000`: `$6,933.08` of tax on one dollar for a single filer whose
   * `$350,000` is all gain.
   */
  readonly netCapitalGain?: number;
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
  /**
   * The Michigan city the filer **lives in**, if it is one of the 24 that levy
   * an income tax.
   *
   * Unlike Maryland's and Indiana's counties this is genuinely optional: most
   * Michigan residents live in none of the 24, and for them there is no city tax
   * and nothing to pass. For the ones who do it is the larger half of a
   * paycheck's local deduction — Detroit charges residents **2.4%** of city
   * income, which is 57% of what Michigan itself charges at 4.25%, and Highland
   * Park 2.0%.
   *
   * Names are matched case-insensitively. The 24 are Albion, Battle Creek,
   * Benton Harbor, Big Rapids, Detroit, East Lansing, Flint, Grand Rapids,
   * Grayling, Hamtramck, Highland Park, Hudson, Ionia, Jackson, Lansing, Lapeer,
   * Muskegon, Muskegon Heights, Pontiac, Port Huron, Portland, Saginaw,
   * Springfield and Walker; anything else is an error rather than a zero.
   *
   * **In Ohio the same field carries the municipality**, and there are 679 of
   * them — every city and village in the state that levies an income tax, from
   * Columbus and Cleveland at 2.5% to Bedford and Parma Heights at 3.0%. Ohio's
   * municipal income taxes raise more than half of what the state income tax
   * does, and a Columbus resident's 2.5% on gross wages is **larger than their
   * whole Ohio state tax** at every income up to about `$130,000`. The base is
   * {@link qualifyingWages}, not any line of the IT 1040.
   */
  readonly city?: string;
  /**
   * Income as the city measures it, **before** the city's own exemptions.
   *
   * A Michigan city income tax has no line on the MI-1040 behind it. The Uniform
   * City Income Tax Ordinance defines its own base, and it excludes several
   * things federal AGI contains, **entirely and for every city**:
   *
   * - pensions, annuities and IRA distributions;
   * - Social Security and railroad retirement benefits;
   * - unemployment compensation;
   * - the military pay of members of the armed forces.
   *
   * A resident is taxed on everything else wherever earned — including interest,
   * dividends and capital gains, which is why this is not simply wages.
   *
   * When it is absent the engine uses federal AGI less {@link retirementIncome},
   * and {@link StateIncomeTaxResult.notes} says so. That derivation is right for
   * a working filer with no Social Security, unemployment or military pay, and
   * **overstates** the tax for anyone with them.
   */
  readonly cityIncome?: number;
  /**
   * A Michigan or Ohio taxing city the filer worked in but does **not** live
   * in, and {@link workCityEarnings} the wages earned inside it.
   *
   * In **Michigan** the city taxes a nonresident at half its resident rate, and
   * the filer's home city — if it is also one of the 24 — credits the tax paid,
   * capped at the home city's own nonresident rate.
   *
   * In **Ohio** there is no half rate: a municipality charges a commuter the
   * same rate it charges a resident, and it is the *workplace* municipality that
   * gets the money first. The home municipality's credit is set by its own
   * ordinance rather than by statute — see {@link residentCreditRate}.
   *
   * Both taxes are computed when both cities are supplied, and the credit
   * appears in the home city's result.
   */
  readonly workCity?: string;
  /**
   * Wages earned inside {@link workCity}, apportioned by working days.
   *
   * Detroit's Form DW-4 and Grand Rapids's GRW-4 both compute it the same way —
   * gross wages times city working days over total working days — and days at
   * the home office, sick days, vacation and holidays are not city days wherever
   * they were taken. This package takes the apportioned figure; it cannot
   * compute it. In Ohio the same field carries the qualifying wages earned
   * inside {@link workCity}, which is what the employer withheld on.
   */
  readonly workCityEarnings?: number;
  /**
   * Ohio only: **qualifying wages** — the base of every Ohio municipal income
   * tax, and a figure with no line on the IT 1040 behind it.
   *
   * O.R.C. § 718.01(R) defines it as "wages, as defined in section 3121(a) of
   * the Internal Revenue Code, without regard to any wage limitations" — which
   * is **Medicare wages, box 5 of the W-2**, and not box 1. The gap is the whole
   * point:
   *
   * - a **401(k), 457 or SIMPLE elective deferral does not reduce it.** Box 1 is
   *   net of the deferral and box 5 is not, so a Columbus resident deferring the
   *   `$24,500` 2026 maximum is charged 2.5% on all of it — `$612.50` a year
   *   that a model reading box 1, or federal AGI, never sees;
   * - a **§ 125 cafeteria-plan (health premium) contribution does** reduce it,
   *   because it is outside § 3121(a) altogether;
   * - **intangible income — interest, dividends and capital gains — is excluded
   *   entirely** by § 718.01(S), as are pensions, IRA distributions, Social
   *   Security and unemployment compensation. An Ohio retiree with no wages owes
   *   their municipality nothing.
   *
   * A resident is also taxed on the **net profit** of a business or rental
   * carried on anywhere; add it here if there is any. Ohio's own personal
   * exemption is a state figure under § 5747.025 and does not reach a
   * municipality, so this is not reduced by it.
   *
   * There is deliberately no derivation from federal AGI: AGI contains the
   * intangible income a municipality may not tax and is net of above-the-line
   * deductions box 5 never saw, so it is a different figure rather than an
   * approximation of this one. An Ohio return naming a `city` without this — or
   * without {@link earnedIncome} to stand in for it — is an error.
   */
  readonly qualifyingWages?: number;
  /**
   * Ohio only: **Ohio business income** — Schedule IT BUS line 10, before the
   * business income deduction.
   *
   * Ohio is the only state in this package that taxes two kinds of income on the
   * same return at two unrelated rates. The first `$250,000` of business income
   * (`$125,000` married filing separately) is deducted outright under
   * § 5747.01(A)(31), and every dollar above it is taxed at a **flat 3%** —
   * which is *below* the 2.75% nonbusiness rate only in the sense that it never
   * rises: a pass-through owner with `$1,000,000` of Ohio business income pays
   * 3% on `$750,000` of it and nothing on the rest.
   *
   * Treated as zero when absent, which is right for a wage earner and
   * **overstates** the tax for anyone with Schedule C, Schedule F or active
   * Schedule E income — the deduction is the largest single thing on an Ohio
   * small business owner's return.
   */
  readonly businessIncome?: number;
  /**
   * Ohio only: whether **each** spouse on a joint return has at least `$500` of
   * qualifying income — O.R.C. § 5747.05(E)(1).
   *
   * The joint filing credit is worth up to `$650` and is allowed only where both
   * spouses have qualifying income of their own: Ohio AGI **less** interest,
   * dividends, capital gains and rental income, computed per spouse. No federal
   * figure on a joint return splits income between the two people on it, so this
   * package cannot derive it.
   *
   * Absent, the credit is computed as **zero** and the result says what it would
   * have been worth. That is the safe direction — a single-earner couple is not
   * entitled to it — but it is wrong for the majority of joint returns, where
   * both spouses work.
   */
  readonly bothSpousesHaveQualifyingIncome?: boolean;
  /**
   * Ohio only: the share of the tax paid to {@link workCity} that the filer's
   * **home** municipality credits — the "Credit Rate" column of Ohio's own
   * municipal rate table.
   *
   * Ohio has no statutory resident credit. O.R.C. Chapter 718 leaves it to each
   * municipality's ordinance, so the two numbers below are jurisdiction-specific
   * data that no state rate table carries. Most municipalities credit 100%
   * limited to their own rate, which is what this package assumes when neither
   * field is supplied — and says so in the result, with the amount at stake.
   */
  readonly residentCreditRate?: number;
  /**
   * Ohio only: the rate the home municipality caps its resident credit at — the
   * "Credit Factor" (or credit limit) column of the same table. The credit is
   * the lesser of {@link residentCreditRate} times the tax paid and this rate
   * times the earnings the other municipality taxed.
   */
  readonly residentCreditLimitRate?: number;
  /**
   * Ohio only: the **school district** the filer lives in, as its four-digit
   * number — `'0203'` is Bluffton EVSD in Allen County — or by name where the
   * name is unique.
   *
   * 214 of Ohio's 600-odd districts levy an income tax of their own, at 0.25% to
   * 2.00%, on a separate SD 100 return and **on top of** the state and municipal
   * taxes. It is charged on residence and on nothing else: there is no
   * nonresident district tax and no credit for tax paid to another district.
   *
   * The base is one of two, chosen by the district's own ballot language, and
   * they are not variations of each other:
   *
   * - **traditional** (146 districts) — modified AGI less exemptions, which
   *   *adds the business income deduction back*, so a district taxes income the
   *   Ohio return itself does not;
   * - **earned income** (68 districts) — {@link earnedIncome} and nothing else,
   *   with no deductions and no exemptions at all, measured as included in
   *   modified AGI, which is **box 1** of the W-2 where the municipal tax
   *   reaches **box 5**.
   *
   * An earned income district needs {@link earnedIncome} and is an error without
   * it. Ohio's own Finder resolves an address to a district; this package
   * cannot, and a district that levies nothing is simply not in the table.
   */
  readonly schoolDistrict?: string;
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
 * Income the state taxes at a rate of its own, beside the main schedule.
 *
 * Massachusetts is the only supported state that does this, and it is the reason
 * calling it "a 5% flat tax state" is wrong rather than merely rough: a
 * short-term capital gain is taxed at **8.5%** and a long-term gain on
 * collectibles at **12%** on half the gain. Neither rate appears in any table of
 * state income tax rates, because such a table has one row per state.
 *
 * The distinction from {@link SurtaxDetail} is which question the rate answers.
 * A surtax asks *how much* income there is — California's 1% over `$1,000,000`,
 * Massachusetts's own 4% over the indexed threshold. An income class asks *what
 * kind* it is, and the answer does not change with the amount.
 */
export interface IncomeClassDetail {
  readonly name: string;
  readonly rate: number;
  /** The gross amount supplied, before any class deduction. */
  readonly income: number;
  /**
   * What the rate was actually applied to — after the class's own deduction
   * (Massachusetts deducts half of a collectibles gain) and after any exemption
   * left over from the main schedule.
   */
  readonly taxableAmount: number;
  readonly tax: number;
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
  readonly locality: LocalTaxJurisdiction;
  readonly localityName: string;
  /** Whether this is the tax on living there or the tax on earning there. */
  readonly basis: 'resident' | 'nonresidentEarnings';
  /** Which figure from the state return the locality applied its rate to. */
  readonly base:
    | 'stateTaxableIncome'
    | 'stateAdjustedGrossIncome'
    | 'stateNetTax'
    | 'cityIncome'
    | 'qualifyingWages'
    | 'stateModifiedTaxableIncome'
    | 'stateEarnedIncome'
    | 'wages';
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
  /**
   * The part of {@link subtractions} this package computed itself, rather than
   * taking from {@link StateIncomeTaxInput.subtractions}. New Jersey's pension
   * and retirement income exclusion is the only one so far, and it is the
   * largest subtraction in the package.
   */
  readonly computedSubtractions: readonly { readonly name: string; readonly amount: number }[];
  /**
   * The state's own standard or itemized deduction, plus any property tax
   * deduction the engine decided was worth more than the credit it replaces.
   */
  readonly deduction: number;
  /** Exemptions taken as a *deduction* from income, not as a credit. */
  readonly exemptions: number;
  /**
   * Taxable income on the state's main schedule. In Massachusetts this is the
   * 5.0% income only; the separately rated classes are in
   * {@link incomeClasses} and are **not** included here.
   */
  readonly taxableIncome: number;
  /**
   * Tax on {@link taxableIncome} plus the tax on every {@link incomeClasses}
   * entry, before surtaxes and before credits.
   */
  readonly taxBeforeCredits: number;
  /**
   * Income the state taxes at a rate of its own. Empty for every state but
   * Massachusetts — see {@link IncomeClassDetail}.
   */
  readonly incomeClasses: readonly IncomeClassDetail[];
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
