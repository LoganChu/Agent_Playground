// Maryland's poverty level credit, Md. Code, Tax-Gen. § 10-709.
//
// It is the only provision in a Maryland return that can forgive the whole bill,
// and it does it in two halves at two different rates: 5% of earned income
// against the state tax, and the COUNTY'S OWN RATE times the same earned income
// against the county tax. So the credit is worth a different amount in each of
// the twenty-four jurisdictions and there is no per-county figure anywhere in
// the package — the same economy as the local earned income credit, which is
// ten times that county's rate.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { stateIncomeTax } from '../dist/esm/index.js';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

const federal = (agi, eitc = 0) => ({
  adjustedGrossIncome: agi,
  taxableIncome: Math.max(0, agi - 15_750),
  deduction: 15_750,
  deductionKind: 'standard',
  earnedIncomeCredit: eitc,
});

const maryland = (opts = {}) =>
  stateIncomeTax({
    state: 'MD',
    year: opts.year ?? 2026,
    filingStatus: opts.filingStatus ?? 'single',
    county: opts.county ?? 'Allegany County',
    federal: federal(opts.agi ?? 15_000, opts.eitc ?? 0),
    earnedIncome: opts.earnedIncome,
    ...opts,
  });

const creditNamed = (result, name) =>
  result.credits.find((c) => c.name === name)?.amount ?? 0;
const localCreditNamed = (result, name) =>
  result.localTaxes[0].credits.find((c) => c.name === name)?.amount ?? 0;

test('a single worker at $15,000 owes Maryland nothing at all', () => {
  // The whole bill — state and county — against $15,000 of wages under the
  // $15,960 guideline. Before v0.21.0 this filer was charged $160.85.
  const r = maryland({ agi: 15_000, earnedIncome: 15_000 });
  money(r.totalTax, 0);
  assert.ok(creditNamed(r, 'Maryland poverty level credit') > 0);
  assert.ok(localCreditNamed(r, 'Local poverty level credit') > 0);
});

test('the county half is the county rate and nothing is stored per county', () => {
  // A filer just under the guideline with only $1,000 of earned income: the tax
  // is large enough that the CREDIT is the binding figure rather than its cap,
  // which is the only place the rate is visible.
  const at = (county) =>
    maryland({ agi: 15_900, earnedIncome: 1_000, county, dependents: 0 });
  // $1,000 of earned income: the state credit is $50 and the county credit is
  // $22.50 in Worcester and $33.00 in Dorchester.
  money(creditNamed(at('Worcester County'), 'Maryland poverty level credit'), 50);
  money(localCreditNamed(at('Worcester County'), 'Local poverty level credit'), 22.5);
  money(localCreditNamed(at('Dorchester County'), 'Local poverty level credit'), 33);
  // The dearest county's credit is worth 47% more than the cheapest one's, on
  // the same income, because the credit IS the rate.
  const worcester = localCreditNamed(at('Worcester County'), 'Local poverty level credit');
  const dorchester = localCreditNamed(at('Dorchester County'), 'Local poverty level credit');
  money(dorchester / worcester, 0.033 / 0.0225);
});

test('neither half can be paid out — the bill stops at zero', () => {
  const r = maryland({ agi: 15_000, earnedIncome: 15_000, county: 'Dorchester County' });
  assert.ok(r.tax >= 0, 'the state half is capped at the state tax');
  assert.ok(r.localTaxes[0].tax >= 0, 'and the county half at the county tax');
  money(r.totalTax, 0);
  // 5% of $15,000 is $750 and the whole Maryland bill is under $200, so the
  // credit is nowhere near binding. Its cap is.
  assert.ok(creditNamed(r, 'Maryland poverty level credit') < 750);
});

test('it is a cliff at the guideline, and the cliff is what it costs', () => {
  const under = maryland({ agi: 15_959, earnedIncome: 15_959 });
  const over = maryland({ agi: 15_961, earnedIncome: 15_961 });
  money(under.totalTax, 0, 'forgiven entirely one dollar under');
  assert.ok(over.totalTax > 100, 'and charged in full one dollar over');
  // Two dollars of income, $200.66 of Maryland tax.
  assert.ok(over.totalTax - under.totalTax > 150);
});

test('the guideline grows with the household and the caller can override it', () => {
  // A family of four: $15,960 + three x $5,680 = $33,000, which is more than
  // twice the single filer's guideline on the same schedule.
  const family = { filingStatus: 'marriedFilingJointly', dependentAges: [4, 9] };
  money(maryland({ ...family, agi: 32_999, earnedIncome: 32_999 }).totalTax, 0);
  assert.ok(maryland({ ...family, agi: 33_001, earnedIncome: 33_001 }).totalTax > 0);
  // And the caller's own figure wins, because HHS republishes in January for a
  // year that has already started.
  const overridden = maryland({
    ...family,
    agi: 33_001,
    earnedIncome: 33_001,
    federalPovertyGuideline: 34_000,
  });
  money(overridden.totalTax, 0);
});

test('both income tests are separate, and a pension fails the first one', () => {
  // $9,000 of wages and $40,000 of pension. Earned income passes; federal AGI
  // does not, and § 10-709(a)(3)(i) reads the ADDITIONS, not the subtractions,
  // so no Maryland pension exclusion can buy this filer in.
  const r = maryland({
    agi: 49_000,
    earnedIncome: 9_000,
    filerAge: 66,
    retirement: { filer: { employerPlanPension: 40_000 } },
  });
  money(creditNamed(r, 'Maryland poverty level credit'), 0);
  assert.ok(r.totalTax > 0);
});

test('a filer who supplies no earnedIncome gets nothing, by construction', () => {
  const r = maryland({ agi: 15_000 });
  money(creditNamed(r, 'Maryland poverty level credit'), 0);
  assert.ok(r.totalTax > 0, 'and is charged the whole bill');
});

test('the earned income credit is subtracted first, and can leave nothing', () => {
  // § 10-709(a)(3)(iv): a filer whose earned income credit already exceeds the
  // tax is not an eligible low income taxpayer. Maryland matches a childless
  // federal credit at 100%.
  const r = maryland({ agi: 15_000, earnedIncome: 15_000, eitc: 5_000 });
  money(creditNamed(r, 'Maryland poverty level credit'), 0, 'the EITC covered the tax');
  // And the bill is negative rather than zero, because Maryland's childless
  // match is refundable at 100% — the poverty level credit had nothing left to
  // forgive, which is exactly what § 10-709(a)(3)(iv) tests for.
  assert.ok(r.tax < 0);
});

test('the credit is described in the state notes with both rates', () => {
  const notes = maryland({ agi: 15_000, earnedIncome: 15_000 }).notes.join(' ');
  assert.match(notes, /poverty level credit/i);
  assert.match(notes, /2\.25% in Worcester/);
});
