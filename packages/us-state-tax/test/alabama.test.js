// Alabama. The state whose tax base contains the federal tax bill, whose 5% rate
// starts at $3,000, whose standard deduction is a staircase that rounds the
// opposite way from Connecticut's, and whose retirement answer turns on a fact no
// federal form records.
//
// Every expected figure below is computed from the statute by hand and written
// out, not read back out of the engine. Day 27's rule: a test written from the
// data can only confirm the data.
//
// And where a claim is about a PATTERN — the five columns of the standard
// deduction, the one dependent chart that serves five filing statuses — the test
// is the loop and not the three assertions I had in mind. Day 39's rule, which
// is how Connecticut's one unscaled recapture row was found: a loop costs the
// same to write and is the only version that can contradict its author.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FILING_STATUSES, getStateDefinition, stateIncomeTax } from './strict.mjs';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

/** Alabama starts from federal AGI. */
const federal = (agi, extra = {}) => ({
  adjustedGrossIncome: agi,
  taxableIncome: Math.max(0, agi - 15_750),
  deduction: 15_750,
  deductionKind: 'standard',
  ...extra,
});

const al = ({ agi = 60_000, year = 2026, filingStatus = 'single', federal: fed, ...fields } = {}) =>
  stateIncomeTax({
    state: 'AL',
    year,
    filingStatus,
    ...fields,
    federal: fed ?? federal(agi),
  });

const subtractionNamed = (result, fragment) =>
  result.computedSubtractions.find((s) => s.name.toLowerCase().includes(fragment))?.amount ?? 0;

// ---------------------------------------------------------------------------
// § 40-18-5: the rate schedule from 1935
// ---------------------------------------------------------------------------

test('the 5% rate begins at $3,000, and the whole graduated part is worth $40', () => {
  // 2% of the first $500 is $10 and 4% of the next $2,500 is $100, so the tax on
  // the first $3,000 is $110 — and against a flat 5% on the same $3,000 ($150)
  // the schedule saves $40. The saving is constant above the band, which is the
  // claim that matters, so it is checked at six incomes rather than one.
  // Above $35,500 of Alabama AGI the staircase has bottomed out, so the deduction
  // is the floor and the arithmetic is readable: AGI less the floor less the
  // exemption is the taxable income.
  for (const taxable of [40_000, 46_000, 100_000, 250_000, 1_000_000]) {
    const agi = taxable + 2_500 + 1_500;
    const r = al({ agi });
    money(r.taxableIncome, taxable, `taxable at ${agi}`);
    money(r.tax, taxable * 0.05 - 40, `single tax at ${agi}`);
  }
  // And once at the bottom of the schedule, where the deduction is the MAXIMUM
  // because the filer is below the threshold: $7,500 less $3,000 less $1,500 is
  // $3,000 of taxable income, $110 of tax, and the $40 saving is already whole.
  const small = al({ agi: 7_500 });
  money(small.taxableIncome, 3_000);
  money(small.tax, 110);
  money(small.tax, 3_000 * 0.05 - 40);
  for (const taxable of [40_000, 46_000, 250_000]) {
    const agi = taxable + 5_000 + 3_000;
    const r = al({ agi, filingStatus: 'marriedFilingJointly' });
    money(r.taxableIncome, taxable, `joint taxable at ${agi}`);
    money(r.tax, taxable * 0.05 - 80, `joint tax at ${agi}`);
  }
});

test('head of family takes the single schedule and the joint exemption', () => {
  // Three different treatments of one filing status on one return, which is why
  // this is a test rather than a sentence: the rate schedule is the single one,
  // the personal exemption is the joint one, and the standard deduction is
  // neither.
  const def = getStateDefinition('AL', 2026);
  assert.deepEqual(def.rate.byStatus.headOfHousehold, def.rate.byStatus.single);
  assert.equal(def.exemption.perFiler.headOfHousehold, 3_000);
  assert.equal(def.exemption.perFiler.marriedFilingJointly, 3_000);
  assert.equal(def.exemption.perFiler.single, 1_500);
  assert.equal(def.deduction.maximum.headOfHousehold, 5_200);
  assert.ok(
    def.deduction.maximum.single < def.deduction.maximum.headOfHousehold &&
      def.deduction.maximum.headOfHousehold < def.deduction.maximum.marriedFilingJointly,
  );
});

