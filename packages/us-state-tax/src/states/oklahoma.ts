/**
 * Oklahoma — the twenty-ninth taxing state, the largest jurisdiction this
 * package had left, and the one whose most expensive parameter is a date.
 *
 * ## Six brackets became four, and the row the legislature does not count is the one that decides most returns
 *
 * HB 2764 of the 2025 regular session rewrote 68 O.S. § 2355(C) for tax years
 * beginning on or after 1 January 2026. Every account of it — the Senate's own
 * press release, the fiscal note, every secondary summary — says the same thing:
 * **"consolidates six income tax brackets into three"** and cuts the top rate
 * from 4.75% to 4.5%.
 *
 * The published schedule has **four** rows.
 *
 * ```text
 *   single and married filing separately
 *
 *     2025                                 2026
 *     0.25%   on the first    1,000        0%      on the first    3,750
 *     0.75%   1,000 to        2,500        2.5%    3,750 to        4,900
 *     1.75%   2,500 to        3,750        3.5%    4,900 to        7,200
 *     2.75%   3,750 to        4,900        4.5%    over            7,200
 *     3.75%   4,900 to        7,200
 *     4.75%   over            7,200
 * ```
 *
 * The fourth row is a **0% band**, and it is the half of HB 2764 that no summary
 * leads with. "Three brackets" counts the rows that charge something; a filer
 * reads the row that charges nothing. A single filer's first `$3,750` of 2026
 * Oklahoma taxable income is untaxed where in 2025 it cost `$35.63`, and the
 * band is a BRACKET rather than a deduction, so it sits in {@link RateRule}
 * `brackets` beside North Dakota's, Mississippi's and Idaho's.
 *
 * > **A RATE SCHEDULE IS NOT THE NUMBER OF BRACKETS SOMEBODY COUNTED.** Three
 * > positive rates and a zero band are four rows, and a package that believed
 * > the press release would have put 2.5% on the first dollar.
 *
 * ## Every rate fell by exactly 0.25 points, and the thresholds did not move at all
 *
 * This is the structural fact worth storing, because it makes the whole reform
 * checkable in one line: the three surviving bands kept their 2025 thresholds —
 * `$3,750`, `$4,900`, `$7,200` — and each of their rates fell by exactly 0.25
 * percentage points (2.75 → 2.5, 3.75 → 3.5, 4.75 → 4.5). The three bottom
 * bands, at 0.25%, 0.75% and 1.75%, were replaced by one band at zero.
 *
 * One consequence is worth having in front of you: **any error expressed as a
 * difference between two Oklahoma rates is the same number in both years.**
 * Subtracting a constant from every rate leaves every gap between adjacent
 * rates alone, so a wrong threshold costs the same in 2025 and 2026 — see the
 * `$22` below, which is `$22` in both.
 *
 * ## The joint column is exactly twice the single one, and this module stores both
 *
 * At every threshold, in both years, without rounding:
 *
 * ```text
 *   single      1,000   2,500   3,750   4,900   7,200       3,750   4,900   7,200
 *   joint       2,000   5,000   7,500   9,800  14,400       7,500   9,800  14,400
 * ```
 *
 * North Dakota's separate column was half its joint column in four published
 * years and this package refused to derive it, because no document it could
 * read stated the relation. Louisiana's joint deduction is 200% of its single
 * one and this package DOES derive it, because R.S. 47:294(A)(2) says so in
 * words.
 *
 * Oklahoma is the third case and it is neither: § 2355(C)(1)(a) and (C)(2)(a)
 * are two subsections that each **write their own dollar amounts out
 * incrementally** — `$1,000 + $1,500 + $1,250 + $1,150 + $2,300` and
 * `$2,000 + $3,000 + $2,500 + $2,300 + $4,600`. The law states two tables. It
 * does not state a relation between them.
 *
 * > **A RELATION VISIBLE IN A TABLE IS NOT A RELATION THE LAW STATES** — and
 * > where the law states the two tables separately, storing both is not
 * > duplication, it is transcription. `test/oklahoma.test.js` asserts the
 * > doubling as an observation about the published schedules, which is where a
 * > relation nobody legislated belongs.
 *
 * ## Head of household files on the JOINT rate schedule and keeps its own smaller deduction
 *
 * § 2355(C)(2) covers married filing jointly, a surviving spouse **and head of
 * household** in one subsection, so a single parent gets the wide brackets. They
 * do not get the wide deduction: the standard deduction is `$9,350` against a
 * joint return's `$12,700`, and the aged exemption's income limit is `$19,000`
 * against `$25,000`.
 *
 * Oklahoma is therefore a state where head of household is the joint column on
 * one table and a column of its own on the other two, and a model that maps the
 * status once, at the top, gets two of the three wrong.
 *
 * ## THE MOST EXPENSIVE PARAMETER IN THIS STATE IS A DATE, AND IT IS WHY THE EITC IS NOT MODELLED
 *
 * 68 O.S. § 2357.43 gives Oklahoma an earned income credit of 5% of the federal
 * one — and computed under **the Internal Revenue Code as it existed on 31
 * December 2020.** The federal credit is indexed every year. Oklahoma's base is
 * frozen in 2020 and has been for five tax years.
 *
 * ```text
 *   max federal EITC        2020 (Oklahoma's base)   2025        2026
 *   no children                            538        649         664
 *   one child                            3,584      4,328       4,427
 *   two children                         5,920      7,152       7,316
 *   three or more                        6,660      8,046       8,231
 *
 *   5% of the gap — what "5% of the federal EITC" overstates by
 *   no children                                      5.55        6.30
 *   one child                                       37.20       42.15
 *   two children                                    61.60       69.80
 *   three or more                                   69.30       78.55
 * ```
 *
 * A three-child Oklahoma family at the plateau is owed `$333.00` and a model
 * that reads this year's federal credit gives them `$402.30` — **20.8% too much
 * in 2025 and 23.6% too much in 2026, and the error grows every year by
 * construction**, because one side of the comparison is indexed and the other
 * is a date. The 2025 and 2026 federal maxima above are read out of
 * `us-federal-tax`'s own `src/data`, and
 * `tools/cross-package/oklahoma-frozen-eitc.mjs` asserts the whole table and the
 * growth on every push — which is the only place in this repository where that
 * claim can be made, because the frozen year and the indexed years live in two
 * different packages.
 *
 * So this module declares **no `earnedIncomeCredit`**, and the reason is the
 * house rule rather than fatigue: `matchRate: 0.05` would read
 * {@link FederalBasis.earnedIncomeCredit}, which is this year's credit, and ship
 * a number known to be a fifth too large for the households that need it most.
 * An Oklahoma return computed here is too HIGH by the whole credit — at most
 * `$333.00` in 2025 — and the note says so with the table. What this rule wants
 * is an input nobody has yet: the federal credit **under 2020 law**.
 *
 * ## Military retired pay is out in full and does NOT eat the $10,000
 *
 * Two subsections of § 2358 and two lines of Schedule 511-A:
 *
 * - **(A)(8)**, up to `$10,000` **per person**, of retirement benefits — a
 *   pension, a 401(k) or other retirement distribution, and a Roth conversion.
 *   **There is no age test.** Oklahoma's `$10,000` is not a senior benefit; it
 *   belongs to anyone with retirement income in their own name, which makes it
 *   the only such exclusion in this package available to a 45-year-old. Several
 *   published guides describe it as "up to `$10,000` for retirees 65 and older",
 *   and one as `$25,000`; both are wrong.
 * - **(E)(17)**, 100% of retired pay from any component of the armed forces,
 *   since tax year 2022 — it was the greater of 75% or `$10,000` before — with
 *   no age test and no ceiling.
 *
 * And nothing reduces either by the other. That is the whole content of
 * {@link RetirementIncomeSubtractionRule.militaryExemptOutsideCap}, which is the
 * flag Day 50 deleted: South Carolina's § 12-6-1170(C)(1) explicitly charges its
 * military deduction against its cap, so the flag had one setter and that setter
 * was a misreading. Oklahoma has no such provision, three independent readings
 * say the `$10,000` survives a military retirement in full, and the reference
 * model sums the two with no interaction term. `$10,000` of exclusion, `$475` of
 * 2025 tax, and visible only on a return that has military retired pay **and**
 * another pension behind it.
 *
 * ## The standard deduction has not moved since 2017, and it is the single biggest thing about this state
 *
 * `$6,350` single, `$12,700` joint, `$9,350` head of household. Those are the
 * **federal 2017** amounts, and Oklahoma decoupled from the federal figure when
 * the Tax Cuts and Jobs Act nearly doubled it rather than following it up. There
 * is no indexing provision, and the figures are the same in 2021, 2025 and 2026.
 *
 * The federal single standard deduction is `$15,750` in 2025 and `$16,100` in
 * 2026. So a published guide that says "Oklahoma mirrors the federal standard
 * deduction" — and one does, with those exact figures — is wrong by `$9,400` of
 * deduction in 2025 and `$9,750` in 2026: **`$446.50` and `$438.75` of tax, in
 * the direction that understates what the filer owes.** That is nine hundred
 * times the size of North Dakota's `$0.49`, and it is the same kind of error:
 * a figure assumed to track a federal one that stopped tracking it.
 *
 * ## Sourcing, stated plainly
 *
 * `oklahoma.gov`, `oklegislature.gov`, `oscn.net`, `law.justia.com` and
 * `law.cornell.edu` are all refused by this sandbox's egress policy, which Day
 * 61 established is an allowlist carrying six package registries and Anthropic's
 * API and nothing else. This is the fourteenth consecutive run to record a
 * blocked primary source, and the first to establish that `WebFetch` is not a
 * way round it: that tool resolves DNS in this container, so it fails with
 * `ENOTFOUND` on the same hosts `curl` does.
 *
 * The route is Day 45's. Both years' schedules are corroborated three ways:
 * `policyengine-us` 2.65.0's parameter files, which cite Form 511 packet page 27
 * for 2025 and HB 2764 page 11 for 2026 by name; server-side search's reading of
 * the Form 511 packet itself for the deduction and exemption figures; and two
 * independent commercial tables per year that agree figure for figure.
 *
 * **And the arithmetic discriminated, which on North Dakota it could not.** Two
 * third-party tables give the joint top threshold as `$12,200` rather than
 * `$14,400`. `$12,200` is refutable from the published schedule alone: the
 * fourth joint threshold is `$9,800`, which is exactly twice the single
 * `$4,900`, and § 2355(C)(2)(a)'s own increments sum to `$14,400`. It is also
 * exactly the value `policyengine-us` itself carried until it corrected the
 * figure in 2024 — so the two sites are a stale reference dataset with a
 * five-year echo. The error is `$22.00` of tax, in both years, for the reason
 * given above.
 */
