/**
 * Where every number in every state-year came from, and — the half that is
 * load-bearing — **why it is the same as last year's when it is.**
 *
 * ## The measurement that produced this file
 *
 * Day 36 built the federal package's provenance ledger and left the rule: *a
 * list of sources beside a list of figures is not provenance; the mapping is
 * the provenance, and it is the part nobody writes down.* Day 37 measured the
 * state package against it and found the same hole, nearly three times as
 * large: **2,309 figures across 56 state-years, 276 citations, and nothing
 * anywhere saying which document any one figure came from.**
 *
 * But the state package has a second, sharper question the federal one does
 * not, and the measurement found it first:
 *
 * ```text
 * numeric figures over 56 state-years                2,293
 * figures identical in 2025 and 2026 (unbounded aside)   949
 *   of those, flagged as carried forward                 148
 *   of those, explained by nothing at all                801
 * ```
 *
 * Every one of those 847 is one of two completely different things. Either the
 * law fixes the figure — New Jersey's brackets have stood since 2020, Virginia's
 * rate schedule since 1990 — in which case 2026 equals 2025 *because the statute
 * says so*, and that is a fact worth selling. Or nobody read the 2026 document,
 * in which case it is a silent carry-forward: the exact failure this package
 * took nineteen days to notice in Illinois, and the one thing it says about
 * itself that every competitor gets wrong.
 *
 * **THE RULE: a figure that did not move is a claim, and "it did not move" is
 * not the evidence for it.** A package that cannot tell those two apart is
 * carrying the Illinois bug in 847 places and cannot know it.
 *
 * ## What an entry asserts, and what checks it
 *
 * Every numeric parameter of every supported state-year is covered by exactly
 * one entry, and `test/provenance.test.js` fails on a figure no entry claims,
 * on an entry no figure needs, and on a tie between two entries of equal
 * specificity. Beyond coverage, each entry makes three falsifiable claims:
 *
 *  1. **`constant`, checked in both directions.** An entry claiming its figures
 *     never move fails if one moves; an entry claiming they move fails if none
 *     of them does. The second half is the one with teeth, because an `indexed`
 *     figure that has not moved is the shape of a silent carry-forward — so an
 *     `indexed` entry may not claim `constant` without a written `why`, and six
 *     of them have one.
 *  2. **`document` names a citation the state-year already carries.** Not a new
 *     citation, not a statute remembered from somewhere: a substring of a title
 *     already in that definition's `citations`, every one of which a previous
 *     run sourced and cross-checked. Day 36's rule — *a wrong citation is worse
 *     than a missing one* — applied to a file that makes 200 claims in one
 *     sitting. The ledger can map figures to evidence this package already has;
 *     it is not licensed to invent evidence, and the test enforces the
 *     difference.
 *  3. **`carried-forward` agrees with `provisionalFigures`, both ways.** A
 *     figure this ledger calls carried forward must be flagged there, and a
 *     figure flagged there must be called carried forward here. Two ledgers
 *     describing the same fact are worth having only if something fails when
 *     they disagree.
 *
 * ## `unestablished` is a measured backlog, not a shrug
 *
 * Where neither this package's citations nor its notes settle which kind a
 * figure is, the entry says `unestablished` and names what would settle it. The
 * count is pinned in `test/provenance.test.js` and may go down and not up,
 * which is how the mutation score went from 85.8% to 99.1% over three days.
 * The alternative — guessing a kind for a figure whose statute nobody read —
 * would make the ledger's other 2,000 claims worthless, because a reader cannot
 * tell a guessed entry from a sourced one.
 */
import type { Citation, FilingStatus } from '../types.js';
import type { StateCode } from '../types.js';

/**
 * What kind of authority sets a figure, and therefore **what a new tax year
 * costs.** That is the only operational question provenance can settle, and it
 * is why the kind is not a label on a document.
 */
export type StateFigureKind =
  /**
   * The state's code prints the figure. A change is an amendment, and an
   * amendment is news — nothing is owed when a tax year is added.
   */
  | 'statute'
  /**
   * The code prints a *different* figure for different years, on its own
   * schedule or by an annual appropriation act. A new year costs a reading of
   * that schedule, and the figure can move without being indexed.
   */
  | 'statute-scheduled'
  /**
   * The state publishes an adjusted figure for each tax year, and **this
   * year's was read.** A new year costs that release.
   */
  | 'indexed'
  /**
   * The figure *is* a federal figure, adopted by reference. A new year costs
   * nothing to the state and everything to whoever tracks the federal one.
   */
  | 'federal-conformity'
  /** Published by an agency that is not the state's revenue department. */
  | 'agency'
  /**
   * Equal to another figure in this package by a relation something asserts.
   * A new year costs nothing beyond the figure it is derived from.
   */
  | 'derived'
  /**
   * Not read for this year: last year's figure, or a statutory default,
   * standing in. **Must be flagged in `provisionalFigures`.**
   */
  | 'carried-forward'
  /**
   * The law does not determine the figure until the tax year has closed, so no
   * amount of reading during the year can settle it.
   */
  | 'determined-after-year-end'
  /**
   * Not published for this year, not last year's figure either: **computed from
   * figures that ARE published for this year**, under an uncertainty the
   * computation bounds.
   *
   * Distinct from `derived`, which is an exact relation between two figures
   * this package holds — the Utah military retirement credit rate IS the tax
   * rate — and from `carried-forward`, which is last year's number standing in.
   * Here the figure is new, it was not read, and the arithmetic says how wrong
   * it can be. `cite` must state the bound, and the figure must be flagged in
   * `provisionalFigures` with reason `bounded-derivation` — checked both ways by
   * `test/provenance.test.js`, exactly as `carried-forward` is.
   *
   * Wisconsin's three 2026 standard deduction figures are the first. The 2026
   * rate schedules ARE published and the top bracket threshold is indexed off a
   * statutory base of $225,000, so a published threshold bounds the cumulative
   * indexation factor to 7.5 parts per million — which determines four of the
   * seven figures of the unpublished standard deduction schedule outright and
   * narrows these three to two adjacent multiples of $10 each.
   */
  | 'derived-bounded'
  /**
   * Not a figure read from anywhere: a value chosen to encode the *absence* of
   * a limit — a bracket with no ceiling, a phase-out that does not apply.
   */
  | 'sentinel'
  /**
   * Honestly unknown. Nothing in this package's citations or notes says whether
   * the figure is statutory or indexed, so nothing here says either.
   * `resolvedBy` names what would settle it.
   */
  | 'unestablished';

/** One claim about one group of figures in one state. */
export interface StateFigureSource {
  readonly state: StateCode;
  /**
   * Dot path into the state's `StateIncomeTaxDefinition`, where `*` matches one
   * segment and `**` matches every remaining segment. Array indices are
   * segments, so `rate.byStatus.*.*.upTo` is every bracket ceiling in every
   * filing status.
   */
  readonly path: string;
  readonly kind: StateFigureKind;
  /**
   * A substring of the title of a citation this state-year already carries.
   * Required except for `sentinel`, `unestablished` and `derived`, and checked
   * to appear in every year the entry covers — so a figure cannot cite a
   * document the state-year does not list.
   *
   * **It must match EXACTLY ONE citation.** Day 37 wrote this field to stop the
   * ledger inventing evidence and then found the looseness underneath: a
   * substring is a weaker claim than it reads as. `'§ 17052'` is inside
   * `'§ 17052.1 — Young Child Tax Credit'`, so every CalEITC figure named the
   * Young Child Tax Credit's section as well as its own; `'§ 5747.02'` is
   * inside `'§ 5747.025'` and `'§ 5747.022'`, so Ohio's rate schedule named
   * three documents, two of them about exemptions. 25 entry-years were
   * ambiguous.
   *
   * **THE RULE: a token that matches a citation is not the same claim as a
   * token that identifies one, and a prefix of a statute number is a prefix of
   * every subsection of it.** `test/provenance.test.js` now fails on a token
   * matching two citations, which is why these read `'§ 17052 —'`: the em dash
   * is already in every title and ends the number.
   */
  readonly document?: string;
  /** The provision, table or worksheet line the figure is read from. */
  readonly cite: string;
  /**
   * Claim: every figure this entry covers is identical in every year it covers.
   * Checked in both directions.
   */
  readonly constant: boolean;
  /** The years this entry covers. Absent means every year the path exists in. */
  readonly years?: readonly number[];
  /**
   * Required where the claim is surprising — an `indexed` figure that has not
   * moved, or a `statute` figure that has. An indexed figure sitting still is
   * the shape of a silent carry-forward, and this package will not let one pass
   * without a sentence saying why it is not one.
   */
  readonly why?: string;
  /** For `carried-forward`: the year the figure was copied from. */
  readonly carriedForwardFrom?: number;
  /**
   * For `carried-forward`, `determined-after-year-end` and `unestablished`: the
   * document that would settle it, named specifically enough to go and find.
   */
  readonly resolvedBy?: string;
}

const STATUSES: readonly FilingStatus[] = [
  'single',
  'marriedFilingJointly',
  'marriedFilingSeparately',
  'headOfHousehold',
  'qualifyingSurvivingSpouse',
];

/** The nine states with no individual income tax carry one figure: the year. */
const NO_TAX: readonly StateCode[] = ['AK', 'FL', 'NH', 'NV', 'SD', 'TN', 'TX', 'WA', 'WY'];

/**
 * `year` is the tax year the definition describes. It is not a figure read from
 * a document — it is the key the document was chosen by — so every state gets
 * one entry for it and the coverage test is not weakened by an exclusion list.
 *
 * **THE LIST OF STATES IS STILL HAND-WRITTEN, AND IT IS THE ONE HAND-WRITTEN
 * LIST IN THIS REPOSITORY THAT IT IS SAFE TO LEAVE SO.** Four states — MN, OR,
 * SC, WI — are deliberately absent because they carry a `year` entry of their
 * own further down, so the list cannot be "every state"; and a state missing
 * from it FAILS the coverage test by name on the first run, which is Day 61's
 * distinction between a list that goes stale by refusing something and one that
 * goes stale by not asking. Deriving it from `SUPPORTED_STATES` would import
 * `states/index.ts`, which imports `louisiana.ts`, which imports this file.
 */
const YEAR_ENTRIES: readonly StateFigureSource[] = (
  [
    'AK', 'AL', 'AR', 'AZ', 'CA', 'CO', 'CT', 'FL', 'GA', 'IA', 'ID', 'IL', 'IN', 'KS', 'KY',
    'LA',
    'MA', 'MD',
    'MI',
    'MS', 'MO', 'NC', 'ND', 'NH', 'NJ', 'NV', 'NY', 'OH', 'OK', 'PA', 'SD', 'TN', 'TX', 'UT',
    'VA', 'WA',
    'WY',
  ] as const
).map((state) => ({
  state,
  path: 'year',
  kind: 'derived' as const,
  cite: 'the tax year this definition describes — the key the documents were chosen by, not a figure read from one',
  constant: false,
}));

/**
 * The ledger.
 *
 * Ordered by state, and within a state by the order the figures appear on the
 * return. Entries are deliberately narrow where the kinds differ — New York's
 * bracket *rates* moved for 2026 and its bracket *ceilings* did not, so they
 * cannot share an entry, exactly as `§ 1(j)(2)` and the indexed federal
 * ceilings cannot.
 */
