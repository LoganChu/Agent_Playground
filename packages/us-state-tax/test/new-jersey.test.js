// New Jersey. The state with no federal starting line, the largest cliff in this
// package, and a set of published tables that turn out to be generated.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getStateDefinition, stateIncomeTax } from '../dist/esm/index.js';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

// New Jersey reads none of these. They are here because the input type requires
// them, and passing something plausible rather than zero makes it visible in the
// test that the answers below do not move when they change.
const FEDERAL = {
  adjustedGrossIncome: 120_000,
  taxableIncome: 104_250,
  deduction: 15_750,
  deductionKind: 'standard',
};

const nj = (opts = {}) =>
  stateIncomeTax({
    state: 'NJ',
    year: opts.year ?? 2025,
    filingStatus: opts.filingStatus ?? 'single',
    federal: { ...FEDERAL, ...(opts.federal ?? {}) },
    ...opts,
  });

const creditNamed = (result, fragment) =>
  result.credits.find((c) => c.name.toLowerCase().includes(fragment))?.amount ?? 0;

// ---------------------------------------------------------------------------
// The base
// ---------------------------------------------------------------------------

test('New Jersey refuses federal AGI and names the field it needs', () => {
  assert.throws(
    () => stateIncomeTax({ state: 'NJ', year: 2025, filingStatus: 'single', federal: FEDERAL }),
    /newJerseyGrossIncome/,
  );
  // The message has to say why, because the caller is often a language model and
  // "supply a number" invites it to supply federal AGI.
  assert.throws(
    () => stateIncomeTax({ state: 'NJ', year: 2025, filingStatus: 'single', federal: FEDERAL }),
    /403\(b\)/,
  );
  assert.equal(getStateDefinition('NJ', 2025).base, 'stateDefined');
  // And the answer does not move with the federal figures, which is the whole
  // claim that 'stateDefined' makes.
  const a = nj({ newJerseyGrossIncome: 100_000 }).tax;
  const b = nj({
    newJerseyGrossIncome: 100_000,
    federal: { adjustedGrossIncome: 500_000, taxableIncome: 480_000 },
  }).tax;
  money(a, b, 'federal figures are not consulted');
});

// ---------------------------------------------------------------------------
// The published rate schedules are a rendering of the marginal ones
// ---------------------------------------------------------------------------

/**
 * New Jersey publishes its tax as "multiply line 41 by .05525 and subtract
 * $1,492.50". This reconstructs the subtraction column from the marginal
 * schedule: for a band beginning at `threshold`, the constant is
 * `rate x threshold - (tax already collected below the threshold)`.
 */
function subtractionColumn(status) {
  const brackets = getStateDefinition('NJ', 2025).rate.byStatus[status];
  const out = [];
  let cumulative = 0;
  let previous = 0;
  for (const bracket of brackets) {
    if (previous > 0) out.push(Number((bracket.rate * previous - cumulative).toFixed(2)));
    if (Number.isFinite(bracket.upTo)) cumulative += (bracket.upTo - previous) * bracket.rate;
    previous = bracket.upTo;
  }
  return out;
}

test('the thirteen published subtraction constants are generated, not stored', () => {
  // Schedule I — single and married filing separately. Every figure here is
  // printed in the NJ-1040 rate schedules; none of them is in this package.
  assert.deepEqual(
    subtractionColumn('single'),
    [70, 682.5, 1_492.5, 2_126.25, 15_126.25, 32_926.25],
  );
  assert.deepEqual(subtractionColumn('marriedFilingSeparately'), subtractionColumn('single'));

  // Schedule II — joint, head of household and qualifying surviving spouse.
  assert.deepEqual(
    subtractionColumn('marriedFilingJointly'),
    [70, 420, 1_155, 2_775, 4_042.5, 17_042.5, 34_842.5],
  );
  assert.deepEqual(
    subtractionColumn('headOfHousehold'),
    subtractionColumn('marriedFilingJointly'),
  );
  assert.deepEqual(
    subtractionColumn('qualifyingSurvivingSpouse'),
    subtractionColumn('marriedFilingJointly'),
  );
});

