// WHICH STATES READ A FEDERAL FIGURE FROM BELOW AGI, AND WHETHER THEY ARE
// ENTITLED TO.
//
// Day 46. `test/conformity.test.js` has asserted since Day 4 that the One Big
// Beautiful Bill Act's standard deduction increase cut tax in Arizona, Colorado
// and Idaho. Every one of those assertions passed, and all three were measured
// against the WRONG federal figure: `$14,600`, which is 2024's. Rev. Proc.
// 2024-40 had already set 2025 at `$15,000` before OBBBA touched it, so the
// increase is `$750` and not `$1,150`, and a third of what five states' notes
// credited to the Act was ordinary indexation.
//
// **The engine was never wrong.** It computes 2.5% of whatever deduction it is
// handed. What was wrong was the premise in the test, and the test could not
// fail on it because the test supplied the premise. Four test files and five
// states' notes agreed with each other and with nothing else.
//
// This file is the other half of the question, and it is the half that was
// missing entirely: *is the state entitled to the federal figure at all?*
// `ConformityBase` says where a state starts. It does not say WHEN — whether the
// state reads the Code as it stands or as it stood on a date. Arizona and
// Colorado both give their 2025 filers the OBBBA deduction; Colorado because its
// conformity is rolling, Arizona because a Governor ordered the Department to
// print it on a form while the conformity statute still points six months before
// the Act and two bills to move it were vetoed.
//
// So: the set of states that read such a figure is DERIVED by moving the figure,
// not by reading the definitions, and every state in that set must declare how
// it tracks the Code.
import assert from 'node:assert/strict';
import test from 'node:test';

import { FILING_STATUSES, SUPPORTED_STATES, getStateDefinition, stateIncomeTax } from './strict.mjs';

const YEARS = [2025, 2026];

/**
 * The OBBBA § 70102 increase, per filing status.
 *
 * PINNED HERE AND PROVED ELSEWHERE. `tools/obbba-claims.mjs` reads
 * `us-federal-tax`'s own `OBBBA_2025_STANDARD_DEDUCTION_INCREASE` — derived
 * there from the superseded Rev. Proc. 2024-40 figures and the figures the 2025
 * return uses — and fails if these three numbers disagree with it. That is the
 * link this repository did not have: the right answer was in the federal
 * package's data and the wrong one in this package's tests, for 46 days, with
 * nothing comparing them.
 */
const OBBBA_INCREASE = {
  single: 750,
  marriedFilingSeparately: 750,
  marriedFilingJointly: 1_500,
  qualifyingSurvivingSpouse: 1_500,
  headOfHousehold: 1_125,
};

/** The pre-OBBBA 2025 standard deduction — Rev. Proc. 2024-40 § 2.15. */
const SUPERSEDED = {
  single: 15_000,
  marriedFilingSeparately: 15_000,
  marriedFilingJointly: 30_000,
  qualifyingSurvivingSpouse: 30_000,
  headOfHousehold: 22_500,
};

/** A federal basis at a fixed AGI with a given below-AGI deduction. */
const basis = (deduction, agi = 120_000) => ({
  adjustedGrossIncome: agi,
  taxableIncome: Math.max(0, agi - deduction),
  deduction,
  deductionKind: 'standard',
});

/** The tax a state charges on the same AGI with two different federal deductions. */
function sensitivity(state, year, filingStatus, agi = 120_000) {
  const before = stateIncomeTax({
    state,
    year,
    filingStatus,
    federal: basis(SUPERSEDED[filingStatus], agi),
  });
  const after = stateIncomeTax({
    state,
    year,
    filingStatus,
    federal: basis(SUPERSEDED[filingStatus] + OBBBA_INCREASE[filingStatus], agi),
  });
  return before.tax - after.tax;
}

