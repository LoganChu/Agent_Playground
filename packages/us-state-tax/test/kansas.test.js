// Kansas — and the two tests here that are not about an answer.
//
// ## The $527.48 checkbox
//
// Kansas has no qualifying-surviving-spouse filing status and its head-of-household
// box names her status as an alternative qualification, so a widow is read against
// the HEAD-OF-HOUSEHOLD column: not the joint one that `byStatus()` defaults to and
// not the single one a guess reaches for. Kansas is the first state in this package
// where that column carries an allowance of its own — the $2,320 head-of-household
// personal exemption — so the right answer is between the two wrong ones and
// neither bound is reachable by choosing the "conservative" column.
//
// The first block below prices all three, because a declaration is only worth
// having if something fails when it is removed, and `surviving-spouse-column.test.js`
// can only check that a declaration EXISTS.
//
// ## And a guard on a rule this package deliberately does NOT have
//
// Kansas publishes a minimum filing requirement by status and the reference model
// ships it as five parameters and a branch. Every one of those thresholds is
// exactly its own status's standard deduction plus its own personal exemption, so a
// filer at or below one already has no taxable income and the rule can zero a
// positive tax in no household at any income. This package carries no
// `zeroTaxThreshold` for Kansas for that reason.
//
// **What makes the omission safe is an IDENTITY BETWEEN THREE OTHER PARAMETERS, and
// identities between parameters break.** The day Kansas moves the standard deduction
// without moving the filing requirement — or indexes the exemption, which the bill
// that became SB 1 proposed and the act did not do — the threshold starts to bind
// and becomes a cliff that nothing here models and no answer-level test can see,
// because today it changes no answer.
//
// So the identity is asserted against the published thresholds, transcribed. The
// pinned side is the document and the computed side is the package, which is the
// only arrangement in which this can fail for the right reason.
//
// > **A RULE WORTH OMITTING IS WORTH A TEST, AND THE TEST GOES ON THE PREMISE
// > RATHER THAN ON THE OUTPUT.** Day 65's finding, one level down: a check on a
// > number cannot see a thing designed not to move that number.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getStateDefinition, stateIncomeTax } from './strict.mjs';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

const fed = (agi) => ({
  adjustedGrossIncome: agi,
  taxableIncome: agi,
  deduction: 0,
  deductionKind: 'standard',
});

const ks = (opts = {}) =>
  stateIncomeTax({
    state: 'KS',
    year: opts.year ?? 2026,
    filingStatus: opts.filingStatus ?? 'single',
    federal: fed(opts.agi ?? 60_000),
    ...(opts.filerAge === undefined ? {} : { filerAge: opts.filerAge }),
    ...(opts.spouseAge === undefined ? {} : { spouseAge: opts.spouseAge }),
    ...(opts.dependents === undefined ? {} : { dependents: opts.dependents }),
    ...(opts.dependentAges === undefined ? {} : { dependentAges: opts.dependentAges }),
    ...(opts.retirement === undefined ? {} : { retirement: opts.retirement }),
    ...(opts.taxableSocialSecurity === undefined
      ? {}
      : { taxableSocialSecurity: opts.taxableSocialSecurity }),
    ...(opts.blindOrDisabled === undefined ? {} : { blindOrDisabled: opts.blindOrDisabled }),
  });

// The minimum filing requirements, transcribed from the K-40 instructions'
// own table. NOT computed from the definition — that is the whole point of the
// identity test below, which recomputes the right-hand side from the package.
const FILING_REQUIREMENT = {
  marriedFilingJointly: 26_560,
  headOfHousehold: 17_660,
  single: 12_765,
  marriedFilingSeparately: 13_280,
};

test('a Kansas widow is read against the head-of-household column, which is neither of the two defaults', () => {
  const household = { agi: 60_000, dependents: 1, dependentAges: [10], filerAge: 40 };
  const widow = ks({ ...household, filingStatus: 'qualifyingSurvivingSpouse' }).tax;
  const hoh = ks({ ...household, filingStatus: 'headOfHousehold' }).tax;
  const joint = ks({ ...household, filingStatus: 'marriedFilingJointly' }).tax;
  const single = ks({ ...household, filingStatus: 'single' }).tax;

  money(widow, 2_145.72, 'the widow');
  money(widow, hoh, 'the widow reads the head-of-household column');

  // The joint column understates her by more than the single column overstates
  // her, so there is no safe default: one error is twice the other and they
  // point opposite ways.
  money(joint, 1_618.24, 'the joint column');
  money(single, 2_418.86, 'the single column');
  money(widow - joint, 527.48, 'what the joint default costs');
  money(single - widow, 273.14, 'what the single guess costs');

  // And the reason the joint column is so far out is structural rather than
  // arithmetic: the joint schedule's 5.2% band runs to $46,000 and swallows her
  // whole taxable income, so she never reaches 5.58% at all.
  money(
    ks({ ...household, filingStatus: 'marriedFilingJointly' }).marginalRate,
    0.052,
    'the joint column keeps her in the first band',
  );
  money(
    ks({ ...household, filingStatus: 'qualifyingSurvivingSpouse' }).marginalRate,
    0.0558,
    'her own column does not',
  );
});

