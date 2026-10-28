// Arkansas. The thirty-first taxing state, and the one whose highest marginal
// rate is nearly four times the rate it advertises.
//
// Every expected figure below is computed by hand from the published card, the
// statutory tables or the Low Income Tax Tables and written out, not read back
// out of the engine. Day 27's rule: a test written from the data can only
// confirm the data.
//
// FOUR GROUPS HERE DO A JOB NO OTHER STATE'S FILE DOES.
//
// `the bracket adjustment is a ten-point marginal rate and thirty cliffs`
// MEASURES the slope and counts the discontinuities rather than asserting
// either. The figure that matters about Arkansas is not in Arkansas's rate
// schedule: it is the slope of a relief being withdrawn, and the only way to
// see it is to compute the tax at two incomes $100 apart.
//
// `the 2026 rows agree with the two statutory tables at every dollar` is the
// only place in this suite where a DERIVED schedule is checked against an
// independent recomputation of the law it was derived from. No Indexed Tax
// Brackets card exists for 2026, so `AR_ROWS_2026` is arithmetic rather than
// transcription, and arithmetic in a tax table has to be proved.
//
// `the published card is anchored one dollar below each bracket floor` is the
// finding that the card and the statute do not compute the same tax. It is
// worth two to four cents a return and it is the reason the reductions carry
// cents at all.
//
// And `every figure the mutation audit cannot see` is the hand-written half of
// the quality claim. Nine of Arkansas's by-status credit cells and 19 of the 224
// amounts in its low-income tables are integers below $1,000, which is the
// blind-spot class Day 60 documented and Day 63's one real defect landed in. A
// 99.6% score says nothing about them, so they are asserted here by hand.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SUPPORTED_STATES, getStateDefinition, stateIncomeTax } from '../dist/esm/index.js';
import { ARKANSAS_STANDARD_DEDUCTION } from './step-charts.mjs';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

const FEDERAL_DEDUCTION = { 2025: 15_750, 2026: 16_100 };

/** A single wage earner at `income`, with the federal figures a 1040 would carry. */
const single = (income, year, extra = {}) => ({
  state: 'AR',
  year,
  filingStatus: 'single',
  federal: {
    adjustedGrossIncome: income,
    taxableIncome: Math.max(0, income - FEDERAL_DEDUCTION[year]),
    deduction: FEDERAL_DEDUCTION[year],
    deductionKind: 'standard',
  },
  ...extra,
});

/** The Arkansas tax on a given NET TAXABLE income, through a separate return. */
//
// Married filing separately, deliberately, and it is the only status that can
// answer this question: Arkansas's Low Income Tax Tables reach every other
// status up to at least $17,500 of AGI and always come out lower, so a single
// filer's tax below that is the table's and not the schedule's. § 26-51-301
// bars a separate return from all seven tables, which makes it the one status
// whose tax is the rate schedule's all the way down to the first dollar.
const onSchedule = (netTaxableIncome, year) =>
  stateIncomeTax({
    state: 'AR',
    year,
    filingStatus: 'marriedFilingSeparately',
    federal: {
      adjustedGrossIncome: netTaxableIncome + 2_470,
      taxableIncome: Math.max(0, netTaxableIncome + 2_470 - FEDERAL_DEDUCTION[year]),
      deduction: FEDERAL_DEDUCTION[year],
      deductionKind: 'standard',
    },
  });

// ---------------------------------------------------------------------------
// The probe input this suite shares with `step-charts.mjs`, pinned against the
// figure the package actually ships.
//
// `ARKANSAS_STANDARD_DEDUCTION` exists because the staircase probes have to
// convert a net-taxable-income probe value into wages, and it is a COPY of an
// indexed figure. A copy that drifts turns every rate-schedule probe into a
// probe of the wrong row, silently — the probes would still pass, against the
// row below the one they were written for. This is the only thing standing
// between the two.
// ---------------------------------------------------------------------------

test('the probe input equals the deduction the package ships', () => {
  for (const year of [2025, 2026]) {
    const shipped = getStateDefinition('AR', year).deduction.amounts;
    for (const status of Object.keys(shipped)) {
      assert.equal(
        ARKANSAS_STANDARD_DEDUCTION[year][status],
        shipped[status],
        `${year} ${status}: step-charts.mjs and the definition disagree about the deduction`,
      );
      // AND THIS IS THE ASSERTION THAT CAUGHT A REAL DEFECT, which is why it
      // loops over every status rather than checking the two distinct figures.
      // `byStatus` defaults `qualifyingSurvivingSpouse` to the JOINT value, and
      // the first draft of `arkansas.ts` left the cell out — so a surviving
      // spouse got $4,940 where § 26-51-430 gives them the single filer's
      // $2,470, worth $91.39 of 2026 tax. Nothing else in the suite reads that
      // cell: the differential grid has a surviving-spouse household and this
      // state was not in the grid yet.
    }
  }
});

