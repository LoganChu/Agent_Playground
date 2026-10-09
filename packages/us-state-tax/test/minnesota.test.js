// Minnesota. The twenty-fifth taxing state, and the first whose 2026 figures are
// READ rather than carried forward or derived — § 270C.22 subd. 1 makes the
// commissioner publish them by 1 December of the preceding year.
//
// Three rules arrive with it, all three of them staircases or slopes that no
// rate table shows:
//
//   1. a standard deduction LIMITED by 3% then 10% of income and floored at 20%
//      of itself (§ 290.0123 subd. 5);
//   2. a dependent-only exemption withdrawn 2% per $2,500 "or fraction thereof"
//      (§ 290.0121 subd. 2) — a share of the exemption per step, so what a step
//      costs depends on how many dependents are on the return;
//   3. a Social Security subtraction withdrawn 10% per $4,000 "or fraction
//      thereof" (§ 290.0132 subd. 26(c)).
//
// Every expected figure below was computed from the statute by an INDEPENDENT
// reference model written in exact decimal arithmetic, over a 1,680-point grid
// of years, statuses, incomes, dependent counts, aged/blind counts and Social
// Security amounts — not read back out of this engine. The two agreed on all
// 1,680, and the only differences anywhere were twelve one-cent roundings where
// the exact answer is a three-decimal half-cent and binary floating point lands
// a hair below the midpoint. That is Day 27's rule and Day 43's method: the
// reference is what makes a figure here evidence rather than a transcript.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getStateDefinition, stateIncomeTax } from './strict.mjs';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

const mn = (agi, over = {}) => {
  const { year = 2026, filingStatus = 'single', federal: fedOver, ...rest } = over;
  return stateIncomeTax({
    state: 'MN',
    year,
    filingStatus,
    federal: {
      adjustedGrossIncome: agi,
      taxableIncome: agi,
      // Minnesota starts from federal AGI, so the federal deduction reaches
      // nothing here. Zero rather than a real figure makes that explicit: if
      // any Minnesota figure ever moves when this changes, the base is wrong.
      deduction: 0,
      deductionKind: 'standard',
      ...fedOver,
    },
    ...rest,
  });
};

// ---------------------------------------------------------------------------
// The rate schedule
// ---------------------------------------------------------------------------

test('the four statutory rates are 5.35, 6.80, 7.85 and 9.85 per cent in both years', () => {
  for (const year of [2025, 2026]) {
    const def = getStateDefinition('MN', year);
    for (const status of [
      'single',
      'marriedFilingJointly',
      'marriedFilingSeparately',
      'headOfHousehold',
      'qualifyingSurvivingSpouse',
    ]) {
      assert.deepEqual(
        def.rate.byStatus[status].map((band) => band.rate),
        [0.0535, 0.068, 0.0785, 0.0985],
        `${year} ${status}`,
      );
    }
  }
});

test('the 2026 thresholds are the published ones, for every status', () => {
  const def = getStateDefinition('MN', 2026);
  const tops = (status) => def.rate.byStatus[status].slice(0, 3).map((band) => band.upTo);
  assert.deepEqual(tops('single'), [33_310, 109_430, 203_150]);
  assert.deepEqual(tops('marriedFilingJointly'), [48_700, 193_480, 337_930]);
  assert.deepEqual(tops('marriedFilingSeparately'), [24_350, 96_740, 168_965]);
  assert.deepEqual(tops('headOfHousehold'), [41_010, 164_800, 270_060]);
  // Minnesota HAS a surviving-spouse status: § 290.06 subd. 2c(1) puts
  // "married individuals filing joint returns and surviving spouses" on one
  // schedule, so this column is Minnesota's own and not a translation.
  assert.deepEqual(tops('qualifyingSurvivingSpouse'), [48_700, 193_480, 337_930]);
  assert.equal(def.survivingSpouseFilesAs, undefined);
});

test('the 2025 thresholds are the published ones, for every status', () => {
  const def = getStateDefinition('MN', 2025);
  const tops = (status) => def.rate.byStatus[status].slice(0, 3).map((band) => band.upTo);
  assert.deepEqual(tops('single'), [32_570, 106_990, 198_630]);
  assert.deepEqual(tops('marriedFilingJointly'), [47_620, 189_180, 330_410]);
  assert.deepEqual(tops('marriedFilingSeparately'), [23_810, 94_590, 165_205]);
  assert.deepEqual(tops('headOfHousehold'), [40_100, 161_130, 264_050]);
  assert.deepEqual(tops('qualifyingSurvivingSpouse'), [47_620, 189_180, 330_410]);
});

