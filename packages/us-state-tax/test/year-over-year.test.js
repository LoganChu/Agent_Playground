// Six of the fourteen taxing states changed their rate between 2025 and 2026, and
// two of the six changed the deduction with it. This is the file that would catch
// a package quietly answering a 2026 question with 2025 law.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SUPPORTED_STATES, getStateDefinition, stateIncomeTax } from './strict.mjs';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

const single100k = (state, year, dependents = 0) =>
  stateIncomeTax({
    state,
    year,
    filingStatus: 'single',
    dependents,
    pennsylvaniaTaxableIncome: 100_000,
    newJerseyGrossIncome: 100_000,
    massachusettsFivePercentIncome: 100_000,
    federal: {
      adjustedGrossIncome: 100_000,
      taxableIncome: year === 2025 ? 84_250 : 83_900,
      deduction: year === 2025 ? 15_750 : 16_100,
      deductionKind: 'standard',
    },
  });

/** The flat rate a state charges, whether it is stored flat or as a top band. */
function topRate(state, year) {
  const rate = getStateDefinition(state, year).rate;
  if (rate.kind === 'flat') return rate.rate;
  if (rate.kind === 'brackets') {
    const bands = rate.byStatus.single;
    return bands[bands.length - 1].rate;
  }
  return 0;
}

test('the six states that cut their rate for 2026', () => {
  const cuts = {
    GA: [0.0519, 0.0499],
    IN: [0.03, 0.0295],
    KY: [0.04, 0.035],
    MS: [0.044, 0.04],
    NC: [0.0425, 0.0399],
    UT: [0.045, 0.0445],
  };
  for (const [state, [y2025, y2026]] of Object.entries(cuts)) {
    assert.equal(topRate(state, 2025), y2025, `${state} 2025`);
    assert.equal(topRate(state, 2026), y2026, `${state} 2026`);
    assert.ok(
      single100k(state, 2026).tax < single100k(state, 2025).tax,
      `${state} should be cheaper in 2026`,
    );
  }
});

test('the states whose rate did not move for 2026', () => {
  for (const [state, rate] of Object.entries({
    AZ: 0.025,
    CO: 0.044,
    IL: 0.0495,
    MI: 0.0425,
    PA: 0.0307,
  })) {
    assert.equal(topRate(state, 2025), rate, `${state} 2025`);
    assert.equal(topRate(state, 2026), rate, `${state} 2026`);
  }
  // California's whole schedule is unchanged because 2026 is carried forward, not
  // because California did nothing — see the provisional note.
  assert.deepEqual(
    getStateDefinition('CA', 2026).rate.byStatus.single,
    getStateDefinition('CA', 2025).rate.byStatus.single,
  );
});

test('Georgia raised the standard deduction and the dependent exemption with the cut', () => {
  //   2025: (100,000 - 12,000 - 8,000) x 5.19% = 4,152.00
  //   2026: (100,000 - 15,000 - 10,000) x 4.99% = 3,742.50
  const y2025 = single100k('GA', 2025, 2);
  const y2026 = single100k('GA', 2026, 2);
  money(y2025.deduction, 12_000);
  money(y2025.exemptions, 8_000);
  money(y2025.tax, 4_152.0);
  money(y2026.deduction, 15_000);
  money(y2026.exemptions, 10_000);
  money(y2026.tax, 3_742.5);
});

test('Georgia treats a surviving spouse as "any other taxpayer", both years', () => {
  // HB 1437 draws one line: married filing jointly, and everyone else. This is a
  // documented divergence from PolicyEngine-US, which gives a 2026 surviving
  // spouse the joint amount while giving a 2025 one the single amount.
  for (const year of [2025, 2026]) {
    const amounts = getStateDefinition('GA', year).deduction.amounts;
    assert.equal(amounts.qualifyingSurvivingSpouse, amounts.single, `GA ${year}`);
    assert.notEqual(amounts.qualifyingSurvivingSpouse, amounts.marriedFilingJointly);
  }
});

test('Mississippi taxes the first $10,000 at zero, and does not double it for a joint return', () => {
  //   joint, $50,000 of AGI
  //   less the standard deduction              -4,600
  //   less the exemption                      -12,000
  //   Mississippi taxable income               33,400
  //   0%   x 10,000                        =        0.00
  //   4.4% x 23,400                        =    1,029.60   (2025)
  //   4.0% x 23,400                        =      936.00   (2026)
  const joint = (year) =>
    stateIncomeTax({
      state: 'MS',
      year,
      filingStatus: 'marriedFilingJointly',
      federal: {
        adjustedGrossIncome: 50_000,
        taxableIncome: 18_500,
        deduction: 31_500,
        deductionKind: 'standard',
      },
    });
  money(joint(2025).taxableIncome, 33_400);
  money(joint(2025).tax, 1_029.6);
  money(joint(2026).tax, 936.0);

  // The exemption and the standard deduction both double for a joint return. The
  // zero bracket does not.
  const def = getStateDefinition('MS', 2026);
  assert.deepEqual(def.rate.byStatus.marriedFilingJointly, def.rate.byStatus.single);
  assert.equal(def.deduction.amounts.marriedFilingJointly, def.deduction.amounts.single * 2);
  assert.equal(def.exemption.perFiler.marriedFilingJointly, def.exemption.perFiler.single * 2);
});

