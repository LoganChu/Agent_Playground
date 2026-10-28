#!/usr/bin/env node
/**
 * A LEVELS audit that runs, rather than a grep.
 *
 * ## Why this exists
 *
 * Day 32 found a Virginia defect that had had its own test case for a month. The
 * test asserted a DIFFERENCE — what one exemption was worth — and the age
 * deduction sat on both sides of the subtraction, so the assertion was `$99.47`
 * with the deduction at `$12,000` and `$99.47` with it at `$0`. The household was
 * right, the statute was read right, and the test was structurally incapable of
 * failing.
 *
 * THE RULE it left: an assertion on a difference tests the difference and nothing
 * else. The open question it left: how much of the suite is differences?
 *
 * That question cannot be answered by reading the tests, because the tell is not
 * in the assertion's SHAPE. `assert.equal(r.tax, 1612.40)` is a level and
 * `assert.equal(withSpouse.tax - without.tax, 99.47)` is a difference, but so is
 * `assert.equal(a.tax, b.tax)`, and so is any level computed from a household the
 * parameter cannot reach. The only honest question is the operational one:
 *
 *   IF THIS NUMBER WERE WRONG, WOULD ANY TEST FAIL?
 *
 * So this harness sets each number wrong, one at a time, and runs the suite.
 *
 * ## What a survivor is, and what it is not
 *
 * A SURVIVOR is a parameter this package can be shipped with a wrong value for.
 * That is not automatically a bug — a rate in a registry of 1,033 municipal rates
 * cannot have its own test, and pretending otherwise would be theatre. It is a
 * statement about what the suite pins, which is the thing nobody had measured.
 *
 * Registries are excluded by `--skip`, so the report is about RULE parameters:
 * thresholds, amounts, rates, ages, phase-outs — every number a statute puts in a
 * sentence rather than in a table of localities.
 *
 * ## How it mutates
 *
 * The operator has to produce a value that is wrong but still the same KIND of
 * thing, or the mutant dies of a type error rather than of being wrong:
 *
 *   rate   (0 < v < 1)      ->  v / 2     halve it
 *   year   1900..2100, `2024` ->  v - 1     one year off, the classic off-by-one
 *   money  v >= 100           ->  v * 2     double it
 *
 * The year band overlaps real money — `additionalStandardDeduction.single` is
 * `2_000` — and a `-1` on a $2,000 deduction is six cents of tax, which rounds
 * away and reports a survivor that is an artefact of the operator. The
 * SEPARATOR settles it: this codebase writes years bare (`finalYear: 2024`) and
 * money with separators (`2_000`), so a four-digit literal containing `_` is
 * money and gets doubled. Three survivors in the first run were this, one per
 * year, and the parameter they named (§ 63(f)'s aged amount for an unmarried
 * filer) turned out to be genuinely untested anyway — so the operator bug hid a
 * real finding behind a fake one of the same shape.
 *
 * Doubling is chosen over `+1` deliberately: a `+1` on a `$12,000` deduction is
 * `$0.06` of Virginia tax and can round away, and a mutant that dies of rounding
 * teaches nothing. Doubling is unmistakable.
 *
 * ## Mutating the BUILD, not the source
 *
 * Each mutant patches `dist/esm/**.js` and runs `node --test test/*.test.js`
 * directly, so no mutant pays for a `tsc` run. The tests import from
 * `../dist/esm/index.js`, so each worker gets its own copy of the package tree
 * and they cannot see each other's mutants.
 *
 * Usage:
 *   node tools/mutation/mutate.mjs <packageDir> [--workers N] [--skip a,b]
 *                                  [--only substr] [--limit N] [--json out.json]
 *                                  (--record | --no-record)  <- required for a FULL run
 *                                  [--max-survivors N] [--record [FILE]]
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { execFile, execFileSync, execSync } from 'node:child_process';
import { enumerateMutants } from './enumerate.mjs';
import {
  attributionOf,
  codeAtIn,
  codesIn,
  mentionsIn,
  narrowableIn,
  planSteps,
} from './select.mjs';
import { promisify } from 'node:util';
import os from 'node:os';

const argv = process.argv.slice(2);
const pkgDir = argv[0];
if (!pkgDir) {
  console.error('usage: mutate.mjs <packageDir> (--record|--no-record) [--workers N] [--skip a,b] [--only s] [--limit N] [--json f]');
  process.exit(2);
}
/**
 * Read `--name value`, or `dflt` when the flag is absent.
 *
 * **`presentWithoutValue` is the whole of Day 42's lesson in this file.** The
 * old version returned `argv[i + 1]` unconditionally, so `--record` written as
 * the LAST argument — with no path after it — returned `undefined`, which is
 * falsy, which made the record block below do nothing at all. A 1,267-mutant
 * audit ran for 105 minutes, printed a correct report, and recorded nothing,
 * and there was no way to tell until `check-scores.mjs` still called the score
 * stale afterwards.
 *
 * THE RULE: a flag that is PRESENT and does nothing is worse than a flag that
 * is missing, because the command line says the thing was asked for. So a flag
 * given without a value now takes `presentWithoutValue` where that makes sense
 * and throws where it does not, and `--record` announces its destination at
 * START-UP rather than on success — a long measurement must not be able to
 * decline to record silently.
 */
