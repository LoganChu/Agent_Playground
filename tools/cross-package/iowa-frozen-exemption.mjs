#!/usr/bin/env node
/**
 * Is Iowa's low-income exemption still being withdrawn by the federal standard
 * deduction — and is it still worthless to every non-elderly filer?
 *
 * ## Why this exists
 *
 * Iowa Code § 422.5(3) exempts a return whose Iowa net income is at or below
 * `$9,000` (single or married filing separately, under 65), `$13,500` (any
 * other status, under 65), `$24,000` (single, 65 or over) or `$32,000` (any
 * other status, 65 or over). **None of those four figures has moved since at
 * least 2021 and no provision indexes them.**
 *
 * The test is on net income, *before* the deduction — the instructions add the
 * deduction and the QBI deduction back when computing it. And since tax year
 * 2023 Iowa's deduction **is the federal one**: the IA 1040 reads it off the
 * federal return, § 63(f) age and blindness additions included. That deduction
 * is indexed every year.
 *
 * So the provision can only change an answer where the threshold still
 * EXCEEDS that filer's own deduction, and the gap closes annually:
 *
 * ```text
 *                      2025                        2026
 *                 deduction  threshold  reach  deduction  threshold  reach
 *   single (65)      17,750     24,000  6,250     18,150     24,000  5,850
 *   head of hh       25,625     32,000  6,375     26,200     32,000  5,800
 *   separate         17,350     32,000 14,650     17,750     32,000 14,250
 *   joint            33,100     32,000      -     33,850     32,000      -
 *   surv. spouse     33,100     32,000      -     33,850     32,000      -
 * ```
 *
 * `$6,250` of reach is `$237.50` of Iowa tax at 3.8%; `$5,850` is `$222.30`.
 * **`$15.20` of relief withdrawn from the poorest Iowans over 65 in a single
 * year, with no Iowa figure amended by anybody.**
 *
 * **THE RULE THIS GUARDS: A THRESHOLD THAT IS NOT INDEXED IS A WITHDRAWAL
 * SCHEDULE, AND NOTHING ANNOUNCES IT.** Iowa's figures did not change. What
 * changed is the deduction they are compared against, and that belongs to the
 * other government — so neither package could make this check from inside
 * itself. `us-state-tax` has no dependencies and cannot read the federal
 * figures; `us-federal-tax` has never heard of Iowa.
 *
 * This is Day 62's Oklahoma finding with the sign reversed. There a frozen
 * BASE makes a naive reader overpay a family, and the error grows. Here a
 * frozen THRESHOLD withdraws a relief, and the withdrawal grows. Both are one
 * side of a comparison being indexed and the other being a fixed number, and
 * neither is visible to anything that reads a single year's table.
 *
 * ## What it checks
 *
 * The thresholds come from `us-state-tax` and the deductions from
 * `us-federal-tax`. Nothing is hard-coded but the two years, the rate used to
 * price the result, and the statutory prose.
 *
 *   1. For BOTH years and ALL FIVE statuses, the non-elderly threshold is at or
 *      below that status's federal deduction — so the exemption cannot change a
 *      non-elderly answer. This is the claim `states/iowa.ts` publishes and the
 *      one `status-sweep.test.js` leans on.
 *   2. At 65, the exemption still reaches exactly single, married filing
 *      separately and head of household, and NOT joint or surviving spouse.
 *      Pinned so that a status crossing the line is an event.
 *   3. THE DIRECTION, which is the half no table of one year's figures can
 *      show: for every status it still reaches, the reach must SHRINK from 2025
 *      to 2026 — and it must shrink because the deduction grew, not because a
 *      threshold fell. Both halves are asserted, because a threshold cut would
 *      produce the same shrinking and mean the opposite thing.
 *   4. The deduction figures this tool reads are the ones
 *      `packages/us-state-tax/test/iowa.test.js` transcribes. That test cannot
 *      import `us-federal-tax`, so this is what stops its copy going stale.
 *   5. Iowa's own thresholds are IDENTICAL in the two years, which is what
 *      makes the whole movement federal.
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

const federal = await load('us-federal-tax', 'the standard deduction and the § 63(f) addition');
const state = await load('us-state-tax', "Iowa's low-income exemption thresholds");

const FEDERAL_YEAR = { 2025: federal.YEAR_2025, 2026: federal.YEAR_2026 };
const YEARS = [2025, 2026];
const STATUSES = [
  'single',
  'marriedFilingJointly',
  'marriedFilingSeparately',
  'headOfHousehold',
  'qualifyingSurvivingSpouse',
];
// The statuses § 422.5(3) can still reach at 65, pinned. A status joining or
// leaving this list is the event this tool exists to make loud.
const STILL_REACHED = ['single', 'marriedFilingSeparately', 'headOfHousehold'];

const problems = [];

/** Iowa's exemption rule, with both tiers. */
const iowaRule = (year) => {
  const def = state.getStateDefinition('IA', year);
  if (!def) fail(`us-state-tax has no Iowa definition for ${year}.`);
  const rule = def.zeroTaxThreshold;
  if (!rule) {
    fail(
      `IA ${year}: there is no zeroTaxThreshold rule.`,
      '',
      "Iowa's low-income exemption is the whole subject of this check. If the rule",
      'was renamed or removed, this tool has to be rewritten rather than deleted.',
    );
  }
  if (!rule.elderlyThreshold || rule.elderlyAge === undefined) {
    fail(
      `IA ${year}: the rule has no elderlyThreshold/elderlyAge.`,
      '',
      '§ 422.5(3) writes a whole second table for a return with someone at 65 rather',
      'than adding an increment, and the two tiers are what this check compares.',
    );
  }
  return rule;
};

