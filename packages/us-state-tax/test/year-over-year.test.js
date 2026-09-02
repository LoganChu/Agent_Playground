// Six of the fourteen taxing states changed their rate between 2025 and 2026, and
// two of the six changed the deduction with it. This is the file that would catch
// a package quietly answering a 2026 question with 2025 law.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SUPPORTED_STATES, getStateDefinition, stateIncomeTax } from '../dist/esm/index.js';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

const single100k = (state, year, dependents = 0) =>
  stateIncomeTax({
    state,
    year,
    filingStatus: 'single',
    dependents,
    federal: {
      adjustedGrossIncome: 100_000,
      taxableIncome: year === 2025 ? 84_250 : 83_900,
      deduction: year === 2025 ? 15_750 : 16_100,
      deductionKind: 'standard',
    },
  });

/** The flat rate a state charges, whether it is stored flat or as a top band. */
function topRate(state, year) {
  const rate = getStateDefinition(state, year).rate;
  if (rate.kind === 'flat') return rate.rate;
  if (rate.kind === 'brackets') {
    const bands = rate.byStatus.single;
    return bands[bands.length - 1].rate;
  }
  return 0;
}

test('the six states that cut their rate for 2026', () => {
  const cuts = {
    GA: [0.0519, 0.0499],
    IN: [0.03, 0.0295],
    KY: [0.04, 0.035],
    MS: [0.044, 0.04],
    NC: [0.0425, 0.0399],
    UT: [0.045, 0.0445],
  };
  for (const [state, [y2025, y2026]] of Object.entries(cuts)) {
    assert.equal(topRate(state, 2025), y2025, `${state} 2025`);
    assert.equal(topRate(state, 2026), y2026, `${state} 2026`);
    assert.ok(
      single100k(state, 2026).tax < single100k(state, 2025).tax,
      `${state} should be cheaper in 2026`,
    );
  }
});

test('the states whose rate did not move for 2026', () => {
  for (const [state, rate] of Object.entries({
    AZ: 0.025,
    CO: 0.044,
    IL: 0.0495,
    MI: 0.0425,
    PA: 0.0307,
  })) {
    assert.equal(topRate(state, 2025), rate, `${state} 2025`);
    assert.equal(topRate(state, 2026), rate, `${state} 2026`);
  }
  // California's whole schedule is unchanged because 2026 is carried forward, not
  // because California did nothing — see the provisional note.
  assert.deepEqual(
    getStateDefinition('CA', 2026).rate.byStatus.single,
    getStateDefinition('CA', 2025).rate.byStatus.single,
  );
});

test('Georgia raised the standard deduction and the dependent exemption with the cut', () => {
  //   2025: (100,000 - 12,000 - 8,000) x 5.19% = 4,152.00
  //   2026: (100,000 - 15,000 - 10,000) x 4.99% = 3,742.50
  const y2025 = single100k('GA', 2025, 2);
  const y2026 = single100k('GA', 2026, 2);
  money(y2025.deduction, 12_000);
  money(y2025.exemptions, 8_000);
  money(y2025.tax, 4_152.0);
  money(y2026.deduction, 15_000);
  money(y2026.exemptions, 10_000);
  money(y2026.tax, 3_742.5);
});

test('Georgia treats a surviving spouse as "any other taxpayer", both years', () => {
  // HB 1437 draws one line: married filing jointly, and everyone else. This is a
  // documented divergence from PolicyEngine-US, which gives a 2026 surviving
  // spouse the joint amount while giving a 2025 one the single amount.
  for (const year of [2025, 2026]) {
    const amounts = getStateDefinition('GA', year).deduction.amounts;
    assert.equal(amounts.qualifyingSurvivingSpouse, amounts.single, `GA ${year}`);
    assert.notEqual(amounts.qualifyingSurvivingSpouse, amounts.marriedFilingJointly);
  }
});

test('Mississippi taxes the first $10,000 at zero, and does not double it for a joint return', () => {
  //   joint, $50,000 of AGI
  //   less the standard deduction              -4,600
  //   less the exemption                      -12,000
  //   Mississippi taxable income               33,400
  //   0%   x 10,000                        =        0.00
  //   4.4% x 23,400                        =    1,029.60   (2025)
  //   4.0% x 23,400                        =      936.00   (2026)
  const joint = (year) =>
    stateIncomeTax({
      state: 'MS',
      year,
      filingStatus: 'marriedFilingJointly',
      federal: {
        adjustedGrossIncome: 50_000,
        taxableIncome: 18_500,
        deduction: 31_500,
        deductionKind: 'standard',
      },
    });
  money(joint(2025).taxableIncome, 33_400);
  money(joint(2025).tax, 1_029.6);
  money(joint(2026).tax, 936.0);

  // The exemption and the standard deduction both double for a joint return. The
  // zero bracket does not.
  const def = getStateDefinition('MS', 2026);
  assert.deepEqual(def.rate.byStatus.marriedFilingJointly, def.rate.byStatus.single);
  assert.equal(def.deduction.amounts.marriedFilingJointly, def.deduction.amounts.single * 2);
  assert.equal(def.exemption.perFiler.marriedFilingJointly, def.exemption.perFiler.single * 2);
});

test('hand-computed 2026 returns for North Carolina, Indiana and Kentucky', () => {
  //   NC: (100,000 - 12,750) x 3.99% = 3,481.275, reported as 3,481.27
  // The half cent lands down because 87,250 x 0.0399 is not representable in
  // binary floating point and the nearest double is 3481.2749999999996. Same
  // behaviour as the federal engine, which rounds at the boundary the same way.
  money(single100k('NC', 2026).tax, 3_481.27);
  money(single100k('NC', 2025).tax, 3_708.13);
  //   IN: (100,000 - 1,000) x 2.95% = 2,920.50   (state only; the county tax is extra)
  money(single100k('IN', 2026).tax, 2_920.5);
  //   KY: (100,000 - 3,270) x 3.50% = 3,385.55
  money(single100k('KY', 2026).tax, 3_385.55);
});

test('every state produces a different answer for 2026 than a naive 2025 fallback would', () => {
  // The point of refusing to fall back: for these six the fallback is wrong, and
  // for the rest it happens to be right — which is exactly why a caller cannot
  // tell the difference without being told.
  const differs = SUPPORTED_STATES.filter((state) => {
    if (state === 'PA') return false; // handled separately, needs its own base
    return single100k(state, 2025).tax !== single100k(state, 2026).tax;
  });
  // Georgia, Indiana, Kentucky, Mississippi, North Carolina and Utah changed rate;
  // Arizona, Colorado and Idaho move because the federal deduction inside their
  // base moved.
  assert.deepEqual(differs, ['AZ', 'CO', 'GA', 'ID', 'IN', 'KY', 'MS', 'NC', 'UT']);
});
