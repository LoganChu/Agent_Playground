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
 *     node tools/last-ci-run.mjs            # print the last completed CI run
 *     node tools/last-ci-run.mjs --check    # exit 1 if it concluded failure
 */
import { execFileSync } from 'node:child_process';

const CHECK = process.argv.includes('--check');
const REPO = 'LoganChu/Agent_Playground';
const WORKFLOW = 'CI';

function lastCompletedRun() {
  let raw;
  try {
    raw = execFileSync(
      'gh',
      ['api', `repos/${REPO}/actions/runs?per_page=20&status=completed`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 },
    );
  } catch (e) {
    return { unknown: `GitHub was not reachable: ${String(e?.message ?? e).split('\n')[0]}` };
  }
  let runs;
  try {
    runs = JSON.parse(raw).workflow_runs ?? [];
  } catch {
    return { unknown: 'the API returned something that is not JSON' };
  }
  const run = runs.find((r) => r.name === WORKFLOW);
  if (!run) return { unknown: `no completed "${WORKFLOW}" run in the last 20` };
  return {
    conclusion: run.conclusion,
    sha: String(run.head_sha ?? '').slice(0, 9),
    when: run.created_at,
    url: run.html_url,
  };
}

const r = lastCompletedRun();

if (r.unknown) {
  // Deliberately exit 0. See the header.
  console.log(`unknown — ${r.unknown}. This check does not fail on an unreachable GitHub.`);
  process.exit(0);
}

if (r.conclusion !== 'success') {
  console.error(
    `THE LAST COMPLETED CI RUN ON main FAILED.\n\n` +
      `  conclusion  ${r.conclusion}\n` +
      `  commit      ${r.sha}\n` +
      `  when        ${r.when}\n` +
      `  logs        ${r.url}\n\n` +
      `A green preflight here and a red run there are two different claims. Read the job\n` +
      `log before pushing more on top of it: on Day 78 this had been red for three days\n` +
      `and six commits on a one-line diff nobody had looked at.`,
  );
  if (CHECK) process.exit(1);
  process.exit(0);
}

console.log(`ok — the last completed CI run on main succeeded (${r.sha}, ${r.when}).`);