import type { StateIncomeTaxDefinition } from '../definition.js';
import { byStatus, byStatusOf, perPerson } from './helpers.js';
import type { Bracket, ByStatus, Citation } from '../types.js';

const OK_CITATIONS: readonly Citation[] = [
  {
    title:
      '68 O.S. § 2355(C) — the individual income tax rate schedules. (C)(1)(a) is single and married filing separately; (C)(2)(a) covers married filing jointly, surviving spouse AND head of household, which is why a single parent files on the wide brackets. Each subsection writes its own band widths out incrementally: 1,000 + 1,500 + 1,250 + 1,150 + 2,300 = 7,200 and 2,000 + 3,000 + 2,500 + 2,300 + 4,600 = 14,400. NOT OPENED FROM THIS SANDBOX: oscn.net does not resolve here',
    url: 'https://www.oscn.net/applications/oscn/DeliverDocument.asp?CiteID=92565',
  },
  {
    title:
      'HB 2764 of the 2025 regular session, page 11 — the 2026 schedule. It cuts the top rate from 4.75% to 4.5%, replaces the three bottom bands with a single 0% band, and leaves the three surviving thresholds untouched. Every summary of it says "six brackets into three"; the published schedule has four rows and the fourth is the zero band. The act also sets revenue triggers that step the rate down by 0.25 points toward zero, cancelled automatically on a declared revenue failure — nothing in this package projects them. NOT OPENED FROM THIS SANDBOX',
    url: 'https://www.oklegislature.gov/cf_pdf/2025-26%20ENR/hB/HB2764%20ENR.PDF',
  },
  {
    title:
      '2025 Oklahoma Resident Individual Income Tax Forms and Instructions (Form 511 packet) — page 10 for the standard deduction and the federal-election lock, page 9 for the exemptions and the special exemption table, page 17 for the Schedule 511-A retirement subtractions, page 27 for the 2025 rate schedules. NOT OPENED FROM THIS SANDBOX: oklahoma.gov does not resolve here, by curl or by WebFetch. The figures below are policyengine-us 2.65.0\'s, which cites these exact pages, corroborated by server-side search\'s reading of this document and by two commercial tables',
    url: 'https://oklahoma.gov/content/dam/ok/en/tax/documents/forms/individuals/current/511-Pkt.pdf',
  },
  {
    title:
      '68 O.S. § 2358(D) — the special exemption. An additional $1,000 for each taxpayer or spouse 65 or older at the close of the tax year, where federal adjusted gross income is "EQUAL TO OR LESS THAN" the figure for their filing status: $15,000 single, $25,000 joint, $19,000 head of household, $12,500 married filing separately. The Form 511 instructions print "Federal AGI is equal to or less than" as the column heading. Indiana\'s equivalent $500 says "less than", which is why this package now has a flag for the boundary',
    url: 'https://www.oklegislature.gov/OK_Statutes/CompleteTitles/os68.pdf',
  },
  {
    title:
      '68 O.S. § 2358(A)(8) and (A)(13) — the retirement benefit exclusion, up to $10,000 per person, of pension income, retirement distributions and Roth conversions, "but not to exceed the amount included in federal adjusted gross income". NO AGE TEST: the Tax Commission\'s own help centre puts the condition as "you must have retirement income in your name". HB 2190 of 2025 would have raised it to $40,000 from tax year 2026 and died on 14 May 2026, so $10,000 is the figure for both years here',
    url: 'https://www.oklegislature.gov/OK_Statutes/CompleteTitles/os68.pdf#page=1012',
  },
  {
    title:
      '68 O.S. § 2358(E)(17) and Okla. Admin. Code 710:50-15-49(g) — military retired pay, 100% excluded from tax year 2022, where 2007 through 2021 allowed the greater of 75% of it or $10,000. Schedule 511-A line 4, separate from the (A)(8) line, with no provision reducing either exclusion by the other',
    url: 'https://www.law.cornell.edu/regulations/oklahoma/OAC-710-50-15-49',
  },
  {
    title:
      '68 O.S. § 2357.43 — the Oklahoma earned income credit: 5% of the federal credit, computed under the Internal Revenue Code AS IT EXISTED ON 31 DECEMBER 2020. Refundable 2002-2015, non-refundable 2016-2021, refundable again from 2022 under HB 2962 (Laws 2021, c. 493). NOT MODELLED here, because the base is a frozen federal credit and this package has no input for one — see this module\'s notes for the measured size',
    url: 'https://law.justia.com/codes/oklahoma/title-68/section-68-2357-43/',
  },
  {
    title:
      'Oklahoma Form 561 — the capital gain deduction, for qualifying gains on real or tangible property located in Oklahoma held at least five years, on stock or an ownership interest in an Oklahoma company held at least two years, or on the sale of a direct interest in an Oklahoma partnership or LLC. NOT MODELLED: whether a gain qualifies turns on where the property was and how long it was held, and no field in this package carries either fact',
    url: 'https://oklahoma.gov/content/dam/ok/en/tax/documents/forms/individuals/current/511-Pkt.pdf',
  },
  {
    title:
      'Rev. Proc. 2024-40 and Rev. Proc. 2025-32 — the federal 2025 and 2026 earned income credit maxima ($649/$4,328/$7,152/$8,046 and $664/$4,427/$7,316/$8,231) and standard deductions ($15,750 and $16,100 single), both of which this module measures Oklahoma against. The same figures are in this repository, in us-federal-tax\'s src/data, and the cross-package check reads them from there rather than from this comment',
    url: 'https://www.irs.gov/pub/irs-drop/rp-25-32.pdf',
  },
];

