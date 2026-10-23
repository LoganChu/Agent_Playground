// An unpruned, full-matrix reference for the near-miss rule, and the corpus to
// run it over. Deliberately the dumbest correct thing there is.
//
// ## Why a second implementation, when this repository's rule is against them
//
// Day 53's rule is that a second copy of a FACT drifts — seven hand-written
// lists of which states read which field were each wrong in the flattering
// direction. This is not a second copy of a fact. It is a second
// implementation of an ALGORITHM, written from the recurrence rather than from
// the shipped code, and its whole job is to disagree with the fast one.
//
// Day 59 made `nearestFields` thirty times faster by two changes that must not
// move a single suggestion:
//
//   1. a LENGTH PRUNE — an edit distance is never less than the difference in
//      length, so a name whose length differs from the key's by more than the
//      budget cannot be within it and is never measured at all;
//   2. THREE ROLLING ROWS in place of the whole matrix.
//
// The first is an exact bound and the second is a rewrite of the same
// recurrence, so "cannot change an answer" is provable in both cases. **This
// file is how it is proved instead of argued**: the shipped function and this
// one are run over every one-edit neighbour of every field name and required to
// agree, key by key, suggestion by suggestion.
//
// Note what the reference does NOT share with the shipped code: no prune, no
// row rotation, `Array.from` per row. A bug that lived in both would have to be
// a bug in the recurrence itself, which is the one part neither version
// rewrote — and the length bound the prune rests on is asserted here directly,
// over every pair, rather than inherited from either implementation.
//
// There are two byte-identical copies of this file, one per package, for the
// same reason there are two of `src/unknown-input.ts`: the packages do not
// depend on each other and a test that reaches into a sibling leaves the
// mutation audit. `shared-module.test.js` is the waiting period that keeps them
// equal.

/** Optimal string alignment, straight from the recurrence, whole matrix. */
export function referenceEditDistance(a, b) {
  const rows = [];
  for (let i = 0; i <= a.length; i += 1) {
    rows.push(Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : 0)));
    rows[i][0] = i;
  }
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + substitution);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, rows[i - 2][j - 2] + 1);
      }
      rows[i][j] = best;
    }
  }
  return rows[a.length][b.length];
}

// The three published constants, repeated here on purpose: a reference that
// imported them from the module under test would agree with it about the budget
// by construction, and the budget is what decides the prune's width.
const SUGGESTION_LIMIT = 3;
const MAX_EDITS = 2;
const CHARACTERS_PER_EDIT = 4;

/** `nearestFields`, written from its own documentation, measuring every name. */
export function referenceNearestFields(key, known) {
  const lower = key.toLowerCase();
  const shared = (field) => Math.min(field.length, key.length);
  const contained = known
    .filter((field) => {
      const candidate = field.toLowerCase();
      return candidate.includes(lower) || lower.includes(candidate);
    })
    .sort((a, b) => {
      const byShared = shared(b) - shared(a);
      if (byShared !== 0) return byShared;
      const byCloseness = Math.abs(a.length - key.length) - Math.abs(b.length - key.length);
      return byCloseness !== 0 ? byCloseness : a.localeCompare(b);
    });
  if (contained.length > 0) return contained.slice(0, SUGGESTION_LIMIT);
  const budget = Math.min(MAX_EDITS, Math.floor(key.length / CHARACTERS_PER_EDIT));
  if (budget === 0) return [];
  return known
    .map((field) => ({ field, distance: referenceEditDistance(lower, field.toLowerCase()) }))
    .filter(({ distance }) => distance <= budget)
    .sort((a, b) =>
      a.distance !== b.distance ? a.distance - b.distance : a.field.localeCompare(b.field),
    )
    .map(({ field }) => field)
    .slice(0, SUGGESTION_LIMIT);
}

/**
 * Every one-edit neighbour of every field name, in the four shapes the distance
 * is built to catch, plus the keys this suite names elsewhere.
 *
 * GENERATED FROM THE SHIPPED FIELD LIST rather than typed, so it grows with the
 * interface and cannot go stale the way a hand-written corpus would. The letters
 * are the five vowels: a corpus of one-letter substitutions does not need the
 * whole alphabet to exercise every length the prune can see, and the five keep
 * the reference's own cost inside a few seconds.
 */
export function oneEditCorpus(fields, extra = []) {
  const keys = new Set(['', 'x', 'xy', 'xyz', ...extra]);
  for (const field of fields) {
    keys.add(field);
    keys.add(field.toUpperCase());
    for (let i = 0; i < field.length; i += 1) {
      keys.add(field.slice(0, i) + field.slice(i + 1));
      if (i + 1 < field.length) {
        keys.add(field.slice(0, i) + field[i + 1] + field[i] + field.slice(i + 2));
      }
      for (const c of 'aeiou') {
        keys.add(field.slice(0, i) + c + field.slice(i));
        keys.add(field.slice(0, i) + c + field.slice(i + 1));
      }
    }
  }
  return [...keys];
}