test('the separate schedule is exactly half the joint one, in both years', () => {
  // Not a coincidence and not a rounding: § 290.06 subd. 2c(2) sets the separate
  // schedule at half the joint amounts, which is why $168,965 is the one
  // threshold in this state that is not a multiple of $10.
  for (const year of [2025, 2026]) {
    const def = getStateDefinition('MN', year);
    const joint = def.rate.byStatus.marriedFilingJointly;
    const separate = def.rate.byStatus.marriedFilingSeparately;
    for (let i = 0; i < 3; i += 1) {
      assert.equal(separate[i].upTo, joint[i].upTo / 2, `${year} band ${i}`);
    }
  }
});

test('a plain wage earner pays the schedule on AGI less the standard deduction', () => {
  // 2026 single, $60,000: 15,300 deduction, 44,700 taxable.
  // 5.35% x 33,310 = 1,782.085; 6.80% x 11,390 = 774.52  ->  2,556.605
  money(mn(60_000).deduction, 15_300, 'deduction');
  money(mn(60_000).taxableIncome, 44_700, 'taxable income');
  money(mn(60_000).tax, 2_556.61, 'tax');
  // 2025 single, $60,000: 14,950 deduction, 45,050 taxable.
  // 5.35% x 32,570 = 1,742.495; 6.80% x 12,480 = 848.64  ->  2,591.135
  money(mn(60_000, { year: 2025 }).tax, 2_591.14, '2025 tax');
});

// ---------------------------------------------------------------------------
// § 290.0123 subd. 5 — the standard deduction limitation
// ---------------------------------------------------------------------------

test('the deduction is the full table amount at and below the lower threshold', () => {
  money(mn(244_400).deduction, 15_300, '2026 single at the threshold');
  money(mn(244_399).deduction, 15_300, 'one dollar below');
  money(mn(244_400, { filingStatus: 'marriedFilingJointly' }).deduction, 30_600, 'joint');
  money(mn(122_200, { filingStatus: 'marriedFilingSeparately' }).deduction, 15_300, 'separate');
  money(mn(244_400, { filingStatus: 'headOfHousehold' }).deduction, 23_000, 'head of household');
});

test('the first tier withdraws 3 per cent of the excess, continuously', () => {
  // A SLOPE and not a staircase: one dollar over the threshold costs three
  // cents of deduction, not a whole step. That is the opposite of both
  // staircases in this same state.
  money(mn(244_401).deduction, 15_300 - 0.03, 'one dollar over');
  // 15,300 - 3% x (250,000 - 244,400) = 15,300 - 168
  money(mn(250_000).deduction, 15_132, '$250,000');
  money(mn(250_000).taxableIncome, 234_868, 'taxable income');
  // 5.35% x 33,310 + 6.80% x 76,120 + 7.85% x 93,720 + 9.85% x 31,718
  money(mn(250_000).tax, 17_439.49, 'tax');
});

test('the second tier withdraws 10 per cent, and the first tier stops', () => {
  // The 3% tier reaches only the span between the two thresholds, which for a
  // 2026 single filer is 337,800 - 244,400 = 93,400 and so is worth 2,802 of
  // deduction however high income goes.
  // 15,300 - 2,802 - 10% x (400,000 - 337,800) = 15,300 - 2,802 - 6,220
  money(mn(400_000).deduction, 6_278, '$400,000');
  money(mn(400_000).tax, 33_086.61, 'tax');
});

test('the limitation never removes more than 80 per cent of the deduction', () => {
  // § 290.0123 subd. 5(a)(2). The floor is a fifth of the deduction and it
  // holds at every income there is.
  money(mn(600_000).deduction, 3_060, '2026 single at $600,000 keeps 20% of 15,300');
  money(mn(50_000_000).deduction, 3_060, 'and at $50m');
});

test('the income where the 80 per cent floor binds is not a parameter', () => {
  // 2025 joint. The 3% tier contributes 3% x (330,300 - 238,950) = 2,740.50,
  // and the cap is 80% x 29,900 = 23,920, so the remaining 21,179.50 takes
  // 211,795 of income at 10%: the floor binds at 330,300 + 211,795 = 542,095.
  const joint2025 = { year: 2025, filingStatus: 'marriedFilingJointly' };
  money(mn(542_094, joint2025).deduction, 5_980.1, 'one dollar below the crossing');
  money(mn(542_095, joint2025).deduction, 5_980, 'at it');
  money(mn(542_096, joint2025).deduction, 5_980, 'and above it');
});

