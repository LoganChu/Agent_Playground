// The engine, as the test suite is allowed to call it: `strict: true`.
//
// Day 38 built the top-level unknown-input guard and then measured what this
// suite had been doing with it. **109 of 596 tests were passing a key the engine
// does not read**, through fourteen household helpers all shaped the same way:
//
//   const oh = (opts = {}) => stateIncomeTax({
//     state: 'OH', year: opts.year ?? 2025, federal: federal(opts.agi ?? 60_000),
//     ...opts,                                 // <- `agi` goes to the engine too
//   });
//
// `...opts` is what lets one helper pass any real field through, and it is also
// what spreads the helper's OWN options straight into the engine, where an
// unrecognised key is dropped without a word. None of the leaks changed an
// answer — they were all helper options the engine has no field for — but the
// pattern is a machine for Day 33's bug, and two real defects were sitting in
// it: a `wages` key written thirteen times where no such field exists, and a
// `stateSubtractions` that should have been `subtractions` and turned a
// regression test into one that could not fail on the bug it guards.
//
// Fixing fourteen helpers is not a fix. **The reason a typo survives is that
// nothing fails on it**, so the suite now asks for the throw. Every test file
// imports the engine from here instead of from `../dist/esm/index.js`, which
// costs one import line per file and nothing at any call site, and an
// unrecognised key is now a test failure naming the key and the nearest real
// field.
//
// `strict` is a documented option of the shipped engine and this is exactly
// what its documentation says it is for. The guard's DEFAULT behaviour — a note
// in `result.notes`, never a throw — is what a library caller gets, and it is
// tested directly in `unknown-input.test.js`, which imports the real entry
// point rather than this one.
import { stateIncomeTax as engine } from '../dist/esm/index.js';

export * from '../dist/esm/index.js';

/** `stateIncomeTax`, defaulting to `strict: true`. A caller may still override. */
export const stateIncomeTax = (input, options = {}) =>
  engine(input, { strict: true, ...options });

// ---------------------------------------------------------------------------
// THE STATE-YEAR PAIRS THIS PACKAGE ACTUALLY SERVES.
//
// Day 84. `SUPPORTED_STATES × SUPPORTED_YEARS` was the whole suite's idea of
// "every state-year" for eighty-three days, and it was right for eighty-three
// days because both supported years were served by all forty-two states. Tax
// year 2027 ends that: twelve states serve it — the nine with no individual
// income tax, which have no figure that can arrive later, and the three whose
// 2027 is already written into statute — and the other thirty do not, because
// each of them has a figure that arrives between December and February.
//
// The cross product is therefore no longer a list of state-years. It is a list
// of state-years plus thirty-three pairs that make `getStateDefinition` throw,
// and a sweep over it does not fail with an assertion about tax — it fails with
// a `RangeError` from the lookup, in whatever test happened to reach it first.
// Day 83 fixed exactly this shape inside the two packages, where it made
// `import` itself throw. This is the same shape in the instrument that watches
// them.
//
// The two replacements — `statesForYear(year)` and `supportedYears(state)` —
// are SHIPPED API rather than test helpers, and deliberately so: a caller
// asking a non-square registry "what can I ask about 2027" has the same problem
// this suite had, and the answer should not live in `test/`. They are re-exported
// by the `export *` above.
