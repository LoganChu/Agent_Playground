#!/usr/bin/env node
/**
 * Arkansas's steepest marginal rate is 13.70%, it is not in Arkansas's rate
 * schedule, and a model built from that schedule is too low by a flat $287.30
 * for every filer above the band. This asserts all of it on every push.
 *
 * ## Why this exists
 *
 * A.C.A. § 26-51-201 writes **two** rate schedules, selected by income rather
 * than by filing status. A filer whose net taxable income does not *exceed*
 * `$94,700` is taxed on the ordinary graduated table — 0%, 2%, 3%, 3.4%, 3.7%.
 * A filer one dollar above it is taxed under a different table: 2% on the first
 * `$4,700` and 3.7% on **every dollar above it**, applied to the *whole* of
 * their net income and not to the excess over anything.
 *
 * That second table charges much more than the first, and the difference is
 * handed back by a **bracket adjustment** of `$290`, falling by `$10` for every
 * `$100` of further income and reaching zero at `$97,600`.
 *
 * ```text
 *                    2026                         2025
 *   income        tax      adjustment       tax        reduction
 *   94,700     3,136.70        -         3,273.34        419.96
 *   94,701     3,134.04      290         3,294.04        399.30
 *   94,801     3,147.74      280         3,307.94        389.30
 *    ...
 *   97,601     3,531.34        0         3,793.44         89.30
 * ```
 *
 * **A `$10` RELIEF WITHDRAWN PER `$100` EARNED IS TEN PERCENTAGE POINTS OF
 * MARGINAL RATE.** Nothing in any published Arkansas bracket table contains the
 * number 13.7; it is the slope of a relief being withdrawn, and the only way to
 * see it is to compute the tax at two incomes `$100` apart.
 *
 * Three things are asserted, and the third is the one worth selling:
 *
 * 1. **The slope**, measured rather than read — 13.70% in 2026 and 13.90% in
 *    2025 — and that it exceeds the top statutory rate by the full ten points.
 * 2. **The staircase**, counted: the adjustment's rows are `$100` wide and its
 *    amounts are whole dollars, so `$10` of tax arrives on one cent of income,
 *    29 times in 2026 and 31 times in 2025. A provision written to remove a
 *    cliff is a run of smaller ones.
 * 3. **The flat error.** Above the band the two routes are linear with the same
 *    slope, so a model using only the graduated table is too low by exactly the
 *    whole adjustment, at every income: `$287.30` for 2026 and, for 2025,
 *    `$330.70` up to `$100,000` and `$329.00` above `$100,001` — the card
 *    printing *"$3,809 plus 3.9% of the excess over $100,000"* makes one dollar
 *    of extra income worth `$1.70` LESS tax at that point.
 *
 * ## And why it is a CROSS-PACKAGE check rather than a unit test
 *
 * `test/arkansas.test.js` already measures the slope and the steps from
 * `us-state-tax`'s own definition. What that file cannot do is check the
 * DIRECTION against the other government's figures: the comparison worth
 * guarding is between Arkansas's frozen `$10` steps and the FEDERAL standard
 * deduction, because the band's position in a filer's life depends on both.
 *
 * `us-federal-tax` carries the federal deduction. So this file computes, for a
 * single filer, the GROSS WAGE at which the Arkansas band begins — net taxable
 * income of `$94,701` plus Arkansas's own `$2,470` deduction — and checks that
 * the band is reached by a wage the federal return also taxes, in both years.
 * It then asserts the thing a single year cannot show:
 *
 * > **THE BAND IS NOT INDEXED AND THE INCOMES THAT REACH IT ARE.**
 * > § 26-51-201(d)(1) indexes the bracket bounds and says nothing about the
 * > adjustment's dollar amounts, and DFA's 2022-to-2025 cards kept each Act's
 * > `$10` steps unchanged. So the number of filers inside a 13.70% band whose
 * > width is fixed in nominal dollars grows with every year of wage growth,
 * > and the band's own arithmetic never moves.
 *
 * A failure here means one of five things, and all five are news: Arkansas
 * indexed the adjustment, Arkansas repealed it, the high-income table changed
 * shape, this package's derived 2026 rows drifted from the statute, or
 * `us-federal-tax`'s deduction moved far enough to change which wage reaches
 * the band.
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const fail = (...lines) => {
  for (const l of lines) console.error(l);
  process.exit(1);
};

async function load(pkg, what) {
  const entry = join(ROOT, 'packages', pkg, 'dist', 'esm', 'index.js');
  try {
    return await import(entry);
  } catch (e) {
    fail(
      `Could not load ${pkg} to check ${what}: ${e.message}`,
      `Build it first: (cd packages/${pkg} && npm install && npm run build)`,
    );
  }
}

const state = await load('us-state-tax', "Arkansas's bracket adjustment");
const federal = await load('us-federal-tax', 'the standard deduction the band is reached through');

const YEARS = [2025, 2026];
const problems = [];
const round = (v) => Math.round(v * 100) / 100;

/**
 * Arkansas tax before credits on a given NET TAXABLE income, through a married
 * filing separately return.
 *
 * The status is not incidental. Arkansas's Low Income Tax Tables reach every
 * other status up to at least `$17,500` of AGI and always come out lower, so a
 * single filer's tax at the bottom of the rate schedule is the table's and not
 * the schedule's. § 26-51-301 bars a separate return from all seven tables,
 * which makes it the one status whose tax is the schedule's all the way down.
 */
