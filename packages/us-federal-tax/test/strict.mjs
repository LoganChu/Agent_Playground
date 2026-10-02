// The engine, as the test suite is allowed to call it: `strict: true`.
//
// Day 38 built the top-level unknown-input guard after Day 37 called the
// published library with `wages` where the field is `w2Wages` and got a
// complete, internally consistent estimate of **nothing** back. The guard's
// default is a note in `result.notes`, because the caller who needs it is the
// one who does not know the field name and so does not know to ask for strict
// either — see `src/unknown-input.ts`.
//
// A test suite is the one caller that does know, and it is the caller for whom a
// dropped field should stop the run. So every test file imports the engine from
// here instead of from `../dist/esm/index.js`: one import line per file, nothing
// at any call site, and an unrecognised key becomes a failure naming the key and
// the nearest real field.
//
// This suite was measured before the switch and was already clean — unlike
// `us-state-tax`, where the same measurement found 109 tests passing a key the
// engine does not read. The wrapper is here so that stays true rather than
// because it was not.
//
// The DEFAULT behaviour is tested directly in `unknown-input.test.js`, which
// imports the real entry point rather than this one.
import { estimateFederalTax as engine } from '../dist/esm/index.js';

export * from '../dist/esm/index.js';

/** `estimateFederalTax`, defaulting to `strict: true`. A caller may still override. */
export const estimateFederalTax = (input, options = {}) =>
  engine(input, { strict: true, ...options });
