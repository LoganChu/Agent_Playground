#!/usr/bin/env node
/**
 * WHAT EACH REFUSED STATE'S NEXT TAX YEAR IS ACTUALLY WAITING FOR.
 *
 *   node tools/next-year-blockers.mjs            the decomposition
 *   node tools/next-year-blockers.mjs --check    the arithmetic closes, and
 *                                                OFFER.md's figures are these
 *
 * ## Why this is a tool and not a paragraph
 *
 * `OFFER.md` has carried a decomposition of the refused states since Day 86. It
 * said: *"20 states waiting on a department, 8 waiting on a document this
 * sandbox cannot reach, and 2 waiting on a revenue determination. 20 + 8 + 2 =
 * 30, with no state in two groups"* — in a paragraph whose own journal entry
 * boasts that an earlier draft *"said twenty-two and did not add up, which is
 * the reason every other count here is derived."*
 *
 * **It was not derived, and both of its claims were wrong.**
 *
 *   - The count was wrong. KY, MD and VA read the **HHS poverty guidelines**, a
 *     federal publication, and sat in the "waiting on a department" bucket —
 *     which named the wrong department, in the wrong government.
 *   - The partition claim was never true. **Eight** states are in two groups,
 *     and four of them (GA, MO, NC, OR) were already so before today.
 *
 * A partition is a stronger statement than a tally, and that one was decoration.
 *
 * ## And the first recount repeated the error it was fixing
 *
 * My own first re-derivation counted every provenance record with
 * `constant: false` as *"waiting on a department"*. That lumps two kinds with
 * **opposite remedies**:
 *
 * ```text
 *   kind: 'indexed'            somebody must PUBLISH a number
 *   kind: 'statute-scheduled'  the number is already WRITTEN IN LAW
 * ```
 *
 * Five states — CT GA NC NJ NY — have only the second, so their next year is a
 * reading of statute and no publication gates it. Lumping them in overstated the
 * department group by five and hid the largest unworked seam in the product.
 *
 * > **THE RULE: A FIGURE THAT MOVES AND A FIGURE THAT WAITS ARE NOT THE SAME
 * > FIGURE.** `constant: false` means *not a constant*, which is a statement
 * > about indexation and not about whether anybody still has to publish it.
 *
 * ## What it reads
 *
 * Four signals, because no one of them sees everything — which is the lesson of
 * `external-basis-years.mjs` applied to its own conclusion:
 *
 *   1. `federalDependency()` — the IRS group, from the definition's shape.
 *   2. The provenance ledger's `document` — the HHS group, by name of publisher.
 *   3. `kind` among the moving records — indexed (a publication) against
 *      statute-scheduled (a reading).
 *   4. `provisionalFigures[].reason === 'awaiting-publication'` — the states
 *      that record their waiting there instead, which is how CALIFORNIA does
 *      it. A ledger-only screen puts California in "nothing moves", which is
 *      false: it carries 76 provisional figures awaiting the FTB.
 */
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { federalDependency } from './cross-package/federal-basis-years.mjs';
import { EXTERNAL_PUBLICATIONS } from './cross-package/external-basis-years.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Moving-figure kinds that mean somebody still has to publish a number. */
export const NEEDS_PUBLICATION = new Set([
  'indexed',
  'agency',
  'determined-after-year-end',
  'carried-forward',
  'derived-bounded',
]);

/** States whose next year turns on a revenue determination nobody has made. */
export const AWAITING_DETERMINATION = ['GA', 'NC'];

export const IRS = 'IRS';
export const HHS = 'HHS';
export const DETERMINATION = 'revenue determination';
export const OWN_DEPARTMENT = 'own department';
export const OWN_STATUTE = 'own statute';

/**
 * The decomposition, as a pure function so the test can drive it with fixtures.
 *
 * Returns `{ rows, groups, overlaps, closes }`. `closes` is the arithmetic:
 * the group sizes summed, minus the states counted twice, must equal the number
 * of refused states — and it is only valid if no state is in three groups,
 * which is asserted rather than assumed.
 */
export function decomposeBlockers({ refused, getDef, lastYearFor, provenance, externalDocuments }) {
  const external = new Map();
  for (const publication of externalDocuments) {
    for (const row of provenance.filter((r) => r.document === publication.document)) {
      if (!external.has(row.state)) external.set(row.state, new Set());
      external.get(row.state).add(publication.document);
    }
  }

  const rows = [];
  for (const state of refused) {
    const def = getDef(state, lastYearFor(state));
    const waits = [];
    if (federalDependency(def) !== null) waits.push(IRS);
    if (external.has(state)) waits.push(HHS);
    if (AWAITING_DETERMINATION.includes(state)) waits.push(DETERMINATION);

    const records = provenance.filter((r) => r.state === state && r.constant === false);
    const isExternal = (r) => externalDocuments.some((p) => p.document === r.document);
    const publication = records.filter((r) => NEEDS_PUBLICATION.has(r.kind) && !isExternal(r)).length;
    const scheduled = records.filter((r) => r.kind === 'statute-scheduled').length;
    const awaiting = (def.provisionalFigures ?? []).filter((f) => f.reason === 'awaiting-publication').length;

    if (publication > 0 || awaiting > 0) waits.push(OWN_DEPARTMENT);
    else if (scheduled > 0) waits.push(OWN_STATUTE);

    rows.push({ state, waits, publication, scheduled, awaiting });
  }

  const names = [IRS, HHS, DETERMINATION, OWN_DEPARTMENT, OWN_STATUTE];
  const groups = Object.fromEntries(names.map((n) => [n, rows.filter((r) => r.waits.includes(n)).map((r) => r.state)]));
  const nothingMoves = rows.filter((r) => r.waits.length === 0).map((r) => r.state);
  const overlaps = rows.filter((r) => r.waits.length > 1);
  const threeOrMore = rows.filter((r) => r.waits.length > 2);

  const dependencies = names.reduce((sum, n) => sum + groups[n].length, 0) + nothingMoves.length;
  // Only exact while every overlapping state is in EXACTLY two groups.
  const closes = threeOrMore.length === 0 && dependencies - overlaps.length === refused.length;

  return {
    rows,
    groups,
    nothingMoves,
    overlaps,
    threeOrMore,
    dependencies,
    closes,
    noPublicationNeeded: rows
      .filter((r) => r.waits.length === 0 || (r.waits.length === 1 && r.waits[0] === OWN_STATUTE))
      .map((r) => r.state),
  };
}

