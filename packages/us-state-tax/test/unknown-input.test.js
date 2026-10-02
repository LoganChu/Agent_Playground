// The top-level unknown-input guard, and what measuring it found in this suite.
//
// The guard itself is Day 37's reproduction from the federal package: a caller
// who writes `wages` where the field is `w2Wages` gets a complete, internally
// consistent answer with the figure missing from it and nothing saying so. The
// state engine has the same hole in a worse place, because `StateIncomeTaxInput`
// has 52 fields and several of them are the difference between a right answer
// and a plausible one.
//
// What is specific to this package is what turning the guard on measured:
// **109 of its own 596 tests were passing a key the engine does not read**,
// through fourteen household helpers that all spread their own option bag into
// the engine. None changed an answer. Two real defects were living in the
// pattern, and both are fixed — see `test/strict.mjs`, which is now how every
// other file in this suite reaches the engine.
//
// This file imports the REAL entry point, because the default is what is under
// test: a note, always, and `strict` only to escalate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  KNOWN_STATE_INPUT_FIELDS,
  PERSON_RETIREMENT_FIELDS,
  nearestFields,
  stateIncomeTax,
} from '../dist/esm/index.js';
import * as pkg from '../dist/esm/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const src = (name) => readFileSync(resolve(here, '..', 'src', name), 'utf8');

const OH = {
  state: 'OH',
  year: 2026,
  filingStatus: 'single',
  federal: { adjustedGrossIncome: 60_000, taxableIncome: 44_250, deduction: 15_750 },
};
const unknownNotes = (result) => result.notes.filter((n) => n.startsWith('Ignored unknown input:'));

// ---------------------------------------------------------------------------
// The default: a note, and the answer it explains
// ---------------------------------------------------------------------------

test('an unrecognised key is reported and the answer is still the wrong one', () => {
  const r = stateIncomeTax({ ...OH, subtractons: 40_000 });
  const notes = unknownNotes(r);
  assert.equal(notes.length, 1);
  assert.match(notes[0], /`subtractons` is not a field of StateIncomeTaxInput/);
  assert.match(notes[0], /`subtractions`/);
  // The guard reports; it does not repair. The subtraction is still gone.
  assert.equal(r.stateAdjustedGrossIncome, stateIncomeTax(OH).stateAdjustedGrossIncome);
});

test('the real field changes the answer, which is what the note is about', () => {
  const r = stateIncomeTax({ ...OH, subtractions: 40_000 });
  assert.deepEqual(unknownNotes(r), []);
  assert.equal(r.stateAdjustedGrossIncome, 20_000);
});

test('the note comes FIRST, ahead of the state notes and the dynamic ones', () => {
  const r = stateIncomeTax({ ...OH, subtractons: 1 });
  assert.ok(r.notes.length > 1, "Ohio's own notes should follow");
  assert.ok(r.notes[0].startsWith('Ignored unknown input:'), r.notes[0]);
});

test('a no-income-tax state reports it too, on its early return', () => {
  // Checked before the `rate.kind === 'none'` return for the same reason the
  // retirement guard is: a caller who tests against Texas first is the one who
  // most needs to be told, and a typo that is reported in Ohio and swallowed in
  // Texas is a typo learned about from the wrong state.
  const r = stateIncomeTax({ ...OH, state: 'TX', subtractons: 1 });
  assert.equal(r.hasIncomeTax, false);
  assert.equal(unknownNotes(r).length, 1);
});

test('it is checked before the state and the year, so the complaint is the typo', () => {
  assert.throws(
    () => stateIncomeTax({ ...OH, state: 'ZZ', subtractons: 1 }, { strict: true }),
    /`subtractons` is not a field of StateIncomeTaxInput/,
  );
  assert.throws(
    () => stateIncomeTax({ ...OH, year: 1999, subtractons: 1 }, { strict: true }),
    /`subtractons` is not a field of StateIncomeTaxInput/,
  );
});

test('`undefined` is silent and `null` is not', () => {
  assert.deepEqual(unknownNotes(stateIncomeTax({ ...OH, subtractons: undefined })), []);
  assert.equal(unknownNotes(stateIncomeTax({ ...OH, subtractons: null })).length, 1);
});