test("Kansas's minimum filing requirement is exactly the deduction plus the exemption, which is why no zeroTaxThreshold is carried", () => {
  for (const year of [2025, 2026]) {
    const def = getStateDefinition('KS', year);
    assert.equal(
      def.zeroTaxThreshold,
      undefined,
      `${year}: the rule is deliberately absent and its absence rests on the identity below`,
    );
    for (const [status, threshold] of Object.entries(FILING_REQUIREMENT)) {
      const allowances = def.deduction.amounts[status] + def.exemption.perFiler[status];
      assert.equal(
        allowances,
        threshold,
        `${year} ${status}: the published filing requirement is ${threshold} and the ` +
          `deduction plus exemption is ${allowances}. If these have come apart, Kansas's ` +
          'filing requirement now binds on somebody and this package needs a ' +
          'zeroTaxThreshold rule for it',
      );
    }
    // A widow reads the head-of-household column, so her threshold is covered by
    // the head-of-household row and needs no row of its own — which is only true
    // because `survivingSpouseFilesAs` points there.
    assert.equal(def.survivingSpouseFilesAs.filesAs, 'headOfHousehold');
  }
});

test('the head-of-household exemption is the $9,160 every non-joint status gets plus the $2,320 the form granted before the statute did', () => {
  for (const year of [2025, 2026]) {
    const e = getStateDefinition('KS', year).exemption;
    assert.equal(e.perFiler.single, 9_160);
    assert.equal(e.perFiler.marriedFilingSeparately, 9_160);
    assert.equal(e.perFiler.marriedFilingJointly, 18_320);
    assert.equal(
      e.perFiler.headOfHousehold - e.perFiler.single,
      2_320,
      'the head-of-household additional exemption, codified retroactively by HB 2231 of 2025',
    );
    // It is the same figure a dependent is worth, which is the statute reusing
    // one number rather than two numbers that happen to agree: HB 2231 wrote the
    // head-of-household amount, the unborn-child amount and the 2025 disabled
    // veteran amount all as $2,320, the figure SB 1 had already set per dependent.
    assert.equal(e.perDependent, 2_320);
  }
  // Worth $120.64 in the 5.2% band and $129.46 in the 5.58% one.
  const withIt = ks({ filingStatus: 'headOfHousehold', agi: 60_000, dependents: 1, dependentAges: [10], filerAge: 40 }).tax;
  const withoutIt = ks({ filingStatus: 'headOfHousehold', agi: 60_000 - 2_320, dependents: 1, dependentAges: [10], filerAge: 40 }).tax;
  money(withIt - withoutIt, 129.46, 'the head-of-household exemption at 5.58%');
});

test('the two schedules: the joint column is exactly twice the other, and the statutory accumulations are exact at the thresholds', () => {
  for (const year of [2025, 2026]) {
    const by = getStateDefinition('KS', year).rate.byStatus;
    const other = by.single;
    const joint = by.marriedFilingJointly;

    // Two rates, two rows, in both years and every status.
    for (const status of Object.keys(by)) {
      assert.deepEqual(
        by[status].map((b) => b.rate),
        [0.052, 0.0558],
        `${year} ${status}: two rates`,
      );
    }
    assert.equal(other[0].upTo, 23_000);
    assert.equal(joint[0].upTo, 46_000);
    // An OBSERVATION about two published schedules and not a relation the law
    // states: K.S.A. 79-32,110(a)(2)(F) writes (i) and (ii) out separately, each
    // with its own accumulated figure.
    assert.equal(joint[0].upTo, other[0].upTo * 2, 'the joint threshold is twice the other');
    assert.deepEqual(
      by.marriedFilingSeparately,
      other,
      'a separate return reads "all other individuals" and is NOT half the joint column',
    );

    // THE ARITHMETIC THAT SETTLES THE THRESHOLDS. The statute prints $1,196 and
    // $2,392 as the tax accumulated at each breakpoint, and 5.2% hits both
    // exactly at $23,000 and $46,000 — which is what rules out the reference
    // model's $23,001 and $46,001, where the same multiplication gives
    // $1,196.052 and $2,392.052. The difference in the final tax is $0.0038 a
    // return, which no rounded answer can show; the difference in the published
    // constant is a whole cent and five of them.
    assert.equal(0.052 * other[0].upTo, 1_196, 'the single-column accumulation');
    assert.equal(0.052 * joint[0].upTo, 2_392, 'the joint-column accumulation');
  }
});

