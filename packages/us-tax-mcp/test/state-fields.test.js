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
import {
  KNOWN_STATE_INPUT_FIELDS,
  SUPPORTED_STATES,
  SUPPORTED_YEARS,
  getStateDefinition,
} from '../dist/state-engine/index.js';

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


/**
 * Households to probe a field against. One is not enough: a field that only
 * bites on a retiree cannot be shown to be read by a wage earner, and a field
 * that only bites in a county cannot be shown by a filer without one.
 */
function probesFor(state) {
  const low = {
    federalAdjustedGrossIncome: 18_000,
    federalTaxableIncome: 2_250,
    ...(state === 'PA' ? { pennsylvaniaTaxableIncome: 18_000 } : {}),
    ...(state === 'NJ' ? { newJerseyGrossIncome: 18_000 } : {}),
    ...(state === 'MA' ? { massachusettsFivePercentIncome: 18_000 } : {}),
  };
  const high = {
    federalAdjustedGrossIncome: 400_000,
    federalTaxableIncome: 384_250,
    ...(state === 'PA' ? { pennsylvaniaTaxableIncome: 400_000 } : {}),
    ...(state === 'NJ' ? { newJerseyGrossIncome: 400_000 } : {}),
    ...(state === 'MA' ? { massachusettsFivePercentIncome: 400_000 } : {}),
  };
  return [
    {},
    // AN ODD TAX YEAR, and the reason it is here is Day 54's finding arriving in
    // a second instrument one day later. Every other probe in this set pins
    // `year: 2026`, and `{}` takes the server's default, which is also 2026 —
    // so this sweep could not see a field that is live only in an odd year.
    // Oregon's kicker is the first: `surplusCredit` is declared for 2025 and
    // ABSENT for 2026, so `oregonPriorYearTaxBeforeCredits` read as accepted and
    // never read, in a sweep built precisely to catch that.
    //
    // THE RULE, again and in a different file: AN ARGUMENT FROM AN ABSENCE IS
    // ONLY AS GOOD AS THE INSTRUMENT'S ABILITY TO HAVE SEEN THE THING — and a
    // probe set is a grid, with every axis a grid has.
    { year: 2025 },
    { year: 2026, filerAge: 70, spouseAge: 70, retirementIncome: 30_000 },
    { year: 2026, filingStatus: 'marriedFilingJointly', dependents: 2 },
    // A two-earner joint return, for the credits that ask whether the second
    // spouse has income of their own.
    {
      year: 2026,
      filingStatus: 'marriedFilingJointly',
      bothSpousesHaveQualifyingIncome: true,
      ...(state === 'OH' || state === 'VA' ? {} : {}),
    },
    // A credit that switches OFF as income rises is invisible from above, and a
    // threshold is invisible from below — Day 29's rule, and a probe set with one
    // income is a grid with one income.
    { year: 2026, ...low, earnedIncome: 18_000 },
    { year: 2026, ...high },
    // A retiree INSIDE a phase-out band. Utah's `taxExemptInterest` is read only
    // here: it is added back to a modified AGI that withdraws a retirement
    // credit, so it is invisible both to a filer with no credit and to one whose
    // credit is already gone.
    {
      year: 2026,
      filerAge: 70,
      taxableSocialSecurity: 10_000,
      federalAdjustedGrossIncome: 40_000,
      federalTaxableIncome: 24_250,
      ...(state === 'PA' ? { pennsylvaniaTaxableIncome: 40_000 } : {}),
      ...(state === 'NJ' ? { newJerseyGrossIncome: 40_000 } : {}),
      ...(state === 'MA' ? { massachusettsFivePercentIncome: 40_000 } : {}),
    },
    // A household carrying a FEDERAL TAX BILL, which until Alabama no probe here
    // had any reason to. Alabama's two refundable-credit fields are subtracted
    // from the federal tax deduction and the deduction is floored at zero, so on
    // a household with no federal tax they move nothing — and "accepted and never
    // read" is exactly what this test would have reported about a field that is
    // read, on the strength of a probe set in which it could not bite.
    //
    // The same shape as the retiree probe above it: a field that only matters
    // inside a band needs a probe inside the band, and a federal credit only
    // matters where there is federal tax for it to come off.
    {
      year: 2026,
      federalIncomeTax: 6_617,
      federalAdjustedGrossIncome: 62_000,
      federalTaxableIncome: 46_250,
      // No `earnedIncome` here, and the reason is this file's own mechanism: the
      // tool REFUSES a field the state is not listed for, so a probe carrying one
      // is not a household at all — `answerOf` returns undefined and every field
      // measured on that probe reports itself unreachable. A probe set is input
      // to the validator before it is input to the engine.
      ...(state === 'PA' ? { pennsylvaniaTaxableIncome: 62_000 } : {}),
      ...(state === 'NJ' ? { newJerseyGrossIncome: 62_000 } : {}),
      ...(state === 'MA' ? { massachusettsFivePercentIncome: 62_000 } : {}),
    },
  ];
}

