// Every row of the findings page, asserted — the figures AND their signs.
//
// ## Why the sign is the half that matters
//
// `site/src/checks.js` computes both sides of every row from the engine, so a
// figure cannot be transcribed wrongly. What it CAN do is flip: a row whose
// right answer is suddenly the larger one is a different finding, and the page
// would go on rendering it with the old sentence beside it. "A Kansas widow read
// against the joint column is $527.48 too LOW" is the claim; the number alone
// does not carry the word.
//
// So each assertion below pins the magnitude and the direction, and the sentence
// each row ships is the thing being guarded rather than the arithmetic.
//
// ## And the thing this file exists to stop
//
// A findings page is marketing surface, which makes it the one place in this
// repository where a wrong number costs the most and where nothing else would
// look. The engine's own suites never import it; the differential never sees it;
// the mutation audit does not reach `site/`. Day 43 found the published
// calculator advertising "30 states" while the engine ranked 33, and wrote the
// rule: a claim on the page a visitor actually READS needs the same test as a
// claim in a README. This is that test for the second page.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { CHECKS, runChecks } from '../dist/src/checks.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const money = (actual, expected, message) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${message}: expected ${expected}, got ${actual}`,
  );

const byId = () => new Map(runChecks().map((check) => [check.id, check]));

test('every row computes both sides and names which kind of row it is', () => {
  const checks = runChecks();
  assert.equal(checks.length, 7);
  for (const check of checks) {
    assert.ok(['error', 'comparison'].includes(check.kind), `${check.id}: ${check.kind}`);
    assert.ok(check.headline.length > 20, `${check.id} needs a headline`);
    assert.ok(check.says.length > 200, `${check.id} needs a paragraph, not a label`);
    assert.ok(check.cite.length > 20, `${check.id} needs a citation`);
    assert.ok(check.wrongLabel.length > 10, `${check.id} needs to say what the other side is`);
    assert.equal(typeof check.ours, 'number', `${check.id} ours`);
    assert.equal(typeof check.theirs, 'number', `${check.id} theirs`);
    assert.ok(Number.isFinite(check.ours) && Number.isFinite(check.theirs), check.id);
    // A row whose two sides agree demonstrates nothing and would render as a
    // finding with a zero beside it.
    assert.ok(Math.abs(check.difference) > 0.004, `${check.id} has no gap to show`);
  }
  // BOTH LABELS HAVE TO BE IN USE. Calling a lawful comparison an error is the
  // easy way to make this page look sharper and a lie about the law, and the
  // reverse — demoting a real defect to a comparison — is the easy way to make
  // the engine look safer. Neither can happen silently.
  const kinds = new Set(checks.map((check) => check.kind));
  assert.deepEqual([...kinds].sort(), ['comparison', 'error']);
});

test('a Kansas widow read against the joint column is $527.48 too LOW', () => {
  const check = byId().get('ks-widow');
  money(check.ours, 2_145.72, 'the head-of-household column, which the K-40 sends her to');
  money(check.theirs, 1_618.24, 'the joint column');
  // The SIGN: the default understates her. A model that overstated a widow would
  // be a different and much less interesting claim.
  assert.ok(check.theirs < check.ours, 'the joint default must be the LOWER figure');
  money(check.ours - check.theirs, 527.48, 'what the joint default costs');
  assert.equal(check.kind, 'error');
});

test('the same $50,000 of Kansas pension is $0 or $1,942.88 by who paid it', () => {
  const check = byId().get('ks-pension');
  money(check.ours, 0, 'a KPERS, federal civil service or military pension');
  money(check.theirs, 1_942.88, 'the same money from a private plan');
  assert.equal(check.kind, 'comparison', 'both answers are right, which is the finding');
});

test('a Kansas separate filer pays less than a single one, which is the only such state here', () => {
  const check = byId().get('ks-separate');
  money(check.theirs - check.ours, 28.73, 'the $515 of deduction at 5.58%');
  assert.ok(check.ours < check.theirs, 'the MARRIED separate filer must be the cheaper one');
});