/**
 * The published schedules, stored and not derived.
 *
 * Two relations are visible and NEITHER is applied. The joint column is exactly
 * twice the single one at every threshold in both years, and the
 * head-of-household and surviving-spouse columns ARE the joint one — which
 * § 2355(C)(2) states in its own words, so the statuses share a schedule here
 * for the reason the statute gives rather than because `byStatusOf` defaults
 * them. The doubling is asserted in `test/oklahoma.test.js` as an observation
 * about the two subsections' published increments, because § 2355(C) states two
 * tables and no relation between them.
 */
function oklahomaBrackets(year: number): ByStatus<readonly Bracket[]> {
  // § 2355(C)(1)(a): the single and married-filing-separately schedule.
  const lower: readonly Bracket[] =
    year === 2025
      ? [
          { rate: 0.0025, upTo: 1_000 },
          { rate: 0.0075, upTo: 2_500 },
          { rate: 0.0175, upTo: 3_750 },
          { rate: 0.0275, upTo: 4_900 },
          { rate: 0.0375, upTo: 7_200 },
          { rate: 0.0475, upTo: Infinity },
        ]
      : [
          { rate: 0, upTo: 3_750 },
          { rate: 0.025, upTo: 4_900 },
          { rate: 0.035, upTo: 7_200 },
          { rate: 0.045, upTo: Infinity },
        ];
  // § 2355(C)(2)(a): joint, surviving spouse and HEAD OF HOUSEHOLD together.
  const upper: readonly Bracket[] =
    year === 2025
      ? [
          { rate: 0.0025, upTo: 2_000 },
          { rate: 0.0075, upTo: 5_000 },
          { rate: 0.0175, upTo: 7_500 },
          { rate: 0.0275, upTo: 9_800 },
          { rate: 0.0375, upTo: 14_400 },
          { rate: 0.0475, upTo: Infinity },
        ]
      : [
          { rate: 0, upTo: 7_500 },
          { rate: 0.025, upTo: 9_800 },
          { rate: 0.035, upTo: 14_400 },
          { rate: 0.045, upTo: Infinity },
        ];
  return byStatusOf<readonly Bracket[]>({
    single: lower,
    joint: upper,
    separate: lower,
    headOfHousehold: upper,
  });
}

