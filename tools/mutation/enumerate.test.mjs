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
  assert.equal(files.length, 39, 'files walked');
  // 2,436, AND IT IS THE FIRST TIME THIS FIGURE IS NOT THE ONE scores.json
  // RECORDS. The enumerator measures the tree; `scores.json` records the last
  // completed audit, and Day 64's did not complete — 2,436 mutants against a
  // 1,018-test suite on four cores is about fifteen hours. The two numbers are
  // allowed to differ and `check-scores.mjs` is what fails while they do; this
  // assertion's job is to say what the TREE holds, so it tracks the tree.
  assert.equal(mutants.length, 2_530, 'mutants the enumerator finds in the current tree');

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
  // KANSAS, pinned on Day 66 and now the newest state, for the reason the
  // Louisiana anchor above was added: a golden sample made only of files that
  // have stopped moving stops being a sample of the tree.
  //
  // AND ITS COUNT IS WORTH PINNING FOR A SECOND REASON. Twenty-two is every
  // literal the module writes EXCEPT two, and the two are the interesting ones:
  // `standardDeductionAgedOrBlindAddition.age` at 65, which is below the
  // enumerator's money floor, and the retirement rule's `cap: 0`, which is a
  // sentinel encoding "Kansas exempts nothing outside its own list" and is not a
  // figure read from a document at all. Both are in `blind-spots.mjs`'s count of
  // real parameters the audit cannot perturb, and both are asserted directly in
  // `test/kansas.test.js` instead — the cap because an ABSENT cap would mean "the
  // whole of it" and exempt every pension in the state.
  assert.equal(
    mutants.filter((m) => m.rel === 'states/kansas.js').length,
    22,
    "Kansas's 22 mutants: every literal but the age of 65 and the sentinel cap of zero",
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

  // ARKANSAS, pinned on Day 64, and it is the file this sample most needed:
  // 774 of the tree's 2,436 mutants are in it, which is 32% of the whole audit in
  // one state, and the largest single-state addition this harness has taken.
  assert.equal(
    mutants.filter((m) => m.rel === 'states/arkansas.js').length,
    774,
    'Arkansas has 774 mutants — 32% of the whole tree, from one state',
  );
  // Line 196 is the top of the regular table — the `$94,700` the two schedules
  // meet at, which is the single most load-bearing figure in the state and the
  // one the whole 13.70% finding hangs on. `at` returns the FIRST mutant on a
  // line and this line carries two: the threshold and the 3.7% beside it.
  assert.deepEqual(at('states/arkansas.js', 196), {
    rel: 'states/arkansas.js', offset: 14_525, from: '94_700', to: '189400', kind: 'money', line: 196,
  });
  // AND THE ABSENCES ARE THE POINT OF PINNING THIS FILE, because they are what the
  // 99.6% does not cover and what `blind-spots.mjs` declares. Not one of these has
  // a mutant, and each is a figure a reader of an Arkansas return would notice
  // first:
  //
  //   $29 / $58   the personal tax credits, in all five statuses
  //   $60 / $5    the additional tax credit and its withdrawal step
  //   419.96      the published card's own "minus adjustment", and every other
  //               reduction in the schedule, because they carry CENTS
  //
  // If the harness ever starts perturbing any of them this fails, which is the
  // right direction to fail in: it would mean the audit got stronger and the
  // declarations in `blind-spots.mjs` got stale.
  for (const absent of ['29', '58', '60', '5', '10', '2', '111.98', '223.97', '287.97', '419.96']) {
    assert.equal(
      mutants.filter((m) => m.rel === 'states/arkansas.js' && m.from === absent).length,
      0,
      `${absent} has a mutant, and this harness is not supposed to reach it`,
    );
  }
  // What it CAN reach in that file, for contrast: the 3.7% rate in all 31 rows
  // that carry it, the $6,000 retirement cap, and the four deduction cells.
  const arFrom = (v) =>
    mutants.filter((m) => m.rel === 'states/arkansas.js' && m.from === v).length;
  assert.equal(arFrom('0.037'), 31, 'the 2026 rate, once per row that carries it');
  assert.equal(arFrom('6_000'), 1, "the retirement exemption's cap");
  assert.equal(arFrom('2_470'), 4, 'the four statuses that take the single deduction');

  // NORTH DAKOTA, pinned on Day 61 for the reason Louisiana was pinned on
  // Day 60 and one more: this is now the file where the mask is most
  // load-bearing in the whole tree. `states/north-dakota.js` holds 296
  // mutable-looking literals and exactly 24 of them are code, because its doc
  // comment is four published rate schedules, a worked indexation search and a
  // table of federal bracket ceilings. A Day 56-style mask regression would
  // move the total above by 272 FROM THIS ONE FILE, against Louisiana's 95.
  assert.deepEqual(at('states/north-dakota.js', 59), {
    rel: 'states/north-dakota.js', offset: 4_962, from: '48_475', to: '96950', kind: 'money', line: 59,
  });
  assert.equal(
    mutants.filter((m) => m.rel === 'states/north-dakota.js').length,
    24,
    'North Dakota has 24 mutants and not the 296 its doc comment would add',
  );
  // AND THE CONTRAST WITH LOUISIANA, WHICH IS THE POINT OF HAVING BOTH PINNED.
  // Louisiana stores ONE standard deduction a year and multiplies it, because
  // R.S. 47:294(A)(2) states the relation — so two of its parameters are
  // integers below 100 and the audit is blind to them. North Dakota stores all
  // eight published thresholds and derives nothing, so it has NO relation
  // parameter at all and every figure it ships has a mutant. The same coverage,
  // bought two different ways, and only one of them is visible to this harness.
  assert.equal(
    mutants.filter((m) => m.rel === 'states/north-dakota.js').length,
    [
      ...new Set(
        mutants.filter((m) => m.rel === 'states/north-dakota.js').map((m) => `${m.line}:${m.from}`),
      ),
    ].length,
    'no two North Dakota mutants are the same literal on the same line',
  );
  // OKLAHOMA, pinned on Day 62, and it takes North Dakota's record for the file
  // where the mask carries the most weight in the whole tree.
  // `states/oklahoma.js` holds **393** mutable-looking literals and exactly 51
  // of them are code, because its doc comment is two rate schedules in each of
  // two shapes, a frozen earned-income-credit table across three tax years and
  // a worked price for every parameter in it. A Day 56-style mask regression
  // would move the total above by 342 FROM THIS ONE FILE, against North
  // Dakota's 272 and Louisiana's 95.
  assert.deepEqual(at('states/oklahoma.js', 56), {
    rel: 'states/oklahoma.js', offset: 6_152, from: '0.0025', to: '0.00125', kind: 'rate', line: 56,
  });
  assert.equal(
    mutants.filter((m) => m.rel === 'states/oklahoma.js').length,
    51,
    'Oklahoma has 51 mutants and not the 393 its doc comment would add',
  );

  // AND OKLAHOMA'S HEADLINE PARAMETER HAS NO MUTANT, WHICH IS THE SHARPEST
  // STATEMENT OF THIS HARNESS'S BLIND SPOT THE TREE CONTAINS.
  //
  // HB 2764's 2026 schedule is 0%, 2.5%, 3.5% and 4.5%, and the row that
  // decides the most returns is the first one. This harness mutates decimals in
  // the OPEN interval (0,1), so `rate: 0` is not a literal it can perturb —
  // there is no "half of zero" and no "double zero" to try. Oklahoma ships a 0%
  // band in each of two filing-status schedules and the audit can say nothing
  // about either.
  //
  // Day 61 recorded that the harness cannot produce a $25 threshold move because
  // it perturbs by doubling and halving. This is the same gap at the other end:
  // it cannot produce ANY move in a parameter whose value is zero. Both of
  // Oklahoma's zero rates, North Dakota's, Mississippi's and Idaho's are
  // invisible to it, and in Oklahoma's case so is the 2026 reform's whole
  // shape — the three bands that were REPLACED by that zero. Only a
  // hand-written weakening or a test that knows the published schedule can see
  // it, which is what `test/oklahoma.test.js` is for.
  assert.equal(
    mutants.filter((m) => m.rel === 'states/oklahoma.js' && m.from === '0').length,
    0,
    "Oklahoma's two 0% bands have no mutant, because 0 is not in (0,1)",
  );
  // IOWA, pinned on Day 63, and it is the file where the mask carries the LEAST
  // weight of the four most recent states: `states/iowa.js` holds 95
  // mutable-looking literals and exactly 14 of them are code, so a Day 56-style
  // mask regression would move the total by 81 from this file, against
  // Oklahoma's 342, North Dakota's 272 and Louisiana's 95. Its doc comment is
  // prose and one table rather than four published rate schedules, which is
  // what that ratio measures.
  assert.deepEqual(at('states/iowa.js', 156), {
    rel: 'states/iowa.js', offset: 19_076, from: '9_000', to: '18000', kind: 'money', line: 156,
  });
  assert.equal(
    mutants.filter((m) => m.rel === 'states/iowa.js').length,
    14,
    'Iowa has 14 mutants and not the 95 its doc comment would add',
  );

  // AND IOWA DECLARES 25 PARAMETERS, SO ELEVEN OF THEM HAVE NO MUTANT — which
  // is the same statement as Oklahoma's above, made about a class rather than a
  // value, and it is the one that cost something.
  //
  // The fourteen the harness sees are the two supported years, two rates and
  // the ten low-income exemption thresholds. The eleven it does not are the $40
  // personal credit in five statuses, the $40 dependent credit, the two $20
  // additions and the three age gates (55, 65, 65) — every one an integer below
  // 100. **The $40 is the figure Day 63 shipped wrong**: a head of household
  // claims TWO personal credits and this package gave them one, which the
  // differential grid caught in six households at exactly $40.00 each and this
  // harness could not have caught at all.
  //
  // Two more Iowa parameters are invisible for reasons of their own and neither
  // is in the 25: the DEDUCTION, because it is the federal one and therefore not
  // an Iowa figure, and the retirement exclusion's CAP, because there is none —
  // the exclusion is total and the module says so by OMITTING the field.
  //
  //   A PARAMETER EXPRESSED AS THE ABSENCE OF A FIELD HAS NO LITERAL TO MUTATE.
  //
  // `tools/mutation/blind-spots.mjs` measures this across the whole package —
  // 4,043 of 4,913 figures perturbable, 593 real parameters not — and fails when
  // a rule field holds an unperturbable figure nobody declared.
  assert.equal(
    mutants.filter((m) => m.rel === 'states/iowa.js' && ['40', '80', '20', '55', '65'].includes(m.from))
      .length,
    0,
    "Iowa's $40 and $80 credits, its two $20 additions and its three age gates have no mutant",
  );
  // And the thresholds DO, so the absence above is about the magnitude and not
  // about the file: ten of them, five per tier.
  assert.equal(
    mutants.filter((m) => m.rel === 'states/iowa.js' && m.kind === 'money').length,
    10,
    "Iowa's ten exemption thresholds each have a mutant",
  );

  // The 2025 rates DO all have one, so the absence above is about the value and
  // not about the file: six rates in each of two schedules, twelve in all, plus
  // the three positive 2026 rates twice.
  assert.equal(
    mutants.filter((m) => m.rel === 'states/oklahoma.js' && m.kind === 'rate').length,
    18,
    'twelve 2025 rates and six positive 2026 ones',
  );
  // And the per-person retirement cap IS a mutant where Louisiana's relation
  // parameters are not, because $10,000 is money and `single * 2` is a 2.
  assert.equal(
    mutants.filter((m) => m.rel === 'states/oklahoma.js' && m.from === '10_000').length,
    1,
    "the $10,000 retirement cap has a mutant",
  );

  // Both 40% shares are mutants and they are two, which is what makes a
  // transposition between the capital-gain rule and the dividend rule visible
  // to the audit at all: one share moving is one failing test file.
  assert.equal(
    mutants.filter((m) => m.rel === 'states/north-dakota.js' && m.from === '0.4').length,
    2,
    "North Dakota's two forty percents are two literals and not one constant",
  );
  // And `cap: 0` has no mutant, which is the same blind spot Louisiana's age
  // gate has, reached by a different route: zero is not a mutable literal
  // anywhere in this harness. North Carolina's identical `cap: 0` is invisible
  // for the same reason and has been since Day 19.
  assert.equal(
    mutants.filter((m) => m.rel === 'states/north-dakota.js' && m.from === '0').length,
    0,
    'the zero cap and the zero bracket rate have no mutant',
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
  //
  // Day 61's +26 is 944+16, 359+4, 256+6: North Dakota's eight thresholds in
  // each of two years (16 money), its two rates and its two 40% shares (4
  // rate), the two `year === 2025` selectors and the two years in its guard (4
  // year), and the two new provenance entries' `years:` arrays (2 year). Every
  // one of those twenty-six was written down before the enumerator ran.
  //
  // DAY 62'S +55 IS 960+29, 363+18, 262+8, AND IT IS THE LARGEST SINGLE-STATE
  // ADDITION THIS BREAKDOWN HAS TAKEN — because Oklahoma is the first state here
  // whose two supported years are two different SCHEDULES rather than the same
  // schedule with different numbers. Sixteen thresholds (eleven 2025 across the
  // two subsections and six 2026, less the Infinity tops), the standard
  // deduction's four, four exemption amounts, the four special-exemption limits
  // and the $10,000 cap make 29 money; twelve 2025 rates and six positive 2026
  // ones make 18 rate; the two schedule selectors, the two in the supported-year
  // guard and four new provenance entries make 8 year. 51 of the 55 are in
  // `states/oklahoma.js` and the other 4 are the provenance entries. Every one
  // of the 55 was attributed in writing before the enumerator ran, and the
  // breakdown is reached by a route the total cannot see.
  const byKind = {};
  for (const m of mutants) byKind[m.kind] = (byKind[m.kind] ?? 0) + 1;
  // DAY 64'S +782 DWARFS EVERY EARLIER ADDITION PUT TOGETHER: money 999 -> 1,691,
  // rate 383 -> 455, year 272 -> 290. 774 of the 782 are in `states/arkansas.js`
  // and the other 8 are its provenance entries.
  //
  // The shape of the split is the finding. 692 of Arkansas's 774 are `money`, and
  // almost all of them are TABLE THRESHOLDS rather than parameters — the 224
  // distinct `over` values in the seven low income tax tables and the 73 `upTo`
  // values in the two rate schedules. Only 72 are `rate`, which is the 3.7% and
  // the 3.9% repeated once per row that carries them.
  //
  // AND WHAT IS NOT HERE IS NARROWER THAN IT LOOKS, which Day 64 learned by
  // measuring a claim it had already written down four times. The tables' 224
  // income boundaries are ALL reachable and so are 205 of their 224 tax amounts,
  // because this harness perturbs any integer at or above 100 — a 240-mutant
  // sample over exactly those figures killed 240 of 240. What it cannot reach is
  // the 19 amounts below $100, the $29 and $58 credits, the $60 and $5
  // additional-credit figures, and every reduction in the rate schedule, because
  // those carry CENTS. The absences below are that list and not a bigger one.
  // KANSAS, Day 66, adds 15 money, 5 rate and 2 year — and the 2 year mutants are
  // the whole of its year handling: the `if (year !== 2025 && year !== 2026)
  // return undefined` guard, and nothing else. No Kansas rule chooses a name, a
  // row or an amount by the year, because SB 1 wrote every figure for "tax year
  // 2024, and all tax years thereafter". That matters here rather than in the
  // module, because Day 65's seventh survivor was exactly such a selector in
  // Arkansas — a `year === 2025` in front of a rule NAME — and a state with two
  // year mutants has no room for one.
  // NEW MEXICO, Day 67, adds 47 money, 23 rate and 2 year — 72 in all, and the
  // SPLIT is the opposite of Kansas's one day earlier for a reason that is about
  // the state and not about the harness.
  //
  // Kansas's 22 were 15 money, 5 rate and 2 year, because its complexity is in
  // what it EXEMPTS: one list of retirement sources, one checkbox, four flat
  // allowances. New Mexico's 23 `rate` mutants are the largest rate contribution
  // any single state has made here — three published schedules of six bands each
  // is 18 rates before anything else, plus § 7-2-5.8's three tapers (0.10, 0.15,
  // 0.20) and the 25% credit match and the 0 of a repealed element. **A state
  // that writes three rate schedules where a reader expects five puts half its
  // parameters in this one kind.**
  //
  // The 2 year mutants are the whole of its year handling — the `if (year !==
  // 2025 && year !== 2026) return undefined` guard and nothing else — which is
  // Kansas's count for Kansas's reason: HB 252 of 2024 wrote the schedules for
  // "taxable years beginning on or after 1 January 2025" and nothing in the state
  // is indexed. No New Mexico rule chooses a name, a row or an amount by the
  // year, and the one figure that would (§ 7-2-18.34's child credit) is the one
  // this package does not model.
  assert.deepEqual(byKind, { money: 1_753, rate: 483, year: 294 });
});
