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
import {
  INDIANA_COUNTIES,
  MARYLAND_COUNTIES,
  MICHIGAN_CITIES,
  OHIO_MUNICIPALITIES,
  OHIO_SCHOOL_DISTRICTS,
  SUPPORTED_STATES,
  SUPPORTED_YEARS,
} from '../dist/vendor/us-state-tax/index.js';

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
  assert.equal(checks.length, 10);
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

test('every number the page states in prose is the engine\'s own', () => {
  // DAY 43'S RULE, APPLIED TO THE SECOND PAGE ON THE DAY IT WAS WRITTEN RATHER
  // THAN AFTER IT DRIFTED. `index.html` said "30 states" in its title, its meta
  // description and its opening paragraph while the engine ranked 33, and the
  // rule that came out of it was: a claim on the page a visitor actually READS
  // needs the same test as a claim in a README.
  //
  // This page states five: the state count, the locality count, the supported
  // years, the size of the differential grid, and how many rows it has. Every one
  // is read from the thing that produces it.
  const html = readFileSync(join(root, 'checks.html'), 'utf8').replace(/\s+/g, ' ');

  assert.ok(
    html.includes(`${SUPPORTED_STATES.length} states`),
    `the page no longer says "${SUPPORTED_STATES.length} states"`,
  );
  const localities =
    MARYLAND_COUNTIES.length +
    INDIANA_COUNTIES.length +
    MICHIGAN_CITIES.length +
    OHIO_MUNICIPALITIES.length +
    OHIO_SCHOOL_DISTRICTS.length;
  assert.ok(
    html.includes(`${localities.toLocaleString('en-US')} local income taxes`),
    `the page no longer says "${localities.toLocaleString('en-US')} local income taxes"`,
  );
  for (const year of SUPPORTED_YEARS) {
    assert.ok(html.includes(String(year)), `the page does not mention ${year}`);
  }

  // The differential grid's size, read out of the committed report rather than
  // typed — the one figure on the page that comes from outside the engine.
  const report = readFileSync(resolve(root, '..', 'tools', 'differential', 'REPORT.md'), 'utf8');
  const households = report.match(/^(\d[\d,]*) households/m);
  assert.ok(households, 'the differential report no longer opens with a household count');
  // Compared on the DIGITS, because the report writes `2816` and prose wants
  // `2,816`. Forcing one of the two to match the other's formatting was the first
  // attempt and it made the page read worse to satisfy a test, which is the wrong
  // way round: the test exists to keep the figure right, not to pick the commas.
  const digits = (text) => text.replace(/,/g, '');
  const stated = html.match(/([\d,]+) households on every push/);
  assert.ok(stated, 'the page no longer states the grid size');
  assert.equal(
    digits(stated[1]),
    digits(households[1]),
    `the page says a different grid size from the report's ${households[1]}`,
  );

  // And the row count, written out in words in the title, the lede and the
  // section below it. Spelt rather than numeric, so it is a word lookup.
  const WORDS = { 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten' };
  const word = WORDS[CHECKS.length];
  assert.ok(word, `no spelling for ${CHECKS.length} rows — add one`);
  assert.ok(html.includes(`${word} households where tax software is wrong`), 'the title');
  assert.ok(
    html.includes(`Run these ${word.toLowerCase()} against your own calculator`),
    'the lede',
  );

  // AND THE TWO PLACES THE COUNT ALSO APPEARS, WHICH THIS TEST DID NOT COVER
  // AND WHICH WERE BOTH THREE OUT. Day 79: the title, the lede and the section
  // heading above were gated and said "Ten"; the page's own META DESCRIPTION
  // and the LINK on `index.html` that sends every visitor here were not gated
  // and both said "Seven". So the front page undersold the page it links to by
  // three rows, and the description a search engine reads disagreed with the
  // title it reads beside it.
  //
  // **The rule this is an instance of: a count in prose needs a gate wherever
  // it is WRITTEN, not wherever it is most prominent.** Three gated sites and
  // two ungated ones is not a 60% gate, it is an ungated count with three
  // witnesses.
  assert.ok(
    html.includes(`content="${word} US state income tax households,`),
    "the page's own meta description",
  );
  const index = readFileSync(join(root, 'index.html'), 'utf8');
  assert.ok(
    index.includes(`<strong>${word} households where tax software is wrong</strong>`),
    "the link on index.html, which is how a visitor gets here",
  );
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

// DAY 80 — THE TWO DEFECTS IN THE ONLY THING THIS PROJECT SHIPS WITHOUT A HUMAN.
//
// `dist.yml` attaches both single-file pages to a Release on every push to
// `main`. That Release is the whole of this project's reach: Pages is off, the
// packages are not on a registry, and a Release asset is the one artefact a
// stranger can get. Both of the following were wrong in it, and neither was
// reachable by any test that existed, because both live OUTSIDE `site/` or only
// in the built output.
test('each single-file page links to the OTHER single file, not to its multi-file name', () => {
  // The cross-link is the third kind of sibling reference, after the entry
  // script and the stylesheet. `build.mjs`'s guard has always been *named*
  // "still references a file beside it" and only ever checked the other two, so
  // `retirement-tax-calculator.html` shipped a link to `checks.html` — a file
  // the Release does not upload. It tested clean because `dist/` happens to
  // hold `checks.html` as well: the only broken copy was the one a reader got.
  const dist = join(root, 'dist');
  for (const [page, sibling, absent] of [
    ['retirement-tax-calculator.html', 'state-tax-checks.html', 'checks.html'],
    ['state-tax-checks.html', 'retirement-tax-calculator.html', 'index.html'],
  ]) {
    const html = readFileSync(join(dist, page), 'utf8');
    assert.ok(
      html.includes(`href="${sibling}"`),
      `${page} does not link to ${sibling}, so the pair does not work as a pair`,
    );
    assert.ok(
      !html.includes(`href="${absent}"`),
      `${page} still links to ${absent}, which the Release does not ship`,
    );
  }
});

test('the release notes DERIVE the row count rather than spelling it', () => {
  // The fifth place this count is written, and the first one a reader meets on
  // the Release page. It said "seven households" while the page said "Ten" —
  // the same three-row error Day 79 found in the meta description and the front
  // page link, in a file no test in `site/` can see. Day 79's rule was "a count
  // in prose needs a gate wherever it is WRITTEN"; the stronger move available
  // here is the one the state count beside it already used since Day 8 — read
  // the figure from the engine at build time, so there is no prose to gate.
  const workflow = readFileSync(join(root, '..', '.github', 'workflows', 'dist.yml'), 'utf8');
  assert.ok(
    workflow.includes('$checks households where tax software is wrong'),
    'the release notes no longer interpolate the row count',
  );
  assert.ok(
    workflow.includes("m.CHECKS.length"),
    'the release notes no longer read the row count from the module',
  );
  for (const word of ['five', 'six', 'seven', 'eight', 'nine', 'ten']) {
    assert.ok(
      !workflow.includes(`${word} households where tax software is wrong`),
      `the release notes hard-code "${word} households" again`,
    );
  }

  // DAY 80 — AND THE NOTES NOW CARRY THE FINDINGS THEMSELVES, DERIVED.
  //
  // With Pages off, nothing on a registry and no description on the repository,
  // the Release body is the ONLY public, search-indexed prose this project
  // controls without a human touching anything. It described two files. Nobody
  // searches for a file; they search for the question they are stuck on.
  assert.ok(
    workflow.includes('node tools/release-highlights.mjs'),
    'the release notes no longer carry the findings',
  );
  // And not one figure in them is typed. The last transcribed one was the Kansas
  // widow's $527.48, removed the day the deriving tool was written: a figure in
  // a workflow is a figure no test in `site/` can see, which is exactly how
  // "seven households" survived.
  const block = workflow.slice(workflow.indexOf('notes-calculator.md') - 2200);
  const typed = [...block.matchAll(/echo "[^"]*\\\$[0-9][0-9,]*\.[0-9]{2}/g)];
  assert.equal(
    typed.length,
    0,
    `the release notes transcribe ${typed.length} dollar figure(s) again: ` +
      typed.map((m) => m[0].slice(-12)).join(', '),
  );
});

// DAY 80 — THE ONE PLACE ON THIS PAGE WHERE A FIGURE WAS NOT COMPUTED BY THE ROW
// THAT PRINTS IT.
//
// The page's lede says "Both sides are computed in this page, by the same
// engine, from the same household — so nothing here is a figure somebody typed
// in". That was true of every figure except the ones inside a HEADLINE, which is
// prose and was never checked. `nm-social-security-cliff` read "One dollar of
// income costs a New Mexico couple $2,855.65 of tax" directly above a table
// reading "Apart by $2,920.05": a $64.40 contradiction in a row heading, on the
// page whose entire purpose is to show that other people's numbers are wrong.
//
// Neither figure was a typo. $2,855.65 is the measurement in `new-mexico.ts`'s
// own note, on a couple taking a federal standard deduction; this page's
// `federal` helper sets `deduction: 0`. The headline had been borrowed from the
// engine and placed over a row computing a different household.
//
// The rule, which is narrow on purpose: **a dollar figure with CENTS in a
// headline must be one the row computes.** A round figure is a statutory one —
// New Mexico's "$4,000 dependent deduction" is the statute's own amount and has
// nothing to do with the row's arithmetic — so requiring those to match would
// force the page to stop naming provisions. Cents mean somebody's engine
// produced it, and then it must be THIS row's engine.
test('a headline that quotes cents quotes its own row', () => {
  const rows = runChecks();
  const cents = (value) => Math.round(Math.abs(value) * 100);
  let checked = 0;

  for (const row of rows) {
    const quoted = [...row.headline.matchAll(/\$([0-9][0-9,]*\.[0-9]{2})/g)].map((m) =>
      Math.round(Number(m[1].replaceAll(',', '')) * 100),
    );
    for (const amount of quoted) {
      checked += 1;
      const computed = [cents(row.ours), cents(row.theirs), cents(row.difference)];
      const dollars = (c) => '$' + (c / 100).toFixed(2);
      assert.ok(
        computed.includes(amount),
        row.id +
          ': the headline quotes ' +
          dollars(amount) +
          ", which is none of the row's own figures (" +
          computed.map(dollars).join(', ') +
          '). A headline is the one piece of prose on this page; make it a function of the row.',
      );
    }
  }

  // A loop over what it happens to find passes when it finds nothing, which is
  // the failure mode this repository keeps writing down. There is exactly one
  // such figure today and it is the New Mexico cliff.
  assert.ok(checked >= 1, 'no headline quotes a figure with cents — this test checked nothing');
});