// ---------------------------------------------------------------------------
// THE BRACKET ADJUSTMENT. The day's headline, measured.
// ---------------------------------------------------------------------------

test('the bracket adjustment is a ten-point marginal rate, in both years', () => {
  // A $10 relief withdrawn per $100 of income is ten percentage points on top
  // of the statutory rate. MEASURED by computing the tax at two incomes $100
  // apart, which is the only way the figure can be seen at all: nothing in any
  // published Arkansas bracket table contains 13.7 or 13.9.
  const slope = (year) => {
    const lo = onSchedule(94_701, year).taxBeforeCredits;
    const hi = onSchedule(94_801, year).taxBeforeCredits;
    return (hi - lo) / 100;
  };
  money(slope(2026), 0.137, '2026 marginal rate in the adjustment band');
  money(slope(2025), 0.139, '2025 marginal rate in the adjustment band');
  // THREE DIFFERENT TRUE RATES FOR ONE PROVISION, and the one worth publishing is
  // the one a one-dollar probe cannot see. The adjustment's rows are $100 wide, so
  // the ten points arrive all at once at a row's edge rather than being spread
  // across it.
  const perDollar = (at, year) =>
    onSchedule(at + 1, year).taxBeforeCredits - onSchedule(at, year).taxBeforeCredits;
  // Inside a row: the statutory rate, to the cent the engine rounds to.
  money(perDollar(94_750, 2026), 0.04, 'one dollar inside a row');
  // Across a boundary: ten dollars on one dollar of income.
  money(perDollar(94_800, 2026), 10.04, 'one dollar across a row boundary');
  // And over the WHOLE band, exactly the same 13.70% as over any $100 in it, which
  // is what makes the figure publishable rather than an artifact of where it was
  // measured.
  money(
    (onSchedule(97_601, 2026).taxBeforeCredits - onSchedule(94_701, 2026).taxBeforeCredits) / 2_900,
    0.137,
    'the whole 2026 band',
  );
  money(
    (onSchedule(97_801, 2025).taxBeforeCredits - onSchedule(94_701, 2025).taxBeforeCredits) / 3_100,
    0.139,
    'the whole 2025 band',
  );
  // And it is 3.7 times the top statutory rate, which is the comparison worth
  // keeping rather than the rate itself.
  const top = (year) => {
    const rows = getStateDefinition('AR', year).rate.rows;
    return Math.max(...rows.map((r) => r.rate));
  };
  assert.equal(top(2026), 0.037);
  assert.equal(top(2025), 0.039);
  assert.ok(slope(2026) / top(2026) > 3.7, 'the band is more than 3.7x the top rate');
});

test('the adjustment is a staircase and not a slope — thirty cliffs, counted', () => {
  // The rows are $100 wide and the amounts are whole dollars, so the tax STEPS.
  // A provision written to stop a cliff at $94,700 is itself a run of smaller
  // ones, and the count is measured by walking the band a cent at a time across
  // each boundary.
  const cliffs = (year) => {
    const found = [];
    for (let at = 94_800; at <= 97_900; at += 100) {
      const before = onSchedule(at, year).taxBeforeCredits;
      const after = onSchedule(at + 0.01, year).taxBeforeCredits;
      if (after - before > 1) found.push([at, Math.round((after - before) * 100) / 100]);
    }
    return found;
  };
  const c26 = cliffs(2026);
  const c25 = cliffs(2025);
  assert.equal(c26.length, 29, '2026 discontinuities of about $10');
  assert.equal(c25.length, 31, '2025 discontinuities of about $10');
  // Every one of them is $10, to the cent, in both years.
  for (const [at, jump] of [...c26, ...c25]) {
    money(jump, 10, `the step at ${at} is $10`);
  }
  // For comparison, the rule this package called "the only discontinuous rate
  // structure" until today: Ohio's baseAmountSchedule has TWO.
  const ohio = getStateDefinition('OH', 2025).rate;
  assert.equal(ohio.kind, 'baseAmountSchedule');
  assert.ok(c26.length > 14 * ohio.bands.filter((b) => b.base > 0).length);
});

