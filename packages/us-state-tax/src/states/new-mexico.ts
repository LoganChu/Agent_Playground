/**
 * New Mexico — the thirty-third taxing state, and the one where the four
 * figures worth selling are all about a COUNT rather than a rate.
 *
 * ## THE $4,000 DEPENDENT DEDUCTION PAYS NOTHING FOR AN ONLY CHILD
 *
 * NMSA 1978 § 7-2-39 allows `$4,000` of deduction from net income for a
 * dependent, to a return filed as head of household or married filing jointly.
 * Every published account of the provision stops there. The statute does not:
 * the deduction is allowed **for each dependent in excess of one**.
 *
 * ```text
 *   dependents          1        2        3        4
 *   what NM allows      $0   $4,000   $8,000  $12,000
 *   "$4,000 each"    $4,000   $8,000  $12,000  $16,000
 *   overstated by    $4,000   $4,000   $4,000   $4,000
 * ```
 *
 * **The error is the same `$4,000` for every family of every size**, which makes
 * it the second finding in this package with Arkansas's most useful property: a
 * buyer checks one household and the number they see is the number every other
 * household shows. `$172.00` of tax in the 4.3% band, `$188.00` at 4.7%,
 * `$196.00` at 4.9%, `$236.00` at 5.9% — and for a New Mexico family with ONE
 * child it is the whole of the deduction rather than a part of it.
 *
 * The design is legible once the figure is right. HB 6 of 2019 created the
 * deduction to offset the federal personal exemption that the Tax Cuts and Jobs
 * Act had set to zero, and New Mexico's own deduction IS the federal standard
 * deduction — which that Act had nearly doubled. The Legislative Finance
 * Committee's post-session report describes it in exactly those terms: "a
 * $4,000 income tax deduction for each dependent after the first", to offset the
 * effects of federal tax reform. The first dependent is the one the bigger
 * standard deduction was taken to have already covered.
 *
 * > **A DEDUCTION'S COUNT IS A PARAMETER AND NOT A DETAIL.** Six states in this
 * > package have been added on the strength of a figure in a table; this one
 * > turns on an off-by-one in a sentence, and no rate schedule, bracket table or
 * > summary of New Mexico contains the information needed to get it right.
 *
 * **And the deduction belongs to two of the five statuses.** § 7-2-39 names a
 * return filed "as a head of household or married filing jointly" and no other,
 * so a single filer, a married filer filing separately and — the contestable one
 * — a **surviving spouse** get nothing. New Mexico's PIT-1 has five
 * filing-status boxes including "Surviving Spouse with dependent child", and the
 * state's rate table sends her to the married-filing-jointly COLUMN while
 * § 7-2-39 does not name her status. A qualifying surviving spouse has a
 * dependent child by definition, so she is the one filer for whom the omission
 * is certainly not an oversight of drafting convenience — and this package takes
 * the literal reading, which is also the independent reference model's. It is
 * worth `$4,000` of deduction on a widow with two children — `$188.00` of tax on
 * `$90,000` of AGI, measured, where the marginal band is 4.7%.
 *
 * ## A NEW MEXICO HEAD OF HOUSEHOLD IS TAXED ON THE MARRIED-COUPLE SCHEDULE
 *
 * § 7-2-7 writes three schedules, not five, and the one it writes for married
 * individuals filing joint returns serves **heads of household and surviving
 * spouses too**. The Department's own rate table prints the joint column with
 * the note that it "must also be used by surviving spouse" and gives head of
 * household the same figures. Married filing separately is exactly half.
 *
 * ```text
 *                      single        joint / HoH / surviving spouse
 *   1.5% from               0                 0
 *   3.2% from           5,500             8,000
 *   4.3% from          16,500            25,000
 *   4.7% from          33,500            50,000
 *   4.9% from          66,500           100,000
 *   5.9% from         210,000           315,000
 * ```
 *
 * A model that defaults a head of household to the single column — the ordinary
 * default for a state that publishes no head-of-household table, and the reading
 * that the two-column shape of most rate tables invites — overcharges, and the
 * error settles to a constant:
 *
 * ```text
 *   net taxable income    66,500     100,000     210,000     315,000 and above
 *   on the joint column    2,514.50   4,089.00    9,479.00     14,624.00
 *   on the single column   2,716.50   4,358.00    9,748.00     15,943.00
 *   overcharged by           202.00     269.00      269.00       1,319.00
 * ```
 *
 * **`$1,319.00` at every net taxable income above `$315,000`, forever**, because
 * above that point the two schedules run parallel at 5.9% and the gap is the
 * accumulated difference of the five bands below. The jump from `$269` to
 * `$1,319` is the single column's 5.9% band opening `$105,000` earlier than the
 * joint one.
 *
 * ## NEW MEXICO'S SOCIAL SECURITY EXEMPTION IS A CLIFF, AND IT IS IN FORCE
 *
 * § 7-2-5.14 exempts the whole federally taxable Social Security benefit where
 * federal AGI "does not exceed" `$100,000` single, `$150,000` joint, head of
 * household or surviving spouse, `$75,000` married filing separately. There is
 * no taper. One dollar above the figure and every taxable dollar of the benefit
 * is New Mexico income.
 *
 * ```text
 *   one dollar of federal AGI, 2026, measured
 *     joint, $60,000 of federally taxable benefit, at 150,000   $2,855.65
 *     joint, $85,000 of benefit, at 150,000                     $3,961.85
 *     single, $40,000 of benefit, at 100,000                    $1,914.85
 *     separate, $30,000 of benefit, at 75,000                   $1,427.85
 * ```
 *
 * **It is the largest live discontinuity this package carries on a Social
 * Security threshold, and `test/new-mexico.test.js` measures that over every
 * state here rather than asserting it.** Kansas charged `$2,845.80` on the same
 * shape at `$75,000` and repealed it for tax year 2024; Connecticut's surviving
 * threshold is `$405` for a couple with `$40,000` of benefits. New Mexico's
 * exceeds the repealed Kansas figure on a household whose benefit a couple of
 * two long-career maximum earners could actually have, and nothing has repealed
 * it. (It is not the largest discontinuity in this package: Maryland's
 * capital-gains surtax tests federal AGI against `$350,000` rather than taking
 * an excess, and one dollar there can cost `$6,933.08`.)
 *
 * The figures are computed and not `benefit x rate`: `$60,000` of benefit
 * straddles the 4.7% and 4.9% bands, so the naive product overstates the cliff
 * by `$84.35`.
 *
 * **AND THE THREE FIGURES ARE NOT INDEXED, ALTHOUGH A PUBLISHED 2026 GUIDE SAYS
 * THEY ARE.** HB 249 of the 2024 regular session would have adjusted all three
 * for inflation from tax year 2025. It was **postponed indefinitely on 6
 * February 2024** and never became law, and the 2025 PIT-ADJ instructions print
 * the unindexed `$100,000` and `$75,000` in their Table 2. A guide reaching this
 * sandbox states the opposite — that HB 249 amended § 7-2-5.14 so the base
 * amounts are adjusted for inflation and rounded down to the nearest `$100` —
 * and on a cliff that error is not a rounding difference: it moves the point at
 * which an entire benefit becomes taxable.
 *
 * > **AN INDEXING CLAUSE IN A BILL THAT DIED IS THE SAME DEFECT AS AN INDEXING
 * > CLAUSE IN A FISCAL NOTE, AND THIS IS THE SECOND CONSECUTIVE STATE TO CARRY
 * > IT.** Kansas's SB 1 as introduced would have indexed the standard deduction
 * > from 2025 and the enacted act does not, so a model built from the fiscal
 * > note indexes a figure the law fixes. New Mexico's is worse in one respect
 * > and better in another: the figure it moves sits on a cliff rather than on a
 * > deduction, and the bill's own record says plainly that it failed.
 *
 * ## THE LOW- AND MIDDLE-INCOME EXEMPTION IS PER EXEMPTION, AND ITS INCOME LIMIT IS REDUNDANT
 *
 * § 7-2-5.8's figure is `$2,500` and that is not what a household gets: the
 * subsection multiplies it by the number of federal exemptions, so a joint
 * return with two children claims four and `$10,000` of exemption. It withdraws
 * at 10% of AGI above `$30,000` for a joint, head-of-household or
 * surviving-spouse return, 15% above `$20,000` single and 20% above `$15,000`
 * separate — and the statute ALSO prints an income limit above which nothing is
 * allowed.
 *
 * **Every one of those limits is exactly where the taper reaches zero.**
 *
 * ```text
 *             taper ends at                      the printed limit
 *   joint     30,000 + 2,500/0.10 = 55,000.00     55,000
 *   single    20,000 + 2,500/0.15 = 36,666.67     36,667
 *   separate  15,000 + 2,500/0.20 = 27,500.00     27,500
 * ```
 *
 * So the limit can zero a positive exemption in no household, in any status, at
 * any income, and `test/new-mexico.test.js` asserts the three identities rather
 * than trusting them — the Kansas minimum-filing-requirement pattern, where a
 * rule that changes no answer today gets a test on its PREMISE because nothing
 * in a suite of answers can see the premise break.
 *
 * **The single row is the interesting one, and it is a third of a dollar wide.**
 * `$36,666.67` is not `$36,667`, so the printed limit sits just above the end of
 * the taper. This package clamps the exemption at zero and the independent
 * reference model does not: between `$36,666.67` and `$36,667` of single AGI
 * that model computes `$2,500 - 0.15 x 16,667 = -$0.05` per exemption and
 * ADDS it to taxable income. It is five cents on a four-person return and it is
 * the shape worth recording, not the amount: a clamp omitted where two published
 * figures were believed to coincide exactly.
 *
 * ## THE AGED-OR-BLIND EXEMPTION HAS NOT BEEN INDEXED SINCE 1987, AND IT IS NINE CLIFFS
 *
 * § 7-2-5.2 gives up to `$8,000` to each person 65 or over **or** blind, read off
 * a table by AGI that falls in whole `$1,000` steps. A step is not a taper: one
 * dollar of AGI at a boundary costs the whole `$1,000`.
 *
 * ```text
 *   single    $8,000 to 18,000, then -1,000 per 1,500 of AGI, nothing from 28,500
 *   joint     $8,000 to 30,000, then -1,000 per 3,000 of AGI, nothing from 51,000
 *   separate  $8,000 to 15,000, then -1,000 per 1,500 of AGI, nothing from 25,500
 * ```
 *
**And most of the steps cost nothing, which is the finding.** Measured
 * over every boundary in all three tables for 2026:
 *
 * ```text
 *   single, filer 70        18,000  19,500  21,000  22,500  24,000  25,500  27,000  28,500
 *                            $0.00   $0.00   $0.00   $0.00  $14.27  $15.01  $30.34  $32.04
 *   joint, both 70          30,000 ... 42,000  45,000  48,000  51,000
 *                            $0.00       $0.00  $30.02  $48.74  $64.04
 * ```
 *
 * **FOUR of the eight single boundaries are free, and the largest step in the
 * state is `$64.04`.** The reason is that the exemption expires at `$28,500` of
 * AGI for a single filer, and a single New Mexican at `$28,500` has about
 * `$7,400` of taxable income once the federal deduction and the other two
 * allowances are taken — which is inside the 3.2% band. **So `$1,000` of
 * exemption at one of these boundaries can never be worth 4.3% or 4.7%, because
 * nobody who reaches those bands still has the exemption.** `$64.04` is the
 * joint `$51,000` boundary, where BOTH people's exemptions fall at once:
 * `$2,000` of allowance on one dollar of income.
 *
 * > **A STAIRCASE'S STEP IS WORTH THE RATE AT THE INCOME WHERE THE STEP
 * > HAPPENS, NOT THE STATE'S TOP RATE.** The first draft of this module priced
 * > these at `$43.00` and `$47.00` by multiplying `$1,000` by two of New
 * > Mexico's six rates, and no filer at any of the eight boundaries is in
 * > either band. It is Day 66's rule — a claim about a set is checked by walking
 * > the set — applied to a rate rather than to a superlative.
 *
 * **The thresholds are the 1987 figures** — the reference model carries every one
 * of them from `1987-01-01` with no later value — so what was a middle-income
 * allowance when it was written now expires below the federal poverty guideline
 * for a family of four, and that is why its steps are cheap: the allowance has
 * been overtaken by the deduction that sits above it.
 *
 * **AND AGED AND BLIND DO NOT STACK ON ONE PERSON.** The subsection reaches a
 * person "sixty-five years of age or older **or** blind", so a single New
 * Mexican who is both gets `$8,000` once. Federal § 63(f) stacks its two
 * additions, every state addition in this package modelled on § 63(f) stacks
 * too, and Kansas's Worksheet I gives a filer who is both 65 and blind two boxes
 * at `$850`. New Mexico is the first state here where the two conditions are
 * alternatives rather than additions.
 *
 * ## THE DEDUCTION IS THE FEDERAL ONE, SO OBBBA CUT NEW MEXICO TAX WITH NO NEW MEXICO LEGISLATION
 *
 * PIT-1 line 12 is "Federal standard or itemized deduction amount (from federal
 * Form 1040, line 12)". New Mexico has no deduction of its own and no personal
 * exemption at all, which makes it the fourth state in this package declared
 * `deduction: { kind: 'federal' }` after Arizona, Missouri and Iowa.
 *
 * Two consequences the state never legislated:
 *
 * 1. **The One Big Beautiful Bill Act's increase flows straight through.** A
 *    single New Mexican's deduction was `$15,000` under the pre-Act schedule and
 *    is `$15,750` for 2025 and `$16,100` for 2026; a joint return's is `$32,200`
 *    for 2026. At 4.9% the 2026 increase alone is worth `$53.90` single and
 *    `$107.80` joint against the figures a model built before July 2025 carries.
 * 2. **The § 63(f) addition for age and blindness flows through too**, because
 *    line 12 is the deduction the filer ACTUALLY TOOK and that figure includes
 *    it. `$2,050` for a single filer 65 or over in 2026, `$1,650` each on a joint
 *    return. This is Missouri's answer and not Arizona's: Arizona's statute sets
 *    its deduction equal to the federal standard amount in a flat table, so the
 *    addition does NOT reach an Arizona return, and this package was wrong about
 *    Arizona for 47 days for exactly that reason. **A New Mexico retiree
 *    therefore collects the age allowance twice** — once inside line 12 and again
 *    through § 7-2-5.2 — which is a fact about two provisions and not a
 *    double-count here.
 *
 * And the four OBBBA Schedule 1-A deductions — § 224 tips, § 225 overtime, the
 * § 151(d)(5) senior deduction and § 163(h)(4) vehicle loan interest — sit BELOW
 * federal AGI, so none of them reaches the New Mexico base and New Mexico has
 * legislated no subtraction of its own for any of them.
 *
 * ## THE 40% CAPITAL GAINS DEDUCTION IS GONE FOR EVERYBODY WHO DID NOT SELL A NEW MEXICO BUSINESS
 *
 * § 7-2-34 allowed the greater of `$1,000` or **40% of net capital gain**
 * through tax year 2024. HB 252 of 2024 restricted the 40% element to the gain
 * from the sale of a New Mexico business and raised the flat element to `$2,500`,
 * from tax year 2025. So for an ordinary filer the deduction is now
 * `min(net capital gain, $2,500)` — `$122.50` of tax at 4.9%, against `$9,800`
 * on a `$200,000` gain under the repealed percentage. Published accounts of this
 * state are slow here and several still describe the 40% deduction as current.
 *
 * ## SOURCING
 *
 * `tax.newmexico.gov`, `realfile.tax.newmexico.gov`, `nmlegis.gov`,
 * `nmonesource.com` and `law.justia.com` all fail to resolve from this sandbox,
 * by `curl` and by the fetch tool alike. **No New Mexico primary document was
 * opened.** The figures are `policyengine-us` 2.87.0's parameter files, which
 * cite the 2025 PIT packet page by page, corroborated by server-side search's
 * reading of the 2025 PIT-1 and PIT-ADJ instructions, the Department's 2025 rate
 * table, the Legislative Finance Committee's 2019 post-session report and the
 * Taxation and Revenue Department's Tax Expenditure presentation. Where the two
 * routes disagree or where only one of them speaks, the notes say so.
 */
