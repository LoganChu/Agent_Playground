#!/usr/bin/env node
// WHAT ADDING THE NEXT TAX YEAR COSTS, COUNTED RATHER THAN GUESSED.
//
// Day 83. `us-state-tax` is designed so that a tax year arrives state by state:
// the registry is keyed on `state:year`, each state builder declines a year it
// has no figures for, and `supportedYears(state)` is the per-state answer.
// Forty-two states publish their 2027 figures between December and February, so
// every month from the next one is a year that some states serve and others do
// not.
//
// The first time that was actually built, two packages raised a `RangeError` at
// module load, because eight lists were derived from the cross product of every
// state and every advertised year. That is fixed. What is left is the suite:
// assertions written when "both years" was a complete description of the
// package.
//
// This script measures how many of them there are. It copies the package to a
// temporary directory, adds a probe year to `SUPPORTED_YEARS` and to the nine
// states with no income tax, builds, runs every test file, and prints what
// failed and how much. **The nine are the right states to extend** — a state
// with no income tax has no figure that can arrive later, so they are the only
// nine that can answer for a tax year before anybody publishes anything.
//
// ## WHY IT COPIES THE PACKAGE INSTEAD OF EDITING IT
//
// Because an instrument that edits the tree it measures leaves the tree edited
// when it is interrupted, and this one takes minutes. `node_modules` is
// symlinked rather than copied, so the copy costs about a megabyte.
//
// ## AND WHY IT MEASURES THE COPY TWICE
//
// **Its first version reported three failures that had nothing to do with the
// year.** `near-miss-proof.test.js` and `shared-module.test.js` read files
// outside the package — the mutation harness skips them both for exactly that
// reason — so they fail in any copy, patched or not. A meter that cannot tell
// its own artefacts from the thing it is measuring reports the wrong number
// confidently, which is worse than reporting none.
//
// So it runs the suite in the copy UNPATCHED first and subtracts. The baseline
// is printed, because a baseline that grows is itself news about the copy.
//
// **The subtraction has one limit worth stating**: a file can fail both for an
// artefact and for the year, and this attributes only the difference. Day 83's
// baseline was 7 failures across 4 files — `near-miss-proof` 1,
// `provenance` 3, `readme` 1, `shared-module` 2 — so those four are the files
// where the attributable count is a floor rather than an equality.
//
// Day 83's reading: **79 failures across 15 files** attributable to the probe
// year, out of 86 seen. Run it again to watch that fall; at zero the probe year
// is shippable for the nine.
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PKG = join(ROOT, 'packages/us-state-tax');

const args = process.argv.slice(2);
const yearArg = args.indexOf('--year');
const PROBE = yearArg === -1 ? null : Number(args[yearArg + 1]);
const QUIET = args.includes('--quiet');

function fail(message) {
  process.stderr.write(`[ripple] ${message}\n`);
  process.exit(2);
}

if (!existsSync(join(PKG, 'node_modules'))) {
  fail(
    'packages/us-state-tax has no node_modules. This script builds the package, so run ' +
      '`npm ci` in it first. It refuses rather than falling back to a global tsc, which is ' +
      'the failure mode `test-counts` carries in its own error text.',
  );
}

// The probe year defaults to one past the last year the package serves, read
// from the package rather than written here: a probe year hard-coded in a tool
// becomes a real year, and then the tool measures nothing. That is the defect
// `an unsupported year throws rather than falling back` shipped on Day 82.
const indexSrc = readFileSync(join(PKG, 'src/states/index.ts'), 'utf8');
const yearsLine = /export const SUPPORTED_YEARS: readonly number\[\] = \[([\d, ]+)\];/.exec(indexSrc);
if (!yearsLine) fail('could not find SUPPORTED_YEARS in src/states/index.ts');
const SUPPORTED = yearsLine[1].split(',').map((n) => Number(n.trim()));
const probeYear = PROBE ?? Math.max(...SUPPORTED) + 1;
if (SUPPORTED.includes(probeYear)) {
  fail(`${probeYear} is already in SUPPORTED_YEARS, so there is no ripple left to measure.`);
}

