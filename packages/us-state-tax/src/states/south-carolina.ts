/**
 * South Carolina — the twenty-sixth taxing state here, and the first whose two
 * supported years are **two different laws rather than two sets of figures**.
 *
 * Act 110 of 2026 (H.4216), signed 30 March 2026 and effective for tax years
 * beginning after 2025, did four things an income tax does not usually do all at
 * once:
 *
 * 1. replaced a three-bracket schedule — 0%, 3%, 6% — with two, 1.99% and 5.21%;
 * 2. moved the starting point from **federal taxable income** to **federal
 *    adjusted gross income**, decoupling the state from IRC § 63(b)-(g);
 * 3. put a new deduction of its own, the SCIAD, where the federal standard
 *    deduction used to be, and phased it out on federal AGI; and
 * 4. **capped the state earned income credit at `$200`**, where it had been 125%
 *    of the federal credit with no ceiling at all.
 *
 * Every other state in this package has one mechanism and two years of figures.
 * This one has two mechanisms, and the pair is worth more than either: the
 * difference between the two years is a measurement of what the reform did,
 * taken on the same household by the same engine.
 *
 * **And the reform cured a conformity gap without touching the conformity
 * date.** S.C. Code § 12-6-40(A)(1)(a) reads the Internal Revenue Code as
 * amended through **31 December 2024**, and the One Big Beautiful Bill Act was
 * enacted 4 July 2025 — so a 2025 South Carolina return adds back the OBBBA
 * increase in the standard deduction and all four Schedule 1-A deductions, none
 * of which exist in the Code South Carolina reads. The 2026 return starts at
 * federal AGI, which is **above** every one of them. The date is still 31
 * December 2024 and can no longer reach an individual wage return.
 *
 * **THE RULE: A STATE CAN CURE A CONFORMITY GAP BY MOVING ITS STARTING LINE
 * INSTEAD OF MOVING ITS DATE.** Which is the half of conformity
 * {@link FederalConformityRule} was built to make visible: the figures agree
 * with a conforming state's and the authority behind them does not.
 */
import type { StateIncomeTaxDefinition } from '../definition.js';
import { byStatus, uniform } from './helpers.js';
import type { Bracket, Citation, ByStatus } from '../types.js';

