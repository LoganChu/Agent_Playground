/**
 * The CONDITION a shipped note states about an input field, against what the
 * engine actually does with that field.
 *
 * ```sh
 * node tools/note-conditions.mjs            # the full report
 * node tools/note-conditions.mjs --check    # compare to the ledger, non-zero on drift
 * node tools/note-conditions.mjs --write    # regenerate the ledger
 * ```
 *
 * ## The defect class this exists for, which had three instances and no instrument
 *
 * Day 80 closed three bugs of exactly one shape — **the shipped note was right
 * and the code did something else** — and recorded that every instrument in this
 * repository was blind to all three:
 *
 * ```text
 *   AZ  flat-states.ts  the note warned about the federal itemised passthrough
 *                       "since the state shipped"; the code passed it through
 *   VA  virginia.ts     "applies the compulsion when stateItemizedDeductions is
 *                       SUPPLIED"; the code tested the figure for being POSITIVE
 *                       -> $503.12 across one cent
 *   GA  flat-states.ts  the same sentence, the same test, $622.80 across one cent
 *                       — the largest such gap in the package
 * ```
 *
 * `notes.test.js` pins the first 72 characters of every note, so it sees a note
 * appear, vanish or move and nothing about what it says. `note-figures.mjs` and
 * `dynamic-note-figures.test.js` compare the FIGURES a note prints against the
 * engine. **A note saying "when the field is SUPPLIED" against code saying "when
 * it is POSITIVE" carries no figure to compare and no prefix to move**, so it is
 * invisible to all three, and it is worth $622.80 on one return.
 *
 * ## The one fact that makes this measurable without reading English
 *
 * "Supplied" and "positive" differ on exactly one input, and the engine will say
 * which it means if you ask it twice:
 *
 * ```text
 *   result(field absent) !== result(field: 0)    the engine distinguishes a
 *                                                supplied zero from an absence
 *                                                -> SUPPLIED semantics
 *   result(field absent) === result(field: 0)    it does not
 *                                                -> POSITIVE semantics
 * ```
 *
 * That is a binary, computed per (state, field) by running the return three
 * times, and it needs no parser, no type information and no table. A table is
 * what `unread-input.ts` refuses to keep for the same reason: *"a claim that is
 * recomputed on every call cannot go stale, because there is nowhere for it to
 * go stale in."*
 *
 * ## Why ZERO and not some other value, which is not a hypothetical here
 *
 * Zero is the value a caller passes **by accident**: an uninitialised
 * accumulator, a column nobody filled in, a spreadsheet blank. This repository's
 * own buyer-facing audit reads a blank cell as zero — `readMoney` in
 * `tools/audit/household.mjs` returns `0` for `''` — so the distance between
 * "the customer left the column empty" and "the customer told us the figure is
 * nothing" is one `if` in the engine, and on Virginia it was $503.12.
 *
 * ## The two halves, and the second one is what found today's defect
 *
 * **A — the claim.** Harvest every note the engine actually EMITS, per state,
 * and look for a sentence naming an input field next to a word from a small
 * vocabulary (`is supplied`, `is provided`, `is present` on one side; `is
 * positive`, `greater than zero`, `non-zero` on the other). Classify, measure,
 * compare, and report a disagreement as a defect.
 *
 * **Two of the three instances above are inside half A's reach and the third is
 * not.** Arizona's note warned about a FEDERAL TOTAL being passed through,
 * which is not a question about an optional field being supplied, so nothing
 * here can see it. An instrument validated against two known positives is
 * worth having; one whose author had not checked which of the three it covers
 * would be worth less.
 *
 * **Adjacency is required and it is the whole precision of this half.** The
 * phrase must sit within {@link WINDOW} characters of the field name. Iowa's
 * retirement note is why: it contains `retirementIncome` and, 190 characters
 * later in the same sentence, "unless the income is passed in the spouse's
 * name" — a condition about a DIFFERENT field. Without the window that is a
 * finding, and an invented finding in a report sold as a defect list is the
 * expensive kind of wrong. `classify.mjs` learned the same thing four times.
 *
 * **B — the inventory.** Every (state, field) pair where supplying zero differs
 * from omitting the field, with the largest gap found and the household that
 * locates it, committed to {@link LEDGER}. Each entry is DISCLOSED or it is
 * not, and there are two ways to be disclosed, which the ledger's `how` names:
 *
 * ```text
 *   differential  the return SAYS something about this field at zero that it
 *                 does not say when the field is absent (or the reverse) —
 *                 measured, not grepped, and it is what a caller staring at two
 *                 different answers actually has to go on
 *   standing      hand-written prose that states the rule on both sides, which
 *                 half A already harvests
 * ```
 *
 * An undisclosed step is one a caller cannot read about anywhere, and it is the
 * thing this half exists to count.
 *
 * Half B is the half with no English in it at all, and it is the half that found
 * Day 81's defect: New Mexico and Kentucky both accept a supplied modified gross
 * income BELOW the floor their own notes say the figure cannot go below, and
 * both pay a larger credit for it.
 *
 * ## What this tool can and cannot be wrong about
 *
 * It cannot invent a semantics: the absent-versus-zero measurement is the
 * engine's own answer, run twice. It CAN be wrong about a claim, in both
 * directions — a vocabulary this small misses conditions written in other words
 * (under-reporting), and a sentence can put a word near a field name without
 * conditioning on it (over-reporting, which the window is against). So a clean
 * half A proves little and a dirty one is worth reading, which is the same
 * direction `note-figures.mjs` is honest about.
 *
 * And **UNREACHED is a verdict, not a pass.** Where no household in the battery
 * makes the field move the state's tax, the measurement establishes nothing and
 * says so rather than reporting agreement. Day 79's itemised-deduction probe
 * reported six states as unmoved when its household could not reach the
 * provision at all: *"a null result from a harness that could not reach the
 * provision is not a null result about the law."*
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LEDGER = join(ROOT, 'tools', 'note-conditions.json');
const CHECK = process.argv.includes('--check');
const WRITE = process.argv.includes('--write');

const { stateIncomeTax, SUPPORTED_STATES, SUPPORTED_YEARS, KNOWN_STATE_INPUT_FIELDS } = await import(
  join(ROOT, 'packages', 'us-state-tax', 'dist', 'esm', 'index.js')
);

/** The four fields every return must carry; absence is not a case for them. */
const STRUCTURAL = new Set(['state', 'year', 'filingStatus', 'federal']);

