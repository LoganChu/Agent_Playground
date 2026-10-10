#!/usr/bin/env node
/**
 * Does this repository agree with ITSELF about what the One Big Beautiful Bill
 * Act did to the 2025 standard deduction?
 *
 * ## Why this exists
 *
 * For 46 days it did not, and the disagreement was 53%.
 *
 * `packages/us-federal-tax/src/data/2025.ts` has said since the package shipped:
 *
 *     // OBBBA § 70102. These are *not* the Rev. Proc. 2024-40 figures — see the
 *     // header comment. A 2025 return prepared with $15,000 / $30,000 / $22,500
 *     // overstates taxable income by $750 / $1,500 / $1,125.
 *
 * That is right. Meanwhile `packages/us-state-tax` described the same increase in
 * **five states' shipped notes, two READMEs and four test files**, and every one
 * of them measured it from `$14,600` — the **2024** standard deduction — making
 * the increase `$1,150` and the Colorado cut `$50.60` instead of `$33.00`.
 *
 * **Nothing caught it, and the reason is worth stating precisely.** The tests
 * were not weak; they were *circular*. Each one built a pre-OBBBA federal basis
 * with `deduction: 14_600`, handed it to the engine, and asserted the engine's
 * answer. The engine takes 4.4% of whatever deduction it is given, so
 * `4.4% × $1,150 = $50.60` is arithmetically perfect and factually about a change
 * the Act did not make. A test that supplies its own premise can only ever
 * confirm it.
 *
 * **THE RULE, which is the generalisable half: a claim about a federal figure
 * made inside the state package is a CROSS-PACKAGE claim, and this repository had
 * no instrument that could read across the two.** The provenance ledger, the
 * differential grid, the mutation audit and the indexation derivation are all
 * scoped to one package. The right answer was sitting in the other one, in data,
 * four directories away.
 *
 * ## What it checks
 *
 * Nothing here is hard-coded. Every figure is computed from one of the two
 * packages and compared with the other:
 *
 * 1. The state suite's pinned `OBBBA_INCREASE` equals `us-federal-tax`'s own
 *    `OBBBA_2025_STANDARD_DEDUCTION_INCREASE`, which is itself derived from the
 *    superseded Rev. Proc. 2024-40 figures and the figures the 2025 return uses.
 * 2. For each of the five states that read a below-AGI federal figure, the cut
 *    the state engine computes from the REAL increase is the one both READMEs
 *    advertise.
 * 3. Both READMEs' OBBBA tables are PARSED — the cut and the conformity kind in
 *    every row — and each is required to be the one the engines produce.
 *
 * ## What it deliberately does NOT check, and why that is the interesting part
 *
 * The first version of this tool scanned every tracked file for the cuts derived
 * from the WRONG increase, on the theory that `$50.60` should never appear again.
 * It reported twelve hits and **ten of them were false**: `$28.75` and `$69.00`
 * are ordinary tax amounts that occur by coincidence in `bracket-pins.json`, in
 * `status-sweep.json`, in an unrelated Missouri retirement test and twice in the
 * differential output, and the other two were this file's own corrections citing
 * the old figures on purpose.
 *
 * **THE RULE: a money figure is not a fingerprint.** `$50.60` carries no evidence
 * about what produced it, so a scan for it cannot tell a stale claim from a
 * coincidence — and a check that cries wolf is a check somebody switches off,
 * which is worse than not having one. The claims are therefore checked where they
 * are MADE, in a parsed table, and nowhere else.
 *
 * ## Usage
 *
 *     node tools/cross-package/obbba-claims.mjs           # print
 *     node tools/cross-package/obbba-claims.mjs --check    # exit 1 on disagreement
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHECK = process.argv.includes('--check');

const fail = (...lines) => {
  for (const l of lines) console.error(l);
  process.exit(1);
};

/** The five states whose answer moves when a below-AGI federal figure moves. */
const SENSITIVE = ['AZ', 'CO', 'ID', 'MO', 'UT'];

/**
 * Utah's cut has to be measured where its Taxpayer Tax Credit is still live —
 * the credit is fully withdrawn by $90,906 of AGI, so a measurement at $100,000
 * reports zero and would make the README's $45.00 look wrong.
 */
