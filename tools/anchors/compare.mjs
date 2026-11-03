/**
 * The anchor report: this package's answer against a figure read off a filled
 * form, within the fixture's OWN tolerance.
 *
 * ```
 * node tools/anchors/compare.mjs            # report
 * node tools/anchors/compare.mjs --json     # machine-readable, for the test
 * ```
 *
 * ## THE MARGIN IS THE FIXTURE'S AND NEVER THIS HARNESS'S
 *
 * The fifteen fixture files carry margins from `0.01` to `5`, and they are not
 * arbitrary: a case whose expected value came off a form rounded to the dollar
 * cannot be held to the cent, and a case whose expected value is an exact
 * worksheet line must be. A harness that imposed ONE margin would either
 * reject a correct answer or accept a wrong one, so each case is checked
 * against the number its author wrote down -- and a case with no stated margin
 * must match to the cent, which is the strictest reading of silence rather
 * than the most convenient one.
 *
 * ## WHAT AN AGREEMENT IS AND IS NOT EVIDENCE OF
 *
 * `LIMITATIONS` below names the households where this harness cannot put a
 * question to the engine completely, and it exists because the alternative is
 * worse than a gap: an agreement reached with a rule switched off reads
 * exactly like an agreement reached with it on. Every limitation is printed
 * with the report, counted separately from the agreements, and its anchors are
 * marked so nobody quotes one as proof of a rule it never exercised.
 */
import { readFileSync } from 'node:fs';

const here = (name) => new URL(`./out/${name}`, import.meta.url);

/**
 * Households this harness answers INCOMPLETELY, by anchor id, with what is
 * missing. An entry here does not excuse a disagreement -- it is printed
 * whether the case agrees or not, because the point is that the agreement is
 * about less than the whole return.
 */
const LIMITATIONS = {
  '2025-VA-va-4': {
    what: "Virginia's spouse tax adjustment is not claimed",
    why:
      'The engine takes `lesserSpouseIncome` as line 5 of the Form 760 worksheet — the ' +
      "lesser spouse's Virginia AGI less that spouse's own exemptions — and this harness " +
      'cannot compute a Virginia figure without reimplementing Virginia. It passes neither ' +
      'that field nor `bothSpousesHaveQualifyingIncome`, so the adjustment is unclaimed. ' +
      'For THIS household the anchor says the adjustment is zero, so the figures agree; a ' +
      'two-earner Virginia couple who qualify would be overstated here by up to $257.50.',
  },
};

const anchorsFile = JSON.parse(readFileSync(here('anchors.json'), 'utf8'));
const ours = JSON.parse(readFileSync(here('ours.json'), 'utf8'));
const json = process.argv.includes('--json');

const rows = [];
for (const anchor of anchorsFile.anchors) {
  const got = ours[anchor.id];
  if (got === undefined) throw new Error(`${anchor.id}: no answer in out/ours.json — re-run ours.mjs`);
  // A stated margin or the cent. Silence is the strict reading.
  const margin = anchor.margin === null || anchor.margin === undefined ? 0.01 : Number(anchor.margin);
  for (const expectation of anchor.expect) {
    if (got.error !== null) {
      rows.push({
        ...skeleton(anchor, expectation, margin),
        verdict: 'error',
        detail: got.error,
      });
      continue;
    }
    const value = got.ours[expectation.comparand];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      rows.push({ ...skeleton(anchor, expectation, margin), verdict: 'error', detail: `no ${expectation.comparand}` });
      continue;
    }
    const difference = round(value - expectation.value);
    rows.push({
      ...skeleton(anchor, expectation, margin),
      ours: round(value),
      difference,
      verdict: Math.abs(difference) <= margin + 1e-9 ? 'agree' : 'disagree',
    });
  }
}

function skeleton(anchor, expectation, margin) {
  return {
    id: anchor.id,
    state: anchor.state,
    year: anchor.year,
    name: anchor.source.name,
    source: `${anchor.source.file}[${anchor.source.index}]`,
    variable: expectation.variable,
    comparand: expectation.comparand,
    expected: expectation.value,
    margin,
    limitation: LIMITATIONS[anchor.id]?.what ?? null,
  };
}

function round(n) {
  return Math.round(n * 100) / 100;
}

const agree = rows.filter((r) => r.verdict === 'agree');
const disagree = rows.filter((r) => r.verdict === 'disagree');
const errored = rows.filter((r) => r.verdict === 'error');
const states = [...new Set(rows.map((r) => r.state))].sort();
const agreeingStates = [...new Set(agree.map((r) => r.state))].sort();

const summary = {
  upstream: anchorsFile.upstream,
  counts: {
    ...anchorsFile.counts,
    assertionsCompared: rows.length,
    agree: agree.length,
    disagree: disagree.length,
    errored: errored.length,
    states: states.length,
    limitations: Object.keys(LIMITATIONS).length,
  },
  states,
  agreeingStates,
  rows,
  limitations: LIMITATIONS,
  refused: anchorsFile.refused,
};

