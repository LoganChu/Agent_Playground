/**
 * The households where everything else is wrong — computed, not transcribed.
 *
 * ## Why this file exists
 *
 * `STRATEGY.md` has claimed, five times over six states, that a buyer can check
 * one of this project's findings against their own system **in five minutes**.
 * For sixty-six days there was nowhere to spend those five minutes. The findings
 * live in a 1.6MB journal, a 300KB strategy file and sixteen `notes` arrays, and
 * every instrument in the repository — the differential grid, the mutation audit,
 * the provenance ledger — makes claims checkable by the maintainer and by nobody
 * else.
 *
 * > **A CHECKABLE CLAIM THAT CANNOT BE RUN IS A CLAIM NOBODY CHECKS.**
 *
 * ## The rule this file is built on, which is what makes it not another document
 *
 * **BOTH SIDES OF EVERY ROW ARE ENGINE CALLS.** The right answer is the engine on
 * the household. The wrong answer is the engine on the SAME household with one
 * stated thing changed — a filing status read off the wrong column, an income put
 * in the wrong field, a year swapped — so "what a wrong model gives" is produced
 * rather than remembered.
 *
 * Nothing here is a hard-coded dollar figure, and that is the whole design. A
 * transcribed table of findings is a fifth copy of the journal and goes stale the
 * first time a parameter moves; a table that recomputes cannot. `test/checks.test.js`
 * asserts every row's arithmetic and its SIGN, and the sign is the half that
 * matters: a finding whose direction flips is a different finding.
 *
 * ## What may go in here, and what may not
 *
 * A row belongs here only if the wrong answer is reachable by changing an INPUT.
 * That rules out three of this project's best findings and the exclusion is
 * deliberate rather than a backlog:
 *
 *  - **Arkansas's flat `$287.30`** needs a model built from the published bracket
 *    table alone, which this engine deliberately is not. What IS reachable is the
 *    13.70% marginal rate in a band no Arkansas rate table contains, measured the
 *    only way it can be — the tax at two incomes `$100` apart — so that is the row.
 *  - **Oklahoma's frozen earned income credit** needs the federal credit under
 *    31 December 2020 law, which no field in either package carries. It is the
 *    reason Oklahoma ships no credit rule at all.
 *  - **Kansas's stillbirth exemption** needs a fact no tax return records.
 *
 * Each of those is in the state's `notes` with the figure. **A page of findings
 * that quietly dropped the ones it cannot compute would be the more flattering
 * page and the less honest one**, so the three are named here and the reason is
 * the reason, not the room.
 *
 * ## `kind`, and why half the rows are not errors
 *
 * **A row is `error` where the second figure is WRONG** — a widow read against the
 * joint column, a published top rate that is not the rate paid, a New York return
 * with the city left off. **It is `comparison` where both figures are right and
 * the gap is the finding**: the same `$50,000` of pension taxed at `$0` or at
 * `$1,942.88` depending on which government paid it, the same dollars in a 401(k)
 * or in an IRA, the same Iowa law one year apart.
 *
 * Calling the second kind an error would be the easy way to make the page look
 * sharper and it would be a lie about the law. The two kinds are labelled
 * differently and `test/checks.test.js` asserts that both labels are in use, so a
 * future edit cannot quietly reclassify a comparison as a defect.
 */
import {
  getStateDefinition,
  stateIncomeTax,
  stateName,
} from '../vendor/us-state-tax/index.js';

/** A federal basis with nothing in it but the figure a state return reads. */
const federal = (adjustedGrossIncome, extra = {}) => ({
  adjustedGrossIncome,
  taxableIncome: adjustedGrossIncome,
  deduction: 0,
  deductionKind: 'standard',
  ...extra,
});

const tax = (input) => stateIncomeTax(input).totalTax;
const marginal = (input) => stateIncomeTax(input).totalMarginalRate;

/**
 * One check. `ours` and `theirs` are both functions so that the page and the
 * test run the same arithmetic rather than two copies of it.
 */
