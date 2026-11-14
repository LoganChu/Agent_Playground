#!/usr/bin/env node
/**
 * What did CI say about the last thing this repository pushed?
 *
 * ## Why this exists
 *
 * On Day 78 I checked GitHub Actions after a push, out of habit rather than
 * suspicion, and found **CI had been red for three days and six commits**:
 *
 * ```text
 *   CI | failure | a4d5a95bb | 2026-11-11   Day 77
 *   CI | failure | 8bcbfccad | 2026-11-10   Day 76
 *   CI | success | cfbaafd31 | 2026-11-08   Day 75, the last green run
 * ```
 *
 * One job, one line of diff, every time: `CLIFFS.md` carried `sweep wall clock
 * 557s`, the job regenerates that report on the runner and diffs it byte for
 * byte, and a duration is a property of the machine. **The gate and the line
 * that makes it unsatisfiable were added in the same commit**, so it was red on
 * its first run and never once passed.
 *
 * The structural half of that is what this file is for. `preflight.mjs`
 * deliberately does NOT run the cliff sweep — it says so in its own comment,
 * because the sweep is more expensive than everything else in the file put
 * together and "lives in CI alone". So the one gate that exists only on the
 * runner is the one gate nothing here ever executes, and **a gate nobody looks
 * at is not a gate.**
 *
 * This does not re-run anything. It asks GitHub what the last completed CI run
 * on the default branch concluded, which costs one API call and no sweep. A
 * local green and a remote red are two different claims, and for three days
 * this repository reported the first while publishing the second.
 *
 * ## What it does NOT do
 *
 * It does not check the run for the working tree's own commit — that run may
 * not exist yet, or may still be in progress, and a preflight that fails
 * because CI has not finished would be a gate that punishes pushing quickly.
 * It reports the last **completed** run, which is a fact about what is already
 * on `main`.
 *
 * Network and credentials are not guaranteed in every environment this runs in.
 * **An unreachable GitHub is reported as `unknown`, not as a failure**, because
 * a check that goes red when the network is down teaches people to ignore it —
 * which is the failure mode this whole file exists to correct.
 *
 * ## When the working tree is the FIX for the red run
 *
 * Then push, and say so in the commit message. This repository already has that
 * convention for `check-scores.mjs`, which is red by construction between a code
 * change and the audit that covers it; Day 77 pushed with it red and the message
 * said why. The same applies here: a gate that blocks the commit that repairs it
 * is a gate that gets deleted. What it must never be is red and unread, which is
 * what it was for three days before it existed.
 *
 * ## DAY 80 — AND IT WATCHED ONE WORKFLOW OUT OF FOUR
 *
 * This file was written to fix "a gate nobody looks at is not a gate", and it
 * read `runs.find((r) => r.name === 'CI')`. Every other workflow was invisible
 * to it.
 *
 * `Mutation audit` had therefore been **failing since 2026-11-09**, on its only
 * completed run since the survivor count went from six to eight, with the
 * failure spelled out in the job's own NAME — *"us-state-tax (must stay at six
 * triaged survivors)"* — against a `STATE-SURVIVORS.md` that has recorded "the
 * same eight" for six consecutive audits. Five days, five journal entries, and
 * three of them wrote down "8 survivors, 99.7%" as a good result while the gate
 * asserting six was red on a trigger nothing here read.
 *
 * It is a weekly SCHEDULE rather than a push, which is the whole reason: a gate
 * on a different trigger is a gate on a different planet. So this now takes the
 * last completed run of EVERY workflow on the default branch and fails if any of
 * them concluded anything but success. One API call, as before.
 *
 *     node tools/last-ci-run.mjs            # print every workflow's last run
 *     node tools/last-ci-run.mjs --check    # exit 1 if any concluded failure
 */
import { execFileSync } from 'node:child_process';

const CHECK = process.argv.includes('--check');
const REPO = 'LoganChu/Agent_Playground';
const BRANCH = 'main';