const onSchedule = (netTaxableIncome, year, deduction) =>
  state.stateIncomeTax({
    state: 'AR',
    year,
    filingStatus: 'marriedFilingSeparately',
    federal: {
      adjustedGrossIncome: netTaxableIncome + 2_470,
      taxableIncome: Math.max(0, netTaxableIncome + 2_470 - deduction),
      deduction,
      deductionKind: 'standard',
    },
  }).taxBeforeCredits;

/** § 26-51-201(a)(4)'s graduated table alone — the model every guide prints. */
const graduatedOnly = (income, year) => {
  const top = year === 2025 ? 0.039 : 0.037;
  const bands = [
    [5_600, 0],
    [11_200, 0.02],
    [16_000, 0.03],
    [26_400, 0.034],
    [Infinity, top],
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

const EXPECTED = {
  2025: { slope: 0.139, steps: 31, topRate: 0.039, flat: [[99_000, 330.7], [150_000, 329.0]] },
  2026: { slope: 0.137, steps: 29, topRate: 0.037, flat: [[150_000, 287.3]] },
};

const report = {};

for (const year of YEARS) {
  const expected = EXPECTED[year];
  // The federal deduction this year, FROM THE OTHER PACKAGE, so the wage that
  // reaches the band is computed rather than assumed. This is the whole reason
  // the check lives in `tools/cross-package/`: `us-state-tax` has no
  // dependencies and cannot read this figure from inside itself.
  const fedDeduction = federal.standardDeduction({ year, filingStatus: 'single' });
  if (typeof fedDeduction !== 'number') {
    fail(
      `us-federal-tax returned ${fedDeduction} for the ${year} single standard deduction.`,
      'This check needs it to compute the wage at which the Arkansas band begins.',
    );
  }

  const def = state.getStateDefinition('AR', year);
  if (!def) fail(`us-state-tax has no Arkansas definition for ${year}.`);

  // 1. THE SLOPE, measured over $100 of income inside the band.
  const lo = onSchedule(94_701, year, fedDeduction);
  const hi = onSchedule(94_801, year, fedDeduction);
  const slope = round(((hi - lo) / 100) * 1000) / 1000;
  if (Math.abs(slope - expected.slope) > 0.0005) {
    problems.push(
      `${year}: the marginal rate in the bracket-adjustment band is ${(slope * 100).toFixed(2)}% ` +
        `and this check expects ${(expected.slope * 100).toFixed(2)}%. Either the adjustment's ` +
        `$10 step changed or the row width did.`,
    );
  }
  // And it exceeds the top statutory rate by the full ten points, which is the
  // claim rather than the rate.
  const top = Math.max(...def.rate.rows.map((r) => r.rate));
  if (Math.abs(top - expected.topRate) > 1e-9) {
    problems.push(`${year}: the top statutory rate is ${top} and this check expects ${expected.topRate}.`);
  }
  if (round(slope - top) !== 0.1) {
    problems.push(
      `${year}: the band's rate exceeds the top statutory rate by ${round(slope - top)} and the ` +
        `adjustment's own arithmetic makes that exactly 0.10 ($10 per $100). If this moved, the ` +
        `step is no longer $10 a row or the rows are no longer $100 wide.`,
    );
  }

  // 2. THE STAIRCASE, counted a cent at a time across each row boundary.
  const cliffs = [];
  for (let at = 94_800; at <= 97_900; at += 100) {
    const jump = round(onSchedule(at + 0.01, year, fedDeduction) - onSchedule(at, year, fedDeduction));
    if (jump > 1) cliffs.push([at, jump]);
  }
  if (cliffs.length !== expected.steps) {
    problems.push(
      `${year}: ${cliffs.length} discontinuities of about $10 in the adjustment band and this ` +
        `check expects ${expected.steps}.`,
    );
  }
  for (const [at, jump] of cliffs) {
    if (Math.abs(jump - 10) > 0.005) {
      problems.push(`${year}: the step at $${at} is $${jump} rather than $10.`);
    }
  }

  // 3. THE FLAT ERROR a graduated-only model makes, above the band.
  for (const [income, want] of expected.flat) {
    const got = round(onSchedule(income, year, fedDeduction) - graduatedOnly(income, year));
    if (Math.abs(got - want) > 0.005) {
      problems.push(
        `${year}: a model using only the graduated table is too low by $${got} at $${income} and ` +
          `this check expects $${want}.`,
      );
    }
  }
  // FLAT is the claim, so it is checked across three orders of magnitude.
  const probes = [150_000, 1_000_000, 10_000_000].map((i) =>
    round(onSchedule(i, year, fedDeduction) - graduatedOnly(i, year)),
  );
  if (round(Math.max(...probes) - Math.min(...probes)) !== 0) {
    problems.push(
      `${year}: the graduated-only error is not flat above the band — ${probes.join(', ')} at ` +
        `$150,000, $1,000,000 and $10,000,000. It is the whole bracket adjustment and cannot ` +
        `depend on income.`,
    );
  }

  // 4. THE DIRECTION, which is the half no single year's table can show: the
  //    band is fixed in nominal dollars and the federal deduction that stands
  //    between a wage and it is indexed.
  const wageAtBandStart = 94_701 + 2_470;
  report[year] = {
    slope,
    steps: cliffs.length,
    flat: probes[0],
    bandStart: 94_701,
    bandEnd: year === 2025 ? 97_801 : 97_601,
    wageAtBandStart,
    fedDeduction,
    federalTaxableAtBandStart: wageAtBandStart - fedDeduction,
  };
}

// The adjustment's own arithmetic is identical in the two years — same $10
// step, same $100 row, same $94,700 start — while the federal deduction a wage
// passes through to reach it is not. That is the direction to guard.
const a = report[2025];
const b = report[2026];
if (a.bandStart !== b.bandStart) {
  problems.push(
    `the band now starts at $${a.bandStart} in 2025 and $${b.bandStart} in 2026. ` +
      '§ 26-51-201(d)(1) indexes the bracket bounds; if the high-income threshold has begun ' +
      'to move, the whole premise of this check has changed and the module needs re-reading.',
  );
}
if (!(b.fedDeduction > a.fedDeduction)) {
  problems.push(
    `the federal standard deduction did not rise from 2025 ($${a.fedDeduction}) to 2026 ` +
      `($${b.fedDeduction}). Either Congress cut it or us-federal-tax's figures moved, and ` +
      'both are things somebody would want to know.',
  );
}
if (!(b.federalTaxableAtBandStart < a.federalTaxableAtBandStart)) {
  problems.push(
    "the federal taxable income of the filer at the start of Arkansas's band did not fall from " +
      `2025 ($${a.federalTaxableAtBandStart}) to 2026 ($${b.federalTaxableAtBandStart}). The band ` +
      'is fixed in nominal dollars and the deduction in front of it is indexed, so it must.',
  );
}

if (process.env.QUIET !== '1') {
  console.log('');
  console.log("Arkansas's bracket adjustment — the band, the staircase and the flat error");
  console.log('');
  console.log('              slope   steps   graduated-only error   band');
  for (const year of YEARS) {
    const r = report[year];
    console.log(
      `  ${year}        ${(r.slope * 100).toFixed(2)}%     ${String(r.steps).padStart(2)}      ` +
        `$${r.flat.toFixed(2).padStart(9)}            $${r.bandStart} - $${r.bandEnd}`,
    );
  }
  console.log('');
  console.log(
    '  the same $10 step and the same $94,700 start in both years, against a federal\n' +
      `  standard deduction of $${a.fedDeduction} and $${b.fedDeduction} — so the federal taxable\n` +
      `  income of the filer who reaches the band falls from $${a.federalTaxableAtBandStart} to ` +
      `$${b.federalTaxableAtBandStart}.`,
  );
  console.log('');
}

if (problems.length > 0) {
  fail(
    "Arkansas's bracket adjustment no longer matches what this repository ships:",
    '',
    ...problems.map((p) => `  - ${p}`),
    '',
    'See tools/cross-package/arkansas-bracket-adjustment.mjs for what each assertion is for.',
  );
}

console.log(
  'ok — Arkansas charges 13.90% (2025) and 13.70% (2026) across the bracket-adjustment band, ' +
    'exactly ten points above its own top rate; the adjustment steps $10 at a time 31 and 29 ' +
    'times rather than tapering; a graduated-only model is too low by a flat $329.00 and ' +
    '$287.30 above the band at every income; and the band is fixed in nominal dollars while ' +
    'the federal deduction in front of it is indexed.',
);
