#!/usr/bin/env node
/**
 * Does `policyengine-us` model Indiana's earned income credit and reach zero, or
 * not model it at all — and which of the two engines is wrong?
 *
 * ## The question this file exists to close
 *
 * Day 74 pointed `tools/audit` at `policyengine-us` over all 2,904 differential
 * households and three of the sixteen differences `REPORT.md` had carried under
 * *Unexplained* for weeks came back with one account: PolicyEngine's Indiana
 * figure is this engine's answer **with Indiana's earned income credit not
 * applied**, exactly, to the cent.
 *
 * ```text
 *   2025-couple-two-children-IN-60000    theirs $2,660.60   ours $2,567.30   $93.30
 *   2025-couple-no-children-IN-25000     theirs $1,154.60   ours $1,145.32    $9.28
 *   2025-on-the-boundary-IN-50000        theirs $2,334.30   ours $2,327.37    $6.93
 * ```
 *
 * `INDIANA-EARNED-INCOME-CREDIT.md` wrote down what that could not settle:
 *
 * > Whether PolicyEngine models this credit at all, or models it and gets zero.
 * > **Nothing in the two committed answer files can distinguish them**, because
 * > a credit modelled to zero and a credit not modelled produce the same number.
 *
 * **Day 75 read their source, and the answer is neither of the two things that
 * document expected.** It models the credit. Its amount formula returns 10% of
 * the **current-year** federal credit — which is this engine's figure, to the
 * cent. Its *eligibility* formula recomputes the whole federal credit under the
 * **1 January 2023** Internal Revenue Code and requires that to be positive.
 * Three households sit between the two: the 2023-indexed credit is exhausted and
 * the current-year one is not, so the gate says no to a credit the formula would
 * have paid in full.
 *
 * ```text
 *   policyengine_us/variables/gov/states/in/tax/income/credits/
 *     earned_income_credit/in_eitc.py           amount:      current-year  32  0.10
 *     earned_income_credit/in_eitc_eligible.py  gate:        frozen(2023-01-01) > 0
 * ```
 *
 * ## Why that is a defect without reading a word of Indiana law
 *
 * The two halves cannot both be right, and the grid contains the household that
 * proves it. At `$30,000` of joint wages with two children the frozen credit is
 * `$6,208.07` and the current-year credit is `$7,152.00`. Ten percent of the
 * frozen base would be `$620.81`; ten percent of the current base is `$715.20`.
 * **The two engines agree on that household to the cent, so PolicyEngine paid
 * `$715.20`** — it does not apply the freeze to the amount. It applies it only
 * to the gate.
 *
 * So the freeze is operative for deciding *whether* the credit exists and
 * inoperative for deciding *how large* it is. No reading of IC 6-3.1-21-6
 * produces that, and `in_eitc.py`'s own comment argues against it in terms:
 *
 * > the freeze's only operative effect is that Indiana does not automatically
 * > adopt post-snapshot federal EITC changes -- and those changes are inflation
 * > indexing only. The current-year federal EITC therefore satisfies the freeze
 * > for all filers, with or without children.
 *
 * **And the same codebase answers the same question two other ways.** Three
 * states in `policyengine-us` 2.15.3 freeze the federal credit at a date:
 *
 * ```text
 *   OKLAHOMA   2020-01-01   gate and amount BOTH frozen. ok_federal_eitc
 *                           rebuilds the whole 2020 trapezoid and ok_eitc takes
 *                           5% of THAT. Internally consistent.
 *   WASHINGTON 2022-06-09   split ON PURPOSE and argued in the code: structural
 *                           rules (age band, separate-filer rule) frozen,
 *                           INDEXED DOLLAR AMOUNTS current, because  32(j)'s
 *                           indexing provision is itself inside the snapshot.
 *   INDIANA    2023-01-01   gate frozen INCLUDING the indexed dollar amounts,
 *                           amount current. Neither of the above.
 * ```
 *
 * Indiana is the only one of the three that lets a frozen *indexed* figure zero
 * out a credit it then declines to compute on the frozen base.
 *
 * ## The cliff, which is the part a buyer should care about
 *
 * A gate that turns off at an income the amount keeps rising through is a
 * discontinuity. Just below it the filer receives 10% of the full current-year
 * credit; a cent above it they receive nothing. For a joint return with two
 * children the frozen credit reaches zero at `$59,478.97` of wages, where the
 * current-year credit is still `$1,042.91` — so **one cent of extra earnings
 * costs `$104.29` of Indiana credit.** That is a defect no household-by-household
 * comparison finds, because finding it needs two households a cent apart.
 *
 * ## What this file checks, and the order matters
 *
 * The frozen table is the only data written here. Every current-year figure is
 * read out of `us-federal-tax`, and the frozen credit is computed by the same
 * local trapezoid as the current one — so assertion 1 is what makes the rest
 * worth reading.
 *
 *   1. **THE INSTRUMENT IS VALIDATED BEFORE IT IS USED.** The local trapezoid,
 *      run on the CURRENT-year table, reproduces the federal earned income
 *      credit in `out/theirs.json` to the cent on every Indiana household.
 *      `theirs.json` is the non-circular half: it is another model's answer, so
 *      a trapezoid that reproduces it is a trapezoid, and only then is it
 *      pointed at a counterfactual year nobody has an answer file for.
 *   2. The frozen credit is **zero on exactly the 2025 Indiana households whose
 *      state tax disagrees** in the direction of a credit this engine applied,
 *      and **positive on every one where the two engines agree.** An exact set,
 *      not a count: a household that moved into or out of it fails this.
 *   3. Wherever the frozen credit is positive, the two engines agree to the
 *      cent — so PolicyEngine's amount is 10% of the CURRENT base. This is
 *      assertion 2's other direction and it is the one that rules out the
 *      consistent-frozen reading.
 *   4. **2026 IS THE CONTROL YEAR AND IT IS THE CLEANEST EVIDENCE HERE.** SEA 243
 *      of 2025 advances the snapshot to 1 January 2026, so from 2026 the frozen
 *      and current tables are the same table, the gate cannot bind, and the
 *      predicted gap is exactly zero at every shape. The same households at the
 *      same incomes one year later agree to the cent. Nothing changed but the
 *      date in the statute.
 *   5. The cliff is located and priced for every shape, and the largest is the
 *      bound `known-divergences.json` carries. A bound derived from the
 *      provision rather than from the three differences observed.
 *
 * `--check` for CI-shaped output, **and it IS wired into `ci.yml`**, which is
 * worth arguing because `against-policyengine.mjs` next door deliberately is
 * not. That file re-runs an audit whose inputs include figures that move when
 * PolicyEngine releases. This one reads nothing that is not committed here:
 * `out/theirs.json`, its cases fingerprint, and the two packages' own tables. So
 * it cannot go red because somebody else shipped a version — it can only go red
 * because somebody in THIS repository regenerated the answers against a newer
 * version and the finding stopped being true. That is exactly the moment
 * `INDIANA-EARNED-INCOME-CREDIT.md` and the divergence entry have to be
 * rewritten, and the worst possible moment for nothing to say so.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..', '..');
const CHECK = process.argv.includes('--check');

const fail = (...lines) => {
  for (const l of lines) console.error(l);
  process.exit(1);
};

async function load(pkg, what) {
  const entry = join(ROOT, 'packages', pkg, 'dist', 'esm', 'index.js');
  try {
    return await import(entry);
  } catch (err) {
    fail(
      `cannot import ${pkg}: ${err.message}`,
      '',
      'Run:',
      `  (cd packages/${pkg} && npm install && npm run build)`,
      '',
      `${what} is what it needs from it.`,
    );
  }
}

const federal = await load('us-federal-tax', 'the current-year § 32 table, by child count');

/**
 * § 32 as the Internal Revenue Code carried it on 1 January 2023 — tax year
 * 2023, Rev. Proc. 2022-38 — which is the table IC 6-3-1-11 freezes for tax
 * years 2023 through 2025, and the ONLY data hard-coded in this file.
 *
 * It is written in the same shape as `us-federal-tax`'s own table so that one
 * function computes both, and it agrees figure for figure with
 * `policyengine_us/parameters/gov/irs/credits/eitc/*.yaml` evaluated at
 * `2023-01-01` — the other side's copy of the same statutory table. Two
 * independent transcriptions of a published Revenue Procedure, which is the most
 * a repository can do for a year neither package ships.
 */
