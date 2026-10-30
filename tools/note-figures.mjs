/**
 * Every dollar figure WITH CENTS that a shipped note states, and whether any
 * test computes it.
 *
 * ## The hole this measures, and the day that found it
 *
 * Day 67 published three wrong figures in one state's prose and every test in
 * the repository stayed green. All three were the same shape — a tax amount
 * asserted in a sentence, arrived at by arithmetic in my head rather than by
 * running a household:
 *
 * ```text
 *   "$43.00 of tax in the 4.3% band, $47.00 at 4.7%"   no filer at any of the
 *                                                      eight boundaries is in
 *                                                      either band; the real
 *                                                      steps are $14.27 to $32.04
 *   "about $7,400 of taxable income"                   $8,125
 *   "New York State's own $4,748.13"                   $4,951.75, a figure the
 *                                                      same README already had
 * ```
 *
 * The existing instruments cannot see any of them, and the reasons are worth
 * separating because they are three different reasons:
 *
 *   - `notes.test.js` pins the FIRST 72 CHARACTERS of every note, so it catches
 *     a note appearing, vanishing or moving and says nothing about what the note
 *     says past character 72. All three figures were mid-sentence.
 *   - `dynamic-note-figures.test.js` covers the rendered PERCENTAGES in dynamic
 *     notes, which was Day 56's finding — the `× 100` that turns a stored rate
 *     into the number a sentence prints. It is about a conversion, not an amount.
 *   - the provenance ledger maps every **shipped parameter** to a document, and
 *     not one of these three is a parameter. They are consequences.
 *
 * > **A FIGURE A NOTE STATES IS A CLAIM THE PACKAGE SELLS AND A CLAIM NOTHING
 * > OWNS.** The parameters are cited, the percentages are pinned, the notes'
 * > existence is pinned, and the sentence "this costs $X" — which is the only
 * > part a buyer reads — is checked nowhere at all.
 *
 * ## Why CENTS, and not every dollar figure
 *
 * A figure written with cents is almost always a COMPUTED amount: a tax, a
 * difference between two answers, a credit after a taper. A round figure is
 * almost always a statutory parameter, and those already have the provenance
 * ledger behind them and would drown this report — there are thousands.
 *
 * ```text
 *   $18,320          a parameter. K.S.A. 79-32,121(a). Covered by provenance.
 *   $527.48          a consequence. Nothing owns it.
 * ```
 *
 * So the filter is `\$[\d,]+\.\d\d` and the omission is deliberate: **this tool
 * reports the figures most likely to be wrong and least likely to be noticed**,
 * which is the opposite of reporting all of them.
 *
 * ## What "checked" means here, and what it does NOT mean
 *
 * A figure is counted as checked if its digits appear anywhere in the package's
 * test directory. That is **weak on purpose** and the weakness has a direction:
 *
 *   - It cannot tell an assertion from a comment. A figure written into a test's
 *     prose counts as checked and is not.
 *   - It cannot tell WHICH household produced it.
 *
 * So a clean report does not mean the figures are right. **An unclean one means
 * a figure is quoted in something this package ships and appears nowhere a test
 * could have computed it**, which is a strictly weaker claim and the only one a
 * grep can support. The direction matters: this tool can be wrong by calling a
 * bad figure good, and cannot be wrong by calling a good figure bad — so every
 * line it prints is worth reading and its silence proves little.
 *
 * Run `--check` for a count and a non-zero exit above the recorded ceiling;
 * without it, the full inventory per state.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');

/**
 * Both sides normalised to NUMBERS, which is the third design and the only one
 * that works.
 *
 * The first version grepped the test corpus for the figure exactly as the note
 * prints it — `2,855.65` — and reported eighteen unchecked figures in a state
 * whose test file computes most of them. JavaScript writes that number
 * `2_855.65`, with an underscore separator.
 *
 * The second version generated the comma form, the bare form and the underscore
 * form, and still missed four of New Mexico's, because **JavaScript has no
 * trailing zeros**: a note prints `$11,010.60` and a test asserts `11_010.6`.
 *
 * ```text
 *   printed       asserted        why the string comparison failed
 *   $2,855.65     2_855.65        the separator
 *   $11,010.60    11_010.6        the trailing zero
 *   $202.00       202             both, plus there is no decimal point at all
 * ```
 *
 * And the obvious patch to the second version — also try `202` — is worse than
 * the bug, because `tests.includes('202')` is true of any file containing
 * `2025`. **A looser string match buys coverage by matching the tax year.**
 *
 * > **A NUMBER HAS ONE VALUE AND MANY SPELLINGS, AND A TOOL THAT COMPARES
 * > SPELLINGS IS ENUMERATING A SET IT DOES NOT CONTROL.** Two tries at
 * > enumerating them produced two different wrong answers in one sitting. The
 * > fix is to stop comparing text: take every number-like token out of the test
 * > corpus, parse it, and compare values. Separators, trailing zeros and the
 * > boundary problem all go away together, because `Number('202')` and
 * > `Number('202.00')` are the same thing and `Number('2025')` is not.
 */
