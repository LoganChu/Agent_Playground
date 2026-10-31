#!/usr/bin/env node
/**
 * WHAT THIS REPOSITORY IS ALLOWED TO TRACK, asserted against `git ls-files`.
 *
 * ## Why it exists
 *
 * On Day 67 this repository committed **74,784 files and 838 MB of a Python
 * virtualenv** — a complete install of `policyengine-us` 2.15.3 and its
 * dependency tree — to `main`, and pushed it. The real tree is 275 files. The
 * venv was 99.6% of everything tracked.
 *
 * Two things were wrong with that and only one of them is disk space.
 *
 * **`policyengine-us` is AGPL-3.0 and this repository is MIT.** Day 1 chose that
 * model as a cross-check "used ONLY as a cross-check of published IRS facts; no
 * code or files copied", and sixty-six days of notes repeat the care. A `git
 * add` undid it: 232 third-party licence files, the great majority of them
 * copyleft, sat inside a tree whose root `LICENSE` says MIT and whose three
 * packages all declare `"license": "MIT"`. The npm tarballs were never affected
 * — every `files` list is `dist`, `README.md` and `LICENSE` — so the defect was
 * in the repository as published rather than in anything shipped. That does not
 * make it small: it is the one claim in this project a buyer's diligence would
 * check first, and it was false for a day.
 *
 * **And the directory name was the README's own suggestion.** `.gitignore`
 * listed `.pe/` and `.venv/`; `tools/differential/README.md` said to put a
 * second install in "`.pe2` or similar", in the same code block as a warning
 * that `git add -A` over an unignored venv stages thousands of files of numpy.
 * The advice and the rule that would have covered it were four lines apart.
 *
 * > **AN IGNORE LIST IS A LIST OF THE ACCIDENTS SOMEBODY ALREADY HAD.** It
 * > cannot cover the next directory name, and the next directory name is the one
 * > the next run will invent. So this guard does not enumerate what must not be
 * > tracked. It enumerates what MAY be, and fails on everything else.
 *
 * ## The four assertions, and why there are four
 *
 * Each one on its own would have caught Day 67. They are all here because they
 * fail on *different* accidents, and the cheap ones are the ones that catch the
 * accident nobody has had yet:
 *
 * 1. **No tracked path may contain a vendoring segment** — `node_modules`,
 *    `site-packages`, `__pycache__`, a `.dist-info`, `.pe*`, `.venv*`, `dist`.
 *    This is the enumerating assertion and the weakest of the four, kept because
 *    its failure message is the one that names the problem out loud.
 * 2. **Every tracked file's extension must be allowlisted.** The real tree uses
 *    ten. A venv brings `.so`, `.pyi`, `.h`, `.dylib`, `.typed`, `.cfg`, `.pth`
 *    and a hundred more.
 * 3. **Every licence file must be declared by path.** Day 67 tracked 232 of
 *    them; this repository has four. This is the assertion that is actually
 *    about the licence rather than about disk, and it is why a vendored
 *    dependency cannot arrive quietly even if its extensions all pass (2).
 * 4. **The tracked file count must be at or below a ceiling.** The catch-all.
 *    It is deliberately generous — this tree may quadruple before anyone has to
 *    think about it — because its job is to notice 74,784 and not to notice 12.
 *
 * `--check` exits 1 on any failure and prints every offending path, capped.
 * With no flag it prints what it measured, which is how the ceiling gets set.
 * {@link auditPaths} is exported so `tracked-paths.test.mjs` can run the four
 * assertions over the paths Day 67 actually committed.
 */
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Path segments that never belong in this repository. */
const VENDORING_SEGMENTS = ['node_modules', 'site-packages', '__pycache__', 'dist', 'venv'];
const VENDORING_PATTERNS = [
  /(^|\/)\.pe[^/]*\//,
  /(^|\/)\.venv[^/]*\//,
  /\.(dist|egg)-info(\/|$)/,
  /(^|\/)pyvenv\.cfg$/,
];

/**
 * The extensions this repository's own files use. Ten, measured — and the list
 * is short because every file here is text somebody wrote.
 */
const ALLOWED_EXTENSIONS = new Set([
  'js',
  'mjs',
  'ts',
  'json',
  'md',
  'yml',
  'html',
  'css',
  'py',
  'sha256',
]);

/**
 * Tracked files with no extension to test, allowed by exact path.
 *
 * A DOTFILE HAS NO EXTENSION AND THAT IS NOT A SPECIAL CASE WORTH CODING. The
 * first draft of this file put `gitignore` in the extension allowlist, which is
 * dead: `.gitignore`'s only dot is at position 0, so it lands here instead and
 * the extension entry never matched anything. The guard said so on its first
 * run, which is the cheapest possible way to learn that a rule written from the
 * shape of a filename is a rule about where the dots are.
 */
const ALLOWED_EXTENSIONLESS = new Set([
  'LICENSE',
  'packages/us-federal-tax/LICENSE',
  'packages/us-state-tax/LICENSE',
  'packages/us-tax-mcp/LICENSE',
  '.gitignore',
  'packages/us-tax-mcp/.gitignore',
]);