const CITATIONS: readonly Citation[] = [
  {
    title:
      'S.C. Code § 12-6-510 — the individual income tax rate schedule: 0%, 3% and 6% for 2025, and the two-bracket 1.99% / 5.21% schedule of subsection (C) from 2026',
    url: 'https://www.scstatehouse.gov/code/t12c006.php',
  },
  {
    title:
      'S.C. Code § 12-6-520 — the annual adjustment of the bracket thresholds by the consumer price index, capped at 4% a year',
    url: 'https://www.scstatehouse.gov/code/t12c006.php',
  },
  {
    title:
      'South Carolina Act 110 of 2026 (H.4216), signed 30 March 2026 — § 1 the two-bracket schedule, § 3 the SCIAD at § 12-6-1140(15), § 7 the $200 earned income credit cap',
    url: 'https://www.scstatehouse.gov/sess126_2025-2026/bills/4216.htm',
  },
  {
    title:
      'SCDOR — Information about H. 4216: federal AGI becomes the starting point, the state decouples from IRC §§ 63(b)-(g), and the SCIAD replaces the federal standard deduction, effective tax year 2026',
    url: 'https://dor.sc.gov/news/information-about-h-4216',
  },
  {
    title:
      'SCDOR Information Letter 26-20 — the SCIAD table and the phase-out fraction, including the rounding of the reduction down to the next lowest $10',
    url: 'https://dor.sc.gov/sites/dor/files/policies/IL26-20.pdf',
  },
  {
    title:
      'SCDOR — 2025 Individual Income Tax Instructions (SC1040): the published 2025 rate schedule, the dependent exemption worksheet, the two wage earner credit worksheet and the subtractions',
    url: 'https://dor.sc.gov/sites/dor/files/forms/SC1040Instr_2025.pdf',
  },
  {
    title:
      'SCDOR — Income Tax: South Carolina Internal Revenue Code Conformity Update, the adjustments a 2025 return makes for One Big Beautiful Bill Act provisions South Carolina has not adopted',
    url: 'https://dor.sc.gov/income-tax-south-carolina-internal-revenue-code-conformity-update',
  },
  {
    title:
      'S.C. Code § 12-6-40(A)(1)(a) — the Internal Revenue Code as amended through 31 December 2024, the conformity date in force for tax year 2025',
    url: 'https://www.scstatehouse.gov/code/t12c006.php',
  },
  {
    title:
      'IRS Rev. Proc. 2024-40 § 3.15 — the 2025 standard deduction under the pre-OBBBA § 63(c)(7) rule, which is the figure South Carolina\u2019s frozen Code recognizes',
    url: 'https://www.irs.gov/pub/irs-drop/rp-24-40.pdf',
  },
  {
    title:
      'S.C. Code § 12-6-50 — the federal provisions South Carolina does not adopt, IRC § 199A among them',
    url: 'https://www.scstatehouse.gov/code/t12c006.php',
  },
  {
    title: 'S.C. Code § 12-6-1150 — the 44% deduction of net capital gain',
    url: 'https://www.scstatehouse.gov/code/t12c006.php',
  },
  {
    title:
      'S.C. Code § 12-6-1140(13) — an exemption for each eligible dependent, indexed annually, and the only exemption South Carolina allows',
    url: 'https://www.scstatehouse.gov/code/t12c006.php',
  },
  {
    title:
      'S.C. Code § 12-6-1160 — the young child deduction, set equal to the dependent exemption, for a dependent under the age of six',
    url: 'https://www.scstatehouse.gov/code/t12c006.php',
  },
  {
    title:
      'S.C. Code § 12-6-1170(A) — the general retirement deduction, $3,000 at any age and $10,000 from 65, per person',
    url: 'https://www.scstatehouse.gov/code/t12c006.php',
  },
  {
    title:
      'S.C. Code § 12-6-1170(B) — the $15,000 senior deduction, of ANY income, reduced by whatever that person deducted under subsection (A)',
    url: 'https://www.scstatehouse.gov/code/t12c006.php',
  },
  {
    title:
      'S.C. Code § 12-6-1171 — military retirement income deducted in full, at any age, under the Workforce Enhancement and Military Recognition Act of 2022',
    url: 'https://www.scstatehouse.gov/code/t12c006.php',
  },
  {
    title:
      'S.C. Code § 12-6-1170(C)(1) — the deduction allowed by THAT SECTION, (A) and (B) alike, is reduced by whatever is deducted under § 12-6-1171; the reduction does not apply to an amount claimed as a SURVIVING SPOUSE',
    url: 'https://www.scstatehouse.gov/code/t12c006.php',
  },
  {
    title:
      'SC1040 Instructions 2025, the line p-1 and p-2 retirement deduction worksheets — line 3 subtracts the military retirement deduction from the age-based cap, before the retirement-income limit; the line p-3 surviving-spouse worksheet does not',
    url: 'https://dor.sc.gov/sites/dor/files/forms/SC1040Instr_2025.pdf',
  },
  {
    title:
      'SC Revenue Ruling #22-11 — amounts deducted as a surviving spouse under the general retirement deduction or the military one do not reduce the $15,000 age-65 deduction, and a surviving spouse computes the decedent’s deduction separately from their own, capped by the deceased spouse’s age',
    url: 'https://dor.sc.gov/sites/dor/files/policies/RR22-11.pdf',
  },
  {
    title:
      'S.C. Code § 12-6-3330 — the two wage earner credit, 0.7% of the lesser spouse\u2019s qualified earned income with the ceiling on the INCOME',
    url: 'https://www.scstatehouse.gov/code/t12c006.php',
  },
  {
    title:
      'S.C. Code § 12-6-3632 — the state earned income credit, 125% of the federal credit and non-refundable',
    url: 'https://www.scstatehouse.gov/code/t12c006.php',
  },
];

/**
 * 2025: 0% to `$3,560`, 3% to `$17,830`, 6% above — **and the same three bands
 * for every filing status**, which is the fact about South Carolina's schedule
 * that no comparison of state rates carries.
 *
 * Virginia is the other state here that does not widen its brackets on a joint
 * return, and the two are opposite cases of the same thing. Virginia's top rate
 * arrives at `$17,000` of taxable income and its whole graduated schedule is
 * worth `$257.50` to everybody forever. South Carolina's arrives at `$17,830`
 * and its is worth `$641.70` — the 0% band is `$3,560` wide and the 3% band
 * `$14,270`, so the schedule saves a filer `$3,560 x 6% + $14,270 x 3%`. A
 * married couple get the same `$641.70` between them that a single filer gets
 * alone, which is a marriage penalty of `$641.70` a year in a state whose rate
 * table looks neutral.
 *
 * 2026 replaces all of it with two bands, and the constant SCDOR prints — "5.21%
 * minus `$966`" — is not a parameter: `$30,000 x (5.21% - 1.99%)` is `$966`
 * exactly, which is the figure that makes the two-band schedule continuous at
 * `$30,000`. It is Ohio's `baseAmountSchedule` written the other way round, and
 * where Ohio's constant arrives whole on the first dollar of the band and makes
 * the schedule DISCONTINUOUS, South Carolina's is subtracted and keeps it
 * continuous.
 */
