// Indiana's unified tax credit for the elderly, IC 6-3-3-9.
//
// The last line of an Indiana return this package did not compute, and the only
// rule in it that can be a household's ENTIRE answer: Indiana exempts Social
// Security, so a retired couple living on the benefit has an Indiana tax of
// nothing, and this refundable $140 is the only figure on the return that moves.
//
// The two facts worth testing are both about where the bands are measured and
// how sharply they end. The ceiling is on FEDERAL adjusted gross income, so
// Indiana's own exemptions — $5,000 for a retired couple as of v0.21.0 — buy no
// room under it at all. And each of the three edges is a cliff: one dollar at
// $1,000 costs $50.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getStateDefinition, stateIncomeTax } from '../dist/esm/index.js';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

const indiana = (agi, opts = {}) =>
  stateIncomeTax({
    state: 'IN',
    year: opts.year ?? 2026,
    filingStatus: opts.filingStatus ?? 'single',
    federal: { adjustedGrossIncome: agi },
    ...opts,
  });

const elderlyCredit = (result) =>
  result.credits
    .filter((c) => c.name.toLowerCase().includes('elderly'))
    .reduce((sum, c) => sum + c.amount, 0);

// ---------------------------------------------------------------------------
// The two schedules
// ---------------------------------------------------------------------------

test('the parameters are the statute\'s two schedules, and it is refundable', () => {
  for (const year of [2025, 2026]) {
    const rule = getStateDefinition('IN', year).agedCredit;
    assert.ok(rule, `${year} should carry the elderly credit`);
    assert.equal(rule.minimumAge, 65);
    assert.equal(rule.refundable, true);
    assert.deepEqual(
      rule.oneAged.map((b) => [b.under, b.amount]),
      [
        [1_000, 100],
        [3_000, 50],
        [10_000, 40],
      ],
    );
    assert.deepEqual(
      rule.bothAged.map((b) => [b.under, b.amount]),
      [
        [1_000, 140],
        [3_000, 90],
        [10_000, 80],
      ],
    );
  }
});

test('one filer at 65: $100, $50, $40 and then nothing', () => {
  const at = (agi) => elderlyCredit(indiana(agi, { filerAge: 70 }));
  money(at(0), 100);
  money(at(999.99), 100);
  money(at(1_000), 50);
  money(at(2_999.99), 50);
  money(at(3_000), 40);
  money(at(9_999.99), 40);
  money(at(10_000), 0);
  money(at(50_000), 0);
});

test('two filers at 65: $140, $90, $80 and then nothing', () => {
  const at = (agi) =>
    elderlyCredit(
      indiana(agi, { filingStatus: 'marriedFilingJointly', filerAge: 70, spouseAge: 68 }),
    );
  money(at(0), 140);
  money(at(999.99), 140);
  money(at(1_000), 90);
  money(at(3_000), 80);
  money(at(10_000), 0);
});

test('a joint return with one spouse under 65 takes the ONE-aged schedule', () => {
  const one = indiana(500, {
    filingStatus: 'marriedFilingJointly',
    filerAge: 70,
    spouseAge: 60,
  });
  money(elderlyCredit(one), 100, 'one aged');
  const both = indiana(500, {
    filingStatus: 'marriedFilingJointly',
    filerAge: 70,
    spouseAge: 65,
  });
  money(elderlyCredit(both), 140, 'both aged');
});

test('nobody at 65 gets nothing, and an omitted age is treated as nobody', () => {
  money(elderlyCredit(indiana(500, { filerAge: 64 })), 0, 'too young');
  money(elderlyCredit(indiana(500)), 0, 'no age supplied');
});

// ---------------------------------------------------------------------------
// The cliffs
// ---------------------------------------------------------------------------
//
// The boundary is STRICT: IC 6-3-3-9(c) says "less than one thousand dollars",
// so $1,000.00 exactly is in the band below. The `<=` used by this package's
// other step-function credits would get that household wrong by $50, which is
// why the rule has its own comparison.

test('one dollar at $1,000 costs $50, and it is the dollar itself that does it', () => {
  const below = elderlyCredit(indiana(999, { filerAge: 70 }));
  const at = elderlyCredit(indiana(1_000, { filerAge: 70 }));
  money(below - at, 50, 'the step');
  money(elderlyCredit(indiana(1_000.0, { filerAge: 70 })), 50, 'exactly $1,000 is below the line');
});

test('the three cliffs are $50, $10 and $80 for one filer', () => {
  const at = (agi) => elderlyCredit(indiana(agi, { filerAge: 70 }));
  money(at(999) - at(1_000), 50);
  money(at(2_999) - at(3_000), 10);
  money(at(9_999) - at(10_000), 40);
});

// ---------------------------------------------------------------------------
// The whole return
// ---------------------------------------------------------------------------

test('a retired couple living on Social Security owes nothing and is PAID $140', () => {
  // $40,000 of benefits, none of it taxable federally, so federal AGI is zero.
  // Indiana exempts the benefit and allows $5,000 of exemptions on top, which
  // is what takes the taxable figure below zero — and none of it matters to the
  // credit, which reads the federal figure.
  const result = indiana(0, {
    filingStatus: 'marriedFilingJointly',
    filerAge: 70,
    spouseAge: 70,
    taxableSocialSecurity: 0,
  });
  money(result.taxBeforeCredits, 0, 'no Indiana tax');
  money(result.tax, -140, 'the credit is paid out');
});

test('Indiana\'s own generosity buys no room under the $10,000 ceiling', () => {
  // $12,000 of pension: over the federal ceiling, so no credit — even though
  // the Indiana exemptions take the state taxable figure to $7,000.
  const result = indiana(12_000, {
    filingStatus: 'marriedFilingJointly',
    filerAge: 70,
    spouseAge: 70,
  });
  money(elderlyCredit(result), 0, 'no credit at $12,000 of federal AGI');
  assert.ok(result.taxableIncome < 10_000, 'even though Indiana taxable income is under $10,000');
});

test('a separate return claims nothing, because the statute requires a joint claim', () => {
  money(
    elderlyCredit(indiana(500, { filingStatus: 'marriedFilingSeparately', filerAge: 70 })),
    0,
  );
  // And a head of household does claim it — the bar is on the separate return
  // alone.
  money(elderlyCredit(indiana(500, { filingStatus: 'headOfHousehold', filerAge: 70 })), 100);
});

// ---------------------------------------------------------------------------
// The second person
// ---------------------------------------------------------------------------

test('the second aged filer is worth $40, not $100', () => {
  const one = elderlyCredit(
    indiana(500, { filingStatus: 'marriedFilingJointly', filerAge: 70, spouseAge: 60 }),
  );
  const two = elderlyCredit(
    indiana(500, { filingStatus: 'marriedFilingJointly', filerAge: 70, spouseAge: 70 }),
  );
  money(two - one, 40, 'the second person');
  assert.ok(two < one * 2, 'and it does not double');
});
