/**
 * Report an input field this return ACCEPTED, READ AND SPENT ON NOTHING.
 *
 * ## The gap this closes, and it is the larger half of Day 37's
 *
 * `src/unknown-input.ts` catches the key this package does not have: `wages` for
 * `w2Wages`, dropped silently, every figure computed as if it had not been
 * supplied. This file catches the opposite and commoner case — **a key the
 * package really has, spelt correctly, which the state the caller named has no
 * use for.** Send `pennsylvaniaTaxableIncome` to Texas and it is accepted,
 * dropped and, until today, unmentioned. There is no typo to find and no symptom
 * to notice: the answer is complete, confident and computed as though the figure
 * the caller went and looked up had never arrived.
 *
 * Day 56 measured the size of it. `us-tax-mcp` advertises 47 state-specific
 * fields and exactly FOUR had an engine note for being ignored; the other 43
 * vanish in silence in every state whose law has no use for them.
 *
 * ## Why this is MEASURED and not looked up, which is the whole design
 *
 * The obvious implementation is a table: for each field, the states that read it.
 * `us-tax-mcp`'s gate is exactly that table, derived from `DERIVATION_PATHS` over
 * the definitions — and **Day 53 found seven of those lists wrong, each refusing
 * a field that moves a state's tax**, up to `$1,856.25` on one Arizona return. A
 * second hand-written table, in the engine this time, is that bug with a
 * different owner.
 *
 * So nothing is written down. The engine answers the question by **running the
 * return again without the field** and comparing what came back. A claim that is
 * recomputed on every call cannot go stale, because there is nowhere for it to go
 * stale in.
 *
 * ## What the note may and may not say, which cost the day's best finding
 *
 * The first design said *"nothing in this state-year reads this field"*, and
 * established it with a LADDER: probe the field across a spread of values, and if
 * no value anywhere moves a figure, nothing reads it. The argument is
 * `test/status-households.mjs`'s own — a threshold is only caught by a probe on
 * the far side of it — and over the 35 states the package held at the time, across
 * two years, the ladder reported
 * **2,736 of 3,500 (state, year, field) triples dead**, with SEVENTEEN fields
 * dead in every single state-year.
 *
 * `earnedIncome` was one of the seventeen. It is read by Ohio: a municipality
 * taxes qualifying wages and a `$60,000` earner in Columbus owes `$1,499.97` that
 * a `$1` earner does not. The ladder could not see it because **Ohio reads
 * `earnedIncome` only once `city` is also supplied**, and a ladder that varies
 * one field at a time holds every other field at absent.
 *
 * > **THE RULE: A PROBE THAT VARIES ONE FIELD CANNOT SEE A RULE THAT READS TWO,
 * > AND IT FAILS BY REPORTING THE FIELD DEAD** — which is the flattering
 * > direction, because a field reported dead is a field the caller stops
 * > supplying.
 *
 * A pairwise probe was then written to measure how wrong that was, and the first
 * version of it reproduced the same blindness: it discarded the pair whose
 * partner THREW without the field, which is the strongest possible form of being
 * read, and that is exactly how Ohio reads `earnedIncome` — `city` refuses to run
 * without it. With the throw counted, **8 of the 17 fields the one-field ladder
 * called dead everywhere are live**, and the four extra dimensions found in one
 * afternoon (a second field, a filing status, a lower income, a throw) each
 * revealed more.
 *
 * > **A PROBE CAN ESTABLISH THAT A FIELD DID NOTHING HERE. IT CANNOT ESTABLISH
 * > THAT NOTHING READS IT.** The negative is over every household, every status
 * > and every combination, and each dimension a probe gains converts more of its
 * > own "dead" verdicts into "live".
 *
 * So the note makes the narrow claim and says why it is narrow. It is a statement
 * about THIS return, it is exactly true, and it is the fact the caller cannot get
 * any other way: the figure they went and looked up did not move the answer.
 *
 * ## Why the comparison includes the NOTES
 *
 * It costs a second pass and it is not optional. Send a Pennsylvania separate
 * return with no `pennsylvaniaSpouseEligibilityIncome` and `separatedFromSpouse`
 * moves NO figure: `forgivenessClaimants` gives one claimant on their own income
 * either way, because the engine's default is already the Unmarried oval of
 * line 19a and already the safe direction. **On that return the field's entire
 * observable effect is to switch off the warning that the default was an
 * assumption** — so a comparison over figures alone reports it as having done
 * nothing, which is false: it did the only thing it does there.
 *
 * ### And the first draft of the paragraph above said "on ANY Pennsylvania return"
 *
 * It is wrong, and it was wrong for the reason this whole file is about. Supply
 * `pennsylvaniaSpouseEligibilityIncome: 0` — a real answer, and the answer for a
 * spouse with no income — and `separatedFromSpouse: true` moves the tax from
 * `$0.00` to **`$1,842.00`** on a `$12,000` eligibility income: two claimants
 * with a `$13,000` allowance forgive the whole bill, one claimant with `$6,500`
 * steps the forgiveness down to nothing. 72 Pa. Stat. § 7304.
 *
 * `us-tax-mcp`'s `state-field-witnesses.test.js` had the pair listed with that
 * exact partner, written on Day 53, and I established the claim from a probe that
 * varied one field and stated it over every return.
 *
 * > **THE RULE, CAUGHT ON ITS OWN AUTHOR WITHIN THE HOUR: A CLAIM FROM A
 * > ONE-FIELD PROBE IS A CLAIM ABOUT THAT HOUSEHOLD, AND WRITING IT DOWN WIDER
 * > THAN THE EVIDENCE IS THE SAME DEFECT AS THE LADDER'S, IN PROSE INSTEAD OF
 * > IN CODE.** The design conclusion is untouched — the comparison must include
 * > the notes, because on the return with no spouse figure the note is the only
 * > thing the field moves. Only the breadth of the sentence was wrong.
 *
 * ## One deliberate silence, which is Day 53's own rule mirrored
 *
 * A trivial value is not reported. `us-tax-mcp`'s `declaredBy` records that **a
 * declared `0` or `false` is the state answering no, not asking the question**;
 * the mirror of it here is that a caller's `0`, `false`, `''` or empty collection
 * is the CALLER answering no, and there is no figure to have lost. Reporting
 * those would fire on every well-formed call that answers a question in the
 * negative, and Day 37's rule is that **a warning label is a scarce resource and
 * spending it on something that is fine is how the label stops being read.**
 *
 * For the same reason the finding is ONE note however many fields it names. The
 * label is spent once per return.
 *
 * This module imports only the field list, so it stays a near-leaf of the graph.
 */

