import { MIN_JUMP } from './shapes.mjs';

/**
 * How well does this package already disclose a notch the sweep found?
 *
 * ## Why this is its own file
 *
 * It was inside `find-cliffs.mjs`, which runs a sweep on import, so **nothing
 * could test it.** Day 77 found the classifier wrong in three of six cases and
 * wrote down that "the cliff finder's classifier was wrong in three of six
 * cases with no test able to notice"; Day 78 found a fourth and a fifth and
 * moved it here. `self-check.mjs` now exercises it directly, on notes and moved
 * fields written out by hand, which is the only way to find a classifier wrong
 * in the direction that invents a finding.
 *
 * ## FOUR VERSIONS OF THIS HAVE BEEN WRONG AND ALL IN THE SAME DIRECTION
 *
 * 555 notches invented, then 187, then 52, then 46 of which three groups were
 * false. The rule the repository drew from that — for a tool whose output is
 * sold as a defect list, the expensive failure is the one that invents — is
 * why the matching below is deliberately generous about HOW a note names a
 * provision and deliberately strict about whether it says the provision steps.
 * The two sides of that are `provisionLabels` and `NOTCH_WORDS`.
 *
 * Every answer carries `how`, so a reader of the report can see which join it
 * rests on: a figure quoted in the prose is the strongest, a phrase match on
 * the engine's own label is next, and a word-set or alias match is the weakest
 * and is the one to check by eye.
 */

/** `1234.5` -> `["1,234.50", "1234.50", "1,234.5", "1234.5"]` and friends. */
export function moneyForms(n) {
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
export const NOTCH_WORDS =
  /cliff|staircase|notch|steps?\b|stepped|stepping|discontinu|at once|fraction thereof|all.or.nothing|bands?\b/i;

/**
 * The provision names a moved field stands for, as a note would spell them.
 *
 * A credit's `name` in the result is the engine's own label for it, so matching
 * a note against it is matching the package against itself rather than against
 * a guess. The parenthetical that several credits carry — `(assumed: ...)` — is
 * cut, because it is a caveat about inputs and never appears in a note.
 */
/**
 * The smallest movement in a figure that can attribute a notch to it.
 *
 * **A FIELD THAT MOVED BY HALF A CENT DID NOT CAUSE A $10 JUMP.** On a one-cent
 * interval almost every figure on a return moves by about a cent whether it is
 * the cause or not, and Arkansas is the case that forces the rule: its `$10`
 * bracket-adjustment step is in the rate schedule, but on the
 * investment-income axis the capital-gain exclusion is HALF the swept cent, so
 * `subtractions` moves by `$0.005`, arrives in `moved` looking like a provision
 * that moved, and dragged 236 notches into the column this instrument is sold
 * on.
 *
 * The floor is `MIN_JUMP` — the smallest step the tool will call a notch at
 * all. Below that a movement is rounding, and the report already refuses to
 * report one. A transition to or from `null` is kept whatever its size, because
 * a provision appearing or vanishing is the strongest evidence there is and
 * Maryland's capital gains surtax arrives exactly that way.
 *
 * This is a rule about ATTRIBUTION and lives here rather than in `explain`, so
 * that the figures which moved by a cent are still in the inventory and still
 * in the needle set for the figure path.
 */
const MOVEMENT_FLOOR = MIN_JUMP;

function causal(m) {
  if (m.from === null || m.to === null) return true;
  if (typeof m.from !== 'number' || typeof m.to !== 'number') return true;
  return Math.abs(m.to - m.from) >= MOVEMENT_FLOOR;
}

export function provisionLabels(moved, stateName) {
  const out = new Map(); // text -> specific?
  const add = (text, specific) => {
    if (!text) return;
    if (!out.has(text) || specific) out.set(text, specific);
  };
  for (const m of moved.filter(causal)) {
    const [kind, ...rest] = m.field.split(':');
    const full = rest.join(':').trim();
    const name = full.split(' (')[0].trim();
    if (name) {
      add(name.toLowerCase(), true);
      // THE PARENTHETICAL, WHEN IT IS AN ABBREVIATION RATHER THAN A CAVEAT.
      // `(assumed: ...)` is a caveat about inputs and never appears in a note,
      // which is why it is cut. `(CalEITC)` is the name the notes actually
      // USE — R&TC § 17052's credit is called CalEITC in all five of
      // California's notes about it and spelled out in none of them — so
      // cutting it cost 14 notches a green column against a note that declares
      // the $4,814 cliff and prices it at $4,528.82. Telling the two apart:
      // an abbreviation is one word with no colon in it.
      const paren = full.match(/\(([^)]+)\)\s*$/)?.[1]?.trim();
      if (paren && !paren.includes(':') && !/\s/.test(paren)) add(paren.toLowerCase(), true);
      // AND the same name with the state's own name taken off the front. The
      // engine labels a credit `"Kentucky family size tax credit"` and KRS
      // 141.066's note calls it `"the family size tax credit"`, because a note
      // inside Kentucky's own file does not repeat which state it is in. Without
      // this variant the classifier called 64 Kentucky notches `undisclosed`
      // against a note that names the provision AND says it has "ten
      // percentage steps" — the worst kind of wrong answer, because it was
      // wrong in the direction that manufactures findings.
      const bare = name.toLowerCase().replace(new RegExp(`^${stateName.toLowerCase()}\\s+`), '');
      if (bare !== name.toLowerCase()) add(bare, true);
    }
    // GENERIC, and marked so. These are not the engine's name for a provision
    // — they are the name of a FIELD, and several provisions move each one. A
    // note containing the word "subtraction" is not evidence about this notch,
    // and reading it as evidence is what put 238 notches in the `named` column
    // on Day 78: Arkansas's $10 bracket-adjustment step is in the rate
    // schedule, but on the investment-income axis the capital-gain subtraction
    // moves too, so `subtraction` entered the label set and dragged in every
    // Arkansas note with the word in it. The same step found by walking wages
    // names nothing and is reported as unattributed, which is the honest
    // answer — so the classifier was giving two answers for one disclosure,
    // decided by which axis found it.
    if (kind === 'subtractions' || m.field === 'subtractions') add('subtraction', false);
    if (m.field === 'exemptions') add('exemption', false);
    if (m.field === 'deduction') add('deduction', false);
    if (m.field === 'lowIncomeTableTax') add('low income tax table', false);
    if (m.field === 'additions') add('addition', false);
  }
  return [...out].map(([text, specific]) => ({ text, specific }));
}

