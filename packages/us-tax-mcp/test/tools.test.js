/**
 * What the tools compute, and what they say about it.
 *
 * The engine's own arithmetic is tested in `packages/us-federal-tax` — 238
 * tests against hand-computed figures. These tests are about the layer on top:
 * that the plumbing does not lose an input, that the numbers a model reads in
 * the text block are the same numbers a program reads in structuredContent, and
 * that the two derived tools (`compare_tax_years`, `effective_marginal_rate`)
 * are internally consistent.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';

import {
  TOOLS,
  estimateFederalTax,
  findTool,
  handleMessage,
  stateIncomeTax,
} from '../dist/index.js';

/** Call a tool the way a client would, and return the parsed result. */
function call(name, args) {
  const response = handleMessage({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name, arguments: args },
  });
  assert.ok(!('error' in response), `tools/call returned a protocol error: ${JSON.stringify(response)}`);
  return response.result;
}

function ok(name, args) {
  const result = call(name, args);
  assert.equal(result.isError, false, `expected success, got: ${result.content[0].text}`);
  return { text: result.content[0].text, structured: result.structuredContent };
}

function err(name, args) {
  const result = call(name, args);
  assert.equal(result.isError, true, 'expected a tool error');
  return result.content[0].text;
}

// ---------------------------------------------------------------------------
// The wrapper does not change the answer
// ---------------------------------------------------------------------------

test('estimate_federal_tax returns exactly what the engine returns', () => {
  const household = {
    filingStatus: 'marriedFilingJointly',
    w2Wages: 180000,
    selfEmploymentNetProfit: 40000,
    longTermCapitalGains: 20000,
    stateAndLocalTaxesPaid: 22000,
    otherItemizedDeductions: 15000,
    qualifyingChildren: 2,
    federalWithholding: 30000,
    year: 2026,
  };
  const { structured } = ok('estimate_federal_tax', household);
  // Same inputs straight into the engine, bypassing the whole MCP layer.
  assert.deepEqual(structured.estimate, JSON.parse(JSON.stringify(estimateFederalTax(household))));
});

test('every household input reaches the engine', () => {
  // A silently dropped field is the failure mode this layer is most prone to,
  // and it is invisible: the estimate still computes, it is just wrong. So
  // change each field one at a time and require that the answer moves.
  const base = { filingStatus: 'single', w2Wages: 90000, selfEmploymentNetProfit: 20000, year: 2026 };
  const moves = [
    ['w2Wages', 120000],
    ['selfEmploymentNetProfit', 50000],
    ['otherOrdinaryIncome', 10000],
    ['longTermCapitalGains', 30000],
    ['itemizedDeductions', 40000],
    ['stateAndLocalTaxesPaid', 30000],
    ['otherItemizedDeductions', 30000],
    ['qualifiedBusinessIncomeDeduction', 10000],
    ['qualifiedTips', 5000],
    ['qualifiedOvertimeCompensation', 5000],
    ['qualifiedVehicleLoanInterest', 4000],
    ['age65OrOlder', true],
    ['blind', true],
    ['qualifyingChildren', 2],
    ['otherDependents', 1],
    ['federalWithholding', 5000],
  ];
  const baseline = ok('estimate_federal_tax', base).structured.estimate;
  for (const [field, value] of moves) {
    const changed = ok('estimate_federal_tax', { ...base, [field]: value }).structured.estimate;
    assert.notDeepEqual(
      changed,
      baseline,
      `setting ${field} changed nothing — it is probably not being read`,
    );
  }
});

test('qualifiedBusinesses is passed through as structured objects, not flattened', () => {
  const { structured } = ok('estimate_federal_tax', {
    filingStatus: 'single',
    selfEmploymentNetProfit: 200000,
    year: 2026,
    qualifiedBusinesses: [
      {
        name: 'Consulting',
        qualifiedBusinessIncome: 200000,
        w2Wages: 0,
        isSpecifiedServiceTradeOrBusiness: true,
      },
    ],
  });
  assert.ok(structured.estimate.section199A, 'section199A should be computed, not null');
  assert.equal(structured.estimate.section199A.businesses[0].name, 'Consulting');
  assert.equal(structured.estimate.section199A.businesses[0].isSpecifiedServiceTradeOrBusiness, true);
});