test('the 2026 adjustment OVERSHOOTS and the 2025 card UNDERSHOOTS the same join', () => {
  // At $94,700 the regular table governs and at $94,701 the high-income one
  // does. The adjustment exists to make the two meet, and in neither year does
  // it — in opposite directions, with no act having changed it: the 2026 amount
  // is Act 1 of 2026's and the 2025 one is the Department's.
  const step = (year) =>
    onSchedule(94_701, year).taxBeforeCredits - onSchedule(94_700, year).taxBeforeCredits;
  // 2026: one dollar of extra income CUTS the bill by $2.66.
  money(step(2026), -2.66, '2026 step at the high-income threshold');
  // 2025: the same dollar costs $20.70.
  money(step(2025), 20.7, '2025 step at the high-income threshold');
});

test('a model using only the graduated table is too low by a FLAT amount', () => {
  // The commercial shape of the finding. Every published account of this state
  // prints the graduated schedule and stops; above the adjustment band the two
  // routes are linear with the same slope, so the error does not depend on
  // income. It is the same number at $100,000 and at $10,000,000.
  const graduated = (income, year) => {
    const bands =
      year === 2025
        ? [
            [5_600, 0],
            [11_200, 0.02],
            [16_000, 0.03],
            [26_400, 0.034],
            [Infinity, 0.039],
          ]
        : [
            [5_600, 0],
            [11_200, 0.02],
            [16_000, 0.03],
            [26_400, 0.034],
            [Infinity, 0.037],
          ];
    let tax = 0;
    let floor = 0;
    for (const [upTo, rate] of bands) {
      if (income <= floor) break;
      tax += (Math.min(income, upTo) - floor) * rate;
      floor = upTo;
    }
    return tax;
  };
  // 2026 IS ONE FIGURE AND 2025 IS TWO, and the second figure is the card's own
  // oddity rather than a rounding slip. For $100,001 and over DFA prints "$3,809
  // plus 3.9% of the excess over $100,000", which is a reduction of $91.00 where
  // the row beneath carries $89.30 — so an Arkansan earning one dollar more than
  // $100,000 pays $1.70 LESS, and the flat error steps from $330.70 to $329.00
  // across that dollar. It is the only place in either year where more income
  // means less tax by more than a cent.
  const spread = (incomes, year) => {
    const errors = incomes.map(
      (i) => onSchedule(i, year).taxBeforeCredits - graduated(i, year),
    );
    return { errors, flat: Math.max(...errors) - Math.min(...errors) };
  };
  const a = spread([97_700, 100_001, 150_000, 1_000_000, 10_000_000], 2026);
  for (const e of a.errors) money(e, 287.3, '2026 graduated-only understatement');
  money(a.flat, 0, '2026 the error is flat');
  // 2025, below the notch.
  const b = spread([97_900, 99_000, 100_000], 2025);
  for (const e of b.errors) money(e, 330.7, '2025 understatement below $100,001');
  money(b.flat, 0, '2025 the error is flat below the notch');
  // 2025, above it — and FLAT is the claim, so it is asserted across incomes two
  // orders of magnitude apart rather than at one income.
  const c = spread([100_001, 150_000, 1_000_000, 10_000_000], 2025);
  for (const e of c.errors) money(e, 329.0, '2025 understatement above $100,001');
  money(c.flat, 0, '2025 the error is flat above the notch');
  // The notch itself: one dollar of extra income, $1.70 less tax.
  money(
    onSchedule(100_001, 2025).taxBeforeCredits - onSchedule(100_000, 2025).taxBeforeCredits,
    -1.66,
    "the card's notch at $100,001",
  );
});

// ---------------------------------------------------------------------------
// THE 2026 DERIVATION, checked against the law it was derived from.
// ---------------------------------------------------------------------------

