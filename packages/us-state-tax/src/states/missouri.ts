/**
 * Missouri — the first state in the United States to exempt capital gains from
 * its income tax outright, and the state where the largest marginal rate is a
 * CLIFF built out of the federal tax bill.
 *
 * Alabama, which arrived in this package the day before Missouri, deducts the
 * whole federal income tax at a flat 5%. Missouri deducts a SHARE of it chosen
 * by a chart of five steps, and § 143.171.2 writes the chart as a cliff rather
 * than as a phase-out: 35% of the federal bill at `$25,000` or less of Missouri
 * adjusted gross income, 25% to `$50,000`, 15% to `$100,000`, 5% to `$125,000`
 * and nothing at all above it. **One dollar moves the whole deduction down a
 * step.**
 *
 * | Missouri AGI | share of the federal bill | one dollar at the boundary costs |
 * | --- | --- | --- |
 * | `$25,000` | 35% → 25% | `$4.05` |
 * | `$50,000` | 25% → 15% | `$18.00` |
 * | **`$100,000`** | **15% → 5%** | **`$61.94`** |
 * | `$125,000` | 5% → 0% | `$44.07` |
 *
 * Nothing in a table of Missouri's rates can show that, because the figure that
 * falls off the cliff is a federal one. The `$100,000` step is the largest
 * single-dollar jump in this package outside Maryland's `$6,933.08` capital
 * gains surtax — and unlike that one it is reached by an ordinary wage earner
 * with no gain, no surtax and no planning.
 *
 * ## The rate schedule is one number, and the graduated part is worth $180.63
 *
 * Missouri prints eight brackets. They are **`$1,348` times one through seven**
 * for 2026 (`$1,313` for 2025), indexed as a single figure under § 143.011.5,
 * and the first band is taxed at **zero**. So the whole schedule is:
 *
 * ```
 * 0%  2%  2.5%  3%  3.5%  4%  4.5%   then 4.7% forever, from $9,436
 * ```
 *
 * The tax on the first `$9,436` is `$262.86` at every income above it, and a
 * flat 4.7% on the same money would be `$443.49`. **The entire graduated
 * schedule is worth `$180.63`** — the figure Virginia's is `$257.50` and
 * Alabama's is `$40`. Missouri is a 4.7% flat tax with a `$180.63` discount.
 *
 * And **the brackets do not double on a joint return.** They do not change at
 * all: § 143.011 sets one schedule and § 143.031 lets a married couple file a
 * combined return that computes each spouse's tax separately on it. So the
 * `$180.63` is worth `$180.63` to a single filer and `$180.63` to a couple
 * where Alabama's `$40` becomes `$80` — unless the couple splits its income on
 * the combined return, in which case each spouse runs the schedule once and the
 * discount doubles. This package computes one schedule on the return's taxable
 * income, which is the conservative reading and is what PolicyEngine-US does.
 *
 * ## Capital gains: all of them, short-term included
 *
 * HB 594, signed 10 July 2025 and retroactive to 1 January 2025, adds to
 * § 143.121.3 a subtraction of "one hundred percent of all income reported as a
 * capital gain for federal income tax purposes". It reaches **short-term gain
 * as well as long-term**, which is the opposite end of this package from
 * Massachusetts, where a short-term gain is charged 8.5% against 5% on
 * everything else.
 *
 * The part that is not in any summary is **where** the subtraction sits. It is
 * a modification in arriving at Missouri ADJUSTED GROSS INCOME, and Missouri
 * AGI is the figure the federal income tax deduction's cliff chart is read
 * against. So the exemption does two things at once: it takes the gain out of
 * the base, and it can move the filer DOWN a step of the chart — handing them a
 * larger share of a federal bill that the gain itself made bigger.
 *
 * A single filer with `$90,000` of wages and `$60,000` of long-term gain has
 * `$150,000` of federal AGI and would deduct nothing of their federal tax. With
 * the gain out of Missouri AGI they are at `$90,000`, inside the 15% step, and
 * deduct 15% of a federal bill computed ON the gain. **The exemption is worth
 * more than the gain it exempts.**
 *
 * It also brought a dead letter back to life. The `$5,000` / `$10,000` cap on
 * the federal income tax deduction could not bind on any ordinary return
 * between 2019 and 2024 — 35% of a bill reaches `$5,000` only at `$14,286` of
 * federal tax, which nobody with `$25,000` of Missouri AGI pays, and the other
 * four steps need `$40,000`, `$66,667` and `$200,000` against lower income
 * still. A filer with `$4,000,000` of gain and `$20,000` of wages now has a
 * federal bill near `$900,000` and `$20,000` of Missouri AGI, and the cap is
 * the only thing standing between them and `$315,000` of deduction.
 *
 * ## And a retiree's Social Security eats their pension exemption
 *
 * Missouri is described everywhere as a state that exempts Social Security and
 * public pensions. Both halves are true and **they are not additive.** Form
 * MO-A Part 3 Section A caps the public pension deduction at the maximum Social
 * Security benefit — `$47,633` for 2025 — and then subtracts the Social
 * Security deduction the same person took in Section C.
 *
 * | a retiree with `$70,000` | Missouri deduction |
 * | --- | --- |
 * | all of it public pension | `$47,633` |
 * | `$40,000` pension + `$30,000` taxable benefit | `$40,000` |
 *
 * The second retiree is `$7,633` worse off on identical income, in a state that
 * taxes neither kind of it. It is Maryland's construction reached from the
 * other direction, and Missouri's own Department of Revenue states it in one
 * sentence that no ranking of retiree-friendly states repeats.
 *
 * The private pension deduction on the same form disagrees with Section A about
 * the same dollars. `$6,000` a person, withdrawn DOLLAR FOR DOLLAR as Missouri
 * AGI **less the taxable Social Security** rises above `$25,000` (`$32,000`
 * joint, `$16,000` separate) — so the benefit that destroyed the public pension
 * exemption protects the private one. Dollar for dollar is Virginia's age
 * deduction shape: inside the band the marginal rate is **double** the
 * statutory one, 9.4% in a 4.7% state.
 */
