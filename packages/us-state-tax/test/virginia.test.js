// Virginia. A graduated tax whose graduation is worth $257.50 to everybody, a
// deduction withdrawn at 100%, a published ceiling that cannot be reached, and
// two poverty floors set by two different governments.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getStateDefinition, stateIncomeTax } from '../dist/esm/index.js';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

const federal = (agi, extra = {}) => ({
  adjustedGrossIncome: agi,
  // Virginia reads none of these: its base is line 11 and nothing below it.
  taxableIncome: Math.max(0, agi - 15_750),
  deduction: 15_750,
  deductionKind: 'standard',
  ...extra,
});

const va = (agi, opts = {}) =>
  stateIncomeTax({
    state: 'VA',
    year: opts.year ?? 2025,
    filingStatus: opts.filingStatus ?? 'single',
    federal: federal(agi, opts.fed ?? {}),
    ...opts,
  });

const creditNamed = (result, fragment) =>
  result.credits.find((c) => c.name.toLowerCase().includes(fragment))?.amount ?? 0;

/** The schedule walked by hand, as a check on the engine walking it. */
const scheduleTax = (taxable) => {
  let t = 0;
  t += Math.min(taxable, 3_000) * 0.02;
  t += Math.min(Math.max(taxable - 3_000, 0), 2_000) * 0.03;
  t += Math.min(Math.max(taxable - 5_000, 0), 12_000) * 0.05;
  t += Math.max(taxable - 17_000, 0) * 0.0575;
  return t;
};

// ---------------------------------------------------------------------------
// The schedule, and the fact that it is the same one for everybody
// ---------------------------------------------------------------------------

test('every filing status walks the same four brackets', () => {
  const def = getStateDefinition('VA', 2025);
  assert.equal(def.rate.kind, 'brackets');
  const schedules = Object.values(def.rate.byStatus);
  for (const s of schedules) assert.deepEqual(s, schedules[0]);
  // And the top band starts at $17,000 for all of them, which is the whole
  // reason the spouse tax adjustment exists.
  assert.equal(schedules[0][2].upTo, 17_000);
  assert.equal(schedules[0][3].rate, 0.0575);
});

test('the entire value of Virginia’s graduation is $257.50, at every income', () => {
  // Below $17,000 the graduation is worth less; at and above it the saving is
  // fixed forever, because every dollar past $17,000 is charged at the flat top
  // rate on both counts.
  for (const taxable of [17_000, 25_000, 50_000, 250_000, 5_000_000]) {
    money(taxable * 0.0575 - scheduleTax(taxable), 257.5, `graduation benefit at ${taxable}`);
  }
});

test('a single filer on $60,000 owes $2,635.90', () => {
  const r = va(60_000);
  money(r.taxableIncome, 50_320, 'taxable income'); // 60,000 - 8,750 - 930
  money(r.tax, 2_635.9);
  money(r.marginalRate, 0.0575);
});

// ---------------------------------------------------------------------------
// The spouse tax adjustment, and the ceiling that cannot be reached
// ---------------------------------------------------------------------------

test('the spouse tax adjustment is claimed only where both spouses had income', () => {
  const without = va(60_000, { filingStatus: 'marriedFilingJointly' });
  const with_ = va(60_000, {
    filingStatus: 'marriedFilingJointly',
    bothSpousesHaveQualifyingIncome: true,
  });
  money(without.tax, 2_079.3);
  money(with_.tax, 1_821.8);
  money(without.tax - with_.tax, 257.5, 'the adjustment');
});

test('the published $259 ceiling is $1.50 above anything the worksheet can produce', () => {
  const def = getStateDefinition('VA', 2025);
  assert.equal(def.spouseTaxAdjustment.cap, 259);

  // Search the whole surface: joint taxable income against every split of it.
  // The maximum is the graduation benefit, $257.50, and it is reached whenever
  // both spouses clear $17,000 — so the cap is dead law rather than a limit.
  let max = 0;
  for (let taxable = 0; taxable <= 250_000; taxable += 131) {
    for (const smaller of [0, 500, 3_000, 5_000, 17_000, 25_000, taxable / 2, taxable / 3]) {
      const r = stateIncomeTax({
        state: 'VA',
        year: 2025,
        filingStatus: 'marriedFilingJointly',
        // 17,500 standard deduction + 1,860 of exemptions puts taxable income
        // exactly where this loop wants it.
        federal: federal(taxable + 19_360),
        bothSpousesHaveQualifyingIncome: true,
        lesserSpouseIncome: smaller,
      });
      max = Math.max(max, creditNamed(r, 'spouse tax adjustment'));
    }
  }
  money(max, 257.5, 'the largest adjustment reachable');
  assert.ok(max < def.spouseTaxAdjustment.cap, 'the cap must never bind');
});

