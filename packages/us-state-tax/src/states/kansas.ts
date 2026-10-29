/**
 * Kansas — the thirty-second taxing state, the largest jurisdiction this package
 * had left, and the one where the figure that decides a widow's bill is a
 * CHECKBOX rather than a number.
 *
 * ## A Kansas widow files as HEAD OF HOUSEHOLD, which is the third answer and the one nothing defaults to
 *
 * The K-40 has **four** filing-status boxes — single, married filing joint,
 * married filing separate, head of household — and no qualifying-surviving-spouse
 * box at all. Kansas's own instruction is that the Kansas status must match the
 * federal one, and then names the single exception: a federal qualifying
 * widow(er) with a dependent child **checks the HEAD OF HOUSEHOLD box**, because
 * the Kansas head-of-household box qualifies a filer who claimed "Head of
 * Household **or** Qualifying Widow or Widower with a Dependent Child" federally.
 *
 * That is the phrase `test/surviving-spouse-column.test.js` was built to look
 * for, and Kansas is the fourth state in this package to carry it after
 * Wisconsin, Arizona and Mississippi. The consequence is three figures at once,
 * and not one of them is the joint column:
 *
 * ```text
 *   a Kansas widow reads                 the joint column would give
 *     standard deduction   6,180           8,240
 *     personal exemption   9,160           18,320
 *     + head of household  2,320           --
 *     the 5.58% band opens at 23,000       46,000
 * ```
 *
 * **Worth `$527.48` on one household**, and in the direction that matters. A
 * widow with one dependent child and `$60,000` of federal AGI owes Kansas
 * `$2,145.72`; read against the joint column — which {@link byStatus} defaults to
 * and which every model that has not read the instruction applies — she owes
 * `$1,618.24`, because the joint schedule's 5.2% band swallows her whole taxable
 * income. Read against the single column she owes `$2,418.86`, `$273.14` too
 * much. The three answers are `$527.48` apart in one direction and `$273.14` in
 * the other and the right one is in the middle, which is why a guess cannot get
 * here.
 *
 * > **THE DEFAULT IS NOT HALFWAY BETWEEN THE TWO WRONG ANSWERS, IT IS ONE OF
 * > THEM.** Day 26 fixed this class in three states and Day 29 built the ledger
 * > that demands the declaration. Kansas is the first state added since where
 * > the right column is the one the state uses for a *different* status, so the
 * > widow collects a head-of-household allowance she would get under neither of
 * > the two obvious readings.
 *
 * ## THE $2,320 HEAD-OF-HOUSEHOLD EXEMPTION WAS ON THE DEPARTMENT'S FORM A YEAR BEFORE IT WAS IN THE STATUTE
 *
 * The exemption a Kansas head of household reads above is `$9,160 + $2,320`, and
 * the second term has a history this package records because it is the cleanest
 * instance of a shape it keeps finding.
 *
 * SB 1 of the 2024 special session rewrote K.S.A. 79-32,121(a) to give `$18,320`
 * to a joint return and `$9,160` to "single, head of household, or married filing
 * separate", plus `$2,320` a dependent. It said nothing about an extra allowance
 * for a head of household. **The 2024 K-40 gave one anyway** — the form carried
 * an additional `$2,320` line that no subsection authorised, and `policyengine-us`
 * still ships a comment saying so in terms: *"The legal code does not specify an
 * additional exemption amount, however, the tax form allows for an additional
 * exemption amount for head of household filers"*, with HB 2231 noted as
 * introduced and not passed.
 *
 * **HB 2231 passed, and it backdated the allowance to the year the form had
 * already granted it** — the Department's Notice 25-07 records the amendment to
 * K.S.A. 79-32,121 as codifying the additional `$2,320` "for tax year 2024 and all
 * tax years thereafter."
 *
 * > **A TWO-DOCUMENT DISAGREEMENT CAN BE SETTLED BY THE LEGISLATURE AGREEING WITH
 * > THE FORM, RETROACTIVELY.** Arkansas's card and statute disagree by two to four
 * > cents and the instructions settle it in favour of the card. Kansas's form was
 * > ahead of its statute by `$2,320` and the statute moved. The reason to hold
 * > both facts is that a model built from the 2024 statute alone was wrong about
 * > tax year 2024 *at the time* and is still wrong about it now, and a model built
 * > from the 2024 form was right before it had authority to be.
 *
 * ## KANSAS GIVES A PERSONAL EXEMPTION FOR A STILLBIRTH, AND NOTHING MODELS IT
 *
 * The same 2025 act added K.S.A. 79-32,121(a)(4): an additional personal
 * exemption of **`$2,320` for an unborn child that does not result in a live
 * birth**, from tax year 2025. A pregnancy that ends in a live birth during the
 * year produces a dependent, and a dependent is already `$2,320`; paragraph (4)
 * reaches the case where there is no dependent at the end of the year and grants
 * the same figure.
 *
 * It is `$120.64` of tax at 5.2% and `$129.46` at 5.58%. **No field in this
 * package can carry it** — a return does not record a stillbirth and no federal
 * figure implies one — so it is not modelled, and a Kansas return computed here
 * for a household that suffered one is too HIGH by that amount. The note says so.
 *
 * > **AN EXEMPTION CAN BE UNMODELLABLE BECAUSE THE FACT IT TURNS ON IS NOT A
 * > NUMBER ANYBODY REPORTS.** Oklahoma's earned income credit is unmodellable
 * > because its base is a frozen Code; Form 561's capital gain deduction because
 * > the qualifying fact is where the property was. This one is the sharpest of the
 * > three, and the reason to write it down rather than omit it silently is that a
 * > caller in that position is the one person who would know to supply it through
 * > `subtractions`.
 *
 * ## KANSAS'S MINIMUM FILING REQUIREMENT CANNOT CHANGE ANYBODY'S TAX, AND THIS PACKAGE PROVES IT RATHER THAN CARRYING IT
 *
 * The K-40 instructions print a minimum filing requirement by status, and
 * `policyengine-us` models it as a second zero-tax threshold read against Kansas
 * AGI, five parameters and a branch:
 *
 * ```text
 *   joint              26,560  =  8,240 + 18,320
 *   head of household  17,660  =  6,180 +  9,160 + 2,320
 *   single             12,765  =  3,605 +  9,160
 *   separate           13,280  =  4,120 +  9,160
 * ```
 *
 * **Every row is exactly the standard deduction plus the personal exemption for
 * its own status**, which is not a coincidence — the comments beside those figures
 * in that model write the sums out. A filer whose Kansas AGI is at or below the
 * threshold already has no taxable income, because taxable income is AGI less
 * those same two allowances and the allowances only ever grow from there: a
 * dependent adds `$2,320`, each aged or blind box adds `$850` or `$700`, and an
 * itemiser's deduction is larger by construction or they would not have itemised.
 *
 * So the threshold can zero a tax that is positive in **no** household, in any
 * status, at any income. This package therefore carries no
 * {@link StateIncomeTaxDefinition.zeroTaxThreshold} for Kansas, and
 * `test/kansas.test.js` asserts the identity the absence rests on — three sums,
 * one per status — so that a year in which Kansas moves one of the three figures
 * and not the filing requirement FAILS here instead of quietly becoming a cliff
 * nothing models.
 *
 * > **A RULE WORTH OMITTING IS WORTH A TEST, BECAUSE WHAT MAKES IT OMISSIBLE IS AN
 * > IDENTITY BETWEEN OTHER PARAMETERS AND IDENTITIES BETWEEN PARAMETERS BREAK.**
 * > Day 65 wrote that a check on a score cannot see a selection designed not to
 * > affect the score. This is the same shape one level down: nothing in a suite of
 * > answers can see a missing rule that currently changes no answer, so the guard
 * > has to be on the premise rather than on the output.
 *
 * ## What a Kansas retirement costs depends on WHICH GOVERNMENT employed the retiree, and on nothing else
 *
 * Two provisions and one 2024 repeal leave Kansas with the starkest split in this
 * package:
 *
 * - **K.S.A. 79-32,117(c)** subtracts retirement benefits from KPERS, the Kansas
 *   Police and Firemen's system, the Judges and Justices system and the Highway
 *   Patrol system; **federal civil service retirement and disability**, and any
 *   other retirement from federal employment — a Thrift Savings Plan distribution
 *   being one by that wording, which is an application of the rule rather than a
 *   line anybody here has read naming it; and retired pay for service in the armed
 *   forces. In full. No cap, no age test, no income test.
 * - **Nothing subtracts a private pension, a 401(k), an IRA or an annuity.** Not
 *   partially, not at an age, not below a ceiling. Kansas is one of the few states
 *   in this package with no retirement allowance of any kind outside that list.
 * - **And from tax year 2024 the federally taxable part of a Social Security
 *   benefit is subtracted for everybody**, which replaced a cliff described below.
 *
 * ```text
 *   single filer of 67, $50,000 of pension and nothing else, 2026
 *     a KPERS, federal civil service or military pension         $0.00
 *     the same $50,000 from a private plan or an IRA         $1,942.88
 * ```
 *
 * `$0` against `$1,942.88`, and a retired state employee of Kansas and a retired
 * state employee of Missouri who moved across the state line are on opposite sides
 * of it: **an out-of-state public pension is not on the list.** The federal half
 * of the list is there because 4 U.S.C. § 111 requires a state exempting its own
 * retirees to treat federal retirees the same — *Davis v. Michigan Dep't of
 * Treasury*, 489 U.S. 803 (1989) — and nothing requires parity with any other
 * state's retirees.
 *
 * > **THE EXEMPT LIST IS {THIS STATE} UNION {THE UNITED STATES}, AND THE SECOND
 * > TERM IS A SUPREME COURT CASE RATHER THAN A POLICY.** Which is why the boundary
 * > falls where it does and why a guide that compresses it to "Kansas exempts
 * > government pensions" is wrong about every retiree who earned one somewhere
 * > else.
 *
 * **PUT ONLY KANSAS AND FEDERAL SERVICE IN `retirement.*.governmentPension`
 * HERE**, and an out-of-state public pension in `employerPlanPension`. The
 * reference model cannot make that distinction — its own comment says *"Out-of-state
 * public pensions are not exempt"* and then subtracts `taxable_public_pension_income`
 * "as an in-state proxy", exempting them — so this is one of the few places where
 * a field this package already has buys an answer a larger model cannot reach.
 *
 * ## The cliff Kansas abolished, which most published accounts of this state still describe
 *
 * Through tax year 2023, all Social Security benefits were exempt from Kansas tax
 * where federal AGI was `$75,000` or less, and **one dollar above it the whole
 * federally taxable benefit became Kansas income.** SB 1 of 2024 removed the
 * limit. For a couple with `$51,000` of federally taxable benefits the old rule
 * turned one dollar of income into `$2,845.80` of Kansas tax; it is the largest
 * single discontinuity this project has recorded in any state, Ohio's `$0.01`
 * epsilon and Arkansas's twenty-nine `$10` steps included, and it is **gone** in
 * both years this module covers. A model still carrying it overstates that
 * couple's Kansas bill by the same `$2,845.80`.
 *
 * ## Two brackets, and THE DOUBLING THAT IS NOT A DOUBLING
 *
 * K.S.A. 79-32,110(a)(2)(F), as SB 1 rewrote it for tax year 2024 and after:
 * 5.2% to `$23,000` of Kansas taxable income and 5.58% above, with both
 * thresholds exactly doubled on a joint return, and a personal exemption of
 * `$9,160` doubled to `$18,320`. Two tables out of three are exactly symmetric.
 *
 * **THE STANDARD DEDUCTION IS NOT, AND THE ASYMMETRY RUNS THE OTHER WAY FROM
 * EVERY MARRIAGE PENALTY IN THIS PACKAGE.**
 *
 * ```text
 *   single                3,605
 *   married separately    4,120     <- MORE than a single filer, by $515
 *   joint                 8,240     =  2 x 4,120, and NOT 2 x 3,605
 *   head of household     6,180
 * ```
 *
 * The joint figure is twice the SEPARATE one and the single filer is `$515`
 * below that half. Two consequences, neither of which any rate table shows:
 *
 * - **A married Kansan filing separately has a larger standard deduction than a
 *   single Kansan on the same income** — `$26.78` of tax in the 5.2% band and
 *   `$28.73` in the 5.58% one. Every other state in this package that sets a
 *   separate column at all sets it equal to single.
 * - **And two single filers who marry GAIN `$1,030` of deduction**: `$57.47` of
 *   tax for two people on `$50,000` each. Kansas's is a marriage BONUS where the
 *   rest of this package records penalties.
 *
 * `policyengine-us`'s own parameter file says of the separate figure that *"the
 * legal code doesn't specify the value for separate, but recent tax forms show
 * that it is half the joint value"* — so the `$4,120` is read off a form and the
 * `$3,605` is its own statutory number, which is how the two came to disagree.
 *
 * **TWO THINGS DO BREAK IN THE PENALTY DIRECTION AND BOTH BELONG TO A STATUS
 * RATHER THAN TO A COUPLE.** Worksheet I gives `$850` per box checked for
 * 65-or-over or blindness on a single or head-of-household return and `$700` on a
 * joint or separate one, per person — so marrying costs each aged-or-blind Kansan
 * `$150` of deduction, `$300` for a couple both 65, `$16.74` of tax. Oregon's
 * addition is upside down the same way (`$1,200` single against `$1,000` joint)
 * and the two are the only figures in this package where a single filer's
 * allowance exceeds a joint filer's. **The amounts carry a 1998 start date in the
 * reference model's parameter file and no later value**, which is that package
 * asserting twenty-eight tax years without a change and is the only evidence for
 * the date readable from here; the federal § 63(f) additions were `$1,050` and
 * `$850` in 1998 and are `$2,000` and `$1,600` now.
 *
 * And the head-of-household column is the larger break: a single parent loses the
 * `$2,320` additional exemption AND `$1,545` of deduction on marrying — `$1,545`
 * and not the `$2,575` between the two columns, because the single filer's own
 * `$3,605` is absorbed into the joint `$8,240` rather than lost. So a parent on
 * `$60,000` who marries a single filer on `$40,000` pays `$215.67` more than the
 * two of them did apart, which is exactly `3,865 x 5.58%`. That is not peculiar
 * to Kansas — head-of-household status is for the unmarried everywhere — but it
 * is THIRTEEN times the aged-or-blind penalty, and it is the one a widow reading
 * this column would meet on remarrying.
 *
 * ## Nothing in Kansas is indexed, and that is the statute rather than a carry-forward
 *
 * The deduction, the exemption, the dependent amount, the two Worksheet I figures
 * and both bracket thresholds are the same in 2024, 2025 and 2026. SB 1's own
 * words are "tax year 2024, and all tax years thereafter", and the 2025 K-40
 * booklet prints the 2024 figures unchanged — which is the evidence that there is
 * no cost-of-living provision rather than that nobody read the second document.
 * The bill as **introduced** would have indexed the standard deduction from tax
 * year 2025 and the enacted law does not.
 *
 * > **A FISCAL NOTE DESCRIBES THE BILL IT WAS WRITTEN FOR AND NOT THE ACT THAT
 * > PASSED**, and an indexing clause is the single most common thing to be
 * > amended out on the way. This is the first state in this package where the
 * > tempting wrong answer was published by the legislature's own research office.
 *
 * ## Two credits, one of them unmodellable, and one abolished for 2025
 *
 * - **The earned income credit is 17% of the federal credit and refundable**
 *   (K.S.A. 79-32,205). It was 18% and was cut to 17% in 2013; thirteen tax years
 *   later it has not been restored.
 * - **The child and dependent care credit is 50% of the federal § 21 credit** from
 *   tax year 2024, raised from 25%, and non-refundable. **Not modelled**, because
 *   neither this package nor `us-federal-tax` computes the federal § 21 credit and
 *   no input carries it. A Kansas return with child care expenses on it is
 *   computed here too HIGH by half of that credit.
 * - **The food sales tax credit is `$0` from tax year 2025.** It was `$125` per
 *   qualifying exemption for a household with a child under 18, a filer of 55 or
 *   over, or a blind or disabled filer, where federal AGI was below `$30,615` — a
 *   limit unchanged since 2015 — and HB 2106 of 2022 ended it as the state's own
 *   sales tax on food reached zero. A family of four with a young child and
 *   `$30,000` of AGI had `$500` in 2024 and nothing in 2025.
 *
 * ## Sourcing, stated plainly
 *
 * `ksrevenue.gov`, `kslegislature.gov` and `ksrevisor.gov` are all refused by this
 * sandbox's egress policy, by `curl` and by `WebFetch` alike — the fifteenth
 * consecutive run to record a blocked primary source. **No Kansas primary document
 * was opened today.** Every figure below is corroborated three ways: the parameter
 * files inside `policyengine-us` 2.78.0, downloaded from PyPI, which cite the 2024
 * and 2025 K-40 instruction pages by page number; that package's own 2025 Kansas
 * integration tests, which write the arithmetic out in comments and whose
 * breakpoints read `$23,000` and `$46,000` where its parameter file encodes
 * `$23,001` and `$46,001`; and server-side search's reading of the 2025 booklet,
 * the Department's Notice 25-07 and the Department's Schedule S help pages.
 *
 * **And the arithmetic discriminated once.** This module uses the statute's
 * `$23,000` and `$46,000` rather than the reference model's `$23,001` and
 * `$46,001`, because 5.2% of `$23,000` is exactly the `$1,196` the statute prints
 * as the accumulated tax at the breakpoint and 5.2% of `$23,001` is not. The
 * difference is `$0.0038` of tax for every Kansan above the breakpoint — under
 * four tenths of a cent, invisible after rounding, and recorded because a
 * one-dollar anchoring error is exactly the defect Arkansas's published card has
 * and the direction here is the opposite one.
 */
