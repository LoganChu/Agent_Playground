#!/usr/bin/env node
/**
 * Regenerate `packages/us-state-tax/test/status-sweep.json`.
 *
 * Run this ONLY when a state parameter has deliberately changed and the change
 * has been checked some other way — a statute, a state release, the differential
 * grid. Running it to make a failing test pass destroys the only thing the file
 * is for, exactly as with `regenerate-bracket-pins.mjs`.
 *
 *   node tools/mutation/regenerate-status-sweep.mjs
 *   git diff --stat packages/us-state-tax/test/status-sweep.json   # read every line
 *
 * One line per row on purpose: a fixture whose diff cannot be read is a fixture
 * nobody checks before regenerating, and then it guards nothing.
 */
import { writeFileSync } from 'node:fs';
import {
  FILING_STATUSES,
  NO_INCOME_TAX_STATES,
  SUPPORTED_STATES,
  SUPPORTED_YEARS,
  stateIncomeTax,
} from '../../packages/us-state-tax/dist/esm/index.js';
import {
  DIGEST_COLUMNS,
  HOUSEHOLDS,
  digest,
  household,
} from '../../packages/us-state-tax/test/status-households.mjs';

const taxing = SUPPORTED_STATES.filter((s) => !NO_INCOME_TAX_STATES.includes(s));
const rows = [];
for (const year of SUPPORTED_YEARS) {
  for (const state of taxing) {
    for (const filingStatus of FILING_STATUSES) {
      for (const name of HOUSEHOLDS) {
        const result = stateIncomeTax(household(name, state, year, filingStatus));
        rows.push([year, state, filingStatus, name, ...digest(result)].join('|'));
      }
    }
  }
}

writeFileSync(
  new URL('../../packages/us-state-tax/test/status-sweep.json', import.meta.url),
  `{
 "generatedBy": "node tools/mutation/regenerate-status-sweep.mjs",
 "what": "Every taxing state-year, every filing status, every household in the frozen battery, and what the engine answers. See test/status-sweep.test.js for what this is and is not evidence of.",
 "columns": ${JSON.stringify(['year', 'state', 'filingStatus', 'household', ...DIGEST_COLUMNS])},
 "rows": [
${rows.map((r) => `  ${JSON.stringify(r)}`).join(',\n')}
 ]
}
`,
);
console.log(`${rows.length} rows across ${taxing.length} states, ${SUPPORTED_YEARS.length} years, ${FILING_STATUSES.length} statuses and ${HOUSEHOLDS.length} households`);
