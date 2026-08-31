/**
 * Every number quoted in README.md, recomputed.
 *
 * Day 1 of this repository shipped a README with a figure that was $4 wrong,
 * and it was caught only because the numbers were verified programmatically.
 * The rule since: a number in the docs is a claim, and a claim gets a test.
 *
 * These assertions read the README itself rather than restating its figures, so
 * editing prose without editing the arithmetic fails here.
 */
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { estimateFederalTax, getYearParameters, handleMessage, standardDeduction } from '../dist/index.js';

const README = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '..', 'README.md'),
  'utf8',
);

/** Assert the README literally contains this text. */
function quotes(text) {
  assert.ok(README.includes(text), `README does not contain ${JSON.stringify(text)}`);
}

function marginalRate(household, delta = 1000) {
  const base = estimateFederalTax(household);
  const field =
    household.selfEmploymentNetProfit !== undefined
      ? 'selfEmploymentNetProfit'
      : household.otherOrdinaryIncome !== undefined
        ? 'otherOrdinaryIncome'
        : 'w2Wages';
  const bumped = estimateFederalTax({ ...household, [field]: household[field] + delta });
  return {
    bracket: base.marginalRate,
    rate: (bumped.balanceDue - base.balanceDue) / delta,
  };
}

test('the three marginal-rate rows are what the engine computes', () => {
  const rows = [
    [{ filingStatus: 'headOfHousehold', w2Wages: 30000, qualifyingChildren: 2, year: 2026 }, 0.1, 0.2106],
    [{ filingStatus: 'headOfHousehold', w2Wages: 45000, qualifyingChildren: 1, year: 2026 }, 0.12, 0.2798],
    [
      {
        filingStatus: 'marriedFilingJointly',
        otherOrdinaryIncome: 560000,
        stateAndLocalTaxesPaid: 60000,
        otherItemizedDeductions: 20000,
        year: 2026,
      },
      0.35,
      0.455,
    ],
  ];
  for (const [household, bracket, expected] of rows) {
    const measured = marginalRate(household);
    assert.equal(measured.bracket, bracket, `bracket for ${JSON.stringify(household)}`);
    assert.ok(
      Math.abs(measured.rate - expected) < 0.0001,
      `expected ${expected}, measured ${measured.rate} for ${JSON.stringify(household)}`,
    );
  }
  quotes('| Head of household, 2 children, $30,000 | 10% | **21.06%** |');
  quotes('| Head of household, 1 child, $45,000 | 12% | **27.98%** |');
  quotes('| Joint, $560,000, $60,000 of state tax | 35% | **45.5%** |');
});

test('the worked example block is exactly what the tool returns', () => {
  const response = handleMessage({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'estimate_federal_tax',
      arguments: { filingStatus: 'headOfHousehold', w2Wages: 30000, qualifyingChildren: 2, year: 2026 },
    },
  });
  const text = response.result.content[0].text;
  for (const line of [
    'Gross income                            $30,000.00',
    'Deduction (standard)                    $24,150.00',
    'Taxable income                           $5,850.00',
    'Ordinary income tax                        $585.00',
    'Child tax credit (§ 24)                  $4,400.00',
    '  applied against income tax               $585.00',
    '  refundable (ACTC)                      $3,400.00',
    '  unused (neither offset nor paid)         $415.00',
    'Earned income credit (§ 32)              $6,029.23',
    'Total tax                                    $0.00',
    'REFUND                                   $9,429.23',
    'Marginal ordinary rate (bracket)               10%',
  ]) {
    assert.ok(text.includes(line), `the tool no longer emits: ${line}`);
    quotes(line);
  }
});

test('the marginal-rate example block is exactly what the tool returns', () => {
  const response = handleMessage({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'effective_marginal_rate',
      arguments: { filingStatus: 'headOfHousehold', w2Wages: 30000, qualifyingChildren: 2, year: 2026 },
    },
  });
  const text = response.result.content[0].text;
  for (const line of [
    'Ordinary tax bracket                           10%',
    'TRUE MARGINAL RATE                          21.06%',
    'Cost of the extra income                   $210.60',
    'You keep                                   $789.40',
    '  Ordinary income tax                      $100.00',
    '  Earned income credit withdrawn           $210.60',
  ]) {
    assert.ok(text.includes(line), `the tool no longer emits: ${line}`);
    quotes(line);
  }
});

