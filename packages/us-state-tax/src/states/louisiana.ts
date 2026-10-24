/**
 * Louisiana — the first jurisdiction added to this package since its coverage
 * list was written, and the one whose 2025 return is least like its own
 * reputation.
 *
 * ## Act 11 did not cut Louisiana's tax, it rebuilt the base
 *
 * Every secondary summary leads with the rate: a graduated 1.85% / 3.5% / 4.25%
 * schedule replaced by a flat **3%** for taxable periods beginning on or after
 * 1 January 2025. That is the half that is easy to print. The half that decides
 * most returns is that **Act 11 of the 2024 Third Extraordinary Session
 * repealed every exemption Louisiana had** — the `$4,500`/`$9,000` personal
 * exemption, the `$1,000` dependent exemption, the `$1,000` exemption for a
 * filer of 65 and the `$1,000` for a blind filer — and put a standard deduction
 * of `$12,500`/`$25,000` where they were.
 *
 * So a 2025 Louisiana return has **no per-dependent allowance of any kind**, and
 * no addition for age or blindness. This package therefore carries no
 * {@link StateIncomeTaxDefinition.exemption} for Louisiana at all, and that
 * absence is a finding rather than a gap: it is the only state here that reached
 * zero exemptions by repealing them rather than by never having had any.
 *
 * ## The head-of-household deduction is DOUBLE the single one, not one and a half
 *
 * R.S. 47:294(A)(2) does not print a head-of-household figure. It sets the
 * amount for a joint return, a head of household and a qualified surviving
 * spouse at **200% of the amount provided for a single individual**, which is
 * why this module stores ONE figure a year and multiplies it. A model that
 * reaches for the usual 1.5× ratio gives a Louisiana head of household
 * `$18,750` against the statute's `$25,000` and overstates their 2025 tax by
 * **`$187.50`**.
 *
 * ## And that 200% is a formula, which is why 2026 is a dollar off
 *
 * R.S. 47:294(B) indexes the deduction annually from 1 January 2026 by the
 * percentage increase in CPI-U. LDR's Revenue Information Bulletin 26-019
 * (28 September 2026) applies the 2.7% that BLS reported for the twelve months
 * ending December 2025:
 *
 * ```text
 *   12,500 x 1.027  =  12,837.50  ->  12,838   the single figure, rounded
 *        2 x 12,838  =  25,676              <- what the statute's 200% produces
 *   25,000 x 1.027  =  25,675.00  ->  25,675   <- what indexing the joint figure gives
 * ```
 *
 * **The order of rounding and doubling moves the joint deduction by a dollar**,
 * and the statute fixes the order: the single amount is the parameter and the
 * joint amount is 200% of it. `$25,676` is the bulletin's figure and this
 * module's, and it is reachable only by doubling second.
 *
 * ## And a fourth candidate figure, from the arithmetic rather than the law
 *
 * `12,500 x 1.027` is **12,837.499999999998** in binary floating point, so
 * rounding it gives **`$12,837`** — a dollar below the published amount. The
 * single deduction's derivation lands EXACTLY on a rounding boundary, which is
 * the one place a decimal literal's representation error can change the answer,
 * and of Louisiana's three 2026 figures it is the only one that does: the other
 * two products are a hair low as well and round to 12,324 and 25,675 either way.
 *
 * So `test/louisiana.test.js` indexes with the exact rational `1027 / 1000` and
 * asserts the literal's answer too, as the wrong one. **Four different 2026
 * single-filer deductions are now reachable by a defensible route** — `$12,838`
 * published, `$12,875` in the withholding tables, `$12,835` from the unrounded
 * 2.677%, and `$12,837` from multiplying by a decimal literal — and only the
 * first is the one a return is filed on.
 *
 * ## Louisiana has TWO official 2026 standard deductions, and both are right
 *
 * The figure above is the one the **return** uses. The **withholding** tables
 * proposed for 2026 at LAC 61:I.1501 use `$12,875` and `$25,750` — `$12,500`
 * and `$25,000` grown by **3.0%** rather than 2.7%, a September-over-September
 * change computed from the data available on 1 December 2025.
 *
 * Both are the statute's "percentage increase in the Consumer Price Index", read
 * over two different twelve-month windows, and the windows differ because a
 * withholding table has to exist before the tax year it withholds for. The
 * December-over-December figure did not exist on 1 December 2025; the
 * September-over-September one was the most recent twelve-month CPI-U change
 * that did, because **BLS collected no October 2025 prices at all during that
 * year's lapse in appropriations** and so published no October index. (That the
 * gap is *why* September was used is this package's inference from the dates,
 * not a reason the Department states.)
 *
 * The practical size of it: `$37` of deduction for a single filer and `$74` on a
 * joint return, so `$1.11` and `$2.22` of tax. The practical shape of it is
 * larger than the practical size — **a payroll engine reading Louisiana's
 * withholding tables and a return engine reading RIB 26-019 disagree for 2026,
 * and neither is wrong.** This package computes the return.
 *
 * ## The retirement exemption doubled, is per person, and is not transferable
 *
 * Act 11 also amended R.S. 47:44.1 to take the annual retirement income
 * exemption for a person of 65 or over from `$6,000` to **`$12,000`**, indexed
 * from 2026 by the same mechanism (`$12,324` per RIB 26-019 —
 * `12,000 x 1.027` exactly, with no rounding to do). It is claimed by the person
 * who RECEIVED the income: a couple both over 65 with `$40,000` of pension in
 * one spouse's name exclude `$12,000` and not `$24,000`, which is
 * {@link RetirementIncomeSubtractionRule.scope} `'perPerson'`.
 *
 * Retired pay from a Louisiana state or local retirement system, or from the
 * federal government — **military retired pay included** — is exempt in full
 * under R.S. 47:44.2 with **no age test and no cap**, and it does not consume
 * the `$12,000`. That is New York's construction exactly, and this module uses
 * the same two fields for it: `governmentPensionExemptInFull` with
 * {@link RetirementIncomeSubtractionRule.cappedMinimumAge} rather than
 * `minimumAge`, so a Louisiana trooper who retired at 48 pays nothing on their
 * pension while the `$12,000` waits for their sixty-fifth birthday.
 *
 * ## Sourcing, stated plainly
 *
 * `legis.la.gov`, `dam.ldr.la.gov` and `law.justia.com` are all unreachable from
 * this sandbox — the eleventh consecutive run to record a blocked primary
 * source. The 2025 figures are corroborated across the Act 11 enrolled text, the
 * IT-540 instructions and LDR's own legislative summaries as quoted by
 * server-side search; the 2026 figures come from RIB 26-019 **as quoted by two
 * independent third parties**, and each of the three is checked arithmetically
 * against the 2025 base and the published BLS figure above, which is the Day 45
 * route and a workaround rather than a fix. Every one of the four products
 * reproduces to the cent; the joint figure additionally discriminates between
 * the two rounding orders, so the corroboration is not merely consistent with
 * the bulletin but picks it out.
 */
