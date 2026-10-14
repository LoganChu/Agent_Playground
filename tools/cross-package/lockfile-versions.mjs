#!/usr/bin/env node
/**
 * Does each package's lockfile agree with its own `package.json` about what
 * version this is?
 *
 * ## Why this exists
 *
 * Day 48's worklist queued this check and sized it at one test. Day 50 bumped
 * `us-tax-mcp` from 0.47.0 to 0.48.0 and found its lockfile already said
 * **0.46.0** — stale before today's change, which means the version it had been
 * shipping under was wrong in the lockfile for the whole of Day 49 and nothing
 * said so. **The drift the check was queued against had already happened by the
 * time it was queued**, which is the best possible argument for a check that
 * costs a second.
 *
 * `npm install` rewrites `version` and `packages[""].version` from
 * `package.json`, so the two agree for anyone who bumps a version the normal
 * way. They part company when a version is edited by hand — which is how it is
 * done here, because the release workflow reads `package.json` and a full
 * `npm install` in a zero-dependency package is three seconds of nothing.
 *
 * ## Why it matters beyond tidiness
 *
 * The lockfile is in the published tarball. A consumer running `npm ci` against
 * a checkout of this repository resolves the version the LOCKFILE names, and a
 * lockfile a version behind is a lockfile describing a package that was
 * released with different code in it. It is the same class as Day 37's stale
 * mutation score: an artefact that is allowed to drift from the thing it
 * describes is worth less than no artefact, because it is believed.
 *
 * ## Usage
 *
 *     node tools/cross-package/lockfile-versions.mjs          # report
 *     node tools/cross-package/lockfile-versions.mjs --check  # exit 1 on drift
 */
import { readFileSync } from 'node:fs';

const PACKAGES = ['us-federal-tax', 'us-state-tax', 'us-tax-mcp'];

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

const rows = PACKAGES.map((name) => {
  const pkg = read(`../../packages/${name}/package.json`);
  const lock = read(`../../packages/${name}/package-lock.json`);
  return {
    name,
    package: pkg.version,
    // Both places a lockfile records its own version. `packages[""]` is the
    // root entry of the v2/v3 format and is the one `npm ci` reads; the
    // top-level `version` is the v1 field npm still writes. A hand-edit that
    // fixes one and not the other is exactly the failure this is for.
    lockTop: lock.version,
    lockRoot: lock.packages?.['']?.version,
    lockName: lock.name,
  };
});

const wrong = rows.filter(
  (r) => r.package !== r.lockTop || r.package !== r.lockRoot || r.name !== r.lockName,
);

for (const r of rows) {
  const ok = wrong.includes(r) ? 'DRIFTED' : 'ok';
  console.log(
    `${r.name.padEnd(16)} package.json ${String(r.package).padEnd(8)} ` +
      `lock ${String(r.lockTop).padEnd(8)} lock.packages[""] ${String(r.lockRoot).padEnd(8)} ${ok}`,
  );
}

if (process.argv.includes('--check')) {
  if (wrong.length > 0) {
    console.error(
      `\n${wrong.length} lockfile(s) disagree with their package.json. Run \`npm install\` in ` +
        'each one, or edit the lockfile to match — the lockfile ships in the tarball and a ' +
        'consumer running `npm ci` resolves the version IT names.',
    );
    process.exit(1);
  }
  console.log(`\nAll ${rows.length} lockfiles agree with their package.json.`);
}
