#!/usr/bin/env node
/**
 * Regenerate `packages/us-state-tax/test/bracket-pins.json`.
 *
 * Run this ONLY when a rate schedule has deliberately changed and the change has
 * been checked some other way — a statute, a state release, the differential grid.
 * Running it to make a failing test pass destroys the only thing the file is for.
 *
 *   node tools/mutation/regenerate-bracket-pins.mjs
 *   git diff --stat packages/us-state-tax/test/bracket-pins.json   # read every line
 */
import { writeFileSync } from 'node:fs';
import { applyBrackets, getStateDefinition, SUPPORTED_STATES, SUPPORTED_YEARS } from '../../packages/us-state-tax/dist/esm/index.js';

const rows = [];
for (const year of SUPPORTED_YEARS) {
  for (const state of SUPPORTED_STATES) {
    const rate = getStateDefinition(state, year).rate;
    if (!rate || rate.kind !== 'brackets') continue;
    const tables = rate.byStatus ? Object.entries(rate.byStatus) : [['*', rate.brackets ?? rate.table]];
    for (const [filingStatus, brackets] of tables) {
      if (!Array.isArray(brackets) || brackets.length < 2) continue;
      for (let i = 0; i < brackets.length; i++) {
        // $1,000 into the band, so the probe sits strictly inside it and is not a
        // boundary case. A probe AT a ceiling is ambiguous between two bands and a
        // probe derived from the ceiling moves when the ceiling does — which is the
        // mistake Day 33 made first and caught with this very harness.
        const lower = i === 0 ? 0 : brackets[i - 1].upTo;
        if (lower === null || lower === undefined) continue;
        const taxableIncome = lower + 1_000;
        const { tax } = applyBrackets(taxableIncome, brackets);
        rows.push([year, state, filingStatus, taxableIncome, Math.round(tax * 100) / 100]);
      }
    }
  }
}

writeFileSync(
  new URL('../../packages/us-state-tax/test/bracket-pins.json', import.meta.url),
  JSON.stringify(
    {
      generatedBy: 'node tools/mutation/regenerate-bracket-pins.mjs',
      what: 'One probe $1,000 into every band of every state rate schedule, and the tax it owes. See test/bracket-pins.test.js for what this is and is not evidence of.',
      columns: ['year', 'state', 'filingStatus', 'taxableIncome', 'tax'],
      rows,
    },
    null,
    1,
  ) + '\n',
);
console.log(`${rows.length} pins written`);