/**
 * Every state whose answer MOVES when a below-AGI federal figure moves.
 *
 * A `stateDefined` state REFUSES a federal-only basis rather than ignoring it —
 * Massachusetts, New Jersey and Pennsylvania all throw, which is Day 38's guard
 * working. Those states read no federal figure by construction, so they are not
 * sensitive; but the refusal is checked to be that refusal, because a `catch`
 * that swallows any error is how this test would stop being able to fail.
 */
function sensitiveStates(year) {
  const out = [];
  for (const state of SUPPORTED_STATES) {
    const def = getStateDefinition(state, year);
    if (!def) continue;
    let moved;
    try {
      // Swept across incomes, not measured at one. Utah's sensitivity is a
      // BAND — its Taxpayer Tax Credit is fully withdrawn by $90,906 of AGI for
      // a 2025 single filer, so a probe at $120,000 finds Utah insensitive and
      // would drop it from this set. The first version of this test did exactly
      // that and found Utah only through the joint column by luck.
      moved = [40_000, 120_000].some((agi) =>
        FILING_STATUSES.some((fs) => Math.abs(sensitivity(state, year, fs, agi)) > 0.004),
      );
    } catch (err) {
      assert.equal(
        def.base,
        'stateDefined',
        `${state} ${year}: only a stateDefined state may refuse a federal basis, and this one threw: ${err.message}`,
      );
      assert.ok(def.stateDefinedBase?.field, `${state} ${year}: a refusing state names the field it wants`);
      continue;
    }
    if (moved) out.push(state);
  }
  return out;
}

test('exactly FOUR states read a below-AGI federal figure, and it is MEASURED not listed', () => {
  for (const year of YEARS) {
    assert.deepEqual(
      sensitiveStates(year),
      ['CO', 'ID', 'MO', 'UT'],
      `${year}: the states whose tax moves when the federal deduction moves`,
    );
  }
});

test('ARIZONA LEFT THIS SET, and the measurement is what says so rather than a note', () => {
  // Day 46 found five. Day 47 finds four, and the state that left did not change
  // its answer by a cent: A.R.S. § 43-1041(A) defined Arizona's standard
  // deduction AS the federal one until Laws 2026 ch. 140 (HB 4168) §§ 16 and
  // 35(A) replaced the cross-reference with Arizona's own figures, retroactive
  // to taxable years beginning after 31 December 2024.
  //
  // So this is the inverse of the Day 46 defect. There the figures were wrong
  // and the mechanism was right; here the figures are right and the MECHANISM
  // changed, and no number in this package moved on the day it happened. That
  // is why the probe is the test: nothing else in this file could tell the two
  // apart.
  for (const year of YEARS) {
    for (const filingStatus of FILING_STATUSES) {
      for (const agi of [40_000, 120_000]) {
        assert.equal(
          sensitivity('AZ', year, filingStatus, agi),
          0,
          `AZ ${year} ${filingStatus} at $${agi}: Arizona's deduction is its own, so moving the ` +
            `federal one must not move Arizona's tax`,
        );
      }
    }
  }
});

