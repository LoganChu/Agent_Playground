/**
 * Run the discontinuity sweep over every state, year and household shape, and
 * write the inventory and the report.
 *
 * ```sh
 * node tools/cliffs/find-cliffs.mjs                 # the whole sweep
 * node tools/cliffs/find-cliffs.mjs --states OH,NY  # one or more states
 * node tools/cliffs/find-cliffs.mjs --check         # compare to the ledger
 * ```
 *
 * ## The two things it produces, and why the second one is the product
 *
 * `out/cliffs.json` is the **inventory**: every discontinuity in this engine's
 * output, to the cent, with the figure in the result object that moved. It is
 * committed, so a parameter change that introduces a notch or moves one shows
 * up as a diff rather than as a surprise in somebody's payroll run. `--check`
 * is that gate.
 *
 * `CLIFFS.md` is the **report**, and the claim it makes is the one only this
 * repository can make: not "we tested some incomes" but *every* discontinuity
 * over the swept bands, each one either matched to a note in the package that
 * already declares it statutory, or listed as needing an answer.
 *
 * ## Classification is a text match, which is weaker than it looks and is said so
 *
 * Each notch is sorted into `declared`, `named` or `undisclosed` by matching the
 * package's own shipped `notes` against the provision that moved and against the
 * notch's dollar figures. That is evidence about what the package SAYS, which is
 * the only thing a text match can be evidence about — it is not a ruling on
 * whether the notch is lawful, and the report prints the matching note beside
 * each group so a reader checks the match rather than trusting it.
 *
 * `named` is the column that matters: a provision the package computes from a
 * statutory table, names in its notes, and never tells the caller is a step.
 */

import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { cpus } from 'node:os';
import { stateIncomeTax } from '../../packages/us-state-tax/dist/esm/index.js';
import { householdInput } from '../differential/ours.mjs';
import { STATES, YEARS, SHAPES, BANDS, FLAG_THRESHOLD, MIN_JUMP, caseFor } from './shapes.mjs';
import { sweepOne } from './sweep.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');
const LEDGER = join(OUT, 'cliffs.json');

/* ------------------------------------------------------------------ */
/* Classification                                                      */
/* ------------------------------------------------------------------ */

/** `1234.5` -> `["1,234.50", "1234.50", "1,234.5", "1234.5"]` and friends. */
function moneyForms(n) {
  const a = Math.abs(n);
  const withCommas = (s) => {
    const [i, d] = s.split('.');
    return i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (d ? `.${d}` : '');
  };
  const out = new Set();
  for (const s of [a.toFixed(2), String(a), a.toFixed(0)]) {
    out.add(s);
    out.add(withCommas(s));
  }
  return [...out].filter((s) => s.length >= 3);
}

/**
 * The vocabulary a note uses when it is telling a reader that a provision is a
 * step rather than a taper.
 *
 * This list is the whole classifier, so it is a committed literal and not a
 * regex built in a hurry. Every term was taken from a note already in the
 * package: Connecticut's *"the personal tax credit steps down in $500 bands"*,
 * Ohio's *"Ohio's rate schedule is DISCONTINUOUS"*, Missouri's *"A cliff chart
 * and not a phase-out"*, New York's *"it is a staircase"*, § 12-702(a)(1)'s
 * *"or fraction thereof"*.
 */
const NOTCH_WORDS =
  /cliff|staircase|notch|steps?\b|stepped|stepping|discontinu|at once|fraction thereof|all.or.nothing|bands?\b/i;

/**
 * The provision names a moved field stands for, as a note would spell them.
 *
 * A credit's `name` in the result is the engine's own label for it, so matching
 * a note against it is matching the package against itself rather than against
 * a guess. The parenthetical that several credits carry — `(assumed: ...)` — is
 * cut, because it is a caveat about inputs and never appears in a note.
 */
