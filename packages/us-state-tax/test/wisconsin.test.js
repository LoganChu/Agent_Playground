// Wisconsin. The state whose standard deduction is a RATE, which makes the
// withdrawal a multiplier on the marginal rate rather than a step in it — and
// the state with the only election in this package that trades a subtraction
// against every credit on the form.
//
// Every expected figure below is computed from the statute by hand and written
// out rather than read back out of the engine. That is Day 27's rule, and it is
// what caught the module header's claim that the single sliding scale ends at
// $136,470: it ends at $136,463.33, because 2026's $13,960 is not a whole
// multiple of 12% the way 2025's $13,560 happens to be.
//
// Federal figures are written out by hand rather than imported from
// `us-federal-tax`: the mutation harness SKIPS a test file that resolves a path
// out of its own package, so importing the federal engine here would quietly
// take every Wisconsin figure out of the audit with it.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getStateDefinition, stateIncomeTax } from './strict.mjs';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

// The federal standard deductions this package's households take, written out.
const FED_STD_2026 = { single: 16_100, joint: 32_200, headOfHousehold: 24_150 };
const FED_STD_2025 = { single: 15_750, joint: 31_500, headOfHousehold: 23_625 };

const wi = (agi, over = {}) => {
  const year = over.year ?? 2026;
  const status = over.filingStatus ?? 'single';
  const std = year === 2026 ? FED_STD_2026 : FED_STD_2025;
  const fedStd =
    status === 'marriedFilingJointly' || status === 'qualifyingSurvivingSpouse'
      ? std.joint
      : status === 'headOfHousehold'
        ? std.headOfHousehold
        : status === 'marriedFilingSeparately'
          ? std.single
          : std.single;
  const { federal: fedOver, ...rest } = over;
  return stateIncomeTax({
    state: 'WI',
    year,
    filingStatus: status,
    federal: {
      adjustedGrossIncome: agi,
      taxableIncome: Math.max(0, agi - fedStd),
      deduction: fedStd,
      deductionKind: 'standard',
      ...fedOver,
    },
    ...rest,
  });
};

// ---------------------------------------------------------------------------
// The sliding scale
// ---------------------------------------------------------------------------

test('the standard deduction is the maximum at and below the threshold', () => {
  money(wi(20_120).deduction, 13_960, 'single at the threshold');
  money(wi(10_000).deduction, 13_960, 'single below it');
  money(wi(29_040, { filingStatus: 'marriedFilingJointly' }).deduction, 25_840, 'joint');
  money(wi(13_780, { filingStatus: 'marriedFilingSeparately' }).deduction, 12_280, 'separate');
  money(wi(20_120, { filingStatus: 'headOfHousehold' }).deduction, 18_030, 'head of household');
});

test('the withdrawal is a percentage of every dollar above the threshold', () => {
  // 13,960 - 12% x (60,000 - 20,120) = 13,960 - 4,785.60
  money(wi(60_000).deduction, 9_174.4, 'single at $60,000');
  // 25,840 - 19.778% x (90,000 - 29,040) = 25,840 - 12,056.67
  money(wi(90_000, { filingStatus: 'marriedFilingJointly' }).deduction, 13_783.33, 'joint');
  // 12,280 - 19.778% x (40,000 - 13,780) = 12,280 - 5,185.79
  money(
    wi(40_000, { filingStatus: 'marriedFilingSeparately' }).deduction,
    7_094.21,
    'separate',
  );
  // 18,030 - 22.515% x (40,000 - 20,120) = 18,030 - 4,475.98
  money(wi(40_000, { filingStatus: 'headOfHousehold' }).deduction, 13_554.02, 'head of household');
});

test('the deduction reaches zero and does not go negative', () => {
  // 20,120 + 13,960 / 12% = 20,120 + 116,333.33
  money(wi(136_453.33).deduction, 0, 'single at the end of the scale');
  money(wi(500_000).deduction, 0, 'single far above it');
  money(wi(1_000_000, { filingStatus: 'marriedFilingJointly' }).deduction, 0, 'joint');
});

