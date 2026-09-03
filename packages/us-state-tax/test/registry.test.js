import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  FILING_STATUSES,
  NO_INCOME_TAX_STATES,
  SUPPORTED_STATES,
  SUPPORTED_YEARS,
  getStateDefinition,
  isSupported,
  stateIncomeTax,
  stateName,
  supportedYears,
} from '../dist/esm/index.js';

const federal = (agi, taxableIncome, deduction = agi - taxableIncome) => ({
  adjustedGrossIncome: agi,
  taxableIncome,
  deduction,
  deductionKind: 'standard',
});

test('every supported state resolves for every supported year', () => {
  assert.equal(SUPPORTED_STATES.length, 23);
  for (const state of SUPPORTED_STATES) {
    assert.deepEqual(supportedYears(state), SUPPORTED_YEARS);
    for (const year of SUPPORTED_YEARS) {
      const def = getStateDefinition(state, year);
      assert.equal(def.code, state);
      assert.equal(def.year, year);
      assert.ok(def.citations.length > 0, `${state} has no citation`);
      assert.ok(def.notes.length > 0, `${state} has no notes`);
    }
  }
});

test('an unsupported year is an error, not a silent fallback', () => {
  // Six of these states changed their rate between 2025 and 2026. A fallback to
  // the nearest year would return a number that looks right for all of them.
  assert.throws(() => getStateDefinition('NC', 2024), /tax year 2024 is not/);
  assert.throws(() => getStateDefinition('NC', 2027), /Supported years: 2025, 2026/);
  assert.equal(isSupported('NC', 2024), false);
  assert.equal(isSupported('NC', 2025), true);
});

test('an unsupported state names what is missing rather than returning zero', () => {
  assert.throws(() => getStateDefinition('MA', 2026), /not supported/);
  // The message has to say which states are absent, because the caller is often a
  // language model and a model that cannot see the gap will fill it in.
  assert.throws(() => getStateDefinition('MA', 2026), /Massachusetts/);
  assert.throws(() => getStateDefinition('NJ', 2026), /New Jersey/);
  // New York was one of these until it was not. When a state moves from the gap
  // list into the registry, this is where the two have to be kept in step.
  assert.equal(isSupported('NY', 2026), true);
});

test('every state computes for every filing status without throwing', () => {
  for (const state of SUPPORTED_STATES) {
    for (const year of SUPPORTED_YEARS) {
      for (const filingStatus of FILING_STATUSES) {
        const r = stateIncomeTax({
          state,
          year,
          filingStatus,
          federal: federal(90_000, 74_250, 15_750),
          pennsylvaniaTaxableIncome: 90_000,
          dependents: 2,
        });
        assert.ok(Number.isFinite(r.tax), `${state} ${year} ${filingStatus} produced ${r.tax}`);
        assert.ok(r.tax >= 0, `${state} ${year} ${filingStatus} produced a negative tax`);
        assert.equal(r.stateName, stateName(state));
      }
    }
  }
});

test('the nine states with no income tax return zero and say why', () => {
  assert.equal(NO_INCOME_TAX_STATES.length, 9);
  for (const state of NO_INCOME_TAX_STATES) {
    const r = stateIncomeTax({
      state,
      year: 2026,
      filingStatus: 'single',
      federal: federal(500_000, 484_250),
    });
    assert.equal(r.hasIncomeTax, false);
    assert.equal(r.tax, 0);
    assert.equal(r.marginalRate, 0);
    assert.equal(r.provisional, false);
  }
});

test('New Hampshire says the interest and dividends tax ended after 2024', () => {
  const r = stateIncomeTax({
    state: 'NH',
    year: 2025,
    filingStatus: 'single',
    federal: federal(100_000, 84_250),
  });
  assert.ok(r.notes.some((n) => n.includes('2025')));
  assert.ok(r.notes.some((n) => n.includes('2024 was the last year')));
});

test('Washington says "no income tax" is incomplete', () => {
  // A Washington filer with a large long-term gain owes Washington tax. Answering
  // "no income tax" and stopping is the failure this note exists to prevent.
  const r = stateIncomeTax({
    state: 'WA',
    year: 2026,
    filingStatus: 'single',
    federal: federal(2_000_000, 1_984_250),
  });
  assert.equal(r.tax, 0);
  assert.ok(r.notes.some((n) => n.includes('capital gains')));
  assert.ok(r.notes.some((n) => n.includes('7%')));
});

test('every provisional state-year says so in its first note', () => {
  for (const state of SUPPORTED_STATES) {
    for (const year of SUPPORTED_YEARS) {
      const def = getStateDefinition(state, year);
      if (def.status !== 'provisional') continue;
      assert.ok(
        def.notes[0].startsWith('PROVISIONAL:'),
        `${state} ${year} is provisional but does not lead with it`,
      );
      const r = stateIncomeTax({
        state,
        year,
        filingStatus: 'single',
        federal: federal(80_000, 64_250, 15_750),
        pennsylvaniaTaxableIncome: 80_000,
      });
      assert.equal(r.provisional, true);
    }
  }
});

test('2025 has no provisional state and 2026 has seven', () => {
  const count = (year) =>
    SUPPORTED_STATES.filter((s) => getStateDefinition(s, year).status === 'provisional').length;
  // Everything published for 2025; for 2026 the states whose indexed figures had
  // not been released — plus Colorado, whose rate can still be cut retroactively.
  assert.equal(count(2025), 0);
  assert.equal(count(2026), 7);
  const provisional2026 = SUPPORTED_STATES.filter(
    (s) => getStateDefinition(s, 2026).status === 'provisional',
  );
  assert.deepEqual(provisional2026, ['CA', 'CO', 'ID', 'IL', 'KY', 'MI', 'UT']);
});

test('the package has no runtime dependencies', () => {
  // An engine that ships a dependency tree is a supply chain the caller did not
  // choose. This is a claim in the README, so it is a test.
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.peerDependencies, undefined);
});
