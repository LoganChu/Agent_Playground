// The top-level unknown-input guard, and the one failure mode it exists for.
//
// Day 37 installed the published package from a release URL and wrote
// `wages: 180_000` where the field is `w2Wages`. The engine dropped the key and
// returned a complete, internally consistent estimate of nothing — AGI zero,
// taxable income zero, total tax zero, and a marginal rate of 10%, which is the
// most convincing part. Nothing in the output said a figure had gone missing.
//
// This file imports the REAL entry point rather than `./strict.mjs`, because the
// default is the thing under test: a note, always, and `strict` only to escalate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  KNOWN_ESTIMATE_INPUT_FIELDS,
  estimateFederalTax,
  nearestFields,
  unknownInputKeys,
} from '../dist/esm/index.js';
import * as pkg from '../dist/esm/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const src = (name) => readFileSync(resolve(here, '..', 'src', name), 'utf8');

const JOINT = { filingStatus: 'marriedFilingJointly', year: 2026 };
const unknownNotes = (result) => result.notes.filter((n) => n.startsWith('Ignored unknown input:'));

// ---------------------------------------------------------------------------
// The reproduction
// ---------------------------------------------------------------------------

test('the Day 37 call: `wages` is reported, and the note names `w2Wages`', () => {
  const r = estimateFederalTax({ ...JOINT, wages: 180_000 });
  // The answer is still the wrong one — the guard reports, it does not repair.
  assert.equal(r.totalTax, 0);
  const notes = unknownNotes(r);
  assert.equal(notes.length, 1);
  assert.match(notes[0], /`wages` is not a field of EstimateInput/);
  assert.match(notes[0], /`w2Wages`/);
  // And it says what it COST, which is the part a reader cannot work out.
  assert.match(notes[0], /dropped/);
});

test('the correct field produces no note and a real answer', () => {
  const r = estimateFederalTax({ ...JOINT, w2Wages: 180_000 });
  assert.deepEqual(unknownNotes(r), []);
  assert.ok(r.totalTax > 20_000, `expected a real bill, got ${r.totalTax}`);
});

test('a note for an unrecognised key comes FIRST, ahead of every other note', () => {
  // A separate return with no `spouseItemizes` answer earns a note of its own,
  // so this household has two. The dropped figure outranks the assumption,
  // because it is the one that explains every number below it.
  const r = estimateFederalTax({
    filingStatus: 'marriedFilingSeparately',
    year: 2026,
    wages: 90_000,
  });
  assert.ok(r.notes.length > 1, 'expected a second note to order against');
  assert.ok(r.notes[0].startsWith('Ignored unknown input:'), r.notes[0]);
});

// ---------------------------------------------------------------------------
// The one deliberate silence, and its opposite
// ---------------------------------------------------------------------------

test('an unrecognised key holding `undefined` is NOT reported', () => {
  // `undefined` means absent everywhere in this engine, so a key holding it has
  // dropped no figure. Reporting it would make the guard noisy for a caller who
  // spreads an optional object.
  assert.deepEqual(unknownNotes(estimateFederalTax({ ...JOINT, wages: undefined })), []);
  assert.deepEqual(unknownInputKeys({ wages: undefined }, KNOWN_ESTIMATE_INPUT_FIELDS), []);
});

test('an unrecognised key holding `null` IS reported', () => {
  // A JSON caller can really send this, and it really is discarded.
  assert.equal(unknownNotes(estimateFederalTax({ ...JOINT, wages: null })).length, 1);
});

test('nothing inherited from a prototype is reported', () => {
  const base = { wages: 1 };
  const input = Object.create(base);
  input.filingStatus = 'single';
  input.year = 2026;
  assert.deepEqual(unknownNotes(estimateFederalTax(input)), []);
});

// ---------------------------------------------------------------------------
// The suggestion, and the ordering bug found while writing it
// ---------------------------------------------------------------------------

test('`wages` suggests `w2Wages` BEFORE `age`', () => {
  // Both match: `w2Wages` contains `wages`, and `wages` happens to contain
  // `age`. Ranked by closeness of LENGTH the two tie at 2 and the coincidence
  // wins alphabetically, which is what the first version of this did. Ranked by
  // how much of the name they share — five characters against three — the field
  // the caller wanted comes first.
  assert.deepEqual(nearestFields('wages', KNOWN_ESTIMATE_INPUT_FIELDS), ['w2Wages', 'age']);
});