test('the schedules reproduce the published "multiply and subtract" arithmetic', () => {
  // A single filer at $100,000 of taxable income: .0637 x 100,000 - 2,126.25.
  const single = nj({ newJerseyGrossIncome: 101_000 });
  money(single.taxableIncome, 100_000);
  money(single.tax, 0.0637 * 100_000 - 2_126.25);
  money(single.tax, 4_243.75);

  // A joint filer at the same taxable income is not even in the same band: on
  // Schedule II $100,000 is still inside 5.525%, and the published line reads
  // .05525 x 100,000 - 2,775.
  const joint = nj({ newJerseyGrossIncome: 102_000, filingStatus: 'marriedFilingJointly' });
  money(joint.taxableIncome, 100_000);
  money(joint.tax, 0.05525 * 100_000 - 2_775);
  money(joint.tax, 2_750);
  // Which is $1,493.75 less than the single filer pays on the same income — the
  // whole reason New Jersey publishes two schedules rather than one.
  money(single.tax - joint.tax, 1_493.75);
});

test('a head of household gets the JOINT schedule, which is unusual', () => {
  const hoh = nj({ newJerseyGrossIncome: 61_000, filingStatus: 'headOfHousehold' });
  const joint = nj({ newJerseyGrossIncome: 62_000, filingStatus: 'marriedFilingJointly' });
  money(hoh.taxableIncome, 60_000);
  money(joint.taxableIncome, 60_000);
  money(hoh.tax, joint.tax, 'same taxable income, same schedule');
  // And it is a real saving against Schedule I, entirely from the 2.45% band
  // that Schedule I does not have.
  const single = nj({ newJerseyGrossIncome: 61_000 });
  money(single.taxableIncome, 60_000);
  assert.ok(single.tax > hoh.tax + 500, 'Schedule I costs a head of household much more');
});

// ---------------------------------------------------------------------------
// The filing threshold is a cliff
// ---------------------------------------------------------------------------

test('below the filing threshold there is no tax at all, and one dollar later there is', () => {
  money(nj({ newJerseyGrossIncome: 10_000 }).tax, 0);
  money(nj({ newJerseyGrossIncome: 10_001 }).tax, 126.01);
  // The tax is on taxable income and the threshold is on gross income, so the
  // whole first bracket arrives at once and marginalRate reports the cliff.
  money(nj({ newJerseyGrossIncome: 10_000 }).marginalRate, 126.014);

  const joint = (income) =>
    nj({ newJerseyGrossIncome: income, filingStatus: 'marriedFilingJointly' });
  money(joint(20_000).tax, 0);
  money(joint(20_001).tax, 252.01);
  // Two exemptions instead of one means the joint filer falls twice as far —
  // the size of this cliff is a property of the filer, not of the threshold.
  money(joint(20_001).tax - nj({ newJerseyGrossIncome: 10_001 }).tax, 126);
});

test('the threshold does not take the refundable credits with it', () => {
  // New Jersey tells filers under the threshold to file anyway and claim the
  // earned income credit, so zeroing the tax must not zero the credits.
  const r = nj({
    newJerseyGrossIncome: 9_000,
    filingStatus: 'headOfHousehold',
    earnedIncome: 9_000,
    dependentAges: [2],
    federal: { earnedIncomeCredit: 3_500 },
  });
  money(r.tax, -1_400 - 1_000, 'no tax, but the credits are still paid');
  money(creditNamed(r, 'earned income'), 1_400);
  money(creditNamed(r, 'child tax credit'), 1_000);
});

// ---------------------------------------------------------------------------
// Exemptions
// ---------------------------------------------------------------------------

test('the exemptions stack per person and per dependent', () => {
  const base = nj({ newJerseyGrossIncome: 100_000 });
  money(base.exemptions, 1_000);

  money(nj({ newJerseyGrossIncome: 100_000, filerAge: 65 }).exemptions, 2_000, 'senior at 65');
  money(nj({ newJerseyGrossIncome: 100_000, filerAge: 64 }).exemptions, 1_000, 'not at 64');
  money(
    nj({
      newJerseyGrossIncome: 100_000,
      filingStatus: 'marriedFilingJointly',
      filerAge: 70,
      spouseAge: 68,
    }).exemptions,
    4_000,
    'two filers, two senior exemptions',
  );
  money(
    nj({ newJerseyGrossIncome: 100_000, blindOrDisabled: 1 }).exemptions,
    2_000,
    'blind or disabled',
  );
  money(
    nj({ newJerseyGrossIncome: 100_000, dependentAges: [8, 12, 20], dependentsAttendingCollege: 1 })
      .exemptions,
    1_000 + 3 * 1_500 + 1_000,
    'three dependents, one of them at college',
  );
  // A college dependent is a dependent as well, not instead — and cannot exceed
  // the dependents claimed.
  money(
    nj({ newJerseyGrossIncome: 100_000, dependents: 1, dependentsAttendingCollege: 3 }).exemptions,
    1_000 + 1_500 + 1_000,
  );
});