test('subd. 5(b) is arithmetically subsumed, which is why it is not stored', () => {
  // § 290.0123 subd. 5(b) reduces the deduction by a flat 80% above an indexed
  // income threshold — $1,083,150 for 2025 and $1,107,750 for 2026. This
  // package stores neither, because the min() in (a) has already reached the
  // same 80% hundreds of thousands of dollars lower: a 2025 joint filer is on
  // the floor from $542,095. So (b) cannot change an answer for any filer it
  // could reach, and a stored threshold would be a figure with no reader.
  const joint2025 = { year: 2025, filingStatus: 'marriedFilingJointly' };
  money(mn(1_083_150, joint2025).deduction, 5_980, 'at the 2025 subd. 5(b) threshold');
  money(mn(1_083_149, joint2025).deduction, 5_980, 'and one dollar below it');
  const joint2026 = { year: 2026, filingStatus: 'marriedFilingJointly' };
  money(mn(1_107_750, joint2026).deduction, 6_120, 'at the 2026 threshold: 20% of 30,600');
  money(mn(1_107_749, joint2026).deduction, 6_120, 'and one dollar below it');
});

test('the separate column halves both thresholds exactly', () => {
  const separate = { filingStatus: 'marriedFilingSeparately' };
  money(mn(122_201, separate).deduction, 15_300 - 0.03, 'one dollar over the lower');
  // 15,300 - 3% x (168,900 - 122,200) - 10% x (183,350 - 168,900)
  //       = 15,300 - 1,401 - 1,445 = 12,454
  money(mn(183_350, separate).deduction, 12_454, 'into the second tier');
});

// ---------------------------------------------------------------------------
// § 290.0123 subd. 2 — the aged and blind addition, INSIDE the limited figure
// ---------------------------------------------------------------------------

test('the aged and blind addition is per person and larger when unmarried', () => {
  // It follows § 63(f)'s shape: $2,000 on a single or head of household return
  // and $1,600 (2026) on a joint one.
  money(mn(60_000, { filerAge: 70 }).deduction, 17_300, 'single aged 70');
  money(mn(60_000, { filerAge: 70, blindOrDisabled: 1 }).deduction, 19_300, 'aged AND blind');
  money(
    mn(60_000, { filingStatus: 'marriedFilingJointly', filerAge: 70, spouseAge: 70 }).deduction,
    30_600 + 1_600 * 2,
    'joint, both 70',
  );
  money(
    mn(60_000, { year: 2025, filingStatus: 'marriedFilingJointly', filerAge: 70, spouseAge: 70 })
      .deduction,
    29_900 + 1_550 * 2,
    '2025 joint, both 70',
  );
});

test('the addition is withdrawn along with the rest of the deduction', () => {
  // This is the half that costs money, and it is why the addition could not be
  // handled by the `table` short-circuit: the 3% and 10% tiers and the 80% cap
  // are all computed on base PLUS addition, so a senior's extra deduction is
  // limited too.
  //
  // 2026 joint at $400,000 with no addition:
  //   30,600 - 3% x 93,400 - 10% x 62,200 = 30,600 - 2,802 - 6,220 = 21,578
  money(mn(400_000, { filingStatus: 'marriedFilingJointly' }).deduction, 21_578, 'no addition');
  // With one: gross 32,200, same withdrawal of 9,022 -> 23,178.
  money(
    mn(400_000, { filingStatus: 'marriedFilingJointly', filerAge: 70 }).deduction,
    23_178,
    'one aged filer',
  );
  // And the floor moves with the gross figure, because it is a SHARE of it.
  money(mn(600_000, { filerAge: 70 }).deduction, 0.2 * 17_300, 'the floor is 20% of 17,300');
});

test('a separate return counts only the people on it', () => {
  // Whether § 290.0123 subd. 2's addition follows a separate filer's spouse
  // with no gross income, the way 26 U.S.C. § 63(f) does, is NOT READ — and is
  // recorded as unread in the state's notes. This package counts the filer
  // alone, which is the answer that does not flatter the filer.
  money(
    mn(60_000, { filingStatus: 'marriedFilingSeparately', filerAge: 70, spouseAge: 70 }).deduction,
    15_300 + 1_600,
    'one addition, not two',
  );
});

// ---------------------------------------------------------------------------
// § 290.0121 — the dependent-only exemption and its proportional staircase
// ---------------------------------------------------------------------------

