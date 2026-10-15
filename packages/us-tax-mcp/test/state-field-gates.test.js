// THE GATES, MEASURED.
//
// `STATE_FIELDS` pairs every argument of `state_income_tax` with the states that
// read it, and the loop at the end of that tool REFUSES the argument for any
// other state. The refusal is deliberate and the module's header argues for it:
// a silently ignored field is a wrong answer with no symptom.
//
// But a refusal is only as good as the list behind it, and on Day 51 ELEVEN of
// those lists were wrong — all eleven hand-written, all eleven refusing a field
// that moves the tax of a state they omitted:
//
//   taxableSocialSecurity   15 states, up to $1,206.16 of Minnesota tax
//   dependentAges           10 states, including South Carolina's under-6 deduction
//   retirementIncome         8 states
//   spouseAge                6 states
//   filerAge                 5 states, including the state where age decides
//                            the whole retirement answer
//   stateItemizedDeductions  3; netCapitalGain, lesserSpouseIncome 2 each;
//   socialSecurityAndMedicarePaid, propertyTaxPaid, rentPaid 1 each
//
// A FIELD REFUSED WITH A FALSE EXPLANATION IS WORSE THAN A FIELD SILENTLY
// DROPPED, because the message names the states that do read it and the caller
// believes it. A model asking about a Minnesota retiree was told Minnesota does
// not read a Social Security benefit.
//
// This file is the instrument that makes the lists safe rather than correct. It
// cannot prove a list complete — a field may move a state's tax in a household
// no probe here reaches — but it fails on every drift it can see, and the eleven
// it found on its first run are the measure of what it is worth.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { STATE_FIELDS } from '../dist/state-fields.js';
import { stateIncomeTax, SUPPORTED_STATES } from '../dist/state-engine/index.js';

const FEDERAL_DEDUCTION = { single: 15_750, marriedFilingJointly: 31_500 };

/**
 * A plausible probe value per field, by its declared schema type.
 *
 * String fields are skipped and that is the instrument's declared bound: a
 * county, city or school district name is state-specific and a wrong one throws
 * rather than answering, so this cannot ask them the question. Those four gates
 * are checked by the locality suites instead.
 */
const probe = (field) => {
  if (field.name === 'dependentAges') return [4, 8];
  switch (field.schema?.type) {
    case 'number':
      return 12_000;
    case 'boolean':
      return true;
    case 'integer':
      return field.name.endsWith('Age') ? 70 : 1;
    default:
      return undefined;
  }
};

const household = (state, filingStatus, agi, extra) => {
  const deduction = FEDERAL_DEDUCTION[filingStatus];
  return {
    state,
    year: 2026,
    filingStatus,
    federal: {
      adjustedGrossIncome: agi,
      taxableIncome: Math.max(0, agi - deduction),
      deduction,
      deductionKind: 'standard',
    },
    // The three own-base states, so they answer rather than throw. The figures
    // only have to be COMPARABLE: the same number goes into both sides.
    massachusettsFivePercentIncome: agi,
    newJerseyGrossIncome: agi,
    pennsylvaniaTaxableIncome: agi,
    ...extra,
  };
};

test('no state field is refused for a state whose tax it moves', () => {
  const drift = [];
  let asked = 0;
  for (const field of STATE_FIELDS) {
    const value = probe(field);
    if (value === undefined) continue;
    const moved = new Set();
    for (const state of SUPPORTED_STATES) {
      for (const filingStatus of ['single', 'marriedFilingJointly']) {
        // Four incomes, because a credit limit or a phase-out can hide a field
        // at every income but one.
        for (const agi of [20_000, 45_000, 90_000, 250_000]) {
          // And three household shapes, because an age provision needs an age
          // and a dependent provision needs a dependent.
          for (const extra of [
            {},
            { filerAge: 70, spouseAge: 70 },
            { dependents: 2, dependentAges: [4, 8] },
          ]) {
            let without;
            let withIt;
            try {
              without = stateIncomeTax(household(state, filingStatus, agi, extra));
              withIt = stateIncomeTax(
                household(state, filingStatus, agi, { ...extra, [field.name]: value }),
              );
            } catch {
              // A required field missing, or a state that refuses this input
              // outright. Not a comparison, so not a verdict.
              continue;
            }
            asked++;
            if (Math.abs(without.tax - withIt.tax) > 0.005) moved.add(state);
          }
        }
      }
    }
    const missing = [...moved].filter((s) => !field.states.includes(s)).sort();
    if (missing.length > 0) drift.push(`${field.name}: refused for ${missing.join(', ')}`);
  }
  // The count is asserted for the reason Day 50 learned the hard way: a sweep
  // that silently stopped comparing passes a one-directional assertion
  // perfectly. A checker whose default is to print rather than to verify will be
  // mistaken for a pass, and a checker that verified nothing is the same thing.
  assert.ok(asked > 20_000, `comparisons made: ${asked}`);
  assert.deepEqual(drift, [], 'state fields refused for a state whose tax they move');
});

test('the gate still refuses a field the state genuinely does not read', () => {
  // The fix is a wider list and not a removed check, so the check has to still
  // bite. Pennsylvania reads no dependent ages, no county and no Social
  // Security subtraction.
  const field = STATE_FIELDS.find((f) => f.name === 'county');
  assert.ok(!field.states.includes('PA'), 'county is not a Pennsylvania field');
  const ages = STATE_FIELDS.find((f) => f.name === 'yonkersNonresidentEarnings');
  assert.deepEqual([...ages.states], ['NY'], 'Yonkers is in New York and nowhere else');
});