test('the 2025 retroactivity table matches the shipped parameters', () => {
  const actual = {
    single: 15750,
    marriedFilingJointly: 31500,
    headOfHousehold: 23625,
  };
  for (const [filingStatus, expected] of Object.entries(actual)) {
    assert.equal(standardDeduction({ filingStatus, year: 2025 }), expected);
  }
  quotes('| Standard deduction | $15,000 / $30,000 / $22,500 | **$15,750 / $31,500 / $23,625** |');

  const params2025 = getYearParameters(2025);
  assert.equal(params2025.saltCap.cap.marriedFilingJointly, 40000);
  assert.equal(params2025.saltCap.phaseDownThreshold.marriedFilingJointly, 500000);
  quotes('| SALT cap | $10,000 | **$40,000**, phasing down above $500,000 |');

  assert.equal(params2025.childTaxCredit.amountPerChild, 2200);
  quotes('| Child tax credit | $2,000 | **$2,200** |');

  assert.notEqual(params2025.scheduleOneA, null, 'Schedule 1-A is live in 2025');
  assert.equal(getYearParameters(2024).scheduleOneA, null, 'Schedule 1-A did not exist in 2024');
});

test('the two OBBBA provisions the README calls non-retroactive really are', () => {
  assert.equal(getYearParameters(2025).section199A.minimumDeduction, null);
  assert.notEqual(getYearParameters(2026).section199A.minimumDeduction, null);
  assert.equal(getYearParameters(2025).section199A.phaseInRange.marriedFilingJointly, 100000);
  assert.equal(getYearParameters(2026).section199A.phaseInRange.marriedFilingJointly, 150000);
  quotes('both start in 2026');
});

test('the 2024 rate-schedule correction is derived, not transcribed', () => {
  // The IRS printed $99,334.75 and corrected it to $98,334.75 on 2025-01-08.
  // This engine stores no base-tax column, so the right figure falls out of
  // walking the bands — it cannot express the typo.
  const atThreshold = estimateFederalTax({
    filingStatus: 'marriedFilingSeparately',
    otherOrdinaryIncome: 365600 + 14600, // taxable income exactly $365,600
    year: 2024,
  });
  assert.equal(atThreshold.taxableIncome, 365600);
  assert.equal(atThreshold.ordinaryIncomeTax, 98334.75);
  assert.notEqual(atThreshold.ordinaryIncomeTax, 99334.75);
  quotes('**$98,334.75** + 37%, not the');
  quotes('$99,334.75');
});

test('the corrected 2026 EITC endpoint is the reissued figure', () => {
  // The completed phase-out is DERIVED from the two stored parameters rather
  // than transcribed from the IRS's convenience column, which turns that column
  // into a test of the inputs instead of a second copy of them. It is also how
  // the 2025-10-17 reissue lands here automatically.
  const row = getYearParameters(2026).earnedIncomeCredit.table[3];
  const endpoint =
    row.phaseOutStart.marriedFilingJointly + row.maximumCredit / row.phaseOutRate;
  assert.equal(Math.round(endpoint), 70244);
  assert.notEqual(Math.round(endpoint), 70224);
  quotes('from $70,224 to **$70,244**');
});

test('the EITC joint add-on really does split for 2026', () => {
  // § 32(b)(2)(B) adds one inflation-adjusted amount for a joint return, but the
  // IRS rounds the resulting SUM to the nearest $10 rather than the addend — so
  // the effective add-on differs between the childless table and the rest.
  const table = getYearParameters(2026).earnedIncomeCredit.table;
  const addOn = (row) => row.phaseOutStart.marriedFilingJointly - row.phaseOutStart.single;
  assert.equal(addOn(table[0]), 7280);
  for (const row of table.slice(1)) assert.equal(addOn(row), 7270);
  quotes('$7,280 with no children and $7,270');
});

test('the self-employment claim about credits is exact', () => {
  const estimate = estimateFederalTax({
    filingStatus: 'headOfHousehold',
    selfEmploymentNetProfit: 30000,
    qualifyingChildren: 1,
    year: 2026,
  });
  assert.equal(estimate.incomeTaxBeforeCredits, 373.06);
  assert.equal(estimate.selfEmployment.total, 4238.87);
  // The credit erases the income tax and none of the SE tax.
  assert.equal(estimate.totalTax, estimate.selfEmployment.total);
  quotes('owes $373.06 of income tax and');
  quotes('$4,238.87 of SE tax');
});

test('the § 68 bound quoted in the coverage section matches the 37% thresholds', () => {
  const brackets = getYearParameters(2026).ordinaryBrackets;
  assert.equal(brackets.single.at(-2).upTo, 640600);
  assert.equal(brackets.marriedFilingJointly.at(-2).upTo, 768700);
  quotes('above $640,600 ($768,700 joint)');
});

test('the test counts the README advertises are the real ones', () => {
  // Deliberately brittle: if the suites grow, this fails and the README gets
  // updated, rather than quietly overstating or understating the coverage.
  const claimed = /\*\*(\d+) tests\*\*[\s\S]*?\*\*(\d+) more\*\*/.exec(README);
  assert.ok(claimed, 'README no longer states both test counts in the expected shape');
  assert.equal(claimed[1], '238', 'engine test count in the README is stale');
  assert.equal(claimed[2], '62', 'this package\'s test count in the README is stale');
});

test('the client configuration in the README is the one that actually works', () => {
  quotes('"command": "npx"');
  quotes('"args": ["-y", "us-tax-mcp"]');
});
