// The audit lock, tested without ever touching the real lockfile.
//
// ## Why that caveat is the first line of this file
//
// The obvious test calls `acquire()` and checks that a second `acquire()`
// throws. On a machine with an audit in flight that test **overwrites the
// running audit's lock with this process's pid**, and when this process exits
// the lock names a dead pid — so the build guard, whose entire job is to refuse
// a rebuild during that window, silently starts passing.
//
// **A TEST THAT HAS TO DISABLE THE THING IT TESTS IS NOT A TEST OF IT.** That
// was noticed while writing this file, with a real audit holding the real lock,
// and it is why every entry point in `audit-lock.mjs` takes the path.
//
// ## What is worth testing here, and what is not
//
// The arithmetic is trivial; the FAILURE DIRECTIONS are not. A lock is a guard,
// and a guard has two ways to be wrong that are not equally bad:
//
//   fails OPEN   it lets a build through during an audit -- the thing it exists
//                to stop, and the expensive one
//   fails CLOSED it refuses every build forever because a lockfile got
//                truncated or a container was reaped -- and the first thing
//                anybody does to a lock that will not clear is delete it
//                without reading it, which removes the guard permanently
//
// So the cases below are mostly about staleness and malformation, which are the
// fail-closed risks, plus the one fail-open risk that matters: `EPERM` from
// `process.kill(pid, 0)` means the process IS alive and must count as held.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LOCK_PATH, acquire, held, refuseIfAudited } from './audit-lock.mjs';

const scratch = () => join(mkdtempSync(join(tmpdir(), 'audit-lock-')), 'lock.json');

const write = (path, lock) => writeFileSync(path, JSON.stringify(lock) + '\n');

test('the real lock path is beside the harness, and nothing here writes it', () => {
  // Pinned so that a refactor moving the file cannot silently separate this
  // module from the `finalize.mjs` guards, which find the lock by a hard-coded
  // relative path of their own and cannot import this one.
  assert.match(LOCK_PATH, /tools[\\/]mutation[\\/]\.audit-lock\.json$/);
});

test('no lock, or a lock for a dead pid, is not held', () => {
  const path = scratch();
  assert.equal(held(path), null, 'a path with no file');
  // 999999 is above the default pid_max on Linux and is reliably absent here;
  // the assertion is that the lock is reported STALE rather than absent, because
  // a caller that cannot tell those apart cannot say why it is proceeding.
  write(path, { pid: 999_999, package: 'packages/us-state-tax', started: new Date().toISOString() });
  const stale = held(path);
  assert.equal(stale.stale, true);
  assert.equal(stale.pid, 999_999);
});

test('a live pid is held, and pid 1 is the case that must not fail open', () => {
  const path = scratch();
  // `process.pid` is alive by construction.
  write(path, { pid: process.pid, package: 'packages/us-state-tax', started: new Date().toISOString() });
  assert.equal(held(path).stale, false);

  // PID 1 EXISTS AND IS USUALLY NOT OURS. `process.kill(1, 0)` throws `EPERM`
  // for an unprivileged caller and succeeds for root, and BOTH mean alive. An
  // implementation that treated a throw as "gone" would report this lock stale
  // and let a build through during an audit — the fail-open direction.
  write(path, { pid: 1, package: 'packages/us-state-tax', started: new Date().toISOString() });
  assert.equal(held(path).stale, false, 'pid 1 is alive whether or not we may signal it');
});

test('a malformed, truncated or nonsense lock is ignored rather than fatal', () => {
  const path = scratch();
  for (const junk of ['', 'not json', '{', '{"pid":', '[]', 'null', '{"package":"x"}']) {
    writeFileSync(path, junk);
    // `[]` and `null` parse but carry no usable pid; `{"package":"x"}` has none.
    // Every one of them must come back absent or stale, and none may throw.
    const result = held(path);
    assert.ok(result === null || result.stale === true, `junk lock: ${JSON.stringify(junk)}`);
  }
  // A non-integer and a negative pid are the same question asked by a corrupt
  // writer rather than by a truncating one.
  for (const pid of [0, -1, 1.5, 'x', null]) {
    write(path, { pid, package: 'packages/us-state-tax', started: new Date().toISOString() });
    assert.equal(held(path).stale, true, `pid ${String(pid)}`);
  }
});

