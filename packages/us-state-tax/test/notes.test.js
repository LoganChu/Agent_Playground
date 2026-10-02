// The notes, pinned — the one output this package sells and the only one that had
// nothing asserting it.
//
// ## Why this file exists
//
// Day 34's mutation audit left 26 numbers the package could ship wrong with no test
// noticing. Five of them were not tax at all. They were the year selector on a
// `notes:` array:
//
//   ohio.js 258, maryland.js 310, flat-states.js 205 and 670, new-jersey.js 229
//   notes: year >= 2026 ? [...NOTES_2026, ...NOTES] : NOTES
//
// **Nothing in this package pinned which notes a state-year emits**, so a 2026-only
// note appearing in 2025 — or vanishing from 2026 — failed no test. Colorado's
// "PROVISIONAL BY LAW" warning could have started appearing on a 2025 return that
// is published and settled, and the suite would have been green.
//
// That is worth more than five survivors, because of what the notes are FOR.
// `STRATEGY.md` has a heading of its own for it — "Saying what is not known, as a
// product feature" — and the argument is that a provisional figure's explanation
// belongs in the RESULT OBJECT, where a language model actually encounters it,
// rather than in a README nobody passes to the model. Every figure in that object
// is now pinned several ways over. The prose beside it, which is the part this
// package claims as its differentiator, had nothing behind it at all.
//
// **THE RULE: a suite that watches numbers cannot see the thing you sell if the
// thing you sell is not a number.** The status sweep's digest is four figures per
// household and a note is not a figure, so the more thoroughly the numbers got
// pinned, the more conspicuous it became that the differentiator was unguarded.
//
// ## What is pinned, and what is deliberately not
//
// The first 72 characters of every note, in order, per state-year — not the whole
// note. The notes are edited often, because saying a gap clearly is the feature,
// and a fixture that churned on every clause would stop being read before it was
// regenerated. What the prefix catches is a note APPEARING, VANISHING, MOVING or
// SWAPPING YEARS, which is the whole of what a year selector gets wrong.
//
// The second test is the direct assertion the year branches actually need. Day 34's
// rule: a household battery catches a MONEY mutation, because a doubled parameter
// leaves a 100%-wide window for a probe to sit in, and it cannot catch a YEAR
// mutation, because a year selector swaps one value for another and the two can be
// arbitrarily close — or, as here, not numbers at all. **Where two branches are
// nearly equal the right instrument is a direct assertion on each branch**, and for
// the notes that means naming, in a table a reader can check against the statutes,
// exactly which notes 2026 has that 2025 does not.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FILING_STATUSES,
  SUPPORTED_STATES,
  SUPPORTED_YEARS,
  getStateDefinition,
} from './strict.mjs';
import { notePrefix } from './note-prefix.mjs';
import { HOUSEHOLDS, household } from './status-households.mjs';

const PINS = JSON.parse(readFileSync(new URL('./note-pins.json', import.meta.url), 'utf8'));

const notesOf = (def) => [
  ...(def.notes ?? []).map((text, i) => ({ kind: 'def', i, text })),
  ...(def.conditionalNotes ?? []).map((note, i) => ({ kind: 'cond', i, text: note.text })),
];

test('every state-year still emits the notes it emitted, in order', () => {
  assert.ok(PINS.rows.length > 400, 'the fixture is present and not truncated');
  const shipped = new Map();
  for (const year of SUPPORTED_YEARS) {
    for (const state of SUPPORTED_STATES) {
      for (const { kind, i, text } of notesOf(getStateDefinition(state, year))) {
        shipped.set(`${year}|${state}|${kind}|${i}`, notePrefix(text));
      }
    }
  }
  const pinned = new Set();
  for (const row of PINS.rows) {
    const key = row.split('|').slice(0, 4).join('|');
    const prefix = row.slice(key.length + 1);
    pinned.add(key);
    assert.ok(shipped.has(key), `${key} is pinned and no longer emitted — regenerate the fixture`);
    assert.equal(shipped.get(key), prefix, `${key} changed:\n  was  ${prefix}\n  now  ${shipped.get(key)}`);
  }
  for (const key of shipped.keys()) {
    assert.ok(pinned.has(key), `${key} is emitted and not pinned — regenerate the fixture`);
  }
});

/**
 * The notes that exist in one supported year and not the other, by state.
 *
 * Written by hand and checked against the definitions, rather than generated —
 * this is the direct per-branch assertion that Day 34 concluded a year selector
 * needs, and a generated version of it would be the year selector describing
 * itself.
 *
 * Every entry is a statement about the LAW that a reader can check:
 *
 *   CA  the 2026 figures are indexed and the FTB has not published them
 *   CO  both 2026 figures are fixed after the year ends, by law and not by neglect
 *   GA  HB 463's $1,750 exclusion is new for 2026 and gone after 2028, and the
 *       same bill set the 2026 rate at 4.99%
 *   ID  the 2026 zero bracket is the 2025 figure carried forward
 *   MD  the 2026 standard deduction is confirmed at $3,350 / $6,700
 *   MI  the 2026 special exemption for a blind or disabled filer is carried
 *   NJ  the child credit is 25% higher for 2026 through 2028
 *   OH  the 2026 exemption chart is carried; the $26,050 zero band is NOT
 *   UT  six 2026 figures are carried
 *
 * Nothing is removed in either direction. That is itself the claim worth pinning:
 * a note that stops applying is rewritten rather than deleted, because a caller
 * reading a 2025 return is entitled to the same warnings the 2026 one carries.
 */
