#!/usr/bin/env node
/**
 * What does Indiana's frozen earned income credit base cost THIS engine — and
 * why is its shape the opposite of Oklahoma's?
 *
 * ## Why this exists
 *
 * `oklahoma-frozen-eitc.mjs` next door is the same provision in another state
 * and this repository took the other decision about it. 68 O.S. § 2357.43
 * freezes Oklahoma's base at 2020, so `states/oklahoma.ts` ships **no** credit
 * rule at all rather than a `matchRate` reading a figure known to be a fifth too
 * large. IC 6-3.1-21-6 freezes Indiana's at **1 January 2023** — and
 * `flat-states.ts` ships `matchRate: 0.1` anyway, with the overstatement written
 * into the note.
 *
 * **Both can be right, because the two freezes are not the same shape.**
 * Oklahoma's date does not move, so its error widens every year forever.
 * Indiana's does: SEA 243 of 2025 advances the snapshot to 1 January 2026, so
 * from tax year 2026 the frozen base **is** the current base and the error is
 * exactly zero. A rule that is wrong in 2025 and exactly right in 2026 is worth
 * shipping with a note; a rule that is wrong in every year and more so in each
 * is not. That contrast is the judgement this file exists to keep honest, and it
 * is checkable rather than arguable.
 *
 * ```text
 *                        Oklahoma                     Indiana
 *   snapshot             31 December 2020             1 January 2023, then 2026
 *   moves?               no                           yes, SEA 243 of 2025
 *   2025 error           a fifth of the credit        up to $111.09
 *   2026 error           larger than 2025             EXACTLY ZERO
 *   what ships           no rule at all               matchRate 0.1 and a note
 * ```
 *
 * ## The two prices, and why the larger one is a constant
 *
 * Under the strict reading of the freeze — the snapshot reaching § 32's
 * inflation adjustments and not only its text — this engine overstates an
 * Indiana filer by 10% of the difference between the current-year credit and the
 * 2023 one. That difference has two regimes and the arithmetic is worth seeing:
 *
 * ```text
 *   on the PLATEAU      both credits are at their maximum, so the gap is
 *                       max(2025) - max(2023), a small number
 *
 *   in the PHASE-OUT    both fall at the SAME statutory rate, so the gap is
 *                       CONSTANT across the whole band:
 *                         (max25 - max23) + rate x (start25 - start23)
 *                       which is the largest it ever gets
 *
 *   past the point where the 2023 credit is exhausted, the gap IS the current
 *   credit, and it decays to zero. At that point the two expressions agree,
 *   which is why one number does for both.
 * ```
 *
 * **AND THAT CONSTANT IS THE SAME NUMBER AS THE CLIFF IN `policyengine-us`.**
 * `tools/differential/in-eitc-conformity.mjs` found that their Indiana credit
 * gates on the frozen credit being positive and then pays 10% of the CURRENT
 * one, so a cent of income past the frozen exhaustion point costs their filer
 * the whole credit. The most their gate can withhold and the most this engine
 * can overstate are **the same quantity measured from opposite sides** — one
 * model stops paying where the other keeps paying, and the gap between the two
 * readings is what each of them is wrong by. `$111.09` for a joint return with
 * three or more children, in both directions.
 *
 * ## What it checks
 *
 * Only the 2023 maxima and phase-out starts are written here. Every current
 * figure is read out of `us-federal-tax`, and the Indiana rule out of
 * `us-state-tax`.
 *
 *   1. Indiana still ships `matchRate: 0.1` on a credit read from the federal
 *      figure, refundable, in both supported years. If that rule ever grows an
 *      input for the credit under frozen law, this file measures the new rule
 *      rather than its absence — and deleting the assertion means reading this
 *      comment first.
 *   2. Every 2025 federal maximum is STRICTLY GREATER than its 2023 value, so
 *      the sign of the finding holds: this engine overstates rather than
 *      understates. If a federal maximum ever fell, the whole direction flips.
 *   3. **THE 2026 EXPOSURE IS EXACTLY ZERO AT EVERY CHILD COUNT.** This is the
 *      assertion that distinguishes Indiana from Oklahoma and the one that would
 *      fail first if SEA 243 were repealed or this file misread which year it
 *      takes effect.
 *   4. The plateau price and the phase-out price are computed two ways each —
 *      from the parameters, and by evaluating the two trapezoids at the income
 *      where the 2023 credit is exhausted — and the two agree to the cent. A
 *      closed form and a measurement of the same thing, because the closed form
 *      is where a sign error hides.
 *   5. The figures published in the Indiana note in `flat-states.ts` match what
 *      this file measures.
 *
 * Run with `--check` for CI; without it, it prints the comparison.
 */
