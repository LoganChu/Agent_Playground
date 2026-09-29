#!/usr/bin/env node
/**
 * Regenerate `packages/us-state-tax/test/note-pins.json`.
 *
 * Run this when a note has deliberately changed, and then READ THE DIFF. That is
 * the whole protocol: the fixture stores the first 72 characters of every note the
 * package can emit, so a diff here is a sentence a caller will see, and it is
 * readable in the way a hash would not be.
 *
 *   node tools/mutation/regenerate-note-pins.mjs
 *   git diff packages/us-state-tax/test/note-pins.json
 *
 * 72 characters rather than the whole note, on purpose. The prose is edited often
 * and the fixture should not churn every time a clause moves; what it has to catch
 * is a note APPEARING, VANISHING or MOVING between state-years, which is what a
 * year selector on a `notes:` array gets wrong. See `test/notes.test.js`.
 */
import { writeFileSync } from 'node:fs';
import {
  SUPPORTED_STATES,
  SUPPORTED_YEARS,
  getStateDefinition,
} from '../../packages/us-state-tax/dist/esm/index.js';
import { PREFIX_LENGTH, notePrefix } from '../../packages/us-state-tax/test/note-prefix.mjs';

const rows = [];
for (const year of SUPPORTED_YEARS) {
  for (const state of SUPPORTED_STATES) {
    const def = getStateDefinition(state, year);
    (def.notes ?? []).forEach((text, i) => rows.push([year, state, 'def', i, notePrefix(text)].join('|')));
    (def.conditionalNotes ?? []).forEach((note, i) =>
      rows.push([year, state, 'cond', i, notePrefix(note.text)].join('|')),
    );
  }
}

writeFileSync(
  new URL('../../packages/us-state-tax/test/note-pins.json', import.meta.url),
  JSON.stringify(
    {
      generatedBy: 'node tools/mutation/regenerate-note-pins.mjs',
      what: `The first ${PREFIX_LENGTH} characters of every note every state-year can emit, in order. See test/notes.test.js for why the notes are the one output that needed this.`,
      columns: ['year', 'state', 'kind', 'index', 'prefix'],
      rows,
    },
    null,
    1,
  ) + '\n',
);
console.log(`${rows.length} notes pinned`);
