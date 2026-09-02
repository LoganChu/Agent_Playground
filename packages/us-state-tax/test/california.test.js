import { test } from 'node:test';
import assert from 'node:assert/strict';

import { doubled, getStateDefinition, stateIncomeTax } from '../dist/esm/index.js';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

const fed = (agi, deduction = 5706) => ({
  adjustedGrossIncome: agi,
  taxableIncome: agi - deduction,
  deduction,
  deductionKind: 'standard',
});

/**
 * The 2024 California figures, as published by the Franchise Tax Board.
 *
 * These are here as a *provenance* test rather than as data: California indexes
 * its brackets, its standard deduction, its exemption credits and its exemption
 * phase-out thresholds by one factor (R&TC § 17041(h)), so if all thirteen 2025
 * figures fall out of the 2024 ones multiplied by a single number, then either
 * every one of them is right or the same wrong factor was applied to all of them.
 * That is a much stronger check than transcribing 2025 twice.
 */
const CA_2024 = {
  singleThresholds: [10756, 25499, 40245, 55866, 70606, 360659, 432787, 721314],
  standardDeductionSingle: 5540,
  standardDeductionJoint: 11080,
  personalExemptionCredit: 149,
  dependentExemptionCredit: 461,
  phaseOutStartSingle: 244857,
  phaseOutStartJoint: 489719,
  phaseOutStartHeadOfHousehold: 367291,
};

test('the 2025 California figures are the 2024 ones indexed by a single factor of 1.030', () => {
  const factor = 1.03;
  const indexed = (x) => Math.round(x * factor);
  const def = getStateDefinition('CA', 2025);

  const stored = def.rate.byStatus.single.slice(0, 8).map((b) => b.upTo);
  assert.deepEqual(stored, CA_2024.singleThresholds.map(indexed));

  assert.equal(def.deduction.amounts.single, indexed(CA_2024.standardDeductionSingle));
  assert.equal(def.deduction.amounts.marriedFilingJointly, indexed(CA_2024.standardDeductionJoint));
  assert.equal(def.exemptionCredit.perFiler.single, indexed(CA_2024.personalExemptionCredit));
  assert.equal(def.exemptionCredit.perDependent, indexed(CA_2024.dependentExemptionCredit));
  assert.equal(def.exemptionCredit.phaseOut.start.single, indexed(CA_2024.phaseOutStartSingle));
  assert.equal(
    def.exemptionCredit.phaseOut.start.marriedFilingJointly,
    indexed(CA_2024.phaseOutStartJoint),
  );
  assert.equal(
    def.exemptionCredit.phaseOut.start.headOfHousehold,
    indexed(CA_2024.phaseOutStartHeadOfHousehold),
  );
});

test('the joint schedule is the single schedule doubled, and separate is single unchanged', () => {
  // R&TC § 17041(a)(2). Stored as a derivation rather than as a second table, so
  // there is no second table to transcribe wrong.
  const def = getStateDefinition('CA', 2025);
  assert.deepEqual(def.rate.byStatus.marriedFilingJointly, doubled(def.rate.byStatus.single));
  assert.deepEqual(def.rate.byStatus.marriedFilingSeparately, def.rate.byStatus.single);
  assert.deepEqual(
    def.rate.byStatus.qualifyingSurvivingSpouse,
    def.rate.byStatus.marriedFilingJointly,
  );
  // Head of household is its own schedule and is NOT derived from either.
  assert.notDeepEqual(def.rate.byStatus.headOfHousehold, def.rate.byStatus.single);
  assert.notDeepEqual(def.rate.byStatus.headOfHousehold, def.rate.byStatus.marriedFilingJointly);
});

test('the Mental Health Services Tax threshold is the one thing not doubled for a joint return', () => {
  // A married couple at $1,200,000 of California taxable income pays it. Two
  // single filers at $600,000 each — the same money, the same schedule doubled —
  // do not. This is a $2,000 marriage penalty that exists nowhere in the brackets.
  const couple = stateIncomeTax({
    state: 'CA',
    year: 2025,
    filingStatus: 'marriedFilingJointly',
    federal: fed(1_211_412, 11_412),
  });
  money(couple.taxableIncome, 1_200_000);
  assert.equal(couple.surtaxes.length, 1);
  money(couple.surtaxes[0].amount, 2_000, '1% of the $200,000 over the threshold');

  const oneSingle = stateIncomeTax({
    state: 'CA',
    year: 2025,
    filingStatus: 'single',
    federal: fed(605_706),
  });
  money(oneSingle.taxableIncome, 600_000);
  assert.equal(oneSingle.surtaxes.length, 0, 'no surtax below $1,000,000');
});