test('a qualifying surviving spouse is one person for exemptions and two for the rate schedule', () => {
  const qss = nj({ newJerseyGrossIncome: 61_000, filingStatus: 'qualifyingSurvivingSpouse' });
  money(qss.exemptions, 1_000, 'one $1,000 exemption, not two');
  const joint = nj({ newJerseyGrossIncome: 62_000, filingStatus: 'marriedFilingJointly' });
  money(qss.taxableIncome, 60_000);
  money(joint.taxableIncome, 60_000);
  money(qss.tax, joint.tax, 'but the joint rate schedule');
});

// ---------------------------------------------------------------------------
// The retirement income exclusion, and the largest cliff in this package
// ---------------------------------------------------------------------------

const retiree = (totalIncome, opts = {}) =>
  nj({
    newJerseyGrossIncome: totalIncome,
    filingStatus: opts.filingStatus ?? 'marriedFilingJointly',
    retirementIncome: opts.pension ?? 100_000,
    filerAge: opts.age ?? 70,
    ...opts,
  });

test('the exclusion tiers are 100%, 50% and 25% of the pension, capped at the maximum', () => {
  const excluded = (income, opts) =>
    retiree(income, opts).computedSubtractions.find((s) => s.name.includes('exclusion')).amount;

  money(excluded(100_000), 100_000, 'the whole pension below $100,000 of total income');
  money(excluded(100_001), 50_000, 'half of it one dollar later');
  money(excluded(125_001), 25_000);
  money(excluded(150_001), 0, 'and nothing at all above $150,000');

  // The cap binds where the percentage does not: 50% of a $250,000 pension is
  // $125,000, more than a joint return may exclude.
  money(excluded(100_001, { pension: 250_000 }), 100_000);
});

test('the six non-joint tier percentages are derived from the four maxima', () => {
  const rule = getStateDefinition('NJ', 2025).retirementExclusion;
  const jointMax = rule.maximum.marriedFilingJointly;
  const fraction = (status, jointPercentage) =>
    jointPercentage >= 1 ? 1 : jointPercentage * (rule.maximum[status] / jointMax);

  // The four published partial percentages, none of them stored in this package.
  money(fraction('single', 0.5), 0.375);
  money(fraction('single', 0.25), 0.1875);
  money(fraction('marriedFilingSeparately', 0.5), 0.25);
  money(fraction('marriedFilingSeparately', 0.25), 0.125);
  // And a head of household and a surviving spouse share the single maximum,
  // so they share its percentages too.
  money(fraction('headOfHousehold', 0.5), 0.375);
  money(fraction('qualifyingSurvivingSpouse', 0.5), 0.375);

  // The engine agrees with the arithmetic above: $100,000 of pension, single,
  // in the middle tier, is 37.5% of it.
  const single = retiree(120_000, { filingStatus: 'single' });
  money(
    single.computedSubtractions.find((s) => s.name.includes('exclusion')).amount,
    37_500,
  );
});

test('one dollar at $150,000 of total income costs $1,381.31 — the largest cliff here', () => {
  const at = retiree(150_000);
  const past = retiree(150_001);
  money(at.tax, 3_965.5);
  money(past.tax, 5_346.81);
  money(past.tax - at.tax, 1_381.31);
  // Reported as the marginal rate, because the rate is measured by running the
  // whole return a dollar higher rather than by reading the 5.525% band the
  // filer is standing in.
  money(at.marginalRate, 1_381.3052);
  assert.ok(retiree(149_000).marginalRate < 0.06, 'and a thousand dollars earlier it is a rate');
});

