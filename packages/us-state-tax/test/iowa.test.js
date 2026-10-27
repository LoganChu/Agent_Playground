// Iowa. The thirtieth taxing state, the largest uncovered jurisdiction when it
// was added, and the only state in this package whose answer changes between
// the two supported years with NOT ONE of its own figures moving.
//
// Every expected figure below is computed by hand from the published rate,
// deduction and threshold and written out, not read back out of the engine.
// Day 27's rule: a test written from the data can only confirm the data.
//
// Three groups here do a job no other state's file does.
//
// `the non-elderly exemption cannot bite in either year, and the elderly one
// only for single, head of household and separate` is the file's centrepiece
// and it DERIVES a partition rather than asserting one. Iowa's four low-income
// exemption thresholds are frozen and the deduction they are tested against is
// indexed, so which filers the provision can still reach is a fact about the
// gap between the two — it is recomputed here from the thresholds and the
// federal deductions, and it will change on its own when the federal figure
// next moves. North Dakota's indexation search is the same shape: run the
// search in CI rather than record its answer.
//
// `the relief the exemption can give is SHRINKING` is the direction, which is
// the half no table of one year's figures can show, and it is Oklahoma's frozen
// earned income credit with the sign reversed.
//
// And `a doubled threshold is visible where the true one is worthless` is the
// distinction the status-sweep guard forced on Day 63: whether a parameter
// matters and whether a wrong value would be caught are different questions,
// and Iowa's exemption answers them in opposite directions inside one table.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getStateDefinition, stateIncomeTax } from '../dist/esm/index.js';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

// ---------------------------------------------------------------------------
// The federal figures Iowa adopts, by hand from Rev. Proc. 2024-40 and
// Rev. Proc. 2025-32.
//
// WRITTEN OUT HERE RATHER THAN IMPORTED, and the reason is a property of this
// package worth keeping: `us-state-tax` has NO DEPENDENCIES, `us-federal-tax`
// included, so a test inside it cannot read the other package's data. What
// compares the two engines is `tools/cross-package/iowa-frozen-exemption.mjs`,
// which imports both and would fail if these numbers ever stopped matching
// `us-federal-tax`'s own. So this block is a transcription that something else
// checks, which is the only honest form for it to take.
const FEDERAL = {
  2025: {
    deduction: {
      single: 15_750,
      marriedFilingJointly: 31_500,
      marriedFilingSeparately: 15_750,
      headOfHousehold: 23_625,
      qualifyingSurvivingSpouse: 31_500,
    },
    // § 63(f), per qualifying condition.
    aged: {
      single: 2_000,
      marriedFilingJointly: 1_600,
      marriedFilingSeparately: 1_600,
      headOfHousehold: 2_000,
      qualifyingSurvivingSpouse: 1_600,
    },
  },
  2026: {
    deduction: {
      single: 16_100,
      marriedFilingJointly: 32_200,
      marriedFilingSeparately: 16_100,
      headOfHousehold: 24_150,
      qualifyingSurvivingSpouse: 32_200,
    },
    aged: {
      single: 2_050,
      marriedFilingJointly: 1_650,
      marriedFilingSeparately: 1_650,
      headOfHousehold: 2_050,
      qualifyingSurvivingSpouse: 1_650,
    },
  },
};

const STATUSES = [
  'single',
  'marriedFilingJointly',
  'marriedFilingSeparately',
  'headOfHousehold',
  'qualifyingSurvivingSpouse',
];

const RATE = 0.038;
const CREDIT = 40;

const federalOf = (agi, year, filingStatus, aged = 0) => {
  const deduction = FEDERAL[year].deduction[filingStatus] + aged * FEDERAL[year].aged[filingStatus];
  return {
    adjustedGrossIncome: agi,
    taxableIncome: Math.max(0, agi - deduction),
    deduction,
    deductionKind: 'standard',
  };
};

const ia = (year, filingStatus, agi, extra = {}, aged = 0) =>
  stateIncomeTax({
    state: 'IA',
    year,
    filingStatus,
    federal: federalOf(agi, year, filingStatus, aged),
    ...extra,
  });

// ---------------------------------------------------------------------------
// The rate, and the act that set it.
// ---------------------------------------------------------------------------