/**
 * Fields whose "zero" is not a number, so the absent-versus-zero question does
 * not apply to them in the form this tool asks it.
 *
 * The object-valued ones (`retirement`, `federalDeductions`,
 * `federalOneDollarHigher`) and the string-valued ones (`locality`, `county`,
 * `city`, `workCity`, `schoolDistrict`) have no zero; `dependentAges` is an
 * array. Booleans DO have one — `false` — and are kept, because `separatedFromSpouse:
 * false` versus omitting it is the same question in a different type.
 */
const NON_SCALAR = new Set([
  'dependentAges',
  'retirement',
  'federalDeductions',
  'federalOneDollarHigher',
  'locality',
  'county',
  'city',
  'workCity',
  'schoolDistrict',
]);

const BOOLEAN = new Set([
  'separatedFromSpouse',
  'spouseHasNoGrossIncomeAndIsNotADependent',
  'spouseClaimsAgeDeduction',
  'bothSpousesHaveQualifyingIncome',
]);
const COUNT = new Set(['dependents', 'blindOrDisabled', 'dependentsAttendingCollege']);
const AGE = new Set(['filerAge', 'spouseAge']);
const RATE = new Set(['residentCreditRate', 'residentCreditLimitRate']);

/**
 * The fields probed, taken from the engine's own exported list rather than from
 * a copy here — so a field added to `StateIncomeTaxInput` is probed on the next
 * run without anybody remembering this file.
 */
export const PROBED_FIELDS = KNOWN_STATE_INPUT_FIELDS.filter(
  (f) => !STRUCTURAL.has(f) && !NON_SCALAR.has(f)
);

/** The value that stands for "the caller supplied nothing of this". */
function zeroValue(field) {
  return BOOLEAN.has(field) ? false : 0;
}

/** A value far enough from zero to move anything that reads the field. */
function probeValue(field) {
  if (BOOLEAN.has(field)) return true;
  if (COUNT.has(field)) return 2;
  if (AGE.has(field)) return 68;
  if (RATE.has(field)) return 0.05;
  return 5000;
}

