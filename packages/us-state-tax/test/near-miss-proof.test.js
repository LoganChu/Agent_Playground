// The exhaustive proof that Day 59's two optimisations moved no suggestion.
//
// ## Why this is a separate file, and why it reads out of this package
//
// Day 58 measured one misspelled input key at **1,152 microseconds** — 232
// times a whole state return — essentially all of it inside the near-miss
// fallback's edit distance. Day 59 made that path 36 times faster with two
// changes that must be invisible:
//
//   1. a LENGTH PRUNE, which is exact: an edit distance is never less than the
//      difference in length, so a field name whose length is further from the
//      key's than the budget allows cannot be within budget and is never
//      measured at all;
//   2. THREE ROLLING ROWS in place of a matrix allocated one row at a time.
//
// "Cannot change an answer" is provable for both, and this file is where it is
// PROVED rather than argued: every one-edit neighbour of every field name — the
// four shapes the distance is built to catch, about twenty thousand keys across
// the two interfaces — run through the shipped function and through an unpruned,
// full-matrix reference, and required to agree key by key.
//
// **It is here rather than in `unknown-input.test.js` for a cost reason that is
// a measurement, not a preference.** `tools/mutation/mutate.mjs` runs each
// package's whole suite once per mutant — 1,543 times for this package — so
// thirteen seconds of proof in a suite file is an hour and a half added to every
// audit. And it would buy nothing there: the prune contains no numeric literal,
// so the harness cannot mutate it and no mutant can ever reach it. The
// in-suite tests are the fast ones; this is the slow one, run once per push.
//
// Being out of the audit is automatic rather than configured. `mutate.mjs`
// derives it — a test file that resolves a path out of its own package is a
// repository assertion, cannot pass inside a worker copy of one package, and is
// printed in the skip list. This file qualifies honestly, because the claim it
// checks is genuinely about BOTH packages at once.
//
// ## And it proves both packages from one copy of the module
//
// `src/unknown-input.ts` is byte-identical in the two packages —
// `shared-module.test.js` is the waiting period that keeps it so. So the module
// under test is the same module, and what differs is the FIELD LIST it is
// handed. This file therefore runs THIS package's compiled function against
// both interfaces' field names, and reads the federal list out of
// `us-federal-tax/src/estimate.ts` by a source parse rather than by importing
// its `dist` — because the sibling package is not built in the CI job that runs
// this suite, and a test that needs a neighbour's build is a test that fails for
// a reason that is not about the code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KNOWN_STATE_INPUT_FIELDS, nearestFields } from '../dist/esm/index.js';
import { referenceNearestFields, oneEditCorpus } from './near-miss-reference.mjs';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * The federal field list, parsed out of the sibling's source.
 *
 * A source parse is the thing Day 37's `ExactlyKeys` proof exists to avoid for
 * the list the engine USES, and that is not what this is: the list the federal
 * engine uses is still proved against `keyof EstimateInput` by its own compiler
 * inside its own package. This is a second interface's worth of field names
 * borrowed as TEST DATA, and the only property it needs is that the names are
 * real and there are the right number of them — both checked below.
 */
function federalFields() {
  const file = readFileSync(
    resolve(here, '..', '..', 'us-federal-tax', 'src', 'estimate.ts'),
    'utf8',
  );
  const body = file.match(
    /export const KNOWN_ESTIMATE_INPUT_FIELDS = \[([\s\S]*?)\n\] as const;/,
  );
  assert.ok(body, 'the premise: the federal field list is still a literal array in estimate.ts');
  return [...body[1].matchAll(/'([A-Za-z0-9]+)'/g)].map((m) => m[1]);
}

const LISTS = [
  ['StateIncomeTaxInput', [...KNOWN_STATE_INPUT_FIELDS], 55],
  ['EstimateInput', federalFields(), 41],
];

test('the federal field list really was parsed, and is the length it should be', () => {
  const [, fields, count] = LISTS[1];
  assert.equal(fields.length, count);
  assert.equal(new Set(fields).size, count, 'no name read twice');
  assert.ok(fields.includes('w2Wages'), 'the field Day 37 got wrong, which has a digit in it');
  assert.ok(fields.includes('itemizedDeductions'), 'and the one the British spelling misses');
});

for (const [interfaceName, fields, count] of LISTS) {
  test(`every one-edit neighbour of every ${interfaceName} field gets the same answer`, () => {
    assert.equal(fields.length, count, 'the premise: the list is the size the corpus is sized for');
    const keys = oneEditCorpus(fields);
    // Sized so a regression in the generator cannot quietly shrink the proof to
    // nothing: a corpus of a few hundred keys would pass this file and prove
    // very little.
    assert.ok(keys.length > 90 * count, `${keys.length} keys is too few to be a proof`);
    let reached = 0;
    for (const key of keys) {
      const lower = key.toLowerCase();
      const substringHit = fields.some((f) => {
        const c = f.toLowerCase();
        return c.includes(lower) || lower.includes(c);
      });
      if (!substringHit && Math.min(2, Math.floor(key.length / 4)) > 0) reached += 1;
      assert.deepEqual([...nearestFields(key, fields)], [...referenceNearestFields(key, fields)], key);
    }
    // And the corpus really does exercise the pruned path, rather than being
    // thousands of keys that the substring rule answers before the fallback is
    // reached. THIS IS THE ASSERTION THAT MAKES THE FILE A PROOF OF ANYTHING:
    // without it, a corpus of exact field names would pass every line above.
    assert.ok(reached > keys.length / 2, `only ${reached} of ${keys.length} keys reached the fallback`);
  });
}
