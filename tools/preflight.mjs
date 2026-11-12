#!/usr/bin/env node
/**
 * Everything CI checks except the mutation audit, in one command.
 *
 * This line said "the three-hour mutation audit" from Day 61 to Day 70. It was
 * three hours when it was written, ten by Day 69, and about forty minutes after
 * Day 70 fixed the selection — and the figure in this sentence never moved,
 * because a duration in prose is a duration nothing re-measures. The audit now
 * records its own cost in `tools/mutation/scores.json` beside the score, so the
 * number lives where it is re-derived; this header no longer carries one.
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
 * record that covers it — and whose cost is recorded in `scores.json`. That one is
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
    // The GLOB and not `enumerate.test.mjs`, since Day 65. CI's `mutation-claims`
    // job has always run `node --test tools/mutation/*.test.mjs`, so naming one
    // file here made the push gate weaker than CI — and `select.test.mjs`, which
    // is the only thing that can see the selection losing its reach, would have
    // been run by CI and not by the gate that decides whether to push.
    label: "the mutation harness's own tests",
    cmd: 'node --test tools/mutation/*.test.mjs',
    expect: (out) => (out.match(/^# pass (\d+)/m) ?? [])[1] && `${(out.match(/^# pass (\d+)/m))[1]} tests`,
  },
  {
    // The CROSS-PACKAGE tests, by glob, for Day 65's reason applied a second
    // time: `tracked-paths.test.mjs` arrived on Day 68 and a gate that names
    // files one at a time is a gate that silently stops covering the newest one.
    label: "the cross-package tools' own tests",
    cmd: 'node --test tools/cross-package/*.test.mjs',
    expect: (out) => (out.match(/^# pass (\d+)/m) ?? [])[1] && `${(out.match(/^# pass (\d+)/m))[1]} tests`,
  },
  {
    // FIRST IN THE LIST IN SPIRIT, because it is the only check here that can
    // see what is about to be pushed rather than what the code computes. Day 67
    // pushed 838 MB of an AGPL virtualenv past a green preflight: every tax
    // check passed, because nothing in this file had ever looked at the index.
    label: 'what this repository is allowed to track',
    cmd: 'node tools/cross-package/tracked-paths.mjs --check',
    expect: (out) => (out.match(/^ok — (.*)$/m) ?? [])[1],
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
    label: "Indiana's frozen base, priced, and zero from 2026",
    cmd: 'node tools/cross-package/indiana-frozen-eitc.mjs --check',
    expect: (out) => (out.match(/^ok — (.*)$/m) ?? [])[1],
  },
  {
    label: "policyengine-us's Indiana credit: gate frozen, amount current",
    cmd: 'node tools/differential/in-eitc-conformity.mjs --check',
    expect: (out) => (out.match(/^ok — (.*)$/m) ?? [])[1],
  },
  {
    // The join Day 77's item 3 asked for, on the one note in this repository
    // that is generated rather than written: the figure in its prose is
    // re-derived from two returns a cent apart. It caught six defects on its
    // first run — four in the note's own arithmetic, two in this check's.
    label: '§ 32(i): the investment-income cliff in both packages, and the note that prices it',
    cmd: 'node tools/cross-package/eitc-investment-income-cliff.mjs --check',
    expect: (out) => (out.match(/^ok — (.*)$/m) ?? [])[1],
  },
  {
    label: 'what the mutation score does NOT cover, declared field by field',
    cmd: 'node tools/mutation/blind-spots.mjs --check',
    expect: (out) => (out.match(/^ok — (.*)$/m) ?? [])[1],
  },
  {
    label: "Iowa's low-income exemption against the deduction that is withdrawing it",
    cmd: 'node tools/cross-package/iowa-frozen-exemption.mjs --check',
    expect: (out) => (out.match(/^ok — (.*)$/m) ?? [])[1],
  },
  {
    label: "Arkansas's 13.70% band, its thirty cliffs and the flat $287.30 above it",
    cmd: 'node tools/cross-package/arkansas-bracket-adjustment.mjs --check',
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
    // Day 73. The three fields a stranger sees before deciding whether to click,
    // against what the registry was measured to serve. Nothing in this file
    // covered the published surface at all: every gate above checks whether a
    // figure a CALLER receives is right, and this is the first that checks
    // whether a sentence a STRANGER receives exists.
    label: 'the registry surface the packages publish',
    cmd: 'node tools/registry/surface.mjs',
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
  {
    // The anchor harness, the same way: `read.py` needs the network and is
    // manual, so `out/anchors.json` is committed and the two node steps are
    // regenerated and diffed. `ours.json` is regenerated FIRST, because the
    // report is a function of it and diffing a stale report against a stale
    // report is the failure mode this whole check exists to prevent.
    label: 'the preparer-anchor report is reproducible from the code',
    cmd: 'node tools/anchors/ours.mjs > tools/anchors/out/ours.json && ' +
      'node tools/anchors/compare.mjs > /tmp/preflight-anchors.md && ' +
      'diff -q /tmp/preflight-anchors.md tools/anchors/REPORT.md',
    expect: () => 'byte for byte',
  },
  {
    label: 'the anchor harness still compares what it says it compares',
    cmd: 'node --test tools/anchors/*.test.mjs',
    expect: (out) => `${out.match(/^# pass (\d+)/m)[1]} assertions about the anchors`,
  },
  {
    // Day 74. The buyer-facing audit, the same golden-file shape as the two
    // above and for a different reason: there is no manual step here, the demo
    // input is committed and the whole thing is pure node, so the committed
    // report is reproducible on every machine. It is diffed rather than merely
    // regenerated because the report is the product listing for a priced
    // service, and a figure in it that no longer matches the engine is wrong in
    // the one place a buyer looks.
    label: "the buyer's audit report is reproducible from the code",
    cmd: 'node tools/audit/audit.mjs --demo > /tmp/preflight-audit.md && ' +
      'diff -q /tmp/preflight-audit.md tools/audit/out/REPORT.md',
    expect: () => 'byte for byte',
  },
  {
    label: 'the audit harness finds exactly the classes it claims to find',
    cmd: 'node --test tools/audit/*.test.mjs',
    expect: (out) => `${out.match(/^# pass (\d+)/m)[1]} assertions about the audit`,
  },
  {
    // Day 76. The cliff finder's self-check, and NOT the full sweep: the sweep
    // is 2,347,800 evaluations over five axes and about eight minutes, which is
    // more than everything above it put together, so it lives in CI alone. What
    // runs here is the part that can be wrong without anybody noticing — the
    // locator, on synthetic functions whose jumps were put at chosen cents by
    // hand, four notches this package documented in prose before the tool
    // existed, and (Day 78) the § 32(i) notch that exists to prove an axis
    // other than wages reaches something the wage axis cannot.
    //
    // Three of the synthetic cases failed on the first run and found a real
    // defect in the binary search: both subdivision steps were computed from
    // the ORIGINAL window, so the second round walked a tenth of a window the
    // first round had already shrunk. Nothing in the sweep's output would have
    // shown it, because a locator that misses a notch reports nothing.
    label: 'the cliff finder locates notches whose answers are known in advance',
    cmd: 'node tools/cliffs/self-check.mjs',
    expect: (out) => out.match(/self-check: (.*)$/m)[1],
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