const AGI_FOR = { UT: 60_000 };
const DEFAULT_AGI = 100_000;

async function load(pkg, what) {
  const entry = join(ROOT, 'packages', pkg, 'dist', 'esm', 'index.js');
  try {
    return await import(entry);
  } catch (err) {
    fail(
      `cannot import ${pkg}: ${err.message}`,
      '',
      `This tool reads both engines, so both must be built. Run:`,
      `  (cd packages/${pkg} && npm install && npm run build)`,
      '',
      `${what} is what it needs from it.`,
    );
  }
}

const federal = await load('us-federal-tax', 'the superseded and current standard deductions');
const state = await load('us-state-tax', 'each state engine');

const superseded = federal.SUPERSEDED_2025_STANDARD_DEDUCTION;
const increase = federal.OBBBA_2025_STANDARD_DEDUCTION_INCREASE;
const current = federal.YEAR_2025.standardDeduction;
const y2024 = federal.YEAR_2024.standardDeduction;

// ---------------------------------------------------------------- 0. coherence
for (const status of Object.keys(superseded)) {
  if (superseded[status] + increase[status] !== current[status]) {
    fail(`us-federal-tax disagrees with itself at ${status}: ${superseded[status]} + ${increase[status]} !== ${current[status]}`);
  }
}

// ------------------------------------------- 1. the state suite's pinned figure
const PINNED_FILE = join(ROOT, 'packages', 'us-state-tax', 'test', 'federal-conformity.test.js');
const pinnedSrc = readFileSync(PINNED_FILE, 'utf8');
const block = pinnedSrc.match(/const OBBBA_INCREASE = \{([^}]*)\}/);
if (!block) fail(`no OBBBA_INCREASE literal in ${PINNED_FILE} — the pin this tool exists to check is gone`);
const pinned = {};
for (const [, k, v] of block[1].matchAll(/(\w+):\s*([\d_]+)/g)) pinned[k] = Number(v.replaceAll('_', ''));

for (const status of Object.keys(increase)) {
  if (pinned[status] !== increase[status]) {
    fail(
      `the state suite pins the OBBBA increase at ${status} = ${pinned[status]};`,
      `us-federal-tax derives ${increase[status]} from its own data.`,
      '',
      'This is the Day 46 defect. Fix the pin, not the federal figure, unless a',
      'statute moved — in which case fix the federal data and both will agree.',
    );
  }
}

// --------------------------------- 2 & 3. the per-state cuts, right and wrong
const basis = (deduction, agi) => ({
  adjustedGrossIncome: agi,
  taxableIncome: Math.max(0, agi - deduction),
  deduction,
  deductionKind: 'standard',
});
const cut = (code, from, to) => {
  const agi = AGI_FOR[code] ?? DEFAULT_AGI;
  const at = (d) =>
    state.stateIncomeTax({ state: code, year: 2025, filingStatus: 'single', federal: basis(d, agi) }).tax;
  return at(from) - at(to);
};

const NAMES = { AZ: 'Arizona', CO: 'Colorado', ID: 'Idaho', MO: 'Missouri', UT: 'Utah' };

const rows = SENSITIVE.map((code) => ({
  code,
  name: NAMES[code],
  real: cut(code, superseded.single, current.single),
  wrong: cut(code, y2024.single, current.single),
  conformity: state.getStateDefinition(code, 2025).federalConformity,
}));

for (const r of rows) {
  console.log(
    `${r.code}  real $${r.real.toFixed(2)}  (from $${superseded.single})` +
      `   would-be $${r.wrong.toFixed(2)}  (from $${y2024.single}, the 2024 figure)` +
      `   ${r.conformity.kind}${r.conformity.conformedTo ? ' ' + r.conformity.conformedTo : ''}`,
  );
}

/**
 * Parse the OBBBA table out of a README and return what it advertises per state.
 *
 * The row is matched on the state NAME at the start of a table row, inside the
 * section that mentions the Act, so an unrelated table carrying the same name
 * cannot answer for it.
 */