function rateBrackets(year: number): ByStatus<readonly Bracket[]> {
  const bands: readonly Bracket[] =
    year === 2025
      ? [
          { rate: 0, upTo: 3_560 },
          { rate: 0.03, upTo: 17_830 },
          { rate: 0.06, upTo: Infinity },
        ]
      : [
          { rate: 0.0199, upTo: 30_000 },
          { rate: 0.0521, upTo: Infinity },
        ];
  return {
    single: bands,
    marriedFilingJointly: bands,
    marriedFilingSeparately: bands,
    headOfHousehold: bands,
    qualifyingSurvivingSpouse: bands,
  };
}

/**
 * The SCIAD base, S.C. Code § 12-6-1140(15)(a) — `$15,000` single and separate,
 * `$22,500` head of household, `$30,000` joint and surviving spouse.
 *
 * They are the pre-OBBBA federal standard deductions to the dollar, which is
 * where the Act got them: the 2025 figures Rev. Proc. 2024-40 indexed under the
 * rule South Carolina's frozen Code still reads. So South Carolina replaced a
 * federal deduction with a state copy of the same federal deduction, and then
 * began phasing the copy out — which is the whole of the reform's distribution.
 */
const SCIAD_BASE: ByStatus = byStatus({
  single: 15_000,
  separate: 15_000,
  headOfHousehold: 22_500,
  joint: 30_000,
});


/**
 * The standard deduction South Carolina's Code recognizes for 2025 — the
 * pre-OBBBA § 63(c)(7) amounts as Rev. Proc. 2024-40 indexed them, against the
 * `$15,750` / `$23,625` / `$31,500` the same filer took federally.
 */
const RECOGNIZED_STANDARD_DEDUCTION: ByStatus = byStatus({
  single: 15_000,
  separate: 15_000,
  headOfHousehold: 22_500,
  joint: 30_000,
});

/** 2025's published dependent exemption, § 12-6-1140(13) — indexed annually. */
const DEPENDENT_EXEMPTION_2025 = 4_930;

