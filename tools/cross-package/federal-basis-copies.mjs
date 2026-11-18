#!/usr/bin/env node
/**
 * EVERY HAND-WRITTEN COPY OF § 63(c) AND § 63(f) IN `us-state-tax`'s TESTS,
 * CHECKED AGAINST THE PACKAGE THAT SHIPS THE REAL ONES.
 *
 * ## WHY THESE COPIES EXIST AT ALL, WHICH IS A GOOD REASON
 *
 * A state engine consumes a federal basis: AGI, taxable income, and the
 * deduction the filer actually took. So every household in `us-state-tax`'s
 * suite has to supply federal figures, and they are **inputs**, not shipped
 * state parameters — the state engine is never wrong about them, it is handed
 * them.
 *
 * They are written out by hand rather than imported from `us-federal-tax`
 * because **a test that reaches into a sibling package cannot run inside the
 * mutation harness's worker copy**, which is a real constraint with a real
 * history: it is the bug that made the harness's first federal run report a
 * perfect score. `test/near-miss-proof.test.js` and `test/shared-module.test.js`
 * are the two files that still read outside the package, and the harness skips
 * both.
 *
 * ## WHY THEY NEED A GATE, WHICH IS THE PART NOTHING SAID
 *
 * Day 84. There are **nine** of them, in nine files, in five different shapes —
 * a flat status map, a year-keyed map of status maps, a `_2025`/`_2026` suffixed
 * pair, a `{ basic, aged }` pair, and a nested `{ deduction: {...} }`. Nothing
 * tied any of them to `us-federal-tax`. They agree today because each was
 * entered from the same source in the same hour; they would drift the way every
 * duplicated table in this repository has drifted, silently, and the symptom
 * would be a STATE answer that is wrong about a FEDERAL input.
 *
 * The day the gate was written, two of the nine had just gained a 2027 row:
 * `$16,600 / $33,200 / $24,925` and `$2,100 / $1,700`. **`$24,925` is the figure
 * that makes the point.** It has been exactly 1.5 x the single amount in every
 * year this package has ever shipped. 1.5 x `$16,600` is `$24,900`. Tax year
 * 2027 is the first in four where § 1(f)(6)'s rounding lands on a multiple of
 * `$25` rather than `$50`, and at least one published secondary transcription
 * printed `$24,900` because it did the obvious arithmetic instead.
 *
 * ## HOW IT WORKS, AND THE LIMIT IT PRINTS
 *
 * It reads the test files as TEXT rather than importing them — importing a test
 * module runs its tests — and it works on VALUES rather than structures, because
 * the nine shapes have nothing in common to parse.
 *
 * For each file it finds every `<status>: <number>` pair that sits inside a
 * declaration whose name says it is federal (`FED`, `FEDERAL`, `STD`,
 * `STANDARD_DEDUCTION`), and then resolves two things about it before comparing:
 *
 *   WHICH YEAR   a `2025:`-style key above it, or a `_2025` suffix on the name.
 *   WHICH TABLE  § 63(c) or § 63(f) — from an `aged:`/`deduction:` key above it,
 *                or from `AGED` in the declaration's name.
 *
 * **The table half is not decoration, and the tool's own first run proved it.**
 * Written without it, this reported twenty-five disagreements, every one of them
 * a § 63(f) figure held against the § 63(c) column: `aged 2025 single: 2,000,
 * us-federal-tax says 15,750`. A cross-check that cannot tell which of two
 * tables it is reading reports the right shape of finding with the wrong
 * content, which is the failure mode that gets a gate disbelieved and then
 * disabled.
 *
 * **The limit, stated because a gate that hides one is worse than none:** a pair
 * whose year cannot be determined is checked only for MEMBERSHIP in the federal
 * figures of some year, and is reported separately. That catches a typo and a
 * figure from no year at all; it does not catch 2026's single amount written
 * into an unlabelled table that means 2025. Every unanchored pair is printed, so
 * the number is visible rather than assumed to be nil.
 *
 * ## AND THE HOLE THE OTHER WAY, WHICH IS WHY THERE IS A SECOND SWEEP
 *
 * The scan above only looks inside declarations whose NAME says they are
 * federal. **A copy under any other name is a copy this tool cannot see**, and
 * a gate that silently covers nine of ten tables is the Day 84 defect it was
 * written to catch, one level out: `readme.test.js` covering thirty-two claims
 * on a page taught a reader the page was covered.
 *
 * So a second sweep goes the other way: any § 63(c) AMOUNT, under a
 * filing-status key, in a declaration the first sweep did not recognise. It
 * found one on its first run — `arizona-deduction.test.js`'s `STATUTORY` — and
 * that one is EXEMPT for a reason worth stating rather than hard-coding away:
 * those are Arizona's own statutory amounts under A.R.S. § 43-1041 as amended by
 * HB 4168, which happen to equal the federal ones and are **not** the federal
 * ones. Requiring them to match forever is the error that `arizona-deduction.mjs`
 * exists to prevent: Arizona carried the federal figure by cross-reference until
 * HB 4168 replaced it with amounts of its own, so the day they diverge, Arizona's
 * table is right and a gate tying it to § 63(c) would be the thing that is
 * wrong. It is checked there, separately and on its own terms.
 *
 * Run: node tools/cross-package/federal-basis-copies.mjs
 * Exit 0 if every copy agrees, 1 if any does not, 2 if the tool cannot run.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const TESTS = join(ROOT, 'packages/us-state-tax/test');

const fed = await import(join(ROOT, 'packages/us-federal-tax/dist/esm/index.js')).catch(() => null);
if (fed === null) {
  process.stderr.write(
    '[federal-basis] packages/us-federal-tax is not built. Run `npm run build` there first.\n',
  );
  process.exit(2);
}

/** § 63(c) and § 63(f) as `us-federal-tax` ships them, per year and status. */
const FEDERAL = new Map();
for (const year of fed.SUPPORTED_YEARS) {
  const p = fed.getYearParameters(year);
  FEDERAL.set(year, {
    standard: p.standardDeduction,
    aged: p.additionalStandardDeduction,
  });
}
if (FEDERAL.size === 0) {
  process.stderr.write('[federal-basis] us-federal-tax reports no supported years.\n');
  process.exit(2);
}

