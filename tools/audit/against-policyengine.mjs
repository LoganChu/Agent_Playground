/**
 * The audit, pointed at an engine somebody else wrote.
 *
 * ```
 * node tools/audit/against-policyengine.mjs            # the report, to stdout
 * node tools/audit/against-policyengine.mjs --limit 50 # a quick slice
 * ```
 *
 * **THE PROBLEM THIS EXISTS TO SOLVE: `demo-synthetic.csv` IS TWELVE HOUSEHOLDS
 * I INVENTED, WHICH MAKES IT A DEMONSTRATION AND NOT EVIDENCE.** Each demo row
 * is wrong in exactly one way I had already decided the tool would find, so the
 * tool finding it proves the wiring works and nothing about whether the
 * classifier is any good. The question a buyer actually has — *what does this
 * say when it is pointed at a real engine's real output?* — cannot be answered
 * by input I wrote to be answered.
 *
 * `tools/differential` already holds the answer: **2,904 households and
 * `policyengine-us`'s own figure for each**, in `out/theirs.json`. So this runs
 * the audit over all of them with PolicyEngine's state tax in the buyer's
 * column.
 *
 * And it is gradeable, which is the rare part. The differential harness has
 * **hand-classified every difference** — 1,181 explained by the 71 rules in
 * `known-divergences.json`, each with a written reason and a bound, and 16 it
 * could not explain. So this does not merely report what the audit found; it
 * scores the audit's mechanical classification against a human's, in four
 * buckets:
 *
 *   AGREED-UNEXPLAINED   the human could not explain it and nor could the tool.
 *                        The tool's honest answer, on the hardest cases.
 *   TOOL-EXPLAINED-ONLY  the human could not explain it and the tool named
 *                        something. Either a genuine find or a false positive,
 *                        and each one is printed in full so it can be read.
 *   BOTH-EXPLAINED       both had an account of it. The accounts may differ.
 *   HUMAN-ONLY           a known divergence the tool is silent about. Expected
 *                        and not a defect: most known divergences are about a
 *                        provision neither engine's OUTPUT mentions.
 *
 * **THE HUMAN VERDICT IS READ OUT OF `tools/differential/REPORT.md`, NOT
 * RE-DERIVED FROM THE 71 RULES.** Matching a rule to a case is 130 lines in
 * `compare.mjs` — `maxAbs`, `maxShareOfIncome`, `minAbs`, a sign check and a
 * selector allowlist, every one of which was added after a bound absorbed a
 * difference it was not about. A second implementation here would be a second
 * place for that to be wrong, and it would be wrong in the direction that
 * flatters this file. The committed report is that code's own output.
 *
 * **AND THE TWO HARNESSES DO NOT AGREE ON WHAT A DIFFERENCE IS.** The
 * differential compares to the DOLLAR; the audit compares to the CENT, because
 * a buyer's own figure is a figure they printed on something. So every
 * difference under a dollar was never classified by a human at all — the
 * differential counted it as agreement — and scoring those against an empty
 * verdict would manufacture a result. They are separated out and reported on
 * their own, which turns out to be a finding about the differential rather than
 * about the audit.
 *
 * This is deliberately a measurement and not a gate. It is not in CI and it
 * pins nothing, because PolicyEngine's figures move when they release and an
 * assertion over somebody else's model would fail for their reasons. What it
 * produces is a number that goes in the journal and in `OFFER.md`, honestly
 * whichever way it comes out.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cases } from '../differential/cases.mjs';
import { diagnose, money } from './diagnose.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const json = (p) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));

function main() {
  const limitArg = process.argv.indexOf('--limit');
  const limit = limitArg === -1 ? Infinity : Number(process.argv[limitArg + 1]);

  const theirs = json('tools/differential/out/theirs.json');

  // THE CASES THE HUMAN COULD NOT EXPLAIN, read off the differential harness's
  // own committed report. Only `state.tax` rows: the report also lists
  // unexplained FEDERAL metrics, which this tool does not look at and must not
  // claim a verdict about.
  const report = readFileSync(resolve(ROOT, 'tools/differential/REPORT.md'), 'utf8');
  const unexplainedSection = report.slice(
    report.indexOf('## Unexplained'),
    report.indexOf('\n## ', report.indexOf('## Unexplained') + 1),
  );
  const humanCouldNot = new Set(
    [...unexplainedSection.matchAll(/^\|\s*`([^`]+)`\s*\|\s*state\.tax\s*\|/gm)].map(
      (m) => m[1],
    ),
  );
  if (humanCouldNot.size === 0) {
    throw new Error(
      'no unexplained state.tax rows found in tools/differential/REPORT.md — the table ' +
        'shape changed, and scoring against an empty verdict set would report every ' +
        'difference as one the human explained',
    );
  }

  const all = cases();
  const rows = [];
  let skipped = 0;
  for (const c of all) {
    if (rows.length >= limit) break;
    const entry = theirs[c.id];
    // A case PolicyEngine could not compute, or that this harness's own
    // `ours.mjs` refuses, is not a disagreement. Counted and set aside.
    if (!entry || entry.error || !entry.state || typeof entry.state.tax !== 'number') {
      skipped += 1;
      continue;
    }
    const out = diagnose({
      household: c,
      theirTax: entry.state.tax,
      defaulted: [],
      unknownColumns: [],
    });
    if (out.error) {
      skipped += 1;
      continue;
    }
    rows.push({ ...out, humanCouldNot: humanCouldNot.has(c.id) });
  }

  const differ = rows.filter((row) => !row.agreement);
  // Under a dollar: the differential called these agreement, so no human ever
  // classified them and they are scored against nothing.
  const subDollar = differ.filter((row) => Math.abs(row.gap) < 1);
  const scored = differ.filter((row) => Math.abs(row.gap) >= 1);
  const toolExplained = scored.filter((row) => row.diagnoses.length > 0);
  const bucket = (couldNot, tool) =>
    scored.filter(
      (row) => row.humanCouldNot === couldNot && row.diagnoses.length > 0 === tool,
    );
  const agreedUnexplained = bucket(true, false);
  const toolOnly = bucket(true, true);
  const bothExplained = bucket(false, true);
  const humanOnly = bucket(false, false);

  const kinds = new Map();
  for (const row of scored) {
    for (const kind of new Set(row.diagnoses.map((d) => d.kind))) {
      kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
    }
  }

  const out = [];
  const p = (line = '') => out.push(line);
  p('# The audit, pointed at PolicyEngine-US');
  p();
  p(
    'Produced by `tools/audit/against-policyengine.mjs`. This is a MEASUREMENT, not a ' +
      'gate: it is not in CI and it pins nothing, because PolicyEngine’s figures move ' +
      'when they release and an assertion over somebody else’s model would fail for ' +
      'their reasons.',
  );
  p();
  p('## What happened');
  p();
  p('```text');
  p(`  households with a figure on both sides   ${String(rows.length).padStart(8)}`);
  p(`  set aside (no figure, or refused)        ${String(skipped).padStart(8)}`);
  p(`  agree to the CENT                        ${String(rows.length - differ.length).padStart(8)}`);
  p(`  differ by under a dollar                 ${String(subDollar.length).padStart(8)}`);
  p(`  differ by a dollar or more               ${String(scored.length).padStart(8)}`);
  p(`    of those, the tool explains            ${String(toolExplained.length).padStart(8)}`);
  p(`    of those, it does NOT                  ${String(scored.length - toolExplained.length).padStart(8)}`);
  p('```');
  p();
  p(
    `**The ${subDollar.length} sub-dollar differences are a finding about the differential ` +
      'harness, not about the audit.** That harness compares to the dollar and counted ' +
      'every one of them as agreement; this one compares to the cent, because a buyer’s ' +
      'figure is a figure they printed on something. They are set aside from the scoring ' +
      'below — no human ever classified them, so there is nothing to score against — and ' +
      'they are listed at the end.',
  );
  p();
  p('## Scored against the human classification');
  p();
  p(
    '`tools/differential/known-divergences.json` is 71 hand-written rules accounting for ' +
      'every difference that harness accepts, each with a reason and a bound; the cases ' +
      'it could NOT account for are listed in `tools/differential/REPORT.md`, and that ' +
      'list — the harness’s own output, not a re-derivation of its matcher — is the human ' +
      'verdict used here. Over the ' +
      `${scored.length} differences of a dollar or more:`,
  );
  p();
  p('| | human explained it | human could not |');
  p('| --- | ---: | ---: |');
  p(`| **tool named something** | ${bothExplained.length} | ${toolOnly.length} |`);
  p(`| **tool was silent** | ${humanOnly.length} | ${agreedUnexplained.length} |`);
  p();
  p(
    '**`tool was silent` / `human explained it` is expected and is not a defect.** Most ' +
      'known divergences are about a provision neither engine’s OUTPUT mentions — a ' +
      'different reading of one statute, or a figure PolicyEngine models and this engine ' +
      'does not. The audit only sees what a return reports, by design.',
  );
  p();
  const statusFindings = scored.flatMap((row) =>
    row.diagnoses.filter((d) => d.kind === 'filing-status'),
  );
  const confusable = statusFindings.filter((d) => d.confusable).length;
  if (statusFindings.length > 0) {
    p('### The class that fires most, and why its count is not a success');
    p();
    p(
      `\`filing-status\` produced ${statusFindings.length} findings over ` +
        `${new Set(scored.filter((row) => row.diagnoses.some((d) => d.kind === 'filing-status')).map((row) => row.id)).size} ` +
        'households — the largest class here by a distance. **On almost all of them the ' +
        'human account says something else and better**: PolicyEngine allows the § 32(d) ' +
        'earned income credit to EVERY married-filing-separately filer and this package ' +
        'does not. On a state return whose only status-sensitive line is a percentage of ' +
        'that federal credit, *"they used the status single"* and *"they allowed a separate ' +
        'filer a single-filer credit"* are the same number, and a re-run cannot separate ' +
        'them because both re-runs are the same re-run.',
    );
    p();
    p('```text');
    p(`  findings that move NOTHING BUT A CREDIT   ${String(confusable).padStart(5)}   inconclusive, and they say so`);
    p(`  findings that move a bracket or deduction ${String(statusFindings.length - confusable).padStart(5)}   specific to the status`);
    p('```');
    p();
    p(
      '> **A CLASS THAT FIRES OFTEN AND AGREES WITH A HUMAN’S DIFFERENT ACCOUNT IS NOT ' +
        'CORROBORATED, IT IS CONFUSABLE.** The discriminator exists because of this run.',
    );
    p();
  }
  if (kinds.size > 0) {
    p('### What the tool said, by class');
    p();
    p('| finding | households |');
    p('| --- | ---: |');
    for (const [kind, count] of [...kinds].sort((a, b) => b[1] - a[1])) {
      p(`| \`${kind}\` | ${count} |`);
    }
    p();
  }

  p('## Every case the human could not explain and the tool could');
  p();
  p(
    'This is the bucket that matters, in both directions: a genuine find here is the ' +
      'tool earning its keep on the hardest cases in the repository, and a false ' +
      'positive here is the tool telling a buyer something untrue. **Each one is printed ' +
      'in full so it can be read rather than counted.**',
  );
  p();
  if (toolOnly.length === 0) {
    p('*None.* On every difference the differential harness could not account for, the ' +
      'audit was also silent.');
    p();
  }
  for (const row of [...toolOnly].sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))) {
    p(`### \`${row.id}\``);
    p();
    p('```text');
    p(`  PolicyEngine  ${money(row.theirTax).padStart(14)}`);
    p(`  this engine   ${money(row.ours).padStart(14)}`);
    p(`  gap           ${money(row.gap).padStart(14)}`);
    p('```');
    p();
    for (const d of row.diagnoses) {
      p(`- **${d.kind}** — ${d.title}  \n  *${d.evidence}* — ${d.detail}`);
    }
    p();
  }

  p('## The largest gaps the tool was silent about');
  p();
  p(
    'The residue, biggest first. These are where a human has to read the statute, which ' +
      'is the half of the audit that is not arithmetic.',
  );
  p();
  p('| case | PolicyEngine | this engine | gap | human had a reason |');
  p('| --- | ---: | ---: | ---: | --- |');
  for (const row of [...scored]
    .filter((candidate) => candidate.diagnoses.length === 0)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, 25)) {
    p(
      `| \`${row.id}\` | ${money(row.theirTax)} | ${money(row.ours)} | ${money(row.gap)} | ` +
        `${row.humanCouldNot ? '**no**' : 'yes'} |`,
    );
  }
  p();

  p('## The sub-dollar differences the differential harness calls agreement');
  p();
  p(
    `All ${subDollar.length} of them, because the count is the point: two engines that ` +
      '"agree to the dollar" on a state tax bill disagree about the cents this often. ' +
      'Whether that matters is the buyer’s call and not this tool’s, which is why it is ' +
      'a `rounding` class and not an error.',
  );
  p();
  p('| case | PolicyEngine | this engine | gap |');
  p('| --- | ---: | ---: | ---: |');
  for (const row of [...subDollar]
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, 40)) {
    p(`| \`${row.id}\` | ${money(row.theirTax)} | ${money(row.ours)} | ${money(row.gap)} |`);
  }
  if (subDollar.length > 40) p(`\n*…and ${subDollar.length - 40} more.*`);
  p();
  return out.join('\n') + '\n';
}

if (process.argv[1] && process.argv[1].endsWith('against-policyengine.mjs')) {
  process.stdout.write(main());
}

export { main };
