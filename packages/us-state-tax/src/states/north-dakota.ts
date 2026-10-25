/**
 * North Dakota — the twenty-eighth taxing state, and the one whose rate
 * schedule is a longer argument than its rates are.
 *
 * ## A three-band schedule whose first band is zero
 *
 * HB 1158 of the 68th Legislative Assembly (2023) replaced five brackets
 * running to 2.9% with three: **0%, 1.95% and 2.50%**, from tax year 2023. The
 * top rate ties Arizona's for the lowest in the country among states that tax
 * wage income at all, and the zero band is the half that decides most returns —
 * a single filer's first `$48,475` of 2025 taxable income is untaxed, and a
 * joint return's first `$80,975`.
 *
 * The band is a BRACKET and not a deduction, so it does not come off income
 * before the rest: it is the first row of {@link RateRule} `brackets`, which is
 * Mississippi's and Idaho's construction already in this package.
 *
 * ## The base is federal TAXABLE income, so the deduction is already spent
 *
 * Form ND-1 line 1 is federal taxable income, not AGI, which is why this state
 * declares `deduction: { kind: 'none' }` and no `exemption` at all. The federal
 * standard deduction — or the filer's itemized deductions — is inside the
 * starting figure, and North Dakota adds nothing of its own on top. Colorado,
 * Idaho and South Carolina's 2025 return reach the same place.
 *
 * One consequence worth stating because it is the opposite of the usual one:
 * **an OBBBA change to the federal standard deduction moves a North Dakota bill
 * directly**, dollar for dollar at the filer's North Dakota marginal rate,
 * where in a federal-AGI state it moves nothing at all.
 *
 * ## The 0% band WAS the federal 12% bracket, for three years, and in 2026 it is not
 *
 * North Dakota's single-filer zero band tops out at exactly the federal 12%
 * bracket in 2023, 2024 and 2025 — `$44,725`, `$47,150`, `$48,475`, the same
 * three figures — because HB 1158 took the federal 2023 figure as its base and
 * N.D.C.C. § 57-38-30.3(1)(e) indexes it by the federal cost-of-living
 * adjustment thereafter. Three years is long enough for the coincidence to look
 * like a rule.
 *
 * ```text
 *   year   ND single 0% band   federal 12% bracket
 *   2023             44,725                 44,725
 *   2024             47,150                 47,150
 *   2025             48,475                 48,475
 *   2026             49,575                 50,400   <- they part
 * ```
 *
 * **They part because of a federal act that says nothing about North Dakota.**
 * OBBBA § 70101 moved the base year for the chained-CPI adjustment of the 10%
 * and 12% brackets — and only those two — from 2017 to 2016 for tax years
 * beginning after 31 December 2025, which buys them an extra year of
 * indexation. Every other federal bracket keeps 2017. North Dakota's own
 * provision was untouched, so its figure got the ordinary adjustment and the
 * federal one got the extra year.
 *
 * `$825` of zero-rated income, `$16.09` of North Dakota tax at 1.95%, and a
 * model that had hard-wired "North Dakota's zero band is the federal 12%
 * bracket" would have been right for three years and wrong in the fourth.
 * `tools/cross-package/` asserts both halves against `us-federal-tax`'s own
 * 2025 and 2026 tables, so the equality and the divergence are both checked
 * against a second package rather than against a comment.
 *
 * ## The published 2026 schedule is NOT reproducible from the published 2025 one
 *
 * This is the finding that decides how the figures are stored. The eight
 * thresholds (four statuses × two bands; the surviving-spouse column is the
 * joint one) are indexed annually, and the obvious way to check a published
 * table is to ask whether one multiplier reaches it. **None does.** Over every
 * combination of base year (2023, 2024, 2025), rounding interval (`$25`,
 * `$50`) and rounding direction (down, nearest, up), there is no factor `f`
 * that carries all eight:
 *
 * ```text
 *   from 2025, rounding DOWN to $25, each threshold's admissible factor
 *     single   0%     [1.0226921, 1.0232078)
 *     single   1.95%  [1.0227714, 1.0228735)
 *     joint    0%     [1.0225378, 1.0228466)
 *     joint    1.95%  [1.0227292, 1.0228131)
 *     separate 0%     [1.0228536, 1.0234713)   <- floor
 *     separate 1.95%  [1.0228150, 1.0229827)
 *     HOH      0%     [1.0223249, 1.0227098)   <- ceiling
 *     HOH      1.95%  [1.0226561, 1.0227482)
 *
 *   the floor is above the ceiling, so the intersection is EMPTY
 * ```
 *
 * `test/north-dakota.test.js` runs that search rather than asserting its
 * conclusion, so the claim fails the day a figure here is corrected. Its
 * practical form: **a model that projects North Dakota's brackets forward
 * instead of reading them will be wrong, and it will be wrong by `$25` on a
 * head-of-household threshold — `$0.49` of tax, in the direction nothing
 * notices.** This module therefore stores all eight published figures a year
 * and derives none of them.
 *
 * ## And the relation the table exhibits is NOT stored, which is the opposite of Louisiana
 *
 * Married filing separately is exactly half the joint threshold, rounded down
 * to `$25`, in all four published years:
 *
 * ```text
 *   2023   74,750 / 2 = 37,375.0  ->  37,375     published 37,375
 *   2024   78,775 / 2 = 39,387.5  ->  39,375     published 39,375
 *   2025   80,975 / 2 = 40,487.5  ->  40,475     published 40,475
 *   2026   82,800 / 2 = 41,400.0  ->  41,400     published 41,400
 * ```
 *
 * Louisiana, added the day before this state, stores ONE standard deduction a
 * year and doubles it, because R.S. 47:294(A)(2) says the joint figure is 200%
 * of the single one. North Dakota's half is visible in four years of tables and
 * is stated in no document this package could open.
 *
 * > **A RELATION VISIBLE IN A TABLE IS NOT A RELATION THE LAW STATES, AND ONLY
 * > THE SECOND MAY BE WRITTEN AS CODE.** Storing the derivation would make the
 * > halving a property of this package rather than of North Dakota, and it
 * > would then be silently right for four years and silently wrong in the year
 * > the Tax Commissioner prints something else. The relation is asserted in the
 * > test — where being wrong is a failure — and not in the module, where being
 * > wrong is an answer.
 *
 * ## One forty percent, two bases, and the second is not a capital gain at all
 *
 * N.D.C.C. § 57-38-30.3(2)(d) subtracts forty percent twice:
 *
 * - **Line 6**, of "the excess of net long-term capital gain over net
 *   short-term capital loss" — the IRC § 1222(11) arithmetic, so a short-term
 *   LOSS eats the exclusion and a short-term GAIN cannot create one. That is
 *   this package's `longTermNetted` basis, and North Dakota is the fourth state
 *   in that rule: Wisconsin reaches it through a sentence of its own, South
 *   Carolina through a federal cross-reference, and North Dakota through its
 *   own words again — so Congress amending § 1222(11) moves South Carolina's
 *   base and leaves these two where they are.
 * - **Line 13**, of qualified dividend income — Form 1040 line **3a**, which is
 *   ordinary income on a federal return and was never in Schedule D.
 *
 * The two look like one provision and are two, which is why
 * {@link QualifiedDividendSubtractionRule} exists rather than a wider capital
 * gains basis: no arithmetic over {@link StateIncomeTaxInput.netCapitalGain}
 * and {@link StateIncomeTaxInput.shortTermCapitalGains} can reach a dividend.
 * A filer with `$20,000` of qualified dividends and no capital gains has a
 * `$8,000` subtraction here and none at all above.
 *
 * ## Social Security out in full; military retired pay out in full; everything else in
 *
 * The federally taxable part of a Social Security benefit comes straight back
 * out at line 15, for every filer, **with no income test** — the test that
 * existed when the deduction began in 2019 was removed from tax year 2021.
 *
 * Military retired pay comes out in full at line 14, at any age and with no
 * cap, and a surviving spouse of a retired member claims it on the same line.
 * Nothing else does: a civilian federal pension, a state pension, a 401(k)
 * distribution and an IRA distribution are all taxed in full. That is North
 * Carolina's shape exactly, and the same three fields express it — `cap: 0`
 * with `militaryReducesCap`, which exempts military pay and leaves no pool for
 * anything else.
 *
 * ## Sourcing, stated plainly
 *
 * `tax.nd.gov`, `ndlegis.gov`, `law.justia.com`, `codes.findlaw.com` and
 * `law.cornell.edu` are all refused by this sandbox's egress policy — the
 * thirteenth consecutive run to record a blocked primary source, and the first
 * on which the policy was confirmed to be an allowlist of package registries
 * rather than a per-host denial. The route is Day 45's: a second party's
 * published reading of the blocked document, checked arithmetically.
 *
 * The 2025 schedule is corroborated three ways — the Tax Commissioner's own
 * individual income tax page as server-side search read it, `policyengine-us`
 * 2.63.3's parameter files citing the 2025 instruction booklet page 29, and two
 * independent commercial tables. The 2026 schedule has no primary reading at
 * all from here: it rests on `policyengine-us` 2.63.3 citing the **2026 Form
 * ND-1ES rate schedules** and on two third parties that agree with it figure
 * for figure, against two more that simply carry 2025 forward — which is the
 * failure mode the arithmetic above exists to catch and does not resolve.
 *
 * **Both years still ship `published`, and the reason is worth recording.** The
 * first draft marked 2026 `provisional` with an invented reason of
 * `unreadPrimarySource`, and the compiler refused it. Every existing
 * {@link ProvisionalReason} is a statement about the STATE — the figure is not
 * out yet, the law cannot settle it until the year ends, it is derived under a
 * bound. "Nothing here could open the document" is a statement about this
 * sandbox, and it belongs in the citation, where it is written in those words.
 *
 * > **`provisional` IS A CLAIM ABOUT THE PUBLISHER, NOT ABOUT THE READER.**
 */
