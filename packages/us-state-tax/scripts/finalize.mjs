// REFUSE A BUILD OF THIS PACKAGE WHILE A DELIBERATE-ERROR AUDIT IS MEASURING IT.
//
// Four times now a run has started the 46-minute audit, gone on working — which
// is the correct use of 46 minutes — and rebuilt `dist` underneath it, leaving
// the audit about to write a score fingerprinted against bytes that had moved.
// `tools/mutation/audit-lock.mjs` carries the full account.
//
// Read as a FILE rather than imported, deliberately: this script ships inside a
// package whose `files` field is `dist`, `README.md` and `LICENSE`, so a build
// run outside this repository has no `tools/` beside it. A missing or unreadable
// lock means "no audit", which is the right answer there and the common answer
// here.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function auditHoldingThisPackage() {
  let lock;
  try {
    lock = JSON.parse(
      readFileSync(
        join(import.meta.dirname, '..', '..', '..', 'tools', 'mutation', '.audit-lock.json'),
        'utf8',
      ),
    );
  } catch {
    return null;
  }
  // `JSON.parse` succeeds on `null` and on `[]`, so a truncated or nonsense lock
  // is rejected HERE rather than by the `process.kill` below throwing a
  // TypeError that happens to be caught. The accidental version reached the same
  // answer and said nothing about why.
  if (typeof lock !== 'object' || lock === null || Array.isArray(lock)) return null;
  // A lock whose process is gone is stale. `process.kill(pid, 0)` throws ESRCH
  // for a dead pid and EPERM for one owned by another user — and EPERM means
  // ALIVE, so it must count as held or the guard fails open.
  try {
    process.kill(lock.pid, 0);
  } catch (error) {
    if (error.code !== 'EPERM') return null;
  }
  const segments = String(lock.package).split(/[\\/]/).filter(Boolean);
  return segments.includes('us-state-tax') ? lock : null;
}

// RUN AS THE FIRST STEP OF THE BUILD AS WELL AS THE LAST, with `--guard-only`.
//
// The guard below was written to sit at the END of the build, where this script
// has always run — and that makes it a WARNING rather than a prevention,
// because `tsc` has already rewritten `dist` by the time it fires. It was
// noticed the first time it fired for real: the message said "rebuilding dist
// moves them" about a rebuild that had already happened.
//
// So `npm run build` now invokes this script twice: once with `--guard-only`
// before `rm -rf dist`, which refuses and changes nothing, and once at the end
// without it. The second call is not redundant — an audit can START during a
// build, and the two together mean the overlap is caught whichever order it
// happens in.
const GUARD_ONLY = process.argv.includes('--guard-only');

const audit = auditHoldingThisPackage();
if (audit !== null) {
  const minutes = Math.round((Date.now() - Date.parse(audit.started)) / 60_000);
  console.error(
    `REFUSED: a deliberate-error audit of us-state-tax is running (pid ${audit.pid}, ` +
      `started ${audit.started}, ${minutes} minute(s) ago).\n\n` +
      `The audit snapshotted this package at start-up, so the RUN is unharmed — but\n` +
      `scores.json fingerprints the bytes of the files the score was computed over, and\n` +
      `rebuilding dist moves them, so the score it is about to write would describe a\n` +
      `tree that no longer exists.\n\n` +
      `Either wait for the audit, or kill pid ${audit.pid}, build, and restart it on the\n` +
      `final tree. The second is almost always right: ten minutes of CPU costs less\n` +
      `than an unusable score.`,
  );
  process.exit(2);
}
if (GUARD_ONLY) process.exit(0);

// Root package.json says "type": "module", so the CommonJS output needs its own
// marker or Node will try to parse the .js files as ESM.
import { writeFileSync } from 'node:fs';

writeFileSync('dist/esm/package.json', JSON.stringify({ type: 'module' }, null, 2) + '\n');
writeFileSync('dist/cjs/package.json', JSON.stringify({ type: 'commonjs' }, null, 2) + '\n');
console.log('wrote dist/{esm,cjs}/package.json module markers');
