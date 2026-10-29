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
 * (`suiteFingerprint`).
 *
 * **This comment used to go on to say that a reworded doc comment changes
 * neither, "because `tsc` puts it in the `.d.ts`". That is false, and Day 42
 * corrected it in `fingerprint.mjs` and not here** — both packages set
 * `"removeComments": false`, so every doc comment is in the emitted `.js`, and
 * `mutantFingerprint` is a hash of raw bytes. Rewording a comment or correcting
 * a citation DOES invalidate a recorded score.
 *
 * **THE RULE, which is Day 42's own finding arriving one file late: a false
 * claim that appears in two files is corrected in two files, and the copy that
 * is not the one you were reading is the one that survives.** The claim behind
 * it is still true and still worth stating — a string is not a mutant, so this
 * fingerprint is STRICTER than the property it stands in for and can reject a
 * score that is in fact valid, which is the safe direction. Making it a
 * computation rather than an argument needs the digest to be over the ENUMERATED
 * LITERALS rather than over the file bytes, which is on the worklist and has now
 * cost two audit restarts (Day 42 one, Day 43 one).
 *
 * ```sh
 * node tools/mutation/check-scores.mjs          # report
 * node tools/mutation/check-scores.mjs --check  # and exit non-zero if stale
 * ```
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mutantFingerprint, suiteFingerprint } from './fingerprint.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RECORD = join(ROOT, 'tools', 'mutation', 'scores.json');
const CHECK = process.argv.includes('--check');
/**
 * `--write` updates the README's mutation table from the record.
 *
 * Day 37 built this file because "the mutation numbers were the last advertised
 * measurements in this repository that a human copied by hand". It has caught
 * the copy being wrong ever since and still left the copying to a human, which
 * is half a fix: `tools/test-counts.mjs` has had `--write` since Day 36 and this
 * had not.
 *
 * Only the README table, deliberately. Its rows begin with the package name, so
 * which number belongs to which package is unambiguous. STRATEGY.md writes the
 * same figures into PROSE that says "the federal engine" and "the state engine"
 * rather than naming the packages, so nothing in the file says which phrase
 * belongs to which record entry — and a `--write` that guessed would be a tool
 * for putting the right number in the wrong sentence. It stays checked and
 * hand-edited, and making it attributable is on the worklist.
 */
const WRITE = process.argv.includes('--write');

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
// `let`, because `--write` rewrites it per package and there are two. Read once
// into a string and written twice from that string, the second write would have
// discarded the first — the README is the shared state here, and two packages
// means two passes over it.
let README = readFileSync(join(ROOT, 'README.md'), 'utf8');
// Whitespace-collapsed, because the phrase it is searched for straddles a line
// break in prose and a check that fails on a newline is a check that teaches
// the reader to ignore it. The first run of this file reported exactly that.
//
// AND IT IS THE CURRENT REVIEW ALONE, WHICH IS A TIGHTENING DAY 66 MADE AFTER
// NOTICING THAT THE FILE IS A LOG. `STRATEGY.md` is twelve dated reviews newest
// first, separated by `---`, and every one of them quotes the score that was true
// on its own day. A substring search over the whole file is therefore satisfied by
// a HISTORICAL sentence: the moment two measurements happen to produce the same
// counts and score — which five consecutive days did, at 1,654 / 6 / 99.6% — a
// stale claim in today's review passes on the strength of an old one that was
// never meant to be checked.
//
// THE RULE: A CHECK OVER AN APPEND-ONLY LOG IS SATISFIED BY THE PAST, AND THE PAST
// IS THE ONE PART OF IT NOBODY IS CLAIMING ANY MORE. The scope is the text before
// the first `---`, which is this day's review and the only part of the file that
// asserts anything about this build.
const STRATEGY_FULL = readFileSync(join(ROOT, 'STRATEGY.md'), 'utf8');
const STRATEGY_REVIEWS = STRATEGY_FULL.split(/\n---\n/);
const STRATEGY = STRATEGY_REVIEWS[0].replace(/\s+/g, ' ');
// The split has to have found something, or the scope is silently the whole file
// again and this tightening undoes itself the day somebody reformats the headings.
// Twelve reviews today; the assertion is on there being MORE THAN ONE, because the
// count grows every time the strategy is reviewed and a count would go stale here
// exactly as the ones this file exists to check do.
if (STRATEGY_REVIEWS.length < 2) {
  process.stdout.write(
    'STRATEGY.md has no `---` separator, so the score phrase cannot be scoped to the current ' +
      'review. Check the file\'s structure before trusting this run.\n',
  );
  process.exit(1);
}

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
  } else if (WRITE) {
    // The cells are rewritten in place rather than rebuilt, so whatever prose a
    // cell carries beside its number — `6 — see the worklist` — survives.
    const cells = line.split('|');
    const put = (i, value) => {
      cells[i] = cells[i].replace(/[\d.]+/, String(value));
    };
    put(2, row.mutants);
    put(3, row.survivors);
    put(4, row.score);
    const updated = cells.join('|');
    if (updated !== line) {
      README = README.replace(line, updated);
      writeFileSync(join(ROOT, 'README.md'), README);
      process.stdout.write(`  WROTE  README.md: ${updated.trim()}\n`);
    }
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
  // **THE PERCENTAGE IS IN THE PHRASE SINCE DAY 65, and leaving it out was a hole
  // this file could not see.** The check was for `(1654 mutants, 6 survivors)`
  // alone, so STRATEGY.md could have read "**99.6%** (2436 mutants, 6
  // survivors)" — a stale score beside fresh counts — and passed. Every
  // occurrence in that file already writes the score immediately before the
  // counts, so the tighter phrase costs nothing and closes it.
  //
  // THE RULE: a check on PART of a claim passes a claim that is wrong in the
  // part it does not read, and the part left out is the headline number.
  const phrase = `**${row.score}%** (${row.mutants} mutants, ${row.survivors} survivors)`;
  if (!STRATEGY.includes(phrase)) {
    note(
      `${name}: STRATEGY.md's CURRENT review does not contain "${phrase}"` +
        (STRATEGY_FULL.replace(/\s+/g, ' ').includes(phrase)
          ? ' — an older review does, which is the case this check was scoped to stop counting'
          : ''),
    );
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
