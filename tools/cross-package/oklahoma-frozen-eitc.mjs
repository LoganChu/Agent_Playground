#!/usr/bin/env node
/**
 * How far has the federal earned income credit moved away from the one
 * Oklahoma's statute points at — and is it still moving?
 *
 * ## Why this exists
 *
 * 68 O.S. § 2357.43 gives Oklahoma an earned income credit of **5% of the
 * federal credit**, and then says which federal credit: the one computed under
 * the Internal Revenue Code **as it existed on 31 December 2020.** The federal
 * credit is indexed every year. Oklahoma's base is a date.
 *
 * So "5% of the federal EITC" is a true sentence about Oklahoma and a wrong
 * instruction to a model, and the gap between the two readings is not a
 * constant — it widens every year, by construction, with nobody legislating
 * anything.
 *
 * ```text
 *   max federal EITC        2020 (Oklahoma's base)   2025        2026
 *   no children                            538        649         664
 *   one child                            3,584      4,328       4,427
 *   two children                         5,920      7,152       7,316
 *   three or more                        6,660      8,046       8,231
 * ```
 *
 * A three-child Oklahoma family at the plateau is owed `$333.00`. A model
 * reading this year's federal credit gives them `$402.30` for 2025 and
 * `$411.55` for 2026 — **20.8% and 23.6% too much**, of a credit that is
 * refundable, to the households it exists for.
 *
 * **THE RULE THIS GUARDS: A STATE THAT BORROWS A FEDERAL FIGURE AS OF A DATE
 * HAS NOT BORROWED THE FEDERAL FIGURE.** `states/oklahoma.ts` therefore ships
 * **no** `earnedIncomeCredit` at all, which is the one judgement call in that
 * module, and this file is the evidence for it. The alternative was a
 * `matchRate: 0.05` reading `federal.earnedIncomeCredit` — a number known to be
 * a fifth too large, shipped because the shape of the rule happened to fit.
 *
 * **And neither package could make this check from inside itself.** The frozen
 * 2020 table is a fact about Oklahoma law and the indexed 2025 and 2026 tables
 * belong to `us-federal-tax`. A repository holding both can compare them; a
 * reader holding one cannot. That is the same argument as
 * `north-dakota-zero-band.mjs`, pointed at a credit instead of a bracket — and
 * it is the opposite case in one respect worth noting: North Dakota's
 * coincidence was a state figure that tracked a federal one and stopped, where
 * Oklahoma's statute never tracked it at all and every passing year makes the
 * mistake bigger.
 *
 * ## What it checks
 *
 * Only the 2020 table and the statutory prose are written here. Every current
 * figure is read out of `us-federal-tax`.
 *
 *   1. The federal maxima this repository ships for 2025 and 2026 are STRICTLY
 *      GREATER, at every child count, than the 2020 figures Oklahoma's statute
 *      freezes. If a federal maximum ever fell below its 2020 value the sign of
 *      this whole finding would flip, and a model reading the current credit
 *      would be understating Oklahoma rather than overstating it.
 *   2. The overstatement, priced at 5% of the gap, matches the figures published
 *      in `states/oklahoma.ts` and in that package's README.
 *   3. THE GAP GROWS from 2025 to 2026 at every child count. This is the claim
 *      that makes the finding structural rather than a snapshot: it is what
 *      "one side is indexed and the other is a date" means, and it is the half
 *      a table of this year's numbers cannot show.
 *   4. Oklahoma ships no `earnedIncomeCredit` and no `ownEarnedIncomeCredit`, in
 *      both supported years — so the module and this evidence cannot drift
 *      apart. A future run that adds the rule has to delete this assertion, and
 *      deleting it means reading this comment.
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

const federal = await load('us-federal-tax', 'the earned income credit maxima by child count');
const state = await load('us-state-tax', "Oklahoma's definition, to confirm it ships no EITC rule");

const FEDERAL_YEAR = { 2025: federal.YEAR_2025, 2026: federal.YEAR_2026 };

/**
 * The maxima the Internal Revenue Code carried on 31 December 2020 — tax year
 * 2020, Rev. Proc. 2019-44 — which is the table § 2357.43 points at and the
 * only hard-coded data in this file.
 *
 * These are 2020 and not 2021: the American Rescue Plan Act raised the
 * childless credit to $1,502 for 2021 alone, and a reader who took "the most
 * recent year before the statute was written" would land on a figure nearly
 * three times the right one for a childless filer.
 */
const FROZEN_2020 = [538, 3_584, 5_920, 6_660];
const SHARE = 0.05;
const LABELS = ['no children', 'one child', 'two children', 'three or more'];

/** The published federal maxima for a year, by child count, read from the package. */
const federalMaxima = (year) => {
  const table = FEDERAL_YEAR[year]?.earnedIncomeCredit?.table;
  if (!Array.isArray(table)) {
    fail(
      `us-federal-tax has no earned income credit table for ${year}.`,
      '',
      'This tool reads the maxima out of that table rather than restating them,',
      'so a change to its shape must be reflected here deliberately.',
    );
  }
  if (table.length !== FROZEN_2020.length) {
    fail(
      `us-federal-tax's ${year} credit has ${table.length} child-count bands and`,
      `Oklahoma's frozen 2020 table has ${FROZEN_2020.length}.`,
      '',
      'The bands are compared by POSITION, which is only safe while both tables',
      'are indexed the same way (0, 1, 2, 3-or-more). If Congress adds a band,',
      'this comparison has to be rewritten rather than extended.',
    );
  }
  return table.map((band) => band.maximumCredit);
};

const problems = [];
const rows = [];
const gapByYear = {};