test('a conformity claim must say WHICH HALF of the return it governs, and be backed for that half', () => {
  // Day 46 made this two-sided and could only ask one question: does the state's
  // tax move when a below-AGI federal figure moves? Arizona answered yes, so it
  // had to declare; after HB 4168 it answers no, so under the old rule it was
  // forbidden to declare — although § 43-105 still decides which Code builds the
  // federal AGI Arizona starts from.
  //
  // THE RULE: "does this state read the federal Code?" is not one question. The
  // claim now names the half it governs and each half is checked against a
  // different fact about the state.
  for (const year of YEARS) {
    const sensitive = new Set(sensitiveStates(year));
    for (const state of SUPPORTED_STATES) {
      const def = getStateDefinition(state, year);
      if (!def) continue;
      const c = def.federalConformity;
      if (sensitive.has(state)) {
        assert.ok(
          c,
          `${state} ${year}: tax moves with a below-AGI federal figure, so federalConformity is required`,
        );
        assert.equal(
          c.governs,
          'belowTheLine',
          `${state} ${year}: measured sensitive below the line, so that is what it governs`,
        );
      } else if (c) {
        // An insensitive state may still declare, and there are now TWO backings
        // for it. Each is checked against a different structural fact, because a
        // claim this probe cannot see has to be backed by something the probe
        // can.
        assert.ok(
          c.governs === 'base' || c.governs === 'recognizedDeductions',
          `${state} ${year}: not sensitive below the line, so a 'belowTheLine' claim would be unbacked`,
        );
        if (c.governs === 'base') {
          // The date reaches the state's starting line — but only if it has a
          // federal one. A 'base' claim on a stateDefined state would be backed
          // by nothing at all.
          assert.equal(
            def.base,
            'federalAdjustedGrossIncome',
            `${state} ${year}: a 'base' conformity claim needs a federal base to govern`,
          );
        } else {
          // SOUTH CAROLINA, AND THE CASE THIS PROBE IS BLIND TO BY
          // CONSTRUCTION. The state starts below the federal standard deduction
          // and adds back the part its frozen Code does not recognize, so the
          // movement cancels and the probe reports no sensitivity. The claim is
          // backed by the add-back machinery instead: a state cannot say the
          // date governs which deductions it recognizes unless it holds the
          // rule that refuses one.
          assert.equal(
            def.base,
            'federalTaxableIncome',
            `${state} ${year}: a 'recognizedDeductions' claim only means something below the federal deduction`,
          );
          assert.ok(
            def.recognizedStandardDeduction !== undefined ||
              (def.addBacks !== undefined && def.addBacks.length > 0),
            `${state} ${year}: 'recognizedDeductions' is backed by the add-back and this state has none`,
          );
        }
      }
    }
  }
});

test('a static-date state names its date and a rolling one has none', () => {
  for (const year of YEARS) {
    for (const state of sensitiveStates(year)) {
      const c = getStateDefinition(state, year).federalConformity;
      assert.ok(c.cite.length > 20, `${state} ${year}: a conformity claim needs a section`);
      if (c.kind === 'staticDate') {
        assert.match(c.conformedTo, /^\d{4}-\d{2}-\d{2}$/, `${state} ${year}: a frozen Code has a date`);
      } else {
        assert.equal(c.kind, 'rolling');
        assert.equal(
          c.conformedTo,
          undefined,
          `${state} ${year}: a rolling state has no conformity date, and storing one invites a reader to trust it`,
        );
      }
    }
  }
});

test("THE FINDING: Arizona 2025 is carried by ARIZONA'S OWN FIGURE, not by conformity and not by the order", () => {
  // Day 46 called this entry "the only answer here carried by executive action"
  // and that was true when it was written. It stopped being true on 13 June
  // 2026, nearly four months before Day 46 ran, and Day 46 had the bill in hand:
  // it cited HB 4168 for moving the conformity date and did not read that §§ 16
  // and 35(A) of the same bill backdated Arizona's own deduction table to 2025.
  //
  // THE RULE: AN OMNIBUS ACT HAS ONE HEADLINE DATE AND MANY EFFECTIVE DATES.
  const az = getStateDefinition('AZ', 2025).federalConformity;
  assert.equal(az.kind, 'staticDate');
  assert.equal(az.conformedTo, '2025-01-01', 'the date was never moved for 2025 — both bills were vetoed');
  assert.equal(az.governs, 'base', 'what the date still reaches is federal AGI, not the deduction');
  assert.equal(az.reachedAnyway.route, 'ownStatutoryFigure');
  assert.match(az.reachedAnyway.cite, /43-1041\(A\)/);
  assert.match(az.reachedAnyway.cite, /HB 4168/);
  assert.match(az.reachedAnyway.cite, /retroactive/i, 'the retroactivity is the whole of the finding');
  // The vetoes and the order are still on the record, because the seven months
  // in which the order WAS the only authority are a fact about the year.
  assert.match(az.reachedAnyway.cite, /Executive Order 2025-15/);
  assert.match(az.reachedAnyway.cite, /vetoed/);

  const az26 = getStateDefinition('AZ', 2026).federalConformity;
  assert.equal(az26.conformedTo, '2026-01-01', 'HB 4168, signed 13 June 2026');
  assert.equal(az26.governs, 'base');
  assert.equal(az26.reachedAnyway, undefined);

  // NO STATE-YEAR IN THIS PACKAGE NOW RESTS ON AN EXECUTIVE ORDER. That is the
  // claim worth asserting, because it is the one that changed.
  const byExecutive = [];
  for (const year of YEARS) {
    for (const state of SUPPORTED_STATES) {
      const c = getStateDefinition(state, year)?.federalConformity;
      if (c?.reachedAnyway?.route === 'executiveAction') byExecutive.push(`${state} ${year}`);
    }
  }
  assert.deepEqual(byExecutive, [], 'Arizona was the only one and HB 4168 replaced it');
});