export function oklahoma(year: number): StateIncomeTaxDefinition | undefined {
  if (year !== 2025 && year !== 2026) return undefined;
  return {
    code: 'OK',
    name: 'Oklahoma',
    year,
    // Both years are published releases: the Form 511 packet for 2025 and HB
    // 2764 itself for 2026. Nothing here is last year's figure standing in —
    // the standard deduction, the exemption and the $10,000 exclusion are the
    // same in both years because no provision moves them, which is the statute
    // saying so rather than this package carrying a number forward.
    status: 'published',
    // Form 511 line 1 is federal AGI, so Oklahoma's own deduction and
    // exemptions come off below it and the four OBBBA Schedule 1-A deductions
    // never reach the base at all.
    base: 'federalAdjustedGrossIncome',
    // Schedule 511-A line 3. Oklahoma subtracts the federally taxable part of a
    // Social Security benefit in full, for everybody, with no income test.
    subtractsTaxableSocialSecurity: true,
    rate: { kind: 'brackets', byStatus: oklahomaBrackets(year) },
    // The federal 2017 amounts, frozen. Oklahoma decoupled rather than follow
    // the TCJA increase and has not indexed them since; the same four figures
    // appear in the 2021 and the 2026 instructions.
    deduction: {
      kind: 'table',
      amounts: byStatus({ single: 6_350, joint: 12_700, separate: 6_350, headOfHousehold: 9_350 }),
    },
    exemption: {
      // $1,000 a head. Two on a joint return, one on every other, and one for a
      // qualifying surviving spouse — which is what `perPerson` is for and why
      // it is not `byStatus`: this is a count of people, not a statutory
      // figure, and a widow's return has one person on it.
      perFiler: perPerson(1_000),
      perDependent: 1_000,
      separateReturnSpouse: {
        // UNRESOLVED, and deliberately. The Form 511 exemption boxes are
        // "Yourself" and "Spouse", and nothing available from this sandbox says
        // whether a married-filing-separate Oklahoma return may count a spouse
        // with no gross income the way § 151(b) lets a federal one. The
        // reference model counts nobody — its spouse exemptions are gated on
        // the JOINT status alone — and this package follows it, which keeps the
        // answer identical and records that the provision is unread.
        spouse: 'unresolved',
        cite:
          '68 O.S. § 2358(D) and the Form 511 instructions, page 9 — the exemption is "$1,000 for each exemption claimed"; whether a separate return may claim a spouse with no gross income, as IRC § 151(b) allows, is not settled by anything readable from here. Worth $1,000 of exemption, $47.50 of 2025 tax and $45.00 of 2026 tax.',
        // There is no untested age addition and no blind addition in the
        // § 63(f) sense to follow: Oklahoma's age addition is the means-tested
        // one below, and its blind addition is a second whole exemption rather
        // than an increment.
        agedAndBlind: 'notApplicable',
        // The means-tested $1,000 is the one addition Oklahoma has, and the same
        // question arises for it. Unread, for the same reason.
        lowIncomeSenior: 'unresolved',
        lowIncomeSeniorCite:
          '68 O.S. § 2358(D) gives the special exemption "for each taxpayer or spouse who is sixty-five (65) years of age or older"; on a separate return, whether the word "spouse" reaches a spouse who is not on the return is unread from here. The reference model gives it only on a joint return. Worth $1,000 of exemption, $47.50 of 2025 tax.',
      },
      // A second WHOLE exemption rather than an increment: the Form 511 box is
      // ticked and the exemption count goes from one to two.
      perBlindOrDisabledFiler: 1_000,
      // § 2358(D). The only age-related figure on an Oklahoma return outside
      // the retirement exclusion, and it is means-tested — so there is no
      // `perSeniorFiler` here at all.
      perLowIncomeSeniorFiler: 1_000,
      seniorAge: 65,
      lowIncomeSeniorThreshold: byStatus({
        single: 15_000,
        joint: 25_000,
        separate: 12_500,
        headOfHousehold: 19_000,
      }),
      // "EQUAL TO OR LESS THAN", which Indiana's "less than" is not. The dollar
      // exactly on the threshold is $1,000 of exemption in Oklahoma and nothing
      // in Indiana.
      lowIncomeSeniorThresholdInclusive: true,
    },
    retirementIncomeSubtractions: [
      {
        name: 'Oklahoma retirement benefit exclusion',
        // Schedule 511-A line 4 is a different statute from line 5's, and
        // reporting the two under one name would tell the caller the $10,000
        // cap applies to money that has no cap at all.
        exemptInFullName: 'Oklahoma military retirement exclusion (100%)',
        // § 2358(A)(8) is per person and unused room is lost: "each individual
        // may exclude their retirement benefits up to $10,000". A couple's
        // $20,000 is two claims of $10,000 and not one of $20,000.
        scope: 'perPerson',
        // NO AGE TEST AT ALL, which makes Oklahoma the only state in this rule
        // whose cap is available to a 45-year-old. Neither `minimumAge` nor
        // `cappedMinimumAge` is set, and that is the parameter published guides
        // most often get wrong about this state.
        cap: 10_000,
        // § 2358(E)(17) exempts military retired pay in full and NOTHING
        // reduces the $10,000 by it — the one construction South Carolina's
        // § 12-6-1170(C)(1) forbids and Oklahoma's statute does not mention.
        militaryExemptOutsideCap: true,
      },
    ],
    // NO `earnedIncomeCredit`, DELIBERATELY, AND IT IS THE DAY'S LARGEST
    // JUDGEMENT CALL. § 2357.43 is 5% of the federal credit computed under the
    // IRC as it existed on 31 December 2020. `matchRate: 0.05` would read
    // `federal.earnedIncomeCredit`, which is THIS year's credit, and overstate
    // the credit by 20.8% in 2025 and 23.6% in 2026 for a three-child family —
    // growing every year, because one side is indexed and the other is a date.
    // Omitting it overstates an Oklahoma return by at most the whole credit,
    // $333.00, and says so in a note; shipping the wrong base would overstate
    // the refund of exactly the households the credit exists for. What this
    // needs is an input for the federal credit UNDER 2020 LAW.
    notes: [
      "OKLAHOMA'S 2026 SCHEDULE HAS FOUR ROWS AND EVERY SUMMARY OF IT SAYS THREE. HB 2764 of 2025 is universally described as consolidating six brackets into three and cutting the top rate from 4.75% to 4.5%. Both halves are true and neither is the half that decides most returns: the fourth row is a 0% BAND, covering a single filer's first $3,750 of Oklahoma taxable income and a joint or head-of-household return's first $7,500. In 2025 that same $3,750 cost $35.63. A model built from the press release puts 2.5% on the first dollar.",
      'EVERY SURVIVING RATE FELL BY EXACTLY 0.25 POINTS AND NO THRESHOLD MOVED. 2.75% became 2.5%, 3.75% became 3.5%, 4.75% became 4.5%, and $3,750/$4,900/$7,200 are the 2025 figures unchanged. Because the reform subtracted a constant from every rate, every gap between adjacent Oklahoma rates is the same in both years — so an error expressed as a rate DIFFERENCE costs the same in 2025 and 2026, which is why the $22.00 below is $22.00 twice.',
      "HEAD OF HOUSEHOLD FILES ON THE JOINT RATE SCHEDULE IN OKLAHOMA AND KEEPS A SMALLER DEDUCTION. § 2355(C)(2) names married filing jointly, a surviving spouse and head of household in one subsection, so a single parent's 4.75% rate starts at $14,400 rather than $7,200 — but their standard deduction is $9,350 against a joint return's $12,700, and their special-exemption income limit is $19,000 against $25,000. Head of household is the joint column on one of Oklahoma's three tables and a column of its own on the other two; mapping the status once gets two of them wrong.",
      "OKLAHOMA'S STANDARD DEDUCTION IS THE FEDERAL 2017 FIGURE AND HAS NOT MOVED SINCE. $6,350 single and married filing separately, $12,700 joint and surviving spouse, $9,350 head of household, with no indexing provision — the same four figures in the 2021 instructions and the 2026 ones. The federal single deduction is $15,750 in 2025 and $16,100 in 2026, so a table that says Oklahoma follows the federal amount (and at least one published guide does, with those exact figures) overstates the deduction by $9,400 and $9,750: $446.50 and $438.75 of tax, in the direction that understates what is owed.",
      'OKLAHOMA LOCKS THE DEDUCTION ELECTION TO THE FEDERAL ONE, AND THIS PACKAGE MODELS THE STANDARD DEDUCTION ONLY. The Form 511 instructions are explicit: "If you claimed the standard deduction on your federal return, you must claim the Oklahoma standard deduction. If you claimed itemized deductions on your federal return, you must claim Oklahoma itemized deductions." It is not a choice, and the trap runs one way — a joint filer with $20,000 of federal itemized deductions takes the larger federal standard deduction of $31,500 and is then FORCED onto Oklahoma\'s $12,700, losing $7,300 of Oklahoma deduction they would have had by itemizing. Oklahoma itemized deductions are capped at $17,000 with charitable contributions and medical expenses outside the cap, and this package does not model them: `stateItemizedDeductions` is not read for Oklahoma, and a filer who itemized federally is computed here on the standard deduction instead.',
      "THE $10,000 RETIREMENT EXCLUSION HAS NO AGE TEST, WHICH IS THE PARAMETER MOST OFTEN REPORTED WRONG ABOUT THIS STATE. § 2358(A)(8) gives each individual up to $10,000 of retirement benefits — pension income, retirement-plan distributions and Roth conversions — and the condition is having the income in your own name, not reaching an age. A 45-year-old Oklahoma filer with a $30,000 pension excludes $10,000 of it. Published guides describing it as \"$10,000 for retirees 65 and older\" or \"$25,000 for residents 65 and older\" are both wrong, and HB 2190 of 2025, which would have raised it to $40,000 from 2026, died on 14 May 2026.",
      'MILITARY RETIRED PAY IS 100% EXCLUDED AND DOES NOT CONSUME THE $10,000. § 2358(E)(17) from tax year 2022, at any age, with no ceiling, on Schedule 511-A line 4 — and no provision reduces the § 2358(A)(8) exclusion by it, so a retired sergeant with $45,000 of military pay and a $12,000 IRA distribution excludes the $45,000 AND $10,000 of the IRA. South Carolina is the opposite case: § 12-6-1170(C)(1) charges its military deduction against its cap by name. The difference is $10,000 of exclusion and $475.00 of 2025 Oklahoma tax, and it shows only on a return with military pay AND a second pension. Before 2022 Oklahoma allowed the greater of 75% of military pay or $10,000; a model carrying that rule into 2025 understates the exclusion for anybody with more than $40,000 of it.',
      'PASS `retirement.filer` AND `retirement.spouse` SEPARATELY IN OKLAHOMA. The $10,000 is per person and not transferable. A couple whose $20,000 of pension is all in one spouse\'s name exclude $10,000 and pay $475.00 of 2025 tax on the rest; the same couple with $10,000 each exclude the lot. A single `retirementIncome` figure is attributed ENTIRELY TO THE FILER by the household fallback, so it buys one $10,000 exclusion and not two.',
      "NOT MODELLED — THE EARNED INCOME CREDIT, AND THE REASON IS A DATE RATHER THAN AN OMISSION. § 2357.43 gives 5% of the federal earned income credit computed under the Internal Revenue Code AS IT EXISTED ON 31 DECEMBER 2020, and the federal credit has been indexed every year since. Oklahoma's base maxima are $538, $3,584, $5,920 and $6,660 by child count; the 2025 federal ones are $649, $4,328, $7,152 and $8,046 and the 2026 ones $664, $4,427, $7,316 and $8,231. So 5% of THIS year's credit overstates Oklahoma's by $5.55, $37.20, $61.60 and $69.30 in 2025 and by $6.30, $42.15, $69.80 and $78.55 in 2026 — 20.8% and 23.6% too much for a three-child family at the plateau, and growing every year by construction. This package therefore computes an Oklahoma return TOO HIGH by the whole credit, at most $333.00 in 2025 and $333.00 in 2026 (the frozen figures do not move), rather than ship a credit on the wrong base. `tools/cross-package/oklahoma-frozen-eitc.mjs` asserts the whole table against us-federal-tax's own data on every push.",
      'NOT MODELLED — THE FORM 561 CAPITAL GAIN DEDUCTION, and it is unmodellable here rather than merely absent. Oklahoma deducts the qualifying net capital gain from real or tangible property located IN OKLAHOMA and held at least five years, from stock or an ownership interest in an Oklahoma company held at least two years, or from the sale of a direct interest in an Oklahoma partnership or LLC. Whether a gain qualifies turns on where the property was and how long it was held, and `netCapitalGain` carries neither fact. An Oklahoma filer with a qualifying gain is overstated here by up to the whole gain at their marginal rate; supply the deduction through `subtractions`.',
      "OKLAHOMA'S SPECIAL EXEMPTION INCOME TEST IS \"EQUAL TO OR LESS THAN\", AND IT IS READ AGAINST A MODIFIED FEDERAL AGI. The $1,000 for each filer or spouse of 65 or over is allowed where federal AGI is equal to or less than $15,000 single, $25,000 joint, $19,000 head of household or $12,500 married filing separately — so the dollar exactly on the threshold is worth the exemption here, where Indiana's \"less than\" denies it. AND THE FIGURE THE TEST READS IS NOT PLAIN FEDERAL AGI: the Form 511 instructions exclude income from converting a traditional IRA to a Roth IRA, with the federal return and Form 8606 enclosed. This package reads plain federal AGI, so a filer pushed over the limit ONLY by a Roth conversion is denied an exemption Oklahoma allows them — the Oklahoma figure here is too high by up to $47.50 for that filer, and by nothing for anybody else.",
      'NOT MODELLED, and each would reduce an Oklahoma return computed here: the sales tax relief credit of $40 a person (68 O.S. § 5011, for gross income at or under $20,000, or $50,000 with a person 65 or over or a dependent, claimed on Form 538-S), the low-income property tax credit of Form 538-H, the child care/child tax credit of the greater of 20% of the federal child and dependent care credit or 5% of the federal child tax credit for federal AGI at or under $100,000, the Oklahoma 529 contribution deduction, the credit for taxes paid to another state, and the qualifying disability deduction. Nothing in this package can supply a credit; supply deductions through `subtractions`.',
      "OKLAHOMA TAXES TIPS AND OVERTIME THAT THE FEDERAL GOVERNMENT NOW EXEMPTS. Form 511 line 1 is federal AGI, and the four OBBBA Schedule 1-A deductions — § 224 tips, § 225 overtime, § 151(d)(5) senior and § 163(h)(4) vehicle loan interest — all sit BELOW federal AGI, so none of them reaches Oklahoma's base. Oklahoma has legislated no subtraction of its own for any of them, where Alabama, Georgia and Arizona have for some. A tipped Oklahoma worker with $8,000 of qualified tips pays Oklahoma $380.00 in 2025 and $360.00 in 2026 on income the federal return exempted entirely.",
      'NO CITY, COUNTY OR SCHOOL DISTRICT IN OKLAHOMA LEVIES AN INCOME TAX. The state figure is the whole of an Oklahoma resident\'s income tax, so `locality` is never required and `SUPPORTED_LOCALITIES` names none here.',
      "OKLAHOMA'S RATE COULD FALL AGAIN WITHOUT LEGISLATION AND NOTHING HERE PROJECTS IT. HB 2764 sets revenue triggers that step every rate down by a further 0.25 percentage points when the State Board of Equalization certifies that revenue has grown enough, repeating toward the elimination of the individual income tax, and cancel a pending reduction automatically if a revenue failure is declared. This package ships the 2026 schedule the act itself prints. A 2027 Oklahoma figure is a certification that has not happened, not an indexation that can be computed.",
    ],
    citations: OK_CITATIONS,
  };
}
