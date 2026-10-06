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
 */
const YEAR_ENTRIES: readonly StateFigureSource[] = (
  [
    'AK', 'AL', 'AZ', 'CA', 'CO', 'CT', 'FL', 'GA', 'ID', 'IL', 'IN', 'KY', 'MA', 'MD', 'MI', 'MS',
    'MO', 'NC', 'NH', 'NJ', 'NV', 'NY', 'OH', 'PA', 'SD', 'TN', 'TX', 'UT', 'VA', 'WA', 'WY',
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
  // ARIZONA — one figure. The standard deduction is `kind: 'federal'`, so
  // Arizona stores no copy of it and there is nothing here to cite.
  // =========================================================================
  {
    state: 'AZ',
    path: 'rate.rate',
    kind: 'statute',
    document: '§ 43-1011',
    cite: 'Ariz. Rev. Stat. § 43-1011 — the 2.5% rate, flat since tax year 2023',
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
    path: 'compensationExclusions.*.cap',
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
    kind: 'statute',
    document: 'Mississippi Department of Revenue — tax rates',
    cite: 'Miss. Code Ann. § 27-7-17 as the Department\'s tax rates, exemptions and deductions page carries it — $2,300 / $4,600 / $3,400, fixed dollar amounts with no indexing provision',
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
    path: 'compensationExclusions.*.cap',
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