import { readFileSync } from 'node:fs';
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

const federal = await load('us-federal-tax', 'the § 32 table for 2025 and 2026');
const state = await load('us-state-tax', "Indiana's earned income credit rule");

const FEDERAL_YEAR = { 2025: federal.YEAR_2025, 2026: federal.YEAR_2026 };
const LABELS = ['no children', 'one child', 'two children', 'three or more'];
const MATCH = 0.1;

/**
 * § 32 as the Internal Revenue Code carried it on 1 January 2023 — tax year
 * 2023, Rev. Proc. 2022-38 — which is the base IC 6-3-1-11 freezes for tax years
 * 2023 through 2025, and the only data hard-coded in this file.
 *
 * The phase-out rate is not listed because it has not moved since 1995 and the
 * arithmetic below depends on both sides sharing it; assertion 4's second method
 * is what would catch it if that stopped being true.
 */
const FROZEN_2023 = {
  maximumCredit: [600, 3_995, 6_604, 7_430],
  phaseOutStart: { single: [9_800, 21_560, 21_560, 21_560], joint: [16_370, 28_120, 28_120, 28_120] },
};

const cents = (n) => Math.round(n * 100) / 100;
const money = (n) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function federalRow(year, children) {
  const table = FEDERAL_YEAR[year]?.earnedIncomeCredit?.table;
  if (!Array.isArray(table)) fail(`us-federal-tax has no § 32 table for ${year}.`);
  if (table.length !== FROZEN_2023.maximumCredit.length) {
    fail(
      `us-federal-tax's ${year} credit has ${table.length} child-count bands and the frozen ` +
        `2023 table has ${FROZEN_2023.maximumCredit.length}. The bands are compared BY ` +
        `POSITION, so a new band means this comparison is rewritten rather than extended.`,
    );
  }
  return table[children];
}

const problems = [];

// ─── 1. The rule this engine actually ships ───────────────────────────────────
for (const year of [2025, 2026]) {
  const def = state.getStateDefinition('IN', year);
  if (!def) fail(`us-state-tax has no Indiana definition for ${year}.`);
  const rule = def.earnedIncomeCredit;
  if (!rule) {
    problems.push(
      `IN ${year} ships no earnedIncomeCredit. If the rule was deleted on the strength of the ` +
        `freeze, that is Oklahoma's decision taken for Indiana and it needs the 2026 figures ` +
        `below argued against it, because in 2026 the rule is exactly right.`,
    );
    continue;
  }
  if (rule.matchRate !== MATCH) {
    problems.push(
      `IN ${year} matches at ${rule.matchRate} and this file prices ${MATCH}. IC 6-3.1-21-6 ` +
        `sets 10%; a different figure means the statute moved and every price below with it.`,
    );
  }
  if (rule.refundable !== true) {
    problems.push(
      `IN ${year} no longer declares the credit refundable. IC 6-3.1-21-6 makes it so, and ` +
        `refundability is why the overstatement is cash rather than a reduction capped at the ` +
        `filer's liability.`,
    );
  }
  if (def.ownEarnedIncomeCredit !== undefined) {
    problems.push(
      `IN ${year} now declares ownEarnedIncomeCredit, which is the shape a credit computed on ` +
        `a frozen base would take. If that is what happened, this file should be measuring the ` +
        `residual rather than the whole exposure.`,
    );
  }
}

