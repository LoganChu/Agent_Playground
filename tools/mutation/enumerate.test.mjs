// The enumerator, under test at last.
//
// "Give the mutation harness a test suite — it still has none" sat on the
// worklist from Day 54 to Day 58, restated by four runs in a row. The cause was
// never that the tests are hard: `mutate.mjs` is a script, so importing it RUNS
// a three-hour audit, and `maskNonCode` could not be called from a suite while
// it lived in there. Splitting `enumerate.mjs` out was the whole blocker.
//
// ## Why the enumerator is the part that needed watching
//
// It is the only part of the harness whose failures are invisible. A broken
// worker pool shows up as a wrong duration. A broken comparison shows up as an
// absurd score. **A broken enumerator just produces fewer mutants — and a mutant
// that stops existing cannot survive, so the score RISES while the coverage
// falls, and every artefact in the repository agrees with every other one.**
//
// Day 56 caught exactly that by predicting 1,534 and measuring 1,533. Ten real
// literals in one file had never been mutated and six of them turned out to be
// checked by no test at all — every one a percentage this package prints in
// prose a language model repeats. It was found by a margin of ONE, which is the
// thinnest possible margin for the most serious kind of defect this project can
// have: a defect in the measurement of its own quality.
//
// So the first tests below are that bug and its family. The three marked
// REGRESSION were run against the pre-Day-56 mask — restored from the journal's
// description of it — and all three were seen to fail, which is the only reason
// they are known to check anything.
//
// The fourth, on a backtick inside a block comment, passes under BOTH masks, and
// that is why it is here rather than why it should not be: Day 57 and Day 58 each
// staked a predicted mutant count on that property, each reasoned about it
// correctly, and nothing in this repository could confirm it either time. A test
// that pins a property no version ever broke is still the difference between
// knowing and arguing.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  enumerateMutants,
  literalsIn,
  maskNonCode,
  mutantOf,
  mutantsInSource,
} from './enumerate.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The `from` of every mutant the enumerator finds in one source string. */
const found = (src) => mutantsInSource(src, 'x.js').map((m) => m.from);

// ---------------------------------------------------------------- the mask

test('REGRESSION (Day 56): a literal inside a ${...} interpolation is executable code', () => {
  // The actual missing mutant, in its actual shape: the FICA rate, inside a
  // template interpolation, in a note. The pre-Day-56 mask saw a backtick,
  // scanned to the next one, and blanked the interpolation with the text.
  const src = 'const n = `cap of ${Math.round(rule.perFilerCap / 0.0765)} dollars`;';
  assert.deepEqual(found(src), ['0.0765']);
});

test('REGRESSION (Day 56): the text around the interpolation is still masked', () => {
  // The other half, and the reason the masking exists at all: a statute citation
  // in a note must NOT be mutated. Both in one template, so a mask that gets
  // either side wrong fails here.
  const src = 'const n = `§ 164(f) caps it at $8,812, or ${1_700 * 2} in 2026`;';
  assert.deepEqual(found(src), ['1_700']);
});

test('REGRESSION (Day 56): a local edit cannot delete a check somewhere else', () => {
  // THE RULE: a mask with a state machine is a global property of the file, so
  // an earlier template literal can change whether a later literal is visible.
  // Enumerate one function, then the same function with an unrelated template
  // added in front of it, and require the same answer.
  //
  // The fixture is chosen, not invented: the first draft of this test used a
  // template with an escaped backtick, and the OLD mask handled it, so the test
  // proved nothing. This one is a backtick inside a STRING inside the
  // interpolation — three backticks, which the naive scan pairs wrongly, leaving
  // it inside a string literal that never closes and blanking the rest of the
  // file. Under the old mask `12_400` does not merely move, it DISAPPEARS, in a
  // function the edit did not touch.
  const later = 'function f() { return x * 12_400; }';
  const earlier = 'const note = `x ${"`"} y`;\n';
  assert.deepEqual(found(later), ['12_400']);
  assert.deepEqual(found(earlier + later), ['12_400'], 'the earlier template deleted a later check');
});

test('a backtick inside a block comment does not open a template literal', () => {
  // Day 57 and Day 58 both predicted a mutant count that depended on this, both
  // reasoned about it, and until now NOTHING in this repository could say
  // whether it holds. Today's new doc comments are full of backticks; if a
  // comment's backtick opened a template, the mask would run past the end of the
  // comment and blank live code after it.
  const src = '/** a `backtick` in prose, and $796 of it */\nconst v = 12_400;\n';
  assert.deepEqual(found(src), ['12_400']);
  // And the figure in the comment stays masked, which is the other direction.
  assert.equal(found(src).includes('796'), false);
});

