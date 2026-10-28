/**
 * The selection has to stay USEFUL, which no other check in this repository can
 * see.
 *
 * `mutate.mjs` re-runs every mutant that survives its selection against the whole
 * suite and records only that verdict, so the score is exact whatever the
 * selection does. That is the property that makes selection safe and it is also
 * what makes it rot invisibly: **a selection that stops attributing mutants
 * leaves every test green, every number right, and the run fifteen hours long.**
 * Nothing fails. It just gets slow, weeks later, and the reason is three commits
 * back.
 *
 * So these tests are about reach rather than about correctness. Two of them are
 * over the real shipped package, deliberately: a synthetic fixture cannot notice
 * that `tsc` stopped putting declarations at column zero, or that the sweeps were
 * renamed, and those are the two ways this actually breaks.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  attributionOf,
  codeAtIn,
  codesIn,
  declarations,
  mentionsIn,
  narrowableIn,
  planSteps,
} from './select.mjs';

const PKG = new URL('../../packages/us-state-tax/', import.meta.url).pathname;
const ESM = join(PKG, 'dist/esm');

test('declarations own the span from their own start to the next one', () => {
  const src = ['const A_NOTES = [', '];', 'function alpha(year) {', '    return 1;', '}', 'const B = 2;'].join('\n');
  const d = declarations(src);
  assert.deepEqual(
    d.map((x) => x.name),
    ['A_NOTES', 'alpha', 'B'],
  );
  assert.equal(d[0].start, 0);
  assert.equal(d[2].end, src.length, 'the last declaration runs to the end of the file');
  for (let i = 1; i < d.length; i++) assert.equal(d[i - 1].end, d[i].start, 'the spans tile the file');
});

test('an indented declaration is not a top-level one', () => {
  // The attribution reads `tsc` output, where everything top level is at column
  // zero. A nested `const` must not open a new span, or a mutant inside a
  // function body would be attributed to the wrong declaration.
  const d = declarations(['function alpha(year) {', '    const inner = 1;', '    return inner;', '}'].join('\n'));
  assert.deepEqual(
    d.map((x) => x.name),
    ['alpha'],
  );
});

test('THE NEAREST PRECEDING `code:` IS THE WRONG ANSWER, and the declaration is the right one', () => {
  // This is the shape that forced per-declaration attribution rather than
  // proximity: a state's function opens with helper `const` lines BEFORE its
  // `return {`, so the closest `code:` literal above a mutant in them belongs to
  // the previous state.
  const src = [
    'function arizona(year) {', // 0
    "    return { code: 'AZ', deduction: 14600 };",
    '}',
    'function georgia(year) {',
    '    const joint = 24000;', // the mutant lands here
    '    const dependent = 4000;',
    '    return {',
    "        code: 'GA',",
    '    };',
    '}',
  ].join('\n');
  const offset = src.indexOf('24000');
  const attribution = attributionOf([['states/flat.js', src]], codesIn([src]));
  assert.equal(codeAtIn(attribution, 'states/flat.js', offset), 'GA');

  // And the naive answer, spelled out so the test says what it is defending
  // against rather than only that it passes.
  const preceding = [...src.slice(0, offset).matchAll(/\bcode: '([A-Z]{2})'/g)].pop()?.[1];
  assert.equal(preceding, 'AZ', 'proximity would have said Arizona');
});

test('a declaration with no `code:` is attributed by its name prefix, and only to a real code', () => {
  const src = ["const GA_NOTES = [", "    'something about 26000 dollars',", '];', 'function georgia(year) {', "    return { code: 'GA' };", '}'].join('\n');
  const attribution = attributionOf([['states/flat.js', src]], new Set(['GA']));
  assert.equal(codeAtIn(attribution, 'states/flat.js', src.indexOf('26000')), 'GA');

  // `XX_` that is not a shipped code must not be invented into one.
  const odd = ['const ZZ_NOTES = [', "    '26000',", '];', 'function alpha(year) {', '    return 1;', '}'].join('\n');
  const a2 = attributionOf([['states/odd.js', odd]], new Set(['GA']));
  assert.equal(codeAtIn(a2, 'states/odd.js', odd.indexOf('26000')), undefined);
});

test('a single-state module attributes every offset, including its helpers', () => {
  // The fallback matters more than it looks: most state modules name their
  // helpers without a code prefix (`CITATIONS`, `NOTES`), so without the
  // file-level fallback a per-declaration scheme would be WORSE than the
  // per-file one it replaced.
  const src = ['const CITATIONS = [', "    'A.C.A. 26-51-201',", '];', 'function arkansas(year) {', "    return { code: 'AR', deduction: 2470 };", '}'].join('\n');
  const attribution = attributionOf([['states/arkansas.js', src]], codesIn([src]));
  assert.equal(codeAtIn(attribution, 'states/arkansas.js', 0), 'AR');
  assert.equal(codeAtIn(attribution, 'states/arkansas.js', src.indexOf('2470')), 'AR');
});

test('an unknown module is not attributed rather than guessed', () => {
  assert.equal(codeAtIn(new Map(), 'engine.js', 10), undefined);
});

test('a test file is narrowable when it names its tests after a state', () => {
  const sweep = 'for (const state of TAXING) {\n  test(`every byStatus cell ${state} ships moves a pinned answer`, () => {});\n}';
  const plain = "test('Arkansas charges 13.70%', () => {});";
  const narrowable = narrowableIn(new Map([['sweep.test.js', sweep], ['plain.test.js', plain]]));
  assert.deepEqual(narrowable, ['sweep.test.js']);
});

test('a file naming no state runs for every mutant, and a narrowed step carries the pattern', () => {
  const testFiles = ['sweep.test.js', 'arkansas.test.js', 'ohio.test.js', 'notes.test.js'];
  const testSource = new Map([
    ['sweep.test.js', 'test(`every byStatus cell ${state} ships`, () => {});\n'],
    ['arkansas.test.js', "stateIncomeTax({ state: 'AR' })"],
    ['ohio.test.js', "stateIncomeTax({ state: 'OH' })"],
    ['notes.test.js', 'every note in the package'],
  ]);
  const allCodes = new Set(['AR', 'OH']);
  const mentions = mentionsIn(testSource, allCodes);
  // The sweep names both codes, so it is narrowable for either.
  const plan = planSteps({ code: 'AR', testFiles, narrowable: narrowableIn(testSource), mentions });
  assert.deepEqual(plan.steps[0], { files: ['sweep.test.js'], pattern: ' AR ' });
  assert.deepEqual(plan.steps[1].files.sort(), ['arkansas.test.js', 'notes.test.js']);
  assert.equal(plan.steps[1].pattern, null, 'whole files run unfiltered');
  assert.ok(!plan.steps[1].files.includes('ohio.test.js'), "another state's own file is not run");
  assert.ok(!plan.steps[1].files.includes('sweep.test.js'), 'a narrowed file is not also run whole');
});

test('no code means no plan, which means the whole suite', () => {
  for (const code of [undefined, null]) {
    assert.equal(planSteps({ code, testFiles: ['a.test.js'], narrowable: [], mentions: new Map([['a.test.js', new Set()]]) }), null);
  }
});

// ---- over the package as it actually ships, because a fixture cannot see these ----

test('the shipped package still has two narrowable sweep files', () => {
  const dir = join(PKG, 'test');
  const testSource = new Map(
    readdirSync(dir)
      .filter((f) => f.endsWith('.test.js'))
      .map((f) => [f, readFileSync(join(dir, f), 'utf8')]),
  );
  const narrowable = narrowableIn(testSource).sort();
  // Named rather than counted: if a rename makes these unnarrowable, every
  // mutant pays 16.5 seconds again and no other check in this repository would
  // notice. Day 65 split these two; a third would be an improvement and is
  // meant to fail here so the figure above gets re-measured.
  assert.deepEqual(narrowable, ['status-sweep.test.js', 'step-probes.test.js']);
});

test('the shipped package attributes the great majority of its mutants to a state', async () => {
  const { enumerateMutants } = await import('./enumerate.mjs');
  const SKIP = [
    'localities/ohio.js',
    'localities/ohio-school-districts.js',
    'localities/indiana.js',
    'localities/michigan.js',
    'localities/maryland.js',
    'localities/new-york.js',
    'localities/counties.js',
  ];
  const { files, mutants } = enumerateMutants(ESM, SKIP);
  const stateFiles = files
    .map((abs) => [abs.slice(ESM.length + 1), abs])
    .filter(([rel]) => /^states\/[a-z0-9-]+\.js$/.test(rel))
    .map(([rel, abs]) => [rel, readFileSync(abs, 'utf8')]);
  const allCodes = codesIn(stateFiles.map(([, src]) => src));
  const attribution = attributionOf(stateFiles, allCodes);
  const attributed = mutants.filter((m) => codeAtIn(attribution, m.rel, m.offset) !== undefined);

  // A RATIO AND NOT A COUNT. Every state that arrives moves the count, and a
  // test that has to be regenerated on every state is a test that gets
  // regenerated without being read. What must not happen is the ratio falling,
  // which is the silent slowdown these tests exist for.
  assert.ok(
    attributed.length / mutants.length > 0.9,
    `only ${attributed.length} of ${mutants.length} mutants can be attributed to a state — ` +
      'the selection has lost its reach and the audit is back to running the whole suite for them',
  );
  // The modules that hold several states are the ones this is easy to lose, so
  // they are asserted directly: each must attribute more than one code.
  for (const rel of ['states/flat-states.js', 'states/utah-pennsylvania.js', 'states/federal-taxable-base.js']) {
    const codes = new Set(
      mutants.filter((m) => m.rel === rel).map((m) => codeAtIn(attribution, m.rel, m.offset)),
    );
    codes.delete(undefined);
    assert.ok(codes.size > 1, `${rel} holds several states and attributed ${codes.size} of them`);
  }
});