// ---------------------------------------------------------------------------
// `federal` and `retirement`: three contracts, three answers
// ---------------------------------------------------------------------------

test('`federal` is a documented superset and is NOT checked', () => {
  // Callers are told to pass `estimateFederalTax()`'s whole result straight in,
  // so every extra key on it is expected. A note per key would be 30 notes.
  const r = stateIncomeTax({
    ...OH,
    federal: { ...OH.federal, totalTax: 1, balanceDue: 2, effectiveRate: 0.1, notes: [] },
  });
  assert.deepEqual(unknownNotes(r), []);
});

test('`retirement` still throws, and the three answers are deliberate', () => {
  // retirement: throw. The top level: a note. `federal`: silence. The split is
  // three different contracts, not three levels of care.
  assert.throws(
    () => stateIncomeTax({ ...OH, retirement: { filer: { pension: 1 } } }),
    /`employerPlanPension`/,
  );
  assert.ok(PERSON_RETIREMENT_FIELDS.includes('employerPlanPension'));
});

// ---------------------------------------------------------------------------
// The suggestion
// ---------------------------------------------------------------------------

test('a difference of case alone is an exact hit', () => {
  assert.equal(nearestFields('SUBTRACTIONS', KNOWN_STATE_INPUT_FIELDS)[0], 'subtractions');
});

test('the best guess is ranked by how much of the name is shared', () => {
  // `age` is inside `dependentAges`, `filerAge`, `spouseAge`. The longest shared
  // run wins, and ties go to the closest length.
  assert.equal(nearestFields('spouseage', KNOWN_STATE_INPUT_FIELDS)[0], 'spouseAge');
  assert.equal(nearestFields('earnedincome', KNOWN_STATE_INPUT_FIELDS)[0], 'earnedIncome');
});

test('at most three near-misses are named', () => {
  assert.equal(nearestFields('pennsylvania', KNOWN_STATE_INPUT_FIELDS).length, 3);
});

test('a MISSING letter is caught, which substring matching cannot do', () => {
  // `subtractons` is this module's reason for having an edit distance at all.
  // Delete a character from the middle of a name and containment breaks in both
  // directions at once, so the substring rule — Day 34's, which said a full edit
  // distance "has never been the shape of one of these" — returns nothing.
  assert.deepEqual(nearestFields('subtractons', KNOWN_STATE_INPUT_FIELDS), ['subtractions']);
  assert.deepEqual(nearestFields('dependants', KNOWN_STATE_INPUT_FIELDS), ['dependents']);
  assert.deepEqual(nearestFields('filerAeg', KNOWN_STATE_INPUT_FIELDS), ['filerAge']);
});

test('substring matches win outright: the edit distance is only a fallback', () => {
  // `stateSubtractions` was the real defect in this suite, and it CONTAINS
  // `subtractions`. The fallback never runs for it, so adding one cannot have
  // changed any answer the substring rule already had.
  assert.deepEqual(nearestFields('stateSubtractions', KNOWN_STATE_INPUT_FIELDS), [
    'subtractions',
    'state',
  ]);
});

test('the edit budget is earned: one edit per four characters, at most two', () => {
  // Two edits turn a four-letter name into a different word, and a suggestion
  // that is mostly different is worse than being pointed at the list.
  assert.deepEqual(nearestFields('yeax', KNOWN_STATE_INPUT_FIELDS), ['year'], 'four: one edit');
  assert.deepEqual(nearestFields('yeaxy', KNOWN_STATE_INPUT_FIELDS), [], 'five: still one edit');
  // Eleven characters buy the full two, which is what `subtractoon` needs.
  assert.equal(nearestFields('subtractoon', KNOWN_STATE_INPUT_FIELDS)[0], 'subtractions');
  // And a key too short to earn an edit falls through to the substring rule,
  // which has plenty to say about two characters of `age`.
  assert.deepEqual(nearestFields('ag', KNOWN_STATE_INPUT_FIELDS), [
    'filerAge',
    'spouseAge',
    'dependentAges',
  ]);
});

