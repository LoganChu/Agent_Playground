/**
 * The per-state field split, and the three ways it can rot.
 *
 * `state_income_tax` used to describe all twenty-eight states' fields in a
 * schema every client loads on every session. It now carries a short pointer per
 * field — the name, the type, the state list — and the prose lives in
 * `describe_state`, which a caller reaches for one state's worth of.
 *
 * That is a saving of 7,800 bytes and it buys three new ways to be wrong:
 *
 *  1. A field is documented for a state that will refuse it, or refused for a
 *     state whose documentation claims it. Two copies of the same fact —
 *     `STATE_FIELDS[].states` and the validator — is a bug with a waiting
 *     period, so every pair is exercised against the real tool here.
 *  2. A field loses its documentation altogether, which is worse than the
 *     duplication it replaced: a model cannot tell an undocumented field from an
 *     unimportant one.
 *  3. The pointer stops pointing — `describe_state` is not named, or the field
 *     is not in the schema at all.
 *
 * This is the same argument as the three invariants Day 21's pointer rule needed
 * in `estimate_federal_tax`, one tool over, and it is load-bearing for the same
 * reason: the saving is only safe while the pointer is true.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';

import { TOOLS, ToolInputError } from '../dist/index.js';
import { STATE_FIELDS, fieldsForState, shortDescription } from '../dist/state-fields.js';

const stateTool = TOOLS.find((tool) => tool.name === 'state_income_tax');
const describeTool = TOOLS.find((tool) => tool.name === 'describe_state');
const ALL_STATES = stateTool.inputSchema.properties.state.enum;

/** A minimum legal call, for whichever state we are probing. */
const baseArgs = (state) => ({
  state,
  filingStatus: 'single',
  federalAdjustedGrossIncome: 60_000,
  federalTaxableIncome: 44_250,
  federalDeduction: 15_750,
  // The three states with no federal starting line refuse to compute without
  // their own figure, and this test is about a different refusal.
  ...(state === 'PA' ? { pennsylvaniaTaxableIncome: 60_000 } : {}),
  ...(state === 'NJ' ? { newJerseyGrossIncome: 60_000 } : {}),
  ...(state === 'MA' ? { massachusettsFivePercentIncome: 60_000 } : {}),
});

/** A value of the right JSON type for a field, so a type check never fires first. */
function sampleValue(field) {
  switch (field.schema.type) {
    case 'number':
    case 'integer':
      return 1;
    case 'boolean':
      return true;
    case 'array':
      return [10];
    case 'object':
      return { filer: { employerPlanPension: 1 } };
    default:
      // A string field is a jurisdiction name, and a wrong name errors for its
      // own reason. The state check runs first, which is what this measures.
      return 'Nowhere';
  }
}

test('every per-state field is in the schema, typed, and points at describe_state', () => {
  for (const field of STATE_FIELDS) {
    const property = stateTool.inputSchema.properties[field.name];
    assert.ok(property, `${field.name} is documented but not in the schema`);
    assert.equal(property.type, field.schema.type, `${field.name} type`);
    assert.match(
      property.description,
      /describe_state/,
      `${field.name} does not say where its documentation is`,
    );
    assert.equal(property.description, shortDescription(field), `${field.name} pointer`);
    // The pointer has to be short, or it is the thing it replaced.
    assert.ok(
      property.description.length < 120,
      `${field.name} pointer is ${property.description.length} bytes; it is prose again`,
    );
  }
});

test('every per-state field names every state it belongs to', () => {
  for (const field of STATE_FIELDS) {
    assert.ok(field.states.length > 0, `${field.name} belongs to no state`);
    for (const state of field.states) {
      assert.ok(ALL_STATES.includes(state), `${field.name} names ${state}, which is not supported`);
    }
    for (const state of field.requiredIn ?? []) {
      assert.ok(
        field.states.includes(state),
        `${field.name} is required in ${state} and not listed for it`,
      );
    }
  }
});

test('every per-state field is documented in full, and only by describe_state', () => {
  for (const field of STATE_FIELDS) {
    // Long enough to say what the figure is, where it comes from and what its
    // absence costs. The shortest of these is one sentence too short to be
    // useful, so the floor is deliberately not zero.
    assert.ok(field.doc.length > 120, `${field.name} documentation is ${field.doc.length} bytes`);
    for (const state of field.states) {
      const { structured } = describeTool.run({ state, year: 2026 });
      const found = structured.fields.find((f) => f.name === field.name);
      assert.ok(found, `describe_state(${state}) does not mention ${field.name}`);
      assert.equal(found.documentation, field.doc, `${state} ${field.name} documentation`);
      assert.equal(
        found.required,
        (field.requiredIn ?? []).includes(state),
        `${state} ${field.name} required flag`,
      );
    }
  }
});

