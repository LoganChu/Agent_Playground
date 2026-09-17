// Which states tax Social Security, and the field that said so and was ignored.
//
// Thirty-seven of the forty-one states with an income tax do not tax Social
// Security benefits. Until v0.18.0 this package subtracted them in **four**
// states — Georgia, Kentucky, Maryland and Virginia — and taxed them in ten
// others that exempt them by statute, while accepting `taxableSocialSecurity`
// on every one of those returns and using it only for Utah's credits and
// Virginia's age deduction.
//
// That is the failure mode this package exists to refuse: a field the caller
// supplied, accepted without complaint, and silently not applied. There is
// nothing in the result to say the answer is too high. Day 22 found the same
// shape in `county` on an Alaska return; this one was worth up to $1,200 a year
// to a single retiree and had been shipped since state coverage began.
//
// It was found by running PolicyEngine-US over the same 437 households — see
// `tools/differential/`. Not one of this package's 377 shipped tests noticed, because
// not one of them put a retiree in Arizona, California, Idaho, Illinois,
// Indiana, Michigan, Mississippi, North Carolina, New York or Ohio. **A test
// suite that is organised by feature has a hole exactly where no feature was
// claimed.**
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getStateDefinition, stateIncomeTax } from '../dist/esm/index.js';

/**
 * Every state here whose statute writes federally-taxable Social Security back
 * out of the state base, with the provision that does it.
 */
const EXEMPT = [
  ['AZ', 'A.R.S. § 43-1022(2)'],
  ['CA', 'R&TC § 17087'],
  ['GA', 'O.C.G.A. § 48-7-27(a)(3)'],
  ['ID', 'Idaho Code § 63-3022'],
  ['IL', '35 ILCS 5/203(a)(2)(F)'],
  ['IN', 'IC 6-3-1-3.5(a)'],
  ['KY', 'KRS 141.010'],
  ['MD', 'Md. Code, Tax-Gen. § 10-207(f)'],
  ['MI', 'MCL 206.30(1)(f)'],
  ['MS', 'Miss. Code § 27-7-15(4)(g)'],
  ['NC', 'G.S. § 105-153.5(b)(5)'],
  ['NY', 'N.Y. Tax Law § 612(c)(3)(ii)'],
  ['OH', 'R.C. 5747.01(A)(5)'],
  ['VA', 'Va. Code § 58.1-322.02(5)'],
];

/** A retiree return: federal AGI containing a § 86 amount, and nothing else. */
const retiree = (state, opts = {}) =>
  stateIncomeTax({
    state,
    year: 2026,
    filingStatus: 'single',
    federal: {
      adjustedGrossIncome: 60_000,
      taxableIncome: 36_200,
      deduction: 23_800,
      deductionKind: 'standard',
    },
    filerAge: 70,
    ...opts,
  });

test('every exempt state removes the taxable benefit from its base', () => {
  for (const [state, cite] of EXEMPT) {
    const withBenefit = retiree(state, { taxableSocialSecurity: 20_000 });
    const without = retiree(state, { taxableSocialSecurity: 0 });
    assert.ok(
      withBenefit.tax < without.tax - 1,
      `${state} (${cite}) taxed the benefit: ${withBenefit.tax} vs ${without.tax}`,
    );
  }
});

test('the subtraction is named on the return rather than netted silently', () => {
  for (const [state] of EXEMPT) {
    const result = retiree(state, { taxableSocialSecurity: 20_000 });
    const named = (result.computedSubtractions ?? []).some((s) =>
      s.name.toLowerCase().includes('social security'),
    );
    assert.ok(named, `${state} did not name the subtraction`);
  }
});

test('the definitions agree with the list, in both directions', () => {
  // The over-restriction direction is the one that feels redundant and is the
  // one that catches a state added later with the flag left off.
  const codes = new Set(EXEMPT.map(([code]) => code));
  for (const [code] of EXEMPT) {
    assert.equal(
      getStateDefinition(code, 2026)?.subtractsTaxableSocialSecurity,
      true,
      `${code} should subtract`,
    );
  }
  for (const code of ['UT', 'CO']) {
    assert.ok(!codes.has(code), `${code} is not in the exempt list`);
    assert.notEqual(
      getStateDefinition(code, 2026)?.subtractsTaxableSocialSecurity,
      true,
      `${code} taxes the benefit and must not subtract it`,
    );
  }
});

test('Utah taxes the benefit and hands the tax back, which is not the same thing', () => {
  // The two routes differ above the credit's threshold, which is the whole
  // reason Utah is not on the list: a subtraction is unconditional and the
  // credit is withdrawn at 2.5 cents on the dollar.
  const below = stateIncomeTax({
    state: 'UT',
    year: 2026,
    filingStatus: 'marriedFilingJointly',
    federal: { adjustedGrossIncome: 70_000, deduction: 0, deductionKind: 'standard' },
    taxableSocialSecurity: 20_000,
    filerAge: 70,
    spouseAge: 70,
  });
  const above = stateIncomeTax({
    state: 'UT',
    year: 2026,
    filingStatus: 'marriedFilingJointly',
    federal: { adjustedGrossIncome: 140_000, deduction: 0, deductionKind: 'standard' },
    taxableSocialSecurity: 20_000,
    filerAge: 70,
    spouseAge: 70,
  });
  const credit = (r) =>
    r.credits.find((c) => c.name.toLowerCase().includes('social security'))?.amount ?? 0;
  assert.ok(credit(below) > 0, 'below the threshold the benefit is free');
  assert.equal(credit(above), 0, 'above it the credit is gone and the benefit is taxed');
});

test('Colorado taxes it, and this package does not yet model the subtraction', () => {
  // C.R.S. § 39-22-104(4)(f) subtracts all federally taxable Social Security
  // for a filer 65 or over. This package does not, so a Colorado retiree
  // computes too HIGH — recorded here so the gap is a test rather than a note.
  const co = retiree('CO', { taxableSocialSecurity: 20_000 });
  const none = retiree('CO', { taxableSocialSecurity: 0 });
  assert.equal(co.tax, none.tax, 'Colorado currently ignores the benefit either way');
});

test('a pension supplied per person reaches the rules that read one figure', () => {
  // `retirementIncome` and `retirement` are the same fact at two resolutions.
  // Ohio's retirement income credit read only the first, so a caller who gave
  // the *more* detailed one got a zero credit and no complaint. The differential
  // test found it as a flat $200 on every Ohio retiree.
  const perPerson = stateIncomeTax({
    state: 'OH',
    year: 2026,
    filingStatus: 'marriedFilingJointly',
    federal: {
      adjustedGrossIncome: 90_000,
      taxableIncome: 57_800,
      deduction: 32_200,
      deductionKind: 'standard',
    },
    filerAge: 70,
    spouseAge: 70,
    taxableSocialSecurity: 20_000,
    retirement: { filer: { employerPlanPension: 50_000 } },
  });
  const scalar = stateIncomeTax({
    state: 'OH',
    year: 2026,
    filingStatus: 'marriedFilingJointly',
    federal: {
      adjustedGrossIncome: 90_000,
      taxableIncome: 57_800,
      deduction: 32_200,
      deductionKind: 'standard',
    },
    filerAge: 70,
    spouseAge: 70,
    taxableSocialSecurity: 20_000,
    retirementIncome: 50_000,
  });
  const credit = (r) =>
    r.credits.find((c) => c.name.toLowerCase().includes('retirement'))?.amount ?? 0;
  assert.equal(credit(perPerson), credit(scalar), 'the two spellings agree');
  assert.ok(credit(perPerson) > 0, 'and the credit is actually granted');
});
