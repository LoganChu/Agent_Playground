#!/usr/bin/env node
/**
 * Everything CI checks except the three-hour mutation audit, in one command.
 *
 * ## Why this exists, and it is a Day 61 finding rather than a convenience
 *
 * Every check in this repository was already runnable on its own, and that is
 * exactly how they were being run: each one at the moment its own piece of work
 * finished. On Day 61 that produced a red CI job from a check that had passed.
 *
 * `tools/readme-root.mjs --check` compares the root README's advertised
 * differential grid — *"2,376 households ... across 27 states"* — against what
 * `tools/differential/cases.mjs` produces. It was run after the README's state
 * counts were corrected and printed **"ok — 19 claims in the root README all
 * match the code"**. An hour later the differential's own `STATES` list was
 * derived from the registry rather than written by hand, which took the grid to
 * 2,464 households across 28 states, and nothing re-ran the check that had just
 * passed.
 *
 * > **A CHECK THAT PASSED IS A STATEMENT ABOUT THE TREE AT THE MOMENT IT RAN.**
 *
 * The repository already had this rule for one tool. `tools/test-counts.mjs`'s
 * own documentation says to run it LAST, not when convenient, and five separate
 * days have recorded the test count being written down one short because it was
 * run before the final test was added. **The rule was never generalised**, and
 * the generalisation is this file: there is no moment at which running one check
 * tells you the tree is consistent, because the only tree that matters is the
 * one you are about to push.
 *
 * ## What it runs, and what it deliberately does not
 *
 * Everything in `.github/workflows/ci.yml` except `mutation-claims` step 7, the
 * score check, which is red by construction between a code change and the audit
 * record that covers it — and which takes three hours to make green. That one is
 * the expected red of a two-push day and has to stay outside a gate that is
 * meant to be run before every push.
 *
 * Each row prints `ok` or the tool's own failure text. The exit code is 1 if any
 * row failed, so it can be a pre-push hook.
 *
 *   node tools/preflight.mjs
 *   node tools/preflight.mjs --quiet     # one line per check, failures in full
 */
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const QUIET = process.argv.includes('--quiet');

/**
 * One check: a label, the command, and how to read its output.
 *
 * `expect` turns the tool's own stdout into a one-line summary, so a passing row
 * says what it proved rather than only that it exited zero. A check whose
 * summary is empty has stopped proving anything, which is the failure mode every
 * loop in this repository is written against.
 */