test('what a Kansas retirement costs depends on which government employed the retiree, and on nothing else', () => {
  const retiree = { agi: 50_000, filerAge: 67 };
  const privatePlan = ks({ ...retiree, retirement: { filer: { employerPlanPension: 50_000 } } });
  const ira = ks({ ...retiree, retirement: { filer: { iraDistributions: 50_000 } } });
  const government = ks({ ...retiree, retirement: { filer: { governmentPension: 50_000 } } });
  const military = ks({ ...retiree, retirement: { filer: { militaryRetirement: 50_000 } } });

  money(privatePlan.tax, 1_942.88, 'a private pension');
  money(ira.tax, 1_942.88, 'an IRA — the same, because Kansas has no allowance for either');
  money(government.tax, 0, 'a KPERS or federal civil service pension');
  money(military.tax, 0, 'military retired pay');

  // No age test anywhere on the exempt list, which is the parameter most often
  // reported wrong about a state retirement rule. A 45-year-old retired Kansas
  // trooper subtracts the whole pension.
  money(
    ks({ agi: 50_000, filerAge: 45, retirement: { filer: { governmentPension: 50_000 } } }).tax,
    0,
    'the exemption has no age test',
  );
  // And no ceiling.
  money(
    ks({ agi: 400_000, filerAge: 67, retirement: { filer: { governmentPension: 400_000 } } }).tax,
    0,
    'the exemption has no cap',
  );
  // The cap of zero is doing real work: it is what makes the rule subtract the
  // exempt list and NOTHING else. A cap that was absent would mean "the whole of
  // it" and would exempt every pension in Kansas.
  for (const year of [2025, 2026]) {
    const [rule] = getStateDefinition('KS', year).retirementIncomeSubtractions;
    assert.equal(rule.cap, 0, `${year}: nothing outside the exempt list is subtracted`);
    assert.equal(rule.governmentPensionExemptInFull, true);
    assert.equal(rule.minimumAge, undefined, `${year}: no age test`);
    assert.equal(rule.cappedMinimumAge, undefined, `${year}: and none on the cap either`);
  }
});

test('Social Security is subtracted unconditionally, so the $75,000 cliff Kansas repealed in 2024 is not in either year here', () => {
  // The old rule exempted the whole federally taxable benefit at or below
  // $75,000 of federal AGI and NONE of it one dollar above. If any of it
  // survived, these two returns would differ by the tax on the whole benefit
  // rather than by the tax on one dollar.
  const couple = { filingStatus: 'marriedFilingJointly', filerAge: 70, spouseAge: 70 };
  const atTheOldLimit = ks({ ...couple, agi: 75_000, taxableSocialSecurity: 20_000 });
  const oneDollarOver = ks({ ...couple, agi: 75_001, taxableSocialSecurity: 20_000 });
  money(
    oneDollarOver.tax - atTheOldLimit.tax,
    0.052,
    'one dollar over the repealed limit costs one dollar of tax',
  );

  // And the size of the cliff that used to be there, priced from this package's
  // own figures so the claim in `notes` cannot drift. A couple with $51,000 of
  // federally taxable benefits: the subtraction is worth $2,845.80, and before
  // 2024 the whole of it vanished on the 75,001st dollar of federal AGI.
  const withBenefit = ks({ ...couple, agi: 150_000, taxableSocialSecurity: 51_000 });
  const withoutBenefit = ks({ ...couple, agi: 150_000 });
  money(
    withoutBenefit.tax - withBenefit.tax,
    2_845.80,
    'what the repealed cliff charged on one dollar of income',
  );
  money(withoutBenefit.tax - withBenefit.tax, 51_000 * 0.0558, 'the whole benefit at the margin');
});

