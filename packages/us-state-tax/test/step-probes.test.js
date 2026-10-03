// Every step of every staircase this package ships, priced — and a proof that
// every number inside them is load-bearing.
//
// ## Why this file exists
//
// Day 34's status sweep took the state engine's mutation score from 85.8% to 96.3%
// and left 26 numbers the package could ship wrong with no test noticing. Ten of
// them — the only group that was straightforwardly untested rather than unreachable
// — were rows of a STAIRCASE:
//
//   Ohio        the retirement income credit's `$500`, `$3,000`, `$5,000` and
//               `$8,000` steps, and the `$130` the fourth of them pays
//   Maryland    the itemized-deduction limit's `$200,000` row
//   California  CalEITC's final phase-out start
//
// The sweep could not see them and neither could a bigger sweep, for a reason worth
// stating as a rule. **A battery of households is a ladder in ONE dimension of a
// return, and a staircase is a second ladder inside one rule.** Ohio's retirement
// credit steps between `$500` and `$8,000` of pension; the shared battery's rungs
// are `$3,000`, `$6,000`, `$12,000` and up, because they have to reach a
// millionaire as well. Making the battery catch this one credit means five more
// households in every state's run — and then five more for New York's household
// credit, and five more for New Jersey's child credit, until the battery is linear
// in the number of charts, which is exactly what Day 34 proved it did not have to
// be.
//
// **THE RULE: a chart of steps needs a probe inside each step, not a household for
// each step.** `step-charts.mjs` carries the argument for where the probes sit; the
// short version is that a probe belongs against a step's FLOOR, at `upTo[i-1] + 1`,
// because that is the only placement a doubled ceiling can reach.
//
// ## What the pins are evidence of, and what they are not
//
// Exactly what `bracket-pins.test.js` and `status-sweep.test.js` say of their own:
// they are a REGRESSION GUARD. Every expected figure was computed by this package,
// so Day 27's rule applies in full — a test written from the data can only confirm
// the data, and these pins cannot tell you Ohio's credit chart is right. The
// correctness evidence is elsewhere and is unaffected by this file: `ohio.test.js`
// and its siblings, each citing a statute, and `tools/differential`, which compares
// 779 households against an independently built model.
//
// What the pins CAN say is that no step moved without somebody saying so.
//
// ## The second test is the one that makes the first one honest
//
// The coverage proof below takes every number in every staircase the package ships,
// sets it wrong, and requires that a pinned answer — here or in the status sweep —
// moves. That is the mutation harness's question asked inside the suite, and it
// runs in a second where the harness takes half an hour.
//
// It is deliberately STRICTER than the harness in one way and it is the way that
// matters here. `tools/mutation/mutate.mjs` mutates integers at or above 100 and
// decimals inside (0, 1); a staircase is mostly small integers, so the harness
// never touches Ohio's `25`, `50` and `80`, New York's `$75` household credit or
// any `maxAge` in the package. Those are the numbers a staircase is MADE of. A
// coverage test that adopted the harness's filter here would report a clean sweep
// over the rows nobody was worried about.
//
// **THE RULE: a filter chosen to make two instruments agree is only honest where
// the two instruments are looking at the same thing.** The status sweep uses the
// harness's filter because its claim is about the harness's score. This file's
// claim is about staircases, so it perturbs every number in one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FILING_STATUSES,
  NO_INCOME_TAX_STATES,
  SUPPORTED_STATES,
  SUPPORTED_YEARS,
  applyBrackets,
  getStateDefinition,
  stateIncomeTax,
} from './strict.mjs';
import {
  DIGEST_COLUMNS,
  DRIVERS,
  digest,
  driverKey,
  driverStatuses,
  probeInput,
  probeValues,
  stepCharts,
} from './step-charts.mjs';
import { HOUSEHOLDS, digest as sweepDigest, household } from './status-households.mjs';

const PINS = JSON.parse(readFileSync(new URL('./step-probes.json', import.meta.url), 'utf8'));
const SWEEP = JSON.parse(readFileSync(new URL('./status-sweep.json', import.meta.url), 'utf8'));
const BRACKETS = JSON.parse(readFileSync(new URL('./bracket-pins.json', import.meta.url), 'utf8'));
const TAXING = SUPPORTED_STATES.filter((s) => !NO_INCOME_TAX_STATES.includes(s));

const parse = (row) => {
  const [year, state, chart, filingStatus, probe, ...figures] = row.split('|');
  return { year: Number(year), state, chart, filingStatus, probe: Number(probe), expected: figures.map(Number) };
};

/** Every staircase in the package, with its state and year. */
function* shippedCharts() {
  for (const year of SUPPORTED_YEARS) {
    for (const state of TAXING) {
      for (const chart of stepCharts(getStateDefinition(state, year))) {
        yield { year, state, ...chart };
      }
    }
  }
}