test('the exclusion is gated on age 62 and on nothing else this package can see', () => {
  // 62 and 64 both qualify for the exclusion and neither is old enough for the
  // $1,000 senior exemption, which is a different age in the same statute.
  money(retiree(120_000, { age: 62 }).tax, retiree(120_000, { age: 64 }).tax);
  money(retiree(120_000, { age: 62 }).tax, 1_246);
  money(retiree(120_000, { age: 65 }).tax, 1_221.5, 'and the senior exemption arrives at 65');
  const tooYoung = retiree(120_000, { age: 61 });
  money(
    tooYoung.computedSubtractions.find((s) => s.name.includes('exclusion')).amount,
    0,
    'nothing at 61',
  );
  // Supplying no age at all is the same as being too young, which is the safe
  // direction: it computes a tax that is too high and says so, rather than
  // handing a 40-year-old a $100,000 exclusion.
  const noAge = nj({
    newJerseyGrossIncome: 120_000,
    filingStatus: 'marriedFilingJointly',
    retirementIncome: 100_000,
  });
  money(noAge.tax, tooYoung.tax);
});

test('the other retirement income exclusion turns on $3,000 of earnings', () => {
  // A 70-year-old couple with $60,000 of interest and dividends, no pension and
  // no wages: the unused exclusion covers all of it and the tax is zero.
  const quiet = nj({
    newJerseyGrossIncome: 60_000,
    filingStatus: 'marriedFilingJointly',
    filerAge: 70,
    retirementIncome: 0,
    earnedIncome: 0,
  });
  money(quiet.tax, 0);

  // The same couple with $3,001 of that income earned rather than received.
  const working = nj({
    newJerseyGrossIncome: 60_000,
    filingStatus: 'marriedFilingJointly',
    filerAge: 70,
    retirementIncome: 0,
    earnedIncome: 3_001,
  });
  money(working.tax, 976.5, 'one dollar of wages over the limit costs the whole exclusion');
});

// ---------------------------------------------------------------------------
// The child tax credit: five cliffs, and a 25% raise for 2026
// ---------------------------------------------------------------------------

const family = (taxableIncome, year = 2025, ages = [1, 3, 5]) =>
  nj({
    year,
    // Two personal exemptions plus $1,500 for each dependent, so that the
    // taxable income the credit steps on is exactly the figure asked for.
    newJerseyGrossIncome: taxableIncome + 2_000 + ages.length * 1_500,
    filingStatus: 'marriedFilingJointly',
    dependentAges: ages,
  });

test('the child tax credit is a staircase on taxable income, and each step is per child', () => {
  money(family(30_000).taxableIncome, 30_000, 'the step is measured on taxable income');
  money(creditNamed(family(30_000), 'child tax credit'), 3_000);
  money(creditNamed(family(30_001), 'child tax credit'), 2_400);
  money(creditNamed(family(40_001), 'child tax credit'), 1_800);
  money(creditNamed(family(50_001), 'child tax credit'), 1_200);
  money(creditNamed(family(60_001), 'child tax credit'), 600);
  money(creditNamed(family(80_001), 'child tax credit'), 0);

  // $600 on one dollar of income, for a family of three young children. The
  // marginal rate says so.
  money(family(30_000).marginalRate, 600.0175);
});

test('P.L. 2026, c.26 is a flat 25% on every step', () => {
  for (const income of [30_000, 30_001, 40_001, 50_001, 60_001]) {
    const y2025 = creditNamed(family(income, 2025), 'child tax credit');
    const y2026 = creditNamed(family(income, 2026), 'child tax credit');
    money(y2026, y2025 * 1.25, `step at ${income}`);
  }
  money(creditNamed(family(30_000, 2026), 'child tax credit'), 3_750);
  // Which makes the first cliff $750 for this family rather than $600.
  money(
    creditNamed(family(30_000, 2026), 'child tax credit') -
      creditNamed(family(30_001, 2026), 'child tax credit'),
    750,
  );
});

test('the credit is per child under 6, refundable, and denied to married filing separately', () => {
  money(creditNamed(family(30_000, 2025, [1]), 'child tax credit'), 1_000, 'one child');
  money(creditNamed(family(30_000, 2025, [5, 6]), 'child tax credit'), 1_000, 'six is too old');
  money(creditNamed(family(30_000, 2025, [7, 9]), 'child tax credit'), 0);

  // Refundable: the credit exceeds the tax and the result goes negative.
  assert.ok(family(30_000).tax < 0);

  const separate = nj({
    newJerseyGrossIncome: 36_500,
    filingStatus: 'marriedFilingSeparately',
    dependentAges: [1, 3, 5],
  });
  money(creditNamed(separate, 'child tax credit'), 0, 'nothing for a separate filer');
  assert.ok(separate.tax > 0);
});

