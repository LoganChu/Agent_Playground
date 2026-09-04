// New York is the state where walking the bracket table is the wrong computation.
//
// Above $107,650 of New York AGI the state runs a "tax table benefit recapture"
// (N.Y. Tax Law § 601(d)) that claws back the benefit of every bracket below the
// filer's top one, until a high earner pays their top rate on their whole income.
// The statute prints it as forty dollar amounts a year. This package stores none
// of them and derives them from the rate schedule, and these tests are the proof
// that the derivation is the same computation.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getStateDefinition, stateIncomeTax } from '../dist/esm/index.js';
import { recaptureLadder } from '../dist/esm/engine.js';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

const DEDUCTION = {
  single: 8_000,
  marriedFilingJointly: 16_050,
  marriedFilingSeparately: 8_000,
  headOfHousehold: 11_200,
  qualifyingSurvivingSpouse: 16_050,
};

const ny = (agi, opts = {}) => {
  const status = opts.filingStatus ?? 'single';
  const deduction = DEDUCTION[status];
  return stateIncomeTax({
    state: 'NY',
    year: opts.year ?? 2025,
    filingStatus: status,
    ...(opts.dependentAges
      ? { dependentAges: opts.dependentAges }
      : { dependents: opts.dependents ?? 0 }),
    federal: {
      adjustedGrossIncome: agi,
      taxableIncome: Math.max(0, agi - deduction),
      deduction,
      deductionKind: 'standard',
      earnedIncomeCredit: opts.earnedIncomeCredit,
    },
    ...(opts.federalOneDollarHigher ? { federalOneDollarHigher: opts.federalOneDollarHigher } : {}),
  });
};

const supplemental = (result) =>
  result.surtaxes.find((s) => s.name.startsWith('New York supplemental'))?.amount ?? 0;

const creditNamed = (result, prefix) =>
  result.credits.find((c) => c.name.startsWith(prefix))?.amount ?? 0;

// ---------------------------------------------------------------------------
// The derivation against the published table
// ---------------------------------------------------------------------------

// Every recapture level the statute publishes for 2025, rounded half up. Thirteen
// distinct figures over three distinct rate schedules; married filing separately
// repeats single and a qualifying surviving spouse repeats joint, so twenty-two
// assertions across the five filing statuses. Each is a number the drafters
// printed and this package does not store. (The joint schedule has one more
// bracket below 6.85% than the single one, so it has one more rung.)
const PUBLISHED_2025 = {
  single: [568, 2399, 32571, 65071],
  marriedFilingSeparately: [568, 2399, 32571, 65071],
  marriedFilingJointly: [333, 1140, 3887, 64237, 96737],
  qualifyingSurvivingSpouse: [333, 1140, 3887, 64237, 96737],
  headOfHousehold: [787, 3076, 48337, 80837],
};

test('the recapture derived from the rate schedule reproduces every published 2025 figure', () => {
  const def = getStateDefinition('NY', 2025);
  let checked = 0;
  for (const [status, expected] of Object.entries(PUBLISHED_2025)) {
    const rungs = recaptureLadder(def.rate.byStatus[status], 107_650);
    // The last rung is the over-$25,000,000 tier, which the statute has and the
    // reference datasets checked here do not. It is asserted separately below.
    assert.equal(rungs.length, expected.length + 1, `${status}: rung count`);
    expected.forEach((amount, i) => {
      assert.equal(
        Math.round(rungs[i].level),
        amount,
        `${status} rung ${i}: derived ${rungs[i].level}, statute ${amount}`,
      );
      checked += 1;
    });
  }
  assert.equal(checked, 22, 'twenty-two published figures across five filing statuses');
});

test('the derivation supplies the over-$25,000,000 tier that reference datasets omit', () => {
  const def = getStateDefinition('NY', 2025);
  const rungs = recaptureLadder(def.rate.byStatus.single, 107_650);
  const top = rungs[rungs.length - 1];
  assert.equal(top.start, 25_000_000);
  // 10.9% - 10.3% on the first $25,000,000 is exactly $150,000 more benefit to
  // recapture than the tier below, which is why the top rung is a round number
  // above the one before it.
  money(top.level - rungs[rungs.length - 2].level, 150_000, 'top tier increment');
  money(top.level, 215_070.55, 'top tier level');
});