import type { StateIncomeTaxDefinition } from '../definition.js';
import { byStatus } from './helpers.js';
import type { Citation } from '../types.js';

const LA_CITATIONS: readonly Citation[] = [
  {
    title:
      'La. R.S. 47:32(A) — the individual income tax rate. Act 11 of the 2024 Third Extraordinary Session (HB 10) replaced the graduated 1.85% / 3.5% / 4.25% schedule with a flat 3% for taxable periods beginning on or after 1 January 2025',
    url: 'https://www.legis.la.gov/legis/Law.aspx?d=101946',
  },
  {
    title:
      "La. R.S. 47:294 — the standard deduction. Subsection (A)(1) prints the single and married-filing-separately amount; subsection (A)(2) sets the joint, head-of-household and qualified-surviving-spouse amount at 200% OF THE SINGLE AMOUNT rather than printing a figure, which is why this package stores one figure a year and doubles it. Subsection (B) indexes the amount annually from 1 January 2026 by the percentage increase in CPI-U",
    url: 'https://www.legis.la.gov/legis/Law.aspx?d=101761',
  },
  {
    title:
      'Act 11 of the 2024 Third Extraordinary Session (HB 10), enrolled — the act that created the standard deduction AND repealed the personal, dependent, aged and blind exemptions of R.S. 47:294 and 47:79, effective 4 December 2024 for tax year 2025. The repeal is the half of this act that secondary summaries omit',
    url: 'https://www.legis.la.gov/legis/ViewDocument.aspx?d=1391656',
  },
  {
    title:
      "Louisiana Department of Revenue, Revenue Information Bulletin 26-019 (28 September 2026) — Inflation Adjustment to Standard Deduction and Retirement Income Exemption. The 2026 figures: $12,838 single and separate, $25,676 joint, head of household and qualified surviving spouse, and $12,324 of retirement income exemption, from a 2.7% CPI-U multiplier. NOT OPENED FROM THIS SANDBOX — dam.ldr.la.gov does not resolve here; the figures are taken from two independent third-party quotations and checked arithmetically against the 2025 bases and the BLS release below",
    url: 'https://dam.ldr.la.gov/lawspolicies/RIB%2026-019.pdf',
  },
  {
    title:
      'Louisiana Department of Revenue, Revenue Information Bulletin 25-012 — Louisiana Individual Income Tax Reform, the Department\'s own account of what Act 11 changed for 2025',
    url: 'https://dam.ldr.la.gov/lawspolicies/RIB-25-012-Louisiana-Individual-Income-Tax-Reform-1.pdf',
  },
  {
    title:
      '2025 Louisiana Resident Income Tax Return (IT-540) instructions — the "What\'s New" page, the Line 8 standard deduction, the Line 11 rate and the Schedule E exemption codes. Its definition of "annual retirement income" for code 06E includes a distribution from a pension, an annuity OR an individual retirement arrangement',
    url: 'https://dam.ldr.la.gov/taxforms/IT540i%20WEB(2025)D11.pdf',
  },
  {
    title:
      'La. R.S. 47:44.1(A) — the annual retirement income exemption. Act 11 took it from $6,000 to $12,000 per individual of 65 or over for taxable periods beginning on or after 1 January 2025, and subsection (A) indexes it annually from 1 January 2026 by the CPI-U increase. Only the individual who received the income is entitled to the exemption',
    url: 'https://www.legis.la.gov/legis/Law.aspx?d=102133',
  },
  {
    title:
      'La. Admin. Code tit. 61, § I.1311 — Annual Retirement Income Exemption for Individuals 65 or Older, the rule implementing R.S. 47:44.1. Its own definition of "annual retirement income" names pension and annuity income included in tax table income and does NOT name an IRA distribution, which the IT-540 instructions and RIB 05-015 both do. This package follows the forms; see the note',
    url: 'https://www.law.cornell.edu/regulations/louisiana/La-Admin-Code-tit-61-SS-I-1311',
  },
  {
    title:
      'La. R.S. 47:44.2 — the exemption of retirement benefits paid by the State of Louisiana, its political subdivisions and their retirement systems, and by the United States, military retired pay included. No age test and no ceiling, and it does not consume the R.S. 47:44.1 exemption',
    url: 'https://www.legis.la.gov/legis/Law.aspx?d=102134',
  },
  {
    title:
      'La. R.S. 47:297.8 — the Louisiana earned income tax credit. Subsection (A) sets the match at 5% of the federal credit from tax year 2019; subsection (B) makes it refundable',
    url: 'https://www.legis.la.gov/legis/Law.aspx?d=453085',
  },
  {
    title:
      'Louisiana Register vol. 52 no. 2 (20 February 2026) — notice of intent for the LAC 61:I.1501 withholding tables, which carry a 2026 standard deduction of $12,875 and $25,750: the SAME statutory index read over a September-over-September window, because the table has to exist before the year it withholds for',
    url: 'https://dam.ldr.la.gov/lawspolicies/NOI-Withholding%20Tables%20LAC%2061.I.1501.pdf',
  },
  {
    title:
      'BLS Consumer Price Index news release for December 2025 (13 January 2026) — the all-items CPI-U rose 2.7% over the twelve months ending December 2025, which is RIB 26-019\'s multiplier, against 3.0% over the twelve months ending September 2025, which is the withholding table\'s. No October 2025 index was published: BLS collected no prices that month during the lapse in appropriations',
    url: 'https://www.bls.gov/news.release/archives/cpi_01132026.htm',
  },
];