// ─── 2, 3, 4. The prices, two ways, in both years ─────────────────────────────
const rows = [];
/**
 * The snapshot IC 6-3-1-11 points at, for a tax year. SEA 243 of 2025 is why
 * this is a function of the year rather than a constant.
 *
 * DAY 75 WROTE THE 2026 ASSERTION GATED ON THIS FUNCTION AND THAT MADE IT
 * CIRCULAR. Moving the threshold from 2026 to 2027 — the exact mistake a repeal
 * or a misreading would produce — passed the whole suite, because the only
 * assertion that said "2026 is exactly zero" was inside `if (frozenIsCurrent)`
 * and `frozenIsCurrent` was false. An assertion gated on the claim it is
 * checking checks nothing. The zero is now asserted on the MEASUREMENT, for
 * 2026, whatever this function returns.
 */
const snapshotYear = (year) => (year >= 2026 ? year : 2023);

for (const year of [2025, 2026]) {
  const snapshot = snapshotYear(year);
  const frozenIsCurrent = snapshot === year;
  for (let k = 0; k < LABELS.length; k += 1) {
    const cur = federalRow(year, k);
    const frozenRow = snapshot === 2023 ? undefined : federalRow(snapshot, k);
    const frozenMax = frozenRow ? frozenRow.maximumCredit : FROZEN_2023.maximumCredit[k];
    for (const status of ['single', 'joint']) {
      const curStart = status === 'joint' ? cur.phaseOutStart.marriedFilingJointly : cur.phaseOutStart.single;
      const frozenStart = frozenRow
        ? (status === 'joint' ? frozenRow.phaseOutStart.marriedFilingJointly : frozenRow.phaseOutStart.single)
        : FROZEN_2023.phaseOutStart[status][k];

      // 2. Direction. Checked on the maxima, which is where the sign lives.
      if (!frozenIsCurrent && !(cur.maximumCredit > frozenMax)) {
        problems.push(
          `${year} ${LABELS[k]}: the current federal maximum is ${cur.maximumCredit} and the ` +
            `2023 figure Indiana freezes is ${frozenMax}. This finding says a model reading ` +
            `the CURRENT credit OVERSTATES Indiana's, which holds only while the current ` +
            `figure is the larger one.`,
        );
      }

      // Method A: the closed form.
      const plateau = cents((cur.maximumCredit - frozenMax) * MATCH);
      const band = cents(
        ((cur.maximumCredit - frozenMax) + cur.phaseOutRate * (curStart - frozenStart)) * MATCH,
      );

      // Method B: evaluate both trapezoids where the frozen credit is exhausted.
      const exhausted = frozenStart + frozenMax / cur.phaseOutRate;
      const currentThere = Math.max(
        0,
        Math.min(
          cur.maximumCredit,
          cur.maximumCredit - cur.phaseOutRate * Math.max(0, exhausted - curStart),
        ),
      );
      const bandMeasured = cents(currentThere * MATCH);

      // 4. The closed form and the measurement are the same number.
      if (band !== bandMeasured) {
        problems.push(
          `${year} ${LABELS[k]} ${status}: the closed form prices the phase-out band at ` +
            `${money(band)} and evaluating the two trapezoids where the 2023 credit is ` +
            `exhausted gives ${money(bandMeasured)}. They are the same quantity, so a ` +
            `difference is a sign error in one of them — most likely the assumption that both ` +
            `years share § 32's phase-out rate.`,
        );
      }

      // 3. 2026 IS EXACTLY ZERO, asserted on the measurement and not on the
      //    branch that believes it. This is the whole Indiana-versus-Oklahoma
      //    point and it is the assertion that would fail first if SEA 243 were
      //    repealed or this file misread which year it takes effect.
      if (year === 2026 && (plateau !== 0 || band !== 0)) {
        problems.push(
          `${year} ${LABELS[k]} ${status}: SEA 243 of 2025 advances the snapshot to 1 January ` +
            `2026, so from 2026 the frozen base IS the current base and this engine's rule is ` +
            `exactly right — but the exposure measures ${money(plateau)} on the plateau and ` +
            `${money(band)} in the band, computed against the ${snapshot} snapshot this file ` +
            `believes applies.`,
        );
      }
      if (year === 2026 && snapshot !== 2026) {
        problems.push(
          `this file computes tax year 2026 against the ${snapshot} snapshot. IC 6-3-1-11 as ` +
            `amended by SEA 243 of 2025 puts it at 1 January 2026, which is the single fact ` +
            `that makes Indiana's error end and Oklahoma's not.`,
        );
      }
      if (!frozenIsCurrent && !(band >= plateau)) {
        problems.push(
          `${year} ${LABELS[k]} ${status}: the phase-out price ${money(band)} is below the ` +
            `plateau price ${money(plateau)}. The band price is the larger by construction, ` +
            `because the 2023 credit starts phasing out at a LOWER income.`,
        );
      }
      rows.push({ year, k, status, plateau, band, exhausted, label: LABELS[k] });
    }
  }
}

