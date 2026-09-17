// Utah's child tax credit — Utah Code § 59-10-1047.
//
// The Utah retirement credits found a 15.26% marginal rate in a 4.45% state.
// This one is worse, and for the same structural reason one level over: the
// credit is withdrawn at TEN cents on the dollar, which is 2.2 times the rate
// of the tax it offsets, so the withdrawal is a bigger tax than the tax.
//
// Two things here are not in any summary of the provision:
//
//  1. The withdrawal overlaps the Utah earned income credit's withdrawal and
//     the Taxpayer Tax Credit's, and all three sit under the statutory rate.
//     A working Utah couple with two children reaches **20.00%** on the next
//     dollar — four and a half times the rate the state advertises, and more
//     than the 15.26% a retiree faces.
//  2. A family with MORE eligible children can face a LOWER rate, because the
//     withdrawal rate is fixed and the band's length scales with the credit:
//     $2,000 of credit takes $20,000 of income to withdraw and ends past the
//     earned income credit's own band, where $1,000 ends inside it.
//
// And one fact about the *income* the credit is withdrawn against, which is the
// part that cannot be expressed by a package with one "state income" figure:
// § 59-10-1047(4) reads TC-40 line 9, after Utah subtractions, where the
// retirement credits of §§ 59-10-1019 and 1042 read line 6, before them.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { stateIncomeTax } from '../dist/esm/index.js';
import { estimateFederalTax } from '../../us-federal-tax/dist/esm/index.js';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

const creditNamed = (result, fragment) =>
  result.credits.find((c) => c.name.toLowerCase().includes(fragment.toLowerCase()));

/** A Utah family return, computed the way a caller would: federal first. */
function family({
  wages,
  childAges = [],
  filingStatus = 'marriedFilingJointly',
  year = 2026,
  taxExemptInterest = 0,
  subtractions = 0,
}) {
  const fed = estimateFederalTax({
    filingStatus,
    year,
    w2Wages: wages,
    age: 38,
    qualifyingChildren: childAges.filter((a) => a < 17).length,
    eitcQualifyingChildren: childAges.length,
    taxExemptInterest,
  });
  return stateIncomeTax({
    state: 'UT',
    year,
    filingStatus,
    federal: {
      adjustedGrossIncome: fed.adjustedGrossIncome,
      taxableIncome: fed.taxableIncome,
      deduction: fed.deduction,
      deductionKind: fed.deductionKind,
      earnedIncomeCredit: fed.credits.earnedIncomeCredit?.credit ?? 0,
    },
    dependents: childAges.length || undefined,
    dependentAges: childAges.length ? childAges : undefined,
    earnedIncome: wages,
    taxExemptInterest,
    subtractions: subtractions || undefined,
  });
}

const creditAt = (opts) => creditNamed(family(opts), 'child tax credit')?.amount ?? 0;

// ---------------------------------------------------------------------------
// The credit itself.
// ---------------------------------------------------------------------------

test('$1,000 for each child under 6, below the threshold', () => {
  money(creditAt({ wages: 40_000, childAges: [1, 4] }), 2_000);
});

test('the sixth birthday ends it, and nothing on the return says why', () => {
  money(creditAt({ wages: 40_000, childAges: [5] }), 1_000, 'age 5');
  money(creditAt({ wages: 40_000, childAges: [6] }), 0, 'age 6');
});

test('a newborn qualifies — HB 106 (2025) widened the 1-to-3 band of 2024', () => {
  money(creditAt({ wages: 40_000, childAges: [0] }), 1_000);
});

// ---------------------------------------------------------------------------
// The withdrawal: ten cents on the dollar, no step.
// ---------------------------------------------------------------------------

test('ten cents on the dollar above $61,000 joint, in 2026', () => {
  money(creditAt({ wages: 61_000, childAges: [3] }), 1_000, 'at the threshold');
  money(creditAt({ wages: 66_000, childAges: [3] }), 500, '$5,000 over');
  money(creditAt({ wages: 71_000, childAges: [3] }), 0, 'gone');
});

test('it is a rate and not a staircase — one dollar costs ten cents', () => {
  const at = (w) => creditAt({ wages: w, childAges: [3] });
  money(at(62_000) - at(61_999), -0.1, 'one dollar of income');
});

test('HB 290 raised the 2026 thresholds; 2025 keeps the originals', () => {
  money(creditAt({ wages: 55_000, childAges: [3], year: 2026 }), 1_000, '2026 under');
  money(creditAt({ wages: 55_000, childAges: [3], year: 2025 }), 900, '2025 over');
});

