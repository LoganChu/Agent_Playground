#!/usr/bin/env node
/**
 * Does Arizona's own standard deduction still equal the federal basic one?
 *
 * ## Why this exists
 *
 * For 47 days this repository said Arizona's standard deduction WAS the federal
 * standard deduction, with `deduction: { kind: 'federal' }`, because A.R.S.
 * § 43-1041(A) said so. On **13 June 2026** Laws 2026, ch. 140 (HB 4168) §§ 16
 * and 35(A) replaced the cross-reference with Arizona's own amounts —
 * `$15,750` / `$23,625` / `$31,500` — **retroactively, for taxable years
 * beginning from and after December 31, 2024**.
 *
 * **Not one figure in this repository changed on that day, and that is the
 * problem this tool exists for.** § 43-1041(H) indexes the subsection (A)
 * amounts "in the same manner in which the federal basic standard deduction is
 * adjusted for inflation pursuant to section 63", and the 2025 bases were made
 * equal, so Arizona's 2026 amounts come out at the federal `$16,100` /
 * `$24,150` / `$32,200`. The old declaration kept producing the right answer
 * after it stopped being the right reason.
 *
 * **THE RULE: A NUMBER THAT IS RIGHT FOR THE WRONG REASON HAS NO GUARD ON IT.**
 * Arizona's amounts and the federal ones are now TWO parameters that agree
 * rather than ONE parameter read twice, and what Arizona borrows is the
 * indexing METHOD, not the number. The two will part company the next time
 * Congress moves the § 63(c) base the way the OBBBA did — and nothing in either
 * package would notice, because each is internally consistent. This is the
 * check that notices.
 *
 * ## What it checks
 *
 * Every figure is computed from one of the two packages and compared with the
 * other. Nothing is hard-coded except the statutory citations in the prose.
 *
 *   1. Arizona's table equals `us-federal-tax`'s BASIC standard deduction, for
 *      every filing status and every supported year. This is the coincidence,
 *      pinned.
 *   2. Arizona takes NO § 63(f) addition. The federal package's
 *      `additionalStandardDeduction` is non-zero for every status; Arizona's
 *      answer must not move when it is applied. That is the defect this change
 *      fixed, worth `$50.00` to a single Arizona filer aged 65 or over.
 *   3. Arizona's 2025 amounts are the POST-OBBBA federal figures — the
 *      superseded Rev. Proc. 2024-40 amounts plus the Act's increase — so the
 *      `$18.75` the READMEs advertise is inside § 43-1041(A) rather than
 *      reaching Arizona through the Code.
 *   4. The surviving-spouse cell reuses the head-of-household amount, because
 *      Form 140 has no such box, and the gap between joint and head of
 *      household is the `$201.25` the READMEs quote for 2026.
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

const federal = await load('us-federal-tax', 'the basic and § 63(f) additional standard deductions');
const state = await load('us-state-tax', "Arizona's own standard-deduction table");

const YEARS = [2025, 2026];
const FEDERAL_YEAR = { 2025: federal.YEAR_2025, 2026: federal.YEAR_2026 };
const problems = [];

// ------------------------------------------------- 1. the coincidence, pinned
for (const year of YEARS) {
  const def = state.getStateDefinition('AZ', year);
  if (def.deduction.kind !== 'table') {
    fail(
      `AZ ${year}: deduction.kind is '${def.deduction.kind}', not 'table'.`,
      '',
      "Arizona's standard deduction has been its OWN since HB 4168. A cross-reference",
      'to the federal figure produces the same answer today and silently takes the',
      '§ 63(f) age and blindness additions, which A.R.S. § 43-1041(A) does not allow.',
    );
  }
  const basic = FEDERAL_YEAR[year].standardDeduction;
  for (const status of Object.keys(basic)) {
    // Arizona has no surviving-spouse box; checked separately below.
    if (status === 'qualifyingSurvivingSpouse') continue;
    const mine = def.deduction.amounts[status];
    if (mine !== basic[status]) {
      problems.push(
        `AZ ${year} ${status}: Arizona's § 43-1041(A) amount is $${mine.toLocaleString()} and ` +
          `us-federal-tax's BASIC § 63(c)(2) amount is $${basic[status].toLocaleString()}.`,
      );
    }
  }
}

// -------------------------------- 2. and Arizona takes no § 63(f) addition
const basis = (deduction, agi = 100_000) => ({
  adjustedGrossIncome: agi,
  taxableIncome: Math.max(0, agi - deduction),
  deduction,
  deductionKind: 'standard',
});
for (const year of YEARS) {
  const basic = FEDERAL_YEAR[year].standardDeduction;
  const extra = FEDERAL_YEAR[year].additionalStandardDeduction;
  for (const status of Object.keys(basic)) {
    if (extra[status] <= 0) {
      problems.push(`us-federal-tax ${year} ${status}: no § 63(f) addition, so this check proves nothing`);
      continue;
    }
    const at = (d) => state.stateIncomeTax({ state: 'AZ', year, filingStatus: status, federal: basis(d) }).tax;
    const moved = at(basic[status]) - at(basic[status] + extra[status]);
    if (Math.abs(moved) >= 0.005) {
      problems.push(
        `AZ ${year} ${status}: the § 63(f) addition of $${extra[status].toLocaleString()} moves ` +
          `Arizona's tax by $${moved.toFixed(2)}, and Arizona allows no such addition. This is the ` +
          `Day 47 defect: ${state.getStateDefinition('AZ', year).deduction.kind === 'federal' ? 'the deduction is a federal cross-reference again' : 'something reintroduced an aged-or-blind addition'}.`,
      );
    }
  }
}

// ------------------------ 3. the OBBBA increase is INSIDE § 43-1041(A) now
const superseded = federal.SUPERSEDED_2025_STANDARD_DEDUCTION;
const increase = federal.OBBBA_2025_STANDARD_DEDUCTION_INCREASE;
const az2025 = state.getStateDefinition('AZ', 2025);
for (const status of Object.keys(superseded)) {
  if (status === 'qualifyingSurvivingSpouse') continue;
  const want = superseded[status] + increase[status];
  const mine = az2025.deduction.amounts[status];
  if (mine !== want) {
    problems.push(
      `AZ 2025 ${status}: Arizona carries $${mine.toLocaleString()}; the superseded Rev. Proc. ` +
        `2024-40 figure plus the OBBBA increase is $${want.toLocaleString()}. Arizona's own statute ` +
        `is supposed to contain the post-OBBBA figure, which is why the $18.75 survived HB 4168.`,
    );
  }
}

// ---------------------- 4. no surviving-spouse box, and the $201.25 it closed
for (const year of YEARS) {
  const def = state.getStateDefinition('AZ', year);
  const { amounts } = def.deduction;
  if (amounts.qualifyingSurvivingSpouse !== amounts.headOfHousehold) {
    problems.push(
      `AZ ${year}: the surviving-spouse cell is $${amounts.qualifyingSurvivingSpouse.toLocaleString()} ` +
        `and Arizona sends her to head of household ($${amounts.headOfHousehold.toLocaleString()}). ` +
        `Form 140 has four boxes and none of them is hers.`,
    );
  }
}
const gap2026 = (() => {
  const { amounts } = state.getStateDefinition('AZ', 2026).deduction;
  const rate = state.getStateDefinition('AZ', 2026).rate.rate;
  return state.roundCents((amounts.marriedFilingJointly - amounts.headOfHousehold) * rate);
})();

for (const year of YEARS) {
  const def = state.getStateDefinition('AZ', year);
  const basic = FEDERAL_YEAR[year].standardDeduction;
  console.log(
    `AZ ${year}  ` +
      Object.keys(def.deduction.amounts)
        .filter((s) => s !== 'qualifyingSurvivingSpouse')
        .map((s) => `${s.slice(0, 6)} $${def.deduction.amounts[s]}${def.deduction.amounts[s] === basic[s] ? '=' : '!'}fed`)
        .join('  '),
  );
}
console.log(`the surviving-spouse question HB 4168 closed, 2026: $${gap2026.toFixed(2)}`);

if (problems.length) {
  fail(
    "Arizona's own standard deduction no longer agrees with us-federal-tax, or the",
    'cross-reference has come back.',
    '',
    ...problems.map((p) => `  ${p}`),
    '',
    'A.R.S. § 43-1041(H) indexes Arizona\'s amounts "in the same manner in which the',
    'federal basic standard deduction is adjusted for inflation pursuant to section 63",',
    'so they track the federal BASIC figure and not the deduction a filer took. If',
    'Congress has moved the § 63(c) base again, Arizona does NOT follow until its own',
    'indexing applies — update Arizona\'s table from the statute, not from the federal',
    'package, and say in the note which year they parted company.',
  );
}

if (CHECK) {
  console.log(
    `\nok — Arizona's ${YEARS.length} years x 4 statuses equal us-federal-tax's basic standard ` +
      `deduction, take no § 63(f) addition, and carry the post-OBBBA figures`,
  );
}