test('Iowa is a flat 3.8% in both supported years, and the 3.9% in circulation is a superseded act', () => {
  for (const year of [2025, 2026]) {
    const rate = getStateDefinition('IA', year).rate;
    assert.equal(rate.kind, 'flat');
    assert.equal(rate.rate, 0.038);
    // HF 2317 of 2022 would have reached 3.9% in 2026; SF 2442 of 2024 pulled
    // the flat year forward to 2025 AND set the rate lower. A secondary source
    // printing 3.9% for 2026 is reading the schedule that was replaced.
    assert.notEqual(rate.rate, 0.039);
  }
  // $100,000 single, 2025: (100,000 - 15,750) x 3.8% = 3,201.50, less the $40
  // exemption credit.
  money(ia(2025, 'single', 100_000).tax, 3_161.5, '2025 single $100k');
  // 2026: (100,000 - 16,100) x 3.8% = 3,188.20, less $40.
  money(ia(2026, 'single', 100_000).tax, 3_148.2, '2026 single $100k');
});

test('every Iowa figure is identical across the two years and the answer differs anyway', () => {
  const a = getStateDefinition('IA', 2025);
  const b = getStateDefinition('IA', 2026);
  // Everything Iowa stores: the rate, the four thresholds twice over, the
  // credit and the exclusion age.
  assert.deepEqual(a.rate, b.rate);
  assert.deepEqual(a.zeroTaxThreshold, b.zeroTaxThreshold);
  assert.deepEqual(a.exemptionCredit, b.exemptionCredit);
  assert.deepEqual(a.earnedIncomeCredit, b.earnedIncomeCredit);
  assert.deepEqual(a.retirementIncomeSubtractions, b.retirementIncomeSubtractions);
  // And the answers differ, by 3.8% of the $350 the FEDERAL deduction moved.
  const gap = ia(2025, 'single', 100_000).tax - ia(2026, 'single', 100_000).tax;
  money(gap, 13.3, 'the year-over-year difference is entirely federal');
  money(350 * RATE, 13.3, 'and it is exactly the rate times the deduction increase');
});

// ---------------------------------------------------------------------------
// The deduction, and the distinction that cost this package $50.00 a filer in
// Arizona for 47 days.
// ---------------------------------------------------------------------------

test("Iowa's deduction is the federal one INCLUDING the § 63(f) additions, which is Missouri's case and not Arizona's", () => {
  assert.equal(getStateDefinition('IA', 2025).deduction.kind, 'federal');
  // THE AGE IS HELD FIXED AND ONLY THE DEDUCTION VARIES, and the first draft of
  // this test did it the other way round and measured $96.00 against the
  // $76.00 the § 63(f) addition is worth. The extra $20 is Iowa's OWN senior
  // exemption credit, which turns on at the same age — so moving the filer from
  // 50 to 67 moves two rules at once and the difference is not a measurement of
  // either. Day 63's version of a standing rule in this suite: to price one
  // parameter, change one parameter.
  for (const year of [2025, 2026]) {
    const plain = ia(year, 'single', 60_000, { filerAge: 67 }, 0).tax;
    const withAddition = ia(year, 'single', 60_000, { filerAge: 67 }, 1).tax;
    money(plain - withAddition, FEDERAL[year].aged.single * RATE, `${year} § 63(f) is worth`);
  }
  // $2,000 x 3.8% = $76.00 and $2,050 x 3.8% = $77.90 — the two cells
  // `aged-standard-deduction.test.js` measures for IA across all 39 states.
  money(
    ia(2025, 'single', 60_000, { filerAge: 67 }, 0).tax -
      ia(2025, 'single', 60_000, { filerAge: 67 }, 1).tax,
    76,
  );
  money(
    ia(2026, 'single', 60_000, { filerAge: 67 }, 0).tax -
      ia(2026, 'single', 60_000, { filerAge: 67 }, 1).tax,
    77.9,
  );
});

test("the statutory Iowa standard deduction is NOT used, and it is what a reader of the Code gets", () => {
  // Iowa Code § 422.9 still prints $2,210 single and $5,450 joint — the 2022
  // figures — and the IA 1040 has read the federal line since tax year 2023.
  // A model built from the statute deducts $2,210 where the form deducts
  // $15,750, which is $13,540 of deduction and $514.52 of tax.
  const statutory = 2_210;
  const form = FEDERAL[2025].deduction.single;
  money((form - statutory) * RATE, 514.52, 'the cost of reading the statute instead of the form');
  // And the engine is on the form's side: a $60,000 single return pays 3.8% of
  // $44,250 and not of $57,790.
  money(ia(2025, 'single', 60_000).tax, (60_000 - form) * RATE - CREDIT, 'the form governs');
});