const NOTES_BOTH_YEARS: readonly string[] = [
  'SOUTH CAROLINA TAXES EVERY FILING STATUS ON THE SAME RATE SCHEDULE. The brackets do not widen on a joint return, in either year, which is a fact about the statute (\u00a7 12-6-510) and not an omission here \u2014 and it is the whole of South Carolina\u2019s marriage penalty, because everything else on the return scales. In 2025 a couple at $120,000 pay $4,758.30 against $4,116.60 for two single filers at $60,000 each: $641.70, which is exactly what the graduated schedule is worth to one filer ($3,560 at 6% plus $14,270 at 3%), so the couple lose one filer\u2019s whole schedule. In 2026 the penalty is $965.99 and is the SAME NUMBER SCDOR PRINTS ON THE RATE SCHEDULE: the $966 of "5.21% minus $966" is $30,000 x (5.21% - 1.99%), and a couple who do not get a second $30,000 band pay exactly that. The reported figure is a cent light because the single return\u2019s own tax carries a half-cent that rounds up, twice \u2014 the difference of the answers as reported, not of the figures behind them. Virginia is the only other state in this package that does not widen its brackets.',
  'South Carolina does not tax Social Security benefits at all: the federally taxable amount is subtracted in full, at any age and any income. Pass `taxableSocialSecurity`.',
  'THE $15,000 SENIOR DEDUCTION IS AN AGE PROVISION AND NOT A RETIREMENT ONE, and every guide files it under retirement income. \u00a7 12-6-1170(B) allows a filer of 65 to deduct $15,000 of ANY income, reduced by whatever that person deducted under subsection (A) \u2014 so the pair is a FLOOR of $15,000 rather than $15,000 on top of the retirement deduction. A single South Carolina filer of 66 with $60,000 pays $1,158.30 whether that $60,000 is pension or wages, and the same person at 50 with the same pension pays $1,878.30, because the retirement deduction alone is $3,000 under 65. The $720.00 difference is the deduction, not the income: $12,000 more of it \u2014 the $15,000 floor against the $3,000 cap \u2014 at 6%.',
  'MILITARY RETIRED PAY IS DEDUCTED IN FULL, AT ANY AGE, WITH NO CAP \u2014 \u00a7 12-6-1171, the Workforce Enhancement and Military Recognition Act of 2022. A single filer with $60,000 of military retired pay and nothing else owes South Carolina NOTHING, at 50 and at 66 alike, where the same $60,000 of civilian government pension costs $1,878.30 at 50. Pass it as `retirement.filer.militaryRetirement`, not through `retirementIncome`, which cannot tell the two apart.',
  'AND IT IS DEDUCTED IN FULL OUT OF A SHARED CAP, WHICH IS THE PART EVERY SUMMARY OF \u00a7 12-6-1171 LEAVES OUT. \u00a7 12-6-1170(C)(1) reduces the deduction allowed by THAT WHOLE SECTION \u2014 (A)\u2019s $3,000/$10,000 general retirement deduction as well as (B)\u2019s $15,000 senior deduction \u2014 by whatever is deducted under \u00a7 12-6-1171, and the 2025 SC1040 instructions apply it on line 3 of the line p-1 and p-2 worksheets, before the retirement-income limit. So a military retiree\u2019s OTHER retirement income is deducted at $0 and not at $10,000: a 65-year-old with $60,000 of retired pay and a $20,000 civilian pension subtracts $60,000, not $70,000. The two rules compose into a FLOOR rather than a sum \u2014 at 65 the total is max($15,000, military + min(other, max($0, $10,000 \u2212 military))) \u2014 so below $5,000 of retired pay the senior deduction fills the hole and the answer is unchanged, and from $20,000 of it the whole $10,000 is gone. Worth $600 of 2025 tax and $521 of 2026 tax at the top rate. This package had it wrong until v0.45.0, and in the taxpayer\u2019s favour, which is the direction a filer hears about from the Department rather than from their software.',
  'NOT MODELLED \u2014 the SURVIVING-SPOUSE side of both deductions, and it is the one place where the paragraph above runs the other way. A surviving spouse claims the decedent\u2019s \u00a7 12-6-1170(A) deduction on SC1040 line p-3 and the decedent\u2019s \u00a7 12-6-1171 military deduction on a line of its own, SEPARATELY from their own and capped by the DECEASED spouse\u2019s age \u2014 and (C)(1)\u2019s reduction expressly does not apply to an amount claimed as a surviving spouse, so neither of those amounts reduces the other and neither reduces the $15,000 senior deduction (SC Revenue Ruling #22-11). A 65-year-old widow of a career soldier with a pension of her own therefore keeps the military deduction in full, the decedent\u2019s $10,000 and her own $10,000 \u2014 and the $15,000 senior deduction reduced by that last one alone, to $5,000, because (B) reduces it by what SHE deducts under (A) and (C)(1) no longer reaches her. This package has no input for income received AS A SURVIVING SPOUSE, so it treats those dollars as the filer\u2019s own and charges them the shared cap: for that household its answer is too HIGH, by $25,000 of deduction \u2014 $10,000 + $10,000 + $5,000. Supply the difference through `subtractions` until there is a field for it.',
  'The 44% net capital gain deduction (\u00a7 12-6-1150) makes a long-term gain cost 2.9176% in 2026 against 5.21% on a wage, and 3.36% in 2025 against 6%. It is worth $2,292.40 on $100,000 of gain to a 2026 filer in the top band. The base is the IRC \u00a7 1222(11) "net capital gain", so a short-term LOSS eats the deduction and a short-term GAIN cannot create one: pass `netCapitalGain` (Form 1040 line 7) and `shortTermCapitalGains` to split it. Supplying only the net figure treats all of it as long-term, which is the most generous reading and the only one a single netted number supports.',
  'Interest on obligations of the United States is exempt and is NOT modelled as a subtraction here \u2014 pass it through `subtractions`. The same goes for the South Carolina college investment (529) deduction and the subsistence allowance for police, firefighters and emergency personnel.',
  'NOT MODELLED, and the largest gap for a business owner: the \u00a7 12-6-545 reduced rate on active trade or business income. South Carolina taxes income from a pass-through trade or business at a flat rate of its own rather than at the schedule rate, so a South Carolina return with Schedule C, partnership or S corporation income computed here is TOO HIGH by the rate differential on that income.',
  'NOT MODELLED: the \u00a7 12-6-1130(2) add-back of state and local income taxes deducted on federal Schedule A. It needs the Schedule A detail \u2014 the itemized total, the standard deduction that was forgone, the SALT cap and the real estate taxes inside it \u2014 and this package does not ask for them. A South Carolina ITEMIZER computed here is too LOW. Supply the add-back through `additions`.',
  'NOT MODELLED: the 7% match of the federal child and dependent care credit (\u00a7 12-6-3380), the refundable tuition credit (\u00a7 12-6-3385) and the credits for volunteer firefighters and for taxes paid to another state. All of them reduce the answer, so a filer who qualifies is computed too HIGH.',
];

/**
 * The 2026 provisional note, and the kind of debt it records is new in this
 * package.
 *
 * The other nine provisional state-years are waiting on an INDEXED FIGURE. This
 * one is not, mostly: Act 110 fixed the rates, the SCIAD and the earned income
 * credit cap in statute in March 2026, and those are the figures a 2026 South
 * Carolina answer is mostly built from. What is missing is the 2026 SC1040
 * instructions, and they carry two different things — one indexed amount, and
 * the confirmation of which of the older subtractions the reform left standing.
 */
