/**
 * The mutation audit's ENUMERATOR, in a module a test can import.
 *
 * ## Why this file exists, which is a six-day worklist item with a one-line cause
 *
 * "Give the mutation harness a test suite — it still has none" has been on the
 * worklist since Day 54, and four runs in a row restated it without doing it.
 * Day 58 found the reason, and it is not that the tests are hard to write:
 * **`mutate.mjs` is a script, so importing it RUNS the audit.** There is no way
 * to call `maskNonCode` from a test while the only copy of it lives inside three
 * hours of top-level work. Nothing was blocking the tests but the module
 * boundary.
 *
 * So the pure part lives here — no argv, no child processes, no clock — and
 * `mutate.mjs` imports it. `enumerate.test.mjs` is the suite that could not be
 * written before.
 *
 * ## Why the enumerator in particular, out of everything the harness does
 *
 * It is the only part whose failures are INVISIBLE. A broken worker pool shows
 * up as a wrong duration; a broken comparison shows up as an absurd score. A
 * broken enumerator just produces fewer mutants, and **a mutant that stops
 * existing cannot survive**, so the score rises while the coverage falls and
 * every artefact in the repository agrees with every other one.
 *
 * That is not hypothetical here. Day 56 predicted the state engine at 1,534
 * mutants and measured 1,533; the missing one was `0.0765`, the FICA rate, real
 * executable code six hundred lines from anything that had changed, invisible
 * because `maskNonCode` had no notion of a `${...}` interpolation. Ten literals
 * in one file were never being mutated and six of the ten turned out to be
 * checked by no test at all. **It was caught by a prediction being off by one,
 * which is the thinnest possible margin for the most serious kind of defect this
 * project can have** — a defect in the measurement of its own quality.
 *
 * Extracting these three functions changes no behaviour, and that is checked
 * rather than asserted: the enumeration was dumped from the old script before
 * the move and compared element by element afterwards, 1,543 mutants over 32
 * files, byte for byte identical. `enumerate.test.mjs` keeps a golden sample of
 * that dump so the comparison survives this run.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Mask comments and string literals with spaces, keeping every byte offset —
 * but keep the CODE inside a template literal's `${...}` interpolations.
 *
 * Without the masking the harness mutates STATUTE CITATIONS: the first pilot run
 * reported `credits.js` at 0% killed because `§ 164(f)`, `$1,700` and `$8,812`
 * live in JSDoc, and a number in a comment cannot make a test fail. A mutation
 * score computed over comments is a measure of documentation density.
 *
 * ## And then it masked real code for twenty-two days, and the count moved by
 * ## one for a reason that had nothing to do with the change
 *
 * Day 56 predicted that the state engine's mutant count would be unchanged at
 * **1,534**, on the argument that the day's edit introduced no numeric literal
 * and the three operators only read numbers. The run came back **1,533**.
 *
 * The missing mutant was `0.0765` — the FICA rate, in
 * `Math.round(rule.perFilerCap / 0.0765)`, six hundred lines from anything the
 * day touched. It is real, executable code. It lives inside a `${...}`
 * interpolation in a note, and **this function had no notion of an
 * interpolation**: it saw a backtick, scanned forward to the next unescaped
 * backtick, and blanked everything between — interpolated code included. Which
 * of those backticks it landed on depends on every quote, comment and escaped
 * backtick BEFORE it in the file, so editing one template literal in one
 * function silently changed whether a literal in a different function was
 * visible at all.
 *
 * > **THE RULE: A MASK WITH A STATE MACHINE IS A GLOBAL PROPERTY OF THE FILE,
 * > SO A LOCAL EDIT CAN DELETE A CHECK SOMEWHERE ELSE.** And it fails in the
 * > direction that LOOKS fine: a mutant that stops existing cannot survive, so
 * > the score goes up while the coverage goes down.
 *
 * The old comment claimed "a mis-parse would only over-mask (fewer mutants),
 * never invent one", and treated that as safe. It is the safe DIRECTION and it
 * is not harmless: fewer mutants is fewer checks, reported as a better number.
 *
 * So the scan is now template-aware. It blanks a template's literal text and
 * walks each `${...}` as code, tracking brace depth and recursing into nested
 * templates and quotes. That recovered **ten** literals in `us-state-tax`'s
 * `engine.js` — eight `× 100` percentage conversions and the rates `0.0765` and
 * `0.025`, every one of them inside a note's own text — and **changed nothing in
 * `us-federal-tax`, which has no interpolated literal at all**, so its recorded
 * 716 still stands and did not need re-measuring.
 */