test('the exemption credit is a credit, so it is worth the same at 1% and at 12.3%', () => {
  // Modelling it as a deduction would make it worth $1.53 to the first filer and
  // $18.82 to the second. It is worth $153 to both.
  const low = stateIncomeTax({
    state: 'CA',
    year: 2025,
    filingStatus: 'single',
    federal: fed(15_706),
  });
  const high = stateIncomeTax({
    state: 'CA',
    year: 2025,
    filingStatus: 'single',
    federal: fed(205_706),
  });
  money(low.credits[0].amount, 153);
  money(high.credits[0].amount, 153);
  assert.equal(low.exemptions, 0, 'California exemptions never reduce income');
});

test('a non-refundable credit cannot take the California tax below zero', () => {
  // $10,000 of taxable income generates $100 of tax against a $153 credit.
  const r = stateIncomeTax({
    state: 'CA',
    year: 2025,
    filingStatus: 'single',
    federal: fed(15_706),
  });
  money(r.taxBeforeCredits, 100);
  money(r.tax, 0);
});

test('the exemption credit phases out in whole $2,500 steps, per exemption', () => {
  const at = (agi, dependents = 0) =>
    stateIncomeTax({
      state: 'CA',
      year: 2025,
      filingStatus: 'single',
      federal: fed(agi),
      dependents,
    }).credits[0].amount;

  money(at(252_203), 153, 'at the threshold exactly, the credit is whole');
  money(at(252_204), 147, 'one dollar over costs the full first $6 step');
  money(at(254_703), 147, 'and nothing more until the step closes');
  money(at(254_704), 141, 'then another $6');

  // "Multiply by the number of exemptions": with two dependents the same dollar
  // costs $18, and the credit being phased out is $1,103 rather than $153.
  money(at(252_203, 2), 153 + 950);
  money(at(252_204, 2), 153 + 950 - 18);
});

test('at a phase-out step boundary the marginal rate is a dollar figure, not a rate', () => {
  // Measured by running the whole computation one dollar higher. A rate schedule
  // cannot see this: 9.3 cents of bracket plus $6 of lost credit on one dollar.
  const r = stateIncomeTax({
    state: 'CA',
    year: 2025,
    filingStatus: 'single',
    federal: fed(252_203),
  });
  money(r.marginalRate, 6.093);
});

test('a hand-computed California single return at $100,000 of wages', () => {
  //   AGI                                     100,000.00
  //   less the 2025 standard deduction         -5,706.00
  //   California taxable income                94,294.00
  //
  //   1%    x 11,079                     =        110.79
  //   2%    x (26,264 - 11,079)          =        303.70
  //   4%    x (41,452 - 26,264)          =        607.52
  //   6%    x (57,542 - 41,452)          =        965.40
  //   8%    x (72,724 - 57,542)          =      1,214.56
  //   9.3%  x (94,294 - 72,724)          =      2,006.01
  //                                            ---------
  //   tax before credits                        5,207.98
  //   less the personal exemption credit         -153.00
  //   California tax                            5,054.98
  const r = stateIncomeTax({
    state: 'CA',
    year: 2025,
    filingStatus: 'single',
    federal: fed(100_000),
  });
  money(r.taxableIncome, 94_294);
  money(r.taxBeforeCredits, 5_207.978);
  money(r.tax, 5_054.978);
  money(r.marginalRate, 0.093);
  assert.ok(Math.abs(r.effectiveRate - 0.0505) < 0.0001);
});

test('California 2026 is provisional and says exactly what is carried forward', () => {
  const def = getStateDefinition('CA', 2026);
  assert.equal(def.status, 'provisional');
  assert.match(def.notes[0], /^PROVISIONAL:/);
  assert.match(def.notes[0], /rates themselves are statutory/);
  // Carrying thresholds forward leaves income in higher bands, so the provisional
  // figure is an over-estimate, and the note says which direction it errs in.
  assert.match(def.notes[0], /HIGH/);
  const y2025 = stateIncomeTax({ state: 'CA', year: 2025, filingStatus: 'single', federal: fed(100_000) });
  const y2026 = stateIncomeTax({ state: 'CA', year: 2026, filingStatus: 'single', federal: fed(100_000) });
  assert.equal(y2026.tax, y2025.tax);
  assert.equal(y2026.provisional, true);
  assert.equal(y2025.provisional, false);
});