for (const year of [2025, 2026]) {
  const maxima = federalMaxima(year);
  gapByYear[year] = maxima.map((m, i) => m - FROZEN_2020[i]);
  for (let i = 0; i < FROZEN_2020.length; i += 1) {
    // 1. Every current maximum is above its 2020 value. The sign of the whole
    //    finding depends on this and nothing else.
    if (!(maxima[i] > FROZEN_2020[i])) {
      problems.push(
        `${year} ${LABELS[i]}: the federal maximum is ${maxima[i]} and the 2020 figure ` +
          `Oklahoma freezes is ${FROZEN_2020[i]}. This finding says a model reading the ` +
          `CURRENT credit overstates Oklahoma's, which is only true while the current ` +
          `figure is the larger one.`,
      );
    }
    rows.push({
      year,
      label: LABELS[i],
      frozen: FROZEN_2020[i],
      current: maxima[i],
      oklahoma: FROZEN_2020[i] * SHARE,
      naive: maxima[i] * SHARE,
      over: (maxima[i] - FROZEN_2020[i]) * SHARE,
    });
  }
}

// 2. The published prices, which `states/oklahoma.ts` and the README both quote.
const PUBLISHED_OVERSTATEMENT = {
  2025: [5.55, 37.2, 61.6, 69.3],
  2026: [6.3, 42.15, 69.8, 78.55],
};
for (const year of [2025, 2026]) {
  for (let i = 0; i < FROZEN_2020.length; i += 1) {
    const measured = Math.round(gapByYear[year][i] * SHARE * 100) / 100;
    const published = PUBLISHED_OVERSTATEMENT[year][i];
    if (measured !== published) {
      problems.push(
        `${year} ${LABELS[i]}: 5% of the gap measures ${measured.toFixed(2)} and ` +
          `states/oklahoma.ts publishes ${published.toFixed(2)}. Correct the note and the ` +
          `README, which both carry this table in prose.`,
      );
    }
  }
}

// 3. THE GAP GROWS. This is the structural half: a snapshot of either year
//    cannot show it, and it is what makes the error a trend rather than a size.
for (let i = 0; i < FROZEN_2020.length; i += 1) {
  if (!(gapByYear[2026][i] > gapByYear[2025][i])) {
    problems.push(
      `${LABELS[i]}: the gap is ${gapByYear[2025][i]} in 2025 and ${gapByYear[2026][i]} in ` +
        `2026, so it did not widen. Oklahoma's base is a date and the federal figure is ` +
        `indexed, so the gap widens in every year the federal credit rises — if this stops ` +
        `being true, either the federal credit was cut or § 2357.43 was amended.`,
    );
  }
}

// 4. And the module still ships no rule, so the evidence and the code agree.
for (const year of [2025, 2026]) {
  const def = state.getStateDefinition('OK', year);
  if (!def) fail(`us-state-tax has no Oklahoma definition for ${year}.`);
  for (const key of ['earnedIncomeCredit', 'ownEarnedIncomeCredit']) {
    if (def[key] !== undefined) {
      problems.push(
        `OK ${year} now declares ${key}. If that rule reads the CURRENT federal credit it ` +
          `is wrong by the figures above; if an input for the credit under 2020 law has ` +
          `been added, update this check to measure the new rule rather than its absence.`,
      );
    }
  }
}

if (!CHECK) {
  console.log("Oklahoma's earned income credit base, against the federal credit this repository ships");
  console.log('');
  console.log('  68 O.S. § 2357.43: 5% of the federal credit computed under the Internal');
  console.log('  Revenue Code AS IT EXISTED ON 31 DECEMBER 2020.');
  console.log('');
  console.log('  year  children        frozen   current     OK owed   naive 5%   over by');
  for (const r of rows) {
    console.log(
      `  ${r.year}  ${r.label.padEnd(14)}  ${String(r.frozen).padStart(6)}` +
        `  ${String(r.current).padStart(8)}  ${r.oklahoma.toFixed(2).padStart(10)}` +
        `  ${r.naive.toFixed(2).padStart(9)}  ${r.over.toFixed(2).padStart(8)}`,
    );
  }
  console.log('');
  for (const year of [2025, 2026]) {
    const i = 3;
    const pct = ((gapByYear[year][i] * SHARE) / (FROZEN_2020[i] * SHARE)) * 100;
    console.log(
      `  ${year}: a three-child family at the plateau is owed ` +
        `$${(FROZEN_2020[i] * SHARE).toFixed(2)} and a model reading this year's credit ` +
        `gives $${(FEDERAL_YEAR[year].earnedIncomeCredit.table[i].maximumCredit * SHARE).toFixed(2)}` +
        ` — ${pct.toFixed(1)}% too much.`,
    );
  }
  console.log('');
  console.log('  And the gap WIDENS at every child count:');
  for (let i = 0; i < FROZEN_2020.length; i += 1) {
    console.log(
      `    ${LABELS[i].padEnd(14)} ${String(gapByYear[2025][i]).padStart(6)} -> ` +
        `${String(gapByYear[2026][i]).padStart(6)}`,
    );
  }
  console.log('');
}

if (problems.length > 0) {
  fail(
    "Oklahoma's frozen earned income credit base no longer matches what this repository ships:",
    '',
    ...problems.map((p) => `  - ${p}`),
    '',
    'See tools/cross-package/oklahoma-frozen-eitc.mjs for what each assertion is for.',
  );
}

console.log(
  'ok — Oklahoma freezes the federal earned income credit at 31 December 2020, the ' +
    'current credit is larger at every child count in both years, 5% of the gap matches ' +
    'the published figures, THE GAP WIDENS from 2025 to 2026 in all four, and the state ' +
    'module still ships no credit rule.',
);