const flag = (name, dflt, presentWithoutValue) => {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return dflt;
  const value = argv[i + 1];
  if (value === undefined || value.startsWith('--')) {
    if (presentWithoutValue !== undefined) return presentWithoutValue;
    console.error(`[mutate] --${name} needs a value`);
    process.exit(2);
  }
  return value;
};
const WORKERS = Number(flag('workers', Math.max(2, Math.min(8, os.cpus().length))));
/**
 * Files the state package's audit has always left out, as a DEFAULT rather than
 * as a line in a README.
 *
 * Day 43 started a two-hour recorded measurement with the wrong flags, because
 * the invocation every previous run used lived in `tools/mutation/README.md` and
 * nowhere the program could read. It enumerated 1,626 mutants instead of 1,356
 * and would have recorded a score against a different mutant set from every
 * score before it. `check-scores.mjs` compares the `skipped` list and would have
 * rejected it, which is the only thing that stood between a wrong flag and a
 * wrong number in the README.
 *
 * **THE RULE, which is Day 42's with the sign flipped: a flag that is PRESENT
 * and does nothing is worse than one that is missing, and a flag that is ABSENT
 * while the run silently measures something ELSE is worse than both.** Day 42's
 * fix was to announce at start-up what the run would record; this one is to make
 * the invocation a property of the harness, so that there is nothing to
 * remember, and to announce the effective list for the same reason.
 *
 * The locality registries are left out because they are DATA — 1,033 rates and
 * names transcribed from ordinances — rather than rules, and a mutation score
 * over a registry measures whether the registry has a test per row, which is a
 * different question from whether the rules are pinned. Pass `--skip none` to
 * include them.
 */
const DEFAULT_SKIP = {
  'us-state-tax': [
    'localities/ohio.js',
    'localities/ohio-school-districts.js',
    'localities/indiana.js',
    'localities/michigan.js',
    'localities/maryland.js',
    'localities/new-york.js',
    'localities/counties.js',
  ],
};
const SKIP_GIVEN = flag('skip', null);
const SKIP =
  SKIP_GIVEN === null
    ? (DEFAULT_SKIP[basename(pkgDir)] ?? [])
    : SKIP_GIVEN === 'none'
      ? []
      : String(SKIP_GIVEN).split(',').filter(Boolean);
const ONLY = flag('only', null);
const LIMIT = Number(flag('limit', Infinity));
const JSON_OUT = flag('json', null);
const SHARD = flag('shard', null); // "i/n"
// A ratchet, used by CI. `--max-survivors 0` exits non-zero if anything survives.
// It is a ratchet on a MEASUREMENT, which Day 31 warns about — so it is set from
// the number the package actually reaches with every gap closed, not from a
// number chosen to pass, and raising it is a deliberate edit with a reason.
const MAX_SURVIVORS = flag('max-survivors', null);
// Where to record the score and the fingerprint of what produced it.
// Bare `--record` writes the repository's own score file, which is what every
// caller has ever wanted and what the usage line above now says.
const RECORD_OUT = flag('record', null, 'tools/mutation/scores.json');

/**
 * A FULL RUN MUST CHOOSE. `--record` or `--no-record`, explicitly, or this
 * refuses to start.
 *
 * ## Why an announcement was not enough
 *
 * Day 42 lost 105 minutes to a run that recorded nothing, and the fix was to
 * ANNOUNCE the destination at start-up: `[mutate] NOT recording (pass --record
 * to write tools/mutation/scores.json)`. Day 43 lost a two-hour run to the wrong
 * flags and the fix was the same announcement, louder.
 *
 * **Day 47 read that line twice, in the log of two separate runs, and started a
 * third without the flag.** The announcement is correct, prominent, and printed
 * before any work happens. It did not work, because it is a message addressed to
 * somebody who has already decided what they are doing.
 *
 * **THE RULE: AN ANNOUNCEMENT AT START-UP IS NOT A GUARD. A guard is something
 * that will not proceed.** This is the same distinction the repository draws
 * everywhere else between a note and an assertion — a note tells a reader
 * something, an assertion refuses to let them be wrong — and the mutation
 * harness had the note and not the assertion for five days.
 *
 * Scoped to a FULL run on purpose. `--limit` and `--only` exist to check the
 * harness rather than the package, cannot be recorded anyway (see the refusal
 * below), and are run casually and often; making those choose would be the kind
 * of friction that gets a guard deleted.
 */
const NO_RECORD = argv.includes('--no-record');
if (RECORD_OUT === null && !NO_RECORD && ONLY === null && !Number.isFinite(LIMIT)) {
  console.error(
    '[mutate] REFUSED to start: a full run must say whether it is recording.\n' +
      '\n' +
      `  --record       write the score and both fingerprints to tools/mutation/scores.json\n` +
      '  --no-record    measure only, and leave the committed score alone\n' +
      '\n' +
      'This run is 1,400-odd mutants and takes about two hours on four cores. Day 42 lost\n' +
      '105 minutes to a run that recorded nothing and Day 47 lost two more, both times with\n' +
      'the "NOT recording" line sitting in the log. An announcement is not a guard.',
  );
  process.exit(2);
}