/**
 * The most recent COMPLETED run of each workflow on the default branch.
 *
 * One call to list the workflows, then one per workflow for its latest
 * completed run. The first version asked for the last 100 runs in a single call
 * and died with `spawnSync gh ENOBUFS`, because a hundred run objects is
 * megabytes of JSON. Per workflow is also correct by construction rather than
 * by window: a WEEKLY workflow can fall outside the last hundred pushes, and
 * the weekly one is exactly the gate this change exists to stop missing.
 *
 * `--jq` projects to compact JSON server-side, so every response is a few
 * hundred bytes. It projects to JSON rather than to a formatted line because
 * the first attempt used jq's `\(...)` interpolation inside a JavaScript string
 * literal, where `\(` is not an escape and the backslash is silently dropped —
 * so jq received `(.id)` and the request asked for a workflow named `(.id)`.
 */
function gh(path, jq) {
  const out = execFileSync('gh', ['api', path, '--jq', jq], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
  }).trim();
  // `gh --jq` prints NOTHING when the filter yields null, which is what a
  // workflow with no completed run on this branch produces. `JSON.parse('')`
  // throws, and because this file reports every throw here as "GitHub was not
  // reachable", the first version of this turned one workflow that had never
  // run into a silent all-clear for all five. Empty is a value, not an error.
  if (!out || out === 'null') return null;
  return JSON.parse(out);
}

function lastCompletedRuns() {
  let workflows;
  try {
    workflows =
      gh(
        `repos/${REPO}/actions/workflows?per_page=100`,
        '[.workflows[] | select(.state == "active") | {id: .id, name: .name}]',
      ) ?? [];
  } catch (e) {
    return { unknown: `GitHub was not reachable: ${String(e?.message ?? e).split('\n')[0]}` };
  }
  if (!workflows.length) return { unknown: 'the repository reports no active workflows' };

  const runs = [];
  for (const wf of workflows) {
    let run;
    try {
      run = gh(
        `repos/${REPO}/actions/workflows/${wf.id}/runs` +
          `?per_page=1&status=completed&branch=${BRANCH}`,
        // Projected to four fields: a whole run object carries the commit
        // message and the actor, and five of those is what overflowed the
        // buffer in the first version.
        '.workflow_runs[0] | if . == null then null else ' +
          '{conclusion: .conclusion, head_sha: .head_sha, ' +
          'created_at: .created_at, html_url: .html_url} end',
      );
    } catch (e) {
      return { unknown: `GitHub was not reachable: ${String(e?.message ?? e).split('\n')[0]}` };
    }
    // A workflow that has never completed a run on this branch is NOT a
    // failure; it is a workflow with nothing to say.
    if (!run) continue;
    runs.push({
      workflow: wf.name,
      conclusion: run.conclusion,
      sha: String(run.head_sha ?? '').slice(0, 9),
      when: run.created_at,
      url: run.html_url,
    });
  }
  if (!runs.length) return { unknown: `no workflow has a completed run on ${BRANCH}` };
  return { runs };
}

const r = lastCompletedRuns();

if (r.unknown) {
  // Deliberately exit 0. See the header.
  console.log(`unknown — ${r.unknown}. This check does not fail on an unreachable GitHub.`);
  process.exit(0);
}

const bad = r.runs.filter((run) => run.conclusion !== 'success');

if (bad.length) {
  const plural = bad.length === 1 ? 'WORKFLOW' : 'WORKFLOWS';
  console.error(
    `THE LAST COMPLETED RUN OF ${bad.length} ${plural} ON ${BRANCH} DID NOT SUCCEED.\n`,
  );
  for (const run of bad) {
    console.error(
      `  ${run.workflow}\n` +
        `    conclusion  ${run.conclusion}\n` +
        `    commit      ${run.sha}\n` +
        `    when        ${run.when}\n` +
        `    logs        ${run.url}\n`,
    );
  }
  console.error(
    `A green preflight here and a red run there are two different claims. Read the job\n` +
      `log before pushing more on top of it: on Day 78 CI had been red for three days and\n` +
      `six commits on a one-line diff nobody had looked at, and on Day 80 the weekly\n` +
      `Mutation audit had been red for five days because this check read only "CI".`,
  );
  if (CHECK) process.exit(1);
  process.exit(0);
}

console.log(
  `ok — the last completed run of all ${r.runs.length} workflow(s) on ${BRANCH} succeeded:`,
);
for (const run of r.runs) {
  console.log(`     ${run.workflow} (${run.sha}, ${run.when})`);
}