test('a field offered to a state the table excludes is refused by the tool', () => {
  // The invariant the whole split rests on: the state list a model reads and
  // the state list the server enforces are the same list. Anything the table
  // excludes has to come back as an error rather than be silently ignored,
  // because a silently ignored field is a wrong answer with no symptom.
  let checked = 0;
  for (const field of STATE_FIELDS) {
    const outsider = ALL_STATES.find(
      (state) => !field.states.includes(state) && !['PA', 'NJ', 'MA'].includes(state),
    );
    assert.ok(outsider, `${field.name} applies to every state`);
    let error;
    try {
      stateTool.run({ ...baseArgs(outsider), [field.name]: sampleValue(field) });
    } catch (caught) {
      error = caught;
    }
    assert.ok(
      error instanceof ToolInputError,
      `${field.name} was accepted by ${outsider}, which the table says it does not apply to`,
    );
    assert.match(
      error.message,
      new RegExp(field.name),
      `${field.name} was refused by ${outsider} for some other reason: ${error.message}`,
    );
    checked += 1;
  }
  assert.ok(checked === STATE_FIELDS.length, 'every field was probed');
});

test('a field offered to a state the table includes is accepted', () => {
  // The other half. A pointer that over-restricts is as wrong as one that
  // under-restricts, and only this direction catches it.
  for (const field of STATE_FIELDS) {
    for (const state of field.states) {
      if (field.schema.type === 'string') continue; // a jurisdiction name errors on its own merits
      const args = {
        ...baseArgs(state),
        [field.name]: sampleValue(field),
        // Two fields are refused without their partner, for their own reasons.
        ...(field.name === 'stateItemizedDeductions' ? { federalItemized: true } : {}),
      };
      // Ohio refuses a work city without earnings and vice versa; both are
      // exercised by the tool's own suite.
      if (field.name === 'workCityEarnings' || field.name === 'residentCreditRate') continue;
      if (field.name === 'residentCreditLimitRate') continue;
      assert.doesNotThrow(
        () => stateTool.run(args),
        `${state} refused ${field.name}, which the table says it reads`,
      );
    }
  }
});

test('describe_state answers for every supported state', () => {
  for (const state of ALL_STATES) {
    const { text, structured } = describeTool.run({ state, year: 2026 });
    assert.ok(text.length > 60, `${state} produced almost no text`);
    assert.equal(structured.state, state);
    if (structured.hasIncomeTax) {
      assert.ok(structured.sources.length > 0, `${state} cited nothing`);
    } else {
      // A state with no income tax needs no fields, and saying so is the answer.
      assert.equal(structured.fields.length, 0, `${state} has no income tax and wants fields`);
    }
  }
});

test('describe_state puts the required fields first and says they are required', () => {
  for (const [state, expected] of [
    ['PA', 'pennsylvaniaTaxableIncome'],
    ['NJ', 'newJerseyGrossIncome'],
    ['MA', 'massachusettsFivePercentIncome'],
    ['MD', 'county'],
    ['IN', 'county'],
  ]) {
    const { text, structured } = describeTool.run({ state, year: 2026 });
    assert.equal(structured.fields[0].name, expected, `${state} first field`);
    assert.equal(structured.fields[0].required, true, `${state} first field required`);
    assert.match(text, /## Required/, `${state} has no required section`);
    // And the required one is named before the optional ones in the prose too.
    const optionalHeading = text.indexOf('## Read when supplied');
    if (optionalHeading !== -1) {
      assert.ok(
        text.indexOf(`### ${expected}`) < optionalHeading,
        `${state} lists ${expected} after the optional fields`,
      );
    }
  }
});

test('fieldsForState is the same list describe_state renders', () => {
  for (const state of ALL_STATES) {
    const { structured } = describeTool.run({ state, year: 2026 });
    if (!structured.hasIncomeTax) continue;
    assert.deepEqual(
      structured.fields.map((f) => f.name),
      fieldsForState(state).map((f) => f.name),
      `${state}`,
    );
  }
});

test('Utah is the state this split was forced by, and it is fully described', () => {
  const { structured, text } = describeTool.run({ state: 'UT', year: 2026 });
  const names = structured.fields.map((f) => f.name);
  for (const expected of ['taxableSocialSecurity', 'taxExemptInterest', 'retirement', 'filerAge', 'spouseAge']) {
    assert.ok(names.includes(expected), `UT is missing ${expected}`);
  }
  // The two facts a caller cannot guess and that decide a Utah retiree's answer.
  assert.match(text, /code AH/);
  assert.match(text, /2\.5%/);
});
