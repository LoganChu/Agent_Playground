// What Minnesota's alternative minimum tax reaches, measured — because this
// package does not model it, and "does not model it" is a different claim from
// "it does not matter".
//
// § 290.091 charges 6.75% of alternative minimum taxable income less an
// exemption, payable only to the extent it exceeds the ordinary tax. For a
// filer with no preference items and no itemised deductions — which is every
// household this package can express, because it takes none of them as inputs —
// AMTI is federal AGI less the Minnesota subtractions the M1MT allows back. So
// the comparison can be made exactly here, without the rule being in the
// engine.
//
// ## Two corrections, and the second one is the reason this file is careful
//
// **The first version of Minnesota's notes said the AMT "cannot bind a filer
// whose income is wages alone, at any income, in either year".** That was
// written from two hand-worked households and it is false: Minnesota's
// dependent exemption reduces the ordinary tax and does not reduce AMTI, so
// every dependent widens the gap in the AMT's favour. A sweep found 82,698
// households where the AMT wins.
//
// **The second version said the AMT could never reach a filer with two
// dependents or fewer. That is false too, and the DIFFERENTIAL GRID is what
// said so** — PolicyEngine-US charged $598.63 of Minnesota AMT to the grid's
// surviving spouse with ONE child at $300,000, on a household this file had
// just asserted was clear. The reason is a federal statute:
//
// § 290.091, subd. 3 does not state a phase-out rate. It says the exemption is
// "subject to the phase out under section 55(d)(2) of the Internal Revenue
// Code", substituting Minnesota's own AMTI — and **the One Big Beautiful Bill
// Act raised that rate from 25% to 50% for tax years beginning after 31
// December 2025.** So Minnesota's AMT exemption phases out twice as fast in
// 2026 as in 2025, by operation of a federal amendment, and the state's
// published exemption amount did not change to signal it.
//
// Under 50%, the AMT reaches a Minnesota filer **with no dependents at all.**
//
// THE RULE, and it is Day 44's with a federal statute standing in for the
// state's own words: a rule incorporated BY REFERENCE is a rule whose
// parameters live in somebody else's code, and reading the state's section
// tells you nothing about whether they moved. Both false claims above came from
// reading § 290.091 and stopping.
//
// ## The open question, which is not ours to settle
//
// Whether Minnesota's 2026 AMT really phases out at 50% depends on Minnesota's
// IRC conformity date (§ 290.01, subd. 19) picking up the OBBBA amendment to
// § 55(d)(2). This package does not model the AMT either way, so nothing here
// turns on it — but the two readings give very different answers and the
// measurements below are therefore given for BOTH. PolicyEngine-US takes the
// conforming reading.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { stateIncomeTax } from './strict.mjs';

/** § 290.091, subd. 6. */
const AMT_RATE = 0.0675;

/**
 * 26 U.S.C. § 55(d)(2)'s phase-out rate, adopted by § 290.091 subd. 3 by
 * reference: 25% through 2025 and 50% from 2026 under the OBBBA.
 */
const CONFORMING_PHASE_OUT = { 2025: 0.25, 2026: 0.5 };

/** The AMTI above which the exemption is withdrawn. Statutory and unindexed. */
const PHASE_OUT_START = {
  single: 112_500,
  marriedFilingJointly: 150_000,
  marriedFilingSeparately: 75_000,
  headOfHousehold: 112_500,
  qualifyingSurvivingSpouse: 150_000,
};

/** The exemption, indexed. Schedule M1MT line 21 and the 2026 inflation table. */
const EXEMPTION = {
  2025: {
    single: 71_540,
    marriedFilingJointly: 95_390,
    marriedFilingSeparately: 47_700,
    headOfHousehold: 71_540,
    qualifyingSurvivingSpouse: 95_390,
  },
  2026: {
    single: 73_100,
    marriedFilingJointly: 97_470,
    marriedFilingSeparately: 48_740,
    headOfHousehold: 73_100,
    qualifyingSurvivingSpouse: 97_470,
  },
};

const STATUSES = Object.keys(PHASE_OUT_START);