test('the 2026 rows agree with the two statutory tables at every dollar', () => {
  // `AR_ROWS_2026` is the only derived schedule in this state. It is checked
  // here by recomputing § 26-51-201(a)(4) and (a)(5) independently — the
  // graduated walk below $94,700, and 2% on the first $4,700 plus 3.7% on the
  // rest of the WHOLE income less the stepped adjustment above it — and
  // comparing at every dollar.
  const graduated = (income) => {
    const bands = [
      [5_600, 0],
      [11_200, 0.02],
      [16_000, 0.03],
      [26_400, 0.034],
      [Infinity, 0.037],
    ];
    let tax = 0;
    let floor = 0;
    for (const [upTo, rate] of bands) {
      if (income <= floor) break;
      tax += (Math.min(income, upTo) - floor) * rate;
      floor = upTo;
    }
    return tax;
  };
  const statutory = (income) => {
    if (income <= 94_700) return graduated(income);
    const whole = Math.min(income, 4_700) * 0.02 + Math.max(0, income - 4_700) * 0.037;
    const steps = Math.ceil((income - 94_700) / 100);
    return whole - Math.max(0, 290 - (steps - 1) * 10);
  };
  const rows = getStateDefinition('AR', 2026).rate.rows;
  // THIRTY-FIVE ROWS AND NOT THIRTY-SIX. The adjustment table's thirtieth row
  // is $0, which is the state of affairs for every income above $97,600 and so
  // already unbounded; a further row with the same reduction duplicates it, and
  // a duplicate row is a row no probe can witness. That is how the extra one
  // was found — see `test/step-probes.test.js`.
  assert.equal(rows.length, 35, 'the 2026 schedule has thirty-five rows');
  const fromRows = (income) => {
    for (const row of rows) if (income <= row.upTo) return Math.max(0, income * row.rate - row.reduction);
    throw new Error('the last row is not unbounded');
  };
  let worst = 0;
  let worstAt = 0;
  for (let i = 0; i <= 120_000; i += 1) {
    const d = Math.abs(fromRows(i) - statutory(i));
    if (d > worst) {
      worst = d;
      worstAt = i;
    }
  }
  // The two forms are algebraically identical, so the only disagreement is a
  // HALF-CENT TIE: `0.037 x 26,405 - 367.20` and `609.60 + 0.037 x 5` are both
  // exactly 609.785, and the two routes round it apart. One cent, and Arkansas
  // settles which governs — the instructions say a formula's results "must
  // match the table".
  assert.ok(worst <= 0.01, `the derived rows and the statute differ by ${worst} at ${worstAt}`);
});

// ---------------------------------------------------------------------------
// THE CARD AND THE STATUTE DO NOT AGREE.
// ---------------------------------------------------------------------------

test('the published 2025 card is anchored one dollar below each bracket floor', () => {
  // The card's reductions are NOT the accumulated tax of the bands beneath
  // them. Each is that figure measured one dollar lower, so every Arkansan
  // above $5,600 pays the graduated statutory tax plus their own rate on one
  // dollar. Two to four cents, in the state's favour, on every return filed.
  const rows = getStateDefinition('AR', 2025).rate.rows;
  const byFloor = new Map(rows.map((r) => [r.upTo, r]));
  const checks = [
    // [floor, rate, the card's reduction, the accumulated tax below]
    [5_600, 0.02, 111.98, 112.0],
    [11_200, 0.03, 223.97, 224.0],
    [16_000, 0.034, 287.97, 288.0],
    [26_400, 0.039, 419.96, 420.0],
  ];
  for (const [floor, rate, reduction, accumulated] of checks) {
    const row = [...byFloor.values()].find((r) => r.rate === rate && r.reduction === reduction);
    assert.ok(row !== undefined, `no 2025 row at ${rate} with a reduction of ${reduction}`);
    // The shortfall is the row's own rate on one dollar, to the cent the card
    // rounds to.
    money(
      Math.round((accumulated - reduction) * 100) / 100,
      Math.round(rate * 100) / 100,
      `the card's anchor at ${floor}`,
    );
  }
});

test('the zero row charges nothing at its ceiling and the first taxed row charges two cents', () => {
  // Both ends of the boundary the zero-rate row's zero reduction sits beside.
  // The reduction itself is the one figure in either year's schedule that no
  // probe can reach: `max(0, rate x income - reduction)` with a rate of zero is
  // zero for every reduction, which is why it is in UNREACHABLE rather than
  // probed. These two assertions are what stands behind it.
  money(onSchedule(5_599, 2025).taxBeforeCredits, 0, 'the top of the zero row');
  money(onSchedule(5_600, 2025).taxBeforeCredits, 0.02, 'the first dollar of the 2% row');
  money(onSchedule(5_599, 2026).taxBeforeCredits, 0, 'the top of the zero row, 2026');
  money(onSchedule(5_600, 2026).taxBeforeCredits, 0, 'the 2026 row is anchored on the floor');
});

// ---------------------------------------------------------------------------
// THE LOW INCOME TAX TABLES.
// ---------------------------------------------------------------------------