export const STATE_FIGURE_PROVENANCE: readonly StateFigureSource[] = [
  ...YEAR_ENTRIES,

  // =========================================================================
  // ARIZONA — one figure until Day 47, because the standard deduction was
  // `kind: 'federal'` and Arizona stored no copy of it. HB 4168 §§ 16 and
  // 35(A) replaced that cross-reference with Arizona's own amounts, so there
  // are now eleven, and SIX OF THEM ARE THE INTERESTING KIND: a figure this
  // state's statute carries that is equal to a federal figure for a reason
  // rather than by transcription.
  // =========================================================================
  {
    state: 'AZ',
    path: 'capitalGainsSubtraction.share',
    kind: 'statute',
    document: '§ 43-1022(22)',
    cite:
      "A.R.S. § 43-1022(22) and the Form 140 net long-term capital gain worksheet — 25 percent of the net long-term capital gain included in federal AGI on assets acquired after 31 December 2011. CONSTANT ACROSS BOTH YEARS HERE AND NOT ACROSS THE PROVISION’S LIFE: 10 percent in 2013, 20 percent in 2014, 25 percent from 2015, which policyengine-us 2.40.1 carries as a three-step series citing the same statute and the 2022 Form 140 instructions. The share is the half of this provision that has NOT been under legislative attack — SB 1331 (2025) went after the 2011 vintage and not the quarter, and died.",
    constant: true,
  },
  {
    state: 'AZ',
    path: 'rate.rate',
    kind: 'statute',
    document: '§ 43-1011',
    cite: 'Ariz. Rev. Stat. § 43-1011 — the 2.5% rate, flat since tax year 2023',
    constant: true,
  },
  {
    state: 'AZ',
    path: 'deduction.amounts.*',
    years: [2025],
    kind: 'statute',
    document: 'Laws 2026, ch. 140 (HB 4168) §§ 16 and 35(A)',
    cite: "Ariz. Rev. Stat. § 43-1041(A) as amended by Laws 2026, ch. 140 (HB 4168) §§ 16 and 35(A), signed June 13, 2026 and retroactive to taxable years beginning from and after December 31, 2024 — $15,750 single and separate, $23,625 head of household, $31,500 joint. These are PRINTED IN THE ARIZONA STATUTE and are not this package's copy of a federal figure, which is what they were before HB 4168 and what the absence of this entry used to record.",
    constant: true,
  },
  {
    state: 'AZ',
    path: 'deduction.amounts.*',
    years: [2026],
    kind: 'indexed',
    document: 'Ariz. Rev. Stat. § 43-1041(H)',
    cite: "Ariz. Rev. Stat. § 43-1041(H) indexes the subsection (A) amounts 'in the same manner in which the federal basic standard deduction is adjusted for inflation pursuant to section 63', so the 2026 Arizona amounts are the 2025 ones carried forward by the FEDERAL method and come out equal to the federal figures — $16,100 / $24,150 / $32,200, Rev. Proc. 2025-32 § 4.14(1). INDEXED AND NOT CARRIED-FORWARD, because the index is specified and applied rather than unpublished; what is borrowed is the method, not the number. `test/arizona-deduction.test.js` requires the equality to hold against us-federal-tax and fails the year it stops.",
    constant: true,
  },
  {
    state: 'AZ',
    path: 'itemizedDeduction.phaseOutRate',
    kind: 'statute',
    document: '§ 43-1042',
    cite: 'Ariz. Rev. Stat. § 43-1042 — Arizona itemized deductions, which carry no income-based phase-out of their own, so the rate is zero by the statute saying nothing rather than by this package choosing a default. A filer may itemise in Arizona whether or not they itemised federally.',
    constant: true,
  },

  // =========================================================================
  // CALIFORNIA — the state where almost everything is indexed, so almost
  // everything in 2026 is a carry-forward. The RATES are the exception and the
  // distinction is the whole value of the entry: § 17041 prints them and the
  // Franchise Tax Board indexes only the thresholds they apply to.
  // =========================================================================
  {
    state: 'CA',
    path: 'rate.byStatus.*.*.rate',
    kind: 'statute',
    document: '§ 17041',
    cite: 'Cal. Rev. & Tax. Code § 17041(a)(1) and (b) — the statutory rates, which no indexing provision moves',
    constant: true,
  },
  {
    state: 'CA',
    path: 'rate.byStatus.*.*.upTo',
    years: [2025],
    kind: 'indexed',
    document: 'FTB 2025 California Tax Rate Schedules',
    cite: 'FTB 2025 California Tax Rate Schedules — the thresholds, indexed by the California CPI factor; § 17041(a)(2) doubles the single schedule for a joint return',
    constant: true,
  },
  {
    state: 'CA',
    path: 'rate.byStatus.*.*.upTo',
    years: [2026],
    kind: 'carried-forward',
    document: 'FTB 2025 California Tax Rate Schedules',
    cite: 'the published 2025 thresholds, carried forward — § 17041(h) indexes them by the California CPI factor and the 2026 factor is not published',
    constant: true,
    carriedForwardFrom: 2025,
    resolvedBy:
      "the Franchise Tax Board's annual 'California tax rates and exemptions' release for 2026, and the 2026 Form 540 booklet",
  },
  {
    state: 'CA',
    path: 'deduction.amounts.*',
    years: [2025],
    kind: 'indexed',
    document: 'FTB 2025 California Tax Rate Schedules',
    cite: 'FTB 2025 California Tax Rate Schedules — the standard deduction, indexed by the California CPI factor',
    constant: true,
  },
  {
    state: 'CA',
    path: 'deduction.amounts.*',
    years: [2026],
    kind: 'carried-forward',
    document: 'FTB 2025 California Tax Rate Schedules',
    cite: 'the published 2025 standard deduction, carried forward',
    constant: true,
    carriedForwardFrom: 2025,
    resolvedBy:
      "the Franchise Tax Board's annual 'California tax rates and exemptions' release for 2026, and the 2026 Form 540 booklet",
  },
  {
    state: 'CA',
    path: 'exemptionCredit.seniorAge',
    kind: 'statute',
    document: '§ 17054',
    cite: 'Cal. Rev. & Tax. Code § 17054(a) — the additional credit is for an individual who has attained 65; the age is not indexed',
    constant: true,
  },
  {
    state: 'CA',
    path: 'exemptionCredit.**',
    years: [2025],
    kind: 'indexed',
    document: '§ 17054',
    cite: 'Cal. Rev. & Tax. Code § 17054 — the personal and dependent exemption credits and their AGI limitation, indexed under § 17054(h)',
    constant: true,
  },
  {
    state: 'CA',
    path: 'exemptionCredit.**',
    years: [2026],
    kind: 'carried-forward',
    document: '§ 17054',
    cite: 'the published 2025 exemption credits and phase-out, carried forward',
    constant: true,
    carriedForwardFrom: 2025,
    resolvedBy:
      "the Franchise Tax Board's annual 'California tax rates and exemptions' release for 2026, and the 2026 Form 540 booklet",
  },
  {
    state: 'CA',
    path: 'ownEarnedIncomeCredit.byChildCount.*.children',
    kind: 'statute',
    document: '§ 17052 —',
    cite: 'Cal. Rev. & Tax. Code § 17052(b)(1) — the three qualifying-child bands the credit is tabled against; a count, not an amount',
    constant: true,
  },
  {
    state: 'CA',
    path: 'ownEarnedIncomeCredit.byChildCount.*.phaseInRate',
    kind: 'statute',
    document: '§ 17052 —',
    cite: 'Cal. Rev. & Tax. Code § 17052(b) — the credit percentages of IRC § 32(b) as adopted by reference: 7.65%, 34%, 40% and 45%',
    constant: true,
  },
  {
    state: 'CA',
    path: 'ownEarnedIncomeCredit.adjustmentFactor',
    kind: 'statute-scheduled',
    document: '§ 17052 —',
    cite: 'Cal. Rev. & Tax. Code § 17052(a)(2)(B) — the adjustment factor set by the annual Budget Act; 85% in every year since 2015',
    constant: true,
  },
  {
    state: 'CA',
    path: 'ownEarnedIncomeCredit.minimumAgeWithoutChildren',
    kind: 'statute',
    document: '§ 17052 —',
    cite: 'Cal. Rev. & Tax. Code § 17052(i) — 18, where IRC § 32 sets 25; an age, not an indexed amount',
    constant: true,
  },
  {
    state: 'CA',
    path: 'ownEarnedIncomeCredit.qualifyingChildMaxAge',
    kind: 'statute',
    document: '§ 17052 —',
    cite: 'IRC § 32(c)(3) as adopted by Cal. Rev. & Tax. Code § 17052 — a qualifying child is under 19, or under 24 as a student',
    constant: true,
  },
  {
    state: 'CA',
    path: 'ownEarnedIncomeCredit.byChildCount.*.finalPhaseOutStartCredit',
    years: [2025],
    kind: 'derived',
    document: 'FTB Form 3514',
    cite: 'FTB Form 3514 — read off the kink in the published lookup table; no California release states it, and twelve of that table\'s values are asserted against it in test/california.test.js',
    constant: true,
  },
  {
    state: 'CA',
    path: 'ownEarnedIncomeCredit.**',
    years: [2025],
    kind: 'indexed',
    document: '§ 17052 —',
    cite: 'Cal. Rev. & Tax. Code § 17052(b)(1) and (f) — the 2015 phase-in ceilings carried forward by the California CPI; the 2015 bases are exported as CALEITC_2015_STATUTORY_AMOUNTS and one factor reproduces all three',
    constant: true,
  },
  {
    state: 'CA',
    path: 'ownEarnedIncomeCredit.**',
    years: [2026],
    kind: 'carried-forward',
    document: '§ 17052 —',
    cite: 'the published 2025 CalEITC amounts, carried forward',
    constant: true,
    carriedForwardFrom: 2025,
    resolvedBy:
      "the Franchise Tax Board's annual 'California tax rates and exemptions' release for 2026, and the 2026 Form 3514 booklet",
  },
  {
    state: 'CA',
    path: 'youngChildCredit.ineligibleAge',
    kind: 'statute',
    document: '§ 17052.1',
    cite: 'Cal. Rev. & Tax. Code § 17052.1(a) — a qualifying child younger than six; an age, not an indexed amount',
    constant: true,
  },
  {
    state: 'CA',
    path: 'youngChildCredit.phaseOut.amountPerIncrement',
    kind: 'derived',
    document: '§ 17052.1',
    cite: 'amount / ((finalPhaseOutEnd - start) / increment), truncated to the cent — the rule the Franchise Tax Board applies from 2024, which also reproduces the legislated 2021 and 2022 figures',
    constant: true,
  },
  {
    state: 'CA',
    path: 'youngChildCredit.phaseOut.increment',
    kind: 'statute',
    document: '§ 17052.1',
    cite: 'Cal. Rev. & Tax. Code § 17052.1 — the credit is reduced per $100 of earned income above the threshold',
    constant: true,
  },
  {
    state: 'CA',
    path: 'youngChildCredit.**',
    years: [2025],
    kind: 'indexed',
    document: '§ 17052.1',
    cite: 'Cal. Rev. & Tax. Code § 17052.1 — the credit amount and phase-out start, indexed on the same California CPI factor as CalEITC',
    constant: true,
  },
  {
    state: 'CA',
    path: 'youngChildCredit.**',
    years: [2026],
    kind: 'carried-forward',
    document: '§ 17052.1',
    cite: 'the published 2025 Young Child Tax Credit, carried forward',
    constant: true,
    carriedForwardFrom: 2025,
    resolvedBy:
      "the Franchise Tax Board's annual 'California tax rates and exemptions' release for 2026, and the 2026 Form 3514 booklet",
  },
  {
    state: 'CA',
    path: 'surtax.brackets.*.rate',
    kind: 'statute',
    document: '§ 17043',
    cite: 'Cal. Rev. & Tax. Code § 17043 — the 1% Mental Health Services Tax, added by Proposition 63 (2004)',
    constant: true,
  },
  {
    state: 'CA',
    path: 'surtax.brackets.*.upTo',
    kind: 'statute',
    document: '§ 17043',
    cite: 'Cal. Rev. & Tax. Code § 17043 — $1,000,000 of taxable income, per return and never indexed; it is NOT doubled for a joint return, unlike every bracket threshold',
    constant: true,
  },

  // =========================================================================
  // COLORADO — the one state in this package where a 2026 figure cannot be
  // found by looking. Both parameters are fixed after the tax year closes, so
  // each needs a year-scoped pair of entries rather than one.
  // =========================================================================
  {
    state: 'CO',
    path: 'rate.rate',
    years: [2025],
    kind: 'statute',
    document: 'Proposition 121',
    cite: 'Colo. Rev. Stat. § 39-22-104(1.7) as reduced by Proposition 121 (2022) — 4.40%, the ceiling TABOR can reduce for a year and never raise',
    constant: true,
  },
  {
    state: 'CO',
    path: 'rate.rate',
    years: [2026],
    kind: 'determined-after-year-end',
    document: '§ 39-22-104 —',
    cite: 'the statutory 4.40%, standing in for a rate the TABOR surplus calculation fixes after the year closes; this is therefore the MOST tax Colorado can charge for 2026',
    constant: true,
    resolvedBy:
      "Colorado's TABOR surplus calculation for fiscal 2026-27, which the state completes after the tax year closes — the DR 0104 filing guide published in late 2026 is the first document that can carry it",
  },
  {
    state: 'CO',
    path: 'earnedIncomeCredit.matchRate',
    years: [2025],
    kind: 'statute-scheduled',
    document: 'Colorado Individual Income Tax Guide',
    cite: 'the match the General Assembly set for 2025, raised by act in each of 2023, 2024 and 2025 and interacting with the same TABOR surplus',
    constant: true,
  },
  {
    state: 'CO',
    path: 'earnedIncomeCredit.matchRate',
    years: [2026],
    kind: 'determined-after-year-end',
    document: 'Colorado Individual Income Tax Guide',
    cite: 'the statutory floor, standing in for a match the surplus calculation and any 2026 act will fix after the year closes; this is therefore the LEAST credit Colorado can pay for 2026',
    constant: true,
    resolvedBy:
      'the same surplus calculation, plus any act of the 2026 General Assembly raising the match as it did for 2023, 2024 and 2025',
  },

  // =========================================================================
  // GEORGIA — a flat tax on a legislated schedule. HB 1437 (2022) set the rate
  // and standard deduction falling year by year, and HB 463 (2026) accelerated
  // it, so Georgia's figures MOVE every year and none of them is indexed. The
  // distinction `statute-scheduled` exists for exactly this state.
  // =========================================================================
  {
    state: 'GA',
    path: 'rate.rate',
    kind: 'statute-scheduled',
    document: '§ 48-7-20(a.1)',
    cite: 'O.C.G.A. § 48-7-20(a.1) — 5.19% for 2025 and 4.99% for 2026, with annual cuts toward 3.99% directed by HB 463 (2026) subject to revenue conditions',
    constant: false,
  },
  {
    state: 'GA',
    path: 'deduction.amounts.*',
    kind: 'statute-scheduled',
    document: 'HB 1437 (2022)',
    cite: 'Georgia HB 1437 (2022) — the standard deduction replacing the personal exemption, $12,000/$24,000 for 2025 and $15,000/$30,000 for 2026; a qualifying surviving spouse takes the single amount because Form 500 has no such status',
    constant: false,
  },
  {
    state: 'GA',
    path: 'exemption.perFiler.*',
    kind: 'statute',
    document: 'HB 1437 (2022)',
    cite: 'Georgia HB 1437 (2022) repealed the personal exemption for the filer and spouse from tax year 2024, so this is zero in every status and only the dependent exemption survives',
    constant: true,
  },
  {
    state: 'GA',
    path: 'exemption.perDependent',
    kind: 'statute-scheduled',
    document: 'tax tables and rate schedule',
    cite: "the Department's tax tables carry $4,000 for 2025 and $5,000 for 2026. Georgia has no indexing provision for it — HB 1437 left it a legislated amount — so the increase is an act of the General Assembly; this package's sources do not name which act, and the figure itself is cross-checked rather than derived",
    constant: false,
  },
  {
    state: 'GA',
    path: 'itemizedDeduction.phaseOutRate',
    kind: 'sentinel',
    cite: 'zero, because the Georgia reduction of itemized deductions is not modelled — the threshold beside it is Infinity for the same reason, and the notes say so',
    constant: true,
  },
  {
    state: 'GA',
    path: 'itemizerCredit.perTaxpayer',
    kind: 'statute',
    document: '§ 48-7-27.1',
    cite: 'O.C.G.A. § 48-7-27.1 — $300 for each taxpayer who elected to itemise federally, for tax years from 2024; no income test, no carryforward',
    constant: true,
  },
  {
    state: 'GA',
    path: 'retirementIncomeExclusion.capAtOlderAge',
    kind: 'statute-scheduled',
    document: 'Georgia HB 463 (2026)',
    cite: 'O.C.G.A. § 48-7-27(a)(5) — $65,000 at 65 or over, which HB 463 § 2-3 raises to $70,000 from tax year 2027 by adding § 48-7-27(a)(5)(A)(xiv)',
    constant: true,
    why: 'Scheduled to move in 2027 and not before, so a year added beyond 2026 costs a reading of HB 463 rather than of any Department release.',
  },
  {
    state: 'GA',
    path: 'retirementIncomeExclusion.**',
    kind: 'statute',
    document: '§ 48-7-27(a)(5)',
    cite: 'O.C.G.A. § 48-7-27(a)(5) — the exclusion opens at 62, widens at 65, and allows at most $5,000 of EARNED income inside it ($4,000 through 2023, which most summaries still print)',
    constant: true,
  },
  {
    state: 'GA',
    path: 'militaryRetirementExclusion.**',
    kind: 'statute',
    document: '(a)(5.1)',
    cite: 'O.C.G.A. § 48-7-27(a)(5.1) — $17,500 below 62, plus a second $17,500 where earned income exceeds $17,500; the second half is a cliff on employment',
    constant: true,
  },
  {
    state: 'GA',
    path: 'childCredit.amountByAge.*.*',
    years: [2026],
    kind: 'statute',
    document: 'tax tables and rate schedule',
    cite: 'Georgia HB 136 (2025) — $250 for each child under 6, first available for tax year 2026, non-refundable, with no phase-out and no ceiling on the number of children',
    constant: true,
  },
  {
    state: 'GA',
    path: 'federalDeductionSubtractions.*.cap',
    years: [2026],
    kind: 'statute',
    document: 'Georgia HB 463 (2026)',
    cite: 'Georgia HB 463 (2026) — § 48-7-27(a)(16) and (a)(17), up to $1,750 each of qualified overtime compensation and cash tips per employee, for tax years 2026 through 2028',
    constant: true,
  },

  // =========================================================================
  // IDAHO — one indexed figure and the rest statute, which is why four fifths
  // of the carry-forward went unflagged until Day 37.
  // =========================================================================
  {
    state: 'ID',
    path: 'rate.byStatus.*.0.rate',
    kind: 'statute',
    document: '§ 63-3024',
    cite: 'Idaho Code § 63-3024 — the zero bracket is taxed at 0%, which is the definition of the bracket rather than a figure published for a year',
    constant: true,
  },
  {
    state: 'ID',
    path: 'rate.byStatus.*.1.rate',
    kind: 'statute-scheduled',
    document: 'Idaho HB 40 (2025)',
    cite: 'Idaho HB 40 (2025) — 5.3%, reduced from 5.695% retroactively to 1 January 2025, so a 2025 return computed on the pre-HB 40 rate is 7.5% too high',
    constant: true,
    why: 'Idaho sets the rate by act, not by indexing. It moved for 2025 and HB 40 made no further change, so 2026 equals 2025 because no later act touched it.',
  },
  {
    state: 'ID',
    path: 'rate.byStatus.*.0.upTo',
    years: [2025],
    kind: 'indexed',
    document: '§ 63-3024',
    cite: 'Idaho Code § 63-3024 fixes a base of $2,500 single / $5,000 joint and directs the Tax Commission to multiply it by an annual indexing factor; $4,811 is $2,500 x 1.9244 for 2025, and the doubled amount goes to joint, head-of-household AND surviving-spouse filers',
    constant: true,
  },
  {
    state: 'ID',
    path: 'rate.byStatus.*.0.upTo',
    years: [2026],
    kind: 'carried-forward',
    document: '§ 63-3024',
    cite: 'the published 2025 zero bracket, carried forward in all five filing statuses. Carrying it taxes a little income the indexed bracket would exempt: at most 5.3% of the movement, about $8 a filer',
    constant: true,
    carriedForwardFrom: 2025,
    resolvedBy:
      "the Idaho State Tax Commission's individual income tax rate schedule for 2026, published with the Form 40 instructions",
  },

  // =========================================================================
  // ILLINOIS — the state this whole file exists because of. Its exemption
  // allowance IS indexed, it was carried forward silently for nineteen days in
  // 2026, and the figures sitting beside it are NOT indexed and never were.
  // =========================================================================
  {
    state: 'IL',
    path: 'rate.rate',
    kind: 'statute',
    document: '5/201(b)',
    cite: '35 ILCS 5/201(b) — 4.95%, unchanged since the 2017 increase',
    constant: true,
  },
  {
    state: 'IL',
    path: 'exemption.perFiler.*',
    kind: 'indexed',
    document: '5/204',
    cite: '35 ILCS 5/204(b) — the basic amount, indexed annually; $2,850 for 2025 and $2,925 for 2026. A joint return counts two',
    constant: false,
  },
  {
    state: 'IL',
    path: 'exemption.perDependent',
    kind: 'indexed',
    document: '5/204',
    cite: '35 ILCS 5/204(b) — the same indexed basic amount for each exemption allowable under IRC § 151',
    constant: false,
  },
  {
    state: 'IL',
    path: 'exemption.perSeniorFiler',
    kind: 'statute',
    document: '5/204',
    cite: '35 ILCS 5/204(c) — a further $1,000 for each filer aged 65 or over. NOT indexed, unlike the basic amount it sits beside: it has been $1,000 since 2004',
    constant: true,
  },
  {
    state: 'IL',
    path: 'exemption.perBlindOrDisabledFiler',
    kind: 'statute',
    document: '5/204',
    cite: '35 ILCS 5/204(d) — a further $1,000 for each blind filer, also unindexed since 2004',
    constant: true,
  },
  {
    state: 'IL',
    path: 'exemption.seniorAge',
    kind: 'statute',
    document: '5/204',
    cite: '35 ILCS 5/204(c) — the additional exemption is for a filer who "has attained the age of 65"',
    constant: true,
  },
  {
    state: 'IL',
    path: 'exemption.cliff.*',
    kind: 'statute',
    document: '5/204',
    cite: '35 ILCS 5/204(g) — the whole exemption allowance is DISALLOWED above $500,000 of federal AGI on a joint return and $250,000 on every other return, including a qualifying surviving spouse\'s',
    constant: true,
  },
  {
    state: 'IL',
    path: 'earnedIncomeCredit.matchRate',
    kind: 'statute',
    document: 'Form IL-1040 instructions',
    cite: 'the IL-1040 instructions and Schedule IL-E/EIC — 20% of the federal credit, refundable, raised from 18% for tax year 2023 and unchanged since',
    constant: true,
  },
  {
    state: 'IL',
    path: 'earnedIncomeCreditChildBonus.**',
    kind: 'statute',
    document: '5/244',
    cite: '35 ILCS 5/244, added by Public Act 103-0592 — the Illinois child tax credit is 40% of the Illinois earned income credit for a filer with a child under 12, so it inherits the whole of § 32\'s phase-out and the child only switches it on',
    constant: true,
  },

  // =========================================================================
  // INDIANA — a legislated rate schedule and fixed dollar exemptions. Nothing
  // Indiana charges is indexed, including the figures that look it.
  // =========================================================================
  {
    state: 'IN',
    path: 'rate.rate',
    kind: 'statute-scheduled',
    document: '§ 6-3-2-1(a)',
    cite: 'Ind. Code § 6-3-2-1(a) — 3.05% in 2024, 3.00% in 2025, 2.95% in 2026 and 2.90% from 2027; the schedule is in the statute',
    constant: false,
  },
  {
    state: 'IN',
    path: 'exemption.**',
    kind: 'statute',
    document: '§ 6-3-1-3.5',
    cite: 'Ind. Code § 6-3-1-3.5(a) — the $1,000 per exemption, $1,500 more per dependent child, $1,000 each at 65 and for blindness, and the means-tested $500 with its $40,000 / $20,000 cliff. All fixed amounts; Indiana indexes none of them',
    constant: true,
  },
  {
    state: 'IN',
    path: 'agedCredit.**',
    kind: 'statute',
    document: '§ 6-3-3-9',
    cite: 'Ind. Code § 6-3-3-9 — the unified tax credit for the elderly, banded on FEDERAL AGI at $1,000 / $3,000 / $10,000, refundable, and claimable jointly only where spouses reside together',
    constant: true,
  },
  {
    state: 'IN',
    path: 'earnedIncomeCredit.matchRate',
    kind: 'statute',
    document: 'Indiana IT-40 instruction booklet',
    cite: 'the IT-40 instruction booklet — 10% of a federal credit recomputed under IC 6-3.1-21-6 as of a frozen Code date, with Indiana\'s own $3,800 investment-income limit substituted',
    constant: true,
  },
  {
    state: 'IN',
    path: 'outOfStateMunicipalInterestAddition.acquiredAfterYear',
    kind: 'statute',
    document: '§ 6-3-1-3.5',
    cite: 'Ind. Code § 6-3-1-3.5(a)(11) — only an out-of-state obligation "acquired by the taxpayer after December 31, 2011" is added back, and Information Bulletin #19 makes acquisition the trade date',
    constant: true,
  },

  // =========================================================================
  // KENTUCKY — one indexed figure (the standard deduction), one legislated rate
  // and one frozen exclusion that has twice gone DOWN.
  // =========================================================================
  {
    state: 'KY',
    path: 'rate.rate',
    kind: 'statute-scheduled',
    document: 'Kentucky HB 1 (2025)',
    cite: 'Kentucky HB 1 (2025) — 4.0% for 2025 and 3.5% for 2026; further cuts are conditional on the KRS 141.020(4) revenue triggers and are not scheduled',
    constant: false,
  },
  {
    state: 'KY',
    path: 'deduction.amounts.*',
    kind: 'indexed',
    document: 'Form 740 instructions',
    cite: 'indexed annually under KRS 141.081 and announced by Department of Revenue press release in the autumn of the preceding year — $3,270 for 2025 and $3,360 for 2026, the latter also carried by the 2026 withholding formula (42A003)',
    constant: false,
  },
  {
    state: 'KY',
    path: 'pensionIncomeExclusion.cap',
    kind: 'statute',
    document: 'KRS 141.019(1)',
    cite: 'KRS 141.019(1) — $31,110, NOT indexed: indexed from $35,700 in 1999 to $41,110 in 2005, frozen for thirteen years, cut 24% by the 2018 reform and frozen again',
    constant: true,
  },
  {
    state: 'KY',
    path: 'pensionIncomeExclusion.uncappedServiceBefore',
    kind: 'statute',
    document: 'KRS 141.019(1)',
    cite: 'KRS 141.019(1) — service performed before 1 January 1998 is exempt in full with no ceiling; the date has never moved, so the cohort empties by retirement',
    constant: true,
  },

  // =========================================================================
  // LOUISIANA — nine figures a year, and the ledger's vocabulary happens to
  // answer this state's hardest question for free. R.S. 47:294(A)(2) sets the
  // joint, head-of-household and surviving-spouse deduction at 200% OF THE
  // SINGLE AMOUNT rather than printing a figure, so those three are `derived`
  // and the single amount is the only standard deduction parameter Louisiana
  // has. That is also why its 2026 joint figure is $25,676 and not $25,675:
  // `derived` says the doubling happens AFTER the indexed single figure is
  // rounded, and nothing else in this file could have said which order.
  // =========================================================================
  {
    state: 'LA',
    path: 'rate.rate',
    kind: 'statute',
    document: 'R.S. 47:32(A) —',
    cite: 'La. R.S. 47:32(A) as amended by Act 11 of the 2024 Third Extraordinary Session — the flat 3% rate, which replaced a graduated 1.85% / 3.5% / 4.25% schedule for taxable periods beginning on or after 1 January 2025. One printed figure, no indexation provision and no revenue trigger between the two years here',
    constant: true,
  },
  {
    state: 'LA',
    path: 'deduction.amounts.single',
    years: [2025],
    kind: 'statute',
    document: 'R.S. 47:294 —',
    cite: 'La. R.S. 47:294(A)(1) as enacted by Act 11 — $12,500 for a single individual. PRINTED IN THE STATUTE for 2025: subsection (B) does not index the amount until 1 January 2026, so the first year of the new deduction is the only year it is a statutory figure rather than a published one',
    constant: true,
  },
  {
    state: 'LA',
    path: 'deduction.amounts.marriedFilingSeparately',
    years: [2025],
    kind: 'statute',
    document: 'R.S. 47:294 —',
    cite: 'La. R.S. 47:294(A)(1) — the same $12,500. The statute and the IT-540 instructions print ONE row for "Single Individual/Married Filing Separately", so this is that row read again and not a half of the joint amount, which is why it is `statute` here and `derived` for the three doubled statuses',
    constant: true,
  },
  {
    state: 'LA',
    path: 'deduction.amounts.single',
    years: [2026],
    kind: 'indexed',
    document: 'Revenue Information Bulletin 26-019',
    cite: "LDR Revenue Information Bulletin 26-019 (28 September 2026) — $12,838, which is R.S. 47:294(B)'s CPI-U adjustment applied to the 2025 amount: 12,500 x 1.027 = 12,837.50, rounded to the nearest dollar, where 2.7% is the all-items CPI-U increase BLS published for the twelve months ending December 2025. INDEXED AND READ, not carried forward. The bulletin could not be opened from this sandbox (dam.ldr.la.gov does not resolve); the figure is from two independent third-party quotations of it and is checked against the 2025 base and the BLS release, both of which this state-year cites",
    constant: true,
  },
  {
    state: 'LA',
    path: 'deduction.amounts.marriedFilingSeparately',
    years: [2026],
    kind: 'indexed',
    document: 'Revenue Information Bulletin 26-019',
    cite: 'LDR Revenue Information Bulletin 26-019 — the same $12,838, on the same single/separate row the statute prints as one',
    constant: true,
  },
  {
    state: 'LA',
    path: 'deduction.amounts.marriedFilingJointly',
    kind: 'derived',
    cite: "La. R.S. 47:294(A)(2) — 200% of the amount provided for a single individual. NOT A FIGURE IN ANY DOCUMENT: the statute states a percentage, so a new tax year costs this figure nothing beyond the single amount it is twice of. It is also the entry that settles the rounding order, because 2 x 12,838 = 25,676 while indexing the 2025 joint amount directly gives 25,675 — a dollar of deduction and three cents of tax that only the order of operations decides, and the order is this relation",
    constant: false,
  },
  {
    state: 'LA',
    path: 'deduction.amounts.headOfHousehold',
    kind: 'derived',
    cite: "La. R.S. 47:294(A)(2) — 200% of the single amount, the same relation as the joint figure. LOUISIANA'S HEAD OF HOUSEHOLD IS NOT GIVEN ONE AND A HALF TIMES THE SINGLE DEDUCTION, which is what most states in this package do and what a scaling model would assume: the statute names head of household in the same clause as a joint return, so the figure is $25,000 and not $18,750",
    constant: false,
  },
  {
    state: 'LA',
    path: 'deduction.amounts.qualifyingSurvivingSpouse',
    kind: 'derived',
    cite: 'La. R.S. 47:294(A)(2) — 200% of the single amount; the statute names a qualified surviving spouse in the same clause as a joint return and a head of household, so Louisiana needs no `survivingSpouseFilesAs` translation and the `byStatus` default happens to be right for the statutory reason rather than by the helper falling back',
    constant: false,
  },
  {
    state: 'LA',
    path: 'retirementIncomeSubtractions.0.cappedMinimumAge',
    kind: 'statute',
    document: 'R.S. 47:44.1(A) —',
    cite: 'La. R.S. 47:44.1(A) — the exemption is for annual retirement income received by an individual SIXTY-FIVE YEARS OF AGE OR OLDER. The age has not moved since the provision was written and Act 11 did not touch it; what Act 11 doubled was the amount. It is `cappedMinimumAge` rather than `minimumAge` because R.S. 47:44.2 exempts government retirement benefits with no age test at all',
    constant: true,
  },
  {
    state: 'LA',
    path: 'retirementIncomeSubtractions.0.cap',
    years: [2025],
    kind: 'statute',
    document: 'R.S. 47:44.1(A) —',
    cite: 'La. R.S. 47:44.1(A) as amended by Act 11 of the 2024 Third Extraordinary Session — $12,000, doubled from $6,000 for taxable periods beginning on or after 1 January 2025. Printed in the statute for 2025 for the same reason as the standard deduction: the indexation in the same subsection begins 1 January 2026',
    constant: true,
  },
  {
    state: 'LA',
    path: 'retirementIncomeSubtractions.0.cap',
    years: [2026],
    kind: 'indexed',
    document: 'Revenue Information Bulletin 26-019',
    cite: 'LDR Revenue Information Bulletin 26-019 (28 September 2026) — $12,324, which is 12,000 x 1.027 EXACTLY, with no rounding to do. That exactness is worth recording: of the three 2026 Louisiana figures taken from a bulletin this sandbox cannot open, this is the one whose arithmetic leaves no room for a rounding convention, so it is the strongest of the three corroborations and the joint deduction is the one that discriminates between two conventions',
    constant: true,
  },
  {
    state: 'LA',
    path: 'earnedIncomeCredit.matchRate',
    kind: 'statute',
    document: 'R.S. 47:297.8 —',
    cite: 'La. R.S. 47:297.8(A) — 5% of the federal earned income credit, from tax year 2019; it was 3.5% from 2018. Subsection (B) makes it refundable, which is the half that matters to a low-income Louisiana return, and the rate is a printed figure no indexation moves',
    constant: true,
  },
  // =========================================================================
  // MASSACHUSETTS — one indexed figure in the whole return, and the
  // Department of Revenue certified it for 2026. Everything else is a fixed
  // dollar amount in Chapter 62, which is why this state is `published` for a
  // year it has barely begun.
  // =========================================================================
  {
    state: 'MA',
    path: 'rate.rate',
    kind: 'statute',
    document: '§ 4',
    cite: 'M.G.L. c. 62 § 4(b) — the step-down mechanism ran out in tax year 2020 at 5.00% and the rate has not moved since. The statute still READS 5.95%, so a model built from the text alone is 19% too high',
    constant: true,
  },
  {
    state: 'MA',
    path: 'separatelyRatedIncome.*.rate',
    kind: 'statute',
    document: '§ 4',
    cite: 'M.G.L. c. 62 § 4(a) — 8.5% on short-term capital gains and 12% on long-term gains from collectibles; Chapter 50 of the Acts of 2023 set the short-term rate',
    constant: true,
  },
  {
    state: 'MA',
    path: 'separatelyRatedIncome.*.deductionShare',
    kind: 'statute',
    document: '§ 2',
    cite: 'M.G.L. c. 62 § 2 — the 50% deduction against a collectibles gain, which is why the 12% is stored apart from the share rather than as a single effective 6%',
    constant: true,
  },
  {
    state: 'MA',
    path: 'surtax.brackets.*.rate',
    kind: 'statute',
    document: '§ 4',
    cite: 'M.G.L. c. 62 § 4(d) — the 4% surtax added by art. CXI of the Amendments to the Constitution',
    constant: true,
  },
  {
    state: 'MA',
    path: 'surtax.brackets.*.upTo',
    kind: 'indexed',
    document: 'Massachusetts DOR — 4% surtax',
    cite: 'the threshold the Department of Revenue certifies annually; it is per RETURN and is not doubled for a joint return, and since 2024 a couple filing jointly federally must file jointly here',
    constant: false,
  },
  {
    state: 'MA',
    path: 'exemption.**',
    kind: 'statute',
    document: '§ 3',
    cite: 'M.G.L. c. 62 § 3(B)(a) — the personal exemption by filing status, $1,000 per dependent, $700 at 65 and $2,200 for blindness. Fixed dollar amounts; Massachusetts indexes none of them',
    constant: true,
  },
  {
    state: 'MA',
    path: 'payrollTaxDeduction.perFilerCap',
    kind: 'statute',
    document: '§ 3',
    cite: 'M.G.L. c. 62 § 3(B)(a)(9) — up to $2,000 PER FILER of Social Security, Medicare and public retirement contributions, which has no federal analogue and binds at $26,144 of wages',
    constant: true,
  },
  {
    state: 'MA',
    path: 'rentDeduction.**',
    kind: 'statute',
    document: '§ 3',
    cite: 'M.G.L. c. 62 § 3(B)(a)(9A) — half the rent up to $4,000 per return ($2,000 filing separately), so the cap binds at $8,000 of annual rent',
    constant: true,
  },
  {
    state: 'MA',
    path: 'zeroTaxThreshold.**',
    kind: 'statute',
    document: '§ 5',
    cite: 'M.G.L. c. 62 § 5 — No Tax Status and the Limited Income Credit. The joint and head-of-household figures are $7,600 plus that status\'s own personal exemption, which is why only the single filer\'s $8,000 is stored as a figure of its own',
    constant: true,
  },
  {
    state: 'MA',
    path: 'childCredit.amountByAge.**',
    kind: 'statute',
    document: '§ 6(h)',
    cite: 'M.G.L. c. 62 § 6(x) — the Child and Family Tax Credit, $440 per dependent under 13 or aged 65 and over, uncapped in number and with no phase-out since Chapter 50 of the Acts of 2023',
    constant: true,
  },
  {
    state: 'MA',
    path: 'earnedIncomeCredit.matchRate',
    kind: 'statute',
    document: '§ 6(h)',
    cite: 'M.G.L. c. 62 § 6(h) — 40% of the federal credit, refundable, raised from 30% by Chapter 50 of the Acts of 2023',
    constant: true,
  },
  // =========================================================================
  // MARYLAND — 204 figures, 199 of them identical across the two years, and
  // `status: 'published'` with no provisional figure at all. That combination
  // is exactly what a silent carry-forward looks like, and here it is not one:
  // the brackets and exemptions are fixed in Tax-General, and the one indexed
  // figure was READ for 2026 and found not to have moved. The entry for it is
  // the most valuable in this file, because it is the one a reader cannot
  // distinguish from a defect without it.
  // =========================================================================
  {
    state: 'MD',
    path: 'rate.byStatus.*.*.rate',
    kind: 'statute',
    document: '§ 10-105',
    cite: 'Md. Code, Tax-Gen. § 10-105(a) — the rates, including the 6.25% and 6.5% brackets Chapter 604 of the 2025 Laws of Maryland added',
    constant: true,
  },
  {
    state: 'MD',
    path: 'rate.byStatus.*.*.upTo',
    kind: 'statute',
    document: '§ 10-105',
    cite: 'Md. Code, Tax-Gen. § 10-105(a) — the bracket ceilings as dollar amounts in the statute; Maryland does not index them, and married filing separately reads the SINGLE column rather than half the joint one',
    constant: true,
  },
  {
    state: 'MD',
    path: 'deduction.amounts.*',
    kind: 'indexed',
    document: '§ 10-217',
    cite: 'Md. Code, Tax-Gen. § 10-217 — the standard deduction, flat from tax year 2025 and indexed from 2026; $3,350 / $6,700',
    constant: true,
    why:
      'Indexed and NOT carried forward: the 2026 figure was read and is the same as 2025\'s. ' +
      'Three Maryland documents say so — the 2026 Employer Withholding Guide, the 2026 Form ' +
      'MW507, and the Department of Legislative Services fiscal note on HB 411 of 2026, a bill ' +
      'to raise it to $4,100 that died in committee and states current law for 2026 as $3,350 ' +
      'while costing the increase. Two of the three are the state telling its own employers what ' +
      'to withhold. This package carried the figure provisional from Day 8 to Day 28 because ' +
      'secondary sources split between $3,350 and $3,400.',
  },
  {
    state: 'MD',
    path: 'exemption.perExemptionSteps.*.*.*',
    kind: 'statute',
    document: '§ 10-211',
    cite: 'Md. Code, Tax-Gen. § 10-211(c) — the exemption amount chart by federal AGI: $3,200, then $1,600, then $800, then nothing. A separate filer reads the single column, because § 10-211(c)(2) is the joint, head-of-household and surviving-spouse case',
    constant: true,
  },
  {
    state: 'MD',
    path: 'exemption.perFiler.*',
    kind: 'derived',
    cite: 'the top step of `perExemptionSteps` for that status, stored so `registry.test.js` can check it against the chart that generates it. The engine reads the chart; this copy exists to be cross-checked',
    constant: true,
  },
  {
    state: 'MD',
    path: 'exemption.filersClaimed.*',
    kind: 'statute',
    document: '§ 10-211',
    cite: 'Md. Code, Tax-Gen. § 10-211(a) — a count of people, not an amount. A joint return claims two and a qualifying surviving spouse one, because the spouse is dead and Form 502\'s box B has one column',
    constant: true,
  },
  {
    state: 'MD',
    path: 'exemption.**',
    kind: 'statute',
    document: '§ 10-211',
    cite: 'Md. Code, Tax-Gen. § 10-211 — $3,200 per dependent, a further $1,000 each at 65 and for blindness (neither reduced by income), and $3,200 for a dependent aged 65 or over',
    constant: true,
  },
  {
    state: 'MD',
    path: 'itemizedDeduction.**',
    kind: 'statute',
    document: 'Chapter 604 of the 2025 Laws of Maryland',
    cite: 'Chapter 604 of the 2025 Laws of Maryland (HB 352) — Maryland itemized deductions reduced by 7.5% of federal AGI over $200,000 ($100,000 married filing separately, and NOT doubled for a joint return). This is § 68, the federal "Pease" limitation, revived by a state seven years after Congress suspended the federal one',
    constant: true,
  },
  {
    state: 'MD',
    path: 'capitalGainsSurtax.*',
    kind: 'statute',
    document: 'Chapter 604 of the 2025 Laws of Maryland',
    cite: 'Chapter 604 of the 2025 Laws of Maryland (HB 352) — 2% of net capital gain where FEDERAL AGI exceeds $350,000. The threshold is a TEST and not a floor, which makes it the sharpest single-dollar cliff in this package',
    constant: true,
  },
  {
    state: 'MD',
    path: 'seniorCredit.**',
    kind: 'statute',
    document: '§ 10-754',
    cite: 'Md. Code, Tax-Gen. § 10-754 — $1,000 at 65, $1,750 where both spouses on a joint return qualify and $1,750 for a head of household or surviving spouse, with a cliff at $100,000 / $150,000 of federal AGI',
    constant: true,
  },
  {
    state: 'MD',
    path: 'pensionExclusion.maximum',
    kind: 'indexed',
    document: '§ 10-209',
    cite: 'the Comptroller\'s published maximum — $41,200 for 2025 and $40,600 for 2026. § 10-209(a) ties it to the maximum annual benefit under the Social Security Act, but the published figures have never matched the SSA\'s own maxima, so it cannot be derived and must be transcribed each year. It is the only parameter in this package that has ever DECREASED, so a model that indexes it upward is wrong for 2026 in the expensive direction',
    constant: false,
  },
  {
    state: 'MD',
    path: 'pensionExclusion.minimumAge',
    kind: 'statute',
    document: '§ 10-209',
    cite: 'Md. Code, Tax-Gen. § 10-209(b) — 65, or disabled at any age; the exclusion is reduced dollar for dollar by the TOTAL Social Security and railroad retirement received, taxable or not',
    constant: true,
  },
  {
    state: 'MD',
    path: 'militaryRetirementSubtraction.**',
    kind: 'statute',
    document: '§ 10-207(q)',
    cite: 'Md. Code, Tax-Gen. § 10-207(q) — $12,500 under 55 and $20,000 at 55 or over, per person, with no age-65 gate and no benefit offset; a survivor\'s cap is set by the SURVIVOR\'S age',
    constant: true,
  },
  {
    state: 'MD',
    path: 'agedIncomeSubtraction.**',
    kind: 'statute',
    document: '(nn)',
    cite: 'Md. Code, Tax-Gen. § 10-207(nn) — the centenarian subtraction, $100,000 of income at age 100, per person, with no income or source test',
    constant: true,
  },
  {
    state: 'MD',
    path: 'povertyLevelCredit.earnedIncomeShare',
    kind: 'statute',
    document: 'Maryland 2025 Resident Tax Forms and Instructions',
    cite: 'Md. Code, Tax-Gen. § 10-709 and Form 502 line 23 — the state half of the poverty level credit is 5% of earned income; the county half is the COUNTY\'S OWN RATE times the same earned income',
    constant: true,
  },
  {
    state: 'MD',
    path: 'povertyLevelCredit.povertyGuideline.*',
    kind: 'agency',
    document: 'HHS poverty guidelines',
    cite: 'the HHS poverty guidelines for the contiguous states, republished every January — so a stored copy is wrong about the start of the year it applies to, and `federalPovertyGuideline` overrides it',
    constant: false,
  },
  {
    state: 'MD',
    path: 'earnedIncomeCredit.*',
    kind: 'statute',
    document: '§ 10-704',
    cite: 'Md. Code, Tax-Gen. § 10-704 — ONE credit, not two: 50% of the federal credit capped at the Maryland tax, plus a refundable half paying 45% less that tax, and 100% for an unmarried filer with no qualifying child',
    constant: true,
  },
  {
    state: 'MD',
    path: 'childCredit.**',
    kind: 'statute',
    document: 'Maryland 2025 Resident Tax Forms and Instructions',
    cite: 'Md. Code, Tax-Gen. § 10-751 and the Form 502 credit worksheets — $500 per dependent under 6, refundable, withdrawn at $50 per $1,000 of federal AGI over $15,000 ON THE RETURN rather than per child',
    constant: true,
  },

  // =========================================================================
  // MICHIGAN — the state that proves `provisionalFigures` has to be per figure.
  // The personal exemption is published for 2026 because withholding needs it;
  // the special exemption appears on the MI-1040 and nowhere else, so it waits
  // for instructions published in January 2027. Same statute, same indexing
  // provision, two different answers.
  // =========================================================================
  {
    state: 'MI',
    path: 'rate.rate',
    kind: 'statute',
    document: '§ 206.51',
    cite: 'Mich. Comp. Laws § 206.51 — 4.25%. It fell to 4.05% for tax year 2023 under the § 206.51(1)(c) revenue trigger and returned: the trigger is a one-year reduction, so a 2023 figure carried forward is 4.7% too low',
    constant: true,
  },
  {
    state: 'MI',
    path: 'exemption.perFiler.*',
    kind: 'indexed',
    document: '§ 206.30(2)',
    cite: 'Mich. Comp. Laws § 206.30(2) — the personal exemption, indexed: $5,600 for 2024, $5,800 for 2025 and $5,900 for 2026, the last published in the 2026 withholding guide (Form 446, Rev. 02-26)',
    constant: false,
  },
  {
    state: 'MI',
    path: 'exemption.perDependent',
    kind: 'indexed',
    document: '§ 206.30(2)',
    cite: 'the same indexed personal exemption, allowed for each dependent',
    constant: false,
  },
  {
    state: 'MI',
    path: 'exemption.perBlindOrDisabledFiler',
    years: [2025],
    kind: 'indexed',
    document: '§ 206.30(2)',
    cite: 'Mich. Comp. Laws § 206.30(3)(a) — the "special exemption" at MI-1040 line 9, $3,400 for 2025, indexed on the same provision as the personal exemption. The largest allowance for blindness in this package by a factor of three',
    constant: true,
  },
  {
    state: 'MI',
    path: 'exemption.perBlindOrDisabledFiler',
    years: [2026],
    kind: 'carried-forward',
    document: '§ 206.30(2)',
    cite: 'the 2025 special exemption, carried forward. The personal exemption beside it is NOT carried forward, which is the whole reason provisional figures are per figure: the withholding guide carries the personal exemption because withholding needs it, and the special exemption is on the MI-1040 and nowhere else',
    constant: true,
    carriedForwardFrom: 2025,
    resolvedBy:
      'the 2026 MI-1040 instructions (line 9), published in January 2027 — the 2026 withholding guide does not carry this figure because it is not a withholding allowance',
  },
  {
    state: 'MI',
    path: 'earnedIncomeCredit.matchRate',
    kind: 'statute',
    document: '§ 206.272',
    cite: 'Mich. Comp. Laws § 206.272 — 30% of the federal credit, refundable, raised fivefold from 6% retroactively by Public Act 4 of 2023. A return computed on the old 6% understates a two-child family by about $1,700',
    constant: true,
  },
  {
    state: 'MI',
    path: 'retirementIncomeSubtractions.*.cap.*',
    kind: 'indexed',
    document: '§ 206.30',
    cite: 'Mich. Comp. Laws § 206.30(1)(f) — the retirement and pension deduction cap, indexed to the figure the state publishes for withholding: $65,897 / $131,794 for 2025 and $67,610 / $135,220 for 2026. ONE figure for the return, keyed to the older spouse',
    constant: false,
  },
  {
    state: 'MI',
    path: 'retirementIncomeSubtractions.*.capMultiplier',
    kind: 'statute-scheduled',
    document: '§ 206.30',
    cite: 'Public Act 4 of 2023 restores the deduction Michigan repealed in 2011 a quarter at a time: 25% for 2023, 50% for 2024, 75% for 2025 and the whole of it from 2026',
    constant: false,
  },
  {
    state: 'MI',
    path: 'retirementIncomeSubtractions.*.minimumAge',
    kind: 'statute-scheduled',
    document: '§ 206.30',
    cite: 'Mich. Comp. Laws § 206.30(1)(f) and (9) test BIRTH YEAR, not age: born before 1946 for the tier-one deduction, which is 80 or over at the end of 2025 and 81 or over in 2026, and born in 1946 or later for the phased-in one',
    constant: false,
  },
  {
    state: 'MI',
    path: 'retirementIncomeSubtractions.*.maximumAge',
    years: [2025],
    kind: 'statute-scheduled',
    document: '§ 206.30',
    cite: 'Mich. Comp. Laws § 206.30(9) — for 2025 the phased-in deduction stops at birth year 1967, which is age 80 at the end of the year. From 2026 the upper bound is gone and the deduction is universal, so this figure does not exist in that year at all',
    constant: true,
  },

  // =========================================================================
  // MISSISSIPPI — the Build Up Mississippi Act schedule, and fixed exemptions.
  // =========================================================================
  {
    state: 'MS',
    path: 'rate.byStatus.*.0.rate',
    kind: 'statute',
    document: '§ 27-7-5',
    cite: 'Miss. Code Ann. § 27-7-5 — the first band is taxed at 0%, which defines the bracket rather than being a published figure',
    constant: true,
  },
  {
    state: 'MS',
    path: 'rate.byStatus.*.0.upTo',
    kind: 'statute',
    document: '§ 27-7-5',
    cite: 'Miss. Code Ann. § 27-7-5 — the zero bracket on the first $10,000, per RETURN and not doubled for a joint return, which is the opposite of the exemption beside it',
    constant: true,
  },
  {
    state: 'MS',
    path: 'rate.byStatus.*.1.rate',
    kind: 'statute-scheduled',
    document: 'Mississippi HB 1 (2025)',
    cite: 'Mississippi HB 1 (2025), the Build Up Mississippi Act — 4.7% in 2024, 4.4% in 2025 and 4.0% in 2026, with further reductions toward zero conditional on revenue triggers',
    constant: false,
  },
  {
    state: 'MS',
    path: 'deduction.amounts.*',
    // `agency` AND NOT `indexed`, AND THE CORRECTION IS OLDER THAN THE STATE
    // THAT EXPOSED IT. This entry said `indexed` beside a cite reading "fixed
    // dollar amounts with no indexing provision" — the kind contradicting its
    // own prose — and `test/provenance.test.js`'s indexed-figure check would
    // have caught it on any run. It did not, because that check asserts inside
    // its loop and throws on the FIRST failure, and a state sorting before MS
    // was failing first. Adding Arkansas, which sorts before Mississippi and
    // passes, is what made it reachable.
    //
    //   AN ASSERTION THAT THROWS ON THE FIRST FAILURE HIDES EVERY LATER ONE.
    //
    // The check now collects every failure instead, which is the same fix Day
    // 61 made to the README test and Day 63 found a second instance of.
    kind: 'agency',
    document: 'Mississippi Department of Revenue — tax rates',
    cite: 'Miss. Code Ann. § 27-7-17 as the Department\'s tax rates, exemptions and deductions page carries it — $2,300 / $4,600 / $3,400, fixed dollar amounts with NO INDEXING PROVISION, which is why this is an agency reading of a statutory figure and not an indexed one. Identical in both years because the statute sets them, not because the second year went unread',
    constant: true,
  },
  {
    state: 'MS',
    path: 'exemption.**',
    kind: 'statute',
    document: 'Mississippi Department of Revenue — tax rates',
    cite: 'Miss. Code Ann. § 27-7-21 — $6,000 / $12,000 / $8,000 per filer, $1,500 per dependent, and a further $1,500 each at 65 (§ 27-7-21(f)) and for blindness (§ 27-7-21(g)), which Form 80-105 counts on the SAME line as the dependents',
    constant: true,
  },
  {
    state: 'MS',
    path: 'retirementIncomeSubtractions.*.minimumAge',
    kind: 'statute',
    document: 'Mississippi Department of Revenue — tax rates',
    cite: 'Miss. Code Ann. § 27-7-15(4)(k) exempts qualified retirement income and (l) leaves a premature distribution — one the federal § 72(t) penalty would reach — fully taxable, so the gate is 59½',
    constant: true,
  },

  // =========================================================================
  // NORTH CAROLINA — a legislated rate schedule and a statutory standard
  // deduction, so the 2026 amounts were already law when this package was
  // built. There is no general retirement subtraction and that is a finding.
  // =========================================================================
  {
    state: 'NC',
    path: 'rate.rate',
    kind: 'statute-scheduled',
    document: '§ 105-153.7',
    cite: 'N.C. Gen. Stat. § 105-153.7 — 4.50% in 2024, 4.25% in 2025 and 3.99% in 2026, with lower rates from 2027 if the § 105-153.7(a2) revenue triggers are met',
    constant: false,
  },
  {
    state: 'NC',
    path: 'deduction.amounts.*',
    kind: 'statute',
    document: '§ 105-153.5',
    cite: 'N.C. Gen. Stat. § 105-153.5(a)(1) — $12,750 / $25,500 / $19,125, a fixed statutory figure rather than an indexed one, which is why nothing in North Carolina waits on a release',
    constant: true,
  },
  {
    state: 'NC',
    path: 'retirementIncomeSubtractions.*.cap',
    kind: 'sentinel',
    cite: 'zero, which together with `militaryReducesCap` exempts military retired pay in full and leaves nothing else in the pool. It encodes "North Carolina taxes every other pension in full" rather than being a figure read from a document',
    constant: true,
  },

  // =========================================================================
  // NORTH DAKOTA — twenty-nine figures a year and only two kinds between them,
  // which makes this the cleanest statement in the ledger of the distinction
  // the whole file exists to draw. Three RATES, legislated once in 2023 and
  // untouched since. Twenty-four THRESHOLDS, indexed every year and read off a
  // published schedule, never carried forward: all eight moved between 2025 and
  // 2026, which is why the `indexed` entries below can claim `constant: false`
  // and need no `why`.
  //
  // AND THE LEDGER CANNOT SAY WHAT THIS STATE'S INDEXATION *IS*, which is the
  // entry worth reading. § 57-38-30.3(1)(e) indexes the thresholds by the
  // federal cost-of-living adjustment, and no single multiplier under any
  // rounding carries the published 2025 schedule to the published 2026 one —
  // see `states/north-dakota.ts` and `test/north-dakota.test.js`, which runs
  // the search. So `indexed` here means "the state indexed it and published the
  // result", and emphatically not "this package could reproduce it". Nothing is
  // `derived`: the married-filing-separately column IS half the joint one in
  // all four published years and that relation is asserted in the test rather
  // than applied in the module, because no document available here states it.
  // =========================================================================
  {
    state: 'ND',
    path: 'rate.byStatus.*.0.rate',
    kind: 'statute',
    document: '§ 57-38-30.3(1)',
    cite: 'N.D.C.C. § 57-38-30.3(1) as amended by HB 1158 (2023) — the first bracket is taxed at 0%, which is the definition of the bracket rather than a figure published for a year',
    constant: true,
  },
  {
    state: 'ND',
    path: 'rate.byStatus.*.1.rate',
    kind: 'statute',
    document: '§ 57-38-30.3(1)',
    cite: 'N.D.C.C. § 57-38-30.3(1) as amended by HB 1158 (2023) — 1.95%, the middle of three rates that replaced a five-bracket schedule topping out at 2.9%. A printed figure with no indexation provision and no revenue trigger between the two years here',
    constant: true,
  },
  {
    state: 'ND',
    path: 'rate.byStatus.*.2.rate',
    kind: 'statute',
    document: '§ 57-38-30.3(1)',
    cite: 'N.D.C.C. § 57-38-30.3(1) as amended by HB 1158 (2023) — 2.50%, the top rate, which ties Arizona for the lowest in the country among states that tax wage income',
    constant: true,
  },
  {
    state: 'ND',
    path: 'rate.byStatus.*.*.upTo',
    years: [2025],
    kind: 'indexed',
    document: '2025 North Dakota Individual Income Tax booklet',
    cite: 'the 2025 rate schedules on page 29 of the instruction booklet — $48,475 and $244,825 single, $80,975 and $298,075 joint and surviving spouse, $40,475 and $149,025 separate, $64,950 and $271,450 head of household, indexed under § 57-38-30.3(1)(e) from the 2023 figures HB 1158 printed. NOT OPENED FROM THIS SANDBOX: tax.nd.gov does not resolve here, and the figures are the Tax Commissioner\'s own rate-schedule page as server-side search read it, agreed by policyengine-us 2.63.3 and two commercial tables',
    constant: true,
  },
  {
    state: 'ND',
    path: 'rate.byStatus.*.*.upTo',
    years: [2026],
    kind: 'indexed',
    document: '2026 Form ND-1ES',
    cite: 'the 2026 estimated-tax rate schedules on page 2 of Form ND-1ES — $49,575 and $250,400 single, $82,800 and $304,850 joint and surviving spouse, $41,400 and $152,425 separate, $66,400 and $277,600 head of household. INDEXED AND READ, not carried forward: every one of the eight moved. NOT OPENED FROM THIS SANDBOX; the figures are policyengine-us 2.63.3\'s, which cites this form, corroborated figure for figure by two independent third parties against two more that simply carry 2025 forward. All eight moved from 2025, which `test/north-dakota.test.js` asserts figure by figure rather than this entry claiming it: a one-year entry cannot carry a `constant: false`',
    constant: true,
  },
  {
    state: 'ND',
    path: 'capitalGainsSubtraction.share',
    kind: 'statute',
    document: '§ 57-38-30.3(2)(d)',
    cite: 'N.D.C.C. § 57-38-30.3(2)(d)(1) — forty percent of the excess of net long-term capital gain over net short-term capital loss. Raised from thirty percent in 2013 and unmoved since',
    constant: true,
  },
  {
    state: 'ND',
    path: 'qualifiedDividendSubtraction.share',
    kind: 'statute',
    document: '§ 57-38-30.3(2)(d)',
    cite: 'N.D.C.C. § 57-38-30.3(2)(d)(2) — forty percent of qualified dividend income. The SAME percentage as the capital gain exclusion above, spent on a different base: Form 1040 line 3a, which is ordinary income and is not on Schedule D at all',
    constant: true,
  },
  {
    state: 'ND',
    path: 'retirementIncomeSubtractions.*.cap',
    kind: 'sentinel',
    cite: 'zero, which together with `militaryReducesCap` exempts military retired pay in full and leaves nothing else in the pool. North Carolina\'s construction exactly, and the same encoding of "every other pension is taxed in full" rather than a figure read from a document',
    constant: true,
  },

  // =========================================================================
  // =========================================================================
  // ARKANSAS — the state whose rate schedule is 36 rows long, 30 of which are
  // one relief being withdrawn $10 at a time, and whose largest figures are the
  // ones the mutation audit cannot see.
  //
  // Every `reduction` in this state carries CENTS, which is Day 62's
  // `largeDecimal` blind-spot class: `mutantOf` perturbs a decimal in (0,1), a
  // year-like integer and an integer at or above 100, and $111.98 is none of
  // those. So 33 of the 36 reductions in each year's schedule have no mutant at
  // all, and neither does the $29 personal credit (an integer below 100, Day
  // 60's class) nor the 19 low-income table amounts under $100 (the other 205 and all 224 boundaries ARE
  // reachable, which Day 64 claimed otherwise before measuring; see the seven low-income
  // tables. The rate schedule that produces a 13.70% marginal rate is almost
  // entirely invisible to the audit, which is why `test/arkansas.test.js`
  // measures the slope, the step count and the $287.30 by hand.
  //
  // THE ROW THAT IS DERIVED RATHER THAN READ IS THE 2026 SCHEDULE, and it is
  // the only derivation in this state. No Indexed Tax Brackets card exists for
  // 2026, so the reductions are computed from Act 1 of 2026's two statutory
  // tables; the 2025 ones are transcribed from DFA's card and differ from the
  // same computation by the row's rate on one dollar.
  // =========================================================================
  {
    state: 'AR',
    path: 'rate.rows.**',
    kind: 'agency',
    document: '2025 Indexed Tax Brackets',
    years: [2025],
    cite: 'Arkansas DFA\'s published Indexed Tax Brackets card for 2025, transcribed row for row: the row\'s rate on ALL net taxable income minus the row\'s "minus adjustment", five regular rows and thirty-one taper rows from $94,701, plus "$3,809 plus 3.9% of the excess over $100,000" at the top. AN AGENCY FIGURE RATHER THAN A STATUTORY ONE, AND THE DISTINCTION BITES HERE: the card\'s four regular reductions — $111.98, $223.97, $287.97, $419.96 — are NOT the accumulated tax of the bands beneath them ($112.00, $224.00, $288.00, $420.00). Each is short by exactly the row\'s rate on one dollar, because the card is anchored one dollar below each bracket floor, so the card and A.C.A. § 26-51-201(a)(4) do not compute the same tax. The instructions settle which governs — a formula\'s results "must match the table" — so the two to four cents are real, and policyengine-us agrees: it carried the round figures as late as 2.15.3 and replaced them with the card\'s by 2.68.0. THE THIRTY-ONE TAPER ROWS ARE THE BRACKET ADJUSTMENT, ten percentage points of marginal rate (13.90% in 2025) and thirty-one discontinuities of $10 on one cent of income. NOT OPENED FROM THIS SANDBOX: dfa.arkansas.gov does not resolve here',
    constant: true,
  },
  {
    state: 'AR',
    path: 'rate.rows.**',
    kind: 'derived',
    document: 'Arkansas Act 1 of 2026',
    years: [2026],
    cite: 'DERIVED, and the only derivation in this state. No Indexed Tax Brackets card has been published for 2026, so each row\'s reduction is computed from A.C.A. § 26-51-201(a)(4)\'s graduated table (0%, 2%, 3%, 3.4%, 3.7% at $5,600, $11,200, $16,000, $26,400) and (a)(5)\'s high-income table (2% on the first $4,700 and 3.7% on every dollar above, applied to the WHOLE net income of a filer over $94,700) less the thirty-row bracket adjustment ($290 at $94,701 falling $10 per $100 to $0 at $97,600), as Act 1 of the 2026 First Extraordinary Session writes them. The identity is reduction = rate x the row\'s floor less the tax accumulated below it. CHECKED TWO WAYS rather than asserted: test/arkansas.test.js recomputes the statutory route at every dollar from $0 to $120,000, and policyengine-us 2.15.3 — which has no high-income parameters at all — holds the same thirty-five amounts including the $367.20 and the $79.90, derived independently from the same two tables. The thresholds did NOT move from 2025, which is Act 1 setting them rather than a carry-forward. § 26-51-201(d)(1) indexes the bracket bounds and NOT the adjustment\'s dollar amounts. NOT OPENED FROM THIS SANDBOX: arkleg.state.ar.us does not resolve here',
    constant: true,
  },
  {
    state: 'AR',
    path: 'deduction.amounts.*',
    kind: 'indexed',
    years: [2025],
    document: '§ 26-51-430',
    cite: 'A.C.A. § 26-51-430 — $2,200 single and $4,400 joint as enacted in 2015, indexed to CPI-U with the result ROUNDED DOWN to the nearest $10, which is why $2,470 and $4,940 are not round. Head of household, married filing separately and a qualifying surviving spouse ALL take the single amount: Arkansas gives a single parent no more deduction than a single filer and hands them the larger figure through the low-income tables and the personal credits instead. The second smallest standard deduction among the states that HAVE one — Mississippi\'s $2,300 is smaller, and thirteen states here allow none at all — and roughly a sixth of the federal one, which is the arithmetic that makes the low-income tables matter. 2026 is carried forward: no card has been published and the rounding-down rule makes the step $60 to $80, worth $2.22 to $2.96 of tax',
    constant: true,
  },
  {
    state: 'AR',
    path: 'deduction.amounts.*',
    kind: 'carried-forward',
    years: [2026],
    document: '§ 26-51-430',
    cite: 'CARRIED FORWARD FROM 2025. § 26-51-430 indexes the deduction to CPI-U and rounds the result DOWN to the nearest $10, and neither a 2026 Indexed Tax Brackets card nor the 2026 AR1000F instructions has been published, so $2,470 and $4,940 are the 2025 figures standing in. One indexation step is $60 to $80 of deduction, which is $2.22 to $2.96 of tax — the smallest provisional exposure in this package, because the deduction itself is the second smallest',
    constant: true,
  },
  {
    state: 'AR',
    path: 'lowIncomeTaxTable.secondTableFromDependents',
    kind: 'agency',
    document: 'Low Income Tax Tables',
    cite: 'TWO, which is the instructions\' own division: each status but single has one table for "no dependents or one dependent" and a second for "two or more dependents". The single filer\'s table has no second half because a single filer with a dependent is a head of household in Arkansas',
    constant: true,
  },
  {
    state: 'AR',
    path: 'lowIncomeTaxTable.byStatus.**',
    kind: 'agency',
    years: [2025],
    document: 'Low Income Tax Tables',
    cite: 'A.C.A. § 26-51-301 and the 2025 AR1000F and AR1000NR instructions — SEVEN tables of tax by state AGI and family size, taken IN LIEU of the standard or itemized deduction when they come out lower, with married filing separately barred from all of them. FIVE DISTINCT ARRAYS OF 224 ROWS behind those seven cells — the surviving-spouse pair duplicates the head-of-household pair and the separate cell is empty — each row an income boundary and a whole-dollar tax amount, every one transcribed. The exempt amounts are $14,643 single, $20,820 head of household or surviving spouse with no or one dependent, $24,695 joint with no or one, $24,818 head of household or surviving spouse with two or more and $29,722 joint with two or more; the ceilings are $17,500, $25,300, $29,000, $29,000 and $36,100. THE IMPLIED MARGINAL RATES INSIDE THEM ARE 7.00% TO 12.40%, against a top statutory rate of 3.9% and 3.7%, and the steepest is charged to a single parent of two between $24,818 and $29,000. The surviving-spouse pair is byte for byte the head-of-household pair; the instructions print four tables and this package stores four. ALL 224 BOUNDARIES AND 205 OF THE 224 AMOUNTS ARE PERTURBABLE by the mutation harness, which reaches any integer at or above 100, and a 240-mutant sample over exactly those killed 240 of 240; only the 19 amounts below $100 are out of its reach. 2026 is carried forward: § 26-51-301 indexes the tables to CPI-U and none has been published',
    constant: true,
  },
  {
    state: 'AR',
    path: 'lowIncomeTaxTable.byStatus.**',
    kind: 'carried-forward',
    years: [2026],
    document: 'Low Income Tax Tables',
    cite: 'CARRIED FORWARD FROM 2025, all five distinct arrays and all 224 rows. § 26-51-301 indexes the tables and their exempt amounts to CPI-U and no 2026 AR1000F instructions have been published. The exposure runs the OPPOSITE WAY to a carried-forward deduction and is larger: an unindexed table charges a 2026 household whose income rose with inflation more rows than the real table will, so an Arkansas answer here is TOO HIGH for a low-income 2026 return by up to roughly one indexation step of rows — about $60 of tax on a joint return with two or more dependents',
    constant: true,
  },
  {
    state: 'AR',
    path: 'exemptionCredit.perFiler.*',
    kind: 'statute',
    document: '§ 26-51-501',
    cite: 'A.C.A. § 26-51-501 — $29 for each filer, plus ONE MORE CREDIT for a head of household or a qualifying surviving spouse, which is a property of the filing status rather than of a person. So a single parent claims $58 with one person on the return, which is Iowa\'s shape and the opposite of Oklahoma\'s § 2358(D); stored byStatus rather than perPerson for that reason. $29 is an integer below 100 and has NO MUTANT, which is the blind-spot class that produced Day 63\'s one real defect, so test/arkansas.test.js asserts the five cells by hand. Unindexed: § 26-51-501(e) indexed it to 2001 and it has stood at $29 since 2020',
    constant: true,
  },
  {
    state: 'AR',
    path: 'exemptionCredit.perDependent',
    kind: 'statute',
    document: '§ 26-51-501',
    cite: 'A.C.A. § 26-51-501 — $29 a dependent, the same figure a filer is worth, which is the ordinary shape and not a separate parameter',
    constant: true,
  },
  {
    state: 'AR',
    path: 'exemptionCredit.perSeniorFiler',
    kind: 'statute',
    document: '§ 26-51-501',
    cite: 'A.C.A. § 26-51-501 — a SECOND whole $29 credit for each filer or spouse 65 or over, not an increment of a different size, which is Oklahoma\'s shape rather than Iowa\'s half-sized $20. The statute gives a THIRD "65 Special" credit to a filer of 65 who did not use the $6,000 retirement exemption and this package does not model the election; see the state\'s notes for the $28.96 price',
    constant: true,
  },
  {
    state: 'AR',
    path: 'exemptionCredit.seniorAge',
    kind: 'statute',
    document: '§ 26-51-501',
    cite: 'A.C.A. § 26-51-501 — 65, the federal § 63(f) age. It is the ONLY age test on an Arkansas return: § 26-51-307\'s retirement exemption has none at all',
    constant: true,
  },
  {
    state: 'AR',
    path: 'exemptionCredit.perBlindOrDisabledFiler',
    kind: 'statute',
    document: '§ 26-51-501',
    cite: 'A.C.A. § 26-51-501 — a further $29 for each blind filer or spouse, which STACKS with the age credit: a blind Arkansan of 65 claims $29 + $29 + $29. The statute gives the same credit to a DEAF filer and no field in this package carries deafness, so that one is declared in the notes rather than stored',
    constant: true,
  },
  {
    state: 'AR',
    path: 'additionalTaxCredit.maximum.*',
    kind: 'agency',
    document: 'Additional Tax Credit for Qualified Individuals',
    cite: 'The additional tax credit for qualified individuals — $60 a filer and $120 on a joint return, where net taxable income is at or below the threshold below. Successor to the 2022 and 2023 inflationary relief credit. Nonrefundable, and after the personal credits in the statutory order',
    constant: true,
  },
  {
    state: 'AR',
    path: 'additionalTaxCredit.start.*',
    kind: 'agency',
    years: [2025],
    document: 'Additional Tax Credit for Qualified Individuals',
    cite: '$26,500 of net taxable income, the same figure for every filing status — which is the unusual half: the credit itself doubles on a joint return and the income test does not. Carried forward to 2026, where no instructions have been published',
    constant: true,
  },
  {
    state: 'AR',
    path: 'additionalTaxCredit.start.*',
    kind: 'carried-forward',
    years: [2026],
    document: 'Additional Tax Credit for Qualified Individuals',
    cite: 'CARRIED FORWARD FROM 2025. The $26,500 income test has not been published for 2026; the $60 and the $5 step are statutory and not indexed by anything, so this threshold is the whole of the credit\'s provisional exposure — one indexation step is five withdrawal steps and $25 of credit',
    constant: true,
  },
  {
    state: 'AR',
    path: 'additionalTaxCredit.increment',
    kind: 'agency',
    document: 'Additional Tax Credit for Qualified Individuals',
    cite: '$100, and the words that go with it are "for each $100 OR PART OF $100" — the CEILING of the increments and not the quotient, which is what makes this a staircase of twelve $5 steps rather than a 5% phase-out rate. The distinction is $5 of tax on one dollar of income, twelve times between $26,500 and $27,700',
    constant: true,
  },
  {
    state: 'AR',
    path: 'additionalTaxCredit.withdrawalPerIncrement.*',
    kind: 'agency',
    document: 'Additional Tax Credit for Qualified Individuals',
    cite: '$5 a step, doubled to $10 on a joint return so that the $120 is withdrawn over the same $1,200 of income as the $60. Not indexed by anything and not amended since the credit replaced the inflationary relief credit',
    constant: true,
  },
  {
    state: 'AR',
    path: 'capitalGainsSubtraction.share',
    kind: 'statute',
    document: '§ 26-51-815',
    cite: 'A.C.A. § 26-51-815(a) — 50% of the excess of net long-term capital gain over net short-term capital loss is exempt, and the HIGHEST flat capital-gains exclusion in this ledger: North Dakota 40%, South Carolina 44%, Wisconsin 30%. Unindexed and unamended since the rate reforms began. THE ROW IS HERE BECAUSE THE DIFFERENTIAL GRID REFUSED ITS ABSENCE: this module first declared the exclusion unmodellable because `netCapitalGain` cannot tell a long-term gain from a short-term one, and the grid answered with a $1,978.00 difference on one household — a gap that size is a missing rule rather than a declared one, and `longTermNetted` is a basis this package already had',
    constant: true,
  },
  {
    state: 'AR',
    path: 'retirementIncomeSubtractions.*.cap',
    kind: 'statute',
    document: '§ 26-51-307',
    cite: 'A.C.A. § 26-51-307 — $6,000 per recipient of employment-related pension and IRA distribution income, AT ANY AGE, and NOT INDEXED SINCE 1997. Arkansas and Oklahoma are the only two states in this ledger whose retirement cap has no age test at all, which is the parameter published guides most often get wrong about both. Per person and unused room is lost: a couple whose $12,000 of pension is all in one name exempts $6,000 and the same couple with $6,000 each exempts the lot. Military retired pay is exempt in full from tax year 2018 under Act 141 of 2017 and does NOT consume it',
    constant: true,
  },

  // =========================================================================
  // =========================================================================
  // IOWA — the state where EVERY figure in this ledger is `constant: true` and
  // the answer still changes between the two years.
  //
  // Nothing Iowa stores moves: SF 2442 fixed the rate at 3.8% with no further
  // step, § 422.5(3)'s four exemption thresholds have not moved since at least
  // 2021 and no provision indexes them, § 422.12(1)'s $40 has not moved, and
  // § 422.7(19)'s exclusion has had no cap since 2023. What moves is the
  // DEDUCTION, and it is not Iowa's — Iowa Code § 422.9 still prints the
  // state's own $2,210, and the IA 1040 reads the federal figure instead. So
  // Iowa is the one state here where `constant: true` on every row is the
  // truth AND a reader who concluded from it that 2025 and 2026 are the same
  // return would be wrong by $13.30.
  //
  // THE ABSENT ROW IS THE INTERESTING ONE. There is no entry for
  // `retirementIncomeSubtractions.*.cap`, because Iowa has no cap: the
  // exclusion is total and the module expresses that by omitting the field, so
  // the largest subtraction in the state has no figure to attribute and no
  // mutant to kill. North Dakota's cap is a `sentinel` zero and Oklahoma's is
  // a statutory $10,000; Iowa's is the absence of both.
  // =========================================================================
  {
    state: 'IA',
    path: 'rate.rate',
    kind: 'statute',
    document: '§ 422.5A',
    cite: 'Iowa Code § 422.5A — a single rate of 3.8% for every filing status, from tax year 2025 under SF 2442 of 2024. The act pulled HF 2317\'s flat year forward from 2026 AND set the rate below HF 2317\'s 3.9% destination, so a secondary source printing 3.9% for 2026 is reading the superseded schedule. Identical in both years because no further step exists, not because the second year went unread. NOT OPENED FROM THIS SANDBOX: legis.iowa.gov does not resolve here',
    constant: true,
  },
  {
    state: 'IA',
    path: 'exemptionCredit.perFiler.*',
    kind: 'statute',
    document: '§ 422.12(1)',
    cite: 'Iowa Code § 422.12(1) — $40 for each personal credit, and the INSTRUCTIONS SAY HOW MANY: one if you are single, married filing separately or a qualifying surviving spouse, and TWO if you are married filing jointly OR HEAD OF HOUSEHOLD. So a single parent claims $80 with one person on the return, which is the opposite of Oklahoma\'s § 2358(D). Stored per status rather than per person for that reason; a per-person reading was refuted by six differential households that differed by exactly $40.00. A CREDIT and not an exemption, so it is worth the same at every income; $40 of Iowa credit is $1,052.63 of income at 3.8%. Unindexed and unamended through the flat-tax reform',
    constant: true,
  },
  {
    state: 'IA',
    path: 'exemptionCredit.perDependent',
    kind: 'statute',
    document: '§ 422.12(1)',
    cite: 'Iowa Code § 422.12(1) — $40 a dependent, the same figure a filer is worth, which is the ordinary shape and not a separate parameter',
    constant: true,
  },
  {
    state: 'IA',
    path: 'exemptionCredit.perSeniorFiler',
    kind: 'statute',
    document: '§ 422.12(1)',
    cite: 'Iowa Code § 422.12(1) — an ADDITIONAL $20 for each filer or spouse 65 or over, on top of the $40. Half the personal figure rather than a second whole credit, which is where Iowa differs from Oklahoma\'s § 2358(D) blind exemption, and it is not means-tested, which is where it differs from Oklahoma\'s special exemption',
    constant: true,
  },
  {
    state: 'IA',
    path: 'exemptionCredit.perBlindOrDisabledFiler',
    kind: 'statute',
    document: '§ 422.12(1)',
    cite: 'Iowa Code § 422.12(1) — a further $20 for each blind filer or spouse, which STACKS with the age addition: a blind Iowan of 65 claims $40 + $20 + $20',
    constant: true,
  },
  {
    state: 'IA',
    path: 'exemptionCredit.seniorAge',
    kind: 'statute',
    document: '§ 422.12(1)',
    cite: 'Iowa Code § 422.12(1) — 65, the federal § 63(f) age, and the same age § 422.5(3) uses for the larger exemption threshold. Iowa uses one age for both and neither is indexed',
    constant: true,
  },
  {
    state: 'IA',
    path: 'zeroTaxThreshold.threshold.*',
    kind: 'statute',
    document: '§ 422.5(3)',
    cite: 'Iowa Code § 422.5(3) — the low-income exemption under 65: $9,000 for a single or married-filing-separately return and $13,500 for every other status, measured on Iowa net income. NOT INDEXED AND NOT MOVED SINCE AT LEAST 2021, and that is what has killed them: the federal standard deduction they are now effectively raced against is $15,750 in 2025 and $16,100 in 2026, so a non-elderly return at any of these thresholds already has zero taxable income and the exemption cannot change an answer for ANY status in either year',
    constant: true,
  },
  {
    state: 'IA',
    path: 'zeroTaxThreshold.elderlyThreshold.*',
    kind: 'statute',
    document: '§ 422.5(3)',
    cite: 'Iowa Code § 422.5(3) — the low-income exemption at 65 or over: $24,000 for a SINGLE return and $32,000 for every other status, so married filing separately moves from the small group to the large one on a birthday. Only one spouse need reach 65. Unindexed, so this tier is being withdrawn by the same arithmetic: it still bites for a single, head-of-household or separate filer and no longer for joint or surviving spouse, and the most it can save a single Iowan falls from $237.50 in 2025 to $222.30 in 2026',
    constant: true,
  },
  {
    state: 'IA',
    path: 'zeroTaxThreshold.elderlyAge',
    kind: 'statute',
    document: '§ 422.5(3)',
    cite: 'Iowa Code § 422.5(3) — 65, and the test is satisfied by EITHER spouse reaching it, which the instructions state in those words: "only one spouse must be 65 or older to qualify"',
    constant: true,
  },
  {
    state: 'IA',
    path: 'retirementIncomeSubtractions.0.minimumAge',
    kind: 'statute',
    document: '§ 422.7(19)',
    cite: 'Iowa Code § 422.7(19) — 55, and it is the lowest retirement-income age in this ledger by seven years: Georgia\'s is 62, South Carolina\'s 65, Michigan\'s a birth-year cohort. The statute also qualifies a disabled person and a surviving spouse of someone who would have qualified, NEITHER of which this package models from this figure — see the state\'s notes for the price',
    constant: true,
  },
  {
    state: 'IA',
    path: 'earnedIncomeCredit.matchRate',
    kind: 'statute',
    document: '§ 422.12B',
    cite: 'Iowa Code § 422.12B — 15% of the federal earned income credit, refundable. THE FEDERAL CREDIT FOR THE SAME TAX YEAR, with no date in the provision: Iowa reads this year\'s credit where Oklahoma\'s § 2357.43 reads the credit as it stood on 31 December 2020, which is the entire reason Iowa\'s is modelled here and Oklahoma\'s is not',
    constant: true,
  },

  // =========================================================================
  // =========================================================================
  // OKLAHOMA — the state where the two years are two different schedules,
  // because HB 2764 of 2025 rewrote § 2355(C) for tax years beginning on or
  // after 1 January 2026. So every rate and every threshold is split by year
  // here, which no other state in this ledger needs: ND's rates are one statute
  // across both years and its thresholds are indexed, and Oklahoma's are
  // neither. Nothing in Oklahoma is indexed at all — the standard deduction is
  // the federal 2017 figure frozen, the exemption has been $1,000 since before
  // this ledger's range, and the $10,000 retirement exclusion has no indexing
  // provision — so `constant: true` here is the statute saying so and not a
  // carry-forward. The one figure that could have moved and did not is the
  // retirement cap: HB 2190 of 2025 would have taken it to $40,000 from 2026
  // and died on 14 May 2026.
  // =========================================================================
  {
    state: 'OK',
    path: 'rate.byStatus.*.*.rate',
    years: [2025],
    kind: 'statute',
    document: '§ 2355(C)',
    cite: '68 O.S. § 2355(C)(1)(a) and (C)(2)(a) — the six rates 0.25%, 0.75%, 1.75%, 2.75%, 3.75% and 4.75%, the same six for every filing status. A printed schedule with no indexation provision; what moves it is an act, and one came. NOT OPENED FROM THIS SANDBOX: oscn.net does not resolve here',
    constant: true,
  },
  {
    state: 'OK',
    path: 'rate.byStatus.*.*.upTo',
    years: [2025],
    kind: 'statute',
    document: '§ 2355(C)',
    cite: '68 O.S. § 2355(C)(1)(a) — $1,000, $2,500, $3,750, $4,900 and $7,200 for single and married filing separately, written as the increments $1,000 + $1,500 + $1,250 + $1,150 + $2,300; (C)(2)(a) — $2,000, $5,000, $7,500, $9,800 and $14,400 for joint, surviving spouse AND head of household, written as $2,000 + $3,000 + $2,500 + $2,300 + $4,600. Two subsections, two tables, and no relation stated between them although the second is exactly twice the first',
    constant: true,
  },
  {
    state: 'OK',
    path: 'rate.byStatus.*.*.rate',
    years: [2026],
    kind: 'statute-scheduled',
    document: 'HB 2764',
    cite: 'HB 2764 of the 2025 regular session, page 11 — 0%, 2.5%, 3.5% and 4.5%. FOUR ROWS, where every summary of the act says it consolidated six brackets into three: the fourth is a 0% band and the three positive rates are each exactly 0.25 points below their 2025 values. Enacted in 2025 for tax years beginning on or after 1 January 2026, so the 2026 figure was a scheduled change rather than a projection',
    constant: true,
  },
  {
    state: 'OK',
    path: 'rate.byStatus.*.*.upTo',
    years: [2026],
    kind: 'statute-scheduled',
    document: 'HB 2764',
    cite: 'HB 2764, page 11 — $3,750, $4,900 and $7,200 single and separate; $7,500, $9,800 and $14,400 joint, surviving spouse and head of household. NOT ONE THRESHOLD MOVED: these are the 2025 figures with the three bottom bands collapsed into one at zero, which is why an error expressed as a difference between two Oklahoma rates costs the same in both years',
    constant: true,
  },
  {
    state: 'OK',
    path: 'deduction.amounts.*',
    kind: 'statute',
    document: 'Form 511 packet',
    cite: 'the Form 511 instructions, page 10 — $6,350 single and married filing separately, $12,700 joint and surviving spouse, $9,350 head of household. THE FEDERAL 2017 AMOUNTS, FROZEN: Oklahoma decoupled rather than follow the Tax Cuts and Jobs Act increase, there is no indexing provision, and the same four figures appear in the 2021 instructions and the 2026 ones. Identical in both years because nothing moves them, not because nobody read the second one',
    constant: true,
  },
  {
    state: 'OK',
    path: 'exemption.perFiler.*',
    kind: 'statute',
    document: '§ 2358(D)',
    cite: '68 O.S. § 2358(D) — $1,000 per exemption, two on a joint return and one on every other including a qualifying surviving spouse, whose return has one person on it. Unindexed and unamended across both years here',
    constant: true,
  },
  {
    state: 'OK',
    path: 'exemption.perDependent',
    kind: 'statute',
    document: '§ 2358(D)',
    cite: '68 O.S. § 2358(D) — the same $1,000 a dependent is worth as a filer is, which is the ordinary shape and not a separate figure',
    constant: true,
  },
  {
    state: 'OK',
    path: 'exemption.perBlindOrDisabledFiler',
    kind: 'statute',
    document: '§ 2358(D)',
    cite: '68 O.S. § 2358(D) — a blind filer or spouse counts as a SECOND WHOLE EXEMPTION rather than taking an increment, which is why the figure is $1,000 and not a supplement to it: the Form 511 box is ticked and the exemption count goes from one to two',
    constant: true,
  },
  {
    state: 'OK',
    path: 'exemption.perLowIncomeSeniorFiler',
    kind: 'statute',
    document: '§ 2358(D)',
    cite: '68 O.S. § 2358(D) — the special exemption, a further $1,000 for each taxpayer or spouse 65 or over whose federal AGI is at or under the limit for their status. It is the ONLY age-related figure on an Oklahoma return outside the retirement exclusion, and it is means-tested, so Oklahoma has no untested age exemption at all',
    constant: true,
  },
  {
    state: 'OK',
    path: 'exemption.seniorAge',
    kind: 'statute',
    document: '§ 2358(D)',
    cite: '68 O.S. § 2358(D) — "sixty-five (65) years of age or older at the close of the tax year". The federal § 63(f) age, which is the age almost every state in this ledger uses and none of them indexes',
    constant: true,
  },
  {
    state: 'OK',
    path: 'exemption.lowIncomeSeniorThreshold.*',
    kind: 'statute',
    document: '§ 2358(D)',
    cite: '68 O.S. § 2358(D) — $15,000 single, $25,000 joint and surviving spouse, $19,000 head of household, $12,500 married filing separately, and the test is "EQUAL TO OR LESS THAN" rather than Indiana\'s "less than". Unindexed since enactment, which is what makes them bite: $15,000 of 1980s federal AGI and $15,000 of 2026 federal AGI are not the same household',
    constant: true,
  },
  {
    state: 'OK',
    path: 'retirementIncomeSubtractions.*.cap',
    kind: 'statute',
    document: '§ 2358(A)(8)',
    cite: '68 O.S. § 2358(A)(8) and (A)(13) — $10,000 per person of retirement benefits, "not to exceed the amount included in federal adjusted gross income", with NO AGE TEST. Unindexed, and the figure that could have moved: HB 2190 of 2025 would have raised it to $40,000 from tax year 2026 and died on 14 May 2026, so $10,000 in 2026 is current law read rather than last year\'s number carried',
    constant: true,
  },

  // =========================================================================
  // =========================================================================
  // ALABAMA — the state whose figures have not moved because nothing in Alabama
  // is indexed and almost nothing in it has been amended. The rate schedule is
  // from 1935; the personal exemption, the standard deduction and the dependent
  // exemption chart are where Act 2022-292 left them in 2022; the defined
  // benefit exemption is a regulation reading a federal definition. A new tax
  // year costs Alabama no release at all, which is what `statute` means here
  // and why none of these is `carried-forward`.
  //
  // The ONE difference between 2025 and 2026 is the overtime provision, and it
  // differs because one act expired in the middle of 2025 and another was
  // signed in April 2026.
  // =========================================================================
  {
    state: 'AL',
    path: 'rate.byStatus.*.*.rate',
    kind: 'statute',
    document: '§ 40-18-5 —',
    cite: 'Ala. Code § 40-18-5 — 2% on the first bracket, 4% on the second and 5% above, unchanged since 1935. The 5% rate is reached at $3,000 of taxable income, so the graduated part of the schedule is worth $40 against a flat 5% and $80 on a joint return',
    constant: true,
  },
  {
    state: 'AL',
    path: 'rate.byStatus.*.*.upTo',
    kind: 'statute',
    document: '§ 40-18-5 —',
    cite: 'Ala. Code § 40-18-5 — $500 and $3,000 for a single, separate or head-of-family return and exactly twice each for a joint one. Alabama has no indexing provision and these have not moved since 1935',
    constant: true,
  },
  {
    state: 'AL',
    path: 'deduction.maximum.*',
    kind: 'statute',
    document: '§ 40-18-15 —',
    cite: 'Ala. Code § 40-18-15(b) — the optional standard deduction below the threshold: $3,000 single, $8,500 joint, $5,200 head of family, $4,250 separate. Act 2022-292 raised the joint figure by $1,000 and the other three by $500 in 2022 and nothing has moved since',
    constant: true,
  },
  {
    state: 'AL',
    path: 'deduction.min.*',
    kind: 'statute',
    document: '§ 40-18-15 —',
    cite: 'Ala. Code § 40-18-15(b) — the figure the deduction may not fall below: $5,000 joint and $2,500 for every other status. Act 2022-292 raised these by the same amounts as the maxima, which is what makes every column complete its withdrawal in exactly twenty steps',
    constant: true,
  },
  {
    state: 'AL',
    path: 'deduction.threshold.*',
    kind: 'statute',
    document: '§ 40-18-15 —',
    cite: 'Ala. Code § 40-18-15(b) — the adjusted gross income at which the withdrawal begins: $25,500, and exactly half of it, $12,750, on a separate return',
    constant: true,
  },
  {
    state: 'AL',
    path: 'deduction.increment.*',
    kind: 'statute',
    document: '§ 40-18-15 —',
    cite: 'Ala. Code § 40-18-15(b) — the step of income the reduction is charged "for each" of: $500, and $250 on a separate return. There is no "or fraction thereof" clause, so the step is taken whole and the first $499 above the threshold cost nothing',
    constant: true,
  },
  {
    state: 'AL',
    path: 'deduction.reduction.*',
    kind: 'statute',
    document: '§ 40-18-15 —',
    cite: 'Ala. Code § 40-18-15(b) — the deduction removed by one step: $25 single, $175 joint, $135 head of family, $88 separate. The separate figure is the only one that does not scale: half of $175 is $87.50 and the statute rounded it up, so the twentieth step is worth $78 rather than $88 and the floor absorbs the difference',
    constant: true,
  },
  {
    state: 'AL',
    path: 'itemizedDeduction.phaseOutRate',
    kind: 'sentinel',
    cite: 'Zero because Alabama puts no limit on its itemized deductions — nothing in § 40-18-15(a) reduces them as income rises, so this is the absence of a Maryland-style limitation rather than a rate read from anywhere',
    constant: true,
  },
  {
    state: 'AL',
    path: 'exemption.perFiler.*',
    kind: 'statute',
    document: '§ 40-18-19 —',
    cite: 'Ala. Code § 40-18-19(a)(8) — $1,500 single or separate and $3,000 joint or head of family, confirmed figure for figure by the Department of Revenue’s own Form 40 rejection codes, which reject a return whose line 13 is anything else. Head of family takes the JOINT exemption and the SINGLE rate schedule',
    constant: true,
  },
  {
    state: 'AL',
    path: 'exemption.perDependent',
    kind: 'derived',
    cite: 'The top step of `exemption.perDependentSteps`, kept so that something can be checked against the chart rather than read from it: the engine reads the chart and never this. `test/registry.test.js` fails if the two disagree, which is the check Ohio’s dead copy of its exemption went without for 33 days',
    constant: true,
  },
  {
    state: 'AL',
    path: 'exemption.perDependentSteps.*.amount',
    kind: 'statute',
    document: '§ 40-18-19 —',
    cite: 'Ala. Code § 40-18-19(a)(9) — $1,000 a dependent at or below $50,000 of adjusted gross income, $500 above it and at or below $100,000, $300 above $100,000. One chart for all five filing statuses',
    constant: true,
  },
  {
    state: 'AL',
    path: 'exemption.perDependentSteps.*.upTo',
    kind: 'statute',
    document: '§ 40-18-19 —',
    cite: 'Ala. Code § 40-18-19(a)(9) — the chart’s boundaries, both of them INCLUSIVE in the statute’s own words ("equal to or less than fifty thousand dollars", "in excess of fifty thousand dollars and equal to or less than one hundred thousand dollars"). Act 2022-292 raised the first from $20,000 to $50,000 for tax years after 2021',
    constant: true,
  },
  {
    state: 'AL',
    path: 'planTypeRetirement.definedContributionCap',
    kind: 'statute',
    document: '§ 40-18-19 —',
    cite: 'Ala. Code § 40-18-19(a)(13), claimed on Schedule RS — $6,000 per person of otherwise taxable defined contribution distributions, from tax year 2023 and not indexed. The defined benefit exemption beside it has no figure at all, which is why it appears in no entry here: it is the whole of the payment',
    constant: true,
  },
  {
    state: 'AL',
    path: 'planTypeRetirement.definedContributionAge',
    kind: 'statute',
    document: '§ 40-18-19 —',
    cite: 'Ala. Code § 40-18-19(a)(13) — age 65. It is the only age test in the Alabama return: the defined benefit exemption has none, so an Alabama retiree at 50 with a pension is treated exactly as one at 80',
    constant: true,
  },
  {
    state: 'AL',
    path: 'federalDeductionSubtractions.*.cap',
    kind: 'statute',
    document: 'HB 527 (2026)',
    cite: 'Alabama HB 527, signed in April 2026 — up to $1,000 of qualified overtime compensation for tax years beginning after 31 December 2025 and through 2028, on the federal definition of overtime above the regular rate. The predecessor it replaces was uncapped and covered the whole overtime wage, and it expired on 30 June 2025',
    years: [2026],
    constant: true,
  },
  // MISSOURI — one indexed figure, one rate that was allowed to fall and did
  // not, and a chart of percentages that has not moved since 2019.
  //
  // The whole rate schedule is generated from the first bracket's width, which
  // § 143.011.5 indexes as a block — so there is ONE indexed figure in Missouri
  // and it appears eight times per filing status. The rates above it are
  // statutory: § 143.011.3 cut the top one to 4.8% for 2024 and 4.7% for 2025,
  // and § 143.011.4 allows a further 0.1 point a year on a revenue condition
  // that was NOT met for 2026. A rate that could have moved and did not is a
  // statutory figure with a schedule attached, which is why the entry says so
  // in its cite rather than claiming the statute fixed it.
  //
  // Everything else — the five percentage steps, the two caps, the $6,000, the
  // three allowances, the $1,400 and the 20% — is a dollar figure or a rate
  // printed in the Revised Statutes and not indexed by anything. The ONE
  // exception is the maximum Social Security benefit, which is the ceiling on
  // the public pension deduction and is reprinted on Form MO-A every January:
  // 2026's does not exist yet, so it is carried forward and flagged.
  // =========================================================================
  {
    state: 'MO',
    path: 'rate.byStatus.*.*.rate',
    kind: 'statute',
    document: '§ 143.011 —',
    cite: 'Mo. Rev. Stat. § 143.011.1 — 0%, 2%, 2.5%, 3%, 3.5%, 4%, 4.5% and a top rate of 4.7%, the same schedule for every filing status. § 143.011.3 cut the top rate from 4.95% to 4.8% for 2024 and § 143.011.4 to 4.7% for 2025; the further 0.1-point reduction subsection 4 allows for 2026 required general revenue growth of $175,000,000 over the highest of the three preceding fiscal years and the condition was not met, which the Department of Revenue confirmed by publishing a 2026 withholding formula at 4.7%',
    constant: true,
  },
  {
    state: 'MO',
    path: 'rate.byStatus.*.*.upTo',
    kind: 'indexed',
    document: '§ 143.011 —',
    cite: 'Mo. Rev. Stat. § 143.011.5 indexes the bracket as a block by the percentage increase in the consumer price index, and the eight ceilings are the first bracket’s width times one through seven: $1,313 for 2025 and $1,348 for 2026. One indexed figure generates the whole schedule, which is why a transcribed table of eight numbers can drift from the provision and this one cannot',
    constant: false,
  },
  {
    state: 'MO',
    path: 'itemizedDeduction.phaseOutRate',
    kind: 'sentinel',
    cite: 'Zero because Missouri puts no income limit on its itemized deductions — § 143.141 builds the Missouri figure from the federal Schedule A by removing the state and local income taxes and adding the payroll taxes, and nothing in it falls away as income rises',
    constant: true,
  },
  {
    state: 'MO',
    path: 'federalIncomeTaxDeduction.rateSteps.*.rate',
    kind: 'statute',
    document: '§ 143.171 —',
    cite: 'Mo. Rev. Stat. § 143.171.2 — 35%, 25%, 15%, 5% and 0% of the federal income tax liability, one of them applying to the WHOLE bill. The five percentages have stood since the 2018 act that replaced the flat $5,000 deduction with them, for tax years beginning on or after 1 January 2019',
    constant: true,
  },
  {
    state: 'MO',
    path: 'federalIncomeTaxDeduction.rateSteps.*.upTo',
    kind: 'statute',
    document: '§ 143.171 —',
    cite: 'Mo. Rev. Stat. § 143.171.2 — $25,000, $50,000, $100,000 and $125,000 of Missouri adjusted gross income, every boundary INCLUSIVE in the statute’s own words ("twenty-five thousand dollars or less", then "in excess of twenty-five thousand dollars"). Not indexed: these are the same four figures the 2018 act wrote',
    constant: true,
  },
  {
    state: 'MO',
    path: 'federalIncomeTaxDeduction.cap.*',
    kind: 'statute',
    document: '§ 143.171 —',
    cite: 'Mo. Rev. Stat. § 143.171.2 — "not to exceed five thousand dollars on a single taxpayer’s return or ten thousand dollars on a combined return", unchanged since 1994 and not indexed. PolicyEngine-US reads the first figure as belonging to the SINGLE filing status alone and gives $10,000 to a separate, head-of-household or surviving-spouse return; this package reads "a single taxpayer’s return" as a return with one taxpayer on it',
    constant: true,
  },
  {
    state: 'MO',
    path: 'capitalGainsSubtraction.share',
    kind: 'statute',
    document: 'Missouri HB 594 (2025), signed',
    cite: 'Mo. Rev. Stat. § 143.121.3(14), added by HB 594 (2025) — "one hundred percent of all income reported as a capital gain for federal income tax purposes", retroactive to tax years beginning on or after 1 January 2025 and with no sunset',
    constant: true,
  },
  {
    state: 'MO',
    path: 'stateRetirementDeduction.socialSecurityMinimumAge',
    kind: 'statute',
    document: '§ 143.125 —',
    cite: 'Mo. Rev. Stat. § 143.125.2 — 62 years of age by 31 December. SB 190 (2023) removed the income test from this deduction for tax year 2024 and left the age alone',
    constant: true,
  },
  {
    state: 'MO',
    path: 'stateRetirementDeduction.publicPensionCap',
    kind: 'indexed',
    document: 'Pension FAQs',
    cite: 'The maximum Social Security benefit, reprinted on Form MO-A Part 3 Section A line 7 each year and confirmed by the Department of Revenue’s pension FAQs: $47,633 for 2025. It moves with the Social Security Administration’s own figure rather than with any Missouri index, which is why a Missouri retiree’s pension ceiling is set in Baltimore',
    years: [2025],
    constant: true,
    why: 'one year of a figure that moves annually: the 2026 value is a separate carried-forward entry, so this one has nothing to compare against',
  },
  {
    state: 'MO',
    path: 'stateRetirementDeduction.publicPensionCap',
    kind: 'carried-forward',
    document: 'Pension FAQs',
    cite: '2025’s $47,633, standing in. The 2026 Form MO-A is published in January 2027 and the maximum Social Security benefit it will print does not exist yet, so this figure is last year’s — and because the figure has risen every year, carrying it forward understates the deduction rather than overstating it',
    years: [2026],
    carriedForwardFrom: 2025,
    constant: true,
    why: 'a carried-forward figure is equal to the year it was carried from by construction',
    resolvedBy: 'the 2026 Form MO-A, Part 3 Section A line 7, published January 2027',
  },
  {
    state: 'MO',
    path: 'stateRetirementDeduction.privatePensionPerPersonCap',
    kind: 'statute',
    document: '§ 143.124 —',
    cite: 'Mo. Rev. Stat. § 143.124.2 — $6,000 per person of private pension, annuity, IRA, 401(k), 403(b), SEP or Keogh income. The figure has stood since 2007 and is not indexed, so inflation has halved it',
    constant: true,
  },
  {
    state: 'MO',
    path: 'stateRetirementDeduction.privatePensionAllowance.*',
    kind: 'statute',
    document: '§ 143.124 —',
    cite: 'Mo. Rev. Stat. § 143.124.2 — $25,000 for a single, head-of-household or qualifying surviving spouse return, $32,000 for a combined return and $16,000 for a separate one. The $6,000 is withdrawn dollar for dollar as Missouri adjusted gross income LESS the taxable Social Security exceeds these, so a single filer with one pension has nothing left at $31,000',
    constant: true,
  },
  {
    state: 'MO',
    path: 'earnedIncomeCredit.matchRate',
    kind: 'statute',
    document: '\u00a7 143.177 \u2014',
    cite: 'Mo. Rev. Stat. \u00a7 143.177.3(2) \u2014 20% of the federal earned income credit. The act set 10% for 2023 and allowed increases to a statutory maximum of 20% on revenue conditions; the maximum was reached for tax year 2024 and the Department of Revenue\u2019s 2024 and 2025 MO-1040 books both print it, so the schedule has run out and this is a fixed figure rather than a scheduled one',
    constant: true,
  },
  {
    state: 'MO',
    path: 'earnedIncomeCredit.investmentIncomeLimit',
    kind: 'indexed',
    document: 'Working Family Tax Credit FAQ',
    cite: 'Form MO-WFTC line 3, $4,400 for 2025. There is no federal series to read and no dollar amount in the statute: \u00a7 143.177.3(1) computes the credit under \u00a7 32 as it stood on 1 January 2021, so the limit is the PRE-ARPA disqualified income amount, which the IRS stopped publishing when ARPA replaced it \u2014 the Department of Revenue indexes it itself and prints it on the form',
    years: [2025],
    constant: true,
    why: 'one year of a figure the Department of Revenue re-publishes annually: the 2026 value is a separate carried-forward entry, so this one has nothing to compare against',
  },
  {
    state: 'MO',
    path: 'earnedIncomeCredit.investmentIncomeLimit',
    kind: 'carried-forward',
    document: 'Working Family Tax Credit FAQ',
    cite: '2025\u2019s $4,400, standing in. Form MO-WFTC 2026 is published in January 2027 and is the ONLY place this figure appears \u2014 it is a pre-ARPA \u00a7 32(i) amount the IRS no longer publishes, so no federal release can settle it either',
    years: [2026],
    carriedForwardFrom: 2025,
    constant: true,
    why: 'a carried-forward figure is equal to the year it was carried from by construction',
    resolvedBy: 'Form MO-WFTC for 2026, line 3, published January 2027',
  },
  {
    state: 'MO',
    path: 'businessIncomeDeduction.rate',
    kind: 'statute',
    document: '§ 143.022 —',
    cite: 'Mo. Rev. Stat. § 143.022.2 — 20% of business income, the statutory maximum, reached in 2023 after rising five points a year from 2018. The schedule has run out, so this is a fixed figure rather than a scheduled one',
    constant: true,
  },
  {
    state: 'MO',
    path: 'exemption.perFiler.*',
    kind: 'statute',
    document: '§ 143.161 —',
    cite: 'Mo. Rev. Stat. § 143.161.2 — $1,400 for a head of household or a qualifying surviving spouse, and nothing for anybody else. The general exemption in subsection 1 is defined by reference to the federal one, which IRC § 151(d)(5) has set to zero since 2018 and the OBBBA made permanent, so the zeros here are a federal figure and the $1,400 is not',
    constant: true,
  },
  {
    state: 'MO',
    path: 'exemption.perDependent',
    kind: 'federal-conformity',
    document: '§ 143.161 —',
    cite: 'Zero, and it is a FEDERAL zero: Mo. Rev. Stat. § 143.161.1 grants an exemption "for each exemption to which the taxpayer is entitled for federal income tax purposes", and IRC § 151(d)(5) set that to zero. Missouri did not repeal its dependent exemption — Congress did, and Missouri’s statute followed without being amended, which is the same mechanism that makes the Missouri standard deduction move when Congress moves the federal one',
    constant: true,
  },
  // OREGON — the third state that deducts the federal income tax, and the
  // state where the AGENCY'S OWN WITHHOLDING FORMULA is the primary document
  // for most of 2026. The 2026 Form OR-40 instructions do not exist until
  // January 2027, but 150-206-436 (Rev. 12-31-25) was published on 31 December
  // 2025 and carries the standard deduction, the federal tax subtraction
  // ceiling AND its whole phase-out table, the allowance value and the bracket
  // boundaries. An agency does not publish a withholding formula for a figure
  // it has not settled, which is why these are `indexed` and read rather than
  // carried forward — and why Oregon's 2026 has only two provisional figures
  // where Missouri's and California's have more.
  //
  // The three unindexed groups are worth naming because two of them are odd.
  // The 9.9% bracket threshold has been $125,000 since 1993. The aged-or-blind
  // addition has stood at $1,200/$1,000 since 2021. And every figure of the
  // retirement income credit has stood since 2018 — which is why the credit is
  // now arithmetically unreachable for an ordinary retiree: the base did not
  // move and the Social Security benefit that cancels it did.
  // =========================================================================
  {
    state: 'OR',
    path: 'year',
    kind: 'sentinel',
    cite: 'The tax year the definition answers for, not a figure read from anywhere',
    constant: false,
  },
  {
    state: 'OR',
    path: 'rate.byStatus.*.*.rate',
    kind: 'statute',
    document: 'ORS 316.037 \u2014',
    cite: 'ORS 316.037 \u2014 4.75%, 6.75%, 8.75% and 9.9%. The three lower rates were cut from 5%, 7% and 9% for tax years beginning on or after 1 January 2020 and none of the four has moved since',
    constant: true,
  },
  {
    state: 'OR',
    path: 'rate.byStatus.*.2.upTo',
    kind: 'statute',
    document: 'ORS 316.037 \u2014',
    cite: 'ORS 316.037 \u2014 the 9.9% rate begins at $125,000 of taxable income ($250,000 on the joint schedule, which head of household and qualifying surviving spouse also use) and THE FIGURE HAS NOT MOVED SINCE 1993. It is the one boundary in the Oregon schedule the cost-of-living adjustment does not reach, so thirty-three years of inflation have walked the top bracket down the income distribution with no Oregon legislature involved',
    constant: true,
  },
  {
    state: 'OR',
    path: 'rate.byStatus.*.0.upTo',
    kind: 'indexed',
    document: 'Oregon Withholding Tax Formulas, 150-206-436',
    cite: 'ORS 316.037 carries a cost-of-living adjustment on the first two boundaries, measured on the U.S. City Average CPI for the twelve months ending 31 August of the prior year against the second quarter of 1992. $4,400 for 2025 and $4,550 for 2026 on the single schedule, doubled on the joint one \u2014 and the joint column is generated from the single one in this package rather than transcribed, because the doubling IS the provision. The 2026 figures are from the Department of Revenue\u2019s 2026 withholding formula, published 31 December 2025, which is the only document carrying them until the 2026 Form OR-40 instructions appear in January 2027',
    constant: false,
  },
  {
    state: 'OR',
    path: 'rate.byStatus.*.1.upTo',
    kind: 'indexed',
    document: 'Oregon Withholding Tax Formulas, 150-206-436',
    cite: 'ORS 316.037 \u2014 $11,100 for 2025 and $11,400 for 2026 on the single schedule, doubled on the joint one. Same cost-of-living adjustment and same 2026 document as the first boundary',
    constant: false,
  },
  {
    state: 'OR',
    path: 'deduction.amounts.*',
    kind: 'indexed',
    document: 'Oregon Withholding Tax Formulas, 150-206-436',
    cite: 'ORS 316.695 and its cost-of-living adjustment \u2014 $2,835 single and separate, $4,560 head of household and $5,670 joint and surviving spouse for 2025; $2,910, $4,685 and $5,820 for 2026. The single and joint 2026 figures and the $263 allowance are printed in the 2026 withholding formula; the head of household figure is carried by the 2026 Combined Payroll Tax Report Instructions, 150-211-155-2, and is the only one of the three this package has not read in the document itself \u2014 it is also the only value consistent with the published $2,910, since the indexing factor that produces $2,910 from $2,835 cannot produce the $4,650 some secondary sources give',
    constant: false,
  },
  {
    state: 'OR',
    path: 'standardDeductionAgedOrBlindAddition.amount.*',
    kind: 'statute',
    document: 'ORS 316.695 \u2014',
    cite: 'ORS 316.695, Form OR-40 line 16 \u2014 $1,200 for a single or head of household filer and $1,000 each on a joint, separate or surviving spouse return, per person, for age 65 and again for blindness. Not indexed and unchanged since 2021. It is the only figure in this package where a SINGLE filer\u2019s allowance exceeds a joint filer\u2019s per person, so two single 65-year-olds deduct $2,400 between them and the same two people married deduct $2,000',
    constant: true,
  },
  {
    state: 'OR',
    path: 'standardDeductionAgedOrBlindAddition.age',
    kind: 'statute',
    document: 'ORS 316.695 \u2014',
    cite: 'ORS 316.695, Form OR-40 line 16 \u2014 65, and it has never moved',
    constant: true,
  },
  {
    state: 'OR',
    path: 'itemizedDeduction.phaseOutRate',
    kind: 'sentinel',
    cite: 'Zero because Oregon puts no income limit on its itemized deductions \u2014 Schedule OR-A follows the federal Schedule A with the state income tax removed, and nothing in it falls away as income rises',
    constant: true,
  },
  {
    state: 'OR',
    path: 'federalIncomeTaxDeduction.capSteps.*.*.amount',
    kind: 'indexed',
    document: 'Oregon Withholding Tax Formulas, 150-206-436',
    cite: 'ORS 316.695, which limits the ORS 316.680 subtraction, and Table 4 of the Form OR-40 instructions \u2014 $8,500 / $6,800 / $5,100 / $3,400 / $1,700 / nothing for 2025 and $8,750 / $7,000 / $5,250 / $3,500 / $1,750 / nothing for 2026, halved for a separate return. THE FIVE ROWS ARE NOT FIFTHS OF THE MAXIMUM AS A MATTER OF LAW \u2014 each is indexed on its own and rounded, and in 2023 and 2024 they came out unequal to the fifths \u2014 so they are stored and not generated, while the halving for a separate return IS a relation and is generated. The 2026 table comes whole from the 2026 withholding formula; an uprated estimate of the maximum would have given $8,700',
    constant: false,
  },
  {
    state: 'OR',
    path: 'federalIncomeTaxDeduction.capSteps.*.*.from',
    kind: 'statute',
    document: 'Oregon Withholding Tax Formulas, 150-206-436',
    cite: 'Table 4 \u2014 $125,000, $130,000, $135,000, $140,000 and $145,000 of FEDERAL adjusted gross income, doubled on the joint schedule and NOT halved for a separate return, which is what makes the chart exactly marriage-neutral. Not indexed: the same five figures since 2021. Each is the step\u2019s INCLUSIVE LOWER bound \u2014 Table 4 prints the rows as "$125,000\u2013$130,000", which is ambiguous at both ends, and the 2026 withholding formula writes the same row as "greater than or equal to $125,000 and less than $130,000", which settles it the opposite way from Missouri\u2019s \u00a7 143.171.2',
    constant: true,
  },
  {
    state: 'OR',
    path: 'exemptionCredit.perFiler.*',
    kind: 'indexed',
    document: 'Oregon Withholding Tax Formulas, 150-206-436',
    cite: 'ORS 316.085 \u2014 $256 a person for 2025 and $263 for 2026, two on a joint return and one on every other. The 2026 figure is the "value of a state allowance" the 2026 withholding formula publishes, which is the same number: the withholding allowance IS the exemption credit',
    constant: false,
  },
  {
    state: 'OR',
    path: 'exemptionCredit.perDependent',
    kind: 'indexed',
    document: 'Oregon Withholding Tax Formulas, 150-206-436',
    cite: 'ORS 316.085 \u2014 the same $256 and $263 a dependent as a filer. A CREDIT and not an exemption, so it is worth the same to a filer in the 4.75% band and one in the 9.9% band',
    constant: false,
  },
  {
    state: 'OR',
    path: 'exemptionCredit.incomeLimitByStatus.*',
    kind: 'statute',
    document: 'ORS 316.085 \u2014',
    cite: 'ORS 316.085(5) \u2014 $100,000 of federal adjusted gross income on a single or separate return and $200,000 on a joint, head of household or surviving spouse one. Not indexed and unchanged since 1986, and the statute\u2019s word is "exceed", so the filer standing EXACTLY on the figure keeps the credit \u2014 the opposite of Ohio\u2019s \u00a7 5747.022, which allows its credit only below the figure',
    constant: true,
  },
  {
    state: 'OR',
    path: 'surplusCredit.rate',
    years: [2025],
    // `agency` and not `statute`, because Or. Const. Art. IX § 14(4) sets the
    // MECHANISM and the Office of Economic Analysis — which is not the
    // Department of Revenue — sets the figure. That is what a new odd year
    // costs: one certification, published once the biennium has closed, and
    // nothing in the constitution or the statutes to read instead. Colorado's
    // TABOR rate is the same mechanism recorded the other way round, as
    // `determined-after-year-end`, because its 2026 figure is NOT yet known
    // where Oregon's 2025 figure is.
    kind: 'agency',
    document: 'Or. Const. Art. IX § 14 —',
    cite: 'Or. Const. Art. IX § 14(4) returns a biennial General Fund surplus as a credit on the following ODD tax year’s return and the Office of Economic Analysis certifies the percentage once the biennium has closed: 9.863% of the 2024 liability for tax year 2025, off a $1.41 billion surplus for the 2023-25 biennium, against 17.171% / 17.341% / 44.280% for 2019 / 2021 / 2023. Not indexed and not scheduled — a rate that is 4.5 times larger one biennium than the next cannot be either. There is no 2026 figure because there is no 2026 kicker, so the rule is ABSENT for 2026 rather than zero. `constant: true` because the figure exists in ONE of this package\u2019s two years and a single-year figure cannot be observed to move \u2014 which is the ledger\u2019s own rule and not a claim that the rate is stable; it is the least stable figure in the package',
    constant: true,
  },
  {
    state: 'OR',
    path: 'earnedIncomeCredit.matchRate',
    kind: 'statute-scheduled',
    document: 'SB 1507 (2026) \u2014',
    cite: 'ORS 315.266(1)(a) \u2014 9% of the federal credit for 2025 and 14% from 2026, raised by SB 1507 (2026) for tax years beginning on or after 1 January 2026. Scheduled rather than indexed: the figure moved because a bill moved it, and the two years this package covers sit on either side of it',
    constant: false,
  },
  {
    state: 'OR',
    path: 'earnedIncomeCredit.youngChildMatchRate',
    kind: 'statute-scheduled',
    document: 'SB 1507 (2026) \u2014',
    cite: 'ORS 315.266(1)(b) \u2014 12% of the federal credit for 2025 and 17% from 2026, for a taxpayer with a dependent under the age of three. Raised by the same section of SB 1507 as the base rate, and by the same five points',
    constant: false,
  },
  {
    state: 'OR',
    path: 'earnedIncomeCredit.youngChildMaxAge',
    kind: 'statute',
    document: 'ORS 315.266 \u2014',
    cite: 'ORS 315.266(1)(b) reads "under the age of three"; 2 is that age stored inclusively, which is the form a list of dependent ages is compared against',
    constant: true,
  },
  {
    state: 'OR',
    path: 'childCredit.amountByAge.*.maxAge',
    kind: 'statute',
    document: 'HB 3235 (2023) \u2014',
    cite: 'HB 3235 (2023) \u00a7 2 reaches a dependent "who has not attained six years of age"; 5 is that age stored inclusively',
    constant: true,
  },
  {
    state: 'OR',
    path: 'childCredit.maxChildren',
    kind: 'statute',
    document: 'HB 3235 (2023) \u2014',
    cite: 'HB 3235 (2023) \u00a7 2(1) caps the Oregon Kids Credit at five qualifying children. A count and not a ceiling in dollars, so a sixth child adds nothing and takes nothing away',
    constant: true,
  },
  {
    state: 'OR',
    path: 'childCredit.phaseOut.width',
    kind: 'statute',
    document: 'HB 3235 (2023) \u2014',
    cite: 'HB 3235 (2023) \u00a7 2 withdraws the WHOLE credit across $5,000 of Oregon adjusted gross income above the threshold. A width and not a rate, which is why the implied marginal rate is proportional to the family: 21% with one child under six and 105% with the statutory maximum of five, at which point the family is strictly worse off at the top of the band than the bottom. The $5,000 is not indexed and has not moved since 2023',
    constant: true,
  },
  {
    state: 'OR',
    path: 'childCredit.amountByAge.*.amount',
    years: [2025],
    kind: 'indexed',
    document: 'HB 3235 (2023) \u2014',
    cite: 'HB 3235 (2023) \u00a7 2 sets $1,000 and indexes it. $1,050 for 2025, from the Department of Revenue\u2019s Oregon Kids Credit guidance for tax year 2025',
    constant: true,
  },
  {
    state: 'OR',
    path: 'childCredit.amountByAge.*.amount',
    years: [2026],
    kind: 'carried-forward',
    document: 'HB 3235 (2023) \u2014',
    cite: 'HB 3235 (2023) \u00a7 2 sets $1,000 and indexes it: $1,000 for 2023 and 2024 and $1,050 for 2025. The 2026 figure is NOT PUBLISHED \u2014 the Department of Revenue issues its Oregon Kids Credit guidance for a year in the January after it \u2014 so 2025\u2019s is carried forward, which understates the credit rather than overstating it',
    constant: true,
    carriedForwardFrom: 2025,
  },
  {
    state: 'OR',
    path: 'childCredit.phaseOut.threshold.*',
    years: [2025],
    kind: 'indexed',
    document: 'HB 3235 (2023) \u2014',
    cite: 'HB 3235 (2023) \u00a7 2 \u2014 $26,550 of Oregon adjusted gross income for 2025, the same figure for every filing status, from the Department of Revenue\u2019s Oregon Kids Credit guidance for tax year 2025',
    constant: true,
  },
  {
    state: 'OR',
    path: 'childCredit.phaseOut.threshold.*',
    years: [2026],
    kind: 'carried-forward',
    document: 'HB 3235 (2023) \u2014',
    cite: 'HB 3235 (2023) \u00a7 2 \u2014 $25,000 for 2023, $25,750 for 2024 and $26,550 for 2025 of Oregon adjusted gross income, the same figure for every filing status, which is unusual enough to state: a single parent and a couple lose the credit at the same income. The 2026 figure is NOT PUBLISHED and 2025\u2019s is carried forward, which withdraws the credit EARLIER than the indexed figure would \u2014 so the error is against the filer',
    constant: true,
    carriedForwardFrom: 2025,
  },
  {
    state: 'OR',
    path: 'reducedBaseRetirementCredit.rate',
    kind: 'statute',
    document: 'ORS 316.157 \u2014',
    cite: 'ORS 316.157(1) \u2014 9% of the qualifying amount, unchanged since 2018 and below both of Oregon\u2019s top two rates, so even an unreduced credit does not exempt the pension it is computed on',
    constant: true,
  },
  {
    state: 'OR',
    path: 'reducedBaseRetirementCredit.base.*',
    kind: 'statute',
    document: 'ORS 316.157 \u2014',
    cite: 'ORS 316.157 \u2014 $7,500, doubled to $15,000 on a joint return, and NOT INDEXED SINCE 2018. That is the whole reason the credit is now arithmetically unreachable for an ordinary retiree: the base stood still and the Social Security benefit that cancels it dollar for dollar did not, and the average benefit is several times $7,500',
    constant: true,
  },
  {
    state: 'OR',
    path: 'reducedBaseRetirementCredit.householdIncomeThreshold.*',
    kind: 'statute',
    document: 'ORS 316.157 \u2014',
    cite: 'ORS 316.157 \u2014 $15,000, doubled to $30,000 on a joint return, above which the base falls dollar for dollar. Not indexed since 2018. Household income is federal AGI plus tax-exempt interest less the TAXABLE part of the Social Security benefit, while the reduction above reads the GROSS benefit \u2014 two definitions of one benefit on one worksheet',
    constant: true,
  },
  {
    state: 'OR',
    path: 'reducedBaseRetirementCredit.minimumAge',
    kind: 'statute',
    document: 'ORS 316.157 \u2014',
    cite: 'ORS 316.157 \u2014 62, reached by a schedule that raised it one year at a time from 58 in 1991 and stopped in 1999. The test is on the PERSON and reaches only the filer and the spouse',
    constant: true,
  },
  // CONNECTICUT — four staircases and one moving figure. Nothing in Connecticut
  // is indexed: the rate schedule has stood since the 2024 cut to the two
  // lowest rates, the exemption and the personal credit table since 2016 and
  // the recapture's middle and top tiers since 2015. The ONE figure that
  // differs between 2025 and 2026 is the IRA phase-in share, and it differs
  // because § 12-701(a)(20)(B) schedules it to. A new tax year costs
  // Connecticut no release at all — it costs one reading of that schedule,
  // which is what `statute-scheduled` means and why it is not `indexed`.
  // =========================================================================
  {
    state: 'CT',
    path: 'rate.byStatus.*.*.rate',
    kind: 'statute',
    document: '\u00a7 12-700 \u2014',
    cite: 'Conn. Gen. Stat. \u00a7 12-700(a)(10) \u2014 2%, 4.5%, 5.5%, 6%, 6.5%, 6.9% and 6.99%, the two lowest cut from 3% and 5% for tax years from 2024 and unchanged since',
    constant: true,
  },
  {
    state: 'CT',
    path: 'rate.byStatus.*.*.upTo',
    kind: 'statute',
    document: '\u00a7 12-700 \u2014',
    cite: 'Conn. Gen. Stat. \u00a7 12-700(a)(10) \u2014 the bracket ceilings as dollar amounts, every one of them the joint figure times one half (single and separate) or four fifths (head of household). Connecticut has no indexing provision',
    constant: true,
  },
  {
    state: 'CT',
    path: 'exemption.perFiler.*',
    kind: 'statute',
    document: '\u00a7 12-702 \u2014',
    cite: 'Conn. Gen. Stat. \u00a7 12-702(a)(1) \u2014 $15,000 single, $24,000 joint, $19,000 head of household, $12,000 separate, unchanged since 2016. These do NOT scale the way the rate schedule does: half of joint is $12,000, which is the separate figure, not the single one',
    constant: true,
  },
  {
    state: 'CT',
    path: 'exemption.perDependent',
    kind: 'statute',
    document: '\u00a7 12-702 \u2014',
    cite: 'Conn. Gen. Stat. \u00a7 12-702 grants no exemption for a dependant. The zero is the statute\u2019s answer rather than a figure nobody read',
    constant: true,
  },
  {
    state: 'CT',
    path: 'exemption.stepPhaseOut.*',
    kind: 'statute',
    document: '\u00a7 12-702 \u2014',
    cite: 'Conn. Gen. Stat. \u00a7 12-702(a)(1) \u2014 the exemption is reduced by $1,000 for each $1,000, or fraction thereof, of Connecticut AGI above $30,000 single / $48,000 joint / $38,000 head of household / $24,000 separate. Dollar for dollar, so the marginal rate inside the band is double the statutory one',
    constant: true,
  },
  {
    state: 'CT',
    path: 'exemption.stepPhaseOut.start.*',
    kind: 'statute',
    document: '\u00a7 12-702 \u2014',
    cite: 'Conn. Gen. Stat. \u00a7 12-702(a)(1) \u2014 the Connecticut AGI at which the withdrawal begins, by filing status; Form CT-1040 TCS Table A prints the resulting staircase',
    constant: true,
  },
  {
    state: 'CT',
    path: 'phaseOutAddBack.staircase.**',
    kind: 'statute',
    document: 'Tables A to E',
    cite: 'Form CT-1040 TCS Table C, under Conn. Gen. Stat. \u00a7 12-700(a)(10) \u2014 $25 per $5,000 or fraction thereof above $56,500 (single), to a maximum of $250. The head of household column steps by $4,000 and the separate one by $2,500, so the increments do not scale with the rate schedule either',
    constant: true,
  },
  {
    state: 'CT',
    path: 'steppedRecapture.tiers.*.**',
    kind: 'statute',
    document: 'Tables A to E',
    cite: 'Form CT-1040 TCS Table D, under Conn. Gen. Stat. \u00a7 12-700(b) \u2014 three tiers with flat stretches between them: $25 per $5,000 from $105,000, $90 per $5,000 from $200,000 and $50 per $5,000 from $500,000 for a single filer, maxima $250, $2,700 and $450, totalling $3,400. Unlike the exemption and the add-back thresholds, the recapture scales \u2014 single and separate half the joint figures, head of household four fifths \u2014 with ONE exception: the middle tier charges a head of household $140 per $8,000 to a maximum of $4,200, where four fifths would be $144 and $4,320',
    constant: true,
  },
  {
    state: 'CT',
    path: 'personalTaxCredit.steps.*.*.fraction',
    kind: 'statute',
    document: '\u00a7 12-703 \u2014',
    cite: 'Conn. Gen. Stat. \u00a7 12-703(a) \u2014 the decimal credit, 75% falling to 1% over 27 steps, applied to the tax AFTER the add-back and the recapture',
    constant: true,
  },
  {
    state: 'CT',
    path: 'personalTaxCredit.steps.*.*.from',
    kind: 'statute',
    document: '\u00a7 12-703 \u2014',
    cite: 'Conn. Gen. Stat. \u00a7 12-703(a) \u2014 the Connecticut AGI each step begins above. The rows read "over $15,000 but not over $18,800", so the boundary belongs to the step BELOW it \u2014 the opposite convention from the pension phase-out on the same return',
    constant: true,
  },
  {
    state: 'CT',
    path: 'socialSecurityBenefitAdjustment.fullSubtractionBelow.*',
    kind: 'statute',
    document: '\u00a7 12-701 \u2014',
    cite: 'Conn. Gen. Stat. \u00a7 12-701(a)(20)(B)(x) \u2014 federal AGI below $75,000, or $100,000 on a joint return or for a qualifying surviving spouse, subtracts the whole federally taxable benefit. A cliff, not a taper, and the largest one Connecticut has',
    constant: true,
  },
  {
    state: 'CT',
    path: 'socialSecurityBenefitAdjustment.rate',
    kind: 'statute',
    document: '\u00a7 12-701 \u2014',
    cite: 'Conn. Gen. Stat. \u00a7 12-701(a)(20)(B)(x) \u2014 above the threshold Connecticut charges 25% of the lesser of gross benefits and the \u00a7 86 combined income excess, so Connecticut taxable benefits can never exceed 25% of the gross',
    constant: true,
  },
  {
    state: 'CT',
    path: 'socialSecurityBenefitAdjustment.combinedIncomeBase.*',
    kind: 'federal-conformity',
    document: '\u00a7 12-701 \u2014',
    cite: 'IRC \u00a7 86(c)(1) base amounts, adopted by reference through the Connecticut Social Security Benefit Adjustment Worksheet: $25,000, or $32,000 on a joint return. A separate filer who lived with their spouse has a federal base of zero, which this package does not ask about',
    constant: true,
  },
  {
    state: 'CT',
    path: 'retirementSubtractionSchedule.schedule.*.*.fraction',
    kind: 'statute',
    document: 'Public Act 23-204',
    cite: 'Public Act 23-204 \u00a7 93 \u2014 100% below the threshold, then 85%, 70%, 55%, 40%, 25%, 10%, 5%, 2.5% and nothing, replacing a cliff at the same threshold for tax years from 2024',
    constant: true,
  },
  {
    state: 'CT',
    path: 'retirementSubtractionSchedule.schedule.*.*.from',
    kind: 'statute',
    document: 'Public Act 23-204',
    cite: 'Public Act 23-204 \u00a7 93 \u2014 the federal AGI each step begins at: $75,000 to $100,000 in $2,500 steps for a non-joint filer, $100,000 to $150,000 in steps of $5,000 and then $10,000 for a joint one. The bands read "at least X but less than Y", so the boundary belongs to the step ABOVE it',
    constant: true,
  },
  {
    state: 'CT',
    path: 'retirementSubtractionSchedule.iraPhaseInShare',
    kind: 'statute-scheduled',
    document: 'OLR Report 2025-R-0152',
    cite: 'Conn. Gen. Stat. \u00a7 12-701(a)(20)(B)(xxvii)-(xxx) \u2014 25% for 2023, 50% for 2024, 75% for 2025 and 100% from 2026. The only Connecticut figure that differs between the two years this package covers, and the reason 2026 is the first year a Connecticut retiree\u2019s IRA and pension are treated alike',
    constant: false,
  },
  {
    state: 'CT',
    path: 'earnedIncomeCreditChildBonus.amount',
    kind: 'statute-scheduled',
    document: '\u00a7 12-704e \u2014',
    cite: 'Conn. Gen. Stat. \u00a7 12-704e as amended for tax years from 2025 \u2014 a flat $250 on top of the 40% match for a filer eligible for the credit with at least one qualifying child, once per return. CT-1040 line 20a and Schedule CT-EITC; the DRS 2025 income tax developments page announces it',
    constant: true,
    why: 'new for tax year 2025, so it is the same in both years this package covers and will not move again without an amendment \u2014 but it is scheduled rather than statutory in the sense that 2024 did not have it, and a run adding tax year 2024 must not carry it back',
  },
  {
    state: 'CT',
    path: 'earnedIncomeCreditChildBonus.maxChildAge',
    kind: 'federal-conformity',
    document: '\u00a7 12-704e \u2014',
    cite: 'IRC \u00a7 152(c)(3), adopted by reference: a qualifying child for federal purposes. The 18 here is the age limb alone \u2014 the student and permanent-disability limbs need facts this package is not given, and the notes say the figure is understated by $250 for a household that qualifies only under those',
    constant: true,
  },
  {
    state: 'CT',
    path: 'earnedIncomeCredit.matchRate',
    kind: 'statute',
    document: '\u00a7 12-704e \u2014',
    cite: 'Conn. Gen. Stat. \u00a7 12-704e \u2014 40% of the federal credit, refundable, raised from 30.5% for tax years from 2023',
    constant: true,
  },

  // =========================================================================
  // NEW JERSEY — the state at the far end of the range this file exists to
  // express. 128 figures, 122 identical across the two years, nothing indexed,
  // nothing carried forward: the rate schedules have stood since 2020, the
  // exemptions since 1994 and the retirement exclusion maxima since 2020. A
  // new tax year costs New Jersey no release at all.
  // =========================================================================
  {
    state: 'NJ',
    path: 'rate.byStatus.*.*.rate',
    kind: 'statute',
    document: '54A:2-1',
    cite: 'N.J.S.A. 54A:2-1 — Schedule I and Schedule II, unchanged since the 10.75% band was added in 2020. Schedule II has a 2.45% band Schedule I does not, so the two schedules have different numbers of brackets',
    constant: true,
  },
  {
    state: 'NJ',
    path: 'rate.byStatus.*.*.upTo',
    kind: 'statute',
    document: '54A:2-1',
    cite: 'N.J.S.A. 54A:2-1 — the bracket ceilings as dollar amounts; New Jersey has no indexing provision. A head of household takes the JOINT schedule, which almost no other state does',
    constant: true,
  },
  {
    state: 'NJ',
    path: 'exemption.**',
    kind: 'statute',
    document: '54A:3-1',
    cite: 'N.J.S.A. 54A:3-1 — $1,000 per filer, $1,500 per dependent, $1,000 for a college dependent, $1,000 at 65 and $1,000 for blindness, unchanged since 1994. A qualifying surviving spouse gets ONE $1,000, not two',
    constant: true,
  },
  {
    state: 'NJ',
    path: 'zeroTaxThreshold.threshold.*',
    kind: 'statute',
    document: '54A:8-3.1',
    cite: 'N.J.S.A. 54A:8-3.1 — the gross income filing threshold, $10,000 single and separate and $20,000 otherwise. It is a cliff: one dollar above it the whole first bracket applies at once',
    constant: true,
  },
  {
    state: 'NJ',
    path: 'retirementExclusion.**',
    kind: 'statute',
    document: '54A:6-10',
    cite: 'N.J.S.A. 54A:6-10 — $100,000 joint / $75,000 single / $50,000 separate, unchanged since 2020, with the tier wall at $100,000, $125,000 and $150,000 of TOTAL income. A qualifying surviving spouse takes the SINGLE maximum while filing on the joint rate schedule',
    constant: true,
  },
  {
    state: 'NJ',
    path: 'propertyTaxRelief.**',
    kind: 'statute',
    document: '54A:3A-16',
    cite: 'N.J.S.A. 54A:3A-16 to 54A:3A-20 — a deduction of up to $15,000 of property tax or a $50 credit, whichever leaves the filer better off, with 18% of rent treated as property tax',
    constant: true,
  },
  {
    state: 'NJ',
    path: 'earnedIncomeCredit.matchRate',
    kind: 'statute',
    document: '54A:4-7',
    cite: 'N.J.S.A. 54A:4-7 — 40% of the federal credit, refundable; the joint largest state match in the country alongside Massachusetts\'s',
    constant: true,
  },
  {
    state: 'NJ',
    path: 'steppedChildCredit.steps.*.amount',
    kind: 'statute-scheduled',
    document: 'P.L. 2026, c.26',
    cite: 'P.L. 2026, c.26 (S-4531) — every amount raised by exactly 25% for tax years 2026 through 2028, reverting in 2029, so the 2026 column is the 2025 one times 1.25',
    constant: false,
  },
  {
    state: 'NJ',
    path: 'steppedChildCredit.**',
    kind: 'statute',
    document: '54A:4-17',
    cite: 'N.J.S.A. 54A:4-17 — a staircase on New Jersey taxable income for a child under 6, in $10,000 steps that are NOT halved for a separate filer, who gets nothing at all',
    constant: true,
  },

  // =========================================================================
  // NEW YORK — 204 figures, 177 identical, and its own notes already said why:
  // "New York does not index its brackets, standard deduction or dependent
  // exemption. All three are fixed in statute." What moved is the RATES, which
  // the FY2026 budget cut, and that is why the rates and the ceilings they
  // apply to cannot share an entry.
  // =========================================================================
  {
    state: 'NY',
    path: 'rate.byStatus.*.*.rate',
    kind: 'statute-scheduled',
    document: 'New York FY2026 Enacted Budget, S.3009-C',
    cite: 'the FY2026 enacted budget cut the bottom five rates for 2026 and cuts them again for 2027; the top four are unchanged, so the recapture owed by high earners RISES in 2026 — there is more graduated-rate benefit below the top bracket to claw back',
    constant: false,
  },
  {
    state: 'NY',
    path: 'rate.byStatus.*.*.upTo',
    kind: 'statute',
    document: '§ 601',
    cite: 'N.Y. Tax Law § 601 — the bracket ceilings as dollar amounts; New York does not index them. Married filing separately uses the SINGLE schedule unchanged, so a separate return climbs the recapture ladder on its own income',
    constant: true,
  },
  {
    state: 'NY',
    path: 'deduction.amounts.*',
    kind: 'statute',
    document: '§ 614',
    cite: 'N.Y. Tax Law § 614 — the standard deduction, fixed in statute and not indexed',
    constant: true,
  },
  {
    state: 'NY',
    path: 'exemption.**',
    kind: 'statute',
    document: '§ 616',
    cite: 'N.Y. Tax Law § 616(a) — the $1,000 exemption is for DEPENDENTS only; New York allows none for the filer or the spouse in any status, and the IT-201 has no personal exemption line',
    constant: true,
  },
  {
    state: 'NY',
    path: 'recapture.*',
    kind: 'statute',
    document: '§ 601',
    cite: 'N.Y. Tax Law § 601(d) — the tax table benefit recapture begins at $107,650 of New York AGI and phases in over $50,000. Walking the rate schedule alone understates a $300,000 single filer by $2,399',
    constant: true,
  },
  {
    state: 'NY',
    path: 'retirementIncomeSubtractions.*.*',
    kind: 'statute',
    document: '§ 612(c)(3)',
    cite: 'N.Y. Tax Law § 612(c)(3-a) — $20,000 per person at 59½, the federal § 72(t) age the IT-201 line 29 instructions use. § 612(c)(3)(i) and (ii) exempt a federal, New York State or New York local government pension IN FULL at any age, over and above it',
    constant: true,
  },
  {
    state: 'NY',
    path: 'householdCredit.**',
    kind: 'statute',
    document: '§ 606(b)',
    cite: 'N.Y. Tax Law § 606(b), Tables 1 and 2 — the household credit. The per-person addition falls at $20,000 where the base amount holds to $22,000, which is why Table 2 has eight income rows and not seven',
    constant: true,
  },
  {
    state: 'NY',
    path: 'childCredit.amountByAge.*.amount',
    kind: 'statute-scheduled',
    document: '§ 606(c-1)',
    cite: 'S.3009-C, Part C, § 2, adding N.Y. Tax Law § 606(c-1)(1-A) — $1,000 for each child under 4 in both years, and $330 for 2025 against $500 for 2026 for a child aged 4 to 16',
    constant: false,
  },
  {
    state: 'NY',
    path: 'childCredit.amountByAge.*.maxAge',
    kind: 'statute',
    document: '§ 606(c-1)',
    cite: 'N.Y. Tax Law § 606(c-1)(1-A) — the bands are matched in order, so a child of exactly 4 gets the older-child amount and a 17-year-old gets nothing',
    constant: true,
  },
  {
    state: 'NY',
    path: 'childCredit.phaseOut.**',
    kind: 'statute',
    document: '§ 606(c-1)',
    cite: 'N.Y. Tax Law § 606(c-1) — $16.50 per $1,000 of AGI "or fraction thereof" above the threshold, applied to the WHOLE credit rather than to each child\'s share. That $16.50 is exactly one third of the federal § 24 phase-out, because the credit was 33% of the federal one until 2024',
    constant: true,
  },
  {
    state: 'NY',
    path: 'earnedIncomeCredit.matchRate',
    kind: 'statute',
    document: '§ 606(d)',
    cite: 'N.Y. Tax Law § 606(d)(1) — 30% of the federal credit LESS the New York household credit; the two are not additive. Refundable',
    constant: true,
  },

  // =========================================================================
  // OHIO — a discontinuous rate schedule whose constants HB 96 moved, and an
  // exemption chart whose THRESHOLDS are statutory while its AMOUNTS are
  // indexed off 2015 bases. Reading § 5747.025(A) for the current chart gives
  // the floor from 2015, which is the trap the ledger has to name.
  // =========================================================================
  {
    state: 'OH',
    path: 'rate.bands.*.rate',
    kind: 'statute-scheduled',
    document: '§ 5747.02 —',
    cite: 'O.R.C. § 5747.02(A)(3) — 0% to $26,050 and 2.75% above it, plus a third band at 3.125% over $100,000 that applies to 2025 only; Am. Sub. H.B. 96 made the schedule flat above the zero band from 2026',
    constant: true,
    why:
      'The two rates that exist in both years did not move. The 2026 change was the REMOVAL of ' +
      'the third band, which is a figure that stops existing rather than one that moves, so a ' +
      'constancy check over the surviving paths correctly finds nothing.',
  },
  {
    state: 'OH',
    path: 'rate.bands.*.base',
    kind: 'statute-scheduled',
    document: '§ 5747.02 —',
    cite: 'O.R.C. § 5747.02(A)(3) charges a flat constant the moment taxable nonbusiness income clears the zero band — $342.00 for 2025 and $332.00 from 2026 — so a filer at $26,050 owes nothing and one at $26,050.01 owes the whole constant. HB 96 lowered this one and left the $100,000 constant at $2,394.32, which is what $360.69 chained to, so crossing $100,000 in 2025 costs a further $18.69 on one cent',
    constant: false,
  },
  {
    state: 'OH',
    path: 'rate.bands.*.upTo',
    kind: 'statute',
    document: '§ 5747.02 —',
    cite: 'O.R.C. § 5747.02(A)(3) — the $26,050 zero band, written into the statute by HB 96 and confirmed in force for 2026, and the $100,000 step that applies to 2025 only',
    constant: true,
  },
  {
    state: 'OH',
    path: 'exemption.perExemptionSteps.*.*.upTo',
    kind: 'statute-scheduled',
    document: '§ 5747.025',
    cite: 'O.R.C. § 5747.025(A) — steps at $40,000 and $80,000 of Ohio MODIFIED adjusted gross income, and the cliff HB 96 added: $750,000 for 2025 and $500,000 for 2026. The band ends one CENT short because the statute reads "or more"',
    constant: false,
  },
  {
    state: 'OH',
    path: 'exemption.perExemptionSteps.*.3.amount',
    kind: 'statute',
    document: 'H.B. 96',
    cite: 'Am. Sub. H.B. 96 — zero above the cliff. This is not an indexed amount and is correctly NOT flagged provisional, which is what keeps the fix to the other three from being "flag everything"',
    constant: true,
  },
  {
    state: 'OH',
    path: 'exemption.perExemptionSteps.*.*.amount',
    years: [2025],
    kind: 'indexed',
    document: '§ 5747.025',
    cite: 'O.R.C. § 5747.025(B) indexes statutory bases of $2,350 / $2,100 / $1,850 by the GDP deflator, and the IT 1040 instruction booklet carries the result: $2,400 / $2,150 / $1,900. Take care reading the statute — § 5747.025(A) prints the BASE amounts, which are LOWER than the figures in force, so a source quoting the Revised Code as the current chart is quoting a floor from 2015',
    constant: true,
  },
  {
    state: 'OH',
    path: 'exemption.perExemptionSteps.*.*.amount',
    years: [2026],
    kind: 'carried-forward',
    document: '§ 5747.025',
    cite: 'the 2025 indexed amounts, carried forward in all five columns. Ohio\'s exemption does not vary by filing status, so every column is the same carry-forward — which is why flagging only the `single` column reported three of fifteen',
    constant: true,
    carriedForwardFrom: 2025,
    resolvedBy:
      'the 2026 Ohio IT 1040 instruction booklet, published January 2027 — NOT R.C. 5747.025(A), which prints the 2015 base amounts rather than the indexed ones in force',
  },
  {
    state: 'OH',
    path: 'exemption.perFiler.*',
    kind: 'derived',
    cite: 'the top step of `perExemptionSteps` times `filersClaimed`, stored so `registry.test.js` can check it against the chart that generates it. The engine reads the chart, and this copy read `qualifyingSurvivingSpouse: 4_800` for 33 days on the strength of a comment claiming a test that did not exist. For 2026 it inherits the chart\'s carry-forward',
    constant: true,
  },
  {
    state: 'OH',
    path: 'exemption.perDependent',
    kind: 'derived',
    cite: 'the top step of the same chart, for the same reason and with the same 2026 carry-forward behind it',
    constant: true,
  },
  {
    state: 'OH',
    path: 'exemption.filersClaimed.*',
    kind: 'statute',
    document: '§ 5747.025',
    cite: 'O.R.C. § 5747.025 — a count of people, not an amount. A widow files the IT 1040 alone and claims ONE exemption',
    constant: true,
  },
  {
    state: 'OH',
    path: 'exemptionCredit.**',
    kind: 'statute',
    document: '§ 5747.022',
    cite: 'O.R.C. § 5747.022 — $20 per exemption below $30,000 of modified AGI. It needs modified AGI above $28,450 and below $30,000, a window $1,550 wide that a second exemption closes',
    constant: true,
  },
  {
    state: 'OH',
    path: 'jointFilingCredit.incomeLimit',
    kind: 'statute-scheduled',
    document: 'H.B. 96',
    cite: 'Am. Sub. H.B. 96 — the credit is cut off above $750,000 of modified AGI for 2025 and $500,000 from 2026, the same cliff the exemption chart gained',
    constant: false,
  },
  {
    state: 'OH',
    path: 'jointFilingCredit.**',
    kind: 'statute',
    document: '§ 5747.05 —',
    cite: 'O.R.C. § 5747.05(E)(1) — 20% / 15% / 10% / 5% of the tax after every other non-refundable credit, capped at $650, and allowed only where EACH spouse has at least $500 of qualifying income. The 20% row is unreachable: it needs modified AGI less exemptions at or below $25,000, which is below the zero band',
    constant: true,
  },
  {
    state: 'OH',
    path: 'seniorCredit.**',
    kind: 'statute',
    document: '§ 5747.05 —',
    cite: 'O.R.C. § 5747.05(B) — the senior citizen credit, a fixed dollar amount with an income limit and no indexing provision',
    constant: true,
  },
  {
    state: 'OH',
    path: 'retirementIncomeCredit.**',
    kind: 'statute',
    document: '§ 5747.055',
    cite: 'O.R.C. § 5747.055(B) Table 2 — six steps of retirement income to a maximum credit of $200, gone above $100,000 of modified AGI less exemptions. Fixed amounts since the credit was written',
    constant: true,
  },
  {
    state: 'OH',
    path: 'businessIncome.**',
    kind: 'statute',
    document: '§ 5747.02 —',
    cite: 'O.R.C. § 5747.01(A)(31) deducts the first $250,000 ($125,000 married filing separately) of Ohio business income and § 5747.02(A)(4) taxes the excess at a flat 3% — so a filer with $250,000 of business income owes no Ohio income tax where a wage earner on the same income owes $7,022.45',
    constant: true,
  },
  {
    state: 'OH',
    path: 'earnedIncomeCredit.matchRate',
    kind: 'statute',
    document: '§ 5747.71',
    cite: 'O.R.C. § 5747.71 — 30% of the federal credit and NON-REFUNDABLE, which is the whole of what is wrong with quoting the 30%: every filer with the credit\'s own income already has no Ohio tax for it to offset',
    constant: true,
  },

  // =========================================================================
  // PENNSYLVANIA — five figures, none of them indexed, the rate unchanged
  // since 2004 and the forgiveness table since 2003.
  // =========================================================================
  {
    state: 'PA',
    path: 'rate.rate',
    kind: 'statute',
    document: '§ 7302',
    cite: '72 Pa. Stat. § 7302 — 3.07%, unchanged since 2004',
    constant: true,
  },
  {
    state: 'PA',
    path: 'forgiveness.**',
    kind: 'statute',
    document: '§ 7304',
    cite: '72 Pa. Stat. § 7304 and PA-40 Schedule SP — a $6,500 allowance plus $9,500 per dependent, then ten percentage points less of the WHOLE tax for each $250 of eligibility income above it. Unchanged since 2003, which is why a single parent of two faces about 34% across the band against a statutory 3.07%',
    constant: true,
  },

  // =========================================================================
  // UTAH — six indexed figures in the Taxpayer Tax Credit and nothing else.
  // Utah's own 2026 note already drew the line this ledger now enforces: the
  // retirement-credit figures "are NOT provisional and are not carried forward
  // for the same reason — set in statute with no indexing mechanism, so 2026
  // equals 2025 because the law says so and not because this package guessed."
  // =========================================================================
  {
    state: 'UT',
    path: 'rate.rate',
    kind: 'statute-scheduled',
    document: 'Utah SB 60 (2026)',
    cite: 'Utah Code § 59-10-104 as reduced by HB 106 (2025) to 4.5% for 2025 and by SB 60 (2026) to 4.45%',
    constant: false,
  },
  {
    state: 'UT',
    path: 'taxpayerCredit.rate',
    kind: 'statute',
    document: '§ 59-10-1018',
    cite: 'Utah Code § 59-10-1018 — 6% of the sum of the federal deduction and the personal exemptions, which is why the federal deduction is worth 6 cents on the dollar in Utah rather than the full marginal rate',
    constant: true,
  },
  {
    state: 'UT',
    path: 'taxpayerCredit.phaseOutRate',
    kind: 'statute',
    document: '§ 59-10-1018',
    cite: 'Utah Code § 59-10-1018(2)(c) — the credit is reduced by 1.3 cents per dollar of state taxable income above the threshold',
    constant: true,
  },
  {
    state: 'UT',
    path: 'taxpayerCredit.*',
    years: [2025],
    kind: 'indexed',
    document: 'Form TC-40 instructions',
    cite: 'Utah Code § 59-10-1018(1)(f) and (2)(b) — the per-dependent exemption amount and the phase-out thresholds, indexed annually and published with the TC-40 instructions',
    constant: true,
  },
  {
    state: 'UT',
    path: 'taxpayerCredit.*',
    years: [2026],
    kind: 'carried-forward',
    document: 'Form TC-40 instructions',
    cite: 'the published 2025 amounts, carried forward. This one cannot be resolved by searching during 2026: Utah publishes the indexed result with the TC-40 instructions in January AFTER the tax year, so the 2026 figures do not yet exist',
    constant: true,
    carriedForwardFrom: 2025,
    resolvedBy: 'the 2026 Utah TC-40 instructions, published by the Tax Commission in January 2027',
  },
  {
    state: 'UT',
    path: 'taxpayerCredit.phaseOutThreshold.*',
    years: [2025],
    kind: 'indexed',
    document: 'Form TC-40 instructions',
    cite: 'Utah Code § 59-10-1018(2)(b) — the phase-out thresholds, indexed annually and published with the TC-40 instructions',
    constant: true,
  },
  {
    state: 'UT',
    path: 'taxpayerCredit.phaseOutThreshold.*',
    years: [2026],
    kind: 'carried-forward',
    document: 'Form TC-40 instructions',
    cite: 'the published 2025 thresholds, carried forward for the same reason as the exemption amount above',
    constant: true,
    carriedForwardFrom: 2025,
    resolvedBy: 'the 2026 Utah TC-40 instructions, published by the Tax Commission in January 2027',
  },
  {
    state: 'UT',
    path: 'exclusiveRetirementCredits.retirement.**',
    kind: 'statute',
    document: '§ 59-10-1019',
    cite: 'Utah Code § 59-10-1019 — $450 a head, a closed birth cohort at 31 December 1952, and thresholds of $25,000 / $32,000 / $16,000 that have not moved since the credit was written. No indexing mechanism, so 2026 equals 2025 by law',
    constant: true,
  },
  {
    state: 'UT',
    path: 'exclusiveRetirementCredits.socialSecurity.**',
    kind: 'statute',
    document: '§ 59-10-1042',
    cite: 'Utah Code § 59-10-1042 — the state\'s own rate applied to the taxable part of the benefit, withdrawn at 2.5 cents on the dollar above $54,000 / $90,000 / $45,000. SB 71 (2025) raised those thresholds 20% from $45,000 / $75,000 / $37,500 and they are NOT indexed',
    constant: true,
  },
  {
    state: 'UT',
    path: 'childCredit.phaseOut.threshold.*',
    kind: 'statute-scheduled',
    document: 'Utah HB 290 (2026)',
    cite: 'Utah HB 290 (2026), Child Tax Credit Amendments — the thresholds raised from $43,000 / $54,000 / $27,000 to $49,000 / $61,000 / $30,500. Withdrawn against TC-40 line 9 plus tax-exempt interest, a different income figure from the one the retirement credits use on the same return',
    constant: false,
  },
  {
    state: 'UT',
    path: 'childCredit.**',
    kind: 'statute',
    document: '§ 59-10-1047',
    cite: 'Utah Code § 59-10-1047 — $1,000 per child under 6, reduced by "$.10 for each $1" with no step, and non-refundable because § 59-10-1047 sits in the Nonrefundable Tax Credit Act. HB 106 (2025) widened it from the 1-to-3 band that excluded a newborn',
    constant: true,
  },
  {
    state: 'UT',
    path: 'earnedIncomeCredit.matchRate',
    kind: 'statute',
    document: 'Form TC-40 instructions',
    cite: 'Utah Code § 59-10-1044 — 20% of the federal credit and NON-REFUNDABLE, the only state credit in this package that is a share of the federal one and cannot be paid out',
    constant: true,
  },

  // =========================================================================
  // VIRGINIA — a 1990 rate schedule, a $930 personal exemption unchanged since
  // 2008, and a standard deduction fixed year by year by the Appropriation Act
  // rather than by the Code. Nothing here is indexed and nothing is carried
  // forward, which is why 78 identical figures are a fact rather than a gap.
  // =========================================================================
  {
    state: 'VA',
    path: 'rate.byStatus.*.*.*',
    kind: 'statute',
    document: '§ 58.1-320',
    cite: 'Va. Code § 58.1-320 — the rate schedule, unchanged since 1990. One schedule for every filing status: Virginia has no separate joint, head-of-household or surviving-spouse table',
    constant: true,
  },
  {
    state: 'VA',
    path: 'deduction.amounts.*',
    kind: 'statute-scheduled',
    document: 'House Bill 1600 (2025 Appropriation Act)',
    cite: 'House Bill 1600 (2025 Appropriation Act), Item 4-14 — $8,750 / $17,500 for 2025 and 2026. The amounts are TEMPORARY and revert by their own terms to the $3,000 / $6,000 written in § 58.1-322.03(1)(b); the Appropriation Act has moved the reversion date at every budget since 2022',
    constant: true,
    why:
      'Fixed for both years by the same Appropriation Act item rather than indexed, so it did not ' +
      'move and nothing is waiting on a release. A year beyond 2026 should be treated as unknown ' +
      'rather than as a continuation, because the reversion is in the Code and the extension is not.',
  },
  {
    state: 'VA',
    path: 'exemption.**',
    kind: 'statute',
    document: '§ 58.1-322.03',
    cite: 'Va. Code § 58.1-322.03(1) — $930 for each personal exemption allowable federally, unchanged since 2008, and § 58.1-322.03(2)(b)\'s $800 for each blind or aged taxpayer "as defined under § 63(f) of the Internal Revenue Code", unchanged for longer. A qualifying surviving spouse takes the SINGLE figure, because Form 760 sends one to Filing Status 1',
    constant: true,
  },
  {
    state: 'VA',
    path: 'ageDeduction.**',
    kind: 'statute',
    document: '§ 58.1-322.03',
    cite: 'Va. Code § 58.1-322.03(5) — $12,000 at 65, reduced dollar for dollar above $50,000 / $75,000 of adjusted federal AGI, and allowed in full to a filer born before 1 January 1939. A separate filer gets the JOINT threshold measured on the COMBINED income of both spouses, which is the one line of Form 760 where a separate return reads the other return\'s income',
    constant: true,
  },
  {
    state: 'VA',
    path: 'itemizedDeduction.phaseOutRate',
    kind: 'sentinel',
    cite: 'zero, because the § 58.1-322.03(1)(a)(2) reduction of itemized deductions is not modelled — the threshold beside it is Infinity for the same reason, and the notes price the gap',
    constant: true,
  },
  {
    state: 'VA',
    path: 'spouseTaxAdjustment.*',
    kind: 'statute',
    document: 'spouse tax adjustment',
    cite: 'Va. Code § 58.1-324 — the spouse tax adjustment, up to $259, computed by halving the couple\'s joint tax base; Virginia Tax publishes the cap',
    constant: true,
  },
  {
    state: 'VA',
    path: 'zeroTaxThreshold.threshold.*',
    kind: 'statute',
    document: '§ 58.1-321',
    cite: 'Va. Code § 58.1-321 — the filing threshold, $11,950 / $23,900. For a single filer it never binds, because the Credit for Low Income Individuals zeroes the tax up to the federal poverty guideline, which is higher',
    constant: true,
  },
  {
    state: 'VA',
    path: 'earnedIncomeCredit.matchRate',
    kind: 'statute-scheduled',
    document: 'refundable earned income tax credit',
    cite: 'Va. Code § 58.1-339.8.B.2 sets a non-refundable 20%, and the refundable 20% is set for tax years 2025 and 2026 by the Appropriation Act rather than by the Code — raised from 15%, which leaves the non-refundable option dominated at every income and never the right election',
    constant: true,
    why:
      'Scheduled by the Appropriation Act for 2025 and 2026 together, so the two years agree by ' +
      'the same act rather than by indexing or by a carry-forward.',
  },
  {
    state: 'VA',
    path: 'lowIncomeCredit.perExemption',
    kind: 'statute',
    document: '§ 58.1-339.8',
    cite: 'Va. Code § 58.1-339.8 — $300 per exemption, capped at the Virginia tax, and an ALTERNATIVE to the earned income match rather than an addition to it',
    constant: true,
  },
  {
    state: 'VA',
    path: 'lowIncomeCredit.povertyGuideline.*',
    kind: 'agency',
    document: 'HHS poverty guidelines',
    cite: 'the HHS poverty guidelines, republished every January — the cliff the Credit for Low Income Individuals sits on, and the figure that decides whether Virginia\'s real floor is the statutory threshold or this one',
    constant: false,
  },

  // =========================================================================
  // WISCONSIN — Day 43. The first state-year in this ledger where a figure
  // nobody published is nonetheless KNOWN, which is why `derived-bounded`
  // exists.
  //
  // Wisconsin publishes its rate schedules a year early (the 2026 Form 1-ES
  // instructions, December 2025) and its Standard Deduction Table a year late
  // (the 2026 Form 1 instructions, January 2027). The top bracket threshold is
  // indexed off a statutory base of $225,000 / $300,000 / $150,000 set by 2013
  // Act 20, so a published threshold BOUNDS the cumulative indexation factor —
  // to 7.5 parts per million for 2026, across three statuses. That bound
  // determines four of the seven figures of the unpublished 2026 standard
  // deduction schedule outright, and narrows the other three to two adjacent
  // multiples of $10 each. `test/wisconsin-indexation.test.js` does the
  // arithmetic and validates the method by hold-out: bases derived from
  // 2021-2024 alone put all seven published 2025 figures inside their
  // admissible sets.
  //
  // So the 2025 schedule is `indexed` and READ; the 2026 schedule is `derived`
  // where the arithmetic settles it and `derived-bounded` where it does not,
  // which is a sharper statement than either `indexed` or `carried-forward`
  // could make.
  // =========================================================================
  {
    state: 'WI',
    path: 'year',
    kind: 'sentinel',
    cite: 'The tax year the definition answers for, not a figure read from anywhere',
    constant: false,
  },
  {
    state: 'WI',
    path: 'rate.byStatus.*.*.rate',
    kind: 'statute',
    document: '§ 71.06 —',
    cite: 'Wis. Stat. § 71.06 — 3.5%, 4.4%, 5.3% and 7.65%. The first two were cut from 3.54% and 4.65% by 2023 Act 19 for tax years beginning on or after 1 January 2023 and none of the four has moved since. Note that Wisconsin’s WITHHOLDING tables (Publication W-166) still carry the pre-2023 3.54% and 4.65%, which is why a withholding formula is NOT the primary source for Wisconsin the way it is for Oregon',
    constant: true,
  },
  {
    state: 'WI',
    path: 'rate.byStatus.*.0.upTo',
    kind: 'indexed',
    document: '2026 Form 1-ES instructions',
    cite: 'Wis. Stat. § 71.06 indexes every bracket boundary off the statutory base amounts, rounded to the nearest $10 — section level, because § 71.06(2e) is written for 2010 through 2024 and 2025 Act 118 repealed several neighbouring subsections, so the subsection in force for 2026 is not one this package has read. The top of the 3.5% band is $14,680 single and head of household, $19,580 joint and $9,790 separate for 2025 (2025 Form 1 instructions, rate schedules) and $15,110, $20,150 and $10,080 for 2026 (2026 Form 1-ES instructions, published December 2025 — the only document carrying the 2026 schedules until the 2026 Form 1 instructions appear in January 2027)',
    constant: false,
  },
  {
    state: 'WI',
    path: 'rate.byStatus.*.1.upTo',
    kind: 'indexed',
    document: '2025 Wisconsin Act 15',
    cite: 'THE ONE FIGURE HERE A WIDELY USED REFERENCE MODEL GETS WRONG. 2025 Act 15 raised the top of the 4.4% band to $50,480 single and head of household, $67,300 joint and $33,650 separate, retroactive to 1 January 2025; § 71.06\'s bracket indexing resumes for 2026 and produces $51,950, $69,260 and $34,630, which is what the 2026 Form 1-ES instructions carry. The arithmetic is what settles 2025 rather than the citation alone: $50,480 times the factor the published 2026 figures pin rounds to $51,950 to the dollar, and all three statuses agree. PolicyEngine-US 2.15.3 carries $51,130 / $68,170 / $34,090 for 2025 — the Act 15 figures indexed a year early — which cannot reach the 2026 figures the same model also carries: $51,130 indexed is $52,620',
    constant: false,
  },
  {
    state: 'WI',
    path: 'rate.byStatus.*.2.upTo',
    kind: 'indexed',
    document: '2026 Form 1-ES instructions',
    cite: 'Wis. Stat. § 71.06 — the 7.65% rate begins at $323,290 single and head of household, $431,060 joint and $215,530 separate for 2025, and $332,720, $443,630 and $221,820 for 2026. These three are the figures the rest of this state-year is measured against: their statutory bases are $225,000, $300,000 and $150,000, VERIFIED ARITHMETICALLY rather than read in a subsection — 266,930/225,000, 355,910/300,000 and 177,960/150,000 agree to six figures, across three statuses and five years. 2013 Act 20 is the act that took Wisconsin from five brackets to four and is the likely source of the three figures, on one source rather than two, which is why the arithmetic is what this entry rests on, so a published value divided by its base IS the cumulative indexation factor to within $5/base — which is what makes the unpublished 2026 standard deduction schedule derivable',
    constant: false,
  },
  {
    state: 'WI',
    path: 'deduction.maximum.*',
    kind: 'indexed',
    document: '2025 Form 1 instructions',
    years: [2025],
    cite: 'Wis. Stat. § 71.05(22)(dp) and the Standard Deduction Table in the 2025 Form 1 instructions — $13,560 single, $25,110 joint and surviving spouse, $11,930 separate and $17,520 head of household. Read; the 2026 column of the same table does not exist until January 2027 and is covered by the four entries below',
    constant: true,
    why: 'a one-year entry, because 2025 and 2026 have different KINDS of provenance for this path rather than different figures: 2025 was read in the Standard Deduction Table and 2026 was derived from the published rate schedules. Splitting the entry is the only way to say that',
  },
  {
    state: 'WI',
    path: 'deduction.maximum.*',
    kind: 'derived',
    years: [2026],
    cite: 'DERIVED, and for FOUR of the five cells DETERMINED. The 2026 Standard Deduction Table is not published until January 2027, but § 71.06 and § 71.05(22) index both schedules on the same CPI measure, so the published 2026 top-bracket thresholds bound the cumulative factor to 7.5 parts per million and each figure’s own statutory base is bounded by its five published years. The single ($13,960), joint and surviving spouse ($25,840) and head of household ($18,030) cells come out UNIQUE; the single and joint figures are independently corroborated by two secondary reproductions of the 2026 table. The separate cell is bounded and not determined and is overridden by the entry below. See test/wisconsin-indexation.test.js, which also validates the method by predicting the published 2025 schedule from 2021-2024 alone',
    constant: true,
  },
  {
    state: 'WI',
    path: 'deduction.maximum.marriedFilingSeparately',
    kind: 'derived-bounded',
    years: [2026],
    cite: 'BOUNDED, not determined: the derivation gives $12,274.90 to $12,277.60, which admits $12,270 and $12,280 and no other value. This package carries $12,280, which the interval midpoint of $12,276.25 rounds to. $10 of deduction, at most 77 cents of tax, and the 2026 Form 1 instructions settle it',
    constant: true,
  },
  {
    state: 'WI',
    path: 'deduction.tiers.*.*.rate',
    kind: 'statute',
    document: '§ 71.05(22)(dp)',
    cite: 'Wis. Stat. § 71.05(22)(dp), "Deduction limits, 2000 and thereafter" — 12% single, 19.778% joint, separate and surviving spouse, and 22.515% then 12% head of household. Statutory and UNINDEXED, which is what makes the sliding scale a multiplier on the marginal rate rather than a step in it: a single filer in the 4.4% bracket and inside the band pays 4.928% on their next dollar. The 19.778% is the figure the statute PRINTS and not a rounding of anything — the paragraph reads "subtracting from $19,010 19.778 percent of aggregate Wisconsin adjusted gross income in excess of $21,360", the base-year amounts the indexing starts from',
    constant: true,
  },
  {
    state: 'WI',
    path: 'deduction.tiers.*.0.above',
    kind: 'indexed',
    document: '2025 Form 1 instructions',
    years: [2025],
    cite: 'Wis. Stat. § 71.05(22)(dp) — the Wisconsin AGI above which the withdrawal begins: $19,550 single and head of household, $28,210 joint and surviving spouse, $13,390 separate for 2025. Indexed on the same measure as the maxima and read from the same table. The 2026 figures are derived — see the two entries below',
    constant: true,
    why: 'a one-year entry for the same reason as the maxima above: the 2025 figure was read and the 2026 figure was derived, which is a difference in provenance rather than in value',
  },
  {
    state: 'WI',
    path: 'deduction.tiers.marriedFilingJointly.0.above',
    kind: 'derived',
    years: [2026],
    cite: 'DETERMINED by the derivation: $29,037.10 to $29,038.30 admits $29,040 and nothing else. Same arithmetic as the maxima, same test. The qualifying surviving spouse cell takes this figure in this package and is covered by the entry below, where the open question about that status is recorded',
    constant: true,
  },
  {
    state: 'WI',
    path: 'deduction.tiers.qualifyingSurvivingSpouse.0.above',
    kind: 'derived',
    years: [2026],
    cite: 'the joint threshold, which this package gives a qualifying surviving spouse because that is the near-universal state rule. WHETHER WISCONSIN OFFERS THE STATUS AT ALL IS THE OPEN QUESTION OF DAY 43 and is recorded in NOTES-FOR-HUMAN.md: § 71.06 writes its schedules for "fiduciaries, single individuals and heads of households" and for "married persons", with no surviving-spouse schedule, and the Form 1 instructions tell a filer whose spouse died in an earlier year to file as single or head of household. If that reading holds, this cell and the joint rate schedule are both wrong for the status and the error is up to $2,861 in the filer\'s favour',
    constant: true,
  },
  {
    state: 'WI',
    path: 'deduction.tiers.single.0.above',
    kind: 'derived-bounded',
    years: [2026],
    cite: 'BOUNDED: $20,124.00 to $20,125.60 admits $20,120 and $20,130. This package carries $20,120, the midpoint’s rounding. The head of household column holds the SAME figure, which is why `provisionalFigures` flags two paths for one unresolved number — Day 42’s rule that a byStatus table turns one unread figure into five',
    constant: true,
  },
  {
    state: 'WI',
    path: 'deduction.tiers.headOfHousehold.0.above',
    kind: 'derived-bounded',
    years: [2026],
    cite: 'the single threshold, same figure and same $20,120/$20,130 ambiguity — § 71.05(22)(dp) gives single and head of household one threshold and two withdrawal rates. It also moves the derived crossover below it by $10 of income',
    constant: true,
  },
  {
    state: 'WI',
    path: 'deduction.tiers.marriedFilingSeparately.0.above',
    kind: 'derived-bounded',
    years: [2026],
    cite: 'BOUNDED: $13,779.60 to $13,785.90 admits $13,780 and $13,790. This package carries $13,780, the midpoint’s rounding. Starting the withdrawal $10 of income early or late costs at most two cents of tax, which is the smallest provisional figure in this package',
    constant: true,
  },
  {
    state: 'WI',
    path: 'deduction.tiers.headOfHousehold.1.above',
    kind: 'derived',
    cite: 'NOT A PARAMETER. The income at which the head-of-household deduction has fallen to the single one, after which § 71.05(22)(dp) withdraws both at 12%: threshold + (maxHeadOfHousehold - maxSingle) / (22.515% - 12%). $57,210.49 for 2025 and $58,826.61 for 2026. The only source that carries the 2025 figure records $57,210, which is this rounded — so the identity is checked against the published value rather than replacing it, in test/wisconsin.test.js',
    constant: false,
  },
  {
    state: 'WI',
    path: 'capitalGainsSubtraction.share',
    kind: 'statute',
    document: '§ 71.05(6)(b)9',
    cite: 'Wis. Stat. § 71.05(6)(b)9, Schedule WD line 25 — 30% of the net capital gain to the extent it is long-term, and the reason Wisconsin’s top rate on a long-term gain is 5.355% rather than 7.65%. The share has not moved across the years this package checks; an earlier draft of this entry said "unchanged since 2011" and that year was not from a source',
    constant: true,
  },
  {
    state: 'WI',
    path: 'exemption.perFiler.*',
    kind: 'statute',
    document: '§ 71.05(23)',
    cite: 'Wis. Stat. § 71.05(23) — $700 per exemption, so $1,400 on a joint return and $700 on every other status including a qualifying surviving spouse, who files alone. UNINDEXED, and $700 for every year any source this package has consulted carries — the earliest is 2001, which is where a parameter file\'s series begins and not necessarily where the statute\'s does. An earlier draft of this entry added a purchasing-power percentage that nothing here could cite, and it was wrong',
    constant: true,
  },
  {
    state: 'WI',
    path: 'exemption.perDependent',
    kind: 'statute',
    document: '§ 71.05(23)',
    cite: 'Wis. Stat. § 71.05(23) — the same $700 for each dependent',
    constant: true,
  },
  {
    state: 'WI',
    path: 'exemption.perSeniorFiler',
    kind: 'statute',
    document: '§ 71.05(23)',
    cite: 'Wis. Stat. § 71.05(23) — $250 more for the taxpayer and again for the spouse at 65, PER PERSON, so a joint return where both have reached 65 claims two. Unindexed. Section level: the paragraph that carries the age addition is not one this package has read, and § 71.05(23)(a)2 is the only subdivision of it a source has shown',
    constant: true,
  },
  {
    state: 'WI',
    path: 'exemption.seniorAge',
    kind: 'statute',
    document: '§ 71.05(23)',
    cite: 'Wis. Stat. § 71.05(23) — 65, and Wisconsin’s age addition sits inside the EXEMPTION rather than inside the standard deduction, which is why its separate-return declaration has no aged half to read',
    constant: true,
  },
  {
    state: 'WI',
    path: 'exemption.filersClaimed.*',
    kind: 'statute',
    document: '§ 71.05(23)',
    cite: 'Wis. Stat. § 71.05(23) — a count of people, not an amount. A joint return claims two and a qualifying surviving spouse one, because the spouse is dead and there is one filer on the return',
    constant: true,
  },
  {
    state: 'WI',
    path: 'itemizedDeductionCredit.rate',
    kind: 'statute',
    document: '§ 71.07(5)',
    cite: 'Wis. Stat. § 71.07(5) — 5% of the excess of eligible itemized deductions over the standard deduction. A CREDIT and not a deduction, and 5% is below every Wisconsin rate, so the state’s itemized relief is worth less than a deduction and the gap widens with the bracket',
    constant: true,
  },
  {
    state: 'WI',
    path: 'schoolPropertyTaxCredit.rate',
    kind: 'statute',
    document: '§ 71.07(9)',
    cite: 'Wis. Stat. § 71.07(9) — 12% of property taxes on a principal dwelling',
    constant: true,
  },
  {
    state: 'WI',
    path: 'schoolPropertyTaxCredit.max',
    kind: 'statute',
    document: '§ 71.07(9)',
    cite: 'Wis. Stat. § 71.07(9) — a $300 maximum, which is 12% of $2,500 and binds below the median Wisconsin property tax bill, so for most Wisconsin homeowners this credit is a flat $300',
    constant: true,
  },
  {
    state: 'WI',
    path: 'schoolPropertyTaxCredit.rentShare',
    kind: 'statute',
    document: '§ 71.07(9)',
    cite: 'Wis. Stat. § 71.07(9) — 20% of rent is treated as property tax where heat is included. Section level: the subdivision is one a parameter file names and this package has not read. The statute uses a higher share where it is not, and this package does not ask which, because the $300 cap binds either way above $12,500 of annual rent',
    constant: true,
  },
  {
    state: 'WI',
    path: 'marriedCoupleCredit.rate',
    kind: 'statute',
    document: '§ 71.07(6)',
    cite: 'Wis. Stat. § 71.07(6) — 3% of the qualified earned income of the spouse with the LESSER qualified earned income. Section level; the paragraph is not one this package has read',
    constant: true,
  },
  {
    state: 'WI',
    path: 'marriedCoupleCredit.cap.max',
    kind: 'statute',
    document: '§ 71.07(6)',
    cite: 'Wis. Stat. § 71.07(6) — $480, which the 3% reaches at $16,000 of second-earner income. Unindexed across the years this package checks. The path says `cap.max` because the statute attaches "not to exceed" to the CREDIT; South Carolina attaches its own ceiling to the income',
    constant: true,
  },
  {
    state: 'WI',
    path: 'earnedIncomeCredit.matchRate',
    kind: 'statute',
    document: '§ 71.07(9e)',
    cite: 'Wis. Stat. § 71.07(9e) — ZERO, which is the rate for a filer with no qualifying children. Wisconsin pays no match at all on the federal childless credit, so this is a figure and not a placeholder; the rates for one, two and three children are the table below',
    constant: true,
  },
  {
    state: 'WI',
    path: 'earnedIncomeCredit.matchRateByChildCount.*.rate',
    kind: 'statute',
    document: '§ 71.07(9e)',
    cite: 'Wis. Stat. § 71.07(9e) — 4% with one qualifying child, 11% with two, 34% with three or more. The largest spread by family size of any state match here: on the 2026 federal maximums that is $177.08, $804.76 and $2,798.54',
    constant: true,
  },
  {
    state: 'WI',
    path: 'earnedIncomeCredit.matchRateByChildCount.*.children',
    kind: 'statute',
    document: '§ 71.07(9e)',
    cite: 'Wis. Stat. § 71.07(9e) — the child counts the three rates attach to, 1, 2 and 3. The last means three OR MORE',
    constant: true,
  },
  {
    state: 'WI',
    path: 'retirementIncomeExclusionElection.minimumAge',
    kind: 'statute',
    document: '2025 Wisconsin Act 15',
    cite: 'Wis. Stat. § 71.05(6)(b)54m.a, created by 2025 Act 15 — 67 before the close of the taxable year. Not 65, and not the federal full retirement age by accident: 67 IS the full retirement age for everyone born in 1960 or later',
    constant: true,
  },
  {
    state: 'WI',
    path: 'retirementIncomeExclusionElection.perPerson',
    kind: 'statute',
    document: '2025 Wisconsin Act 15',
    cite: 'Wis. Stat. § 71.05(6)(b)54m.a — $24,000 of qualifying retirement income per eligible individual. This package carries the same figure for 2025 and 2026 because Act 15 is four months old and nothing has indexed it yet; whether the statute indexes it at all is not something this package has read',
    constant: true,
  },
  {
    state: 'WI',
    path: 'retirementIncomeExclusionElection.jointBothEligible',
    kind: 'statute',
    document: '2025 Wisconsin Act 15',
    cite: 'Wis. Stat. § 71.05(6)(b)54m.a — $48,000 where BOTH spouses on a joint return have reached 67. A pooled cap and not two per-person ones: a couple with $40,000 and $2,000 of pension subtracts the whole $42,000, where a per-person cap would allow $26,000',
    constant: true,
  },

  // ---------------------------------------------------------------------------
  // Minnesota. 96 real figures a year, and EVERY ONE OF THEM IS READ FOR BOTH
  // YEARS — the first state-year pair here with no carried-forward figure and
  // no derivation, because § 270C.22 subd. 1 makes the commissioner announce the
  // adjusted amounts by 1 December of the PRECEDING year. The Department of
  // Revenue met that deadline for 2026 on 16 December 2025 and for 2025 on
  // 16 December 2024, so both releases existed before either tax year began.
  //
  // That is the operational point of the `kind` column stated in one state:
  // what a new Minnesota year costs, MEASURED by newYearCost() rather than
  // counted by hand, is 49 statutory figures that cannot move without an
  // amendment, 46 indexed ones that are on a published calendar, and 6
  // sentinels. Neither of those costs is a search.
  {
    state: 'MN',
    path: 'year',
    kind: 'sentinel',
    cite: 'The tax year the definition answers for, not a figure read from anywhere',
    constant: false,
  },
  {
    state: 'MN',
    path: 'rate.byStatus.*.*.rate',
    kind: 'statute',
    document: '§ 290.06, subd. 2c',
    cite: 'Minn. Stat. § 290.06, subd. 2c — 5.35%, 6.80%, 7.85% and 9.85%. The top rate was added by 2013 Minn. Laws ch. 143 and none of the four has moved since; subd. 2d indexes the THRESHOLDS and says nothing about the rates, which is why the rate schedule is 20 statutory cells beside 15 indexed ones in the same table',
    constant: true,
  },
  {
    state: 'MN',
    path: 'rate.byStatus.*.*.upTo',
    kind: 'indexed',
    document: '16 December 2025',
    cite: 'Minn. Stat. § 290.06, subd. 2d indexes every bracket boundary under § 270C.22, rounded to the nearest $10. 2025 was read in the Department of Revenue release of 16 December 2024 and 2026 in the release of 16 December 2025, both of which this state-year lists. THE 2026 COLUMN WAS CORROBORATED ARITHMETICALLY BEFORE IT WAS TRUSTED, and the corroboration has a measured strength. Each published pair bounds the year-on-year factor to an interval; the twelve intervals INTERSECT, at 1.0227290 to 1.0227831, which is 5.4 parts per hundred thousand wide. That is a real constraint rather than a restatement: of the 216 single-cell transcription errors of $10 to $1,000 in either direction, 195 make the intersection EMPTY. Nineteen of the twenty-one survivors are $10 errors — one rounding step, the smallest change the $10 rounding can hide — and the other two are $20 errors in the joint column alone, at the tops of its 6.80% and 7.85% bands. So the check catches any error of $30 or more anywhere, and any error of $20 or more outside those two cells. It earned its keep immediately: the first search that returned these figures also reported the factor as 2.369%, which is nowhere near this interval, and the interval is why that was not believed',
    constant: false,
  },
  {
    state: 'MN',
    path: 'deduction.amounts.*',
    kind: 'indexed',
    document: '16 December 2025',
    cite: 'Minn. Stat. § 290.0123, subd. 1, indexed under subd. 6 and rounded to the nearest $50 — $14,950 single and separate, $29,900 joint and surviving spouse, $22,500 head of household for 2025; $15,300, $30,600 and $23,000 for 2026. Both columns read in the Department of Revenue releases this state-year lists. The single and separate figures are exactly half the joint one in both years, which the statute requires rather than the rounding happening to allow',
    constant: false,
  },
  {
    state: 'MN',
    path: 'deduction.limitation.tiers.*.*.rate',
    kind: 'statute',
    document: '§ 290.0123',
    cite: 'Minn. Stat. § 290.0123, subd. 5(a)(1) — 3% of the excess over the lower threshold and 10% of the excess over the higher one. Statutory and UNINDEXED, which is what makes the limitation part of the marginal rate rather than a step in it: a Minnesota single filer in the 7.85% bracket and inside the 10% tier pays 8.635% on their next dollar, until the 80% cap binds and the rate drops back to 7.85%. The 10% tier and its threshold were added for tax year 2023; before that the limitation had one tier',
    constant: true,
  },
  {
    state: 'MN',
    path: 'deduction.limitation.tiers.*.*.above',
    kind: 'indexed',
    document: 'inflation-adjusted amounts',
    cite: 'Minn. Stat. § 290.0123, subd. 5(a)(1), indexed under subd. 6 — $238,950 and $330,300 for 2025 and $244,400 and $337,800 for 2026, halved exactly for a separate return ($119,475 / $165,150 and $122,200 / $168,900). The 2026 pair is in the Department of Revenue tax year 2026 inflation-adjusted amounts table. Note that the lower threshold is NOT the same figure as the dependent exemption threshold beside it: $238,950 against $239,050 for a single filer in 2025, two separately indexed amounts $100 apart',
    constant: false,
  },
  {
    state: 'MN',
    path: 'deduction.limitation.maxReductionShare',
    kind: 'statute',
    document: '§ 290.0123',
    cite: 'Minn. Stat. § 290.0123, subd. 5(a)(2) — the limitation removes the LESSER of the tiered amount and 80% of the standard deduction, so the deduction never falls below a fifth of itself. Statutory and unindexed. Subd. 5(b) sets out a separate flat 80% reduction above an indexed income threshold ($1,083,150 for 2025, $1,107,750 for 2026) and this package does not store it, because it is not a free parameter: the tiered reduction already exceeds 80% of the deduction far below that income — $542,095 of AGI for a 2025 joint filer with no aged or blind addition — so the min() in (a) has bound for every filer (b) could reach. test/minnesota.test.js asserts that at the threshold itself rather than leaving the claim to this sentence',
    constant: true,
  },
  {
    state: 'MN',
    path: 'standardDeductionAgedOrBlindAddition.amount.*',
    kind: 'indexed',
    document: 'inflation-adjusted amounts',
    cite: 'Minn. Stat. § 290.0123, subd. 2, indexed under subd. 6 — $2,000 per qualifying person on a single or head of household return in both years, $1,550 for 2025 and $1,600 for 2026 on a joint, separate or surviving spouse one. It follows 26 U.S.C. § 63(f) in giving the UNMARRIED filer the larger amount. These are the one group of Minnesota figures the indexation check cannot reach, and the reason is granularity rather than evidence. The brackets pin the cumulative 2021-to-2026 factor to 1.223457 to 1.223536; the published $1,650-to-$2,000 single cell bounds it only to 1.179 to 1.246 and the $1,300-to-$1,600 joint cell to 1.189 to 1.275. Both contain the bracket interval, so both are CONSISTENT and neither is corroborated: a $50-rounded figure near $2,000 carries about a thousand times less information about the factor than a $10-rounded figure near $300,000, so it has to be READ rather than checked',
    constant: false,
  },
  {
    state: 'MN',
    path: 'standardDeductionAgedOrBlindAddition.age',
    kind: 'statute',
    document: '§ 290.0123',
    cite: 'Minn. Stat. § 290.0123, subd. 2 — 65, the age 26 U.S.C. § 63(f)(1) uses, and unindexed',
    constant: true,
  },
  {
    state: 'MN',
    path: 'exemption.perFiler.*',
    kind: 'statute',
    document: '§ 290.0121',
    cite: 'ZERO, in all five statuses, and it is a READ figure rather than an unfilled field: Minn. Stat. § 290.0121, subd. 1 allows the exemption "for each individual who is a dependent of the taxpayer" and there is no corresponding allowance for the taxpayer or the spouse anywhere in the section. Minnesota repealed its personal exemption when it conformed to the federal suspension of § 151 and replaced it with a dependent exemption alone, so it is the only state in this package where the filer gets nothing. test/separate-return-spouse.test.js PROVES the zero rather than trusting it — a non-zero cell in any status fails the noFilerExemption declaration',
    constant: true,
  },
  {
    state: 'MN',
    path: 'exemption.perDependent',
    kind: 'indexed',
    document: '16 December 2025',
    cite: 'Minn. Stat. § 290.0121, subd. 1, indexed under subd. 3 and rounded to the nearest $50 — $5,200 for 2025 and $5,300 for 2026, both read in the Department of Revenue releases this state-year lists. Worth up to $522.05 of tax a dependent in 2026 at the 9.85% top rate, which is more than any other dependent exemption in this package',
    constant: false,
  },
  {
    state: 'MN',
    path: 'exemption.proportionalStepPhaseOut.start.*',
    kind: 'indexed',
    document: 'inflation-adjusted amounts',
    cite: 'Minn. Stat. § 290.0121, subd. 2, indexed under subd. 3 — the federal AGI above which the exemption begins to be disallowed: $239,050 single, $358,550 joint and surviving spouse, $298,800 head of household and $179,275 separate for 2025, and $244,500, $366,700, $305,600 and $183,350 for 2026. Four separately indexed columns, and the separate column is exactly half the joint one in both years',
    constant: false,
  },
  {
    state: 'MN',
    path: 'exemption.proportionalStepPhaseOut.increment.*',
    kind: 'statute',
    document: '§ 290.0121',
    cite: 'Minn. Stat. § 290.0121, subd. 2 — $2,500 of federal AGI a step, $1,250 on a separate return. Statutory and UNINDEXED, which is the half that matters: the thresholds move every year and the step does not, so the number of steps is fixed at fifty by 2% and $2,500 together and the staircase is always the same width however far the threshold moves. That width is $122,500 and not $125,000: the fiftieth step takes the last 2% and the ceil() in \'or fraction thereof\' brings it on the first dollar past $122,500, so fifty steps of $2,500 reach zero one step early ($61,250 on a separate return)',
    constant: true,
  },
  {
    state: 'MN',
    path: 'exemption.proportionalStepPhaseOut.sharePerStep',
    kind: 'statute',
    document: '§ 290.0121',
    cite: 'Minn. Stat. § 290.0121, subd. 2 — 2% of the exemption per step, disallowed "for each $2,500, or fraction thereof". Statutory and unindexed. The four words are the whole rule: ceil() rather than floor(), so one dollar over any boundary costs a whole 2% step — $106 of exemption for a Minnesota parent of one in 2026 and $424 for a parent of four, on the same dollar',
    constant: true,
  },
  {
    state: 'MN',
    path: 'socialSecuritySubtraction.fullSubtractionAtOrBelow.*',
    kind: 'indexed',
    document: 'inflation-adjusted amounts',
    cite: 'Minn. Stat. § 290.0132, subd. 26(c), indexed under subd. 26(j) — $84,490 single and head of household, $108,320 joint and surviving spouse, $54,160 separate for 2025, and $86,410, $110,780 and $55,390 for 2026. The 2026 column is in the Department of Revenue tax year 2026 inflation-adjusted amounts table. Subd. 26(j) adjusts ONLY these thresholds: the alternative subtraction amounts in paragraph (a) have stood at $5,840 joint and $4,560 single since 2023 and the Department lists them as not indexed, which is why the alternative route is a different kind of figure from this one and is recorded in the notes rather than carried here',
    constant: false,
  },
  {
    state: 'MN',
    path: 'socialSecuritySubtraction.increment.*',
    kind: 'statute',
    document: '§ 290.0132, subd. 26',
    cite: 'Minn. Stat. § 290.0132, subd. 26(c) — $4,000 of adjusted gross income a step, $2,000 on a separate return. Statutory and unindexed, so the withdrawal is always the same width however far the threshold moves — $36,000 and not the $40,000 that ten steps of $4,000 suggests, because the tenth step arrives on the first dollar past $36,000 ($18,000 separate)',
    constant: true,
  },
  {
    state: 'MN',
    path: 'socialSecuritySubtraction.sharePerStep',
    kind: 'statute',
    document: '§ 290.0132, subd. 26',
    cite: 'Minn. Stat. § 290.0132, subd. 26(c) — 10% of the subtraction per step, reduced "for each $4,000, or fraction thereof". Statutory and unindexed, and the same four words as the dependent exemption: one dollar over a boundary costs a tenth of the whole benefit, which for a retiree with $30,000 of federally taxable benefit is $3,000 of subtraction on one dollar of income',
    constant: true,
  },

  // ---------------------------------------------------------------------------
  // SOUTH CAROLINA. Two years, two laws, and the ledger is where that shows
  // most plainly: nine of these entries are year-scoped, because Act 110 of 2026
  // did not index a figure, it replaced a mechanism. The 2025 rate schedule is
  // `indexed` and the 2026 one is `statute` — the same path, two different kinds
  // of debt, and a reader who wants to know what tax year 2027 costs South
  // Carolina needs both answers.
  {
    state: 'SC',
    path: 'year',
    kind: 'sentinel',
    cite: 'The tax year the definition answers for, not a figure read from anywhere',
    constant: false,
  },
  {
    state: 'SC',
    path: 'rate.byStatus.*.*.rate',
    kind: 'statute',
    years: [2025],
    document: '§ 12-6-510',
    cite: 'S.C. Code § 12-6-510(A) — 0%, 3% and 6% for tax year 2025. The RATES are statutory and the thresholds below are indexed, which is the usual split; what is unusual is that the top rate has been on a legislated glide path, 6.5% for 2022, 6.4% for 2023, 6.2% for 2024 and 6% for 2025, so a reader who treats it as constant across years is wrong about every year but the last',
    constant: true,
  },
  {
    state: 'SC',
    path: 'rate.byStatus.*.*.upTo',
    kind: 'indexed',
    years: [2025],
    document: 'Instructions (SC1040)',
    cite: 'SCDOR 2025 Individual Income Tax Instructions (SC1040), the 2025 rate schedule — $3,560 and $17,830, indexed annually under § 12-6-520 and the same three bands for EVERY filing status, which is the fact about this schedule a table of state rates does not carry',
    constant: true,
  },
  {
    state: 'SC',
    path: 'rate.byStatus.*.*.rate',
    kind: 'statute',
    years: [2026],
    document: 'Act 110 of 2026 (H.4216), signed',
    cite: 'S.C. Code § 12-6-510(C) as added by Act 110 of 2026 (H.4216) § 1 — 1.99% and 5.21%, for tax years beginning after 2025. SCDOR prints the upper band as "5.21% minus $966"; the $966 is not a parameter, it is $30,000 x (5.21% - 1.99%) exactly, which is the constant that makes the two-band schedule continuous at the threshold. Act 110 also provides for automatic reductions in the top rate from 2027 where revenue grows, which is NOT modelled and cannot be until a year closes',
    constant: true,
  },
  {
    state: 'SC',
    path: 'rate.byStatus.*.*.upTo',
    kind: 'statute',
    years: [2026],
    document: 'Act 110 of 2026 (H.4216), signed',
    cite: 'S.C. Code § 12-6-510(C) as added by Act 110 of 2026 (H.4216) § 1 — the single bracket boundary is $30,000 of taxable income, a statutory figure for its first year rather than an indexed one, and the same for every filing status',
    constant: true,
  },
  {
    state: 'SC',
    path: 'recognizedStandardDeduction.amounts.*',
    kind: 'federal-conformity',
    years: [2025],
    document: 'Rev. Proc. 2024-40',
    cite: 'IRC § 63(c)(7) as it stood on 31 December 2024 — the date S.C. Code § 12-6-40(A)(1)(a) freezes the Code at — indexed for 2025 by Rev. Proc. 2024-40 § 3.15: $15,000 single and separate, $22,500 head of household, $30,000 joint and surviving spouse. A FEDERAL figure that South Carolina adopted by reference and the federal government then superseded, which is the one case where `federal-conformity` means the state tracks a figure that no longer exists federally',
    constant: true,
  },
  {
    state: 'SC',
    path: 'recognizedStandardDeduction.increase.*',
    kind: 'federal-conformity',
    years: [2025],
    document: 'Rev. Proc. 2024-40',
    cite: 'The difference between IRC § 63(c)(2) as the One Big Beautiful Bill Act § 70101 substituted it for 2025 and the same paragraph as Rev. Proc. 2024-40 § 3.15 indexed it — $15,750 against $15,000, $23,625 against $22,500, $31,500 against $30,000, so $750 single and separate, $1,125 head of household and $1,500 joint and surviving spouse. A DERIVED federal figure, declared rather than computed because the add-back is the difference of the two PARAMETERS and not of the filer’s own deduction: § 63(f)’s aged and blind additions are in both Codes and must survive the add-back. Published as these three amounts by TaxAct, Drake Tax and 1040.com for SC1040 line e; SCDOR Information Letter #26-4 is the document that would settle it and dor.sc.gov is refused by this sandbox’s egress policy',
    constant: true,
  },
  {
    state: 'SC',
    path: 'deduction.maximum.*',
    kind: 'statute',
    years: [2026],
    document: 'Act 110 of 2026 (H.4216), signed',
    cite: 'S.C. Code § 12-6-1140(15)(a) as added by Act 110 of 2026 (H.4216) § 3 — the SCIAD base: $15,000 single and separate, $22,500 head of household, $30,000 joint and surviving spouse. They are the pre-OBBBA federal standard deductions to the dollar, which is where the Act got them, and they are now South Carolina figures that index on South Carolina\u2019s own schedule',
    constant: true,
  },
  {
    state: 'SC',
    path: 'deduction.tiers.*.*.above',
    kind: 'statute',
    years: [2026],
    document: 'Act 110 of 2026 (H.4216), signed',
    cite: 'S.C. Code § 12-6-1140(15)(b) as added by Act 110 of 2026 (H.4216) § 3 — the federal AGI at which the SCIAD begins to be withdrawn: $40,000 single and separate, $60,000 head of household, $80,000 joint and surviving spouse, as SCDOR Information Letter 26-20 states them',
    constant: true,
  },
  {
    state: 'SC',
    path: 'deduction.tiers.*.*.denominator',
    kind: 'statute',
    years: [2026],
    document: 'Information Letter 26-20',
    // The path said `.rate` and carried the QUOTIENT until the ulp defect — see
    // `SlidingScaleTier`. The quotient was a derived figure masquerading as a
    // parameter and it was wrong in the sixteenth digit, which a $10 floor
    // turned into a whole step. The denominator is what the statute has.
    cite: 'S.C. Code § 12-6-1140(15)(b) as SCDOR Information Letter 26-20 states it — the denominator of the phase-out fraction: $55,000 single and separate, $82,500 head of household, $110,000 joint and surviving spouse, so the phase-out runs $40,000-$95,000, $60,000-$142,500 and $80,000-$190,000. EACH IS ELEVEN THIRDS OF ITS OWN BASE, so the withdrawal rate is 3/11 in every filing status and the columns differ only in where it begins — asserted in `test/south-carolina.test.js` rather than assumed, because an amendment that moved one base without its denominator would end it silently',
    constant: true,
  },
  {
    state: 'SC',
    path: 'deduction.roundReductionDownTo',
    // `statute` and not `agency`: `agency` in this ledger means a body that is
    // NOT the state's revenue department, and an SCDOR information letter is
    // the revenue department. It is a rule of law rather than an annual figure,
    // and the cite says plainly that the sentence quoted is the Department's
    // and that § 12-6-1140(15)(b) itself has not been read here.
    kind: 'statute',
    years: [2026],
    document: 'Information Letter 26-20',
    cite: 'SCDOR Information Letter 26-20 — "any reduction amount that is not a multiple of ten dollars is rounded down to the next lowest ten dollars". The $10 is why the SCIAD phase-out is a staircase rather than a rate, and because the withdrawal rate is 3/11 the step is $36.66... of income: the widths of an integer-dollar income run 37, 37, 36, repeating. `kind: agency` and not `statute` because the rounding sentence is the Department\u2019s and this package has not read § 12-6-1140(15)(b) itself',
    constant: true,
  },
  {
    state: 'SC',
    path: 'capitalGainsSubtraction.share',
    kind: 'statute',
    document: '§ 12-6-1150',
    cite: 'S.C. Code § 12-6-1150(A) — 44% of net capital gain, unchanged since 1991 and untouched by Act 110. Against the flat 5.21% of 2026 that is an effective 2.9176% on a long-term gain and 5.21% on a wage; against the 6% top rate of 2025 it is 3.36%',
    constant: true,
  },
  {
    state: 'SC',
    path: 'retirementIncomeSubtractions.0.capByAge.*.cap',
    kind: 'statute',
    document: '§ 12-6-1170(A)',
    cite: 'S.C. Code § 12-6-1170(A)(1) — $3,000 of retirement income for a claimant under 65 and $10,000 from 65, per person. Unindexed, and the $3,000 has not moved since 1989',
    constant: true,
  },
  {
    state: 'SC',
    path: 'retirementIncomeSubtractions.0.capByAge.*.fromAge',
    kind: 'statute',
    document: '§ 12-6-1170(A)',
    cite: 'S.C. Code § 12-6-1170(A)(1) — the band boundary is the 65th birthday, and the first band begins at 0 because the subtraction has NO age test at all: a 40-year-old with a pension has $3,000 of it, which no other retirement rule in this package allows',
    constant: true,
  },
  {
    state: 'SC',
    path: 'agedIncomeSubtraction.maximum',
    kind: 'statute',
    document: '§ 12-6-1170(B)',
    cite: 'S.C. Code § 12-6-1170(B) — $15,000 per person, of ANY income rather than of retirement income, reduced by whatever that person deducted under subsection (A). Unindexed since 1994',
    constant: true,
  },
  {
    state: 'SC',
    path: 'agedIncomeSubtraction.minimumAge',
    kind: 'statute',
    document: '§ 12-6-1170(B)',
    cite: 'S.C. Code § 12-6-1170(B) — 65, "attained the age of sixty-five years" by the end of the taxable year',
    constant: true,
  },
  {
    state: 'SC',
    path: 'exemption.perFiler.*',
    kind: 'statute',
    document: '§ 12-6-1140(13)',
    cite: 'ZERO, and it is a figure rather than a placeholder: S.C. Code § 12-6-1140(13) allows an exemption for DEPENDENTS and names no exemption for the filer or a spouse, in either year. In 2025 the federal standard deduction is already inside federal taxable income and in 2026 the SCIAD stands where it was, so the state has never needed one',
    constant: true,
  },
  {
    state: 'SC',
    path: 'exemption.perDependent',
    kind: 'indexed',
    years: [2025],
    document: 'Instructions (SC1040)',
    cite: 'SCDOR 2025 Individual Income Tax Instructions (SC1040), dependent exemption worksheet — $4,930 for each eligible dependent, indexed annually under § 12-6-1140(13); $4,790 for 2024',
    constant: true,
  },
  {
    state: 'SC',
    path: 'exemption.perQualifyingChild',
    kind: 'derived',
    years: [2025],
    cite: 'S.C. Code § 12-6-1160 sets the young child deduction EQUAL to the § 12-6-1140(13) dependent exemption rather than naming an amount, so this is one statutory figure read twice and a South Carolina dependent under six is worth exactly double one of seven. Kept as its own field so the two can be told apart the day South Carolina decouples them, and `test/south-carolina.test.js` asserts the equality so that day is noticed',
    constant: true,
  },
  {
    state: 'SC',
    path: 'exemption.perDependent',
    kind: 'carried-forward',
    years: [2026],
    document: 'Instructions (SC1040)',
    carriedForwardFrom: 2025,
    resolvedBy:
      'the 2026 SC1040 instructions and dependent exemption worksheet, which SCDOR publishes close to the start of the 2027 filing season',
    cite: 'The published 2025 figure of $4,930 CARRIED FORWARD. § 12-6-1140(13) indexes the amount annually and no SCDOR document reachable when this was written carries the 2026 one. Carrying it forward understates the exemption, so a 2026 South Carolina return with dependents is computed slightly too HIGH — at most the indexation times the rate, a few dollars a dependent',
    constant: true,
  },
  {
    state: 'SC',
    path: 'exemption.perQualifyingChild',
    kind: 'carried-forward',
    years: [2026],
    document: 'Instructions (SC1040)',
    carriedForwardFrom: 2025,
    resolvedBy:
      'the same 2026 SC1040 dependent exemption worksheet: § 12-6-1160 ties the two together, so one document settles both',
    cite: 'Equal to the dependent exemption by § 12-6-1160 and therefore carried forward with it',
    constant: true,
  },
  {
    state: 'SC',
    path: 'exemption.qualifyingChildMaxAge',
    kind: 'statute',
    document: '§ 12-6-1160',
    cite: 'S.C. Code § 12-6-1160 — a dependent "who had not attained the age of six years" by the end of the taxable year, stored as the inclusive age 5 because that is what a list of ages is compared against',
    constant: true,
  },
  {
    state: 'SC',
    path: 'marriedCoupleCredit.rate',
    kind: 'statute',
    document: '§ 12-6-3330',
    cite: 'S.C. Code § 12-6-3330(A) — seven-tenths of one percent of the qualified earned income of the spouse with the LOWER qualified earned income, on a joint return',
    constant: true,
  },
  {
    state: 'SC',
    path: 'marriedCoupleCredit.cap.max',
    // The first draft of this entry said `indexed`, from a feel rather than a
    // document, and the second said `unestablished` — which would have been the
    // first figure in this package to raise that backlog above zero since Day 37
    // drove it there. Neither was necessary, because the statute settles it:
    // § 12-6-3330(B)(1) prints "fifty thousand dollars" FLAT, substituted for
    // "thirty thousand dollars" by 2017 Act No. 40 § 17.A for tax years after
    // 2017, with no indexing clause anywhere in the section.
    //
    // AND THE CODIFIED TEXT HIDES A SIX-YEAR PHASE-IN. policyengine-us carries
    // $43,333 for 2021, $46,667 for 2022 and $50,000 for 2023 — evenly spaced
    // thirds of the $20,000 increase, which is the 2017 Act's transition
    // provision. The current code shows the destination and the annotation says
    // only "applies to tax years beginning after 2017", so a model built from
    // the codified statute alone is wrong about 2018 through 2022 by up to $140
    // of credit and right about every year this package supports.
    kind: 'statute',
    document: '§ 12-6-3330',
    cite: 'S.C. Code § 12-6-3330(B)(1) — seven-tenths of one percent of the lesser of FIFTY THOUSAND DOLLARS or the qualified earned income of the spouse with the lower qualified earned income. A flat statutory figure at its maximum since 2023, so the $350 maximum credit every summary of this provision quotes is 0.7% OF THIS and not a parameter of its own — and storing it as a ceiling on the credit would store a derived number as though the statute had said it',
    constant: true,
  },
  {
    state: 'SC',
    path: 'earnedIncomeCredit.matchRate',
    kind: 'statute',
    document: '§ 12-6-3632',
    cite: 'S.C. Code § 12-6-3632 — 125% of the federal earned income credit, non-refundable. Phased in from 20.83% for 2018 and at its statutory maximum since 2023. Act 110 left the RATE alone and capped the credit, which is why this entry covers both years and the cap below covers one',
    constant: true,
  },
  {
    state: 'SC',
    path: 'earnedIncomeCredit.maximum',
    kind: 'statute',
    years: [2026],
    document: 'Act 110 of 2026 (H.4216), signed',
    cite: 'S.C. Code § 12-6-3632 as amended by Act 110 of 2026 (H.4216) § 7 — $200 per return, for tax years beginning after 2025, where the credit had no ceiling at all. The cap binds from $160 of federal credit upward, so it takes nothing from the smallest claims; and because the credit is non-refundable it takes nothing from a household with no South Carolina liability either, which is where the largest federal credits are',
    constant: true,
  },

  // =========================================================================
  // KANSAS — thirty figures a year, every one of them STATUTE, and the ledger's
  // cleanest case of a state where "identical in both years" is the law rather
  // than a carry-forward. SB 1 of the 2024 special session wrote the rate
  // schedule, the standard deduction and the personal exemption each for "tax
  // year 2024, and all tax years thereafter", and the enacted act carries NO
  // cost-of-living provision although the bill as introduced would have indexed
  // the standard deduction from tax year 2025. So `constant: true` here needs no
  // `why`: nothing in this state is `indexed` and the 2025 booklet printing the
  // 2024 table unchanged is the corroboration rather than the claim.
  //
  // TWO ENTRIES ARE MORE SPECIFIC THAN THEIR GLOB AND THAT IS THE POINT OF THEM.
  // `exemption.perFiler.*` is § 79-32,121(a) at $9,160 and $18,320; the
  // head-of-household column is $11,480, which is that $9,160 plus an additional
  // $2,320 the 2024 K-40 granted while no subsection authorised it and HB 2231 of
  // 2025 then backdated into the statute. Those are two documents and one figure,
  // so they are two entries and the narrower one wins. The surviving-spouse column
  // is the same $11,480 for the same reason, because the K-40 routes a widow to
  // the head-of-household box.
  // =========================================================================
  {
    state: 'KS',
    path: 'rate.byStatus.*.*.rate',
    kind: 'statute',
    document: '79-32,110',
    cite: 'K.S.A. 79-32,110(a)(2)(F) as rewritten by SB 1 of the 2024 special session — 5.2% and 5.58%, the same two rates for every filing status, for tax year 2024 and all tax years thereafter. No indexation provision; what moves them is an act, and none has come. Published accounts of this state are slow here: several still print the superseded three-bracket schedule of 3.1%, 5.25% and 5.7%',
    constant: true,
  },
  {
    state: 'KS',
    path: 'rate.byStatus.*.*.upTo',
    kind: 'statute',
    document: '79-32,110',
    cite: 'K.S.A. 79-32,110(a)(2)(F) — $23,000 for "all other individuals" under (ii) and $46,000 for a joint return under (i). SETTLED BY THE STATUTE\'S OWN ACCUMULATED FIGURES: it prints $1,196 and $2,392 as the tax at each breakpoint, and 5.2% hits both exactly at these thresholds where the reference model\'s $23,001 and $46,001 give $1,196.052 and $2,392.052. A one-dollar anchoring error is worth $0.0038 of tax a return, invisible after rounding, and it is the mirror of the error Arkansas\'s own published card actually contains',
    constant: true,
  },
  {
    state: 'KS',
    path: 'deduction.amounts.*',
    kind: 'statute',
    document: '79-32,119',
    cite: 'K.S.A. 79-32,119(c) — $3,605 single, $8,240 married filing joint, $6,180 head of household, $4,120 married filing separate. SB 1 raised each of the 2023 figures by exactly 3.0% and then fixed them: the clause that would have indexed them annually from tax year 2025 was in the bill as introduced and is not in the act, which is why a model built from the legislature\'s own fiscal note indexes a figure the law holds still. A widow reads the head-of-household column, so her $6,180 is this entry and not the joint $8,240',
    constant: true,
  },
  {
    state: 'KS',
    path: 'standardDeductionAgedOrBlindAddition.amount.*',
    kind: 'statute',
    document: '79-32,119',
    cite: 'K.S.A. 79-32,119(b) and Worksheet I of the K-40 instructions — $850 per box checked for 65-or-over or blindness, $700 where the status is married filing joint or married filing separate. UNCHANGED SINCE 1998 ON THE REFERENCE MODEL\'S WORD rather than on a Kansas document read here: policyengine-us carries both figures from 1998-01-01 with no later value, which is twenty-eight tax years, and the federal § 63(f) additions were $1,050 and $850 in 1998 and are $2,000 and $1,600 now. It is the one figure in the Kansas income tax where a single filer\'s allowance EXCEEDS a joint filer\'s, and therefore the state\'s only marriage penalty',
    constant: true,
  },
  {
    state: 'KS',
    path: 'standardDeductionAgedOrBlindAddition.age',
    kind: 'statute',
    document: '79-32,119',
    cite: 'K.S.A. 79-32,119(b) — 65, the federal § 63(f) age. It is the ONLY age test on a Kansas return: the retirement subtraction of § 79-32,117(c) has none at all and neither does the Social Security subtraction since 2024',
    constant: true,
  },
  {
    state: 'KS',
    path: 'exemption.perFiler.*',
    kind: 'statute',
    document: '79-32,121',
    cite: 'K.S.A. 79-32,121(a) — $18,320 for a joint return and $9,160 for a single, head-of-household or married-filing-separate return. ONE FIGURE PER STATUS and not a figure per exemption claimed, which is what Kansas abandoned in 2024: through tax year 2023 the exemption was $2,250 "for each individual". The joint amount is exactly twice the other, and the statute writes both',
    constant: true,
  },
  {
    state: 'KS',
    path: 'exemption.perFiler.headOfHousehold',
    kind: 'statute',
    document: 'Notice 25-07',
    cite: '$11,480 — § 79-32,121(a)\'s $9,160 plus an ADDITIONAL $2,320 for a head of household. The 2024 K-40 granted it while no subsection authorised it, which is why policyengine-us still ships a comment saying the legal code does not specify it; HB 2231 of the 2025 session codified it and the Department\'s Notice 25-07 records the amendment as allowing it "for tax year 2024 and all tax years thereafter". A model built from the 2024 statute alone is $2,320 of exemption short for both years here',
    constant: true,
  },
  {
    state: 'KS',
    path: 'exemption.perFiler.qualifyingSurvivingSpouse',
    kind: 'statute',
    document: 'Notice 25-07',
    cite: 'the same $11,480 as the head-of-household column, because the K-40 has no qualifying-surviving-spouse box and its head-of-household box qualifies a filer who claimed head of household OR qualifying widow(er) with a dependent child federally. So the additional $2,320 of HB 2231 reaches a Kansas widow too, and the figure is this document\'s rather than § 79-32,121(a)\'s on its own',
    constant: true,
  },
  {
    state: 'KS',
    path: 'exemption.perDependent',
    kind: 'statute',
    document: '79-32,121',
    cite: 'K.S.A. 79-32,121(a) — $2,320 for each dependent. It is the figure HB 2231 of 2025 then reused for the head-of-household additional exemption, for the unborn-child exemption of paragraph (4) and for the disabled veteran exemption of subsection (b), so four Kansas allowances are one number',
    constant: true,
  },
  {
    state: 'KS',
    path: 'retirementIncomeSubtractions.0.cap',
    kind: 'sentinel',
    cite: 'zero, which together with `governmentPensionExemptInFull` subtracts the retirement benefits § 79-32,117(c) exempts — KPERS and the three other Kansas systems, federal civil service and other federal employment, and military retired pay — and leaves nothing else in the pool. It encodes "Kansas taxes every private pension, 401(k), IRA and annuity in full, at every age, with no ceiling" rather than being a figure read from a document. North Carolina\'s zero is the same construction; the difference is that Kansas\'s exempt list has a civilian government half and North Carolina\'s does not',
    constant: true,
  },
  {
    state: 'KS',
    path: 'earnedIncomeCredit.matchRate',
    kind: 'statute',
    document: '79-32,205',
    cite: 'K.S.A. 79-32,205 — 17% of the federal § 32 earned income credit, refundable. It was 18% for tax years 2010 through 2012 and was cut to 17% in 2013; thirteen tax years later it has not been restored, and the point it lost is worth $44.27 a year to a one-child family at the 2026 federal plateau. Unlike Oklahoma\'s 5% the base carries no date, which is why Kansas can declare the rule and Oklahoma cannot',
    constant: true,
  },
];