/**
 * The single-filer standard deduction, which is the ONLY standard deduction
 * figure Louisiana stores.
 *
 * R.S. 47:294(A)(2) defines the joint, head-of-household and
 * qualified-surviving-spouse amount as 200% of this one, so writing the doubled
 * figures as literals would be storing a derivation as data — and would hide the
 * one-dollar question of Part 3 of this module's doc comment, which only the
 * order of operations answers.
 */
function louisianaStandardDeduction(year: number) {
  // R.S. 47:294(A)(1) for 2025, as enacted by Act 11; RIB 26-019 for 2026,
  // which is 12,500 x 1.027 = 12,837.50 rounded to the nearest dollar.
  const single = year === 2025 ? 12_500 : 12_838;
  return byStatus({
    single,
    // 200% of the single amount, per R.S. 47:294(A)(2) — doubled AFTER the
    // rounding, which is what makes 2026's joint figure 25,676 and not 25,675.
    joint: single * 2,
    // The statute prints one row for "Single Individual/Married Filing
    // Separately", so this is the same figure and not a half of the joint one.
    separate: single,
    headOfHousehold: single * 2,
  });
}

export function louisiana(year: number): StateIncomeTaxDefinition | undefined {
  if (year !== 2025 && year !== 2026) return undefined;
  return {
    code: 'LA',
    name: 'Louisiana',
    year,
    // Both years' figures are from a published state release: Act 11 and the
    // IT-540 instructions for 2025, RIB 26-019 for 2026. Nothing here is last
    // year's number standing in, which is why there are no `provisionalFigures`
    // — see the sourcing note in this module's doc comment for the separate
    // question of whether the 2026 release could be OPENED from here.
    status: 'published',
    base: 'federalAdjustedGrossIncome',
    // Schedule E code 07E. R.S. 47:44.2 and the IT-540 instructions exempt the
    // part of a Social Security benefit that the federal return taxed, so the
    // figure comes straight back out of the federal-AGI base.
    subtractsTaxableSocialSecurity: true,
    rate: { kind: 'flat', rate: 0.03 },
    deduction: { kind: 'table', amounts: louisianaStandardDeduction(year) },
    // NO `exemption` BLOCK, DELIBERATELY. Act 11 repealed all four of
    // Louisiana's exemptions — personal, dependent, aged and blind — and put the
    // standard deduction above in their place. A dependent is worth nothing on a
    // 2025 Louisiana return and so is a sixty-fifth birthday, outside the
    // retirement exemption below.
    retirementIncomeSubtractions: [
      {
        name: 'Louisiana annual retirement income exemption',
        // R.S. 47:44.2 is a different statute with its own Schedule E codes
        // (02E, 03E, 04E, 05E) from R.S. 47:44.1's 06E, so reporting the two
        // under one name would tell the caller the $12,000 cap applies to money
        // that has no cap at all.
        exemptInFullName: 'Louisiana exempt state, local and federal retirement benefits',
        // Each person's own income, and unused room is lost: R.S. 47:44.1 gives
        // the exemption to "the individual who received" the retirement income.
        scope: 'perPerson',
        // On the CAPPED part only. R.S. 47:44.2 has no age test, so a government
        // retiree of any age is exempt in full — which is why this is
        // `cappedMinimumAge` and not `minimumAge`.
        cappedMinimumAge: 65,
        cap: year === 2025 ? 12_000 : 12_324,
        governmentPensionExemptInFull: true,
      },
    ],
    earnedIncomeCredit: {
      name: 'Louisiana earned income credit',
      matchRate: 0.05,
      refundable: true,
    },
    notes: [
      'LOUISIANA HAS NO EXEMPTIONS AT ALL FROM 2025, AND THAT IS A REPEAL RATHER THAN AN OMISSION HERE. Act 11 of the 2024 Third Extraordinary Session deleted the $4,500/$9,000 personal exemption, the $1,000 per dependent, the $1,000 for a filer of 65 or over and the $1,000 for a blind filer, and replaced the lot with the standard deduction. A table that still prints Louisiana as "$4,500 personal exemption plus $1,000 a dependent" is describing law that was repealed before tax year 2025 began. `dependents`, `filerAge`, `spouseAge` and `blindOrDisabled` move no Louisiana figure except through the retirement exemption.',
      "LOUISIANA'S HEAD OF HOUSEHOLD GETS THE FULL JOINT DEDUCTION. R.S. 47:294(A)(2) sets the joint, head-of-household and qualified-surviving-spouse amount at 200% of the single amount — not the 1.5x that most states use — so a head of household deducts $25,000 in 2025 and $25,676 in 2026. Scaling the single figure by 1.5 instead gives $18,750 and overstates their 2025 tax by $187.50.",
      "THE 2026 JOINT DEDUCTION IS $25,676 AND NOT $25,675, AND WHICH ONE IT IS DEPENDS ONLY ON THE ORDER OF TWO OPERATIONS. The 2.7% CPI-U increase takes the single figure to $12,837.50, which rounds to $12,838; the statute then takes 200% of it, giving $25,676. Indexing the $25,000 joint figure directly and rounding gives $25,675. R.S. 47:294 fixes the order by making the single amount the parameter and the joint amount a percentage of it, and RIB 26-019's published figure is the doubled one.",
      'LOUISIANA PUBLISHES TWO DIFFERENT 2026 STANDARD DEDUCTIONS AND BOTH ARE CORRECT. The return uses RIB 26-019\'s $12,838/$25,676, from the 2.7% CPI-U increase over the twelve months ending December 2025. The 2026 WITHHOLDING tables at LAC 61:I.1501 use $12,875/$25,750, from the 3.0% increase over the twelve months ending September 2025 — the most recent twelve-month figure that existed when a withholding table for 2026 had to be settled, there being no October 2025 index at all after that year\'s lapse in appropriations stopped BLS collecting prices. The gap is $37 of deduction for a single filer and $74 on a joint return: $1.11 and $2.22 of tax. THIS PACKAGE COMPUTES THE RETURN. A payroll product that reconciles withholding to liability in Louisiana should expect this difference and not treat it as an error in either source.',
      "Louisiana's annual retirement income exemption is $12,000 for 2025 — doubled from $6,000 by Act 11 — and $12,324 for 2026, available to a person of 65 or over, and it is PER PERSON AND NOT TRANSFERABLE: R.S. 47:44.1 gives it to the individual who received the income. A couple both over 65 whose $40,000 of pension is all in one spouse's name exclude $12,000 and pay $90; the same couple with $20,000 each exclude $24,000 and pay nothing — $90 apart on identical income, decided by whose name is on the plan. Pass `retirement.filer` and `retirement.spouse` separately; a single `retirementIncome` figure is attributed ENTIRELY TO THE FILER by the household fallback, so it buys one $12,000 exemption and not two.",
      "Retired pay from the State of Louisiana, a Louisiana political subdivision or their retirement systems, and from the United States — MILITARY RETIRED PAY INCLUDED — is exempt in full under R.S. 47:44.2, with no age test and no ceiling, and it does NOT consume the $12,000. Pass it as `retirement.<person>.governmentPension` or `retirement.<person>.militaryRetirement`. A Louisiana state trooper who retired at 48 pays Louisiana nothing on that pension and still has the whole $12,000 waiting at 65 for an IRA — and at 50 with a $50,000 pension from ANOTHER state's system pays the full $1,125. ONLY LOUISIANA AND FEDERAL SYSTEMS QUALIFY: an ANOTHER STATE'S public pension is ordinary retirement income in Louisiana, so do not put it in `governmentPension` — it belongs in `employerPlanPension`, where the $12,000 cap will reach it. PolicyEngine-US treats every public pension as exempt here and does not draw that line.",
      'A DEFINITIONAL GAP THIS PACKAGE RESOLVES TOWARDS THE FORMS AND DISCLOSES. La. Admin. Code 61:I.1311 defines "annual retirement income" for the $12,000 exemption as pension and annuity income included in tax table income, and does not name an IRA distribution; the IT-540 instructions and RIB 05-015 both define it to include a distribution from a pension, an annuity OR an individual retirement arrangement. This package follows the instructions and lets `retirement.<person>.iraDistributions` into the exemption. A filer whose only retirement income is an IRA distribution is the one whose Louisiana tax turns on which document governs, and nothing here can settle that for them.',
      'NO PARISH, CITY OR TOWN IN LOUISIANA LEVIES AN INCOME TAX. Unlike Ohio, Michigan, Indiana, Maryland and New York, the state figure is the whole of a Louisiana resident\'s income tax, so `locality` is never required and `SUPPORTED_LOCALITIES` names none here.',
      'NOT MODELLED, and each would reduce a Louisiana return computed here: the child care credit of R.S. 47:297.4 (both its non-refundable and refundable halves), the school readiness credit, the excess of federal medical expense deductions over the federal standard deduction allowed as an itemized deduction by R.S. 47:293(3), the R.S. 47:293(9)(e) military pay exclusion of up to $50,000 for pay earned outside Louisiana, the $6,000 disability income exemption, the START savings deduction, and the twenty-odd remaining Schedule E exclusions. A Louisiana filer claiming any of them is overstated here; supply the amount through `subtractions` for the deductions, and nothing in this package can supply a credit.',
      'FOUR DIFFERENT 2026 LOUISIANA STANDARD DEDUCTIONS ARE REACHABLE BY A DEFENSIBLE ROUTE, and a return is filed on one of them. $12,838 is the published figure (RIB 26-019). $12,875 is the withholding tables\'. $12,835 is what the unrounded 2.677% CPI-U change gives. And $12,837 is what `12500 * 1.027` gives in any language with binary floating-point numbers, because that product is 12837.499999999998 and the true one is exactly 12837.50 — the figure sits ON a rounding boundary, which is the only place the representation error can change the answer. If you index this figure yourself rather than reading it, multiply by 1027 and divide by 1000.',
      "Louisiana's 2026 rate is the same 3% as 2025: R.S. 47:32 prints one figure and no indexing provision or revenue trigger moves it between these two years. That is the statute saying so rather than this package carrying a number forward — see `STATE_FIGURE_PROVENANCE` for which Louisiana figures are of which kind.",
    ],
    citations: LA_CITATIONS,
  };
}