function advertised(readmePath) {
  const text = readFileSync(readmePath, 'utf8');
  const lines = text.split('\n');

  // The anchor: the sentence that makes the claim. Both READMEs have exactly one.
  const anchors = lines
    .map((l, i) => [l, i])
    .filter(([l]) => /One Big Beautiful Bill Act cut/.test(l))
    .map(([, i]) => i);
  if (anchors.length !== 1) {
    fail(
      `${readmePath.slice(ROOT.length + 1)}: expected exactly one "One Big Beautiful Bill Act cut ..." sentence, found ${anchors.length}.`,
      'This tool scopes its table search to that sentence; two of them (or none) means it',
      'would read the wrong table, which is how the first version of this check reported a',
      'Missouri row from an unrelated table four hundred lines earlier.',
    );
  }

  // The first contiguous run of table rows after it, and nothing else. Scoping
  // matters: `| Missouri | the **share** of the bill | ...` is a real row in a
  // different table and answered for Missouri until this was fixed.
  const rowsOut = [];
  let seen = false;
  for (let i = anchors[0]; i < lines.length; i += 1) {
    const isRow = lines[i].trimStart().startsWith('|');
    if (isRow) {
      seen = true;
      rowsOut.push(lines[i]);
    } else if (seen) {
      break;
    }
  }
  if (!rowsOut.length) fail(`${readmePath.slice(ROOT.length + 1)}: no table follows the OBBBA sentence`);

  const out = {};
  for (const r of rows) {
    const row = rowsOut.find((l) => new RegExp(`^\\|\\s*${r.name}\\s*\\|`).test(l.trimStart()));
    if (!row) continue;
    const money = row.match(/\$([\d,]+\.\d{2})/);
    const kind = /\brolling\b/.test(row)
      ? 'rolling'
      : /\bstatic\b/.test(row)
        ? 'staticDate'
        : undefined;
    const date = row.match(/(\d{4}-\d{2}-\d{2})/);
    out[r.code] = {
      cut: money ? Number(money[1].replaceAll(',', '')) : undefined,
      kind,
      conformedTo: date?.[1],
      row,
    };
  }
  return out;
}

const READMES = [
  join(ROOT, 'packages', 'us-state-tax', 'README.md'),
  join(ROOT, 'packages', 'us-tax-mcp', 'README.md'),
];

if (CHECK) {
  const problems = [];
  for (const path of READMES) {
    const ad = advertised(path);
    const rel = path.slice(ROOT.length + 1);
    for (const r of rows) {
      const a = ad[r.code];
      if (!a) {
        problems.push(`${rel}: no OBBBA row for ${r.name}, and all five states pass the increase through`);
        continue;
      }
      if (a.cut === undefined) {
        problems.push(`${rel}: ${r.name}'s row advertises no cut — "${a.row.trim()}"`);
      } else if (Math.abs(a.cut - r.real) >= 0.005) {
        problems.push(
          `${rel}: ${r.name} advertises $${a.cut.toFixed(2)}; the engine computes $${r.real.toFixed(2)}` +
            (Math.abs(a.cut - r.wrong) < 0.005
              ? '  <-- this is the cut measured from the 2024 standard deduction, which is the Day 46 defect'
              : ''),
        );
      }
      if (a.kind !== r.conformity.kind) {
        problems.push(
          `${rel}: ${r.name}'s row says conformity is "${a.kind ?? 'nothing'}"; the definition declares "${r.conformity.kind}"`,
        );
      }
      if (r.conformity.conformedTo && a.conformedTo !== r.conformity.conformedTo) {
        problems.push(
          `${rel}: ${r.name}'s row says the Code is frozen at ${a.conformedTo ?? 'no date'}; the definition says ${r.conformity.conformedTo}`,
        );
      }
    }
  }
  if (problems.length) {
    fail(
      'A README advertises an OBBBA figure or a conformity claim that the engines do not produce.',
      '',
      ...problems.map((p) => `  ${p}`),
      '',
      '$14,600 is the 2024 standard deduction. The pre-OBBBA 2025 figure is',
      '$15,000 (Rev. Proc. 2024-40 § 2.15), so the OBBBA increase is $750 single,',
      '$1,500 joint and $1,125 head of household.',
    );
  }
  console.log(
    `\nok — ${rows.length} states x ${READMES.length} READMEs: every advertised cut and ` +
      `conformity claim matches us-federal-tax's data and the state engine`,
  );
}