// ---------------------------------------------------------------------------
// § 40-18-15(b): the staircase, and the floor() that is the whole of it
// ---------------------------------------------------------------------------

test('the standard deduction loses nothing until a whole step of income has passed', () => {
  // The opposite of Connecticut. § 12-702 says "or fraction thereof" and charges
  // the whole step on the first dollar; § 40-18-15(b) says "for each $500" and
  // charges it on the five-hundredth.
  money(al({ agi: 25_501 }).deduction, 3_000, 'one dollar over');
  money(al({ agi: 25_999 }).deduction, 3_000, '$499 over');
  // The staircase is read against ALABAMA AGI, which for a wage earner is federal
  // AGI, so the probe income is the AGI itself.
  const atAgi = (agi, status = 'single') => al({ agi, filingStatus: status }).deduction;
  money(atAgi(25_999), 3_000, 'just under the first step');
  money(atAgi(26_000), 2_975, 'the first step');
  money(atAgi(26_499), 2_975, 'inside the first step');
  money(atAgi(26_500), 2_950, 'the second step');
});

test('every column completes in exactly twenty steps, and the separate one does not scale', () => {
  // The arithmetic that makes the five columns one provision — and the test is a
  // loop over the columns rather than the two or three assertions the header
  // claims, because a loop is the only version that can contradict the claim.
  const def = getStateDefinition('AL', 2026);
  const { maximum, min, threshold, increment, reduction } = def.deduction;
  // The column a status is READ against, which is not always the column named
  // after it: Alabama has no qualifying surviving spouse status and files such a
  // filer as single (§ 40-18-1 defines head of family as 26 U.S.C. § 2(b), which
  // excludes a surviving spouse, and § 40-18-5 gives the joint schedule to
  // "married persons filing a joint return" only). So the surviving-spouse cell
  // of every Alabama table is derived from the joint one by `byStatus()` and then
  // never read, and this loop asks the engine for the answer rather than the
  // table — which is why it caught the change in v0.40.0 instead of passing
  // through it. See `surviving-spouse-column.test.js`.
  const column = (status) =>
    status === 'qualifyingSurvivingSpouse' && def.survivingSpouseFilesAs !== undefined
      ? def.survivingSpouseFilesAs.filesAs
      : status;
  for (const status of FILING_STATUSES) {
    const range = maximum[status] - min[status];
    const steps = Math.ceil(range / reduction[status]);
    assert.equal(steps, 20, `${status} completes in ${steps} steps`);
    // The floor is reached at the threshold plus twenty whole steps of income,
    // and $35,500 ($17,750 separate) is the figure the published chart ends at.
    const floorAt = threshold[status] + 20 * increment[status];
    assert.equal(floorAt, status === 'marriedFilingSeparately' ? 17_750 : 35_500);
    const read = column(status);
    money(al({ agi: floorAt, filingStatus: status }).deduction, min[read], `${status} floor`);
    money(
      al({ agi: floorAt - increment[read], filingStatus: status }).deduction,
      Math.max(min[read], maximum[read] - 19 * reduction[read]),
      `${status} nineteenth step`,
    );
  }
  // And the one cell that does not scale. Half of the joint $175 is $87.50 and
  // the statute rounded it up, so nineteen steps have withdrawn $1,672 of a
  // $1,750 range and the twentieth step is worth $78 rather than $88.
  assert.equal(reduction.marriedFilingSeparately, 88);
  assert.equal(reduction.marriedFilingJointly / 2, 87.5);
  money(al({ agi: 17_500, filingStatus: 'marriedFilingSeparately' }).deduction, 2_578);
  money(al({ agi: 17_750, filingStatus: 'marriedFilingSeparately' }).deduction, 2_500);
  assert.equal(4_250 - 19 * 88, 2_578);
  assert.equal(2_578 - 2_500, 78);
  // The separate threshold and increment ARE half the joint ones, which is what
  // makes the reduction the exception rather than the column being drafted apart.
  assert.equal(threshold.marriedFilingSeparately * 2, threshold.marriedFilingJointly);
  assert.equal(increment.marriedFilingSeparately * 2, increment.marriedFilingJointly);
});