import type { ConditionalNote, StateIncomeTaxDefinition } from '../definition.js';
import { byStatus, byStatusOf } from './helpers.js';
import type { Bracket, Citation } from '../types.js';

/**
 * § 143.011.1 and the § 143.011.5 indexation. ONE indexed figure generates the
 * whole schedule: the bands are that figure times one through seven, the first
 * of them is taxed at zero, and the rate above the seventh is the only number
 * the General Assembly has moved since 2022.
 *
 * Written as a generator rather than as two literal tables, because the
 * relationship IS the provision: § 143.011.5 indexes "the brackets" as a block
 * by the same percentage, and a table of eight transcribed numbers can drift
 * from that by a dollar in a way nothing would catch.
 */
const BRACKET_RATES: readonly number[] = [0, 0.02, 0.025, 0.03, 0.035, 0.04, 0.045];

/** The top rate. § 143.011.3 cut it to 4.8% for 2024 and 4.7% for 2025. */
const TOP_RATE = 0.047;

/** The indexed first-bracket width, which is also the whole schedule. */
const BRACKET_STEP: Readonly<Record<number, number>> = { 2025: 1_313, 2026: 1_348 };

function schedule(step: number): readonly Bracket[] {
  return [
    ...BRACKET_RATES.map((rate, i) => ({ rate, upTo: step * (i + 1) })),
    { rate: TOP_RATE, upTo: Infinity },
  ];
}

/**
 * § 143.171.2. A cliff chart and not a phase-out, and the boundary belongs to
 * the step BELOW it: the first step is "twenty-five thousand dollars or less"
 * and the second is "in excess of twenty-five thousand dollars but not in
 * excess of fifty thousand dollars", so a filer standing exactly on `$25,000`
 * keeps 35%.
 */
const FEDERAL_TAX_RATE_STEPS: readonly { readonly upTo: number; readonly rate: number }[] = [
  { upTo: 25_000, rate: 0.35 },
  { upTo: 50_000, rate: 0.25 },
  { upTo: 100_000, rate: 0.15 },
  { upTo: 125_000, rate: 0.05 },
  { upTo: Infinity, rate: 0 },
];

/**
 * The maximum Social Security benefit, which is the ceiling on the public
 * pension deduction. Printed on Form MO-A Part 3 Section A line 7.
 *
 * 2026's figure does not exist yet: the 2026 MO-A is published in January 2027,
 * so the 2025 number is carried forward and declared provisional. That is a
 * different thing from a figure nobody has looked up — see `provisionalFigures`
 * below, which says which document would settle it.
 */
const MAX_SOCIAL_SECURITY_BENEFIT: Readonly<Record<number, number>> = {
  2025: 47_633,
  2026: 47_633,
};

