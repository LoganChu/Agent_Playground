// An unknown key in the `retirement` split is an error, not a default.
//
// ## Why this file exists, which is the third time
//
// Day 32's rule: *accepting an input is not reading it.* Day 33's inverse, written
// after a test passed against an empty household because it set `wages` where the
// field is `w2Wages`: *supplying an input is not passing it.* Day 34 walked into it
// again, writing `retirement.filer.pension` for `employerPlanPension` while
// building the status sweep — eighteen households with no retirement income in
// them, in a battery whose entire job is to reach retirement rules, and every
// assertion passing.
//
// **THE RULE: three occurrences of one mistake is a missing guard, not three
// mistakes.**
//
// The cost of the silent drop is not an error, it is a wrong tax. The key is
// ignored, the person has no pension, and every exclusion, subtraction and credit
// that reads one comes back as if the retiree had none — which in Maryland moves up
// to $41,200 of income into the taxable base and returns a plausible number.
//
// TypeScript catches this at compile time and nothing catches it at run time, which
// is no help at all to the callers who matter most: `us-tax-mcp` receives its input
// as JSON from a language model, and a model writing `pension` for a pension is the
// single most likely input error this package will ever see.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PERSON_RETIREMENT_FIELDS, stateIncomeTax } from './strict.mjs';

const retiree = (retirement) => ({
  state: 'MD',
  year: 2026,
  filingStatus: 'single',
  filerAge: 70,
  retirement,
  federal: {
    adjustedGrossIncome: 80_000,
    taxableIncome: 63_900,
    deduction: 16_100,
    deductionKind: 'standard',
  },
});

test('a field of PersonRetirementIncome that does not exist is rejected', () => {
  assert.throws(() => stateIncomeTax(retiree({ filer: { pension: 50_000 } })), {
    name: 'RangeError',
    message: /retirement\.filer\.pension is not a field/,
  });
  // The suggestion is the point of the message: the two fields that contain the
  // word are the two a caller could have meant, and which one they meant changes
  // the answer by thousands of dollars in Maryland and Kentucky.
  //
  // Day 38 moved this rule into `nearestFields`, shared with the top-level
  // guard, and the order changed with it: both fields share the same seven
  // characters with `pension`, so the tie goes to the one closest in length.
  // Declaration order was what put `employerPlanPension` first before, which is
  // not a reason for anything.
  assert.throws(() => stateIncomeTax(retiree({ filer: { pension: 50_000 } })), {
    message: /Did you mean `governmentPension` or `employerPlanPension`\?/,
  });
  assert.throws(() => stateIncomeTax(retiree({ spouse: { socialSecurity: 20_000 } })), {
    message: /Did you mean `socialSecurityBenefits`\?/,
  });
  // No near match: list them all rather than guess.
  assert.throws(() => stateIncomeTax(retiree({ filer: { w2Wages: 1_000 } })), {
    message: /The fields are `employerPlanPension`, `definedContributionPlan`, `socialSecurityBenefits`/,
  });
});

test('an unknown key on the split itself is rejected too', () => {
  assert.throws(() => stateIncomeTax(retiree({ spouce: { employerPlanPension: 1 } })), {
    name: 'RangeError',
    message: /retirement\.spouce is not a field of RetirementIncomeSplit/,
  });
});

test('a typo throws in a state with no income tax as well', () => {
  // Before the `rate.kind === 'none'` early return on purpose. A caller who tests
  // against Texas first and Maryland later would otherwise be told their input is
  // fine by the state that reads none of it.
  assert.throws(
    () => stateIncomeTax({ ...retiree({ filer: { pension: 50_000 } }), state: 'TX' }),
    /not a field of PersonRetirementIncome/,
  );
});

test('every documented field is accepted, and an empty split is fine', () => {
  // The other half of the guard: a list that is too SHORT rejects a field the type
  // allows, and that failure would be as silent as the one this file is about —
  // silent until a caller who used the field complained. `types.ts` also proves the
  // list exhaustive at compile time; this proves the engine agrees at run time.
  const everyField = {
    employerPlanPension: 1_000,
    definedContributionPlan: 1_500,
    socialSecurityBenefits: 2_000,
    militaryRetirement: 3_000,
    iraDistributions: 4_000,
    investmentIncome: 5_000,
    earnedIncome: 6_000,
    governmentPension: 7_000,
    serviceMonthsBefore1998: 120,
    serviceMonthsAfter1997: 60,
    totallyDisabled: false,
  };
  assert.deepEqual(Object.keys(everyField).sort(), [...PERSON_RETIREMENT_FIELDS].sort());
  assert.doesNotThrow(() => stateIncomeTax(retiree({ filer: everyField, spouse: everyField })));
  assert.doesNotThrow(() => stateIncomeTax(retiree({})));
  assert.doesNotThrow(() => stateIncomeTax(retiree({ filer: {} })));
  assert.doesNotThrow(() => stateIncomeTax({ ...retiree(undefined) }));
});

test('the guard reads every state, not just the one it was written for', () => {
  // A validation that lives in one state's branch is a validation for one state.
  for (const state of ['CA', 'GA', 'KY', 'MI', 'NJ', 'NY', 'OH', 'PA', 'UT', 'VA']) {
    assert.throws(
      () => stateIncomeTax({ ...retiree({ filer: { pension: 1 } }), state }),
      /not a field of PersonRetirementIncome/,
      state,
    );
  }
});