/** The tool's own answer, or undefined where this household is not a legal call. */
function answerOf(args) {
  try {
    return stateTool.run(args).structured.state.totalTax;
  } catch (error) {
    if (error instanceof ToolInputError) return undefined;
    throw error;
  }
}

/**
 * A value big enough to MOVE an answer, which `sampleValue`'s `1` deliberately
 * is not: that helper exists to get past a type check, and a dollar of anything
 * rounds away in most states.
 */
function reachableValues(field) {
  switch (field.schema.type) {
    case 'number':
      return [20_000, 1];
    case 'integer':
      return field.name.toLowerCase().includes('age') ? [70, 40] : [2, 1];
    case 'boolean':
      return [true];
    case 'array':
      return [[10, 10]];
    case 'object':
      return [{ filer: { employerPlanPension: 10_000 } }];
    default:
      return ['x'];
  }
}

test('a field whose doc counts its own states counts the array beside it', () => {
  // Day 40's rule and the Day 41 instance: a prose count of a list declared
  // three lines above is a SECOND COPY of that list, and it drifts the moment
  // the list grows. `retirement` said "NINE states read this" while its own
  // array held eleven, and nothing failed — the sentence had been wrong for
  // two states before Missouri made it wrong for a third.
  //
  // Generalised rather than pinned to one field: any doc line that opens with
  // a number followed by " states read this" must agree with that field's own
  // `states` array. A field that grows one tomorrow is covered.
  let checked = 0;
  for (const field of STATE_FIELDS) {
    // `doc` is an array in the source and a joined string by the time it
    // reaches here, which is itself worth knowing: a test that iterated the
    // array would have passed over a string and checked nothing.
    for (const line of String(field.doc).split('\n')) {
      const hit = /^(\d+) states read this/.exec(line);
      if (!hit) continue;
      checked += 1;
      assert.equal(
        Number(hit[1]),
        field.states.length,
        `${field.name}: the doc says ${hit[1]} states and the array has ${field.states.length}`,
      );
    }
  }
  assert.equal(checked, 1, 'one field counts its own states in prose');
});

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
        // Two fields are refused without their partner, for their own reasons —
        // AND THE PARTNERSHIP IS NOT UNIVERSAL, which Day 51 found. Alabama,
        // Oregon and Wisconsin read `stateItemizedDeductions` and do NOT read
        // `federalItemized`: measured, not assumed — itemizing moves an Alabama
        // answer from $4,260.00 to $3,385.00 at $90,000 with no federal election
        // supplied, and supplying the election alone moves nothing in any of the
        // three. So the partner is added only where the table says that state
        // reads it, or this test refuses a field on the strength of a second
        // field the state never asked for.
        ...(field.name === 'stateItemizedDeductions' &&
        STATE_FIELDS.find((f) => f.name === 'federalItemized')?.states.includes(state)
          ? { federalItemized: true }
          : {}),
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