// This is what a benefit recapture IS, and it is the reason the identity holds:
// once the phase-in is complete, the graduated rates have been undone entirely.
test('past the phase-in a New Yorker pays the top rate on every dollar, not just the last band', () => {
  // AGI $6,008,000, standard deduction $8,000, so taxable income is $6,000,000
  // and the recapture is fully phased in ($6,008,000 > $5,050,000).
  const r = ny(6_008_000);
  assert.equal(r.taxableIncome, 6_000_000);
  money(r.taxBeforeCredits, 552_929.45, 'bracket walk alone');
  money(supplemental(r), 65_070.55, 'recapture');
  // The point: the two add to the flat top rate on the whole taxable income.
  money(r.tax, 0.103 * 6_000_000, 'top rate on the whole income');
  money(r.tax, 618_000, 'top rate on the whole income');
});

test('walking the brackets alone understates a $300,000 single New Yorker by $2,399', () => {
  const r = ny(300_000);
  money(supplemental(r), 2_399.15, 'recapture');
  money(r.tax - r.taxBeforeCredits, 2_399.15, 'the difference is the whole recapture');
  money(r.tax, 20_002, 'total New York tax');
});

test('the recapture phases in over $50,000 of AGI, and is invisible in the rate schedule', () => {
  money(supplemental(ny(107_650)), 0, 'at the threshold');
  money(supplemental(ny(132_650)), 284.125, 'half way through the first step');
  money(supplemental(ny(157_650)), 568.25, 'fully phased in');
  money(supplemental(ny(200_000)), 568.25, 'flat between steps');

  // A single filer at $130,000 is in the 6% band and faces 7.1365%: the 6% rate
  // plus $568.25 spread over $50,000 of phase-in. No rate schedule shows this.
  const r = ny(130_000);
  assert.equal(r.brackets[r.brackets.length - 1].rate, 0.06);
  money(r.marginalRate, 0.0714, 'marginal rate inside the phase-in');
});

// The recapture claws back the benefit of the filing-status schedules too, which
// is the least advertised consequence of it and the easiest to check.
test('the head-of-household schedule is worth nothing to a New Yorker past the phase-in', () => {
  // Same taxable income, two filing statuses, both past the first phase-in and
  // both inside the 6% band. The graduated-rate benefit of each schedule has been
  // fully recaptured, so both pay 6% on the whole of it.
  for (const taxableIncome of [160_000, 188_800, 200_000]) {
    const at = (filingStatus, deduction) =>
      stateIncomeTax({
        state: 'NY',
        year: 2025,
        filingStatus,
        federal: {
          adjustedGrossIncome: taxableIncome + deduction,
          taxableIncome,
          deduction,
          deductionKind: 'standard',
        },
      }).tax;
    const single = at('single', 8_000);
    const hoh = at('headOfHousehold', 11_200);
    money(single, hoh, `taxable income ${taxableIncome}`);
    money(single, 0.06 * taxableIncome, '6% on the whole taxable income');
  }

  // Below the phase-in the schedules do differ, which is what makes the above a
  // consequence of the recapture rather than of the schedules being identical.
  const belowSingle = stateIncomeTax({
    state: 'NY',
    year: 2025,
    filingStatus: 'single',
    federal: { adjustedGrossIncome: 96_000, taxableIncome: 88_000, deduction: 8_000, deductionKind: 'standard' },
  }).tax;
  const belowHoh = stateIncomeTax({
    state: 'NY',
    year: 2025,
    filingStatus: 'headOfHousehold',
    federal: { adjustedGrossIncome: 99_200, taxableIncome: 88_000, deduction: 11_200, deductionKind: 'standard' },
  }).tax;
  money(belowSingle - belowHoh, 120.37, 'the schedule is worth $120.37 at $88,000 of taxable income');
});

// ---------------------------------------------------------------------------
// 2026
// ---------------------------------------------------------------------------

test('the 2026 rate cut RAISES the recapture, because the top rates did not move', () => {
  const single2025 = recaptureLadder(getStateDefinition('NY', 2025).rate.byStatus.single, 107_650);
  const single2026 = recaptureLadder(getStateDefinition('NY', 2026).rate.byStatus.single, 107_650);
  // Rung 1 recaptures the benefit of brackets that were ALL cut, so it is
  // unchanged: the cut and the recapture move together.
  money(single2026[0].level, single2025[0].level, 'first rung unchanged');
  // Rung 2 recaptures against the 6.85% rate, which was not cut, so there is more
  // benefit below it to claw back.
  money(single2025[1].level, 2_399.15, '2025 second rung');
  money(single2026[1].level, 2_614.55, '2026 second rung');
  assert.ok(single2026[1].level > single2025[1].level);
});