function federal(agi, kind, year) {
  const deduction = kind === 'itemized' ? 14600 : year === 2026 ? 16100 : 15750;
  return {
    adjustedGrossIncome: agi,
    taxableIncome: Math.max(0, agi - deduction),
    deduction,
    deductionKind: kind,
    incomeTaxBeforeRefundableCredits: Math.round(agi * 0.08),
    earnedIncomeCredit: 0,
  };
}

/**
 * The households the probe walks.
 *
 * The list is short and each row is here for a reason a shorter list cannot
 * reach: an itemising federal return, because nine states gate their itemised
 * route on the federal election and Day 79's first probe reported six of them
 * unmoved for want of one; a retiree, because age- and pension-tested
 * provisions are reachable from no working-age shape; a low income with a
 * child, because a refundable credit floors `totalTax` at zero and hides every
 * step underneath it; and a high income, because a phase-out needs a household
 * past it.
 */
const SHAPES = [
  ['single-60k-std', (s, y) => ({ state: s, year: y, filingStatus: 'single', federal: federal(60000, 'standard', y), earnedIncome: 60000 })],
  ['single-60k-item', (s, y) => ({ state: s, year: y, filingStatus: 'single', federal: federal(60000, 'itemized', y), earnedIncome: 60000 })],
  ['joint-2kids-45k', (s, y) => ({ state: s, year: y, filingStatus: 'marriedFilingJointly', federal: federal(45000, 'standard', y), earnedIncome: 45000, dependents: 2, dependentAges: [5, 9] })],
  ['hoh-1kid-25k', (s, y) => ({ state: s, year: y, filingStatus: 'headOfHousehold', federal: federal(25000, 'standard', y), earnedIncome: 25000, dependents: 1, dependentAges: [7] })],
  ['retiree-single-40k', (s, y) => ({ state: s, year: y, filingStatus: 'single', federal: federal(40000, 'standard', y), filerAge: 70, retirementIncome: 20000, taxableSocialSecurity: 8000, earnedIncome: 0 })],
  ['single-200k-item', (s, y) => ({ state: s, year: y, filingStatus: 'single', federal: federal(200000, 'itemized', y), earnedIncome: 200000 })],
];

function answer(input) {
  try {
    const r = stateIncomeTax(input);
    // The notes AND the credit names, because the two are one channel. The
    // engine's established way of saying "this figure was assumed" is to
    // annotate the credit line rather than to add a note — "a credit line
    // reading $0.00 beside a refundable credit worth thousands is the one
    // place a caller will look for why" — so a half that read `notes` alone
    // would report a disclosed step as silent.
    return {
      tax: r.totalTax,
      notes: r.notes,
      says: [...r.notes, ...(r.credits ?? []).map((c) => c.name)],
      threw: false,
    };
  } catch (e) {
    return { tax: null, notes: [], says: [], threw: true, message: String(e?.message ?? e) };
  }
}

/** How close a condition phrase must sit to the field name to be about it. */
export const WINDOW = 48;

/**
 * The affirmative forms only, and the omission is the point.
 *
 * "X is supplied" asserts something about the branch a SUPPLIED value takes,
 * which is the branch a zero decides. "X is not supplied" or "X is omitted"
 * asserts something about the ABSENT branch, which both readings share — so a
 * negation is not evidence either way, and reading one as evidence is how the
 * first version of this file reported California disagreeing with a note that
 * agreed with it.
 *
 * `is passed` and `is given` were here and are deliberately gone. Iowa's
 * retirement note ends *"unless the income is passed in the spouse's name"* and
 * Kentucky's family size note contains *"this package is given dependents and
 * nothing finer"* — neither is a condition on the field the window attached it
 * to, and both were findings until the vocabulary stopped accepting a verb that
 * is this common in ordinary prose.
 */
export const SUPPLIED_PHRASES = [
  'is supplied',
  'are supplied',
  'when supplied',
  'if supplied',
  'where supplied',
  'is provided',
  'when provided',
  'is present',
  'is defined',
  'is specified',
];

export const POSITIVE_PHRASES = [
  'is positive',
  'being positive',
  'greater than zero',
  'above zero',
  'more than zero',
  'non-zero',
  'nonzero',
  'at least one cent',
];

