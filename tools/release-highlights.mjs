#!/usr/bin/env node
/**
 * The findings, as markdown, for the body of the `calculator` Release.
 *
 * ## Why this file exists, which is a distribution argument rather than a tax one
 *
 * With GitHub Pages off, nothing on a registry, and no description or topics on
 * the repository, there is exactly **one** piece of public, search-indexed,
 * human-readable prose this project controls without a human touching anything:
 * the body text of its own Release. `dist.yml` writes that text on every push to
 * `main`, so it is the one surface where this repository can say something to a
 * stranger entirely under its own power.
 *
 * Until Day 80 it said that two files exist and what they do. That is a
 * description of an artefact, and nobody searches for an artefact — they search
 * for the question they are stuck on. A developer who has just been told their
 * Kansas figure is wrong types something like "kansas widow filing status
 * standard deduction", and the sentence that would answer them was sitting in a
 * page nobody can reach.
 *
 * So the Release body now carries the findings themselves.
 *
 * ## Every figure is DERIVED, and that is the whole design
 *
 * The release notes already read the supported-state count out of the engine,
 * which is the rule the READMEs have had since Day 8. They also, until Day 80,
 * said "seven households" about a page whose own title says Ten — the fifth of
 * six places that count is written and the first a reader meets on the Release
 * page. The lesson of that defect is not "gate the prose"; it is **do not write
 * the figure down**.
 *
 * Nothing here is transcribed. Each row's headline, household and both figures
 * come from `runChecks()`, which computes both sides from the engine, so this
 * output cannot disagree with the page it summarises and cannot go stale while
 * the engine is right. If a finding changes shape, this text changes with it.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOW_MANY = Number(process.env.RELEASE_HIGHLIGHTS ?? 3);

let runChecks;
try {
  ({ runChecks } = await import(join(ROOT, 'site/dist/src/checks.js')));
} catch (err) {
  console.error(`cannot import the findings module: ${err.message}`);
  console.error('');
  console.error('This tool reads the built site rather than its source, so build it first:');
  console.error('  (cd site && npm run build)');
  process.exit(1);
}

const money = (n) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const rows = runChecks();

// A row is quoted only if its two sides differ by at least a dollar OF MONEY.
// Arkansas's row is a pair of RATES — 13.70% against a published 3.7% — so its
// `difference` is 0.1 and means ten percentage points, not ten cents. Printing
// it through `money()` would read as a ten-cent finding, which is the one way to
// make the sharpest number here look like the weakest.
const quotable = rows
  .filter((r) => Number.isFinite(r.difference) && Math.abs(r.difference) >= 1)
  .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
  .slice(0, HOW_MANY);

if (!quotable.length) {
  console.error('no findings had a dollar difference — refusing to print an empty list');
  process.exit(1);
}

for (const r of quotable) {
  // The headline is the sentence a person might actually search for, and the
  // household is what makes it checkable against their own software.
  //
  // The gap is appended only when the headline does not already quote it. Since
  // Day 80 a headline may be a FUNCTION of its own row, and the New Mexico one
  // is — so printing the figure unconditionally said "$2,920.05 of tax ...
  // $2,920.05 apart" in one sentence.
  const gap = money(Math.abs(r.difference));
  const already = r.headline.includes(gap);
  console.log(`- **${r.headline}** ${r.household}${already ? '.' : ` — ${gap} apart.`}`);
}
