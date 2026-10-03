// Connecticut. Four staircases, three of them built from the same four words of
// statute, and a set of tables half of which scale between filing statuses while
// the other half do not.
//
// Every expected figure below is computed from the statute or the Tax
// Calculation Schedule by hand and written out, not read back out of the engine.
// Day 27's rule: a test written from the data can only confirm the data.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getStateDefinition, stateIncomeTax } from './strict.mjs';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

/** Connecticut starts from federal AGI, so the federal basis is the AGI. */
const federal = (agi, extra = {}) => ({
  adjustedGrossIncome: agi,
  taxableIncome: Math.max(0, agi - 15_750),
  deduction: 15_750,
  deductionKind: 'standard',
  ...extra,
});

const ct = ({ agi = 60_000, year = 2025, filingStatus = 'single', federal: fed, ...fields } = {}) =>
  stateIncomeTax({
    state: 'CT',
    year,
    filingStatus,
    ...fields,
    federal: fed ?? federal(agi),
  });

const creditNamed = (result, fragment) =>
  result.credits.find((c) => c.name.toLowerCase().includes(fragment))?.amount ?? 0;
const surtaxNamed = (result, fragment) =>
  result.surtaxes.find((s) => s.name.toLowerCase().includes(fragment))?.amount ?? 0;

// ---------------------------------------------------------------------------
// The rate schedule
// ---------------------------------------------------------------------------

test('a whole single return at $60,000, every line of the Tax Calculation Schedule', () => {
  // Line 1  Connecticut AGI                                        60,000.00
  // Line 2  exemption: $15,000 less $1,000 x ceil(30,000/1,000)         0.00
  // Line 3  Connecticut taxable income                             60,000.00
  // Line 4  2% x 10,000 + 4.5% x 40,000 + 5.5% x 10,000             2,550.00
  // Line 5  Table C: ceil(3,500/5,000) = 1 step of $25                 25.00
  // Line 6  Table D: below $105,000                                     0.00
  // Line 7  Connecticut income tax                                  2,575.00
  // Line 8  Table E: over $33,300, not over $60,000                     .10
  // Line 9  personal tax credit                                       257.50
  // Line 10 Connecticut income tax                                  2,317.50
  const r = ct({ agi: 60_000 });
  money(r.exemptions, 0, 'exemption');
  money(r.taxableIncome, 60_000, 'taxable income');
  money(r.taxBeforeCredits, 2_550, 'line 4');
  money(surtaxNamed(r, 'add-back'), 25, 'line 5');
  money(creditNamed(r, 'personal tax credit'), 257.5, 'line 9');
  money(r.tax, 2_317.5, 'line 10');
  // And no locality, because Connecticut has none at all.
  assert.deepEqual(r.localTaxes, []);
  money(r.totalTax, 2_317.5, 'total tax');
});

test('the top of the single schedule, with both add-back and recapture at their maxima', () => {
  // 2% x 10,000 + 4.5% x 40,000 + 5.5% x 50,000 + 6% x 100,000
  //   + 6.5% x 50,000 + 6.9% x 250,000 + 6.99% x 500,000 = 66,200
  // Table C maximum $250; Table D 250 + 2,700 + 450 = 3,400; Table E zero.
  const r = ct({ agi: 1_000_000 });
  money(r.taxBeforeCredits, 66_200, 'graduated tax');
  money(surtaxNamed(r, 'add-back'), 250, 'add-back at its maximum');
  money(surtaxNamed(r, 'recapture'), 3_400, 'recapture at its maximum');
  money(r.tax, 69_850, 'total');
});

