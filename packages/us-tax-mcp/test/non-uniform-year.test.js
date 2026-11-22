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
  INDIANA_COUNTIES,
  MARYLAND_COUNTIES,
  MICHIGAN_CITIES,
  OHIO_MUNICIPALITIES,
  OHIO_SCHOOL_DISTRICTS,
  SUPPORTED_STATES,
  SUPPORTED_YEARS,
  localTaxYears,
  statesForYear,
  supportedYears,
  supportedYears as supportedStateYears,
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

// ---------------------------------------------------------------------------
// THE DEFAULT YEAR MUST ANSWER THE WHOLE REQUEST, NOT ONE AXIS OF IT
// ---------------------------------------------------------------------------

/**
 * A real value for every argument that names a local jurisdiction, taken from
 * the engine's own registries rather than written here.
 *
 * Written from the lists so that the day a jurisdiction is renamed this test
 * follows it, and so that a state gaining a local tax is covered without anybody
 * remembering to extend a literal. The alternative — 'Marion', 'Detroit', '0203'
 * typed into a test — is the shape of defect this whole file exists about.
 */
function localArgsFor(state) {
  const out = [];
  if (state === 'NY') {
    out.push({ locality: 'NYC' }, { locality: 'YONKERS' }, { yonkersNonresidentEarnings: 25_000 });
  }
  if (state === 'MD') out.push({ county: MARYLAND_COUNTIES[0] });
  if (state === 'IN') out.push({ county: INDIANA_COUNTIES[0] });
  if (state === 'MI') out.push({ city: MICHIGAN_CITIES[0] });
  if (state === 'OH') {
    out.push(
      { city: OHIO_MUNICIPALITIES[0], qualifyingWages: 60_000 },
      { schoolDistrict: OHIO_SCHOOL_DISTRICTS[0] },
    );
  }
  return out;
}

const RETURN = {
  filingStatus: 'single',
  federalAdjustedGrossIncome: 60_000,
  federalTaxableIncome: 44_250,
  federalDeduction: 15_750,
};

test('A LOCAL JURISDICTION WITH NO YEAR NAMED IS ANSWERED, NOT REFUSED', () => {
  //   THIS SHIPPED. `state_income_tax({ state: 'IN', county: 'Marion', ... })`
  //   with no `year` threw a bare RangeError in 0.67.0 for three days, because
  //   the default year became "the latest year INDIANA serves" the day Indiana
  //   served 2027 — and Indiana's ninety-two county taxes do not. Every Indiana
  //   resident owes one, so that was close to the most likely Indiana call
  //   there is, and the refusal named a year the caller had not asked for.
  //
  //   Day 84 fixed exactly this defect one level up, where the default was the
  //   latest year ANY state served. The fix defaulted from the state instead of
  //   from the union and reproduced the bug against the layer below. So the gate
  //   is not "the default is the state's latest year" — it is this: a request
  //   the server accepts must be answerable with the year the server chose.
  let checked = 0;
  for (const state of SUPPORTED_STATES) {
    for (const extra of localArgsFor(state)) {
      const args = { ...RETURN, state, ...extra };
      const result = findTool('state_income_tax').run(args);
      checked += 1;
      const year = result.structured.state.year;
      assert.ok(
        localTaxYears(state).includes(year),
        `${state} ${JSON.stringify(extra)} was answered for ${year}, which its local taxes ` +
          'do not serve',
      );
      //   And the local tax is actually IN the answer. A default that merely
      //   stopped throwing — by dropping the jurisdiction — would pass the line
      //   above and be worse than the refusal it replaced.
      assert.ok(
        result.structured.state.localTaxes.length > 0,
        `${state} ${JSON.stringify(extra)} returned no local tax at all`,
      );
    }
  }
  assert.equal(checked, 8, 'local-jurisdiction arguments exercised with no year named');
});

test('and a local jurisdiction in a year it does not serve is an ARGUMENT error', () => {
  //   The other half. When the caller names the year themselves there is nothing
  //   to narrow, so the refusal has to arrive as a `ToolInputError` — arguments
  //   the caller can fix — rather than as an engine `RangeError` escaping the
  //   tool boundary. The engine's message was already right; what it was not was
  //   catchable as bad input.
  const widest = Math.max(...SUPPORTED_YEARS);
  let refused = 0;
  for (const state of SUPPORTED_STATES) {
    if (!supportedStateYears(state).includes(widest)) continue;
    if (localTaxYears(state).includes(widest)) continue;
    for (const extra of localArgsFor(state)) {
      assert.throws(
        () => findTool('state_income_tax').run({ ...RETURN, state, year: widest, ...extra }),
        (error) => {
          assert.equal(error.name, 'ToolInputError', `${state}: ${error.name} escaped the tool`);
          //   The message has to carry three things a model can act on: the
          //   years that DO work, the state's own wider list, and which argument
          //   to drop.
          assert.match(error.message, new RegExp(String(localTaxYears(state)[0])));
          assert.match(error.message, new RegExp(String(widest)));
          assert.match(error.message, /`(locality|county|city|schoolDistrict|yonkersNonresidentEarnings)`/);
          refused += 1;
          return true;
        },
      );
    }
  }
  assert.ok(refused > 0, `no state serves ${widest} while its localities do not — gate is idle`);
});