import type { CreditStep, StateIncomeTaxDefinition } from '../definition.js';
import { byStatus, byStatusOf } from './helpers.js';
import type { Bracket, ByStatus, Citation } from '../types.js';

const NM_CITATIONS: readonly Citation[] = [
  {
    title:
      'NMSA 1978 § 7-2-7, the individual income tax rate schedules as amended by HB 252 of 2024 for taxable years beginning on or after 1 January 2025. THREE SCHEDULES, NOT FIVE: one for married individuals filing separate returns, one for single individuals, and one for married individuals filing joint returns, SURVIVING SPOUSES AND HEADS OF HOUSEHOLD. Six brackets — 1.5%, 3.2%, 4.3%, 4.7%, 4.9%, 5.9% — with the joint/HoH/surviving-spouse thresholds at 8,000 / 25,000 / 50,000 / 100,000 / 315,000, the single ones at 5,500 / 16,500 / 33,500 / 66,500 / 210,000 and the separate ones at exactly half the joint figures. The 5.9% top rate came from HB 163 of 2022 and the 4.3% band from HB 252 of 2024. NOT OPENED FROM THIS SANDBOX: nmlegis.gov, nmonesource.com and law.justia.com do not resolve here, by curl or by WebFetch',
    url: 'https://nmonesource.com/nmos/nmsa/en/item/4340/index.do',
  },
  {
    title:
      "New Mexico 2025 Personal Income Tax Form Packet — Form PIT-1 and instructions. LINE 7 carries FIVE filing-status boxes: single, married filing jointly, married filing separately, head of household, and SURVIVING SPOUSE WITH DEPENDENT CHILD, and the instruction is to mark only one; the Department's FAQ requires the New Mexico status to match the federal one. LINE 12 is \"Federal standard or itemized deduction amount (from federal Form 1040, line 12)\" — New Mexico has no deduction of its own and no personal exemption. LINE 13 is the deduction for certain dependents, computed on the Worksheet for Calculating Deduction for Certain Dependents in the instructions. The 2025 TAX RATE TABLE prints the married-filing-jointly column with the note that it \"must also be used by surviving spouse\" and gives head of household the same figures. NOT OPENED FROM THIS SANDBOX: realfile.tax.newmexico.gov and tax.newmexico.gov do not resolve here",
    url: 'https://realfile.tax.newmexico.gov/2025pit-1-ins.pdf',
  },
  {
    title:
      'NMSA 1978 § 7-2-39, deduction from net income for certain dependents — $4,000 FOR EACH DEPENDENT IN EXCESS OF ONE, to a taxpayer who is not a dependent of another individual and who files a return as a head of household or married filing jointly, from tax year 2019 and for as long as the federal exemption amount under IRC § 151 is zero. The "in excess of one" is the part no published summary of the provision carries, and three independent records of it reached this sandbox through server-side search: the Legislative Finance Committee\'s May 2019 post-session report ("a $4,000 income tax deduction for each dependent after the first", offsetting the effects of federal tax reform), the Taxation and Revenue Department\'s 2019 and 2020 Tax Expenditure Report presentation ("$4,000 per dependent beyond the first dependent claimed"), and the Senate Finance Committee amendment analysis of SB 300 of 2019 ("a $4,000 deduction for one less than the number of dependents claimed"). § 7-2-39(D) defines "dependent" by reference to IRC § 152. NOT OPENED FROM THIS SANDBOX',
    url: 'https://www.nmlegis.gov/Entity/LFC/Documents/Session_Publications/Post_Session_Fiscal_Reviews/May%202019.pdf',
  },
  {
    title:
      'NMSA 1978 § 7-2-5.14, exemption for social security income — the whole amount included in adjusted gross income under IRC § 86, where federal AGI DOES NOT EXCEED $100,000 for a single filer, $150,000 for a joint, head-of-household or surviving-spouse return and $75,000 for a married individual filing separately. A CLIFF, with no taper, and the boundary is inclusive. HB 249 of the 2024 regular session would have adjusted the three figures for inflation from tax year 2025 and was POSTPONED INDEFINITELY on 6 February 2024; the 2025 PIT-ADJ instructions Table 2 prints the unindexed figures, and policyengine-us 2.87.0 carries all three from 2022-01-01 with no later value. HB 293 of 2025 and HB 92 of 2026 would have removed or suspended the caps and neither is recorded here as enacted. NOT OPENED FROM THIS SANDBOX',
    url: 'https://law.justia.com/codes/new-mexico/chapter-7/article-2/section-7-2-5-14',
  },
  {
    title:
      'NMSA 1978 § 7-2-5.8, exemption for low- and middle-income taxpayers — up to $2,500 MULTIPLIED BY THE NUMBER OF FEDERAL EXEMPTIONS, reduced by 10% of federal AGI above $30,000 (joint, head of household, surviving spouse), 15% above $20,000 (single) or 20% above $15,000 (married filing separately), and allowed only where federal AGI does not exceed $55,000 / $36,667 / $27,500. Each printed limit is exactly where its own taper reaches zero, to within a third of a dollar. 2025 PIT packet page PIT-1-26. NOT OPENED FROM THIS SANDBOX',
    url: 'https://law.justia.com/codes/new-mexico/chapter-7/article-2/section-7-2-5-8',
  },
  {
    title:
      'NMSA 1978 § 7-2-5.2, exemption for income of persons sixty-five and older OR BLIND — up to $8,000 for each qualifying person, falling in whole $1,000 steps as federal AGI rises and reaching zero at $28,500 single, $51,000 joint and head of household, $25,500 married filing separately. THE TWO CONDITIONS ARE ALTERNATIVES AND DO NOT STACK: a person who is both 65 and blind qualifies once, which is the opposite of federal § 63(f). 2025 PIT packet page ADJ-5, TABLE 1, "Exemptions for Persons 65 or Older or Blind". THE 1987 DATE IS THE REFERENCE MODEL\'S RATHER THAN A DOCUMENT READ HERE: policyengine-us carries every threshold and amount in all five tables from 1987-01-01 with no later value, which is that package asserting thirty-nine unindexed years and is the only evidence available from this sandbox for it. NOT OPENED FROM THIS SANDBOX',
    url: 'https://law.justia.com/codes/new-mexico/chapter-7/article-2/section-7-2-5-2',
  },
  {
    title:
      'NMSA 1978 § 7-2-34, deduction for net capital gain income, as amended by HB 252 of 2024 section 8 with effect from tax year 2025 — the greater of $2,500 (raised from $1,000) or 40% of the net capital gain from the sale of a NEW MEXICO BUSINESS, where through tax year 2024 the 40% element reached any net capital gain. Subsection (B) gives each spouse filing separately one-half of the deduction the joint return would have had, and the definition of net capital gain is IRC § 1222(11) — net long-term gain less net short-term loss. NOT OPENED FROM THIS SANDBOX',
    url: 'https://www.nmlegis.gov/Sessions/24%20Regular/final/HB0252.pdf',
  },
  {
    title:
      'NMSA 1978 § 7-2-18.15, the working families tax credit — 25% of the federal § 32 earned income credit, refundable, raised from 20% for tax year 2023, with childless eligibility extended down to age 18. The base is THIS year\'s federal credit rather than a frozen Code, so a match is the whole of the rule. NMSA 1978 § 7-2-18.34, the child income tax credit — a refundable per-child amount banded on adjusted gross income, $637 / $424 / $212 / $106 / $79 / $53 / $26 for 2025, indexed annually under subsection (D) and halved on a married-filing-separate return. NMSA 1978 § 7-2-14, the low income comprehensive tax rebate, and § 7-2-18.34(J)(2)\'s adoption of the IRC § 152(c) qualifying-child definition without the federal earned income credit\'s identification-number requirement. NEITHER THE CHILD INCOME TAX CREDIT NOR THE REBATE IS MODELLED HERE — see the notes. NOT OPENED FROM THIS SANDBOX',
    url: 'https://law.justia.com/codes/new-mexico/chapter-7/article-2/section-7-2-18-15',
  },
  {
    title:
      'NMSA 1978 § 7-2-5.13, exemption for armed forces retirement pay — $10,000 for tax year 2022, $20,000 for 2023 and $30,000 for 2024, per retiree and per surviving spouse of one. THE EXEMPTION IS SCHEDULED TO END AFTER TAX YEAR 2026: SB 56 and SB 125 of 2024 would have removed the sunset and HB 221 of 2026 would have made the exemption total, and none of the three is recorded here as enacted. policyengine-us 2.87.0 carries the $30,000 from 2024-01-01 WITH NO END DATE, so that model exempts the pay in tax year 2027 and after; both years this module covers are inside the window, so the sunset changes no answer here and is recorded because it changes one next year. NOT OPENED FROM THIS SANDBOX',
    url: 'https://law.justia.com/codes/new-mexico/2024/chapter-7/article-2/section-7-2-5-13/',
  },
];