function provisionLabels(moved, stateName) {
  const out = new Set();
  for (const m of moved) {
    const [kind, ...rest] = m.field.split(':');
    const name = rest.join(':').split(' (')[0].trim();
    if (name) {
      out.add(name.toLowerCase());
      // AND the same name with the state's own name taken off the front. The
      // engine labels a credit `"Kentucky family size tax credit"` and KRS
      // 141.066's note calls it `"the family size tax credit"`, because a note
      // inside Kentucky's own file does not repeat which state it is in. Without
      // this variant the classifier called 64 Kentucky notches `undisclosed`
      // against a note that names the provision AND says it has "ten
      // percentage steps" — the worst kind of wrong answer, because it was
      // wrong in the direction that manufactures findings.
      const bare = name.toLowerCase().replace(new RegExp(`^${stateName.toLowerCase()}\\s+`), '');
      if (bare !== name.toLowerCase()) out.add(bare);
    }
    if (kind === 'subtractions' || m.field === 'subtractions') out.add('subtraction');
    if (m.field === 'exemptions') out.add('exemption');
    if (m.field === 'deduction') out.add('deduction');
    if (m.field === 'lowIncomeTableTax') out.add('low income tax table');
    if (m.field === 'additions') out.add('addition');
  }
  return [...out];
}

/**
 * How well does this package already disclose this notch?
 *
 * Three answers, and the middle one is the finding this instrument exists to
 * produce:
 *
 * ```text
 *   declared     a note names the provision AND says it steps, or a note
 *                carries the notch's own dollar figures
 *   named        a note names the provision and never says it is a step, so a
 *                caller reading the notes would expect a taper
 *   undisclosed  no note mentions the provision at all
 * ```
 *
 * **`named` is not a defect in the arithmetic.** Every `named` row below is a
 * figure this engine computes correctly from a table it transcribed from a
 * statute. It is a defect in what the engine *says*, which this package treats
 * as the same kind of defect: the whole argument of `provenance.ts` and of the
 * shipped `notes` array is that a caller is owed the shape of a provision and
 * not only its value, and a provision that can cost a filer `$100` on one cent
 * of income has a shape worth a sentence.
 *
 * The dollar-figure path stays because it catches the cases where the note
 * quotes the step directly — Ohio's `$18.69`, New York's `$16.50` — and those
 * are the strongest disclosures in the package.
 */
function classify(notes, cliff, stateName) {
  const needles = new Set();
  for (const s of moneyForms(cliff.jump)) needles.add(s);
  for (const m of cliff.moved) {
    for (const v of [m.from, m.to]) {
      if (typeof v === 'number' && v !== 0) for (const s of moneyForms(v)) needles.add(s);
    }
    if (typeof m.from === 'number' && typeof m.to === 'number') {
      for (const s of moneyForms(m.to - m.from)) needles.add(s);
    }
  }
  const labels = provisionLabels(cliff.moved, stateName);

  const byFigure = [];
  const byName = [];
  for (const note of notes) {
    const lower = note.toLowerCase();
    if (labels.some((l) => lower.includes(l))) byName.push(note);
    for (const n of needles) {
      if (note.includes(n)) {
        byFigure.push({ note, matched: n });
        break;
      }
    }
  }

  const saysItSteps = byName.filter((n) => NOTCH_WORDS.test(n));
  if (byFigure.length) {
    return { disclosure: 'declared', how: 'figure', evidence: byFigure.slice(0, 2) };
  }
  if (saysItSteps.length) {
    return {
      disclosure: 'declared',
      how: 'name-and-shape',
      evidence: saysItSteps.slice(0, 2).map((note) => ({ note, matched: labels.join(' / ') })),
    };
  }
  if (byName.length) {
    return {
      disclosure: 'named',
      how: 'name-only',
      evidence: byName.slice(0, 2).map((note) => ({ note, matched: labels.join(' / ') })),
    };
  }
  // Nothing in the result object names a provision, which happens when the
  // notch is in the RATE SCHEDULE itself rather than in a credit, a deduction
  // or an exemption: Arkansas's two schedules swap at a threshold and its
  // bracket adjustment falls $10 per $100 of income, and all that moves in the
  // result is `taxBeforeCredits`. A classifier with no label has nothing to
  // match, and saying so is better than either of the two lies available —
  // calling it undisclosed, which manufactures a finding against a state whose
  // notes describe thirty of these, or guessing a label from a generic word
  // like "bracket", which would hand out clean bills of health.
  if (!labels.length) {
    return {
      disclosure: 'unattributed',
      how: null,
      evidence: notes.filter((n) => NOTCH_WORDS.test(n)).slice(0, 2).map((note) => ({ note, matched: '(state notes on notches)' })),
    };
  }
  return { disclosure: 'undisclosed', how: null, evidence: [] };
}

