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
 * `--states` writes `out/partial.json` and leaves the committed report and
 * ledger alone, because a sweep of two states is not the complete list the
 * report says it is. It cannot be combined with `--check`.
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
import {
  STATES, YEARS, SHAPES, BANDS, AXES, DISCRETE_AXES, ALL_AXES, FLAG_THRESHOLD, MIN_JUMP,
  caseFor, shapesFor, midpointFor, isDiscrete, pointsIn, formatAt,
} from './shapes.mjs';
import { sweepOne } from './sweep.mjs';
import { classify } from './classify.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');
const LEDGER = join(OUT, 'cliffs.json');

/* ------------------------------------------------------------------ */
/* Worker                                                              */
/* ------------------------------------------------------------------ */

function runStates(states) {
  const rows = [];
  for (const state of states) {
    for (const year of YEARS) {
      for (const axis of ALL_AXES) {
        for (const shape of shapesFor(axis)) {
          const { cliffs, flags, error } = sweepOne(shape, state, year, axis);
          if (error) {
            rows.push({ state, year, axis: axis.id, shape: shape.id, error, cliffs: [], flags: 0 });
            continue;
          }
          // THE NOTES ARE READ AT THE NOTCH, not once in the middle of the
          // band. They are NOT a property of the state-year, which is what this
          // loop assumed until Day 78 and what cost the day's largest finding
          // its green column: an input-dependent note fires for the household
          // it applies to and not for the others. The § 32(i) disclosure says
          // what one cent of investment income takes from a filer's earned
          // income credit, and it is read off a result object — so at the
          // midpoint of the investment-income band, $60,000, the federal credit
          // is long gone, there is nothing to lose, the note correctly does not
          // fire, and a classifier reading it there concludes the package never
          // said anything. 314 notches were reported as undisclosed by a
          // disclosure that was present at every income where it mattered.
          //
          // `c.at` is the income just BELOW the jump, which is the right place
          // to ask the question: the caller who needs to be told a provision
          // steps is the one standing on the step. One extra evaluation per
          // notch, and `evaluator` has it cached already.
          const mid = stateIncomeTax(
            householdInput(caseFor(shape, state, year, midpointFor(axis), axis)).base,
          );
          const stateName = mid.stateName ?? state;
          const notesAt = (value) => {
            try {
              return (
                stateIncomeTax(householdInput(caseFor(shape, state, year, value, axis)).base)
                  .notes ?? []
              );
            } catch {
              return [];
            }
          };
          rows.push({
            state,
            year,
            axis: axis.id,
            shape: shape.id,
            flags,
            error: null,
            cliffs: cliffs.map((c) => {
              // Both sides of the cent. A note can be the one that fires BELOW
              // the step ("this is what you are about to lose") or the one that
              // fires above it ("this is why you lost it"), and either is the
              // package having said so.
              const notes = [...new Set([...notesAt(c.at), ...notesAt(c.next), ...(mid.notes ?? [])])];
              const k = classify(notes, c, stateName);
              return { ...c, disclosure: k.disclosure, how: k.how, evidence: k.evidence };
            }),
          });
        }
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

function report(rows) {
  const all = [];
  for (const r of rows) for (const c of r.cliffs) all.push({ ...c, state: r.state, year: r.year, shape: r.shape, axis: r.axis });
  const declared = all.filter((c) => c.disclosure === 'declared');
  const named = all.filter((c) => c.disclosure === 'named');
  const undisclosed = all.filter((c) => c.disclosure === 'undisclosed');
  const unattributed = all.filter((c) => c.disclosure === 'unattributed');
  const open = [...undisclosed, ...named];
  const errors = rows.filter((r) => r.error);
  const byAxisId = new Map(ALL_AXES.map((a) => [a.id, a]));
  const axisOf = (c) => byAxisId.get(c.axis) ?? AXES[0];
  // The axis says how to write its own coordinate. Everything in this report is
  // money EXCEPT the coordinate of a discrete axis, and `$64.00` for a
  // sixty-four-year-old would be the most misleading line the instrument could
  // print, so no call site is allowed to reach for `fmt` on an `at`.
  const at = (c) => formatAt(axisOf(c), c.at);
  const nextAt = (c) => formatAt(axisOf(c), c.next);
  const points = rows.reduce((n, r) => n + pointsIn(byAxisId.get(r.axis) ?? AXES[0]), 0);

  // Distinct notches, which is the number worth quoting: the same statutory
  // step is found once per shape and once per year, and six shapes finding
  // Ohio's exemption chart is one provision and not twelve.
  const key = (c) => `${c.state}|${c.year}|${c.axis}|${c.at.toFixed(2)}|${c.jump.toFixed(2)}`;
  const continuous = all.filter((c) => !isDiscrete(axisOf(c)));
  const discrete = all.filter((c) => isDiscrete(axisOf(c)));
  const distinct = new Set(all.map(key)).size;

  // A provision means-tested on a TOTAL is found on every axis that feeds the
  // total; one means-tested on a COMPONENT is found on one axis only. The jump
  // SIZE is what survives a change of coordinate, so grouping by state, year
  // and size is how the two are told apart. Not proof — two unrelated notches
  // can share a size — which is why the table prints the sizes and lets a
  // reader check.
  const sizeAxes = new Map();
  for (const c of all) {
    const k = `${c.state}|${c.year}|${c.jump.toFixed(2)}`;
    if (!sizeAxes.has(k)) sizeAxes.set(k, new Set());
    sizeAxes.get(k).add(c.axis);
  }
  const multiAxis = [...sizeAxes.values()].filter((v) => v.size > 1).length;
  const singleAxis = [...sizeAxes.values()].filter((v) => v.size === 1).length;

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
    '**Income is not the only variable a notch can sit on.** A birthday is a notch',
    'too, and a larger one than almost anything income does: this engine has a state',
    'whose whole bill goes from four figures to zero between a filer’s sixty-fourth',
    'and sixty-fifth birthday. Those live on the *discrete* axes below, where the',
    'variable is an integer and a step needs no refinement to locate — it is already',
    'between two consecutive whole numbers.',
    '',
    'This file is the complete list for this engine, found by walking the tax function',
    'itself rather than by sampling households.',
    '',
  );
  L.push('```text');
  L.push(`  household shapes swept        ${SHAPES.length}`);
  L.push(`  income axes swept             ${AXES.length}   ${AXES.map((a) => a.id).join(', ')}`);
  L.push(
    `  discrete axes swept           ${DISCRETE_AXES.length}   ${DISCRETE_AXES.map((a) => a.id).join(', ')}`,
  );
  L.push(`  states x years               ${STATES.length} x ${YEARS.length}`);
  L.push(`  points evaluated       ${points.toLocaleString('en-US').padStart(13)}`);
  L.push(`  second-difference threshold   ${fmt(FLAG_THRESHOLD)}   (a flag, not a finding)`);
  L.push(`  smallest reported jump        ${fmt(MIN_JUMP)}`);
  L.push('');
  L.push(
    `  DISCONTINUITIES FOUND        ${all.length}  (${distinct} distinct axis-state-year-coordinate notches)`,
  );
  L.push(
    `    on an income axis          ${continuous.length}`,
    `    on a discrete axis         ${discrete.length}   an age or a count, where a jump needs no refinement`,
  );
  L.push(`    declared as a step         ${declared.length}   a note names the provision AND says it steps`);
  L.push(`    named, not as a step       ${named.length}   a note names it; nothing says it is a notch`);
  L.push(`    not named at all           ${undisclosed.length}`);
  L.push(
    `    unattributable             ${unattributed.length}   nothing in the result moved far enough to have caused it`,
  );
  L.push(`  states with none             ${STATES.length - byState.size} of ${STATES.length}`);
  L.push('');
  L.push(`  jump sizes found on >1 axis  ${multiAxis}   a threshold on a TOTAL, met from more than one direction`);
  L.push(`  jump sizes found on 1 axis   ${singleAxis}   a threshold on a COMPONENT, or a size reached one way`);
  // NO WALL CLOCK HERE, and this is the one line in the file with a CI failure
  // behind it. `ci.yml` regenerates this report and diffs it byte for byte
  // against the committed one, which is the right gate for a document that
  // claims to be the complete list. A duration is a property of the MACHINE,
  // so the committed report and the runner's report could never agree, and
  // **CI had been red on a one-line diff for three days** while two journal
  // entries called the repository green. The timing is printed on the console
  // line at the end of a run, where it is a measurement of the machine that
  // took it; it is not a fact about the engine and does not belong in a
  // document about the engine. Same rule as `--limit` refusing to record a
  // score: the number is real, and it is a number about the instrument.
  L.push('```');
  L.push('');

  L.push('## What each axis found');
  L.push('');
  L.push(
    'An axis is the one variable the sweep moves while the rest of the household',
    'stands still. **A means test keyed on a component of income cannot bind on an',
    'axis that does not move that component**, so an instrument with one axis has a',
    'blind spot the size of the other four. This table is the measurement of that',
    'blind spot, taken the day the axes were added.',
    '',
  );
  L.push('```text');
  L.push('  axis                 shapes  holds                      notches  not declared');
  for (const axis of ALL_AXES) {
    const mine = all.filter((c) => c.axis === axis.id);
    const held = Object.entries(axis.holds).map(([k, v]) => `${k}=${fmt(v)}`).join(' ') || '(the shape as written)';
    L.push(
      `  ${axis.id.padEnd(20)} ${String(shapesFor(axis).length).padStart(5)}  ${held.padEnd(25)} ` +
        `${String(mine.length).padStart(7)}  ${String(mine.filter((c) => c.disclosure !== 'declared').length).padStart(12)}`,
    );
  }
  L.push('```');
  L.push('');
  L.push(
    'A held value is a **sample and not a statutory threshold**: where a notch sits',
    'on a held axis depends on what the other variables were holding. What does not',
    'depend on it is that the notch exists and how big it is.',
    '',
  );

  L.push('## The two open columns are an UPPER BOUND on what is owed, not a count of it');
  L.push('');
  L.push(
    'Five versions of the classifier below have been wrong and every one of them was',
    'wrong in the same direction: it invented findings. 555, then 187, then 52, then 46',
    'of which three groups were false, and then — on the day the sweep gained four axes',
    '— 314 notches reported as undisclosed against a note that fires only for the',
    'households it applies to, 236 attributed to a figure that had moved by half a cent,',
    'and 14 against a credit whose notes use its abbreviation.',
    '',
    '**For a tool whose output is sold as a defect list, the expensive failure is the',
    'one that invents.** So: every count below is a count of what a *text match* could',
    'not find, each group prints the note it matched and the join it matched on, and the',
    'only thing that has ever found this classifier wrong is reading the rows. The',
    'classifier is `tools/cliffs/classify.mjs`, and six of `self-check.mjs`\'s twenty-one',
    'cases are its own \u2014 each one a real misclassification this repository shipped.',
    '',
    '`unattributable` is the weakest column and the one to read first. It means nothing',
    'in the result object moved by at least the smallest reported jump, so there is no',
    'provision to match a note against — which is the honest answer for a step in a rate',
    "schedule, and almost all of these are Arkansas's bracket adjustment. It is not a",
    'clean bill of health: a provision the engine does not NAME in its result cannot be',
    'attributed however well the notes describe it, and that is a gap in the result',
    "object rather than in the notes. New Jersey's retirement income exclusion sat here",
    'until the sweep learned to read `computedSubtractions[].name`.',
    '',
  );
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
      L.push(`### ${c.state} ${c.year}, ${c.shape} — ${fmt(c.jump)} at ${at(c)} of ${axisOf(c).noun}`);
      L.push('');
      L.push('```text');
      L.push(
        `  ${axisOf(c).noun} ${at(c)} -> ${nextAt(c)}   total tax moves ${c.jump > 0 ? '+' : ''}${fmt(c.jump)}`,
      );
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
      L.push(`### ${c.state} ${c.year}, ${c.shape} — ${fmt(c.jump)} at ${at(c)} of ${axisOf(c).noun}`);
      L.push('');
      L.push('```text');
      L.push(
        `  ${axisOf(c).noun} ${at(c)} -> ${nextAt(c)}   total tax moves ${c.jump > 0 ? '+' : ''}${fmt(c.jump)}`,
      );
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
      const axes = [...new Set(cs.map((c) => c.axis))];
      // THE SMALLEST COORDINATE, WITHIN ONE AXIS. Comparing `at` across axes was
      // sound while every axis was dollars and became nonsense the moment one of
      // them was an age: 64 is below every income in the sweep, so a provision
      // found on both the wage axis and the filer-age axis would report "first
      // at $64.00". The minimum is taken inside the axis that holds the most of
      // this provision's notches, which is the one a reader is being told about.
      const busiest = axes
        .map((id) => [id, cs.filter((c) => c.axis === id).length])
        .reduce((p, q) => (q[1] > p[1] ? q : p))[0];
      const lowest = cs.filter((c) => c.axis === busiest).reduce((p, q) => (q.at < p.at ? q : p));
      const noun = axisOf(lowest).noun;
      L.push(
        `        ${range};  first at ${at(lowest)} of ${noun}` +
          (axes.length > 1 ? `;  on ${axes.length} axes: ${axes.join(', ')}` : ''),
      );
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
    '- **A notch in a variable no axis walks.** Itemised deductions, property tax,',
    '  rent and the NUMBER of dependents are held fixed. A provision tested on one',
    '  of those has its notch on an axis that is not here. Investment income, pension',
    '  income, Social Security benefits and municipal interest were on this list',
    '  until Day 78, and the filer’s age, the spouse’s age and a dependent’s age',
    '  until Day 79; they are now seven of the eight axes above.',
    '- **A notch in the number of dependents**, which is held fixed on every axis',
    '  and is the one variable here that was tried and deliberately left out. The',
    '  detector that makes the three age axes exact assumes the bill is CONSTANT',
    '  between values of the variable, and a per-head exemption makes it a straight',
    '  line instead — so a first difference reports every household and a second',
    '  difference reports a per-head amount meeting a bracket. Finding a cap at the',
    '  third child needs a third detector, and `shapes.mjs` says which one.',
    '- **A notch that needs two variables to move at once.** Every axis holds the',
    '  rest of the household still, so a provision whose threshold is a function of',
    '  two components — a ratio, or a combined limit with a separate cap on each —',
    '  is only partly reached. The cost of a second swept variable is the product of',
    '  the two bands rather than the sum, which is why there is not one.',
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
        `  ${c.year}  ${c.axis.padEnd(18)} ${c.shape.padEnd(20)} ${at(c).padStart(14)} -> ${(c.jump > 0 ? '+' : '') + fmt(c.jump)}` +
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
    for (const e of errors) L.push(`  ${e.state} ${e.year} ${e.axis} ${e.shape}: ${e.error}`);
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

  const rows = results
    .flat()
    .sort((a, b) =>
      `${a.state}${a.year}${a.axis}${a.shape}`.localeCompare(`${b.state}${b.year}${b.axis}${b.shape}`),
    );
  const seconds = Math.round((Date.now() - t0) / 1000);

  const inventory = {
    generatedBy: 'tools/cliffs/find-cliffs.mjs',
    shapes: SHAPES.map((s) => s.id),
    axes: ALL_AXES.map((a) => ({
      id: a.id,
      field: a.field ?? null,
      bands: a.bands ?? null,
      values: a.values ? [a.values[0], a.values[a.values.length - 1]] : null,
      unit: a.unit ?? 'dollars',
      shapes: a.shapes,
      holds: a.holds,
    })),
    years: YEARS,
    bands: BANDS,
    flagThreshold: FLAG_THRESHOLD,
    minJump: MIN_JUMP,
    rows: rows.map((r) => ({
      state: r.state,
      year: r.year,
      axis: r.axis,
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
    if (only) {
      console.error(
        `--check compares against the committed inventory, which is all ${STATES.length} ` +
          `states. A run of ${states.length} of them disagrees with it by construction. Drop ` +
          `--states, or drop --check and read out/partial.json.`,
      );
      process.exit(1);
    }
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

  const n = rows.reduce((k, r) => k + r.cliffs.length, 0);
  const open = rows.reduce((k, r) => k + r.cliffs.filter((c) => c.disclosure !== 'declared').length, 0);
  console.log(`${rows.length} sweeps, ${seconds}s, ${n} discontinuities, ${open} not declared as a step`);

  // A PARTIAL RUN DOES NOT WRITE THE COMMITTED FILES, and this guard is here
  // because the absence of it cost two full sweeps in one afternoon. `--states
  // OH` is the fast way to try a change, it used to overwrite `CLIFFS.md` and
  // `out/cliffs.json` with one state's worth of findings, and the overwrite is
  // silent: the report still reads as a report, the ledger still reads as a
  // ledger, and `--check` compares the next full run against Ohio. Worse than
  // the wasted time is that a `--states` run followed by a commit would push a
  // document claiming to be "the complete list for this engine" over 1/42nd of
  // it.
  //
  // Written to a side path instead, so the fast loop still gives something to
  // read. Same reasoning as `--limit` refusing to record a mutation score:
  // a measurement over part of the subject is not a measurement of it.
  mkdirSync(OUT, { recursive: true });
  if (only) {
    const side = join(OUT, 'partial.json');
    writeFileSync(side, json);
    console.log(`wrote ${side}`);
    console.log(
      `NOT written: ${LEDGER} and CLIFFS.md. --states ${states.join(',')} is ` +
        `${states.length} of ${STATES.length} states, and the committed report claims to be ` +
        `the complete list. Run without --states to regenerate them.`,
    );
  } else {
    writeFileSync(LEDGER, json);
    writeFileSync(join(HERE, 'CLIFFS.md'), report(rows));
    console.log(`wrote ${LEDGER}`);
    console.log(`wrote ${join(HERE, 'CLIFFS.md')}`);
  }
}
