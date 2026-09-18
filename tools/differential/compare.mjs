/**
 * Join the two models' answers and report every disagreement.
 *
 * A disagreement is not a bug. Two models of the same statute can differ because
 * one is wrong, because they read an ambiguous provision differently, or because
 * one models something the other does not — and the whole value of this harness
 * is in *sorting* the differences, not in counting them. So every difference is
 * either matched by an entry in `known-divergences.json`, which has to give a
 * reason and a side, or it is unexplained and is printed at the top of the
 * report.
 *
 * ```
 * node tools/differential/compare.mjs            # markdown report on stdout
 * node tools/differential/compare.mjs --json     # the same thing as data
 * ```
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => JSON.parse(readFileSync(join(here, name), 'utf8'));

/**
 * A dollar. Below it the two models agree: PolicyEngine computes in 32-bit
 * floats and several states round to whole dollars at different points, so
 * anything smaller is arithmetic noise rather than a reading of the law.
 */
const MATERIAL = 1;

const METRICS = [
  ['federal.adjustedGrossIncome', (r) => r.federal?.adjustedGrossIncome],
  ['federal.taxableIncome', (r) => r.federal?.taxableIncome],
  ['federal.incomeTaxBeforeCredits', (r) => r.federal?.incomeTaxBeforeCredits],
  ['federal.taxableSocialSecurity', (r) => r.federal?.taxableSocialSecurity],
  ['federal.childTaxCredit', (r) => r.federal?.childTaxCredit],
  ['federal.earnedIncomeCredit', (r) => r.federal?.earnedIncomeCredit],
  ['state.tax', (r) => r.state?.tax],
];

/**
 * `maxAbs` is the guard this file was missing, and Day 24 is what it cost.
 *
 * An entry matched on state and metric alone swallows EVERY difference in that
 * state. Four of the reasons in this file were stale on the morning of Day 24 —
 * they said "the caller must supply the pension", the engine had started
 * supplying it itself, and the differences left over in those states had four
 * entirely different causes: an Illinois child tax credit nobody here had heard
 * of, a Michigan exemption figure, a New York credit PolicyEngine does not
 * model, and a North Carolina child deduction. All four were hidden behind a
 * sentence about pensions, and the report called them explained.
 *
 * So a reason now states the size it claims. A difference larger than `maxAbs`
 * is reported as unexplained however well the rest of the entry matches, which
 * makes the report fail loudly in the one direction that matters: a known small
 * gap growing into an unknown large one.
 */
function match(rule, caseRow, metric, delta) {
  if (rule.metric !== metric) return false;
  if (rule.state && rule.state !== caseRow.state) return false;
  if (rule.kind && rule.kind !== caseRow.kind) return false;
  if (rule.idIncludes && !caseRow.id.includes(rule.idIncludes)) return false;
  if (rule.maxAbs !== undefined && Math.abs(delta) > rule.maxAbs) return false;
  return true;
}

export function compare() {
  const cases = read('out/cases.json');
  const ours = read('out/ours.json');
  const theirs = read('out/theirs.json');
  const known = read('known-divergences.json');
  const used = new Set();

  const diffs = [];
  const errors = [];
  let compared = 0;
  let agreed = 0;

  for (const c of cases) {
    const a = ours[c.id];
    const b = theirs[c.id];
    if (!a || !b) {
      errors.push({ id: c.id, error: !a ? 'missing from ours' : 'missing from theirs' });
      continue;
    }
    if (a.error || b.error) {
      errors.push({ id: c.id, error: a.error ?? b.error });
      continue;
    }
    for (const [metric, get] of METRICS) {
      const mine = get(a);
      const yours = get(b);
      if (mine === undefined || yours === undefined) continue;
      compared += 1;
      const delta = mine - yours;
      if (Math.abs(delta) < MATERIAL) {
        agreed += 1;
        continue;
      }
      const rule = known.find((k) => match(k, c, metric, delta));
      diffs.push({
        id: c.id,
        state: c.state,
        kind: c.kind,
        metric,
        ours: mine,
        theirs: yours,
        delta,
        known: rule ? rule.reason : null,
      });
      if (rule) used.add(rule);
    }
  }

  // An entry that matches nothing is the other half of Day 24's lesson. A stale
  // reason that still matches hides defects behind it; a stale reason that
  // matches nothing is a claim about this project that stopped being true and
  // that nobody will notice, because a report only ever lists what it found.
  const dead = known.filter((k) => !used.has(k));
  return { compared, agreed, diffs, errors, dead, cases: cases.length };
}

function money(n) {
  return `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function table(rows) {
  const lines = [
    '| case | metric | us-tax | PolicyEngine | difference |',
    '| --- | --- | ---: | ---: | ---: |',
  ];
  for (const d of rows) {
    lines.push(
      `| \`${d.id}\` | ${d.metric} | ${money(d.ours)} | ${money(d.theirs)} | ${money(d.delta)} |`,
    );
  }
  return lines.join('\n');
}

function report(result) {
  const unknown = result.diffs.filter((d) => d.known === null);
  const explained = result.diffs.filter((d) => d.known !== null);
  const byReason = new Map();
  for (const d of explained) {
    const list = byReason.get(d.known) ?? [];
    list.push(d);
    byReason.set(d.known, list);
  }

  const out = [];
  out.push('# Differential test against PolicyEngine-US');
  out.push('');
  out.push(
    `${result.cases} households, ${result.compared} figures compared, ` +
      `**${result.agreed} agree to the dollar** ` +
      `(${((result.agreed / result.compared) * 100).toFixed(1)}%).`,
  );
  out.push('');
  out.push(
    `${explained.length} differences are explained by \`known-divergences.json\`; ` +
      `**${unknown.length} are not.**`,
  );
  out.push('');
  if (result.errors.length) {
    out.push(`${result.errors.length} cases errored on one side and were not compared.`);
    out.push('');
  }

  out.push('## Unexplained');
  out.push('');
  if (unknown.length === 0) {
    out.push('None. Every difference has a recorded reason.');
  } else {
    out.push(table([...unknown].sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))));
  }
  out.push('');

  if (result.dead.length > 0) {
    out.push('## Reasons that matched nothing');
    out.push('');
    out.push(
      'Each of these is an entry in `known-divergences.json` that no difference ' +
        'in this run matched. That is usually good news — the difference it ' +
        'described was fixed — and it is listed because a reason nobody can see ' +
        'go stale is how a report starts lying.',
    );
    out.push('');
    for (const k of result.dead) {
      const scope = [k.state, k.kind, k.idIncludes].filter(Boolean).join(' / ') || 'any';
      out.push(`- \`${k.metric}\` (${scope}) — ${k.reason}`);
    }
    out.push('');
  }

  out.push('## Explained');
  out.push('');
  for (const [reason, rows] of [...byReason].sort((a, b) => b[1].length - a[1].length)) {
    const worst = rows.reduce((m, r) => (Math.abs(r.delta) > Math.abs(m.delta) ? r : m));
    out.push(
      `- **${rows.length}** — ${reason} (largest: \`${worst.id}\`, ${money(worst.delta)})`,
    );
  }
  out.push('');
  return out.join('\n');
}

const result = compare();
if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify(result, null, 1)}\n`);
} else {
  process.stdout.write(`${report(result)}\n`);
}