test('the itemized deduction does not require itemizing federally, and FICA beats the floor', () => {
  // § 40-18-15(a)(3) allows the FICA and self-employment taxes paid, so an
  // Alabama Schedule A beats the standard deduction on payroll tax alone above
  // about $32,680 of wages — and the federal election is irrelevant to it.
  const fica = (wages) => Math.round(wages * 0.0765 * 100) / 100;
  money(fica(32_680), 2_500.02, 'the wage at which FICA passes the floor');
  const r = al({ agi: 50_000, stateItemizedDeductions: fica(50_000) });
  money(r.deduction, 3_825, 'itemized beats the $2,500 floor');
  // Federal standard deduction above; the state itemized figure is taken anyway.
  assert.equal(r.deduction > al({ agi: 50_000 }).deduction, true);
});

test('the payroll tax paid IS an Alabama Schedule A, and a supplied total replaces it', () => {
  // The default this fixes: a wage earner who supplies no Schedule A was given
  // the $2,500 floor, which is $1,325 of deduction and $66.25 of tax below the
  // FICA they had already paid — and `socialSecurityAndMedicarePaid` is a figure
  // this package already asks Massachusetts filers for.
  money(al({ agi: 50_000, socialSecurityAndMedicarePaid: 3_825 }).deduction, 3_825);
  money(al({ agi: 50_000 }).deduction, 2_500, 'without it, the floor');
  // A caller's own total REPLACES it rather than adding to it: a filer who has
  // already put their FICA on their Schedule A would otherwise deduct it twice,
  // and a double count is a worse error than the one the flag fixes.
  money(
    al({ agi: 50_000, socialSecurityAndMedicarePaid: 3_825, stateItemizedDeductions: 9_000 })
      .deduction,
    9_000,
  );
  // And the standard deduction still wins where it is larger, which is what
  // makes this the larger of the two rather than a third deduction: $1,000 of
  // payroll tax is below every column's floor.
  money(al({ agi: 50_000, socialSecurityAndMedicarePaid: 1_000 }).deduction, 2_500);
});

// ---------------------------------------------------------------------------
// Form 40 line 12: the federal bill, inside the state base
// ---------------------------------------------------------------------------

test('the federal income tax deduction is 5 cents on every federal dollar, and is not itemized', () => {
  const at = (fed, extra = {}) =>
    al({ federal: federal(50_000, { incomeTaxBeforeRefundableCredits: fed, ...extra }) }).tax;
  const none = at(0);
  money(none - at(4_016), 200.8, 'a $4,016 federal bill');
  money(none - at(1_000), 50, 'a $1,000 federal bill');
  // Linear, because the filer is above $3,000 of taxable income either way: the
  // whole of the deduction comes off the 5% band.
  money(at(1_000) - at(2_000), 50, 'the second $1,000');
  // And it is taken WITH the standard deduction, not instead of it: line 11 is
  // $2,500 here and line 12 is the federal tax, and the total is their sum.
  const r = al({ federal: federal(50_000, { incomeTaxBeforeRefundableCredits: 4_016 }) });
  money(r.deduction, 2_500 + 4_016, 'line 11 plus line 12');
  // With an itemized figure too, it is added to whichever of the two is larger.
  const itemized = al({
    federal: federal(50_000, { incomeTaxBeforeRefundableCredits: 4_016 }),
    stateItemizedDeductions: 3_825,
  });
  money(itemized.deduction, 3_825 + 4_016, 'Schedule A plus line 12');
});

test('a federal refundable credit RAISES Alabama tax, and the deduction floors at zero', () => {
  const at = (extra) => al({ filingStatus: 'headOfHousehold', dependents: 2, federal: federal(30_000, extra) }).tax;
  const bare = at({ incomeTaxBeforeRefundableCredits: 700 });
  // $4,000 of earned income credit wipes out the $700 of federal tax, so the
  // whole deduction goes and the Alabama tax rises by 5% of it.
  money(at({ incomeTaxBeforeRefundableCredits: 700, earnedIncomeCredit: 4_000 }) - bare, 35);
  // Floored, not negative: a bigger credit cannot push Alabama higher still.
  money(
    at({ incomeTaxBeforeRefundableCredits: 700, earnedIncomeCredit: 40_000 }),
    at({ incomeTaxBeforeRefundableCredits: 700, earnedIncomeCredit: 4_000 }),
  );
  // The other two refundable credits the worksheet names, each worth the same
  // 5 cents on the dollar as the earned income credit.
  money(at({ incomeTaxBeforeRefundableCredits: 2_000, additionalChildTaxCredit: 1_000 }) -
    at({ incomeTaxBeforeRefundableCredits: 2_000 }), 50);
  money(at({ incomeTaxBeforeRefundableCredits: 2_000, refundableAmericanOpportunityCredit: 1_000 }) -
    at({ incomeTaxBeforeRefundableCredits: 2_000 }), 50);
});

