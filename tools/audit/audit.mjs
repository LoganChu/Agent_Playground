/**
 * The verification audit, run by the buyer, against their own figures.
 *
 * ```
 * node tools/audit/audit.mjs --in your-figures.csv            # report to stdout
 * node tools/audit/audit.mjs --in your-figures.csv --out R.md
 * node tools/audit/audit.mjs --demo                           # the sample, no data needed
 * ```
 *
 * `OFFER.md` prices this at $2,500 and describes a report naming, for every
 * disagreement, the household, the two figures, the dollar size of the gap and
 * the statute line that settles it. **Until Day 74 that was a description of
 * work a human would do by hand, which makes it a promise.** This is the part of
 * it that is arithmetic, and it runs in a second on a laptop with no account, no
 * key and no data leaving the machine.
 *
 * Why give away the thing that was for sale: the audit was never the scarce
 * part. **The scarce part is being willing to look.** A buyer who runs this and
 * sees nine disagreements in eleven households now has a reason to pay for the
 * half a tool cannot do — reading the statute on the ones it could not explain,
 * and deciding which engine is wrong — and a buyer who runs it and agrees
 * everywhere was never going to buy anything.
 *
 * NOTHING IS SENT ANYWHERE. There is no network call in this tool or in either
 * package it imports; both are dependency-free. That is a property a buyer's
 * security review can check in about a minute, and it is the reason this is a
 * CLI rather than a hosted form.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normaliseRow, readRows, COLUMNS, REQUIRED } from './household.mjs';
import { diagnose, money } from './diagnose.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEMO = resolve(HERE, 'demo-synthetic.csv');

/** Strongest first, which is the order the report has to read in. */
const EVIDENCE_ORDER = ['recomputed', 'arithmetic'];
const EVIDENCE_LABEL = {
  recomputed: 'RECOMPUTED — the engine was re-run with one thing changed and returned your figure',
  arithmetic: 'ARITHMETIC — your figure equals a line item this return reports, exactly',
};

function parseArgs(argv) {
  const args = { in: null, out: null, demo: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--in' || arg === '-i') args.in = argv[(i += 1)];
    else if (arg === '--out' || arg === '-o') args.out = argv[(i += 1)];
    else if (arg === '--demo') args.demo = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`unknown argument ${JSON.stringify(arg)}`);
  }
  return args;
}

const USAGE = `node tools/audit/audit.mjs --in <file.csv|file.json> [--out <report.md>] [--json]
node tools/audit/audit.mjs --demo

Columns (${Object.keys(COLUMNS).length}); ${REQUIRED.join(', ')} are required, the rest default:
${Object.entries(COLUMNS)
  .map(([name, kind]) => `  ${name.padEnd(22)}${kind}`)
  .join('\n')}

  childAges   semicolon-separated: "3;7;15"
  county      a Maryland or Indiana county, where one taxes income
  locality    NYC or YONKERS
  theirTax    YOUR figure for this household: state income tax plus any local
              income tax on top of it, after credits
`;

/** Counts and totals, derived once so the headline and the sections cannot disagree. */
export function summarise(rows) {
  const errored = rows.filter((row) => row.error);
  const scored = rows.filter((row) => !row.error);
  const agree = scored.filter((row) => row.agreement);
  const differ = scored.filter((row) => !row.agreement);
  const unexplained = differ.filter((row) => row.diagnoses.length === 0);
  const byClass = new Map();
  for (const row of differ) {
    for (const name of new Set(row.diagnoses.map((d) => d.evidence))) {
      byClass.set(name, (byClass.get(name) ?? 0) + 1);
    }
  }
  const kinds = new Map();
  for (const row of differ) {
    for (const name of new Set(row.diagnoses.map((d) => d.kind))) {
      kinds.set(name, (kinds.get(name) ?? 0) + 1);
    }
  }
  const absGap = differ.reduce((sum, row) => sum + Math.abs(row.gap), 0);
  const largest = differ.reduce(
    (worst, row) => (Math.abs(row.gap) > Math.abs(worst?.gap ?? 0) ? row : worst),
    null,
  );
  return { errored, scored, agree, differ, unexplained, byClass, kinds, absGap, largest };
}

