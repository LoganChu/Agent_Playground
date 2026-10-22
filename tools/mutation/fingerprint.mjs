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
 * **This comment has now been wrong in BOTH directions, and the second version
 * was harder to catch than the first because it arrived labelled as a fix.**
 *
 * Version one claimed that rewording a doc comment does NOT change the
 * fingerprint, because the comment "lands in the `.d.ts` and not in the `.js`".
 * Day 42 disproved that by editing one Oregon citation while a 1,267-mutant audit
 * was 25 minutes in.
 *
 * Version two, written that day, said the opposite and said it too widely: that
 * because both packages set `"removeComments": false`, **tsc copies every doc
 * comment into the emitted `.js`**, so any comment edit invalidates a recorded
 * score. Day 58 measured it, by rewording one comment at a time and rebuilding:
 *
 * ```text
 *   JSDoc on an INTERFACE (type-only)   fingerprint f882147b3c852cf2 -> unchanged
 *   JSDoc on an exported CONST          fingerprint f882147b3c852cf2 -> eb33d18409a62387
 * ```
 *
 * **A doc comment reaches the emitted `.js` only if the declaration it documents
 * does.** `removeComments: false` keeps the comments attached to code that
 * survives; an interface, a type alias and the rest of the type-only
 * declarations are ERASED, and their documentation goes with them. A `cite:`
 * string is a different matter and the old sentence was right about it: that is a
 * string literal in runtime code whatever the compiler does with comments.
 *
 * > **THE RULE: A CORRECTION CAN OVERSHOOT, AND THE OVERSHOOT IS HARDER TO SEE
 * > THAN THE ORIGINAL ERROR, BECAUSE IT ARRIVES LABELLED AS A FIX.** Day 42's
 * > claim was wrong, Day 42's correction was also wrong, and the truth is the
 * > conjunction of the two rather than either one.
 *
 * The operational rule this refines, from Day 42 and restated by Days 56 and 57
 * ("every src edit, every test edit AND every performance decision before the
 * audit starts"), is now precise rather than conservative: **documentation on
 * type-only declarations is free to edit while an audit is in flight, and
 * documentation on anything that survives to runtime is not.** Day 58 used that
 * — two over-wide sentences in `StateIncomeTaxMeter`'s JSDoc were narrowed with
 * a 1,543-mutant audit two hundred mutants in, and the fingerprint and the
 * enumerated mutant list were both checked afterwards and both were unchanged.
 *
 * The fingerprint is still a hash of raw bytes, so it is STRICTER than the thing
 * it stands in for and can still reject a score that is in fact valid.
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