import type { StateIncomeTaxDefinition } from '../definition.js';
import { byStatusOf } from './helpers.js';
import type { Bracket, ByStatus, Citation } from '../types.js';

const ND_CITATIONS: readonly Citation[] = [
  {
    title:
      'N.D.C.C. § 57-38-30.3(1) — the individual income tax rate schedules. HB 1158 of the 68th Legislative Assembly (2023) replaced five brackets topping out at 2.9% with three at 0%, 1.95% and 2.50%, from tax year 2023, and subdivision (1)(e) indexes the thresholds annually by the federal cost-of-living adjustment',
    url: 'https://ndlegis.gov/cencode/t57c38.pdf#nameddest=57-38-30p3',
  },
  {
    title:
      'North Dakota Office of State Tax Commissioner — Individual Income Tax, the page carrying the current rate schedules. NOT OPENED FROM THIS SANDBOX: tax.nd.gov does not resolve here. The 2025 figures below are what server-side search reported this page to contain, and they agree with policyengine-us and two commercial tables',
    url: 'https://www.tax.nd.gov/individual-income-tax',
  },
  {
    title:
      '2025 North Dakota Individual Income Tax booklet, page 29 — the 2025 rate schedules, and pages 14 to 16 for the line 6 capital gain, line 13 qualified dividend, line 14 military retirement and line 15 Social Security subtractions. NOT OPENED FROM THIS SANDBOX',
    url: 'https://www.tax.nd.gov/sites/www/files/documents/forms/individual/2025-iit/2025-individual-income-tax-booklet.pdf',
  },
  {
    title:
      '2026 Form ND-1ES, page 2 — the 2026 estimated-tax rate schedules, which are the only published source for this package\'s 2026 thresholds. NOT OPENED FROM THIS SANDBOX; the figures are policyengine-us 2.63.3\'s, which cites this document, corroborated by two independent third parties',
    url: 'https://www.tax.nd.gov/sites/www/files/documents/forms/individual/2025-iit/28709-form-nd-1es-2026.pdf',
  },
  {
    title:
      '2025 Form ND-1 (SFN 28702) — line 1 federal taxable income, line 6 net long-term capital gain exclusion, line 13 qualified dividend exclusion, line 14 military retirement benefit exclusion (Form 1099-R attached), line 15 Social Security benefit exclusion, line 22 marriage penalty credit',
    url: 'https://www.tax.nd.gov/sites/www/files/documents/forms/individual/2025-iit/28702-form-nd-1-2025.pdf',
  },
  {
    title:
      'N.D.C.C. § 57-38-30.3(2)(d) — the forty percent reductions. Subparagraph (1) reduces taxable income by 40% of the excess of net long-term capital gain over net short-term capital loss, allowed only to the extent the gain is allocated to North Dakota; subparagraph (2) does the same for qualified dividend income. One percentage, two bases, and the second is not on Schedule D',
    url: 'https://codes.findlaw.com/nd/title-57-taxation/nd-cent-code-sect-57-38-30-3/',
  },
  {
    title:
      'N.D.C.C. § 57-38-01.33 — the exclusion of military retirement benefits, enacted 2019, in full and with no age test or ceiling; claimed by a retired member of the armed forces or their surviving spouse',
    url: 'https://ndlegis.gov/cencode/t57c38.pdf',
  },
  {
    title:
      'N.D.C.C. § 57-38-01.28 — the marriage penalty credit, a non-refundable credit for a joint return where both spouses have qualified income. NOT MODELLED here; the statute sets a $300 maximum and the Tax Commissioner indexes it, to $312 for 2025',
    url: 'https://ndlegis.gov/cencode/t57c38.pdf#nameddest=57-38-01p28',
  },
  {
    title:
      'One Big Beautiful Bill Act (Pub. L. 119-21) § 70101 — the provision that parts North Dakota\'s zero band from the federal 12% bracket in 2026. It substitutes 2016 for 2017 as the chained-CPI base year for the 10% and 12% brackets alone, for tax years beginning after 31 December 2025; every other federal bracket keeps 2017',
    url: 'https://www.congress.gov/bill/119th-congress/house-bill/1/text',
  },
  {
    title:
      'Rev. Proc. 2025-32 — the federal 2026 inflation adjustments, which put the single 12% bracket at $50,400 against North Dakota\'s $49,575. The same figures are in this repository, in us-federal-tax\'s `src/data/2026.ts`, and the cross-package check reads them from there',
    url: 'https://www.irs.gov/pub/irs-drop/rp-25-32.pdf',
  },
];

