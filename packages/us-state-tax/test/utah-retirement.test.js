// Utah's three retirement credits — Utah Code §§ 59-10-1019, 1042 and 1043.
//
// This is the FOURTH way a state in this package exempts retirement income and
// the first that is a credit rather than a subtraction. Georgia measures the
// character of the income, Maryland the form of the account, Kentucky who the
// employer was and when the service was performed; Utah does not measure the
// income at all. It charges the tax and hands it back, and then withdraws the
// refund as income rises.
//
// Two consequences that a subtraction does not have and that these tests pin:
//
//  1. A credit is worth its face value rather than the filer's marginal rate,
//     so the same provision is flat where a subtraction is progressive.
//  2. Withdrawing a credit is a rate increase that lives UNDERNEATH the rate
//     schedule, so it compounds with the federal § 86 inclusion rather than
//     replacing it — 1.85 x 8.25% = 15.26% in a state that advertises 4.45%.
//
// And one structural fact that is the provision rather than a detail of it:
// § 59-10-1019(5) makes the three an ELECTION. A filer takes code 18, or takes
// codes AH and AJ, and never both sides. The last group of tests is about the
// choice rather than about any of the credits.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getStateDefinition, stateIncomeTax } from '../dist/esm/index.js';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

const RATE = { 2025: 0.045, 2026: 0.0445 };

/**
 * A Utah return built from what the household actually has.
 *
 * `agi` is federal AGI and `taxableSocialSecurity` is the § 86 amount inside it,
 * because those are the two figures Utah reads. The federal engine derives the
 * second from the first in the site and in the MCP server; here they are given
 * directly so a failure names a Utah rule rather than a federal one.
 */
const ut = (agi, opts = {}) =>
  stateIncomeTax({
    state: 'UT',
    year: opts.year ?? 2026,
    filingStatus: opts.filingStatus ?? 'marriedFilingJointly',
    federal: {
      adjustedGrossIncome: agi,
      deduction: opts.federalDeduction ?? 0,
      deductionKind: 'standard',
    },
    ...opts,
  });

const creditNamed = (result, fragment) =>
  result.credits.find((c) => c.name.toLowerCase().includes(fragment.toLowerCase()));

// ---------------------------------------------------------------------------
// Code AH — the state's own tax on the benefit, handed back.
// ---------------------------------------------------------------------------

test('the Social Security credit is the state rate on the taxable benefit', () => {
  // TC-40 worksheet line 7: taxable benefit x the § 59-10-104(2) percentage.
  const r = ut(80_000, { taxableSocialSecurity: 30_000 });
  const ah = creditNamed(r, 'Social Security benefits credit');
  money(ah.amount, 30_000 * RATE[2026], 'AH at full value');
});

test('below the threshold the benefit costs a Utah retiree nothing', () => {
  // Two returns with the same total income, one with a benefit in it and one
  // without. If the credit works, the benefit is free.
  const withBenefit = ut(80_000, { taxableSocialSecurity: 30_000 });
  const withoutBenefit = ut(80_000, { taxableSocialSecurity: 0 });
  money(
    withoutBenefit.tax - withBenefit.tax,
    30_000 * RATE[2026],
    'the whole tax on the benefit is handed back',
  );
});

test('the credit is withdrawn at 2.5 cents above $90,000 of modified AGI, joint', () => {
  const at = (agi) => creditNamed(ut(agi, { taxableSocialSecurity: 30_000 }), 'Social Security').amount;
  const full = 30_000 * RATE[2026];
  money(at(90_000), full, 'at the threshold, nothing withdrawn');
  money(at(100_000), full - 0.025 * 10_000, '$10,000 over');
  // $1,335 of credit at 2.5 cents a dollar takes $53,400 of income to destroy,
  // so the withdrawal band is more than half as wide again as the threshold.
  money(at(143_400), 0, 'gone');
  // And it cannot go negative.
  money(at(400_000), 0, 'far past gone');
});

test('the threshold is by filing status, and separate is half of single', () => {
  const thresholds = { single: 54_000, marriedFilingJointly: 90_000, marriedFilingSeparately: 45_000, headOfHousehold: 90_000, qualifyingSurvivingSpouse: 90_000 };
  for (const [status, threshold] of Object.entries(thresholds)) {
    const full = 20_000 * RATE[2026];
    const at = (agi) => creditNamed(ut(agi, { filingStatus: status, taxableSocialSecurity: 20_000 }), 'Social Security').amount;
    money(at(threshold), full, `${status} at the threshold`);
    money(at(threshold + 4_000), full - 100, `${status} $4,000 over`);
  }
});