const NUMERIC_TOKEN = /-?\d[\d_,]*(?:\.\d+)?/g;

function valuesIn(text) {
  const out = new Set();
  for (const token of text.match(NUMERIC_TOKEN) ?? []) {
    const n = Number(token.replace(/[_,]/g, ''));
    if (Number.isFinite(n)) out.add(n);
  }
  return out;
}

/**
 * The ceiling, recorded rather than zero.
 *
 * Day 67 measured it on the day the tool was written, which is the only honest
 * starting point: a tool that demanded zero on arrival would have to be switched
 * off, and a tool that is switched off is worse than none. What it buys
 * immediately is that the number cannot GROW without somebody saying so, which
 * is the property every ratchet in this repository has.
 *
 * **69 of 238 on Day 67, across 18 of 42 states.** The worst is NEW MEXICO with
 * seven, which is the state added that day — so the tool's first measurement
 * convicts the run that wrote it, which is the right way round. The seven:
 *
 * ```text
 *   $1,914.85   the SINGLE Social Security cliff; the test asserts the joint one
 *   $107.80     the 2026 OBBBA deduction increase on a joint return at 4.9%
 *    $53.90     the same on a single return
 *   $122.50     the $2,500 capital-gains cap at 4.9%
 *   $345.60     a tipped worker's $8,000 at $50,000 of AGI
 *   $472.00     the same $8,000 wholly inside the 5.9% band
 *  $6,933.08    MARYLAND's capital-gains surtax, quoted in a New Mexico note as
 *               the comparison that keeps a superlative honest — and nothing in
 *               the package computes it, which is a finding about Maryland
 * ```
 *
 * **They are not fixed on the day they were found, and the reason is the same
 * one that restarted the audit twice:** adding a test changes the suite
 * fingerprint, and the 99.7% score had just been recorded against this one. A
 * recorded score is an advertised claim in two READMEs and the strategy
 * document; seven unchecked figures are a documented gap. Keeping the score and
 * writing the gap down is the trade, and the figures are the first thing to fix
 * tomorrow — BEFORE the audit starts.
 */
const CEILING = Number(process.env.NOTE_FIGURE_CEILING ?? 69);

const WITH_CENTS = /\$[\d,]+\.\d\d/g;

function testCorpus(packageDir) {
  const dir = join(packageDir, 'test');
  let all = '';
  for (const name of readdirSync(dir)) {
    if (!/\.(js|mjs|json)$/.test(name)) continue;
    all += readFileSync(join(dir, name), 'utf8');
  }
  return all;
}

/** Every string a definition ships to a caller: the notes and every rule cite. */
function shippedProse(def) {
  const out = [];
  const walk = (v, depth) => {
    if (depth > 8 || v === null || v === undefined) return;
    if (typeof v === 'string') {
      out.push(v);
      return;
    }
    if (typeof v !== 'object') return;
    for (const child of Object.values(v)) walk(child, depth + 1);
  };
  for (const note of def.notes) out.push(note);
  for (const [key, value] of Object.entries(def)) {
    if (key === 'notes' || key === 'citations') continue;
    walk(value, 0);
  }
  return out;
}

const pkg = await import(join(ROOT, 'packages', 'us-state-tax', 'dist', 'esm', 'index.js'));
const { SUPPORTED_STATES, SUPPORTED_YEARS, getStateDefinition } = pkg;
const testValues = valuesIn(testCorpus(join(ROOT, 'packages', 'us-state-tax')));

const unchecked = new Map();
let figures = 0;
for (const state of SUPPORTED_STATES) {
  const seen = new Set();
  for (const year of SUPPORTED_YEARS) {
    const def = getStateDefinition(state, year);
    if (!def) continue;
    for (const text of shippedProse(def)) {
      for (const hit of text.match(WITH_CENTS) ?? []) seen.add(hit);
    }
  }
  if (seen.size === 0) continue;
  figures += seen.size;
  const missing = [...seen].filter((f) => !testValues.has(Number(f.slice(1).replace(/,/g, ''))));
  if (missing.length > 0) unchecked.set(state, missing.sort());
}

const total = [...unchecked.values()].reduce((a, b) => a + b.length, 0);

if (!CHECK) {
  for (const [state, missing] of [...unchecked.entries()].sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    console.log(`\n${state} — ${missing.length} figure(s) with cents that no test file mentions`);
    for (const f of missing) console.log(`    ${f}`);
  }
}

console.log(
  `\n${figures} distinct figures with cents in shipped prose across ${SUPPORTED_STATES.length} states; ` +
    `${total} of them appear in no test file, in ${unchecked.size} state(s).`,
);

if (CHECK && total > CEILING) {
  console.error(
    `\n${total} unchecked figures against a ceiling of ${CEILING}. A figure with cents in a ` +
      `shipped note is a computed amount, and one that appears in no test is one nothing ran. ` +
      `Compute it in that state's test file, or stop printing it.`,
  );
  process.exit(1);
}