const PROVISIONAL_NOTE_2026 =
  'PROVISIONAL, and not for the usual reason. Act 110 of 2026 (H.4216) settled South Carolina\u2019s 2026 rates, the SCIAD and the $200 earned income credit cap BY STATUTE in March 2026, so the figures a 2026 answer is mostly built from are published law rather than carried forward. Two things are owed. (1) The dependent exemption and the young child deduction here are the published 2025 figure of $4,930 carried forward, because \u00a7 12-6-1140(13) indexes the amount annually and SCDOR had published no 2026 figure. (2) This package models the \u00a7 12-6-1150 capital gain deduction, the \u00a7 12-6-1160 young child deduction, the \u00a7 12-6-1170 retirement and senior deductions and the \u00a7 12-6-1171 military retirement deduction as SURVIVING the reform. Act 110\u2019s own section list amends specific items rather than repealing \u00a7 12-6-1140, and policyengine-us 2.41.3 \u2014 which was updated for this Act and carries a baseline test for it \u2014 keeps all five. No primary document reachable from here confirms it. A 2026 South Carolina filer with no dependents, under 65, with no capital gain and no retirement income is computed entirely from published statute; every other 2026 South Carolina filer rests on that reading of the Act as well.';

const NOTES_2026: readonly string[] = [
  'The starting point for 2026 is FEDERAL ADJUSTED GROSS INCOME, not federal taxable income. Act 110 decoupled South Carolina from IRC \u00a7 63(b)-(g), so the federal standard or itemized deduction no longer reaches a South Carolina return at all and the SCIAD takes its place.',
  'THE SCIAD IS READ AGAINST FEDERAL AGI, which is why no South Carolina subtraction buys any of it back. The 44% capital gain deduction, the retirement deductions and the Social Security subtraction all lower South Carolina taxable income and leave the SCIAD exactly where it was \u2014 the opposite of Wisconsin, whose sliding-scale standard deduction is read against the state\u2019s own income so that every subtraction buys part of the deduction back.',
  'SOUTH CAROLINA\u2019S TOP RATE IS 5.21% AND ITS HIGHEST MARGINAL RATE IS 57.31%, on one dollar in every thirty-seven. The SCIAD is withdrawn at 3/11 of each dollar of federal AGI above the threshold \u2014 the same 3/11 for all three columns, because each denominator is eleven thirds of its own base \u2014 and \u00a7 12-6-1140(15)(b) rounds the reduction DOWN to the next lowest $10. So the withdrawal is a staircase and not a rate: inside a step the marginal rate is the statutory 5.21%, and at a step boundary one dollar of income raises taxable income by $11 and costs 5.21% x 11 = 57.31%. In the lower band the same dollar costs 21.89%. The steps are 37, 37 and 36 dollars of income wide, repeating, because $10 at 3/11 is $36.66... and no statute states that width. A model that applies the fraction without the rounding reports 6.6318% everywhere in the band, which is the correct average across a step and wrong about every single dollar.',
  'The $200 earned income credit cap (Act 110 \u00a7 7) replaces a credit of 125% of the federal one with no ceiling. What it costs a household is `min(125% of the federal credit, their South Carolina tax) - $200`, so it takes NOTHING from the families with the largest federal credits \u2014 their South Carolina tax is under $200 to begin with \u2014 and the whole of the difference from the families in the middle of the federal phase-out. A head of household with two children, $45,000 of wages and a $2,400 federal credit is handed $200 where 2025 handed $3,000, and owes nothing in either year, because the credit was never worth more than the $153.43 of tax it was offsetting.',
];

const NOTES_2025: readonly string[] = [
  'The starting point for 2025 is FEDERAL TAXABLE INCOME, so a 2025 South Carolina return inherits the federal standard or itemized deduction \u2014 and then takes part of it back. South Carolina conforms to the Internal Revenue Code only as amended through 31 DECEMBER 2024 (\u00a7 12-6-40(A)(1)(a)), and the One Big Beautiful Bill Act was enacted 4 July 2025, so the Act\u2019s increase in the standard deduction and all four of its Schedule 1-A deductions \u2014 tips, overtime, the senior deduction and vehicle loan interest \u2014 are added back. Pass `federalDeductions` for the four; the standard deduction add-back is computed from the figure you supply in `federal.deduction`.',
  'South Carolina does NOT allow the federal \u00a7 199A qualified business income deduction: \u00a7 12-6-50 names it among the federal provisions the state does not adopt. This package adds it back automatically when you pass `federalDeductions.qualifiedBusinessIncome`.',
];

