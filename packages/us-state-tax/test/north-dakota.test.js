// North Dakota. The twenty-eighth taxing state, and the first whose published
// rate schedule this package could prove it cannot derive.
//
// Every expected figure below is computed by hand from the published schedules
// and written out, not read back out of the engine. Day 27's rule: a test
// written from the data can only confirm the data.
//
// Two groups here do a job no other state's file does.
//
// `the published 2026 schedule is not reachable from any earlier one by one
// multiplier` runs an exhaustive search rather than asserting its conclusion.
// It is the strongest part of this file because it could have refused the
// figures: if a factor existed, the claim in `states/north-dakota.ts` would be
// false and this test would say so.
//
// And `married filing separately is half the joint threshold in every published
// year` records a relation the MODULE deliberately does not apply. Louisiana
// stores one standard deduction a year and doubles it because R.S. 47:294(A)(2)
// states the relation in words. North Dakota's half is visible in four years of
// tables and is stated in no document this package could open, so it is
// asserted here — where being wrong is a failure — and not there, where being
// wrong would be an answer.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FILING_STATUSES, getStateDefinition, stateIncomeTax } from './strict.mjs';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

/**
 * North Dakota starts from federal TAXABLE income — Form ND-1 line 1 — so the
 * helper takes that figure directly and the AGI beside it is only there because
 * the engine's basis carries both.
 */
const federal = (taxableIncome, agi = taxableIncome + 15_750) => ({
  adjustedGrossIncome: agi,
  taxableIncome,
  deduction: agi - taxableIncome,
  deductionKind: 'standard',
});

const nd = ({ taxableIncome = 100_000, year = 2025, filingStatus = 'single', ...fields } = {}) =>
  stateIncomeTax({ state: 'ND', year, filingStatus, ...fields, federal: federal(taxableIncome) });

const subtractionNamed = (result, fragment) =>
  result.computedSubtractions.find((s) => s.name.toLowerCase().includes(fragment))?.amount ?? 0;

// ---------------------------------------------------------------------------
// The schedules, written out once from the published tables. Everything below
// is arithmetic on these. Order is [zero band top, 1.95% band top].
// ---------------------------------------------------------------------------
const SCHEDULE = {
  2025: {
    single: [48_475, 244_825],
    marriedFilingJointly: [80_975, 298_075],
    marriedFilingSeparately: [40_475, 149_025],
    headOfHousehold: [64_950, 271_450],
    qualifyingSurvivingSpouse: [80_975, 298_075],
  },
  2026: {
    single: [49_575, 250_400],
    marriedFilingJointly: [82_800, 304_850],
    marriedFilingSeparately: [41_400, 152_425],
    headOfHousehold: [66_400, 277_600],
    qualifyingSurvivingSpouse: [82_800, 304_850],
  },
};
const MIDDLE_RATE = 0.0195;
const TOP_RATE = 0.025;

/**
 * The tax the published schedule gives, computed from the two thresholds and
 * rounded to the cent as the engine rounds it.
 *
 * The rounding is here rather than in the tolerance because one of the incomes
 * below lands on a half cent — 1.95% of $196,350 is $3,828.825 — and a
 * tolerance wide enough to swallow it would be wide enough to swallow a real
 * half-cent error. `the worked single-filer figures` below writes four answers
 * out in full with no helper between them.
 */
const scheduleTax = (taxableIncome, [zeroTop, middleTop]) =>
  Math.round(
    (MIDDLE_RATE * Math.max(0, Math.min(taxableIncome, middleTop) - zeroTop) +
      TOP_RATE * Math.max(0, taxableIncome - middleTop)) *
      100,
  ) / 100;

// ---------------------------------------------------------------------------
// The rate schedule.
// ---------------------------------------------------------------------------

test('the first bracket is 0%, in every status and both years', () => {
  // HB 1158 (2023) — the headline of the schedule and the half that decides
  // most returns. A dollar below the band's top is untaxed; a dollar above it
  // costs 1.95 cents, so the band is a BRACKET and not a deduction and the step
  // at its top is continuous.
  for (const year of [2025, 2026]) {
    for (const filingStatus of FILING_STATUSES) {
      const [zeroTop] = SCHEDULE[year][filingStatus];
      money(nd({ year, filingStatus, taxableIncome: zeroTop }).tax, 0, `ND ${year} ${filingStatus} at the top of the zero band`);
      money(
        nd({ year, filingStatus, taxableIncome: zeroTop + 1_000 }).tax,
        MIDDLE_RATE * 1_000,
        `ND ${year} ${filingStatus} a thousand above it`,
      );
    }
  }
});