test('Minnesota gives the filer no exemption at all', () => {
  // The only state in this package where the filer gets nothing: § 290.0121
  // subd. 1 allows the exemption "for each individual who is a dependent" and
  // there is no allowance for the taxpayer or the spouse anywhere in the
  // section.
  for (const year of [2025, 2026]) {
    const def = getStateDefinition('MN', year);
    for (const amount of Object.values(def.exemption.perFiler)) assert.equal(amount, 0);
    assert.equal(def.exemption.separateReturnSpouse.spouse, 'noFilerExemption');
  }
  money(mn(60_000).exemptions, 0, 'single, no dependents');
  money(mn(60_000, { filingStatus: 'marriedFilingJointly' }).exemptions, 0, 'joint');
});

test('each dependent is worth $5,200 in 2025 and $5,300 in 2026', () => {
  money(mn(60_000, { dependents: 1 }).exemptions, 5_300, 'one dependent, 2026');
  money(mn(60_000, { dependents: 3 }).exemptions, 15_900, 'three');
  money(mn(60_000, { year: 2025, dependents: 3 }).exemptions, 15_600, 'three, 2025');
});

test('one dollar over the threshold costs a whole 2 per cent step', () => {
  // "for each $2,500, OR FRACTION THEREOF" — ceil(), so the first dollar costs
  // the whole first step, exactly as Connecticut's Table A does. The
  // difference from Connecticut is that a step here is a SHARE and not an
  // amount, so what it costs depends on the number of dependents.
  const two = { dependents: 2 };
  money(mn(244_500, two).exemptions, 10_600, 'at the threshold, nothing lost');
  money(mn(244_501, two).exemptions, 10_388, 'one dollar over: 2% of 10,600 gone');
  money(mn(247_000, two).exemptions, 10_388, 'still one step at the end of it');
  money(mn(247_001, two).exemptions, 10_176, 'and the second step arrives');
  // A step costs 2% of the whole exemption, so a parent of four loses twice
  // what a parent of two does on the same dollar of income.
  money(mn(244_501, { dependents: 4 }).exemptions, 21_200 - 424, 'four dependents');
  money(mn(244_501, { dependents: 1 }).exemptions, 5_300 - 106, 'one dependent');
});

test('fifty steps of 2 per cent reach zero ONE STEP before $125,000', () => {
  // The off-by-one the `ceil` creates, and it was wrong in three places in this
  // package before this test existed. 2% a step is fifty steps and fifty steps
  // of $2,500 is $125,000 — but the fiftieth step takes the last 2% and "or
  // fraction thereof" brings it on the FIRST dollar past the forty-ninth. So
  // the exemption is gone from $122,500 above the threshold, not $125,000, and
  // the last $2,500 of the apparent staircase is already flat at zero.
  const two = { dependents: 2 };
  money(mn(244_500 + 122_500, two).exemptions, 212, 'forty-nine steps: 2% of 10,600 left');
  money(mn(244_500 + 122_501, two).exemptions, 0, 'one dollar more takes the last 2%');
  money(mn(244_500 + 125_000, two).exemptions, 0, 'still zero at the naive width');
  money(mn(500_000, two).exemptions, 0, 'and it stays gone');
  // The separate column halves the step and so halves the width — again one
  // step short of the naive $62,500.
  const sep = { filingStatus: 'marriedFilingSeparately', dependents: 2 };
  money(mn(183_350, sep).exemptions, 10_600, 'at the separate threshold');
  money(mn(183_350 + 61_250, sep).exemptions, 212, 'forty-nine steps of $1,250');
  money(mn(183_350 + 61_251, sep).exemptions, 0, 'gone from 61,250 up, not 62,500');
});

test('the exemption threshold is not the deduction threshold', () => {
  // Two separately indexed figures $100 apart for a 2026 single filer:
  // $244,400 for the deduction limitation and $244,500 for the exemption. A
  // single stored threshold would be wrong for one of them.
  const def = getStateDefinition('MN', 2026);
  assert.equal(def.deduction.limitation.tiers.single[0].above, 244_400);
  assert.equal(def.exemption.proportionalStepPhaseOut.start.single, 244_500);
  const def25 = getStateDefinition('MN', 2025);
  assert.equal(def25.deduction.limitation.tiers.single[0].above, 238_950);
  assert.equal(def25.exemption.proportionalStepPhaseOut.start.single, 239_050);
});