test('the numbers in the text block match the numbers in structuredContent', () => {
  const { text, structured } = ok('estimate_federal_tax', {
    filingStatus: 'headOfHousehold',
    w2Wages: 30000,
    qualifyingChildren: 2,
    year: 2026,
  });
  const refund = -structured.estimate.balanceDue;
  assert.ok(refund > 0);
  const formatted = `$${refund.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  assert.ok(text.includes(formatted), `text should quote the refund ${formatted}`);
  assert.ok(text.includes('REFUND'));
});

// ---------------------------------------------------------------------------
// The pitch: a credit phase-out beats the bracket
// ---------------------------------------------------------------------------

test('effective_marginal_rate reports 21.06% for a 10%-bracket family in the EITC phase-out', () => {
  const { text, structured } = ok('effective_marginal_rate', {
    filingStatus: 'headOfHousehold',
    w2Wages: 30000,
    qualifyingChildren: 2,
    year: 2026,
  });
  assert.equal(structured.ordinaryBracket, 0.1);
  // The whole marginal cost is EITC withdrawal at the § 32 phase-out rate: the
  // child tax credit absorbs the income tax at both incomes, so the bracket is
  // invisible.
  assert.ok(Math.abs(structured.effectiveMarginalRate - 0.2106) < 0.0001);
  assert.match(text, /TRUE MARGINAL RATE/);
  assert.match(text, /21\.06%/);
});

test('the marginal components sum exactly to the cost', () => {
  const cases = [
    { filingStatus: 'headOfHousehold', w2Wages: 30000, qualifyingChildren: 2 },
    { filingStatus: 'headOfHousehold', w2Wages: 45000, qualifyingChildren: 1 },
    { filingStatus: 'marriedFilingJointly', otherOrdinaryIncome: 411000, qualifyingChildren: 2 },
    { filingStatus: 'single', selfEmploymentNetProfit: 150000 },
    { filingStatus: 'single', w2Wages: 300000, longTermCapitalGains: 50000 },
    {
      filingStatus: 'marriedFilingJointly',
      w2Wages: 550000,
      stateAndLocalTaxesPaid: 60000,
      otherItemizedDeductions: 20000,
    },
  ];
  for (const household of cases) {
    const { structured } = ok('effective_marginal_rate', { ...household, year: 2026 });
    const sum = Object.values(structured.components).reduce((a, b) => a + b, 0);
    assert.ok(
      Math.abs(sum - structured.cost) < 0.01,
      `components ${sum} should sum to cost ${structured.cost} for ${JSON.stringify(household)}`,
    );
  }
});

test('the SALT phase-down band has a higher marginal rate than the bracket above it', () => {
  // The § 164(b)(6) phase-down makes the rate non-monotonic: 35% below the
  // threshold, ~45.5% inside the band, 35% again above it — higher inside the
  // band than in the 37% bracket beyond it.
  const household = {
    filingStatus: 'marriedFilingJointly',
    stateAndLocalTaxesPaid: 60000,
    otherItemizedDeductions: 20000,
    year: 2026,
  };
  const inside = ok('effective_marginal_rate', {
    ...household,
    otherOrdinaryIncome: 550000,
  }).structured;
  const above = ok('effective_marginal_rate', {
    ...household,
    otherOrdinaryIncome: 700000,
  }).structured;
  assert.ok(
    inside.effectiveMarginalRate > inside.ordinaryBracket,
    'inside the phase-down band the true rate must exceed the bracket',
  );
  assert.ok(
    inside.effectiveMarginalRate > above.effectiveMarginalRate,
    'the phase-down band must be more expensive than the bracket above it',
  );
});

test('incomeType decides whether self-employment tax is part of the marginal cost', () => {
  const household = { filingStatus: 'single', w2Wages: 60000, year: 2026 };
  const wages = ok('effective_marginal_rate', { ...household, incomeType: 'wages' }).structured;
  const se = ok('effective_marginal_rate', { ...household, incomeType: 'selfEmployment' }).structured;
  assert.ok(!('Self-employment tax' in wages.components));
  assert.ok(se.components['Self-employment tax'] > 0);
  assert.ok(se.effectiveMarginalRate > wages.effectiveMarginalRate);
});

test('a long-term capital gain can cost less than the ordinary bracket', () => {
  const { structured, text } = ok('effective_marginal_rate', {
    filingStatus: 'single',
    w2Wages: 120000,
    incomeType: 'longTermCapitalGains',
    year: 2026,
  });
  assert.ok(structured.effectiveMarginalRate < structured.ordinaryBracket);
  assert.match(text, /BELOW/);
});

// ---------------------------------------------------------------------------
// Multi-year
// ---------------------------------------------------------------------------

test('compare_tax_years runs every supported year by default', () => {
  const { structured } = ok('compare_tax_years', {
    filingStatus: 'marriedFilingJointly',
    w2Wages: 120000,
    qualifyingChildren: 2,
  });
  assert.deepEqual(structured.years, [2024, 2025, 2026]);
  assert.equal(structured.estimates.length, 3);
  for (const year of structured.years) {
    assert.equal(typeof structured.totalTaxByYear[year], 'number');
  }
});

test('compare_tax_years agrees with estimate_federal_tax year by year', () => {
  const household = {
    filingStatus: 'headOfHousehold',
    w2Wages: 68000,
    qualifyingChildren: 1,
    stateAndLocalTaxesPaid: 12000,
  };
  const compared = ok('compare_tax_years', household).structured;
  for (const estimate of compared.estimates) {
    const single = ok('estimate_federal_tax', { ...household, year: estimate.year }).structured.estimate;
    assert.deepEqual(estimate, single, `year ${estimate.year} disagrees between the two tools`);
  }
});

test('the four OBBBA deductions are worth nothing in 2024 and something in 2025', () => {
  const { structured } = ok('compare_tax_years', {
    filingStatus: 'single',
    w2Wages: 60000,
    qualifiedTips: 8000,
    qualifiedOvertimeCompensation: 4000,
    years: [2024, 2025],
  });
  const [y2024, y2025] = structured.estimates;
  assert.equal(y2024.additionalDeductions.total, 0, 'Schedule 1-A did not exist in 2024');
  assert.equal(y2025.additionalDeductions.total, 12000);
  assert.ok(y2025.totalTax < y2024.totalTax);
});

test('the 2025 standard deduction is the OBBBA figure, not the one Rev. Proc. 2024-40 published', () => {
  // OBBBA was signed 2025-07-04 and changed 2025 retroactively, after the IRS
  // had already announced $15,000 / $30,000 / $22,500 for that year. A library
  // built from the Revenue Procedure carries the superseded figures.
  const superseded = { single: 15000, marriedFilingJointly: 30000, headOfHousehold: 22500 };
  const actual = { single: 15750, marriedFilingJointly: 31500, headOfHousehold: 23625 };
  for (const [filingStatus, expected] of Object.entries(actual)) {
    const { structured } = ok('estimate_federal_tax', { filingStatus, w2Wages: 200000, year: 2025 });
    assert.equal(structured.estimate.deduction, expected);
    assert.notEqual(structured.estimate.deduction, superseded[filingStatus]);
  }
});

test('compare_tax_years explains what moved, and only what moved', () => {
  const withChildren = ok('compare_tax_years', {
    filingStatus: 'marriedFilingJointly',
    w2Wages: 120000,
    qualifyingChildren: 2,
  }).text;
  assert.match(withChildren, /child tax credit moved/i);

  const childless = ok('compare_tax_years', {
    filingStatus: 'marriedFilingJointly',
    w2Wages: 120000,
  }).text;
  assert.doesNotMatch(childless, /child tax credit moved/i);
});

test('the SALT cap is not blamed for a change when the standard deduction won anyway', () => {
  // The cap tripled between 2024 and 2026, but a household that takes the
  // standard deduction in every year was not affected by it, and saying it
  // "drove the difference" would be noise dressed up as an explanation.
  const text = ok('compare_tax_years', {
    filingStatus: 'marriedFilingJointly',
    w2Wages: 120000,
    stateAndLocalTaxesPaid: 25000,
  }).text;
  for (const estimate of ok('compare_tax_years', {
    filingStatus: 'marriedFilingJointly',
    w2Wages: 120000,
    stateAndLocalTaxesPaid: 25000,
  }).structured.estimates) {
    assert.equal(estimate.deductionKind, 'standard');
  }
  assert.doesNotMatch(text, /SALT cap moved/);
});

test('compare_tax_years rejects `year` and demands at least two distinct years', () => {
  assert.match(err('compare_tax_years', { filingStatus: 'single', year: 2026 }), /years/);
  assert.match(err('compare_tax_years', { filingStatus: 'single', years: [2026] }), /at least two/);
  assert.match(err('compare_tax_years', { filingStatus: 'single', years: [2026, 2026] }), /at least two/);
  assert.match(err('compare_tax_years', { filingStatus: 'single', years: [2026, 2019] }), /2019/);
});

// ---------------------------------------------------------------------------
// Quarterly
// ---------------------------------------------------------------------------

test('the prior-year safe harbor is used when it is cheaper, and the installments sum exactly', () => {
  const { structured, text } = ok('quarterly_estimated_payments', {
    filingStatus: 'single',
    selfEmploymentNetProfit: 95000,
    priorYearTotalTax: 18000,
    priorYearAdjustedGrossIncome: 90000,
    year: 2026,
  });
  assert.equal(structured.plan.basis, 'priorYearSafeHarbor');
  assert.equal(structured.plan.requiredAnnualPayment, 18000);
  assert.equal(structured.plan.usedHigherPriorYearRate, false);
  const total = structured.plan.installments.reduce((sum, i) => sum + i.amount, 0);
  assert.ok(Math.abs(total - structured.plan.totalEstimatedPayments) < 0.005);
  assert.equal(structured.plan.installments.length, 4);
  assert.match(text, /2027-01-15/);
});

test('prior-year AGI above $150,000 raises the safe harbor to 110%', () => {
  const { structured } = ok('quarterly_estimated_payments', {
    filingStatus: 'single',
    selfEmploymentNetProfit: 300000,
    priorYearTotalTax: 60000,
    priorYearAdjustedGrossIncome: 200000,
    year: 2026,
  });
  assert.equal(structured.plan.usedHigherPriorYearRate, true);
  assert.equal(structured.plan.priorYearTarget, 66000);
});

test('with no prior year the plan says so rather than silently using only one target', () => {
  const { structured, text } = ok('quarterly_estimated_payments', {
    filingStatus: 'single',
    selfEmploymentNetProfit: 95000,
    year: 2026,
  });
  assert.equal(structured.plan.priorYearTarget, null);
  assert.equal(structured.plan.basis, 'currentYear90');
  assert.match(text, /No prior-year figure was supplied/);
});

// ---------------------------------------------------------------------------
// Parameters and coverage
// ---------------------------------------------------------------------------

test('get_tax_parameters narrows to one filing status and still carries the sources', () => {
  const all = ok('get_tax_parameters', { year: 2026 }).structured;
  const one = ok('get_tax_parameters', { year: 2026, filingStatus: 'single' }).structured;
  assert.ok(Array.isArray(one.parameters.ordinaryBrackets), 'brackets should be narrowed to an array');
  assert.ok(!Array.isArray(all.parameters.ordinaryBrackets), 'unfiltered brackets stay keyed by status');
  assert.equal(one.parameters.standardDeduction, 16100);
  assert.ok(one.sources.length > 0);
  assert.ok(JSON.stringify(one).length < JSON.stringify(all).length);
});

test('get_tax_parameters can omit the parameter dump', () => {
  const { structured } = ok('get_tax_parameters', { year: 2026, includeFullParameters: false });
  assert.equal(structured.parameters, undefined);
  assert.ok(structured.sources.length > 0);
});

test('the rendered brackets are the ones the engine actually uses', () => {
  const { text, structured } = ok('get_tax_parameters', { year: 2026, filingStatus: 'single' });
  for (const bracket of structured.parameters.ordinaryBrackets) {
    if (Number.isFinite(bracket.upTo)) {
      assert.ok(
        text.includes(`$${Math.round(bracket.upTo).toLocaleString('en-US')}`),
        `bracket ceiling ${bracket.upTo} should appear in the rendered table`,
      );
    }
  }
});

test('list_supported_years names the gaps, because a model cannot see them otherwise', () => {
  const { text, structured } = ok('list_supported_years', {});
  assert.deepEqual(structured.supportedYears, [2024, 2025, 2026]);
  assert.match(text, /Alternative minimum tax/);
  assert.match(text, /State and local income tax is not modelled/);
  assert.match(text, /§ 68/);
  assert.match(text, /not tax advice/);
  assert.ok(structured.notModelled.length >= 5);
});

test('Schedule 1-A is reported as in effect only for the years it exists', () => {
  const { text } = ok('list_supported_years', {});
  const section2024 = text.slice(text.indexOf('2024:'), text.indexOf('2025:'));
  const section2026 = text.slice(text.indexOf('2026:'), text.indexOf('Not modelled'));
  assert.match(section2024, /Schedule 1-A \(OBBBA deductions\): not in effect/);
  assert.match(section2026, /Schedule 1-A \(OBBBA deductions\): in effect/);
});

// ---------------------------------------------------------------------------
// Input handling
// ---------------------------------------------------------------------------

test('common filing-status spellings are accepted rather than rejected', () => {
  for (const [spelling, canonical] of [
    ['single', 'single'],
    ['married_filing_jointly', 'marriedFilingJointly'],
    ['MFJ', 'marriedFilingJointly'],
    ['joint', 'marriedFilingJointly'],
    ['head of household', 'headOfHousehold'],
    ['head_of_household', 'headOfHousehold'],
    ['married filing separately', 'marriedFilingSeparately'],
    ['qualifying surviving spouse', 'qualifyingSurvivingSpouse'],
  ]) {
    const { structured } = ok('estimate_federal_tax', { filingStatus: spelling, w2Wages: 50000 });
    assert.equal(structured.estimate.filingStatus, canonical, `${spelling} should map to ${canonical}`);
  }
});

test('a numeric string is accepted; a non-numeric one is not', () => {
  const { structured } = ok('estimate_federal_tax', { filingStatus: 'single', w2Wages: '85,000' });
  assert.equal(structured.estimate.grossIncome, 85000);
  assert.match(err('estimate_federal_tax', { filingStatus: 'single', w2Wages: 'a lot' }), /finite number/);
});

test('a misspelled argument is reported rather than silently ignored', () => {
  // Silently dropping `wages` would compute a $0 tax and look entirely
  // plausible, which is the worst possible failure for a tax tool.
  const message = err('estimate_federal_tax', { filingStatus: 'single', wages: 50000 });
  assert.match(message, /Unknown argument/);
  assert.match(message, /wages/);
  assert.match(message, /w2Wages/);
});

test('negative income and a missing filing status are refused', () => {
  assert.match(err('estimate_federal_tax', { filingStatus: 'single', w2Wages: -5 }), /negative/);
  assert.match(err('estimate_federal_tax', {}), /filingStatus is required/);
  assert.match(err('estimate_federal_tax', { filingStatus: 'single', qualifyingChildren: 1.5 }), /whole/);
});

// ---------------------------------------------------------------------------
// Tool table
// ---------------------------------------------------------------------------

test('every tool is read-only and declares it', () => {
  for (const tool of TOOLS) {
    assert.equal(tool.annotations.readOnlyHint, true, `${tool.name} should be read-only`);
    assert.equal(tool.annotations.openWorldHint, false, `${tool.name} touches nothing external`);
    assert.equal(findTool(tool.name), tool);
  }
});

test('every tool answers its own name with a text block and structured content', () => {
  const args = {
    estimate_federal_tax: { filingStatus: 'single', w2Wages: 80000 },
    compare_tax_years: { filingStatus: 'single', w2Wages: 80000 },
    effective_marginal_rate: { filingStatus: 'single', w2Wages: 80000 },
    quarterly_estimated_payments: { filingStatus: 'single', selfEmploymentNetProfit: 80000 },
    paycheck_withholding: { filingStatus: 'single', payPeriod: 'biweekly', wagesThisPeriod: 3000 },
    state_income_tax: {
      filingStatus: 'single',
      state: 'CA',
      federalAdjustedGrossIncome: 100_000,
      federalTaxableIncome: 84_250,
      federalDeduction: 15_750,
    },
    get_tax_parameters: { year: 2026 },
    list_supported_years: {},
  };
  for (const tool of TOOLS) {
    const { text, structured } = ok(tool.name, args[tool.name]);
    assert.ok(text.length > 40, `${tool.name} produced almost no text`);
    assert.ok(structured && typeof structured === 'object', `${tool.name} produced no structuredContent`);
  }
});

// ---------------------------------------------------------------------------
// paycheck_withholding
// ---------------------------------------------------------------------------

test('paycheck_withholding: the text and structuredContent report the same figures', () => {
  const { text, structured } = ok('paycheck_withholding', {
    filingStatus: 'single',
    payPeriod: 'biweekly',
    wagesThisPeriod: 3_000,
    year: 2026,
  });
  assert.equal(structured.paycheck.federalIncomeTax.withholding, 320.38);
  assert.equal(structured.paycheck.socialSecurity, 186);
  assert.equal(structured.paycheck.medicare, 43.5);
  assert.equal(structured.paycheck.takeHomeAfterFederal, 2_450.12);
  assert.match(text, /\$320\.38/);
  assert.match(text, /\$2,450\.12/);
  assert.match(text, /Single or married filing separately column, standard schedule/);
  assert.equal(structured.plan, undefined);
});

test('paycheck_withholding: targetAnnualTax turns it into a Form W-4 plan', () => {
  const { text, structured } = ok('paycheck_withholding', {
    filingStatus: 'single',
    payPeriod: 'biweekly',
    wagesThisPeriod: 4_000,
    year: 2026,
    targetAnnualTax: 20_980.8,
  });
  assert.equal(structured.plan.shortfall, 6_930.92);
  assert.equal(structured.plan.extraWithholdingPerPeriod, 266.57);
  assert.match(text, /Step 4\(c\)/);
  assert.match(text, /\$266\.57/);
});

test('paycheck_withholding: over-withholding is reported as a refund, not a shortfall', () => {
  const { text, structured } = ok('paycheck_withholding', {
    filingStatus: 'single',
    payPeriod: 'monthly',
    wagesThisPeriod: 5_000,
    year: 2026,
    targetAnnualTax: 1_000,
  });
  assert.ok(structured.plan.shortfall < 0);
  assert.equal(structured.plan.extraWithholdingPerPeriod, 0);
  assert.match(text, /Over-withheld by/);
});

test('paycheck_withholding: the Step 2 checkbox halves the schedule', () => {
  const args = {
    filingStatus: 'marriedFilingJointly',
    payPeriod: 'annual',
    wagesThisPeriod: 75_000,
    year: 2026,
  };
  const blank = ok('paycheck_withholding', args);
  const checked = ok('paycheck_withholding', { ...args, multipleJobsCheckbox: true });
  assert.equal(blank.structured.paycheck.federalIncomeTax.schedule, 'standard');
  assert.equal(checked.structured.paycheck.federalIncomeTax.schedule, 'multipleJobsCheckbox');
  // Two such jobs owe 15340 between them, and only the checked pair withholds it.
  assert.equal(2 * checked.structured.paycheck.federalIncomeTax.withholding, 15_340);
  assert.ok(2 * blank.structured.paycheck.federalIncomeTax.withholding < 15_340);
  assert.match(checked.text, /Step 2 checkbox schedule/);
});

test('paycheck_withholding: 2025 says out loud that its tables predate OBBBA', () => {
  const { text } = ok('paycheck_withholding', {
    filingStatus: 'marriedFilingJointly',
    payPeriod: 'annual',
    wagesThisPeriod: 130_000,
    year: 2025,
  });
  assert.match(text, /never reissued/);
  assert.match(text, /\$11,828\.00/);
});

test('paycheck_withholding: a legacy W-4 is accepted, and cannot be mixed with a modern one', () => {
  const legacy = ok('paycheck_withholding', {
    filingStatus: 'single',
    payPeriod: 'annual',
    wagesThisPeriod: 100_000,
    year: 2026,
    allowances2019OrEarlier: 2,
  });
  const modern = ok('paycheck_withholding', {
    filingStatus: 'single',
    payPeriod: 'annual',
    wagesThisPeriod: 100_000,
    year: 2026,
  });
  assert.equal(
    legacy.structured.paycheck.federalIncomeTax.withholding,
    modern.structured.paycheck.federalIncomeTax.withholding,
  );

  const mixed = err('paycheck_withholding', {
    filingStatus: 'single',
    payPeriod: 'annual',
    wagesThisPeriod: 100_000,
    allowances2019OrEarlier: 2,
    multipleJobsCheckbox: true,
  });
  assert.match(mixed, /one form or the other/);
});

test('paycheck_withholding: a missing or wrong pay period is a recoverable tool error', () => {
  assert.match(
    err('paycheck_withholding', { filingStatus: 'single', wagesThisPeriod: 1_000 }),
    /payPeriod must be one of/,
  );
  assert.match(
    err('paycheck_withholding', {
      filingStatus: 'single',
      wagesThisPeriod: 1_000,
      payPeriod: 'fortnightly',
    }),
    /payPeriod must be one of/,
  );
  assert.match(
    err('paycheck_withholding', { filingStatus: 'single', payPeriod: 'weekly' }),
    /wagesThisPeriod is required/,
  );
});

test('paycheck_withholding: the year-to-date fields drive the wage base and the 0.9%', () => {
  const { structured, text } = ok('paycheck_withholding', {
    filingStatus: 'single',
    payPeriod: 'semimonthly',
    wagesThisPeriod: 20_000,
    year: 2026,
    yearToDateSocialSecurityWages: 175_000,
    yearToDateMedicareWages: 195_000,
  });
  assert.equal(structured.paycheck.socialSecurityWagesThisPeriod, 9_500);
  assert.equal(structured.paycheck.socialSecurity, 589);
  assert.equal(structured.paycheck.additionalMedicare, 135);
  assert.match(text, /Additional Medicare/);
});

// ---------------------------------------------------------------------------
// state_income_tax
// ---------------------------------------------------------------------------

test('state_income_tax returns exactly what the state engine returns', () => {
  const args = {
    state: 'CA',
    filingStatus: 'single',
    year: 2025,
    federalAdjustedGrossIncome: 100_000,
    federalTaxableIncome: 84_250,
    federalDeduction: 15_750,
  };
  const { structured } = ok('state_income_tax', args);
  const direct = stateIncomeTax({
    state: 'CA',
    filingStatus: 'single',
    year: 2025,
    federal: {
      adjustedGrossIncome: 100_000,
      taxableIncome: 84_250,
      deduction: 15_750,
      deductionKind: 'standard',
    },
  });
  assert.deepEqual(structured.state, JSON.parse(JSON.stringify(direct)));
});

test('the two tools reconcile: estimate_federal_tax feeds state_income_tax exactly', () => {
  // This is the whole reason state_income_tax asks for federal figures instead
  // of a household. Describing the household twice, to two tools, is how the two
  // answers come to disagree.
  const household = { filingStatus: 'single', w2Wages: 100_000, year: 2025 };
  const federal = ok('estimate_federal_tax', household).structured.estimate;
  const { structured, text } = ok('state_income_tax', {
    state: 'CA',
    filingStatus: 'single',
    year: 2025,
    federalAdjustedGrossIncome: federal.adjustedGrossIncome,
    federalTaxableIncome: federal.taxableIncome,
    federalDeduction: federal.deduction,
  });
  assert.equal(federal.deduction, 15_750);
  assert.equal(structured.state.conformity.amount, federal.adjustedGrossIncome);
  assert.equal(structured.state.tax, 5054.98);
  assert.match(text, /5,054\.98/);
  assert.match(text, /Starts from federal adjusted gross income/);
});

test('state_income_tax reports the marginal rate a rate schedule cannot show', () => {
  const utah = ok('state_income_tax', {
    state: 'UT',
    filingStatus: 'single',
    year: 2026,
    federalAdjustedGrossIncome: 25_000,
    federalTaxableIncome: 8_900,
    federalDeduction: 16_100,
  });
  assert.equal(utah.structured.state.marginalRate, 0.0575);
  assert.match(utah.text, /5\.75%/);

  // Illinois' cliff is a dollar figure, not a rate, and the text says so rather
  // than rendering "14112.45%".
  const illinois = ok('state_income_tax', {
    state: 'IL',
    filingStatus: 'single',
    year: 2025,
    federalAdjustedGrossIncome: 250_000,
    federalTaxableIncome: 234_250,
    federalDeduction: 15_750,
  });
  assert.match(illinois.text, /a cliff, not a rate/);
  assert.match(illinois.text, /\$141\.12/);
});

test('state_income_tax computes CalEITC and the Young Child Tax Credit', () => {
  const parent = (extra) =>
    ok('state_income_tax', {
      state: 'CA',
      filingStatus: 'headOfHousehold',
      year: 2025,
      federalAdjustedGrossIncome: 25_000,
      federalTaxableIncome: 2_500,
      federalDeduction: 22_500,
      dependentAges: [3, 7],
      ...extra,
    });

  const withEarnings = parent({ earnedIncome: 25_000 });
  const credits = withEarnings.structured.state.credits;
  const named = (part) => credits.find((c) => c.name.includes(part));
  assert.equal(named('CalEITC').amount, 331.76);
  assert.equal(named('CalEITC').refundable, true);
  assert.equal(named('Young Child').amount, 1_189);
  assert.equal(withEarnings.structured.state.tax, -1520.76);
  assert.match(withEarnings.text, /-\$1,520\.76/);

  // Without earnings the two credits cannot be computed, and the result says so
  // rather than reporting a confident zero.
  const without = parent({});
  assert.equal(without.structured.state.tax, 0);
  assert.ok(
    without.structured.state.notes.some((n) => n.includes('earnedIncome was not supplied')),
    'a California return without earnings should say what the omission cost',
  );

  // The investment-income limit is a cliff and it takes both credits with it.
  const disqualified = parent({ earnedIncome: 25_000, investmentIncome: 4_815 });
  assert.equal(disqualified.structured.state.tax, 0);
  assert.equal(named('CalEITC').amount > 0, true);
});

test('state_income_tax reports a NEGATIVE marginal rate on the CalEITC phase-in', () => {
  // The credit peaks at $9,823 for a two-child filer and has no plateau, so the
  // dollar before the peak is worth 34 cents and the dollar after costs 34.
  const at = (earnedIncome) =>
    ok('state_income_tax', {
      state: 'CA',
      filingStatus: 'headOfHousehold',
      year: 2025,
      federalAdjustedGrossIncome: earnedIncome,
      federalTaxableIncome: 0,
      federalDeduction: 22_500,
      earnedIncome,
      dependentAges: [3, 7],
    }).structured.state.marginalRate;
  assert.equal(at(8_000), -0.34);
  assert.equal(at(10_000), 0.34);
});

test('state_income_tax refuses earnedIncome it cannot validate, and unknown fields still throw', () => {
  const bad = findTool('state_income_tax');
  assert.throws(
    () =>
      bad.run({
        state: 'CA',
        filingStatus: 'single',
        federalAdjustedGrossIncome: 10_000,
        federalTaxableIncome: 0,
        earnedIncome: -1,
      }),
    /earnedIncome/,
  );
});

test('state_income_tax passes the Colorado add-backs through', () => {
  const withQbi = ok('state_income_tax', {
    state: 'CO',
    filingStatus: 'single',
    year: 2025,
    federalAdjustedGrossIncome: 100_000,
    federalTaxableIncome: 74_250,
    federalDeduction: 15_750,
    federalQualifiedBusinessIncomeDeduction: 10_000,
  });
  assert.equal(withQbi.structured.state.addBacks.length, 1);
  assert.equal(withQbi.structured.state.tax, 3707.0);
  assert.match(withQbi.text, /199A/);

  // 2026 adds overtime back as well; 2025 does not.
  const overtime2026 = ok('state_income_tax', {
    state: 'CO',
    filingStatus: 'single',
    year: 2026,
    federalAdjustedGrossIncome: 100_000,
    federalTaxableIncome: 79_250,
    federalDeduction: 15_750,
    federalOvertimeDeduction: 5_000,
  });
  assert.equal(overtime2026.structured.state.additions, 5_000);
  const overtime2025 = ok('state_income_tax', {
    state: 'CO',
    filingStatus: 'single',
    year: 2025,
    federalAdjustedGrossIncome: 100_000,
    federalTaxableIncome: 79_250,
    federalDeduction: 15_750,
    federalOvertimeDeduction: 5_000,
  });
  assert.equal(overtime2025.structured.state.additions, 0);
});

test('a state with no income tax answers zero and says what is still taxed', () => {
  const { text, structured } = ok('state_income_tax', {
    state: 'WA',
    filingStatus: 'single',
    federalAdjustedGrossIncome: 2_000_000,
    federalTaxableIncome: 1_983_900,
  });
  assert.equal(structured.state.tax, 0);
  assert.equal(structured.state.hasIncomeTax, false);
  assert.match(text, /no individual income tax/);
  // A Washington filer with a large long-term gain owes Washington tax. Saying
  // "no income tax" and stopping is the failure this note exists to prevent.
  assert.match(text, /capital gains/);
});

test('an unsupported state is an error that names the supported ones', () => {
  const message = err('state_income_tax', {
    state: 'MA',
    filingStatus: 'single',
    federalAdjustedGrossIncome: 100_000,
    federalTaxableIncome: 84_250,
  });
  assert.match(message, /state must be one of/);
  assert.match(message, /no zero to fall back to/);
});

test('state_income_tax computes New York with its supplemental tax', () => {
  const { text, structured } = ok('state_income_tax', {
    state: 'NY',
    year: 2025,
    filingStatus: 'single',
    federalAdjustedGrossIncome: 300_000,
    federalTaxableIncome: 284_250,
    federalDeduction: 15_750,
  });
  // The whole point: the bracket walk is not the answer.
  assert.equal(structured.state.taxBeforeCredits, 17_602.85);
  assert.equal(structured.state.tax, 20_002);
  assert.equal(
    structured.state.surtaxes[0].name,
    'New York supplemental tax (tax table benefit recapture)',
  );
  assert.equal(structured.state.surtaxes[0].amount, 2_399.15);
  assert.match(text, /supplemental tax/);
  // And a model that asks for New York City is told it is not in this number.
  assert.match(text, /New York City/);
});

test('state_income_tax takes the federal earned income credit and six states use it', () => {
  const withCredit = (state, extra = {}) =>
    ok('state_income_tax', {
      state,
      year: 2025,
      filingStatus: 'headOfHousehold',
      dependents: 2,
      federalAdjustedGrossIncome: 30_000,
      federalTaxableIncome: 7_500,
      federalDeduction: 22_500,
      federalEarnedIncomeCredit: 6_000,
      ...extra,
    }).structured.state;

  const colorado = withCredit('CO');
  const credit = colorado.credits.find((c) => c.name.includes('earned income'));
  assert.equal(credit.amount, 3_000, 'Colorado matches 50% in 2025');
  assert.equal(credit.refundable, true);
  assert.ok(colorado.tax < 0, 'and pays it out');

  // Utah computes the same kind of credit and cannot pay any of it.
  const utah = withCredit('UT');
  assert.equal(utah.credits.find((c) => c.name.includes('earned income')).refundable, false);
  assert.equal(utah.tax, 0);

  // A state with no credit of its own is unmoved, so passing the figure is safe.
  assert.equal(withCredit('AZ').tax, withCredit('AZ', { federalEarnedIncomeCredit: 0 }).tax);
});

test('a state with an earned income credit says so when the federal figure is missing', () => {
  const { text } = ok('state_income_tax', {
    state: 'MI',
    year: 2025,
    filingStatus: 'headOfHousehold',
    dependents: 2,
    federalAdjustedGrossIncome: 30_000,
    federalTaxableIncome: 7_500,
    federalDeduction: 22_500,
  });
  assert.match(text, /Form 1040 line 27/);
  // A zero credit is not printed as a line item: it costs the caller context and
  // the note above already explains the absence.
  assert.ok(!/Less Michigan earned income/.test(text), text);
});

test('state_income_tax refuses inputs that cannot both be true', () => {
  assert.match(
    err('state_income_tax', {
      state: 'CA',
      filingStatus: 'single',
      federalAdjustedGrossIncome: 50_000,
      federalTaxableIncome: 60_000,
    }),
    /cannot exceed/,
  );
  // Pennsylvania has no federal starting line, so it demands its own figure...
  assert.match(
    err('state_income_tax', {
      state: 'PA',
      filingStatus: 'single',
      federalAdjustedGrossIncome: 100_000,
      federalTaxableIncome: 84_250,
    }),
    /pennsylvaniaTaxableIncome/,
  );
  // ...and no other state will accept one.
  assert.match(
    err('state_income_tax', {
      state: 'CA',
      filingStatus: 'single',
      federalAdjustedGrossIncome: 100_000,
      federalTaxableIncome: 84_250,
      pennsylvaniaTaxableIncome: 100_000,
    }),
    /only applies to PA/,
  );
});

test('a provisional state-year says so in the text, not only in a flag', () => {
  const { text, structured } = ok('state_income_tax', {
    state: 'CA',
    filingStatus: 'single',
    year: 2026,
    federalAdjustedGrossIncome: 100_000,
    federalTaxableIncome: 83_900,
    federalDeduction: 16_100,
  });
  assert.equal(structured.state.provisional, true);
  assert.match(text, /PROVISIONAL/);

  const published = ok('state_income_tax', {
    state: 'NC',
    filingStatus: 'single',
    year: 2026,
    federalAdjustedGrossIncome: 100_000,
    federalTaxableIncome: 83_900,
    federalDeduction: 16_100,
  });
  assert.equal(published.structured.state.provisional, false);
  assert.doesNotMatch(published.text, /PROVISIONAL/);
});

// ---------------------------------------------------------------------------
// state_income_tax: local tax
// ---------------------------------------------------------------------------

test('state_income_tax computes New York City alongside the state', () => {
  const { text, structured } = ok('state_income_tax', {
    state: 'NY',
    filingStatus: 'single',
    year: 2025,
    locality: 'NYC',
    federalAdjustedGrossIncome: 100_000,
    federalTaxableIncome: 92_000,
    federalDeduction: 8_000,
  });
  assert.equal(structured.state.tax, 4951.75);
  assert.equal(structured.state.localTaxes.length, 1);
  assert.equal(structured.state.localTaxes[0].locality, 'NYC');
  assert.equal(structured.state.localTaxes[0].tax, 3174.69);
  assert.equal(structured.state.totalTax, 8126.44);
  assert.equal(structured.state.totalMarginalRate, 0.0965);

  // The city is a separate block with its own total, not folded into the state's.
  assert.match(text, /New York City — resident tax on state taxable income/);
  assert.match(text, /State and local total\s+\$8,126\.44/);
  assert.match(text, /9\.65% counting local tax/);
  // And its own statutes are in Sources.
  assert.match(text, /11-1704\.1/);
});

test('the Yonkers surcharge is on the state tax before refundable credits', () => {
  const { text, structured } = ok('state_income_tax', {
    state: 'NY',
    filingStatus: 'headOfHousehold',
    year: 2025,
    dependents: 2,
    locality: 'YONKERS',
    federalAdjustedGrossIncome: 20_000,
    federalTaxableIncome: 8_800,
    federalDeduction: 11_200,
    federalEarnedIncomeCredit: 6_000,
  });
  assert.equal(structured.state.tax, -1528);
  assert.equal(structured.state.localTaxes[0].baseAmount, 182);
  assert.equal(structured.state.localTaxes[0].tax, 30.49);
  assert.match(text, /the state tax itself, before refundable credits/);
});

test('locality is refused outside New York, and named as the field to drop', () => {
  const message = err('state_income_tax', {
    state: 'CA',
    filingStatus: 'single',
    locality: 'NYC',
    federalAdjustedGrossIncome: 100_000,
    federalTaxableIncome: 84_250,
  });
  assert.match(message, /apply to NY only/);
  assert.match(message, /wrong answer rather than a missing one/);

  const bad = err('state_income_tax', {
    state: 'NY',
    filingStatus: 'single',
    locality: 'BROOKLYN',
    federalAdjustedGrossIncome: 100_000,
    federalTaxableIncome: 92_000,
  });
  assert.match(bad, /locality must be one of NYC, YONKERS/);
});

test('a New York return without a locality says what the city would have cost', () => {
  const { structured } = ok('state_income_tax', {
    state: 'NY',
    filingStatus: 'single',
    year: 2025,
    federalAdjustedGrossIncome: 100_000,
    federalTaxableIncome: 92_000,
    federalDeduction: 8_000,
  });
  assert.deepEqual(structured.state.localTaxes, []);
  assert.equal(structured.state.totalTax, structured.state.tax);
  const note = structured.state.notes.find((n) => n.startsWith('No locality was supplied'));
  assert.ok(note && note.includes('$3,174.69'), 'expected the quantified cost in a note');
});

test('dependentAges computes the Empire State child credit, and a count does not', () => {
  const withAges = ok('state_income_tax', {
    state: 'NY',
    filingStatus: 'marriedFilingJointly',
    year: 2025,
    dependentAges: [2, 10],
    federalAdjustedGrossIncome: 120_000,
    federalTaxableIncome: 103_950,
    federalDeduction: 16_050,
  });
  const credit = withAges.structured.state.credits.find(
    (c) => c.name === 'Empire State child credit',
  );
  // $1,000 + $330, less $16.50 for each of the ten $1,000 increments over $110,000.
  assert.equal(credit.amount, 1165);
  assert.equal(credit.refundable, true);
  assert.equal(withAges.structured.state.exemptions, 2000, 'ages also supply the count');

  const withCount = ok('state_income_tax', {
    state: 'NY',
    filingStatus: 'marriedFilingJointly',
    year: 2025,
    dependents: 2,
    federalAdjustedGrossIncome: 120_000,
    federalTaxableIncome: 103_950,
    federalDeduction: 16_050,
  });
  assert.equal(
    withCount.structured.state.credits.find((c) => c.name === 'Empire State child credit').amount,
    0,
  );
  assert.ok(
    withCount.structured.state.notes.some((n) => n.includes('dependentAges was not supplied')),
    'expected the result to name the missing input',
  );

  assert.match(
    err('state_income_tax', {
      state: 'NY',
      filingStatus: 'single',
      dependentAges: [2, 'four'],
      federalAdjustedGrossIncome: 100_000,
      federalTaxableIncome: 92_000,
    }),
    /dependentAges\[1\] must be a non-negative whole number/,
  );
});
