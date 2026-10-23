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
  referenceEditDistance,
  referenceNearestFields,
} from './near-miss-reference.mjs';
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
  assert.match(notes[0], /54 field names/);
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
  assert.equal(declared.length, 54);
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
  const keys = [...KNOWN_STATE_INPUT_FIELDS, ...KNOWN_STATE_INPUT_FIELDS.map((f) => f.toUpperCase()), ...[
    'subtractons', 'subtractoon', 'dependants', 'filerAeg', 'itemisedDeductions',
    'propertyTaxPayed', 'dependantAges', 'bookkeepingRef', 'qualifedDividends',
    'capitlGains', 'dependnts', 'pennsylvniaTaxabelIncme', 'pennsylvniaTaxabelIncome',
    'outOfStateMuncipalIntrest', 'stateSubtractions', 'spouseage', 'earnedincome',
    'pennsylvania', 'blnid', 'wages', 'sub', 'ag', 'yeax', 'yeaxy', 'xy', 'x', '',
    'w2Wagse', 'w2Wagess', 'İstanbul', 'straße',
  ]];
  for (const key of keys) {
    assert.deepEqual(
      [...nearestFields(key, KNOWN_STATE_INPUT_FIELDS)],
      [...referenceNearestFields(key, KNOWN_STATE_INPUT_FIELDS)],
      key,
    );
  }
  assert.ok(keys.length > 54 * 2);
});

test('the window is five lengths wide, and what it is worth is read off the list', () => {
  // What the prune BUYS, derived from the shipped field list rather than typed
  // in. The budget is at most two, so the window is at most five lengths wide,
  // and how many names fall inside it is a property of this interface's own
  // length histogram — not a portable figure, which is why the one sentence
  // Day 58 wrote about it ("17% to 26% of the 54 names") was true of the corpus
  // it was measured on and not of the rule.
  const lengths = KNOWN_STATE_INPUT_FIELDS.map((f) => f.toLowerCase().length);
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
  // Day 59 did 54, and most keys do far fewer.
  assert.equal(worst, 14, 'the worst-case window over this field list');
  assert.equal(worstAt, 16, 'and the key length that reaches it');
  assert.equal(KNOWN_STATE_INPUT_FIELDS.length, 54, 'the premise: what the old version measured');
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