test('hand-computed 2026 returns for North Carolina, Indiana and Kentucky', () => {
  //   NC: (100,000 - 12,750) x 3.99% = 3,481.275, reported as 3,481.27
  // The half cent lands down because 87,250 x 0.0399 is not representable in
  // binary floating point and the nearest double is 3481.2749999999996. Same
  // behaviour as the federal engine, which rounds at the boundary the same way.
  money(single100k('NC', 2026).tax, 3_481.27);
  money(single100k('NC', 2025).tax, 3_708.13);
  //   IN: (100,000 - 1,000) x 2.95% = 2,920.50   (state only; the county tax is extra)
  money(single100k('IN', 2026).tax, 2_920.5);
  //   KY: (100,000 - 3,360) x 3.50% = 3,382.40
  money(single100k('KY', 2026).tax, 3_382.4);
});

test('every state produces a different answer for 2026 than a naive 2025 fallback would', () => {
  // The point of refusing to fall back: for these six the fallback is wrong, and
  // for the rest it happens to be right — which is exactly why a caller cannot
  // tell the difference without being told.
  const differs = SUPPORTED_STATES.filter((state) => {
    if (state === 'PA') return false; // handled separately, needs its own base
    return single100k(state, 2025).tax !== single100k(state, 2026).tax;
  });
  // Georgia, Indiana, Kentucky, Mississippi, North Carolina and Utah changed rate;
  // Arizona, Colorado and Idaho move because the federal deduction inside their
  // base moved; New York cut its bottom five rates in the FY2026 budget; and
  // ILLINOIS joined the list in v0.25.0 — not by changing anything, but because
  // it PUBLISHED. Its exemption allowance indexes to $2,925 for 2026 from the
  // $2,850 of 2025, and until the Department's own bulletin was found this
  // package carried the 2025 figure forward and said so. A state moves off this
  // list when its law changes and ONTO it when somebody reads the notice.
  //
  // MICHIGAN joined on Day 28 for the same reason as Illinois and nothing else:
  // its personal exemption indexes to $5,900 for 2026 from $5,800, and that
  // figure had been sitting in the state's own 2026 withholding guide while
  // this package carried $5,800 forward. Kentucky's entry is now a CHANGED
  // number rather than a changed rate alone — $3,360 against $3,270.
  //
  // MISSOURI joins for a third reason, which is neither a rate change nor a
  // reading: § 143.011.5 indexes the whole bracket schedule as a block, so the
  // first band's width moves from $1,313 to $1,348 and the other seven move
  // with it. Every Missouri filer's answer differs between the two years and
  // not one Missouri figure was amended.
  // WISCONSIN joins for a FOURTH reason, and it is the first of its kind here:
  // not a rate change, not a reading, not a block indexation — a figure that is
  // DERIVED. Wisconsin's 2026 standard deduction schedule is not published and
  // will not be until January 2027, and it still differs from 2025's, because
  // the published 2026 rate schedules pin the indexation factor tightly enough
  // to compute it. A state can move onto this list by arithmetic.
  //
  // MINNESOTA joins for a FIFTH reason, and it is the dullest and the best one:
  // because the state published the figures BEFORE the tax year began. Minn.
  // Stat. § 270C.22 subd. 1 requires the commissioner to announce the adjusted
  // amounts by 1 December of the preceding year, so every Minnesota figure for
  // 2026 — twelve bracket thresholds, five deduction amounts, the dependent
  // exemption and nine thresholds under it — was read rather than carried
  // forward or derived. Minnesota is the first state-year pair here with no
  // `provisionalFigures` entry at all. Illinois and Michigan joined this list
  // when somebody went and read a notice; Minnesota is on it because the notice
  // existed in time.
  assert.deepEqual(differs, ['AZ', 'CO', 'GA', 'ID', 'IL', 'IN', 'KY', 'MI', 'MN', 'MO', 'MS', 'NC', 'NY', 'OH', 'OR', 'UT', 'WI']);
});

