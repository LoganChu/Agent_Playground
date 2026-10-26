// The surviving spouse's retirement income — `survivorPension`,
// `survivorMilitaryRetirement` and `deceasedSpouseAge`, added on Day 51.
//
// THIS FILE IS THE AUDIT AND NOT THE FEATURE. South Carolina's own figures are in
// `south-carolina.test.js`; what is here is the claim the three fields make about
// the OTHER thirty-four states, which is that they read these dollars exactly as
// the filer's own and therefore answer exactly as they did before the fields
// existed.
//
// Day 50 sized the item as "an audit rather than a field" for Day 38's reason:
// `PersonRetirementIncome` has a closed key set, eleven states read military
// retired pay in six different rules, and Maryland's `militaryRetirement` is
// documented as INCLUDING Survivor Benefit Plan payments — so a military widow
// in a state nobody has researched must not lose a subtraction she has today by
// the addition of a field she did not ask for.
//
// It is also the file that found two defects. The pooling happens in
// `retirementPeople`, which every state SUBTRACTION reads; two credits read the
// caller's input directly instead, and both were silently smaller for a widow
// who used the new fields than for the same widow who had put the same dollars
// in `employerPlanPension` the day before. Ohio's retirement income credit by
// $200 and Utah's military retirement credit by $1,335. Both are pinned below.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  getStateDefinition,
  stateIncomeTax,
  SUPPORTED_STATES,
  STATES_READING_RETIREMENT,
} from './strict.mjs';
import { FIGURE_SWEEP_OPTIONS } from './status-households.mjs';

const FEDERAL_DEDUCTION = {
  single: 15_750,
  marriedFilingSeparately: 15_750,
  headOfHousehold: 23_625,
  marriedFilingJointly: 31_500,
  qualifyingSurvivingSpouse: 31_500,
};

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

const creditOf = (result, name) =>
  (result.credits ?? []).find((c) => c.name === name)?.amount ?? 0;

const household = (state, year, filingStatus, agi, age) => {
  const deduction = FEDERAL_DEDUCTION[filingStatus];
  return {
    state,
    year,
    filingStatus,
    filerAge: age,
    spouseAge: age,
    federal: {
      adjustedGrossIncome: agi,
      taxableIncome: Math.max(0, agi - deduction),
      deduction,
      deductionKind: 'standard',
    },
    // The three states that define their own base and would throw without one.
    // The figures do not have to be right for them to be COMPARABLE, which is
    // all this sweep needs: the same number goes into both sides.
    massachusettsFivePercentIncome: agi,
    newJerseyGrossIncome: agi,
    pennsylvaniaTaxableIncome: agi,
  };
};

// ---------------------------------------------------------------------------
// The sweep. Finished rather than sampled, which is Day 50's Part 12 rule.
// ---------------------------------------------------------------------------

test('exactly one state reads survivor retirement income differently from the filer own, and it is the one with the statute', () => {
  const differ = new Set();
  let comparisons = 0;
  for (const state of SUPPORTED_STATES) {
    for (const year of [2025, 2026]) {
      for (const filingStatus of Object.keys(FEDERAL_DEDUCTION)) {
        for (const agi of [40_000, 90_000, 200_000]) {
          // 50 and 60 are under both age gates in this rule, 65 is South
          // Carolina's and 70 is clear of every one of them.
          for (const age of [50, 60, 65, 70]) {
            for (const [own, survivor] of [
              ['militaryRetirement', 'survivorMilitaryRetirement'],
              ['employerPlanPension', 'survivorPension'],
            ]) {
              const base = household(state, year, filingStatus, agi, age);
              // A FIGURE sweep, so the unread-field probe is off for the cost
              // alone — 35 states x 2 years x 5 statuses x 3 incomes x 4 ages x
              // 2 pairs of fields, and it reads `.tax` and nothing else.
              // `unread-input.test.js` asserts over all 70 state-years that the
              // option moves no figure.
              const a = stateIncomeTax(
                { ...base, retirement: { filer: { [own]: 25_000 } } },
                FIGURE_SWEEP_OPTIONS,
              );
              const b = stateIncomeTax(
                { ...base, retirement: { filer: { [survivor]: 25_000 } } },
                FIGURE_SWEEP_OPTIONS,
              );
              comparisons++;
              if (Math.abs(a.tax - b.tax) > 0.005) differ.add(state);
            }
          }
        }
      }
    }
  }
  // The count is asserted because a sweep that silently stopped comparing would
  // pass this test perfectly — Day 47's "an announcement at start-up is not a
  // guard" in sweep form.
  // 9,120 from Day 62: 38 states x 2 years x 5 statuses x 3 incomes x 4 ages x 2
  // field pairs. Louisiana added 240 on Day 60, North Dakota 240 on Day 61 and
  // Oklahoma 240 on Day 62 — one state is 240 comparisons, every time.
  assert.equal(comparisons, 9_120, 'comparisons made');
  assert.deepEqual([...differ].sort(), ['SC']);
});

