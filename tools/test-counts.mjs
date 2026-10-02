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
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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
  if (tests === null) {
    // Day 37: this used to throw "no TAP summary" and discard the output, and
    // that is what five red CI runs looked like from the outside. The cause was
    // one directory with no `node_modules`, so `npm run build` died with
    // `tsc: not found` and there was nothing to summarise — a fact the error
    // had in its hand and threw away.
    //
    // **An error that reports the ABSENCE of the thing it wanted, when it is
    // holding the reason, costs the next reader the whole investigation.**
    // Day 15's rule was never to redirect a build to /dev/null when the next
    // command reads its output; this is the same rule for a build whose output
    // was captured and then dropped.
    const installed = existsSync(join(ROOT, relative, 'node_modules'));
    const tail = output.trim().split('\n').slice(-12).join('\n      ');
    throw new Error(
      `${relative}: no TAP summary in the output of \`npm test\`.\n` +
        (installed
          ? ''
          : `    ${relative}/node_modules does not exist, so \`npm run build\` had no \`tsc\`. ` +
            `Run \`npm install\` there — in CI, add it to the \`counts\` job in ` +
            `.github/workflows/ci.yml, which has to install every directory in PACKAGES.\n`) +
        `    The last of what \`npm test\` printed:\n      ${tail}`,
    );
  }
  return { tests, pass: read('pass'), fail: read('fail') };
};

const mode = process.argv.includes('--write')
  ? 'write'
  : process.argv.includes('--check')
    ? 'check'
    : 'print';

/**
 * Refuse to measure anything until every directory has its own dependencies.
 *
 * Day 37: this tool was green on every local run for two days and red on every
 * CI run for the same two days, and the reason was not in the repository. **This
 * sandbox has a global `tsc` at `/opt/node22/bin/tsc`; the GitHub runner does
 * not.** So `npm run build` worked here without `npm install` and died there
 * with `tsc: not found`, and "I ran it locally and it is green" — which this
 * project has leaned on for thirty-seven days — was checking a different thing
 * from CI.
 *
 * **THE RULE: a local verification that passes because of a tool the
 * environment happens to have is not a weaker version of CI, it is a check on
 * something else.** The gap cannot be closed by being careful, because the extra
 * tool is invisible from inside the run that benefits from it. It can be closed
 * by refusing the state CI cannot have.
 *
 * So this is a precondition rather than a diagnosis: if a measured directory has
 * no `node_modules`, stop here with the list, whatever is on PATH. A local run
 * and a CI run now fail for the same reason at the same point.
 */
const declaresDependencies = (relative) => {
  const manifest = JSON.parse(readFileSync(join(ROOT, relative, 'package.json'), 'utf8'));
  return Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }).length > 0;
};
// `site` declares none — it builds with `node` alone — so requiring a
// `node_modules` there would be requiring a directory npm has no reason to
// create. The precondition is about declared dependencies being present, not
// about a folder existing.
const uninstalled = PACKAGES.filter(
  (relative) => declaresDependencies(relative) && !existsSync(join(ROOT, relative, 'node_modules')),
);
if (uninstalled.length > 0) {
  process.stderr.write(
    `[test-counts] ${uninstalled.length} directory/ies declare dependencies and have no node_modules:\n` +
      uninstalled.map((relative) => `  ${relative}\n`).join('') +
      '[test-counts] Run `npm install` in each. This is refused rather than attempted because a\n' +
      '[test-counts] global `tsc` on PATH would let the build succeed here and fail in CI, which is\n' +
      '[test-counts] exactly what happened for the two days after this tool was written.\n',
  );
  process.exit(1);
}

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
  // ## And the READMEs the check above does not reach
  //
  // Day 38 wrote "from every one of its 393 tests" into the federal package's own
  // README and the state package's count into its own, and then noticed what it
  // had done: `us-tax-mcp/README.md` was the ONE README this tool checked, so
  // those two numbers would have been the next advertised measurements here that
  // a human has to copy by hand — the exact hole Day 36 built this tool to close
  // and Day 37 found still open for the mutation scores.
  //
  // So a package that states its OWN suite size has it checked against its own
  // runner. The claim is optional — most of these READMEs do not make it — and
  // checked wherever it is made, which is the only arrangement that does not
  // reward leaving it out.
  //
  // **The convention is the bold**, and it is load-bearing rather than
  // typographic: `**616 tests**` is a claim about the size of this package's
  // suite and is checked; `109 tests were passing a key this engine does not
  // read` is a FINDING that happens to be counted in tests, and no amount of
  // grammar in a regular expression tells those apart. Asking the author to mark
  // the claim does, and it matches how `us-tax-mcp/README.md` already writes all
  // three of its own.
  const OWN_SUITE_SIZE = /\*\*([\d,]+) tests\*\*/g;
  for (const relative of ['packages/us-federal-tax', 'packages/us-state-tax']) {
    const own = readFileSync(join(ROOT, relative, 'README.md'), 'utf8');
    for (const hit of own.matchAll(OWN_SUITE_SIZE)) {
      const stated = Number(hit[1].replace(/,/g, ''));
      if (stated === measured[relative].tests) continue;
      console.error(
        `\n${relative}/README.md advertises "${hit[0]}" and its suite ran ` +
          `${measured[relative].tests}. Either update the README or drop the bold, ` +
          `which is what marks a number as this package's own suite size.`,
      );
      process.exit(1);
    }
  }
  if (failing > 0) {
    console.error(`\n${failing} test(s) failing`);
    process.exit(1);
  }
  console.log('\ntools/test-counts.json and both kinds of README claim are current');
}
