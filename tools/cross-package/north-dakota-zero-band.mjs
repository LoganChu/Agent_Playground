#!/usr/bin/env node
/**
 * Is North Dakota's zero bracket still the federal 12% bracket — and is it
 * still not, in 2026?
 *
 * ## Why this exists
 *
 * HB 1158 of North Dakota's 68th Legislative Assembly (2023) rebuilt the state
 * schedule as 0% / 1.95% / 2.50%, and the top of the single filer's zero band
 * came out at `$44,725`. That is, to the dollar, the top of the **federal 12%
 * bracket** for 2023. N.D.C.C. § 57-38-30.3(1)(e) then indexes the state
 * thresholds by the federal cost-of-living adjustment, so the two tracked
 * exactly through 2024 and 2025 as well:
 *
 * ```text
 *   year   ND single 0% band   federal 12% bracket
 *   2023             44,725                 44,725
 *   2024             47,150                 47,150
 *   2025             48,475                 48,475
 *   2026             49,575                 50,400   <- they part
 * ```
 *
 * **In 2026 they part, and nothing about North Dakota changed.** OBBBA § 70101
 * substituted 2016 for 2017 as the chained-CPI base year **for the 10% and 12%
 * brackets alone**, for tax years beginning after 31 December 2025 — one extra
 * year of indexation for those two brackets and no other. Every other federal
 * bracket keeps 2017, and North Dakota's own provision was untouched, so the
 * state figure got the ordinary adjustment and the federal one got the extra
 * year.
 *
 * `$825` of zero-rated income, `$16.09` of North Dakota tax at 1.95%.
 *
 * **THE RULE THIS GUARDS: A COINCIDENCE THAT HELD FOR THREE YEARS LOOKS EXACTLY
 * LIKE A RULE, AND THE PACKAGE THAT LEARNED IT FROM THE DATA IS WRONG IN THE
 * FOURTH.** `states/north-dakota.ts` stores the published figures and derives
 * nothing, which is the right answer — and nothing inside that package could
 * say so, because the fact it rests on belongs to the other one. A single
 * repository holding both engines can check it; a reader holding one cannot.
 *
 * ## What it checks
 *
 * Nothing here is hard-coded but the two years and the statutory prose. Both
 * figures are read out of the two packages.
 *
 *   1. For 2025, North Dakota's single zero band EQUALS us-federal-tax's 12%
 *      bracket ceiling. The coincidence, pinned, so its ending is an event.
 *   2. For 2026, it does NOT — and the gap is `$825`, which is the extra year
 *      of indexation OBBBA § 70101 gave the 10% and 12% brackets.
 *   3. The gap appears in the 12% bracket and NOT in the 22% one. If North
 *      Dakota had simply fallen behind the whole federal schedule, every
 *      bracket would have moved apart; the 22% ceiling moved by the ordinary
 *      factor, which is what identifies § 70101 as the cause rather than a
 *      state figure going stale.
 *   4. The joint, separate and head-of-household zero bands are NOT the federal
 *      12% ceilings in any year, so the coincidence is the single column's
 *      alone and nobody should generalise it.
 *
 * Run with `--check` for CI; without it, it prints the comparison.
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
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
      'This tool reads both engines, so both must be built. Run:',
      `  (cd packages/${pkg} && npm install && npm run build)`,
      '',
      `${what} is what it needs from it.`,
    );
  }
}

const federal = await load('us-federal-tax', 'the single-filer ordinary rate brackets');
const state = await load('us-state-tax', "North Dakota's rate schedule");

const FEDERAL_YEAR = { 2025: federal.YEAR_2025, 2026: federal.YEAR_2026 };
const problems = [];

/** The ceiling of the federal single bracket charged at `rate`. */
const federalCeiling = (year, rate) => {
  const band = FEDERAL_YEAR[year].ordinaryBrackets.single.find((b) => b.rate === rate);
  if (!band) {
    fail(
      `us-federal-tax has no ${rate * 100}% single bracket for ${year}.`,
      '',
      'This tool identifies the brackets by their RATE rather than by position,',
      'because a schedule that gained or lost a band would silently renumber them.',
    );
  }
  return band.upTo;
};

/** North Dakota's zero-band ceiling for a filing status. */
const ndZeroBand = (year, status) => {
  const def = state.getStateDefinition('ND', year);
  if (!def) fail(`us-state-tax has no North Dakota definition for ${year}.`);
  if (def.rate.kind !== 'brackets') {
    fail(
      `ND ${year}: rate.kind is '${def.rate.kind}', not 'brackets'.`,
      '',
      "North Dakota's first band is a BRACKET taxed at 0% and not a deduction. A flat",
      'rule would have no zero band for this tool to read, and would charge the first',
      'dollar of income.',
    );
  }
  const first = def.rate.byStatus[status][0];
  if (first.rate !== 0) {
    fail(
      `ND ${year} ${status}: the first band is taxed at ${first.rate}, not 0.`,
      '',
      'The zero band is the whole subject of this check.',
    );
  }
  return first.upTo;
};

