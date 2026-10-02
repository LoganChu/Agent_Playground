/**
 * Report — or refuse — an input key this package does not read.
 *
 * ## Why this file exists, which is a reproduction rather than an argument
 *
 * Day 37 installed the published packages from a release URL the way a stranger
 * would, and the **first call ever made against the published library** was
 *
 * ```js
 * estimateFederalTax({ filingStatus: 'marriedFilingJointly', wages: 180_000 })
 * ```
 *
 * The field is `w2Wages`. The engine took the unknown key, dropped it, and
 * returned a complete, confident, internally consistent estimate of **nothing**:
 * `adjustedGrossIncome: 0`, `taxableIncome: 0`, `totalTax: 0`, and a
 * `marginalRate` of `0.1`, which is the most convincing part. Every ratio inside
 * that result agreed with every other one. There is no symptom to notice.
 *
 * That is Day 32's rule at the top level — **accepting an input is not reading
 * it** — and it is the fourth occurrence of one mistake in this repository:
 * Day 33's `wages` for `w2Wages` in a test household, twice on Day 34 inside
 * `us-state-tax`'s `retirement` split (which is why its `PERSON_RETIREMENT_FIELDS`
 * throws outright), and then its own author on the first external call.
 *
 * ## Why a note by default and not a throw
 *
 * Four days of worklists specified this as `strict: true`, opt-in. **That design
 * does not work, and the reproduction is what shows why:** the failure mode is a
 * caller who does not know the field name, and a caller who does not know the
 * field name does not know to pass `strict`. An opt-in guard protects exactly the
 * people who did not need it.
 *
 * So it is the other way round. A **note** by default, always, in
 * `result.notes` — which exists for precisely this, "what the engine did with
 * something you told it and could not use", and which a model reads — and
 * `strict: true` to escalate the same finding to a throw for a caller who wants
 * their own typo to stop the program.
 *
 * A note is also what keeps the open-by-design reasoning true. A caller's own
 * object may reasonably carry their bookkeeping keys, and a throw would break
 * them on an upgrade; an advisory string does not.
 *
 * ## One deliberate silence
 *
 * A key whose value is `undefined` is **not** reported. `undefined` means absent
 * everywhere in both engines, so an unrecognised key holding it has dropped no
 * figure and there is nothing to warn about. `null` is reported: it is a value a
 * JSON caller can really send, and it really is discarded.
 *
 * This module imports nothing, so it can be a leaf of either package's graph.
 */

/** How many near-misses a message is allowed to name. */
const SUGGESTION_LIMIT = 3;

/**
 * The most typos a near-miss is allowed to be away.
 *
 * Day 34's version of this note, in `us-state-tax`'s retirement guard, said that
 * a full edit distance "would catch a transposition too and has never been the
 * shape of one of these". It is now: writing the tests for this module produced
 * `subtractons` for `subtractions`, which shares no substring with it in either
 * direction and so got no suggestion at all from the substring rule.
 *
 * **A missing letter is the commonest typo there is and substring matching is
 * blind to it**, because deleting a character from the middle of a name breaks
 * containment in both directions at once.
 */
const MAX_EDITS = 2;

/**
 * How many characters of a key buy one edit of budget.
 *
 * Two edits turn a four-letter name into a different word, and a suggestion that
 * is mostly different is worse than being pointed at the field list. So the
 * budget is earned: one edit from four characters, two from eight, and nothing
 * at all below four.
 */
const CHARACTERS_PER_EDIT = 4;

/**
 * Optimal string alignment distance — Levenshtein with **transposition counted
 * as one edit** rather than two.
 *
 * That choice is the difference between catching `blnid` for `blind` and not:
 * two adjacent letters swapped is one typo to the person who made it, and
 * charging it two puts it outside the budget of every name short enough for the
 * swap to be the likely mistake.
 *
 * Only ever computed against a name that already failed the substring test, so
 * the cost is bounded by the field count.
 */
function editDistance(a: string, b: string): number {
  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i += 1) {
    rows.push(Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : 0)));
    (rows[i] as number[])[0] = i;
  }
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(
        ((rows[i - 1] as number[])[j] as number) + 1,
        ((rows[i] as number[])[j - 1] as number) + 1,
        ((rows[i - 1] as number[])[j - 1] as number) + substitution,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, ((rows[i - 2] as number[])[j - 2] as number) + 1);
      }
      (rows[i] as number[])[j] = best;
    }
  }
  return (rows[a.length] as number[])[b.length] as number;
}

/**
 * Field names that could plausibly be what an unrecognised key was reaching for.
 *
 * Substring in **both** directions, which is the shape a real one of these takes:
 * `wages` is inside `w2Wages`, and `socialSecurity` contains less than
 * `socialSecurityBenefits`. Case-insensitive, which also makes an exact
 * difference of case — `W2Wages` from a JSON caller — an exact hit.
 *
 * Ranked by **how much of the name the two share**, which for a containment match
 * is the length of the shorter of them, and that ordering is not cosmetic. Rank by
 * closeness of LENGTH instead and `wages` is answered with `age` — because `wages`
 * happens to contain it, and `|3 - 5|` ties with `|7 - 5|` — putting a coincidence
 * ahead of the field the caller actually wanted. Shared length breaks that tie the
 * right way round: five characters of `w2Wages` against three of `age`.
 *
 * Length difference and then alphabetical order settle what is left, so the
 * message a caller reads is deterministic.
 */