/**
 * The three schedules of § 7-2-7, stored and not derived.
 *
 * **Head of household and surviving spouse read the JOINT column and this is
 * written out rather than left to {@link byStatusOf}'s default**, because in New
 * Mexico it is the statute's own grouping rather than a convention: § 7-2-7
 * writes one schedule for "married individuals filing joint returns, surviving
 * spouses and heads of household" and the Department's rate table prints the
 * joint column with the note that it must also be used by a surviving spouse.
 * Passing the same array to three keys makes them ONE object, which is the
 * property `status-sweep.test.js` relies on and which a hand-written copy would
 * destroy.
 *
 * The separate column is exactly half the joint one at every threshold. That is
 * an observation about two published schedules, and `test/new-mexico.test.js`
 * asserts it as one.
 */
function newMexicoBrackets(): ByStatus<readonly Bracket[]> {
  // § 7-2-7(C): single individuals and estates and trusts.
  const single: readonly Bracket[] = [
    { rate: 0.015, upTo: 5_500 },
    { rate: 0.032, upTo: 16_500 },
    { rate: 0.043, upTo: 33_500 },
    { rate: 0.047, upTo: 66_500 },
    { rate: 0.049, upTo: 210_000 },
    { rate: 0.059, upTo: Infinity },
  ];
  // § 7-2-7(B): married individuals filing joint returns, surviving spouses and
  // heads of household.
  const joint: readonly Bracket[] = [
    { rate: 0.015, upTo: 8_000 },
    { rate: 0.032, upTo: 25_000 },
    { rate: 0.043, upTo: 50_000 },
    { rate: 0.047, upTo: 100_000 },
    { rate: 0.049, upTo: 315_000 },
    { rate: 0.059, upTo: Infinity },
  ];
  // § 7-2-7(A): married individuals filing separate returns.
  const separate: readonly Bracket[] = [
    { rate: 0.015, upTo: 4_000 },
    { rate: 0.032, upTo: 12_500 },
    { rate: 0.043, upTo: 25_000 },
    { rate: 0.047, upTo: 50_000 },
    { rate: 0.049, upTo: 157_500 },
    { rate: 0.059, upTo: Infinity },
  ];
  return byStatusOf<readonly Bracket[]>({
    single,
    joint,
    separate,
    headOfHousehold: joint,
    qualifyingSurvivingSpouse: joint,
  });
}