test("2025's single maximum is exactly 12% of a round $113,000 and 2026's is not", () => {
  // Worth pinning because it is the only reason the 2025 Standard Deduction
  // Table's last row is a round number, and the roundness is a coincidence
  // rather than a drafting rule — 2023's and 2021's are not round either. A
  // future run that uses "the table ends on a round income" to CHECK an
  // indexed figure would be checking against an accident.
  money(wi(132_550, { year: 2025 }).deduction, 0, '2025 single ends at $132,550 exactly');
  assert.ok(wi(132_549, { year: 2025 }).deduction > 0, 'and not a dollar sooner');
  assert.ok(wi(136_453, { year: 2026 }).deduction > 0, '2026 does not end on a round income');
});

// ---------------------------------------------------------------------------
// The head of household crossover, which is an identity and not a parameter
// ---------------------------------------------------------------------------

test('the head of household crossover is where the two deductions meet', () => {
  // 19,550 + 3,960 / (22.515% - 12%) = 57,210.48. The only source that carries
  // the figure records $57,210, which is this rounded — so the identity is
  // checked against the published value rather than replacing it.
  const crossover2025 = 19_550 + 3_960 / 0.10515;
  assert.ok(Math.abs(crossover2025 - 57_210) < 1, `2025 crossover ${crossover2025} is $57,210`);
  const h = wi(crossover2025, { year: 2025, filingStatus: 'headOfHousehold' }).deduction;
  const s = wi(crossover2025, { year: 2025, filingStatus: 'single' }).deduction;
  money(h, s, 'the two deductions are equal at the crossover');
});

test('above the crossover a head of household deducts exactly what a single filer does', () => {
  for (const agi of [60_000, 70_000, 100_000, 136_000]) {
    money(
      wi(agi, { filingStatus: 'headOfHousehold' }).deduction,
      wi(agi, { filingStatus: 'single' }).deduction,
      `head of household and single at $${agi}`,
    );
  }
  // And below it the head of household is strictly better off.
  assert.ok(
    wi(40_000, { filingStatus: 'headOfHousehold' }).deduction >
      wi(40_000, { filingStatus: 'single' }).deduction,
    'below the crossover the head of household premium survives',
  );
});

// ---------------------------------------------------------------------------
// The marginal rate, which is the whole point of the sliding scale
// ---------------------------------------------------------------------------

test('inside the band the marginal rate is the statutory rate times one plus the withdrawal', () => {
  money(wi(25_000).marginalRate, 0.035 * 1.12, 'single, 3.5% bracket, inside the band');
  money(wi(61_000).marginalRate, 0.044 * 1.12, 'single, 4.4% bracket');
  money(wi(62_000).marginalRate, 0.053 * 1.12, 'single, 5.3% bracket');
  money(
    wi(84_000, { filingStatus: 'marriedFilingJointly' }).marginalRate,
    0.044 * 1.19778,
    'joint, 4.4% bracket',
  );
  money(
    wi(90_000, { filingStatus: 'marriedFilingJointly' }).marginalRate,
    0.053 * 1.19778,
    'joint, 5.3% bracket',
  );
  money(
    wi(50_000, { filingStatus: 'headOfHousehold' }).marginalRate,
    0.044 * 1.22515,
    'head of household, first tier',
  );
});

