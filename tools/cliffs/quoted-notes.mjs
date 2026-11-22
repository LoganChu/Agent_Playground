#!/usr/bin/env node
/**
 * Every note `CLIFFS.md` quotes must still be a note the engine emits.
 *
 * ## WHY THIS FILE EXISTS, AND WHY IT IS NOT THE SWEEP
 *
 * `CLIFFS.md` prints, under each state's notch table, the shipped note that was
 * matched as the disclosure for it — **verbatim**:
 *
 * ```text
 *   > Matched on `1,000`: The Empire State child credit is computed from ...
 * ```
 *
 * So editing a note moves a line of that report **with no notch behind it**. The
 * CI job that keeps the report honest regenerates it and diffs, and regenerating
 * it costs 2,100 sweeps and about six minutes — which is why `preflight.mjs`
 * skips it, and why this failure could only ever be discovered on the runner,
 * after a push that looked green locally.
 *
 * **It has now happened twice, from the same cause.** Day 80 (`ee2f74d`) was
 * Kentucky's family size note; Day 88 was New York's Empire State child credit
 * note, extended to say the $500 amount applies in 2027 as well as 2026. Both
 * times the inventory was identical — 4,758 discontinuities over 2,100 sweeps,
 * the same figures — and the whole diff was one quoted line.
 *
 * And Day 80's own commit message ends:
 *
 * > *Worth noticing for its own sake: this is a gate that only runs on the
 * > runner, because `preflight.mjs` skips the sweep on cost. A ten-minute remote
 * > check that a local push cannot predict is a check that will keep being
 * > discovered after the fact.*
 *
 * It predicted Day 88 precisely, and nothing was built, so the prediction is the
 * defect rather than the sweep's cost.
 *
 * > **THE RULE: A FAILURE MODE WRITTEN DOWN AS A PREDICTION IS NOT A FINDING, IT
 * > IS A GATE SOMEBODY DECIDED NOT TO WRITE.** The expensive half of that CI job
 * > is the discontinuity search. The half that actually broke, twice, is a string
 * > comparison — and it needs no sweep at all.
 *
 * ## The two kinds of quotation, and both are checked
 *
 * **Static (17).** A note the state's definition carries. Compared character for
 * character against the notes of the state the line is filed under, so a note
 * edited in `src/states/*.ts` fails here, and so does a real note quoted under
 * the wrong state.
 *
 * **Dynamic (12).** The § 32(i) investment-income cliff note, which the engine
 * *generates* per state — the state's name and its own ceiling figure are
 * interpolated, so it exists in no definition and cannot be looked up. Each one
 * is regenerated from a probe return for that state and compared with **dollar
 * figures normalised away**, because the figure in the report came from the
 * sweep's household and the figure here comes from this file's. Everything else
 * — every word, and the state's name — must match.
 *
 * Normalising the figures is the one thing this check cannot see, and it is
 * deliberate rather than overlooked: a wrong FIGURE in a generated note is what
 * `note-conditions.mjs` and the cents-in-prose check already cover, against the
 * engine's own answer. What is uncovered without this file is the WORDING, and
 * wording is what moved twice.
 *
 * ## What this does NOT check
 *
 * The notch tables, the counts, the inventory, the classification. Those are the
 * sweep's and only the sweep can do them. This covers exactly the class that has
 * broken twice, in about a second, before a push rather than after one.
 *
 *   node tools/cliffs/quoted-notes.mjs            list what is quoted, and how
 *   node tools/cliffs/quoted-notes.mjs --check    fail if a quotation is stale
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const CHECK = process.argv.includes('--check');

const engine = await import(join(ROOT, 'packages/us-state-tax/dist/esm/index.js')).catch((err) => {
  console.error(`cannot import us-state-tax: ${err.message}`);
  console.error('  (cd packages/us-state-tax && npm install && npm run build)');
  process.exit(1);
});
const { SUPPORTED_STATE_YEARS, getStateDefinition, stateIncomeTax } = engine;

/** Which states carry each static note, over every supported state-year. */
const statesByNote = new Map();
for (const [code, year] of SUPPORTED_STATE_YEARS) {
  for (const note of getStateDefinition(code, year).notes) {
    if (!statesByNote.has(note)) statesByNote.set(note, new Set());
    statesByNote.get(note).add(code);
  }
}