test('a difference of case alone is an exact hit', () => {
  assert.equal(nearestFields('W2Wages', KNOWN_ESTIMATE_INPUT_FIELDS)[0], 'w2Wages');
  assert.equal(nearestFields('AGE', KNOWN_ESTIMATE_INPUT_FIELDS)[0], 'age');
});

test('at most three near-misses are named', () => {
  const many = nearestFields('qualified', KNOWN_ESTIMATE_INPUT_FIELDS);
  assert.equal(many.length, 3);
  for (const field of many) assert.match(field, /^qualified/);
});

test('a MISSING letter is caught, which substring matching cannot do', () => {
  // Delete a character from the middle of a name and containment breaks in both
  // directions at once, so the substring rule returns nothing. A missing letter
  // is the commonest typo there is.
  assert.deepEqual(nearestFields('w2Wges', KNOWN_ESTIMATE_INPUT_FIELDS), ['w2Wages']);
  assert.deepEqual(nearestFields('federalWitholding', KNOWN_ESTIMATE_INPUT_FIELDS), [
    'federalWithholding',
  ]);
});

test('substring matches win outright: the edit distance is only a fallback', () => {
  // `wages` is contained in `w2Wages`, so the fallback never runs for the one
  // key this guard exists for. Adding one cannot have moved that answer.
  assert.deepEqual(nearestFields('wages', KNOWN_ESTIMATE_INPUT_FIELDS), ['w2Wages', 'age']);
});

test('a transposition costs ONE edit, which is what makes short names reachable', () => {
  // `blnid` is `blind` with two letters swapped — one typo to the person who
  // made it. Plain Levenshtein charges two, and five characters only earn one,
  // so counting it properly is the difference between this suggestion and none.
  assert.deepEqual(nearestFields('blnid', KNOWN_ESTIMATE_INPUT_FIELDS), ['blind']);
  assert.deepEqual(nearestFields('w2Wgaes', KNOWN_ESTIMATE_INPUT_FIELDS), ['w2Wages']);
});

test('the edit budget is earned: one edit per four characters, at most two', () => {
  assert.deepEqual(nearestFields('yeax', KNOWN_ESTIMATE_INPUT_FIELDS), ['year'], 'four: one edit');
  assert.deepEqual(nearestFields('yeaxy', KNOWN_ESTIMATE_INPUT_FIELDS), [], 'five: still one edit');
  // Below four characters nothing is earned, and the substring rule answers.
  assert.deepEqual(nearestFields('ag', KNOWN_ESTIMATE_INPUT_FIELDS), [
    'age',
    'w2Wages',
    'age65OrOlder',
  ]);
});

test('two edits is the ceiling however long the key is', () => {
  // `fedralWitholdng` is `federalWithholding` with three letters missing. The
  // budget formula would allow three at fifteen characters; the ceiling is what
  // stops it, because a name three typos away is as likely to be a different
  // field as the same one badly spelt.
  assert.deepEqual(nearestFields('fedralWitholdng', KNOWN_ESTIMATE_INPUT_FIELDS), []);
  // Two of the three restored, and it resolves.
  assert.deepEqual(nearestFields('federalWitholdng', KNOWN_ESTIMATE_INPUT_FIELDS), [
    'federalWithholding',
  ]);
});

test('a key resembling nothing is told where the field names are', () => {
  const notes = unknownNotes(estimateFederalTax({ ...JOINT, salary: 1 }));
  assert.equal(notes.length, 1);
  assert.doesNotMatch(notes[0], /Did you mean/);
  assert.match(notes[0], /41 field names/);
  assert.match(notes[0], /`KNOWN_ESTIMATE_INPUT_FIELDS`/);
});

test('the export that message names is really exported, under that name', () => {
  // A message that names an export is a claim about the package. Rename the
  // constant and this fails rather than leaving a caller hunting for it.
  const quoted = unknownNotes(estimateFederalTax({ ...JOINT, salary: 1 }))[0].match(/`(\w+)`\.$/);
  assert.ok(quoted, 'the note should end by naming an export');
  assert.ok(Array.isArray(pkg[quoted[1]]), `${quoted[1]} is not an exported array`);
});