const CITATIONS: readonly Citation[] = [
  {
    title:
      'Mo. Rev. Stat. § 143.011 — the rate schedule and its top-rate reductions: 4.95% for 2023, 4.8% for 2024 and 4.7% from 2025, with further 0.1-point cuts conditioned on general revenue growth',
    url: 'https://revisor.mo.gov/main/OneSection.aspx?section=143.011',
  },
  {
    title:
      'Mo. Rev. Stat. § 143.021 — "no tax on taxable income, when": the tax is zero below the first bracket, which the 0% first band already produces',
    url: 'https://revisor.mo.gov/main/OneSection.aspx?section=143.021',
  },
  {
    title:
      'Mo. Rev. Stat. § 143.171 — the federal income tax deduction: a percentage of the federal bill chosen by Missouri adjusted gross income, capped at $5,000 on a single taxpayer’s return and $10,000 on a combined return',
    url: 'https://revisor.mo.gov/main/OneSection.aspx?section=143.171',
  },
  {
    title:
      'Mo. Rev. Stat. § 143.121 — Missouri adjusted gross income; subsection 3(14), added by HB 594 (2025), subtracts 100% of all income reported as a capital gain for federal income tax purposes',
    url: 'https://www.revisor.mo.gov/main/OneSection.aspx?section=143.121&bid=57543',
  },
  {
    title:
      'Missouri HB 594 (2025), signed 10 July 2025 — the capital gains exemption for individuals, retroactive to tax year 2025, with a trigger extending it to corporations once the top individual rate reaches 4.5%',
    url: 'https://www.senate.mo.gov/BillTracking/Bills/BillInformation?year=2025&billid=4957943',
  },
  {
    title:
      'Mo. Rev. Stat. § 143.124 — the pension and Social Security deductions: the public pension ceiling is the maximum Social Security benefit, the private pension deduction is $6,000 per person withdrawn against an income allowance, and military retired pay is exempt in full',
    url: 'https://revisor.mo.gov/main/OneSection.aspx?section=143.124',
  },
  {
    title:
      'Mo. Rev. Stat. § 143.125 — the Social Security deduction; SB 190 (2023) removed the income test from tax year 2024',
    url: 'https://revisor.mo.gov/main/OneSection.aspx?section=143.125',
  },
  {
    title:
      'Mo. Rev. Stat. § 143.131 — the Missouri standard deduction IS the federal one, so every federal change to it is a Missouri change with no Missouri legislation',
    url: 'https://revisor.mo.gov/main/OneSection.aspx?section=143.131',
  },
  {
    title:
      'Mo. Rev. Stat. § 143.161 — exemptions: the personal and dependent exemptions are defined by reference to the federal ones and are therefore zero, and the $1,400 addition for a head of household or qualifying surviving spouse is not',
    url: 'https://www.revisor.mo.gov/main/OneSection.aspx?section=143.161',
  },
  {
    title: 'Mo. Rev. Stat. § 143.022 — the business income deduction, 20% from 2023',
    url: 'https://revisor.mo.gov/main/OneSection.aspx?section=143.022',
  },
  {
    title:
      'Missouri Department of Revenue — 2026 Missouri Withholding Tax Formula: the bracket table ($1,348 steps to $9,436, then 4.7%) and the standard deductions of $16,100, $24,150 and $32,200',
    url: 'https://dor.mo.gov/forms/Withholding%20Formula_2026.pdf',
  },
  {
    title:
      'Missouri Department of Revenue — Pension FAQs: the public pension exemption is capped at the maximum Social Security benefit, $47,633 for 2025, and is REDUCED by any Social Security or Social Security disability deduction claimed',
    url: 'https://dor.mo.gov/faq/taxation/individual/pension.html',
  },
  {
    title:
      'Missouri Department of Revenue — Form MO-A, Individual Income Tax Adjustments: Part 3 Section A public pensions, Section B private pensions, Section C Social Security',
    url: 'https://dor.mo.gov/forms/MO-A_2025.pdf',
  },
];

/**
 * The one 2026 figure nobody can look up yet. It leads the 2026 note list
 * because `provisional.test.js` requires a provisional state-year to say so
 * before it says anything else.
 */
const PROVISIONAL_NOTE_2026 =
  'PROVISIONAL, one figure: the $47,633 ceiling on the public pension deduction is the 2025 amount carried forward. It is the maximum Social Security benefit, reprinted on Form MO-A Part 3 Section A line 7 every January, and the 2026 MO-A is not published until January 2027. The figure has risen every year, so carrying 2025 forward understates the deduction rather than overstating it \u2014 a retiree with a pension above the ceiling is too HIGH here by 4.7% of whatever the increase turns out to be, which has run $1,700 to $2,000 a year and is therefore about $90 of tax. Everything else about Missouri 2026 was read: the 4.7% rate and the $1,348 bracket width are both in the Department of Revenue 2026 withholding formula, published 1 November 2025, and the standard deduction is the federal one.';