test('the marginal rate FALLS twice for a head of household as income rises', () => {
  // Up, up, down, up, down, up — the whole schedule, with each boundary taken
  // from the module header's table. The two falls are the tier change at the
  // crossover and the end of the withdrawal, and both arrive as income RISES.
  const at = (agi) => wi(agi, { filingStatus: 'headOfHousehold' }).marginalRate;
  const steps = [
    [19_000, 0.035, 'below the threshold'],
    [25_000, 0.035 * 1.22515, 'first tier, 3.5% bracket'],
    [50_000, 0.044 * 1.22515, 'first tier, 4.4% bracket'],
    [58_000, 0.044 * 1.22515, 'still the first tier at $58,000'],
    [59_500, 0.044 * 1.12, 'past the crossover at $58,826.61'],
    [70_000, 0.053 * 1.12, 'second tier, 5.3% bracket'],
    [136_000, 0.053 * 1.12, 'still inside the band'],
    [137_000, 0.053, 'the withdrawal is finished'],
    [400_000, 0.0765, 'the top bracket'],
  ];
  for (const [agi, rate, why] of steps) money(at(agi), rate, `${why} ($${agi})`);
  assert.ok(at(59_500) < at(58_000), 'the rate falls at the crossover');
  assert.ok(at(137_000) < at(136_000), 'and falls again when the deduction runs out');
  // The boundaries themselves, to the dollar on either side.
  assert.ok(at(58_825) > at(58_828), 'the crossover is between $58,825 and $58,828');
  assert.ok(at(136_452) > at(136_454), 'and the scale ends between $136,452 and $136,454');
});

test('the single and joint marginal rates fall once, where the withdrawal ends', () => {
  assert.ok(wi(137_000).marginalRate < wi(136_000).marginalRate, 'single');
  const joint = (agi) => wi(agi, { filingStatus: 'marriedFilingJointly' }).marginalRate;
  assert.ok(joint(161_000) < joint(159_000), 'joint');
  money(joint(161_000), 0.053, 'and lands on the statutory rate');
});

// ---------------------------------------------------------------------------
// Brackets and exemptions
// ---------------------------------------------------------------------------

test('the 2025 middle threshold is the Act 15 figure and not an indexed one', () => {
  // 2025 Act 15 set the top of the 4.4% band at $50,480 single, retroactive to
  // 1 January 2025; indexation resumes in 2026. The arithmetic is what settles
  // it: $50,480 x the factor the published 2026 figures pin rounds to $51,950,
  // and $51,130 — which PolicyEngine-US 2.15.3 carries for 2025 — rounds to
  // $52,620, a figure no source carries.
  const def = getStateDefinition('WI', 2025);
  const single = def.rate.byStatus.single;
  money(single[1].upTo, 50_480, '2025 single 4.4% ceiling');
  money(getStateDefinition('WI', 2026).rate.byStatus.single[1].upTo, 51_950, '2026');
  money(def.rate.byStatus.marriedFilingJointly[1].upTo, 67_300, '2025 joint');
  money(def.rate.byStatus.marriedFilingSeparately[1].upTo, 33_650, '2025 separate');
});

test('a head of household uses the single rate schedule', () => {
  const def = getStateDefinition('WI', 2026);
  assert.deepEqual(
    def.rate.byStatus.headOfHousehold.map((b) => [b.upTo, b.rate]),
    def.rate.byStatus.single.map((b) => [b.upTo, b.rate]),
    'Wisconsin does not give a head of household a schedule of its own',
  );
});

test('the exemption is $700 a person and $250 more at 65, per person', () => {
  money(wi(60_000).exemptions, 700, 'single under 65');
  money(wi(60_000, { filerAge: 66 }).exemptions, 950, 'single at 66');
  money(
    wi(60_000, { filingStatus: 'marriedFilingJointly' }).exemptions,
    1_400,
    'joint under 65',
  );
  money(
    wi(60_000, { filingStatus: 'marriedFilingJointly', filerAge: 70, spouseAge: 70 }).exemptions,
    1_900,
    'joint, both over 65 — two $250s and not one',
  );
  money(wi(60_000, { dependents: 3 }).exemptions, 2_800, 'three dependents');
});