const YEAR_ONLY_NOTES = {
  CA: { 2026: 2, 2025: 0 },
  CO: { 2026: 3, 2025: 0 },
  GA: { 2026: 2, 2025: 0 },
  ID: { 2026: 1, 2025: 0 },
  MD: { 2026: 1, 2025: 0 },
  MI: { 2026: 1, 2025: 0 },
  NJ: { 2026: 1, 2025: 0 },
  OH: { 2026: 2, 2025: 0 },
  UT: { 2026: 1, 2025: 0 },
};

test('the notes that differ between 2025 and 2026 are exactly the ones named here', () => {
  for (const state of SUPPORTED_STATES) {
    const prefixes = (year) => notesOf(getStateDefinition(state, year)).map((n) => notePrefix(n.text));
    const a = prefixes(2025);
    const b = prefixes(2026);
    const only2026 = b.filter((x) => !a.includes(x)).length;
    const only2025 = a.filter((x) => !b.includes(x)).length;
    const expected = YEAR_ONLY_NOTES[state] ?? { 2026: 0, 2025: 0 };
    assert.equal(
      only2026,
      expected[2026],
      `${state}: ${only2026} notes are in 2026 and not 2025, and the table says ${expected[2026]}`,
    );
    assert.equal(
      only2025,
      expected[2025],
      `${state}: ${only2025} notes are in 2025 and not 2026, and the table says ${expected[2025]}`,
    );
  }
  // And the table cannot quietly grow a state that has no year-specific notes,
  // which would make every assertion above pass for the wrong reason.
  for (const state of Object.keys(YEAR_ONLY_NOTES)) {
    assert.ok(SUPPORTED_STATES.includes(state), `${state} is in the table and is not a supported state`);
  }
  assert.equal(Object.keys(YEAR_ONLY_NOTES).length, 9, 'states whose notes depend on the year');
});

test('a provisional state-year says so in a note, and a published one does not', () => {
  // The invariant behind half the year-specific notes, and the one a caller's model
  // reads: `status: 'provisional'` is a field, and the sentence explaining WHICH
  // figure is provisional and what would settle it is the note. A state-year that
  // carried the flag and not the sentence would be technically honest and useless.
  let provisional = 0;
  for (const year of SUPPORTED_YEARS) {
    for (const state of SUPPORTED_STATES) {
      const def = getStateDefinition(state, year);
      const says = notesOf(def).some((n) => /^PROVISIONAL/.test(n.text.trim()));
      if (def.status === 'provisional') {
        provisional++;
        assert.ok(says, `${state} ${year} is provisional and no note begins PROVISIONAL`);
      } else {
        assert.equal(says, false, `${state} ${year} is ${def.status} and a note begins PROVISIONAL`);
      }
    }
  }
  assert.ok(provisional > 0, 'the assertion is not vacuous');
});

test('no note is empty, duplicated within its state-year, or unable to survive the fixture', () => {
  // Shortness is fine and is not checked: Nevada's "Nevada has no individual
  // income tax." is the whole note and the whole prefix. What is checked is that
  // two notes in one state-year cannot share a prefix, because then the fixture
  // could not tell them apart and a swap between them would pass.
  for (const year of SUPPORTED_YEARS) {
    for (const state of SUPPORTED_STATES) {
      const seen = new Set();
      for (const { kind, i, text } of notesOf(getStateDefinition(state, year))) {
        const where = `${state} ${year} ${kind}[${i}]`;
        assert.ok(text.trim().length > 0, `${where} is empty`);
        // The fixture is one row per line, delimited by `|`, so a note containing
        // one would split into a row the test could not read back. Checked here
        // rather than in the regenerator because the regenerator is run by hand and
        // this is run on every push.
        assert.ok(!text.includes('|'), `${where} contains a | and would break the fixture`);
        const prefix = notePrefix(text);
        assert.ok(!seen.has(prefix), `${where} repeats a note already emitted: ${prefix}`);
        seen.add(prefix);
      }
    }
  }
});

test('every conditional note fires for some return and not for others', () => {
  // A `conditionalNote` is a predicate, and a predicate nothing satisfies is a
  // sentence no caller will ever read. Day 34's rule about dead parameters — a
  // value nothing reads is not harmless, it is unconstrained — applies to prose in
  // exactly the same way, and worse: a note is written once, read by nobody, and
  // goes on describing a version of the rule that has moved.
  //
  // The two halves are both needed and they fail differently. A note that never
  // fires is dead. A note that ALWAYS fires is `notes` with extra steps, and the
  // engine's own docstring says why that is wrong: every note costs the caller
  // context on every call, so `conditionalNotes` is the opt-in for the ones that
  // are not always true.
  //
  // The battery is the status sweep's, unchanged, because it already exists and is
  // already argued for. A note that needs a household outside it is a note whose
  // condition is narrower than every shape in this package, which is worth being
  // told about.
  const inputs = [];
  for (const filingStatus of FILING_STATUSES) {
    for (const name of HOUSEHOLDS) inputs.push({ filingStatus, name });
  }
  let checked = 0;
  for (const year of SUPPORTED_YEARS) {
    for (const state of SUPPORTED_STATES) {
      const def = getStateDefinition(state, year);
      for (const [i, note] of (def.conditionalNotes ?? []).entries()) {
        const fired = inputs.filter(({ filingStatus, name }) =>
          note.relevantWhen(household(name, state, year, filingStatus)),
        ).length;
        const where = `${state} ${year} conditionalNotes[${i}]: ${notePrefix(note.text)}`;
        assert.ok(fired > 0, `${where} fires for no household in the battery — it is a note nobody can read`);
        assert.ok(
          fired < inputs.length,
          `${where} fires for every household in the battery — if it is always true it belongs in \`notes\`, which costs the caller nothing extra to decide`,
        );
        checked++;
      }
    }
  }
  assert.equal(checked, 16, 'conditional notes in the package');
});