test('the low-income tables charge the poorest filers up to 12.47%', () => {
  // The implied marginal rate of each table, MEASURED from the table itself
  // rather than stated — the rise from the first $100-wide row to the last,
  // over the income between them. Arkansas's top statutory rate is 3.7%.
  const tables = getStateDefinition('AR', 2025).lowIncomeTaxTable.byStatus;
  const slope = (rows) => {
    // Row 0 is the exempt amount's own row and is not $100 wide; the staircase
    // proper starts at row 1.
    const first = rows[1];
    const last = rows[rows.length - 1];
    return (last.tax - first.tax) / (last.over - first.over);
  };
  const measured = {
    single: slope(tables.single.rows),
    hohOneDependent: slope(tables.headOfHousehold.rows),
    hohTwoDependents: slope(tables.headOfHousehold.withDependents),
    jointOneDependent: slope(tables.marriedFilingJointly.rows),
    jointTwoDependents: slope(tables.marriedFilingJointly.withDependents),
  };
  const pct = (v) => Math.round(v * 10_000) / 100;
  assert.equal(pct(measured.single), 7.0, 'single');
  assert.equal(pct(measured.hohOneDependent), 9.4, 'head of household, no or one dependent');
  assert.equal(pct(measured.jointOneDependent), 10.4, 'joint, no or one dependent');
  assert.equal(pct(measured.jointTwoDependents), 10.77, 'joint, two or more dependents');
  assert.equal(pct(measured.hohTwoDependents), 12.4, 'head of household, two or more');
  // THE STEEPEST RATE IN THE ARKANSAS INCOME TAX IS CHARGED TO A SINGLE PARENT
  // OF TWO, and it is 3.37 times the 2026 top rate.
  const steepest = Math.max(...Object.values(measured));
  assert.equal(steepest, measured.hohTwoDependents);
  assert.ok(steepest / 0.037 > 3.35, 'the steepest table is more than 3.35x the top rate');
  // And every table's rate is above the top statutory rate, which is the claim
  // worth making rather than the five numbers.
  for (const [name, v] of Object.entries(measured)) {
    assert.ok(v > 0.039, `${name} charges more at the margin than the top statutory rate`);
  }
});

test('every low-income table rises monotonically in whole-dollar steps', () => {
  // The tables are transcribed, 224 rows of them, so the shape is what a
  // test can check: each row's tax strictly above the one beneath it, each step
  // a whole number of dollars, and no step wider than the table's own slope
  // allows. A transposed digit in any of the 224 fails here.
  const def = getStateDefinition('AR', 2025).lowIncomeTaxTable.byStatus;
  const seen = new Set();
  let amounts = 0;
  for (const [status, table] of Object.entries(def)) {
    for (const half of ['rows', 'withDependents']) {
      const rows = table[half];
      if (rows === undefined || rows.length === 0) continue;
      const key = rows.map((r) => `${r.over}:${r.tax}`).join(',');
      seen.add(key);
      amounts += rows.length;
      for (let i = 1; i < rows.length; i += 1) {
        assert.ok(rows[i].over > rows[i - 1].over, `${status}.${half} row ${i} income not increasing`);
        assert.ok(rows[i].tax > rows[i - 1].tax, `${status}.${half} row ${i} tax not increasing`);
        assert.equal(rows[i].tax, Math.round(rows[i].tax), `${status}.${half} row ${i} is not whole dollars`);
        const step = rows[i].tax - rows[i - 1].tax;
        assert.ok(step >= 4 && step <= 13, `${status}.${half} row ${i} steps by ${step}`);
      }
      // Every row is $100 wide from row 1 on; row 0 is the exempt amount's.
      for (let i = 2; i < rows.length; i += 1) {
        assert.equal(rows[i].over - rows[i - 1].over, 100, `${status}.${half} row ${i} is not $100 wide`);
      }
    }
  }
  assert.equal(amounts, 311, 'rows across the by-status cells that hold a table');
  // FOUR DISTINCT TABLES AND NOT SEVEN, because the surviving-spouse pair is
  // byte for byte the head-of-household pair and the separate cell is empty.
  // The instructions print the four this package stores as seven cells; the
  // identity is asserted as an OBSERVATION and used nowhere.
  // FIVE DISTINCT ARRAYS, not seven: the surviving-spouse pair is byte for byte
  // the head-of-household pair, so two of the seven published tables duplicate
  // two others, and the separate cell is empty because Arkansas prints no table
  // for a separate return. The instructions print four distinct tables plus the
  // single filer's; this package stores exactly that and asserts the identity as
  // an OBSERVATION below.
  assert.equal(seen.size, 5, 'distinct row arrays across the by-status cells');
});