test('two edits is the ceiling however long the key is', () => {
  // `pennsylvniaTaxabelIncme` is three typos from `pennsylvaniaTaxableIncome` —
  // a missing `a`, a swapped `el`, a missing `o`. At twenty-three characters the
  // budget formula would allow five, and the ceiling is what refuses it: a name
  // three typos away is as likely to be a different field as the same one badly
  // spelt.
  assert.deepEqual(nearestFields('pennsylvniaTaxabelIncme', KNOWN_STATE_INPUT_FIELDS), []);
  // Restore the last of the three and it resolves.
  assert.deepEqual(nearestFields('pennsylvniaTaxabelIncome', KNOWN_STATE_INPUT_FIELDS), [
    'pennsylvaniaTaxableIncome',
  ]);
  // And a longer key that happens to CONTAIN a field name never reaches the
  // fallback at all: `outOfStateMuncipalIntrest` holds `state`, so the substring
  // rule answers first — which is a weakness of the substring rule worth knowing
  // about rather than a property of the budget.
  assert.deepEqual(nearestFields('outOfStateMuncipalIntrest', KNOWN_STATE_INPUT_FIELDS), ['state']);
});

test('a key resembling nothing names the count and the export, and that export exists', () => {
  const notes = unknownNotes(stateIncomeTax({ ...OH, bookkeepingRef: 'XYZ' }));
  assert.equal(notes.length, 1);
  assert.doesNotMatch(notes[0], /Did you mean/);
  assert.match(notes[0], /52 field names/);
  const quoted = notes[0].match(/`(\w+)`\.$/);
  assert.ok(quoted, 'the note should end by naming an export');
  assert.ok(Array.isArray(pkg[quoted[1]]), `${quoted[1]} is not an exported array`);
});

// ---------------------------------------------------------------------------
// `strict`, which is how this suite calls the engine everywhere else
// ---------------------------------------------------------------------------

test('`strict: true` throws a RangeError naming the key', () => {
  assert.throws(
    () => stateIncomeTax({ ...OH, subtractons: 1 }, { strict: true }),
    (error) => {
      assert.ok(error instanceof RangeError, error.name);
      assert.match(error.message, /strict: true/);
      return true;
    },
  );
});

test('`strict: false` and no options are the same thing', () => {
  for (const options of [undefined, {}, { strict: false }]) {
    assert.equal(unknownNotes(stateIncomeTax({ ...OH, subtractons: 1 }, options)).length, 1);
  }
});

// ---------------------------------------------------------------------------
// The field list
// ---------------------------------------------------------------------------

test('every field name on the list is accepted without a note', () => {
  const input = { ...OH };
  for (const field of KNOWN_STATE_INPUT_FIELDS) {
    if (input[field] === undefined) input[field] = 0;
  }
  Object.assign(input, {
    state: 'OH',
    year: 2026,
    filingStatus: 'single',
    federal: OH.federal,
    dependentAges: [],
    retirement: {},
    federalDeductions: {},
    federalOneDollarHigher: OH.federal,
    locality: undefined,
    county: undefined,
    city: undefined,
    workCity: undefined,
    schoolDistrict: undefined,
  });
  assert.deepEqual(unknownNotes(stateIncomeTax(input)), []);
});

test('the list is exactly the interface, by a source parse independent of the compiler', () => {
  const body = src('types.ts').match(/export interface StateIncomeTaxInput \{([\s\S]*?)\n\}/)[1];
  const declared = (
    body.replace(/\/\*[\s\S]*?\*\//g, '').match(/^ {2}readonly ([A-Za-z0-9]+)\??:/gm) ?? []
  ).map((line) => line.trim().replace(/^readonly /, '').replace(/\??:$/, ''));
  assert.deepEqual([...declared].sort(), [...KNOWN_STATE_INPUT_FIELDS].sort());
  assert.equal(declared.length, 52);
});

// The two copies of `src/unknown-input.ts` are compared in `shared-module.test.js`,
// which has its own file because one assertion reaching into a sibling package
// takes the whole file out of the mutation audit.