test("Idaho 2025's answer became the right one on 10 February 2026 and not before", () => {
  const id = getStateDefinition('ID', 2025).federalConformity;
  assert.equal(id.kind, 'staticDate');
  assert.equal(id.conformedTo, '2026-01-01', 'HB 559 moved the date and backdated it');
  assert.equal(id.reachedAnyway.route, 'retroactiveLegislation');
  assert.match(id.reachedAnyway.cite, /HB 559/);

  // 2026 reaches the same Code with no retroactivity, which is the difference.
  assert.equal(getStateDefinition('ID', 2026).federalConformity.reachedAnyway, undefined);
});

test('Colorado, Missouri and Utah are rolling, and none of them needed a route', () => {
  for (const state of ['CO', 'MO', 'UT']) {
    for (const year of YEARS) {
      const c = getStateDefinition(state, year).federalConformity;
      assert.equal(c.kind, 'rolling', `${state} ${year}`);
      assert.equal(c.reachedAnyway, undefined, `${state} ${year}: a rolling state needs no other route`);
    }
  }
});

test('the four deltas are the state rate times the REAL increase', () => {
  // These are the figures that were wrong in four test files and five notes.
  // Each is now stated against the $750 / $1,500 / $1,125 increase.
  //
  // THE INCOME IS PER STATUS AND THAT IS NOT TIDINESS. A joint filer at $40,000
  // is INSIDE Idaho's $9,622 zero bracket once the $31,500 deduction comes off,
  // so most of the increase is untaxed and Idaho's delta is $20.03 rather than
  // $79.50. A single filer at $120,000 is past the withdrawal of Utah's credit,
  // so Utah's delta is $0.00. Each status is measured where all five states are
  // live, and both of those boundaries have a test of their own below.
  //
  // ARIZONA IS NOT HERE ANY MORE and its $18.75 has not gone away: Arizona's own
  // statutory table carries the post-OBBBA figures, so the Act's increase is
  // inside § 43-1041(A) rather than reaching Arizona through the Code. That is
  // asserted in `arizona-deduction.test.js`, against the table, which is where
  // the claim now lives.
  const expected = {
    CO: { single: 33.0, marriedFilingJointly: 66.0 },
    ID: { single: 39.75, marriedFilingJointly: 79.5 },
    MO: { single: 35.25, marriedFilingJointly: 70.5 },
    UT: { single: 45.0, marriedFilingJointly: 90.0 },
  };
  const incomeFor = { single: 60_000, marriedFilingJointly: 80_000 };
  for (const [state, byStatus] of Object.entries(expected)) {
    for (const [filingStatus, want] of Object.entries(byStatus)) {
      const got = sensitivity(state, 2025, filingStatus, incomeFor[filingStatus]);
      assert.ok(
        Math.abs(got - want) < 0.005,
        `${state} ${filingStatus}: expected ${want}, got ${got.toFixed(4)}`,
      );
    }
  }

  // The Idaho boundary, so the choice of income above is a measurement.
  assert.ok(
    sensitivity('ID', 2025, 'marriedFilingJointly', 40_000) < 21,
    "a joint Idaho filer at $40,000 is inside the zero bracket and the increase mostly isn't taxed",
  );
});