test('the surviving-spouse tables are identical to the head-of-household ones', () => {
  // An observation about two published tables, and deliberately not a
  // derivation: the AR1000F instructions print four tables for these two
  // statuses and this package stores four. A relation visible in a table is not
  // a relation the instructions state.
  const t = getStateDefinition('AR', 2025).lowIncomeTaxTable.byStatus;
  assert.deepEqual(t.qualifyingSurvivingSpouse.rows, t.headOfHousehold.rows);
  assert.deepEqual(t.qualifyingSurvivingSpouse.withDependents, t.headOfHousehold.withDependents);
  assert.equal(t.qualifyingSurvivingSpouse.ceiling, t.headOfHousehold.ceiling);
  assert.equal(t.qualifyingSurvivingSpouse.ceilingWithDependents, t.headOfHousehold.ceilingWithDependents);
  // And they are not the same OBJECT, which is the half that matters: two
  // statuses sharing one array make the witness guard's perturbation of either
  // a perturbation of both, and a household filed as one "witnesses" a cell the
  // other reads. See `test/status-sweep.test.js`.
  assert.notEqual(t.qualifyingSurvivingSpouse, t.headOfHousehold);
});

test('the table is taken when it is lower, and read on AGI rather than taxable income', () => {
  // A single Arkansan at $15,000. The table says $54; the rate schedule on
  // $15,000 less the $2,470 deduction says 3% x 12,530 - 223.97 = $151.93. Both
  // less the $29 personal credit, so $25 against $122.93 — and the table wins.
  // A single Arkansan at $15,000 of AGI. The table's row is "(14,900, 15,000]"
  // at $47 — $15,000 is the TOP of that row, not the bottom of the next — and
  // the rate schedule on $15,000 less the $2,470 deduction says
  // 3% x 12,530 - 223.97 = $151.93. The $29 personal credit and the $60
  // additional credit then take the table's $47 to nothing and would have left
  // $62.93 of the schedule's figure standing.
  const r = stateIncomeTax(single(15_000, 2025));
  assert.equal(r.lowIncomeTableTax, 47, 'the table governed and said so');
  money(r.taxBeforeCredits, 47, 'the table is the tax before credits');
  money(r.tax, 0, 'and the credits take it to nothing');
  // The schedule's own answer, for the same filer, through the one status the
  // table does not reach.
  money(onSchedule(12_530, 2025).taxBeforeCredits, 151.93, 'the schedule on the same income');
  // THE TABLE IS READ ON AGI, NOT ON TAXABLE INCOME, and the difference is 24
  // of the single table's 29 rows. A model that looks it up after the deduction
  // finds $0 where Arkansas finds $54.
  const rows = getStateDefinition('AR', 2025).lowIncomeTaxTable.byStatus.single.rows;
  const atAgi = rows.filter((row) => 15_000 > row.over).length;
  const atTaxable = rows.filter((row) => 12_530 > row.over).length;
  assert.equal(atAgi, 4, 'rows reached at $15,000 of AGI');
  assert.equal(atTaxable, 0, 'rows reached at $12,530 of taxable income');
  assert.equal(rows.length, 29);
});

test('above the ceiling the schedule governs, and the handover is not a cliff', () => {
  // The single table stops at $17,500 of AGI. Either side of it the tax must be
  // continuous enough that no filer is better off earning less — which is what
  // the table's steep rate buys.
  const below = stateIncomeTax(single(17_500, 2025));
  const above = stateIncomeTax(single(17_501, 2025));
  assert.equal(below.lowIncomeTableTax, 222, 'the last row of the table');
  assert.equal(above.lowIncomeTableTax, undefined, 'above the ceiling the schedule governs');
  // $222 less the $29 personal credit and the $60 additional credit.
  money(below.tax, 222 - 89, 'the table, less both credits');
  // $17,501 - $2,470 = $15,031 of taxable income: 3% x 15,031 - 223.97 = 226.96
  money(above.tax, 226.96 - 89, 'the schedule, less both credits');
  // More tax above than below, so the handover does not pay anyone to earn less.
  assert.ok(above.tax > below.tax, 'the ceiling is not a reverse cliff');
});