/**
 * TABLE 1 of page ADJ-5 — one `$1,000` step of exemption per step of AGI.
 *
 * Three distinct tables serve the five statuses: head of household and surviving
 * spouse read the joint one, which is the same grouping § 7-2-7 uses for the
 * rate schedule. Every threshold and every amount is the 1987 figure.
 */
function agedOrBlindSteps(): ByStatus<readonly CreditStep[]> {
  const table = (first: number, step: number): readonly CreditStep[] => [
    { upTo: first, amount: 8_000 },
    { upTo: first + step, amount: 7_000 },
    { upTo: first + 2 * step, amount: 6_000 },
    { upTo: first + 3 * step, amount: 5_000 },
    { upTo: first + 4 * step, amount: 4_000 },
    { upTo: first + 5 * step, amount: 3_000 },
    { upTo: first + 6 * step, amount: 2_000 },
    { upTo: first + 7 * step, amount: 1_000 },
    { upTo: Infinity, amount: 0 },
  ];
  // Single: $8,000 to $18,000, then a step every $1,500, nothing from $28,500.
  const single = table(18_000, 1_500);
  // Joint, head of household and surviving spouse: $8,000 to $30,000, then a
  // step every $3,000, nothing from $51,000.
  const joint = table(30_000, 3_000);
  // Married filing separately: $8,000 to $15,000, then every $1,500, nothing
  // from $25,500 — which is NOT half the joint table, unlike the rate schedule.
  const separate = table(15_000, 1_500);
  return byStatusOf<readonly CreditStep[]>({
    single,
    joint,
    separate,
    headOfHousehold: joint,
    qualifyingSurvivingSpouse: joint,
  });
}