test('an uneven split is worth less, and the assumption is named in the credit line', () => {
  const even = va(79_360, {
    filingStatus: 'marriedFilingJointly',
    bothSpousesHaveQualifyingIncome: true,
  });
  const uneven = va(79_360, {
    filingStatus: 'marriedFilingJointly',
    bothSpousesHaveQualifyingIncome: true,
    lesserSpouseIncome: 5_000,
  });
  money(creditNamed(even, 'spouse tax adjustment'), 257.5);
  money(creditNamed(uneven, 'spouse tax adjustment'), 167.5);
  const assumed = even.credits.find((c) => c.name.startsWith('Spouse tax adjustment'));
  assert.match(assumed.name, /assumed/);
  assert.match(assumed.name, /lesserSpouseIncome/);
});

// ---------------------------------------------------------------------------
// The age deduction: a 100% withdrawal rate, and 11.5%
// ---------------------------------------------------------------------------

test('the age deduction band is taxed at 11.5%, twice the top statutory rate', () => {
  const single = va(55_000, { filerAge: 70 });
  money(single.marginalRate, 0.115, 'single 65+ inside the band');
  // 5.75% on both sides of it.
  money(va(45_000, { filerAge: 70 }).marginalRate, 0.0575);
  money(va(65_000, { filerAge: 70 }).marginalRate, 0.0575);
});

test('two 65-year-old spouses face the 11.5% band for $24,000, not $12,000', () => {
  const joint = (agi) =>
    va(agi, { filingStatus: 'marriedFilingJointly', filerAge: 70, spouseAge: 70 });
  money(joint(74_000).marginalRate, 0.0575, 'below the threshold');
  money(joint(80_000).marginalRate, 0.115);
  money(joint(98_000).marginalRate, 0.115, 'still inside at $98,000');
  money(joint(100_000).marginalRate, 0.0575, 'exhausted at $99,000');
  // The deduction is withdrawn dollar for dollar, so it is exactly the excess.
  const at80 = joint(80_000).computedSubtractions.find((s) => s.name === 'Age deduction');
  money(at80.amount, 19_000, '24,000 less 5,000 of excess');
});

test('taxable Social Security moves the age test and the base in the same direction', () => {
  const withSs = va(90_000, {
    filingStatus: 'marriedFilingJointly',
    filerAge: 70,
    spouseAge: 70,
    taxableSocialSecurity: 30_000,
  });
  const withoutSs = va(90_000, {
    filingStatus: 'marriedFilingJointly',
    filerAge: 70,
    spouseAge: 70,
  });
  // Adjusted federal AGI is $60,000, below the $75,000 threshold, so the whole
  // $24,000 survives — and the $30,000 comes out of the base as well.
  const subs = withSs.computedSubtractions;
  money(subs.find((s) => s.name.startsWith('Social Security')).amount, 30_000);
  money(subs.find((s) => s.name === 'Age deduction').amount, 24_000);
  money(withoutSs.computedSubtractions.find((s) => s.name === 'Age deduction').amount, 9_000);
});

test('a filer born before 1939 is not income-tested at all', () => {
  // Age 88 in 2025 is the 1937 cohort: the full $12,000 at $300,000 of income.
  const older = va(300_000, { filerAge: 88 });
  const younger = va(300_000, { filerAge: 80 });
  money(
    older.computedSubtractions.find((s) => s.name === 'Age deduction').amount,
    12_000,
    'untested cohort',
  );
  assert.equal(younger.computedSubtractions.length, 0);
  money(younger.tax - older.tax, 690, '12,000 at 5.75%');
});

// ---------------------------------------------------------------------------
// The two floors, and the cliff that moves with family size
// ---------------------------------------------------------------------------

const jumpAt = (agi, opts) => va(agi + 1, opts).tax - va(agi, opts).tax;