function southCarolinaDefinition(year: number): StateIncomeTaxDefinition {
  const is2026 = year === 2026;
  return {
    code: 'SC',
    name: 'South Carolina',
    year,
    // 2025 is published in full. 2026 is provisional for a reason that is new in
    // this package and is recorded figure by figure below: the Act 110 figures
    // ARE published and the 2026 SC1040 instructions are NOT, so the rates, the
    // SCIAD and the earned income credit cap are statute and the indexed
    // dependent exemption is a carry-forward.
    status: is2026 ? 'provisional' : 'published',
    // The whole of the reform, in one field. 2025 starts below the federal
    // standard deduction and inherits every federal change to it; 2026 starts
    // above and inherits none.
    base: is2026 ? 'federalAdjustedGrossIncome' : 'federalTaxableIncome',
    ...(is2026
      ? {}
      : {
          // Declared for 2025 only, and the absence in 2026 is the finding
          // rather than an omission: the date did not move, the starting line
          // did, and a frozen § 63 cannot reach a return that begins at AGI.
          federalConformity: {
            kind: 'staticDate' as const,
            // NOT `belowTheLine`, and the reason is the finding rather than a
            // technicality: South Carolina adds back the whole of what its
            // frozen Code does not recognize, so moving the federal standard
            // deduction does not move a South Carolina answer AT ALL — and
            // `federal-conformity.test.js`, which decides this by measurement,
            // reports the most non-conforming state in the package as
            // indifferent to the federal figure. See the third value's
            // documentation on `FederalConformityRule.governs`.
            governs: 'recognizedDeductions' as const,
            conformedTo: '2024-12-31',
            cite:
              'S.C. Code § 12-6-40(A)(1)(a) — the Internal Revenue Code as amended through 31 December 2024, effective 22 May 2025. The One Big Beautiful Bill Act was enacted 4 July 2025 and South Carolina has not adopted it; SCDOR’s conformity update tells filers to go on making the adjustments on their South Carolina return.',
            primaryTextUnread:
              'scstatehouse.gov and dor.sc.gov are both refused by this sandbox’s egress policy to `curl` and to `WebFetch` alike (DNS does not resolve). The date, the effective date and the non-adoption are established from SCDOR’s own conformity page and the Revenue and Fiscal Affairs Office memo of 11 December 2025 as WebSearch reported them, plus policyengine-us 2.41.3, whose parameter file cites § 12-6-40(A)(1)(a) and SCDOR Information Letter 26-4 for the same date.',
          },
        }),
    rate: { kind: 'brackets', byStatus: rateBrackets(year) },
    deduction: is2026
      ? {
          kind: 'slidingScale',
          maximum: SCIAD_BASE,
          // The DENOMINATOR, not the quotient. § 12-6-1140(15)(b) writes the
          // reduction as the base times a fraction, and storing the fraction's
          // value cost $10 of deduction at every income where the statute's own
          // arithmetic is exact — see SlidingScaleTier, which carries the worked
          // example and the rule.
          //
          // EVERY SCIAD FIGURE LIVES HERE AND NOWHERE ELSE, and that is a
          // correction. The first draft hoisted the phase-out starts and the
          // denominators into two named `byStatus` tables beside `SCIAD_BASE`,
          // exported them as `SCIAD_PARAMETERS` "for the test", and then the
          // test was written from its own literals — correctly, because Day 27's
          // rule is that a test written from the data can only confirm the data.
          // So eight shipped figures were read by nothing at all, and the
          // mutation audit found all eight: Day 43's Wisconsin defect, in a
          // module three hours old.
          //
          // THE RULE: A CONSTANT HOISTED FOR A TEST THAT THE TEST DOES NOT READ
          // IS A SECOND COPY OF THE REGISTRY. The proportionality the export was
          // meant to serve — each denominator is eleven thirds of its own base,
          // so the withdrawal rate is 3/11 in every column — is asserted in
          // `south-carolina.test.js` against the DEFINITION, which is the only
          // copy that can be wrong in a way anybody pays for.
          //
          // Each denominator is eleven thirds of the base above it: 15,000 and
          // 55,000, 22,500 and 82,500, 30,000 and 110,000, so the phase-out
          // runs $40,000-$95,000, $60,000-$142,500 and $80,000-$190,000.
          tiers: {
            single: [{ above: 40_000, denominator: 55_000 }],
            marriedFilingSeparately: [{ above: 40_000, denominator: 55_000 }],
            headOfHousehold: [{ above: 60_000, denominator: 82_500 }],
            marriedFilingJointly: [{ above: 80_000, denominator: 110_000 }],
            qualifyingSurvivingSpouse: [{ above: 80_000, denominator: 110_000 }],
          },
          // Federal AGI, not South Carolina's own income. So the 44% capital
          // gain deduction and the retirement deductions lower a South Carolina
          // filer's taxable income and buy back NONE of their SCIAD, where every
          // Wisconsin subtraction buys part of that state's deduction back.
          measuredOn: 'federalAdjustedGrossIncome',
          roundReductionDownTo: 10,
          cite:
            'S.C. Code § 12-6-1140(15), added by Act 110 of 2026 (H.4216) § 3 — the SC Income Adjusted Deduction, reduced by the base times the fraction of federal AGI above the threshold over the denominator, the reduction rounded down to the next lowest $10 (SCDOR Information Letter 26-20). Each rate stored here is the base over the denominator: 15,000/55,000, 22,500/82,500 and 30,000/110,000, all three of which are 3/11.',
        }
      : // 2025 has no deduction of its own: the federal one is already inside
        // federal taxable income, which is the same reason Colorado and Idaho
        // declare none.
        { kind: 'none' },
    ...(is2026
      ? {}
      : {
          recognizedStandardDeduction: {
            name: 'Federal standard deduction add-back (South Carolina recognizes the pre-OBBBA amount)',
            amounts: RECOGNIZED_STANDARD_DEDUCTION,
            cite:
              'S.C. Code § 12-6-40(A)(1)(a) with IRC § 63(c)(7) as it stood on 31 December 2024, indexed for 2025 by Rev. Proc. 2024-40 § 3.15 — $15,000 single and separate, $22,500 head of household, $30,000 joint and surviving spouse, against the $15,750 / $23,625 / $31,500 the One Big Beautiful Bill Act substituted.',
          },
          // § 12-6-50 names § 199A among the federal provisions South Carolina
          // does not adopt, and the four Schedule 1-A deductions are outside the
          // Code it reads at all. None of the five is in a federal-AGI base, so
          // 2026 needs no add-back of any of them.
          addBacks: [
            'qualifiedBusinessIncome',
            'tips',
            'overtime',
            'senior',
            'carLoanInterest',
          ] as const,
        }),
    subtractsTaxableSocialSecurity: true,
    capitalGainsSubtraction: {
      name: 'Net capital gain deduction (44%)',
      share: 0.44,
      // THE THIRD STATE IN THIS RULE AND THE FIRST THAT NEEDED NO NEW BASIS.
      // § 12-6-1150(A) deducts 44% of "net capital gain", which is the IRC
      // § 1222(11) term — net long-term capital gain over net short-term
      // capital LOSS — so a short-term loss eats the deduction and a short-term
      // gain cannot create one. That is arithmetically the base Wis. Stat.
      // § 71.05(6)(b)9 reaches by its own words ("netted before application of
      // the percentage"), and the two statutes get there by different routes: a
      // federal cross-reference and a sentence of Wisconsin's own. Which means
      // South Carolina's base moves if Congress amends § 1222(11) and
      // Wisconsin's does not.
      basis: { kind: 'longTermNetted' },
      cite:
        'S.C. Code § 12-6-1150(A) — 44% of the net capital gain recognized in the taxable year; "net capital gain" is the IRC § 1222(11) term, so the base is the net long-term gain reduced by a net short-term LOSS and not by a short-term gain. SC1040 Instructions 2025, line w.',
    },
    retirementIncomeSubtractions: [
      {
        name: 'Retirement deduction',
        scope: 'perPerson',
        // § 12-6-1170(A)(1). NO age test on availability — a 40-year-old with a
        // pension has $3,000 of deduction — and the age moves the AMOUNT, which
        // is why this is `capByAge` rather than `cappedMinimumAge`. South
        // Carolina is the only state in this rule where the under-59 1/2 retiree
        // gets anything at all.
        capByAge: [
          { fromAge: 0, cap: 3_000 },
          { fromAge: 65, cap: 10_000 },
        ],
        // § 12-6-1171, the Workforce Enhancement and Military Recognition Act of
        // 2022: military retired pay comes out IN FULL, uncapped, at any age —
        // while a civilian federal, state or local pension is charged the
        // ordinary cap above. New York's construction with the two swapped.
        //
        // AND IT COMES OFF THAT CAP. § 12-6-1170(C)(1): "if a taxpayer claims a
        // deduction pursuant to Section 12-6-1171, then the deduction allowed by
        // this section must be reduced by the amount the taxpayer deducts
        // pursuant to Section 12-6-1171" — THIS SECTION, so (A)'s $3,000/$10,000
        // as well as (B)'s $15,000. The 2025 SC1040 instructions put it on line 3
        // of the line p-1 and p-2 worksheets, above the retirement-income limit.
        // Day 49 read § 12-6-1171 as sitting outside the cap because it is a
        // separate statute with its own form line; it is a separate statute that
        // SHARES the cap, and the reading was worth up to $10,000 of deduction
        // and $600 of 2025 tax to every South Carolina military retiree with any
        // other retirement income.
        militaryReducesCap: true,
        // Two statutes, two lines. The $60,000 that comes out under § 12-6-1171
        // was reported on a line named for § 12-6-1170(A)'s $10,000 deduction,
        // which is what the published tarball showed on Day 49.
        exemptInFullName: 'Military retirement deduction',
      },
    ],
    agedIncomeSubtraction: {
      name: 'Senior deduction (age 65)',
      minimumAge: 65,
      maximum: 15_000,
      // § 12-6-1170(B): "reduced by any amount the taxpayer deducts pursuant to
      // subsection (A)". Per person, so the pair is a FLOOR of $15,000 on a
      // 65-year-old's retirement subtractions rather than $15,000 on top of
      // them — and it asks nothing about the kind of income, so a 65-year-old
      // wage earner subtracts the whole $15,000.
      //
      // The MILITARY half of the reduction is not in (B) and was cited to it
      // here until Day 50. It is § 12-6-1170(C)(1), which reduces the whole
      // section by the § 12-6-1171 amount — so (B) is reduced by (A) under its
      // own words and by § 12-6-1171 under (C)(1), and this one flag is doing
      // two statutes' work. The arithmetic was right and the citation was a
      // subsection out.
      reducedByRetirementSubtractions: true,
    },
    exemption: {
      // South Carolina gives the FILER no exemption of its own in either year.
      // In 2025 the federal standard deduction is already inside the starting
      // point; in 2026 the SCIAD is where it went. Minnesota is the other state
      // here that allows an exemption for dependents and nobody else.
      perFiler: uniform(0),
      separateReturnSpouse: {
        spouse: 'noFilerExemption',
        agedAndBlind: 'notApplicable',
        cite:
          'S.C. Code § 12-6-1140(13) allows an exemption for dependents only, so there is no filer exemption for a separate return to claim or forgo, and § 12-6-1170(B) attaches the senior deduction to a person rather than to a status.',
      },
      perDependent: DEPENDENT_EXEMPTION_2025,
      // § 12-6-1160, the young child deduction: a SECOND amount for each
      // dependent who had not reached 6 by 31 December, and the statute sets it
      // EQUAL to the § 12-6-1140(13) dependent exemption rather than naming a
      // figure. So a South Carolina child under 6 is worth exactly double a
      // child of seven, and the two numbers here are one statutory figure read
      // twice — which `south-carolina.test.js` pins, so the day South Carolina
      // decouples them this stops being true out loud.
      perQualifyingChild: DEPENDENT_EXEMPTION_2025,
      qualifyingChildMaxAge: 5,
    },
    marriedCoupleCredit: {
      name: 'Two wage earner credit',
      rate: 0.007,
      // A ceiling on the INCOME, which is where § 12-6-3330(B) attached it:
      // "the lesser of fifty thousand dollars or the South Carolina qualified
      // earned income of the taxpayer with the lower qualified earned income".
      // Wisconsin's identical-looking credit caps the CREDIT instead, and
      // storing South Carolina's that way would store 0.007 x 50,000 as if the
      // statute had said $350 — see MarriedCoupleCreditCap.
      cap: { kind: 'earnedIncome', max: 50_000 },
      cite:
        'S.C. Code § 12-6-3330(B) — seven-tenths of one percent of the lesser of $50,000 or the qualified earned income of the spouse with the lower qualified earned income, on a joint return. The statutory figure was $30,000 as amended in 2017 and is indexed; $50,000 is the amount in effect for the years here (SC1040 Instructions 2025, two wage earner credit worksheet).',
    },
    earnedIncomeCredit: {
      name: 'South Carolina earned income credit',
      // 125% of the federal credit, phased in 2018-2023 and at its statutory
      // maximum since.
      matchRate: 1.25,
      refundable: false,
      ...(is2026 ? { maximum: 200 } : {}),
    },
    ...(is2026
      ? {
          provisionalFigures: [
            {
              path: 'exemption.perDependent',
              reason: 'awaiting-publication' as const,
              carriedForwardFrom: 2025,
              resolvedBy:
                "the 2026 SC1040 instructions and dependent exemption worksheet, which SCDOR publishes close to the start of the 2027 filing season — § 12-6-1140(13) indexes the amount annually and the 2026 figure was not in any SCDOR document available when this was written",
            },
            {
              path: 'exemption.perQualifyingChild',
              reason: 'awaiting-publication' as const,
              carriedForwardFrom: 2025,
              resolvedBy:
                'the same worksheet: § 12-6-1160 sets the young child deduction equal to the dependent exemption, so one document settles both and they cannot move apart',
            },
          ],
        }
      : {}),
    notes: is2026 ? [PROVISIONAL_NOTE_2026, ...NOTES_2026, ...NOTES_BOTH_YEARS] : [...NOTES_2025, ...NOTES_BOTH_YEARS],
    citations: CITATIONS,
  };
}

export function southCarolina(year: number): StateIncomeTaxDefinition | undefined {
  if (year !== 2025 && year !== 2026) return undefined;
  return southCarolinaDefinition(year);
}