// ---- enumerate ----
// The enumerator lives in `enumerate.mjs` so that a TEST can import it. This
// script runs an audit on import, so for as long as `maskNonCode` lived in here
// there was no way to call it from a suite — which is why "give the mutation
// harness a test suite" sat on the worklist from Day 54 to Day 58. See that
// file's header; the move was checked by dumping the enumeration before and
// after and comparing it element by element.
const esm = join(pkgDir, 'dist/esm');
const { files, mutants } = enumerateMutants(esm, SKIP);
let selected = ONLY ? mutants.filter((x) => x.rel.includes(ONLY)) : mutants;
if (SHARD) {
  const [i, n] = SHARD.split('/').map(Number);
  selected = selected.filter((_, k) => k % n === i);
}
selected = selected.slice(0, LIMIT);
console.error(`[mutate] ${pkgDir}: ${selected.length} mutants over ${files.length} files, ${WORKERS} workers`);
// Announced for the same reason the record destination is: a measurement that
// takes two hours must say what it is measuring BEFORE the wait, not after it.
console.error(
  SKIP.length === 0
    ? '[mutate] skipping no files'
    : `[mutate] skipping ${SKIP.length} file(s)${SKIP_GIVEN === null ? ' (harness default for this package)' : ' (--skip)'}: ${SKIP.join(', ')}`,
);

// ---- baseline ----
// Some test files assert about the REPOSITORY rather than about the engine —
// `readme.test.js` checks that no README advertises a stale tarball URL and that
// every markdown table in every README is still a table. Those read sibling
// packages, so they cannot pass inside a worker copy, and no parameter mutation
// could ever make them fail. Excluding them is not lowering the bar: a test that
// no mutant can kill contributes nothing to the score in either direction, and
// leaving them in makes the BASELINE red, which would mark every mutant killed.
const SKIP_TESTS = String(flag('skip-tests', 'readme.test.js')).split(',').filter(Boolean);

/**
 * A test file that reads a SIBLING package cannot run inside a worker copy, and
 * the list above is the wrong way to know which ones do.
 *
 * Day 38 found that out by being refused. Two new test files cross-check one
 * package's guard module against the other's, byte for byte — two independent
 * zero-dependency packages cannot share a module, so there are two copies, and
 * two copies of a fact that must agree is a bug with a waiting period. Both
 * assertions reach `../../<other-package>/src/`, both are green in the
 * repository, and both made the baseline red in here. The harness was right to
 * refuse and the diagnosis cost nothing, because it printed the three failures.
 *
 * So the criterion is DERIVED instead of listed: a file that resolves a path out
 * of its own package is a repository assertion, no parameter mutation can make
 * it fail, and it cannot be satisfied from a copy of one package. Added to the
 * name list rather than replacing it — un-skipping `readme.test.js` would change
 * what the score is a score of, which is not a change to make in passing — and
 * every skip is PRINTED, because a measurement tool that silently drops tests is
 * the defect this whole file exists to find.
 */