test('every per-state field is READ, not merely accepted', () => {
  // The fourth way this split can rot, and the one that went undetected until
  // Day 32 found it by hand. `spouseAdjustedFederalAdjustedGrossIncome` was in
  // `STATE_FIELDS`, so the schema advertised it, the validator accepted it for
  // Virginia and refused it everywhere else, `describe_state` documented what it
  // was worth — and `state_income_tax` never copied it into the engine input. A
  // caller who supplied it got the refusal note telling them to supply it.
  //
  // THE RULE: ACCEPTING AN INPUT IS NOT READING IT. The three tests above prove
  // the pointer, the documentation and the validator, and all three can be true
  // of a field the tool throws away. Only running the tool twice can tell.
  //
  // This is Day 31's reachability rule at the server boundary: a declaration no
  // input can reach is decoration, and a field no output can reach is worse,
  // because the schema promises it.
  const unread = [];
  for (const field of STATE_FIELDS) {
    // A jurisdiction NAME has to be a real one to reach anything, and all 1,033
    // of them are exercised in localities.test.js. Probing with a made-up name
    // tests the registry's error message, which is a different test.
    if (field.schema.type === 'string') {
      unread.push(field.name);
      continue;
    }
    // A field has to be reachable in AT LEAST ONE of its states, on at least one
    // of the probes below. Requiring every state would be requiring the field to
    // matter to a household this test happens to describe, which is a different
    // claim and a false one — Maryland's county fields do nothing for a filer
    // with no county.
    let moved = false;
    for (const state of field.states) {
      for (const probe of probesFor(state)) {
        const plain = answerOf({ ...baseArgs(state), ...probe, state });
        if (plain === undefined) continue;
        // Two values, because ONE value can be the no-change point by accident.
        // Virginia's spouse tax adjustment pins each half of the return at no
        // less than the midpoint, so a `lesserSpouseIncome` near the midpoint
        // gives exactly the even-split answer the field was supposed to replace —
        // and a probe that tried only that value would have reported the field
        // unread. A test that concludes "not reachable" from one input has
        // measured its own input.
        for (const value of reachableValues(field)) {
          const supplied = answerOf({
            ...baseArgs(state),
            ...probe,
            state,
            [field.name]: value,
            ...(field.name === 'stateItemizedDeductions' ? { federalItemized: true } : {}),
            // A PARTNER FIELD, for the same reason `federalItemized` is one above:
            // the field is read only on a return the partner makes possible.
            // A.R.S. § 43-1022(22) subtracts a share of the long-term gain only
            // where there is a net capital gain OVERALL — a year that nets to a
            // loss includes no gain in federal AGI to subtract from — so without
            // `netCapitalGain` the gate closes, the answer does not move, and
            // this test would report a field it can in fact reach as unread.
            //
            // Injected rather than added to `EXPLAINED` below BECAUSE THE FIELD
            // IS GENUINELY READ. The excuse list is for fields this probe set
            // cannot build a household for; this one it can, in one more key.
            ...(field.name === 'longTermCapitalGainAfter2011' ? { netCapitalGain: value } : {}),
          });
          if (supplied !== undefined && supplied !== plain) {
            moved = true;
            break;
          }
        }
        if (moved) break;
      }
      if (moved) break;
    }
    if (!moved) unread.push(field.name);
  }
  // Every field this test cannot move is named here WITH ITS REASON, so the list
  // is a set of claims rather than an allowlist. A field that stops being
  // unreachable fails this test as loudly as one that starts being.
  const EXPLAINED = {
    // Refused without a partner field, which the tool's own suite exercises.
    workCityEarnings: 'refused without workCity',
    residentCreditRate: 'refused without a work city',
    residentCreditLimitRate: 'refused without a work city',
    // A jurisdiction NAME needs to be a real one, and the names are exercised in
    // localities.test.js against all 1,033 of them.
    city: 'a city name is exercised in localities.test.js',
    workCity: 'a city name is exercised in localities.test.js',
    schoolDistrict: 'a four-digit district is exercised in localities.test.js',
    county: 'a county name is exercised in localities.test.js',
    locality: 'a locality name is exercised in localities.test.js',
    cityIncome: 'needs a Michigan city, exercised in localities.test.js',
    qualifyingWages: 'needs an Ohio municipality, exercised in localities.test.js',
    // Reads a figure only in a household this probe set does not build.
    pennsylvaniaSpouseEligibilityIncome: 'needs a married claimant inside PA tax forgiveness',
    separatedFromSpouse: 'needs a separate return with a qualifying child',
    spouseClaimsAgeDeduction: 'needs a separate return with a spouse of 65 or over',
    spouseHasNoGrossIncomeAndIsNotADependent: 'needs a separate return',
    spouseAdjustedFederalAdjustedGrossIncome: 'needs a separate return with a filer of 65 or over',
  };
  const surprising = unread.filter((name) => EXPLAINED[name] === undefined);
  assert.deepEqual(
    surprising,
    [],
    `these fields are accepted and never read: ${surprising.join(', ')}`,
  );
  // And the other direction, so the list above cannot become a graveyard: a
  // field that IS reachable must not be sitting in it.
  const stale = Object.keys(EXPLAINED).filter((name) => !unread.includes(name));
  assert.deepEqual(stale, [], `these fields are reachable and still excused: ${stale.join(', ')}`);
});