test('the 2026 rate cut is worth exactly nothing to a filer past the phase-in', () => {
  assert.ok(ny(130_000, { year: 2026 }).tax < ny(130_000, { year: 2025 }).tax, 'a cut at $130,000');

  //   A single filer at $300,000 is past the first phase-in, so the whole benefit
  //   of the cut brackets has already been recaptured. The FY2026 "middle-class
  //   tax cut" gives with one hand and the recapture takes it back with the other,
  //   to the cent — because the recapture is DEFINED as the benefit of the lower
  //   brackets, and 6.85% did not change.
  const low = ny(300_000, { year: 2025 });
  const high = ny(300_000, { year: 2026 });
  money(high.taxBeforeCredits - low.taxBeforeCredits, -215.4, 'bracket tax fell by $215.40');
  money(supplemental(high) - supplemental(low), 215.4, 'recapture rose by $215.40');
  money(high.tax - low.tax, 0, 'and the New Yorker pays exactly the same');
});

// The derived 2026 figures disagree with PolicyEngine-US's transcription of the
// FY2026 budget bill by $1 in two places: it holds 567 where the identity gives
// 568.25 and 2,614 where the identity gives 2,614.55. Every 2021-2025 figure
// agrees exactly, and 567 is not derivable from any clean rate: solving for the
// rate that would produce it gives 5.401873%, not 5.4%. The identity is kept and
// the disagreement is recorded here so a future run can resolve it against the
// statute rather than rediscovering it.
test('the 2026 derivation is internally consistent with the rate schedule', () => {
  const def = getStateDefinition('NY', 2026);
  const rungs = recaptureLadder(def.rate.byStatus.single, 107_650);
  money(rungs[0].level, 568.25, 'derived; PolicyEngine-US transcribes 567');
  money(rungs[1].level, 2_614.55, 'derived; PolicyEngine-US transcribes 2,614');
  // The same identity check that holds in 2025 holds in 2026: past the phase-in,
  // the top rate applies to the whole income. A figure of 567 would break it.
  const r = ny(6_008_000, { year: 2026 });
  money(r.tax, 0.103 * 6_000_000, '2026 top rate on the whole income');
});

// ---------------------------------------------------------------------------
// The ordinary return, the household credit, and the earned income credit
// ---------------------------------------------------------------------------

test('a hand-computed New York single return at $100,000 of wages', () => {
  //   New York AGI                                100,000.00
  //   standard deduction                           -8,000.00
  //   New York taxable income                      92,000.00
  //     8,500 x 4%                                     340.00
  //     3,200 x 4.5%                                   144.00
  //     2,200 x 5.25%                                  115.50
  //    66,750 x 5.5%                                 3,671.25
  //    11,350 x 6%                                     681.00
  //   tax                                           4,951.75
  //   no supplemental tax: AGI is under $107,650
  const r = ny(100_000);
  assert.equal(r.taxableIncome, 92_000);
  money(r.taxBeforeCredits, 4_951.75);
  money(supplemental(r), 0);
  money(r.tax, 4_951.75);
  assert.equal(r.provisional, false, 'New York indexes nothing, so 2025 is published');
});

test('the household credit is a staircase, and crossing $28,000 costs a single filer $20', () => {
  money(creditNamed(ny(28_000), 'New York household'), 20);
  money(creditNamed(ny(28_001), 'New York household'), 0);
  money(creditNamed(ny(4_000), 'New York household'), 75);
  // A joint filer with two dependents: base $50 at $24,000 plus $10 for each of
  // the three household members after the first.
  const joint = ny(24_000, { filingStatus: 'marriedFilingJointly', dependents: 2 });
  money(creditNamed(joint, 'New York household'), 80);
});

