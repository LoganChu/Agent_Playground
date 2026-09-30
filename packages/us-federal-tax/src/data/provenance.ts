/**
 * Where every number in this package came from, one entry per figure per year.
 *
 * ## Why this file exists
 *
 * The first line of this package's own description is that every figure is
 * "cited to the IRS release it came from". Until Day 36 that claim was a list of
 * URLs on each year and nothing connecting the two: `getYearParameters(2024)`
 * returned 240 numbers and 8 documents, with no statement anywhere — in code, in
 * a test, or in a comment — about which document any given number came from. So
 * the claim could not be checked, and it was false in a way nobody could see:
 * 2024 read § 1411, § 199A, § 32, § 86, § 1401, § 1402, § 3101 and § 3111 and
 * cited none of them.
 *
 * **THE RULE: a list of sources beside a list of figures is not provenance. The
 * mapping is the provenance, and it is the part nobody writes down.** It is also
 * the part that cannot rot silently once written, which is the whole reason to
 * write it: every assertion in `test/provenance.test.js` is about this mapping
 * and not about the figures.
 *
 * ## Why the source is a property of the figure AND the year
 *
 * A figure does not have one source. `standardDeduction` comes from the year's
 * Revenue Procedure in 2024 and 2026, and from **Pub. L. 119-21 § 70102** in
 * 2025, because OBBBA raised it in July of a year whose Revenue Procedure had
 * been published the previous October. Any ledger keyed on the figure alone
 * would have to pick one of those and be wrong for a year; a list keyed on the
 * year alone — which is what `sources` is — cannot say which of the year's
 * documents a figure came from.
 *
 * So an entry may be scoped to particular years, and a year-scoped entry beats
 * an unscoped one for the years it names.
 *
 * ## The six kinds, and why each is a different question
 *
 * The kind is not a label on the document; it answers **what a new tax year
 * costs**, which is the only operational question a ledger like this can settle:
 *
 * | kind | what a new year requires |
 * | --- | --- |
 * | `indexed` | read that year's Revenue Procedure |
 * | `statute` | nothing; a change here is an amendment, and news |
 * | `statute-scheduled` | read the statute's own table for the new year |
 * | `agency` | read the other agency's release — the IRS does not publish it |
 * | `withholding-methods` | read that year's Publication 15-T |
 * | `reconstructed` | READ THE DOCUMENT. This figure was never in one. |
 *
 * `reconstructed` is this package's federal answer to the state engine's
 * `provisional` flag, and it has exactly one member: the 2026 withholding
 * amounts, which were computed from the 2026 Revenue Procedure by the identity
 * that reproduces 2024 and 2025 exactly, because Publication 15-T for 2026 could
 * not be read from here. Day 31's rule applies — "nobody read it" is a different
 * answer from "the document says no" — and the difference belongs in the data,
 * not in a comment.
 */
import type { Citation } from '../types.js';
import { YEARS } from '../core.js';

/** What kind of authority publishes a figure, and therefore what a new tax year costs. */
export type FigureSourceKind =
  /** The IRS inflation-adjustment Revenue Procedure for that tax year publishes it. */
  | 'indexed'
  /** The Code states the figure, and no adjustment provision moves it. */
  | 'statute'
  /** The Code states a *different* figure for different years, on its own schedule. */
  | 'statute-scheduled'
  /** Published by an agency other than the IRS — in this package, always the SSA. */
  | 'agency'
  /** Publication 15-T, which is neither the Code nor the year's Revenue Procedure. */
  | 'withholding-methods'
  /** Not read from any document: computed from figures that were, because the document could not be read. */
  | 'reconstructed';