// ---------------------------------------------------------------------------
// THE CENTREPIECE. Which filers the low-income exemption can still reach, and
// it is DERIVED rather than asserted.
// ---------------------------------------------------------------------------

test('the non-elderly exemption cannot bite in either year, and the elderly one only for single, head of household and separate', () => {
  const bites = { 2025: {}, 2026: {} };
  for (const year of [2025, 2026]) {
    const rule = getStateDefinition('IA', year).zeroTaxThreshold;
    for (const status of STATUSES) {
      // Under 65: no § 63(f) addition. At 65: one, because § 422.5(3) is
      // satisfied by EITHER spouse reaching it, so one qualifying person is the
      // case that decides whether the provision can ever help.
      const plainDeduction = FEDERAL[year].deduction[status];
      const agedDeduction = plainDeduction + FEDERAL[year].aged[status];
      bites[year][status] = {
        under65: rule.threshold[status] > plainDeduction,
        at65: rule.elderlyThreshold[status] > agedDeduction,
      };
    }
  }

  // THE DERIVED RESULT. A threshold tested on income BEFORE the deduction can
  // only change an answer where it EXCEEDS that filer's deduction; below it,
  // the deduction has already taken taxable income to zero and the exemption
  // exempts a tax of nothing.
  for (const year of [2025, 2026]) {
    for (const status of STATUSES) {
      assert.equal(
        bites[year][status].under65,
        false,
        `${year} ${status}: the non-elderly exemption is overtaken by the deduction`,
      );
    }
    assert.deepEqual(
      STATUSES.filter((s) => bites[year][s].at65),
      ['single', 'marriedFilingSeparately', 'headOfHousehold'],
      `${year}: the statuses the exemption can still reach at 65`,
    );
  }

  // AND THE ENGINE AGREES, measured rather than reasoned. A single filer at 65
  // with $24,000 of income is exempt; at $24,001 the whole tax arrives.
  const at65 = (year, agi) => ia(year, 'single', agi, { filerAge: 70 }, 1).tax;
  money(at65(2025, 24_000), 0, '2025 single at 65, exactly at the threshold');
  // One dollar over: (24,001 - 17,750) x 3.8% = 237.538, less the $40 credit
  // and the $20 age credit.
  money(at65(2025, 24_001), (24_001 - 17_750) * RATE - 60, '2025 single at 65, one dollar over');

  // And a JOINT return at 65 is not exempt at its threshold and owes nothing
  // anyway, which is what "already overtaken" means.
  const joint = ia(2025, 'marriedFilingJointly', 32_000, { filerAge: 70, spouseAge: 70 }, 2);
  money(joint.tax, 0, 'a joint return at its own threshold owes nothing either way');
});

test('the relief the exemption can give is SHRINKING, because one side is frozen and the other is indexed', () => {
  // The most the exemption can ever be worth to a filer is the tax on the gap
  // between their deduction and the threshold — reached one cent below it.
  const headroom = (year, status) =>
    getStateDefinition('IA', year).zeroTaxThreshold.elderlyThreshold[status] -
    (FEDERAL[year].deduction[status] + FEDERAL[year].aged[status]);

  // $24,000 - $17,750 = $6,250 at 3.8% = $237.50 for 2025.
  money(headroom(2025, 'single') * RATE, 237.5, '2025 single at 65');
  // $24,000 - $18,150 = $5,850 at 3.8% = $222.30 for 2026.
  money(headroom(2026, 'single') * RATE, 222.3, '2026 single at 65');
  // $32,000 - $25,625 = $6,375 at 3.8% = $242.25, and $32,000 - $26,200 =
  // $5,800 at 3.8% = $220.40.
  money(headroom(2025, 'headOfHousehold') * RATE, 242.25, '2025 head of household at 65');
  money(headroom(2026, 'headOfHousehold') * RATE, 220.4, '2026 head of household at 65');

  // THE DIRECTION, which is the assertion that matters and the one no single
  // year's table can carry: for every status the exemption still reaches, the
  // headroom must be SMALLER in 2026 than in 2025, and it must shrink because
  // the deduction grew rather than because a threshold fell.
  for (const status of ['single', 'marriedFilingSeparately', 'headOfHousehold']) {
    assert.ok(
      headroom(2026, status) < headroom(2025, status),
      `${status}: the exemption's reach must shrink while the deduction indexes`,
    );
    assert.equal(
      getStateDefinition('IA', 2026).zeroTaxThreshold.elderlyThreshold[status],
      getStateDefinition('IA', 2025).zeroTaxThreshold.elderlyThreshold[status],
      `${status}: and the threshold itself must not have moved`,
    );
  }
  // $15.20 of relief withdrawn from a single Iowan at 65 in one year, with
  // nothing amended in Iowa.
  money((headroom(2025, 'single') - headroom(2026, 'single')) * RATE, 15.2, 'withdrawn in a year');
});