test('acquire writes this process, refuses a live one, and overruns a stale one', () => {
  const path = scratch();
  const release = acquire('packages/us-state-tax', path);
  const lock = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(lock.pid, process.pid);
  assert.equal(lock.package, 'packages/us-state-tax');
  assert.ok(Number.isFinite(Date.parse(lock.started)), 'started is a timestamp');

  // A second acquire against the same live lock is refused, and the message has
  // to carry the pid — a refusal that does not say what to kill is a dead end.
  assert.throws(
    () => acquire('packages/us-state-tax', path),
    (error) => {
      assert.match(error.message, /already running/);
      assert.match(error.message, new RegExp(`pid ${process.pid}`));
      return true;
    },
  );

  release();
  assert.equal(held(path), null, 'release removes it');
  // Idempotent: a release wired to both `exit` and a signal handler will run twice.
  release();
  assert.equal(held(path), null);

  // A stale lock does not block.
  write(path, { pid: 999_999, package: 'packages/us-federal-tax', started: new Date().toISOString() });
  const second = acquire('packages/us-state-tax', path);
  assert.equal(JSON.parse(readFileSync(path, 'utf8')).pid, process.pid);
  second();
});

test('a release does NOT remove a lock that another process has since taken', () => {
  // The case that makes `release` check the pid rather than just unlinking. A
  // run that overran a stale lock, then finished after a LATER run took the
  // lock, must not delete the later run's — which would leave a live audit
  // unguarded, the fail-open direction again.
  const path = scratch();
  const release = acquire('packages/us-state-tax', path);
  write(path, { pid: 1, package: 'packages/us-federal-tax', started: new Date().toISOString() });
  release();
  const still = held(path);
  assert.ok(still !== null, 'the later lock survives our release');
  assert.equal(still.pid, 1);
  rmSync(path, { force: true });
});

test('refuseIfAudited matches the package by path SEGMENT, not by substring', () => {
  const path = scratch();
  write(path, { pid: process.pid, package: 'packages/us-state-tax', started: new Date().toISOString() });

  assert.throws(() => refuseIfAudited('us-state-tax', path), /REFUSED/);
  assert.doesNotThrow(() => refuseIfAudited('us-federal-tax', path));

  // A SUBSTRING match would fire here and must not: `us-state-tax` contains
  // `state-tax`, and a package legitimately named `state-tax` would be refused
  // for an audit that has nothing to do with it. The guards in both
  // `finalize.mjs` files split on the separator for the same reason, and they
  // are separate copies of this rule — which is why it is asserted twice.
  assert.doesNotThrow(() => refuseIfAudited('state-tax', path));
  assert.doesNotThrow(() => refuseIfAudited('tax', path));

  // And a stale lock refuses nothing at all.
  write(path, { pid: 999_999, package: 'packages/us-state-tax', started: new Date().toISOString() });
  assert.doesNotThrow(() => refuseIfAudited('us-state-tax', path));
  rmSync(path, { force: true });
});

test("the refusal says what it costs and what to do, because it is read while waiting", () => {
  const path = scratch();
  write(path, { pid: process.pid, package: 'packages/us-state-tax', started: new Date().toISOString() });
  let message = '';
  try {
    refuseIfAudited('us-state-tax', path);
  } catch (error) {
    message = error.message;
  }
  // Not prose-pinning for its own sake: each of these is an instruction the
  // reader needs and all three were missing from the first draft of the guard,
  // which said only that a build was refused.
  assert.match(message, new RegExp(`pid ${process.pid}`), 'what to kill');
  assert.match(message, /scores\.json/, 'why it matters');
  assert.match(message, /wait for the audit|restart it/, 'the two choices');
  rmSync(path, { force: true });
});

test('both audited packages carry a build guard, and it runs BEFORE the build', () => {
  // The lock is only worth having if the packages consult it, and the FIRST
  // version of this guard ran at the end of `npm run build` — after `rm -rf
  // dist && tsc` had already rewritten the tree — which made it a warning
  // rather than a prevention. Asserted here rather than trusted, because the
  // guard lives in two hand-copied files that this module cannot import.
  const root = new URL('../..', import.meta.url).pathname;
  for (const pkg of ['us-state-tax', 'us-federal-tax']) {
    const finalize = readFileSync(join(root, 'packages', pkg, 'scripts', 'finalize.mjs'), 'utf8');
    assert.match(finalize, /auditHoldingThisPackage/, `${pkg} finalize.mjs has the guard`);
    assert.match(finalize, /--guard-only/, `${pkg} finalize.mjs can run guard-only`);
    assert.match(finalize, /EPERM/, `${pkg} finalize.mjs treats EPERM as alive`);

    const manifest = JSON.parse(readFileSync(join(root, 'packages', pkg, 'package.json'), 'utf8'));
    assert.match(
      manifest.scripts.build,
      /^node scripts\/finalize\.mjs --guard-only &&/,
      `${pkg} guards before rm -rf dist`,
    );
  }
});