/**
 * The eight published thresholds a year, stored and not derived.
 *
 * Every figure here is read off a published rate schedule. Two relations are
 * visible in them and NEITHER is applied: the surviving-spouse column is the
 * joint one (which this package's `byStatusOf` default would supply anyway, and
 * which the published tables state in their own headings), and the
 * married-filing-separately figures are half the joint ones rounded down to
 * `$25` in all four published years. The second is asserted in
 * `test/north-dakota.test.js` as an observation about the tables rather than
 * applied here as arithmetic — see this module's doc comment for why that is
 * the opposite of the choice Louisiana's statute compels.
 */
function northDakotaBrackets(year: number): ByStatus<readonly Bracket[]> {
  const zeroBandTop =
    year === 2025
      ? { single: 48_475, joint: 80_975, separate: 40_475, headOfHousehold: 64_950 }
      : { single: 49_575, joint: 82_800, separate: 41_400, headOfHousehold: 66_400 };
  const middleBandTop =
    year === 2025
      ? { single: 244_825, joint: 298_075, separate: 149_025, headOfHousehold: 271_450 }
      : { single: 250_400, joint: 304_850, separate: 152_425, headOfHousehold: 277_600 };
  const schedule = (zero: number, middle: number): readonly Bracket[] => [
    { rate: 0, upTo: zero },
    { rate: 0.0195, upTo: middle },
    { rate: 0.025, upTo: Infinity },
  ];
  return byStatusOf<readonly Bracket[]>({
    single: schedule(zeroBandTop.single, middleBandTop.single),
    joint: schedule(zeroBandTop.joint, middleBandTop.joint),
    separate: schedule(zeroBandTop.separate, middleBandTop.separate),
    headOfHousehold: schedule(zeroBandTop.headOfHousehold, middleBandTop.headOfHousehold),
  });
}