test('the schedule and the recapture scale between statuses, and three other tables do not', () => {
  // This is the Connecticut trap, and it is a trap because the wrong answer is a
  // real Connecticut number. Half of a joint figure is the SEPARATE figure in
  // two of the three tables that do not scale, so a model that scales them lands
  // somewhere plausible.
  const def = getStateDefinition('CT', 2026);
  const joint = def.rate.byStatus.marriedFilingJointly;
  for (const [status, scale] of [
    ['single', 0.5],
    ['marriedFilingSeparately', 0.5],
    ['headOfHousehold', 0.8],
  ]) {
    const table = def.rate.byStatus[status];
    assert.equal(table.length, joint.length, `${status}: same number of bands`);
    table.forEach((band, i) => {
      assert.equal(band.rate, joint[i].rate, `${status} band ${i} rate`);
      if (Number.isFinite(band.upTo)) {
        money(band.upTo, joint[i].upTo * scale, `${status} band ${i} ceiling`);
      }
    });
  }
  def.steppedRecapture.tiers.forEach((tier, i) => {
    for (const field of ['start', 'increment', 'amount', 'maximum']) {
      money(tier[field].single, tier[field].marriedFilingJointly * 0.5, `recapture ${field} single`);
      money(tier[field].marriedFilingSeparately, tier[field].marriedFilingJointly * 0.5, `recapture ${field} separate`);
      // ...and the head of household column scales in the first and third
      // tiers and NOT in the second, which is the one place in Connecticut
      // where a table that looks generated is not. See the test below.
      if (!(i === 1 && (field === 'amount' || field === 'maximum'))) {
        money(tier[field].headOfHousehold, tier[field].marriedFilingJointly * 0.8, `recapture ${field} hoh tier ${i}`);
      }
    }
  });
  // And the three that do not, written as the exact disagreement rather than as
  // `notEqual`, so that a table which starts scaling is a diff and not a pass.
  const exemption = def.exemption.perFiler;
  assert.equal(exemption.marriedFilingJointly, 24_000);
  assert.equal(exemption.single, 15_000);
  assert.equal(exemption.marriedFilingJointly * 0.5, 12_000);
  assert.equal(exemption.marriedFilingSeparately, 12_000);
  assert.equal(exemption.headOfHousehold, 19_000);
  assert.notEqual(exemption.headOfHousehold, exemption.marriedFilingJointly * 0.8);

  const addBack = def.phaseOutAddBack.staircase;
  assert.equal(addBack.start.marriedFilingJointly, 100_500);
  assert.equal(addBack.start.single, 56_500);
  assert.equal(addBack.start.marriedFilingJointly * 0.5, 50_250);
  assert.equal(addBack.start.marriedFilingSeparately, 50_250);
  // The add-back's STEP scales and its THRESHOLD does not, which is the harder
  // half to notice: a head of household steps by $4,000 of income for $40,
  // exactly four fifths of the joint $5,000 for $50, and starts at $78,500
  // rather than at the $80,400 that same four fifths would give. And a single
  // filer steps by the JOINT $5,000 rather than by half of it — $2,500 is the
  // separate column again.
  assert.equal(addBack.increment.headOfHousehold, addBack.increment.marriedFilingJointly * 0.8);
  assert.equal(addBack.amount.headOfHousehold, addBack.amount.marriedFilingJointly * 0.8);
  assert.notEqual(addBack.start.headOfHousehold, addBack.start.marriedFilingJointly * 0.8);
  assert.equal(addBack.increment.single, 5_000);
  assert.equal(addBack.increment.marriedFilingSeparately, 2_500);
  assert.notEqual(addBack.increment.single, addBack.increment.marriedFilingJointly * 0.5);

  const credit = def.personalTaxCredit.steps;
  assert.equal(credit.marriedFilingJointly[0].from, 24_000);
  assert.equal(credit.single[0].from, 15_000);
  assert.notEqual(credit.single[0].from, 12_000);
  assert.equal(credit.headOfHousehold[0].from, 19_000);
  assert.notEqual(credit.headOfHousehold[0].from, 19_200);
});

test('and the head of household middle recapture tier is the one that does NOT scale', () => {
  // Found by this file rather than written into it. The scaling test above was
  // written as a loop over all three tiers and all four fields, and it failed on
  // one cell: § 12-700(b) charges a head of household "one hundred forty dollars
  // for each eight thousand dollars, or fraction thereof, by which the
  // taxpayer's Connecticut adjusted gross income exceeds three hundred twenty
  // thousand dollars, up to a maximum payment of four thousand two hundred
  // dollars" — where four fifths of the joint figures would be $144 and $4,320.
  //
  // The first and third tiers DO scale ($40 and $80 against joint's $50 and
  // $100), so this is not a column drafted on a different basis. It is one row,
  // and it is worth $120 to a head of household at the top of the tier.
  const tiers = getStateDefinition('CT', 2026).steppedRecapture.tiers;
  assert.equal(tiers[1].amount.marriedFilingJointly, 180);
  assert.equal(tiers[1].amount.headOfHousehold, 140);
  assert.equal(tiers[1].maximum.marriedFilingJointly, 5_400);
  assert.equal(tiers[1].maximum.headOfHousehold, 4_200);
  assert.equal(180 * 0.8, 144);
  assert.equal(5_400 * 0.8, 4_320);
  // The whole recapture a head of household can ever pay is therefore $5,320 and
  // not the $5,440 that four fifths of the joint $6,800 would be.
  const total = tiers.reduce((sum, t) => sum + t.maximum.headOfHousehold, 0);
  assert.equal(total, 5_320);
  assert.equal(6_800 * 0.8, 5_440);
});