test('the threshold is by filing status, and separate is not half of single', () => {
  // $49,000 single, $61,000 joint, $30,500 separate in 2026. A separate filer's
  // threshold is 62% of a single filer's, not 50%.
  money(creditAt({ wages: 50_000, childAges: [3], filingStatus: 'single' }), 900);
  money(
    creditAt({ wages: 50_000, childAges: [3], filingStatus: 'marriedFilingSeparately' }),
    0,
    'separate is gone by $40,500',
  );
  money(
    creditAt({ wages: 50_000, childAges: [3], filingStatus: 'headOfHousehold' }),
    900,
    'head of household shares the single threshold',
  );
});

// ---------------------------------------------------------------------------
// The income the withdrawal is measured against — the part a single "state
// income" figure cannot express.
// ---------------------------------------------------------------------------

test('tax-exempt interest is added back, as it is for the retirement credits', () => {
  money(creditAt({ wages: 61_000, childAges: [3] }), 1_000, 'no coupon');
  money(
    creditAt({ wages: 61_000, childAges: [3], taxExemptInterest: 4_000 }),
    600,
    '$4,000 of municipal interest costs $400 of Utah child credit',
  );
});

test('a Utah SUBTRACTION buys back child credit and does nothing for a retiree credit', () => {
  // § 59-10-1047(4) measures TC-40 line 9, after subtractions; §§ 59-10-1019
  // and 1042 measure line 6, before them. Same return, same year, two figures.
  money(creditAt({ wages: 66_000, childAges: [3] }), 500, 'no subtraction');
  money(
    creditAt({ wages: 66_000, childAges: [3], subtractions: 5_000 }),
    1_000,
    'a $5,000 subtraction restores the whole credit',
  );

  // And the other half of the claim, which is the half that makes it a finding:
  // the same subtraction on a retiree's return moves the Social Security
  // Benefits Credit not at all, because that one reads line 6.
  const retiree = (subtractions) =>
    stateIncomeTax({
      state: 'UT',
      year: 2026,
      filingStatus: 'marriedFilingJointly',
      federal: { adjustedGrossIncome: 100_000, deduction: 0, deductionKind: 'standard' },
      taxableSocialSecurity: 20_000,
      filerAge: 70,
      spouseAge: 70,
      subtractions,
    });
  const ss = (r) => creditNamed(r, 'social security')?.amount ?? 0;
  money(ss(retiree(5_000)) - ss(retiree(0)), 0, 'the retirement credit does not move');
});

// ---------------------------------------------------------------------------
// What the withdrawal does to the marginal rate, which is the finding.
// ---------------------------------------------------------------------------

const marginal = (opts) =>
  family({ ...opts, wages: opts.wages + 1 }).tax - family(opts).tax;

test('a working couple with two children reaches 20.00% in a 4.45% state', () => {
  // 4.45 (the rate) + 10 (this credit) + 1.3 (the Taxpayer Tax Credit) +
  // 4.212 (20% of the federal earned income credit's 21.06% withdrawal)
  // = 19.962, and the last of the four is rounded in the federal credit.
  money(marginal({ wages: 64_200, childAges: [3, 8] }), 0.2, 'per dollar');
});

test('that is higher than the 15.26% a Utah retiree faces', () => {
  assert.ok(marginal({ wages: 64_200, childAges: [3, 8] }) > 0.1526);
});

test('MORE eligible children can mean a LOWER rate', () => {
  // Two children under 6 is $2,000 of credit, which takes $20,000 of income to
  // withdraw and so ends past the earned income credit's band rather than
  // inside it. The family with more young children faces 16% where the family
  // with one faces 20%.
  const one = marginal({ wages: 64_200, childAges: [3, 8] });
  const two = (() => {
    let peak = 0;
    for (let w = 55_000; w <= 90_000; w += 100) {
      peak = Math.max(peak, marginal({ wages: w, childAges: [2, 4] }));
    }
    return peak;
  })();
  money(two, 0.16, 'two children under 6');
  assert.ok(two < one, 'the bigger credit ends in the lower peak rate');
});

test('a single parent faces 19% on the same overlap', () => {
  money(marginal({ wages: 50_500, childAges: [3], filingStatus: 'headOfHousehold' }), 0.19);
});

// ---------------------------------------------------------------------------
// Non-refundable, which is what decides who the credit is actually for.
// ---------------------------------------------------------------------------

test('the credit is non-refundable, so a family with no Utah tax gets nothing', () => {
  const low = family({ wages: 25_000, childAges: [3] });
  assert.equal(creditNamed(low, 'child tax credit').refundable, false);
  money(low.tax, 0, 'tax floors at zero rather than paying out');
});