/* ------------------------------------------------------------------ */
/* Worker                                                              */
/* ------------------------------------------------------------------ */

function runStates(states) {
  const rows = [];
  for (const state of states) {
    for (const year of YEARS) {
      for (const shape of SHAPES) {
        const { cliffs, flags, error } = sweepOne(shape, state, year);
        if (error) {
          rows.push({ state, year, shape: shape.id, error, cliffs: [], flags: 0 });
          continue;
        }
        // The notes are a property of the state-year, not of the income, so
        // one evaluation in the middle of the band is enough and the sweep
        // does not carry 1,800 copies of them.
        const mid = stateIncomeTax(householdInput(caseFor(shape, state, year, 60_000)).base);
        const notes = mid.notes ?? [];
        const stateName = mid.stateName ?? state;
        rows.push({
          state,
          year,
          shape: shape.id,
          flags,
          error: null,
          cliffs: cliffs.map((c) => {
            const k = classify(notes, c, stateName);
            return { ...c, disclosure: k.disclosure, how: k.how, evidence: k.evidence };
          }),
        });
      }
    }
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/* Report                                                              */
/* ------------------------------------------------------------------ */

function fmt(n) {
  const s = Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${n < 0 ? '-' : ''}$${s}`;
}

function report(rows, seconds) {
  const all = [];
  for (const r of rows) for (const c of r.cliffs) all.push({ ...c, state: r.state, year: r.year, shape: r.shape });
  const declared = all.filter((c) => c.disclosure === 'declared');
  const named = all.filter((c) => c.disclosure === 'named');
  const undisclosed = all.filter((c) => c.disclosure === 'undisclosed');
  const unattributed = all.filter((c) => c.disclosure === 'unattributed');
  const open = [...undisclosed, ...named];
  const errors = rows.filter((r) => r.error);
  const points = rows.length * BANDS.reduce((n, b) => n + Math.floor((b.to - b.from) / b.step) + 1, 0);

  // Distinct notches, which is the number worth quoting: the same statutory
  // step is found once per shape and once per year, and six shapes finding
  // Ohio's exemption chart is one provision and not twelve.
  const key = (c) => `${c.state}|${c.year}|${c.at.toFixed(2)}|${c.jump.toFixed(2)}`;
  const distinct = new Set(all.map(key)).size;

  const byState = new Map();
  for (const c of all) {
    if (!byState.has(c.state)) byState.set(c.state, []);
    byState.get(c.state).push(c);
  }

  const L = [];
  L.push('# Every discontinuity in this engine, and which ones are the law');
  L.push('');
  L.push('<!-- Generated by tools/cliffs/find-cliffs.mjs. Do not edit by hand. -->');
  L.push('');
  L.push(
    'A state income tax ought to be **continuous** in income: a cent more of wages',
    'should never cost more than a cent of tax. Where it does, the law has a *notch*',
    'and a filer has a reason to turn down a raise. Some of those notches are real —',
    'written into a statute, printed on a form, and owed. Others are defects.',
    '',
    'This file is the complete list for this engine, found by walking the tax function',
    'itself rather than by sampling households.',
    '',
  );
  L.push('```text');
  L.push(`  household shapes swept        ${SHAPES.length}`);
  L.push(`  states x years               ${STATES.length} x ${YEARS.length}`);
  L.push(`  income points evaluated      ${points.toLocaleString('en-US')}`);
  L.push(`  second-difference threshold   ${fmt(FLAG_THRESHOLD)}   (a flag, not a finding)`);
  L.push(`  smallest reported jump        ${fmt(MIN_JUMP)}`);
  L.push('');
  L.push(`  DISCONTINUITIES FOUND        ${all.length}  (${distinct} distinct state-year-income notches)`);
  L.push(`    declared as a step         ${declared.length}   a note names the provision AND says it steps`);
  L.push(`    named, not as a step       ${named.length}   a note names it; nothing says it is a notch`);
  L.push(`    not named at all           ${undisclosed.length}`);
  L.push(`    unattributable             ${unattributed.length}   the notch is in the rate schedule; no provision moved`);
  L.push(`  states with none             ${STATES.length - byState.size} of ${STATES.length}`);
  L.push(`  sweep wall clock             ${seconds}s`);
  L.push('```');
  L.push('');

  L.push('## How to read the four numbers, because none of them is an arithmetic defect');
  L.push('');
  L.push(
    'Every notch below is a figure this engine computes **from a table it transcribed',
    'out of a statute or a form**. None of the four columns is an arithmetic error.',
    'What they measure is what the package *tells a caller* about the shape of the',
    'provision, which this repository treats as the same kind of obligation as the',
    'figure itself: a provision that can cost a filer a hundred dollars on one cent of',
    'income has a shape worth a sentence, and a caller who reads the notes and sees no',
    'sentence will build a taper.',
    '',
    '- **declared** — a note names the provision and says it steps, or quotes the',
    '  step’s own dollar figure. Ohio’s `$18.69`, New York’s `$16.50` per `$1,000`,',
    '  Connecticut’s four overlapping staircases, Missouri’s *"cliff chart and not a',
    '  phase-out"*. Nothing is owed here.',
    '- **named, not as a step** — a note names the provision and never says it is a',
    '  notch. This is the queue, and it is a disclosure defect rather than a',
    '  computation one.',
    '- **not named at all** — no note mentions the provision. Rarer and worse.',
    '- **unattributable** — the notch is in the rate schedule itself, so nothing in',
    '  the result object names a provision and the classifier has no label to match.',
    '  These need a reader. The state\u2019s own notes about discontinuities are printed',
    '  beside them.',
    '',
    '### What `named` does NOT mean, measured on Day 77',
    '',
    'The test is applied to ONE note at a time: a single string has to carry both the',
    'provision\u2019s name and a word from the step vocabulary. The notes are written as a',
    'sequence of paragraphs, so a disclosure can be complete and still fail it. All six',
    'groups this column held on Day 76 were read by hand, and **three of the six were',
    'already disclosed:**',
    '',
    '- Illinois said *"not phased out \u2014 it is lost entirely at the first dollar"* and priced',
    '  the step, and no word in the vocabulary appears in that sentence.',
    '- Arkansas named the Low Income Tax Tables in one note and called them staircases in',
    '  the note two below, which began *"THE TABLES ARE STAIRCASES TOO"*.',
    '- New York\u2019s Empire State child credit declares its `$16.50` staircase in four',
    '  sentences, every one of which refers to the credit as *"Its"* or *"The phase-out"*.',
    '',
    'All three were reworded so that each note stands alone, which is what this package',
    'claims of its notes anyway, and all three now pass. **The failure direction is the',
    'expensive one:** this column over-reports. A reader who checks a row and finds that the',
    'package already says it is reading correctly \u2014 it is the instrument that is wrong. Read',
    'the note quoted under each group rather than trusting the count.',
    '',
  );

  if (!open.length) {
    L.push('**Both queues are empty.**', '');
  }

  if (unattributed.length) {
    L.push('## Found, but the result object names no provision');
    L.push('');
    for (const c of unattributed) {
      L.push(`### ${c.state} ${c.year}, ${c.shape} — ${fmt(c.jump)} at ${fmt(c.at)} of wages`);
      L.push('');
      L.push('```text');
      L.push(`  wages ${fmt(c.at)} -> ${fmt(c.next)}   total tax moves ${c.jump > 0 ? '+' : ''}${fmt(c.jump)}`);
      for (const m of c.moved) L.push(`  ${m.field}: ${m.from} -> ${m.to}`);
      L.push('```');
      L.push('');
      for (const ev of c.evidence ?? []) L.push(`> ${ev.note}`, '');
    }
  }

  if (undisclosed.length) {
    L.push('## Not named in any note');
    L.push('');
    for (const c of undisclosed) {
      L.push(`### ${c.state} ${c.year}, ${c.shape} — ${fmt(c.jump)} at ${fmt(c.at)} of wages`);
      L.push('');
      L.push('```text');
      L.push(`  wages ${fmt(c.at)} -> ${fmt(c.next)}   total tax moves ${c.jump > 0 ? '+' : ''}${fmt(c.jump)}`);
      for (const m of c.moved) L.push(`  ${m.field}: ${m.from} -> ${m.to}`);
      L.push('```');
      L.push('');
    }
  }

  if (named.length) {
    L.push('## Named, but never as a step');
    L.push('');
    L.push(
      'Grouped by the provision that moved, because one statutory chart is found once per',
      'household shape and once per year and six shapes finding Connecticut’s personal',
      'credit is one sentence owed and not ' + `${named.length}.`,
      '',
    );
    const byProvision = new Map();
    for (const c of named) {
      const sig = c.moved
        .map((m) => m.field)
        .filter((f) => !/^(stateAdjustedGrossIncome|taxableIncome|tax|taxBeforeCredits)$/.test(f))
        .map((f) => f.split(' (')[0])
        .sort()
        .join(' + ');
      const k = `${c.state} — ${sig || '(no named provision moved)'}`;
      if (!byProvision.has(k)) byProvision.set(k, []);
      byProvision.get(k).push(c);
    }
    L.push('```text');
    for (const [k, cs] of [...byProvision.entries()].sort((a, b) => b[1].length - a[1].length)) {
      const jumps = [...new Set(cs.map((c) => c.jump))].sort((a, b) => a - b);
      const range = jumps.length <= 3 ? jumps.map(fmt).join(', ') : `${jumps.length} sizes, ${fmt(jumps[0])} to ${fmt(jumps[jumps.length - 1])}`;
      L.push(`  ${String(cs.length).padStart(4)}  ${k}`);
      L.push(`        ${range};  first at ${fmt(Math.min(...cs.map((c) => c.at)))} of wages`);
    }
    L.push('```');
    L.push('');
  }

  L.push('## What the sweep cannot see');
  L.push('');
  L.push(
    '- **A notch inside a credit-absorbed region.** The sweep measures `totalTax`,',
    '  which is floored at zero, so a notch where a credit already covers the whole',
    '  bill moves nothing. Ohio’s `$342` constant is invisible to every shape here',
    '  with children, because Ohio’s earned income credit covers the bill there.',
    '- **A notch in a variable other than wages.** Investment income, municipal',
    '  interest, itemised deductions and property tax are held at zero. A provision',
    '  tested on one of those has its notch on that axis.',
    '- **A notch smaller than the step can separate from a kink** — about `$3` below',
    `  ${fmt(150_000)} of wages and about ${fmt(50)} above it, where the grid steps by ${fmt(2_500)}.`,
    '- **Local income tax.** No county, city or school district is supplied, so',
    '  Maryland and Indiana figures here are the state tax alone.',
    '',
  );

  L.push('## The inventory');
  L.push('');
  for (const state of [...byState.keys()].sort()) {
    const cs = byState.get(state);
    L.push(`### ${state} — ${new Set(cs.map((c) => `${c.year}|${c.at.toFixed(2)}`)).size} notch(es)`);
    L.push('');
    L.push('```text');
    for (const c of cs) {
      L.push(
        `  ${c.year}  ${c.shape.padEnd(20)} ${fmt(c.at).padStart(14)} -> ${(c.jump > 0 ? '+' : '') + fmt(c.jump)}` +
          `${c.disclosure === 'declared' ? '' : `   [${c.disclosure.toUpperCase()}]`}`,
      );
      for (const m of c.moved) L.push(`          ${m.field}: ${m.from} -> ${m.to}`);
    }
    L.push('```');
    L.push('');
    const ev = cs.find((c) => c.evidence?.length)?.evidence?.[0];
    if (ev) {
      L.push(`> Matched on \`${ev.matched}\`: ${ev.note}`);
      L.push('');
    }
  }

  if (errors.length) {
    L.push('## Shapes the engine refused');
    L.push('');
    L.push('```text');
    for (const e of errors) L.push(`  ${e.state} ${e.year} ${e.shape}: ${e.error}`);
    L.push('```');
    L.push('');
  }

  return `${L.join('\n')}\n`;
}

/* ------------------------------------------------------------------ */
/* Entry                                                              */
/* ------------------------------------------------------------------ */

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i < 0 ? null : (argv[i + 1] ?? '');
};

if (process.env.CLIFF_WORKER) {
  // Worker: the parent sends a list of states, the child sends back rows.
  // `process.send` is asynchronous and `process.exit` does not wait for it, so
  // exiting on the next line drops the payload and the parent waits forever on
  // a promise nothing will settle. The callback is the flush.
  process.on('message', (msg) => {
    process.send({ rows: runStates(msg.states) }, () => process.exit(0));
  });
} else {
  const only = flag('--states');
  const states = only ? only.split(',').map((s) => s.trim().toUpperCase()) : STATES;
  const check = argv.includes('--check');
  const workers = Math.max(1, Math.min(cpus().length, 4));
  const t0 = Date.now();

  const chunks = Array.from({ length: workers }, () => []);
  // Round-robin rather than contiguous: the cost per state varies tenfold —
  // New York and Ohio carry local-tax machinery and Florida carries none — so
  // contiguous blocks leave one worker running alone for minutes.
  states.forEach((s, i) => chunks[i % workers].push(s));

  const results = await Promise.all(
    chunks
      .filter((c) => c.length)
      .map(
        (c) =>
          new Promise((resolve, reject) => {
            const child = fork(fileURLToPath(import.meta.url), [], {
              env: { ...process.env, CLIFF_WORKER: '1' },
            });
            child.on('message', (m) => resolve(m.rows));
            child.on('error', reject);
            child.on('exit', (code) => {
              if (code !== 0) reject(new Error(`worker exited ${code}`));
            });
            child.send({ states: c });
          }),
      ),
  );

  const rows = results.flat().sort((a, b) => `${a.state}${a.year}${a.shape}`.localeCompare(`${b.state}${b.year}${b.shape}`));
  const seconds = Math.round((Date.now() - t0) / 1000);

  const inventory = {
    generatedBy: 'tools/cliffs/find-cliffs.mjs',
    shapes: SHAPES.map((s) => s.id),
    years: YEARS,
    bands: BANDS,
    flagThreshold: FLAG_THRESHOLD,
    minJump: MIN_JUMP,
    rows: rows.map((r) => ({
      state: r.state,
      year: r.year,
      shape: r.shape,
      error: r.error,
      cliffs: r.cliffs.map((c) => ({
        at: c.at,
        next: c.next,
        jump: c.jump,
        disclosure: c.disclosure,
        moved: c.moved,
      })),
    })),
  };

  const json = `${JSON.stringify(inventory, null, 1)}\n`;

  if (check) {
    if (!existsSync(LEDGER)) {
      console.error(`${LEDGER} does not exist. Run the sweep without --check first.`);
      process.exit(1);
    }
    const old = readFileSync(LEDGER, 'utf8');
    if (old === json) {
      const n = rows.reduce((k, r) => k + r.cliffs.length, 0);
      console.log(`cliff inventory unchanged: ${n} discontinuities over ${rows.length} sweeps, ${seconds}s`);
      process.exit(0);
    }
    console.error('THE CLIFF INVENTORY MOVED.');
    console.error('');
    console.error('A discontinuity in a tax function appeared, vanished, or changed size.');
    console.error('That is either a parameter this repository just shipped, or a defect it');
    console.error('just introduced, and it is never nothing. Re-run without --check, read');
    console.error('the diff in tools/cliffs/out/cliffs.json, and say in CLIFFS.md which it');
    console.error('was before committing the new inventory.');
    process.exit(1);
  }

  mkdirSync(OUT, { recursive: true });
  writeFileSync(LEDGER, json);
  writeFileSync(join(HERE, 'CLIFFS.md'), report(rows, seconds));
  const n = rows.reduce((k, r) => k + r.cliffs.length, 0);
  const open = rows.reduce((k, r) => k + r.cliffs.filter((c) => c.disclosure !== 'declared').length, 0);
  console.log(`${rows.length} sweeps, ${seconds}s, ${n} discontinuities, ${open} not declared as a step`);
  console.log(`wrote ${LEDGER}`);
  console.log(`wrote ${join(HERE, 'CLIFFS.md')}`);
}