test('a doubled threshold is visible where the true one is worthless, and the two facts do not line up', () => {
  // Day 63's distinction, and the reason the status-sweep guard refused a
  // whole-table exemption for this state. A cell is AUDITABLE where the band
  // (that status's deduction, twice the threshold] is non-empty; the true value
  // MATTERS where the threshold exceeds the deduction. The two are independent.
  const auditable = (year, table, status, aged) => {
    const rule = getStateDefinition('IA', year).zeroTaxThreshold;
    const threshold = table === 'threshold' ? rule.threshold[status] : rule.elderlyThreshold[status];
    const deduction =
      FEDERAL[year].deduction[status] + (aged ? FEDERAL[year].aged[status] : 0);
    return threshold * 2 > deduction;
  };

  for (const year of [2025, 2026]) {
    // The non-elderly table: three cells a household can reach and two it
    // cannot, and the two are the ones whose DOUBLED threshold is still under
    // the deduction ($27,000 against $31,500 and $32,200).
    assert.deepEqual(
      STATUSES.filter((s) => auditable(year, 'threshold', s, false)),
      ['single', 'marriedFilingSeparately', 'headOfHousehold'],
      `${year}: the non-elderly cells the audit can see`,
    );
    // The elderly table: ALL FIVE are auditable, including the joint and
    // surviving-spouse cells that cannot help anybody — doubling $32,000 to
    // $64,000 clears a $33,100 deduction even though $32,000 does not.
    assert.deepEqual(
      STATUSES.filter((s) => auditable(year, 'elderlyThreshold', s, true)),
      STATUSES,
      `${year}: every elderly cell is auditable, worthless or not`,
    );
  }

  // So joint is EQUALLY worthless in both tables and OPPOSITELY visible, which
  // is the whole point.
  const rule = getStateDefinition('IA', 2025).zeroTaxThreshold;
  const jointDeduction = FEDERAL[2025].deduction.marriedFilingJointly;
  assert.ok(rule.threshold.marriedFilingJointly < jointDeduction, 'non-elderly joint: worthless');
  assert.ok(
    rule.elderlyThreshold.marriedFilingJointly <
      jointDeduction + FEDERAL[2025].aged.marriedFilingJointly,
    'elderly joint: worthless too',
  );
  assert.equal(auditable(2025, 'threshold', 'marriedFilingJointly', false), false);
  assert.equal(auditable(2025, 'elderlyThreshold', 'marriedFilingJointly', true), true);
});

test('married filing separately changes threshold groups on a birthday', () => {
  const rule = getStateDefinition('IA', 2025).zeroTaxThreshold;
  // Under 65 the statute says "single or married filing separately" and at 65
  // it says "single" against one figure and "other than single" against the
  // other, so the separate filer moves from the small group to the large one.
  assert.equal(rule.threshold.marriedFilingSeparately, rule.threshold.single);
  assert.equal(rule.elderlyThreshold.marriedFilingSeparately, rule.elderlyThreshold.marriedFilingJointly);
  assert.notEqual(rule.elderlyThreshold.marriedFilingSeparately, rule.elderlyThreshold.single);
  // $32,000 against $24,000 — the separate filer at 65 has the LARGER
  // threshold of the two, which is worth $556.70 at the top of its band
  // against the single filer's $237.50.
  money(
    (rule.elderlyThreshold.marriedFilingSeparately -
      (FEDERAL[2025].deduction.marriedFilingSeparately + FEDERAL[2025].aged.marriedFilingSeparately)) *
      RATE,
    556.7,
    'the separate filer at 65 has the largest headroom in the state',
  );
});