function reportFor(rows, source) {
  const s = summarise(rows);
  const out = [];
  const p = (line = '') => out.push(line);

  p('# Verification audit');
  p();
  p(`Input: \`${source}\` — **${rows.length} households**.`);
  p();
  p(
    'Produced by `tools/audit/audit.mjs` in the `us-state-tax` repository. Every figure ' +
      'below was computed on the machine that ran it; nothing was sent anywhere.',
  );
  p();
  p('## What the run found');
  p();
  p('```text');
  p(`  households audited                 ${String(rows.length).padStart(10)}`);
  p(`  agree to the cent                  ${String(s.agree.length).padStart(10)}`);
  p(`  disagree                           ${String(s.differ.length).padStart(10)}`);
  if (s.errored.length > 0) {
    p(`  could not be computed              ${String(s.errored.length).padStart(10)}`);
  }
  p(`  total of the gaps, absolute        ${money(s.absGap).padStart(10)}`);
  if (s.largest) {
    p(`  largest single gap                 ${money(Math.abs(s.largest.gap)).padStart(10)}   ${s.largest.id}`);
  }
  p(`  disagreements this tool explains   ${String(s.differ.length - s.unexplained.length).padStart(10)}`);
  p(`  disagreements it does NOT          ${String(s.unexplained.length).padStart(10)}`);
  p('```');
  p();
  if (s.differ.length > 0) {
    p(
      'The last line is the one worth reading twice. **A tool that explains every ' +
        'disagreement has a catch-all in it**, and this one is built to report the ' +
        'residue rather than absorb it. An unexplained gap is where a human has to ' +
        'read the statute and decide which of the two engines is wrong — which is ' +
        'what the paid audit is for, and is the only part of it that is not arithmetic.',
    );
    p();
  }

  if (s.kinds.size > 0) {
    p('### By what it is');
    p();
    p('| finding | households |');
    p('| --- | --- |');
    for (const [kind, count] of [...s.kinds].sort((a, b) => b[1] - a[1])) {
      p(`| \`${kind}\` | ${count} |`);
    }
    p();
    p('### By how strong the evidence is');
    p();
    for (const name of EVIDENCE_ORDER) {
      if (!s.byClass.has(name)) continue;
      p(`- **${s.byClass.get(name)}** household(s) — ${EVIDENCE_LABEL[name]}`);
    }
    p();
  }

  if (s.differ.length > 0) {
    p('## Every disagreement');
    p();
    p('| household | state | year | yours | this engine | gap | what explains it |');
    p('| --- | --- | --- | --- | --- | --- | --- |');
    for (const row of [...s.differ].sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))) {
      const first = row.diagnoses[0];
      p(
        `| \`${row.id}\` | ${row.household.state} | ${row.household.year} | ` +
          `${money(row.theirTax)} | ${money(row.ours)} | ${money(row.gap)} | ` +
          `${first ? `\`${first.kind}\`` : '**nothing — see below**'} |`,
      );
    }
    p();

    p('## Each one, with the provision named');
    p();
    for (const row of [...s.differ].sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))) {
      p(`### \`${row.id}\` — ${row.household.state} ${row.household.year}, ${money(row.gap)}`);
      p();
      p('```text');
      p(`  your figure          ${money(row.theirTax).padStart(14)}`);
      p(`  this engine          ${money(row.ours).padStart(14)}`);
      p(`  gap                  ${money(row.gap).padStart(14)}`);
      p(`  the household        ${describe(row.household)}`);
      p('```');
      p();
      if (row.diagnoses.length === 0) {
        p(
          '**UNEXPLAINED.** Nothing in this engine\'s own output accounts for this gap: it ' +
            'is not a credit, a surtax, a local tax, a filing status, an earlier year\'s ' +
            'parameters, the top rate on the whole base, or a rounding difference. This is ' +
            'the kind of disagreement that needs the statute read, and it is the kind most ' +
            'likely to be a real defect in one of the two engines.',
        );
        p();
      }
      for (const [index, d] of row.diagnoses.entries()) {
        p(
          `**${index + 1}. ${d.title}**  \n` +
            `*${EVIDENCE_LABEL[d.evidence].split(' — ')[0]}* — ${d.detail}`,
        );
        p();
      }
      if (row.diagnoses.length > 1) {
        p(
          `*${row.diagnoses.length} explanations match this gap arithmetically. They are ` +
            'listed strongest-evidence first and are not mutually exclusive; which one is ' +
            'the cause is a question about your code, not about this number.*',
        );
        p();
      }
      // THE NOTES GO WHERE THE HUMAN WORK IS, AND NOWHERE ELSE.
      //
      // `StateIncomeTaxResult.notes` is the best thing in this engine's output —
      // "things a caller would otherwise get wrong", in the state's own terms —
      // and printing all of it on all eleven demo rows made the report 111 KB,
      // of which about 85 KB was Georgia and New York prose a reader had already
      // skipped. So it is printed on the rows where NOTHING explained the gap,
      // which is exactly where a reader has to go and read a statute and wants
      // every clue the engine has. On an explained row the count is stated and
      // `--json` carries the rest.
      const notes = row.result?.notes ?? [];
      if (notes.length > 0 && row.diagnoses.length === 0) {
        p(
          '<details open><summary>What this engine said about the return itself — ' +
            `all ${notes.length} notes, because nothing above explained the gap</summary>`,
        );
        p();
        for (const note of notes) p(`- ${note}`);
        p();
        p('</details>');
        p();
      } else if (notes.length > 0) {
        p(
          `*This return carries ${notes.length} note(s) from the engine about things a ` +
            'caller would otherwise get wrong. They are omitted here because the gap is ' +
            'explained above; `--json` carries them.*',
        );
        p();
      }
      if (row.defaulted.length > 0) {
        p(
          `*This harness defaulted ${row.defaulted.length} field(s) on this row — ` +
            `${row.defaulted.join('; ')}. Where that matters the gap is this harness's ` +
            'silence rather than your engine\'s answer.*',
        );
        p();
      }
      if (row.citations?.length > 0) {
        p('<details><summary>The documents behind this state-year</summary>');
        p();
        for (const citation of row.citations) p(`- [${citation.title}](${citation.url})`);
        p();
        p('</details>');
        p();
      }
    }
  }

  if (s.errored.length > 0) {
    p('## Rows that could not be computed');
    p();
    for (const row of s.errored) p(`- \`${row.id}\` — ${row.error}`);
    p();
  }

  if (s.agree.length > 0) {
    p('## Where the two engines agree');
    p();
    p(
      `**${s.agree.length} of ${s.scored.length} households agree to the cent.** Listed ` +
        'because an audit that reports only disagreements tells a buyer nothing about how ' +
        'much of their product it actually exercised.',
    );
    p();
    for (const row of s.agree) {
      p(`- \`${row.id}\` — ${row.household.state} ${row.household.year}, ${money(row.ours)}`);
    }
    p();
  }

  p('## What this tool cannot do');
  p();
  p(
    '- **It cannot tell you which engine is right.** It names what explains a gap, not who ' +
      'is wrong. Several findings above are statements about which of two correct ' +
      'computations answers the question you asked.',
  );
  p(
    '- **Its input schema is narrow on purpose.** Sixteen columns, four required. A ' +
      'household whose income this schema cannot express is answered on the income it can, ' +
      'and every defaulted field is named on the row it affected.',
  );
  p(
    '- **It explains a gap; it does not find every gap.** It looks for the ways a tax ' +
      'engine is wrong that leave an arithmetic trace. A product that is wrong in a way ' +
      'that happens to land on no line item of this return is reported as unexplained, ' +
      'which is the right answer and not a useful one.',
  );
  p(
    '- **Nine states levy no individual income tax on wage income** and are correct at ' +
      'zero. A row for one of them that agrees proves nothing about the other 42.',
  );
  p();
  p('---');
  p();
  p(
    'Engine: `us-state-tax`, 42 states and 1,033 local income taxes, every figure mapped ' +
      'to the document it came from. The written audit — the half that reads the statute ' +
      'on the gaps this tool could not explain, and says which engine is wrong — is ' +
      'priced in `OFFER.md`.',
  );
  return `${out.join('\n')}\n`;
}