// ---------------------------------------------------------------------------
// "or fraction thereof" — the three staircases that are reached by one dollar
// ---------------------------------------------------------------------------

test('one cent over $30,000 costs a single filer a whole $1,000 of exemption', () => {
  // § 12-702(a)(1): $1,000 "for each one thousand dollars, or fraction thereof".
  // At exactly $30,000 nothing is exceeded and the exemption is whole.
  const at = ct({ agi: 30_000 });
  money(at.exemptions, 15_000, 'exemption at the threshold');
  // 2% x 10,000 + 4.5% x 5,000 = 425, less the 15% Table E credit.
  money(at.taxBeforeCredits, 425, 'tax at the threshold');
  money(at.tax, 361.25, 'tax at the threshold, after the credit');

  const over = ct({ agi: 30_000.01 });
  money(over.exemptions, 14_000, 'exemption one cent later');
  // The extra cent is taxed and so is the $1,000 of exemption it cost:
  // 4.5% x 1,000.01 = 45.00045 of extra tax, of which the filer keeps 85%.
  money(over.tax - at.tax, 45.00045 * 0.85, 'one cent of income');
});

test('the marginal rate inside the withdrawal band is exactly double the statutory rate', () => {
  // The withdrawal is dollar for dollar, so $1,000 of income adds $2,000 of
  // taxable income. 4.5% doubled is 9%, and it is a figure that appears in no
  // Connecticut table.
  const a = ct({ agi: 35_000 });
  const b = ct({ agi: 36_000 });
  money(b.taxableIncome - a.taxableIncome, 2_000, 'taxable income per $1,000 of AGI');
  money(b.taxBeforeCredits - a.taxBeforeCredits, 90, 'tax per $1,000 of AGI, before credits');
  // A joint return does the same thing between $48,000 and $72,000.
  const c = ct({ agi: 60_000, filingStatus: 'marriedFilingJointly' });
  const d = ct({ agi: 61_000, filingStatus: 'marriedFilingJointly' });
  money(d.taxableIncome - c.taxableIncome, 2_000, 'joint taxable income per $1,000');
  money(d.taxBeforeCredits - c.taxBeforeCredits, 90, 'joint tax per $1,000');
});

test('the exemption runs out exactly where the statute says, in all four columns', () => {
  // start + max x increment: $45,000 single, $72,000 joint, $57,000 head of
  // household, $36,000 separate. One cent above each, the exemption is zero.
  for (const [filingStatus, gone] of [
    ['single', 45_000],
    ['marriedFilingJointly', 72_000],
    ['headOfHousehold', 57_000],
    ['marriedFilingSeparately', 36_000],
  ]) {
    money(ct({ agi: gone - 1_000, filingStatus }).exemptions, 1_000, `${filingStatus} one step left`);
    money(ct({ agi: gone, filingStatus }).exemptions, 0, `${filingStatus} exhausted`);
  }
});

test('the add-back is a flat $25 staircase from $56,500 and stops at $250', () => {
  money(surtaxNamed(ct({ agi: 56_500 }), 'add-back'), 0, 'at the threshold');
  money(surtaxNamed(ct({ agi: 56_500.01 }), 'add-back'), 25, 'one cent over');
  money(surtaxNamed(ct({ agi: 61_500 }), 'add-back'), 25, 'one whole increment');
  money(surtaxNamed(ct({ agi: 61_500.01 }), 'add-back'), 50, 'one cent into the second');
  money(surtaxNamed(ct({ agi: 106_500 }), 'add-back'), 250, 'the maximum');
  money(surtaxNamed(ct({ agi: 5_000_000 }), 'add-back'), 250, 'and it never grows again');
});