test('a dependent count without ages computes the credit as zero rather than guessing', () => {
  const counted = nj({
    newJerseyGrossIncome: 36_500,
    filingStatus: 'marriedFilingJointly',
    dependents: 3,
  });
  money(creditNamed(counted, 'child tax credit'), 0);
  // But the exemptions still count them, so the omission costs only the credit.
  money(counted.exemptions, 2_000 + 3 * 1_500);
});

// ---------------------------------------------------------------------------
// The earned income credit
// ---------------------------------------------------------------------------

test('the earned income credit is 40% of the federal one and is refundable', () => {
  const rule = getStateDefinition('NJ', 2025).earnedIncomeCredit;
  assert.equal(rule.matchRate, 0.4);
  assert.equal(rule.refundable, true);
  const r = nj({
    newJerseyGrossIncome: 22_000,
    filingStatus: 'headOfHousehold',
    earnedIncome: 22_000,
    dependentAges: [4, 8],
    federal: { earnedIncomeCredit: 5_000 },
  });
  money(creditNamed(r, 'earned income'), 2_000);
  assert.ok(r.tax < 0, 'and it is paid out');
});

test('the notes say that the credit reaches filers the federal one does not', () => {
  const notes = getStateDefinition('NJ', 2025).notes.join(' ');
  assert.match(notes, /18 to 24/);
  assert.match(notes, /notional federal amount/);
});

// ---------------------------------------------------------------------------
// Property tax: deduction or credit, whichever wins
// ---------------------------------------------------------------------------

test('the engine runs the return both ways and keeps the cheaper', () => {
  const withTax = (propertyTaxPaid) => nj({ newJerseyGrossIncome: 25_000, propertyTaxPaid });

  // At $2,857 of property tax the 1.75% deduction is worth $49.99 and the flat
  // credit wins; one dollar more and the deduction does.
  const credited = withTax(2_857);
  money(credited.deduction, 0);
  money(creditNamed(credited, 'property tax credit'), 50);
  money(credited.tax, 300);

  const deducted = withTax(2_858);
  money(deducted.deduction, 2_858);
  money(creditNamed(deducted, 'property tax credit'), 0);
  money(deducted.tax, 299.99);

  // Which is the crossover the NJ-1040 describes: the credit is $50 and the
  // deduction is worth the filer's marginal rate times the property tax.
  money(2_857 * 0.0175, 49.9975);
  money(2_858 * 0.0175, 50.015);
});

test('a tenant deducts 18% of rent, and the deduction is capped at $15,000', () => {
  const tenant = nj({ newJerseyGrossIncome: 60_000, rentPaid: 24_000 });
  money(tenant.deduction, 4_320, '18% of $24,000');
  const owner = nj({ newJerseyGrossIncome: 120_000, propertyTaxPaid: 20_000 });
  money(owner.deduction, 15_000, 'capped');
  // A filer who supplies neither is not given one.
  money(nj({ newJerseyGrossIncome: 60_000 }).deduction, 0);
});

// ---------------------------------------------------------------------------
// Year over year
// ---------------------------------------------------------------------------

test('nothing but the child tax credit moved between 2025 and 2026', () => {
  for (const status of ['single', 'marriedFilingJointly', 'headOfHousehold']) {
    for (const income of [15_000, 45_000, 120_000, 600_000, 2_000_000]) {
      const a = nj({ newJerseyGrossIncome: income, filingStatus: status, year: 2025 });
      const b = nj({ newJerseyGrossIncome: income, filingStatus: status, year: 2026 });
      money(a.tax, b.tax, `${status} at ${income}`);
    }
  }
  // New Jersey indexes nothing, so this is a statement about the statute rather
  // than a carry-forward — which is why the 2026 definition is 'published'.
  assert.equal(getStateDefinition('NJ', 2026).status, 'published');
  assert.equal(getStateDefinition('NJ', 2025).status, 'published');
});
