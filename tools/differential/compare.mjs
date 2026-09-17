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

function match(rule, caseRow, metric) {
  if (rule.metric !== metric) return false;
  if (rule.state && rule.state !== caseRow.state) return false;
  if (rule.kind && rule.kind !== caseRow.kind) return false;
  if (rule.idIncludes && !caseRow.id.includes(rule.idIncludes)) return false;
  return true;
}

export function compare() {
  const cases = read('out/cases.json');
  const ours = read('out/ours.json');
  const theirs = read('out/theirs.json');
  const known = read('known-divergences.json');

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
      const rule = known.find((k) => match(k, c, metric));
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
    }
  }

  return { compared, agreed, diffs, errors, cases: cases.length };
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