const NOTES: readonly string[] = [
  'MISSOURI DEDUCTS A SHARE OF THE FEDERAL BILL AND THE CHART IS A CLIFF. § 143.171.2 gives 35% of the federal income tax at $25,000 or less of MISSOURI adjusted gross income, 25% to $50,000, 15% to $100,000, 5% to $125,000 and nothing above — one percentage for the whole bill, chosen by one number. So one dollar of income at a boundary moves the entire deduction down a step: at $100,000 the deduction falls by 10% of a federal bill of about $13,000, which is $61.94 OF MISSOURI TAX ON ONE DOLLAR. Pass `federal.incomeTaxBeforeRefundableCredits` — Form 1040 line 22 plus the Form 8960 net investment income tax. Omitting it makes the Missouri answer too HIGH by the whole deduction.',
  'AND THE FEDERAL REFUNDABLE CREDITS COME BACK OFF IT, as they do in Alabama. The MO-1040 line 9 worksheet starts from the federal tax and subtracts the earned income credit, the refundable American Opportunity credit and the net premium tax credit, floored at zero. So `federal.earnedIncomeCredit` RAISES Missouri tax — by the credit times the step times the Missouri rate, which is at most about 1.6 cents in the dollar against Alabama’s 5 — where the six states here that match the federal credit read the same field to lower theirs.',
  'THE BOUNDARY BELONGS TO THE STEP BELOW IT. § 143.171.2 reads "twenty-five thousand dollars or less" and then "in excess of twenty-five thousand dollars", so a filer standing exactly on $25,000, $50,000, $100,000 or $125,000 of Missouri AGI keeps the HIGHER share. That is Connecticut’s § 12-703 convention and the opposite of the one Connecticut’s own pension phase-out uses on the same return; this package reads the words rather than the chart in both states.',
  'THE CAP WAS DEAD LAW UNTIL 2025 AND THE CAPITAL GAINS EXEMPTION REVIVED IT. The deduction may not exceed $5,000 on a single taxpayer’s return or $10,000 on a combined one, and the chart above had made that unreachable: 35% of a federal bill is $5,000 only when the bill is $14,286, which no filer with $25,000 or less of Missouri AGI pays, and the other steps need $40,000, $66,667 or $200,000 of federal tax against lower Missouri income still. HB 594 then took capital gains out of MISSOURI AGI — the very figure the chart reads — so a filer with $4,000,000 of gain and $20,000 of wages now sits in the 35% step with a federal bill near $900,000. The cap is the only thing between them and $315,000 of deduction.',
  'MISSOURI IS THE FIRST STATE TO EXEMPT CAPITAL GAINS OUTRIGHT, AND IT REACHES SHORT-TERM GAIN. § 143.121.3(14), added by HB 594 and retroactive to 1 January 2025, subtracts "one hundred percent of all income reported as a capital gain for federal income tax purposes". Pass the whole of Form 1040 line 7 as `netCapitalGain`, short-term included — the same field Maryland reads for its 2% surtax, where the classes that state exempts have to be removed first. A $1,000,000 long-term gain costs a Missouri resident $0 of state tax and a Massachusetts resident $50,000.',
  'AND THE EXEMPTION IS WORTH MORE THAN THE GAIN, because it is a subtraction in arriving at MISSOURI AGI rather than a deduction from it. Missouri AGI is what the federal income tax deduction’s chart is read against, so taking the gain out can move the filer down a step and hand them a larger share of a federal bill the gain itself made bigger. A single filer with $90,000 of wages and $60,000 of gain goes from no federal tax deduction at $150,000 to 15% of one at $90,000.',
  'THE EIGHT BRACKETS ARE ONE NUMBER. § 143.011.5 indexes the schedule as a block, so the bands are the first-bracket width times one through seven — $1,313 for 2025 and $1,348 for 2026 — the first band is taxed at ZERO, and 4.7% begins at $9,436. The tax on everything below that is $262.86 at every income, where a flat 4.7% would be $443.49: THE WHOLE GRADUATED SCHEDULE IS WORTH $180.63, which is Virginia’s $257.50 and Alabama’s $40 in a third state. $175.94 for 2025.',
  'THE BRACKETS DO NOT DOUBLE ON A JOINT RETURN. They do not change at all — § 143.011 sets one schedule for every filing status, so the $180.63 discount is the same figure for a couple as for a single filer where Alabama’s $40 becomes $80. Missouri’s combined return (§ 143.031) computes each spouse’s tax on their own share and would run the schedule twice; this package applies it once to the return’s taxable income, which is the lower-allowance reading and is what PolicyEngine-US does. A two-earner couple who split their income evenly on a combined return may therefore be up to $180.63 better off than this figure.',
  'THE STANDARD DEDUCTION IS THE FEDERAL ONE, by § 143.131 and not by coincidence — $16,100, $24,150 and $32,200 for 2026, the additional amounts for age and blindness included. So the OBBBA’s increase cut Missouri tax with no Missouri legislation, exactly as it did in Arizona. The OBBBA senior, tips, overtime and car-loan deductions are NOT part of it: they are below-the-line deductions outside § 63(c), Missouri has not adopted any of them, and a Missouri filer keeps the whole of that income in the state base.',
  'MISSOURI HAS NO PERSONAL OR DEPENDENT EXEMPTION LEFT. § 143.161 defines both by reference to the federal exemption, which § 151(d)(5) set to zero and the OBBBA made permanent — so they are zero and a dependent is worth nothing on a Missouri return. The ONE survivor is the $1,400 addition for a head of household or a qualifying surviving spouse, which is written in Missouri’s own words and appears on MO-1040 line 15.',
  'A RETIREE’S SOCIAL SECURITY EATS THEIR PUBLIC PENSION EXEMPTION. Form MO-A Part 3 Section A caps the public pension deduction at the maximum Social Security benefit — $47,633 for 2025 — and then SUBTRACTS the Social Security deduction the same person took in Section C. So $70,000 of public pension alone deducts $47,633, and the same $70,000 as $40,000 of pension plus $30,000 of taxable benefit deducts $40,000: $7,633 less, on identical income, in a state that taxes neither kind of it. That is Maryland’s construction from the other direction — Maryland charges the GROSS benefit against its exclusion, Missouri charges the deduction actually taken. Pass public retired pay as `retirement.filer.governmentPension`.',
  'THE PRIVATE PENSION DEDUCTION DISAGREES WITH IT ABOUT THE SAME DOLLARS. Section B gives $6,000 a person and withdraws it DOLLAR FOR DOLLAR as Missouri AGI LESS the taxable Social Security rises above $25,000 ($32,000 joint, $16,000 separate) — so the benefit that destroyed the public pension exemption protects the private one, on one form. Dollar for dollar is Virginia’s age deduction shape and has the same consequence: inside the band the marginal rate is DOUBLE the statutory one, 9.4% in a 4.7% state, and the deduction is gone by $31,000 for a single filer with one $6,000 pension. Pass pensions, 401(k) and 403(b) draws as `retirement.filer.employerPlanPension` or `definedContributionPlan` and IRA distributions as `iraDistributions`; all three are Section B income.',
  'SOCIAL SECURITY IS EXEMPT FROM 62 AND THE INCOME TEST IS GONE. § 143.125, as SB 190 (2023) left it, deducts the whole taxable benefit for a person who has reached 62 by 31 December, with no income limit from tax year 2024 — and Social Security DISABILITY has no age test at all. Below 62 an ordinary retirement benefit is fully taxable in Missouri. Pass `taxableSocialSecurity` with the ages; where the two people on a return differ in age the taxable part is split in proportion to the gross benefits each received, which is the only split a return carries.',
  'MILITARY RETIRED PAY IS EXEMPT IN FULL, at any age, with no cap, and OUTSIDE the public pension ceiling that federal, state and local retired pay share. § 143.124.9. Pass it as `retirement.filer.militaryRetirement` and not as `governmentPension`, which would cap it at $47,633 and charge Social Security against it.',
  'A FIFTH OF BUSINESS INCOME COMES OFF. § 143.022 deducts 20% of the income from a sole proprietorship or a share of a partnership or S corporation, at every income, with no cap — which is the opposite shape from Ohio’s, where the first $250,000 is deducted in full and the excess is charged a flat 3%. $250,000 of Schedule C profit deducts $50,000 in Missouri and all of it in Ohio. Pass it as `businessIncome`.',
  'NOT MODELLED: the Kansas City and St. Louis earnings taxes, 1% each. Both cities charge 1% of gross earnings — of every resident wherever they work, and of every non-resident for work performed inside the city — with no deduction, no exemption and no reference to this return. For a Kansas City resident earning $60,000 that is $600 a year against about $2,050 of Missouri tax, so a model that omits it is low by nearly a quarter of the total. They are not in this package’s locality registry yet.',
  'NOT MODELLED: the Missouri property tax credit (§ 135.010), the working family tax credit (§ 143.177, 10% of the federal earned income credit and non-refundable), the long-term care insurance deduction, the health care sharing ministry deduction, the qualified health insurance premium subtraction and the $8,000 MOST 529 subtraction. The first two are the largest: the property tax credit is worth up to $1,100 to an elderly or disabled filer and the working family credit up to about $800 to a family with three children. Supply the credits yourself; the 529 and health premium figures go in `subtractions`.',
  'THE ZERO BRACKET AND § 143.021 ARE TWO COPIES OF ONE THRESHOLD. § 143.021 says there is no tax where taxable income falls below the first bracket, and § 143.011 taxes that first bracket at 0% — so the statute states the same rule twice and this engine implements the bracket, which is the one that also produces the right answer one dollar above it. The two cannot disagree while the first rate is zero, and if a future General Assembly makes it positive they will.',
  'THE TOP RATE IS 4.7% FOR BOTH YEARS AND IT WAS NOT A FORECAST. § 143.011.4 allows up to ten further 0.1-point reductions, one a year, each conditioned on general revenue growth of $175,000,000 over the highest of the three preceding fiscal years. The condition was not met for 2026: the Department of Revenue’s 2026 withholding formula, published 1 November 2025, carries 4.7%. A flat-tax replacement for the whole schedule has been introduced repeatedly and, as of this package’s publication, has not been enacted — the live proposal is a constitutional amendment for the ballot rather than a statute.',
  'THIS PACKAGE STARTS MISSOURI FROM FEDERAL AGI, which is what MO-1040 line 1 asks for. Missouri’s own additions and subtractions live on Form MO-A Part 1 — out-of-state municipal bond interest and state tax refunds up, United States obligation interest and the items listed above down. Supply the ones this package does not compute through `additions` and `subtractions`.',
];