test('ONE spouse at 65 is enough for the larger threshold', () => {
  // "Only one spouse must be 65 or older to qualify" — the instructions' own
  // words. A head-of-household return has one person on it, so the case that
  // tests this is a joint return with exactly one qualifying filer, and what it
  // must NOT do is take the small threshold.
  const one = stateIncomeTax({
    state: 'IA',
    year: 2025,
    filingStatus: 'marriedFilingJointly',
    filerAge: 66,
    spouseAge: 60,
    federal: federalOf(30_000, 2025, 'marriedFilingJointly', 1),
  });
  // $30,000 against a $33,100 deduction is zero taxable income regardless, so
  // the assertion is on the threshold the rule chose rather than on the tax.
  money(one.tax, 0, 'no taxable income either way');
  const rule = getStateDefinition('IA', 2025).zeroTaxThreshold;
  assert.equal(rule.elderlyAge, 65);
  // And the figure a return with NOBODY at 65 would be tested on is smaller.
  assert.ok(rule.elderlyThreshold.marriedFilingJointly > rule.threshold.marriedFilingJointly);
});

// ---------------------------------------------------------------------------
// The retirement exclusion, which is stored as the absence of a number.
// ---------------------------------------------------------------------------

test("the retirement income exclusion is TOTAL, and the absence of `cap` is how it says so", () => {
  for (const year of [2025, 2026]) {
    const rules = getStateDefinition('IA', year).retirementIncomeSubtractions;
    assert.equal(rules.length, 1);
    const rule = rules[0];
    assert.equal(rule.minimumAge, 55);
    assert.equal(rule.scope, 'perPerson');
    // THE PARAMETER THAT IS NOT THERE. `engine.ts`'s `capOf` reads an absent
    // cap as Infinity, so the largest subtraction in this state has no figure
    // — and therefore no mutant, because the audit perturbs literals.
    assert.equal(rule.cap, undefined, 'an absent cap IS the unlimited exclusion');
    assert.equal(rule.capByAge, undefined);
  }
  // $80,000 of pension at 57 is excluded in full: the return owes nothing on it.
  const retired = ia(2025, 'single', 80_000, {
    filerAge: 57,
    retirement: { filer: { employerPlanPension: 80_000 } },
  });
  money(retired.tax, 0, '$80,000 of pension at 57 is wholly excluded');
  // And 2021-2022's $6,000 would have left $74,000 in the base — $2,812.00 of
  // tax, which is what a model carrying the old cap forward charges.
  money((80_000 - 6_000) * RATE - CREDIT, 2_772, 'what the superseded $6,000 cap would cost');
});

test('the exclusion is gated at 55 and claimed PER PERSON, so whose name the pension is in decides the tax', () => {
  // 54 is under the gate and 55 is not.
  const under = ia(2025, 'single', 50_000, {
    filerAge: 54,
    retirement: { filer: { employerPlanPension: 50_000 } },
  });
  const over = ia(2025, 'single', 50_000, {
    filerAge: 55,
    retirement: { filer: { employerPlanPension: 50_000 } },
  });
  money(under.tax, (50_000 - 15_750) * RATE - CREDIT, 'at 54 nothing is excluded');
  money(over.tax, 0, 'at 55 all of it is');
  // 55 is the lowest retirement age in this package — Georgia's is 62 and
  // South Carolina's 65 — so Iowa is the state an early retiree can use.
  assert.equal(getStateDefinition('IA', 2025).retirementIncomeSubtractions[0].minimumAge, 55);

  // PER PERSON, on the recipient's own income: a couple whose pension is in the
  // name of the spouse who is under 55 excludes nothing.
  const inTheYoungerName = stateIncomeTax({
    state: 'IA',
    year: 2025,
    filingStatus: 'marriedFilingJointly',
    filerAge: 60,
    spouseAge: 50,
    federal: federalOf(60_000, 2025, 'marriedFilingJointly', 0),
    retirement: { filer: {}, spouse: { employerPlanPension: 60_000 } },
  });
  const inTheOlderName = stateIncomeTax({
    state: 'IA',
    year: 2025,
    filingStatus: 'marriedFilingJointly',
    filerAge: 60,
    spouseAge: 50,
    federal: federalOf(60_000, 2025, 'marriedFilingJointly', 0),
    retirement: { filer: { employerPlanPension: 60_000 }, spouse: {} },
  });
  money(inTheOlderName.tax, 0, 'in the older spouse’s name, wholly excluded');
  money(
    inTheYoungerName.tax,
    (60_000 - 31_500) * RATE - 80,
    'in the younger spouse’s name, wholly taxed',
  );
  assert.ok(
    inTheYoungerName.tax - inTheOlderName.tax > 1_000,
    'identical household totals, $1,003 apart on whose name the pension is in',
  );
});

