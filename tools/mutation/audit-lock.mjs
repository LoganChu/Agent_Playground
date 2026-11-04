/**
 * A lock the deliberate-error audit holds while it runs, and that `npm run
 * build` refuses to run under.
 *
 * ## Why this exists, and it is the fifth demonstration rather than the fifth restatement
 *
 * The audit snapshots each worker's copy of the package **once at start-up** and
 * then runs for forty-six minutes. So rebuilding `dist` under a running audit
 * does not corrupt the run — the workers never read the tree again — it
 * corrupts the RESULT, because `scores.json` fingerprints the bytes of the files
 * the score was computed over. The run finishes, the fingerprint no longer
 * matches the tree, and the score is a measurement of a package that no longer
 * exists.
 *
 * It has happened four times:
 *
 * ```text
 *   Day 43   three rebuilds in one run, the third AFTER writing the note about
 *            the first -- the commit is titled for it
 *   Day 66   worklist item 16: "give the harness a lock"
 *   Day 69   restated
 *   Day 70   restated
 *   Day 71   ten minutes of CPU, killed and restarted
 * ```
 *
 * **THE PART THAT MATTERS IS WHY REMEMBERING DOES NOT WORK.** Day 71 wrote it
 * down plainly: it was not a slip of the hand. A forty-six minute measurement
 * is started and then the run goes on working, *because that is the correct use
 * of forty-six minutes*. The schedule is the defect, not the discipline, and a
 * guard that costs ten seconds of confusion replaces an hour of remembering.
 *
 * ## What it refuses, and the two cases are not the same
 *
 * 1. **A second audit in the same container.** Two audits on four cores is the
 *    Day 70 measurement — two long measurements do not share a machine well —
 *    and worse, both would write `scores.json`.
 * 2. **A build of the package under audit.** This is the one that has actually
 *    happened, four times, and it is the one a human would never think to guard.
 *
 * ## Why a pid and not just a file
 *
 * A lockfile with no liveness check is a worse failure than no lockfile: a run
 * killed with `SIGKILL`, or a container reaped mid-audit, leaves a file that
 * refuses every build forever, and the first thing anybody does to a lock that
 * will not clear is delete it without reading it. So the lock holds the pid and
 * `held()` checks it: a lock whose process is gone is **stale and ignored**,
 * and says so rather than being silently reused.
 *
 * `process.kill(pid, 0)` is the check. It throws `ESRCH` for a pid that does not
 * exist and `EPERM` for one owned by another user — and `EPERM` means the
 * process IS alive, so it counts as held. Getting that backwards would make the
 * guard fail open, which is the one direction a guard must not fail.
 */
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** The lock lives beside the harness, and `.gitignore` keeps it out of commits. */
export const LOCK_PATH = join(import.meta.dirname, '.audit-lock.json');

/** Whether a pid is a live process. `EPERM` means alive and owned by somebody else. */
function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

/**
 * The lock, if one is held by a live process — otherwise `null`.
 *
 * A malformed or unreadable lock is treated as absent on purpose. The guard's
 * job is to stop a known-bad overlap, and refusing every build in the
 * repository because a JSON file got truncated would be a worse outcome than
 * the overlap it is preventing.
 */
export function held() {
  let raw;
  try {
    raw = readFileSync(LOCK_PATH, 'utf8');
  } catch {
    return null;
  }
  let lock;
  try {
    lock = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!alive(lock.pid)) return { ...lock, stale: true };
  return { ...lock, stale: false };
}

/**
 * Take the lock for `pkgDir`, or throw if a live audit already holds one.
 *
 * Returns a `release` function. The caller also wires it to `exit`, because a
 * lock released only on the happy path is a lock that outlives every crash.
 */
export function acquire(pkgDir) {
  const existing = held();
  if (existing && !existing.stale) {
    const minutes = Math.round((Date.now() - Date.parse(existing.started)) / 60_000);
    throw new Error(
      `another deliberate-error audit is already running in this container.\n` +
        `  pid ${existing.pid}, package ${existing.package}, started ${existing.started} ` +
        `(${minutes} minute(s) ago)\n` +
        `Two audits on the same cores take longer than two audits and both write\n` +
        `scores.json. Wait for it, or kill pid ${existing.pid} if it is not wanted.\n` +
        `If that pid is gone, this lock is stale and the next run will take it.`,
    );
  }
  if (existing?.stale) {
    console.error(
      `[audit-lock] ignoring a stale lock from pid ${existing.pid} (${existing.package}) — ` +
        `that process is gone`,
    );
  }
  writeFileSync(
    LOCK_PATH,
    JSON.stringify(
      { pid: process.pid, package: pkgDir, started: new Date().toISOString() },
      null,
      2,
    ) + '\n',
  );
  let released = false;
  return function release() {
    if (released) return;
    released = true;
    // Only remove a lock that is still OURS. A run that overran a stale lock
    // taken by a later run must not delete the later run's.
    const now = held();
    if (now && now.pid === process.pid) rmSync(LOCK_PATH, { force: true });
  };
}

/**
 * The guard a package's `scripts/finalize.mjs` calls: refuse to finish a build
 * of a package a live audit is measuring.
 *
 * `finalize.mjs` runs at the END of `npm run build`, after `tsc` has already
 * written `dist`. So this does not prevent the write — it makes the build FAIL
 * LOUDLY, which is what is needed: the run then knows the audit in flight is
 * measuring a tree that has moved, and can kill it at a cost of ten seconds
 * instead of discovering it forty-six minutes later.
 *
 * It matches on the package DIRECTORY NAME rather than on a path, because the
 * audit is invoked as `mutate.mjs packages/us-state-tax` from the repository
 * root and a build runs with that directory as its cwd.
 */
export function refuseIfAudited(packageName) {
  const lock = held();
  if (!lock || lock.stale) return;
  if (!String(lock.package).split(/[\\/]/).filter(Boolean).includes(packageName)) return;
  const minutes = Math.round((Date.now() - Date.parse(lock.started)) / 60_000);
  throw new Error(
    `REFUSED: a deliberate-error audit of ${packageName} is running (pid ${lock.pid}, started ` +
      `${lock.started}, ${minutes} minute(s) ago).\n` +
      `\n` +
      `The audit snapshotted this package at start-up, so the RUN is unharmed — but\n` +
      `scores.json fingerprints the bytes of the files the score was computed over, and\n` +
      `rebuilding dist moves them. The score it is about to write would be a measurement\n` +
      `of a tree that no longer exists.\n` +
      `\n` +
      `This has happened four times (Day 43 three times in one run, Day 71 once). Choose:\n` +
      `  - wait for the audit, then build; or\n` +
      `  - kill pid ${lock.pid}, build, and restart the audit on the final tree.\n` +
      `The second is almost always right: ten minutes of CPU costs less than an\n` +
      `unusable score.`,
  );
}