/**
 * The notes that are about THIS return rather than about Missouri.
 *
 * The first is the same hazard Alabama introduced and Missouri makes worse: the
 * federal bill is an input, and a missing one looks exactly like a zero. It is
 * worse here because the consequence is not proportional — a Missouri filer who
 * omits it loses a deduction whose SIZE depends on a chart they also cannot see.
 */
const CONDITIONAL_NOTES: readonly ConditionalNote[] = [
  {
    relevantWhen: (input) => (input.federal.incomeTaxBeforeRefundableCredits ?? 0) <= 0,
    text:
      'NO FEDERAL INCOME TAX WAS SUPPLIED, so MO-1040 line 13 was taken as zero and this Missouri figure is TOO HIGH by the share of the federal bill this household could have deducted — 15% of the $13,000 a single filer owes on $100,000 of wages is $1,950 of deduction and $91.65 of tax. Pass `federal.incomeTaxBeforeRefundableCredits`: Form 1040 line 22, the tax after non-refundable credits, plus the Form 8960 net investment income tax. A filer who genuinely owes no federal tax can ignore this note; there is no way for the engine to tell the two apart.',
  },
  {
    relevantWhen: (input) =>
      (input.shortTermCapitalGains ?? 0) > 0,
    text:
      'A SHORT-TERM GAIN WAS SUPPLIED AND MISSOURI DID NOT READ IT. Missouri subtracts "all income reported as a capital gain for federal income tax purposes", short-term included, and it reads ONE field — `netCapitalGain`, the whole of Form 1040 line 7. `shortTermCapitalGains` is Massachusetts’s field, because Massachusetts charges that half 8.5% and the other half 5%; adding it here would count the same dollars twice for a caller who supplies both. Check that your short-term gain is INSIDE the figure you passed as `netCapitalGain` \u2014 if it is not, this Missouri answer is too high by 4.7% of it.',
  },
  {
    relevantWhen: (input) =>
      (input.taxableSocialSecurity ?? 0) > 0 &&
      (input.filerAge ?? 0) < 62 &&
      (input.spouseAge ?? 0) < 62 &&
      input.retirement?.filer?.totallyDisabled !== true &&
      input.retirement?.spouse?.totallyDisabled !== true,
    text:
      'THE SOCIAL SECURITY ON THIS RETURN WAS TAXED, because nobody on it has reached 62. \u00a7 143.125 gates the deduction on age 62 by 31 December \u2014 where Alabama, the other state here that exempts the benefit, has no age test at all \u2014 so a survivor at 60 or an early retiree pays Missouri tax on a benefit the same household will stop paying on their sixty-second birthday: $20,400 of taxable benefit is $958.80 a year. If an age is simply missing rather than low, pass `filerAge` and, on a joint return, `spouseAge`. A person receiving Social Security DISABILITY is exempt at any age and is marked with `retirement.filer.totallyDisabled`.',
  },
  {
    relevantWhen: (input) =>
      (input.retirement?.filer?.governmentPension ?? 0) > 0 ||
      (input.retirement?.spouse?.governmentPension ?? 0) > 0,
    text:
      'THE PUBLIC PENSION DEDUCTION HERE IS NET OF THE SOCIAL SECURITY ONE. Form MO-A Part 3 Section A caps the deduction at the maximum Social Security benefit, $47,633, and subtracts the Section C Social Security deduction from it — so a benefit does not add to a public pension exemption, it consumes it. If the pension is MILITARY retired pay, move it to `retirement.filer.militaryRetirement`: § 143.124.9 exempts that in full, at any age, outside this ceiling and with no Social Security offset.',
  },
];

