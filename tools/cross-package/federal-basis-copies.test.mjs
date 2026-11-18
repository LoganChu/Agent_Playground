/**
 * The federal-basis cross-check, run against the defect it was written for.
 *
 * Day 84. A guard is worth what the evidence that it refuses the real thing is
 * worth, so this drives the checker over fixture text rather than trusting that
 * it passes on a clean tree — which it would also do if it looked at nothing.
 *
 * The real thing is `utah-child-credit.test.js` as it stood that morning: a
 * table whose comment calls it "published 2026 parameters", feeding households
 * that default to `year = 2026`, beside an `EITC` table labelled "§ 32, 2026",
 * holding
 *
 *   single                   15_750     the 2025 amount; 2026 is 16_100
 *   marriedFilingJointly     32_200     correct
 *   marriedFilingSeparately  15_750     the 2025 amount; 2026 is 16_100
 *   headOfHousehold          23_625     the 2025 amount; 2026 is 24_150
 *
 * Three of four wrong, each of them a REAL federal figure of a real year, which
 * is why nothing short of resolving the year could catch it. The whole state
 * suite was green, and a Utah head-of-household family on $50,000 with one child
 * was charged $24.76 of tax it does not owe — the right figure takes that
 * household to exactly zero.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../..');
const TOOL = join(HERE, 'federal-basis-copies.mjs');
const TESTS = join(ROOT, 'packages/us-state-tax/test');

/** Run the checker with one extra fixture file dropped into the state suite. */
function withFixture(name, source, fn) {
  const file = join(TESTS, name);
  writeFileSync(file, source);
  try {
    let out = '';
    let code = 0;
    try {
      out = execFileSync(process.execPath, [TOOL], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
    } catch (e) {
      out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
      code = e.status;
    }
    fn({ out, code });
  } finally {
    rmSync(file, { force: true });
  }
}

test('the checker refuses the Utah table exactly as it stood', () => {
  withFixture(
    'zz-federal-basis-probe.test.js',
    `const FEDERAL_STD_2026 = {
  single: 15_750,
  marriedFilingJointly: 32_200,
  marriedFilingSeparately: 15_750,
  headOfHousehold: 23_625,
};
export default FEDERAL_STD_2026;
`,
    ({ out, code }) => {
      assert.equal(code, 1, `expected a refusal, got:\n${out}`);
      // Named, each one, with the year it belongs to and what it should be.
      assert.match(out, /single: 15,750, us-federal-tax says 16,100/);
      assert.match(out, /marriedFilingSeparately: 15,750, us-federal-tax says 16,100/);
      assert.match(out, /headOfHousehold: 23,625, us-federal-tax says 24,150/);
      // And the one column that WAS right is not reported, or the finding is
      // four wide and a reader cannot tell which three to fix.
      assert.ok(
        !/marriedFilingJointly: 32,200, us-federal-tax says/.test(out),
        `the correct column was reported as wrong:\n${out}`,
      );
    },
  );
});

test('the checker tells § 63(c) from § 63(f), which its first version did not', () => {
  // Written without this, the tool reported twenty-five disagreements on a clean
  // tree, every one a § 63(f) amount held against the § 63(c) column —
  // `aged 2025 single: 2,000, us-federal-tax says 15,750`. A cross-check that
  // cannot tell which of two tables it is reading produces findings of the right
  // shape and the wrong content, which is how a gate gets disbelieved.
  withFixture(
    'zz-federal-basis-probe.test.js',
    `const FEDERAL_AGED_ADDITION = {
  2025: { single: 2_000, marriedFilingJointly: 1_600 },
  2026: { single: 2_050, marriedFilingJointly: 1_650 },
};
const FEDERAL = {
  2025: {
    deduction: { single: 15_750 },
    aged: { single: 2_000 },
  },
};
export default [FEDERAL_AGED_ADDITION, FEDERAL];
`,
    ({ out, code }) => {
      assert.equal(code, 0, `the § 63(f) tables were misread as § 63(c):\n${out}`);
      assert.match(out, /§ 63\(f\)/);
    },
  );
});

test('a figure belonging to no year at all is refused even without a year label', () => {
  // The membership check: the weaker half, for the tables that carry no year.
  // It cannot catch 2025's amount in an unlabelled 2026 table — that limit is
  // printed by the tool — but it does catch a figure that is nobody's.
  withFixture(
    'zz-federal-basis-probe.test.js',
    `const FEDERAL_DEDUCTION = { single: 15_751, marriedFilingJointly: 31_500 };
export default FEDERAL_DEDUCTION;
`,
    ({ out, code }) => {
      assert.equal(code, 1, `expected a refusal, got:\n${out}`);
      assert.match(out, /15,751 is not that figure in ANY tax year/);
    },
  );
});

test('it is pointed at something: the real suite is checked and counted', () => {
  // A checker that found no figures at all would pass every assertion above by
  // never running, so the clean-tree run has to report a floor. The real suite
  // holds nine hand-written copies of this table across eleven files.
  const out = execFileSync(process.execPath, [TOOL], { cwd: ROOT, encoding: 'utf8' });
  const checked = Number(/^ok — (\d+) hand-written/m.exec(out)?.[1] ?? 0);
  assert.ok(checked > 60, `only ${checked} figures checked — the scanner stopped finding them`);
  assert.match(out, /utah-child-credit\.test\.js/);
  assert.match(out, /status-households\.mjs/);
  // And the file it reads them against really is the shipping one.
  const fed = readFileSync(join(ROOT, 'packages/us-federal-tax/src/data/2027.ts'), 'utf8');
  assert.match(fed, /headOfHousehold: 24_925/);
});

test('the reverse sweep sees a copy hiding under a name the first sweep skips', () => {
  // The hole the other way. The first sweep only looks inside declarations whose
  // NAME says they are federal, so a tenth copy under any other name is a copy
  // this tool cannot see — and a gate that silently covers nine of ten tables is
  // today's own defect one level out.
  //
  // It found one on its first run: `arizona-deduction.test.js`'s `STATUTORY`,
  // which is exempt because those are Arizona's own amounts under
  // A.R.S. § 43-1041 as amended by HB 4168 — equal to the federal ones and not
  // them. `arizona-deduction.mjs` checks that on its own terms, which is the
  // only correct place: the day they diverge, Arizona's table is right.
  withFixture(
    'zz-federal-basis-probe.test.js',
    `const UTAH_THING = {
  single: 16_100,
  marriedFilingJointly: 32_200,
};
export default UTAH_THING;
`,
    ({ out, code }) => {
      assert.equal(code, 1, `a copy under an unscanned name was not reported:\n${out}`);
      assert.match(out, /UNDER A FILING-STATUS KEY/);
      assert.match(out, /zz-federal-basis-probe\.test\.js:UTAH_THING\s+single: 16,100/);
      // And it says what to do about it, both ways.
      assert.match(out, /rename it so the scan reaches it, or add it to NOT_FEDERAL/);
    },
  );
});

test('the Arizona exemption is named with a reason, not silently skipped', () => {
  const out = execFileSync(process.execPath, [TOOL], { cwd: ROOT, encoding: 'utf8' });
  assert.match(out, /arizona-deduction\.test\.js:STATUTORY/);
  assert.match(out, /HB 4168/);
  assert.match(out, /arizona-deduction\.mjs/);
});