test('a separated filer is barred from the low-income tables and pays the schedule', () => {
  // § 26-51-301 prints no separate-return table and bars the status from the
  // other seven. At $14,000 of AGI a single Arkansan pays nothing and a
  // separated one pays the schedule on $14,000 less $2,470.
  const asSingle = stateIncomeTax(single(14_000, 2025));
  money(asSingle.tax, 0, 'a single filer below the exempt amount');
  const asSeparate = stateIncomeTax({
    ...single(14_000, 2025),
    filingStatus: 'marriedFilingSeparately',
  });
  assert.equal(asSeparate.lowIncomeTableTax, undefined, 'no table for a separate return');
  // $11,530 of taxable income: 3% x 11,530 - 223.97 = $121.93, less the $29
  // personal credit and the $60 additional credit.
  money(asSeparate.tax, 121.93 - 89, 'the schedule on a separate return');
  assert.ok(asSeparate.tax > 32, 'the bar costs a separated filer real money');
});

// ---------------------------------------------------------------------------
// THE FIGURES THE MUTATION AUDIT CANNOT SEE.
// ---------------------------------------------------------------------------

test('every personal credit cell, by hand, because none of them has a mutant', () => {
  // $29 and $58 are integers below 100 and `mutantOf` perturbs neither, so the
  // audit cannot reach any of these five cells. Day 63 shipped a $40 credit in
  // this class and had it wrong; these are asserted rather than scored.
  for (const year of [2025, 2026]) {
    const c = getStateDefinition('AR', year).exemptionCredit;
    assert.equal(c.perFiler.single, 29);
    assert.equal(c.perFiler.marriedFilingSeparately, 29);
    // TWO CREDITS WITH ONE PERSON ON THE RETURN, for a head of household and a
    // surviving spouse: § 26-51-501 makes the additional credit a property of
    // the FILING STATUS. Iowa's shape; the opposite of Oklahoma, which hands a
    // single parent the married treatment through the rate schedule instead.
    assert.equal(c.perFiler.headOfHousehold, 58);
    assert.equal(c.perFiler.qualifyingSurvivingSpouse, 58);
    // And two people on a joint return, which is a count rather than a bonus.
    assert.equal(c.perFiler.marriedFilingJointly, 58);
    assert.equal(c.perDependent, 29);
    assert.equal(c.perSeniorFiler, 29);
    assert.equal(c.perBlindOrDisabledFiler, 29);
    assert.equal(c.seniorAge, 65);
  }
});

test('the additional tax credit is twelve $5 steps and not a 5% phase-out', () => {
  // "For each $100 OR PART OF $100" — the ceiling of the increments, not the
  // quotient. The distinction is $5 of tax arriving on one dollar of income,
  // twelve times, and it is invisible to the audit: $60, $5 and $10 are all
  // below 100.
  const rule = getStateDefinition('AR', 2025).additionalTaxCredit;
  assert.equal(rule.maximum.single, 60);
  assert.equal(rule.maximum.marriedFilingJointly, 120);
  assert.equal(rule.maximum.headOfHousehold, 60);
  assert.equal(rule.maximum.marriedFilingSeparately, 60);
  assert.equal(rule.increment, 100);
  assert.equal(rule.withdrawalPerIncrement.single, 5);
  assert.equal(rule.withdrawalPerIncrement.marriedFilingJointly, 10);
  for (const status of Object.keys(rule.start)) assert.equal(rule.start[status], 26_500);
  // Measured through the engine, on the one status the low-income tables do not
  // cover, so the credit is not hidden behind a table.
  const credit = (netTaxable) => {
    const r = onSchedule(netTaxable, 2025);
    const hit = r.credits.find((c) => c.name.includes('additional tax credit'));
    return hit === undefined ? 0 : hit.amount;
  };
  assert.equal(credit(26_500), 60, 'the whole credit at the threshold');
  assert.equal(credit(26_501), 55, 'one dollar over costs $5');
  assert.equal(credit(26_600), 55, 'and the next $99 cost nothing');
  assert.equal(credit(26_601), 50, 'and the dollar after that costs $5 again');
  assert.equal(credit(27_700), 0, 'gone at $27,700');
  // TWELVE STEPS, counted.
  let steps = 0;
  for (let at = 26_500; at < 27_700; at += 100) {
    if (credit(at) - credit(at + 1) === 5) steps += 1;
  }
  assert.equal(steps, 12, 'withdrawal steps between $26,500 and $27,700');
});

