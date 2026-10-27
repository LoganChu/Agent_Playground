/**
 * Iowa — a flat 3.8% state whose standard deduction is **the federal one**, and
 * whose low-income exemption the federal deduction has quietly killed.
 *
 * Three things about this state are reported wrongly often enough to be worth
 * stating before any figure.
 *
 * **ONE: IOWA ADOPTED THE FEDERAL STANDARD AND ITEMIZED DEDUCTIONS IN TAX YEAR
 * 2023, NOT 2025.** Every secondary account found from here attaches the change
 * to the flat-tax year, because that is the year the state is written about.
 * The reference model's parameter — `applies_federal` — turns true at
 * `2023-01-01` and cites the **2023** IA 1040 instructions. The flat rate and
 * the deduction conformity are two reforms two years apart, and a model that
 * dates the conformity to 2025 gets tax years 2023 and 2024 wrong.
 *
 * **TWO: IOWA'S CODE STILL PRINTS A DIFFERENT RULE FROM IOWA'S FORM.** Iowa
 * Code § 422.9 and Iowa Admin. Code r. 701-303.4 still carry the state's own
 * optional standard deduction — `$2,210` single and `$5,450` joint, the 2022
 * figures. The IA 1040 does not use them: line 1d reads *"standard deduction
 * from federal 1040"*. The reference model's own parameter file says so in a
 * comment — *"the legal code does not represent the current policy according to
 * the 2023 IA1040 instructions"* — and this package follows the form, because
 * the form is what a return is filed on. **A reader who settles this from the
 * statute gets a deduction seven times too small.**
 *
 * **THREE: THE FEDERAL DEDUCTION IOWA TAKES IS THE ONE THE FILER ACTUALLY TOOK,
 * § 63(f) AGE AND BLINDNESS ADDITIONS INCLUDED** — so Iowa is Missouri's case
 * and not Arizona's. That distinction is not cosmetic here: `flat-states.ts`
 * records that this package declared Arizona `deduction: { kind: 'federal' }`
 * for 47 days and was too low by `$50.00` for a single filer over 65, because
 * Arizona's table is flat per status while the federal figure is not. Iowa's
 * form says *"from federal 1040"* and stops, so the additions come with it, and
 * the reference model adds `aged_or_blind` per person on exactly that reading.
 * **The identical declaration is right in this file and was wrong one state
 * over, which is why the reason is written here and not just the flag.**
 *
 * ---
 *
 * **AND THE RESULT THIS MODULE EXISTS TO RECORD: IOWA'S LOW-INCOME EXEMPTION IS
 * MEASURED AGAINST A FROZEN THRESHOLD AND DEFEATED BY AN INDEXED DEDUCTION.**
 *
 * § 422.5(3) exempts a return whose Iowa net income is at or below `$9,000`
 * (single or separate, under 65), `$13,500` (any other status, under 65),
 * `$24,000` (single, 65 or over) or `$32,000` (any other status, 65 or over).
 * None of those four figures has moved since at least 2021 and no provision
 * indexes them. The deduction they are now effectively racing — the federal
 * one, since 2023 — is indexed every year.
 *
 * The test is on net income, *before* the deduction. So the relief can only
 * change an answer where the threshold is **larger than the filer's own
 * deduction**; below that, the deduction has already taken taxable income to
 * zero and the exemption is exempting nothing.
 *
 * ```text
 *                        2025                           2026
 *                  deduction  threshold  bites?   deduction  threshold  bites?
 *   under 65
 *     single          15,750      9,000     no       16,100      9,000     no
 *     separate        15,750      9,000     no       16,100      9,000     no
 *     joint           31,500     13,500     no       32,200     13,500     no
 *     head of hh      23,625     13,500     no       24,150     13,500     no
 *     surv. spouse    31,500     13,500     no       32,200     13,500     no
 *   65 or over  (deduction includes the § 63(f) addition)
 *     single          17,750     24,000    YES       18,150     24,000    YES
 *     separate        17,350     32,000    YES       17,750     32,000    YES
 *     head of hh      25,625     32,000    YES       26,200     32,000    YES
 *     joint           33,100     32,000     no       33,850     32,000     no
 *     surv. spouse    33,100     32,000     no       33,850     32,000     no
 * ```
 *
 * **Five of the ten combinations are dead in 2025 and the same five are dead in
 * 2026**, and the live ones are shrinking: the most the exemption can be worth
 * to a single Iowan at 65 is `(24,000 − 17,750) × 3.8% =` **`$237.50`** in 2025
 * and `(24,000 − 18,150) × 3.8% =` **`$222.30`** in 2026. `$15.20` of relief
 * withdrawn in one year, from the poorest elderly filers in the state, by
 * nobody amending anything.
 *
 * **This is Oklahoma's frozen earned income credit with the sign reversed.**
 * There a frozen base makes a naive reader pay a family too much; here a frozen
 * threshold withdraws a relief, and both move every year because one side of
 * the comparison is a fixed number and the other is indexed. Day 62's rule —
 * *a state that borrows a federal figure as of a date has not borrowed the
 * federal figure* — has a sibling:
 *
 * > **A THRESHOLD THAT IS NOT INDEXED IS A WITHDRAWAL SCHEDULE, AND NOTHING
 * > ANNOUNCES IT.** Iowa's own figures did not change. What changed is the
 * > deduction they are compared against, which belongs to the other
 * > government.
 *
 * `test/iowa.test.js` COMPUTES that table from this package's own thresholds
 * and `us-federal-tax`'s own deduction figures rather than asserting it, and
 * `tools/cross-package/iowa-frozen-exemption.mjs` asserts the DIRECTION — the
 * single-at-65 headroom must shrink from 2025 to 2026 — because a direction is
 * the half no table of one year's numbers can show.
 *
 * ---
 *
 * **THE RETIREMENT EXCLUSION IS TOTAL, AND IT IS STORED AS THE ABSENCE OF A
 * NUMBER.** From tax year 2023, § 422.7(19) excludes *all* qualifying
 * retirement income of a person who is 55 or over, disabled, or a surviving
 * spouse of someone who would have qualified — there is no cap at all, where
 * 2021 and 2022 allowed `$6,000` and `$12,000`. This module expresses that by
 * omitting `cap`, which `engine.ts`'s `capOf` reads as `Infinity`.
 *
 * That has a consequence for the quality claim this repository publishes:
 *
 * > **A PARAMETER EXPRESSED AS THE ABSENCE OF A FIELD HAS NO MUTANT**, because
 * > the mutation harness perturbs literals and there is no literal to perturb.
 *
 * Day 62 recorded that a parameter whose value is zero has no mutant either,
 * since the harness halves and doubles inside the open interval `(0,1)`. These
 * are the same blind spot reached from the two opposite ends of the number
 * line, and between them they cover the single most important parameter in each
 * of the last two states added. Iowa's unlimited exclusion is covered by
 * `test/iowa.test.js` and by nothing in the 99.6%.
 *
 * ---
 *
 * **WHAT IS NOT MODELLED, each with what it is worth.** Iowa has four separate
 * relief computations that a return takes the *best* of, and this package
 * models one of them (the exemption above). See the notes for prices; the
 * largest is the alternate tax.
 */