test('the New York earned income credit is 30% of the federal one LESS the household credit', () => {
  // A head of household at $27,000 with two children and a $6,000 federal credit.
  //   household credit: $40 base + 2 x $5                         50.00
  //   30% x 6,000                                             1,800.00
  //   less the household credit (Tax Law § 606(d)(1))            -50.00
  //   New York earned income credit                           1,750.00
  const r = ny(27_000, { filingStatus: 'headOfHousehold', dependents: 2, earnedIncomeCredit: 6_000 });
  money(creditNamed(r, 'New York household'), 50);
  money(creditNamed(r, 'New York earned income'), 1_750);
  assert.equal(
    r.credits.find((c) => c.name.startsWith('New York earned income')).refundable,
    true,
  );
  //   New York taxable income 27,000 - 11,200 - 2,000 =        13,800.00
  //     12,800 x 4%                                               512.00
  //      1,000 x 4.5%                                              45.00
  //   tax before credits                                          557.00
  //   less household credit                                       -50.00
  //   less refundable earned income credit                     -1,750.00
  money(r.taxBeforeCredits, 557);
  money(r.tax, -1_243, 'a refund, because the credit is refundable');
});

test('omitting the federal earned income credit says so in the result', () => {
  const without = ny(27_000, { filingStatus: 'headOfHousehold', dependents: 2 });
  assert.ok(
    without.notes.some((n) => n.includes('Form 1040 line 27')),
    'the result names the figure that was left out',
  );
  money(creditNamed(without, 'New York earned income'), 0);
});

// ---------------------------------------------------------------------------
// The Empire State child credit
// ---------------------------------------------------------------------------

const nyKids = (agi, ages, opts = {}) =>
  ny(agi, { ...opts, filingStatus: opts.filingStatus ?? 'marriedFilingJointly' , dependentAges: ages });

const escc = (result) => creditNamed(result, 'Empire State child credit');

test('the Empire State child credit is banded on each child’s age', () => {
  money(escc(nyKids(50_000, [2])), 1_000, 'under 4, 2025');
  money(escc(nyKids(50_000, [2], { year: 2026 })), 1_000, 'under 4, 2026');
  money(escc(nyKids(50_000, [10])), 330, '4 to 16, 2025');
  money(escc(nyKids(50_000, [10], { year: 2026 })), 500, '4 to 16, 2026 — the FY2026 increase');
  money(escc(nyKids(50_000, [17])), 0, '17 gets nothing');
  // The band edges: 3 is a young child, 4 is not, 16 is a child and 17 is not.
  money(escc(nyKids(50_000, [3])), 1_000);
  money(escc(nyKids(50_000, [4])), 330);
  money(escc(nyKids(50_000, [16])), 330);
  // Mixed families add up.
  money(escc(nyKids(50_000, [1, 7, 19])), 1_330, 'a toddler, a child and an adult dependent');
});

// $16.50 per $1,000 is exactly a third of the federal § 24 phase-out of $50 per
// $1,000. New York's credit WAS 33% of the federal credit from 2018 to 2024; the
// FY2026 budget replaced the amount with flat figures and left the phase-out at
// a third of the federal rate. The old credit is still in there.
test('the phase-out rate is one third of the federal one, exactly', () => {
  const rule = getStateDefinition('NY', 2025).childCredit;
  assert.equal(rule.phaseOut.amountPerIncrement, 50 * 0.33);
  assert.equal(rule.phaseOut.increment, 1_000);
  assert.equal(rule.refundable, true);
});

// The finding: the reduction is on the WHOLE credit, not on each child's share,
// so a bigger family phases out LATER rather than faster. "Phases out above
// $110,000" is true and tells you almost nothing about where it ends.
test('a bigger family phases out later, not faster', () => {
  const one = (agi) => escc(nyKids(agi, [2]));
  const three = (agi) => escc(nyKids(agi, [1, 2, 3]));

  money(one(110_000), 1_000, 'nothing lost at the threshold itself');
  money(three(110_000), 3_000);

  // One child under 4: the credit survives another $60,000 of income.
  money(one(170_000), 10, 'still $10 at $170,000');
  money(one(170_001), 0, 'gone one dollar later');

  // Three children under 4: another $181,000 of income.
  money(three(291_000), 13.5, 'still $13.50 at $291,000');
  money(three(291_001), 0);

  // The rate is the same $16.50 per $1,000 for both, which is the whole reason.
  money(one(111_000) - one(112_000), 16.5);
  money(three(111_000) - three(112_000), 16.5);
});