function describe(h) {
  const parts = [`${h.filingStatus}`, `age ${h.primaryAge}`];
  if (h.spouseAge !== null) parts.push(`spouse ${h.spouseAge}`);
  if (h.childAges.length > 0) parts.push(`children aged ${h.childAges.join(', ')}`);
  for (const [key, label] of [
    ['wages', 'wages'],
    ['pension', 'pension'],
    ['socialSecurity', 'Social Security'],
    ['longTermCapitalGains', 'long-term gains'],
    ['taxExemptInterest', 'tax-exempt interest'],
  ]) {
    if (h[key] > 0) parts.push(`${money(h[key])} ${label}`);
  }
  if (h.county) parts.push(`${h.county.ours} County`);
  if (h.locality) parts.push(h.locality);
  return parts.join(', ');
}

/** Read, normalise, diagnose. Exported so the test suite does not shell out. */
export function auditFile(path) {
  const text = readFileSync(path, 'utf8');
  const raw = readRows(text, path);
  if (raw.length === 0) throw new Error(`${path} has no rows`);
  return raw.map((row, index) => diagnose(normaliseRow(row, index)));
}

export { reportFor, DEMO };

// Guarded: importing this module must not audit anything. `tools/registry/
// surface.mjs` shipped the opposite on Day 73 and it printed a three-package
// report into a TAP stream.
if (process.argv[1] && process.argv[1].endsWith('audit.mjs')) {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (!args.in && !args.demo)) {
    process.stdout.write(USAGE);
    process.exit(args.help ? 0 : 1);
  }
  const path = args.demo ? DEMO : resolve(args.in);
  const rows = auditFile(path);
  const label = args.demo ? 'tools/audit/demo-synthetic.csv' : args.in;
  const body = args.json
    ? `${JSON.stringify(
        rows.map(({ result, household, ...rest }) => ({ ...rest, household })),
        null,
        1,
      )}\n`
    : reportFor(rows, label);
  if (args.out) {
    writeFileSync(resolve(args.out), body);
    const s = summarise(rows);
    process.stderr.write(
      `${rows.length} households, ${s.agree.length} agree, ${s.differ.length} differ, ` +
        `${s.unexplained.length} unexplained — ${args.out}\n`,
    );
  } else process.stdout.write(body);
}