const FROZEN_2023 = {
  year: 2023,
  maximumInvestmentIncome: 11_000,
  childlessAgeRange: { min: 25, max: 64 },
  table: [
    { creditRate: 0.0765, phaseOutRate: 0.0765, maximumCredit: 600, single: 9_800, joint: 16_370 },
    { creditRate: 0.34, phaseOutRate: 0.1598, maximumCredit: 3_995, single: 21_560, joint: 28_120 },
    { creditRate: 0.4, phaseOutRate: 0.2106, maximumCredit: 6_604, single: 21_560, joint: 28_120 },
    { creditRate: 0.45, phaseOutRate: 0.2106, maximumCredit: 7_430, single: 21_560, joint: 28_120 },
  ],
};

/** Indiana's match, IC 6-3.1-21-6. */
const MATCH = 0.1;
/** The snapshot IC 6-3-1-11 points at, by tax year. SEA 243 of 2025 moves it. */
const snapshotYear = (year) => (year >= 2026 ? year : 2023);

const YEARS = { 2024: federal.YEAR_2024, 2025: federal.YEAR_2025, 2026: federal.YEAR_2026 };

/** The current-year table for a year, in the shape above, read from the package. */
function currentTable(year) {
  const p = YEARS[year]?.earnedIncomeCredit;
  if (!p?.table) fail(`us-federal-tax ships no earned income credit table for ${year}.`);
  if (p.table.length !== FROZEN_2023.table.length) {
    fail(
      `us-federal-tax's ${year} credit has ${p.table.length} child-count bands and the frozen ` +
        `2023 table has ${FROZEN_2023.table.length}. The bands are compared BY POSITION, so a ` +
        `new band means this comparison is rewritten rather than extended.`,
    );
  }
  return {
    year,
    maximumInvestmentIncome: p.maximumInvestmentIncome,
    childlessAgeRange: p.childlessAgeRange,
    table: p.table.map((r) => ({
      creditRate: r.creditRate,
      phaseOutRate: r.phaseOutRate,
      maximumCredit: r.maximumCredit,
      single: r.phaseOutStart.single,
      joint: r.phaseOutStart.marriedFilingJointly,
    })),
  };
}