test('every pinned probe still answers what it answered', () => {
  assert.ok(PINS.rows.length > 100, 'the fixture is present and not truncated');
  assert.equal(PINS.columns.length, 5 + DIGEST_COLUMNS.length);
  for (const row of PINS.rows) {
    const { year, state, chart, filingStatus, probe, expected } = parse(row);
    const actual = digest(stateIncomeTax(probeInput(chart, probe, state, year, filingStatus)));
    assert.deepEqual(
      actual,
      expected,
      `${state} ${year} ${chart} ${filingStatus} at ${probe}: ${DIGEST_COLUMNS.join('/')} was ${expected.join('/')} and is now ${actual.join('/')}`,
    );
  }
});

test('the fixture has a probe inside every step of every staircase this file drives', () => {
  // The companion claim, and the one that keeps the file from going stale: a step
  // ADDED to a chart, or a chart added to a state, fails here rather than silently
  // narrowing the guard. Same rule `bracket-pins.test.js` applies to itself.
  const seen = new Map();
  for (const row of PINS.rows) {
    const { year, state, chart, filingStatus, probe } = parse(row);
    const key = `${year}|${state}|${chart}|${filingStatus}`;
    seen.set(key, (seen.get(key) ?? new Set()).add(probe));
  }
  let expected = 0;
  for (const { year, state, path, steps } of shippedCharts()) {
    if (DRIVERS[driverKey(path)] === undefined) continue;
    for (const filingStatus of driverStatuses(path)) {
      const key = `${year}|${state}|${path}|${filingStatus}`;
      const probes = seen.get(key);
      assert.ok(probes !== undefined, `${key} is shipped and not probed — regenerate the fixture`);
      for (const value of probeValues(steps)) {
        assert.ok(probes.has(value), `${key} has no probe at ${value} — regenerate the fixture`);
      }
      assert.equal(probes.size, probeValues(steps).length, `${key} has a probe for a step that no longer exists`);
      expected++;
    }
  }
  assert.equal(seen.size, expected, 'a pinned row names a chart, state, year or status that is no longer shipped');
});

// ---------------------------------------------------------------------------
// The coverage proof
// ---------------------------------------------------------------------------

/**
 * The staircases this file does not drive a probe for, each with the instrument
 * that does reach it.
 *
 * Every entry is still PERTURBED below against every pinned answer in the package,
 * so an entry here says which instrument owns a chart — not that the chart is
 * exempt from being covered. The only exemption from coverage is `UNREACHABLE`,
 * and it has to say why.
 *
 * The point of requiring an entry at all is that `stepCharts()` finds staircases by
 * SHAPE, so it finds more than this file probes, and it will find whatever is added
 * tomorrow. A chart that is neither driven here nor claimed here fails the test,
 * which is the only way a new one cannot arrive unnoticed.
 */
const COVERED_ELSEWHERE = {
  'rate.byStatus.<status>': 'bracket-pins.test.js — one probe $1,000 into every band',
  'rate.bands': 'ohio.test.js, and the status sweep across both sides of the $26,050 step',
  'surtax.brackets': 'massachusetts.test.js and california.test.js, and the sweep’s $1.4m household',
};

/**
 * Numbers inside a staircase that NO pinned answer can move, with the reason.
 *
 * Day 29's rule: an unreachable figure cannot be wrong, which is why nobody checks
 * reachability. Writing a probe for a row nothing reads would assert that something
 * matters when it does not — so an entry here is a claim that has to be defended,
 * and the test fails if one becomes reachable, because a stale exemption is how an
 * audit starts lying.
 */
