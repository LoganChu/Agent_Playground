/**
 * Is the mutation score this repository advertises a score of this repository?
 *
 * ## The defect this exists for
 *
 * Day 33 built the mutation audit and made "how sensitive are the tests" a
 * measured number instead of a claim. Day 35 left the rule that a score may not
 * be INFERRED. Day 36 added that it may not be INHERITED either, having twice
 * invalidated a run in flight by editing a string.
 *
 * All three left the enforcement to a future run remembering, and Day 37 found
 * the bill: `README.md` advertised `us-federal-tax` at **698 mutants** for a day
 * after the committed, measured figure became **711**. The mutation numbers were
 * the last advertised measurements in this repository that a human copied by
 * hand — the same hole Day 36 closed for the test counts, sitting directly
 * beside it and missed because the test-count fix was the day's subject and this
 * was not.
 *
 * **THE RULE: a measurement is only ever a measurement OF something, and the
 * something has to be recorded beside it.** A score with no fingerprint cannot
 * be told from a stale score by reading it, which is the only property that
 * matters for a number whose whole purpose is to be more trustworthy than
 * "well tested".
 *
 * ## The split, and why it is the useful one
 *
 * Running the audits takes hours, so they stay weekly (`.github/workflows/
 * mutation.yml`) and write `scores.json` with `--record`. THIS runs on every
 * push, costs a build, and answers the cheap half:
 *
 *   - do the documents agree with the record?        (a copy-paste check)
 *   - was the record measured over THIS build?       (a staleness check)
 *
 * The second is the one that could not be done before. It separates the two
 * reasons a score can move, because they want different fixes: the parameters
 * changed (`mutantFingerprint`), or the suite that kills them changed
 * (`suiteFingerprint`). A reworded doc comment changes neither, because `tsc`
 * puts it in the `.d.ts` — so **"a string is not a mutant" is now a computation
 * rather than an argument.**
 *
 * ```sh
 * node tools/mutation/check-scores.mjs          # report
 * node tools/mutation/check-scores.mjs --check  # and exit non-zero if stale
 * ```
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mutantFingerprint, suiteFingerprint } from './fingerprint.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RECORD = join(ROOT, 'tools', 'mutation', 'scores.json');
const CHECK = process.argv.includes('--check');

const problems = [];
const note = (message) => {
  problems.push(message);
  process.stdout.write(`  STALE  ${message}\n`);
};

if (!existsSync(RECORD)) {
  process.stderr.write(
    `[scores] ${RECORD} does not exist. Run an audit with --record to create it:\n` +
      '  node tools/mutation/mutate.mjs packages/us-federal-tax --record tools/mutation/scores.json\n',
  );
  process.exit(1);
}
const record = JSON.parse(readFileSync(RECORD, 'utf8'));
const README = readFileSync(join(ROOT, 'README.md'), 'utf8');
// Whitespace-collapsed, because the phrase it is searched for straddles a line
// break in prose and a check that fails on a newline is a check that teaches
// the reader to ignore it. The first run of this file reported exactly that.
const STRATEGY = readFileSync(join(ROOT, 'STRATEGY.md'), 'utf8').replace(/\s+/g, ' ');

for (const [name, row] of Object.entries(record.packages)) {
  const dir = join(ROOT, 'packages', name);
  process.stdout.write(`\n${name} — measured ${row.measured}: ${row.mutants} mutants, ${row.survivors} survivors, ${row.score}%\n`);

  // The same precondition `tools/test-counts.mjs` learned the hard way on the
  // same day: a build that works because of a global `tsc` is not the build CI
  // gets. Refused rather than attempted.
  if (!existsSync(join(dir, 'node_modules'))) {
    process.stderr.write(
      `[scores] ${name} has no node_modules, so a fresh build would depend on whatever \`tsc\` is\n` +
        '[scores] on PATH. Run `npm install` there first.\n',
    );
    process.exit(1);
  }
  execFileSync('npm', ['run', 'build'], { cwd: dir, stdio: ['ignore', 'ignore', 'pipe'] });

  const mutants = mutantFingerprint(dir);
  const suite = suiteFingerprint(dir);
  if (mutants !== row.mutantFingerprint) {
    note(
      `${name}: the score was measured over parameters fingerprinted ${row.mutantFingerprint} and ` +
        `this build is ${mutants}. The PARAMETERS changed, so the score is of a package that no ` +
        'longer exists — re-run the audit with --record.',
    );
  }
  if (suite !== row.suiteFingerprint) {
    note(
      `${name}: the score was measured against a suite fingerprinted ${row.suiteFingerprint} and ` +
        `this one is ${suite}. The SUITE changed, which is the thing doing the killing — re-run ` +
        'the audit with --record.',
    );
  }

  // The documents. A number a human copied is the thing this file exists to
  // stop, so both places that advertise it are checked against the record and
  // not against each other.
  // Split on the pipes rather than matching a regex over them: a markdown table
  // row is already delimited, and the first draft of this check died on its own
  // backslashes instead of on a stale number.
  const line = README.split('\n').find((text) => text.startsWith(`| \`${name}\``));
  if (line === undefined) {
    note(`${name}: README.md has no mutation table row for it`);
  } else {
    const cells = line.split('|').map((cell) => cell.trim());
    const number = (cell) => Number((String(cell).match(/[\d.]+/) ?? ['NaN'])[0]);
    const [, , mutantCell, survivorCell, scoreCell] = cells;
    if (number(mutantCell) !== row.mutants) {
      note(`${name}: README says ${number(mutantCell)} mutants, the record says ${row.mutants}`);
    }
    if (number(survivorCell) !== row.survivors) {
      note(`${name}: README says ${number(survivorCell)} survivors, the record says ${row.survivors}`);
    }
    if (number(scoreCell) !== row.score) {
      note(`${name}: README says ${number(scoreCell)}%, the record says ${row.score}%`);
    }
  }
  const phrase = `(${row.mutants} mutants, ${row.survivors} survivors)`;
  if (!STRATEGY.includes(phrase)) {
    note(`${name}: STRATEGY.md does not contain "${phrase}"`);
  }
}

// A record only checks what is in it, so a package that drops out of the record
// is silently unchecked — which is the same defect as a list nobody prunes. Every
// row of the README's mutation table has to have a record entry.
for (const line of README.split('\n')) {
  const named = /^\| `(us-[a-z-]+)`/.exec(line);
  if (named === null) continue;
  if (!line.includes('|')) continue;
  if (!(named[1] in record.packages)) {
    note(`${named[1]}: README advertises a mutation score for it and scores.json has no entry`);
  }
}

if (problems.length === 0) {
  process.stdout.write('\nEvery advertised mutation score matches the record, and the record matches this build.\n');
  process.exit(0);
}
process.stdout.write(`\n${problems.length} stale mutation claim(s).\n`);
process.exit(CHECK ? 1 : 0);
