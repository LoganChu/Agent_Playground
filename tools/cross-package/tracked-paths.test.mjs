/**
 * The guard in `tracked-paths.mjs`, run against the accident it was written for.
 *
 * Day 67 committed a 74,784-file AGPL virtualenv to `main`. A guard written the
 * day after is worth exactly as much as the evidence that it would have refused
 * that commit, so the paths below are **real paths out of `6e720f3bb`**, copied
 * from `git ls-tree -r`, and each is here because it is refused for a DIFFERENT
 * one of the four reasons.
 *
 * The test does not read git history: a CI checkout may be shallow, and a guard
 * that needs sixty-eight days of objects to prove itself is a guard that stops
 * proving itself the first time somebody clones with `--depth 1`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditPaths, MAX_TRACKED_FILES } from './tracked-paths.mjs';

/** Four real paths from the offending commit, one per assertion. */
const DAY_67 = {
  'a vendored source file': '.pe2/lib/python3.11/site-packages/policyengine_us/variables/gov/states/ne/tax/income/ne_income_tax.py',
  'compiled Python': '.pe2/lib/python3.11/site-packages/policyengine_us/variables/gov/states/mt/dphhs/ccap/eligibility/__pycache__/mt_ccap_eligible.cpython-311.pyc',
  'the AGPL grant itself': '.pe2/lib/python3.11/site-packages/policyengine_us-2.15.3.dist-info/licenses/LICENSE',
  'a shell activate script': '.pe2/bin/activate',
};

/** What this repository really tracks — the shape every assertion must pass. */
const REAL = [
  '.gitignore',
  'LICENSE',
  'JOURNAL.md',
  'packages/us-state-tax/LICENSE',
  'packages/us-state-tax/src/states/new-mexico.ts',
  'packages/us-state-tax/test/new-mexico.test.js',
  'tools/differential/theirs.py',
  'tools/differential/out/theirs.cases.sha256',
  'site/index.html',
  'site/style.css',
  '.github/workflows/ci.yml',
  'packages/us-tax-mcp/.gitignore',
];

test('the real tree passes all four assertions', () => {
  assert.deepEqual(auditPaths(REAL), []);
});

test('every one of the four assertions refuses a path from Day 67 on its own', () => {
  for (const [what, path] of Object.entries(DAY_67)) {
    const failures = auditPaths([...REAL, path]);
    assert.ok(
      failures.length > 0,
      `${what} (${path}) was accepted, so the guard would not have stopped Day 67`,
    );
    assert.ok(
      failures.some((f) => f.paths.includes(path)),
      `${what} failed the audit but no assertion named ${path}`,
    );
  }
});

test('the AGPL licence file is refused by the LICENCE assertion specifically', () => {
  // THE POINT OF HAVING FOUR. A vendored dependency whose every extension is
  // allowlisted — `.py`, `.md`, `.json` are all legitimate here — still cannot
  // arrive quietly, because it brings its own grant with it. This is the
  // assertion that is about the licence rather than about disk.
  const failures = auditPaths([...REAL, 'vendor/somepkg/LICENSE']);
  // THREE of the four fire on this one path and the third is the surprise: a
  // bare `LICENSE` has no extension, and the extension assertion allows an
  // extensionless file only BY PATH. So the four assertions are not
  // independent, and that is a property worth pinning rather than tidying —
  // overlapping guards are what made Day 67 catchable four ways.
  assert.equal(failures.length, 3);
  assert.ok(
    failures.some((f) => /licence files/.test(f.what) && f.paths.includes('vendor/somepkg/LICENSE')),
    'the licence assertion did not name it',
  );
  assert.ok(
    failures.some((f) => /top-level/.test(f.what) && f.paths.includes('vendor')),
    'the top-level assertion did not name vendor/',
  );
  assert.ok(
    failures.some((f) => /extension/.test(f.what) && f.paths.includes('vendor/somepkg/LICENSE')),
    'the extension assertion did not name it',
  );
});

test('a file count of Day 67’s order is refused with nothing else wrong with it', () => {
  // The catch-all, isolated: every path here is individually legitimate.
  const many = Array.from({ length: MAX_TRACKED_FILES + 1 }, (_, i) => `tools/generated-${i}.mjs`);
  const failures = auditPaths(many);
  assert.equal(failures.length, 1);
  assert.match(failures[0].what, /over the declared ceiling/);
});

test('the real tree is far enough under the ceiling that the ceiling is not a daily chore', () => {
  // 275 on the day it was set against a ceiling of 1,200. If this ever fails,
  // the ceiling needs RAISING deliberately with a new measurement beside it —
  // not deleting, which is what every stale guard in this repo died of.
  assert.ok(REAL.length < MAX_TRACKED_FILES);
  assert.equal(MAX_TRACKED_FILES, 1_200);
});