test('the recapture is three tiers with flat stretches between them', () => {
  const at = (agi, filingStatus = 'single') => surtaxNamed(ct({ agi, filingStatus }), 'recapture');
  money(at(105_000), 0, 'at the first threshold');
  money(at(105_000.01), 25, 'one cent over');
  money(at(150_000), 225, 'nine steps');
  money(at(150_000.01), 250, 'the first tier at its maximum');
  money(at(199_999), 250, 'and flat all the way to the second tier');
  money(at(200_000), 250, 'still flat at the second threshold itself');
  money(at(200_000.01), 340, 'one cent over, which costs $90');
  money(at(345_000.01), 2_950, 'the second tier at its maximum');
  money(at(499_999), 2_950, 'flat again');
  money(at(500_000.01), 3_000, 'the third tier begins');
  money(at(540_000.01), 3_400, 'and tops out');
  // A joint return is exactly double, a head of household four fifths.
  money(at(1_080_000.01, 'marriedFilingJointly'), 6_800, 'joint maximum');
  money(at(864_000.01, 'headOfHousehold'), 5_320, 'head of household maximum');
});

// ---------------------------------------------------------------------------
// Table E, and the two boundary conventions on one return
// ---------------------------------------------------------------------------

test('a Table E boundary belongs to the step BELOW it', () => {
  // § 12-703(a) reads "over $15,000 but not over $18,800 ... .75", so a single
  // filer at exactly $18,800 keeps the 75% row. PolicyEngine-US models this
  // table with the other convention.
  //
  // $18,800 of Connecticut AGI less a whole $15,000 exemption is $3,800 of
  // taxable income, all of it in the 2% band: $76.00 of tax.
  const at = ct({ agi: 18_800 });
  money(at.taxBeforeCredits, 76, 'tax before the credit');
  money(creditNamed(at, 'personal tax credit'), 57, '75% of $76');
  money(at.tax, 19, 'tax at the boundary');
  const over = ct({ agi: 18_800.01 });
  money(creditNamed(over, 'personal tax credit'), 0.7 * 76.0002, '70% one cent later');
  money(over.tax - at.tax, 3.8, 'one cent of income costs five points of the credit');
  // And the last step: 1% through $64,500, nothing above it.
  money(creditNamed(ct({ agi: 64_500 }), 'personal tax credit'), 0.01 * 2_847.5, 'the 1% row');
  money(creditNamed(ct({ agi: 64_500.01 }), 'personal tax credit'), 0, 'and gone');
});

test('the pension schedule uses the OPPOSITE boundary convention, on the same return', () => {
  // The phase-out reaches a filer with federal AGI "at least $75,000 but less
  // than $77,500", so a retiree at exactly $75,000 is already on the 85% row.
  // $40,000 of pension, no Social Security, so Connecticut AGI is AGI less the
  // subtraction and nothing else moves.
  const retiree = (agi) =>
    ct({ agi, retirement: { filer: { employerPlanPension: 40_000 } } });
  money(retiree(74_999).stateAdjustedGrossIncome, 34_999, '100% of the pension comes out');
  money(retiree(75_000).stateAdjustedGrossIncome, 75_000 - 34_000, '85% at the threshold itself');
  money(retiree(77_500).stateAdjustedGrossIncome, 77_500 - 28_000, '70% at the next');
  money(retiree(100_000).stateAdjustedGrossIncome, 100_000, 'nothing at $100,000');
});