// ---------------------------------------------------------------------------
// The two credits that read the input rather than the pooled person. Both of
// these were WRONG when first measured, and both are the same shape as the
// v0.18.0 defect `retirementIncomeOf`'s own doc comment describes: a caller who
// supplied the more detailed input was treated as having supplied nothing.
// ---------------------------------------------------------------------------

test("Ohio's retirement income credit reads a survivor pension", () => {
  // O.R.C. 5747.055 — the credit is a staircase on retirement income and tops
  // out at $200, which $30,000 reaches by either field. It was $0 for the
  // survivor field before the fix, so the whole $200 is what this pins.
  for (const field of ['employerPlanPension', 'survivorPension', 'survivorMilitaryRetirement']) {
    const r = stateIncomeTax({
      ...household('OH', 2026, 'single', 90_000, 60),
      retirement: { filer: { [field]: 30_000 } },
    });
    money(creditOf(r, 'Retirement income credit'), 200, field);
    money(r.tax, 1_838.38, field);
  }
});

test("Utah's military retirement credit reads a survivor annuity", () => {
  // Utah Code § 59-10-1043 defines the credit AS the rate rather than storing a
  // figure, so $30,000 at 4.45% is $1,335.00 and the credit moves the year the
  // rate does. Survivor Benefit Plan payments are military retired pay to the
  // survivor, so they are the same dollars by any name.
  for (const field of ['militaryRetirement', 'survivorMilitaryRetirement']) {
    const r = stateIncomeTax({
      ...household('UT', 2026, 'single', 90_000, 60),
      retirement: { filer: { [field]: 30_000 } },
    });
    money(creditOf(r, 'Utah military retirement credit (code AJ)'), 1_335, field);
    money(r.tax, 2_658.23, field);
  }
  // And a survivor PENSION does not buy it, because § 59-10-1043 is about
  // military retired pay and not about retirement income.
  const pension = stateIncomeTax({
    ...household('UT', 2026, 'single', 90_000, 60),
    retirement: { filer: { survivorPension: 30_000 } },
  });
  money(creditOf(pension, 'Utah military retirement credit (code AJ)'), 0, 'survivor pension');
});

test('Alabama reads a survivor annuity as a defined benefit payment', () => {
  // The one state whose answer turns on the PLAN TYPE, and a survivor annuity
  // has no plan type on the input. It is read as `employerPlanPension` is — a
  // defined benefit payment, exempt in full — which is both the documented
  // contract and what a caller got by calling it that yesterday.
  const db = stateIncomeTax({
    ...household('AL', 2026, 'single', 60_000, 62),
    retirement: { filer: { employerPlanPension: 30_000 } },
  });
  const survivor = stateIncomeTax({
    ...household('AL', 2026, 'single', 60_000, 62),
    retirement: { filer: { survivorPension: 30_000 } },
  });
  money(survivor.tax, db.tax, 'survivor annuity vs defined benefit pension');
  // And NOT as the defined contribution half, which at 62 is worth $1,380 of
  // Alabama tax on these dollars — the gap the plan-type field exists for.
  const dc = stateIncomeTax({
    ...household('AL', 2026, 'single', 60_000, 62),
    retirement: { filer: { definedContributionPlan: 30_000 } },
  });
  assert.ok(dc.tax > survivor.tax + 1, 'a defined contribution draw is taxed and this is not');
});

