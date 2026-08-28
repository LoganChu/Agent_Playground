import assert from 'node:assert/strict';
import test from 'node:test';

import {
  estimateFederalTax,
  saltCapParameters,
  stateAndLocalTaxDeduction,
} from '../dist/esm/index.js';

const salt = (over) =>
  stateAndLocalTaxDeduction({
    filingStatus: 'marriedFilingJointly',
    year: 2026,
    stateAndLocalTaxesPaid: 60_000,
    adjustedGrossIncome: 400_000,
    ...over,
  });

// --------------------------------------------------------------------------
// Parameters
// --------------------------------------------------------------------------

test('2026 SALT cap parameters', () => {
  const p = saltCapParameters(2026);
  assert.equal(p.cap.single, 40_400);
  assert.equal(p.cap.marriedFilingJointly, 40_400);
  assert.equal(p.cap.headOfHousehold, 40_400);
  assert.equal(p.cap.qualifyingSurvivingSpouse, 40_400);
  // Halved for a separate return — cap, threshold and floor alike.
  assert.equal(p.cap.marriedFilingSeparately, 20_200);
  assert.equal(p.phaseDownThreshold.single, 505_000);
  assert.equal(p.phaseDownThreshold.marriedFilingSeparately, 252_500);
  assert.equal(p.floor.single, 10_000);
  assert.equal(p.floor.marriedFilingSeparately, 5_000);
  assert.equal(p.phaseDownRate, 0.3);
  assert.equal(p.finalYear, 2029);
});

test('the cap is not doubled on a joint return — only halved on a separate one', () => {
  const p = saltCapParameters(2026);
  assert.equal(p.cap.marriedFilingJointly, p.cap.single);
  assert.equal(p.phaseDownThreshold.marriedFilingJointly, p.phaseDownThreshold.single);
});

// --------------------------------------------------------------------------
// The cap itself
// --------------------------------------------------------------------------

test('below the threshold the full cap applies', () => {
  const r = salt({ adjustedGrossIncome: 400_000 });
  assert.equal(r.excessIncome, 0);
  assert.equal(r.phaseDownReduction, 0);
  assert.equal(r.cap, 40_400);
  assert.equal(r.deduction, 40_400);
  assert.equal(r.limitedByCap, true);
});

test('taxes below the cap are deductible in full', () => {
  const r = salt({ stateAndLocalTaxesPaid: 12_000 });
  assert.equal(r.deduction, 12_000);
  assert.equal(r.limitedByCap, false);
});

test('the phase-down takes 30 cents per dollar of MAGI over the threshold', () => {
  const r = salt({ adjustedGrossIncome: 545_000 });
  assert.equal(r.excessIncome, 40_000);
  assert.equal(r.phaseDownReduction, 12_000); // 30% of 40,000
  assert.equal(r.cap, 28_400);
  assert.equal(r.deduction, 28_400);
});

test('the phase-down is continuous — one dollar of excess costs exactly 30 cents', () => {
  const at = salt({ adjustedGrossIncome: 505_000 }).cap;
  const justOver = salt({ adjustedGrossIncome: 505_001 }).cap;
  assert.equal(at, 40_400);
  assert.equal(justOver, 40_399.7);
});

test('the cap never falls below the $10,000 floor', () => {
  // 40,400 − 10,000 = 30,400 of cap to lose at 30 cents per dollar, so the floor
  // is reached exactly $101,333.33 above the threshold.
  const justBelow = salt({ adjustedGrossIncome: 606_000 });
  const atFloor = salt({ adjustedGrossIncome: 606_333.34 });
  const wayOver = salt({ adjustedGrossIncome: 2_000_000 });
  assert.equal(justBelow.cap, 10_100);
  assert.equal(atFloor.cap, 10_000);
  assert.equal(wayOver.cap, 10_000);
  assert.equal(wayOver.phaseDownReduction, 30_400);
});

test('a separate return halves the cap, the threshold and the floor together', () => {
  const r = stateAndLocalTaxDeduction({
    filingStatus: 'marriedFilingSeparately',
    year: 2026,
    stateAndLocalTaxesPaid: 60_000,
    adjustedGrossIncome: 272_500, // $20,000 over its own $252,500 threshold
  });
  assert.equal(r.statutoryCap, 20_200);
  assert.equal(r.excessIncome, 20_000);
  assert.equal(r.phaseDownReduction, 6_000);
  assert.equal(r.cap, 14_200);

  const wayOver = stateAndLocalTaxDeduction({
    filingStatus: 'marriedFilingSeparately',
    year: 2026,
    stateAndLocalTaxesPaid: 60_000,
    adjustedGrossIncome: 1_000_000,
  });
  assert.equal(wayOver.cap, 5_000);
});

test('excluded foreign income is added back before the phase-down', () => {
  const without = salt({ adjustedGrossIncome: 500_000 });
  const withExclusion = salt({
    adjustedGrossIncome: 500_000,
    foreignEarnedIncomeExclusion: 50_000,
  });
  assert.equal(without.excessIncome, 0);
  assert.equal(without.cap, 40_400);
  // § 164(b)(6) runs on AGI increased by § 911/931/933 exclusions.
  assert.equal(withExclusion.modifiedAdjustedGrossIncome, 550_000);
  assert.equal(withExclusion.cap, 26_900); // 40,400 − 30% × 45,000
});

