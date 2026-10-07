// How a 2026 figure nobody has published is KNOWN, and the arithmetic that
// says which ones are not.
//
// Wisconsin publishes its 2026 rate schedules a year early — the Department of
// Revenue's 2026 Form 1-ES instructions carry all four — and does not publish
// the 2026 Standard Deduction Table until the Form 1 instructions appear in
// January 2027. Day 42 met the same situation in Oregon and resolved one figure
// by noticing that it was the only candidate arithmetically consistent with an
// agency-confirmed one. This is that argument made into an instrument.
//
// The method, and it is the whole file:
//
//  1. The top bracket threshold is indexed off a statutory base of $225,000
//     (single), $300,000 (joint) and $150,000 (separate), set by 2013 Act 20.
//     A published threshold therefore BOUNDS the cumulative indexation factor:
//     the figure is rounded to the nearest $10, so the true product lies within
//     $5 of it. Three statuses give three bounds on one factor, and the
//     intersection for 2026 is 7.5 parts per million wide.
//  2. Each standard deduction figure has a base of its own, unknown and not
//     needed: five published years bound it the same way, through the factors
//     from step 1.
//  3. The 2026 figure is then `round10(base x factor)` over both intervals. For
//     four of the seven figures the interval maps onto a single multiple of $10
//     and the figure is determined. For three it straddles a rounding boundary
//     and admits two adjacent values $10 apart.
//
// And the method is VALIDATED rather than assumed: deriving the bases from
// 2021-2024 alone and predicting 2025 puts the published 2025 figure inside the
// admissible set for all seven. A cruder version of the same idea — chaining
// the year-over-year ratio of two rounded figures — gets the 2025 separate
// deduction wrong by $10, because rounding compounds when you chain it and does
// not when you go back to the base. That failure is asserted below too, because
// it is the reason this file does interval arithmetic instead of multiplication.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getStateDefinition } from './strict.mjs';

/** Half of the $10 rounding interval every indexed Wisconsin figure is rounded to. */
const HALF = 5;

/** The published top bracket thresholds. Every one is an agency figure. */
const TOP = {
  2021: { single: 266_930, joint: 355_910, separate: 177_960 },
  2022: { single: 280_950, joint: 374_600, separate: 187_300 },
  2023: { single: 304_170, joint: 405_550, separate: 202_780 },
  2024: { single: 315_310, joint: 420_420, separate: 210_210 },
  2025: { single: 323_290, joint: 431_060, separate: 215_530 },
  2026: { single: 332_720, joint: 443_630, separate: 221_820 },
};

/** The statutory bases of § 71.06(1q), set by 2013 Act 20. */
const BASE = { single: 225_000, joint: 300_000, separate: 150_000 };

/** The published standard deduction schedule, 2021 to 2025. */
const PUBLISHED = {
  'max.single': { 2021: 11_200, 2022: 11_790, 2023: 12_760, 2024: 13_230, 2025: 13_560 },
  'max.joint': { 2021: 20_730, 2022: 21_820, 2023: 23_620, 2024: 24_490, 2025: 25_110 },
  'max.separate': { 2021: 9_850, 2022: 10_370, 2023: 11_220, 2024: 11_630, 2025: 11_930 },
  'max.headOfHousehold': { 2021: 14_470, 2022: 15_230, 2023: 16_480, 2024: 17_090, 2025: 17_520 },
  'start.single': { 2021: 16_150, 2022: 16_990, 2023: 18_400, 2024: 19_070, 2025: 19_550 },
  'start.joint': { 2021: 23_300, 2022: 24_520, 2023: 26_550, 2024: 27_520, 2025: 28_210 },
  'start.separate': { 2021: 11_060, 2022: 11_640, 2023: 12_600, 2024: 13_060, 2025: 13_390 },
};

const round10 = (x) => Math.round(x / 10) * 10;

/** The cumulative indexation factor, bounded by every status that publishes a threshold. */
function factor(year) {
  let lo = -Infinity;
  let hi = Infinity;
  for (const status of ['single', 'joint', 'separate']) {
    lo = Math.max(lo, (TOP[year][status] - HALF) / BASE[status]);
    hi = Math.min(hi, (TOP[year][status] + HALF) / BASE[status]);
  }
  return [lo, hi];
}