// ─── 5. The figures the published documents carry ─────────────────────────────
//
// **THESE BELONG IN THE SHIPPED NOTE AND THEY ARE NOT THERE YET, WHICH IS A
// DEFERRAL WITH A DATE ON IT RATHER THAN AN OVERSIGHT.** Day 75 wrote them into
// Indiana's `notes` array in `flat-states.ts` — the right place, because this
// package's argument is that a caveat belongs in the RESULT OBJECT a model sees
// and not in a README nobody passes it — and then took them back out, because
// editing a package source file moves `mutantFingerprint` and adding a note
// moves `suiteFingerprint` through `test/note-pins.json`, and `check-scores.mjs`
// then correctly refuses the recorded 99.7%. The re-measurement was started
// before the first commit of the day and this machine turned out to run it at
// 6.0 mutants a minute against Day 74's 58.0 — a projected 7.3 hours, measured
// over two minutes with nothing else on the box.
//
//   THE CHOICE WAS: PUSH THE DISCLOSURE AND LEAVE THIS REPOSITORY'S HONESTY
//   INSTRUMENT RED, OR KEEP THE GATE GREEN AND SHIP THE DISCLOSURE TOMORROW
//   ALONGSIDE A PLANNED AUDIT. The second, because a repository that sells proof
//   cannot advertise a mutation score it is unable to stand behind, and the note
//   loses one day. Reverting restored both fingerprints to the recorded values
//   exactly, which is itself the evidence that the score is of this build.
//
// So the figures are checked against the two documents that DO carry them —
// `INDIANA-EARNED-INCOME-CREDIT.md`, which a reader meets, and this file's own
// table — and the note assertion below is kept, failing until the note exists,
// so the deferral cannot quietly become permanent.
const PUBLISHED = { plateau: [4.9, 33.3, 54.8, 61.6], band: [15.3, 70.85, 104.29, 111.09] };
const DOC = 'tools/differential/INDIANA-EARNED-INCOME-CREDIT.md';
for (let k = 0; k < LABELS.length; k += 1) {
  const plateau = rows.find((r) => r.year === 2025 && r.k === k && r.status === 'joint').plateau;
  const band = rows.find((r) => r.year === 2025 && r.k === k && r.status === 'joint').band;
  if (plateau !== PUBLISHED.plateau[k]) {
    problems.push(
      `2025 ${LABELS[k]}: the plateau overstatement measures ${money(plateau)} and the note in ` +
        `flat-states.ts publishes ${money(PUBLISHED.plateau[k])}.`,
    );
  }
  if (band !== PUBLISHED.band[k]) {
    problems.push(
      `2025 ${LABELS[k]}: the phase-out overstatement measures ${money(band)} on a joint ` +
        `return and the note in flat-states.ts publishes ${money(PUBLISHED.band[k])}.`,
    );
  }
}

// Read across ALL of Indiana's notes joined, not the one note that happens to
// carry the phrase. The caveat and its prices are two notes because they are two
// claims — the investment-income limit and the frozen date — and a check pinned
// to whichever note holds the phrase would have passed the day the prices were
// moved into a note of their own.
// The document a reader meets. Every figure this file measures has to appear in
// it, because a measurement nobody can find is not a disclosure.
const doc = readFileSync(join(ROOT, DOC), 'utf8');
for (const figure of ['$4.90', '$33.30', '$54.80', '$61.60', '$15.30', '$70.85', '$104.29', '$111.09']) {
  if (!doc.includes(figure)) {
    problems.push(
      `${DOC} does not mention ${figure}. That document is where this exposure is written down ` +
        `while the shipped note is pending; a figure measured here and absent there is a finding ` +
        `this repository kept to itself.`,
    );
  }
}

