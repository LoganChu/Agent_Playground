#!/usr/bin/env node
/**
 * Count the tests each package actually runs, and check the README against it.
 *
 * ## Why this exists
 *
 * `packages/us-tax-mcp/test/readme.test.js` carried this, for nine days:
 *
 *     test('the test counts the README advertises are the real ones', () => {
 *       // Deliberately brittle: if the suites grow, this fails and the README
 *       // gets updated, rather than quietly overstating the coverage.
 *       assert.equal(claimed[1], '283', 'federal engine test count is stale');
 *
 * It compared the README to a literal copied out of the README. The suites had
 * grown to 368, 581 and 159 by Day 36 and the assertion had never once fired,
 * because there was nothing in it that knew how many tests there are.
 *
 * **THE RULE: a test that pins a claim to a COPY of the claim cannot catch the
 * claim going stale, and reads exactly like one that can.** The comment saying
 * "deliberately brittle" is the tell — brittleness was the whole intent, and the
 * assertion was rigid instead: it fails when the README changes and never when
 * the world does.
 *
 * A count of tests is not available from inside a suite: `node:test` exposes no
 * registry, and a static count of `test(` call sites misses the 21 the federal
 * suite generates in a loop over years. The only thing that knows is the runner.
 * So the measurement moves out here, where the runner can be invoked, and the
 * suite's own assertion compares the README against the number this tool
 * committed.
 *
 * ## Usage
 *
 *     node tools/test-counts.mjs            # measure and print
 *     node tools/test-counts.mjs --write     # measure and update tools/test-counts.json
 *     node tools/test-counts.mjs --check     # fail if the committed numbers are stale
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RECORD = join(ROOT, 'tools', 'test-counts.json');

const PACKAGES = ['packages/us-federal-tax', 'packages/us-state-tax', 'packages/us-tax-mcp', 'site'];

/** Run one package's suite and read the counts out of the TAP summary. */
const measure = (relative) => {
  let output;
  try {
    output = execFileSync('npm', ['test'], {
      cwd: join(ROOT, relative),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    // A failing suite still prints its summary, and a stale count is not the
    // interesting news when a test is red — so report both.
    output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
  }
  const read = (label) => {
    const matches = [...output.matchAll(new RegExp(`^# ${label} (\\d+)$`, 'gm'))];
    return matches.length === 0 ? null : Number(matches.at(-1)[1]);
  };
  const tests = read('tests');
  if (tests === null) throw new Error(`${relative}: no TAP summary in the output of \`npm test\``);
  return { tests, pass: read('pass'), fail: read('fail') };
};

const mode = process.argv.includes('--write')
  ? 'write'
  : process.argv.includes('--check')
    ? 'check'
    : 'print';

const measured = {};
for (const relative of PACKAGES) {
  process.stderr.write(`[test-counts] ${relative}\n`);
  measured[relative] = measure(relative);
}
const total = Object.values(measured).reduce((sum, row) => sum + row.tests, 0);
const failing = Object.values(measured).reduce((sum, row) => sum + (row.fail ?? 0), 0);

for (const [relative, row] of Object.entries(measured)) {
  console.log(`${relative.padEnd(26)} ${String(row.tests).padStart(5)} tests, ${row.fail} failing`);
}
console.log(`${'TOTAL'.padEnd(26)} ${String(total).padStart(5)} tests, ${failing} failing`);

if (mode === 'write') {
  writeFileSync(
    RECORD,
    `${JSON.stringify(
      {
        measured: new Date().toISOString().slice(0, 10),
        total,
        packages: Object.fromEntries(Object.entries(measured).map(([k, v]) => [k, v.tests])),
      },
      null,
      2,
    )}\n`,
  );
  console.log(`wrote ${RECORD}`);
} else if (mode === 'check') {
  const record = JSON.parse(readFileSync(RECORD, 'utf8'));
  const stale = Object.entries(measured).filter(([k, v]) => record.packages[k] !== v.tests);
  if (stale.length > 0 || record.total !== total) {
    console.error('\ntools/test-counts.json is stale:');
    for (const [k, v] of stale) console.error(`  ${k}: recorded ${record.packages[k]}, ran ${v.tests}`);
    if (record.total !== total) console.error(`  total: recorded ${record.total}, ran ${total}`);
    console.error('\nRun `node tools/test-counts.mjs --write` and update the README numbers beside it.');
    process.exit(1);
  }
  // And the README that quotes them, which is the claim a reader actually sees.
  const readme = readFileSync(join(ROOT, 'packages/us-tax-mcp/README.md'), 'utf8');
  const quoted = /\*\*([\d,]+) tests\*\*[\s\S]*?\*\*([\d,]+) tests\*\*[\s\S]*?\*\*([\d,]+) more\*\*/.exec(readme);
  if (quoted === null) {
    console.error('\npackages/us-tax-mcp/README.md no longer states the three test counts');
    process.exit(1);
  }
  const claimed = quoted.slice(1, 4).map((text) => Number(text.replace(/,/g, '')));
  const expected = [
    measured['packages/us-federal-tax'].tests,
    measured['packages/us-state-tax'].tests,
    measured['packages/us-tax-mcp'].tests,
  ];
  if (claimed.join() !== expected.join()) {
    console.error(
      `\npackages/us-tax-mcp/README.md claims ${claimed.join(', ')} tests and the suites ran ` +
        `${expected.join(', ')}. Update the README.`,
    );
    process.exit(1);
  }
  if (failing > 0) {
    console.error(`\n${failing} test(s) failing`);
    process.exit(1);
  }
  console.log('\ntools/test-counts.json and the README are current');
}
