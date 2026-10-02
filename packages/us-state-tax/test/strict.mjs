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