test('SB 71 raised the thresholds 20% and they are the same in both years', () => {
  // The rate moved between 2025 and 2026 and the thresholds did not, which is
  // the whole reason they are not marked provisional for 2026: there is no
  // indexing mechanism to carry forward, only a statute that has not changed.
  for (const year of [2025, 2026]) {
    const full = 20_000 * RATE[year];
    money(
      creditNamed(ut(90_000, { year, taxableSocialSecurity: 20_000 }), 'Social Security').amount,
      full,
      `${year} at $90,000`,
    );
    money(
      creditNamed(ut(94_000, { year, taxableSocialSecurity: 20_000 }), 'Social Security').amount,
      full - 100,
      `${year} at $94,000`,
    );
  }
});

test('the credit reads the TAXABLE benefit, not the benefit received', () => {
  // A retiree whose benefit § 86 left alone has no Utah credit and needs none:
  // there is no Utah tax on the benefit to hand back.
  const r = ut(30_000, { taxableSocialSecurity: 0 });
  money(creditNamed(r, 'Social Security').amount, 0, 'nothing taxable, nothing credited');
});

// ---------------------------------------------------------------------------
// Tax-exempt interest — the add-back that taxes a municipal bond at 2.5%.
// ---------------------------------------------------------------------------

test('tax-exempt interest is added back into the modified AGI these credits test', () => {
  const plain = ut(90_000, { taxableSocialSecurity: 30_000 });
  const bonds = ut(90_000, { taxableSocialSecurity: 30_000, taxExemptInterest: 10_000 });
  money(bonds.tax - plain.tax, 250, '$10,000 of exempt interest costs $250 of Utah tax');
  // And it is 2.5% exactly — the withdrawal rate, not the tax rate. A bond that
  // is tax-free on its own line is taxed at 2.5% by the return as a whole.
  money((bonds.tax - plain.tax) / 10_000, 0.025, 'the rate on a municipal bond');
});

test('the modified AGI is Utah total income, before Utah subtractions', () => {
  // A caller's `subtractions` reduce Utah taxable income and must NOT buy back
  // a credit the statute withdraws on total income. This is the one place the
  // two figures come apart and it is worth a test of its own.
  const plain = ut(120_000, { taxableSocialSecurity: 30_000 });
  const subtracted = ut(120_000, { taxableSocialSecurity: 30_000, subtractions: 30_000 });
  money(
    creditNamed(plain, 'Social Security').amount,
    creditNamed(subtracted, 'Social Security').amount,
    'the credit is the same either way',
  );
  assert.ok(subtracted.tax < plain.tax, 'the subtraction still reduces the tax');
});

// ---------------------------------------------------------------------------
// Code 18 — a flat credit, a closed cohort, and almost no one who can use it.
// ---------------------------------------------------------------------------

test('the retirement credit is $450 a head for filers born in or before 1952', () => {
  // 2026: born 1952 means aged 74 at the end of the year.
  const both = ut(32_000, { filerAge: 74, spouseAge: 74 });
  money(creditNamed(both, 'code 18').amount, 900, 'two qualifying filers');
  const one = ut(32_000, { filerAge: 74, spouseAge: 73 });
  money(creditNamed(one, 'code 18').amount, 450, 'one qualifying filer');
  const neither = ut(32_000, { filerAge: 73, spouseAge: 73 });
  // With nobody eligible the election falls to the other side, which is worth
  // nothing here either — so the credit that appears is AH at zero.
  assert.equal(creditNamed(neither, 'code 18'), undefined, 'nobody qualifies');
});

test('the birth-year test moves with the tax year, because 1952 does not', () => {
  // 2025: aged 73. 2026: aged 74. The same person ages out of nothing; the
  // cohort simply closes further behind them.
  money(creditNamed(ut(32_000, { year: 2025, filerAge: 73, spouseAge: 73 }), 'code 18').amount, 900, '2025 at 73');
  assert.equal(creditNamed(ut(32_000, { year: 2026, filerAge: 73, spouseAge: 73 }), 'code 18'), undefined, '2026 at 73');
});

test('code 18 is withdrawn at 2.5 cents from $32,000 joint and is gone by $68,000', () => {
  const at = (agi) => creditNamed(ut(agi, { filerAge: 80, spouseAge: 80 }), 'code 18');
  money(at(32_000).amount, 900, 'at the threshold');
  money(at(50_000).amount, 900 - 0.025 * 18_000, '$18,000 over');
  assert.equal(at(68_000), undefined, 'fully withdrawn at $68,000');
  // Single: $450 from $25,000, gone at $43,000.
  const single = (agi) => creditNamed(ut(agi, { filingStatus: 'single', filerAge: 80 }), 'code 18');
  money(single(25_000).amount, 450, 'single at the threshold');
  assert.equal(single(43_000), undefined, 'single, fully withdrawn');
});

