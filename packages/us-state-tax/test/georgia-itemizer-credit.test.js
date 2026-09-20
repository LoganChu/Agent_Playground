// Georgia's eligible itemizer tax credit, O.C.G.A. § 48-7-27.1.
//
// The credit is $300 a taxpayer for having elected to itemize federally, and
// the reason it is worth its own file is that it is the only rule in this
// package whose sole test is the standard-versus-itemized election. Every other
// credit here asks about income, age or dependents. This one asks which box was
// ticked on a *federal* return, and then pays the same amount to a filer at
// $50,000 and one at $5,000,000.
//
// The consequence that no guide states, and which the last section pins to the
// cent: because § 48-7-27(a)(1) compels a federal itemizer to itemize in Georgia
// too, and because HB 1437 raised the Georgia standard deduction while leaving
// the itemized figure alone, the credit exists to pay for a deduction the filer
// is forced to lose. At 4.99% it covers a shortfall of $6,012 — so the rule
// "itemize when your itemized deductions beat the standard deduction" is wrong
// in Georgia by $6,012, and by $12,024 on a joint return.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getStateDefinition, stateIncomeTax } from '../dist/esm/index.js';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

const ga = (agi, opts = {}) =>
  stateIncomeTax({
    state: 'GA',
    year: opts.year ?? 2026,
    filingStatus: opts.filingStatus ?? 'single',
    federal: {
      adjustedGrossIncome: agi,
      deductionKind: opts.itemizes ? 'itemized' : 'standard',
    },
    ...opts,
  });

const itemizerCredit = (result) =>
  result.credits
    .filter((c) => c.name.toLowerCase().includes('itemizer'))
    .reduce((sum, c) => sum + c.amount, 0);

const RATE_2026 = 0.0499;
const STANDARD_2026 = { single: 15_000, joint: 30_000 };

// ---------------------------------------------------------------------------
// The parameter, and the citation that was wrong for a day
// ---------------------------------------------------------------------------

test('the credit is $300 a taxpayer in both modelled years', () => {
  for (const year of [2025, 2026]) {
    const rule = getStateDefinition('GA', year).itemizerCredit;
    assert.ok(rule, `${year} should carry the itemizer credit`);
    assert.equal(rule.perTaxpayer, 300);
  }
});

test('Georgia cites § 48-7-27.1 and never § 48-7-29.23', () => {
  const def = getStateDefinition('GA', 2026);
  const text = [...def.notes, ...def.citations.map((c) => c.title)].join(' ');
  assert.ok(text.includes('48-7-27.1'), 'the real section should be cited');
  assert.ok(
    !text.includes('48-7-29.23'),
    'the section this package and PolicyEngine-US both cited until Day 26 does not exist',
  );
});

// ---------------------------------------------------------------------------
// The one test the credit has
// ---------------------------------------------------------------------------

test('a federal standard-deduction filer gets nothing, a federal itemizer gets $300', () => {
  money(itemizerCredit(ga(100_000)), 0, 'standard');
  money(itemizerCredit(ga(100_000, { itemizes: true })), 300, 'itemized');
});

test('the credit has no income test at any level', () => {
  for (const agi of [20_000, 50_000, 400_000, 5_000_000]) {
    money(itemizerCredit(ga(agi, { itemizes: true })), 300, `at $${agi}`);
  }
});

test('it is per taxpayer: $600 joint, $300 on every other status', () => {
  money(itemizerCredit(ga(200_000, { itemizes: true, filingStatus: 'marriedFilingJointly' })), 600);
  money(
    itemizerCredit(ga(100_000, { itemizes: true, filingStatus: 'marriedFilingSeparately' })),
    300,
  );
  money(itemizerCredit(ga(100_000, { itemizes: true, filingStatus: 'headOfHousehold' })), 300);
});