// "Or fraction thereof" makes it a staircase, and the engine sees it because it
// measures the marginal rate by running the computation a dollar higher.
test('the phase-out is a staircase: $16.50 on the dollar that crosses each $1,000', () => {
  // A head of household at $75,000, so the credit's phase-out is the only thing
  // moving — a joint filer's $110,000 threshold sits above the supplemental
  // tax's $107,650 phase-in, which would be measured on the same dollar.
  const hoh = (agi) => nyKids(agi, [2], { filingStatus: 'headOfHousehold' }).marginalRate;
  money(hoh(75_000), 16.5 + 0.055, 'the crossing dollar');
  money(hoh(75_001), 0.055, 'every other dollar in the band');
  money(hoh(76_000), 16.5 + 0.055, 'the next crossing, exactly $1,000 later');
  money(hoh(76_500), 0.055, 'and nothing in between');
});

// The joint threshold sits inside the supplemental tax's phase-in, so a joint
// family crossing $110,000 pays the credit staircase and the recapture at once.
test('a joint family at $110,000 crosses the credit staircase and the recapture together', () => {
  const withKid = nyKids(110_000, [2]).marginalRate;
  const withoutKid = ny(110_000, { filingStatus: 'marriedFilingJointly' }).marginalRate;
  money(withKid - withoutKid, 16.5, 'the credit staircase');
  assert.ok(withoutKid > 0.055, 'and the recapture is already phasing in underneath it');
});

test('the phase-out threshold differs by filing status, and separate is lowest', () => {
  const threshold = getStateDefinition('NY', 2025).childCredit.phaseOut.threshold;
  assert.equal(threshold.marriedFilingJointly, 110_000);
  assert.equal(threshold.qualifyingSurvivingSpouse, 110_000);
  assert.equal(threshold.single, 75_000);
  assert.equal(threshold.headOfHousehold, 75_000);
  assert.equal(threshold.marriedFilingSeparately, 55_000);
  // A single parent at $80,000 has already lost $82.50 of a $1,000 credit that a
  // joint return with the same income keeps in full.
  money(escc(nyKids(80_000, [2], { filingStatus: 'headOfHousehold' })), 1_000 - 5 * 16.5);
  money(escc(nyKids(80_000, [2])), 1_000);
});

// It is refundable, so it pays out past zero tax — which is most of the families
// with young children that it is aimed at.
test('the credit is refundable and pays a family with no New York tax', () => {
  const family = nyKids(30_000, [1, 2], { filingStatus: 'headOfHousehold' });
  assert.ok(family.tax < 0, 'New York owes this family money');
  money(escc(family), 2_000);
  const credit = family.credits.find((c) => c.name === 'Empire State child credit');
  assert.equal(credit.refundable, true);
});

// A count cannot tell a toddler from a nineteen-year-old, and the two are worth
// $1,000 and nothing. The result says so rather than returning a quiet zero.
test('dependents without ages computes the credit as zero and says so', () => {
  const result = ny(100_000, { filingStatus: 'marriedFilingJointly', dependents: 2 });
  money(escc(result), 0);
  const note = result.notes.find((n) => n.includes('dependentAges was not supplied'));
  assert.ok(note, 'expected a note naming the missing input');
  assert.ok(note.includes('$1,000'), `expected the amount at stake, got: ${note}`);
});

test('dependents and dependentAges disagreeing is an error, not a guess', () => {
  assert.throws(
    () =>
      stateIncomeTax({
        state: 'NY',
        year: 2025,
        filingStatus: 'marriedFilingJointly',
        dependents: 3,
        dependentAges: [2, 5],
        federal: {
          adjustedGrossIncome: 100_000,
          taxableIncome: 83_950,
          deduction: 16_050,
          deductionKind: 'standard',
        },
      }),
    /dependents \(3\) and dependentAges \(2 ages\) disagree/,
  );
});

// Ages feed the dependent exemption and the household credit too, so supplying
// them instead of a count changes nothing else about the return.
test('supplying ages is equivalent to supplying the count everywhere else', () => {
  const byCount = ny(200_000, { filingStatus: 'marriedFilingJointly', dependents: 2 });
  const byAges = nyKids(200_000, [19, 21]);
  assert.equal(byAges.exemptions, byCount.exemptions);
  assert.equal(byAges.taxableIncome, byCount.taxableIncome);
  assert.equal(byAges.tax, byCount.tax, 'two adult dependents get no child credit');
});