const ESCAPES_PACKAGE = /\.\.['"]\s*,\s*['"]\.\.|\.\.\/\.\./;
const escaping = readdirSync(join(pkgDir, 'test'))
  .filter((f) => f.endsWith('.test.js'))
  .filter((f) => !SKIP_TESTS.includes(f))
  .filter((f) => ESCAPES_PACKAGE.test(readFileSync(join(pkgDir, 'test', f), 'utf8')));
const TEST_FILES = readdirSync(join(pkgDir, 'test'))
  .filter((f) => f.endsWith('.test.js'))
  .filter((f) => !SKIP_TESTS.includes(f) && !escaping.includes(f));
for (const f of SKIP_TESTS) console.error(`[mutate] not run: test/${f} (named in --skip-tests)`);
for (const f of escaping) console.error(`[mutate] not run: test/${f} (reads outside the package)`);
/**
 * One `node --test` per mutant, every file in the suite, **in one process**.
 *
 * Day 40 measured the obvious speedup and it was BACKWARDS, and the diagnosis in
 * that note was right while the remedy was aimed at the wrong knob. `node --test`
 * spawns one CHILD PROCESS PER TEST FILE, so N workers each running a 50-file
 * suite put 50N node startups on 4 cores; the cost is startup and not contention.
 * Day 40 tried `--test-concurrency=1`, which controls how many of those children
 * run at once, and took 43 Alabama mutants from 4m11s to 9m42s — because
 * serialising the children removed the only parallelism that was hiding their
 * cost. The knob that removes the children themselves is a different one.
 *
 * `--experimental-test-isolation=none` runs every file in the SAME process.
 * Measured on this suite, Day 43:
 *
 * ```text
 * one suite run, standalone        real     user
 *   default (one process/file)     8.27s   14.49s
 *   isolation=none                 6.53s    7.35s
 *
 * the audit itself, four workers on four cores
 *   default                        11.1 mutants/min
 *   isolation=none                 13.8 mutants/min   -> 24% faster
 * ```
 *
 * **24%, and the first version of this comment said "twice as fast".** That was
 * inferred from the user time halving and it is the wrong inference: with workers
 * equal to cores the wall clock tracks the REAL time of one run, because the
 * per-file children were already saturating the cores and their cost was inside
 * that real time. User time predicts how the win SCALES when cores are added —
 * `--workers 8` on eight cores runs eight single-threaded processes here and
 * sixty-four on the old path — not what the win is on four.
 *
 * Both modes report the same 765 tests and 765 passes, both exit non-zero on a
 * planted mutant, and `--only ohio.js` returns the same 64 mutants and the same
 * two survivors on both, which is what validated the change before it was
 * trusted.
 *
 * It is a DEFAULT and not an optimisation to remember, for Part 12's reason:
 * `--test-isolation process` restores the old behaviour, and the mode in force
 * is announced at start-up. If the running Node does not support the flag the
 * probe below falls back with a message, rather than leaving a red baseline to
 * be diagnosed.
 *
 * The fewer-FILES-per-mutant idea in Day 40's note is still worth having and is
 * now worth less: selecting the test files that can reach the mutated module
 * would cut the remaining 7.35s of user time, and the sound way to do it is to
 * re-run every SURVIVOR against the whole suite, because a mis-selection can
 * only ever under-kill. Left on the worklist.
 */
const ISOLATION = String(flag('test-isolation', 'none'));
function isolationArgs(mode) {
  return mode === 'none' ? ['--experimental-test-isolation=none'] : [];
}
let isolation = ISOLATION;
if (isolation === 'none') {
  // A probe rather than a version check: the flag's name has changed once
  // already and a version table would be a second copy of the truth.
  try {
    execFileSync(
      process.execPath,
      ['--test', ...isolationArgs('none'), `test/${TEST_FILES[0]}`],
      { cwd: pkgDir, stdio: 'pipe', timeout: 120_000 },
    );
  } catch (e) {
    if (/not allowed|bad option|unknown option/i.test(String(e.stderr || ''))) {
      console.error(
        `[mutate] this Node (${process.version}) does not support --experimental-test-isolation; running one process per test file`,
      );
      isolation = 'process';
    }
    // Any other failure is a red test file, which the baseline check below is
    // the right place to report.
  }
}
console.error(
  isolation === 'none'
    ? `[mutate] one node process per mutant (--experimental-test-isolation=none) over ${TEST_FILES.length} test files`
    : `[mutate] one node process per TEST FILE (${TEST_FILES.length} per mutant)`,
);
const TESTCMD = ['--test', ...isolationArgs(isolation), ...TEST_FILES.map((f) => `test/${f}`)];
const execFileAsync = promisify(execFile);

/**
 * Run one worker's copy of the suite — **asynchronously**, which is the whole of
 * Day 44's speed finding and is not an optimisation.
 *
 * This was `execFileSync` from the day the worker pool was written. The pool
 * starts `WORKERS` copies of {@link worker}, each an `async` function over its
 * own chunk of the mutant list — and a SYNCHRONOUS child-process call blocks the
 * one event loop they all share, so the first worker to reach `runSuite` held it
 * until the suite returned and the other three could not start. **Four queues,
 * one runner.** The start-up line said "4 workers" the entire time.
 *
 * Measured on this container, Day 44, 1,357 mutants over the state package:
 *
 * ```text
 * one suite run, standalone        real 11.52s   user 14.44s
 * serial (execFileSync)            ~16 s/mutant  ->  about 4.3 hours
 * ```
 *
 * The giveaway was `ps`: **two node processes**, the harness and one child, with
 * a load average of 1.5 on four cores. A pool of four that is really one shows
 * up as three idle cores, and nothing in the harness's own output could say so,
 * because the only thing it prints is `WORKERS`.
 *
 * **THE RULE: a worker pool whose work is a SYNCHRONOUS call is a pool of one,
 * and it reports the number of workers you asked for.** Day 43 Part 12's rule
 * was "a flag that is PRESENT and does nothing is worse than one that is
 * missing"; this is the same thing one level down, where the flag is honoured,
 * the number is printed, and the concurrency it names never existed.
 *
 * `maxBuffer` is explicit rather than defaulted, and the figure is measured: the
 * green suite's TAP output is 152 KB against a 1 MB default, so the default was
 * never binding — but a default that is not binding by a factor of seven is a
 * default that a hundred more tests could make binding, and an overflow here
 * throws, which `runSuite` reads as NOT GREEN, which reads as a mutant KILLED.
 * **The failure mode of this buffer is a score that is too high**, so it gets a
 * number with a reason rather than a default with none.
 */
async function runSuite(dir) {
  return runFiles(dir, TEST_FILES, null);
}

/**
 * One `node --test` over the given test files, optionally narrowed to the tests
 * whose NAME matches `pattern`.
 *
 * `passed` is read back out of the TAP summary and is not decoration: a
 * `--test-name-pattern` that matches nothing produces a GREEN run of zero tests,
 * which this harness would read as a surviving mutant. The count is how the
 * caller can tell "nothing failed" from "nothing ran", and the startup guard
 * below refuses to begin if any selection is empty.
 */
async function runFiles(dir, files, pattern) {
  const args = [
    '--test',
    ...isolationArgs(isolation),
    ...(pattern === null ? [] : [`--test-name-pattern=${pattern}`]),
    ...files.map((f) => `test/${f}`),
  ];
  const read = (s) => Number(/^# pass (\d+)$/m.exec(s)?.[1] ?? -1);
  try {
    const { stdout } = await execFileAsync(process.execPath, args, {
      cwd: dir,
      timeout: 120_000,
      maxBuffer: 64 * 1024 * 1024,
    });
    return { green: true, passed: read(String(stdout)) };
  } catch (e) {
    const out = String(e.stdout || '') + String(e.stderr || '');
    return { green: false, out, passed: read(out) };
  }
}

/**
 * PER-MUTANT TEST SELECTION — AND WHY IT CANNOT MOVE THE SCORE.
 *
 * ## The arithmetic that forced it
 *
 * Day 64 shipped Arkansas and the audit stopped fitting in a day. 2,436 mutants
 * against a 35-second suite on four cores is about FIFTEEN HOURS, so the run was
 * started, reached 100 mutants in 38 minutes, and was stopped; `scores.json` kept
 * Day 63's figures and the score check went red by construction. The cause is the
 * SUITE's growth rather than the state count: every mutant ran all 66 test files.
 *
 * ## Why it is sound, which is the only part that matters
 *
 * A selection that MISSES the test which would have killed a mutant does not
 * report a wrong score, because a mutant that survives its selection is re-run
 * against the WHOLE suite before it is called a survivor. So:
 *
 *   killed by the selection   -> killed, and a real test failure says so
 *   survived the selection    -> re-run on all 66 files, and that verdict stands
 *
 * **THE SCORE IS THEREFORE IDENTICAL TO A FULL RUN, mutant for mutant, whatever
 * the selection does.** A bad selection costs TIME — a full re-run per mutant it
 * failed to kill — and cannot cost accuracy. That is the property that makes this
 * worth doing at all, and it is the reason the idea sat in this file's header from
 * Day 40 as "a mis-selection can only ever under-kill".
 *
 * ## What is selected
 *
 * 2,320 of the 2,436 mutants are in `states/*.js`, and a parameter in one state's
 * module can only change an answer for a household in that state. So for those:
 *
 *   1. the two state-sweep guards, narrowed to that state's own tests with
 *      `--test-name-pattern`. Day 65 split both into one `test()` per state for
 *      exactly this; before that they were one test each and could not be
 *      narrowed. They are the two most expensive files in the suite (16.5s of
 *      26.6s) and they fall to 0.6s for one state.
 *   2. every test file that names that state's code, plus every test file that
 *      names NO state code at all — those are the package-wide guards and have to
 *      run for everything.
 *
 * The 116 mutants outside `states/*.js` — `data/provenance.js` holds 100 of them,
 * and its entries are not separable by state — get the whole suite, as before.
 *
 * Measured on this container for an Arkansas mutant:
 *
 * ```text
 *   whole suite                                      26.56s
 *   the two sweeps, narrowed to AR                     0.60s
 *   the 9 other files that mention AR or no state      1.74s
 *                                                     -----
 *   phase 1                                            2.34s   -> 11x
 * ```
 *
 * ## Both halves are DERIVED, because a list would go stale
 *
 * Which test files can be narrowed is read out of their source — a file is
 * narrowable if it builds a test name from a `${state}` — so splitting a third
 * sweep tomorrow needs no edit here. Which state a mutant belongs to is read out
 * of the top-level declaration its OFFSET sits in. Which states a test file
 * mentions is read out of its text.
 *
 * All of that is pure, so it lives in `select.mjs` where a test can reach it —
 * `mutate.mjs` runs an audit on import, which is the same reason `enumerate.mjs`
 * is its own file. `select.test.mjs` covers it, and the property those tests
 * defend is that the selection stays USEFUL: a selection that quietly stops
 * attributing mutants leaves the score exact and the run fifteen hours long.
 *
 * `--no-select` turns all of it off and restores the Day 64 behaviour.
 */
const SELECT = !argv.includes('--no-select');

/**
 * WHICH STATE A MUTANT BELONGS TO, and the reason it is an OFFSET question rather
 * than a FILE one.
 *
 * Four modules in this package hold more than one state — `flat-states.js` holds
 * eight and 162 mutants, `utah-pennsylvania.js` two, `federal-taxable-base.js`
 * two — and asking the FILE which state it is gets no answer for any of them.
 * That left 230 mutants, about a quarter of an hour of the run, with no selection
 * at all.
 *
 * A mutant has an offset, and the offset sits inside exactly one top-level
 * declaration: `function georgia(year)`, or `const GA_NOTES`. So the attribution
 * is done per declaration — see `attributionOf` in `select.mjs`, which also
 * records why the nearest PRECEDING `code:` literal is the wrong answer — and a
 * mutant that cannot be attributed takes the whole suite, as before.
 *
 * **It is not required to be right, which is the point of the re-run.** A mutant
 * attributed to the wrong state runs the wrong state's tests, passes them, and is
 * then re-run against the whole suite like any other selection miss — slower by
 * one suite and never wrong.
 */
const stateFiles = files
  .map((abs) => [relative(esm, abs), abs])
  .filter(([rel]) => /^states\/[a-z0-9-]+\.js$/.test(rel));
const ALL_CODES = codesIn(stateFiles.map(([, abs]) => readFileSync(abs, 'utf8')));
const attribution = attributionOf(
  stateFiles.map(([rel, abs]) => [rel, readFileSync(abs, 'utf8')]),
  ALL_CODES,
);
const codeAt = (rel, offset) => codeAtIn(attribution, rel, offset);

const testSource = new Map(TEST_FILES.map((f) => [f, readFileSync(join(pkgDir, 'test', f), 'utf8')]));
const NARROWABLE = narrowableIn(testSource);
const mentions = mentionsIn(testSource, ALL_CODES);
const GENERIC = TEST_FILES.filter((f) => mentions.get(f).size === 0);

/** The ordered steps to run for one mutant, or `null` for "the whole suite". */
function planFor(rel, offset) {
  if (!SELECT) return null;
  return planSteps({ code: codeAt(rel, offset), testFiles: TEST_FILES, narrowable: NARROWABLE, mentions });
}

const root = join(os.tmpdir(), `mut-${process.pid}`);
rmSync(root, { recursive: true, force: true });
mkdirSync(root, { recursive: true });
const workerDirs = [];
for (let i = 0; i < WORKERS; i++) {
  const d = join(root, `w${i}`);
  mkdirSync(d, { recursive: true });
  cpSync(join(pkgDir, 'dist'), join(d, 'dist'), { recursive: true });
  cpSync(join(pkgDir, 'test'), join(d, 'test'), { recursive: true });
  // `src` too, since Day 38. Two tests parse the TypeScript interface out of the
  // source and compare it to the field list the built package exports — a check
  // on the compiler's own exhaustiveness proof, independent of the compiler. No
  // mutant can kill them (the harness doubles numbers and a field name is not a
  // number), so they cost the score nothing; what they cost without this line is
  // a red baseline, which costs the whole run.
  cpSync(join(pkgDir, 'src'), join(d, 'src'), { recursive: true });
  cpSync(join(pkgDir, 'package.json'), join(d, 'package.json'));
  if (statSync(join(pkgDir, 'README.md'), { throwIfNoEntry: false })) cpSync(join(pkgDir, 'README.md'), join(d, 'README.md'));
  workerDirs.push(d);
}
const base = await runSuite(workerDirs[0]);
if (!base.green) {
  console.error('[mutate] BASELINE IS RED. Refusing to run — every mutant would read as killed.');
  writeFileSync('/tmp/mutate-baseline.log', base.out);
  console.error(base.out.split('\n').filter((l) => /^not ok/.test(l)).join('\n') || base.out.slice(-3000));
  console.error('[mutate] full baseline output in /tmp/mutate-baseline.log');
  process.exit(1);
}
console.error('[mutate] baseline green');

/**
 * THE SELECTION MUST NOT BE EMPTY, and an announcement would not be enough.
 *
 * `--test-name-pattern` that matches nothing produces a GREEN run of ZERO tests,
 * and this harness reads green as "the mutant survived". A code whose per-state
 * tests had been renamed would therefore send every one of its mutants through a
 * vacuous phase 1 and a full re-run — slower than no selection at all, and
 * silent. So every code in the selected set is probed once, here, and a code that
 * selects no tests stops the run.
 *
 * Day 47's rule, which this file states at length about `--record`: an
 * announcement at start-up is not a guard. A guard is something that will not
 * proceed.
 */
const CODES_IN_RUN = [...new Set(selected.map((mu) => codeAt(mu.rel, mu.offset)).filter(Boolean))].sort();
if (SELECT && CODES_IN_RUN.length > 0) {
  const empty = [];
  for (const code of CODES_IN_RUN) {
    const probe = selected.find((mu) => codeAt(mu.rel, mu.offset) === code);
    const plan = planFor(probe.rel, probe.offset);
    // Only the NARROWED step can match nothing — a step with no pattern runs
    // whole files. Probing just that one keeps this guard to about a second a
    // state instead of the whole of phase 1.
    for (const step of plan.steps.filter((s) => s.pattern !== null)) {
      const r = await runFiles(workerDirs[0], step.files, step.pattern);
      if (!r.green) {
        console.error(`[mutate] BASELINE IS RED under the ${code} selection, which the whole suite passed.`);
        console.error(r.out.split('\n').filter((l) => /^not ok/.test(l)).join('\n').slice(0, 3000));
        process.exit(1);
      }
      if (r.passed <= 0) empty.push(`${code}: ${step.pattern ?? 'no pattern'} over ${step.files.length} file(s)`);
    }
  }
  if (empty.length > 0) {
    console.error(
      '[mutate] REFUSED to start: a test selection matched no tests, and a selection that\n' +
        'matches nothing is GREEN, which this harness reads as a surviving mutant.\n\n' +
        empty.map((e) => `  ${e}`).join('\n'),
    );
    process.exit(2);
  }
  console.error(
    `[mutate] selection: ${CODES_IN_RUN.length} state(s), ${NARROWABLE.length} narrowable test file(s), ` +
      `${GENERIC.length} that name no state`,
  );
}
// Said at the START, because a measurement this long must not be able to
// decline to record without saying so. Day 42 lost 105 minutes to exactly that.
console.error(
  RECORD_OUT
    ? `[mutate] will record the score in ${RECORD_OUT} when the run completes`
    : '[mutate] NOT recording (pass --record to write tools/mutation/scores.json)',
);

// ---- run ----
const originals = new Map();
for (const f of files) originals.set(relative(esm, f), readFileSync(f, 'utf8'));

/**
 * RESUME, BECAUSE A CONTAINER RESTART IS NOT AN EXCEPTIONAL EVENT.
 *
 * Day 65 lost a run at nine minutes to the sandbox restarting underneath it, and
 * that is the second time an audit has been thrown away whole: Day 42 lost 105
 * minutes to a run that recorded nothing and Day 43 two hours to the wrong flags.
 * Those two were fixed with guards on the flags. This one cannot be, because
 * nothing was wrong with the invocation.
 *
 * **THE RULE: a measurement long enough to be interrupted needs to survive being
 * interrupted, and a run that can only be restarted from zero will be restarted
 * from zero.** So every verdict is appended to `<json>.partial` as it is reached,
 * and `--resume` picks up from there.
 *
 * ## It carries the fingerprints, and refuses to mix trees
 *
 * A resumed run is a single score assembled from two processes, so the honest
 * version of it has to prove both halves measured the SAME package. The partial
 * opens with a stamp line holding `mutantFingerprint` and `suiteFingerprint`, and
 * `--resume` refuses when either has moved — which is `check-scores.mjs`'s own
 * rule one level down: a measurement is a measurement OF something, and half a
 * measurement is no exception.
 *
 * Without `--resume` the partial is TRUNCATED rather than appended to, because a
 * stale partial silently extended is a score over two trees with nothing to say
 * so.
 */
const PARTIAL = JSON_OUT === null ? null : `${JSON_OUT}.partial`;
const RESUME = argv.includes('--resume');
if (RESUME && PARTIAL === null) {
  console.error('[mutate] --resume needs --json <file>, which is where the partial verdicts live.');
  process.exit(2);
}
const { mutantFingerprint: mutantFp, suiteFingerprint: suiteFp } = await import('./fingerprint.mjs');
const STAMP = { kind: 'stamp', mutant: mutantFp(pkgDir), suite: suiteFp(pkgDir) };
const keyOf = (r) => `${r.rel}|${r.offset}|${r.from}>${r.to}`;

const results = [];
let resumed = 0;
if (PARTIAL !== null) {
  if (RESUME && existsSync(PARTIAL)) {
    const lines = readFileSync(PARTIAL, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          // A line half-written when the process died. There is exactly one, it
          // is the last, and dropping it costs one mutant.
          return null;
        }
      })
      .filter(Boolean);
    const stamp = lines[0];
    if (stamp?.kind !== 'stamp') {
      console.error(`[mutate] REFUSED to resume: ${PARTIAL} has no fingerprint stamp.`);
      process.exit(2);
    }
    if (stamp.mutant !== STAMP.mutant || stamp.suite !== STAMP.suite) {
      console.error(
        '[mutate] REFUSED to resume: the partial was measured over a different tree.\n' +
          `  parameters  partial ${stamp.mutant}  this build ${STAMP.mutant}\n` +
          `  suite       partial ${stamp.suite}  this build ${STAMP.suite}\n` +
          'A score assembled from two different trees is not a score of either.',
      );
      process.exit(2);
    }
    const done = new Map(lines.slice(1).map((r) => [keyOf(r), r]));
    for (const mu of selected) {
      const prior = done.get(keyOf(mu));
      if (prior !== undefined) results.push(prior);
    }
    resumed = results.length;
    const remaining = selected.filter((mu) => !done.has(keyOf(mu)));
    console.error(`[mutate] resuming: ${resumed} verdict(s) already recorded, ${remaining.length} to go`);
    selected = remaining;
  } else {
    writeFileSync(PARTIAL, `${JSON.stringify(STAMP)}\n`);
  }
}

