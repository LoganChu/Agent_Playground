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
import { createHash } from 'node:crypto';
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
/**
 * Every dollar of income a case puts in front of either model.
 *
 * The denominator `maxShareOfIncome` is read against — see {@link match}. It is
 * the case's own figures rather than either model's answer, so the bound is a
 * property of the question and cannot move when an engine changes.
 */
function caseIncome(caseRow) {
  return (
    (caseRow.wages ?? 0) +
    (caseRow.pension ?? 0) +
    (caseRow.socialSecurity ?? 0) +
    (caseRow.longTermCapitalGains ?? 0) +
    (caseRow.taxExemptInterest ?? 0)
  );
}

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
 * So a reason states the size it claims. A difference larger than `maxAbs` is
 * reported as unexplained however well the rest of the entry matches, which
 * makes the report fail loudly in the one direction that matters: a known small
 * gap growing into an unknown large one.
 *
 * `maxShareOfIncome` is Day 25's addition, and it exists because **a reason
 * about a RATE cannot state its size in dollars.** The two models disagree
 * about one Maryland county's 2026 rate by 0.17 of a point, which is $43.76 on
 * a $30,000 household and $678.70 on a $400,000 one — the same single fact,
 * fifteen times the size. A `maxAbs` wide enough for the second is fifteen
 * times too wide for the first, and would quietly explain any Maryland defect
 * under $700. So a rate disagreement states its bound as a rate, and the two
 * fields add: the entry is allowed `maxAbs` dollars plus `maxShareOfIncome` of
 * the household's income, which is exactly the shape of "one rate differs, and
 * one fixed figure differs."
 */
function match(rule, caseRow, metric, delta) {
  if (rule.metric !== metric) return false;
  if (rule.state && rule.state !== caseRow.state) return false;
  if (rule.kind && rule.kind !== caseRow.kind) return false;
  if (rule.idIncludes && !caseRow.id.includes(rule.idIncludes)) return false;
  if (rule.maxAbs !== undefined || rule.maxShareOfIncome !== undefined) {
    const bound =
      (rule.maxAbs ?? 0) + (rule.maxShareOfIncome ?? 0) * caseIncome(caseRow);
    if (Math.abs(delta) > bound) return false;
  }
  return true;
}

/**
 * Refuse to report on answers that were given to a different grid.
 *
 * `out/theirs.json` is committed so CI can run the cheap half of this harness on
 * every push — this project's side regenerates in three seconds, PolicyEngine's
 * ten-minute pass does not. The price is that the committed answers can go stale
 * the moment `cases.mjs` changes, and nothing noticed: every id that survives a
 * widening still resolves, and every case whose FIGURES changed is then compared
 * against the answer to a different question, silently and in this project's
 * favour or against it at random.
 *
 * `theirs.py` now writes the SHA-256 of the exact cases file it read. If it does
 * not match the cases file in front of us, there is no report to write.
 */
function requireFreshTheirs() {
  const cases = readFileSync(join(here, 'out/cases.json'));
  const digest = createHash('sha256').update(cases).digest('hex');
  let recorded;
  try {
    recorded = readFileSync(join(here, 'out/theirs.cases.sha256'), 'utf8').trim();
  } catch {
    throw new Error(
      'out/theirs.cases.sha256 is missing. Re-run theirs.py — it writes the fingerprint ' +
        'of the cases file it answered, and without one there is no way to tell a fresh ' +
        'out/theirs.json from a stale one.',
    );
  }
  if (recorded !== digest) {
    throw new Error(
      `out/theirs.json answers a different grid. cases.json is ${digest.slice(0, 12)} and ` +
        `PolicyEngine last answered ${recorded.slice(0, 12)}. Re-run the PolicyEngine pass ` +
        '(tools/differential/README.md) and commit out/theirs.json with its sidecar.',
    );
  }
}

export function compare() {
  requireFreshTheirs();
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