/** Walk a dot path, treating numeric segments as array indices. */
const at = (root: unknown, path: string): unknown => {
  if (path === '') return undefined;
  let node: unknown = root;
  for (const segment of path.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[segment];
  }
  return node;
};

/** Does a dot path match a ledger pattern? `*` is one segment, `**` is the rest. */
const matches = (pattern: string, path: string): boolean => {
  const p = pattern.split('.');
  const s = path.split('.');
  for (let i = 0; i < p.length; i += 1) {
    if (p[i] === '**') return s.length > i;
    if (i >= s.length) return false;
    if (p[i] !== '*' && p[i] !== s[i]) return false;
  }
  return p.length === s.length;
};

/**
 * How specific an entry is: literal path segments first, then whether it names
 * years. `exemptionCredit.seniorAge` beats `exemptionCredit.**`, and a
 * year-scoped entry beats an unscoped one — which is how California's indexed
 * 2025 thresholds and carried-forward 2026 ones live in the same ledger.
 */
const specificity = (entry: StateFigureSource): readonly [number, number] => [
  entry.path.split('.').filter((segment) => segment !== '*' && segment !== '**').length,
  entry.years === undefined ? 0 : 1,
];

/**
 * Is this figure a sentinel — a value that encodes the absence of a limit
 * rather than something read from a document?
 *
 * Identified by its VALUE and not by its path, because that is what it is: a
 * top bracket's `upTo` is `Infinity` in every state, a phase-out that does not
 * apply has an `Infinity` threshold, and no ledger pattern can say "the last
 * one" without hard-coding each table's length. `test/provenance.test.js`
 * asserts that every non-finite figure in the package is `Infinity` — never
 * `NaN`, never negative — which is a stronger claim than an exclusion list.
 */
