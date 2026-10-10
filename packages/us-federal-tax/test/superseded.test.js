// The 2025 standard deduction that Rev. Proc. 2024-40 published and OBBBA
// superseded, and the increase derived from the pair.
//
// Why this file exists: `us-state-tax` described the OBBBA increase in five
// states and measured it against $14,600 — the 2024 figure — for 46 days. The
// increase is $750, not $1,150. Nothing caught it because the state package's
// tests transcribed the same wrong premise they were asserting, and this
// package held the right answer in a COMMENT, where no test could reach it.
//
// These assertions are what makes the figure a figure.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FILING_STATUSES,
  OBBBA_2025_STANDARD_DEDUCTION_INCREASE,
  SUPERSEDED_2025_STANDARD_DEDUCTION,
  YEAR_2024,
  YEAR_2025,
} from './strict.mjs';

test('the superseded 2025 standard deduction is Rev. Proc. 2024-40 section 2.15', () => {
  assert.deepEqual(
    { ...SUPERSEDED_2025_STANDARD_DEDUCTION },
    {
      single: 15_000,
      marriedFilingJointly: 30_000,
      marriedFilingSeparately: 15_000,
      headOfHousehold: 22_500,
      qualifyingSurvivingSpouse: 30_000,
    },
  );
});

test('the OBBBA increase is $750 / $1,500 / $1,125 and is DERIVED from both sides', () => {
  assert.deepEqual(
    { ...OBBBA_2025_STANDARD_DEDUCTION_INCREASE },
    {
      single: 750,
      marriedFilingJointly: 1_500,
      marriedFilingSeparately: 750,
      headOfHousehold: 1_125,
      qualifyingSurvivingSpouse: 1_500,
    },
  );

  // The derivation, restated at every status, so neither side can move alone.
  for (const status of FILING_STATUSES) {
    assert.equal(
      SUPERSEDED_2025_STANDARD_DEDUCTION[status] + OBBBA_2025_STANDARD_DEDUCTION_INCREASE[status],
      YEAR_2025.standardDeduction[status],
      `${status}: superseded + increase must be the figure the 2025 return uses`,
    );
  }
});

test('THE DEFECT: the superseded figure is not the 2024 figure, and the gap is the whole error', () => {
  // $14,600 is 2024. Measuring the OBBBA increase from there inflates it by 53%
  // for a single filer, which is exactly what `us-state-tax` did in five states.
  assert.equal(YEAR_2024.standardDeduction.single, 14_600);
  assert.equal(SUPERSEDED_2025_STANDARD_DEDUCTION.single, 15_000);
  assert.notEqual(
    YEAR_2024.standardDeduction.single,
    SUPERSEDED_2025_STANDARD_DEDUCTION.single,
    'the pre-OBBBA 2025 figure is indexed off 2024 and is not equal to it',
  );

  const wrong = YEAR_2025.standardDeduction.single - YEAR_2024.standardDeduction.single;
  const right = OBBBA_2025_STANDARD_DEDUCTION_INCREASE.single;
  assert.equal(wrong, 1_150, 'the figure five states quoted');
  assert.equal(right, 750, 'the figure OBBBA actually added');
  assert.equal(wrong - right, 400, 'the 2024->2025 indexation that is not OBBBA');
});

test('the superseded figures are NOT used by the engine', async () => {
  // They are a historical record, not a parameter. If one of them ever reaches
  // an answer, that answer is six months out of date.
  const src = await import('node:fs/promises').then((fs) =>
    fs.readFile(new URL('../src/data/2025.ts', import.meta.url), 'utf8'),
  );
  const body = src.slice(0, src.indexOf('export const SUPERSEDED_2025_STANDARD_DEDUCTION'));
  assert.ok(
    !body.includes('SUPERSEDED_2025_STANDARD_DEDUCTION'),
    'nothing above the declaration may read it',
  );
});