let done = 0;
let killedBySelection = 0;
let fullReRuns = 0;
async function worker(dir, list) {
  for (const mu of list) {
    const target = join(dir, 'dist/esm', mu.rel);
    const src = originals.get(mu.rel);
    writeFileSync(target, src.slice(0, mu.offset) + mu.to + src.slice(mu.offset + mu.from.length));
    const plan = planFor(mu.rel, mu.offset);
    let killed = false;
    if (plan !== null) {
      for (const step of plan.steps) {
        const r = await runFiles(dir, step.files, step.pattern);
        if (!r.green) {
          killed = true;
          break;
        }
      }
    }
    let survived;
    if (killed) {
      survived = false;
      killedBySelection++;
    } else {
      // Nothing in the selection failed — which is NOT a survivor yet. The whole
      // suite decides, every time, and that is what makes the score identical to
      // a full run however bad the selection is.
      survived = (await runSuite(dir)).green;
      if (plan !== null) fullReRuns++;
    }
    writeFileSync(target, src);
    const verdict = { ...mu, survived };
    results.push(verdict);
    // Appended before the counter moves, so a verdict reached is a verdict kept.
    // `appendFileSync` opens with O_APPEND, so four workers writing short lines
    // interleave by line rather than by byte.
    if (PARTIAL !== null) appendFileSync(PARTIAL, `${JSON.stringify(verdict)}\n`);
    done++;
    // Counted against the WHOLE run and not this process's share of it, so a
    // resumed run's progress line means the same thing as a fresh one's.
    if (done % 50 === 0) console.error(`[mutate] ${resumed + done}/${resumed + selected.length}`);
  }
}
const chunks = Array.from({ length: WORKERS }, () => []);
selected.forEach((mu, i) => chunks[i % WORKERS].push(mu));
await Promise.all(chunks.map((c, i) => worker(workerDirs[i], c)));
rmSync(root, { recursive: true, force: true });