export const isSentinelFigure = (value: number): boolean => !Number.isFinite(value);

/**
 * The ledger entry that accounts for one figure in one state-year, or
 * `undefined` if no entry does.
 *
 * The path is resolved against the definition before any pattern is tried, so
 * a figure that is not there has no provenance rather than a confident
 * citation. Day 32's rule — accepting an input is not reading it — and Day 36
 * paid for it: `standardDeduction.singl` matched `standardDeduction.*` as
 * readily as the real field, because a pattern matches a shape and knows
 * nothing about which fields exist.
 */
export const stateFigureProvenance = (
  definition: unknown,
  state: StateCode,
  year: number,
  path: string,
): StateFigureSource | undefined => {
  const value = at(definition, path);
  if (typeof value !== 'number') return undefined;
  let best: StateFigureSource | undefined;
  let bestRank: readonly [number, number] = [-1, -1];
  for (const entry of STATE_FIGURE_PROVENANCE) {
    if (entry.state !== state) continue;
    if (entry.years !== undefined && !entry.years.includes(year)) continue;
    if (!matches(entry.path, path)) continue;
    const rank = specificity(entry);
    if (rank[0] > bestRank[0] || (rank[0] === bestRank[0] && rank[1] > bestRank[1])) {
      best = entry;
      bestRank = rank;
    }
  }
  return best;
};