const UNREACHABLE = {
  'CT|retirementSubtractionSchedule.schedule.<status>|0.from': {
    // The same arithmetic as Ohio's zero band below, arriving from the other
    // direction. The row says "from $0", meaning every filer under the
    // threshold subtracts 100% of their pension, and a doubling mutation turns
    // a zero into a one — so the only return whose answer could move is one
    // with under a dollar of federal AGI, which has no pension to subtract and
    // no tax to subtract it from.
    why: 'the first row of a floor-indexed chart begins at zero, and 2×0+1 is one dollar of federal AGI — below every filer the chart can reach',
    coveredBy: "connecticut.test.js — \"the pension schedule uses the OPPOSITE boundary convention\", which asserts the 100% row at $74,999 and the 85% row at $75,000",
  },
  'OH|jointFilingCredit.steps|0.amount': {
    why: 'the 20% row applies below $25,000 of modified AGI less exemptions, and an Ohio return with two earners under that figure owes no tax for a nonrefundable credit to take a share of — the journal records it as unreachable arithmetic',
    coveredBy: 'asserted directly below, as virginia-age-deduction.test.js asserts § 58.1-321',
  },
  'OH|rate.bands|0.base': {
    // The finding this instrument produced that the harness never could, because
    // the harness does not mutate a number below 100 and this one is zero.
    //
    // **THE RULE: a doubling mutation cannot perturb a ZERO by more than a dollar,
    // so a parameter whose correct value is zero is only testable where a dollar
    // survives to the bottom line.** Ohio's zero band is the case where it does not:
    // every Ohio return inside it carries at least the $20 exemption credit, which
    // is nonrefundable, so a base amount of $1 on the first $26,050 is absorbed
    // before it reaches an answer and every household in the package reports the
    // same figures either way.
    //
    // Which is worth stating plainly rather than filing as a limitation: the row
    // matters enormously — O.R.C. 5747.02(A)(3) charging nothing below $26,050 is
    // half of why Ohio's schedule is discontinuous — and a $1 error in it is
    // genuinely harmless. The two facts are not in tension. What is testable is the
    // band's WIDTH, and the probes reach that through `bands[0].upTo`.
    why: 'the zero band charges nothing, and 2×0+1 is one dollar, which the $20 nonrefundable exemption credit absorbs on every Ohio return inside the band',
    coveredBy: "ohio.test.js — the $342 step at $26,050.01, which is this row's other side",
  },
};

/** Every number in a staircase, as a path within it. */
function numbersIn(steps) {
  const out = [];
  steps.forEach((step, i) => {
    for (const [key, value] of Object.entries(step)) {
      if (typeof value === 'number' && Number.isFinite(value)) out.push({ at: `${i}.${key}`, value });
    }
  });
  return out;
}

const setAt = (steps, at, value) => {
  const [i, key] = at.split('.');
  steps[Number(i)][key] = value;
};

test('every number in every staircase moves a pinned answer', () => {
  // The probes and the sweep together, indexed by state-year: a staircase can only
  // move an answer in its own state, so perturbing Ohio never needs New York run.
  const pinned = new Map();
  const add = (key, id, figures) => {
    if (!pinned.has(key)) pinned.set(key, new Map());
    pinned.get(key).set(id, figures.join(','));
  };
  for (const row of PINS.rows) {
    const { year, state, chart, filingStatus, probe, expected } = parse(row);
    add(`${year}|${state}`, `probe|${chart}|${filingStatus}|${probe}`, expected);
  }
  for (const row of SWEEP.rows) {
    const [year, state, filingStatus, name, ...figures] = row.split('|');
    add(`${year}|${state}`, `sweep|${filingStatus}|${name}`, figures);
  }
  // And the rate-schedule pins, so that the charts this file leaves to
  // `bracket-pins.test.js` are checked against the instrument that owns them
  // rather than taken on trust. A claim in COVERED_ELSEWHERE that nothing backed
  // would be exactly the comment-instead-of-a-test that Day 34 found in Ohio.
  for (const [year, state, filingStatus, taxableIncome, tax] of BRACKETS.rows) {
    add(`${year}|${state}`, `bracket|${filingStatus}|${taxableIncome}`, [tax]);
  }

  let checked = 0;
  const exempt = [];
  for (const { year, state, path, steps } of shippedCharts()) {
    const key = `${year}|${state}`;
    const probesHere = PINS.rows
      .map(parse)
      .filter((r) => r.year === year && r.state === state)
      .map((r) => ({ id: `probe|${r.chart}|${r.filingStatus}|${r.probe}`, run: () => digest(stateIncomeTax(probeInput(r.chart, r.probe, r.state, r.year, r.filingStatus))) }));
    const sweepHere = [];
    for (const filingStatus of FILING_STATUSES) {
      for (const name of HOUSEHOLDS) {
        sweepHere.push({
          id: `sweep|${filingStatus}|${name}`,
          run: () => sweepDigest(stateIncomeTax(household(name, state, year, filingStatus))),
        });
      }
    }
    const bracketsHere = BRACKETS.rows
      .filter(([y, s]) => y === year && s === state)
      .map(([, , filingStatus, taxableIncome]) => ({
        id: `bracket|${filingStatus}|${taxableIncome}`,
        run: () => {
          const rate = getStateDefinition(state, year).rate;
          const table = filingStatus === '*' ? (rate.brackets ?? rate.table) : rate.byStatus[filingStatus];
          return [Math.round(applyBrackets(taxableIncome, table).tax * 100) / 100];
        },
      }));
    const answers = pinned.get(key) ?? new Map();
    const candidates = [...probesHere, ...sweepHere, ...bracketsHere];
    // Without this, the whole test passes vacuously: a candidate whose id is not
    // in the fixture compares against `undefined`, never matches, and reports that
    // every parameter moved it. That is the failure mode the mutation harness had
    // on its first run — it mutated files no test imported and printed 100% — and
    // it is silent in exactly the same way here.
    for (const candidate of candidates) {
      assert.ok(answers.has(candidate.id), `${key} ${candidate.id} has no pinned answer to compare against`);
    }

    assert.ok(
      DRIVERS[driverKey(path)] !== undefined || COVERED_ELSEWHERE[driverKey(path)] !== undefined,
      `${state} ${year} ${path} is a staircase that this file neither probes nor claims — add a driver to step-charts.mjs or name its owner in COVERED_ELSEWHERE`,
    );

    for (const { at, value } of numbersIn(steps)) {
      let moved = false;
      try {
        // A doubling, plus one so that a row of zero also changes. The registry
        // hands out the same object every call, so the perturbation is an in-place
        // write and the restore is a `finally` — a definition left wrong by a
        // thrown assertion would corrupt every test after this one.
        setAt(steps, at, value * 2 + 1);
        for (const candidate of candidates) {
          if (candidate.run().join(',') !== answers.get(candidate.id)) {
            moved = true;
            break;
          }
        }
      } finally {
        setAt(steps, at, value);
      }
      checked++;
      const where = `${state} ${year} ${path}[${at}] = ${value}`;
      const allowed = UNREACHABLE[`${state}|${driverKey(path)}|${at}`];
      if (allowed !== undefined) {
        exempt.push(where);
        assert.equal(
          moved,
          false,
          `${where} is listed as unreachable and a pinned answer now moves — delete the UNREACHABLE entry and let the probes cover it`,
        );
        continue;
      }
      assert.ok(
        moved,
        `${where} could be wrong and no pinned answer would notice. Add or move a probe in step-charts.mjs — or, if nothing can reach it, say why in UNREACHABLE.`,
      );
    }
  }
  // Pinned so that a walk which silently stops finding charts — a renamed field, a
  // rule moved behind a function — fails instead of reporting a clean sweep over
  // nothing. That is the failure mode the mutation harness had on its first run,
  // and it printed 100%.
  assert.equal(checked, 1_259, 'numbers inside the staircases this package ships');
  assert.equal(exempt.length, 8, 'staircase rows nothing can reach — three rows, both years, and the Connecticut one in two columns, all documented');
});