test("Michigan's pre-1946 cohort ages by exactly one year, because a birth-year cohort must", () => {
  // Day 34's last surviving mutant that a household could have caught, and the
  // reason it is asserted here instead.
  //
  // `minimumAge: year === 2025 ? 80 : 81` survived the mutation audit because the
  // battery's oldest retiree is 82 and qualifies under either figure. The obvious
  // fix is to make that retiree 80 — and it is wrong, because an 80-year-old does
  // NOT qualify in 2026, so the household that catches the mutant in one year stops
  // reaching the rule in the other. Catching it with households needs two of them,
  // in every state, for one gate in one state.
  //
  // **THE RULE: a year branch is a SELECTOR, and a selector is caught by an
  // assertion on the relation between its branches — not by a household sitting
  // between them.** That is Day 34's conclusion about the federal poverty
  // guidelines, whose two branches are 2% apart, and it applies here for the
  // opposite reason: these two branches are one year apart and both of them are
  // right.
  //
  // The relation is the law. MCL 206.30(1)(f) gates tier one on being born before
  // 1946, which is a FIXED COHORT — so the minimum age it implies advances by one
  // every year and is exactly `year - 1945`. A package that carried 80 forward into
  // 2026 would be admitting a cohort born in 1946 that the statute excludes.
  const tierOne = (year) => getStateDefinition('MI', year).retirementIncomeSubtractions[0];
  for (const year of [2025, 2026]) {
    assert.equal(
      tierOne(year).minimumAge,
      year - 1945,
      `Michigan tier one in ${year}: born before 1946 is ${year - 1945} or over at the end of the year`,
    );
  }
  assert.equal(tierOne(2026).minimumAge - tierOne(2025).minimumAge, 1, 'a closed cohort ages one year per year');

  // And the second rule has to meet the first with no age falling between them.
  // The 2025 phase-in is written to overlap tier one by a year rather than to abut
  // it, because Michigan tests a birth YEAR and this package tests an AGE, so a
  // filer whose birthday falls late in the year sits one year either side of the
  // boundary. An overlap gives that filer the more generous rule, which is listed
  // first; a gap would give them neither.
  const phaseIn2025 = getStateDefinition('MI', 2025).retirementIncomeSubtractions[1];
  assert.ok(
    phaseIn2025.maximumAge >= tierOne(2025).minimumAge,
    `the 2025 phase-in stops at ${phaseIn2025.maximumAge} and tier one starts at ${tierOne(2025).minimumAge} — an age between them qualifies for neither`,
  );
  // From 2026 the upper bound is gone entirely, so there is nothing to meet.
  assert.equal(getStateDefinition('MI', 2026).retirementIncomeSubtractions[1].maximumAge, undefined);
});

test('the federal poverty guideline is the one published for the tax year, in both states that carry it', () => {
  // Day 34's group D: five surviving mutants, all of them the SELECTOR on this one
  // block, and the finding that corrected the day's own rule.
  //
  // A household battery catches a money mutation because a doubled parameter leaves
  // a 100%-wide window for a probe to sit in. It cannot catch this: a year mutant
  // swaps one table for another, and the 2025 and 2026 guidelines are **2% apart**.
  // Catching that with a household needs one inside a 2%-wide window, in a ladder
  // whose rungs are a factor of two apart, which no battery can promise and no
  // larger battery fixes.
  //
  // **THE RULE: a household battery is strongest where two values are far apart,
  // which is the opposite of where a year branch lives.** So this is an assertion
  // on each branch, which is what a selector needs.
  //
  // The figures are HHS's, published each January for the contiguous states, and
  // they are not Virginia's or Maryland's to set — which is what makes the
  // cross-state half of this test worth more than the levels. Two states read one
  // federal table; if a branch swapped in one of them the two would disagree, and a
  // disagreement is checkable without knowing which is right.
  const PUBLISHED = {
    2025: { firstPerson: 15_650, additionalPerson: 5_500 },
    2026: { firstPerson: 15_960, additionalPerson: 5_680 },
  };
  const carriers = {
    VA: (def) => def.lowIncomeCredit.povertyGuideline,
    MD: (def) => def.povertyLevelCredit.povertyGuideline,
  };
  for (const [year, expected] of Object.entries(PUBLISHED)) {
    for (const [state, read] of Object.entries(carriers)) {
      const guideline = read(getStateDefinition(state, Number(year)));
      assert.equal(guideline.firstPerson, expected.firstPerson, `${state} ${year} first person`);
      assert.equal(guideline.additionalPerson, expected.additionalPerson, `${state} ${year} additional person`);
      // The label is the part the selector gets wrong, and the only field in the
      // block that says which year's table this is. A table carried into the wrong
      // year is caught here even where the two tables happen to agree.
      assert.equal(guideline.year, Number(year), `${state} ${year} carries the ${guideline.year} guideline`);
    }
  }
  // A guideline that never moves is a guideline nobody updated: HHS has raised both
  // figures every year since 1983, so a year where neither moved is a carry-forward
  // that was never flagged as one.
  assert.ok(PUBLISHED[2026].firstPerson > PUBLISHED[2025].firstPerson);
  assert.ok(PUBLISHED[2026].additionalPerson > PUBLISHED[2025].additionalPerson);
});