/**
 * Notes the engine GENERATES about this return's own inputs, which half A must
 * not read as claims.
 *
 * `unread-input.ts` emits *"A figure was supplied and spent on nothing"* by
 * running the return again without the field, and the omission notes in
 * `engine.ts` say *"X was not supplied, so it was computed as zero"* from
 * inside the branch that computed it as zero. **A note emitted BY a code path
 * is not an independent claim ABOUT that code path**: it is generated from the
 * same `if`, so it cannot disagree with it, and comparing the two measures
 * nothing. Including them put 44 rows of noise in half A and one false
 * disagreement — the unread-input note explains itself with *"Ohio reads
 * `earnedIncome` only once `city` is supplied as well"*, and that sentence was
 * read as a claim about `earnedIncome` in all 42 states.
 *
 * What half A wants is the HAND-WRITTEN prose: the standing notes a state
 * ships, which were composed by a person reading a statute and are the only
 * notes that can be right while the code is wrong.
 */
const GENERATED_MARKERS = [
  // NOT `A figure was supplied and spent on nothing`, which is the singular
  // branch of that sentence: with two or more unread fields it reads "3 figures
  // WERE supplied", and the first version of this marker skipped the singular
  // note and read all 42 plural ones as claims. The invariant substring is the
  // part that does not inflect.
  'supplied and spent on nothing',
  ' not supplied, so ',
];

function isGenerated(note) {
  return GENERATED_MARKERS.some((m) => note.includes(m));
}

/**
 * Split a note into sentences without splitting a statute cite or a figure.
 *
 * The split needs whitespace after the stop, which is what keeps `§ 58.1-322.03`
 * and `$503.12` whole — neither has a space after its dot — and a capital, a
 * digit, a `§`, a backtick, a quote or a `$` after it, which is what keeps a
 * lower-case fragment from being promoted to a sentence. The digit is there
 * because these notes open sentences with years: *"2026 carries 2025 forward in
 * 23 provisionalFigures entries"* is a sentence and `2026` is how it starts.
 */