test('every unrecognised key is reported, not just the first', () => {
  const notes = unknownNotes(estimateFederalTax({ ...JOINT, wages: 1, salary: 2, agi: 3 }));
  assert.equal(notes.length, 3);
  assert.deepEqual(
    notes.map((n) => n.match(/`([^`]+)`/)[1]),
    ['wages', 'salary', 'agi'],
    'in the order the caller wrote them',
  );
});

// ---------------------------------------------------------------------------
// `strict`
// ---------------------------------------------------------------------------

test('`strict: true` throws, and the message names the key and the suggestion', () => {
  assert.throws(
    () => estimateFederalTax({ ...JOINT, wages: 180_000 }, { strict: true }),
    (error) => {
      assert.ok(error instanceof RangeError, error.name);
      assert.match(error.message, /`wages` is not a field of EstimateInput/);
      assert.match(error.message, /`w2Wages`/);
      assert.match(error.message, /strict: true/);
      return true;
    },
  );
});

test('a strict throw counts the keys it is not naming', () => {
  assert.throws(
    () => estimateFederalTax({ ...JOINT, wages: 1, salary: 2 }, { strict: true }),
    /1 further unrecognised key was supplied: `salary`\./,
  );
  assert.throws(
    () => estimateFederalTax({ ...JOINT, wages: 1, salary: 2, agi: 3 }, { strict: true }),
    /2 further unrecognised keys were supplied: `salary`, `agi`\./,
  );
});

test('`strict` is checked before the year, so the complaint is about the typo', () => {
  // `getYearParameters` throws UnsupportedYearError on 2001. A caller who got
  // that back would fix the year and meet the dropped field next time.
  assert.throws(
    () => estimateFederalTax({ filingStatus: 'single', year: 2001, wages: 1 }, { strict: true }),
    /`wages` is not a field of EstimateInput/,
  );
});

test('`strict: false` and no options are the same thing', () => {
  for (const options of [undefined, {}, { strict: false }]) {
    const r = estimateFederalTax({ ...JOINT, wages: 1 }, options);
    assert.equal(unknownNotes(r).length, 1, `options: ${JSON.stringify(options)}`);
  }
});

// ---------------------------------------------------------------------------
// The field list, which is the part that goes stale if nobody watches it
// ---------------------------------------------------------------------------

test('every field name on the list is accepted without a note', () => {
  // The compile-time proof says the list is exactly `keyof EstimateInput`. This
  // says the SHIPPED build agrees — a list that is long in the dist would make
  // the guard silent about a real unknown key.
  const input = { ...JOINT };
  for (const field of KNOWN_ESTIMATE_INPUT_FIELDS) {
    if (input[field] === undefined) input[field] = 0;
  }
  input.filingStatus = 'single';
  input.year = 2026;
  input.qualifiedBusinesses = [];
  assert.deepEqual(unknownNotes(estimateFederalTax(input)), []);
  assert.equal(Object.keys(input).length, KNOWN_ESTIMATE_INPUT_FIELDS.length);
});

test('the list is exactly the interface, by a source parse independent of the compiler', () => {
  const body = src('estimate.ts').match(/export interface EstimateInput \{([\s\S]*?)\n\}/)[1];
  const declared = (body.replace(/\/\*[\s\S]*?\*\//g, '').match(/^ {2}([A-Za-z0-9]+)\??:/gm) ?? []).map(
    (line) => line.trim().replace(/\??:$/, ''),
  );
  assert.deepEqual([...declared].sort(), [...KNOWN_ESTIMATE_INPUT_FIELDS].sort());
  assert.equal(declared.length, 41);
});

test('the obvious pattern for that parse is WRONG, which is why the compiler holds the list', () => {
  // Day 37 specified this list as a source parse and found the trap before
  // building it: `[a-zA-Z]+` drops every field name containing a digit. Pinned
  // here so nobody replaces the compile-time proof with the parse that misses
  // the very field the guard exists to catch.
  const body = src('estimate.ts').match(/export interface EstimateInput \{([\s\S]*?)\n\}/)[1];
  const naive = (body.replace(/\/\*[\s\S]*?\*\//g, '').match(/^ {2}[a-zA-Z]+\??:/gm) ?? []).length;
  assert.equal(naive, 38, 'the naive pattern should see 38 of the 41');
  for (const missed of ['w2Wages', 'age65OrOlder', 'spouseAge65OrOlder']) {
    assert.ok(KNOWN_ESTIMATE_INPUT_FIELDS.includes(missed), missed);
    assert.doesNotMatch(body, new RegExp(`^ {2}[a-zA-Z]+\\??: .*${missed}`, 'm'));
  }
});

// The two copies of `src/unknown-input.ts` are compared in `shared-module.test.js`,
// which has its own file because one assertion reaching into a sibling package
// takes the whole file out of the mutation audit.