/** The ordinary Minnesota tax and the gross AMT on one household. */
function compare(year, filingStatus, dependents, agi, options = {}) {
  const { agedBlind = 0, taxableSocialSecurity = 0, phaseOut = CONFORMING_PHASE_OUT[year] } =
    options;
  const result = stateIncomeTax(
    {
      state: 'MN',
      year,
      filingStatus,
      dependents,
      filerAge: agedBlind >= 1 ? 70 : undefined,
      spouseAge: agedBlind >= 2 ? 70 : undefined,
      taxableSocialSecurity,
      federal: {
        adjustedGrossIncome: agi,
        taxableIncome: agi,
        deduction: 0,
        deductionKind: 'standard',
      },
    },
    { strict: true },
  );
  // The M1MT allows the Social Security subtraction back out of AMTI, so the
  // engine's own computed subtractions are the right figure to remove.
  const subtracted = result.computedSubtractions.reduce((sum, item) => sum + item.amount, 0);
  const amti = Math.max(0, agi - subtracted);
  const exemption = Math.max(
    0,
    EXEMPTION[year][filingStatus] - phaseOut * Math.max(0, amti - PHASE_OUT_START[filingStatus]),
  );
  const gross = AMT_RATE * Math.max(0, amti - exemption);
  return { ordinary: result.tax, gross, excess: gross - result.tax };
}

/**
 * The band of AGI, to the dollar, over which the AMT exceeds the ordinary tax.
 *
 * A coarse sweep to find a caught income, then a bisection on each edge. The
 * first version of this walked every dollar to $2,000,000 and took the suite
 * past its timeout — two million engine calls per band and sixty bands. The
 * bisection is sound because the excess crosses zero exactly once on each side
 * of the band: below it the ordinary tax is winning and the gap is closing,
 * above it the 9.85% rate has taken over and the gap is opening again.
 */
function band(year, filingStatus, dependents, options = {}) {
  const caught = (agi) => compare(year, filingStatus, dependents, agi, options).excess > 0.005;
  let inside = null;
  for (let agi = 1_000; agi <= 2_000_000; agi += 1_000) {
    if (caught(agi)) {
      inside = agi;
      break;
    }
  }
  if (inside === null) return [null, null];
  // Lowest caught dollar: the largest uncaught income below `inside`, plus one.
  let lo = 0;
  let hi = inside;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (caught(mid)) hi = mid;
    else lo = mid;
  }
  const low = hi;
  // Highest caught dollar, by the mirror image.
  lo = inside;
  hi = 2_000_001;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (caught(mid)) lo = mid;
    else hi = mid;
  }
  return [low, lo];
}

/** A band's edges are the edges: caught inside, clear one dollar outside. */
function assertEdges(year, filingStatus, dependents, options = {}) {
  const [low, high] = band(year, filingStatus, dependents, options);
  if (low === null) return;
  const excess = (agi) => compare(year, filingStatus, dependents, agi, options).excess;
  const where = `${year} ${filingStatus} ${dependents}`;
  assert.ok(excess(low) > 0.005, `${where}: the low edge is not caught`);
  assert.ok(excess(low - 1) <= 0.005, `${where}: one dollar below the low edge is caught`);
  assert.ok(excess(high) > 0.005, `${where}: the high edge is not caught`);
  assert.ok(excess(high + 1) <= 0.005, `${where}: one dollar above the high edge is caught`);
}

test('under the 2026 rate the AMT reaches a filer with NO dependents', () => {
  // The correction the differential grid forced. At § 55(d)(2)'s post-OBBBA
  // 50%, four of the five statuses are caught with no dependents at all, and
  // the one that is not is caught with two.
  assert.deepEqual(band(2026, 'headOfHousehold', 0), [202_224, 315_533]);
  assert.deepEqual(band(2026, 'marriedFilingJointly', 0), [290_580, 380_947]);
  assert.deepEqual(band(2026, 'qualifyingSurvivingSpouse', 0), [290_580, 380_947]);
  assert.deepEqual(band(2026, 'marriedFilingSeparately', 0), [145_307, 190_473]);
  assert.deepEqual(band(2026, 'single', 0), [null, null], 'a single filer alone is clear');
  assert.deepEqual(band(2026, 'single', 2), [222_680, 259_819]);
  // The bisection above assumes one crossing on each side. Asserted rather than
  // assumed: every edge quoted is caught and one dollar outside it is not.
  for (const filingStatus of STATUSES) assertEdges(2026, filingStatus, 0);
  assertEdges(2026, 'single', 2);
});