import type { StateIncomeTaxDefinition } from '../definition.js';
import { byStatus } from './helpers.js';
import type { Citation } from '../types.js';

const IA_CITATIONS: readonly Citation[] = [
  {
    title:
      'Iowa Code § 422.5A — the individual income tax rate. SF 2442 of 2024 replaced HF 2317\'s remaining schedule with a single rate of 3.8% from tax year 2025, pulling the flat rate forward a year AND setting it below HF 2317\'s 3.9% destination. A secondary source still prints 3.9% for 2026 from the superseded act; the reference model\'s own bracket parameters push every threshold to infinity at 2025-01-01 and set the rate to 0.038 for both years. NOT OPENED FROM THIS SANDBOX: legis.iowa.gov does not resolve here',
    url: 'https://www.legis.iowa.gov/docs/code/422.5A.pdf',
  },
  {
    title:
      'Iowa Code § 422.9 and Iowa Admin. Code r. 701-303.4 — the STATUTORY standard deduction, $2,210 single and $5,450 joint, which the IA 1040 has not used since tax year 2023. Recorded here because it is the figure a reader who settles this from the statute gets, and it is seven times too small. The form governs: see the next citation',
    url: 'https://www.legis.iowa.gov/docs/code/422.9.pdf',
  },
  {
    title:
      '2025 IA 1040 Expanded Instructions — line 1d reads the standard deduction "from federal 1040", so Iowa takes the federal standard or itemized deduction INCLUDING the § 63(f) age and blindness additions, which is Missouri\'s treatment and not Arizona\'s. policyengine-us 2.68.0 adopts the same reading, in a parameter whose comment states that the legal code does not represent current policy, and adds aged_or_blind per person. NOT OPENED FROM THIS SANDBOX: revenue.iowa.gov does not resolve here, by curl or by WebFetch',
    url: 'https://revenue.iowa.gov/taxes/tax-guidance/individual-income-tax/1040-expanded-instructions',
  },
  {
    title:
      'Iowa Code § 422.5(3) — the low-income exemption. Iowa net income at or below $9,000 (single or married filing separately, under 65), $13,500 (other statuses, under 65), $24,000 (single, 65 or over) or $32,000 (other than single, 65 or over), the filer not being claimed as a dependent on another Iowa return. Only ONE spouse need be 65. The figures are not indexed and have not moved since at least 2021. The test is on net income: the instructions add the deduction and the QBI deduction BACK, which is why this package measures it against state AGI and before deductions',
    url: 'https://www.legis.iowa.gov/docs/code/422.5.pdf',
  },
  {
    title:
      'Iowa Code § 422.7(19) and Iowa Admin. Code r. 701-302.47(1)(a)(3) — the retirement income exclusion. From tax year 2023 it is TOTAL, with no cap, for a person 55 or over, disabled, or a surviving spouse of someone who would have qualified; 2021 and 2022 capped it at $6,000 and $12,000. It covers pensions, retirement-plan distributions and Roth conversions, and NOT a nonqualified deferred compensation plan or most nonqualified annuities',
    url: 'https://www.legis.iowa.gov/docs/code/422.7.pdf',
  },
  {
    title:
      'Iowa Code § 422.12(1) — the exemption credit: $40 for each filer, $40 for each dependent, and an additional $20 for each filer who is 65 or over and $20 for each who is blind. A CREDIT and not an exemption, so it is worth the same at every income, and the 2025 expanded instructions confirm it survives the flat tax unchanged. A dependent filing their own Iowa return may still claim their own $40',
    url: 'https://www.legis.iowa.gov/docs/code/422.12.pdf',
  },
  {
    title:
      'Iowa Code § 422.12B — the Iowa earned income tax credit, 15% of the federal credit and refundable. Iowa reads the CURRENT federal credit, with no frozen date, which is the opposite of Oklahoma\'s § 2357.43 and is why this one is modelled and that one is not',
    url: 'https://www.legis.iowa.gov/docs/code/422.12B.pdf',
  },
  {
    title:
      'Rev. Proc. 2024-40 and Rev. Proc. 2025-32 — the federal standard deductions ($15,750 and $16,100 single; $31,500 and $32,200 joint; $23,625 and $24,150 head of household) and the § 63(f) additions ($2,000 and $2,050 unmarried, $1,600 and $1,650 married, per condition) that Iowa adopts and that its frozen exemption thresholds are measured against. These figures are in this repository, in us-federal-tax\'s src/data, and both the Iowa test and the cross-package check read them from there rather than from this comment',
    url: 'https://www.irs.gov/pub/irs-drop/rp-25-32.pdf',
  },
];