// ---------------------------------------------------------------------------
// The list of states that read `retirement`, and why it is derived.
//
// `us-tax-mcp` gates every argument on the states that read it and REFUSES the
// argument otherwise. On Day 51 its `RETIREMENT_STATES` was the last hand-written
// list in that module and it named 13 states where the engine reads 16: Ohio,
// South Carolina and Wisconsin were refused an input that moves their tax, with
// a message telling the caller the field did not apply to their state.
//
// A silently ignored field is a wrong answer with no symptom. A field REFUSED
// with a false explanation is a wrong answer the caller has been argued out of,
// and it is worse, because the caller stops looking.
// ---------------------------------------------------------------------------

test('every state whose tax moves when `retirement` is supplied is in the derived list', () => {
  // THE DERIVED LIST IS A CLAIM ABOUT KEYS; THIS IS THE MEASUREMENT. A key the
  // list forgets is a state the MCP server refuses, so the honest check is to
  // run households rather than to re-read the key names.
  const moved = new Set();
  const everything = {
    filer: {
      employerPlanPension: 20_000,
      definedContributionPlan: 3_000,
      iraDistributions: 5_000,
      militaryRetirement: 5_000,
      governmentPension: 5_000,
      socialSecurityBenefits: 8_000,
      investmentIncome: 3_000,
      earnedIncome: 2_000,
      serviceMonthsBefore1998: 120,
      serviceMonthsAfter1997: 60,
      totallyDisabled: false,
      survivorPension: 4_000,
      survivorMilitaryRetirement: 4_000,
      deceasedSpouseAge: 70,
    },
  };
  for (const state of SUPPORTED_STATES) {
    for (const year of [2025, 2026]) {
      for (const filingStatus of ['single', 'marriedFilingJointly']) {
        // 62 is Oregon's retirement credit age and Georgia's military cliff; 66
        // and 70 clear every other gate; 50 is under all of them.
        for (const age of [50, 62, 66, 70]) {
          for (const agi of [30_000, 40_000, 90_000]) {
            const base = household(state, year, filingStatus, agi, age);
            const without = stateIncomeTax(base);
            const with_ = stateIncomeTax({ ...base, retirement: everything });
            if (Math.abs(without.tax - with_.tax) > 0.005) moved.add(state);
          }
        }
      }
    }
  }
  // Every state the input MOVES must be in the list. The converse is not
  // asserted: a state may read the field through a provision no household here
  // reaches, which is the right direction for the list to err — a state in the
  // list and unmoved costs a caller nothing, and a state moved and missing from
  // it costs them the refusal.
  const missing = [...moved].filter((s) => !STATES_READING_RETIREMENT.includes(s)).sort();
  assert.deepEqual(missing, [], 'states whose tax moves but which the list omits');
  // And the three that were missing on Day 51 are pinned by name, so a key
  // deleted from `RETIREMENT_READING_RULES` fails here and not in a bug report.
  for (const state of ['OH', 'SC', 'WI', 'LA', 'ND']) {
    assert.ok(moved.has(state), `${state} tax moves on retirement`);
    assert.ok(STATES_READING_RETIREMENT.includes(state), `${state} is in the derived list`);
  }
  assert.equal(STATES_READING_RETIREMENT.length, 19, 'states reading retirement');
});