test('the three bands, in every status and both years', () => {
  // Four incomes a status: inside the zero band, inside the 1.95% band, exactly
  // at the top of it, and inside the 2.50% band. The last is what makes the
  // middle threshold observable at all — an income below it cannot tell
  // $244,825 from $1,000,000.
  for (const year of [2025, 2026]) {
    for (const filingStatus of FILING_STATUSES) {
      const bands = SCHEDULE[year][filingStatus];
      for (const taxableIncome of [
        bands[0] - 10_000,
        Math.round((bands[0] + bands[1]) / 2),
        bands[1],
        bands[1] + 60_000,
      ]) {
        money(
          nd({ year, filingStatus, taxableIncome }).tax,
          scheduleTax(taxableIncome, bands),
          `ND ${year} ${filingStatus} at $${taxableIncome}`,
        );
      }
    }
  }
});

test('the worked single-filer figures, written out rather than computed', () => {
  // The arithmetic above with a loop in it can be subtly wrong in the same way
  // the engine is. These four are long multiplication.
  //
  //   2025 single at $100,000:  1.95% x (100,000 - 48,475) = 1.95% x 51,525
  money(nd({ year: 2025, taxableIncome: 100_000 }).tax, 1_004.74, '2025 single $100k');
  //   2026 single at $100,000:  1.95% x (100,000 - 49,575) = 1.95% x 50,425
  money(nd({ year: 2026, taxableIncome: 100_000 }).tax, 983.29, '2026 single $100k');
  //   2025 single at $300,000:  1.95% x 196,350 + 2.50% x 55,175
  money(nd({ year: 2025, taxableIncome: 300_000 }).tax, 3_828.825 + 1_379.375, '2025 single $300k');
  //   2026 joint at $300,000:   1.95% x (300,000 - 82,800) = 1.95% x 217,200
  money(
    nd({ year: 2026, filingStatus: 'marriedFilingJointly', taxableIncome: 300_000 }).tax,
    4_235.4,
    '2026 joint $300k',
  );
});

