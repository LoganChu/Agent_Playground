/**
 * THE MCP SERVER MUST START WHEN SOME STATES SERVE A TAX YEAR AND OTHERS DO NOT.
 *
 * Day 83. Six lists in `src/state-fields.ts` were derived over the cross product
 * of `SUPPORTED_STATES` and `SUPPORTED_YEARS`, calling `getStateDefinition` for
 * each pair. That function **throws** on a state-year the registry does not
 * hold, and the six are module-level `const`s, so the first non-uniform tax year
 * turned importing this package into a `RangeError`:
 *
 *   RangeError: AL is supported but tax year 2031 is not. Supported years: 2025, 2026.
 *
 * Not a wrong answer from a tool — a server that does not start.
 *
 * ## WHY NO EXISTING TEST COULD SEE IT
 *
 * Both supported years are served by all forty-two states, so
 * `supportedYears(code)` and `SUPPORTED_YEARS` are the same array and the two
 * spellings are indistinguishable. 183 tests here and 1,197 in `us-state-tax`
 * exercise a square cross product, because that is the only one the package has
 * ever had. The defect is not in an answer; it is in a shape.
 *
 * And `state-fields.ts` carried `def?.` chains plus one `if (def === undefined)
 * return false` at every one of those sites. They read as handling exactly this
 * case. None of them could run — the lookup throws before it returns — so the
 * file documented a guard it did not have.
 *
 * ## WHY IT IS WORTH A TEST THAT COPIES THE BUILD
 *
 * `SUPPORTED_YEARS` is a module-level constant in a vendored engine, so a
 * non-uniform year cannot be injected at run time. This copies `dist`, adds a
 * probe year to the advertised list and to the nine states with no income tax
 * only, and imports the copy. The nine are the right states to extend: a state
 * with no income tax has no figure that can arrive later, which makes them the
 * only nine that can answer for a tax year before any state publishes anything.
 *
 * Forty-two states publish their 2027 figures between December and February, one
 * at a time. Every month from the next one is this shape.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const PROBE_YEAR = 2031;
const DIST = new URL('../dist/', import.meta.url);

// ONE COPY FOR THE WHOLE FILE, DELETED AS SOON AS BOTH MODULES ARE IMPORTED.
//
// The first version built a fresh copy inside each of the three tests and
// removed none of them, so every run of this suite left three copies of `dist`
// — about 13 MB — in the OS temp directory. The companion file in
// `us-state-tax` was worse, because **the mutation audit runs that suite once
// per mutant**: today's run left 1,532 directories and roughly 1.5 GB behind,
// and the first symptom was a single unreproducible failure in THIS suite while
// `test-counts.mjs` was running, with the disk the only thing that had changed.
//
// Deleting after `import()` is safe: both modules are resolved and held in
// memory, and nothing reads those files again.
let built;

async function nonUniform() {
  if (built) return built;
  const dir = nonUniformBuild();
  try {
    built = {
      stateFields: await import(pathToFileURL(join(dir, 'state-fields.js')).href),
      entry: await import(pathToFileURL(join(dir, 'index.js')).href),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return built;
}

function nonUniformBuild() {
  const dir = mkdtempSync(join(tmpdir(), 'us-tax-mcp-nonuniform-'));
  cpSync(DIST, dir, { recursive: true });
  // Derived from the build, not written here: a gate about adding a tax year
  // must not break on the day one is added.
  const bump = (rel, decl) => {
    const file = join(dir, rel);
    const before = readFileSync(file, 'utf8');
    const found = [...before.matchAll(new RegExp(`${decl} = \\[([\\d, ]+)\\];`, 'g'))];
    assert.equal(found.length, 1, `expected exactly one \`${decl} = [...]\` in ${rel}, found ${found.length}`);
    const years = found[0][1].split(',').map((n) => Number(n.trim()));
    assert.ok(!years.includes(PROBE_YEAR), `${PROBE_YEAR} is already in ${decl}; pick another probe year`);
    writeFileSync(file, before.replace(found[0][0], `${decl} = [${[...years, PROBE_YEAR].join(', ')}];`));
    return years;
  };
  const advertised = bump('state-engine/states/index.js', 'export const SUPPORTED_YEARS');
  const nine = bump('state-engine/states/no-income-tax.js', 'const YEARS');
  assert.deepEqual(advertised, nine, 'the nine no-income-tax states no longer serve exactly the advertised years, so this probe would not be a NON-uniform year');
  return dir;
}

test('state-fields imports when a tax year is served by some states and not others', async () => {
  const { stateFields: mod } = await nonUniform();
  assert.ok(Array.isArray(mod.STATE_FIELDS));
  assert.ok(mod.STATE_FIELDS.length > 0);
});

test('the whole server module graph imports under a non-uniform year', async () => {
  // state-fields is where the six derivations are, but `tools.ts` and
  // `schema.ts` read SUPPORTED_YEARS too. This imports the package entry point,
  // which is what `npx us-tax-mcp` does.
  const { entry: mod } = await nonUniform();
  assert.ok(mod);
});

test('the derived state lists are the same under a non-uniform year', async () => {
  // Importing is not enough. A `.some()` that swallowed the throw would import
  // too, and would silently drop every state whose first lookup missed. Adding a
  // year in which nine states have no tax rule must change none of these lists:
  // all six are about which states read an INPUT, and a state with no income tax
  // reads nothing in any year.
  const { stateFields: probe } = await nonUniform();
  const live = await import('../dist/state-fields.js');

  assert.equal(probe.STATE_FIELDS.length, live.STATE_FIELDS.length);
  const states = (m) =>
    Object.fromEntries(m.STATE_FIELDS.map((f) => [f.name, [...(f.states ?? [])].sort()]));
  assert.deepEqual(states(probe), states(live));

  // And at least one field must actually carry a non-empty state list, or the
  // comparison above is a comparison of nothing.
  assert.ok(live.STATE_FIELDS.some((f) => (f.states ?? []).length > 0));
});