/**
 * The four fields no probe may remove, because a return without them is not a
 * return.
 *
 * `state` and `year` select the law; `filingStatus` selects the column of every
 * table in it; `federal` is the basis the whole computation starts from. Removing
 * any of them does not ask "was this read" — it asks a question with no answer,
 * and `getStateDefinition` and `conformityAmount` would throw for reasons that
 * have nothing to do with whether the caller's figure was spent.
 */
export const STRUCTURAL_STATE_INPUT_FIELDS = ['state', 'year', 'filingStatus', 'federal'] as const;

/**
 * Whether a supplied value carries a figure that could have been lost.
 *
 * `0`, `false`, `''` and an empty collection are the caller answering no. An
 * object with keys is not: `{ filer: { employerPlanPension: 0 } }` is a shape the
 * caller built deliberately, and whether the engine read it is a real question.
 */
function carriesAFigure(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (value === 0 || value === false || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as object).length > 0;
  return true;
}

/**
 * Every field of `input` worth asking the question about, in the order the caller
 * wrote them.
 *
 * Own enumerable keys only. An unrecognised key is left to
 * {@link unknownInputNotes}, which has a better answer for it than this does.
 */
export function probableInputFields(
  input: object,
  knownFields: readonly string[],
): readonly string[] {
  const bag = input as Readonly<Record<string, unknown>>;
  return Object.keys(bag).filter(
    (key) =>
      knownFields.includes(key) &&
      !(STRUCTURAL_STATE_INPUT_FIELDS as readonly string[]).includes(key) &&
      carriesAFigure(bag[key]),
  );
}

/** An `input` with one field removed, for the probe to run. */
export function withoutField<T extends object>(input: T, field: string): T {
  const copy: Record<string, unknown> = { ...(input as Record<string, unknown>) };
  delete copy[field];
  return copy as T;
}

/**
 * The one note, or none.
 *
 * `spent` is the fields whose removal changed something, and is not reported: a
 * field that was read needs no sentence. `stateName` names the state rather than
 * the code, because the note is prose a model repeats.
 */
export function unreadInputNote(
  unread: readonly string[],
  stateName: string,
  year: number,
): readonly string[] {
  if (unread.length === 0) return [];
  const list = unread.map((field) => `\`${field}\``).join(', ');
  const them = unread.length === 1 ? 'it' : 'them';
  return [
    `${unread.length === 1 ? 'A figure was' : `${unread.length} figures were`} supplied and ` +
      `spent on nothing: ${list}. Every figure in this result — and every other note in it — is ` +
      `identical to the one this return would have had without ${them}. That is MEASURED rather ` +
      `than looked up: the ${year} ${stateName} return was computed again without each field and ` +
      `the answers compared. It does NOT mean ${stateName} has no rule that reads the field, ` +
      `because a rule can need two fields together and the other one may be the one that is ` +
      `missing — Ohio reads \`earnedIncome\` only once \`city\` is supplied as well. It means ` +
      `nothing on THIS return moved, so a caller who went and looked the ` +
      `${unread.length === 1 ? 'figure' : 'figures'} up bought no change in the answer by it.`,
  ];
}