/** The statutory base a published series is consistent with, over the given years. */
function baseInterval(series, years) {
  let lo = -Infinity;
  let hi = Infinity;
  for (const year of years) {
    const [flo, fhi] = factor(year);
    lo = Math.max(lo, (series[year] - HALF) / fhi);
    hi = Math.min(hi, (series[year] + HALF) / flo);
  }
  return [lo, hi];
}

/** Every multiple of $10 the prediction for `target` admits. */
function candidates(series, years, target) {
  const [blo, bhi] = baseInterval(series, years);
  assert.ok(blo <= bhi, 'the published series must be consistent with SOME base');
  const [flo, fhi] = factor(target);
  const lo = blo * flo;
  const hi = bhi * fhi;
  const out = [];
  for (let v = Math.floor(lo / 10) * 10 - 10; v <= Math.ceil(hi / 10) * 10 + 10; v += 10) {
    if (v - HALF <= hi && v + HALF >= lo) out.push(v);
  }
  return { candidates: out, raw: [lo, hi] };
}

test('three statuses bound the 2026 factor to under ten parts per million', () => {
  const [lo, hi] = factor(2026);
  assert.ok(lo < hi, 'the three bounds intersect at all');
  const ppm = ((hi - lo) / lo) * 1e6;
  assert.ok(ppm < 10, `the 2026 interval is ${ppm.toFixed(2)} ppm wide`);
  // And every year's does, which is what makes the base intervals narrow.
  for (const year of Object.keys(TOP)) {
    const [a, b] = factor(Number(year));
    assert.ok(a < b, `${year} intersects`);
    assert.ok(((b - a) / a) * 1e6 < 30, `${year} is narrow`);
  }
});

test('the method predicts the published 2025 schedule from 2021-2024 alone', () => {
  // The hold-out that makes the 2026 prediction worth anything. Not "it gets
  // the answer" — it gets the answer INTO the admissible set for all seven,
  // which is the only claim interval arithmetic is entitled to make.
  for (const [name, series] of Object.entries(PUBLISHED)) {
    const { candidates: set } = candidates(series, [2021, 2022, 2023, 2024], 2025);
    assert.ok(
      set.includes(series[2025]),
      `${name}: published ${series[2025]} is not in {${set.join(', ')}}`,
    );
  }
});

test('chaining the year-over-year ratio instead gets one 2025 figure wrong', () => {
  // The cruder method: take 2024's published figure, multiply by the ratio the
  // 2024 and 2025 top brackets imply, round. It works for five of the seven and
  // puts the separate deduction at $11,920 against a published $11,930, because
  // chaining rounded figures compounds the rounding and going back to the base
  // does not. THE RULE: an index factor is cumulative from a base, so a
  // year-over-year ratio of two rounded figures is not the factor.
  const [rlo, rhi] = [
    factor(2025)[0] / factor(2024)[1],
    factor(2025)[1] / factor(2024)[0],
  ];
  const chained = (name) => round10(PUBLISHED[name][2024] * ((rlo + rhi) / 2));
  assert.equal(chained('max.separate'), 11_920, 'the chained figure');
  assert.equal(PUBLISHED['max.separate'][2025], 11_930, 'the published one');
  // And the base method gets this one UNIQUELY right, which is the comparison.
  const { candidates: set } = candidates(
    PUBLISHED['max.separate'],
    [2021, 2022, 2023, 2024],
    2025,
  );
  assert.deepEqual(set, [11_930], 'the base method has no other candidate');
});

test('four of the seven 2026 figures are determined and three are not', () => {
  const determined = [];
  const ambiguous = [];
  for (const [name, series] of Object.entries(PUBLISHED)) {
    const { candidates: set } = candidates(series, [2021, 2022, 2023, 2024, 2025], 2026);
    assert.ok(set.length >= 1 && set.length <= 2, `${name} admits ${set.length} values`);
    (set.length === 1 ? determined : ambiguous).push(name);
  }
  assert.deepEqual(
    determined.sort(),
    ['max.headOfHousehold', 'max.joint', 'max.single', 'start.joint'],
    'the four the arithmetic settles',
  );
  assert.deepEqual(
    ambiguous.sort(),
    ['max.separate', 'start.separate', 'start.single'],
    'and the three it does not',
  );
});