// ---- report ----
const survivors = results.filter((r) => r.survived);
console.log(`\n# Mutation audit — ${pkgDir}`);
console.log(`\nmutants ${results.length}    killed ${results.length - survivors.length}    survived ${survivors.length}    score ${(((results.length - survivors.length) / results.length) * 100).toFixed(1)}%`);
if (SELECT && killedBySelection + fullReRuns > 0) {
  // Printed because it is the only number that says whether the selection is
  // EARNING anything. Every re-run is a mutant the selection failed to kill and
  // the whole suite then had to judge, so a re-run count near the mutant count
  // means the selection is costing time rather than saving it — and the score is
  // still right, which is exactly why this has to be reported rather than felt.
  console.log(
    `\nselection: ${killedBySelection} killed by a narrowed run, ` +
      `${fullReRuns} re-run against the whole suite because the narrowed run was green` +
      // Said explicitly on a resumed run, because these two count what THIS
      // process did and the mutant total above counts the whole score. A reader
      // comparing them would otherwise read the difference as mutants that
      // skipped the selection.
      (resumed > 0 ? `, over the ${done} mutant(s) this process ran (${resumed} resumed)` : ''),
  );
}
const byFile = {};
for (const s of survivors) (byFile[s.rel] ||= []).push(s);
console.log('\n## Survivors by file\n');
for (const [f, list] of Object.entries(byFile).sort((a, b) => b[1].length - a[1].length)) {
  const total = results.filter((r) => r.rel === f).length;
  console.log(`### ${f} — ${list.length} of ${total} survived\n`);
  for (const s of list.sort((a, b) => a.line - b.line)) {
    console.log(`  line ${String(s.line).padStart(4)}  ${s.kind.padEnd(5)}  ${s.from} -> ${s.to}`);
  }
  console.log();
}
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ pkgDir, results }, null, 1));