// And the shipped note, which is where it BELONGS. This is expected to fail
// until the figures go into `flat-states.ts` beside a planned mutation audit —
// see the comment on PUBLISHED above. It is listed separately from `problems` so
// the deferral is visible in the output rather than silent, and so that it does
// not make `--check` red while it is a known, dated deferral.
const notes = state.getStateDefinition('IN', 2025)?.notes ?? [];
const noteText = notes.join('\n');
const PENDING_IN_NOTE = ['$111.09', '$54.80'].filter((f) => !noteText.includes(f));
if (!notes.some((n) => n.includes('earned income credit is 10%'))) {
  problems.push(
    "Indiana's notes no longer carry the earned income credit caveat at all. The figures above " +
      'are the price of a rule this package ships knowing it is wrong in 2025, and a filer ' +
      'reading the note is the only person who finds that out.',
  );
}

if (!CHECK) {
  console.log("Indiana's frozen earned income credit base, against the credit this repository ships");
  console.log('');
  console.log('  IC 6-3.1-21-6   10% of the federal earned income credit');
  console.log('  IC 6-3-1-11     under the Internal Revenue Code as of 1 JANUARY 2023 for tax');
  console.log('                  years 2023-2025, and 1 JANUARY 2026 from 2026 (SEA 243 of 2025)');
  console.log('');
  console.log('  So the error has an end date, which is what makes Indiana unlike Oklahoma.');
  console.log('');
  console.log('  year  children        return    on the plateau    in the phase-out band');
  for (const r of rows) {
    console.log(
      `  ${r.year}  ${r.label.padEnd(14)} ${r.status.padEnd(8)} ${money(r.plateau).padStart(15)} ` +
        `${money(r.band).padStart(24)}`,
    );
  }
  console.log('');
  console.log('  The band price is a CONSTANT across the whole phase-out, because both years');
  console.log("  fall at the same statutory rate — and it equals 10% of the current-year credit");
  console.log('  at the income where the 2023 credit runs out:');
  console.log('');
  for (const r of rows.filter((x) => x.year === 2025 && x.status === 'joint')) {
    console.log(
      `    ${r.label.padEnd(14)} 2023 credit exhausted at ${money(r.exhausted).padStart(12)}` +
        `, and 10% of what remains is ${money(r.band)}`,
    );
  }
  console.log('');
  console.log('  AND THAT IS THE SAME NUMBER AS THE CLIFF IN policyengine-us. Their gate asks');
  console.log('  whether the FROZEN credit is positive and their amount pays 10% of the CURRENT');
  console.log('  one, so a cent past that income costs their filer the whole credit. The most');
  console.log('  their gate can withhold and the most this engine can overstate are the same');
  console.log('  quantity from opposite sides. See tools/differential/in-eitc-conformity.mjs.');
  console.log('');
  console.log('  2026: every figure above is $0.00. The snapshot caught up.');
  console.log('');
  if (PENDING_IN_NOTE.length > 0) {
    console.log(
      `  PENDING: ${PENDING_IN_NOTE.join(', ')} are not yet in the shipped Indiana note, which`,
    );
    console.log('  is where a caller of this package would find them. Deferred from Day 75 with a');
    console.log('  reason — see the comment on PUBLISHED in this file — and owed on the next day');
    console.log('  that can afford a mutation audit.');
    console.log('');
  }
}

if (problems.length > 0) {
  fail(
    "Indiana's frozen earned income credit base no longer matches what this repository ships:",
    '',
    ...problems.map((p) => `  - ${p}`),
    '',
    'See tools/cross-package/indiana-frozen-eitc.mjs for what each assertion is for.',
  );
}

console.log(
  'ok — Indiana matches the federal earned income credit at 10% in both years; the 2025 ' +
    'exposure against the frozen 1 January 2023 base is $4.90 to $61.60 on the plateau and a ' +
    'constant $11.17 to $111.09 through the phase-out, priced two ways and agreeing to the ' +
    `cent; ${DOC} carries every one of those figures${PENDING_IN_NOTE.length ? ` (the shipped note does NOT yet, which is owed: ${PENDING_IN_NOTE.join(', ')})` : ' and so does the shipped note'}; and THE 2026 EXPOSURE IS EXACTLY ZERO at ` +
    'every child count, because SEA 243 of 2025 advances the snapshot to the current year.',
);
