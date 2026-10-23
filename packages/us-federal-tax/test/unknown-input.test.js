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
  referenceEditDistance,
  referenceNearestFields,
} from './near-miss-reference.mjs';
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

// ---------------------------------------------------------------------------
// Day 59: the fallback got 36x faster, and neither change may move an answer
// ---------------------------------------------------------------------------
//
// Day 58 measured the fallback at **1,152 microseconds for one misspelled key**,
// 232 times a whole return, and two changes took it to a thirtieth of that: a
// LENGTH PRUNE, and THREE ROLLING ROWS in place of the whole matrix. Both are
// supposed to be invisible, so "invisible" is what these tests are about — and
// the three of them check three different things, because no one of them is
// enough on its own.

test('an edit distance is never less than the difference in length', () => {
  // THE PREMISE THE PRUNE RESTS ON, and the only one of the three claims here
  // that is about arithmetic rather than about this package. Every operation
  // that changes a string's length changes it by exactly one and costs one; a
  // substitution and a transposition change it by nothing. So crossing a gap of
  // n in length costs at least n, and a name whose length is more than `budget`
  // away from the key's cannot be within budget however it is spelt.
  //
  // Asserted EXHAUSTIVELY rather than on examples: every pair of strings over
  // three letters up to four characters long, which is 121 strings and 14,641
  // pairs, including both empty ones. A bound that holds on 14,641 pairs of a
  // three-letter alphabet is not evidence about this field list, which is
  // exactly why it is the right shape of check for a claim about the algorithm.
  const alphabet = ['', 'a', 'b', 'c'];
  let strings = [''];
  for (let n = 0; n < 4; n += 1) {
    strings = [...new Set(strings.flatMap((s) => alphabet.map((c) => s + c)))];
  }
  assert.equal(strings.length, 121);
  let pairs = 0;
  for (const a of strings)
    for (const b of strings) {
      pairs += 1;
      assert.ok(
        referenceEditDistance(a, b) >= Math.abs(a.length - b.length),
        `${JSON.stringify(a)} -> ${JSON.stringify(b)}`,
      );
    }
  assert.equal(pairs, 14_641);
});

test('the pruned fallback answers exactly what an unpruned full matrix does', () => {
  // The end-to-end check, over the field names themselves and every typo this
  // suite names anywhere. It is the FAST version on purpose: the exhaustive one
  // — every one-edit neighbour of every field name, in both packages' field
  // lists, about twenty thousand keys — lives in `near-miss-proof.test.js`,
  // which reads out of this package and is therefore run once per push by CI
  // and left out of the mutation audit. THAT ORDERING IS DELIBERATE. The audit
  // runs this suite once per mutant, so a thirteen-second proof in here would
  // cost an hour and a half of audit for nothing: the prune adds no literal the
  // harness can mutate, so no mutant can ever reach it.
  const keys = [...KNOWN_ESTIMATE_INPUT_FIELDS, ...KNOWN_ESTIMATE_INPUT_FIELDS.map((f) => f.toUpperCase()), ...[
    'wages', 'w2Wagse', 'w2Wagess', 'dependnts', 'capitlGains', 'qualifedDividends',
    'itemisedDeductions', 'propertyTaxPayed', 'dependantAges', 'bookkeepingRef',
    'subtractons', 'dependants', 'filerAeg', 'blnid', 'sub', 'ag', 'yeax', 'yeaxy',
    'xy', 'x', '', 'İstanbul', 'straße',
  ]];
  for (const key of keys) {
    assert.deepEqual(
      [...nearestFields(key, KNOWN_ESTIMATE_INPUT_FIELDS)],
      [...referenceNearestFields(key, KNOWN_ESTIMATE_INPUT_FIELDS)],
      key,
    );
  }
  assert.ok(keys.length > 41 * 2);
});

test('the window is five lengths wide, and what it is worth is read off the list', () => {
  // What the prune BUYS, derived from the shipped field list rather than typed
  // in. The budget is at most two, so the window is at most five lengths wide,
  // and how many names fall inside it is a property of this interface's own
  // length histogram — not a portable figure, which is why the one sentence
  // Day 58 wrote about it ("17% to 26% of the 54 names") was true of the corpus
  // it was measured on and not of the rule.
  const lengths = KNOWN_ESTIMATE_INPUT_FIELDS.map((f) => f.toLowerCase().length);
  let worst = -1;
  let worstAt = -1;
  for (let keyLength = 1; keyLength <= 80; keyLength += 1) {
    const budget = Math.min(2, Math.floor(keyLength / 4));
    if (budget === 0) continue;
    const window = lengths.filter((n) => Math.abs(n - keyLength) <= budget).length;
    if (window > worst) {
      worst = window;
      worstAt = keyLength;
    }
  }
  // So the worst a key can do is 14 comparisons where every version before
  // Day 59 did 41, and most keys do far fewer.
  assert.equal(worst, 14, 'the worst-case window over this field list');
  assert.equal(worstAt, 20, 'and the key length that reaches it');
  assert.equal(KNOWN_ESTIMATE_INPUT_FIELDS.length, 41, 'the premise: what the old version measured');
});