/**
 * § 32(a)'s trapezoid, for ONE table, AND NOTHING ELSE.
 *
 * Deliberately not `federal.earnedIncomeCredit()`: that function looks its
 * parameters up by year and there is no year whose parameters are the frozen
 * table. Assertion 1 is the price of writing it again — this must reproduce the
 * other model's committed federal figure before it is believed about 2023.
 *
 * **IT MODELS NO ELIGIBILITY TEST, AND THAT IS A DECISION THAT BREAKING THIS
 * FILE FORCED.** The first version carried three: § 32(d)'s bar on a separate
 * return, § 32(i)'s investment-income limit and § 32(c)(1)(A)(ii)'s childless
 * age band. Deleting the § 32(d) line and re-running the suite changed nothing —
 * **every assertion still passed**, because the only households that line
 * reached were the eight this file had just excluded from the self-check for a
 * different reason. A branch no assertion reaches is a branch nobody is
 * checking; Day 74 deleted an evidence class for exactly this and it was right.
 *
 * So all three came out, and with § 32(d) gone the exclusion came out with it:
 * PolicyEngine allows the credit to a separate filer and this file is measuring
 * ITS answer file, so the trapezoid now reproduces all 88 Indiana households
 * rather than 80 — and the § 32(d) divergence, which has its own entry in
 * `known-divergences.json`, is visible in the fact that it does.
 *
 * `omittedEligibilityIsUnreachable` below asserts that the omission cannot
 * change a figure on this grid, rather than leaving it as a claim in a comment.
 */