const CHECKS = [
  ...['us-federal-tax', 'us-state-tax', 'us-tax-mcp'].map((pkg) => ({
    label: `suite ${pkg}`,
    cmd: 'npm test',
    cwd: `packages/${pkg}`,
    expect: (out) => (out.match(/^# pass (\d+)/m) ?? [])[1] && `${(out.match(/^# pass (\d+)/m))[1]} tests`,
  })),
  {
    label: 'suite site',
    cmd: 'npm test',
    cwd: 'site',
    expect: (out) => (out.match(/^# pass (\d+)/m) ?? [])[1] && `${(out.match(/^# pass (\d+)/m))[1]} tests`,
  },
  {
    label: "the enumerator's own tests",
    cmd: 'node tools/mutation/enumerate.test.mjs',
    expect: (out) => (out.match(/^# pass (\d+)/m) ?? [])[1] && `${(out.match(/^# pass (\d+)/m))[1]} tests`,
  },
  {
    label: 'OBBBA and conformity claims in both READMEs',
    cmd: 'node tools/cross-package/obbba-claims.mjs --check',
    expect: (out) => (out.match(/^ok — (.*)$/m) ?? [])[1],
  },
  {
    label: "Arizona's deduction against the federal basic one",
    cmd: 'node tools/cross-package/arizona-deduction.mjs --check',
    expect: (out) => (out.match(/^ok — (.*)$/m) ?? [])[1] ?? 'ok',
  },
  {
    label: "North Dakota's zero band against the federal 12% bracket",
    cmd: 'node tools/cross-package/north-dakota-zero-band.mjs --check',
    expect: (out) => (out.match(/^ok — (.*)$/m) ?? [])[1],
  },
  {
    label: "Oklahoma's earned income credit base, frozen at 2020 and falling further behind",
    cmd: 'node tools/cross-package/oklahoma-frozen-eitc.mjs --check',
    expect: (out) => (out.match(/^ok — (.*)$/m) ?? [])[1],
  },
  {
    label: "Iowa's low-income exemption against the deduction that is withdrawing it",
    cmd: 'node tools/cross-package/iowa-frozen-exemption.mjs --check',
    expect: (out) => (out.match(/^ok — (.*)$/m) ?? [])[1],
  },
  {
    label: 'each lockfile against its own package.json',
    cmd: 'node tools/cross-package/lockfile-versions.mjs --check',
    expect: (out) => (out.match(/^All (\d+) lockfiles agree/m) ?? [])[1] && 'all agree',
  },
  {
    label: 'the root README against the code',
    cmd: 'node tools/readme-root.mjs --check',
    expect: (out) => (out.match(/^ok — (.*)$/m) ?? [])[1],
  },
  {
    // `--check`, AND THE MISSING FLAG WAS A REAL GATE DEFECT. This entry ran
    // `node tools/test-counts.mjs` with no flag for its whole life, which is the
    // MEASURING half of the tool and not the ASSERTING half: it prints the
    // counts and exits zero whatever the READMEs say. CI runs `--check`, which
    // also compares every README's advertised suite size and exits 1 on a
    // mismatch. So on Day 62 this gate reported "1593 tests recorded" — a true
    // statement — while CI failed on `us-state-tax/README.md` advertising 966
    // tests against a suite of 982, and the whole point of this file is to be
    // what CI runs.
    //
    //   A GATE THAT RUNS A DIFFERENT COMMAND FROM CI IS NOT A GATE FOR CI.
    //
    // Day 61 built this file because a check that had passed was invalidated an
    // hour later. The deeper version is that a check which passed may never have
    // been the check at all.
    label: 'the test-count record and every README that advertises a suite size',
    cmd: 'node tools/test-counts.mjs --check',
    expect: (out) => (out.match(/^TOTAL\s+(\d+) tests, (\d+) failing/m) ?? [])[1] &&
      `${out.match(/^TOTAL\s+(\d+) tests/m)[1]} tests recorded, every README agrees`,
  },
  {
    label: 'the differential report is reproducible from the code',
    cmd: 'node tools/differential/compare.mjs > /tmp/preflight-report.md && ' +
      'diff -q /tmp/preflight-report.md tools/differential/REPORT.md',
    expect: () => 'byte for byte',
  },
];

let failed = 0;
for (const check of CHECKS) {
  let out;
  let ok = true;
  try {
    out = execSync(check.cmd, {
      cwd: check.cwd ? resolve(ROOT, check.cwd) : ROOT,
      encoding: 'utf8',
      stdio: 'pipe',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (e) {
    ok = false;
    out = String(e.stdout ?? '') + String(e.stderr ?? '');
  }
  const summary = ok ? check.expect(out) : undefined;
  if (ok && !summary) {
    // Exited zero and said nothing this file recognises. That is not a pass:
    // it is a tool whose output shape changed, and a gate that reads a changed
    // output as a pass is the gate this whole file was written to replace.
    ok = false;
    out = `${out}\n[preflight] exited 0 but printed nothing this check knows how to read.`;
  }
  console.log(`${ok ? 'ok  ' : 'RED '} ${check.label.padEnd(56)} ${ok ? summary : ''}`);
  if (!ok) {
    failed += 1;
    if (!QUIET) {
      const lines = out.split('\n');
      const interesting = lines.filter((l) => /^not ok |^ {2}error|RED|disagree|says/.test(l));
      for (const l of (interesting.length ? interesting : lines).slice(0, 25)) console.log(`       ${l}`);
    }
  }
}

console.log('');
if (failed) {
  console.log(`${failed} check(s) red. Do not push.`);
  process.exit(1);
}
console.log(
  'All green. NOT CHECKED HERE: tools/mutation/check-scores.mjs, which is red by ' +
    'construction between a code change and the audit that covers it.',
);