test('every 2026 figure this package stores is in its admissible set', () => {
  const def = getStateDefinition('WI', 2026);
  const stored = {
    'max.single': def.deduction.maximum.single,
    'max.joint': def.deduction.maximum.marriedFilingJointly,
    'max.separate': def.deduction.maximum.marriedFilingSeparately,
    'max.headOfHousehold': def.deduction.maximum.headOfHousehold,
    'start.single': def.deduction.tiers.single[0].above,
    'start.joint': def.deduction.tiers.marriedFilingJointly[0].above,
    'start.separate': def.deduction.tiers.marriedFilingSeparately[0].above,
  };
  for (const [name, series] of Object.entries(PUBLISHED)) {
    const { candidates: set, raw } = candidates(series, [2021, 2022, 2023, 2024, 2025], 2026);
    assert.ok(
      set.includes(stored[name]),
      `${name}: stored ${stored[name]} is not in {${set.join(', ')}} (raw ${raw[0].toFixed(2)}..${raw[1].toFixed(2)})`,
    );
    // Where the set has two members this package takes the one the interval's
    // own midpoint rounds to, rather than the lower or the nearer-to-last-year.
    if (set.length === 2) {
      assert.equal(
        stored[name],
        round10((raw[0] + raw[1]) / 2),
        `${name}: the stored value is the midpoint's rounding`,
      );
    }
  }
});

test('the head of household threshold is the single one, in both years', () => {
  // One unresolved figure covers two statuses, which is why provisionalFigures
  // names `tiers.single.0.above` once rather than twice. Pinned so that a
  // future run cannot split them without noticing it has split a provisional
  // entry as well.
  for (const year of [2025, 2026]) {
    const def = getStateDefinition('WI', year);
    assert.equal(
      def.deduction.tiers.headOfHousehold[0].above,
      def.deduction.tiers.single[0].above,
      `${year}`,
    );
  }
});

test('the ambiguity costs at most 77 cents of tax', () => {
  // The bound the provisional entries quote. $10 of deduction at Wisconsin's
  // top rate of 7.65% is 76.5 cents, and nothing about a standard deduction can
  // be worth more than the top rate times itself.
  assert.ok(10 * 0.0765 < 0.77, '$10 of deduction at 7.65%');
  // And the withdrawal cannot magnify it: a threshold $10 out moves the
  // deduction by the withdrawal rate times $10, which is less than $10.
  for (const rate of [0.12, 0.19778, 0.22515]) {
    assert.ok(10 * rate * 0.0765 < 0.77, `a threshold $10 out at ${rate}`);
  }
});

test('the provisional entries are exactly the ambiguous figures, in every column', () => {
  // The flag and the arithmetic cannot drift apart: if a future run narrows one
  // of the three it must remove the entry, and if the arithmetic ever admits a
  // fourth this fails.
  //
  // FOUR paths for THREE figures, because § 71.05(22)(dp) gives single and head
  // of household one threshold and `deduction.tiers` stores it once per status.
  // That is Day 42's rule, which cost Ohio five flags for three figures: a
  // byStatus table turns one unread number into one flag per column.
  const paths = getStateDefinition('WI', 2026)
    .provisionalFigures.map((entry) => entry.path)
    .sort();
  assert.deepEqual(paths, [
    'deduction.maximum.marriedFilingSeparately',
    'deduction.tiers.headOfHousehold.0.above',
    'deduction.tiers.marriedFilingSeparately.0.above',
    'deduction.tiers.single.0.above',
  ]);
  // And the two paths that share a figure really do hold the same number, so
  // the pair is one ambiguity and not two.
  const tiers = getStateDefinition('WI', 2026).deduction.tiers;
  assert.equal(tiers.single[0].above, tiers.headOfHousehold[0].above);
});
