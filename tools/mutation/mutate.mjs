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
 *                                  [--max-survivors N] [--record [FILE]]
 */
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { execFileSync, execSync } from 'node:child_process';
import os from 'node:os';

const argv = process.argv.slice(2);
const pkgDir = argv[0];
if (!pkgDir) {
  console.error('usage: mutate.mjs <packageDir> [--workers N] [--skip a,b] [--only s] [--limit N] [--json f]');
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
 * Mask comments and string/template literals with spaces, keeping every byte
 * offset. Without this the harness mutates STATUTE CITATIONS: the first pilot run
 * reported `credits.js` at 0% killed because `§ 164(f)`, `$1,700` and `$8,812`
 * live in JSDoc, and a number in a comment cannot make a test fail. A mutation
 * score computed over comments is a measure of documentation density.
 */
function maskNonCode(src) {
  const out = src.split('');
  const blank = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' '; };
  let i = 0;
  const n = src.length;
  // Regex literals are the one ambiguity; these files contain none in a position
  // where `/` could start one, and a mis-parse would only over-mask (fewer
  // mutants), never invent one.
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { let j = src.indexOf('\n', i); if (j === -1) j = n; blank(i, j); i = j; continue; }
    if (c === '/' && src[i + 1] === '*') { let j = src.indexOf('*/', i + 2); j = j === -1 ? n : j + 2; blank(i, j); i = j; continue; }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === c) { j++; break; }
        j++;
      }
      blank(i, j); i = j; continue;
    }
    i++;
  }
  return out.join('');
}

function walk(d, out = []) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

/** The three operators, and the kind they name. */
function mutantOf(text) {
  // `Number('12_400')` is NaN.
  const v = Number(text.replace(/_/g, ''));
  if (!Number.isFinite(v)) return null;
  if (text.includes('.')) {
    if (v > 0 && v < 1) return { kind: 'rate', to: String(v / 2) };
    return null; // a decimal >= 1 is usually a multiplier or a printed figure
  }
  // A separator means money, whatever the magnitude: `2_000` is a deduction and
  // `2024` is a tax year. See the operator table above.
  if (v >= 1900 && v <= 2100 && !text.includes('_')) return { kind: 'year', to: String(v - 1) };
  if (v >= 100) return { kind: 'money', to: String(v * 2) };
  return null;
}

// ---- enumerate ----
const esm = join(pkgDir, 'dist/esm');
const files = walk(esm).filter((f) => !SKIP.some((s) => f.includes(s)));
const mutants = [];
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const code = maskNonCode(src);
  const rel = relative(esm, f);
  // Numeric separators are the point: this codebase writes `12_400`, and a
  // pattern that stops at the underscore skips almost every money parameter
  // while still matching the `12` in front of it. `tsc` preserves them.
  const re = /(?<![\w.$])\d[\d_]*(?:\.\d[\d_]*)?(?![\w.])/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    const op = mutantOf(m[0]);
    if (!op) continue;
    // Line number, for a report a human can act on.
    const line = code.slice(0, m.index).split('\n').length;
    mutants.push({ rel, offset: m.index, from: m[0], to: op.to, kind: op.kind, line });
  }
}
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
 * Measured on this suite, Day 43, with the audit itself using all four cores:
 *
 * ```text
 *                        real     user
 * default (per-file)     8.27s   14.49s
 * isolation=none         6.53s    7.35s
 * ```
 *
 * **User time halves**, and user time is what decides throughput when four
 * workers saturate four cores — so the audit's wall clock roughly halves, from
 * about 110 minutes to about 55. Both modes report the same 765 tests and 765
 * passes, and both exit non-zero on a planted mutant, which is the only
 * behaviour the harness depends on.
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
function runSuite(dir) {
  try {
    execFileSync(process.execPath, TESTCMD, { cwd: dir, stdio: 'pipe', timeout: 120_000 });
    return { green: true };
  } catch (e) {
    const out = String(e.stdout || '') + String(e.stderr || '');
    return { green: false, out };
  }
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
const base = runSuite(workerDirs[0]);
if (!base.green) {
  console.error('[mutate] BASELINE IS RED. Refusing to run — every mutant would read as killed.');
  writeFileSync('/tmp/mutate-baseline.log', base.out);
  console.error(base.out.split('\n').filter((l) => /^not ok/.test(l)).join('\n') || base.out.slice(-3000));
  console.error('[mutate] full baseline output in /tmp/mutate-baseline.log');
  process.exit(1);
}
console.error('[mutate] baseline green');
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

const results = [];
let done = 0;
async function worker(dir, list) {
  for (const mu of list) {
    const target = join(dir, 'dist/esm', mu.rel);
    const src = originals.get(mu.rel);
    writeFileSync(target, src.slice(0, mu.offset) + mu.to + src.slice(mu.offset + mu.from.length));
    const r = runSuite(dir);
    writeFileSync(target, src);
    results.push({ ...mu, survived: r.green });
    done++;
    if (done % 50 === 0) console.error(`[mutate] ${done}/${selected.length}`);
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