test('under the pre-OBBBA 25 per cent it takes three dependents or more', () => {
  // 2025's own rate, and what 2026 would look like if Minnesota turns out not
  // to conform to the amendment. The contrast is the point: the same state
  // statute, the same published exemption, and a federal amendment moves the
  // first household caught from six dependents to none.
  assert.deepEqual(band(2025, 'marriedFilingSeparately', 3), [132_784, 183_025]);
  assert.deepEqual(band(2025, 'headOfHousehold', 3), [255_825, 304_079]);
  assert.deepEqual(band(2025, 'marriedFilingJointly', 6), [265_376, 366_050]);
  assert.deepEqual(band(2025, 'single', 7), [187_363, 249_050]);
  // And nothing with two dependents or fewer is caught at 25%, in either year.
  for (const year of [2025, 2026]) {
    for (const filingStatus of STATUSES) {
      for (const dependents of [0, 1, 2]) {
        assert.deepEqual(
          band(year, filingStatus, dependents, { phaseOut: 0.25 }),
          [null, null],
          `${year} ${filingStatus} with ${dependents}`,
        );
      }
    }
  }
});

test('it binds on a BAND of income and not a half-line', () => {
  // Every band above is bounded at both ends, and that is structural rather
  // than a coincidence of the figures: the AMT wins where the exemption it
  // phases out is still worth something and the 9.85% top rate has not yet
  // taken over, so a filer can be too rich for it as easily as too poor.
  for (const year of [2025, 2026]) {
    for (const filingStatus of STATUSES) {
      for (let dependents = 0; dependents <= 8; dependents += 1) {
        const [low, high] = band(year, filingStatus, dependents);
        if (low === null) continue;
        assert.ok(high < 2_000_000, `${year} ${filingStatus} ${dependents} is unbounded above`);
        assert.ok(
          compare(year, filingStatus, dependents, high + 1).excess <= 0.005,
          `${year} ${filingStatus} ${dependents} still caught above its band`,
        );
      }
    }
  }
});

test('the largest shortfall measured is $4,735.905', () => {
  // The figure to beat when § 290.091 is implemented: a 2026 head of household
  // with eight dependents and one filer over 65, at $258,750 of wages. The
  // half-cent is the usual one — the ordinary tax is the figure the engine
  // reports, rounded, and the gross AMT is computed here and is not.
  const seen = compare(2026, 'headOfHousehold', 8, 258_750, { agedBlind: 1 });
  assert.ok(Math.abs(seen.ordinary - 12_729.72) < 0.005, `ordinary: ${seen.ordinary}`);
  assert.ok(Math.abs(seen.gross - 17_465.625) < 0.005, `gross AMT: ${seen.gross}`);
  assert.ok(Math.abs(seen.excess - 4_735.905) < 0.005, `shortfall: ${seen.excess}`);
});

test('the grid household that found all this is reproduced here', () => {
  // `surviving-spouse-high-MN-300000-0-0-0-0`: a surviving spouse aged 47 with
  // a ten-year-old and $300,000 of wages. PolicyEngine-US 2.15.3 reports
  // $18,727.88 of Minnesota tax against this package's $18,125.10, and
  // $598.63 of the $602.78 gap is its `mn_amt` — the rest is its uprated 2026
  // parameters, which are a separate entry in `known-divergences.json`.
  //
  // Computed on the PUBLISHED parameters rather than its uprated ones, the AMT
  // on this household is $608.18.
  const seen = compare(2026, 'qualifyingSurvivingSpouse', 1, 300_000);
  assert.ok(Math.abs(seen.ordinary - 18_125.1) < 0.005, `ordinary: ${seen.ordinary}`);
  assert.ok(Math.abs(seen.excess - 608.18) < 0.005, `AMT payable: ${seen.excess}`);
  // And it is NOT caught under the 25% reading, which is exactly why the
  // conformity question is worth stating rather than resolving by assumption.
  assert.ok(
    compare(2026, 'qualifyingSurvivingSpouse', 1, 300_000, { phaseOut: 0.25 }).excess < 0,
    'the same household is clear at 25%',
  );
});