/**
 * The words of a label that carry its identity.
 *
 * Four letters or more, and not one of the words every tax provision contains.
 * Used only for a label of two or more such words, because a one-word word-set
 * match is a one-word substring match with extra steps.
 */
const STOP = new Set(['tax', 'taxes', 'income', 'credit', 'state', 'federal', 'from', 'over', 'with', 'this', 'that']);
function contentWords(label) {
  return [...new Set(label.split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !STOP.has(w)))];
}

/**
 * Does this note name this provision, and by what join?
 *
 * `phrase` is the engine's own label appearing verbatim and is the strong case.
 * `words` is every content word of the label appearing somewhere in the note,
 * in any order — which is how a human writes the same provision's name.
 * Maryland's label is `2% surtax on net capital gain` and its note, ninety
 * words long, says `the 2% capital gains surtax`: the same four words in a
 * different order. The phrase match called that "not named at all", which is
 * the strongest claim this classifier can make and was made against the most
 * thoroughly documented notch in the package.
 *
 * The word-set path is deliberately the weakest join and is recorded as such,
 * so a reader of the report can see which rows rest on it.
 */
export function nameMatch(note, label) {
  if (note.includes(label)) return 'phrase';
  const words = contentWords(label);
  if (words.length >= 2 && words.every((w) => note.includes(w))) return 'words';
  return null;
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
export function classify(notes, cliff, stateName) {
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
    let best = null;
    for (const label of labels) {
      const how = nameMatch(lower, label.text);
      if (!how) continue;
      // Keep the strongest join, and keep whether any SPECIFIC label matched:
      // a note reached only through a generic field name is not evidence about
      // this provision.
      if (!best || (label.specific && !best.specific) || (how === 'phrase' && best.how !== 'phrase')) {
        best = { how, specific: label.specific, label: label.text };
      }
    }
    if (best) byName.push({ note, ...best });
    for (const n of needles) {
      if (note.includes(n)) {
        byFigure.push({ note, matched: n });
        break;
      }
    }
  }

  const saysItSteps = byName.filter((n) => NOTCH_WORDS.test(n.note));
  const specific = byName.filter((n) => n.specific);
  if (byFigure.length) {
    return { disclosure: 'declared', how: 'figure', evidence: byFigure.slice(0, 2) };
  }
  if (saysItSteps.length) {
    const weakest = saysItSteps.every((n) => n.how === 'words') ? 'words' : 'phrase';
    return {
      disclosure: 'declared',
      how: `name-and-shape/${weakest}`,
      evidence: saysItSteps.slice(0, 2).map((n) => ({ note: n.note, matched: `${n.label} (${n.how})` })),
    };
  }
  // `named` REQUIRES A SPECIFIC LABEL. It is the column this instrument is sold
  // on — "a provision the package computes, names, and never tells a caller is
  // a step" — so a row in it on the strength of the word "subtraction" is an
  // invented finding, and inventing is the one direction this tool must not be
  // wrong in. A notch whose only name match is a field name falls through to
  // `unattributed`, which is what it is: a step with no provision named.
  if (specific.length) {
    return {
      disclosure: 'named',
      how: `name-only/${specific.every((n) => n.how === 'words') ? 'words' : 'phrase'}`,
      evidence: specific.slice(0, 2).map((n) => ({ note: n.note, matched: `${n.label} (${n.how})` })),
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
  if (!labels.some((l) => l.specific)) {
    return {
      disclosure: 'unattributed',
      how: byName.length ? 'generic-field-only' : null,
      evidence: notes.filter((n) => NOTCH_WORDS.test(n)).slice(0, 2).map((note) => ({ note, matched: '(state notes on notches)' })),
    };
  }
  return { disclosure: 'undisclosed', how: null, evidence: [] };
}