export function northDakota(year: number): StateIncomeTaxDefinition | undefined {
  if (year !== 2025 && year !== 2026) return undefined;
  return {
    code: 'ND',
    name: 'North Dakota',
    year,
    // BOTH YEARS ARE `published`, AND THE 2026 ONE IS THE INTERESTING HALF.
    // The first draft of this module marked 2026 `provisional` and invented a
    // `ProvisionalReason` of `unreadPrimarySource` for it; the compiler refused
    // the reason, and the refusal was right. Every value of that union is a
    // statement about the STATE — the figure is not out yet, the law cannot fix
    // it until the year ends, it is derived under a bound. "I could not open
    // the document" is a statement about this sandbox. The 2026 Form ND-1ES
    // rate schedules exist, carry these eight figures and are cited below; what
    // is weaker here than in 2025 is the reading, and the place for that is the
    // citation, which says NOT OPENED FROM THIS SANDBOX in its own words.
    //
    //   `provisional` IS A CLAIM ABOUT THE PUBLISHER, NOT ABOUT THE READER.
    //
    // Louisiana reached the same place a day earlier for the same reason, and
    // the type system is what stopped the two days diverging.
    status: 'published',
    // Form ND-1 line 1. The federal standard or itemized deduction is already
    // inside it, which is why there is no `deduction` and no `exemption`, and
    // why an OBBBA change to the federal standard deduction moves a North
    // Dakota bill where in a federal-AGI state it would move nothing.
    base: 'federalTaxableIncome',
    deduction: { kind: 'none' },
    // ROLLING, and from a federal-TAXABLE-income base that is the strongest
    // form of it in this package: the federal standard deduction, the four
    // OBBBA Schedule 1-A deductions and § 199A all arrive inside line 1 and
    // North Dakota adds none of them back. `addBacks` is deliberately absent
    // and that is a finding rather than an omission — Colorado, on the same
    // base and the same rolling conformity, adds back § 199A by its own statute
    // and overtime from 2026.
    federalConformity: {
      kind: 'rolling',
      governs: 'belowTheLine',
      cite:
        'N.D.C.C. § 57-38-01(5) and § 57-38-01.3(1) — "Internal Revenue Code" means the federal Code as amended, and North Dakota taxable income is federal taxable income with the § 57-38-30.3 adjustments. The conformity is perpetual rather than dated, which the Tax Commissioner\'s own 2025 corporate instructions put in those words: the starting point "perpetually conforms" to the federal computation.',
      primaryTextUnread:
        'ndlegis.gov, tax.nd.gov, law.justia.com and codes.findlaw.com are all refused by this sandbox\'s egress policy, which is an allowlist of package registries rather than a per-host denial. Rolling status is established from two independent conformity surveys naming § 57-38-01 and § 57-38-01.3(1), from the Tax Commissioner\'s 2025 corporate instructions as server-side search quoted them, and from the absence of any 2025 or 2026 North Dakota act decoupling from OBBBA. What is NOT established from here is whether the Tax Commissioner has published individual-income guidance on the four Schedule 1-A deductions; this package lets them through, which is what rolling conformity and an unamended addition list require.',
    },
    // Line 15, in full and with no income test. The test the 2019 deduction
    // carried — $50,000 of federal AGI single, $100,000 joint — was removed
    // from tax year 2021.
    subtractsTaxableSocialSecurity: true,
    rate: { kind: 'brackets', byStatus: northDakotaBrackets(year) },
    capitalGainsSubtraction: {
      name: 'North Dakota net long-term capital gain exclusion (40%)',
      share: 0.4,
      // THE FOURTH STATE IN THIS RULE AND THE SECOND TO REACH THIS BASIS BY ITS
      // OWN WORDS. § 57-38-30.3(2)(d)(1) reduces taxable income by 40% of "the
      // excess of net long-term capital gain over net short-term capital loss",
      // which is the IRC § 1222(11) arithmetic written out rather than
      // cross-referenced. South Carolina reaches the same base through the
      // federal term itself, so § 1222(11) moving would move South Carolina and
      // not North Dakota or Wisconsin.
      basis: { kind: 'longTermNetted' },
      cite:
        'N.D.C.C. § 57-38-30.3(2)(d)(1) — 40% of the excess of net long-term capital gain over net short-term capital loss, allowed only to the extent the gain is allocated to this state. Form ND-1 line 6, worksheet in the instruction booklet.',
    },
    qualifiedDividendSubtraction: {
      name: 'North Dakota qualified dividend exclusion (40%)',
      share: 0.4,
      cite:
        'N.D.C.C. § 57-38-30.3(2)(d)(2) — 40% of qualified dividend income. Form ND-1 line 13: "multiply the qualified dividends from Form 1040 or 1040-SR, line 3a, by 40%". Line 3a and not line 3b, which is the larger ORDINARY dividend figure.',
    },
    // North Carolina's construction exactly: military retired pay out in full,
    // a pool of nothing for everything else. § 57-38-01.33 has no age test and
    // no ceiling, and a surviving spouse of a retired member claims it on the
    // same line 14.
    retirementIncomeSubtractions: [
      {
        name: 'North Dakota military retirement benefit exclusion',
        scope: 'perPerson',
        cap: 0,
        militaryReducesCap: true,
      },
    ],
    notes: [
      "NORTH DAKOTA'S FIRST BRACKET IS 0%, AND IT IS A BRACKET RATHER THAN A DEDUCTION. A single filer's first $48,475 of 2025 taxable income ($49,575 in 2026) is taxed at nothing, a joint return's first $80,975 ($82,800), a head of household's first $64,950 ($66,400) and a separate return's first $40,475 ($41,400). Above it the rate is 1.95%, and 2.50% above $244,825 single. The top rate ties Arizona's for the lowest in the country among states that tax wages.",
      'THE BASE IS FEDERAL TAXABLE INCOME, NOT FEDERAL AGI, SO NORTH DAKOTA HAS NO STANDARD DEDUCTION AND NO EXEMPTIONS OF ITS OWN — the federal ones are already inside the starting figure. Pass `federal.taxableIncome`. One consequence runs the opposite way from most states here: a change to the FEDERAL standard deduction moves a North Dakota bill directly, at the filer\'s North Dakota marginal rate, where in a federal-AGI state it moves nothing at all. `dependents`, `blindOrDisabled`, `filerAge` and `spouseAge` move no North Dakota figure.',
      "NORTH DAKOTA'S ZERO BAND WAS THE FEDERAL 12% BRACKET FOR THREE YEARS AND IS NOT IN 2026. HB 1158 took the federal 2023 single figure, $44,725, as its base, and the two tracked exactly through 2024's $47,150 and 2025's $48,475. For 2026 North Dakota's is $49,575 and the federal 12% bracket is $50,400, because OBBBA § 70101 moved the chained-CPI base year from 2017 to 2016 for the federal 10% and 12% brackets ALONE and North Dakota's own indexing provision was untouched. $825 of zero-rated income and $16.09 of tax, caused by a federal act that says nothing about North Dakota — and a model that learned the equality from three years of data is wrong in the fourth.",
      "NORTH DAKOTA'S PUBLISHED 2026 SCHEDULE CANNOT BE DERIVED FROM ITS PUBLISHED 2025 ONE, SO DO NOT PROJECT IT. No single multiplier, under any rounding to $25 or $50 in any direction, carries all eight 2025 thresholds to all eight 2026 ones: the married-filing-separately figures require a factor of at least 1.02285 and the head-of-household figures one below 1.02271. The same search fails from the 2023 and 2024 schedules too. The practical size is $25 on a head-of-household threshold, $0.49 of tax — small, systematic, and invisible to anything that does not compare against the published table. This package stores all eight figures a year and derives none.",
      'MARRIED FILING SEPARATELY IS HALF THE JOINT THRESHOLD IN EVERY PUBLISHED YEAR, AND THIS PACKAGE DOES NOT RELY ON IT. 74,750/37,375 in 2023, 78,775/39,375 in 2024, 80,975/40,475 in 2025 and 82,800/41,400 in 2026 — each the joint figure halved and rounded down to $25. No document available to this package states the relation, so it is asserted in the test suite as an observation about four years of tables and not applied in the module as arithmetic. Louisiana, by contrast, stores ONE standard deduction figure and doubles it, because R.S. 47:294(A)(2) states that relation in words.',
      'ONE FORTY PERCENT, TWO BASES, AND THE SECOND IS NOT A CAPITAL GAIN. N.D.C.C. § 57-38-30.3(2)(d) subtracts 40% of the excess of net long-term capital gain over net short-term capital loss (line 6) AND 40% of qualified dividend income (line 13). Pass the first through `netCapitalGain` with `shortTermCapitalGains` beside it, and the second through `qualifiedDividends`. They cannot be combined: a qualified dividend is ordinary income on a federal return and is nowhere inside Form 1040 line 7, so a filer with dividends and no gains has a subtraction that no capital-gain field can produce.',
      'QUALIFIED DIVIDENDS ARE FORM 1040 LINE 3a, NOT LINE 3b, AND THE LARGER FIGURE IS THE WRONG ONE. Line 3b is ordinary dividends and line 3a is the qualified subset of it; a 1099-DIV reports the ordinary figure in box 1a and the qualified one in box 1b. Passing ordinary dividends here overstates the subtraction by 40% of the difference. Leaving the field out leaves a North Dakota answer TOO HIGH by 0.78% of the qualified dividends in the 1.95% band — $78.00 on $10,000 — and 1.00% in the 2.50% band.',
      "A SHORT-TERM LOSS EATS THE CAPITAL GAIN EXCLUSION AND A SHORT-TERM GAIN CANNOT CREATE ONE. § 57-38-30.3(2)(d)(1) writes the IRC § 1222(11) arithmetic out in its own words, so $50,000 of long-term gain behind a $20,000 short-term loss excludes 40% of $30,000, and $50,000 of SHORT-term gain alone excludes nothing. Wisconsin's statute says the same thing in different words and South Carolina reaches it by naming the federal term — which means Congress amending § 1222(11) would move South Carolina's base and leave North Dakota's and Wisconsin's exactly where they are.",
      'NORTH DAKOTA DOES NOT TAX SOCIAL SECURITY, FOR ANYBODY. The federally taxable part comes out in full at line 15 with no income test; the $50,000/$100,000 federal-AGI test the deduction carried when it began in 2019 was removed from tax year 2021. Pass `taxableSocialSecurity`.',
      'MILITARY RETIRED PAY IS EXCLUDED IN FULL AND NOTHING ELSE IS. § 57-38-01.33, at any age, with no cap, and a surviving spouse of a retired member claims it on the same line 14. Every other kind of retirement income is taxed in full — a civilian federal pension, a state or local pension, a 401(k) distribution, an IRA distribution and an annuity. Pass military pay as `retirement.<person>.militaryRetirement`; `retirementIncome` cannot tell it from the rest and buys nothing here. North Dakota is grouped with the retiree-friendly states on the strength of Social Security and military pay alone, and for a retired civil servant it is an ordinary taxing state.',
      'NOT MODELLED — THE MARRIAGE PENALTY CREDIT, which is the only credit on a North Dakota return and is BOUNDED. § 57-38-01.28 gives a joint return a non-refundable credit where both spouses have qualified income, capped at $312 for 2025 ($303 for 2024, $287 for 2023); the statute sets a $300 maximum and the Tax Commissioner indexes it. It is available only where North Dakota taxable income exceeds $81,036 and the SMALLER spouse\'s qualified income exceeds $47,550, both 2025 figures. A joint North Dakota return computed here is therefore too high by at most $312, and by nothing at all for a couple below either threshold or with one earner.',
      'NOT MODELLED, and each would reduce a North Dakota return computed here: the College SAVE (529) contribution deduction of up to $5,000 ($10,000 joint), the stillborn child subtraction, the active-duty National Guard and reserve pay exclusion of § 57-38-30.3(2), the renaissance zone exemptions of Schedule ND-1SA, and the planned-gift and endowment-fund credits. Supply the deduction amounts through `subtractions`; nothing in this package can supply a credit. The lump-sum distribution ADDITION of Form 4972, which would increase the return, is likewise not modelled — pass it through `additions`.',
      'NO CITY, COUNTY OR SCHOOL DISTRICT IN NORTH DAKOTA LEVIES AN INCOME TAX. The state figure is the whole of a North Dakota resident\'s income tax, so `locality` is never required and `SUPPORTED_LOCALITIES` names none here.',
    ],
    citations: ND_CITATIONS,
  };
}