test('a line comment, a block comment and both quote styles are masked', () => {
  assert.deepEqual(found('// $1,700 and 2026\nconst a = 1_900;'), ['1_900']);
  assert.deepEqual(found('/* 2024 */ const a = 2_500;'), ['2_500']);
  assert.deepEqual(found('const s = "2024 and 8_812"; const a = 2_500;'), ['2_500']);
  assert.deepEqual(found("const s = 'only 2024'; const a = 2_500;"), ['2_500']);
});

test('the mask preserves every byte offset and every newline, so line numbers are right', () => {
  // The enumerator reports a line number by counting newlines in the MASKED
  // text. If masking collapsed a comment the numbers would all be wrong, and a
  // survivor report would point at the wrong line — which is how a human decides
  // whether a survivor matters.
  const src = '/* two\n   lines */\nconst a = 12_400;\n';
  const masked = maskNonCode(src);
  assert.equal(masked.length, src.length, 'length preserved');
  assert.equal([...masked].filter((c) => c === '\n').length, [...src].filter((c) => c === '\n').length);
  assert.equal(mutantsInSource(src, 'x.js')[0].line, 3);
});

test('an escaped quote does not end the string it is inside', () => {
  const src = 'const s = "a \\" 2024 still inside"; const a = 2_500;';
  assert.deepEqual(found(src), ['2_500']);
});

// ---------------------------------------------- the three operators, and what they decline

test('the operator table: a year goes back one, money doubles, a rate halves', () => {
  assert.deepEqual(mutantOf('2026'), { kind: 'year', to: '2025' });
  assert.deepEqual(mutantOf('1_700'), { kind: 'money', to: '3400' });
  assert.deepEqual(mutantOf('0.0765'), { kind: 'rate', to: '0.03825' });
});

test('a separator means money whatever the magnitude, and that is the point', () => {
  // `2_000` is a deduction and `2024` is a tax year, and they are told apart by
  // the underscore rather than by the value. A year-shaped number WITH a
  // separator is money.
  assert.deepEqual(mutantOf('2024'), { kind: 'year', to: '2023' });
  assert.deepEqual(mutantOf('2_024'), { kind: 'money', to: '4048' });
});

test('what the table declines, which is what keeps the score honest', () => {
  // Each of these would be a mutant no test could kill, or a mutant that is not
  // a change in meaning — and an unkillable mutant lowers the score for nothing
  // while a meaningless one raises it.
  assert.equal(mutantOf('0'), null, 'an index');
  assert.equal(mutantOf('1'), null, 'an index');
  assert.equal(mutantOf('99'), null, 'below the money floor');
  assert.equal(mutantOf('2.5'), null, 'a decimal >= 1 is a multiplier or a printed figure');
  assert.equal(mutantOf('1.0'), null);
  assert.deepEqual(mutantOf('2101'), { kind: 'money', to: '4202' }, 'past the year window it is money');
  assert.deepEqual(mutantOf('1899'), { kind: 'money', to: '3798' }, 'before the year window too');
  assert.deepEqual(mutantOf('100'), { kind: 'money', to: '200' }, 'the money floor itself');
});

test('a rate below 1 halves and a rate at 1 does not', () => {
  assert.deepEqual(mutantOf('0.5'), { kind: 'rate', to: '0.25' });
  assert.equal(mutantOf('1.5'), null);
});

// ---------------------------------------------------------------- the literal scan

test('a numeric separator is part of the literal, not a boundary', () => {
  // A pattern that stopped at the underscore would match the `12` in `12_400`
  // and mutate a deduction to 24.
  assert.deepEqual(literalsIn('x = 12_400;').map((l) => l.text), ['12_400']);
});

test('a number that is part of an identifier or a property is not a literal', () => {
  // `w2Wages` and `age65OrOlder` are field names, and `.0765` would be a
  // property access.
  assert.deepEqual(literalsIn('o.w2Wages + o.age65OrOlder').map((l) => l.text), []);
  assert.deepEqual(literalsIn('a.b2').map((l) => l.text), []);
});