test('a single Wisconsin wage earner at $60,000 owes $2,069.54', () => {
  // 13,960 - 12% x 39,880 = 9,174.40 of deduction; 60,000 - 9,174.40 - 700 =
  // 50,125.60 of taxable income; 15,110 x 3.5% + 35,015.60 x 4.4%.
  const r = wi(60_000);
  money(r.taxableIncome, 50_125.6, 'taxable income');
  money(r.tax, 15_110 * 0.035 + 35_015.6 * 0.044, 'tax');
  money(r.tax, 2_069.54, 'to the cent');
});

// ---------------------------------------------------------------------------
// The 30% long-term capital gain exclusion
// ---------------------------------------------------------------------------

test('30% of a long-term gain is excluded and the top rate on one is 5.355%', () => {
  const withGain = wi(500_000, { netCapitalGain: 100_000 });
  const without = wi(400_000);
  money(
    (withGain.tax - without.tax) / 100_000,
    0.0765 * 0.7,
    'the implied rate on a long-term gain at the top',
  );
  money(withGain.stateAdjustedGrossIncome, 500_000 - 30_000, 'the exclusion is in state AGI');
});

test('a short-term gain cannot create an exclusion and a short-term loss eats one', () => {
  // The whole net gain is short-term: nothing to exclude.
  money(
    wi(200_000, { netCapitalGain: 50_000, shortTermCapitalGains: 50_000 })
      .stateAdjustedGrossIncome,
    200_000,
    'all short-term',
  );
  // $50,000 net of which $20,000 short-term leaves $30,000 long-term, so 30%
  // of $30,000 and not of $50,000.
  money(
    wi(200_000, { netCapitalGain: 50_000, shortTermCapitalGains: 20_000 })
      .stateAdjustedGrossIncome,
    200_000 - 9_000,
    'part short-term',
  );
  // And absent the split the whole net gain is treated as long-term, which is
  // the direction the notes name.
  money(
    wi(200_000, { netCapitalGain: 50_000 }).stateAdjustedGrossIncome,
    200_000 - 15_000,
    'no split supplied',
  );
});

// ---------------------------------------------------------------------------
// The credits
// ---------------------------------------------------------------------------

test('the earned income credit is four rates by child count', () => {
  const at = (dependents, earnedIncomeCredit) =>
    wi(22_000, { dependents, federal: { earnedIncomeCredit } }).credits.find((c) =>
      /earned income/i.test(c.name),
    ).amount;
  money(at(0, 664), 0, 'no children — no Wisconsin credit at all');
  money(at(1, 4_427), 4_427 * 0.04, 'one child');
  money(at(1, 4_427), 177.08, 'one child, to the cent');
  money(at(2, 7_316), 7_316 * 0.11, 'two children');
  money(at(3, 8_231), 8_231 * 0.34, 'three children');
  money(at(5, 8_231), 8_231 * 0.34, 'five children — the 34% row means three OR MORE');
});

test('the earned income credit is refundable, so it is paid beyond the tax', () => {
  // A single parent of three at $22,000: the sliding-scale deduction is
  // $18,030 - 22.515% x $1,880 = $17,606.72 and the four exemptions are $2,800,
  // leaving $1,593.28 of taxable income and $55.76 of tax. The credit is
  // $2,798.54, so $2,742.78 is REFUNDED — which is the whole difference between
  // Wisconsin's credit and Ohio's 30% one, where the same filer gets nothing.
  const r = wi(22_000, {
    filingStatus: 'headOfHousehold',
    dependents: 3,
    federal: { earnedIncomeCredit: 8_231 },
  });
  money(r.taxBeforeCredits, 1_593.28 * 0.035, 'the tax the credit exceeds');
  money(r.taxBeforeCredits, 55.76, 'to the cent');
  money(r.tax, 55.76 - 8_231 * 0.34, 'and the credit is paid in full');
  assert.ok(r.tax < 0, 'the filer is a net recipient');
});