const dir = mkdtempSync(join(tmpdir(), 'next-year-ripple-'));
try {
  for (const entry of ['src', 'test', 'scripts', 'package.json', 'tsconfig.json', 'tsconfig.build.json', 'tsconfig.cjs.json']) {
    cpSync(join(PKG, entry), join(dir, entry), { recursive: true });
  }
  symlinkSync(join(PKG, 'node_modules'), join(dir, 'node_modules'), 'dir');

  const build = (label) => {
    try {
      execFileSync('npm', ['run', 'build'], { cwd: dir, stdio: 'pipe' });
    } catch (e) {
      fail(`the ${label} package does not BUILD, which is a stronger result than any test count:\n${e.stdout}\n${e.stderr}`);
    }
  };

  const files = readdirSync(join(dir, 'test')).filter((f) => f.endsWith('.test.js')).sort();

  const measure = () => {
    const perFile = new Map();
    let total = 0;
    let ran = 0;
    for (const f of files) {
      let out = '';
      try {
        out = execFileSync(process.execPath, ['--test', join('test', f)], { cwd: dir, encoding: 'utf8', stdio: 'pipe' });
      } catch (e) {
        out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
      }
      const failed = Number(/^# fail (\d+)$/m.exec(out)?.[1] ?? 0);
      ran += Number(/^# tests (\d+)$/m.exec(out)?.[1] ?? 0);
      if (failed > 0) perFile.set(f, failed);
      total += failed;
    }
    return { perFile, total, ran };
  };

  // THE BASELINE. The copy is not the package: two test files read paths outside
  // it and fail wherever they are run from. Measured rather than hard-coded,
  // because the set of files that do this is not a constant.
  if (!QUIET) process.stdout.write('[ripple] building the copy unpatched, for a baseline...\n');
  build('unpatched');
  const base = measure();
  if (!QUIET) {
    process.stdout.write(`[ripple] baseline: ${base.total} failure(s) across ${base.perFile.size} file(s) with no probe year at all\n`);
    for (const [f, n] of [...base.perFile].sort()) process.stdout.write(`           ${String(n).padStart(3)}  ${f}\n`);
  }

  const patch = (rel, from, to) => {
    const file = join(dir, rel);
    const before = readFileSync(file, 'utf8');
    if (before.split(from).length - 1 !== 1) {
      fail(`expected exactly one \`${from}\` in ${rel}; the package's shape changed`);
    }
    writeFileSync(file, before.replace(from, to));
  };
  patch(
    'src/states/index.ts',
    `export const SUPPORTED_YEARS: readonly number[] = [${SUPPORTED.join(', ')}];`,
    `export const SUPPORTED_YEARS: readonly number[] = [${[...SUPPORTED, probeYear].join(', ')}];`,
  );
  patch(
    'src/states/no-income-tax.ts',
    `const YEARS: readonly number[] = [${SUPPORTED.join(', ')}];`,
    `const YEARS: readonly number[] = [${[...SUPPORTED, probeYear].join(', ')}];`,
  );

  if (!QUIET) process.stdout.write(`[ripple] probe year ${probeYear}, served by the nine with no income tax only\n[ripple] rebuilding...\n`);
  build('patched');
  const probe = measure();

  const rows = [];
  let total = 0;
  for (const [f, n] of probe.perFile) {
    const attributable = n - (base.perFile.get(f) ?? 0);
    if (attributable > 0) {
      rows.push([attributable, f]);
      total += attributable;
    }
  }
  rows.sort((a, b) => b[0] - a[0] || a[1].localeCompare(b[1]));

  process.stdout.write(
    `\n[ripple] probe year ${probeYear}: ${total} failure(s) across ${rows.length} file(s), ` +
      `attributable to the year\n         (${probe.total} seen, ${base.total} in the baseline, ` +
      `over ${probe.ran} test(s) in ${files.length} file(s))\n`,
  );
  for (const [n, f] of rows) process.stdout.write(`  ${String(n).padStart(3)}  ${f}\n`);
  if (total === 0) {
    process.stdout.write(
      `\n[ripple] NOTHING LEFT. Tax year ${probeYear} is shippable for the nine states with no\n` +
        `         income tax: add it to SUPPORTED_YEARS and to no-income-tax.ts's YEARS.\n`,
    );
  }
  // Exit 0 either way: this is a meter, not a gate. A non-zero status would make
  // it unusable in the one place it belongs, which is beside a progress number.
} finally {
  rmSync(dir, { recursive: true, force: true });
}