async function main() {
  const check = process.argv.includes('--check');
  const state = await import(join(ROOT, 'packages/us-state-tax/dist/esm/index.js')).catch((err) => {
    console.error(`cannot import us-state-tax: ${err.message}`);
    console.error('  (cd packages/us-state-tax && npm install && npm run build)');
    process.exit(1);
  });

  const year = state.SUPPORTED_YEARS.at(-1);
  const serving = new Set(state.statesForYear(year));
  const refused = state.SUPPORTED_STATES.filter((s) => !serving.has(s));

  const result = decomposeBlockers({
    refused,
    getDef: (s, y) => state.getStateDefinition(s, y),
    lastYearFor: (s) => state.supportedYears(s).at(-1),
    provenance: state.STATE_FIGURE_PROVENANCE,
    externalDocuments: EXTERNAL_PUBLICATIONS,
  });

  const { groups, nothingMoves, overlaps, dependencies, closes, noPublicationNeeded, threeOrMore } = result;

  if (!check) {
    console.log(`${refused.length} of ${state.SUPPORTED_STATES.length} states do not serve ${year}. What each is waiting for:\n`);
    for (const row of result.rows) {
      const why = row.waits.join(' + ') || 'NOTHING MOVES — a reading of statute and nothing else';
      console.log(`  ${row.state}  ${why}`);
    }
    console.log('');
    for (const [name, states] of Object.entries(groups)) {
      console.log(`  ${String(states.length).padStart(2)}  ${name.padEnd(22)} ${states.join(' ')}`);
    }
    console.log(`  ${String(nothingMoves.length).padStart(2)}  ${'nothing moves'.padEnd(22)} ${nothingMoves.join(' ')}`);
    console.log(
      `\n  ${dependencies} dependencies across ${refused.length} states, ` +
        `${overlaps.length} state(s) in two groups: ${overlaps.map((r) => r.state).join(' ')}`,
    );
    console.log(`  ${dependencies} - ${overlaps.length} = ${dependencies - overlaps.length}  (refused ${refused.length})`);
    console.log(
      `\n  ${noPublicationNeeded.length} wait on NO publication at all: ${noPublicationNeeded.join(' ')}` +
        `\n     their next year is a statute question, which needs no hostname from anybody`,
    );
  }

  const problems = [];
  if (threeOrMore.length > 0) {
    problems.push(
      `${threeOrMore.map((r) => r.state).join(', ')} are in three or more groups, so "minus the overlaps" ` +
        `is no longer the right correction and the arithmetic printed here would be wrong.`,
    );
  }
  if (!closes) {
    problems.push(
      `the arithmetic does not close: ${dependencies} dependencies - ${overlaps.length} overlaps ` +
        `= ${dependencies - overlaps.length}, and ${refused.length} states are refused.`,
    );
  }

  // OFFER.md quotes these figures. A number in a sales document that nothing
  // derives is the exact defect this file was written for, so the document is
  // pinned to the tool rather than the other way round.
  const offer = readFileSync(join(ROOT, 'OFFER.md'), 'utf8');
  const pins = [
    [`${groups[IRS].length}  wait on the IRS`, 'the IRS group'],
    [`${groups[HHS].length}  wait on HHS`, 'the HHS group'],
    [`${dependencies} - ${overlaps.length} = ${dependencies - overlaps.length}`, 'the arithmetic'],
  ];
  for (const [needle, what] of pins) {
    if (!offer.includes(needle)) {
      problems.push(`OFFER.md does not state ${what} as this tool derives it — expected to find "${needle}".`);
    }
  }

  if (problems.length > 0) {
    console.error('\nThe decomposition of the refused states is not what is published.\n');
    for (const p of problems) console.error(`  ${p}`);
    console.error('\nSee the header of this file.');
    process.exit(1);
  }

  if (check) {
    console.log(
      `ok — ${refused.length} state(s) refuse ${year}; ${groups[IRS].length} wait on the IRS, ` +
        `${groups[HHS].length} on HHS, ${groups[DETERMINATION].length} on a revenue determination, ` +
        `${groups[OWN_DEPARTMENT].length} on their own department, ${groups[OWN_STATUTE].length} on their own statute, ` +
        `${nothingMoves.length} on nothing that moves; ${dependencies} - ${overlaps.length} = ${refused.length}, ` +
        `no state in three groups; ${noPublicationNeeded.length} need no publication at all ` +
        `(${noPublicationNeeded.join(', ')}); OFFER.md states these figures`,
    );
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