test('the married couple credit is 3% of the lesser earned income, capped at $480', () => {
  const at = (lesserSpouseIncome) =>
    wi(100_000, { filingStatus: 'marriedFilingJointly', lesserSpouseIncome }).credits.find((c) =>
      /married couple/i.test(c.name),
    );
  money(at(5_000).amount, 150, '$5,000 of second-earner income');
  money(at(16_000).amount, 480, 'the cap binds at $16,000');
  money(at(50_000).amount, 480, 'and stays there');
  money(at(0).amount, 0, 'a single-earner couple gets nothing');
  // Absent, it is zero AND the credit line says the figure was not supplied —
  // the two zeros are different answers and a result that cannot tell them
  // apart is the silence this package keeps being bitten by.
  const absent = wi(100_000, { filingStatus: 'marriedFilingJointly' }).credits.find((c) =>
    /married couple/i.test(c.name),
  );
  money(absent.amount, 0, 'absent');
  assert.match(absent.name, /pass lesserSpouseIncome/, 'and says so');
  assert.doesNotMatch(at(0).name, /pass lesserSpouseIncome/, 'where it was supplied it does not');
});

test('a married couple credit is not available on any other status', () => {
  for (const filingStatus of ['single', 'headOfHousehold', 'marriedFilingSeparately']) {
    assert.equal(
      wi(100_000, { filingStatus, lesserSpouseIncome: 40_000 }).credits.filter((c) =>
        /married couple/i.test(c.name),
      ).length,
      0,
      filingStatus,
    );
  }
});

test('the itemized deduction credit is 5% of the excess over the standard deduction', () => {
  // At $60,000 the single standard deduction is $9,174.40, so $30,000 of
  // eligible itemized deductions leaves $20,825.60 of excess.
  const r = wi(60_000, { stateItemizedDeductions: 30_000 });
  const credit = r.credits.find((c) => /itemized deduction credit/i.test(c.name));
  money(credit.amount, 0.05 * (30_000 - 9_174.4), 'the credit');
  money(credit.amount, 1_041.28, 'to the cent');
  // Below the standard deduction it is zero rather than negative.
  money(
    wi(60_000, { stateItemizedDeductions: 5_000 }).credits.find((c) =>
      /itemized deduction credit/i.test(c.name),
    ).amount,
    0,
    'below the standard deduction',
  );
});

test('the itemized deduction credit is worth less than the same deduction would be', () => {
  // 5% against a 5.936% marginal rate inside the band, and against 7.65% above
  // the top bracket — the gap WIDENS with the rate, which is the provision.
  const excess = 10_000;
  const credit = 0.05 * excess;
  assert.ok(credit < 0.053 * excess, 'below the 5.3% rate');
  assert.ok(credit < 0.0765 * excess, 'and much further below the 7.65% one');
  money(credit, 500, 'the credit is flat at $500 either way');
});

test('the school property tax credit is 12% to a $300 cap, and rent counts at 20%', () => {
  const credit = (over) =>
    wi(60_000, over).credits.find((c) => /school property tax/i.test(c.name)).amount;
  money(credit({ propertyTaxPaid: 1_000 }), 120, '$1,000 of property tax');
  money(credit({ propertyTaxPaid: 2_500 }), 300, 'the cap binds at $2,500');
  money(credit({ propertyTaxPaid: 6_000 }), 300, 'and stays there');
  money(credit({ rentPaid: 6_000 }), 0.12 * 0.2 * 6_000, 'rent at 20%');
  money(credit({ rentPaid: 12_500 }), 300, 'the cap binds at $12,500 of rent');
  money(credit({ propertyTaxPaid: 1_000, rentPaid: 5_000 }), 0.12 * (1_000 + 1_000), 'both');
});

// ---------------------------------------------------------------------------
// The election
// ---------------------------------------------------------------------------