test('the prune compares the LOWERCASED lengths, and one code point proves it', () => {
  // THIS TEST EXISTS BECAUSE THE SENTENCE IT CHECKS WAS UNVERIFIED FOR AN HOUR.
  // `src/unknown-input.ts` says the prune has to measure the lowercased lengths
  // because the distance does, and case folding can change a string's length.
  // Breaking the module on purpose — pruning on `field.length` and `key.length`
  // instead — changed no answer in either package, so the only thing that
  // noticed was the assertion that reads the shipped bytes. **A doc comment
  // nothing can refuse is this repository's oldest defect**, so here is what
  // refuses it.
  //
  // Why nothing behavioural caught it: in the whole of Unicode exactly ONE code
  // point lowercases to a different length — U+0130, Turkish dotted capital I,
  // which becomes `i` plus a combining dot above — and it only ever grows.
  // A key holding it therefore lowercases to something containing U+0307, which
  // no ASCII field name contains, so the gap can never close against a list of
  // ASCII identifiers. BOTH INTERFACES HERE ARE ASCII IDENTIFIERS.
  //
  // But `nearestFields(key, known)` is exported, and its second argument is the
  // caller's list, which need not be. So the discriminating case is reached with
  // a field list of the test's own — which is the honest scope of the claim, and
  // narrower than the doc comment first stated it.
  const field = '\u0130stanbul';
  const candidate = field.toLowerCase();
  assert.equal(field.length, 8, 'the premise: eight code units');
  assert.equal(candidate.length, 9, 'the premise: case folding grew it by one');

  // Two characters inserted in the MIDDLE, so the substring rule cannot answer
  // first and the fallback is really reached.
  const key = candidate.replace('bul', 'xbuly');
  assert.equal(key.length, 11);
  assert.ok(!candidate.includes(key) && !key.includes(candidate), 'no substring hit');
  assert.equal(Math.min(2, Math.floor(key.length / 4)), 2, 'the premise: a budget of two');

  // The lowercased gap is 2 and within budget; the RAW gap is 3 and is not. So a
  // prune measuring the raw lengths drops a field that is two edits away, and
  // this is the suggestion it drops.
  assert.equal(Math.abs(candidate.length - key.length), 2);
  assert.equal(Math.abs(field.length - key.length), 3);
  assert.deepEqual([...nearestFields(key, [field])], [field]);
  assert.deepEqual([...referenceNearestFields(key, [field])], [field]);
});

test('the shipped bytes carry the prune, which no answer can see', () => {
  // THE REASON THIS TEST EXISTS, and it is the same reason Day 58's meter has a
  // call-site guard: delete the prune and every behavioural assertion in this
  // repository still passes. An exact optimisation is invisible by definition,
  // so the only thing that can notice its absence is something that looks at the
  // artefact — and the artefact is the compiled bytes, not the TypeScript.
  //
  // It would come back as a mutation-audit survivor if the harness could mutate
  // it. It cannot: the prune contains no literal the harness takes.
  const compiled = readFileSync(
    resolve(here, '..', 'dist', 'esm', 'unknown-input.js'),
    'utf8',
  );
  const body = compiled.slice(compiled.indexOf('export function nearestFields'));
  assert.ok(body.length > 0, 'the premise: the function is still exported under this name');
  assert.match(
    body,
    /Math\.abs\(candidate\.length - lower\.length\) > budget/,
    'the length prune is gone from the shipped fallback, and no answer changes when it goes',
  );
  // And the rolling rows, for the same reason: three live rows instead of a
  // matrix is also an answer-preserving rewrite.
  assert.match(compiled, /twoBack/, 'the rolling rows are gone from the shipped distance');
  assert.doesNotMatch(
    compiled,
    /Array\.from\(\{ length: b\.length \+ 1 \}/,
    'the per-row allocation is back',
  );
});

// The two copies of `src/unknown-input.ts` are compared in `shared-module.test.js`,
// which has its own file because one assertion reaching into a sibling package
// takes the whole file out of the mutation audit.