test('the head-of-household column lands on a HALF CENT in two states, and it does not round the same way', () => {
  // 1,125 x 2.5% is 28.125; x 5.3% is 59.625; x 4.7% is 52.875. All three are
  // exact half-cents, and two report DOWN while one reports UP.
  //
  // DAY 46 EXPLAINED THAT WRONGLY AND DAY 47 MEASURED IT. The old comment said
  // "the engine rounds a float ... the binary value lands below the midpoint
  // twice and above it once". It does not: `roundCents` of all three products
  // rounds UP, to 28.13, 59.63 and 52.88. None of these figures is a rounded
  // product. Each is the EXACT difference of two answers already rounded to the
  // cent — Idaho reports 2007.53 - 1947.91 = 59.62 exactly, with no rounding of
  // the difference at all.
  //
  // THE RULE: ROUNDING THE SUBTRAHEND UP PUSHES THE DIFFERENCE DOWN. The
  // direction is decided by WHICH of the two answers absorbs the half-cent, not
  // by anything about binary representation. `engine.ts` already carries this
  // rule for the notes that price a counterfactual; the prose explaining the
  // half-cent had not been held to it.
  //
  // This is worklist item 10 from Day 45, reached from a new direction and with a
  // sharper demonstration than the differential grid gave it: the same arithmetic
  // at the same precision, rounding two ways inside one test.
  // Arizona's $28.12 is the third instance and is no longer measurable from
  // here, because moving the federal deduction no longer moves Arizona. It is
  // asserted against Arizona's own table in `arizona-deduction.test.js` instead,
  // and the two exact values below are still checked on both sides.
  const measured = { ID: 59.62, MO: 52.88 };
  for (const [state, want] of Object.entries(measured)) {
    const got = sensitivity(state, 2025, 'headOfHousehold', 70_000);
    assert.equal(Number(got.toFixed(2)), want, `${state} head of household`);
  }
  assert.equal(Number((1_125 * 0.025).toFixed(3)), 28.125, 'the exact value Arizona rounds DOWN from');
  assert.equal(Number((1_125 * 0.047).toFixed(3)), 52.875, 'the exact value MO rounds UP from');

  // Colorado and Utah have no half-cent at this status, so they are exact.
  assert.equal(sensitivity('CO', 2025, 'headOfHousehold', 70_000).toFixed(2), '49.50');
  assert.equal(sensitivity('UT', 2025, 'headOfHousehold', 70_000).toFixed(2), '67.50');
});

test('UTAH IS THE ONLY ONE OF THE FOUR WHERE THE OBBBA INCREASE IS WORTH NOTHING AT THE TOP', () => {
  // The other three read the deduction through the base or through a deduction of
  // their own, so the benefit is the state rate times the increase at every
  // income. Utah reads it through a CREDIT that withdraws at 1.3 cents on the
  // dollar, so the benefit is a band: full value to $87,444 of AGI, nothing at
  // all from $90,906, for a 2025 single filer taking the standard deduction.
  assert.equal(sensitivity('UT', 2025, 'single', 87_444).toFixed(2), '45.00');
  assert.ok(sensitivity('UT', 2025, 'single', 87_445) < 45, 'the withdrawal starts here');
  assert.equal(sensitivity('UT', 2025, 'single', 90_906).toFixed(2), '0.00');
  assert.equal(sensitivity('UT', 2025, 'single', 200_000).toFixed(2), '0.00');

  // And the floor matters too: the credit is NON-REFUNDABLE, so a filer whose
  // tax it already covers gains less than 6% of the increase.
  assert.ok(sensitivity('UT', 2025, 'single', 20_000) < 45, 'capped by the tax itself');

  // Every other state keeps its full delta at $200,000.
  for (const [state, want] of Object.entries({ CO: 33.0, ID: 39.75, MO: 35.25 })) {
    assert.ok(
      Math.abs(sensitivity(state, 2025, 'single', 200_000) - want) < 0.005,
      `${state} is unbounded above`,
    );
  }
});