import type { StateIncomeTaxDefinition } from '../definition.js';
import { byStatus, byStatusOf } from './helpers.js';
import type { Bracket, ByStatus, Citation } from '../types.js';

const KS_CITATIONS: readonly Citation[] = [
  {
    title:
      'K.S.A. 79-32,110(a)(2)(F) as rewritten by SB 1 of the 2024 special session — the rate schedule for tax year 2024 and all tax years thereafter. Married filing jointly: 5.2% of Kansas taxable income not over $46,000, and $2,392 plus 5.58% of the excess above it. All other individuals: 5.2% not over $23,000, and $1,196 plus 5.58% of the excess. The accumulated figures are exact at the statutory breakpoints — 5.2% x 46,000 = 2,392 and 5.2% x 23,000 = 1,196 — which is what settles the thresholds against the reference model\'s $46,001 and $23,001. NOT OPENED FROM THIS SANDBOX: kslegislature.gov and ksrevisor.gov do not resolve here, by curl or by WebFetch',
    url: 'https://ksrevisor.gov/statutes/chapters/ch79/079_032_0110.html',
  },
  {
    title:
      'K.S.A. 79-32,119 — the Kansas standard deduction: $3,605 single, $8,240 married filing joint, $6,180 head of household, $4,120 married filing separate, for tax year 2024 and all tax years thereafter, with NO cost-of-living provision in the enacted law. Subsection (b) carries Worksheet I: an additional $850 for each box checked for 65-or-over or blind, $700 where the status is married filing joint or married filing separate — unchanged since 1998 on the reference model\'s parameter file, which carries both figures from 1998-01-01 with no later value and is the only evidence for the date available from this sandbox. NOT OPENED FROM THIS SANDBOX',
    url: 'https://ksrevisor.gov/statutes/chapters/ch79/079_032_0119.html',
  },
  {
    title:
      'K.S.A. 79-32,121 — the Kansas personal exemption: $18,320 for a joint return and $9,160 for a single, head-of-household or married-filing-separate return, plus $2,320 for each dependent, for tax year 2024 and after. Paragraph (4), added for tax year 2025, allows an additional $2,320 personal exemption for an unborn child that does not result in a live birth. Subsection (b) carries the disabled veteran exemption, $2,250 for 2023 and 2024 and $2,320 from 2025. NOT OPENED FROM THIS SANDBOX',
    url: 'https://ksrevisor.gov/statutes/chapters/ch79/079_032_0121.html',
  },
  {
    title:
      'Kansas Department of Revenue Notice 25-07, Changes to Individual Income Tax Personal Exemptions (19 November 2025) — records HB 2231 of the 2025 session CODIFYING the additional $2,320 personal exemption for head-of-household filers "for tax year 2024 and all tax years thereafter", a year after the 2024 K-40 had already granted it and while the statute did not; adding the unborn-child exemption of $2,320; and raising the disabled veteran exemption to $2,320 from tax year 2025. The Department\'s own 2025 legislative summary files the unborn-child provision under a different bill number, which is why this module cites the NOTICE for the provision and not a bill. NOT OPENED FROM THIS SANDBOX',
    url: 'https://ksrevenue.gov/taxnotices/notice25-07.pdf',
  },
  {
    title:
      '2025 Kansas Individual Income Tax booklet, Form K-40 and instructions (ip25) — page 2 for the standard deduction and exemption tables, page 6 for the exemptions-and-dependents instruction and Worksheet I, page 3 for the minimum filing requirements, page 11 for Schedule S Part A, pages 8 and 34 for the credits and the rate schedules. The four filing-status boxes are single, married filing joint, married filing separate and head of household: there is no qualifying-surviving-spouse box, and the head-of-household box qualifies a filer who claimed head of household OR QUALIFYING WIDOW OR WIDOWER WITH A DEPENDENT CHILD on the federal return. NOT OPENED FROM THIS SANDBOX: the figures are policyengine-us 2.78.0\'s, which cites these exact pages, corroborated by that package\'s own 2025 Kansas integration tests and by server-side search\'s reading of this booklet',
    url: 'https://www.ksrevenue.gov/pdf/ip25.pdf',
  },
  {
    title:
      'K.S.A. 79-32,117(c) and the Department\'s WebFile Schedule S Part A help — the retirement benefits Kansas subtracts in full: KPERS, the Kansas Police and Firemen\'s, Judges and Justices and Highway Patrol systems; Federal Civil Service Retirement or Disability Fund payments and any other retirement benefits from employment by the federal government, and retired pay for service in the United States Armed Forces. A THRIFT SAVINGS PLAN DISTRIBUTION IS IN THAT CATEGORY BY THE HELP TEXT\'S OWN WORDS — "any other amounts received as retirement benefits from employment by the federal government" — and the K-40 instructions are reported to name it explicitly, but only at second hand: the quotation reaching this sandbox is a taxpayer forum post citing the Schedule S instructions, not the instructions. The words above are the help page\'s; the TSP example is an application of them. No cap, no age test, no income test. OUT-OF-STATE PUBLIC PENSIONS ARE NOT ON THE LIST, and neither is any private pension, 401(k), IRA or annuity. NOT OPENED FROM THIS SANDBOX',
    url: 'https://www.ksrevenue.gov/webfile/help/scheduleS_A.html',
  },
  {
    title:
      'K.S.A. 79-32,117(c)(xviii) and Kansas Notice 24-08, Changes to Individual Income Tax — the subtraction of the federally taxable part of a Social Security benefit. Through tax year 2023 it was allowed only where federal AGI was $75,000 or less, so one dollar above the limit made the WHOLE federally taxable benefit Kansas income; SB 1 of the 2024 special session removed the limit for tax year 2024 and after. NOT OPENED FROM THIS SANDBOX',
    url: 'https://www.ksrevenue.gov/taxnotices/notice24-08.pdf',
  },
  {
    title:
      'K.S.A. 79-32,205 — the Kansas earned income credit, 17% of the federal § 32 credit and refundable. It was 18% for tax years 2010 through 2012 and has been 17% since 2013. K.S.A. 79-32,111c — the child and dependent care expenses credit, a percentage of the federal § 21 credit: 12.5% for 2018, 18.75% for 2019, 25% for 2020 and 50% from tax year 2024 under Kansas Notice 24-09, non-refundable. K.S.A. 79-32,271 — the food sales tax credit, $125 per qualifying exemption below $30,615 of federal AGI, reduced to zero from tax year 2025 by HB 2106 of 2022 as the state sales tax on food reached zero. NOT OPENED FROM THIS SANDBOX',
    url: 'https://ksrevisor.gov/statutes/chapters/ch79/079_032_0205.html',
  },
  {
    title:
      'Davis v. Michigan Dep\'t of Treasury, 489 U.S. 803 (1989), construing 4 U.S.C. § 111 — a state that exempts its own retirees\' benefits may not tax federal retirees\' benefits on the same terms. It is why the federal half of the Kansas exempt list is there and why the list extends to no other state\'s retirees: nothing requires parity with Missouri. CITED FOR THE DOCTRINE AND NOT FOR A KANSAS FIGURE; the opinion was not opened from this sandbox either',
    url: 'https://supreme.justia.com/cases/federal/us/489/803/',
  },
];

