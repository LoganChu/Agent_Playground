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

// ---------------------------------------------------------------------------
// THE DEFAULT YEAR IS PER STATE, AND IT WAS NOT.
//
// Day 84. The two tests above prove the server IMPORTS under a non-uniform
// year. That is necessary and it is not enough, and the gap cost a working tool
// on the first real one.
//
// `state_income_tax`, `describe_state` and `state_figure_provenance` each
// defaulted an omitted `year` to the last entry of `SUPPORTED_YEARS` — the union
// across every state. The moment 2027 was added for the nine states with no
// individual income tax, a caller who named California and no year got
//
//   Invalid arguments: CA is supported but tax year 2027 is not.
//
// **Nothing about that request mentioned a year.** It is Day 51's shape: not a
// wrong number but a REFUSAL with a false explanation, handed to a model that
// will record "California is unavailable" rather than "the default was wrong".
// Thirty-three of the forty-two states, on three tools, from one `[length - 1]`.
//
// The import gates could not see it, because importing is not calling. These
// call.
import { findTool, handleMessage } from '../dist/index.js';
import {
  SUPPORTED_STATES,
  SUPPORTED_YEARS,
  statesForYear,
  supportedYears,
} from '../dist/state-engine/index.js';

const callTool = (name, args) =>
  handleMessage({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } })
    .result;

// Massachusetts, New Jersey and Pennsylvania define their own tax base and
// REFUSE to run without it, which is correct and is not what this file is
// about. Supplying all three to every state is safe: the server rejects a
// field offered to a state that does not read it only when it is the sole
// subject of the call, and these three are accepted engine-wide.
const BASIS = {
  federalAdjustedGrossIncome: 100_000,
  federalTaxableIncome: 84_250,
  federalDeduction: 15_750,
};

const basisFor = (state) => ({
  ...BASIS,
  ...(state === 'MA' ? { massachusettsFivePercentIncome: 100_000 } : {}),
  ...(state === 'NJ' ? { newJerseyGrossIncome: 100_000 } : {}),
  ...(state === 'PA' ? { pennsylvaniaTaxableIncome: 100_000 } : {}),
});

test('every state answers state_income_tax with no year named, in every year it serves', () => {
  // The whole registry, not a sample: the defect hit thirty-three states and
  // would have been invisible in any sample that happened to pick one of the
  // nine. 2,000-odd calls, under a second.
  for (const state of SUPPORTED_STATES) {
    const args = { filingStatus: 'single', state, ...basisFor(state) };
    const defaulted = callTool('state_income_tax', args);
    assert.equal(
      defaulted.isError,
      false,
      `${state} with no year: ${defaulted.content[0].text}`,
    );
    // And the year it chose is that state's latest, not the package's.
    const years = supportedYears(state);
    const latest = years[years.length - 1];
    assert.equal(defaulted.structuredContent.state.year, latest, `${state} defaulted to the wrong year`);

    for (const year of years) {
      const named = callTool('state_income_tax', { ...args, year });
      assert.equal(named.isError, false, `${state} ${year}: ${named.content[0].text}`);
      assert.equal(named.structuredContent.state.year, year);
    }
  }
});

test('a year a state does not serve is refused by naming THAT STATE years', () => {
  let checked = 0;
  for (const state of SUPPORTED_STATES) {
    for (const year of SUPPORTED_YEARS) {
      if (supportedYears(state).includes(year)) continue;
      checked += 1;
      for (const name of ['state_income_tax', 'describe_state']) {
        const args =
          name === 'state_income_tax'
            ? { filingStatus: 'single', state, year, ...basisFor(state) }
            : { state, year };
        const result = callTool(name, args);
        assert.equal(result.isError, true, `${name} ${state} ${year} was not refused`);
        const text = result.content[0].text;
        // The refusal must quote the state's OWN years and must not offer the
        // year it just refused. The message that was here quoted the union, so
        // it listed the refused year as supported in the sentence refusing it.
        assert.ok(
          text.includes(`${state} covers ${supportedYears(state).join(', ')}`),
          `${name} ${state} ${year} does not name the state's own years: ${text}`,
        );
        assert.ok(
          !new RegExp(`covers [^.]*\\b${year}\\b`).test(text),
          `${name} ${state} ${year} lists ${year} as covered: ${text}`,
        );
      }
    }
  }
  // The gate is only meaningful while the grid is not square, and it says so
  // rather than passing silently if it ever becomes square again.
  assert.ok(checked > 0, 'every state serves every year, so this gate asserts nothing');
});

test("the state year enum is a union, and the schema says which states serve the latest", () => {
  // JSON Schema cannot make one property's enum depend on another's, so the
  // enum HAS to be the union — which means the description is the only place the
  // per-state rule can live, and a model that reads the enum and not the prose
  // will offer 2027 for California. The description is therefore load-bearing
  // contract rather than help text, and it is pinned.
  const schema = findTool('state_income_tax').inputSchema.properties.year;
  assert.deepEqual(schema.enum, [...SUPPORTED_YEARS]);
  const widest = Math.max(...SUPPORTED_YEARS);
  assert.match(schema.description, /support is PER STATE/);
  assert.ok(
    schema.description.includes(
      `${statesForYear(widest).length} of ${SUPPORTED_STATES.length} states serve ${widest}`,
    ),
    `the schema no longer counts the states serving ${widest}: ${schema.description}`,
  );
});