test('Social Security is wholly exempt, with no income test', () => {
  assert.equal(getStateDefinition('IA', 2025).subtractsTaxableSocialSecurity, true);
  const withBenefit = ia(2025, 'single', 60_000, {
    filerAge: 70,
    taxableSocialSecurity: 20_000,
  });
  const without = ia(2025, 'single', 40_000, { filerAge: 70 });
  // The $20,000 of taxable benefit leaves the base entirely, so the two returns
  // reach the same Iowa taxable income. They are not the same tax only because
  // the federal deduction differs with the AGI — it does not here, both being
  // single — so these must be equal to the cent.
  money(withBenefit.tax, without.tax, 'the taxable benefit is subtracted in full');
  // And at a high income too: no test, no taper.
  // $40 of personal credit AND $20 of senior credit, because this filer is 70.
  const rich = ia(2025, 'single', 400_000, { filerAge: 70, taxableSocialSecurity: 20_000 });
  money(rich.tax, (400_000 - 20_000 - 15_750) * RATE - CREDIT - 20, 'no income test on the subtraction');
});

// ---------------------------------------------------------------------------
// The credits.
// ---------------------------------------------------------------------------

test('the $40 exemption credit is a CREDIT, worth the same at every income, and the additions stack', () => {
  const rule = getStateDefinition('IA', 2025).exemptionCredit;
  assert.equal(rule.perFiler.single, 40);
  assert.equal(rule.perFiler.marriedFilingJointly, 80);
  assert.equal(rule.perFiler.marriedFilingSeparately, 40);
  assert.equal(rule.perFiler.qualifyingSurvivingSpouse, 40);
  // A HEAD OF HOUSEHOLD CLAIMS TWO PERSONAL CREDITS WITH ONE PERSON ON THE
  // RETURN — the instructions' own count, and the figure a `perPerson` reading
  // of this credit gets wrong. Six differential households refused that
  // reading by exactly $40.00 each.
  assert.equal(rule.perFiler.headOfHousehold, 80);
  assert.notEqual(rule.perFiler.headOfHousehold, rule.perFiler.single);
  assert.equal(rule.perFiler.headOfHousehold, rule.perFiler.marriedFilingJointly);
  assert.equal(rule.perDependent, 40);
  assert.equal(rule.perSeniorFiler, 20);
  assert.equal(rule.perBlindOrDisabledFiler, 20);
  assert.equal(rule.seniorAge, 65);

  // $40 of credit is the same $40 at $30,000 and at $2,000,000, which is
  // $1,052.63 of income at 3.8%.
  const creditOf = (agi) =>
    (agi - 15_750) * RATE - ia(2025, 'single', agi).tax;
  money(creditOf(30_000), 40, 'at $30,000');
  money(creditOf(2_000_000), 40, 'at $2,000,000');
  money(CREDIT / RATE, 1_052.631578, 'the income $40 of credit is worth');

  // A couple with two children and both filers over 65: 2 x $40 + 2 x $40 +
  // 2 x $20 = $200.
  const family = stateIncomeTax({
    state: 'IA',
    year: 2025,
    filingStatus: 'marriedFilingJointly',
    filerAge: 66,
    spouseAge: 67,
    dependents: 2,
    federal: federalOf(120_000, 2025, 'marriedFilingJointly', 2),
  });
  const deduction = FEDERAL[2025].deduction.marriedFilingJointly + 2 * FEDERAL[2025].aged.marriedFilingJointly;
  money(family.tax, (120_000 - deduction) * RATE - 200, 'two filers, two children, both over 65');
});

