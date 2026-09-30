import type { Citation } from '../types.js';

/**
 * The provisions of the Internal Revenue Code that this package reads a NUMBER
 * from, shared by every tax year.
 *
 * ## Why these are not in the per-year files
 *
 * Until Day 36 every citation in this package lived in the year it was written
 * for, and the result was the shape Day 33 found in the test suite: the newest
 * year got the attention and the years behind it got whatever had been written
 * by the time they were added. Tax year 2024 shipped with eight citations and
 * tax year 2026 with twenty-five, and the difference was not that 2024 reads
 * fewer provisions. It reads § 1411, § 199A, § 32, § 86, § 1401, § 1402,
 * § 3101 and § 3111 exactly as 2026 does, and cited none of them.
 *
 * **THE RULE: a citation list PER YEAR is the wrong shape for a source that is
 * not per year.** A Revenue Procedure is a document about one tax year and
 * belongs in that year's list. The Code is not, and a per-year list of statutes
 * is three chances to forget the same provision — which is what happened.
 *
 * So the statutes live here, once, and each year spreads them. What stays in a
 * year's own list is what is genuinely about that year: its Revenue Procedure,
 * its Publication 15-T, its wage base, and the public law that changed the year
 * it was enacted in.
 *
 * ## The rule for adding a row
 *
 * A row belongs here if `provenance.ts` names it as the source of a figure, or
 * if it states a rule the engine implements. `test/provenance.test.js` fails if
 * a ledger entry names a document no year carries, and fails the other way too:
 * a citation no figure and no allowlisted purpose accounts for is a citation
 * nobody can check anything against.
 */
export const CODE_SOURCES: readonly Citation[] = [
  {
    title: '26 U.S.C. § 1(h) — the maximum capital gains rate, and the brackets it applies in',
    url: 'https://www.law.cornell.edu/uscode/text/26/1',
  },
  {
    title: '26 U.S.C. § 1(j) — tax rate tables',
    url: 'https://www.law.cornell.edu/uscode/text/26/1',
  },
  {
    title:
      '26 U.S.C. § 1(f)(7) — rounding of inflation adjustments ($50, or $25 on a separate return)',
    url: 'https://www.law.cornell.edu/uscode/text/26/1',
  },
  {
    title:
      '26 U.S.C. § 24 — child tax credit, the $50-per-$1,000 phase-out, and § 24(d) refundability',
    url: 'https://www.law.cornell.edu/uscode/text/26/24',
  },
  {
    title:
      '26 U.S.C. § 32 — earned income credit, including § 32(b)(1)’s credit and phase-out percentages, § 32(c)(2) earned income and the § 32(i) investment income limit',
    url: 'https://www.law.cornell.edu/uscode/text/26/32',
  },
  {
    title: '26 U.S.C. § 63(c) — the standard deduction and the § 63(c)(4) inflation adjustment',
    url: 'https://www.law.cornell.edu/uscode/text/26/63',
  },
  {
    title: '26 U.S.C. § 63(f) — the additional standard deduction for the aged and the blind',
    url: 'https://www.law.cornell.edu/uscode/text/26/63',
  },
  {
    title:
      '26 U.S.C. § 86 — taxation of Social Security benefits; the four base amounts have never been indexed',
    url: 'https://www.law.cornell.edu/uscode/text/26/86',
  },
  {
    title:
      '26 U.S.C. § 164(b)(6) — state and local tax cap, its phase-down, and the modified AGI definition',
    url: 'https://www.law.cornell.edu/uscode/text/26/164',
  },
  {
    title: '26 U.S.C. § 199A — qualified business income',
    url: 'https://www.law.cornell.edu/uscode/text/26/199A',
  },
  {
    title: '26 U.S.C. § 1401 — self-employment tax rates',
    url: 'https://www.law.cornell.edu/uscode/text/26/1401',
  },
  {
    title:
      '26 U.S.C. § 1402 — net earnings from self-employment: the § 1402(a)(12) deduction that leaves 92.35%, and the § 1402(b)(2) $400 floor',
    url: 'https://www.law.cornell.edu/uscode/text/26/1402',
  },
  {
    title: '26 U.S.C. § 1411 — net investment income tax',
    url: 'https://www.law.cornell.edu/uscode/text/26/1411',
  },
  {
    title:
      '26 U.S.C. § 3101 — employee FICA rates and the § 3101(b)(2) Additional Medicare Tax thresholds',
    url: 'https://www.law.cornell.edu/uscode/text/26/3101',
  },
  {
    title:
      '26 U.S.C. § 3102(f) — Additional Medicare Tax is WITHHELD above $200,000 whatever the employee’s filing status',
    url: 'https://www.law.cornell.edu/uscode/text/26/3102',
  },
  {
    title: '26 U.S.C. § 3111 — employer FICA rates',
    url: 'https://www.law.cornell.edu/uscode/text/26/3111',
  },
  {
    title:
      '26 U.S.C. § 3121(a)(1) — the contribution and benefit base, which the Social Security Administration sets and the IRS does not publish',
    url: 'https://www.law.cornell.edu/uscode/text/26/3121',
  },
];

/**
 * The four Schedule 1-A deductions' own provisions, shared by the years they
 * exist in and deliberately absent from 2024.
 *
 * They are separated from {@link CODE_SOURCES} rather than merged into it
 * because a citation is a claim that a figure came from somewhere, and § 224
 * has nothing to say about a 2024 return. Spreading these into 2024 would make
 * its source list longer and less true at the same time.
 */
export const SCHEDULE_ONE_A_CODE_SOURCES: readonly Citation[] = [
  {
    title: '26 U.S.C. § 224 — qualified tips deduction',
    url: 'https://www.law.cornell.edu/uscode/text/26/224',
  },
  {
    title: '26 U.S.C. § 225 — qualified overtime compensation deduction',
    url: 'https://www.law.cornell.edu/uscode/text/26/225',
  },
  {
    title:
      '26 U.S.C. § 151(d)(5) — the additional deduction for taxpayers who have attained age 65',
    url: 'https://www.law.cornell.edu/uscode/text/26/151',
  },
  {
    title: '26 U.S.C. § 163(h)(4) — qualified passenger vehicle loan interest',
    url: 'https://www.law.cornell.edu/uscode/text/26/163',
  },
];
