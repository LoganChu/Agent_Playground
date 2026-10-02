// The one module these two packages share, and the only way they can share it.
//
// `us-federal-tax` and `us-state-tax` are deliberately independent: zero runtime
// dependencies each, neither importing the other, so a consumer can take one
// without the other. That rules out a shared package for
// `src/unknown-input.ts` — the near-miss rule, the edit distance, the note and
// the throw — so there are two copies of it, byte for byte identical.
//
// **Two copies of a fact that must agree is a bug with a waiting period**, which
// is `us-state-tax`'s own rule about its state lists, and a module is such a
// fact. So the waiting period is this file.
//
// It lives on its own rather than inside `unknown-input.test.js` for a reason
// worth writing down. The mutation harness runs each package's suite inside a
// copy of that package, and a test that resolves a path into a SIBLING package
// cannot pass there — `tools/mutation/mutate.mjs` detects exactly that and
// leaves the file out of the audit. With this assertion in
// `unknown-input.test.js`, the twenty tests beside it that pin
// `SUGGESTION_LIMIT`, the two-edit ceiling and the four-characters-per-edit
// budget went out of the audit with it, and every one of those constants would
// have come back a survivor. **One repository-level assertion in a file of
// engine tests takes the whole file out of the measurement**, so it gets its own
// file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGES = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('src/unknown-input.ts is byte-identical in both packages', () => {
  const read = (pkg) => readFileSync(resolve(PACKAGES, pkg, 'src', 'unknown-input.ts'), 'utf8');
  assert.equal(
    read('us-federal-tax'),
    read('us-state-tax'),
    'packages/*/src/unknown-input.ts must be identical — edit both or neither',
  );
});