export function newMexico(year: number): StateIncomeTaxDefinition | undefined {
  if (year !== 2025 && year !== 2026) return undefined;
  return {
    code: 'NM',
    name: 'New Mexico',
    year,
    // Both years carry the same published figures and the sameness is the
    // statute rather than a carry-forward: HB 252 of 2024 wrote the rate
    // schedules for taxable years beginning on or after 1 January 2025 with no
    // cost-of-living provision, and § 7-2-5.2, § 7-2-5.8, § 7-2-5.14, § 7-2-34
    // and § 7-2-39 are all flat amounts with no indexing clause. The ONE indexed
    // figure in the New Mexico income tax is the child income tax credit of
    // § 7-2-18.34, which this module does not model — see the notes.
    status: 'published',
    // PIT-1 line 9 is federal adjusted gross income, so all four OBBBA
    // Schedule 1-A deductions sit below the New Mexico base.
    base: 'federalAdjustedGrossIncome',
    // ROLLING, AND `belowTheLine` BECAUSE THE DEDUCTION IS THE WHOLE OF WHAT
    // NEW MEXICO BORROWS FROM BELOW FEDERAL AGI. The base is federal AGI and
    // the state adds nothing back, so what the Code's date decides here is the
    // figure on PIT-1 line 12 — which is Iowa's declaration for Iowa's reason,
    // and the one Arizona was wrong to carry after HB 4168 gave Arizona a table
    // of its own.
    federalConformity: {
      kind: 'rolling',
      governs: 'belowTheLine',
      cite:
        'NMSA 1978 § 7-2-2(N) defines New Mexico "net income" by reference to the Internal ' +
        'Revenue Code with no date, which makes New Mexico a rolling-conformity state: a ' +
        'federal amendment reaches a New Mexico return in the year it takes federal effect and ' +
        'without a New Mexico act. Paragraph (N)(1) conforms to the federal STANDARD deduction ' +
        'and (N)(2) to federal ITEMIZED deductions, which is what PIT-1 line 12 reads. So the ' +
        'One Big Beautiful Bill Act of 4 July 2025 raised the New Mexico deduction for tax year ' +
        '2025 itself — $15,750 single against the $15,000 of the pre-Act schedule, $16,100 for ' +
        '2026 — with no New Mexico legislation at all. SB 151, signed 11 March 2026, DECOUPLED ' +
        'New Mexico from parts of the same Act, and every provision it reached is a business ' +
        'one: § 168(k) and § 168(n) bonus depreciation, the § 163(j) interest limitation and ' +
        'federal net CFC tested income in the corporate base, from 1 January 2027. It leaves ' +
        'the personal income tax conformity untouched, which is why the deduction above is ' +
        'still the federal one for both years here.',
      primaryTextUnread:
        'nmonesource.com, nmlegis.gov, law.justia.com, tax.newmexico.gov and ' +
        'realfile.tax.newmexico.gov all fail to resolve from this sandbox, by curl and by ' +
        'WebFetch alike. Rolling status and the (N)(1)/(N)(2) paragraph split come from a ' +
        'Legislative Finance Committee handout of 31 July 2025 on the Act\'s state tax impacts, ' +
        'read through server-side search, corroborated by two independent conformity surveys ' +
        'that classify New Mexico as rolling for both the personal and the corporate tax. The ' +
        'two surveys disagree about which SUBSECTION carries the definition — one says ' +
        '§ 7-2-2(J) and the handout says § 7-2-2(N) — so the paragraph letters above are the ' +
        "handout's and are the weaker half of this citation.",
    },
    // § 7-2-5.14, and the limit below is a CLIFF rather than a taper.
    subtractsTaxableSocialSecurity: true,
    taxableSocialSecurityLimit: {
      atOrBelow: byStatus({
        single: 100_000,
        joint: 150_000,
        separate: 75_000,
        headOfHousehold: 150_000,
      }),
      cite:
        'NMSA 1978 § 7-2-5.14 allows the exemption of the amount included in adjusted gross ' +
        'income under IRC § 86 where federal AGI "does not exceed" $100,000 for a single filer, ' +
        '$150,000 for a joint, head-of-household or surviving-spouse return, and $75,000 for a ' +
        'married individual filing separately. THERE IS NO TAPER: one dollar above the figure ' +
        'makes the WHOLE federally taxable benefit New Mexico income — $2,855.65 of tax on a ' +
        'couple with $60,000 of taxable benefit at $150,001 of AGI, $3,961.85 with $85,000 of ' +
        'benefit, $1,914.85 on a single filer with $40,000 at $100,001, every one measured and ' +
        'not benefit times rate, which overstates the first by $84.35 because $60,000 straddles ' +
        'two bands. The boundary is ' +
        'inclusive, so a filer exactly at the figure keeps all of it. THE FIGURES ARE NOT ' +
        'INDEXED: HB 249 of 2024 would have indexed all three from tax year 2025 and was ' +
        'postponed indefinitely on 6 February 2024, the 2025 PIT-ADJ Table 2 prints the ' +
        'unindexed amounts, and policyengine-us 2.87.0 carries them from 2022-01-01 with no ' +
        'later value. At least one published 2026 guide asserts the indexing passed.',
    },
    rate: { kind: 'brackets', byStatus: newMexicoBrackets() },
    // PIT-1 line 12: the federal standard or itemized deduction, from Form 1040
    // line 12. New Mexico legislates no deduction of its own and no personal
    // exemption, so the OBBBA increase and the § 63(f) age and blindness
    // additions both reach a New Mexico return — Missouri's answer, not
    // Arizona's, and for the same reason: line 12 is the figure the filer
    // actually took rather than a flat table the state publishes.
    deduction: { kind: 'federal' },
    // § 7-2-39. The `notCounted: 1` is the finding.
    dependentDeduction: {
      amount: byStatus({
        single: 0,
        joint: 4_000,
        separate: 0,
        headOfHousehold: 4_000,
        // § 7-2-39 names a return filed "as a head of household or married
        // filing jointly" and no other status. New Mexico's PIT-1 has a
        // surviving-spouse box of its own and § 7-2-7 sends her to the joint
        // RATE schedule, so this cell is the literal reading of a provision
        // that could have named her and did not. It is written out rather than
        // left to `byStatus`'s joint default BECAUSE it differs from it: a
        // widow with two children loses $4,000 of deduction here, $188.00 of
        // tax on $90,000 of AGI, and the notes price the other reading.
        qualifyingSurvivingSpouse: 0,
      }),
      notCounted: 1,
      cite:
        'NMSA 1978 § 7-2-39 allows $4,000 of deduction from net income FOR EACH DEPENDENT IN ' +
        'EXCESS OF ONE, to a taxpayer who is not a dependent of another individual and who ' +
        'files a return as a head of household or married filing jointly, from tax year 2019 ' +
        'and while the federal exemption amount under IRC § 151 is zero. A family with one ' +
        'child gets NOTHING and a family with four gets $12,000. Three independent records of ' +
        'the "in excess of one" reached this sandbox: the Legislative Finance Committee\'s May ' +
        '2019 post-session report, which describes HB 6 as creating "a $4,000 income tax ' +
        'deduction for each dependent after the first"; the Taxation and Revenue Department\'s ' +
        '2019 and 2020 Tax Expenditure Report presentation, "$4,000 per dependent beyond the ' +
        'first dependent claimed"; and the Senate Finance Committee analysis of the SB 300 ' +
        'amendment, "a $4,000 deduction for one less than the number of dependents claimed". ' +
        'policyengine-us 2.87.0 implements the same subtraction of one. THE WORKSHEET ITSELF ' +
        'WAS NOT OPENED: the 2025 PIT-1 instructions carry a "Worksheet for Calculating ' +
        'Deduction for Certain Dependents" whose subtraction step search could not read.',
    },
    // § 7-2-5.8 — $2,500 per federal exemption, tapered, and its income limit is
    // exactly where its own taper ends.
    lowAndMiddleIncomeExemption: {
      maxPerExemption: 2_500,
      reductionStart: byStatus({
        single: 20_000,
        joint: 30_000,
        separate: 15_000,
        headOfHousehold: 30_000,
      }),
      reductionRate: byStatus({
        single: 0.15,
        joint: 0.1,
        separate: 0.2,
        headOfHousehold: 0.1,
      }),
      incomeLimit: byStatus({
        single: 36_667,
        joint: 55_000,
        separate: 27_500,
        headOfHousehold: 55_000,
      }),
      cite:
        'NMSA 1978 § 7-2-5.8 allows up to $2,500 MULTIPLIED BY THE NUMBER OF FEDERAL ' +
        'EXEMPTIONS — filers plus dependents, so a joint return with two children claims four ' +
        'and $10,000 — reduced by 10% of federal AGI above $30,000 for a joint, ' +
        'head-of-household or surviving-spouse return, 15% above $20,000 single and 20% above ' +
        '$15,000 separate, and allowed only where federal AGI does not exceed $55,000, ' +
        '$36,667 or $27,500. EACH PRINTED LIMIT IS EXACTLY WHERE ITS OWN TAPER REACHES ZERO: ' +
        '30,000 + 2,500/0.10 = 55,000.00, 20,000 + 2,500/0.15 = 36,666.67 against a printed ' +
        '36,667, and 15,000 + 2,500/0.20 = 27,500.00. So the limit can zero a positive ' +
        'exemption in no household at any income, and test/new-mexico.test.js asserts the ' +
        'three identities rather than trusting them. The exemption is clamped at zero here; ' +
        'the independent reference model does not clamp it, so between $36,666.67 and $36,667 ' +
        'of single AGI that model allows a NEGATIVE exemption of up to five cents a head.',
    },
    // § 7-2-5.2 — nine steps per status, 1987 thresholds, and the age half only.
    agedOrBlindExemptionSteps: {
      steps: agedOrBlindSteps(),
      age: 65,
      cite:
        'NMSA 1978 § 7-2-5.2 exempts up to $8,000 of the income of each person "sixty-five ' +
        'years of age or older or blind", falling in whole $1,000 steps as federal AGI rises ' +
        'and reaching zero at $28,500 single, $51,000 joint and head of household, $25,500 ' +
        'married filing separately. THE TWO CONDITIONS ARE ALTERNATIVES: a New Mexican who is ' +
        'both 65 and blind qualifies ONCE, which is the opposite of federal § 63(f) and of ' +
        'every state addition in this package modelled on it — Kansas gives a filer who is ' +
        'both two Worksheet I boxes at $850. A STEP IS NOT A TAPER, so one dollar of AGI at a ' +
        'boundary costs the whole $1,000 of allowance — AND MOST OF THE STEPS ARE STILL FREE: ' +
        'measured for 2026, four of the eight single boundaries cost nothing at all and the ' +
        'other four cost $14.27, $15.01, $30.34 and $32.04, because the exemption expires at ' +
        '$28,500 of AGI and a single New Mexican there has about $7,400 of taxable income, ' +
        'inside the 3.2% band. The largest step in the state is $64.04, at the joint $51,000 ' +
        "boundary where BOTH people's exemptions fall on the same dollar. ONLY THE AGE HALF IS " +
        'COMPUTED HERE — the sole input carrying blindness is `blindOrDisabled`, which is New ' +
        "Jersey's and counts a filer blind OR PERMANENTLY DISABLED, and § 7-2-5.2 reaches " +
        'blindness alone. THE 1987 DATE IS THE REFERENCE MODEL\'S: policyengine-us carries ' +
        'every threshold and amount in all five of its tables from 1987-01-01 with no later ' +
        'value, which is that package asserting thirty-nine unindexed years and is the only ' +
        'evidence for the date available from this sandbox.',
    },
    // § 7-2-34 as amended by HB 252 of 2024, from tax year 2025: the flat
    // element only, because the 40% element now reaches just the gain from the
    // sale of a New Mexico business and no field here carries that fact.
    // `share: 1` with `cap: 2_500` is min(net capital gain, $2,500).
    capitalGainsSubtraction: {
      name: 'New Mexico net capital gains deduction (§ 7-2-34)',
      share: 1,
      // IRC § 1222(11) by § 7-2-34's own definition — net long-term capital
      // gain less net short-term capital LOSS. So a short-term gain cannot
      // create a deduction and a short-term loss eats one, which is exactly
      // Wisconsin's basis and not Arizona's.
      basis: { kind: 'longTermNetted' },
      cap: 2_500,
      cite:
        'NMSA 1978 § 7-2-34 as amended by HB 252 of 2024 section 8, effective for tax years ' +
        'beginning in 2025: the greater of $2,500 or 40% of the net capital gain from the sale ' +
        'of a NEW MEXICO BUSINESS. Through tax year 2024 the 40% element reached any net ' +
        'capital gain and the flat element was $1,000, so what the 2024 act did was raise the ' +
        'floor by $1,500 and withdraw the percentage from everybody who did not sell a ' +
        'business. The business-sale element is NOT MODELLED — no field here records what was ' +
        'sold or where — so a New Mexico answer computed here is TOO HIGH for such a seller by ' +
        'up to 40% of the gain less $2,500, and published accounts of this state are slow in ' +
        'the other direction: several still describe the 40% deduction as current for ' +
        'everybody, which overstates the deduction on a $200,000 gain by $77,500 and ' +
        'understates the tax by $4,011.50 — $11,010.60 against $6,999.10 for a single filer with a ' +
        '$200,000 long-term gain and $250,000 of AGI in 2026, measured. "Net capital gain" is ' +
        'IRC § 1222(11) by ' +
        'subsection (C), and subsection (B) gives each spouse filing separately one-half of ' +
        'the deduction the joint return would have had.',
    },
    // § 7-2-5.13 — $30,000 per retiree and per surviving spouse of one, with no
    // age test at all, which is why both caps are the same figure. The
    // exemption is scheduled to end after tax year 2026 and both years here are
    // inside the window; see the citations and the notes.
    militaryRetirementSubtraction: {
      name: 'New Mexico armed forces retirement pay exemption (§ 7-2-5.13)',
      // No age condition in the subsection, so the threshold is unreachable and
      // the two caps are deliberately equal: a New Mexico retiree of 42 and one
      // of 72 exempt the same $30,000.
      ageThreshold: 0,
      capUnderAge: 30_000,
      capAtOrAboveAge: 30_000,
    },
    // § 7-2-18.15 — 25% of the federal § 32 credit, refundable, raised from 20%
    // for tax year 2023. The base is this year's federal credit and not a frozen
    // Code, so a match is the whole of the rule.
    earnedIncomeCredit: {
      name: 'New Mexico working families tax credit (§ 7-2-18.15)',
      matchRate: 0.25,
      refundable: true,
    },
    notes: [
      "NEW MEXICO'S $4,000 DEPENDENT DEDUCTION PAYS NOTHING FOR AN ONLY CHILD, AND EVERY PUBLISHED ACCOUNT OF IT OVERSTATES IT BY EXACTLY $4,000 FOR EVERY FAMILY OF EVERY SIZE. NMSA 1978 § 7-2-39 allows the deduction \"for each dependent in excess of one\": one child is $0, two are $4,000, four are $12,000. A model that pays $4,000 a dependent understates New Mexico tax by $172.00 in the 4.3% band, $188.00 at 4.7%, $196.00 at 4.9% and $236.00 at 5.9%, at every family size — which is the Arkansas property, a single number a buyer can check against one household and then trust for all of them. The design is legible once the count is right: HB 6 of 2019 created the deduction to offset the federal personal exemption that the Tax Cuts and Jobs Act set to zero, and New Mexico's deduction IS the federal standard deduction, which that Act had nearly doubled. The first dependent is the one the larger standard deduction was taken to cover.",
      'A NEW MEXICO HEAD OF HOUSEHOLD IS TAXED ON THE MARRIED-COUPLE SCHEDULE, AND SO IS A SURVIVING SPOUSE. NMSA 1978 § 7-2-7 writes THREE schedules and not five: one for married individuals filing separately, one for single individuals, and one for married individuals filing joint returns, SURVIVING SPOUSES AND HEADS OF HOUSEHOLD. The Department\'s own rate table prints the joint column with the note that it "must also be used by surviving spouse" and gives head of household the same figures. A model that defaults a head of household to the single column overcharges by $202.00 at $66,500 of net taxable income, $269.00 from $100,000 to $210,000 and A FLAT $1,319.00 AT EVERY NET TAXABLE INCOME ABOVE $315,000 — the jump being the single column\'s 5.9% band opening $105,000 earlier than the joint one. The separate schedule is exactly half the joint one at every threshold, which test/new-mexico.test.js asserts.',
      "NEW MEXICO'S SOCIAL SECURITY EXEMPTION IS A CLIFF AND IT IS IN FORCE. § 7-2-5.14 exempts the whole federally taxable benefit where federal AGI does not exceed $100,000 single, $150,000 joint, head of household or surviving spouse, or $75,000 married filing separately — with NO taper. A couple with $60,000 of federally taxable benefit pays nothing on it at $150,000 of AGI and $2,855.65 at $150,001; with $85,000 of benefit it is $3,961.85, and a single filer with $40,000 of benefit pays $1,914.85 for one dollar above $100,000. It is the largest LIVE discontinuity this package carries on a Social Security threshold, and test/new-mexico.test.js measures that over every state here rather than asserting it: Kansas charged $2,845.80 on the same shape at $75,000 and repealed it for tax year 2024, and Connecticut's surviving threshold is $405 for a couple with $40,000 of benefits. It is not the largest discontinuity in this package — Maryland's capital-gains surtax tests federal AGI against $350,000 rather than taking an excess, and one dollar there can cost $6,933.08.",
      'THE THREE SOCIAL SECURITY THRESHOLDS ARE NOT INDEXED, ALTHOUGH A PUBLISHED 2026 GUIDE SAYS THEY ARE. HB 249 of the 2024 regular session would have adjusted all three for inflation from tax year 2025; it was POSTPONED INDEFINITELY ON 6 FEBRUARY 2024 and never became law. The 2025 PIT-ADJ instructions print the unindexed figures in their Table 2, and policyengine-us 2.87.0 carries all three from 2022-01-01 with no later value. A guide reaching this sandbox states the opposite — that HB 249 amended § 7-2-5.14 so that the base amounts are adjusted for inflation and rounded down to the nearest $100 — and on a cliff that is not a rounding difference: it moves the point at which an entire benefit becomes taxable, so a couple between $150,000 and an indexed figure is told they owe nothing on a benefit New Mexico taxes in full. This is the second consecutive state added here to carry an indexing clause that exists only in a bill or a fiscal note: Kansas\'s SB 1 as introduced would have indexed the standard deduction from 2025 and the enacted act does not.',
      "THE LOW- AND MIDDLE-INCOME EXEMPTION IS $2,500 PER EXEMPTION AND NOT $2,500 A RETURN. § 7-2-5.8 multiplies the figure by the number of federal exemptions — filers plus dependents — so a joint return with two children claims four of them and $10,000 of exemption before the taper, which at 4.3% is $430.00 of tax. The taper is 10% of federal AGI above $30,000 joint, head of household and surviving spouse, 15% above $20,000 single, 20% above $15,000 separate. A SURVIVING SPOUSE COUNTS AS ONE EXEMPTION AND NOT TWO here, because § 151 allowed a qualifying widow(er) one personal exemption: the spouse is dead. That distinction doubled five states' allowances for a widow before v0.24.0 and this is the first new rule since to need it.",
      "THE INCOME LIMIT ON THE LOW- AND MIDDLE-INCOME EXEMPTION CANNOT CHANGE ANYBODY'S TAX, WHICH IS WHY test/new-mexico.test.js ASSERTS IT RATHER THAN RELYING ON IT. The statute prints a limit of $55,000 joint, $36,667 single and $27,500 separate, and each is exactly where its own taper reaches zero: 30,000 + 2,500/0.10 = 55,000.00, 20,000 + 2,500/0.15 = 36,666.67, 15,000 + 2,500/0.20 = 27,500.00. So the limit can zero a positive exemption in no household, in any status, at any income. THE SINGLE ROW IS A THIRD OF A DOLLAR WIDE AND THE INDEPENDENT REFERENCE MODEL FALLS INTO IT: this package clamps the per-exemption amount at zero and that model does not, so for single AGI between $36,666.67 and $36,667 it computes 2,500 - 0.15 x 16,667 = -$0.05 an exemption and ADDS it to taxable income. Five cents on a four-person return, recorded for the shape and not the amount — a clamp omitted where two published figures were believed to coincide exactly.",
      "THE AGED-OR-BLIND EXEMPTION HAS NOT BEEN INDEXED SINCE 1987 AND IT IS NINE CLIFFS, NOT A TAPER. § 7-2-5.2 gives up to $8,000 to each person 65 or over or blind, falling in whole $1,000 steps: single $8,000 to $18,000 of AGI then a step every $1,500 and nothing from $28,500; joint and head of household $8,000 to $30,000 then every $3,000 and nothing from $51,000; separate $8,000 to $15,000 then every $1,500 and nothing from $25,500. One dollar of AGI at a boundary costs the whole $1,000 of allowance AND MOST OF THE STEPS ARE STILL FREE: measured for 2026, four of the eight single boundaries cost nothing and the other four cost $14.27, $15.01, $30.34 and $32.04, because the exemption expires at $28,500 of AGI and a single New Mexican there has about $7,400 of taxable income — inside the 3.2% band, so nobody who reaches 4.3% still holds the exemption. The largest step in the state is $64.04, at the joint $51,000 boundary, where both people's exemptions fall on the same dollar. Pricing these steps at the state's top rates is the mistake the first draft of this module made, and the measurement is what caught it. The thresholds are the 1987 figures on the reference model's parameter files, which carry every one of them from 1987-01-01 with no later value; the separate table is NOT half the joint one, unlike the rate schedule.",
      "AGED AND BLIND DO NOT STACK ON ONE PERSON IN NEW MEXICO, WHICH IS THE OPPOSITE OF FEDERAL § 63(f). § 7-2-5.2 reaches a person \"sixty-five years of age or older OR blind\", so a single New Mexican who is both gets $8,000 once and not twice. Kansas's Worksheet I gives such a filer two boxes at $850 each, the federal standard deduction gives two additions of $2,050, and every state addition in this package modelled on § 63(f) stacks them. New Mexico is the first state here where the two conditions are alternatives.",
      "ONLY THE AGE HALF OF THE AGED-OR-BLIND EXEMPTION IS COMPUTED HERE, AND A BLIND NEW MEXICAN UNDER 65 IS CHARGED TOO MUCH BY UP TO $8,000 OF EXEMPTION, and the cost is bounded by the income at which the exemption survives rather than by the state's top rate: a single filer still holding the whole $8,000 has AGI of $18,000 or less, where the federal deduction has already taken the tax to zero, so the omission is worth nothing at all for most of the band it covers and at most a few tens of dollars anywhere in it. That is the same measurement that priced the staircase above, applied to an omission. The obstacle is the input and not the statute: the one field in this package that carries blindness is `blindOrDisabled`, which is New Jersey's and counts a filer who is \"blind or permanently disabled\", where § 7-2-5.2 reaches blindness alone and the field does not say which person on a joint return is which. Reading it would grant the exemption to a disabled New Mexican the subsection does not reach, so it is not read — the same decision, for the same reason, as Kansas's disabled-veteran exemption. Supply it through `subtractions` as the table amount for the status and AGI.",
      "NEW MEXICO'S DEDUCTION IS THE FEDERAL ONE, SO THE ONE BIG BEAUTIFUL BILL ACT CUT NEW MEXICO TAX WITH NO NEW MEXICO LEGISLATION. PIT-1 line 12 is \"Federal standard or itemized deduction amount (from federal Form 1040, line 12)\" and the state legislates no deduction of its own and no personal exemption at all. A single New Mexican's deduction was $15,000 under the pre-Act schedule and is $15,750 for 2025 and $16,100 for 2026; a joint return's is $32,200 for 2026. At 4.9% the 2026 increase alone is worth $53.90 single and $107.80 joint against the figures a model built before July 2025 carries. AND THE § 63(f) ADDITION FOR AGE AND BLINDNESS REACHES A NEW MEXICO RETURN TOO, because line 12 is the deduction the filer ACTUALLY TOOK: $2,050 for a single filer 65 or over in 2026, $1,650 each on a joint return. That is Missouri's answer and not Arizona's — Arizona's statute sets its deduction equal to the federal standard AMOUNT in a flat table, so the addition does not reach an Arizona return, and this package was wrong about Arizona for 47 days for exactly that reason. A NEW MEXICO RETIREE THEREFORE COLLECTS AN AGE ALLOWANCE TWICE, once inside line 12 and again under § 7-2-5.2, which is a fact about two provisions rather than a double-count here.",
      'NEW MEXICO TAXES TIPS AND OVERTIME THAT THE FEDERAL GOVERNMENT NOW EXEMPTS. PIT-1 line 9 is federal adjusted gross income and all four OBBBA Schedule 1-A deductions — § 224 tips, § 225 overtime, § 151(d)(5) senior and § 163(h)(4) vehicle loan interest — sit BELOW it, so none of them reaches the New Mexico base and New Mexico has legislated no subtraction of its own for any of them. A tipped New Mexico worker with $8,000 of qualified tips and $50,000 of AGI pays $345.60 of state tax on income the federal return exempted entirely — measured, because the $8,000 straddles the 4.3% and 4.7% bands — rising to $472.00 where the dollars fall wholly in the 5.9% band. The senior deduction is the sharpest of the four here, because New Mexico already has two age allowances of its own and this third one does not arrive.',
      "THE 40% CAPITAL GAINS DEDUCTION IS GONE FOR EVERYBODY WHO DID NOT SELL A NEW MEXICO BUSINESS. § 7-2-34 allowed the greater of $1,000 or 40% of net capital gain through tax year 2024; HB 252 of 2024 restricted the 40% element to the gain from the sale of a New Mexico business and raised the flat element to $2,500, from tax year 2025. So the deduction an ordinary filer gets is min(net capital gain, $2,500), worth $122.50 at 4.9%, against $9,800 on a $200,000 gain under the repealed percentage. Several published accounts of this state still describe the 40% deduction as current for everybody, which understates the tax on that gain by $4,011.50: a single New Mexican with a $200,000 long-term gain and $250,000 of AGI owes $11,010.60 for 2026 and $6,999.10 under the repealed 40%, because the $77,500 of difference comes out of the 5.9% and 4.9% bands. THE BUSINESS-SALE ELEMENT IS NOT MODELLED — no field here records what was sold or where — so a New Mexico answer computed here is too HIGH for such a seller.",
      "NOT MODELLED — THE CHILD INCOME TAX CREDIT, WHICH IS THE LARGEST OMISSION IN THIS STATE AND THE ONLY INDEXED FIGURE IN THE NEW MEXICO INCOME TAX. § 7-2-18.34 gives a REFUNDABLE per-child credit banded on adjusted gross income: $637 a child up to $25,000 of AGI for 2025, then $424, $212, $106, $79, $53 and $26 at $25,000, $50,000, $75,001, $100,000, $200,000 and $350,000, halved on a married-filing-separate return, with the amounts adjusted for inflation annually under subsection (D) and the qualifying child defined by IRC § 152(c) WITHOUT the federal earned income credit's identification-number requirement — so a child with an ITIN counts. A New Mexico family of two children on $40,000 of AGI is computed here $424.00 too HIGH for 2025, and the shape does not fit any credit rule in this package: the bands are read against AGI rather than taxable income, the age test is § 152(c)'s rather than a single maximum, and the separate column is halved. Supply it yourself; nothing in this package can accept one.",
      "NOT MODELLED — THE LOW INCOME COMPREHENSIVE TAX REBATE of § 7-2-14, which is refundable and reaches further down the income distribution than anything else in the state. It is a table of about 120 indexed amounts — six columns by number of exemptions, twenty income steps each, every cell adjusted annually — and no 2026 figures for it are available from this sandbox. A low-income New Mexico return computed here is therefore too HIGH by up to roughly $252 for a one-exemption household and more for a larger one. Two further refundable items are also absent: the child day care credit of § 7-2-18.1, which needs a figure no input here carries, and the property tax rebate for a filer 65 or over, which needs property tax paid and a county.",
      "A SURVIVING SPOUSE GETS THE JOINT RATE SCHEDULE AND NO DEPENDENT DEDUCTION, AND THE SECOND HALF IS THE CONTESTABLE READING. New Mexico's PIT-1 carries five filing-status boxes including \"Surviving Spouse with dependent child\"; § 7-2-7 sends her to the married-filing-jointly schedule by name; and § 7-2-39 allows its $4,000 to a return filed \"as a head of household or married filing jointly\" and names no other status. This package takes the literal reading, which is also the independent reference model's, and the cost of being wrong is $4,000 of deduction on a widow with two children: $188.00 of tax on $90,000 of AGI, measured, and $172.00 to $236.00 elsewhere depending on the band the deduction comes out of. The reading that cannot be settled from this sandbox is whether a New Mexico surviving spouse \"files a return as ... married filing jointly\" for the purposes of § 7-2-39 when the state gives her a box of her own; the 2025 PIT-1 instructions group the three statuses together in several other places, which is the best argument for the other side. If the other reading is right, add $4,000 per dependent after the first through `subtractions` for a widow.",
      'THE ARMED FORCES RETIREMENT PAY EXEMPTION IS SCHEDULED TO END AFTER TAX YEAR 2026, AND THE INDEPENDENT REFERENCE MODEL DOES NOT KNOW IT. § 7-2-5.13 exempts $30,000 per military retiree and per surviving spouse of one, with no age test, no income test and no cap beyond the figure — $10,000 for 2022, $20,000 for 2023, $30,000 from 2024 — and the enacted provision runs through tax year 2026 only. SB 56 and SB 125 of 2024 would have removed the sunset and HB 221 of 2026 would have made the exemption total; none is recorded here as enacted. BOTH YEARS THIS MODULE COVERS ARE INSIDE THE WINDOW, so the sunset changes no answer here, and it is written down because it changes one in 2027: policyengine-us 2.87.0 carries the $30,000 from 2024-01-01 with no end date and so exempts the pay indefinitely, which would understate a 2027 New Mexico return by up to $1,770.00 at 5.9%.',
      'NEW MEXICO ITEMIZED DEDUCTIONS ARE NOT READ HERE, AND THE ELECTION IS LOCKED TO THE FEDERAL ONE. PIT-1 line 12 takes whichever figure the filer used federally, so a New Mexico filer who itemized federally must itemize in New Mexico — the trap Oklahoma sets, and the opposite of Kansas, which lets a filer choose whichever is better. `stateItemizedDeductions` is ignored for New Mexico and an itemiser is computed on the figure passed in `federal.deduction`, which is the right answer when that field carries the deduction actually taken. New Mexico also adds back the part of the federal state-and-local tax deduction attributable to its own income tax for an itemiser, which is not modelled: an itemising New Mexico return computed here is too LOW by that amount.',
      'NO CITY, COUNTY OR SCHOOL DISTRICT IN NEW MEXICO LEVIES AN INCOME TAX. The state figure is the whole of a New Mexico resident\'s income tax, so `locality` is never required and `SUPPORTED_LOCALITIES` names none here.',
      "NOT MODELLED, AND EACH WOULD REDUCE A NEW MEXICO RETURN COMPUTED HERE: the $2,500 exemption under § 7-2-5.7 for a person ONE HUNDRED YEARS OF AGE OR OLDER, which exempts all of their income and which this package has no household shape to reach usefully; the unreimbursed medical care expense exemption and credit of § 7-2-5.11 and § 7-2-18.30, each needing a medical expense figure no input carries; the New Mexico 529 contribution deduction; the credit for taxes paid to another state; and the medical care expense DEDUCTION of § 7-2-37, whose three rates were reduced to ZERO from tax year 2025 and so is correctly absent from both years here rather than omitted.",
    ],
    citations: NM_CITATIONS,
  };
}