export function nearestFields(key: string, known: readonly string[]): readonly string[] {
  const lower = key.toLowerCase();
  const shared = (field: string): number => Math.min(field.length, key.length);
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
    .map((field) => ({ field, distance: editDistance(lower, field.toLowerCase()) }))
    .filter(({ distance }) => distance <= budget)
    .sort((a, b) => (a.distance !== b.distance ? a.distance - b.distance : a.field.localeCompare(b.field)))
    .map(({ field }) => field)
    .slice(0, SUGGESTION_LIMIT);
}

/** What the caller's object is, and what this package knows about it. */
export interface UnknownKeyOptions {
  /** The interface the object is supposed to satisfy, named in the message. */
  readonly interfaceName: string;
  /** Every field name that interface has. */
  readonly knownFields: readonly string[];
  /**
   * The name this package exports {@link knownFields} under, so a caller who got
   * no useful suggestion can read the list from the package rather than from a
   * message. A test asserts the named export exists.
   */
  readonly listExport: string;
}

/**
 * The sentence both the note and the error are built from.
 *
 * It says three things in order, and the middle one is the one that matters:
 * the key, **what happened to the figure**, and where it might have gone. A
 * message that only reports an unrecognised name leaves the reader to work out
 * whether it cost them anything.
 */
function describe(key: string, options: UnknownKeyOptions): string {
  const near = nearestFields(key, options.knownFields);
  const suggestion =
    near.length > 0
      ? `Did you mean ${near.map((field) => `\`${field}\``).join(' or ')}?`
      : `The ${options.knownFields.length} field names are exported as \`${options.listExport}\`.`;
  return (
    `\`${key}\` is not a field of ${options.interfaceName}. An unrecognised key is ` +
    `dropped, so every figure in the result is computed as if it had not been ` +
    `supplied. ${suggestion}`
  );
}

/**
 * Every unrecognised own key of `input`, in the order the caller wrote them.
 *
 * Own enumerable keys only, so nothing inherited from a prototype is reported.
 */
export function unknownInputKeys(
  input: object,
  knownFields: readonly string[],
): readonly string[] {
  const bag = input as Readonly<Record<string, unknown>>;
  return Object.keys(bag).filter((key) => !knownFields.includes(key) && bag[key] !== undefined);
}

/**
 * Notes for every unrecognised key — or a throw for the first of them.
 *
 * Returns an empty array for the overwhelmingly common case of an input with no
 * unrecognised keys, so a caller pays nothing for the check but the key walk.
 *
 * @throws {RangeError} when `strict` and any key is unrecognised.
 */
export function unknownInputNotes(
  input: object,
  options: UnknownKeyOptions,
  strict: boolean,
): readonly string[] {
  const unknown = unknownInputKeys(input, options.knownFields);
  if (unknown.length === 0) return [];
  if (strict) {
    throw new RangeError(
      `${describe(unknown[0] as string, options)} This is an error because ` +
        `\`strict: true\` was passed; the default reports it in \`notes\` instead.` +
        (unknown.length > 1
          ? ` ${unknown.length - 1} further unrecognised ${
              unknown.length === 2 ? 'key was' : 'keys were'
            } supplied: ${unknown
              .slice(1)
              .map((key) => `\`${key}\``)
              .join(', ')}.`
          : ''),
    );
  }
  return unknown.map((key) => `Ignored unknown input: ${describe(key, options)}`);
}

/**
 * A compile-time proof that a field list is exactly an interface's key set —
 * neither short nor long.
 *
 * Day 34's rule is that a hand-maintained list of field names drifts towards
 * being short, and this is that list exactly. Without the proof the list is a
 * second copy of the interface that goes stale the day a field is added, and the
 * drift is silent in the **worst** direction: a new field would be reported as
 * unknown by the very guard that exists to find unknown fields, so the engine
 * would tell a caller that a field it reads is a field it does not read.
 *
 * This makes that a build failure. `tsc` resolves `keyof I` from the interface
 * itself, which is why it is used here in place of the source parse four days of
 * worklists specified: a regular expression over `src/estimate.ts` has to be
 * right about the grammar, and the obvious one is not — `^  [a-zA-Z]+\??:` drops
 * every field name containing a DIGIT, which in `EstimateInput` is `w2Wages`,
 * `age65OrOlder` and `spouseAge65OrOlder`. A list built from that pattern would
 * have omitted the very field Day 37 got wrong, and would have reported
 * `w2Wages` itself as an unknown input.
 */
export type ExactlyKeys<Keys extends string, Listed extends string> = [Keys] extends [Listed]
  ? [Listed] extends [Keys]
    ? true
    : never
  : never;