/**
 * The key spellings the state suite uses, mapped to the federal package's.
 *
 * `joint` is the state suite's shorthand and is the only renaming. `basic` and
 * `aged` belong to `aged-standard-deduction.test.js`, whose own comment says
 * both are "for a single filer" — so they resolve to the single column of the
 * two federal tables rather than to a status of their own.
 */
const STATUS = {
  single: 'single',
  joint: 'marriedFilingJointly',
  marriedFilingJointly: 'marriedFilingJointly',
  marriedFilingSeparately: 'marriedFilingSeparately',
  headOfHousehold: 'headOfHousehold',
  qualifyingSurvivingSpouse: 'qualifyingSurvivingSpouse',
  basic: 'single',
};

/** Keys that switch which of the two federal tables the figures below belong to. */
const TABLE_KEY = { aged: 'aged', deduction: 'standard', standard: 'standard' };

/** Declarations whose contents are federal figures rather than state ones. */
const FEDERAL_DECL = /^\s*(?:const|let|var)\s+([A-Z][A-Z0-9_]*)\s*=/;
const IS_FEDERAL_NAME = (name) =>
  /(^|_)(FED|FEDERAL)(_|$)/.test(name) ||
  /(^|_)(STD|STANDARD_DEDUCTION)(_|$)/.test(name) ||
  name === 'FEDERAL' ||
  name === 'STANDARD_DEDUCTION';

const num = (text) => Number(text.replace(/_/g, ''));

/**
 * Declarations that hold § 63(c)-valued, status-keyed tables and are NOT copies
 * of § 63(c). Each needs a reason and the tool that checks it instead.
 */
const NOT_FEDERAL = new Map([
  [
    'arizona-deduction.test.js:STATUTORY',
    "Arizona's own amounts under A.R.S. § 43-1041 as amended by HB 4168, which EQUAL " +
      'the federal ones and are not them — checked by tools/cross-package/arizona-deduction.mjs',
  ],
]);

/** Every § 63(c) amount of every year, for the reverse sweep. */
const STANDARD_AMOUNTS = new Set(
  [...FEDERAL.values()].flatMap((y) => Object.values(y.standard)),
);

const problems = [];
const unanchored = [];
const foreign = [];
let checked = 0;
const filesSeen = [];