export function sentences(note) {
  return note.split(/(?<=[.!?])\s+(?=[A-Z0-9§`$"'(])/);
}

/**
 * Every condition a sentence states about a field, with the adjacency rule
 * applied.
 *
 * Exported so `note-conditions.test.mjs` can exercise it on sentences written
 * out by hand — including the Iowa sentence the window exists to reject, which
 * is the only way to find a classifier wrong in the direction that invents.
 */
export function claimsIn(sentence, fields) {
  const bare = sentence.replace(/`/g, '');
  const low = bare.toLowerCase();
  const out = [];
  for (const field of fields) {
    let from = 0;
    const hits = [];
    for (;;) {
      const at = bare.indexOf(field, from);
      if (at < 0) break;
      hits.push([at, at + field.length]);
      from = at + field.length;
    }
    if (!hits.length) continue;
    const near = (phrase) => {
      let from2 = 0;
      for (;;) {
        const at = low.indexOf(phrase, from2);
        if (at < 0) return false;
        for (const [start, end] of hits) {
          if (at >= end && at - end <= WINDOW) return true;
          if (at + phrase.length <= start && start - (at + phrase.length) <= WINDOW) return true;
        }
        from2 = at + 1;
      }
    };
    const supplied = SUPPLIED_PHRASES.filter(near);
    const positive = POSITIVE_PHRASES.filter(near);
    if (!supplied.length && !positive.length) continue;
    out.push({
      field,
      claim: supplied.length && positive.length ? 'both' : supplied.length ? 'supplied' : 'positive',
      phrases: [...supplied, ...positive],
      sentence: bare.trim(),
    });
  }
  return out;
}

/**
 * Run the battery.
 *
 * Returns the measured semantics per (state, field), the notes each state
 * emitted anywhere in the battery, and the largest absent-versus-zero gap found
 * with the household that locates it.
 */
function measure() {
  const semantics = new Map();
  const notesByState = new Map();
  for (const state of SUPPORTED_STATES) {
    notesByState.set(state, new Set());
    for (const year of SUPPORTED_YEARS) {
      for (const [shapeName, build] of SHAPES) {
        const base = build(state, year);
        for (const field of PROBED_FIELDS) {
          const bare = { ...base };
          Reflect.deleteProperty(bare, field);
          const absent = answer(bare);
          const zero = answer({ ...bare, [field]: zeroValue(field) });
          const probe = answer({ ...bare, [field]: probeValue(field) });
          for (const r of [absent, zero, probe]) for (const n of r.notes) notesByState.get(state).add(n);
          const key = `${state}.${field}`;
          const cur = semantics.get(key) ?? { read: false, supplied: false, differential: false, worst: null };
          // READ is measured on the TAX and not on the notes. The engine emits
          // an "accepted and spent on nothing" note for a field this state has
          // no use for (`unread-input.ts`), so a notes comparison calls every
          // field in every state read and the whole measurement collapses.
          if (absent.tax !== probe.tax || zero.tax !== probe.tax) cur.read = true;
          if (absent.threw !== probe.threw || zero.threw !== probe.threw) cur.read = true;
          if (absent.tax !== null && zero.tax !== null && absent.tax !== zero.tax) {
            cur.supplied = true;
            // A step is DIFFERENTIALLY disclosed when the return says something
            // about this field at zero that it does not say when the field is
            // absent, or the other way round — which is what a caller staring
            // at two different answers actually has to go on, and it is
            // measured rather than grepped. The other way to disclose a step is
            // STANDING prose that states the rule on both sides, which half A
            // already harvests; that arm is applied below, and `how` says which
            // one a given row rests on. Kentucky's and New Mexico's steps had
            // neither until Day 81.
            const differing = [
              ...absent.says.filter((s) => !zero.says.includes(s)),
              ...zero.says.filter((s) => !absent.says.includes(s)),
            ];
            if (differing.some((s) => s.includes(field))) cur.differential = true;
            const gap = Math.abs(absent.tax - zero.tax);
            if (!cur.worst || gap > cur.worst.gap) {
              cur.worst = { gap, year, shape: shapeName, absent: absent.tax, zero: zero.tax };
            }
          }
          semantics.set(key, cur);
        }
      }
    }
  }
  return { semantics, notesByState };
}

function round(n) {
  return Math.round(n * 100) / 100;
}

function build() {
  const { semantics, notesByState } = measure();

  // --- half A: the claims
  const claims = [];
  const seen = new Set();
  for (const [state, notes] of notesByState) {
    for (const note of notes) {
      if (isGenerated(note)) continue;
      for (const sentence of sentences(note)) {
        for (const c of claimsIn(sentence, PROBED_FIELDS)) {
          const key = `${state}.${c.field}.${c.claim}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const m = semantics.get(`${state}.${c.field}`) ?? {};
          const measured = !m.read ? 'unreached' : m.supplied ? 'supplied' : 'positive';
          claims.push({
            state,
            field: c.field,
            claim: c.claim,
            measured,
            verdict:
              c.claim === 'both' ? 'ambiguous' : measured === 'unreached' ? 'unreached' : measured === c.claim ? 'agrees' : 'DISAGREES',
            phrases: c.phrases,
            sentence: c.sentence.length > 240 ? `${c.sentence.slice(0, 237)}...` : c.sentence,
          });
        }
      }
    }
  }
  claims.sort((a, b) => a.state.localeCompare(b.state) || a.field.localeCompare(b.field));

  // --- half B: the inventory
  const standing = new Set(
    claims
      .filter((c) => c.claim === 'supplied' || c.claim === 'both')
      .map((c) => `${c.state}.${c.field}`)
  );
  const sentinels = [];
  for (const [key, m] of semantics) {
    if (!m.supplied || !m.worst) continue;
    const [state, field] = key.split('.');
    sentinels.push({
      state,
      field,
      gap: round(m.worst.gap),
      absent: round(m.worst.absent),
      zero: round(m.worst.zero),
      year: m.worst.year,
      shape: m.worst.shape,
      disclosed: m.differential === true || standing.has(key),
      how: m.differential === true ? 'differential' : standing.has(key) ? 'standing' : 'none',
    });
  }
  sentinels.sort((a, b) => b.gap - a.gap || a.state.localeCompare(b.state));

  return {
    states: SUPPORTED_STATES.length,
    years: [...SUPPORTED_YEARS],
    shapes: SHAPES.map(([n]) => n),
    fields: PROBED_FIELDS.length,
    returnsRun: SUPPORTED_STATES.length * SUPPORTED_YEARS.length * SHAPES.length * PROBED_FIELDS.length * 3,
    claims,
    sentinels,
  };
}

function main() {
const report = build();
const disagreements = report.claims.filter((c) => c.verdict === 'DISAGREES');
const undisclosed = report.sentinels.filter((s) => !s.disclosed);

if (WRITE) {
  writeFileSync(LEDGER, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`wrote ${LEDGER}`);
}

if (!CHECK) {
  console.log(
    `${report.returnsRun.toLocaleString()} returns: ${report.states} states x ${report.years.length} years x ${report.shapes.length} households x ${report.fields} fields x 3\n`
  );
  console.log(`A. CONDITIONS A NOTE STATES ABOUT A FIELD  (${report.claims.length})\n`);
  for (const c of report.claims) {
    console.log(
      `  ${c.verdict.padEnd(10)} ${c.state} ${c.field.padEnd(32)} note says ${c.claim.padEnd(9)} engine does ${c.measured}`
    );
    if (c.verdict === 'DISAGREES') console.log(`             ${c.sentence}`);
  }
  console.log(`\nB. SUPPLYING ZERO IS NOT OMITTING  (${report.sentinels.length} pairs)\n`);
  for (const s of report.sentinels) {
    console.log(
      `  ${(s.disclosed ? `disclosed/${s.how}` : 'UNDISCLOSED').padEnd(24)} ${s.state} ${s.field.padEnd(32)} ` +
        `$${s.gap.toFixed(2).padStart(10)}   absent $${s.absent.toFixed(2)} -> zero $${s.zero.toFixed(2)}   ${s.year} ${s.shape}`
    );
  }
  console.log('');
}

if (CHECK) {
  let ledger;
  try {
    ledger = JSON.parse(readFileSync(LEDGER, 'utf8'));
  } catch {
    console.log('RED — no ledger. Run with --write.');
    process.exit(1);
  }
  const problems = [];
  if (disagreements.length) {
    for (const c of disagreements) {
      problems.push(`${c.state}.${c.field}: the note says ${c.claim}, the engine does ${c.measured}`);
    }
  }
  // The ledger is compared on the pairs and their disclosure, not on the
  // amounts: a gap that MOVES is a tax change and has its own tests, and a gap
  // that APPEARS is a new place where a blank column is not an absent field.
  const key = (s) => `${s.state}.${s.field}`;
  const was = new Map((ledger.sentinels ?? []).map((s) => [key(s), s]));
  const now = new Map(report.sentinels.map((s) => [key(s), s]));
  for (const [k, s] of now) {
    if (!was.has(k)) problems.push(`new zero-versus-absent step, undeclared: ${k} ($${s.gap.toFixed(2)}, ${s.year} ${s.shape})`);
    else if (was.get(k).disclosed && !s.disclosed) problems.push(`${k} lost the note that disclosed its zero-versus-absent step`);
  }
  for (const k of was.keys())
    if (!now.has(k))
      problems.push(`a zero-versus-absent step the ledger records is gone: ${k} — rerun with --write if that was the point`);
  // The claims ratchet both ways. A claim APPEARING is a new sentence this tool
  // has never weighed, and a claim VANISHING is a note that has stopped stating
  // the condition the engine is still implementing — which is the same defect
  // class read from the other end. Neither is an error; both need somebody to
  // look, which is what `--write` is for.
  const wasClaims = new Set((ledger.claims ?? []).map((c) => `${c.state}.${c.field}.${c.claim}`));
  const nowClaims = new Set(report.claims.map((c) => `${c.state}.${c.field}.${c.claim}`));
  for (const k of nowClaims) {
    if (!wasClaims.has(k)) problems.push(`a note states a condition the ledger has not recorded: ${k} — read it, then rerun with --write`);
  }
  for (const k of wasClaims) {
    if (!nowClaims.has(k)) problems.push(`a note has STOPPED stating a condition the ledger records: ${k} — check the engine still agrees, then rerun with --write`);
  }
  if (problems.length) {
    console.log(`RED — ${problems.length} problem(s)`);
    for (const p of problems) console.log(`  ${p}`);
    process.exit(1);
  }
  console.log(
    `ok — ${report.claims.length} note conditions agree with the engine, ${report.sentinels.length} zero-versus-absent steps ledgered (${undisclosed.length} undisclosed), over ${report.returnsRun.toLocaleString()} returns`
  );
}
}

/**
 * Only when RUN, never when imported.
 *
 * `tools/cliffs/classify.mjs` exists as a separate file for exactly this
 * reason, recorded on Day 78: the classifier *"was inside `find-cliffs.mjs`,
 * which runs a sweep on import, so nothing could test it"*. The lesson is the
 * guard, not the second file — and the first version of this tool ran all
 * 66,528 returns, and printed its report, every time
 * `note-conditions.test.mjs` imported it to check a sentence.
 */
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