if (json) {
  process.stdout.write(`${JSON.stringify(summary, null, 1)}\n`);
} else {
  const c = anchorsFile.counts;
  const w = (s, n) => String(s).padEnd(n);
  const r = (s, n) => String(s).padStart(n);
  const out = [];
  out.push('# The preparer-anchor report');
  out.push('');
  out.push('GENERATED by `node tools/anchors/compare.mjs > tools/anchors/REPORT.md`. Do not edit.');
  out.push('');
  out.push('Every row\'s expected value was produced OUTSIDE this repository — by commercial');
  out.push("tax software, by a state's own worksheet, or by TAXSIM — and is read out of a");
  out.push('`policyengine-us` test fixture at a pinned commit. The margin on each row is the');
  out.push("fixture author's own, never this harness's.");
  out.push('');
  out.push(`- upstream: \`policyengine-us\` **${anchorsFile.upstream.version}** @ \`${anchorsFile.upstream.commit}\``);
  out.push(`- ${c.cases} fixture cases read from ${anchorsFile.files.length} files; **${c.keptCases} translated**; ${rows.length} assertions compared`);
  out.push(`- **${agree.length} agree**, ${disagree.length} disagree, ${errored.length} errored, across **${agreeingStates.length} states** — ${agreeingStates.join(', ')}`);
  out.push(`- ${c.refused} refused as untranslatable; ${c.skippedYear} outside ${'2025–2026'}; ${c.skippedNoComparand} asserting nothing comparable`);
  out.push('');
  out.push('```text');
  out.push(`${w('anchor', 15)}${w('asserted variable', 44)}${r('expected', 12)}${r('ours', 12)}${r('diff', 10)}${r('margin', 8)}`);
  out.push('-'.repeat(101));
  for (const row of rows) {
    const mark = row.verdict === 'agree' ? (row.limitation ? ' ~' : '') : row.verdict === 'disagree' ? ' X' : ' !';
    out.push(
      `${w(row.id, 15)}${w(row.variable, 44)}${r(row.expected.toFixed(2), 12)}` +
        `${r(row.ours === undefined ? '-' : row.ours.toFixed(2), 12)}${r(row.difference === undefined ? '-' : row.difference.toFixed(2), 10)}` +
        `${r(row.margin, 8)}${mark}`,
    );
  }
  out.push('```');
  out.push('');
  out.push('## Disagreements');
  out.push('');
  if (disagree.length === 0) {
    out.push('None.');
  } else {
    out.push('Each one is a defect here or a finding, and both are worth more than an agreement.');
    out.push('');
    for (const row of disagree) {
      out.push(`- **${row.id}** \`${row.variable}\` — expected \`${row.expected}\`, this package \`${row.ours}\`, off by \`${row.difference > 0 ? '+' : ''}${row.difference}\``);
      out.push(`  - ${row.name}`);
      out.push(`  - \`${row.source}\``);
    }
  }
  out.push('');
  out.push('## Incomplete questions');
  out.push('');
  if (Object.keys(LIMITATIONS).length === 0) {
    out.push('None.');
  } else {
    out.push('Marked `~` above. An agreement on one of these is about LESS THAN THE WHOLE RETURN,');
    out.push('and is listed here so nobody quotes it as evidence about a rule it never exercised.');
    out.push('');
    for (const [id, limitation] of Object.entries(LIMITATIONS)) {
      out.push(`- **${id}** — ${limitation.what}`);
      out.push(`  - ${limitation.why}`);
    }
  }
  out.push('');
  out.push('## What is asserted upstream and has no comparand here');
  out.push('');
  out.push('These cases are **in a supported year and a shipped state** and were skipped only');
  out.push('because every variable they assert is a `policyengine-us` internal with nothing to');
  out.push('compare it to. They are the largest remaining expansion of this harness and they are');
  out.push('listed by the variable they assert, commonest first, so the next run picks the one');
  out.push('that buys the most households rather than the one it happens to read first.');
  out.push('');
  out.push('`compare.mjs` compares a per-state TOTAL (`income_tax`, `taxable_income`,');
  out.push('`income_tax_before_non_refundable_credits`). This engine also returns `credits[]` with');
  out.push('NAMES, so a comparand for a named credit would reach most of the rows below — at the');
  out.push('cost of a per-state map from their variable to this package\'s credit name, which is');
  out.push('exactly the kind of hand-written correspondence that has to refuse rather than guess.');
  out.push('');
  const unreachable = new Map();
  for (const skip of anchorsFile.skipped) {
    if (skip.asserted === undefined) continue;
    for (const variable of skip.asserted) {
      if (!unreachable.has(variable)) unreachable.set(variable, 0);
      unreachable.set(variable, unreachable.get(variable) + 1);
    }
  }
  const ranked = [...unreachable.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (ranked.length === 0) {
    out.push('None.');
  } else {
    out.push('```text');
    out.push(`${w('asserted variable', 54)}${r('cases', 7)}`);
    out.push('-'.repeat(61));
    for (const [variable, count] of ranked) out.push(`${w(variable, 54)}${r(count, 7)}`);
    out.push('```');
  }
  out.push('');
  out.push('## Refused by the reader');
  out.push('');
  if (anchorsFile.refused.length === 0) {
    out.push('None.');
  } else {
    out.push('In scope — a supported year, a shipped state, a comparable assertion — and carrying');
    out.push('a household fact `tools/anchors/read.py` cannot translate. A refusal is a statement');
    out.push('about this harness, and an ignored field would have been a wrong answer wearing the');
    out.push("clothes of a disagreement.");
    out.push('');
    for (const refusal of anchorsFile.refused) {
      out.push(`- \`${refusal.ref}\` ${refusal.state} ${refusal.year} — ${refusal.name}`);
      for (const problem of refusal.problems) out.push(`  - \`${problem}\``);
    }
  }
  out.push('');
  process.stdout.write(`${out.join('\n')}\n`);
}