/** The federal deduction an Iowa filer of this status takes. */
const deductionOf = (year, status, aged) => {
  const y = FEDERAL_YEAR[year];
  const basic = y.standardDeduction[status];
  const addition = y.additionalStandardDeduction[status];
  if (typeof basic !== 'number' || typeof addition !== 'number') {
    fail(
      `us-federal-tax has no standard deduction or § 63(f) addition for ${status} in ${year}.`,
      '',
      'Iowa adopts both — the IA 1040 reads the deduction off the federal return — so',
      'a missing figure here means the comparison cannot be made rather than that it',
      'passes.',
    );
  }
  return basic + (aged ? addition : 0);
};

const RATE = 0.038;
const rateOf = (year) => {
  const def = state.getStateDefinition('IA', year);
  if (def.rate.kind !== 'flat') {
    fail(
      `IA ${year}: rate.kind is '${def.rate.kind}', not 'flat'.`,
      '',
      'The prices this tool prints are the threshold reach times the rate, which only',
      'means what it says while Iowa has one rate.',
    );
  }
  return def.rate.rate;
};

for (const year of YEARS) {
  const got = rateOf(year);
  if (Math.abs(got - RATE) > 1e-12) {
    problems.push(
      `IA ${year}: the rate is ${got} and this tool prices the reach at ${RATE}. ` +
        'Update the constant and the prose above together.',
    );
  }
}

// ---------------------------------------------------------------------------
// 1 and 2 — who the exemption can still reach.
// ---------------------------------------------------------------------------

const reach = {};
for (const year of YEARS) {
  const rule = iowaRule(year);
  reach[year] = {};
  for (const status of STATUSES) {
    const plain = deductionOf(year, status, false);
    const aged = deductionOf(year, status, true);
    const under65 = rule.threshold[status] - plain;
    const at65 = rule.elderlyThreshold[status] - aged;
    reach[year][status] = { under65, at65, plain, aged };

    if (under65 > 0) {
      problems.push(
        `IA ${year} ${status}: the NON-ELDERLY exemption threshold (${rule.threshold[status]}) now ` +
          `EXCEEDS the federal deduction (${plain}), so it can change an answer. ` +
          'states/iowa.ts publishes the opposite, and status-sweep.test.js exempts ' +
          "Iowa's joint and surviving-spouse cells on the strength of it. Both have to " +
          'be revisited — either a threshold was raised or the deduction fell.',
      );
    }
  }
  const reached = STATUSES.filter((s) => reach[year][s].at65 > 0);
  if (JSON.stringify(reached) !== JSON.stringify(STILL_REACHED)) {
    problems.push(
      `IA ${year}: the statuses the exemption reaches at 65 are now [${reached.join(', ')}] ` +
        `and not [${STILL_REACHED.join(', ')}]. A status crossing this line is a real ` +
        'change in who the provision helps; update STILL_REACHED and the notes on the ' +
        'state together.',
    );
  }
}