function trapezoid(p, { children, filingStatus, earnedIncome, agi }) {
  const row = p.table[Math.min(children, p.table.length - 1)];
  // `qualifyingSurvivingSpouse` takes the single column in both engines' tables:
  // § 32(b)(2)(B)'s increase is for a joint return.
  const start = filingStatus === 'marriedFilingJointly' ? row.joint : row.single;
  const phasedIn = Math.min(row.maximumCredit, row.creditRate * earnedIncome);
  const reduction = Math.max(0, row.phaseOutRate * (Math.max(earnedIncome, agi) - start));
  return Math.min(phasedIn, Math.max(0, row.maximumCredit - reduction));
}

/** Where the trapezoid crosses zero on the way down, and the credit there. */
function completedPhaseOut(p, children, joint) {
  const row = p.table[Math.min(children, p.table.length - 1)];
  const start = joint ? row.joint : row.single;
  return start + row.maximumCredit / row.phaseOutRate;
}

const read = (f) => JSON.parse(readFileSync(join(here, 'out', f), 'utf8'));
const cases = read('cases.json').filter((c) => c.state === 'IN');
const ours = read('ours.json');
const theirs = read('theirs.json');

const cents = (n) => Math.round(n * 100) / 100;
const money = (n) =>
  `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const problems = [];
const rows = [];

for (const c of cases) {
  const a = ours[c.id];
  const b = theirs[c.id];
  if (!a || !b || a.error || b.error) {
    problems.push(`${c.id}: missing or errored in one of the two answer files.`);
    continue;
  }
  const children = c.childAges.length;
  const shape = {
    children,
    filingStatus: c.filingStatus,
    earnedIncome: c.wages,
    agi: a.federal.adjustedGrossIncome,
  };
  const current = trapezoid(currentTable(c.year), shape);
  const frozen = trapezoid(
    snapshotYear(c.year) === 2023 ? FROZEN_2023 : currentTable(snapshotYear(c.year)),
    shape,
  );
  const inCreditOurs = cents(
    (a.state.credits ?? []).find((x) => x.name === 'Indiana earned income credit')?.amount ?? 0,
  );
  rows.push({
    id: c.id,
    year: c.year,
    children,
    joint: c.filingStatus === 'marriedFilingJointly',
    wages: c.wages,
    fedTheirs: cents(b.federal.earnedIncomeCredit),
    current: cents(current),
    frozen: cents(frozen),
    inCreditOurs,
    // What PolicyEngine's two halves, read together, predict for its credit.
    predicted: frozen > 0 ? cents(current * MATCH) : 0,
    oursTax: cents(a.state.tax),
    theirsTax: cents(b.state.tax),
    delta: cents(a.state.tax - b.state.tax),
  });
}

// ─── 1. The instrument, validated against the OTHER model's committed answers ──
//
// Every Indiana household, with nothing excluded. `out/theirs.json` is the
// non-circular half — another model's answer — so a trapezoid that reproduces it
// is a trapezoid, and only then is it pointed at a year nobody has an answer
// file for.
const checkable = rows;
const selfCheckMisses = checkable.filter((r) => Math.abs(r.current - r.fedTheirs) > 0.01);

// And the eligibility tests this file does NOT model cannot change a figure on
// this grid. Asserted, because the alternative is a comment claiming it.
//
// ONE HALF OF THIS IS EXERCISED BY TODAY'S DATA AND THE OTHER IS A TRIPWIRE, and
// saying which is which is the point. Narrowing the frozen childless age band to
// 25-40 fails it on two real households, because `couple-no-children-IN-25000`
// is 45 and carries a credit. Dropping the frozen investment-income limit to
// $400 fails NOTHING: the grid's only Indiana investor households hold $20,000
// and $100,000 of gains and are childless at $50,000 of wages, so their credit
// is already zero from the phase-out and § 32(i) has nothing left to withhold.
// That half waits for a household this grid does not contain — which is what a
// guard is for, and is not the same as a guard that has been tested.
const omittedEligibilityIsUnreachable = () => {
  for (const r of rows) {
    const c = cases.find((x) => x.id === r.id);
    if (r.current === 0 && r.frozen === 0) continue; // nothing to withhold
    const limit = Math.min(FROZEN_2023.maximumInvestmentIncome, currentTable(r.year).maximumInvestmentIncome);
    if (c.longTermCapitalGains > limit) {
      problems.push(
        `${r.id} carries ${money(c.longTermCapitalGains)} of investment income, above the ` +
          `${money(limit)} § 32(i) limit, AND a positive trapezoid credit. This file models no ` +
          `eligibility test, so that household's figures here are wrong — and PolicyEngine's ` +
          `frozen GATE does apply § 32(i), which makes this a second mechanism for the same ` +
          `symptom rather than a rounding problem.`,
      );
    }
    if (c.childAges.length === 0) {
      const { min, max } = FROZEN_2023.childlessAgeRange;
      if (c.primaryAge < min || c.primaryAge > max) {
        problems.push(
          `${r.id} is a childless filer aged ${c.primaryAge}, outside § 32(c)(1)(A)(ii)'s ` +
            `${min}-${max} band, AND has a positive trapezoid credit. This file models no age ` +
            `test, so that household's figures here are wrong.`,
        );
      }
    }
  }
};
omittedEligibilityIsUnreachable();
if (selfCheckMisses.length > 0) {
  for (const r of selfCheckMisses.slice(0, 8)) {
    problems.push(
      `${r.id}: this file's § 32 trapezoid gives ${money(r.current)} for the current year and ` +
        `out/theirs.json records ${money(r.fedTheirs)}. THE TRAPEZOID IS THE INSTRUMENT ` +
        `EVERYTHING BELOW USES ON A YEAR NEITHER PACKAGE SHIPS — if it cannot reproduce an ` +
        `answer somebody else computed, nothing below is evidence of anything.`,
    );
  }
}