test('the aged and blind addition is upside down, per person, and the only marriage penalty in the Kansas income tax', () => {
  for (const year of [2025, 2026]) {
    const add = getStateDefinition('KS', year).standardDeductionAgedOrBlindAddition;
    assert.equal(add.age, 65);
    assert.equal(add.amount.single, 850);
    assert.equal(add.amount.headOfHousehold, 850);
    assert.equal(add.amount.marriedFilingJointly, 700);
    assert.equal(add.amount.marriedFilingSeparately, 700);
    assert.ok(
      add.amount.single > add.amount.marriedFilingJointly,
      `${year}: Kansas and Oregon are the only states here where a single filer's ` +
        "allowance EXCEEDS a joint filer's",
    );
    // A widow reads the head-of-household column here too, which is $850 and not
    // the joint $700 — so the surviving-spouse redirection is worth $150 of
    // deduction to her on this figure as well as $2,320 on the exemption.
    assert.equal(add.amount.qualifyingSurvivingSpouse, 700);
  }

  // Per PERSON and per CONDITION: the two boxes stack.
  const base = { filingStatus: 'marriedFilingJointly', agi: 100_000 };
  const neither = ks({ ...base, filerAge: 50, spouseAge: 50 }).tax;
  const oneAged = ks({ ...base, filerAge: 67, spouseAge: 50 }).tax;
  const bothAged = ks({ ...base, filerAge: 67, spouseAge: 67 }).tax;
  const bothAgedOneBlind = ks({ ...base, filerAge: 67, spouseAge: 67, blindOrDisabled: 1 }).tax;
  money(neither - oneAged, 700 * 0.0558, 'one box');
  money(oneAged - bothAged, 700 * 0.0558, 'the second box is worth the same as the first');
  money(bothAged - bothAgedOneBlind, 700 * 0.0558, 'age and blindness stack on one person');

  // The marriage penalty, priced: two 65-year-olds marrying lose $150 each.
  money((850 - 700) * 2 * 0.0558, 16.74, 'what marrying costs a couple both 65');
});

test('nothing in the Kansas income tax is indexed, and the sameness of the two years is the statute', () => {
  const a = getStateDefinition('KS', 2025);
  const b = getStateDefinition('KS', 2026);
  assert.deepEqual(a.deduction, b.deduction, 'the standard deduction');
  assert.deepEqual(a.exemption, b.exemption, 'the exemption');
  assert.deepEqual(a.rate, b.rate, 'both schedules');
  assert.deepEqual(
    a.standardDeductionAgedOrBlindAddition,
    b.standardDeductionAgedOrBlindAddition,
    'Worksheet I',
  );
  assert.deepEqual(a.earnedIncomeCredit, b.earnedIncomeCredit, 'the earned income credit');
  // Both years are PUBLISHED and neither carries a provisional figure, which is a
  // claim about the law rather than about how hard anybody looked: SB 1 wrote
  // every figure for "tax year 2024, and all tax years thereafter", and the bill
  // as introduced would have indexed the standard deduction from 2025.
  for (const def of [a, b]) {
    assert.equal(def.status, 'published');
    assert.equal(def.provisionalFigures, undefined);
  }
});

test('the earned income credit is 17% of the federal credit and refundable, so a filer with no Kansas tax is paid it', () => {
  for (const year of [2025, 2026]) {
    const eitc = getStateDefinition('KS', year).earnedIncomeCredit;
    assert.equal(eitc.matchRate, 0.17);
    assert.equal(eitc.refundable, true);
    assert.equal(eitc.maximum, undefined, `${year}: no ceiling on the match`);
    assert.equal(eitc.ineligibleFilingStatuses, undefined, `${year}: every status may claim it`);
  }
  // Refundable means NEGATIVE, and the income that proves it has to be below the
  // filing requirement — which is the one place Kansas's $12,765 shows up in an
  // answer, as the income at which there is no tax for a credit to offset.
  const paid = stateIncomeTax({
    state: 'KS',
    year: 2026,
    filingStatus: 'headOfHousehold',
    federal: { ...fed(12_000), earnedIncomeCredit: 4_427 },
    dependents: 1,
    dependentAges: [5],
  });
  money(paid.tax, -0.17 * 4_427, 'the whole match is paid out');
  // And 1% of the federal credit is what the 2013 cut from 18% took: $44.27 for
  // this household, every year, for thirteen years.
  money(0.01 * 4_427, 44.27, 'one point of the match');
});