/**
 * The two schedules, stored and not derived.
 *
 * The joint column is exactly twice the other one, and unlike Oklahoma's two
 * subsections — which write their band widths out incrementally and state no
 * relation — K.S.A. 79-32,110(a)(2)(F) writes two whole schedules with their own
 * accumulated figures, `$2,392` and `$1,196`. So the doubling is still an
 * observation about two published tables rather than a relation the law states,
 * and `test/kansas.test.js` asserts it as one.
 *
 * **The surviving-spouse column is left to {@link byStatusOf}'s joint default and
 * that is deliberate, although it is the wrong schedule for a Kansas widow.** It
 * is unreachable: the engine rewrites the status once at its entry point, so
 * every table in this definition is read against head of household for her, and
 * `status-sweep.test.js` proves the rewrite reaches all of them by perturbing
 * this very cell and requiring that no widow's answer moves.
 *
 * Writing the column out by hand was the first thing tried and it is worse in two
 * ways that are only visible from the test suite. Passing the same `other` array
 * to `headOfHousehold` and `qualifyingSurvivingSpouse` makes them ONE OBJECT, so
 * an in-place perturbation of the widow's cell is a perturbation of the column she
 * actually reads — which that guard correctly reported as the status translation
 * having missed a table. And a hand-written figure in an unreachable cell is a
 * parameter the mutation audit enumerates and no test can ever kill, which is a
 * survivor bought for nothing.
 *
 * > **A VALUE WRITTEN INTO A CELL NOTHING READS IS NOT DOCUMENTATION, IT IS AN
 * > UNKILLABLE MUTANT AND, WHERE THE CELL HOLDS AN OBJECT, AN ALIAS.** The place
 * > to say which column a widow reads is `survivingSpouseFilesAs`, which is
 * > checked, and not a copy of the schedule, which is not.
 */