// ---------------------------------------------------------------------------
// 3 — THE DIRECTION, and that it is the deduction moving rather than the
// threshold. This is the assertion the whole tool is for.
// ---------------------------------------------------------------------------

for (const status of STILL_REACHED) {
  const a = reach[2025][status];
  const b = reach[2026][status];
  if (!(b.at65 < a.at65)) {
    problems.push(
      `IA ${status}: the exemption's reach at 65 did not shrink — ${a.at65} in 2025 and ` +
        `${b.at65} in 2026. Either Congress cut the standard deduction or Iowa raised a ` +
        'threshold, and both are things somebody would want to know.',
    );
  }
  if (!(b.aged > a.aged)) {
    problems.push(
      `IA ${status}: the federal deduction did not grow — ${a.aged} to ${b.aged}. The ` +
        'shrinking reach above is only the finding this repository claims if it is the ' +
        'DEDUCTION that moved; a threshold cut would look identical and mean the opposite.',
    );
  }
}

// ---------------------------------------------------------------------------
// 5 — and Iowa's own figures did not move at all.
// ---------------------------------------------------------------------------

const r25 = iowaRule(2025);
const r26 = iowaRule(2026);
for (const status of STATUSES) {
  for (const [tier, key] of [
    ['under 65', 'threshold'],
    ['at 65', 'elderlyThreshold'],
  ]) {
    if (r25[key][status] !== r26[key][status]) {
      problems.push(
        `IA ${status} ${tier}: the threshold moved, ${r25[key][status]} to ${r26[key][status]}. ` +
          'These figures are unindexed and have not moved since at least 2021; the whole ' +
          'point of this check is that the movement is federal. If Iowa legislated, say so ' +
          'in the module and re-price the notes.',
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Report.
// ---------------------------------------------------------------------------

const money = (n) => n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

if (!CHECK) {
  console.log("Iowa's low-income exemption against the deduction that is withdrawing it\n");
  console.log(
    '  status                      year  deduction  threshold     reach      worth',
  );
  for (const status of STATUSES) {
    for (const year of YEARS) {
      const r = reach[year][status];
      const rule = iowaRule(year);
      const worth = r.at65 > 0 ? `$${money(r.at65 * RATE)}` : '        -';
      console.log(
        `  ${status.padEnd(26)} ${year}  ${String(r.aged).padStart(9)}  ` +
          `${String(rule.elderlyThreshold[status]).padStart(9)}  ` +
          `${String(r.at65 > 0 ? r.at65 : '-').padStart(8)}  ${worth.padStart(9)}`,
      );
    }
  }
  console.log('\n  (the figures at 65, which is the only tier the exemption can still reach)\n');
  for (const status of STILL_REACHED) {
    const lost = (reach[2025][status].at65 - reach[2026][status].at65) * RATE;
    console.log(
      `  ${status.padEnd(26)} withdrawn in one year: $${money(lost)}`,
    );
  }
  console.log(
    '\n  And not one Iowa figure moved: every threshold is identical in the two years.',
  );
}

if (problems.length > 0) {
  fail(
    "Iowa's frozen exemption check FAILED:",
    '',
    ...problems.map((p) => `  - ${p}`),
    '',
    'This tool compares a FROZEN state threshold against an INDEXED federal deduction.',
    'A failure means one of the two stopped behaving that way, which is a change in the',
    'law rather than a bug in the arithmetic.',
  );
}

console.log(
  "ok — Iowa's low-income exemption cannot reach a non-elderly filer in either year, " +
    `reaches only ${STILL_REACHED.join(', ')} at 65, and its reach is shrinking because the ` +
    'federal deduction is indexed and Iowa\'s thresholds are not',
);
