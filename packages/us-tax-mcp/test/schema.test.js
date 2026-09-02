/**
 * The schema, and the two ways it can quietly stop matching reality.
 *
 * 1. A property is advertised to the model but never read, so the model sends
 *    it and the server drops it. The estimate still computes; it is just wrong.
 * 2. The engine gains an input and this package never exposes it, so the tool
 *    silently cannot express a household it should be able to.
 *
 * Neither shows up as a failing arithmetic test. Both are caught here, the
 * second by reading the engine's own generated type declarations, so that the
 * day someone adds a field to `EstimateInput` this suite says so.
 */
import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { TOOLS, ToolInputError, readHousehold } from '../dist/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, '..');

const filingStatusTools = TOOLS.filter((tool) =>
  Object.hasOwn(tool.inputSchema.properties, 'filingStatus'),
).filter((tool) => tool.name !== 'get_tax_parameters');

// The tools built on the shared household schema, identified by a field only that
// schema has rather than by a list of the tools that are not.
//
// Two tools take a filing status and deliberately are NOT household tools.
// `paycheck_withholding` describes a paycheck: a pay period, a Form W-4 and a
// year-to-date, and none of the thirty household fields. `state_income_tax`
// describes a *federal result*, because a state return is a function of one — and
// advertising the household here would invite the model to describe the same
// household twice, to two tools, and get two different answers. Sharing the
// household schema in either would have added about 8 KB to every session's
// tools/list to advertise fields the tool cannot use.
//
// The exclusion used to be by name, which meant every new tool of this kind broke
// this test before it broke anything real. Membership is now a positive test on a
// field the household schema owns, so the theory maintains itself.
const householdTools = TOOLS.filter((tool) =>
  Object.hasOwn(tool.inputSchema.properties ?? {}, 'w2Wages'),
);

/** A plausible value for a property, from its declared JSON Schema type. */
function sampleFor(name, schema) {
  if (name === 'filingStatus') return 'single';
  if (name === 'year') return 2026;
  if (name === 'years') return [2024, 2026];
  if (name === 'incomeType') return 'wages';
  if (name === 'qualifiedBusinesses') return [{ qualifiedBusinessIncome: 1234 }];
  switch (schema.type) {
    case 'boolean':
      return true;
    case 'integer':
      return 3;
    case 'number':
      return 1234;
    case 'string':
      return schema.enum ? schema.enum[0] : 'x';
    case 'array':
      return [];
    default:
      return 1;
  }
}

test('every advertised household property is actually read', () => {
  const advertised = Object.keys(TOOLS.find((t) => t.name === 'estimate_federal_tax').inputSchema.properties);
  for (const name of advertised) {
    if (name === 'filingStatus') continue;
    const schema = TOOLS.find((t) => t.name === 'estimate_federal_tax').inputSchema.properties[name];
    const value = sampleFor(name, schema);
    const parsed = readHousehold({ filingStatus: 'single', [name]: value });
    assert.ok(
      Object.hasOwn(parsed, name),
      `${name} is advertised in the schema but readHousehold drops it`,
    );
  }
});

test('nothing is read that is not advertised', () => {
  const advertised = new Set(
    Object.keys(TOOLS.find((t) => t.name === 'estimate_federal_tax').inputSchema.properties),
  );
  const parsed = readHousehold({ filingStatus: 'single', w2Wages: 1 });
  for (const key of Object.keys(parsed)) {
    assert.ok(advertised.has(key), `readHousehold produced ${key}, which the schema never advertises`);
  }
});

test('an unadvertised argument is rejected by every tool that takes one', () => {
  // The base has to be otherwise valid for each tool, or the rejection could be
  // coming from a missing required field instead of from the unknown one.
  const base = {
    paycheck_withholding: { filingStatus: 'single', payPeriod: 'weekly', wagesThisPeriod: 1_000 },
    state_income_tax: {
      filingStatus: 'single',
      state: 'CA',
      federalAdjustedGrossIncome: 100_000,
      federalTaxableIncome: 84_250,
    },
  };
  for (const tool of filingStatusTools) {
    assert.throws(
      () => tool.run({ ...(base[tool.name] ?? { filingStatus: 'single' }), notAField: 1 }),
      /Unknown argument/,
      `${tool.name} accepted an unadvertised argument`,
    );
  }
});

test("the engine's EstimateInput has no field this server silently ignores", () => {
  // Read the generated declarations rather than a hand-kept list, so a new
  // engine input fails this test on the day it lands.
  const declaration = readFileSync(join(packageRoot, 'dist', 'engine', 'estimate.d.ts'), 'utf8');
  const block = /export interface EstimateInput \{([\s\S]*?)\n\}/.exec(declaration);
  assert.ok(block, 'could not find EstimateInput in the generated declarations');
  const fields = [...block[1].matchAll(/^\s{4}(\w+)\??:/gm)].map((match) => match[1]);
  assert.ok(fields.length > 20, `only found ${fields.length} fields; the parser is probably broken`);

  const advertised = new Set(
    Object.keys(TOOLS.find((t) => t.name === 'estimate_federal_tax').inputSchema.properties),
  );

  // Two engine inputs are deliberately not household properties: the quarterly
  // tool takes them as its own options, because they describe last year's
  // return rather than this year's household.
  const exposedElsewhere = new Set(['priorYearTotalTax', 'priorYearAdjustedGrossIncome']);
  for (const name of exposedElsewhere) {
    assert.ok(
      Object.hasOwn(
        TOOLS.find((t) => t.name === 'quarterly_estimated_payments').inputSchema.properties,
        name,
      ),
      `${name} is meant to live on quarterly_estimated_payments but does not`,
    );
  }

  const missing = fields.filter((name) => !advertised.has(name) && !exposedElsewhere.has(name));
  assert.deepEqual(
    missing,
    [],
    `EstimateInput fields not exposed by any tool: ${missing.join(', ')}`,
  );
});