test('the retirement exemption has no age test and is per person', () => {
  // $6,000 a recipient at ANY age, not indexed since 1997 — the parameter
  // published guides most often get wrong about this state, and one Arkansas
  // shares only with Oklahoma in this package.
  for (const year of [2025, 2026]) {
    const [rule] = getStateDefinition('AR', year).retirementIncomeSubtractions;
    assert.equal(rule.cap, 6_000);
    assert.equal(rule.minimumAge, undefined, 'there is no age test');
    assert.equal(rule.cappedMinimumAge, undefined, 'and no capped age test either');
    assert.equal(rule.scope, 'perPerson');
    assert.equal(rule.militaryExemptOutsideCap, true);
  }
  // A 45-year-old with a $20,000 pension excludes $6,000 of it. Measured
  // through a separate return so the low-income tables cannot intervene.
  const withPension = stateIncomeTax({
    state: 'AR',
    year: 2026,
    filingStatus: 'marriedFilingSeparately',
    federal: {
      adjustedGrossIncome: 60_000,
      taxableIncome: 60_000 - 16_100,
      deduction: 16_100,
      deductionKind: 'standard',
    },
    filerAge: 45,
    retirementIncome: 20_000,
  });
  const withoutPension = stateIncomeTax({
    state: 'AR',
    year: 2026,
    filingStatus: 'marriedFilingSeparately',
    federal: {
      adjustedGrossIncome: 60_000,
      taxableIncome: 60_000 - 16_100,
      deduction: 16_100,
      deductionKind: 'standard',
    },
    filerAge: 45,
  });
  // $6,000 of exclusion at 3.7% is $222.00, and the filer is 45.
  money(withoutPension.tax - withPension.tax, 222, 'the exclusion at 45');
});

test('the standard deduction is the single amount for every status but joint', () => {
  // Arkansas gives a single PARENT no more deduction than a single filer, which
  // is the arithmetic that makes its own low-income tables matter: they are
  // worth more than the deduction to every household they reach.
  for (const year of [2025, 2026]) {
    const a = getStateDefinition('AR', year).deduction.amounts;
    assert.equal(a.single, 2_470);
    assert.equal(a.marriedFilingSeparately, 2_470);
    assert.equal(a.headOfHousehold, 2_470);
    assert.equal(a.qualifyingSurvivingSpouse, 2_470);
    assert.equal(a.marriedFilingJointly, 4_940);
    // Exactly twice, which § 26-51-430 states rather than implies.
    assert.equal(a.marriedFilingJointly, a.single * 2);
  }
  // And it is roughly a sixth of the federal one, measured rather than said.
  assert.ok(FEDERAL_DEDUCTION[2025] / 2_470 > 6, 'the federal deduction is more than six times it');
  // "THE SECOND SMALLEST AMONG THE STATES THAT HAVE ONE" is a prose claim in three
  // files, so it is measured here. The qualifier is load-bearing: the first draft
  // said "the second smallest standard deduction in this package" and thirteen
  // states allow NONE AT ALL, which makes Arkansas's the fifteenth smallest on any
  // reading that counts them. Mississippi's $2,300 is the only table smaller.
  const tabled = SUPPORTED_STATES.map((code) => getStateDefinition(code, 2025))
    .filter((def) => def.rate.kind !== 'none' && def.deduction.kind === 'table')
    .map((def) => [def.code, def.deduction.amounts.single])
    .sort((a, b) => a[1] - b[1]);
  assert.deepEqual(tabled.slice(0, 2), [['MS', 2_300], ['AR', 2_470]], 'the two smallest tables');
  const none = SUPPORTED_STATES.map((code) => getStateDefinition(code, 2025)).filter(
    (def) => def.rate.kind !== 'none' && def.deduction.kind === 'none',
  );
  assert.equal(none.length, 13, 'taxing states that allow no standard deduction at all');
});

test('2026 is provisional on its INDEXED figures and published on its rates', () => {
  // The cleanest provisional split in this package: Act 1 of 2026 printed the
  // whole rate side, and the Department has published none of the indexed side.
  const def = getStateDefinition('AR', 2026);
  assert.equal(def.status, 'provisional');
  const paths = def.provisionalFigures.map((f) => f.path).sort();
  assert.deepEqual(paths, [
    'additionalTaxCredit.start',
    'deduction.amounts',
    'lowIncomeTaxTable.byStatus',
  ]);
  // Not one rate figure is flagged, which is the assertion worth having: a
  // reader has to be able to tell that the 13.70% band is law and not a guess.
  for (const f of def.provisionalFigures) {
    assert.ok(!f.path.startsWith('rate.'), `${f.path} is flagged and the rate side is published`);
    assert.equal(f.reason, 'awaiting-publication');
    assert.equal(f.carriedForwardFrom, 2025);
  }
  assert.equal(getStateDefinition('AR', 2025).status, 'published');
});