test('Arkansas charges 13.70% where its published schedule tops out at 3.7%', () => {
  const check = byId().get('ar-marginal');
  assert.equal(check.unit, 'rate');
  money(check.ours, 0.137, 'the marginal rate in the bracket-adjustment band');
  money(check.theirs, 0.037, 'the highest rate in the published schedule');
  // Ten percentage points exactly, which is the $10-per-$100 withdrawal and not
  // an artefact of the two incomes chosen.
  money(check.ours - check.theirs, 0.1, 'the withdrawal rate');
});

test('a Maryland rollover from a 401(k) to an IRA costs $963.88 on the same dollars', () => {
  const check = byId().get('md-rollover');
  money(check.ours, 0, 'the employer plan, inside the exclusion');
  money(check.theirs, 963.88, 'the same money after the rollover');
  assert.ok(check.theirs > check.ours, 'the IRA must be the dearer container');
});

test("Iowa's low-income cliff is SHRINKING, and nothing Iowa wrote moved", () => {
  const check = byId().get('ia-frozen');
  money(check.ours, 240.24, '2026');
  money(check.theirs, 253.54, '2025');
  // THE DIRECTION IS THE FINDING. Iowa's four thresholds and its rate are
  // identical in the two years; the federal standard deduction is not, and it is
  // in front of the test. A row that showed the cliff growing would mean the
  // federal deduction had fallen.
  assert.ok(check.ours < check.theirs, 'the cliff must be smaller in the later year');
  money(check.theirs - check.ours, 13.3, 'the amount the federal deduction moved');
});

test("New York City's own tax is $3,174.69 on the household both READMEs quote", () => {
  const check = byId().get('nyc-locality');
  money(check.ours, 8_126.44, 'state plus city');
  money(check.theirs, 4_951.75, 'the state alone');
  money(check.ours - check.theirs, 3_174.69, 'the city tax');
  // And it is the figure the package README publishes, which is the point of
  // using that household rather than a rounder one: a reader comparing the page
  // and the README sees the same number.
  const readme = readFileSync(resolve(root, '..', 'packages', 'us-state-tax', 'README.md'), 'utf8');
  assert.ok(readme.includes('3,174.69'), 'the README no longer publishes this figure');
});

test('the page renders every row and references no file it does not ship', () => {
  const html = readFileSync(join(root, 'checks.html'), 'utf8');
  assert.ok(html.includes('<script type="module" src="checks-app.js"></script>'));
  assert.ok(html.includes('href="style.css"'));
  // The three findings the page says it cannot compute are NAMED on it, because
  // leaving them out silently is the flattering version. If one of them ever
  // becomes computable it should become a row and come out of this list, and
  // this is what makes that a deliberate edit.
  for (const absent of ['287.30', '31 December 2020', 'stillbirth']) {
    assert.ok(html.includes(absent), `the page no longer names the ${absent} exclusion`);
  }
  // Every row id appears in no markup, because the page builds itself from the
  // module — which is the property that keeps the two in step. Asserted so that
  // a future edit that hard-codes a row into the HTML fails here.
  for (const check of CHECKS) {
    assert.ok(!html.includes(check.id), `${check.id} is hard-coded into checks.html`);
  }
});

test('the single-file findings page carries its modules and opens from file://', () => {
  const single = readFileSync(join(root, 'dist', 'state-tax-checks.html'), 'utf8');
  assert.ok(!single.includes('src="checks-app.js"'), 'it still loads a file beside it');
  assert.ok(!single.includes('href="style.css"'), 'it still loads the stylesheet beside it');
  assert.ok(single.includes('const SOURCES = {'), 'the modules are not inlined');
  assert.ok(single.length > 500_000, 'it is too small to contain the engine');
  // The entry the loader imports has to be THIS page's, or the findings page
  // would boot the calculator. The generalised builder is new today and this is
  // the assertion that says the parameter reached the loader.
  assert.ok(single.includes("import(urlFor(\"checks-app.js\"))"), 'the loader imports the wrong entry');
  const calculator = readFileSync(join(root, 'dist', 'retirement-tax-calculator.html'), 'utf8');
  assert.ok(calculator.includes("import(urlFor(\"app.js\"))"), 'the calculator lost its entry');
});