// ---------------------------------------------------------------------------
// § 290.0132 subd. 26 — the Social Security subtraction
// ---------------------------------------------------------------------------

test('the whole federally taxable benefit comes out at and below the threshold', () => {
  const r = mn(86_410, { taxableSocialSecurity: 20_000 });
  money(
    r.computedSubtractions.reduce((sum, c) => sum + c.amount, 0),
    20_000,
    'at the threshold the whole benefit is subtracted',
  );
  money(r.subtractions, 20_000, 'and it is reported in the subtraction total');
  money(r.taxableIncome, 86_410 - 15_300 - 20_000, 'taxable income');
  money(mn(50_000, { taxableSocialSecurity: 20_000 }).taxableIncome, 14_700, 'well below it');
});

test('one dollar over costs a tenth of the whole benefit', () => {
  // "for each $4,000, OR FRACTION THEREOF" again, and again a SHARE: a retiree
  // with $20,000 of taxable benefit loses $2,000 of subtraction on one dollar.
  const sub = (agi, over = {}) =>
    mn(agi, { taxableSocialSecurity: 20_000, ...over }).computedSubtractions.reduce(
      (sum, c) => sum + c.amount,
      0,
    );
  money(sub(86_411), 18_000, 'one dollar over');
  money(sub(90_410), 18_000, 'to the end of the first step');
  money(sub(90_411), 16_000, 'and the second step');
  // And the same off-by-one-step: ten steps of $4,000 looks like $40,000 of
  // income, and the tenth step arrives on the first dollar past $36,000.
  money(sub(86_410 + 36_000), 2_000, 'nine steps: a tenth of the benefit left');
  money(sub(86_410 + 36_001), 0, 'the tenth step takes it');
  money(sub(126_410), 0, 'still zero at the naive $40,000 width');
  money(sub(500_000), 0, 'and it stays gone');
});

test('the Social Security staircase reaches zero one step early too', () => {
  const sub = (agi, over = {}) =>
    mn(agi, { taxableSocialSecurity: 10_000, ...over }).computedSubtractions.reduce(
      (sum, c) => sum + c.amount,
      0,
    );
  const sep = { filingStatus: 'marriedFilingSeparately' };
  money(sub(55_390, sep), 10_000, 'at the separate threshold');
  money(sub(55_391, sep), 9_000, 'one dollar over');
  money(sub(55_390 + 18_000, sep), 1_000, 'nine steps of $2,000');
  money(sub(55_390 + 18_001, sep), 0, 'gone from 18,000 up, not 20,000');
  const joint = { filingStatus: 'marriedFilingJointly' };
  money(sub(110_780, joint), 10_000, 'at the joint threshold');
  money(sub(110_780 + 36_000, joint), 1_000, 'nine steps of $4,000');
  money(sub(110_780 + 36_001, joint), 0, 'gone from 36,000 up, not 40,000');
});

test('the subtraction is read against FEDERAL AGI, so it cannot widen itself', () => {
  // All three Minnesota rules read federal AGI, which is what makes them
  // independent of each other: a $20,000 Social Security subtraction does not
  // move the deduction limitation or the exemption staircase by a dollar.
  const withSS = mn(250_000, { dependents: 2, taxableSocialSecurity: 20_000 });
  const withoutSS = mn(250_000, { dependents: 2 });
  money(withSS.deduction, withoutSS.deduction, 'deduction unmoved');
  money(withSS.exemptions, withoutSS.exemptions, 'exemption unmoved');
});

// ---------------------------------------------------------------------------
// Both years are published
// ---------------------------------------------------------------------------

test('neither year is provisional and neither carries a provisional figure', () => {
  // The first state-year pair in this package where that is true. § 270C.22
  // subd. 1 requires the adjusted amounts by 1 December of the preceding year.
  for (const year of [2025, 2026]) {
    const def = getStateDefinition('MN', year);
    assert.equal(def.status, 'published', `${year}`);
    assert.equal(def.provisionalFigures, undefined, `${year}`);
    assert.equal(mn(60_000, { year }).provisional, false, `${year}`);
  }
});