// ------------------------- 1 and 2. the coincidence, and the year it ended
const EXPECTED = { 2025: 'equal', 2026: 'apart' };
const rows = [];
for (const year of [2025, 2026]) {
  const nd = ndZeroBand(year, 'single');
  const fed = federalCeiling(year, 0.12);
  const same = nd === fed;
  rows.push({ year, nd, fed, same });
  if (same !== (EXPECTED[year] === 'equal')) {
    problems.push(
      same
        ? `${year}: North Dakota's zero band and the federal 12% bracket are both ` +
          `$${nd.toLocaleString()}, and from 2026 they must NOT be: OBBBA § 70101 gives the ` +
          `federal 10% and 12% brackets an extra year of indexation that North Dakota's ` +
          `§ 57-38-30.3(1)(e) does not get.`
        : `${year}: North Dakota's zero band is $${nd.toLocaleString()} and the federal 12% ` +
          `bracket is $${fed.toLocaleString()}, and through 2025 they must be EQUAL — HB 1158 ` +
          `took the federal 2023 figure as its base and both are indexed the same way.`,
    );
  }
}

const gap = rows[1].fed - rows[1].nd;
if (gap !== 825) {
  problems.push(
    `2026: the gap is $${gap.toLocaleString()} and § 70101's extra year of indexation is $825. ` +
      `A different gap means one of the two figures moved for a reason this tool does not know about.`,
  );
}

// -------------------- 3. the 22% bracket did NOT part, which names the cause
//
// North Dakota's second threshold and the federal 22% ceiling were never equal,
// so this compares their year-on-year GROWTH instead. If North Dakota had
// simply fallen behind the federal schedule, both comparisons would move; the
// 12% bracket moving alone is what identifies § 70101.
const growth = (from, to) => to / from;
const ndMiddleGrowth = growth(
  state.getStateDefinition('ND', 2025).rate.byStatus.single[1].upTo,
  state.getStateDefinition('ND', 2026).rate.byStatus.single[1].upTo,
);
const fed22Growth = growth(federalCeiling(2025, 0.22), federalCeiling(2026, 0.22));
const fed12Growth = growth(federalCeiling(2025, 0.12), federalCeiling(2026, 0.12));
// The two ordinary adjustments agree to within a rounding step; the 12% one
// does not, by more than ten times that.
if (Math.abs(ndMiddleGrowth - fed22Growth) > 0.0005) {
  problems.push(
    `North Dakota's 1.95% ceiling grew by ${(ndMiddleGrowth * 100 - 100).toFixed(4)}% and the ` +
      `federal 22% ceiling by ${(fed22Growth * 100 - 100).toFixed(4)}%. They should agree: both ` +
      `are the ordinary adjustment, and the whole claim is that only the 10% and 12% brackets ` +
      `got anything else.`,
  );
}
if (fed12Growth - fed22Growth < 0.01) {
  problems.push(
    `the federal 12% ceiling grew by ${(fed12Growth * 100 - 100).toFixed(4)}% and the 22% one by ` +
      `${(fed22Growth * 100 - 100).toFixed(4)}%. § 70101's extra year should put them well apart; ` +
      `if it does not, the 2026 federal table no longer carries the provision this tool explains.`,
  );
}

// ----------- 4. and the coincidence is the SINGLE column's alone, in both years
for (const year of [2025, 2026]) {
  for (const status of ['marriedFilingJointly', 'marriedFilingSeparately', 'headOfHousehold']) {
    if (ndZeroBand(year, status) === federalCeiling(year, 0.12)) {
      problems.push(
        `ND ${year} ${status}: the zero band equals the federal SINGLE 12% ceiling. The ` +
          `coincidence HB 1158 created is the single column's alone — the other three bases ` +
          `are North Dakota's own figures and were never federal ones.`,
      );
    }
  }
}

for (const { year, nd, fed, same } of rows) {
  console.log(
    `${year}  ND zero band $${nd.toLocaleString().padStart(7)}   ` +
      `federal 12% bracket $${fed.toLocaleString().padStart(7)}   ` +
      `${same ? 'EQUAL' : `apart by $${(fed - nd).toLocaleString()}`}`,
  );
}

if (problems.length) {
  console.error('');
  console.error("North Dakota's zero band no longer relates to the federal 12% bracket as recorded.");
  console.error('');
  for (const p of problems) console.error(`  ${p}`);
  console.error('');
  console.error('OBBBA § 70101 substitutes 2016 for 2017 as the chained-CPI base year for the');
  console.error('federal 10% and 12% brackets alone, for tax years beginning after 31 December');
  console.error("2025. North Dakota's N.D.C.C. § 57-38-30.3(1)(e) was not amended.");
  if (CHECK) process.exit(1);
} else {
  console.log('');
  console.log(
    'ok — the coincidence holds for 2025 and is $825 wide in 2026, the 1.95% ceiling tracks ' +
      'the ordinary federal adjustment, and no other filing status was ever the federal figure',
  );
}