test('an unknown filing status throws', () => {
  assert.throws(() => salt({ filingStatus: 'martian' }), TypeError);
});

// --------------------------------------------------------------------------
// The marginal-rate cliff the phase-down creates
// --------------------------------------------------------------------------

test('inside the phase-down band the marginal rate is 45.5%, not 35%', () => {
  // Every income point below sits in the 35% ordinary bracket, so the only thing
  // that varies is what the SALT phase-down does to the deduction.
  const at = (agi, saltPaid) =>
    estimateFederalTax({
      filingStatus: 'marriedFilingJointly',
      year: 2026,
      otherOrdinaryIncome: agi,
      stateAndLocalTaxesPaid: saltPaid,
      otherItemizedDeductions: 20_000,
    }).totalTax;

  // A filer whose state taxes exceed the cap, taking a $10,000 raise inside the
  // phase-down band: the raise is taxed at 35%, and it also destroys $3,000 of
  // deduction, which is taxed at 35% too.
  const insideBand = at(580_000, 45_000) - at(570_000, 45_000);
  // The same raise for someone whose state taxes are under the cap, so the
  // phase-down has nothing to bite on.
  const noPhaseDown = at(580_000, 8_000) - at(570_000, 8_000);
  // And the same raise once the $10,000 floor has been reached, where the cap
  // can fall no further.
  const aboveBand = at(710_000, 45_000) - at(700_000, 45_000);

  assert.equal(noPhaseDown, 3_500); // 35% of 10,000
  assert.equal(insideBand, 4_550); // 35% of 13,000
  assert.equal(aboveBand, 3_500); // back to normal

  assert.equal(insideBand / 10_000, 0.455);
  assert.ok(insideBand > aboveBand, 'the marginal rate goes up and then back down');
});

// --------------------------------------------------------------------------
// Integration with estimateFederalTax
// --------------------------------------------------------------------------

test('itemized components are capped, not taken at face value', () => {
  const r = estimateFederalTax({
    filingStatus: 'marriedFilingJointly',
    year: 2026,
    w2Wages: 300_000,
    stateAndLocalTaxesPaid: 55_000,
    otherItemizedDeductions: 18_000,
  });
  assert.equal(r.stateAndLocalTax.deduction, 40_400);
  assert.equal(r.deduction, 58_400); // 40,400 capped + 18,000
  assert.equal(r.deductionKind, 'itemized');
  assert.equal(r.taxableIncome, 241_600);
});

test('the standard deduction still wins when the capped total is smaller', () => {
  const r = estimateFederalTax({
    filingStatus: 'marriedFilingJointly',
    year: 2026,
    w2Wages: 300_000,
    stateAndLocalTaxesPaid: 25_000,
  });
  assert.equal(r.deductionKind, 'standard');
  assert.equal(r.deduction, 32_200);
  // The SALT detail is still reported, so a caller can see how near it was.
  assert.equal(r.stateAndLocalTax.deduction, 25_000);
});

test('a supplied itemized total is still honoured and reports no SALT detail', () => {
  const r = estimateFederalTax({
    filingStatus: 'marriedFilingJointly',
    year: 2026,
    w2Wages: 300_000,
    itemizedDeductions: 90_000,
  });
  assert.equal(r.stateAndLocalTax, null);
  assert.equal(r.deduction, 90_000);
});

test('supplying components overrides a supplied itemized total', () => {
  const r = estimateFederalTax({
    filingStatus: 'marriedFilingJointly',
    year: 2026,
    w2Wages: 300_000,
    itemizedDeductions: 999_999,
    stateAndLocalTaxesPaid: 55_000,
    otherItemizedDeductions: 18_000,
  });
  assert.equal(r.deduction, 58_400);
});

test('the SALT cap feeds through to the § 199A threshold', () => {
  // Identical filers except for state tax paid. The one in the high-tax state
  // does not get to deduct the excess, so their § 199A base — and therefore
  // their QBI deduction — is unchanged by it.
  const base = {
    filingStatus: 'marriedFilingJointly',
    year: 2026,
    otherOrdinaryIncome: 500_000,
    otherItemizedDeductions: 20_000,
    qualifiedBusinesses: [{ qualifiedBusinessIncome: 100_000 }],
  };
  const lowTax = estimateFederalTax({ ...base, stateAndLocalTaxesPaid: 40_400 });
  const highTax = estimateFederalTax({ ...base, stateAndLocalTaxesPaid: 80_000 });

  assert.equal(lowTax.deduction, 60_400);
  assert.equal(highTax.deduction, 60_400);
  assert.equal(
    highTax.section199A.taxableIncomeBeforeDeduction,
    lowTax.section199A.taxableIncomeBeforeDeduction,
  );
  assert.equal(highTax.section199A.deduction, lowTax.section199A.deduction);
});
