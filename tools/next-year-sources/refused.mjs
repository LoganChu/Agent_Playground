#!/usr/bin/env node
/**
 * The states this engine refuses for its latest supported year, as a list the
 * Python scanner beside this file can take verbatim.
 *
 * Day 86's `next-year-candidates.mjs` screens the SAME thirty states by diffing
 * their own numeric leaves. This prints the question rather than answering it,
 * so the two tools cannot drift apart on which states are being asked about —
 * a list typed twice is a list that disagrees with itself, which is the defect
 * `--check` below exists to make loud.
 *
 *   node tools/next-year-sources/refused.mjs            the comma-separated list
 *   node tools/next-year-sources/refused.mjs --check    the committed report
 *                                                       still asks about exactly
 *                                                       these states
 */
import { readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

const state = await import(join(ROOT, 'packages/us-state-tax/dist/esm/index.js')).catch((err) => {
  console.error(`cannot import us-state-tax: ${err.message}`);
  console.error('  (cd packages/us-state-tax && npm install && npm run build)');
  process.exit(1);
});

const year = state.SUPPORTED_YEARS.at(-1);
const refused = state.SUPPORTED_STATES.filter((s) => !state.statesForYear(year).includes(s));

if (!process.argv.includes('--check')) {
  console.log(refused.join(','));
  process.exit(0);
}

// --check: the committed scan must have asked about exactly today's refused set.
let report;
try {
  report = JSON.parse(readFileSync(join(HERE, 'out/sources.json'), 'utf8'));
} catch (err) {
  console.error(`cannot read the committed scan: ${err.message}`);
  process.exit(1);
}

const asked = [...report.asked_about].sort().join(',');
const now = [...refused].sort().join(',');
const problems = [];
if (report.year !== year) {
  problems.push(`the scan answers for ${report.year} and the engine's latest year is ${year}`);
}
if (asked !== now) {
  const gone = report.asked_about.filter((s) => !refused.includes(s));
  const added = refused.filter((s) => !report.asked_about.includes(s));
  if (gone.length) problems.push(`the scan still asks about ${gone.join(', ')}, which now serve ${year}`);
  if (added.length) problems.push(`${added.join(', ')} now refuse ${year} and the scan never asked about them`);
}

if (problems.length) {
  console.error('The committed scan and the registry disagree about the question.\n');
  for (const p of problems) console.error(`  ${p}`);
  console.error('\nRe-run scan.py — see its module docstring for the two commands.');
  process.exit(1);
}

// Count what the worklist actually is, not how many states the scan has any row
// for: a row dated 2030 is a sunset and says nothing about 2027, and a row
// PolicyEngine UPRATED is a forecast. The first draft of this line printed
// `Object.keys(report.states).length` and said 11 where the honest number is 5.
const onYear = Object.entries(report.states).filter(([, rows]) =>
  rows.some(
    (row) =>
      !row.uprated &&
      Object.values(row.future ?? {}).some((dates) => Object.keys(dates).some((d) => Number(d.slice(0, 4)) === year)),
  ),
);

console.log(
  `ok — the committed scan asks about exactly the ${refused.length} state(s) that refuse ${year}, ` +
    `against ${report.source} ${report.version}; a transcribed figure dated ${year} itself exists for ` +
    `${onYear.length} of them (${onYear.map(([s]) => s).join(', ')})`,
);