test('every tool schema is a JSON Schema object with the shape MCP requires', () => {
  for (const tool of TOOLS) {
    assert.equal(tool.inputSchema.type, 'object', `${tool.name} inputSchema must be type: object`);
    assert.equal(
      tool.inputSchema.additionalProperties,
      false,
      `${tool.name} should reject unknown properties at the schema level too`,
    );
    for (const [name, schema] of Object.entries(tool.inputSchema.properties)) {
      assert.equal(
        typeof schema.description,
        'string',
        `${tool.name}.${name} has no description; the model reads these`,
      );
      assert.ok(schema.description.length > 10, `${tool.name}.${name} description is too short to help`);
      assert.ok(schema.type, `${tool.name}.${name} declares no type`);
    }
    assert.ok(tool.name.match(/^[a-z][a-z0-9_]*$/), `${tool.name} is not a snake_case tool name`);
    assert.ok(tool.description.length > 80, `${tool.name} description is too thin for tool selection`);
  }
});

test('the terse schemas keep every field, and only shorten the prose', () => {
  const full = TOOLS.find((t) => t.name === 'estimate_federal_tax').inputSchema.properties;
  for (const tool of householdTools) {
    if (tool.name === 'estimate_federal_tax') continue;
    for (const name of Object.keys(full)) {
      const terse = tool.inputSchema.properties[name];
      if (name === 'year' && !terse) {
        // A tool may legitimately not take a single year — compare_tax_years
        // takes `years` — but then it must not advertise `year` either, or the
        // model is invited to send a field the tool rejects.
        assert.ok(
          tool.inputSchema.properties.years,
          `${tool.name} advertises neither year nor years`,
        );
        continue;
      }
      assert.ok(terse, `${tool.name} is missing the household field ${name}`);
      assert.ok(
        full[name].description.startsWith(terse.description),
        `${tool.name}.${name} terse description is not a prefix of the full one`,
      );
      assert.equal(terse.type, full[name].type, `${tool.name}.${name} changed type`);
    }
  }
});

test('tools/list stays within a sane context budget', () => {
  // Every client pays for this in context on every session, so a regression
  // here is a real cost to every user. The number is a ceiling, not a target.
  const payload = JSON.stringify(
    TOOLS.map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations,
    })),
  );
  assert.ok(
    payload.length < 48_000,
    `tools/list is ${payload.length} bytes, which is more context than these ${TOOLS.length} tools are worth`,
  );
  // Recorded rather than merely asserted, because the headroom is the number that
  // decides what the next tool can be. Four of the eight carry the same thirty-field
  // household schema, which is about 36 KB of the total; MCP has no portable way to
  // share a schema between tools, so the ninth tool has to displace one of those or
  // the household schema has to lose fields.
  assert.ok(
    48_000 - payload.length < 1_000,
    `tools/list has ${48_000 - payload.length} bytes of headroom — more than expected, so ` +
      'this note about the budget is stale and should be rewritten with the real figure',
  );
});

test('a ToolInputError is what callers get for bad input, so it can be caught', () => {
  assert.throws(() => readHousehold({ filingStatus: 'nope' }), ToolInputError);
  assert.throws(() => readHousehold({ filingStatus: 'single', w2Wages: -1 }), ToolInputError);
  assert.throws(() => readHousehold('not an object'), ToolInputError);
});

// ---------------------------------------------------------------------------
// The vendored engine
// ---------------------------------------------------------------------------

function listFiles(root) {
  const found = [];
  const walk = (directory, prefix) => {
    for (const entry of readdirSync(directory).sort()) {
      const full = join(directory, entry);
      if (statSync(full).isDirectory()) walk(full, `${prefix}${entry}/`);
      else if (entry.endsWith('.ts')) found.push(`${prefix}${entry}`);
    }
  };
  walk(root, '');
  return found;
}

test('the vendored engine is byte-identical to packages/us-federal-tax/src', () => {
  // `scripts/sync-engine.mjs` regenerates this on every build, so the two
  // cannot drift — but if the sync ever silently stops running, this is what
  // notices, and shipping a stale copy of a tax engine is exactly the kind of
  // quiet wrongness this project exists to avoid.
  const vendored = resolve(packageRoot, 'src', 'engine');
  const upstream = resolve(packageRoot, '..', 'us-federal-tax', 'src');

  const vendoredFiles = listFiles(vendored);
  const upstreamFiles = listFiles(upstream);
  assert.deepEqual(vendoredFiles, upstreamFiles, 'the vendored engine has a different file list');
  assert.ok(vendoredFiles.includes('index.ts'));
  assert.ok(vendoredFiles.includes('data/2026.ts'));

  for (const file of upstreamFiles) {
    assert.equal(
      readFileSync(join(vendored, file), 'utf8'),
      readFileSync(join(upstream, file), 'utf8'),
      `${file} differs between the vendored copy and the engine`,
    );
  }
});

test('the published package has no runtime dependencies', () => {
  // An MCP server is spawned once per session, usually through `npx -y`. Every
  // dependency is startup latency the user pays every time, and a supply chain
  // they did not ask for.
  const pkg = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.dependencies, undefined, 'us-tax-mcp must stay dependency-free');
  assert.equal(pkg.peerDependencies, undefined);
  assert.equal(pkg.bin['us-tax-mcp'], './dist/cli.js');
});