// ---------------------------------------------------------------------------
// Code AJ — no phase-out, and it exactly cancels the tax on the pay.
// ---------------------------------------------------------------------------

test('the military credit is the state rate on military retired pay', () => {
  const r = ut(45_000, { retirement: { filer: { militaryRetirement: 45_000 } } });
  money(creditNamed(r, 'military retirement credit').amount, 45_000 * RATE[2026], 'AJ');
});

test('the military credit exactly cancels the Utah tax on that pay', () => {
  // Utah has no deduction of its own, so the tax on a dollar of AGI is the rate
  // and the credit on a dollar of military pay is the same rate. A retiree with
  // nothing else owes nothing, to the cent.
  const r = ut(45_000, { retirement: { filer: { militaryRetirement: 45_000 } } });
  money(r.taxBeforeCredits, 45_000 * RATE[2026], 'tax before credits');
  money(r.tax, 0, 'and nothing left');
});

test('the military credit has no phase-out at all', () => {
  // The only one of the three a high-income Utah retiree keeps.
  const at = (agi) =>
    creditNamed(ut(agi, { retirement: { filer: { militaryRetirement: 60_000 } } }), 'military').amount;
  const full = 60_000 * RATE[2026];
  money(at(60_000), full, 'at $60,000');
  money(at(500_000), full, 'at $500,000');
});

test('the military credit is DEFINED as the rate, so a rate change moves it', () => {
  // § 59-10-1043(2)(a) cross-references § 59-10-104(2). This package reads the
  // rate off the state's own rate rule rather than storing a second copy, which
  // is why these two figures differ by exactly the rate cut and nothing else.
  const pay = { retirement: { filer: { militaryRetirement: 45_000 } } };
  money(creditNamed(ut(45_000, { ...pay, year: 2025 }), 'military').amount, 2_025, '2025 at 4.5%');
  money(creditNamed(ut(45_000, { ...pay, year: 2026 }), 'military').amount, 2_002.5, '2026 at 4.45%');
});

test('military retired pay on the spouse counts, and only on a joint return', () => {
  const spouse = { retirement: { spouse: { militaryRetirement: 40_000 } } };
  money(creditNamed(ut(40_000, spouse), 'military').amount, 40_000 * RATE[2026], 'joint');
  money(
    creditNamed(ut(40_000, { ...spouse, filingStatus: 'single' }), 'Social Security').amount,
    0,
    'a single filer has no spouse to have retired',
  );
});

// ---------------------------------------------------------------------------
// The election — the part that is the provision rather than a detail of it.
// ---------------------------------------------------------------------------

test('only one side of the election is ever claimed', () => {
  const r = ut(50_000, { filerAge: 80, spouseAge: 80, taxableSocialSecurity: 20_000 });
  const claimed = r.credits.filter(
    (c) => c.amount > 0 && /retirement credit|Social Security benefits|military retirement/i.test(c.name),
  );
  assert.equal(claimed.length, 1, 'exactly one retirement credit line');
});

test('the engine takes the larger side, and names it', () => {
  // A benefit big enough to beat $900 of code 18: $20,000 taxable is $890 of AH
  // at $90,000 of AGI, against $900 - 2.5% x $58,000 = $0 of code 18.
  const withBenefit = ut(90_000, { filerAge: 80, spouseAge: 80, taxableSocialSecurity: 20_000 });
  assert.match(creditNamed(withBenefit, 'Social Security').name, /code AH/);
  money(creditNamed(withBenefit, 'Social Security').amount, 20_000 * RATE[2026], 'AH won');

  // And with no benefit at all, code 18 is all there is.
  const without = ut(50_000, { filerAge: 80, spouseAge: 80 });
  assert.match(creditNamed(without, 'code 18').name, /code 18/);
  money(creditNamed(without, 'code 18').amount, 900 - 0.025 * 18_000, 'code 18 won');
});

test('AH and AJ are claimed together, on one line that names both', () => {
  const r = ut(100_000, {
    taxableSocialSecurity: 20_000,
    retirement: { filer: { militaryRetirement: 40_000 } },
  });
  const line = creditNamed(r, 'military');
  assert.match(line.name, /code AH/);
  assert.match(line.name, /code AJ/);
  const ah = 20_000 * RATE[2026] - 0.025 * 10_000;
  money(line.amount, ah + 40_000 * RATE[2026], 'both halves');
});