for (const file of readdirSync(TESTS).sort()) {
  if (!/\.(test\.js|mjs)$/.test(file)) continue;
  const lines = readFileSync(join(TESTS, file), 'utf8').split('\n');

  let decl = null; // { name, indent, year, table }
  let yearKey = null; // { year, indent }
  let tableKey = null; // { table, indent }
  let hits = 0;

  for (const line of lines) {
    const indent = line.length - line.trimStart().length;

    const d = FEDERAL_DECL.exec(line);
    if (d) {
      const name = d[1];
      decl = IS_FEDERAL_NAME(name)
        ? {
            name,
            indent,
            year: Number(/_((?:19|20)\d\d)(?:_|$)/.exec(name)?.[1]) || null,
            table: /(^|_)AGED(_|$)/.test(name) ? 'aged' : 'standard',
          }
        : null;
      yearKey = null;
      tableKey = null;
    }
    if (decl === null) continue;
    // A declaration ends at a line indented no further than it that is not the
    // declaration itself — crude, and it only ever ENDS a block early, which
    // makes the gate narrower rather than wrong.
    if (!d && line.trim() !== '' && indent <= decl.indent && !/^\s*[}\])]/.test(line)) {
      decl = null;
      yearKey = null;
      tableKey = null;
      continue;
    }

    const yk = /^\s*((?:19|20)\d\d)\s*:/.exec(line);
    if (yk) yearKey = { year: num(yk[1]), indent };
    else if (yearKey && indent <= yearKey.indent && line.trim() !== '') yearKey = null;

    const tk = /^\s*(aged|deduction|standard)\s*:\s*\{/.exec(line);
    if (tk) tableKey = { table: TABLE_KEY[tk[1]], indent };
    else if (tableKey && indent <= tableKey.indent && line.trim() !== '') tableKey = null;

    const table = () => tableKey?.table ?? decl.table;

    for (const m of line.matchAll(/\b([a-zA-Z]+)\s*:\s*(\d[\d_]*)\b/g)) {
      const [, key, raw] = m;
      // `basic` and `aged` as SCALARS, which is `aged-standard-deduction.test.js`'s
      // shape: `{ basic: 15_750, aged: 2_000 }`, both for a single filer, as that
      // file's own comment says.
      const scalar = key === 'aged' || key === 'basic';
      const status = scalar ? 'single' : STATUS[key];
      if (status === undefined) continue;
      const which = scalar ? (key === 'aged' ? 'aged' : 'standard') : table();
      const value = num(raw);
      if (which === 'standard' && value < 1_000) continue; // a count or an age
      hits += 1;
      const year = yearKey?.year ?? decl.year;
      const label = `${decl.name}${which === 'aged' ? ' § 63(f)' : ' § 63(c)'}`;
      if (year && FEDERAL.has(year)) {
        checked += 1;
        const want = FEDERAL.get(year)[which][status];
        if (value !== want) {
          problems.push(
            `${file}  ${label} ${year} ${key}: ${value.toLocaleString('en-US')}, ` +
              `us-federal-tax says ${want.toLocaleString('en-US')}`,
          );
        }
      } else {
        const anywhere = [...FEDERAL.values()].some((y) => y[which][status] === value);
        unanchored.push(`${file}  ${label} ${key}: ${value.toLocaleString('en-US')}`);
        if (!anywhere) {
          problems.push(
            `${file}  ${label} ${key}: ${value.toLocaleString('en-US')} is not that ` +
              `figure in ANY tax year us-federal-tax ships`,
          );
        }
      }
    }
  }
  if (hits > 0) filesSeen.push(`${file} (${hits})`);

  // THE SECOND SWEEP: a § 63(c) amount under a filing-status key, in a
  // declaration the first sweep did not look inside.
  let anyDecl = null;
  for (const line of lines) {
    const d = /^\s*(?:const|let|var)\s+([A-Z][A-Z0-9_]*)\s*=/.exec(line);
    if (d) anyDecl = d[1];
    for (const m of line.matchAll(/\b([a-zA-Z]+)\s*:\s*(\d[\d_]*)\b/g)) {
      const [, key, raw] = m;
      if (STATUS[key] === undefined) continue;
      const value = num(raw);
      if (!STANDARD_AMOUNTS.has(value)) continue;
      if (anyDecl !== null && IS_FEDERAL_NAME(anyDecl)) continue;
      const where = `${file}:${anyDecl ?? '(no declaration)'}`;
      if (NOT_FEDERAL.has(where)) continue;
      foreign.push(`${where}  ${key}: ${value.toLocaleString('en-US')}`);
    }
  }
}

process.stdout.write(
  `[federal-basis] ${checked} figure(s) checked against us-federal-tax across ` +
    `${filesSeen.length} file(s), over tax years ${[...FEDERAL.keys()].join(', ')}\n`,
);
for (const f of filesSeen) process.stdout.write(`                ${f}\n`);
if (unanchored.length > 0) {
  process.stdout.write(
    `[federal-basis] ${unanchored.length} figure(s) carry no year and are checked only for ` +
      `membership — the limit this tool prints rather than hides:\n`,
  );
  for (const u of unanchored) process.stdout.write(`                ${u}\n`);
}
if (foreign.length > 0) {
  process.stderr.write(
    `\n[federal-basis] ${foreign.length} § 63(c) AMOUNT(S) UNDER A FILING-STATUS KEY, in a ` +
      `declaration this tool does not scan. Either rename it so the scan reaches it, or add it ` +
      `to NOT_FEDERAL with the reason and the tool that checks it instead:\n`,
  );
  for (const f of foreign) process.stderr.write(`  ${f}\n`);
  process.exit(1);
}
if (NOT_FEDERAL.size > 0) {
  process.stdout.write(
    `[federal-basis] ${NOT_FEDERAL.size} table(s) hold these amounts and are deliberately NOT ` +
      `checked here:\n`,
  );
  for (const [where, why] of NOT_FEDERAL) process.stdout.write(`                ${where} — ${why}\n`);
}
if (problems.length > 0) {
  process.stderr.write(`\n[federal-basis] ${problems.length} DISAGREEMENT(S):\n`);
  for (const p of problems) process.stderr.write(`  ${p}\n`);
  process.exit(1);
}
process.stdout.write(
  `ok — ${checked} hand-written federal basis figure(s) in ${filesSeen.length} state-suite ` +
    `file(s) all agree with us-federal-tax, over tax years ${[...FEDERAL.keys()].join(', ')}; ` +
    `${unanchored.length} carry no year and are checked for membership only\n`,
);