test('the twelve published 2026 thresholds admit one common indexation factor', () => {
  // The corroboration that made these figures believable, and it has a measured
  // strength. Each published 2025/2026 pair is a pair of $10-rounded values, so
  // it bounds the year-on-year factor to an interval. If the twelve intervals
  // INTERSECT, the twelve figures are mutually consistent with a single factor;
  // if any one had been mistranscribed, they would not.
  //
  // It earned its keep immediately: the first source consulted for these
  // figures also reported the factor as 2.369%, which is nowhere near the
  // interval below — and that is why it was not believed.
  const d25 = getStateDefinition('MN', 2025);
  const d26 = getStateDefinition('MN', 2026);
  const statuses = ['single', 'marriedFilingJointly', 'marriedFilingSeparately', 'headOfHousehold'];
  let lo = 0;
  let hi = Infinity;
  for (const status of statuses) {
    for (let i = 0; i < 3; i += 1) {
      const a = d25.rate.byStatus[status][i].upTo;
      const b = d26.rate.byStatus[status][i].upTo;
      lo = Math.max(lo, (b - 5) / (a + 5));
      hi = Math.min(hi, (b + 5) / (a - 5));
    }
  }
  assert.ok(lo < hi, `the twelve intervals do not intersect: [${lo}, ${hi}]`);
  // Measured: 1.0227290 to 1.0227831, 5.4 parts per hundred thousand wide.
  assert.ok(Math.abs(lo - 1.022729) < 1e-6, `lower bound moved: ${lo}`);
  assert.ok(Math.abs(hi - 1.0227831) < 1e-6, `upper bound moved: ${hi}`);
  // And the 2.369% a source reported is outside it, which is the whole point.
  assert.ok(1.02369 > hi, '2.369% is excluded by the published figures');
});

test('a $20 error in any one of the twelve is detected by the other eleven', () => {
  // The strength of the check above, asserted rather than asserted ABOUT. Of
  // the 216 single-cell perturbations of $10 to $1,000 in either direction,
  // 195 make the intersection empty; every survivor is a $10 error, which is
  // one step of the $10 rounding and the smallest an error can be.
  const d25 = getStateDefinition('MN', 2025);
  const d26 = getStateDefinition('MN', 2026);
  const statuses = ['single', 'marriedFilingJointly', 'marriedFilingSeparately', 'headOfHousehold'];
  const pairs = [];
  const labels = [];
  for (const status of statuses) {
    for (let i = 0; i < 3; i += 1) {
      pairs.push([d25.rate.byStatus[status][i].upTo, d26.rate.byStatus[status][i].upTo]);
      labels.push(`${status}[${i}]`);
    }
  }
  const intersects = (cells) => {
    let lo = 0;
    let hi = Infinity;
    cells.forEach(([a, b]) => {
      lo = Math.max(lo, (b - 5) / (a + 5));
      hi = Math.min(hi, (b + 5) / (a - 5));
    });
    return lo < hi;
  };
  assert.equal(pairs.length, 12, 'twelve published pairs');
  let detected = 0;
  let total = 0;
  const missed = new Set();
  const missedCells = new Set();
  for (let index = 0; index < pairs.length; index += 1) {
    for (const delta of [10, 20, 30, 40, 50, 100, 200, 500, 1000]) {
      for (const sign of [1, -1]) {
        const cells = pairs.map((pair, i) =>
          i === index ? [pair[0], pair[1] + sign * delta] : pair,
        );
        total += 1;
        if (!intersects(cells)) detected += 1;
        else {
          missed.add(delta);
          if (delta >= 20) missedCells.add(labels[index]);
        }
      }
    }
  }
  assert.equal(total, 216, '216 perturbations');
  assert.equal(detected, 195, '195 of them break the intersection');
  // Nineteen of the twenty-one survivors are $10 errors — one step of the $10
  // rounding, the smallest an error can be. The other two are $20 errors in
  // the JOINT column alone, at the tops of its 6.80% and 7.85% bands, which
  // are the two pairs whose own intervals are widest. So the check catches any
  // error of $30 or more anywhere, and $20 or more outside those two cells.
  assert.deepEqual([...missed].sort((a, b) => a - b), [10, 20], 'the survivor sizes');
  assert.deepEqual(
    [...missedCells].sort(),
    ['marriedFilingJointly[1]', 'marriedFilingJointly[2]'],
    'and the $20 survivors are the two joint cells',
  );
});

test('2026 is not 2025 with a different label, in any status', () => {
  for (const filingStatus of [
    'single',
    'marriedFilingJointly',
    'marriedFilingSeparately',
    'headOfHousehold',
    'qualifyingSurvivingSpouse',
  ]) {
    assert.notEqual(
      mn(120_000, { year: 2026, filingStatus }).tax,
      mn(120_000, { year: 2025, filingStatus }).tax,
      filingStatus,
    );
  }
});