test('every one of the eight indexed thresholds moved between 2025 and 2026', () => {
  // The provenance ledger calls the thresholds `indexed` in both years and a
  // one-year entry cannot carry `constant: false`, so this is where the claim
  // that they MOVED is made. An indexed figure that has not moved is the shape
  // of a silent carry-forward — the defect this package's whole provenance file
  // exists to catch — and North Dakota has none.
  const statuses = ['single', 'marriedFilingJointly', 'marriedFilingSeparately', 'headOfHousehold'];
  for (const filingStatus of statuses) {
    for (const band of [0, 1]) {
      assert.notEqual(
        SCHEDULE[2025][filingStatus][band],
        SCHEDULE[2026][filingStatus][band],
        `${filingStatus} band ${band} must move between the two published schedules`,
      );
    }
  }
  // And the definition holds what this file says it holds, in both years, so the
  // table above is checked against the shipped bytes rather than beside them.
  for (const year of [2025, 2026]) {
    const { byStatus } = getStateDefinition('ND', year).rate;
    for (const filingStatus of FILING_STATUSES) {
      const [zeroTop, middleTop] = SCHEDULE[year][filingStatus];
      assert.deepEqual(
        byStatus[filingStatus],
        [
          { rate: 0, upTo: zeroTop },
          { rate: MIDDLE_RATE, upTo: middleTop },
          { rate: TOP_RATE, upTo: Infinity },
        ],
        `ND ${year} ${filingStatus}`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// The two findings about the published table itself.
// ---------------------------------------------------------------------------

// Every published North Dakota schedule, including the two years before this
// package covers, because the question is about the SEQUENCE and three points
// answer it better than two. 2023 is HB 1158's own figures; 2024 is the
// instruction booklet's.
const PUBLISHED = {
  2023: [44_725, 225_975, 74_750, 275_100, 37_375, 137_550, 59_950, 250_550],
  2024: [47_150, 238_200, 78_775, 289_975, 39_375, 144_975, 63_175, 264_100],
  2025: [48_475, 244_825, 80_975, 298_075, 40_475, 149_025, 64_950, 271_450],
  2026: [49_575, 250_400, 82_800, 304_850, 41_400, 152_425, 66_400, 277_600],
};
const THRESHOLD_NAMES = [
  'single 0%',
  'single 1.95%',
  'joint 0%',
  'joint 1.95%',
  'separate 0%',
  'separate 1.95%',
  'head of household 0%',
  'head of household 1.95%',
];

test('the 2025 and 2026 schedules this package ships ARE the published rows above', () => {
  // The two tables in this file are written for two different jobs — one by
  // filing status for the arithmetic, one as a flat row for the search below —
  // and a divergence between them would make the search a search over
  // something this package does not ship.
  for (const year of [2025, 2026]) {
    const s = SCHEDULE[year];
    assert.deepEqual(
      [
        s.single[0], s.single[1],
        s.marriedFilingJointly[0], s.marriedFilingJointly[1],
        s.marriedFilingSeparately[0], s.marriedFilingSeparately[1],
        s.headOfHousehold[0], s.headOfHousehold[1],
      ],
      PUBLISHED[year],
      `${year}: the two tables in this file must be the same schedule`,
    );
  }
});

test('the published 2026 schedule is not reachable from any earlier one by one multiplier', () => {
  // THE FINDING, RUN RATHER THAN ASSERTED.
  //
  // § 57-38-30.3(1)(e) indexes the thresholds by the federal cost-of-living
  // adjustment, so the obvious check on a published table is whether one factor
  // reaches it. For each threshold and each rounding rule there is an interval
  // of factors that would produce the published 2026 figure; one factor can
  // explain the whole schedule exactly when those eight intervals intersect.
  //
  // They never do — not from 2025, not from 2024, not from the statutory 2023
  // base, under any rounding to $25 or $50 in any direction. So a model that
  // PROJECTS North Dakota's brackets rather than reading them is wrong, and
  // this package stores all eight figures a year.
  //
  // Written so it can fail: if a correction to any figure here made one of the
  // eighteen combinations possible, this test says which one.
  const window = (value, interval, rule) => {
    // A rounding rule can only ever produce a multiple of its interval, so a
    // published figure that is not one rules the rule out before any
    // arithmetic. $49,575 and $152,425 are not multiples of $50, which is what
    // kills all six of the $50 combinations.
    if (value % interval !== 0) return null;
    if (rule === 'floor') return [value, value + interval];
    if (rule === 'nearest') return [value - interval / 2, value + interval / 2];
    return [value - interval, value]; // ceil
  };
  const possible = [];
  for (const from of [2023, 2024, 2025]) {
    for (const interval of [25, 50]) {
      for (const rule of ['floor', 'nearest', 'ceil']) {
        let low = -Infinity;
        let high = Infinity;
        let unreachable = false;
        for (let i = 0; i < 8; i += 1) {
          const w = window(PUBLISHED[2026][i], interval, rule);
          if (w === null) {
            unreachable = true;
            break;
          }
          low = Math.max(low, w[0] / PUBLISHED[from][i]);
          high = Math.min(high, w[1] / PUBLISHED[from][i]);
        }
        if (!unreachable && low < high) possible.push(`${from} -> 2026, ${rule} to $${interval}`);
      }
    }
  }
  assert.deepEqual(
    possible,
    [],
    'a single indexation factor now explains the published 2026 schedule, which this package says is impossible',
  );
});

test('and the obstruction is the head-of-household pair, both exactly $25 low', () => {
  // The negative above is the shipping claim; this is the part that says WHERE,
  // because "no factor works" is the kind of result that is also what a bug in
  // the search looks like.
  //
  // Rounding down to $25 from 2025, the FOUR independently indexed thresholds —
  // single and joint, two bands each — do intersect, on a factor of about
  // 1.02277. The separate pair is left out because it is not independent: the
  // test below shows it is the joint pair halved, so it carries the joint
  // column's rounding and then its own, which is one of the two reasons no
  // single factor can explain all eight. The other reason is this one: THE
  // AGREED FACTOR PUTS BOTH HEAD-OF-HOUSEHOLD THRESHOLDS $25 ABOVE WHAT THE
  // STATE PUBLISHED.
  const floor25 = (value) => Math.floor(value / 25) * 25;
  const independentlyIndexed = [0, 1, 2, 3];
  let low = -Infinity;
  let high = Infinity;
  for (const i of independentlyIndexed) {
    low = Math.max(low, PUBLISHED[2026][i] / PUBLISHED[2025][i]);
    high = Math.min(high, (PUBLISHED[2026][i] + 25) / PUBLISHED[2025][i]);
  }
  assert.ok(low < high, 'the four single and joint thresholds agree on a factor');
  assert.ok(low > 1.0227 && high < 1.0229, 'and it is an ordinary one-year CPI factor');
  for (const i of [6, 7]) {
    const atLow = floor25(PUBLISHED[2025][i] * low);
    const atHigh = floor25(PUBLISHED[2025][i] * (high - 1e-12));
    assert.equal(atLow, atHigh, `${THRESHOLD_NAMES[i]}: the agreed factor gives one answer`);
    assert.equal(
      atLow - PUBLISHED[2026][i],
      25,
      `${THRESHOLD_NAMES[i]}: the published figure is $25 below the factor the other four fix`,
    );
  }
  // $25 of extra zero-rated income is 49 cents at 1.95%. The size is not the
  // point: a derivation is wrong here in a way that nothing but the published
  // table can see, and it is wrong in the direction that produces a smaller
  // bill, which is the direction a filer does not query.
  money(
    MIDDLE_RATE * 25,
    0.4875,
    'what the head-of-household discrepancy is worth',
  );
});

test('married filing separately is half the joint threshold in every published year', () => {
  // A RELATION THE MODULE DELIBERATELY DOES NOT APPLY. It holds in all four
  // published years, in both bands, as the joint figure halved and rounded DOWN
  // to $25 — and no document available to this package states it, so storing it
  // as arithmetic would make the halving a property of this package rather than
  // of North Dakota. Asserted here, where being wrong fails; not there, where
  // being wrong would be an answer.
  //
  // It is also the reason the search above cannot succeed under a single
  // factor: the separate column is not independently indexed, so it carries the
  // joint column's rounding and then its own.
  const floor25 = (value) => Math.floor(value / 25) * 25;
  for (const year of [2023, 2024, 2025, 2026]) {
    const row = PUBLISHED[year];
    assert.equal(floor25(row[2] / 2), row[4], `${year}: separate 0% band is half the joint one`);
    assert.equal(floor25(row[3] / 2), row[5], `${year}: separate 1.95% band is half the joint one`);
  }
  // And the two years where the halving is EXACT are the two where it proves
  // least: 2023's figures are HB 1158's own and 2026's halve evenly, so only
  // 2024 and 2025 — where the half ends in $87.50 and the published figure is
  // $75 — distinguish rounding down from rounding to nearest.
  assert.equal(PUBLISHED[2024][2] / 2, 39_387.5);
  assert.equal(PUBLISHED[2025][2] / 2, 40_487.5);
  assert.equal(PUBLISHED[2024][4], 39_375);
  assert.equal(PUBLISHED[2025][4], 40_475);
});

test("the zero band WAS the federal 12% bracket and in 2026 it is not", () => {
  // The three-year coincidence and the year it broke, stated here in this
  // package's own figures; `tools/cross-package/` checks the same two claims
  // against `us-federal-tax`'s shipped tables, which is the copy that can
  // contradict them.
  assert.equal(PUBLISHED[2023][0], 44_725, 'the federal 2023 single 12% bracket');
  assert.equal(PUBLISHED[2024][0], 47_150, 'the federal 2024 single 12% bracket');
  assert.equal(PUBLISHED[2025][0], 48_475, 'the federal 2025 single 12% bracket');
  assert.equal(PUBLISHED[2026][0], 49_575, 'and the federal 2026 one is $50,400');
  // $825 of zero-rated income the federal bracket would have given and North
  // Dakota's does not, at 1.95%.
  money(MIDDLE_RATE * (50_400 - 49_575), 16.0875, 'what OBBBA § 70101 is worth here');
});

// ---------------------------------------------------------------------------
// The base, and what is not in it.
// ---------------------------------------------------------------------------

test('the base is federal taxable income and North Dakota adds no deduction of its own', () => {
  const def = getStateDefinition('ND', 2025);
  assert.equal(def.base, 'federalTaxableIncome');
  assert.equal(def.deduction.kind, 'none');
  assert.equal(def.exemption, undefined, 'North Dakota has no exemption of its own');
  // So a dollar of federal deduction is a dollar off the North Dakota base, and
  // the engine's own answer is what says so rather than the declaration above.
  const base = nd({ taxableIncome: 100_000 }).tax;
  money(nd({ taxableIncome: 99_000 }).tax, base - MIDDLE_RATE * 1_000, 'a $1,000 federal deduction');
});

test('dependents, age and blindness move no North Dakota figure', () => {
  // The consequence of a federal-taxable-income base with no exemption: every
  // allowance for a person is spent federally before line 1. A state that gives
  // a dependent nothing is worth asserting, because every table of state taxes
  // has a column for it.
  const base = nd({ taxableIncome: 100_000 }).tax;
  for (const extra of [
    { dependents: 4 },
    { filerAge: 70 },
    { filerAge: 70, spouseAge: 70 },
    { blindOrDisabled: 2 },
  ]) {
    money(nd({ taxableIncome: 100_000, ...extra }).tax, base, JSON.stringify(extra));
  }
});

// ---------------------------------------------------------------------------
// The two forty percents.
// ---------------------------------------------------------------------------

test('40% of the net long-term capital gain comes out, and a short-term gain cannot create one', () => {
  // § 57-38-30.3(2)(d)(1): 40% of the excess of net long-term capital gain over
  // net short-term capital loss.
  //
  // $50,000 long-term with no short-term items: the whole $50,000 is the base.
  money(
    subtractionNamed(nd({ taxableIncome: 100_000, netCapitalGain: 50_000 }), 'capital gain'),
    20_000,
    'a plain long-term gain',
  );
  // $50,000 long-term behind a $20,000 short-term LOSS: Form 1040 line 7 is
  // already netted to $30,000, which is the statute's base.
  money(
    subtractionNamed(nd({ taxableIncome: 100_000, netCapitalGain: 30_000 }), 'capital gain'),
    12_000,
    'a short-term loss eats it',
  );
  // $50,000 long-term plus a $10,000 short-term GAIN: line 7 is $60,000 and the
  // base is still $50,000, because a short-term gain cannot create an
  // exclusion.
  money(
    subtractionNamed(
      nd({ taxableIncome: 100_000, netCapitalGain: 60_000, shortTermCapitalGains: 10_000 }),
      'capital gain',
    ),
    20_000,
    'a short-term gain does not add to it',
  );
});

test('40% of qualified dividends comes out, and it is a base no capital-gain field can reach', () => {
  // § 57-38-30.3(2)(d)(2) and Form ND-1 line 13. THE POINT OF THE SEPARATE
  // RULE: this filer has no capital gain at all, so a model that implemented
  // North Dakota's forty percent by widening the capital-gains basis gives them
  // nothing.
  const result = nd({ taxableIncome: 100_000, qualifiedDividends: 20_000 });
  money(subtractionNamed(result, 'qualified dividend'), 8_000, 'the dividend exclusion');
  money(subtractionNamed(result, 'capital gain'), 0, 'and no capital gain exclusion');
  money(result.tax, MIDDLE_RATE * (100_000 - 8_000 - 48_475), 'the tax after it');
  // And the two run together on one return without touching each other.
  const both = nd({ taxableIncome: 100_000, netCapitalGain: 50_000, qualifiedDividends: 20_000 });
  money(both.tax, MIDDLE_RATE * (100_000 - 20_000 - 8_000 - 48_475), 'both exclusions');
});

test('the two 40% rules print the same number and hold their own copy of it', () => {
  // The transposition this guards: swapping the two shares would leave both
  // names true and only the answers would move. So each name is checked against
  // the share of the rule it is ON, and the rules are checked to be two.
  for (const year of [2025, 2026]) {
    const def = getStateDefinition('ND', year);
    assert.equal(def.capitalGainsSubtraction.share, 0.4);
    assert.equal(def.qualifiedDividendSubtraction.share, 0.4);
    assert.match(def.capitalGainsSubtraction.name, /capital gain/i);
    assert.match(def.qualifiedDividendSubtraction.name, /qualified dividend/i);
    assert.equal(def.capitalGainsSubtraction.basis.kind, 'longTermNetted');
  }
});

// ---------------------------------------------------------------------------
// Retirement: two things out, everything else in.
// ---------------------------------------------------------------------------

test('the taxable part of a Social Security benefit comes out in full, at every income', () => {
  // Line 15, with no income test — the $50,000/$100,000 federal-AGI test the
  // 2019 deduction carried was removed from tax year 2021. Swept across incomes
  // because a removed income test is exactly the kind of thing a single probe
  // cannot see.
  for (const taxableIncome of [40_000, 100_000, 400_000]) {
    const withBenefit = nd({ taxableIncome, taxableSocialSecurity: 20_000 });
    const without = nd({ taxableIncome: taxableIncome - 20_000 });
    money(withBenefit.tax, without.tax, `$${taxableIncome} with $20,000 of benefit`);
  }
});

test('military retired pay comes out in full at any age, and nothing else does', () => {
  // § 57-38-01.33, no cap and no age test. North Carolina's construction, and
  // the test that matters is the contrast: the SAME $40,000 as a civilian
  // government pension is taxed in full.
  const military = nd({
    taxableIncome: 100_000,
    filerAge: 45,
    retirement: { filer: { militaryRetirement: 40_000 } },
  });
  money(military.tax, MIDDLE_RATE * (100_000 - 40_000 - 48_475), 'military retired pay at 45');
  money(
    nd({ taxableIncome: 100_000, filerAge: 70, retirement: { filer: { militaryRetirement: 40_000 } } }).tax,
    military.tax,
    'and at 70, because there is no age test',
  );
  for (const kind of ['governmentPension', 'employerPlanPension', 'iraDistributions', 'definedContributionPlan']) {
    money(
      nd({ taxableIncome: 100_000, filerAge: 70, retirement: { filer: { [kind]: 40_000 } } }).tax,
      MIDDLE_RATE * (100_000 - 48_475),
      `${kind} is taxed in full`,
    );
  }
});

// ---------------------------------------------------------------------------
// Conformity, and the notes.
// ---------------------------------------------------------------------------

test('conformity is rolling, governs below the line, and nothing is added back', () => {
  for (const year of [2025, 2026]) {
    const def = getStateDefinition('ND', year);
    assert.equal(def.federalConformity.kind, 'rolling');
    assert.equal(def.federalConformity.governs, 'belowTheLine');
    assert.ok(def.federalConformity.primaryTextUnread, 'the weakest leg says so in the field');
    assert.equal(def.addBacks, undefined, 'North Dakota adds nothing back');
  }
});

test('both years ship published, because `provisional` is a claim about the publisher', () => {
  // The 2026 figures rest on a form this sandbox could not open, and that is a
  // fact about the reader. Marking the state-year `provisional` for it would
  // put a sentence about this container into a field that describes North
  // Dakota. The citation says NOT OPENED FROM THIS SANDBOX in its own words
  // instead, and this test is what keeps the two apart.
  for (const year of [2025, 2026]) {
    const def = getStateDefinition('ND', year);
    assert.equal(def.status, 'published');
    assert.equal(def.provisionalFigures, undefined);
  }
  const unopened = getStateDefinition('ND', 2026).citations.filter((c) =>
    /NOT OPENED FROM THIS SANDBOX/.test(c.title),
  );
  assert.ok(unopened.length >= 3, 'the unread primary sources are named one by one');
  assert.ok(
    unopened.some((c) => /ND-1ES/.test(c.title)),
    'including the one the 2026 schedule rests on',
  );
});

test('the notes name the marriage penalty credit and bound what omitting it costs', () => {
  // The only credit on a North Dakota return, and the only thing omitted here
  // that a joint filer could notice. A note that says "not modelled" without
  // the size of it is an apology; the bound is what makes it usable.
  const notes = getStateDefinition('ND', 2025).notes.join('\n');
  assert.match(notes, /MARRIAGE PENALTY CREDIT/);
  assert.match(notes, /\$312/);
  assert.match(notes, /at most \$312/);
});