test("Ohio's 20% joint filing credit row is arithmetic no return can reach", () => {
  // The direct assertion the UNREACHABLE entry above points at. § 5747.05(G) pays
  // 20% of the tax remaining to a joint return with modified AGI less exemptions at
  // or below $25,000 — and O.R.C. 5747.02(A)(3) charges an Ohio return nothing at
  // all until $26,050 of taxable nonbusiness income. The exemption is subtracted
  // from the credit's income figure and not from the tax's, so the window where the
  // first test passes and the second does not is empty.
  //
  // Asserted rather than probed, because a probe would have to claim the row
  // matters. It does not: a nonrefundable share of zero is zero at every rate.
  for (const year of SUPPORTED_YEARS) {
    const def = getStateDefinition('OH', year);
    const topOfZeroBand = def.rate.bands[0].upTo;
    const [firstStep] = def.jointFilingCredit.steps;
    assert.ok(
      firstStep.upTo <= topOfZeroBand,
      `Ohio's first joint-filing-credit step now runs to ${firstStep.upTo}, past the $${topOfZeroBand} zero band — it is reachable and belongs in the probes`,
    );
    const exemption = def.exemption.perExemptionSteps.marriedFilingJointly[0].amount;
    const probe = stateIncomeTax({
      state: 'OH',
      year,
      filingStatus: 'marriedFilingJointly',
      federal: {
        adjustedGrossIncome: firstStep.upTo + exemption * 2,
        taxableIncome: firstStep.upTo + exemption * 2,
        deduction: 0,
        deductionKind: 'standard',
      },
      earnedIncome: firstStep.upTo + exemption * 2,
      qualifyingWages: firstStep.upTo + exemption * 2,
      filerAge: 45,
      spouseAge: 44,
      lesserSpouseIncome: 10_000,
      bothSpousesHaveQualifyingIncome: true,
    });
    // The richest return that can still be inside the 20% step: its income figure is
    // net of the exemptions, so the gross income may exceed the step's ceiling by
    // exactly them. It still owes nothing, so 20% of nothing is what the row pays.
    assert.equal(probe.totalTax, 0, `OH ${year}`);
    assert.equal(probe.credits.find((c) => c.name === def.jointFilingCredit.name).amount, 0, `OH ${year}`);
  }
});