const IA_NOTES: readonly string[] = [
  "IOWA'S STANDARD DEDUCTION IS THE FEDERAL ONE AND HAS BEEN SINCE TAX YEAR 2023, NOT 2025. Almost every account of Iowa attaches this to the flat-tax year because that is the year the state gets written about; the conformity is two years older. Iowa Code § 422.9 still prints the state's own figures — $2,210 single, $5,450 joint — and the IA 1040 does not use them: line 1d reads the amount from the federal return. A model built from the statute gives an Iowa single filer $2,210 of deduction instead of $15,750, which is $513.52 of 2025 tax.",
  'AND THE FEDERAL DEDUCTION IOWA TAKES INCLUDES THE § 63(f) AGE AND BLINDNESS ADDITIONS, because the form says "from federal 1040" and stops. A single Iowan of 65 deducts $17,750 for 2025 and $18,150 for 2026, not $15,750 and $16,100. This is Missouri\'s treatment; Arizona, the other state here whose deduction is described as the federal one, sets a flat table per filing status and allows no addition at all, and this package had that wrong for 47 days. If you pass `federal.deduction` yourself, pass the figure the filer actually took.',
  'BECAUSE THE DEDUCTION IS FEDERAL, IOWA IS AN OBBBA-SENSITIVE STATE: the One Big Beautiful Bill Act raised the 2025 standard deduction in July 2025 and thereby cut Iowa tax for tax year 2025 with no Iowa legislation, exactly as it did in Colorado, Idaho and Arizona. The $750 increase for a single filer is $28.50 of Iowa tax.',
  "THE LOW-INCOME EXEMPTION IS DEAD FOR EVERY NON-ELDERLY IOWAN AND FOR EVERY JOINT RETURN, AND THE REASON IS ARITHMETIC RATHER THAN POLICY. § 422.5(3)'s four thresholds — $9,000, $13,500, $24,000, $32,000 — have not moved since at least 2021 and nothing indexes them. The test is on Iowa net income, BEFORE the deduction. So where a filer's own deduction already exceeds the threshold, a return at the threshold has no taxable income anyway and the exemption changes nothing: that is true of all five filing statuses under 65 in both 2025 and 2026, and of joint and surviving-spouse returns at 65 too. It still bites for a single, head-of-household or married-filing-separately filer aged 65 or over.",
  'AND THE PART OF IT THAT STILL BITES IS SHRINKING EVERY YEAR BY CONSTRUCTION. The most the exemption can save a single Iowan of 65 is $237.50 in 2025 and $222.30 in 2026 — $15.20 of relief withdrawn in a year, with no Iowa figure changed, because the deduction it is racing is indexed and the threshold is not. On the recent indexation rate the single threshold is overtaken entirely around 2039 and the head-of-household one around 2035, after which the provision cannot change any answer at all. This is the same shape as Oklahoma\'s earned income credit frozen at 2020 law, with the sign reversed: there a frozen base overpays a family, here a frozen threshold quietly withdraws a relief.',
  'THE RETIREMENT INCOME EXCLUSION IS TOTAL AND UNCAPPED FROM TAX YEAR 2023, for a person 55 or over, disabled, or a surviving spouse of someone who would have qualified. 2021 and 2022 allowed $6,000 and $12,000 and a model carrying those figures forward is badly wrong for any substantial pension. It is claimed PER PERSON on the recipient\'s own income, so pass `retirement.filer` and `retirement.spouse` separately; a single `retirementIncome` figure is attributed entirely to the filer by the household fallback, and a 53-year-old filer with a 57-year-old spouse excludes nothing unless the income is passed in the spouse\'s name.',
  'WHAT THE EXCLUSION DOES NOT COVER: a nonqualified deferred compensation plan and most nonqualified annuities are not eligible retirement income under r. 701-302.47, so a filer over 55 whose income is deferred compensation gets nothing here and should not be passed through `retirement`. Military retirement pay and military service pay are excluded by separate provisions, in full and at any age, and are not charged against anything.',
  'SOCIAL SECURITY IS WHOLLY EXEMPT. Iowa finished phasing the benefit out of its base in 2014 and subtracts the federally taxable part in full, for everybody, with no income test. Half the benefit still appears in the "reportable social security" figure the state uses inside its own threshold worksheets, which is a different question from whether it is taxed.',
  'THE $40 EXEMPTION CREDIT IS A CREDIT, NOT AN EXEMPTION, so it is worth $40 to a filer at $20,000 and $40 to one at $2,000,000 — and $40 of credit is $1,052.63 of income at 3.8%. It is nonrefundable. A couple with two children and both filers over 65 claim $40 x 2 + $40 x 2 + $20 x 2 = $200.',
  'AND A HEAD OF HOUSEHOLD CLAIMS TWO PERSONAL CREDITS WITH ONE PERSON ON THE RETURN. The instructions say to enter 1 personal credit if you are single, married filing separately or a qualifying surviving spouse and 2 if you are married filing jointly OR head of household, so a single parent gets $80 where a single filer gets $40. This is the opposite of Oklahoma, where a head of household claims ONE exemption and gets the married treatment through the RATE SCHEDULE instead — two states handing the same filer the joint figure through different halves of the return. $40.00 a return, and a per-person reading of this credit was refuted by six households in the differential grid.',
  'NOT MODELLED — THE ALTERNATE TAX, AND IT IS THE LARGEST GAP IN IOWA HERE. § 422.5(3)(b) lets a joint, head-of-household or surviving-spouse return compute its tax a second way and pay the LESSER, and this package computes only the regular way, so an Iowa answer from here can be TOO HIGH for those three statuses. Iowa has four relief computations that a return takes the best of — the low-income exemption, the alternate tax, the tax reduction worksheet and the regular computation — and modelling one of four is why this state\'s answer is an upper bound rather than an estimate for a married return near the thresholds.',
  'ALSO NOT MODELLED: the Iowa alternative minimum tax (repealed for tax years from 2023, so it does not reach either year here, and it is recorded only because its credit carryforward still can); the child and dependent care credit, which is a percentage of the federal credit that steps down by net income and is refundable; the Iowa capital gains deduction, which turns on what was sold and how long it was held and no field here carries either fact; and the health insurance deduction, whose own base has the senior deduction added back.',
  "ONE OBBBA INTERACTION THIS PACKAGE CANNOT GET WRONG, AND IT IS WORTH KNOWING WHY. The new federal enhanced deduction for seniors — $6,000 a person from 2025 — was enacted by OBBBA § 70103 as an amendment to IRC § 151, the PERSONAL EXEMPTION section, and not to § 63, the standard deduction. Iowa's instructions accordingly treat it as a personal exemption and require it to be added back when computing the low-income exemption, the alternate tax, the tax reduction and the health insurance deduction. Because Iowa's deduction here is the federal standard-or-itemized deduction and nothing else, the senior deduction never enters this package's Iowa base, so there is nothing to add back and no way to double-count it. If you pass `federal.deduction` by hand, do NOT fold the $6,000 into it.",
  'A DEFECT IN THE REFERENCE MODEL THAT CANNOT COST A CENT, recorded because the reason is the same as the one above. policyengine-us decides the exemption threshold by branching on "single" alone, so it gives a married-filing-separately filer the $13,500 limit under 65 where the instructions give $9,000. It can never produce a wrong answer: $15,750 of deduction exceeds both figures, so every non-elderly separate filer has zero taxable income under either limit. A defect inside a dead branch — which is exactly what the table in this module\'s comment predicts.',
];