// ---- the record, so the score stops being hand-maintained ----
//
// Day 37: `README.md` advertised the federal package at 698 mutants for a day
// after the committed, measured figure became 711. The mutation scores were the
// only advertised measurements left in this repository that a human had to copy
// by hand — the same hole Day 36 closed for the test counts, sitting right
// beside it. So the runner writes them, as `tools/test-counts.mjs` does.
//
// And it writes the FINGERPRINT of what it mutated, which the test counts do not
// need and a score does: Day 35 said a score may not be inferred and Day 36 said
// it may not be inherited, and both left it to a future run to remember. A
// fingerprint makes "the audit was re-run after that edit" checkable instead of
// asserted. See `fingerprint.mjs`.
if (RECORD_OUT && Number.isFinite(LIMIT)) {
  // `--limit` exists for checking the harness, not the package — its own flag
  // table says so — and a record saying "3 mutants, 100%" is worse than no
  // record, because it reads exactly like a real one. Refused rather than
  // annotated: the whole value of the file is that every row in it is a score
  // of a whole package.
  console.error(
    `\n[mutate] REFUSED to record: --limit ${LIMIT} measures the harness and not the package, ` +
      'and a partial count in the record would read exactly like a full one.',
  );
  process.exit(1);
}
if (RECORD_OUT) {
  const { mutantFingerprint, suiteFingerprint } = await import('./fingerprint.mjs');
  const name = pkgDir.replace(/^.*packages\//, '');
  const existing = existsSync(RECORD_OUT) ? JSON.parse(readFileSync(RECORD_OUT, 'utf8')) : { packages: {} };
  existing.packages[name] = {
    measured: new Date().toISOString().slice(0, 10),
    mutants: results.length,
    killed: results.length - survivors.length,
    survivors: survivors.length,
    score: Number((((results.length - survivors.length) / results.length) * 100).toFixed(1)),
    // The two reasons a score can move, recorded apart because they want
    // different fixes: the parameters changed, or the suite that kills them did.
    mutantFingerprint: mutantFingerprint(pkgDir),
    suiteFingerprint: suiteFingerprint(pkgDir),
    // What the run covered, so a score measured over a subset cannot be read as
    // one measured over the package.
    skipped: SKIP.length === 0 ? undefined : SKIP,
    only: ONLY === null ? undefined : String(ONLY),
  };
  writeFileSync(RECORD_OUT, `${JSON.stringify(existing, null, 2)}\n`);
  console.log(`\n[mutate] recorded ${name} in ${RECORD_OUT}`);
}

if (MAX_SURVIVORS !== null && survivors.length > Number(MAX_SURVIVORS)) {
  console.error(
    `\n[mutate] FAILED: ${survivors.length} survivors, and at most ${MAX_SURVIVORS} are allowed.\n` +
      `Each one is a parameter this package could ship with a wrong value for. Either write a\n` +
      `test that pins it, or raise the limit with a reason in the workflow that sets it.`,
  );
  process.exit(1);
}
