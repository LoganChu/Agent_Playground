/**
 * A fingerprint of the exact bytes a mutation audit mutates.
 *
 * ## Why a score needs one
 *
 * Day 35 left the rule that a score may not be INFERRED, and Day 36 added that
 * it may not be INHERITED either: the harness copies `dist` into its workers
 * once at start, so a score belongs to the tree it ran on. Both runs stated the
 * rule and then relied on remembering it.
 *
 * Day 37 found what that costs. `README.md` advertised the federal package at
 * **698 mutants** for a day after the committed, measured figure became 711 —
 * the mutation numbers are the only advertised measurements in this repository
 * that are still hand-maintained, which is exactly the hole Day 36 closed for
 * the test counts and did not notice beside it. And the same day, three
 * separate edits landed while an audit was in flight, each needing the question
 * "is the running audit still measuring what will ship?" answered by hand.
 *
 * **THE RULE: a measurement is only a measurement of something, and the
 * something has to be recorded beside it.** A score with no fingerprint cannot
 * be told from a stale score, and this project's whole claim is that its
 * quality numbers are checkable rather than self-reported.
 *
 * So `mutate.mjs --record` writes this fingerprint beside the score, and
 * `check-scores.mjs` recomputes it from a fresh build and fails when they
 * differ — which turns "the audit was re-run after that edit" from something a
 * journal entry asserts into something CI checks on every push, for the price
 * of a build.
 *
 * ## What it covers, and what it deliberately does not
 *
 * Only `dist/esm/**` + `.js`, because that is precisely the set `mutate.mjs`
 * walks.
 *
 * **This comment used to claim that rewording a doc comment does NOT change the
 * fingerprint, because the comment "lands in the `.d.ts` and not in the `.js`".
 * That is false for this repository and was false when it was written.** Both
 * packages set `"removeComments": false`, so tsc copies every doc comment into
 * the emitted `.js`, and a `cite:` string is a string literal in the `.js`
 * whatever the compiler does with comments. The fingerprint is a hash of raw
 * bytes, so **rewording a comment or correcting a citation invalidates a
 * recorded score**, and Day 42 found this out by editing one Oregon citation
 * while a 1,267-mutant audit was 25 minutes in.
 *
 * The claim is worth keeping as a correction rather than deleting, because the
 * argument behind it was right and only the mechanism was wrong. "A string is
 * not a mutant" is true — no comment changes which mutants exist or which die —
 * so a byte fingerprint is STRICTER than the thing it is standing in for. That
 * is the safe direction to be wrong in, and it means the fingerprint can reject
 * a score that is in fact still valid. The cost is real: every comment edit
 * after an audit costs another audit.
 *
 * **What to do about it, for a future run: make every documentation and citation
 * edit BEFORE starting the recorded audit, and treat the audit as the last thing
 * that happens in a run.** Day 42 paid for that rule twice in one day.
 *
 * Fingerprinting the mutable literals rather than the bytes would fix it
 * properly — `mutate.mjs` already enumerates them, so the digest could be over
 * the enumeration instead of the files — and that is on the worklist.
 *
 * The test files are not in it. A change to a test can absolutely change a
 * score — it is the thing doing the killing — so `check-scores.mjs` fingerprints
 * `test/` separately and reports the two independently, because they fail for
 * different reasons and want different fixes.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Every file under `dir` whose name ends with one of `suffixes`, sorted. */
export function filesUnder(dir, suffixes) {
  const out = [];
  const walk = (current) => {
    for (const entry of readdirSync(current).sort()) {
      const path = join(current, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (suffixes.some((suffix) => path.endsWith(suffix))) out.push(path);
    }
  };
  walk(dir);
  return out.sort();
}

/**
 * A hex digest over the sorted relative paths and contents of those files.
 *
 * Paths are included, so adding an empty file or renaming one changes the
 * fingerprint — a mutant set is the files as much as the bytes.
 */
export function fingerprintOf(dir, suffixes) {
  const hash = createHash('sha256');
  for (const path of filesUnder(dir, suffixes)) {
    hash.update(relative(dir, path));
    hash.update('\0');
    hash.update(readFileSync(path));
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 16);
}

/** The bytes `mutate.mjs` mutates, for one package directory. */
export const mutantFingerprint = (packageDir) =>
  fingerprintOf(join(packageDir, 'dist/esm'), ['.js']);

/** The suite that does the killing, which is a separate reason for a score to move. */
export const suiteFingerprint = (packageDir) =>
  fingerprintOf(join(packageDir, 'test'), ['.js', '.json', '.mjs']);