test('literalsIn is callable twice with the same answer', () => {
  // `g` regexes carry `lastIndex`, so a shared one would skip literals depending
  // on who called it last — state outliving the thing it belongs to, which is
  // the mask's own defect one level down. The function builds a fresh one.
  const code = 'a = 12_400; b = 2026; c = 0.0765;';
  assert.deepEqual(literalsIn(code), literalsIn(code));
  assert.equal(literalsIn(code).length, 3);
});

// ---------------------------------------------------------------- the real tree

test('the state engine enumerates what the recorded audit measured', () => {
  // A golden sample rather than a golden file: four anchors, including two of
  // the six known survivors, plus the totals. If the enumerator silently starts
  // seeing less — which is the failure direction, and the one no score can show
  // — this is what says so.
  //
  // Needs a built `dist`, which is why the CI step runs after `check-scores.mjs`
  // has built both packages. It asserts the build is there rather than skipping,
  // because a test that skips is a test that does not run.
  const esm = resolve(ROOT, 'packages/us-state-tax/dist/esm');
  assert.ok(existsSync(esm), `${esm} is missing — build us-state-tax before running this`);

  const SKIP = [
    'localities/ohio.js',
    'localities/ohio-school-districts.js',
    'localities/indiana.js',
    'localities/michigan.js',
    'localities/maryland.js',
    'localities/new-york.js',
    'localities/counties.js',
  ];
  const { files, mutants } = enumerateMutants(esm, SKIP);
  assert.equal(files.length, 33, 'files walked');
  assert.equal(mutants.length, 1_559, 'mutants — the figure tools/mutation/scores.json records');

  const at = (rel, line) => mutants.find((m) => m.rel === rel && m.line === line);
  assert.deepEqual(at('states/ohio.js', 88), {
    rel: 'states/ohio.js', offset: 3_814, from: '2026', to: '2025', kind: 'year', line: 88,
  });
  assert.deepEqual(at('states/flat-states.js', 435), {
    rel: 'states/flat-states.js', offset: 49_830, from: '2024', to: '2023', kind: 'year', line: 435,
  });

  // LOUISIANA, pinned on Day 60 — the newest state in the package, because a
  // golden sample made only of files that have stopped moving stops being a
  // sample of the tree. THIS FILE IS ALSO WHERE THE MASK IS MOST LOAD-BEARING:
  // `states/louisiana.js` holds 105 mutable-looking literals and exactly 10 of
  // them are code, so if `maskNonCode` ever regressed the way it did on Day 56
  // the count above would move by 95 from this one file.
  assert.deepEqual(at('states/louisiana.js', 65), {
    rel: 'states/louisiana.js', offset: 5_948, from: '2025', to: '2024', kind: 'year', line: 65,
  });
  assert.equal(
    mutants.filter((m) => m.rel === 'states/louisiana.js').length,
    10,
    'Louisiana has ten mutants and not the 105 its comments and notes would add',
  );
  // And the two parameters that have NO mutant, asserted as absent rather than
  // left to be noticed: R.S. 47:294(A)(2)'s `single * 2` and R.S. 47:44.1's
  // `cappedMinimumAge: 65` are integers below 100, which this harness does not
  // mutate. They are Louisiana's two most distinctive rules and the audit is
  // blind to both, which is a fact about the harness worth failing on if it
  // silently changes in either direction.
  assert.equal(
    mutants.filter((m) => m.rel === 'states/louisiana.js' && (m.from === '2' || m.from === '65'))
      .length,
    0,
    'the 200% relation and the age-65 gate have no mutant',
  );

  // And one of the ten literals Day 56 recovered from inside a `${...}`, so the
  // regression above is pinned on the real tree and not only on a fixture: the
  // FICA rate in a California note.
  assert.deepEqual(at('states/california.js', 69), {
    rel: 'states/california.js', offset: 2_963, from: '0.0765', to: '0.03825', kind: 'rate', line: 69,
  });

  // The shape of the whole enumeration, which a change to any operator moves.
  //
  // Day 60's +16 is visible here as an attribution rather than a total, which is
  // why this assertion is worth more than the count above: Louisiana contributes
  // 4 money (12,500 / 12,838 / 12,000 / 12,324), 2 rate (0.03 / 0.05) and 4 year,
  // and the twelve new provenance entries contribute the other 6 year, from their
  // `years: [2025]` and `years: [2026]` arrays. 940+4, 357+2, 246+10.
  const byKind = {};
  for (const m of mutants) byKind[m.kind] = (byKind[m.kind] ?? 0) + 1;
  assert.deepEqual(byKind, { money: 944, rate: 359, year: 256 });
});
