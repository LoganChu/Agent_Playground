// WHICH STATES READ IRC § 63(f), AND BY HOW MUCH — the instrument Day 52 did not have.
//
// § 63(f) adds `$2,000` to a single or head-of-household filer's standard deduction
// at 65, and `$1,600` per aged or blind person on a married return (`$2,050` and
// `$1,650` for 2026). It is an OLD provision: the One Big Beautiful Bill Act did not
// touch it, so a state whose conformity date is frozen before the Act still allows it
// in full.
//
// South Carolina 2025 did not, for three days, and the reason was an expression that
// cancelled. Its add-back against the pre-OBBBA § 63(c) amount was
//
//   max(0, federal.deduction - the recognized basic amount)
//
// with no cap, which makes the base `AGI - the recognized amount` for every household
// and takes § 63(f) away with the rest of the federal deduction. $120 of tax for a
// single filer of 65 and $192 for a couple both 65, and nothing in this package could
// see it: every test here BUILDS the federal block, and every one of them built it from
// the basic amount alone. The defect was found by `site/test/compute.test.js`, which
// runs the federal engine and therefore cannot write a federal return nobody could file.
//
// ## What this file does, and why it is a sweep rather than a case
//
// Day 44's method: ask the question of every entry, not of the one the defect was in.
// The question is not "does South Carolina read § 63(f)" — it is **"for every state and
// year, what does a dollar of federal standard deduction above the basic amount do?"**
// — and the answer has to be a figure for every state-year rather than a pass.
//
// THE RULE THE SWEEP IS BUILT ON: a state that starts from federal TAXABLE income has
// inherited the whole federal deduction, § 63(f) included. If it is insensitive to a
// dollar of it, something is cancelling, and that is a defect until a rule in the
// definition says otherwise. A state starting from federal AGI is above the deduction
// and should be insensitive — unless it reads the federal figure somewhere else, which
// two of them do and which is why the movers are pinned by NAME and AMOUNT rather than
// counted.
import assert from 'node:assert/strict';
import test from 'node:test';

import { SUPPORTED_STATES, SUPPORTED_YEARS, getStateDefinition, stateIncomeTax } from './strict.mjs';

/**
 * § 63(c)(2) and § 63(f)(1) for a single filer, as amended by OBBBA § 70101.
 *
 * Household INPUTS, not shipped figures — the same status every federal number in
 * `status-households.mjs` has, and duplicated here for the same reason: a test that
 * reaches into a sibling package cannot run inside the mutation harness's worker copy.
 */
const FEDERAL = {
  2025: { basic: 15_750, aged: 2_000 },
  2026: { basic: 16_100, aged: 2_050 },
};

/** A fixed AGI with a given below-AGI deduction, and nothing else moving. */
const taxAt = (state, year, deduction) =>
  stateIncomeTax({
    state,
    year,
    filingStatus: 'single',
    filerAge: 67,
    federal: {
      adjustedGrossIncome: 80_000,
      taxableIncome: Math.max(0, 80_000 - deduction),
      deduction,
      deductionKind: 'standard',
    },
    // The three states that define their own base and would throw without one. The
    // figure does not have to be right for the two runs to be COMPARABLE, which is all
    // a sensitivity probe needs: the same number goes into both sides.
    massachusettsFivePercentIncome: 80_000,
    newJerseyGrossIncome: 80_000,
    pennsylvaniaTaxableIncome: 80_000,
  }).tax;

/**
 * Every state-year whose tax moves when § 63(f) is added to the federal deduction, with
 * the amount it moves by — DECLARED, so that a state joining this list has to be looked
 * at and a state leaving it fails.
 *
 * Each figure is the addition times a rate, and the rate is the finding in each case:
 *
 *   CO  4.40%  flat, on federal taxable income
 *   ID  5.30%  flat, on federal taxable income
 *   SC  6.00%  2025's top band, on federal taxable income — and 2026 is ABSENT,
 *              because Act 110 moved the state's starting line to federal AGI and a
 *              frozen § 63 stopped being able to reach an individual return at all
 *   MO  4.70%  federal AGI base, and § 143.131 sets Missouri's own standard deduction
 *              EQUAL to the federal one — so § 63(f) arrives through Missouri's
 *              deduction rather than through its base
 *   UT  6.00%  federal AGI base, and the taxpayer tax credit is 6% of the federal
 *              deduction — so a larger federal deduction is a larger Utah CREDIT.
 *              The 6% is the credit rate and has nothing to do with South Carolina's
 *              identical-looking 6% top band
 *
 * Nine state-years, five states, and the two AGI-base ones are the reason this list is
 * not derived from `def.base`: "reads the federal deduction" and "starts from federal
 * taxable income" are different questions with overlapping answers.
 */
