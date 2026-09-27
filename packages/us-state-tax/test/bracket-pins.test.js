// Every band of every state rate schedule, priced.
//
// ## Why this file exists, and what it is NOT
//
// Day 33 ran a mutation audit over this package — `tools/mutation/mutate.mjs`,
// which sets one number in the build wrong and runs the suite — and the rate
// schedules were the worst-covered thing in it. A survivor is a number the package
// could ship with a wrong value for, and among them were:
//
//   California  10.3%, 11.3% and 12.3% — the three top rates, and the thresholds
//               under them. Also the WHOLE head-of-household table: five of its
//               ceilings, untouched by anything.
//   Maryland    every bracket above $150,000 on both tables — the five ceilings
//               that decide what a high earner pays.
//   Ohio        the $500,000 and $750,000 base-amount rows.
//   New York    the $5,000 / $6,000 / $7,000 supplemental-tax rows, twice over.
//
// These are not obscure parameters. They are the top of the table in the two
// states with the most filers above $250,000, and they were unpinned because a
// per-state test is written from a household, a household has one income, and
// nobody writes the $900,000 household.
//
// **THE RULE: a test suite built one household at a time covers the incomes
// somebody thought of, and the top of every table is the part nobody thinks of.**
// A filer in the top band is the filer with the most tax at stake per return,
// which makes this the most expensive place in the package to be wrong and the
// cheapest to leave untested.
//
// ## What these pins are evidence of
//
// They are a REGRESSION GUARD and nothing more. Every expected figure was computed
// by this package (`tools/mutation/regenerate-bracket-pins.mjs`), so Day 27's rule
// applies in full: a test written from the data can only confirm the data. These
// pins cannot tell you a rate schedule is right.
//
// What they can tell you is that no schedule changed without somebody saying so —
// which is exactly what was missing. The correctness evidence lives elsewhere and
// is unaffected by this file:
//
//   - the per-state test files, each citing the statute or state release;
//   - `tools/differential`, which compares 779 households against PolicyEngine-US,
//     an independently built model, on every figure these schedules feed.
//
// So the honest division of labour is: the statute says what the number should be,
// the differential says somebody else agrees, and this file says it has not moved.
// Regenerating the fixture to make this file pass throws away the third and keeps
// the first two — which is why the regenerator says so at the top.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  applyBrackets,
  FILING_STATUSES,
  getStateDefinition,
  SUPPORTED_STATES,
  SUPPORTED_YEARS,
} from '../dist/esm/index.js';

const PINS = JSON.parse(readFileSync(new URL('./bracket-pins.json', import.meta.url), 'utf8'));

test('every pinned band still costs what it cost', () => {
  assert.ok(PINS.rows.length > 400, 'the fixture is present and not truncated');
  for (const [year, state, filingStatus, taxableIncome, expected] of PINS.rows) {
    const rate = getStateDefinition(state, year).rate;
    const brackets = filingStatus === '*' ? (rate.brackets ?? rate.table) : rate.byStatus[filingStatus];
    const { tax } = applyBrackets(taxableIncome, brackets);
    assert.equal(
      Math.round(tax * 100) / 100,
      expected,
      `${state} ${year} ${filingStatus}: $${taxableIncome.toLocaleString('en-US')} of taxable income`,
    );
  }
});

test('the fixture covers every band of every schedule this package ships', () => {
  // A pin file that has gone stale is worse than none, because it reports on a
  // package that no longer exists. Adding a state, a year or a filing status
  // without regenerating fails HERE rather than silently narrowing the guard.
  //
  // This is the same shape as the differential harness's rule from Day 32: an
  // entry with no bound covers everything, and a report that cannot see a gap is
  // the last place that will tell you about it.
  const seen = new Set(PINS.rows.map(([y, s, f]) => `${y}|${s}|${f}`));
  const expectedCount = new Map();
  for (const year of SUPPORTED_YEARS) {
    for (const state of SUPPORTED_STATES) {
      const rate = getStateDefinition(state, year).rate;
      if (!rate || rate.kind !== 'brackets') continue;
      const tables = rate.byStatus ? Object.entries(rate.byStatus) : [['*', rate.brackets ?? rate.table]];
      for (const [filingStatus, brackets] of tables) {
        if (!Array.isArray(brackets) || brackets.length < 2) continue;
        const key = `${year}|${state}|${filingStatus}`;
        assert.ok(seen.has(key), `${key} has a graduated schedule and no pins — regenerate the fixture`);
        expectedCount.set(key, brackets.length);
      }
    }
  }
  // And a band added to an existing schedule, which would otherwise pass above.
  const actualCount = new Map();
  for (const [y, s, f] of PINS.rows) actualCount.set(`${y}|${s}|${f}`, (actualCount.get(`${y}|${s}|${f}`) ?? 0) + 1);
  for (const [key, n] of expectedCount) {
    assert.equal(actualCount.get(key), n, `${key} has ${n} bands and ${actualCount.get(key)} pins`);
  }
  // No pin for a schedule that no longer exists.
  for (const key of actualCount.keys()) {
    assert.ok(expectedCount.has(key), `${key} is pinned and is no longer shipped — regenerate the fixture`);
  }
});

test('every rate schedule is ascending, open at the top, and has no empty band', () => {
  // The structural claims, which the pins cannot make. A duplicated ceiling makes
  // one rate unreachable, and every pin in the file would still pass: the band has
  // zero width, so no probe lands in it. That is Day 29's rule — a parameter the
  // engine can never reach is not tested by anything — and it is reachable here
  // only by looking at the table rather than at an answer.
  for (const year of SUPPORTED_YEARS) {
    for (const state of SUPPORTED_STATES) {
      const rate = getStateDefinition(state, year).rate;
      if (!rate || rate.kind !== 'brackets') continue;
      const tables = rate.byStatus ? Object.entries(rate.byStatus) : [['*', rate.brackets ?? rate.table]];
      for (const [filingStatus, brackets] of tables) {
        if (!Array.isArray(brackets) || brackets.length < 2) continue;
        const where = `${state} ${year} ${filingStatus}`;
        if (filingStatus !== '*') {
          assert.ok(FILING_STATUSES.includes(filingStatus), `${where}: unknown filing status`);
        }
        const last = brackets[brackets.length - 1];
        assert.ok(
          last.upTo === null || last.upTo === undefined || last.upTo === Infinity,
          `${where}: the top band must be open`,
        );
        for (let i = 1; i < brackets.length; i++) {
          assert.ok(
            brackets[i].rate > brackets[i - 1].rate,
            `${where}: band ${i} rate ${brackets[i].rate} must exceed ${brackets[i - 1].rate}`,
          );
          const prev = brackets[i - 1].upTo;
          const here = brackets[i].upTo;
          if (here === null || here === undefined || here === Infinity) continue;
          assert.ok(here > prev, `${where}: band ${i} ceiling ${here} must exceed ${prev} — an empty band hides a rate`);
        }
      }
    }
  }
});