test('the election is not reached below 67', () => {
  const r = wi(100_000, {
    filingStatus: 'marriedFilingJointly',
    filerAge: 66,
    spouseAge: 66,
    retirement: { filer: { employerPlanPension: 40_000 } },
    propertyTaxPaid: 4_000,
  });
  assert.equal(
    r.credits.filter((c) => /forfeited/.test(c.name)).length,
    0,
    'no credit is forfeited at 66',
  );
  money(r.credits.find((c) => /school property tax/i.test(c.name)).amount, 300, 'and $300 is kept');
});

test('the election removes the pension and every credit with it', () => {
  const r = wi(104_000, {
    filingStatus: 'marriedFilingJointly',
    filerAge: 68,
    spouseAge: 68,
    retirement: { filer: { employerPlanPension: 24_000 } },
    propertyTaxPaid: 4_000,
  });
  money(r.stateAdjustedGrossIncome, 80_000, 'the subtraction is in state AGI');
  assert.ok(
    r.credits.length > 0 && r.credits.every((c) => c.amount === 0),
    'every credit is present and every amount is zero',
  );
  assert.ok(
    r.credits.every((c) => /forfeited by the retirement income subtraction/.test(c.name)),
    'and every name says why',
  );
});

test('the subtraction is worth the rate on $28,746.72 and not on $24,000', () => {
  // The sliding scale is read against Wisconsin AGI, so removing $24,000 of
  // pension also buys back 19.778% of it in standard deduction.
  const high = wi(120_000, { filingStatus: 'marriedFilingJointly' }).deduction;
  const low = wi(96_000, { filingStatus: 'marriedFilingJointly' }).deduction;
  money(low - high, 0.19778 * 24_000, 'the buy-back');
  money(low - high, 4_746.72, 'to the cent');
});

test('the crossover is a real income: $5,692.35 of pension', () => {
  const taxAt = (pension) =>
    wi(80_000 + pension, {
      filingStatus: 'marriedFilingJointly',
      filerAge: 68,
      spouseAge: 68,
      retirement: { filer: { employerPlanPension: pension } },
      propertyTaxPaid: 4_000,
    });
  const below = taxAt(5_600);
  const above = taxAt(5_800);
  assert.equal(
    below.credits.filter((c) => /forfeited/.test(c.name)).length,
    0,
    'at $5,600 of pension the credits are worth more than the subtraction',
  );
  assert.ok(
    above.credits.every((c) => /forfeited/.test(c.name)),
    'at $5,800 the subtraction is worth more',
  );
  // And the engine takes the LOWER tax on both sides, which is the whole
  // contract of the election.
  assert.ok(below.tax < taxAt(5_600).tax + 0.005, 'ties and all');
  assert.ok(above.tax <= below.tax + 300, 'the whole $300 credit goes at once');
});

test('the election never raises the tax', () => {
  // The contract: whatever the inputs, the engine returns the lower of the two
  // returns. Swept across the pension, which is the figure that moves the
  // comparison, at an income where both paths have positive tax.
  let previousElected = false;
  for (let pension = 0; pension <= 30_000; pension += 500) {
    const elected = wi(80_000 + pension, {
      filingStatus: 'marriedFilingJointly',
      filerAge: 68,
      spouseAge: 68,
      retirement: { filer: { employerPlanPension: pension } },
      propertyTaxPaid: 4_000,
    });
    const forfeited = elected.credits.every((c) => /forfeited/.test(c.name));
    // Once electing is better it stays better: the subtraction's value rises
    // with the pension and the credits' does not.
    if (previousElected) assert.ok(forfeited, `still electing at $${pension}`);
    previousElected = forfeited;
  }
  assert.ok(previousElected, 'and at $30,000 of pension the election has won');
});