test('the exemption credit is NONREFUNDABLE and the earned income credit is not', () => {
  const credits = ia(2025, 'single', 100_000).credits;
  const exemption = credits.find((c) => c.name.includes('exemption credit'));
  assert.equal(exemption.refundable, false, 'the $40 cannot produce a refund');
  const eitc = credits.find((c) => c.name.includes('earned income'));
  assert.equal(eitc.refundable, true);

  // A low-income family with a federal credit: Iowa pays 15% of it, refundably.
  const rule = getStateDefinition('IA', 2025).earnedIncomeCredit;
  assert.equal(rule.matchRate, 0.15);
  assert.equal(rule.refundable, true);
  const family = stateIncomeTax({
    state: 'IA',
    year: 2025,
    filingStatus: 'headOfHousehold',
    filerAge: 34,
    dependents: 2,
    federal: {
      adjustedGrossIncome: 24_000,
      taxableIncome: 376,
      deduction: 23_625,
      deductionKind: 'standard',
      earnedIncomeCredit: 7_152,
    },
  });
  // 15% of $7,152 is $1,072.80, and the whole of it is a refund because the
  // $376 of taxable income owes $14.29, which the $120 of exemption credit
  // (one filer plus two dependents) already clears.
  const iowaEitc = family.credits.find((c) => c.name.includes('earned income'));
  money(iowaEitc.amount, 1_072.8, '15% of the federal credit');
  money(family.tax, -1_072.8, 'and it is refundable');
});

test("Iowa reads THIS YEAR'S federal credit, which is the whole difference from Oklahoma", () => {
  // Oklahoma's § 2357.43 is 5% of the federal credit computed under the Code as
  // it stood on 31 December 2020, so a model reading this year's credit
  // overpays. Iowa's § 422.12B names no date, so reading this year's credit is
  // RIGHT — and the way this package records that is that Iowa HAS the rule and
  // Oklahoma does not.
  assert.equal(getStateDefinition('IA', 2025).earnedIncomeCredit.matchRate, 0.15);
  assert.equal(getStateDefinition('OK', 2025).earnedIncomeCredit, undefined);
  // The same federal credit moves Iowa's answer between the two years, because
  // the federal maximum is indexed and Iowa's share of it is not frozen.
  const at = (year, federalCredit) =>
    stateIncomeTax({
      state: 'IA',
      year,
      filingStatus: 'headOfHousehold',
      filerAge: 34,
      dependents: 2,
      federal: {
        adjustedGrossIncome: 24_000,
        taxableIncome: 0,
        deduction: FEDERAL[year].deduction.headOfHousehold,
        deductionKind: 'standard',
        earnedIncomeCredit: federalCredit,
      },
    }).credits.find((c) => c.name.includes('earned income')).amount;
  money(at(2025, 7_152), 1_072.8, '15% of the 2025 two-child maximum');
  money(at(2026, 7_316), 1_097.4, '15% of the 2026 two-child maximum');
  // $24.60 more, because the federal figure indexed. Oklahoma's equivalent
  // would not have moved at all.
  money(at(2026, 7_316) - at(2025, 7_152), 24.6, 'the indexed base moves Iowa with it');
});

// ---------------------------------------------------------------------------
// What is not modelled, asserted as absent so that adding it is a decision.
// ---------------------------------------------------------------------------

test('the alternate tax is NOT modelled, and the note says so', () => {
  // § 422.5(3)(b) lets a joint, head-of-household or surviving-spouse return
  // compute its tax a second way and pay the lesser. This package computes only
  // the regular way, so an Iowa answer for those three statuses is an UPPER
  // BOUND. That is a gap, and the thing a test can hold is that it is declared.
  const notes = getStateDefinition('IA', 2025).notes;
  const alternate = notes.find((n) => n.includes('ALTERNATE TAX'));
  assert.ok(alternate, 'the alternate tax gap is declared in a note');
  assert.match(alternate, /NOT MODELLED/);
  assert.match(alternate, /TOO HIGH/);
  // And the survivor gap, which is a judgement rather than an omission.
  assert.ok(
    notes.some((n) => n.includes('surviving spouse') && n.includes('55')),
    'the survivor branch of the exclusion is declared',
  );
});