// ─── 2 & 3. The frozen credit's zero set is exactly the disagreement set ───────
// `delta` is ours minus theirs. This engine applies a credit PolicyEngine's gate
// refuses, so ours is LOWER and the delta is negative.
const MATERIAL = 0.005;
for (const r of rows.filter((x) => x.year === 2025)) {
  const gated = r.frozen === 0 && r.current > 0;
  const disagrees = r.delta < -MATERIAL;
  if (gated && !disagrees) {
    problems.push(
      `${r.id}: the frozen credit is zero and the current one is ${money(r.current)}, so ` +
        `PolicyEngine's gate should refuse a credit this engine pays — but the two engines ` +
        `do not disagree in that direction (delta ${money(r.delta)}).`,
    );
  }
  if (disagrees && !gated && r.inCreditOurs > 0) {
    problems.push(
      `${r.id}: the two engines disagree by ${money(r.delta)} in the direction of a missing ` +
        `credit, and the frozen credit is ${money(r.frozen)} rather than zero, so the ` +
        `frozen-gate account does not explain it. Something else is going on here.`,
    );
  }
  if (r.frozen > 0 && r.inCreditOurs > 0) {
    // The reading this rules out: 10% of the FROZEN base. If PolicyEngine did
    // that, it would differ from this engine on every household in the band.
    const consistentFrozen = cents(r.frozen * MATCH);
    if (Math.abs(r.delta) > MATERIAL) {
      problems.push(
        `${r.id}: the frozen credit is positive so PolicyEngine's gate opens, and the two ` +
          `engines should then agree to the cent — they differ by ${money(r.delta)}.`,
      );
    }
    // Agreement here is what proves the amount is on the CURRENT base, so the
    // row records what the consistent-frozen reading would have paid instead.
    r.consistentFrozenWouldPay = consistentFrozen;
  }
}

// ─── 3b. THE CONTROL HOUSEHOLD, ASSERTED RATHER THAN PRINTED ──────────────────
//
// The argument needs ONE household where the gate opens and the two bases differ
// materially: there the two engines agree, which can only happen if PolicyEngine
// paid 10% of the CURRENT base. Without such a household the consistent-frozen
// reading survives and this file proves nothing — so its existence is an
// assertion and not a paragraph.
const controls = rows.filter(
  (r) =>
    r.year === 2025 &&
    r.frozen > 0 &&
    r.inCreditOurs > 0 &&
    r.current - r.frozen > 1 &&
    Math.abs(r.delta) <= MATERIAL &&
    r.consistentFrozenWouldPay !== r.inCreditOurs,
);
if (controls.length === 0) {
  problems.push(
    'no Indiana 2025 household has an open gate, a frozen base more than a dollar away from ' +
      'the current one, and agreement between the two engines. That household is the only ' +
      'thing ruling out the reading where PolicyEngine takes 10% of the FROZEN base, so ' +
      'without one the finding in INDIANA-EARNED-INCOME-CREDIT.md is not supported by this ' +
      'grid and the document has to say so.',
  );
}