/** Exported for the coverage test, which needs the matcher the lookup uses. */
export const stateFigureProvenanceMatches = matches;
/** Exported for the coverage test, which needs the tie-break the lookup uses. */
export const stateFigureSpecificity = specificity;

/**
 * What a new tax year costs this state, grouped by kind.
 *
 * This is the question the `kind` field exists to answer and the reason the
 * ledger is worth more than the citations it maps to: a hand-maintained list
 * of things to remember drifts towards being short (Day 34), and this one is
 * derived from the data every time it is asked.
 */
export const newYearCost = (
  definition: unknown,
  state: StateCode,
  year: number,
  figurePaths: readonly string[],
): ReadonlyMap<StateFigureKind, number> => {
  const counts = new Map<StateFigureKind, number>();
  for (const path of figurePaths) {
    const value = at(definition, path);
    if (typeof value !== 'number') continue;
    if (isSentinelFigure(value)) {
      counts.set('sentinel', (counts.get('sentinel') ?? 0) + 1);
      continue;
    }
    const entry = stateFigureProvenance(definition, state, year, path);
    if (entry === undefined) continue;
    counts.set(entry.kind, (counts.get(entry.kind) ?? 0) + 1);
  }
  return counts;
};

/**
 * Every document in a state-year's `citations` that the ledger names as the
 * origin of a figure, in the order the state-year lists them.
 *
 * The complement — a citation no figure comes from — is not an error: a form
 * shows how a figure is applied, a fiscal note confirms one against a bill that
 * failed, and a press release announces one another document also carries.
 * What would be an error is a figure whose document the state-year does not
 * list, and that is asserted.
 */
export const documentsBehindFigures = (
  citations: readonly Citation[],
  state: StateCode,
  year: number,
): readonly Citation[] => {
  const needed = new Set(
    STATE_FIGURE_PROVENANCE.filter(
      (entry) =>
        entry.state === state &&
        entry.document !== undefined &&
        (entry.years === undefined || entry.years.includes(year)),
    ).map((entry) => entry.document as string),
  );
  return citations.filter((citation) => [...needed].some((token) => citation.title.includes(token)));
};

export { NO_TAX as NO_TAX_STATES_IN_LEDGER, STATUSES as LEDGER_FILING_STATUSES };