/** One claim about where a figure came from. */
export interface FigureSource {
  /**
   * Dot path into {@link YearParameters}, where `*` matches one segment and `**`
   * matches every remaining segment. `ordinaryBrackets.*.*.upTo` is every
   * bracket ceiling in every filing status.
   */
  readonly path: string;
  readonly kind: FigureSourceKind;
  /**
   * A substring of the title of the citation in that year's `sources` that
   * publishes this figure — `'Rev. Proc.'`, `'§ 3101'`, `'Publication 15-T'`.
   * Checked to appear in every year the entry covers, so a figure cannot cite a
   * document the year does not carry.
   */
  readonly document: string;
  /**
   * For a figure whose NUMBER comes from one document and whose EXISTENCE comes
   * from another — every indexed figure — the token for the provision that
   * creates it. Both must appear in the year's `sources`.
   *
   * An indexed figure has two documents and needs both: the Revenue Procedure
   * says what the number is this year and says nothing about what it is for, and
   * the provision says what it is for and nothing about this year.
   */
  readonly provision?: string;
  /** The provision, worksheet line or table the figure is read from. */
  readonly cite: string;
  /**
   * Claim: every figure this entry covers is identical in every year it covers.
   * Checked against the data in both directions — a `false` entry whose figures
   * never move is as much a defect as a `true` one whose figures do.
   */
  readonly constant: boolean;
  /** The years this entry covers. Absent means every year the path exists in. */
  readonly years?: readonly number[];
  /**
   * Required where the claim is surprising: an `indexed` figure that has not
   * moved, or a `statute` figure that has. An indexed figure sitting still is
   * the exact shape of a silent carry-forward, so this package will not let one
   * pass without a sentence saying why it is not one.
   */
  readonly why?: string;
  /** For `reconstructed`: the year the figure was copied from, if it was copied. */
  readonly carriedForwardFrom?: number;
  /** For `reconstructed`: the document that would settle it, named specifically enough to find. */
  readonly resolvedBy?: string;
}

/**
 * The ledger. Every numeric parameter of every supported year is covered by
 * exactly one of these entries — `test/provenance.test.js` walks the parameters
 * and fails on any number no entry claims, and on any entry no number needs.
 */