const CHECKS = [
  {
    id: 'nm-second-child',
    oursLabel: 'A New Mexico family with two children',
    kind: 'comparison',
    state: 'NM',
    year: 2026,
    headline: 'New Mexico’s $4,000 dependent deduction pays nothing for an only child',
    household: 'A married couple filing jointly, $90,000 of federal AGI, two children',
    wrongLabel: 'The same couple with ONE child',
    says:
      'NMSA 1978 § 7-2-39 allows $4,000 of deduction “for each dependent IN EXCESS OF ONE”. ' +
      'So the first child is worth nothing at all, the second is worth $4,000, and the fourth ' +
      'is worth $12,000 in total. Every published account of the provision describes it as ' +
      '$4,000 a dependent, which overstates the deduction by exactly $4,000 at EVERY family ' +
      'size — a one-child family by the whole of it. The two figures here are the same ' +
      'household with one child added, so the gap IS the second child’s deduction: a ' +
      'per-dependent model would show the same gap between zero children and one, and New ' +
      'Mexico shows none. Check your own system by computing a New Mexico family with one ' +
      'child and then with two; if the step between them is not $4,000 of deduction, or if ' +
      'there is a step between none and one, the deduction is modelled per dependent. The ' +
      'design is legible once the count is right: HB 6 of 2019 created the deduction to ' +
      'offset the federal personal exemption the Tax Cuts and Jobs Act had zeroed, and New ' +
      'Mexico’s own deduction IS the federal standard deduction, which that Act had nearly ' +
      'doubled — so the first dependent is the one the larger deduction was taken to cover.',
    cite:
      'NMSA 1978 § 7-2-39; New Mexico Legislative Finance Committee, May 2019 post-session ' +
      'report (“a $4,000 income tax deduction for each dependent after the first”); ' +
      'Taxation and Revenue Department, 2019 and 2020 Tax Expenditure Report',
    ours: () =>
      tax({
        state: 'NM',
        year: 2026,
        filingStatus: 'marriedFilingJointly',
        federal: federal(90_000),
        dependents: 2,
        dependentAges: [8, 10],
        filerAge: 40,
        spouseAge: 40,
      }),
    theirs: () =>
      tax({
        state: 'NM',
        year: 2026,
        filingStatus: 'marriedFilingJointly',
        federal: federal(90_000),
        dependents: 1,
        dependentAges: [10],
        filerAge: 40,
        spouseAge: 40,
      }),
  },
  {
    id: 'nm-hoh-column',
    kind: 'error',
    state: 'NM',
    year: 2026,
    headline: 'A New Mexico head of household is taxed on the MARRIED-COUPLE schedule',
    household: 'A head of household with $400,000 of New Mexico net taxable income',
    wrongLabel: 'If you read the single column',
    says:
      'NMSA 1978 § 7-2-7 writes THREE rate schedules and not five: one for married individuals ' +
      'filing separately, one for single individuals, and one for married individuals filing ' +
      'joint returns, SURVIVING SPOUSES AND HEADS OF HOUSEHOLD together. The Department’s own ' +
      'rate table prints the joint column with the note that it “must also be used by ' +
      'surviving spouse”. The single column is the ordinary default for a state that ' +
      'publishes no head-of-household table, and it overcharges: $202.00 at $66,500 of net ' +
      'taxable income, $269.00 from $100,000 to $210,000, and A FLAT $1,319.00 AT EVERY ' +
      'INCOME ABOVE $315,000, forever, because the single column’s 5.9% band opens $105,000 ' +
      'earlier than the joint one. Both figures here are the same income read against two ' +
      'columns of the same statute. Check your own system at any head-of-household income ' +
      'above $315,000: if the answer is $1,319.00 high, it is reading the single schedule.',
    cite: 'NMSA 1978 § 7-2-7(B) and (C); New Mexico 2025 Tax Rate Table',
    ours: () =>
      tax({
        state: 'NM',
        year: 2026,
        filingStatus: 'headOfHousehold',
        federal: federal(400_000),
        dependents: 1,
        dependentAges: [10],
        filerAge: 40,
      }),
    theirs: () =>
      tax({
        state: 'NM',
        year: 2026,
        filingStatus: 'single',
        federal: federal(400_000),
        dependents: 1,
        dependentAges: [10],
        filerAge: 40,
      }),
  },
  {
    id: 'nm-social-security-cliff',
    oursLabel: 'At $150,000 of federal AGI',
    kind: 'comparison',
    state: 'NM',
    year: 2026,
    headline: 'One dollar of income costs a New Mexico couple $2,855.65 of tax',
    household:
      'A married couple both 70 with $60,000 of federally taxable Social Security benefit',
    wrongLabel: 'At $150,001 — one dollar more',
    says:
      'NMSA 1978 § 7-2-5.14 exempts the WHOLE federally taxable Social Security benefit where ' +
      'federal AGI “does not exceed” $150,000 on a joint return — $100,000 single, $75,000 ' +
      'married filing separately — and there is no taper. One dollar above the figure and ' +
      'every taxable dollar of the benefit is New Mexico income. Both numbers here are right, ' +
      'which is why this is a comparison and not an error: the finding is the gap. It is the ' +
      'largest live Social Security cliff this engine carries, measured over every state in ' +
      'it. Kansas charged $2,845.80 on the same shape and repealed it for tax year 2024; ' +
      'Connecticut’s surviving threshold is $405. AND THE THREE FIGURES ARE NOT INDEXED, ' +
      'although at least one published 2026 guide says they are: HB 249 of 2024 would have ' +
      'adjusted them for inflation from tax year 2025 and was postponed indefinitely on 6 ' +
      'February 2024. On a cliff that is not a rounding difference — it moves the point at ' +
      'which an entire benefit becomes taxable. Check your own system at $150,000 and ' +
      '$150,001 of joint AGI with a large benefit; if nothing happens, your thresholds are ' +
      'indexed and they should not be.',
    cite:
      'NMSA 1978 § 7-2-5.14; New Mexico 2025 PIT-ADJ instructions, Table 2; New Mexico HB 249 ' +
      '(2024 regular session), postponed indefinitely 6 February 2024',
    ours: () =>
      tax({
        state: 'NM',
        year: 2026,
        filingStatus: 'marriedFilingJointly',
        federal: federal(150_000),
        filerAge: 70,
        spouseAge: 70,
        taxableSocialSecurity: 60_000,
      }),
    theirs: () =>
      tax({
        state: 'NM',
        year: 2026,
        filingStatus: 'marriedFilingJointly',
        federal: federal(150_001),
        filerAge: 70,
        spouseAge: 70,
        taxableSocialSecurity: 60_000,
      }),
  },
  {
    id: 'ks-widow',
    kind: 'error',
    state: 'KS',
    year: 2026,
    headline: 'A Kansas widow is read against the head-of-household column',
    household: 'A qualifying surviving spouse with one dependent child, $60,000 of federal AGI',
    wrongLabel: 'If you default her to the married-couple column',
    says:
      'The K-40 has four filing-status boxes and no box for a widow. Kansas’s instruction ' +
      'is that a federal qualifying widow(er) with a dependent child checks the HEAD OF ' +
      'HOUSEHOLD box, because that box qualifies a filer who claimed head of household OR ' +
      'qualifying widow(er) federally. So she reads a $6,180 standard deduction, a $9,160 ' +
      'exemption plus the $2,320 head-of-household addition, and the 5.58% band opening at ' +
      '$23,000. The joint column is the near-universal default because her federal return ' +
      'looks like a joint one — and its 5.2% band runs to $46,000 and swallows her whole ' +
      'taxable income. The single column overstates her by $273.14, so the correct answer is ' +
      'BETWEEN the two a model would guess and no cautious choice of column reaches it.',
    cite: 'Kansas Form K-40 instructions, filing status; K.S.A. 79-32,119 and 79-32,121',
    ours: () =>
      tax({
        state: 'KS',
        year: 2026,
        filingStatus: 'qualifyingSurvivingSpouse',
        federal: federal(60_000),
        dependents: 1,
        dependentAges: [10],
        filerAge: 40,
      }),
    theirs: () =>
      tax({
        state: 'KS',
        year: 2026,
        filingStatus: 'marriedFilingJointly',
        federal: federal(60_000),
        dependents: 1,
        dependentAges: [10],
        filerAge: 40,
      }),
  },
  {
    id: 'ks-pension',
    oursLabel: 'A KPERS, federal civil service or military pension',
    kind: 'comparison',
    state: 'KS',
    year: 2026,
    headline: 'What a Kansas retirement costs depends on which government employed the retiree',
    household: 'A single Kansan of 67 with $50,000 of pension and nothing else',
    wrongLabel: 'The same $50,000 from a private plan or an IRA',
    says:
      'K.S.A. 79-32,117(c) subtracts in full, with no cap, no age test and no income test: ' +
      'KPERS and the Kansas police, firemen, judges and highway patrol systems; federal civil ' +
      'service retirement; and military retired pay. It subtracts NOTHING else — not a ' +
      'company pension, not a 401(k), not an IRA, at any age, below any ceiling. The federal ' +
      'half of that list is there because 4 U.S.C. § 111 requires it of a state that ' +
      'exempts its own retirees (Davis v. Michigan, 489 U.S. 803) and nothing requires parity ' +
      'with any other state’s — so an OUT-OF-STATE public pension is taxed in full, and a ' +
      'retired Missouri teacher in Wichita pays the figure on the right while her Kansan ' +
      'neighbour pays the one on the left. Put only Kansas and federal service in the ' +
      'retirement.filer.governmentPension field.',
    cite: 'K.S.A. 79-32,117(c) and the Department’s WebFile Schedule S Part A help',
    ours: () =>
      tax({
        state: 'KS',
        year: 2026,
        filingStatus: 'single',
        federal: federal(50_000),
        filerAge: 67,
        retirement: { filer: { governmentPension: 50_000 } },
      }),
    theirs: () =>
      tax({
        state: 'KS',
        year: 2026,
        filingStatus: 'single',
        federal: federal(50_000),
        filerAge: 67,
        retirement: { filer: { employerPlanPension: 50_000 } },
      }),
  },
  {
    id: 'ks-separate',
    oursLabel: 'The married separate filer',
    kind: 'comparison',
    state: 'KS',
    year: 2026,
    headline: 'A married Kansan filing separately has a LARGER standard deduction than a single one',
    household: 'A married Kansan filing separately on $50,000',
    wrongLabel: 'A single Kansan on the same $50,000',
    says:
      'Kansas’s standard deduction is $3,605 single, $4,120 married filing separately and ' +
      '$8,240 joint — so the joint figure is twice the SEPARATE one and the single filer sits ' +
      '$515 below that half. Kansas is the only state in this engine whose separate column ' +
      'differs from its single one at all. The consequence runs opposite to every marriage ' +
      'penalty: two single Kansans who marry GAIN $1,030 of deduction. The bracket thresholds ' +
      'and the personal exemption ARE exactly doubled; the deduction is more than doubled.',
    cite: 'K.S.A. 79-32,119(c) and the 2025 Form K-40 instructions, page 2',
    ours: () =>
      tax({
        state: 'KS',
        year: 2026,
        filingStatus: 'marriedFilingSeparately',
        federal: federal(50_000),
        filerAge: 40,
      }),
    theirs: () =>
      tax({ state: 'KS', year: 2026, filingStatus: 'single', federal: federal(50_000), filerAge: 40 }),
  },
  {
    id: 'ar-marginal',
    oursLabel: 'What one more dollar actually costs',
    kind: 'error',
    state: 'AR',
    year: 2026,
    headline: 'Arkansas charges 13.70% in a band that appears in no table of Arkansas tax rates',
    household:
      'A single Arkansan at $97,500 of income, and the same filer $100 richer. The band is on ' +
      'NET TAXABLE income, so the $2,470 standard deduction has to come off first — which is ' +
      'itself a thing to get wrong: at $95,000 of income the filer is not in the band at all.',
    wrongLabel: 'What the published rate schedule says the top rate is',
    says:
      'Arkansas’s top statutory rate is 3.7%. A.C.A. § 26-51-201 writes TWO schedules ' +
      'selected by income, and above $94,700 the second one applies to the whole of net income ' +
      'less a $290 bracket adjustment that falls by $10 for every further $100 earned. A $10 ' +
      'relief withdrawn per $100 of income is ten percentage points of marginal rate. The ' +
      'figure on the left is the tax at two incomes $100 apart, which is the only way to see ' +
      'it: nothing in any published Arkansas bracket table contains the number 13.7.',
    cite: 'A.C.A. § 26-51-201(a)(4) and (a)(5), and Act 1 of the 2026 First Extraordinary Session',
    unit: 'rate',
    ours: () => {
      const at = (agi) =>
        tax({ state: 'AR', year: 2026, filingStatus: 'single', federal: federal(agi), filerAge: 40 });
      return (at(97_600) - at(97_500)) / 100;
    },
    theirs: () => {
      const brackets = getStateDefinition('AR', 2026).rate.rows;
      return Math.max(...brackets.map((row) => row.rate));
    },
  },
  {
    id: 'md-rollover',
    oursLabel: 'The 401(k), inside the pension exclusion',
    kind: 'comparison',
    state: 'MD',
    year: 2026,
    headline: 'Rolling a 401(k) into an IRA costs a Maryland retiree the pension exclusion',
    household: 'A single Maryland retiree of 67 with $50,000 from a 401(k)',
    wrongLabel: 'The same $50,000 after the rollover, from an IRA',
    says:
      'Md. Code, Tax-Gen. § 10-209(a) defines the excluded income as a payment from an ' +
      'employee retirement system and EXCLUDES an individual retirement account, a rollover ' +
      'IRA, a SEP and a § 457(f) plan by name. So the single most-recommended move in ' +
      'retirement planning converts excluded income into fully taxed income, for the rest of ' +
      'the retiree’s life, at no federal cost and with nothing on the federal return to show ' +
      'it happened. The two figures below are the same dollars in two containers.',
    cite: 'Md. Code, Tax-Gen. § 10-209(a) and the Form 502 pension exclusion worksheet',
    ours: () =>
      tax({
        state: 'MD',
        year: 2026,
        filingStatus: 'single',
        federal: federal(50_000),
        filerAge: 67,
        retirement: { filer: { employerPlanPension: 50_000 } },
      }),
    theirs: () =>
      tax({
        state: 'MD',
        year: 2026,
        filingStatus: 'single',
        federal: federal(50_000),
        filerAge: 67,
        retirement: { filer: { iraDistributions: 50_000 } },
      }),
  },
  {
    id: 'ia-frozen',
    oursLabel: '2026',
    kind: 'comparison',
    state: 'IA',
    year: 2026,
    headline: 'Iowa’s low-income exemption is being withdrawn by a number that is not Iowa’s',
    household:
      'The dollar that costs a single Iowan of 65 the whole exemption — the tax at $24,001 of ' +
      'Iowa net income, 2026',
    wrongLabel: 'The same dollar, the same Iowa law, one year earlier',
    says:
      'Iowa Code § 422.5(3) exempts a return whose Iowa net income is at or under $24,000 for ' +
      'a single filer of 65. That figure has not moved since at least 2021 and nothing indexes ' +
      'it — and the deduction the test is applied BEFORE is the FEDERAL one, which rises every ' +
      'year. So the relief shrinks with no Iowa figure amended by anybody, and the direction is ' +
      'the finding: no snapshot of one year can show it. The two figures below are what one ' +
      'dollar of income costs at the cliff, and it FALLS — every figure this engine stores for ' +
      'Iowa is identical in the two years, and the answer differs anyway, by the amount the ' +
      'federal deduction moved.',
    cite: 'Iowa Code § 422.5(3) and § 422.9, with Rev. Proc. 2024-40 and 2025-32',
    ours: () =>
      tax({
        state: 'IA',
        year: 2026,
        filingStatus: 'single',
        federal: federal(24_001, { deduction: 16_100 }),
        filerAge: 65,
      }),
    theirs: () =>
      tax({
        state: 'IA',
        year: 2025,
        filingStatus: 'single',
        federal: federal(24_001, { deduction: 15_750 }),
        filerAge: 65,
      }),
  },
  {
    id: 'nyc-locality',
    kind: 'error',
    state: 'NY',
    year: 2026,
    headline: 'A New York City resident’s city tax is larger than most states’ entire income tax',
    household: 'A single New Yorker on $85,000 living in the city',
    wrongLabel: 'The same return with the locality left out',
    says:
      'New York City’s resident income tax appears in no table of state tax rates, because it ' +
      'is not one. The difference between these two figures is more than the whole state income ' +
      'tax of fifteen of the thirty-two taxing states this engine covers at the same income. A ' +
      'model that stops at the state line is not approximately right for a third of New York’s ' +
      'filers; it is wrong by a whole tax.',
    cite: 'N.Y. Admin. Code § 11-1701 and the NYC school tax credit of § 1310(f)',
    ours: () =>
      tax({
        state: 'NY',
        year: 2025,
        filingStatus: 'single',
        locality: 'NYC',
        federal: {
          adjustedGrossIncome: 100_000,
          taxableIncome: 92_000,
          deduction: 8_000,
          deductionKind: 'standard',
        },
      }),
    theirs: () =>
      tax({
        state: 'NY',
        year: 2025,
        filingStatus: 'single',
        federal: {
          adjustedGrossIncome: 100_000,
          taxableIncome: 92_000,
          deduction: 8_000,
          deductionKind: 'standard',
        },
      }),
  },
];

/** Every check, with both sides evaluated and the gap named. */
export function runChecks() {
  return CHECKS.map((check) => {
    const ours = check.ours();
    const theirs = check.theirs();
    return {
      ...check,
      stateName: stateName(check.state),
      ours,
      theirs,
      difference: theirs - ours,
    };
  });
}

export { CHECKS };