test('the same input moves the answer in opposite directions in two states', () => {
  // `federal.earnedIncomeCredit` is read by the six states that match the federal
  // credit AND by Alabama's federal tax deduction worksheet, with opposite signs.
  // Nothing in the field's name says which, which is the whole reason this test
  // is here rather than a sentence in a doc comment.
  const fed = (extra) => federal(30_000, { incomeTaxBeforeRefundableCredits: 700, ...extra });
  const of = (state) => (extra) =>
    stateIncomeTax({ state, year: 2026, filingStatus: 'headOfHousehold', dependents: 2, earnedIncome: 30_000, federal: fed(extra) }).tax;
  const alabama = of('AL');
  const illinois = of('IL');
  assert.ok(alabama({ earnedIncomeCredit: 4_000 }) > alabama({}), 'Alabama rises');
  assert.ok(illinois({ earnedIncomeCredit: 4_000 }) < illinois({}), 'Illinois falls');
});

test('a return with no federal tax supplied is told what it cost', () => {
  const r = al({ agi: 50_000 });
  assert.ok(
    r.notes.some((n) => n.startsWith('NO FEDERAL INCOME TAX WAS SUPPLIED')),
    'the conditional note fires when the figure is absent',
  );
  const told = al({ federal: federal(50_000, { incomeTaxBeforeRefundableCredits: 4_016 }) });
  assert.ok(!told.notes.some((n) => n.startsWith('NO FEDERAL INCOME TAX WAS SUPPLIED')));
});

test('the next dollar of Alabama tax depends on the next dollar of FEDERAL tax', () => {
  // The only state in this package whose MARGINAL rate is not a property of its
  // own schedule. One more dollar of wages adds 5 cents of Alabama tax and also
  // adds the federal marginal rate to the federal bill, which Form 40 line 12
  // deducts — so part of the 5 cents comes straight back, and the Alabama rate
  // FALLS as the federal bracket rises.
  //
  // The federal figures here are written out rather than computed, because this
  // file may not import the federal package: a test that reaches outside its own
  // package is skipped by the mutation harness, and skipping this one would take
  // every Alabama figure out of the audit with it.
  const at = (agi, fedTax, fedTaxHigher) =>
    al({
      agi,
      federal: federal(agi, { incomeTaxBeforeRefundableCredits: fedTax }),
      federalOneDollarHigher: federal(agi + 1, {
        incomeTaxBeforeRefundableCredits: fedTaxHigher,
      }),
    }).marginalRate;
  // $50,000 of wages is inside the 12% federal bracket for 2026: 5% - 5% x 12%.
  money(at(50_000, 3_820, 3_820.12), 0.044, 'the 12% bracket');
  // $120,000 is inside the 22% bracket: 5% - 5% x 22%.
  money(at(120_000, 17_570, 17_570.22), 0.039, 'the 22% bracket');
  // And in the top federal bracket the next Alabama dollar costs 3.15%, which is
  // less than the 4.4% a filer on a quarter of the income pays: Alabama's
  // marginal rate is REGRESSIVE, and it is regressive because of a federal
  // schedule that is not.
  money(at(700_000, 211_000, 211_000.37), 0.0315, 'the 37% bracket');
  // Without the second basis the engine reports the schedule's own 5% — too
  // high, and the note says so rather than leaving it to be noticed.
  money(
    al({ agi: 120_000, federal: federal(120_000, { incomeTaxBeforeRefundableCredits: 17_570 }) })
      .marginalRate,
    0.05,
  );
});

// ---------------------------------------------------------------------------
// § 40-18-19(a)(9): one dependent chart for five filing statuses
// ---------------------------------------------------------------------------