function kansasBrackets(): ByStatus<readonly Bracket[]> {
  // K.S.A. 79-32,110(a)(2)(F)(ii): "all other individuals".
  const other: readonly Bracket[] = [
    { rate: 0.052, upTo: 23_000 },
    { rate: 0.0558, upTo: Infinity },
  ];
  // (F)(i): married individuals filing joint returns.
  const joint: readonly Bracket[] = [
    { rate: 0.052, upTo: 46_000 },
    { rate: 0.0558, upTo: Infinity },
  ];
  return byStatusOf<readonly Bracket[]>({
    single: other,
    joint,
    separate: other,
    headOfHousehold: other,
  });
}

export function kansas(year: number): StateIncomeTaxDefinition | undefined {
  if (year !== 2025 && year !== 2026) return undefined;
  return {
    code: 'KS',
    name: 'Kansas',
    year,
    // Both years are the same published figures and the sameness is the statute:
    // SB 1 of 2024 wrote every one of them for "tax year 2024, and all tax years
    // thereafter", the enacted law carries no cost-of-living provision although
    // the bill as introduced did, and the 2025 booklet prints the 2024 table
    // unchanged. Nothing here is last year's figure standing in for an indexed
    // one that has not been published.
    status: 'published',
    // Form K-40 line 1 is federal adjusted gross income, so Kansas's own
    // deduction and exemptions come off below it and none of the four OBBBA
    // Schedule 1-A deductions reaches the Kansas base at all.
    base: 'federalAdjustedGrossIncome',
    // K.S.A. 79-32,117(c)(xviii). In full, for everybody, with no income test
    // from tax year 2024 — the repeal of the $75,000 cliff described above.
    subtractsTaxableSocialSecurity: true,
    // The K-40 has four filing-status boxes and no surviving-spouse box, and the
    // head-of-household box names her status as an alternative qualification.
    // That is Wisconsin's and Arizona's deciding phrase; see the module notes for
    // what the three candidate columns are worth.
    survivingSpouseFilesAs: {
      filesAs: 'headOfHousehold',
      cite:
        'The Kansas K-40 offers four filing statuses — single, married filing joint, married ' +
        'filing separate and head of household — and no qualifying-surviving-spouse box. The ' +
        'booklet requires the Kansas status to match the federal one and then states the one ' +
        'exception: a federal qualifying widow(er) with a dependent child checks the HEAD OF ' +
        'HOUSEHOLD box, because that box qualifies a filer who claimed "Head of Household OR ' +
        'QUALIFYING WIDOW OR WIDOWER WITH A DEPENDENT CHILD" on the federal return. Naming her ' +
        'status as an alternative qualification is what GRANTS the box, where Alabama\'s ' +
        'incorporation of 26 U.S.C. § 2(b) by reference denies it: § 2(b)(1) admits only an ' +
        'individual who "is not a surviving spouse". So Kansas is the fourth state here to ' +
        'reach head of household and the first where that column carries an allowance — the ' +
        '$2,320 head-of-household exemption — that neither the single nor the joint column has.',
    },
    rate: { kind: 'brackets', byStatus: kansasBrackets() },
    // K.S.A. 79-32,119(c). Unindexed; the separate column is exactly half the
    // joint one and the statute writes both.
    deduction: {
      kind: 'table',
      amounts: byStatus({ single: 3_605, joint: 8_240, separate: 4_120, headOfHousehold: 6_180 }),
    },
    // Worksheet I, and it is an addition to the STANDARD deduction rather than to
    // the exemption — so a Kansas itemiser loses it, which is the property that
    // made Oregon's a field of its own. Per box checked: age and blindness stack
    // and each person has both boxes. Kansas is the second state in this package
    // whose single figure EXCEEDS its joint figure. The reference model carries
    // both figures from 1998 with no later value, which is where the "unchanged
    // since 1998" in the notes comes from — a claim of that package's and not a
    // Kansas document read here.
    standardDeductionAgedOrBlindAddition: {
      amount: byStatus({ single: 850, joint: 700, separate: 700, headOfHousehold: 850 }),
      age: 65,
      cite:
        'K.S.A. 79-32,119(b) and Worksheet I of the K-40 instructions, "Standard Deduction for ' +
        'People 65 or Older and/or Blind" — the number of boxes checked times $850, or times ' +
        '$700 where the filing status is married filing joint or married filing separate. Four ' +
        'boxes exist on a joint return: filer 65 or over, filer blind, spouse 65 or over, ' +
        'spouse blind. THE 1998 DATE IS THE REFERENCE MODEL\'S RATHER THAN A DOCUMENT READ ' +
        'HERE: policyengine-us carries these two figures from 1998-01-01 with no later value, ' +
        'which is that package asserting they have not moved since and is the only evidence ' +
        'available from this sandbox for it. Either way they are identical in 2024, 2025 and ' +
        '2026, and the ONE marriage penalty in the Kansas income tax is its allowance for ' +
        'being old or blind: $150 per aged or blind person, $300 for a couple both 65, ' +
        '$16.74 of tax.',
    },
    exemption: {
      // K.S.A. 79-32,121(a) sets the figure BY STATUS and not by a count of
      // people, which is why this is `byStatus` and not `perPerson`: the joint
      // $18,320 is a statutory amount that happens to be twice $9,160, and a
      // married-filing-separate filer gets $9,160 whether or not a spouse exists.
      // The head-of-household column is $9,160 + the $2,320 additional exemption
      // that the 2024 form granted and HB 2231 of 2025 backdated into the statute,
      // and it is the column a Kansas widow is read against — see
      // `survivingSpouseFilesAs` above and `kansasBrackets` for why the
      // surviving-spouse cell is left at the default rather than written out.
      perFiler: byStatus({
        single: 9_160,
        joint: 18_320,
        separate: 9_160,
        headOfHousehold: 11_480,
      }),
      perDependent: 2_320,
      separateReturnSpouse: {
        // NOT a reading of a provision about spouses: a reading of the SHAPE of
        // the provision. § 79-32,121(a) writes one amount for each filing status
        // rather than an amount per exemption claimed, so there is no count for a
        // spouse to enter and nothing for one to be added to. That is a different
        // argument from Georgia's `noFilerExemption`, where the filer's own figure
        // is zero, and from a statute that names the spouse and refuses.
        spouse: 'notClaimed',
        cite:
          'K.S.A. § 79-32,121(a) allows "$18,320" for a joint return and "$9,160" for a single, ' +
          'head-of-household or married-filing-separate return — one figure per STATUS, not a ' +
          'figure per exemption claimed, with the only person-counted term being the $2,320 a ' +
          'dependent. A married-filing-separate return is $9,160 on its face and a spouse with ' +
          'no gross income adds nothing to it, because the subsection has no count to add them ' +
          'to. Kansas abandoned the per-person structure in 2024: through tax year 2023 the ' +
          'exemption WAS $2,250 "for each individual" and the question had purchase.',
        // Provable from the rule beside it: Kansas's aged and blind additions are
        // additions to the STANDARD DEDUCTION (`standardDeductionAgedOrBlindAddition`)
        // and the exemption has none, so there is no exemption addition for a
        // spouse to follow. Whether Worksheet I lets a married-filing-separate
        // return check its spouse's two boxes is a question about the DEDUCTION
        // and is unread; the note says so and what it is worth.
        agedAndBlind: 'notApplicable',
      },
      // NO `perBlindOrDisabledFiler`. Kansas's only additional personal exemption
      // for a condition is § 79-32,121(b)'s disabled VETERAN exemption, which
      // needs both total disability and veteran status, and no field here carries
      // the second. A blind Kansas filer's allowance is the Worksheet I addition
      // above, which is a deduction and not an exemption.
    },
    retirementIncomeSubtractions: [
      {
        name: 'Kansas exempt retirement benefits',
        // One Schedule S line and one statutory subsection family covers KPERS,
        // the other three Kansas systems, federal civil service and military
        // retired pay, so there is no `exemptInFullName` to split off: that field
        // exists where two provisions are reported as one, and Michigan is the
        // precedent for a single name where the state genuinely has one line.
        scope: 'perPerson',
        // No age test anywhere, so a Kansan of 45 drawing one of these pensions
        // subtracts the whole of it. Neither `minimumAge` nor `cappedMinimumAge`
        // is set, and that is the parameter most often reported wrong about a
        // state retirement rule. (The claim here is about the TAX rule and not
        // about when any of these systems lets somebody retire, which nothing
        // readable from this sandbox says.)
        //
        // A cap of ZERO is North Carolina's construction and it is exactly right
        // here: the rule subtracts the income Kansas exempts outright and NOTHING
        // else, because no private pension, 401(k), IRA or annuity has any Kansas
        // allowance at all.
        cap: 0,
        // Reads `retirement.*.governmentPension`, and military retired pay rides
        // the same flag. The caller has to keep an OUT-OF-STATE public pension out
        // of that field — see the note — because the exempt list is Kansas's own
        // systems plus the United States and nothing else.
        governmentPensionExemptInFull: true,
      },
    ],
    // K.S.A. 79-32,205 — 17% of the federal § 32 credit, refundable. Unlike
    // Oklahoma's 5%, the base is THIS year's federal credit and not a frozen
    // Code, so a match is the whole of the rule and the rule can be declared.
    // The rate was 18% for tax years 2010 through 2012 and was cut to 17% in
    // 2013; thirteen tax years later it has not been restored, and 1% of the
    // federal credit is $43.28 for a one-child family at the 2025 plateau.
    earnedIncomeCredit: {
      name: 'Kansas earned income credit (K.S.A. 79-32,205)',
      matchRate: 0.17,
      refundable: true,
    },
    notes: [
      'A KANSAS WIDOW FILES AS HEAD OF HOUSEHOLD, WHICH IS NEITHER OF THE TWO COLUMNS A MODEL DEFAULTS TO. The K-40 has four filing-status boxes and no qualifying-surviving-spouse box, and the Kansas head-of-household box qualifies a filer who claimed head of household OR qualifying widow(er) with a dependent child federally. So a federal qualifying surviving spouse is read against the head-of-household column: a $6,180 standard deduction, a $9,160 exemption plus the $2,320 head-of-household additional exemption, and the 5.58% band opening at $23,000. Against the joint column — the near-universal default — a widow with one dependent child and $60,000 of federal AGI owes $1,618.24 instead of $2,145.72, which is $527.48 too LITTLE, because the joint schedule\'s 5.2% band runs to $46,000 and swallows her whole taxable income. Against the single column she owes $2,418.86, $273.14 too much. The correct answer is between the two wrong ones and is the only one of the three that carries a head-of-household allowance.',
      "KANSAS'S $2,320 HEAD-OF-HOUSEHOLD EXEMPTION WAS ON THE DEPARTMENT'S FORM A YEAR BEFORE IT WAS IN THE STATUTE. SB 1 of the 2024 special session rewrote the personal exemption as $18,320 joint and $9,160 for every other status plus $2,320 a dependent, and said nothing about a head-of-household addition. The 2024 K-40 granted one anyway. HB 2231 of the 2025 session then codified it — the Department's Notice 25-07 records the amendment as allowing the additional $2,320 \"for tax year 2024 and all tax years thereafter\" — so the legislature agreed with the form, retroactively, a year on. A model built from the 2024 statute alone understates a Kansas head of household's exemption by $2,320 for both years: $120.64 of tax at 5.2% and $129.46 at 5.58%.",
      'NOT MODELLED — THE $2,320 PERSONAL EXEMPTION FOR A STILLBIRTH, and the reason is that no return records the fact. K.S.A. 79-32,121(a)(4), added for tax year 2025, allows an additional personal exemption of $2,320 for an unborn child that does not result in a live birth. A pregnancy ending in a live birth during the year produces a dependent and the dependent exemption is the same $2,320; paragraph (4) reaches the case where the year ends with no dependent. No field in this package and no figure on a federal return implies a stillbirth, so a Kansas return computed here for a household that suffered one is too HIGH by $120.64 at 5.2% or $129.46 at 5.58%. Supply it through `subtractions` as $2,320 of state subtraction.',
      "KANSAS'S MINIMUM FILING REQUIREMENT CANNOT CHANGE ANYBODY'S TAX, WHICH IS WHY THIS PACKAGE CARRIES NO ZERO-TAX THRESHOLD FOR KANSAS. The K-40 instructions print $26,560 joint, $17,660 head of household, $12,765 single and $13,280 married filing separate, and every one is exactly that status's standard deduction plus its personal exemption: 8,240 + 18,320, 6,180 + 9,160 + 2,320, 3,605 + 9,160, 4,120 + 9,160. A filer at or below the threshold therefore has no taxable income already, and every further allowance — $2,320 a dependent, $850 or $700 a box on Worksheet I, an itemised deduction larger than the standard one by construction — only widens the gap. The threshold can zero a positive tax in no household, in any status, at any income. `test/kansas.test.js` asserts the three sums so that a year in which one of the figures moves and the filing requirement does not FAILS here rather than becoming a cliff nothing models. The independent reference model ships the threshold as five parameters and a branch that cannot fire.",
      "WHAT A KANSAS RETIREMENT COSTS DEPENDS ON WHICH GOVERNMENT EMPLOYED THE RETIREE AND ON NOTHING ELSE. K.S.A. 79-32,117(c) subtracts in full, with no cap, no age test and no income test: KPERS and the Kansas Police and Firemen's, Judges and Justices and Highway Patrol systems; federal civil service retirement and disability payments and any other retirement from federal employment, and retired pay for service in the United States Armed Forces — a Thrift Savings Plan distribution being federal-employment retirement by that wording, which is an application of the rule rather than a line anybody here has read naming it. NOTHING subtracts a private pension, a 401(k), an IRA or an annuity — not partially, not at any age, not below any ceiling. A single Kansan of 67 with $50,000 of pension and nothing else pays $0.00 on a KPERS, federal or military pension and $1,942.88 on the same $50,000 from a private plan. The federal half of the list is there because 4 U.S.C. § 111 requires it of a state that exempts its own retirees (Davis v. Michigan, 489 U.S. 803) and nothing requires parity with any other state's: AN OUT-OF-STATE PUBLIC PENSION IS TAXED IN FULL.",
      'PUT ONLY KANSAS AND FEDERAL SERVICE IN `retirement.filer.governmentPension` AND `retirement.spouse.governmentPension` FOR KANSAS, and put an out-of-state public pension in `employerPlanPension` instead, where it is taxed as the statute taxes it. This is the one input decision in Kansas that moves an answer by thousands of dollars, and it is one the larger reference model cannot make: its own source comment says "out-of-state public pensions are not exempt" and it then subtracts taxable public pension income "as an in-state proxy", exempting a retired Missouri teacher living in Wichita whom Kansas taxes in full. A $50,000 out-of-state public pension is $2,702.60 of Kansas tax that model does not charge.',
      "SOCIAL SECURITY IS FULLY EXEMPT FROM TAX YEAR 2024, AND THE CLIFF IT REPLACED IS THE LARGEST THIS PROJECT HAS RECORDED. Through 2023, all benefits were exempt where federal AGI was $75,000 or less and the WHOLE federally taxable benefit became Kansas income one dollar above it. For a couple with $51,000 of federally taxable benefits that one dollar cost $2,845.80 of Kansas tax. SB 1 of the 2024 special session removed the limit, so the subtraction is now unconditional and `taxableSocialSecurity` is read for every Kansas return. A model still carrying the $75,000 limit overstates that couple's Kansas bill by the same $2,845.80 — and published accounts of this state are slow here: several still print the pre-2024 three-bracket schedule of 3.1%, 5.25% and 5.7% as well.",
      'NOTHING IN THE KANSAS INCOME TAX IS INDEXED, AND THE SAMENESS OF THE TWO YEARS IS THE STATUTE RATHER THAN A CARRY-FORWARD. The deduction, the exemption, the dependent amount, both Worksheet I figures and both bracket thresholds are identical in 2024, 2025 and 2026, because SB 1 wrote each of them for "tax year 2024, and all tax years thereafter" and the enacted law carries no cost-of-living provision. THE BILL AS INTRODUCED DID: a 2024 fiscal note describes increasing the standard deduction annually by the cost-of-living adjustment of the Internal Revenue Code beginning in tax year 2025, and that clause is not in the act. A model built from the fiscal note indexes a figure the law fixes. The 2025 K-40 booklet printing the 2024 table unchanged is the evidence that there is no indexing, not evidence that nobody read it.',
      "NOT MODELLED — THE CHILD AND DEPENDENT CARE CREDIT, WHICH IS 50% OF THE FEDERAL CREDIT AND THE LARGEST SUCH MATCH IN THIS PACKAGE. K.S.A. 79-32,111c gives a percentage of the federal § 21 credit — 12.5% for 2018 rising to 25% for 2020 and 50% from tax year 2024 — non-refundable. Neither this package nor `us-federal-tax` computes the federal § 21 credit and no input carries one, so a Kansas return with child care expenses is computed here TOO HIGH by half of it. Supply the credit yourself; nothing in this package can accept one.",
      "KANSAS'S FOOD SALES TAX CREDIT IS GONE FROM TAX YEAR 2025. It was $125 per qualifying exemption for a household with a child under 18, a filer or spouse of 55 or over, or a blind or disabled filer, where federal AGI was below $30,615 — a limit unchanged since 2015 — and HB 2106 of 2022 reduced it to zero as the state's own sales tax on food reached zero. A family of four with a young child and $30,000 of AGI had $500 of credit in tax year 2024 and nothing in 2025, so a model carrying the credit into either year this module covers overstates a low-income Kansas refund by up to $125 a head. Neither year here has it, which is why no rule models it.",
      "A MARRIED KANSAN FILING SEPARATELY HAS A LARGER STANDARD DEDUCTION THAN A SINGLE ONE, AND THE JOINT FIGURE IS TWICE THE SEPARATE FIGURE RATHER THAN TWICE THE SINGLE FIGURE. $3,605 single, $4,120 separate, $8,240 joint: the separate column is $515 ABOVE the single one, which is $26.78 of tax in the 5.2% band and $28.73 in the 5.58% one, and every other state in this package that sets a separate column sets it equal to single. The consequence for a couple runs the opposite way from every marriage penalty here: two single Kansans who marry GAIN $1,030 of deduction and $57.47 of tax between them at $50,000 each, because the bracket thresholds and the personal exemption ARE exactly doubled and the deduction is more than doubled. policyengine-us's parameter file says the separate figure is read off recent tax forms rather than from the statute, which is how the two came to disagree.",
      "THE TWO PLACES KANSAS BREAKS IN THE PENALTY DIRECTION BOTH BELONG TO A STATUS RATHER THAN TO A COUPLE. Worksheet I gives $850 per aged-or-blind box on a single or head-of-household return and $700 on a joint or separate one, per person, so marrying costs each aged or blind Kansan $150 of deduction, $300 for a couple both 65, $16.74 of tax — Oregon's addition is upside down the same way and the two are the only figures here where a single filer's allowance exceeds a joint filer's. The larger break is the head-of-household column: a single parent loses the $2,320 additional exemption AND $1,545 of standard deduction on marrying — $1,545 and not the $2,575 between the two columns, because the single filer's own $3,605 is absorbed into the joint $8,240 rather than lost — so a parent on $60,000 who marries a single filer on $40,000 pays $215.67 more than the two paid apart, which is exactly 3,865 x 5.58% and THIRTEEN times the aged-or-blind figure. The 1998 date on the Worksheet I figures is the reference model's — policyengine-us carries both from 1998-01-01 with no later value, which is that package asserting twenty-eight unchanged tax years and the only evidence for the date available from this sandbox; the federal § 63(f) additions were $1,050 and $850 in 1998 and are $2,000 and $1,600 now.",
      'KANSAS TAXES TIPS AND OVERTIME THAT THE FEDERAL GOVERNMENT NOW EXEMPTS. Form K-40 line 1 is federal adjusted gross income and all four OBBBA Schedule 1-A deductions — § 224 tips, § 225 overtime, § 151(d)(5) senior and § 163(h)(4) vehicle loan interest — sit BELOW it, so none of them reaches the Kansas base and Kansas has legislated no subtraction of its own for any of them. A tipped Kansas worker with $8,000 of qualified tips pays Kansas $416.00 of tax on income the federal return exempted entirely where those dollars fall in the 5.2% band, and $446.40 where they fall in the 5.58% one.',
      "WHETHER A MARRIED-FILING-SEPARATE KANSAS RETURN MAY CHECK ITS SPOUSE'S WORKSHEET I BOXES IS UNREAD. The federal § 63(f) additions reach a spouse on a separate return only through § 151(b), which needs the spouse to have no gross income and not be another taxpayer's dependent, and nothing readable from this sandbox says whether Kansas's own worksheet carries that condition. This package counts only the people the return declares, which is the answer that does not flatter the filer. It is worth $700 of deduction and $36.40 to $39.06 of tax, and it is a question about the DEDUCTION: Kansas's personal exemption has no aged or blind addition at all, so there is nothing of that kind for a spouse to follow.",
      'NO CITY, COUNTY OR SCHOOL DISTRICT IN KANSAS LEVIES AN INCOME TAX. The state figure is the whole of a Kansas resident\'s income tax, so `locality` is never required and `SUPPORTED_LOCALITIES` names none here. Kansas City, Missouri and St. Louis levy earnings taxes on people who work there and Kansas City, KANSAS does not — which is a distinction this package already carries on the Missouri side.',
      'NOT MODELLED, and each would reduce a Kansas return computed here: the $2,320 disabled veteran exemption of § 79-32,121(b), which needs both total disability and veteran status and no field here carries the second; the Kansas 529 contribution subtraction, $3,000 a beneficiary and $6,000 on a joint return; the subtraction for interest on United States obligations; the credit for taxes paid to another state; and Kansas itemized deductions, which this package does not read for Kansas — `stateItemizedDeductions` is ignored and a Kansas itemiser is computed on the standard deduction instead. Kansas lets a filer itemize or take the standard deduction WHICHEVER IS BETTER and does not lock the election to the federal one, so the trap Oklahoma sets does not exist here; supply the difference through `subtractions`.',
    ],
    citations: KS_CITATIONS,
  };
}