// A surviving spouse uses the joint rate schedule federally, and `filerCount()`
// in this package answers two for that status because of it. There is still one
// taxpayer on the return, and Georgia already treats a surviving spouse as "any
// other taxpayer" for its standard deduction — so the credit is $300, and this
// test exists because the convenient helper gives the other answer.
test('a qualifying surviving spouse is ONE taxpayer, not two', () => {
  money(
    itemizerCredit(ga(100_000, { itemizes: true, filingStatus: 'qualifyingSurvivingSpouse' })),
    300,
  );
});

// ---------------------------------------------------------------------------
// Non-refundable, and capped at the liability
// ---------------------------------------------------------------------------

test('the credit cannot take a Georgia bill below zero', () => {
  // $20,000 of wages, $15,000 standard deduction: $5,000 taxable, $249.50 of
  // tax against a $300 credit.
  const before = ga(20_000);
  money(before.tax, 5_000 * RATE_2026, 'tax before the credit');
  const after = ga(20_000, { itemizes: true });
  money(after.tax, 0, 'the credit is capped at the liability');
  assert.ok(after.tax >= 0, 'never negative');
});

test('a filer with no Georgia tax at all gets no credit paid out', () => {
  const result = ga(10_000, { itemizes: true });
  money(result.tax, 0);
});

// ---------------------------------------------------------------------------
// The inversion — the part a deduction table cannot show
// ---------------------------------------------------------------------------
//
// Georgia's election follows the federal one in both directions, so a federal
// itemizer takes the Georgia itemized figure even when the Georgia standard
// deduction is larger. The credit is what makes that bearable, and it is worth
// exactly $300 / 4.99% = $6,012.02 of deduction.

const gaItemizing = (agi, stateItemized, filingStatus = 'single') =>
  stateIncomeTax({
    state: 'GA',
    year: 2026,
    filingStatus,
    federal: { adjustedGrossIncome: agi, deductionKind: 'itemized' },
    stateItemizedDeductions: stateItemized,
  });

test('supplying the Georgia itemized figure forces it, even when it is smaller', () => {
  const forced = gaItemizing(100_000, 9_000);
  money(forced.deduction, 9_000, 'the standard $15,000 is not available');
  money(forced.taxableIncome, 91_000);
});

test('an itemizer $6,000 short of the standard deduction still pays LESS', () => {
  const standard = ga(100_000);
  const short = gaItemizing(100_000, STANDARD_2026.single - 6_000);
  money(standard.tax, 85_000 * RATE_2026, 'the standard-deduction filer');
  money(short.tax, 91_000 * RATE_2026 - 300, 'the itemizer');
  assert.ok(
    short.tax < standard.tax,
    `itemizing $6,000 short should still win: ${short.tax} vs ${standard.tax}`,
  );
});

test('the break-even is a $6,012 shortfall, and $6,100 is the wrong side of it', () => {
  const standard = ga(100_000).tax;
  const breakEven = gaItemizing(100_000, STANDARD_2026.single - 6_012).tax;
  assert.ok(
    Math.abs(breakEven - standard) < 0.02,
    `a $6,012 shortfall should be a wash: ${breakEven} vs ${standard}`,
  );
  const past = gaItemizing(100_000, STANDARD_2026.single - 6_100).tax;
  assert.ok(past > standard, `a $6,100 shortfall should cost: ${past} vs ${standard}`);
  // And it is 4.99 cents per dollar past the line, not 4.99 cents from the top.
  money(past - breakEven, 88 * RATE_2026, 'the cost of the last $88');
});

test('a joint return absorbs twice the shortfall, because it claims twice the credit', () => {
  const standard = ga(200_000, { filingStatus: 'marriedFilingJointly' }).tax;
  const short = gaItemizing(
    200_000,
    STANDARD_2026.joint - 12_000,
    'marriedFilingJointly',
  ).tax;
  assert.ok(short < standard, `$12,000 short on a joint return should still win: ${short}`);
  const past = gaItemizing(200_000, STANDARD_2026.joint - 12_100, 'marriedFilingJointly').tax;
  assert.ok(past > standard, `$12,100 short should cost: ${past}`);
});