test('the separate-return fields ARE read, on the return they are about', () => {
  // The five fields the test above excuses for needing a separate return, proved
  // reachable on one. The excuse is about the probe set, not about the field, and
  // this is what makes that an assertion rather than a hope.
  const va = (extra) =>
    stateTool.run({
      state: 'VA',
      year: 2026,
      filingStatus: 'marriedFilingSeparately',
      federalAdjustedGrossIncome: 55_000,
      federalTaxableIncome: 38_900,
      federalDeduction: 16_100,
      filerAge: 68,
      spouseAge: 68,
      ...extra,
    }).structured.state.totalTax;
  const refused = va({});
  const answered = va({ spouseAdjustedFederalAdjustedGrossIncome: 0 });
  const taperedOut = va({ spouseAdjustedFederalAdjustedGrossIncome: 40_000 });
  const shared = va({
    spouseAdjustedFederalAdjustedGrossIncome: 30_000,
    spouseClaimsAgeDeduction: true,
  });
  const alone = va({ spouseAdjustedFederalAdjustedGrossIncome: 30_000 });
  // $12,000 of age deduction at 5.75% is $690: the whole spread between a
  // deduction refused for want of the other return's income and one allowed.
  assert.equal(Number((refused - answered).toFixed(2)), 690);
  assert.equal(refused, taperedOut); // the spouse's income takes it all back
  assert.ok(shared < alone); // half of a joint deduction beats a whole tested one
  assert.equal(
    va({ spouseHasNoGrossIncomeAndIsNotADependent: true }) < refused,
    true,
    'the § 151(b) exemption is not reaching the engine either',
  );
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

test('a state ADDED to a field list is read there, not merely accepted beside the state that was', () => {
  // The hole in the test above, which Connecticut walked straight into and which
  // nothing would have caught.
  //
  // That test requires a field to be reachable in AT LEAST ONE of its states,
  // and it says why: requiring every state would require the field to matter to
  // whatever household the test happens to describe, and Maryland's county
  // fields do nothing for a filer with no county. The reasoning is right and the
  // consequence is that **adding a state to an existing field's list is
  // unchecked**, because the field was already reachable in the state it was
  // written for.
  //
  // Three of Connecticut's fields are of that shape — `taxableSocialSecurity`,
  // `taxExemptInterest` and `retirement` all existed for other states — so the
  // whole of Connecticut's retiree computation could have been refused at this
  // boundary with the generic test green. (`taxExemptInterest` was, until today:
  // the validator had `state !== 'UT'` written out beside a table that said
  // otherwise.)
  //
  // THE RULE: a test that quantifies over "at least one" cannot see an addition.
  // What it can see is a removal, which is the other direction and the one that
  // was being worried about.
  //
  // So: one household per claim, written out, in the branch where the field is
  // load-bearing. A joint Connecticut return at $100,000 of federal AGI, above
  // the Social Security threshold, with $60,000 of gross benefits — the shape
  // where § 86's combined income excess is SMALLER than the benefit and is
  // therefore what Connecticut charges 25% of.
  const base = {
    state: 'CT',
    filingStatus: 'marriedFilingJointly',
    federalAdjustedGrossIncome: 100_000,
    federalTaxableIncome: 68_500,
    federalDeduction: 31_500,
  };
  const taxOf = (args) => stateTool.run({ ...base, ...args }).structured.state.totalTax;

  const benefits = {
    taxableSocialSecurity: 51_000,
    retirement: {
      filer: { socialSecurityBenefits: 30_000 },
      spouse: { socialSecurityBenefits: 30_000 },
    },
  };
  // `taxableSocialSecurity` is what Connecticut subtracts, so it has to move the
  // answer by itself.
  assert.notEqual(taxOf(benefits), taxOf({}), 'CT reads taxableSocialSecurity');
  // `retirement` carries the GROSS benefit, which is the cap on what Connecticut
  // charges — so dropping it while keeping the taxable part changes the answer
  // in the other direction.
  assert.notEqual(
    taxOf(benefits),
    taxOf({ taxableSocialSecurity: benefits.taxableSocialSecurity }),
    'CT reads retirement.socialSecurityBenefits',
  );
  // And `taxExemptInterest` belongs in provisional income, so it raises the
  // excess and therefore the tax — only in this branch, which is why the
  // household is this one.
  assert.ok(
    taxOf({ ...benefits, taxExemptInterest: 10_000 }) > taxOf(benefits),
    'CT reads taxExemptInterest, and it raises the tax',
  );
  // The pension subtraction is the fourth, and it is the one with a date on it:
  // the IRA share is 75% in 2025 and 100% in 2026.
  const retiree = (year) =>
    stateTool.run({
      ...base,
      year,
      federalAdjustedGrossIncome: 60_000,
      federalTaxableIncome: 28_500,
      retirement: { filer: { employerPlanPension: 20_000, iraDistributions: 20_000 } },
    }).structured.state;
  assert.equal(retiree(2026).stateAdjustedGrossIncome, 20_000);
  assert.equal(retiree(2025).stateAdjustedGrossIncome, 25_000);
});

test('every field the ENGINE accepts is exposed by this server, or excused by name', () => {
  // THE GAP THIS CLOSES WAS FOUND BY HAND ON DAY 48, AND BY HAND IS THE WHOLE
  // PROBLEM.
  //
  // `us-state-tax` gained `longTermCapitalGainAfter2011` that day, for Arizona's
  // A.R.S. § 43-1022(22) — the largest unmodelled Arizona provision, worth
  // $625.00 on a $100,000 long-term gain. The engine read it, its own suite
  // proved it, `sync-engine.mjs` copied the new source into `src/state-engine/`
  // on the next build, and the MCP server went on not exposing it. Every test in
  // this file passed: they all iterate `STATE_FIELDS`, so a field missing FROM
  // `STATE_FIELDS` is invisible to all of them.
  //
  // **THE RULE: A REGISTRY'S TESTS CAN ONLY CHECK WHAT IS IN THE REGISTRY.** The
  // four tests above prove the pointer, the documentation, the validator and the
  // read — four properties of every field listed, and not one word about whether
  // the list is complete. That is Day 34's "a hand-maintained list of field names
  // drifts towards being short" at the package boundary, and Day 46's finding that
  // this repository's instruments were all scoped to ONE package.
  //
  // It is checked in this direction — engine first — because the engine is where a
  // field is born. `KNOWN_STATE_INPUT_FIELDS` is itself held to `types.ts` by a
  // source parse in `us-state-tax`'s `unknown-input.test.js`, so the chain runs
  // from the interface to the server with an assertion at every link.
  const exposed = new Set(STATE_FIELDS.map((field) => field.name));

  // Named with its reason, so this is a set of claims and not an allowlist — and
  // checked in both directions below, so it cannot become a graveyard.
  const ELSEWHERE = {
    // The four that identify the return rather than describing it. They are
    // required arguments of `state_income_tax` itself.
    state: 'a required argument of the tool',
    year: 'a required argument of the tool',
    filingStatus: 'a required argument of the tool',
    federal: 'built by the tool from the federal engine, not supplied per state',
    dependents: 'derived from dependentAges, which IS exposed',
    // Exposed under a name that says whose they are, because `additions` and
    // `subtractions` are ambiguous in a tool that also computes a federal return.
    additions: 'exposed as stateAdditions',
    subtractions: 'exposed as stateSubtractions',
    // Pennsylvania's tax forgiveness takes the CLAIMANT's eligibility income from
    // the return the tool already has; only the spouse's half is a separate input.
    pennsylvaniaEligibilityIncome: 'derived from the federal return the tool builds',
    federalDeductions: 'assembled by the tool from qbi, overtime and tips',
    federalOneDollarHigher: "the engine's own marginal-rate probe, not a caller's input",
  };

  const unexposed = KNOWN_STATE_INPUT_FIELDS.filter((name) => !exposed.has(name));
  const surprising = unexposed.filter((name) => ELSEWHERE[name] === undefined);
  assert.deepEqual(
    surprising,
    [],
    `the engine accepts these and this server does not expose them: ${surprising.join(', ')}`,
  );
  // The other direction: a field that becomes exposed must leave the excuse list,
  // or the list stops describing the server.
  const stale = Object.keys(ELSEWHERE).filter((name) => !unexposed.includes(name));
  assert.deepEqual(stale, [], `these are exposed and still excused: ${stale.join(', ')}`);
  // And an excuse for a field the engine has never heard of is a third way to rot.
  const phantom = Object.keys(ELSEWHERE).filter(
    (name) => !KNOWN_STATE_INPUT_FIELDS.includes(name),
  );
  assert.deepEqual(phantom, [], `excused but not an engine field: ${phantom.join(', ')}`);
});

test("the surplus-credit field's NAME is the engine's, not this module's", () => {
  // The gate derives its STATES from the definitions and this derives its NAME
  // from them too, which is the half Day 53's Pennsylvania defect was missing:
  // `pennsylvaniaSpouseEligibilityIncome` was advertised by the schema, named in
  // `describe_state` and never read, and no instrument could tell because the
  // server's copy of the name and the engine's were two independent strings that
  // happened to agree. `SurplusCreditRule.basisField` makes them one string.
  //
  // Asserted here as well as guarded by a throw in the module, because the throw
  // fires only when the COUNT is wrong — two states declaring two different
  // fields — and says nothing about whether the one name is a field the engine
  // actually accepts.
  const declared = new Set();
  for (const state of SUPPORTED_STATES) {
    for (const year of SUPPORTED_YEARS) {
      const field = getStateDefinition(state, year)?.surplusCredit?.basisField;
      if (field !== undefined) declared.add(field);
    }
  }
  assert.equal(declared.size, 1, 'exactly one surplus-credit basis field is declared');
  const [name] = [...declared];
  const entry = STATE_FIELDS.find((candidate) => candidate.name === name);
  assert.ok(entry, `STATE_FIELDS advertises the engine's own ${name}`);
  assert.ok(
    KNOWN_STATE_INPUT_FIELDS.includes(name),
    `${name} is a field StateIncomeTaxInput declares`,
  );
  // And the states it is advertised for are exactly the ones that declare the
  // rule — in ANY year, because the rule is absent in even ones and a gate that
  // dropped Oregon for that reason would refuse the field in the year it works.
  const states = SUPPORTED_STATES.filter((state) =>
    SUPPORTED_YEARS.some((year) => getStateDefinition(state, year)?.surplusCredit !== undefined),
  );
  assert.deepEqual([...entry.states].sort(), [...states].sort());
});