test('the dependent chart boundaries are inclusive, both of them', () => {
  // "equal to or less than fifty thousand dollars" takes the $1,000, and "in
  // excess of fifty thousand dollars and equal to or less than one hundred
  // thousand dollars" takes the $500. PolicyEngine-US reads both the other way.
  const exemptions = (agi) => al({ agi, dependents: 1 }).exemptions;
  assert.equal(exemptions(50_000), 1_500 + 1_000);
  assert.equal(exemptions(50_001), 1_500 + 500);
  assert.equal(exemptions(100_000), 1_500 + 500);
  assert.equal(exemptions(100_001), 1_500 + 300);
  // One dollar at the boundary costs $25 of tax, plus five cents on the dollar.
  money(al({ agi: 50_001, dependents: 1 }).tax - al({ agi: 50_000, dependents: 1 }).tax, 25.05);
});

test('one chart serves five filing statuses, so the joint return is the penalised one', () => {
  // Written as the loop over all five statuses: the chart has no status column at
  // all, and the claim is that none of the five gets a different amount.
  for (const filingStatus of FILING_STATUSES) {
    const one = al({ agi: 50_000, dependents: 1, filingStatus }).exemptions;
    const two = al({ agi: 50_001, dependents: 1, filingStatus }).exemptions;
    assert.equal(one - two, 500, `${filingStatus} loses $500 on the dollar`);
  }
  // And the marriage penalty that follows from it: two single parents at $50,000
  // each claim $1,000 a child; the same two people jointly on $100,000 claim $500.
  assert.equal(al({ agi: 50_000, dependents: 1 }).exemptions - 1_500, 1_000);
  assert.equal(
    al({ agi: 100_000, dependents: 2, filingStatus: 'marriedFilingJointly' }).exemptions - 3_000,
    1_000,
  );
});

test('the chart’s top step is stored once more and the two agree', () => {
  const def = getStateDefinition('AL', 2026);
  assert.equal(def.exemption.perDependent, def.exemption.perDependentSteps[0].amount);
});

// ---------------------------------------------------------------------------
// Ala. Admin. Code r. 810-3-19-.04: the plan, not the person
// ---------------------------------------------------------------------------

test('a defined benefit pension is exempt in full at any age, and a 401(k) is not', () => {
  const at = (age, field) =>
    al({ agi: 60_000, filerAge: age, retirement: { filer: { [field]: 60_000 } } });
  // No age test on the exempt half: 50 and 80 are the same answer.
  for (const age of [50, 62, 65, 80]) {
    money(at(age, 'employerPlanPension').tax, 0, `defined benefit at ${age}`);
    money(at(age, 'governmentPension').tax, 0, `government retired pay at ${age}`);
    money(at(age, 'militaryRetirement').tax, 0, `military retired pay at ${age}`);
  }
  // The defined contribution half, below and above 65. $60,000 of AGI less the
  // $2,500 floored deduction and the $1,500 exemption is $56,000 of taxable
  // income: $110 on the first $3,000 and 5% of the rest.
  money(at(62, 'definedContributionPlan').tax, 2_760);
  money(at(65, 'definedContributionPlan').tax, 2_460);
  // Exactly the $6,000 exclusion at 5%, and not a dollar more.
  money(at(62, 'definedContributionPlan').tax - at(65, 'definedContributionPlan').tax, 300);
  money(at(65, 'iraDistributions').tax, 2_460, 'an IRA is a defined contribution plan here');
});

test('the $6,000 is per person, so which spouse drew it changes the answer', () => {
  const joint = (split) =>
    al({
      agi: 60_000,
      filingStatus: 'marriedFilingJointly',
      filerAge: 67,
      spouseAge: 67,
      retirement: split,
    }).tax;
  const onOne = joint({ filer: { definedContributionPlan: 12_000 }, spouse: {} });
  const onBoth = joint({
    filer: { definedContributionPlan: 6_000 },
    spouse: { definedContributionPlan: 6_000 },
  });
  // $6,000 of exclusion against $12,000 of draw when one person took it, $12,000
  // when they split it — $300 of tax on a return whose totals are identical.
  money(onOne - onBoth, 300);
});

test('a household total says nothing about the plan, so neither half reads it', () => {
  const r = al({ agi: 60_000, filerAge: 67, retirementIncome: 60_000 });
  money(subtractionNamed(r, 'defined benefit'), 0, 'nothing is exempted on a guess');
  money(r.tax, 2_760, 'the income stays taxable');
  assert.ok(r.notes.some((n) => n.startsWith('A PLAN TYPE WAS ASSUMED')));
});

