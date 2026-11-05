// The package metadata, which is the only reach lever this project controls.
//
// Thirty-two entries of NOTES-FOR-HUMAN.md say that publishing to npm is the one
// thing only the human can do, and that what it buys is reach rather than
// capability. Everything upstream of that — the name, the description, the
// keyword list someone searching a registry for `state-income-tax` actually
// matches against — is this package's own, and until Day 38 nothing checked any
// of it.
//
// The bill was small and it was real: **`local-income-tax` appeared twice** in a
// list of 132. A duplicate keyword is not a crime, but the list is 130-odd
// hand-maintained strings and Day 34's rule is that a hand-maintained list of
// names drifts — and this is the list whose whole purpose is to be matched
// against, in the one place a stranger could find this package at all.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkManifest,
  DESCRIPTION_CAP,
  DESCRIPTION_FLOOR,
  KEYWORD_CAP,
  KEYWORD_FLOOR,
} from '../../../tools/registry/surface.mjs';

const pkg = JSON.parse(
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'),
);

test('no keyword appears twice', () => {
  const counts = new Map();
  for (const keyword of pkg.keywords) counts.set(keyword, (counts.get(keyword) ?? 0) + 1);
  const repeated = [...counts].filter(([, n]) => n > 1).map(([k, n]) => `${k} (${n}x)`);
  assert.deepEqual(repeated, [], `duplicate keywords: ${repeated.join(', ')}`);
});

test('every keyword is in the form a registry search matches', () => {
  // npm lowercases and trims on publish, so a keyword with a capital or a space
  // is not the string it looks like in this file — it is silently a different
  // one, which is the same class of defect as the rest of today.
  for (const keyword of pkg.keywords) {
    assert.equal(typeof keyword, 'string');
    assert.match(keyword, /^[a-z0-9][a-z0-9-]*$/, `not a registry-shaped keyword: ${keyword}`);
    assert.ok(keyword.length <= 40, `keyword too long to be searched for: ${keyword}`);
  }
});

test('the three fields a registry card is built from are all present', () => {
  // A blank one of these renders as a blank card everywhere the package is
  // linked, which is the argument NOTES-FOR-HUMAN.md makes about this
  // repository's own empty description.
  //
  // BOTH BOUNDS IN THIS TEST USED TO POINT AWAY FROM THE REGISTRY, and Day 73
  // measured how far. `description.length > 200` had NO CEILING, so the field
  // grew to 2,895 characters against a cap the registry was measured to hold at
  // 255 — 91.2% of it discarded, and the surviving 255 were entirely about New
  // Mexico's dependent deduction, never once saying the package is an MCP
  // server. `keywords.length >= 100` was a FLOOR, demanded 100, and the 99th
  // percentile across 1,497 sampled published packages is 25.
  //
  // > **A GUARD CAN REQUIRE THE DEFECT.** This one did not merely fail to catch
  // > a 135-keyword list and a description nobody could receive; CI enforced
  // > both. A bound is a claim about the consumer, and this file's own header
  // > calls that consumer "the only reach lever this project controls".
  //
  // The bounds now come from `tools/registry/surface.mjs`, which re-derives them
  // from the registry's search index with `--measure` rather than carrying a
  // figure somebody read in a blog post.
  assert.equal(pkg.name, 'us-tax-mcp');
  assert.ok(
    pkg.description.length <= DESCRIPTION_CAP,
    `description is ${pkg.description.length} characters and the registry serves ${DESCRIPTION_CAP}`,
  );
  assert.ok(pkg.description.length > DESCRIPTION_FLOOR, 'the description is the card');
  assert.ok(
    pkg.keywords.length <= KEYWORD_CAP,
    `${pkg.keywords.length} keywords, above the ${KEYWORD_CAP} that is the 99th percentile`,
  );
  assert.ok(pkg.keywords.length >= KEYWORD_FLOOR, `${pkg.keywords.length} keywords`);
  assert.equal(pkg.license, 'MIT');
});

test('this package is reachable from its own registry card', () => {
  // Day 73: all three manifests carried no `homepage`, no `bugs` and no
  // `repository`, so the registry page a stranger lands on had no link back to
  // the proof — which is the entire path from being found to being believed.
  const problems = checkManifest('us-tax-mcp', pkg);
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('the bin, exports and files a published install depends on', () => {
  // `tools/smoke/install-from-release.mjs` proves these work by installing the
  // tarball, which only runs after a release exists. These are the same claims
  // read off the manifest, so a broken one fails before the release is cut.
  assert.equal(pkg.bin['us-tax-mcp'], './dist/cli.js');
  assert.deepEqual(pkg.files, ['dist', 'README.md', 'LICENSE']);
  assert.equal(pkg.exports['.'].default, './dist/index.js');
  assert.equal(pkg.type, 'module');
  assert.deepEqual(pkg.dependencies, undefined, 'zero runtime dependencies');
});