/**
 * EVERY LICENCE FILE IN THIS REPOSITORY, BY PATH. Four, all of them this
 * project's own MIT grant. A fifth means something was vendored, whatever its
 * extensions looked like.
 */
const DECLARED_LICENCE_FILES = new Set([
  'LICENSE',
  'packages/us-federal-tax/LICENSE',
  'packages/us-state-tax/LICENSE',
  'packages/us-tax-mcp/LICENSE',
]);
const LICENCE_BASENAME = /^(licen[cs]e|copying|notice)([.-].*)?$/i;

/** Top-level entries. A new one is a decision and should fail until declared. */
const ALLOWED_TOP_LEVEL = new Set([
  '.github',
  '.gitignore',
  'JOURNAL.md',
  'LICENSE',
  'NOTES-FOR-HUMAN.md',
  'README.md',
  'STRATEGY.md',
  'packages',
  'site',
  'tools',
]);

/**
 * The ceiling, and the number beside it is what was measured when it was set.
 *
 * 275 real files on Day 68, against 74,784 tracked the day before. A ceiling of
 * 1,200 lets this tree more than quadruple without anybody editing this line and
 * still fails on anything of the order that actually went wrong.
 */
export const MAX_TRACKED_FILES = 1_200;
const MEASURED_WHEN_SET = 275;

/**
 * The four assertions, as a pure function of a path list.
 *
 * A GUARD WRITTEN AFTER AN ACCIDENT SHOULD BE TESTED ON THE ACCIDENT, and
 * reading the index is the one thing this function does not do, which is what
 * makes that possible.
 */
export function auditPaths(paths) {
  const failures = [];
  const note = (what, offending) => {
    if (offending.length > 0) failures.push({ what, paths: offending });
  };

  note(
    'tracked paths inside a vendored dependency',
    paths.filter((p) => {
      const segments = p.split('/');
      if (VENDORING_SEGMENTS.some((s) => segments.includes(s))) return true;
      return VENDORING_PATTERNS.some((re) => re.test(p));
    }),
  );

  note(
    'tracked files whose extension is not allowlisted',
    paths.filter((p) => {
      const base = p.split('/').pop();
      const dot = base.lastIndexOf('.');
      if (dot <= 0) return !ALLOWED_EXTENSIONLESS.has(p);
      return !ALLOWED_EXTENSIONS.has(base.slice(dot + 1).toLowerCase());
    }),
  );

  note(
    'licence files that are not this project’s own',
    paths.filter((p) => {
      const base = p.split('/').pop();
      return LICENCE_BASENAME.test(base) && !DECLARED_LICENCE_FILES.has(p);
    }),
  );

  note(
    'undeclared top-level entries',
    [...new Set(paths.map((p) => p.split('/')[0]))].filter((e) => !ALLOWED_TOP_LEVEL.has(e)),
  );

  if (paths.length > MAX_TRACKED_FILES) {
    failures.push({
      what: `${paths.length} tracked files, over the declared ceiling of ${MAX_TRACKED_FILES}`,
      paths: [],
    });
  }
  return failures;
}

function main() {
  const check = process.argv.includes('--check');
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
    .split('\0')
    .filter((p) => p.length > 0);
  const failures = auditPaths(tracked);

  if (!check) {
    const extensions = new Map();
    for (const p of tracked) {
      const base = p.split('/').pop();
      const dot = base.lastIndexOf('.');
      const key = dot <= 0 ? '(none)' : base.slice(dot + 1).toLowerCase();
      extensions.set(key, (extensions.get(key) ?? 0) + 1);
    }
    console.log(`${tracked.length} tracked files, ceiling ${MAX_TRACKED_FILES}`);
    console.log(
      [...extensions]
        .sort((a, b) => b[1] - a[1])
        .map(([e, n]) => `  ${String(n).padStart(5)}  ${e}`)
        .join('\n'),
    );
    console.log(`top level: ${[...new Set(tracked.map((p) => p.split('/')[0]))].sort().join(', ')}`);
  }

  if (failures.length > 0) {
    console.error('This repository tracks paths it does not allow itself to track.\n');
    for (const { what, paths } of failures) {
      console.error(`  ${paths.length > 0 ? `${paths.length} ` : ''}${what}`);
      for (const p of paths.slice(0, 12)) console.error(`      ${p}`);
      if (paths.length > 12) console.error(`      ... and ${paths.length - 12} more`);
      console.error('');
    }
    console.error(
      'Day 67 committed 838 MB of an AGPL virtualenv this way and the ignore rule named\n' +
        'the wrong directory. If a new path is legitimate, declare it in\n' +
        'tools/cross-package/tracked-paths.mjs. Do not widen the glob instead.',
    );
    process.exit(1);
  }

  if (check) {
    console.log(
      `ok — ${tracked.length} tracked files, all allowlisted by extension and top level, ` +
        `4 licence files all this project’s own, ceiling ${MAX_TRACKED_FILES} ` +
        `(${MEASURED_WHEN_SET} when it was set)`,
    );
  }
}

/** Run the CLI only when this file is the entry point, not when imported. */
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
