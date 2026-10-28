/**
 * Which tests can kill a mutant — the pure half of per-mutant test selection.
 *
 * ## Why this is its own file
 *
 * The same reason `enumerate.mjs` is. `mutate.mjs` runs an audit on import, so
 * for as long as a function lives in there, no test can call it: that is why
 * "give the mutation harness a test suite" sat on the worklist from Day 54 to
 * Day 58, and why the enumerator was moved out rather than tested in place.
 *
 * Day 65 added per-mutant selection to `mutate.mjs` and it has a failure mode
 * that nothing would report. **A selection that silently stops attributing
 * mutants does not make the audit WRONG — the whole-suite re-run keeps the score
 * exact — it makes it SLOW.** So a broken selection shows up as a run that takes
 * fifteen hours again, weeks later, with every test green the whole time. That is
 * precisely the class of defect this repository builds instruments for, and it
 * cannot have one while the code is unreachable from a test.
 *
 * So the pure part lives here: no file system, no child processes, no audit. The
 * caller passes sources in and gets a plan out.
 *
 * ## What the selection is allowed to get wrong
 *
 * Everything, as far as correctness goes. `mutate.mjs` re-runs every mutant that
 * SURVIVES its selection against the whole suite and records only that verdict,
 * so a mis-selection costs one suite run and cannot move the score. The tests in
 * `select.test.mjs` are therefore about the selection staying USEFUL, which is a
 * different property from it being sound, and the only one that can rot quietly.
 */

/**
 * The top-level declarations of a module, in order, each owning the span of
 * source from its own start to the next one's.
 *
 * Deliberately a regex over line starts rather than a parse. The input is
 * `tsc` output, which puts every top-level declaration at column zero, and a
 * parser here would be a second dependency for a question whose answer only has
 * to be good enough to attribute a byte offset to a state.
 */
export function declarations(src) {
  const re = /^(?:export\s+)?(?:const|let|var|function|class)\s+([A-Za-z0-9_$]+)/gm;
  const out = [];
  let m;
  while ((m = re.exec(src)) !== null) out.push({ name: m[1], start: m.index });
  for (let i = 0; i < out.length; i++) out[i].end = i + 1 < out.length ? out[i + 1].start : src.length;
  return out;
}

/** Every two-letter state code any of these module sources claims. */
export function codesIn(sources) {
  const codes = new Set();
  for (const src of sources) {
    for (const m of src.matchAll(/\bcode: '([A-Z]{2})'/g)) codes.add(m[1]);
  }
  return codes;
}

/**
 * Per-module attribution: for each top-level declaration, the state it belongs
 * to, plus the module's own code where it has exactly one.
 *
 * A declaration's state is the single `code:` field inside it, or the `GA_`
 * prefix on its name where it holds no `code:` at all. **Proximity is NOT used
 * and that is the whole reason this is done by declaration:** Georgia's function
 * in `flat-states.js` opens with two `const` lines before its `return {`, so the
 * nearest PRECEDING `code:` literal for a mutant in them is Arizona's, 273 lines
 * up. The enclosing declaration is right where the nearest literal is wrong.
 *
 * @param entries `[[rel, source]]` for the modules that can hold a state.
 */
export function attributionOf(entries, allCodes) {
  const attribution = new Map();
  for (const [rel, src] of entries) {
    const fileCodes = codesIn([src]);
    const spans = declarations(src).map((d) => {
      const inside = codesIn([src.slice(d.start, d.end)]);
      const prefix = /^([A-Z]{2})_/.exec(d.name)?.[1];
      return {
        name: d.name,
        start: d.start,
        end: d.end,
        code:
          inside.size === 1
            ? [...inside][0]
            : inside.size === 0 && prefix !== undefined && allCodes.has(prefix)
              ? prefix
              : null,
      };
    });
    attribution.set(rel, { fileCode: fileCodes.size === 1 ? [...fileCodes][0] : null, spans });
  }
  return attribution;
}

/** The state a mutant at `offset` in `rel` belongs to, or `undefined`. */
export function codeAtIn(attribution, rel, offset) {
  const a = attribution.get(rel);
  if (a === undefined) return undefined;
  const span = a.spans.find((s) => offset >= s.start && offset < s.end);
  return span?.code ?? a.fileCode ?? undefined;
}

/**
 * The test files whose tests are named after a state, and so can be selected one
 * state at a time with `--test-name-pattern`.
 *
 * Derived from the source rather than listed, because a list of file names is a
 * list that goes stale: splitting a third sweep into per-state tests tomorrow
 * should need no edit in the harness.
 *
 * @param testSource Map of file name -> source.
 */
export function narrowableIn(testSource) {
  return [...testSource.keys()].filter((f) => /test\(`[^`]*\$\{state\}/.test(testSource.get(f)));
}

/** Which state codes each test file names in its text. */
export function mentionsIn(testSource, allCodes) {
  return new Map(
    [...testSource.keys()].map((f) => [
      f,
      new Set([...allCodes].filter((c) => new RegExp(`['"\`]${c}['"\`]`).test(testSource.get(f)))),
    ]),
  );
}

/**
 * The ordered steps to run for a mutant belonging to `code`, or `null` for
 * "the whole suite".
 *
 * Cheapest and most lethal first: the narrowed sweeps pin every by-status cell
 * and every staircase number in that one state, so they kill most data mutants in
 * well under a second, and a kill in step one means step two is never run.
 *
 * A file that names NO state is a package-wide guard and runs for everything.
 */
export function planSteps({ code, testFiles, narrowable, mentions }) {
  if (code === undefined || code === null) return null;
  const generic = testFiles.filter((f) => mentions.get(f).size === 0);
  const narrowed = narrowable.filter((f) => mentions.get(f).has(code) || mentions.get(f).size === 0);
  const rest = [...new Set([...generic, ...testFiles.filter((f) => mentions.get(f).has(code))])].filter(
    (f) => !narrowed.includes(f),
  );
  const steps = [];
  if (narrowed.length > 0) steps.push({ files: narrowed, pattern: ` ${code} ` });
  if (rest.length > 0) steps.push({ files: rest, pattern: null });
  return steps.length === 0 ? null : { code, steps };
}