test('code 18 loses to the pair whenever the pair is worth more', () => {
  // A military retiree born in 1950 would be giving up $1,780 of AJ for at most
  // $900 of code 18. The statute lets them make that mistake; this does not.
  const r = ut(40_000, {
    filerAge: 80,
    spouseAge: 80,
    retirement: { filer: { militaryRetirement: 40_000 } },
  });
  money(creditNamed(r, 'code AJ').amount, 40_000 * RATE[2026], 'AJ, not code 18');
  assert.equal(creditNamed(r, 'code 18'), undefined, 'code 18 not claimed');
});

// ---------------------------------------------------------------------------
// What this is worth, and the shape the numbers make.
// ---------------------------------------------------------------------------

test("code 18's live band is $45,300 to $67,900 and it is worth at most $395", () => {
  // Below the band the Taxpayer Tax Credit has already zeroed the tax, so there
  // is nothing for code 18 to offset; above it the credit itself is gone. The
  // deduction is the 2026 joint standard deduction for a couple both 65, which
  // is what drives the Taxpayer Tax Credit and therefore the lower edge.
  const eligible = (agi) => ut(agi, { filerAge: 80, spouseAge: 80, federalDeduction: 35_500 }).tax;
  const tooYoung = (agi) => ut(agi, { filerAge: 60, spouseAge: 60, federalDeduction: 35_500 }).tax;
  assert.equal(eligible(45_000), tooYoung(45_000), 'below the band, worth nothing');
  assert.ok(tooYoung(52_200) - eligible(52_200) > 390, 'inside the band, worth something');
  assert.equal(eligible(68_000), tooYoung(68_000), 'above the band, worth nothing');
  let best = 0;
  for (let agi = 40_000; agi <= 72_000; agi += 100) best = Math.max(best, tooYoung(agi) - eligible(agi));
  assert.ok(best > 390 && best < 400, `largest saving was ${best}`);
});

test('the three credits are the reason a Utah retiree return was too high', () => {
  // The figures this package returned before v0.17.0, against the figures it
  // returns now, for the same three households.
  const before = (r) => r.taxBeforeCredits - (creditNamed(r, 'Taxpayer')?.amount ?? 0);
  const couple = ut(94_000, { filerAge: 70, spouseAge: 70, taxableSocialSecurity: 34_000, federalDeduction: 35_500 });
  money(Math.max(0, before(couple)) - couple.tax, 1_413, 'a retired couple');
  const veteran = ut(65_000, {
    filingStatus: 'single',
    filerAge: 60,
    federalDeduction: 16_100,
    retirement: { filer: { militaryRetirement: 45_000 } },
  });
  money(Math.max(0, before(veteran)) - veteran.tax, 2_002.5, 'a military retiree');
});

test('the definition says the credits are an election and why', () => {
  const def = getStateDefinition('UT', 2026);
  assert.ok(def.exclusiveRetirementCredits, 'the rule is present');
  assert.match(def.exclusiveRetirementCredits.why, /59-10-1019\(5\)/);
  // Every one of the three is named with its form code, because the code is how
  // a filer finds the credit on the TC-40 and in the state's own guidance.
  assert.match(def.exclusiveRetirementCredits.retirement.name, /code 18/);
  assert.match(def.exclusiveRetirementCredits.socialSecurity.name, /code AH/);
  assert.match(def.exclusiveRetirementCredits.militaryRetirement.name, /code AJ/);
});

test('the notes about code 18 and the military credit are conditional', () => {
  // Three long notes on a state where most returns are neither a 74-year-old's
  // nor a veteran's. They should not be on a working filer's result.
  const MILITARY = 'NO phase-out of any kind';
  const worker = ut(60_000, { filerAge: 40 });
  assert.ok(!worker.notes.some((n) => n.includes(MILITARY)), 'no military note');
  assert.ok(!worker.notes.some((n) => n.includes('dead law')), 'no code 18 note');
  const veteran = ut(60_000, { filerAge: 40, retirement: { filer: { militaryRetirement: 30_000 } } });
  assert.ok(veteran.notes.some((n) => n.includes(MILITARY)), 'the military note appears');
  const old = ut(60_000, { filerAge: 78, spouseAge: 78 });
  assert.ok(old.notes.some((n) => n.includes('dead law')), 'the code 18 note appears');
});
