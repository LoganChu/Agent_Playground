#!/usr/bin/env node
/**
 * Regenerate `packages/us-state-tax/test/step-probes.json`.
 *
 * Run this ONLY when a staircase has deliberately changed and the change has been
 * checked some other way — a statute, a state release, the differential grid.
 * Running it to make a failing test pass destroys the only thing the file is for.
 *
 *   node tools/mutation/regenerate-step-probes.mjs
 *   git diff packages/us-state-tax/test/step-probes.json   # read every line
 *
 * One row per probe, one probe per step of every staircase that pays an amount.
 * The probe VALUES are frozen here and read back out of the fixture by the test,
 * because a probe recomputed from the table at test time moves with the mutation it
 * exists to catch — Day 33's rule, and the first bug this instrument's ancestor had.
 */
import { writeFileSync } from 'node:fs';
import {
  NO_INCOME_TAX_STATES,
  SUPPORTED_STATES,
  SUPPORTED_YEARS,
  getStateDefinition,
  stateIncomeTax,
} from '../../packages/us-state-tax/dist/esm/index.js';
import {
  DIGEST_COLUMNS,
  digest,
  driverKey,
  driverStatuses,
  probeInput,
  probeValues,
  stepCharts,
} from '../../packages/us-state-tax/test/step-charts.mjs';
import { DRIVERS } from '../../packages/us-state-tax/test/step-charts.mjs';

const rows = [];
for (const year of SUPPORTED_YEARS) {
  for (const state of SUPPORTED_STATES) {
    if (NO_INCOME_TAX_STATES.includes(state)) continue;
    for (const { path, steps } of stepCharts(getStateDefinition(state, year))) {
      if (DRIVERS[driverKey(path)] === undefined) continue;
      for (const filingStatus of driverStatuses(path)) {
        for (const value of probeValues(steps)) {
          const figures = digest(stateIncomeTax(probeInput(path, value, state, year, filingStatus)));
          rows.push([year, state, path, filingStatus, value, ...figures].join('|'));
        }
      }
    }
  }
}

writeFileSync(
  new URL('../../packages/us-state-tax/test/step-probes.json', import.meta.url),
  JSON.stringify(
    {
      generatedBy: 'node tools/mutation/regenerate-step-probes.mjs',
      what: 'One probe inside every step of every staircase this file drives, and the state return it produces. See test/step-probes.test.js for what this is and is not evidence of.',
      columns: ['year', 'state', 'chart', 'filingStatus', 'probe', ...DIGEST_COLUMNS],
      rows,
    },
    null,
    1,
  ) + '\n',
);
console.log(`${rows.length} probes written`);