test('the statutory filing threshold produces no cliff for a single filer', () => {
  // The Credit for Low Income Individuals has already zeroed the tax, and goes
  // on doing so for another $3,700.
  money(jumpAt(11_950), 0, 'at the filing threshold');
  money(va(11_951).tax, 0);
});

test('the cliff that exists is at the poverty guideline, and it is larger', () => {
  money(jumpAt(15_650), 168.55, 'single, at the 2025 guideline');
  // A childless couple is the other way round: their guideline is BELOW the
  // joint filing threshold, so the threshold binds.
  money(jumpAt(21_150, { filingStatus: 'marriedFilingJointly' }), 0);
  money(jumpAt(23_900, { filingStatus: 'marriedFilingJointly' }), 106.23);
  // And a family of four is back to the guideline, for their whole tax.
  const four = { filingStatus: 'marriedFilingJointly', dependents: 2 };
  money(jumpAt(23_900, four), 0);
  money(jumpAt(32_150, four), 416.55);
});

test('a federal earned income credit removes the Virginia cliff entirely', () => {
  const four = {
    filingStatus: 'marriedFilingJointly',
    dependents: 2,
    fed: { earnedIncomeCredit: 4_000 },
  };
  // The refundable 20% match beats the $1,200 non-refundable credit because the
  // family's Virginia tax is smaller than either, so nothing is lost at the
  // guideline — the same family without the federal credit loses $416.55.
  money(jumpAt(32_150, four), 0.05, 'the 5% bracket and nothing else');
  money(va(32_150, four).tax, -383.5);
});

test('the low income credit and the earned income credit are alternatives', () => {
  const poor = va(14_000);
  assert.equal(creditNamed(poor, 'low income'), 300);
  assert.equal(creditNamed(poor, 'earned income'), 0, 'never both');

  const working = va(21_000, {
    filingStatus: 'headOfHousehold',
    dependents: 1,
    fed: { earnedIncomeCredit: 4_328 },
  });
  money(creditNamed(working, 'earned income'), 865.6);
  assert.equal(creditNamed(working, 'low income'), 0);
  money(working.tax, -476.1, 'refundable, so the state pays');
});

test('the age deduction disqualifies a filer from the low income credit', () => {
  // § 58.1-339.8(D). A 70-year-old with $14,000 of income has an age deduction,
  // so the $300 credit is gone — and their tax is zero either way, which is the
  // point: the disqualification costs nothing to exactly the filers it hits.
  const old = va(14_000, { filerAge: 70 });
  assert.equal(creditNamed(old, 'low income'), 0);
  money(old.tax, 0);
});

// ---------------------------------------------------------------------------
// Deductions, exemptions, and the year
// ---------------------------------------------------------------------------

test('itemizing federally compels itemizing in Virginia, even when it costs money', () => {
  const forced = va(60_000, {
    fed: { deductionKind: 'itemized', deduction: 14_000 },
    stateItemizedDeductions: 8_000,
  });
  // $8,000 rather than the $8,750 standard deduction the filer is barred from.
  money(forced.deduction, 8_000);
  money(forced.taxableIncome, 51_070);
  // Without the state figure the engine falls back rather than returning zero.
  const fallback = va(60_000, { fed: { deductionKind: 'itemized', deduction: 14_000 } });
  money(fallback.deduction, 8_750);
});

test('2026 carries the same parameters, and says so rather than guessing', () => {
  const d25 = getStateDefinition('VA', 2025);
  const d26 = getStateDefinition('VA', 2026);
  assert.equal(d26.status, 'published');
  assert.deepEqual(d26.rate, d25.rate);
  assert.deepEqual(d26.deduction, d25.deduction);
  // The poverty guideline is the one figure that moves: HHS republishes it every
  // January and the credit is tested against the year's own table.
  assert.equal(d25.lowIncomeCredit.povertyGuideline.firstPerson, 15_650);
  assert.equal(d26.lowIncomeCredit.povertyGuideline.firstPerson, 15_960);
  money(va(60_000, { year: 2026 }).tax, 2_635.9);
});

test('Virginia has no local income tax, and the result says so with an empty list', () => {
  const r = va(60_000);
  assert.deepEqual(r.localTaxes, []);
  money(r.totalTax, r.tax);
  assert.ok(
    r.notes.some((n) => n.includes('NO local income tax')),
    'the absence is stated, not left to inference',
  );
});