/** Dollar figures out, whitespace flattened — see the header on why. */
const normalise = (s) =>
  s
    .replace(/\$[\d,]+(\.\d+)?/g, '$N')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * One return per state that reaches the generated § 32(i) note.
 *
 * A household with a federal earned income credit and investment income over
 * the § 32(i) ceiling. The figures need not match the sweep's — only the wording
 * is compared — but the household has to REACH the note, and a state whose note
 * cannot be reached is reported rather than skipped: that is Day 31's
 * reachability rule, and a probe that silently finds nothing would turn this
 * whole bucket green by failing.
 */
const dynamicNotesFor = (state) => {
  const base = {
    state,
    year: 2026,
    filingStatus: 'single',
    dependentAges: [5],
    earnedIncome: 20_000,
    capitalGains: 12_000,
    federal: {
      adjustedGrossIncome: 32_000,
      taxableIncome: 15_900,
      deduction: 16_100,
      deductionKind: 'standard',
      earnedIncomeCredit: 2_164,
    },
    // The three states that define their own base and refuse to run without it.
    ...(state === 'NJ' ? { newJerseyGrossIncome: 32_000 } : {}),
    ...(state === 'MA' ? { massachusettsFivePercentIncome: 32_000 } : {}),
    ...(state === 'PA' ? { pennsylvaniaTaxableIncome: 32_000 } : {}),
  };
  try {
    return stateIncomeTax(base).notes ?? [];
  } catch {
    return [];
  }
};

const report = readFileSync(join(HERE, 'CLIFFS.md'), 'utf8');

const problems = [];
const rows = [];
let heading = null;

for (const line of report.split('\n')) {
  const section = /^### ([A-Z]{2}) — /.exec(line);
  if (section) {
    heading = section[1];
    continue;
  }
  const hit = /^> Matched on `([^`]*)`: (.*)$/.exec(line);
  if (hit === null) continue;
  const [, matched, note] = hit;
  const state = heading ?? '??';

  const owners = statesByNote.get(note);
  if (owners !== undefined) {
    if (owners.has(state)) {
      rows.push({ state, matched, kind: 'static' });
    } else {
      problems.push(
        `${state}: the quoted note is a real note of ${[...owners].sort().join(', ')} and NOT of ` +
          `${state}. A real note filed under the wrong state is still a false quotation.`,
      );
    }
    continue;
  }

  // Not a static note of any state. It is either generated, or it is a static
  // note that was edited and the report still carries the old text — which is
  // the whole reason this file exists, so the two must be told apart rather
  // than lumped into an "unverifiable" bucket.
  const generated = dynamicNotesFor(state).find((n) => normalise(n) === normalise(note));
  if (generated !== undefined) {
    rows.push({ state, matched, kind: 'generated' });
    continue;
  }
  problems.push(
    `${state}: the quoted note is neither a note ${state} carries nor one this file's probe ` +
      `return can generate for it — "${note.slice(0, 80)}…". Either a note was edited and ` +
      'CLIFFS.md still quotes the old text (run `node tools/cliffs/find-cliffs.mjs` and commit ' +
      'the result), or the note is generated by a household this probe does not reach, and the ' +
      'probe is what needs widening.',
  );
}

if (rows.length === 0 && problems.length === 0) {
  console.error(
    'CLIFFS.md quotes no notes at all, so this check asserts nothing. Either the report format ' +
      'changed or this is not the file the tool was written against.',
  );
  process.exit(1);
}

const statics = rows.filter((r) => r.kind === 'static').length;
const generatedCount = rows.filter((r) => r.kind === 'generated').length;

if (!CHECK) {
  for (const r of rows) console.log(`  ${r.state}  ${r.kind.padEnd(10)} matched on \`${r.matched}\``);
  for (const p of problems) console.log(`  ${p}`);
  console.log(`\n${statics} static and ${generatedCount} generated quotation(s).`);
  process.exit(problems.length ? 1 : 0);
}

if (problems.length) {
  console.error('CLIFFS.md quotes a note the engine no longer emits:\n');
  for (const p of problems) console.error(`  ${p}`);
  console.error(
    '\nThis is the cheap half of the `cliffs` CI job: it compares strings and runs no sweep, so ' +
      'it fails here in a second instead of on the runner in six minutes.',
  );
  process.exit(1);
}

console.log(
  `ok — all ${rows.length} note(s) CLIFFS.md quotes are still emitted by the state they are filed ` +
    `under: ${statics} verbatim from the definitions, ${generatedCount} regenerated and compared ` +
    `word for word with the dollar figures normalised`,
);