test('the add-back and the personal credit overlap for a single filer and for nobody else', () => {
  // The credit is a percentage of the tax AFTER the add-back — line 7 adds lines
  // 4, 5 and 6 — so wherever the two coexist the add-back is itself discounted.
  // They coexist only where the add-back's threshold is below the credit's last
  // row, which is true of single and separate and of no other status.
  const def = getStateDefinition('CT', 2025);
  const lastCreditRow = (status) => {
    const steps = def.personalTaxCredit.steps[status];
    return steps[steps.length - 1].from;
  };
  const addBackStart = (status) => def.phaseOutAddBack.staircase[status];
  assert.ok(lastCreditRow('single') > def.phaseOutAddBack.staircase.start.single);
  assert.ok(
    lastCreditRow('marriedFilingSeparately') >
      def.phaseOutAddBack.staircase.start.marriedFilingSeparately,
  );
  // Joint and head of household MEET rather than overlap: the credit's last row
  // is exactly the income at which the add-back begins.
  assert.equal(lastCreditRow('marriedFilingJointly'), def.phaseOutAddBack.staircase.start.marriedFilingJointly);
  assert.equal(lastCreditRow('headOfHousehold'), def.phaseOutAddBack.staircase.start.headOfHousehold);
  assert.ok(addBackStart('start').single === 56_500);

  // And the observable consequence, at $60,000 single: the $25 add-back is
  // charged, then 10% of it comes back with the rest of the tax.
  const r = ct({ agi: 60_000 });
  money(creditNamed(r, 'personal tax credit'), 0.1 * (2_550 + 25), 'the credit is taken of line 7');
  assert.notEqual(creditNamed(r, 'personal tax credit'), 0.1 * 2_550);
});

// ---------------------------------------------------------------------------
// Retirement: the Social Security cliff, and the figure that moves between years
// ---------------------------------------------------------------------------

test('the Social Security subtraction is a cliff, not a taper', () => {
  // A joint return, $40,000 of gross benefits of which $20,000 is federally
  // taxable, and $80,000 of other income.
  const couple = (agi) =>
    ct({
      agi,
      filingStatus: 'marriedFilingJointly',
      taxableSocialSecurity: 20_000,
      retirement: {
        filer: { socialSecurityBenefits: 20_000 },
        spouse: { socialSecurityBenefits: 20_000 },
      },
    });
  // Below $100,000 the whole taxable benefit comes out.
  const below = couple(99_999);
  money(below.stateAdjustedGrossIncome, 79_999, 'the benefit is untaxed');
  // At $100,000 the subtraction is replaced by: taxable benefit less 25% of the
  // lesser of gross benefits ($40,000) and the § 86 combined income excess
  // ($80,000 + $20,000 - $32,000 = $68,000). The lesser is $40,000, so $10,000
  // is charged and $10,000 is subtracted.
  const atThreshold = couple(100_000);
  money(atThreshold.stateAdjustedGrossIncome, 90_000, 'half the benefit re-enters the base');
  // 2% x 20,000 + 4.5% x 70,000 = 3,550, less the 10% Table E credit.
  money(atThreshold.taxBeforeCredits, 3_550, 'tax above the threshold');
  money(atThreshold.tax, 3_195, 'tax above the threshold, after the credit');
  // 2% x 20,000 + 4.5% x 59,999 = 3,099.955, less 10%.
  money(below.tax, 2_789.9595, 'tax below the threshold');
  assert.ok(atThreshold.tax - below.tax > 400, 'one dollar of income costs more than $400');
});

test('the combined income excess binds when Social Security is most of the income', () => {
  // $60,000 of gross benefits, $51,000 of it federally taxable, $49,000 of other
  // income. Provisional income is 49,000 + 30,000 = 79,000, the § 86 base for a
  // joint return is $32,000, so the excess is $47,000 — LESS than the $60,000 of
  // gross benefits, which is the branch no household with a small benefit can
  // reach. 25% of $47,000 is $11,750, so $39,250 of the benefit is subtracted.
  const r = ct({
    agi: 100_000,
    filingStatus: 'marriedFilingJointly',
    taxableSocialSecurity: 51_000,
    retirement: {
      filer: { socialSecurityBenefits: 30_000 },
      spouse: { socialSecurityBenefits: 30_000 },
    },
  });
  money(r.stateAdjustedGrossIncome, 100_000 - 39_250, 'Connecticut AGI');
});