export const FEDERAL_FIGURE_PROVENANCE: readonly FigureSource[] = [
  // -------------------------------------------------------------------------
  // Rate schedules. The rates are the statute's and the ceilings are indexed,
  // which is why they cannot share an entry: § 1(j)(2) prints 10/12/22/24/32/35/37
  // and a Revenue Procedure has never moved one of them.
  // -------------------------------------------------------------------------
  {
    path: 'ordinaryBrackets.*.*.rate',
    kind: 'statute',
    document: '§ 1(j)',
    cite: '§ 1(j)(2) — the seven statutory rates',
    constant: true,
  },
  {
    path: 'ordinaryBrackets.*.*.upTo',
    kind: 'indexed',
    document: 'Rev. Proc.',
    provision: '§ 1(j)',
    cite: '§ 1(j)(2) rate tables, adjusted under § 1(j)(3) — the bracket ceilings the Revenue Procedure prints',
    constant: false,
  },
  {
    path: 'longTermCapitalGains.*.*.rate',
    kind: 'statute',
    document: '§ 1(h)',
    cite: '§ 1(h)(1) — 0%, 15% and 20%',
    constant: true,
  },
  {
    path: 'longTermCapitalGains.*.*.upTo',
    kind: 'indexed',
    document: 'Rev. Proc.',
    provision: '§ 1(h)',
    cite: '§ 1(h)(1)(B)-(C) — the maximum zero rate amount and the maximum 15-percent rate amount, adjusted for inflation and printed in the Revenue Procedure',
    constant: false,
  },

  // -------------------------------------------------------------------------
  // The standard deduction, and the year OBBBA overrode the Revenue Procedure.
  // -------------------------------------------------------------------------
  {
    path: 'standardDeduction.*',
    kind: 'indexed',
    document: 'Rev. Proc.',
    provision: '§ 63(c)',
    cite: '§ 63(c)(2) with the § 63(c)(4) adjustment',
    constant: false,
  },
  {
    path: 'standardDeduction.*',
    years: [2025],
    kind: 'statute-scheduled',
    document: 'Pub. L. 119-21 § 70102',
    cite:
      'Pub. L. 119-21 § 70102 — $15,750 / $31,500 / $23,625, enacted in July 2025 for a tax year whose Revenue Procedure was published in October 2024',
    constant: false,
    why:
      'The 2025 figure is NOT Rev. Proc. 2024-40’s. This is the one place in the package where a statute overrides that year’s own Revenue Procedure, and the withholding tables never caught up: see `withholding.standardDeduction`.',
  },
  {
    path: 'additionalStandardDeduction.*',
    kind: 'indexed',
    document: 'Rev. Proc.',
    provision: '§ 63(f)',
    cite: '§ 63(f) with the § 63(c)(4) adjustment — per qualifying condition, aged or blind',
    constant: false,
  },

  // -------------------------------------------------------------------------
  // Payroll and self-employment. Every rate here is in the Code; the only
  // figure that moves is the wage base, and the IRS does not publish it.
  // -------------------------------------------------------------------------
  {
    path: 'socialSecurityWageBase',
    kind: 'agency',
    document: 'SSA',
    provision: '§ 3121(a)(1)',
    cite:
      '§ 3121(a)(1) contribution and benefit base, announced by the SSA with the annual COLA in October',
    constant: false,
  },
  {
    path: 'rates.socialSecurityEmployee',
    kind: 'statute',
    document: '§ 3101',
    cite: '§ 3101(a) — 6.2%',
    constant: true,
  },
  {
    path: 'rates.medicareEmployee',
    kind: 'statute',
    document: '§ 3101',
    cite: '§ 3101(b)(1) — 1.45%',
    constant: true,
  },
  {
    path: 'rates.additionalMedicare',
    kind: 'statute',
    document: '§ 3101',
    cite: '§ 3101(b)(2) — 0.9%, written by the ACA and never indexed',
    constant: true,
  },
  {
    path: 'rates.socialSecurityEmployer',
    kind: 'statute',
    document: '§ 3111',
    cite: '§ 3111(a) — 6.2%, matched',
    constant: true,
  },
  {
    path: 'rates.medicareEmployer',
    kind: 'statute',
    document: '§ 3111',
    cite: '§ 3111(b) — 1.45%, matched; the employer does not match the Additional Medicare Tax',
    constant: true,
  },
  {
    path: 'rates.seSocialSecurity',
    kind: 'statute',
    document: '§ 1401',
    cite: '§ 1401(a) — 12.4%, both halves',
    constant: true,
  },
  {
    path: 'rates.seMedicare',
    kind: 'statute',
    document: '§ 1401',
    cite: '§ 1401(b)(1) — 2.9%, both halves',
    constant: true,
  },
  {
    path: 'additionalMedicareThreshold.*',
    kind: 'statute',
    document: '§ 3101',
    cite: '§ 3101(b)(2)(A)-(C) — $250,000 joint, $125,000 separate, $200,000 otherwise',
    constant: true,
  },
  {
    path: 'seNetEarningsFactor',
    kind: 'statute',
    document: '§ 1402',
    cite: '§ 1402(a)(12) — a deduction of 7.65% of net earnings, so 92.35% remains',
    constant: true,
  },
  {
    path: 'seMinimumNetEarnings',
    kind: 'statute',
    document: '§ 1402',
    cite: '§ 1402(b)(2) — no self-employment tax below $400 of net earnings',
    constant: true,
  },

  // -------------------------------------------------------------------------
  // Net investment income tax. Thresholds in the statute, never indexed, which
  // is why the tax reaches more people every year without being changed.
  // -------------------------------------------------------------------------
  {
    path: 'niit.rate',
    kind: 'statute',
    document: '§ 1411',
    cite: '§ 1411(a)(1) — 3.8%',
    constant: true,
  },
  {
    path: 'niit.thresholds.*',
    kind: 'statute',
    document: '§ 1411',
    cite: '§ 1411(b) — $250,000 joint and surviving spouse, $125,000 separate, $200,000 otherwise',
    constant: true,
  },

  // -------------------------------------------------------------------------
  // § 199A. Four percentages in the statute, one indexed threshold, and a
  // phase-in range Congress widened on a schedule.
  // -------------------------------------------------------------------------
  {
    path: 'section199A.deductionRate',
    kind: 'statute',
    document: '§ 199A',
    cite: '§ 199A(a) — 20% of qualified business income',
    constant: true,
  },
  {
    path: 'section199A.w2WageRate',
    kind: 'statute',
    document: '§ 199A',
    cite: '§ 199A(b)(2)(B)(i) — 50% of W-2 wages',
    constant: true,
  },
  {
    path: 'section199A.w2WageAlternativeRate',
    kind: 'statute',
    document: '§ 199A',
    cite: '§ 199A(b)(2)(B)(ii) — 25% of W-2 wages, plus',
    constant: true,
  },
  {
    path: 'section199A.qualifiedPropertyRate',
    kind: 'statute',
    document: '§ 199A',
    cite: '§ 199A(b)(2)(B)(ii) — 2.5% of unadjusted basis',
    constant: true,
  },
  {
    path: 'section199A.thresholdAmount.*',
    kind: 'indexed',
    document: 'Rev. Proc.',
    provision: '§ 199A',
    cite: '§ 199A(e)(2) — the threshold amount, adjusted under § 199A(e)(2)(B)',
    constant: false,
  },
  {
    path: 'section199A.phaseInRange.*',
    kind: 'statute-scheduled',
    document: '§ 199A',
    cite:
      '§ 199A(b)(3)(B)(ii) as amended by Pub. L. 119-21 § 70105(b) — $50,000 / $100,000 through 2025, $75,000 / $150,000 after',
    constant: false,
    why:
      'The range is a statutory constant that Congress replaced, not an indexed one: it sat at $50,000 for eight years and then moved $25,000 in a single step.',
  },
  {
    path: 'section199A.minimumDeduction.**',
    years: [2026],
    kind: 'statute',
    document: '§ 199A',
    cite:
      '§ 199A(i) as added by Pub. L. 119-21 § 70105(c) — a $400 minimum deduction where active QBI is at least $1,000, first available in 2026',
    constant: true,
  },

  // -------------------------------------------------------------------------
  // The SALT cap. A statutory schedule throughout: $10,000 flat, then a raised
  // cap indexed 1% a year by the statute itself rather than by a Revenue
  // Procedure, which is why this is `statute-scheduled` and not `indexed`.
  // -------------------------------------------------------------------------
  {
    path: 'saltCap.cap.*',
    kind: 'statute-scheduled',
    document: '§ 164(b)(6)',
    cite:
      '§ 164(b)(6)(B) as amended by Pub. L. 119-21 § 70120 — $10,000 through 2024, $40,000 for 2025, then 101% of the prior year',
    constant: false,
  },
  {
    path: 'saltCap.floor.*',
    kind: 'statute',
    document: '§ 164(b)(6)',
    cite: '§ 164(b)(6)(B)(ii) — the phase-down never reduces the cap below $10,000 ($5,000 separate)',
    constant: true,
  },
  {
    path: 'saltCap.phaseDownRate',
    kind: 'statute-scheduled',
    document: '§ 164(b)(6)',
    cite: '§ 164(b)(6)(B)(i) — 30% of modified AGI above the threshold; no phase-down existed before 2025',
    constant: false,
  },
  {
    path: 'saltCap.phaseDownThreshold.*',
    kind: 'statute-scheduled',
    document: '§ 164(b)(6)',
    cite: '§ 164(b)(6)(B)(i) — $500,000 for 2025, then 101% of the prior year; Infinity before 2025',
    constant: false,
  },
  {
    path: 'saltCap.finalYear',
    kind: 'statute-scheduled',
    document: '§ 164(b)(6)',
    cite: '§ 164(b)(6) — the raised cap applies through 2029; 2024 carries the pre-OBBBA regime',
    constant: false,
  },

  // -------------------------------------------------------------------------
  // § 24. Two figures Congress set, one it indexed from 2026, and one indexed
  // figure that has not moved in three years for a reason worth writing down.
  // -------------------------------------------------------------------------
  {
    path: 'childTaxCredit.amountPerChild',
    kind: 'statute-scheduled',
    document: '§ 24',
    cite:
      '§ 24(h)(2) at $2,000 through 2024; § 24(a) as amended by Pub. L. 119-21 § 70104 at $2,200 from 2025, indexed after 2025',
    constant: false,
  },
  {
    path: 'childTaxCredit.amountPerOtherDependent',
    kind: 'statute',
    document: '§ 24',
    cite: '§ 24(h)(4) — $500 for each dependent who is not a qualifying child, never indexed',
    constant: true,
  },
  {
    path: 'childTaxCredit.maximumChildAge',
    kind: 'statute',
    document: '§ 24',
    cite: '§ 24(c)(1) — a qualifying child has not attained age 17',
    constant: true,
  },
  {
    path: 'childTaxCredit.phaseOut.amountPerIncrement',
    kind: 'statute',
    document: '§ 24',
    cite: '§ 24(b)(1) — $50 for each $1,000',
    constant: true,
  },
  {
    path: 'childTaxCredit.phaseOut.increment',
    kind: 'statute',
    document: '§ 24',
    cite: '§ 24(b)(1) — each $1,000 "or fraction thereof", which is why the rounding is up',
    constant: true,
  },
  {
    path: 'childTaxCredit.phaseOut.thresholds.*',
    kind: 'statute',
    document: '§ 24',
    cite: '§ 24(b)(2) — $400,000 on a joint return, $200,000 otherwise, with no adjustment provision',
    constant: true,
  },
  {
    path: 'childTaxCredit.refundable.maximumPerChild',
    kind: 'indexed',
    document: 'Rev. Proc.',
    provision: '§ 24',
    cite: '§ 24 as amended by Pub. L. 119-21 § 70104 — the maximum refundable portion, indexed and rounded down to a multiple of $100',
    constant: true,
    why:
      '$1,700 in all three years, and NOT a carry-forward: the adjustment is rounded DOWN to a multiple of $100, so the figure holds until the unrounded amount clears $1,800. Each year’s value was read from that year’s Revenue Procedure, which is the only thing that distinguishes this from the failure it looks like.',
  },
  {
    path: 'childTaxCredit.refundable.phaseInRate',
    kind: 'statute',
    document: '§ 24',
    cite: '§ 24(d)(1)(B)(i) — 15% of earned income above the floor',
    constant: true,
  },
  {
    path: 'childTaxCredit.refundable.phaseInThreshold',
    kind: 'statute',
    document: '§ 24',
    cite: '§ 24(d)(1)(B)(i) — the $2,500 floor, un-indexed since the TCJA wrote it',
    constant: true,
  },
  {
    path: 'childTaxCredit.refundable.minimumChildrenForSocialSecurityAlternative',
    kind: 'statute',
    document: '§ 24',
    cite:
      '§ 24(d)(1)(B)(ii) — with three or more qualifying children the refundable portion may instead be computed from Social Security taxes paid',
    constant: true,
  },

  // -------------------------------------------------------------------------
  // § 32. The percentages are the 1996 table's; every dollar amount is indexed.
  // -------------------------------------------------------------------------
  {
    path: 'earnedIncomeCredit.table.*.creditRate',
    kind: 'statute',
    document: '§ 32',
    cite: '§ 32(b)(1) — 7.65%, 34%, 40%, 45% by number of qualifying children',
    constant: true,
  },
  {
    path: 'earnedIncomeCredit.table.*.phaseOutRate',
    kind: 'statute',
    document: '§ 32',
    cite: '§ 32(b)(1) — 7.65%, 15.98%, 21.06%, and 21.06% again for three or more',
    constant: true,
  },
  {
    path: 'earnedIncomeCredit.table.*.maximumCredit',
    kind: 'indexed',
    document: 'Rev. Proc.',
    provision: '§ 32',
    cite: '§ 32(j) adjustment of the § 32(b)(2)(A) earned income amount, as the credit it produces',
    constant: false,
  },
  {
    path: 'earnedIncomeCredit.table.*.phaseOutStart.*',
    kind: 'indexed',
    document: 'Rev. Proc.',
    provision: '§ 32',
    cite: '§ 32(j) adjustment of the § 32(b)(2)(A) phase-out amount, plus the § 32(b)(2)(B) joint add-on',
    constant: false,
  },
  {
    path: 'earnedIncomeCredit.maximumInvestmentIncome',
    kind: 'indexed',
    document: 'Rev. Proc.',
    provision: '§ 32',
    cite: '§ 32(i)(1) with the § 32(j) adjustment — the disqualified investment income cliff',
    constant: false,
  },
  {
    path: 'earnedIncomeCredit.childlessAgeRange.*',
    kind: 'statute',
    document: '§ 32',
    cite: '§ 32(c)(1)(A)(ii)(II) — at least 25 and under 65, with no qualifying children',
    constant: true,
  },

  // -------------------------------------------------------------------------
  // § 86. The only block in the package that is one object shared by every
  // year, because the four thresholds have never been indexed in forty years.
  // -------------------------------------------------------------------------
  {
    path: 'socialSecurity.**',
    kind: 'statute',
    document: '§ 86',
    cite:
      '§ 86(a)-(c) — the fractions, and the base amounts of $25,000/$32,000 (1983) and $34,000/$44,000 (1993), with no adjustment provision anywhere in the section',
    constant: true,
  },

  // -------------------------------------------------------------------------
  // Publication 15-T. A separate document on a separate calendar, and the one
  // place where this package holds two different answers to the same question.
  // -------------------------------------------------------------------------
  {
    path: 'withholding.standardDeduction.*',
    kind: 'withholding-methods',
    document: 'Publication 15-T',
    cite: 'Publication 15-T, Worksheet 1A line 1c — the annual standard deduction built into the tables',
    constant: false,
    why:
      'Not the same figure as `standardDeduction` in 2025: Publication 15-T for 2025 was published in December 2024 and never reissued after OBBBA raised the deduction in July, so withholding ran on $15,000 where the return used $15,750.',
  },
  {
    path: 'withholding.standardDeduction.*',
    years: [2026],
    kind: 'reconstructed',
    document: 'Rev. Proc.',
    cite:
      'derived from Rev. Proc. 2025-32’s standard deduction by the identity that reproduces the 2024 and 2025 tables exactly',
    constant: false,
    resolvedBy:
      'IRS Publication 15-T (2026), Worksheet 1A line 1c — the annual standard deduction built into the 2026 percentage-method tables. The document IS published, at https://www.irs.gov/pub/irs-pdf/p15t.pdf; irs.gov is blocked by this sandbox’s network policy, which is a third state worth distinguishing from both "not published yet" and "read and disagrees".',
    why:
      'Publication 15-T for 2026 exists and could not be READ from here. The figure is the Revenue Procedure’s post-OBBBA deduction, which is what 2024 and 2026 have in common and what 2025 does not — so this is a reconstruction that a reading of the document could still falsify, and the identity behind it reproduces every threshold the IRS published for 2024 and 2025.',
  },
  {
    path: 'withholding.step1gAmount.*',
    kind: 'withholding-methods',
    document: 'Publication 15-T',
    cite: 'Publication 15-T, Worksheet 1A line 1g — $12,900 on a joint return, $8,600 otherwise',
    constant: true,
    why:
      'Not an indexed figure and not really an independent one: it is `builtInAllowances × allowanceAmount` — three and two withholding allowances at the frozen $4,300 rate — because the percentage-method tables were built for the pre-2020 Form W-4 and its default allowances. `withholding.test.js` asserts that product, so the three parameters cannot drift apart.',
  },
  {
    path: 'withholding.allowanceAmount',
    kind: 'withholding-methods',
    document: 'Publication 15-T',
    cite: 'Publication 15-T, Worksheet 1B — $4,300 per allowance claimed on a pre-2020 Form W-4',
    constant: true,
    why:
      'Frozen at the 2019 personal exemption figure, and the reason it cannot move: a pre-2020 Form W-4 states a NUMBER OF ALLOWANCES, so indexing what one is worth would change what a form already on file means. It is also the multiplicand behind `step1gAmount`.',
  },
  {
    path: 'withholding.builtInAllowances.*',
    kind: 'withholding-methods',
    document: 'Publication 15-T',
    cite: 'Publication 15-T, Worksheet 1B — the allowances already built into the tables: 3 joint, 2 otherwise',
    constant: true,
    why: 'A count of allowances, not a dollar amount; nothing indexes a count.',
  },
  {
    path: 'withholding.additionalMedicareWithholdingThreshold',
    kind: 'statute',
    document: '§ 3102(f)',
    cite:
      '§ 3102(f)(1) — an employer withholds Additional Medicare Tax above $200,000 of wages regardless of the employee’s filing status, which is why a joint couple under $250,000 can be over-withheld',
    constant: true,
  },

  // -------------------------------------------------------------------------
  // Schedule 1-A. Four deductions, four provisions, one sunset. Nothing here is
  // indexed: every figure is a number Congress wrote for 2025 through 2028.
  // -------------------------------------------------------------------------
  {
    path: 'scheduleOneA.finalYear',
    years: [2025, 2026],
    kind: 'statute-scheduled',
    document: 'Pub. L. 119-21',
    cite: 'Pub. L. 119-21 §§ 70201, 70202, 70103, 70203 — each deduction applies to 2025 through 2028',
    constant: true,
  },
  {
    path: 'scheduleOneA.tips.**',
    years: [2025, 2026],
    kind: 'statute',
    document: '§ 224',
    cite: '§ 224 — a $25,000 cap, reduced by $100 per full $1,000 of MAGI above $150,000 ($300,000 joint)',
    constant: true,
  },
  {
    path: 'scheduleOneA.overtime.**',
    years: [2025, 2026],
    kind: 'statute',
    document: '§ 225',
    cite: '§ 225 — $12,500 ($25,000 joint), on the same phase-out as § 224',
    constant: true,
  },
  {
    path: 'scheduleOneA.senior.**',
    years: [2025, 2026],
    kind: 'statute',
    document: '§ 151(d)(5)',
    cite:
      '§ 151(d)(5)(C) — $6,000 per individual who has attained 65, withdrawn at 6% of MAGI above $75,000 ($150,000 joint)',
    constant: true,
  },
  {
    path: 'scheduleOneA.vehicleLoanInterest.**',
    years: [2025, 2026],
    kind: 'statute',
    document: '§ 163(h)(4)',
    cite:
      '§ 163(h)(4) — $10,000, reduced by $200 per $1,000 "or portion thereof" above $100,000 ($200,000 joint)',
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

/** How specific a pattern is: literal segments first, then whether it names years. */
const specificity = (entry: FigureSource): readonly [number, number] => [
  entry.path.split('.').filter((segment) => segment !== '*' && segment !== '**').length,
  entry.years === undefined ? 0 : 1,
];

/**
 * The ledger entry that accounts for one figure in one year, or `undefined` if
 * no entry does.
 *
 * Where two entries match, the one with more literal path segments wins, and a
 * year-scoped entry beats an unscoped one — which is how 2025's standard
 * deduction comes back citing the public law rather than the Revenue Procedure.
 * A tie between two entries of equal specificity is a defect in the ledger, not
 * something to resolve at lookup time, and `test/provenance.test.js` fails on
 * one rather than letting this function pick.
 */
export const figureProvenance = (
  path: string,
  year: number,
): FigureSource | undefined => {
  // A pattern matches a SHAPE, so `standardDeduction.singl` matches
  // `standardDeduction.*` as readily as the real field does. Day 32's rule —
  // accepting an input is not reading it — so the path is resolved against the
  // year before any pattern is tried, and a figure that is not there has no
  // provenance rather than a confident citation.
  if (typeof at(YEARS[year], path) !== 'number') return undefined;
  let best: FigureSource | undefined;
  let bestRank: readonly [number, number] = [-1, -1];
  for (const entry of FEDERAL_FIGURE_PROVENANCE) {
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
export const figureProvenanceMatches = matches;

/**
 * Every document in a year's `sources` that the ledger names as the origin of a
 * figure, in the order the year lists them.
 *
 * The complement — a citation no figure needs — is not an error. A form shows
 * how a figure is applied and a corrected instruction says what an earlier
 * document got wrong; neither publishes a number. What would be an error is a
 * figure whose document the year does not carry, and that is asserted.
 */
export const documentsBehindFigures = (
  sources: readonly Citation[],
  year: number,
): readonly Citation[] => {
  const covering = FEDERAL_FIGURE_PROVENANCE.filter(
    (entry) => entry.years === undefined || entry.years.includes(year),
  );
  const needed = new Set([
    ...covering.map((entry) => entry.document),
    ...covering.flatMap((entry) => (entry.provision === undefined ? [] : [entry.provision])),
  ]);
  return sources.filter((source) => [...needed].some((token) => source.title.includes(token)));
};