export function missouri(year: number): StateIncomeTaxDefinition | undefined {
  if (year !== 2025 && year !== 2026) return undefined;
  const step = BRACKET_STEP[year] as number;
  const bands = schedule(step);
  return {
    code: 'MO',
    name: 'Missouri',
    year,
    // The rate schedule, the standard deduction and the withholding formula are
    // all published for 2026. The ONE figure that is not is the maximum Social
    // Security benefit on Form MO-A Part 3 Section A line 7, because the 2026
    // MO-A is published in January 2027.
    status: year >= 2026 ? 'provisional' : 'published',
    provisionalFigures:
      year >= 2026
        ? [
            {
              path: 'stateRetirementDeduction.publicPensionCap',
              reason: 'awaiting-publication' as const,
              carriedForwardFrom: 2025,
              resolvedBy:
                'the 2026 Form MO-A, Part 3 Section A line 7, published January 2027 — the figure is the maximum Social Security benefit and has risen every year, so carrying 2025 forward understates the deduction rather than overstating it',
            },
          ]
        : undefined,
    base: 'federalAdjustedGrossIncome',
    // ONE schedule for every filing status. § 143.011 does not vary by status
    // and § 143.031's combined return computes each spouse's tax on their own
    // share of it rather than widening the bands.
    rate: {
      kind: 'brackets',
      byStatus: byStatusOf<readonly Bracket[]>({
        single: bands,
        joint: bands,
        separate: bands,
        headOfHousehold: bands,
      }),
    },
    // § 143.131.2 — the Missouri standard deduction IS the federal one, age and
    // blindness additions included. Arizona is the only other state here that
    // does this, and the consequence is the same: a change Congress makes to
    // § 63(c) is a Missouri tax change nobody in Jefferson City voted for.
    deduction: { kind: 'federal' },
    itemizedDeduction: {
      name: 'Missouri itemized deductions (Form MO-A Part 2)',
      // § 143.141 allows the Missouri itemized deduction only to a filer who
      // itemized federally, which is the Maryland rule and not the Alabama one.
      // So the OBBBA's larger standard deduction took the Missouri itemized
      // deduction away from filers whose Missouri deductions had not changed.
      requiresFederalItemizing: true,
      // Missouri's Schedule A is the federal one with the state and local
      // INCOME taxes removed and the FICA and self-employment taxes added —
      // which is not the same set as Alabama's, so `payrollTaxIsItemized` is
      // deliberately absent and the caller supplies the Missouri total.
      phaseOutRate: 0,
      phaseOutThreshold: byStatus({
        single: Infinity,
        joint: Infinity,
        separate: Infinity,
        headOfHousehold: Infinity,
      }),
    },
    federalIncomeTaxDeduction: {
      name: 'Federal income tax deduction',
      cite: 'Mo. Rev. Stat. § 143.171.2, MO-1040 line 13 — a percentage of the federal income tax liability, deducted below the line 12 standard-or-itemized choice and additional to it, by every filer rather than only by itemizers.',
      // NOT `additionalChildTaxCredit`, which is where Missouri's worksheet
      // differs from Alabama's: the MO-1040 line 9 worksheet starts from Form
      // 1040 LINE 22, and the refundable child tax credit on line 28 never
      // reduced line 22, so there is nothing to add back. Alabama's worksheet
      // does subtract it. One shared constant here would have charged a
      // Missouri family for a credit their form ignores.
      refundableCredits: ['earnedIncomeCredit', 'refundableAmericanOpportunityCredit'],
      refundableCreditsCite:
        'The MO-1040 line 9 worksheet starts from Form 1040 line 22 and subtracts the earned income credit, the refundable American Opportunity credit and the net premium tax credit, flooring the result at zero: those are money received rather than tax paid.',
      rateSteps: FEDERAL_TAX_RATE_STEPS,
      rateStepsCite:
        'Mo. Rev. Stat. § 143.171.2 — 35% where Missouri adjusted gross income is "twenty-five thousand dollars or less", 25% "in excess of twenty-five thousand dollars but not in excess of fifty thousand dollars", 15% to $100,000, 5% to $125,000 and none above. One percentage applies to the WHOLE bill, and the boundary belongs to the lower step.',
      cap: byStatus({
        // "...not to exceed five thousand dollars on a single taxpayer's
        // return or ten thousand dollars on a combined return." A combined
        // return is Missouri's joint one; a separate return, a head of
        // household return and a qualifying surviving spouse return each have
        // one taxpayer on them. PolicyEngine-US reads the first figure as
        // belonging only to the SINGLE status and gives $10,000 to the other
        // three, which is the opposite reading of the same sentence — it is
        // recorded as a known divergence rather than silently followed, and it
        // can only matter on a return where the cap binds at all.
        single: 5_000,
        joint: 10_000,
        separate: 5_000,
        headOfHousehold: 5_000,
        qualifyingSurvivingSpouse: 5_000,
      }),
      capCite:
        'Mo. Rev. Stat. § 143.171.2 — "not to exceed five thousand dollars on a single taxpayer’s return or ten thousand dollars on a combined return". The cap applies AFTER the percentage, which is why it could not bind on an ordinary return before HB 594 took capital gains out of the income the percentage is chosen by.',
    },
    capitalGainsSubtraction: {
      name: 'Capital gains subtraction',
      share: 1,
      includesShortTerm: true,
      cite: 'Mo. Rev. Stat. § 143.121.3(14), added by HB 594 (2025) and retroactive to 1 January 2025 — "one hundred percent of all income reported as a capital gain for federal income tax purposes", which reaches short-term gain as well as long-term. It is a modification in arriving at Missouri adjusted gross income, so it moves the figure § 143.171.2’s percentage chart is read against.',
    },
    stateRetirementDeduction: {
      socialSecurityName: 'Social Security benefit deduction',
      socialSecurityMinimumAge: 62,
      socialSecurityCite:
        'Mo. Rev. Stat. § 143.125, Form MO-A Part 3 Section C — the whole taxable benefit for a person who has reached 62 by 31 December, or at any age where the benefit is Social Security disability. SB 190 (2023) removed the income test from tax year 2024.',
      publicPensionName: 'Public pension deduction',
      publicPensionCap: MAX_SOCIAL_SECURITY_BENEFIT[year] as number,
      publicPensionCite:
        'Mo. Rev. Stat. § 143.124, Form MO-A Part 3 Section A — retired pay from any federal, state or local government, up to the maximum Social Security benefit, LESS the Social Security deduction the same person took in Section C. The offset is the provision rather than an approximation of it: a benefit consumes the pension exemption dollar for dollar.',
      privatePensionName: 'Private pension deduction',
      privatePensionPerPersonCap: 6_000,
      privatePensionAllowance: byStatus({
        single: 25_000,
        joint: 32_000,
        separate: 16_000,
        headOfHousehold: 25_000,
        // A qualifying surviving spouse takes the SINGLE allowance and not the
        // joint one, which is where Missouri's Section B differs from the
        // default this package applies everywhere else: Form MO-A groups
        // "single, head of household, qualifying widow(er)" on one line and
        // gives married filing combined a line of its own. There is one person
        // on the return and the allowance is for the return.
        qualifyingSurvivingSpouse: 25_000,
      }),
      privatePensionCite:
        'Mo. Rev. Stat. § 143.124.2, Form MO-A Part 3 Section B — $6,000 a person of pension, annuity, IRA, 401(k), 403(b), SEP or Keogh income, reduced DOLLAR FOR DOLLAR by the amount Missouri adjusted gross income LESS the taxable Social Security exceeds the allowance for the filing status.',
      militaryRetirementName: 'Military pension deduction',
      militaryRetirementCite:
        'Mo. Rev. Stat. § 143.124.9 — military retired pay is deducted in full, at any age, with no cap, and outside the ceiling that federal, state and local civilian retired pay shares.',
    },
    businessIncomeDeduction: {
      name: 'Business income deduction',
      rate: 0.2,
      cite: 'Mo. Rev. Stat. § 143.022 — 20% of the income from a sole proprietorship or a share of a partnership or S corporation, MO-1040 line 17. The percentage rose five points a year from 2018 and reached its statutory maximum of 20% in 2023.',
    },
    exemption: {
      // § 143.161 defines the personal and dependent exemptions by reference to
      // the federal ones, which § 151(d)(5) set to zero. What remains is one
      // addition in Missouri's own words, for two statuses.
      separateReturnSpouse: {
        spouse: 'notClaimed',
        agedAndBlind: 'notApplicable',
        cite: 'Mo. Rev. Stat. § 143.161.1 grants an exemption "for each exemption to which the taxpayer is entitled for federal income tax purposes", and § 151(d)(5) has set that to zero since 2018 — so there is no Missouri exemption for a spouse on a separate return, nor for anyone else. The $1,400 below is § 143.161.2 and is conditioned on the filing status rather than on a person. Missouri has no aged or blind exemption: the age and blindness additions reach a Missouri return through the federal STANDARD DEDUCTION, which § 143.131 adopts whole.',
      },
      perFiler: byStatus({
        single: 0,
        joint: 0,
        separate: 0,
        headOfHousehold: 1_400,
        qualifyingSurvivingSpouse: 1_400,
      }),
      perDependent: 0,
    },
    notes: year >= 2026 ? [PROVISIONAL_NOTE_2026, ...NOTES] : NOTES,
    conditionalNotes: CONDITIONAL_NOTES,
    citations: CITATIONS,
  };
}