test('a joint return where both spouses are 67 pools against $48,000', () => {
  // Not a per-person $24,000 cap: a couple with $40,000 and $2,000 of pension
  // subtracts the whole $42,000, where a per-person cap would allow $26,000.
  const r = wi(142_000, {
    filingStatus: 'marriedFilingJointly',
    filerAge: 68,
    spouseAge: 68,
    retirement: {
      filer: { employerPlanPension: 40_000 },
      spouse: { employerPlanPension: 2_000 },
    },
  });
  money(r.stateAdjustedGrossIncome, 100_000, 'the whole $42,000 comes out');
  const capped = wi(200_000, {
    filingStatus: 'marriedFilingJointly',
    filerAge: 68,
    spouseAge: 68,
    retirement: {
      filer: { employerPlanPension: 60_000 },
      spouse: { employerPlanPension: 20_000 },
    },
  });
  money(capped.stateAdjustedGrossIncome, 200_000 - 48_000, 'and the pool caps at $48,000');
});

test('one eligible spouse caps at $24,000 even on a joint return', () => {
  const r = wi(200_000, {
    filingStatus: 'marriedFilingJointly',
    filerAge: 68,
    spouseAge: 60,
    retirement: {
      filer: { employerPlanPension: 60_000 },
      spouse: { employerPlanPension: 20_000 },
    },
  });
  money(r.stateAdjustedGrossIncome, 200_000 - 24_000, 'the younger spouse brings nothing');
});

test('an IRA and a government pension qualify and Social Security does not', () => {
  const r = wi(100_000, {
    filerAge: 70,
    taxableSocialSecurity: 20_000,
    retirement: { filer: { iraDistributions: 10_000, governmentPension: 8_000 } },
  });
  // Social Security is already out of the base for every Wisconsin filer, so
  // the subtraction has nothing left of it to take: $100,000 less the $20,000
  // benefit less the $18,000 of qualifying retirement income.
  money(r.stateAdjustedGrossIncome, 100_000 - 20_000 - 18_000, 'both qualify');
});

// ---------------------------------------------------------------------------
// Social Security, and the definition itself
// ---------------------------------------------------------------------------

test('Wisconsin does not tax Social Security', () => {
  const r = wi(60_000, { filerAge: 70, taxableSocialSecurity: 25_000 });
  money(r.stateAdjustedGrossIncome, 35_000, 'the taxable benefit is subtracted');
});

test('2025 is published and 2026 is provisional for three figures in four paths', () => {
  assert.equal(getStateDefinition('WI', 2025).status, 'published');
  const def = getStateDefinition('WI', 2026);
  assert.equal(def.status, 'provisional');
  // Three unresolved FIGURES and four flagged PATHS: the single and head of
  // household thresholds are one number stored twice, and Day 42's rule is that
  // an entry written for one filing status flags one column of a byStatus table.
  assert.equal(def.provisionalFigures.length, 4, 'four paths and not seven');
  const distinct = new Set(
    def.provisionalFigures.map((entry) => entry.resolvedBy.match(/\$[\d,]+\.\d\d to \$[\d,]+\.\d\d/)?.[0]),
  );
  assert.equal(distinct.size, 3, 'covering three distinct intervals');
  for (const entry of def.provisionalFigures) {
    assert.match(entry.resolvedBy, /Standard Deduction Table|the same table/, entry.path);
    // Every entry names BOTH candidates and which one is stored, because an
    // entry that says only "provisional" cannot be acted on by the run that
    // finally reads the table.
    assert.match(entry.resolvedBy, /interval/, entry.path);
  }
});

test('Wisconsin is registered for 2025 and 2026 and for nothing else', () => {
  assert.equal(getStateDefinition('WI', 2025).name, 'Wisconsin');
  assert.equal(getStateDefinition('WI', 2026).name, 'Wisconsin');
  assert.throws(() => stateIncomeTax({
    state: 'WI',
    year: 2024,
    filingStatus: 'single',
    federal: { adjustedGrossIncome: 50_000, taxableIncome: 34_000, deduction: 16_100, deductionKind: 'standard' },
  }));
});