export function iowa(year: number): StateIncomeTaxDefinition | undefined {
  if (year !== 2025 && year !== 2026) return undefined;
  return {
    code: 'IA',
    name: 'Iowa',
    year,
    // Both years are published law rather than a figure carried forward. SF
    // 2442 fixed the rate at 3.8% with no further step, the exemption
    // thresholds are statutory and unindexed, and the $40 credit appears
    // unchanged in the 2025 instructions — so "the same in both years" is the
    // statute saying so and not this package guessing.
    status: 'published',
    // IA 1040 line 1 is federal AGI. The deduction comes off below it, which is
    // what makes the low-income exemption test — measured before the deduction
    // — a test on state AGI.
    base: 'federalAdjustedGrossIncome',
    // ROLLING, which is Colorado's case and not Idaho's — so the OBBBA increase
    // to the 2025 standard deduction reached Iowa with no Iowa act and no Iowa
    // announcement, and reached it for tax year 2025 rather than a year late.
    // `governs: 'belowTheLine'` because the base is federal AGI: what Iowa
    // borrows from below the line is the deduction and nothing else.
    federalConformity: {
      kind: 'rolling',
      governs: 'belowTheLine',
      cite:
        'Iowa Code § 422.3(5)(b) — for tax years beginning on or after 1 January 2020, "Internal Revenue Code" means the Code of 1986 "as amended", with no date. The paragraph it replaced, § 422.3(5)(a), froze the Code at 24 March 2018 and said so expressly — "shall not be construed to include any amendment enacted after the date specified" — so the two paragraphs are the static and the rolling definitions sitting in one section, and which applies is decided by the tax year.',
      primaryTextUnread:
        'legis.iowa.gov does not resolve from this sandbox, by curl or by WebFetch. Rolling status is established from the statutory phrase as the Legislative Services Agency’s own Fiscal Services Division reproduces it — the State "automatically integrates the federal changes" — corroborated by the Center for Agricultural Law and Taxation and by the Department’s conformity guidance page. The limit worth knowing is the one the Fiscal Services Division states: conformity is automatic for what flows through federal taxable income and NOT for federal-only credits, so Iowa conforms to the deduction and not to the federal child tax credit.',
    },
    rate: { kind: 'flat', rate: 0.038 },
    // THE FEDERAL DEDUCTION THE FILER ACTUALLY TOOK, § 63(f) additions
    // included. See this module's comment for why the identical declaration is
    // right here and was wrong in Arizona: the Iowa form says "from federal
    // 1040" and names no table of its own.
    deduction: { kind: 'federal' },
    // Iowa has subtracted the federally taxable part of a Social Security
    // benefit in full since 2014, for everybody, with no income test.
    subtractsTaxableSocialSecurity: true,
    retirementIncomeSubtractions: [
      {
        name: 'Iowa retirement income exclusion (IA 1040 Schedule 1, line 7)',
        // Per recipient: the income must be the eligible person's own.
        scope: 'perPerson',
        minimumAge: 55,
        // NO `cap`. The exclusion is total from tax year 2023 and `capOf`
        // reads an absent cap as Infinity — so the single largest subtraction
        // in this state is expressed as the ABSENCE of a parameter, and has no
        // mutant for that reason. See this module's comment.
        exemptInFullName: 'Iowa military retirement pay exclusion (§ 422.7(31A))',
        // Military retired pay is excluded by its own provision and no
        // provision reduces the retirement exclusion by it. The question is
        // moot while the exclusion is uncapped — there is no cap for it to
        // consume — and it is set explicitly so that it stays right if Iowa
        // ever reinstates one.
        militaryExemptOutsideCap: true,
      },
    ],
    exemptionCredit: {
      name: 'Iowa exemption credit (§ 422.12(1))',
      // $40 A HEAD, EXCEPT THAT A HEAD OF HOUSEHOLD COUNTS AS TWO HEADS.
      //
      // The first draft of this module used `perPerson(40)`, which gives one
      // credit to every return but a joint one — the ordinary shape, and the
      // one Oklahoma's § 2358(D) exemption has. The differential grid refused
      // it: SIX Iowa households differed from PolicyEngine-US by exactly
      // $40.00, every one of them a single parent, and the reference model
      // names the term `hoh_bonus` in its own code.
      //
      // The Iowa instructions say it outright: enter 1 personal credit if you
      // are single, married filing separately or a qualifying surviving spouse,
      // and **2 if you are married filing jointly OR HEAD OF HOUSEHOLD**. So a
      // single parent claims two personal credits with one person on the
      // return, which is the opposite of Oklahoma, where a head of household
      // claims one exemption and files on the joint RATE schedule. Iowa gives
      // this filer the joint CREDIT and its own rate is flat, so the two states
      // hand a single parent the married treatment through different halves of
      // the return.
      //
      // $40.00 a head-of-household return, which is why `byStatus` rather than
      // `perPerson`: the figure is not a count of people.
      perFiler: byStatus({
        single: 40,
        joint: 80,
        separate: 40,
        headOfHousehold: 80,
        qualifyingSurvivingSpouse: 40,
      }),
      perDependent: 40,
      // An ADDITIONAL $20 per filer at 65, and another $20 per blind filer, so
      // a blind Iowan of 65 claims both.
      perSeniorFiler: 20,
      seniorAge: 65,
      perBlindOrDisabledFiler: 20,
    },
    // 15% of the CURRENT federal credit, refundable. Iowa names no frozen date,
    // which is the whole of the difference between this rule and Oklahoma's.
    earnedIncomeCredit: {
      name: 'Iowa earned income tax credit (§ 422.12B)',
      matchRate: 0.15,
      refundable: true,
    },
    zeroTaxThreshold: {
      name: 'Iowa low-income exemption (§ 422.5(3))',
      // Under 65: single AND married filing separately take the small figure.
      threshold: byStatus({
        single: 9_000,
        joint: 13_500,
        separate: 9_000,
        headOfHousehold: 13_500,
        qualifyingSurvivingSpouse: 13_500,
      }),
      // At 65: only SINGLE takes the small figure, so married filing
      // separately changes groups on a birthday. That asymmetry is the
      // statute's, written as two tests rather than one with an increment.
      elderlyThreshold: byStatus({
        single: 24_000,
        joint: 32_000,
        separate: 32_000,
        headOfHousehold: 32_000,
        qualifyingSurvivingSpouse: 32_000,
      }),
      elderlyAge: 65,
    },
    notes: IA_NOTES,
    citations: IA_CITATIONS,
  };
}