// ---------------------------------------------------------------------------
// The latent double-count, guarded before it exists.
//
// The three survivor fields are POOLED into the filer's own income in
// `retirementPeople`, and the one rule with a survivor claim of its own takes
// its share back out in `split()`. That is the whole design, and it is only
// complete for the rules that read the POOLED `RetirementPerson`.
//
// Two readers do not: `retirementIncomeOf` (Ohio's retirement income credit)
// reads the caller's input directly, and `planTypeRetirement` (Alabama) reads
// `definedBenefit`, which `split()` does not adjust because no state needs it
// adjusted. Both are correct today for a reason that is pure coincidence of
// which states exist: `survivorClaim` is South Carolina's, `retirementIncomeCredit`
// is Ohio's and `planTypeRetirement` is Alabama's, and no state has two of them.
//
// **A DECLARATION THAT IS RIGHT BY COINCIDENCE OF WHICH STATES EXIST IS A DEFECT
// WITH A COMMIT DATE IN THE FUTURE**, and the cheapest thing that can be done
// about it now is to make the day it arrives a failing build rather than a wrong
// answer. Day 50's `militaryExemptInFull` and Day 51's misspelt derived-list key
// are the same class: something nothing reads, or nothing contradicts, until it
// matters.
// ---------------------------------------------------------------------------

test('no state combines a survivor claim with a rule that reads the pooled income', () => {
  const withSurvivorClaim = [];
  const pooledReaders = { retirementIncomeCredit: [], planTypeRetirement: [] };
  for (const state of SUPPORTED_STATES) {
    for (const year of [2025, 2026]) {
      const def = getStateDefinition(state, year);
      if ((def.retirementIncomeSubtractions ?? []).some((r) => r.survivorClaim !== undefined)) {
        if (!withSurvivorClaim.includes(state)) withSurvivorClaim.push(state);
      }
      for (const key of Object.keys(pooledReaders)) {
        if (def[key] !== undefined && !pooledReaders[key].includes(state)) {
          pooledReaders[key].push(state);
        }
      }
    }
  }
  // Pinned by name so that the day any of the three lists changes, this test is
  // what says so — and says which combination to go and think about.
  assert.deepEqual(withSurvivorClaim, ['SC'], 'states with a survivor claim');
  assert.deepEqual(pooledReaders.retirementIncomeCredit, ['OH']);
  assert.deepEqual(pooledReaders.planTypeRetirement, ['AL']);
  for (const [key, states] of Object.entries(pooledReaders)) {
    const both = withSurvivorClaim.filter((s) => states.includes(s));
    assert.deepEqual(
      both,
      [],
      `${both.join(', ')} declares a survivorClaim AND ${key}. The survivor dollars are ` +
        `pooled into the filer's own income for that reader and claimed separately by the ` +
        `survivor rule, so they would be counted TWICE. Take the survivor share out of ` +
        `that reader before shipping the combination.`,
    );
  }
});

test('two decedents on one joint return each get their own cap', () => {
  // Both spouses widowed before this marriage, each with survivor income from a
  // different decedent of a different age. The claim is that the cap is read per
  // claimant from THAT claimant's decedent, so the two do not share one band —
  // and a joint return does not widen either, because South Carolina's cap is
  // per person and its brackets do not widen at all (§ 12-6-510).
  //
  //   filer:  decedent would be 70 -> $10,000 cap, $12,000 of income -> $10,000
  //   spouse: decedent would be 60 -> $ 3,000 cap, $12,000 of income -> $ 3,000
  //
  // $13,000, which is neither 2 x $10,000 nor 2 x $3,000 nor one shared cap.
  const r = stateIncomeTax({
    ...household('SC', 2025, 'marriedFilingJointly', 160_000, 68),
    spouseAge: 66,
    retirement: {
      filer: { survivorPension: 12_000, deceasedSpouseAge: 70 },
      spouse: { survivorPension: 12_000, deceasedSpouseAge: 60 },
    },
  });
  assert.deepEqual(r.computedSubtractions, [
    { name: 'Surviving spouse retirement deduction', amount: 13_000 },
    // Both are over 65 and neither claimed anything under (A) of their own, so
    // the senior deduction is $15,000 each and untouched by the survivor claim.
    { name: 'Senior deduction (age 65)', amount: 30_000 },
  ]);
});