test('Social Security is exempt and is outside the AGI the two charts read', () => {
  // The contrast is the point: the retiree and the wage earner have the same
  // federal AGI, and the retiree keeps the maximum standard deduction and the
  // $1,000 dependent exemption that the wage earner has lost.
  const retiree = al({
    agi: 60_000,
    dependents: 1,
    filerAge: 67,
    taxableSocialSecurity: 20_000,
    retirement: { filer: { employerPlanPension: 40_000, socialSecurityBenefits: 24_000 } },
  });
  money(retiree.tax, 0, 'nothing is left in the base');
  money(subtractionNamed(retiree, 'social security'), 20_000);
  const partial = al({
    agi: 60_000,
    dependents: 1,
    filerAge: 67,
    taxableSocialSecurity: 20_000,
    retirement: { filer: { definedContributionPlan: 40_000, socialSecurityBenefits: 24_000 } },
  });
  // Alabama AGI is $40,000 less the $6,000 exclusion = $34,000, which is still
  // inside the staircase: $3,000 - 17 x $25 = $2,575 of deduction, the full
  // $1,000 dependent exemption, and $110 + 5% above $3,000 on the rest.
  money(partial.deduction, 2_575, 'the staircase reads the state AGI, not the federal one');
  assert.equal(partial.exemptions, 1_500 + 1_000);
  money(partial.tax, 0.05 * (34_000 - 2_575 - 2_500) - 40);
});

// ---------------------------------------------------------------------------
// Overtime, three ways in three years
// ---------------------------------------------------------------------------

test('HB 527 deducts the overtime premium in 2026, capped at $1,000, and 2025 has nothing', () => {
  const with2026 = (overtime) =>
    al({ year: 2026, agi: 50_000, federalDeductions: { overtime } });
  money(with2026(0).tax - with2026(600).tax, 30, '$600 of premium at 5%');
  money(with2026(0).tax - with2026(1_000).tax, 50, 'the cap');
  money(with2026(0).tax - with2026(12_500).tax, 50, 'still the cap');
  assert.equal(subtractionNamed(with2026(600), 'overtime'), 600);
  // 2025 carries no Alabama overtime rule: the exclusion that year covered only
  // overtime paid before 30 June and is a payroll figure, so the note says to
  // pass it through `subtractions` and the engine reads nothing.
  const in2025 = al({ year: 2025, agi: 50_000, federalDeductions: { overtime: 1_000 } });
  const bare2025 = al({ year: 2025, agi: 50_000 });
  money(in2025.tax, bare2025.tax, '2025 reads no overtime deduction');
  assert.equal(getStateDefinition('AL', 2025).compensationExclusions, undefined);
  assert.equal(getStateDefinition('AL', 2026).compensationExclusions.length, 1);
});

// ---------------------------------------------------------------------------
// The whole return, once, at a household a human can check
// ---------------------------------------------------------------------------

test('a single filer on $50,000 of wages, end to end', () => {
  // $3,820 is the 2026 federal income tax on $50,000 of wages for a single
  // filer — `us-federal-tax`'s own figure, not a plausible one — and $3,825 is
  // the Social Security and Medicare tax on the same wages.
  const r = al({
    agi: 50_000,
    earnedIncome: 50_000,
    federal: federal(50_000, { incomeTaxBeforeRefundableCredits: 3_820 }),
  });
  // Alabama AGI $50,000; standard deduction floored at $2,500 (the staircase is
  // 49 steps past its threshold, so the floor binds); federal income tax $3,820;
  // personal exemption $1,500; taxable income $42,180; tax $110 + 5% of $39,180.
  money(r.taxableIncome, 42_180);
  money(r.tax, 110 + 0.05 * 39_180);
  money(r.tax, 2_069);
  // The effective rate on the whole AGI, which is the number a filer feels.
  money(r.tax / 50_000, 0.04138);
  // And the same filer with their Schedule A, which is what they should file:
  // the FICA replaces the $2,500 floor and the bill falls by $66.25.
  const itemizing = al({
    agi: 50_000,
    earnedIncome: 50_000,
    socialSecurityAndMedicarePaid: 3_825,
    federal: federal(50_000, { incomeTaxBeforeRefundableCredits: 3_820 }),
  });
  money(itemizing.taxableIncome, 40_855);
  money(itemizing.tax, 2_002.75);
  money(r.tax - itemizing.tax, 66.25);
});