test('and the OLD figures are wrong for every one of the four', () => {
  // The guard that would have caught Day 4's defect: the increase measured from
  // the 2024 figure produces a different answer in all four states, so a test
  // asserting one of these is asserting the 2024-to-2025 change and calling it
  // OBBBA. Arizona's $28.75 is checked against its own table instead.
  const wrong = { CO: 50.6, ID: 60.95, MO: 54.05, UT: 69.0 };
  for (const [state, bad] of Object.entries(wrong)) {
    const got = sensitivity(state, 2025, 'single');
    assert.ok(
      Math.abs(got - bad) > 0.005,
      `${state}: ${bad} is the increase measured from $14,600, which is the 2024 standard deduction`,
    );
  }
});

test('the weakest conformity entry says so, in the field rather than in a journal', () => {
  // Every state revenue and legislature site this package needs has been refused
  // by the sandbox's egress policy for six runs — a policy denial on CONNECT,
  // confirmed against the proxy's own status endpoint on Day 47. Every entry is
  // established from secondary reproductions cross-checked against each other,
  // and that is recorded where a reader of the definition will see it rather
  // than in a journal nobody ships.
  //
  // ARIZONA IS CHECKED HERE TOO although it is no longer in the sensitive set,
  // because an unread primary text is a property of the CLAIM and not of which
  // half of the return the claim governs.
  const unread = [];
  for (const state of [...new Set([...sensitiveStates(2025), 'AZ'])].sort()) {
    if (getStateDefinition(state, 2025).federalConformity?.primaryTextUnread) unread.push(state);
  }
  assert.deepEqual(unread, ['AZ', 'CO', 'ID', 'MO', 'UT'], 'all five, honestly');

  const ut = getStateDefinition('UT', 2025).federalConformity.primaryTextUnread;
  assert.match(ut, /WEAKEST/, 'Utah is the one to re-read first and the field says so');
});

test('a RESULT carries the conformity rule, because a caller cannot read the definition', () => {
  const federal = {
    adjustedGrossIncome: 100_000,
    taxableIncome: 84_250,
    deduction: 15_750,
    deductionKind: 'standard',
  };
  const at = (state) => stateIncomeTax({ state, year: 2025, filingStatus: 'single', federal }).conformity;

  // The pair. `base` alone was all a caller could see until Day 46, and the two
  // halves of the question have different answers in Arizona and Colorado.
  assert.equal(at('CO').base, 'federalTaxableIncome');
  assert.equal(at('CO').federal.kind, 'rolling');

  assert.equal(at('AZ').base, 'federalAdjustedGrossIncome');
  assert.equal(at('AZ').federal.kind, 'staticDate');
  assert.equal(at('AZ').federal.conformedTo, '2025-01-01');
  assert.equal(at('AZ').federal.governs, 'base');
  assert.equal(at('AZ').federal.reachedAnyway.route, 'ownStatutoryFigure');

  // And absent where it would be unbacked. Illinois starts from federal AGI and
  // nothing below it reaches an Illinois return, so Illinois has no business
  // making a conformity claim in a result.
  assert.equal(at('IL').federal, undefined);

  // Every state agrees with its own definition, in both years.
  for (const year of YEARS) {
    for (const state of SUPPORTED_STATES) {
      const def = getStateDefinition(state, year);
      if (!def || def.base === 'stateDefined' || !def.rate || def.rate.kind === 'none') continue;
      const got = stateIncomeTax({ state, year, filingStatus: 'single', federal }).conformity.federal;
      assert.equal(got, def.federalConformity, `${state} ${year}: result and definition must be the same object`);
    }
  }
});