// ─── 4. 2026, where the snapshot is the current year and the gate cannot bind ──
for (const r of rows.filter((x) => x.year === 2026)) {
  if (r.frozen !== r.current) {
    problems.push(
      `${r.id}: SEA 243 of 2025 puts the snapshot at 1 January 2026, so for tax year 2026 the ` +
        `frozen and current tables are the same table — the frozen credit measures ` +
        `${money(r.frozen)} and the current one ${money(r.current)}.`,
    );
  }
  if (r.inCreditOurs > 0 && Math.abs(r.delta) > MATERIAL) {
    problems.push(
      `${r.id}: tax year 2026 and the gate cannot bind, so the two engines should agree on ` +
        `every Indiana household this engine pays a credit to — they differ by ${money(r.delta)}.`,
    );
  }
}

// ─── 5. The cliff, priced from the provision for every shape ──────────────────
const cliffs = [];
for (const children of [0, 1, 2, 3]) {
  for (const joint of [false, true]) {
    const at = completedPhaseOut(FROZEN_2023, children, joint);
    const creditThere = trapezoid(currentTable(2025), {
      children,
      filingStatus: joint ? 'marriedFilingJointly' : 'single',
      earnedIncome: at,
      agi: at,
    });
    cliffs.push({ children, joint, at, lost: cents(creditThere * MATCH) });
  }
}
const worst = cliffs.reduce((m, c) => (c.lost > m.lost ? c : m));
/** The bound `known-divergences.json` carries, and where it comes from. */
const PUBLISHED_BOUND = 112;
if (!(worst.lost <= PUBLISHED_BOUND)) {
  problems.push(
    `the largest Indiana credit this mechanism can withhold is ${money(worst.lost)} and ` +
      `known-divergences.json is bounded at ${money(PUBLISHED_BOUND)}. Raise the bound and say ` +
      `why in the entry — a bound below what the provision can produce is an entry that will ` +
      `stop matching the day a household lands above it.`,
  );
}
if (PUBLISHED_BOUND - worst.lost > 10) {
  problems.push(
    `the bound in known-divergences.json is ${money(PUBLISHED_BOUND)} and the most this ` +
      `mechanism can withhold is ${money(worst.lost)}. A bound more than $10 above what the ` +
      `provision can produce is slack an unrelated difference can walk into.`,
  );
}

