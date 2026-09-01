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

import { TOOLS, estimateFederalTax, findTool, handleMessage } from '../dist/index.js';

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