const MOVERS = {
  'CO:2025': 88,
  'CO:2026': 90.2,
  // IOWA, added Day 63, and it is the THIRD federal-AGI-base state in this
  // table — the structural point this list exists for. Iowa's deduction is the
  // federal one by conformity rather than by starting point (IA 1040 line 1d,
  // "from federal 1040"), so the § 63(f) addition arrives at Iowa's flat 3.8%:
  // $2,000 x 3.8% = $76.00 and $2,050 x 3.8% = $77.90.
  //
  // THAT THESE TWO CELLS ARE NON-ZERO IS THE WHOLE ARGUMENT FOR IOWA'S
  // `deduction: { kind: 'federal' }`, and it is the cell Arizona must NOT have:
  // Arizona is described in every summary as using the federal standard
  // deduction and allows no § 63(f) addition at all, which this package had
  // wrong for 47 days. Iowa and Arizona make the identical claim in prose and
  // differ here, which is why this table is measured rather than listed.
  'IA:2025': 76,
  'IA:2026': 77.9,
  'ID:2025': 106,
  'ID:2026': 108.65,
  'MO:2025': 94,
  'MO:2026': 96.35,
  // NORTH DAKOTA, added Day 61, and the smallest figure in this table by a
  // factor of two: $39.00 against Idaho's $106.00 on the same $2,000 of § 63(f)
  // addition, because North Dakota charges 1.95% where Idaho charges 5.3%. It
  // is here for the structural reason rather than the size of it — the base is
  // federal TAXABLE income and nothing is added back, so every federal
  // deduction reaches the state return at the state's own rate.
  'ND:2025': 39,
  'ND:2026': 39.98,
  // NEW MEXICO, added Day 67, and the FOURTH federal-AGI-base state here. PIT-1
  // line 12 is "Federal standard or itemized deduction amount (from federal
  // Form 1040, line 12)", so the addition arrives at whatever band the filer is
  // in — 4.7% for this fixture's household: $2,000 x 4.7% = $94.00 and
  // $2,050 x 4.7% = $96.35, which is Missouri's pair to the cent for the same
  // reason and not by coincidence (Missouri's top rate is 4.7% too).
  //
  // The cell being non-zero is the whole argument for New Mexico's
  // `deduction: { kind: 'federal' }`, and it is the cell Arizona must NOT have.
  // New Mexico is the sharpest case in the table because the state ALSO has an
  // age allowance of its own — § 7-2-5.2's $8,000 — so a retiree there collects
  // one allowance for age inside line 12 and a second one beside it.
  'NM:2025': 94,
  'NM:2026': 96.35,
  'SC:2025': 120,
  'UT:2025': 120,
  'UT:2026': 123,
};

test('every state that reads the federal standard deduction reads § 63(f) with it', () => {
  const measured = {};
  for (const state of SUPPORTED_STATES) {
    for (const year of SUPPORTED_YEARS) {
      if (!getStateDefinition(state, year)) continue;
      const { basic, aged } = FEDERAL[year];
      const delta = taxAt(state, year, basic) - taxAt(state, year, basic + aged);
      const rounded = Math.round(delta * 100) / 100;
      if (rounded !== 0) measured[`${state}:${year}`] = rounded;
    }
  }
  assert.deepEqual(
    measured,
    MOVERS,
    'a state-year started or stopped reading § 63(f), or reads it for a different amount',
  );
});

test('NO federal-taxable-income state is insensitive to a dollar of federal deduction', () => {
  // The structural half, and the half that would have failed on 15 October. A state
  // whose base IS federal taxable income has the whole federal deduction inside its
  // starting figure; if moving that deduction moves nothing, some add-back is
  // cancelling it, and § 63(f) is inside whatever gets cancelled.
  //
  // This is deliberately a SMALLER step than the OBBBA increase. `federal-conformity.
  // test.js` moves the deduction by exactly the $750 South Carolina refuses, which is
  // the one step that cannot distinguish a bounded cancellation from an unbounded one —
  // and South Carolina is correctly insensitive to it, so that file reports a pass and
  // will go on reporting one.
  //
  //   THE RULE: A PROBE THAT MOVES A PARAMETER BY EXACTLY THE AMOUNT A RULE IS SUPPOSED
  //   TO CANCEL CANNOT TELL A BOUNDED CANCELLATION FROM AN UNBOUNDED ONE.
  const insensitive = [];
  for (const state of SUPPORTED_STATES) {
    for (const year of SUPPORTED_YEARS) {
      const def = getStateDefinition(state, year);
      if (!def || def.base !== 'federalTaxableIncome') continue;
      const { basic } = FEDERAL[year];
      if (taxAt(state, year, basic) - taxAt(state, year, basic + 1_000) === 0) {
        insensitive.push(`${state}:${year}`);
      }
    }
  }
  assert.deepEqual(insensitive, [], 'a federal-taxable-income state swallows the federal deduction');
});

test('the add-back is bounded by the increase the state has not adopted, in every state that declares one', () => {
  // Asked of every entry rather than of South Carolina: whichever states declare
  // `recognizedStandardDeduction`, the add-back may never exceed the `increase` the rule
  // names, and it must REACH that increase for an ordinary filer whose federal deduction
  // is the post-OBBBA basic amount or more. Both halves matter — an add-back that is
  // always zero would pass the first and fail the second.
  let declared = 0;
  for (const state of SUPPORTED_STATES) {
    for (const year of SUPPORTED_YEARS) {
      const def = getStateDefinition(state, year);
      const rule = def?.recognizedStandardDeduction;
      if (!rule) continue;
      declared += 1;
      const { basic, aged } = FEDERAL[year];
      const increase = rule.increase.single;
      assert.ok(increase > 0, `${state}:${year} declares an increase of ${increase}`);
      for (const deduction of [basic, basic + aged, basic + 10_000]) {
        const result = stateIncomeTax({
          state,
          year,
          filingStatus: 'single',
          filerAge: 67,
          federal: {
            adjustedGrossIncome: 80_000,
            taxableIncome: 80_000 - deduction,
            deduction,
            deductionKind: 'standard',
          },
        });
        const added = result.addBacks.reduce((sum, a) => sum + a.amount, 0);
        assert.equal(
          added,
          increase,
          `${state}:${year} added back ${added} against a declared increase of ${increase} at a federal deduction of ${deduction}`,
        );
      }
    }
  }
  // One state-year declares the rule today. The count is pinned so that a walk which
  // stops finding the rule fails instead of reporting a clean sweep over nothing.
  assert.equal(declared, 1, 'exactly one state-year recognizes a superseded standard deduction');
});