export function maskNonCode(src) {
  const out = src.split('');
  const blank = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' '; };
  const n = src.length;

  /** Blank a quoted string starting at `start`, and return the offset after it. */
  function quoted(start) {
    const quote = src[start];
    let j = start + 1;
    while (j < n) {
      if (src[j] === '\\') { j += 2; continue; }
      if (src[j] === quote) { j++; break; }
      j++;
    }
    blank(start, j);
    return j;
  }

  /**
   * Blank a template literal's TEXT from `start` (a backtick), leaving every
   * `${...}` interpolation as code, and return the offset after the closing
   * backtick.
   */
  function template(start) {
    let j = start + 1;
    let textFrom = j;
    while (j < n) {
      if (src[j] === '\\') { j += 2; continue; }
      if (src[j] === '`') { blank(textFrom, j); return j + 1; }
      if (src[j] === '$' && src[j + 1] === '{') {
        blank(textFrom, j);
        // Walk the interpolation as code. Brace depth is what ends it, because
        // an interpolation may contain object literals and arrow bodies.
        let depth = 1;
        let k = j + 2;
        while (k < n && depth > 0) {
          const c = src[k];
          if (c === '\\') { k += 2; continue; }
          if (c === '{') { depth++; k++; continue; }
          if (c === '}') { depth--; k++; continue; }
          if (c === '`') { k = template(k); continue; }
          if (c === '"' || c === "'") { k = quoted(k); continue; }
          if (c === '/' && src[k + 1] === '/') { let m = src.indexOf('\n', k); if (m === -1) m = n; blank(k, m); k = m; continue; }
          if (c === '/' && src[k + 1] === '*') { let m = src.indexOf('*/', k + 2); m = m === -1 ? n : m + 2; blank(k, m); k = m; continue; }
          k++;
        }
        j = k;
        textFrom = j;
        continue;
      }
      j++;
    }
    // An unterminated template is not something these files contain; blanking to
    // the end is the conservative answer if one ever appears.
    blank(textFrom, n);
    return n;
  }

  let i = 0;
  // Regex literals are the one ambiguity; these files contain none in a position
  // where `/` could start one, and a mis-parse would only over-mask (fewer
  // mutants), never invent one — which is the safe direction and, as the header
  // above records, not a harmless one.
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { let j = src.indexOf('\n', i); if (j === -1) j = n; blank(i, j); i = j; continue; }
    if (c === '/' && src[i + 1] === '*') { let j = src.indexOf('*/', i + 2); j = j === -1 ? n : j + 2; blank(i, j); i = j; continue; }
    if (c === '`') { i = template(i); continue; }
    if (c === '"' || c === "'") { i = quoted(i); continue; }
    i++;
  }
  return out.join('');
}

export function walk(d, out = []) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

/** The three operators, and the kind they name. */
export function mutantOf(text) {
  // `Number('12_400')` is NaN.
  const v = Number(text.replace(/_/g, ''));
  if (!Number.isFinite(v)) return null;
  if (text.includes('.')) {
    if (v > 0 && v < 1) return { kind: 'rate', to: String(v / 2) };
    return null; // a decimal >= 1 is usually a multiplier or a printed figure
  }
  // A separator means money, whatever the magnitude: `2_000` is a deduction and
  // `2024` is a tax year. See the operator table above.
  if (v >= 1900 && v <= 2100 && !text.includes('_')) return { kind: 'year', to: String(v - 1) };
  if (v >= 100) return { kind: 'money', to: String(v * 2) };
  return null;
}

/**
 * Every numeric literal in a file of compiled JavaScript, as the harness sees
 * them.
 *
 * The pattern is the harness's, moved verbatim rather than retyped. Numeric
 * separators are the point: this codebase writes `12_400`, and a pattern that
 * stops at the underscore skips almost every money parameter while still
 * matching the `12` in front of it. `tsc` preserves them.
 *
 * A fresh `RegExp` per call, because `g` carries `lastIndex` and a shared one
 * would skip literals depending on who called it last — the same class of defect
 * as the mask's own, where state outlives the thing it belongs to.
 */
export function literalsIn(code) {
  const re = /(?<![\w.$])\d[\d_]*(?:\.\d[\d_]*)?(?![\w.])/g;
  const found = [];
  let m;
  while ((m = re.exec(code)) !== null) found.push({ text: m[0], offset: m.index });
  return found;
}

/**
 * Every mutant in one file of compiled JavaScript, in source order.
 *
 * `rel` is carried through rather than derived, because the caller knows which
 * root the path is relative to and this function does not.
 */
export function mutantsInSource(src, rel) {
  const code = maskNonCode(src);
  const out = [];
  for (const { text, offset } of literalsIn(code)) {
    const op = mutantOf(text);
    if (!op) continue;
    // Line number, for a report a human can act on.
    const line = code.slice(0, offset).split('\n').length;
    out.push({ rel, offset, from: text, to: op.to, kind: op.kind, line });
  }
  return out;
}

/**
 * Every mutant under `esm`, over every `.js` file that no `skip` substring
 * matches.
 *
 * Returns the files it walked alongside the mutants, because the harness
 * announces both and a count of files it did not actually read would be the
 * kind of claim this repository keeps finding wrong.
 */
export function enumerateMutants(esm, skip = []) {
  const files = walk(esm).filter((f) => !skip.some((s) => f.includes(s)));
  const mutants = [];
  for (const f of files) mutants.push(...mutantsInSource(readFileSync(f, 'utf8'), relative(esm, f)));
  return { files, mutants };
}