test('the IRA phase-in is the one Connecticut figure that moves between 2025 and 2026', () => {
  // 75% of a non-Roth IRA distribution in 2025 and 100% from 2026, and the
  // income staircase multiplies whatever is left. Below the threshold the
  // staircase is 100%, so the two years differ by a quarter of the distribution.
  const retiree = (year) =>
    ct({
      agi: 60_000,
      year,
      retirement: { filer: { employerPlanPension: 20_000, iraDistributions: 20_000 } },
    });
  money(retiree(2025).stateAdjustedGrossIncome, 60_000 - (20_000 + 15_000), '2025: 75% of the IRA');
  money(retiree(2026).stateAdjustedGrossIncome, 60_000 - (20_000 + 20_000), '2026: all of it');
  assert.equal(getStateDefinition('CT', 2025).retirementSubtractionSchedule.iraPhaseInShare, 0.75);
  assert.equal(getStateDefinition('CT', 2026).retirementSubtractionSchedule.iraPhaseInShare, 1);
  // And the staircase applies to the phased-in amount, not instead of it: at
  // $80,000 of federal AGI the fraction is 55%.
  const r = ct({
    agi: 80_000,
    year: 2025,
    retirement: { filer: { employerPlanPension: 20_000, iraDistributions: 20_000 } },
  });
  money(r.stateAdjustedGrossIncome, 80_000 - 0.55 * 35_000, 'both percentages apply');
});

test('everything else in Connecticut is identical in 2025 and 2026', () => {
  // Connecticut indexes nothing, so this is a claim about the statute rather
  // than a carry-forward — and it is checked rather than asserted in prose.
  const strip = (def) =>
    JSON.stringify(def, (key, value) =>
      key === 'year' || key === 'retirementSubtractionSchedule' ? undefined : value,
    );
  assert.equal(strip(getStateDefinition('CT', 2025)), strip(getStateDefinition('CT', 2026)));
});

// ---------------------------------------------------------------------------
// The credit that reaches the people with no tax
// ---------------------------------------------------------------------------

test('the Connecticut earned income credit is 40% of the federal one and refundable', () => {
  const r = ct({
    agi: 24_000,
    filingStatus: 'headOfHousehold',
    dependents: 2,
    federal: federal(24_000, { earnedIncomeCredit: 6_000 }),
  });
  money(creditNamed(r, 'earned income'), 2_400, '40% of $6,000');
  // $24,000 of AGI against a $19,000 head-of-household exemption leaves $5,000
  // of taxable income and $100 of tax, which the credit more than covers — so
  // the refundable half shows up as a negative tax.
  assert.ok(r.tax < 0, 'the credit is refundable and the return is a refund');
});

test('the $250 earned income credit child bonus, which the differential grid found', () => {
  // Not in the first draft of this file, and not in the statute I read: new for
  // tax year 2025, announced on the DRS developments page and printed on
  // CT-1040 line 20a. Ten Connecticut households with children came back
  // exactly $250 apart from PolicyEngine-US on the first run of the
  // differential harness against this state, which is what that harness is for.
  //
  // It is FLAT and once per return. One child and three children are worth the
  // same, and it does not taper with § 32 — so it is a cliff at the income
  // where the Connecticut credit reaches zero rather than a tapering credit.
  const parent = (children, eitc) =>
    ct({
      agi: 45_000,
      filingStatus: 'headOfHousehold',
      dependentAges: children,
      federal: federal(45_000, { earnedIncomeCredit: eitc }),
    });
  const one = parent([8], 2_000);
  const three = parent([4, 8, 12], 2_000);
  money(creditNamed(one, 'child bonus'), 250, 'one child');
  money(creditNamed(three, 'child bonus'), 250, 'three children are worth the same');
  money(creditNamed(one, 'earned income tax credit'), 800, '40% of $2,000');
  // No qualifying child, no bonus — and the age test is the federal one's age
  // limb, so a nineteen-year-old dependent does not switch it on.
  money(creditNamed(parent([19], 2_000), 'child bonus'), 0, 'a dependent of 19 is not a qualifying child');
  money(creditNamed(ct({ agi: 45_000, federal: federal(45_000, { earnedIncomeCredit: 2_000 }) }), 'child bonus'), 0, 'no children');
  // And it is gated on the Connecticut credit being paid, not merely on having
  // a child: a household with no federal credit gets neither.
  money(creditNamed(parent([8], 0), 'child bonus'), 0, 'no federal credit, no bonus');
});

test('Connecticut has no local income tax at all', () => {
  const r = ct({ agi: 120_000 });
  assert.deepEqual(r.localTaxes, []);
  money(r.totalTax, r.tax, 'the state return is the whole of it');
  assert.ok(
    r.notes.some((n) => n.includes('no local income tax')),
    'and the result says so',
  );
});