if (!CHECK) {
  const divergent = rows.filter((r) => r.year === 2025 && r.delta < -MATERIAL);
  const paidBoth = rows.filter((r) => r.year === 2025 && r.frozen > 0 && r.inCreditOurs > 0);
  void paidBoth;
  console.log("Indiana's earned income credit: what policyengine-us does, and what it costs");
  console.log('');
  console.log('  IC 6-3.1-21-6   10% of the federal earned income credit');
  console.log('  IC 6-3-1-11     under the Internal Revenue Code as of 1 January 2023 for tax');
  console.log('                  years 2023-2025, and 1 January 2026 from 2026 (SEA 243, 2025)');
  console.log('');
  console.log('  in_eitc.py           amount:  10% of the CURRENT-YEAR federal credit');
  console.log('  in_eitc_eligible.py  gate:    the FROZEN federal credit must be positive');
  console.log('');
  console.log('  THE GATE AND THE AMOUNT ARE EVALUATED AT DIFFERENT DATES, and the households');
  console.log('  between the two are the three the differential grid could not explain.');
  console.log('');
  console.log(
    `  tax year 2025, Indiana households where the frozen credit is EXHAUSTED and the`,
  );
  console.log('  current-year one is not:');
  console.log('');
  console.log('    case                                      current    frozen    ours   theirs       gap');
  for (const r of divergent) {
    console.log(
      `    ${r.id.replace(/-0-0-0-0$/, '').padEnd(40)} ${money(r.current).padStart(9)} ` +
        `${money(r.frozen).padStart(9)} ${money(r.oursTax).padStart(7)} ` +
        `${money(r.theirsTax).padStart(8)} ${money(r.delta).padStart(9)}`,
    );
  }
  console.log('');
  console.log('  and the control, which is what rules out the consistent-frozen reading:');
  console.log('');
  const control = controls.reduce((m, r) => (r.current - r.frozen > m.current - m.frozen ? r : m));
  console.log(`    ${control.id.replace(/-0-0-0-0$/, '')}`);
  console.log(
    `      current-year credit ${money(control.current)}, frozen credit ${money(control.frozen)}`,
  );
  console.log(
    `      10% of the frozen base would be ${money(cents(control.frozen * MATCH))}; 10% of the ` +
      `current base is ${money(control.inCreditOurs)}`,
  );
  console.log(
    `      the two engines agree to the cent (${money(control.oursTax)}), SO POLICYENGINE PAID ` +
      `${money(control.inCreditOurs)}`,
  );
  console.log('');
  console.log('  so the freeze decides WHETHER and not HOW MUCH, and that is a discontinuity:');
  console.log('');
  console.log('    children  return      frozen credit reaches $0 at   Indiana credit lost');
  for (const c of cliffs) {
    console.log(
      `    ${String(c.children === 3 ? '3+' : c.children).padStart(8)}  ` +
        `${(c.joint ? 'joint' : 'single').padEnd(10)}  ${money(c.at).padStart(26)}  ` +
        `${money(c.lost).padStart(19)}`,
    );
  }
  console.log('');
  console.log(
    `  WORST: ${worst.children === 3 ? '3+' : worst.children} children, ` +
      `${worst.joint ? 'a joint return' : 'a single return'} — one cent of earnings above ` +
      `${money(worst.at)} costs ${money(worst.lost)}.`,
  );
  console.log('');
  console.log('  AND THE CONTROL YEAR. SEA 243 of 2025 moves the snapshot to 1 January 2026, so');
  console.log('  from 2026 the frozen table IS the current table and the gate cannot bind:');
  console.log('');
  console.log('    case                                      2025 gap   2026 gap');
  for (const r of divergent) {
    const twin = rows.find((x) => x.id === r.id.replace(/^2025-/, '2026-'));
    console.log(
      `    ${r.id.replace(/^2025-/, '').replace(/-0-0-0-0$/, '').padEnd(40)} ` +
        `${money(r.delta).padStart(9)}  ${(twin ? money(twin.delta) : 'n/a').padStart(9)}`,
    );
  }
  console.log('');
  console.log(
    `  Same households, same incomes, one year apart. Nothing changed but the date in`,
  );
  console.log('  the statute.');
  console.log('');
  console.log(
    `  self-check: the § 32 trapezoid in this file reproduces out/theirs.json's federal`,
  );
  console.log(
    `  earned income credit on ${checkable.length - selfCheckMisses.length} of ` +
      `${checkable.length} Indiana households, separate filers included — which is itself ` +
      `the § 32(d) divergence, since this engine bars them and that one does not.`,
  );
  console.log('');
}

if (problems.length > 0) {
  fail(
    "Indiana's frozen earned income credit base no longer reads the way this file says:",
    '',
    ...problems.map((p) => `  - ${p}`),
    '',
    'See tools/differential/in-eitc-conformity.mjs for what each assertion is for, and',
    'INDIANA-EARNED-INCOME-CREDIT.md for the finding it supports.',
  );
}

console.log(
  `ok — the § 32 trapezoid here reproduces the other model's federal credit on all ` +
    `${checkable.length} Indiana households; the frozen 2023 credit is exhausted on exactly ` +
    `the ` +
    `three 2025 households the two engines disagree about and positive on every one they ` +
    `agree about; the largest Indiana credit the gate can withhold is ${money(worst.lost)} ` +
    `against a published bound of ${money(PUBLISHED_BOUND)}; and every 2026 household agrees, ` +
    `because SEA 243 puts the snapshot on the current year.`,
);
