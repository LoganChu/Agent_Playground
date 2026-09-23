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

import { TOOLS, ToolInputError, readHousehold, handleMessage } from '../dist/index.js';
import { HOUSEHOLD_KEYS } from '../dist/schema.js';

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
      assert.ok(schema.type, `${tool.name}.${name} declares no type`);
      // A shared household field may be undescribed on a tool that cross-references
      // `estimate_federal_tax` for it — see `referenceProperties`. A field the tool
      // does not share is its own to explain, and always must.
      if (schema.description === undefined && HOUSEHOLD_KEYS.includes(name)) continue;
      assert.equal(
        typeof schema.description,
        'string',
        `${tool.name}.${name} has no description; the model reads these`,
      );
      assert.ok(schema.description.length > 10, `${tool.name}.${name} description is too short to help`);
    }
    assert.ok(tool.name.match(/^[a-z][a-z0-9_]*$/), `${tool.name} is not a snake_case tool name`);
    assert.ok(tool.description.length > 80, `${tool.name} description is too thin for tool selection`);
  }
});

test('a cross-referencing tool keeps every field and every type, and drops only prose', () => {
  const primary = TOOLS.find((t) => t.name === 'estimate_federal_tax');
  const full = primary.inputSchema.properties;
  for (const tool of householdTools) {
    if (tool.name === 'estimate_federal_tax') continue;
    // All or nothing. A schema where some shared fields are documented and
    // others are silently not is the worst of both: the model cannot tell
    // whether an undescribed field is undocumented or unimportant.
    // `year` is excluded: it is the one shared field whose meaning is
    // tool-specific — compare_tax_years refuses it outright — so it keeps its
    // description at every verbosity and cannot stand for the rest.
    const shared = Object.keys(full).filter(
      (name) => name !== 'year' && tool.inputSchema.properties[name],
    );
    const described = shared.filter(
      (name) => tool.inputSchema.properties[name].description !== undefined,
    );
    const isReference = described.length === 0;
    assert.ok(
      isReference || described.length === shared.length,
      `${tool.name} documents ${described.length} of ${shared.length} shared fields; it must do all or none`,
    );
    if (isReference) {
      // Then the tool's own description has to send the model somewhere, or the
      // fields are simply undocumented.
      assert.ok(
        tool.description.includes('estimate_federal_tax'),
        `${tool.name} drops the shared descriptions without naming where they live`,
      );
    }

    for (const name of Object.keys(full)) {
      const shortened = tool.inputSchema.properties[name];
      if (name === 'year' && !shortened) {
        // A tool may legitimately not take a single year — compare_tax_years
        // takes `years` — but then it must not advertise `year` either, or the
        // model is invited to send a field the tool rejects.
        assert.ok(
          tool.inputSchema.properties.years,
          `${tool.name} advertises neither year nor years`,
        );
        continue;
      }
      assert.ok(shortened, `${tool.name} is missing the household field ${name}`);
      // Dropping the prose must never drop the validation. Type, enum and the
      // nested item shape are what a client needs to make a legal call, and the
      // model can still discover the meaning from the primary tool.
      assert.equal(shortened.type, full[name].type, `${tool.name}.${name} changed type`);
      assert.deepEqual(shortened.enum, full[name].enum, `${tool.name}.${name} changed its enum`);
      if (full[name].items?.properties) {
        assert.deepEqual(
          Object.keys(shortened.items.properties),
          Object.keys(full[name].items.properties),
          `${tool.name}.${name} lost item properties`,
        );
      }
      if (shortened.description === undefined) continue;

      const long = full[name].description;
      if (!long.startsWith(shortened.description)) {
        // Not a prefix, so it is an AUTHORED short form. Those exist because the
        // derived trim keeps the first sentence and cannot tell an example from a
        // definition — see `withShortForm` in src/schema.ts. An authored form is
        // allowed to rewrite, but not to invent: it must be shorter, and every
        // statute it cites and every dollar figure it quotes must appear in the
        // long description too, so the two cannot drift into disagreeing.
        assert.ok(
          shortened.description.length < long.length,
          `${tool.name}.${name} authored short form is not shorter than the full one`,
        );
        const claims = shortened.description.match(/\u00a7 \d+[\w().]*|\$[\d,]+/g) ?? [];
        for (const claim of claims) {
          assert.ok(
            long.includes(claim),
            `${tool.name}.${name} short form cites ${claim}, which the full description does not`,
          );
        }
      }
    }
  }
});

test('the primary tool documents every shared field in full', () => {
  // The cross-reference above is only honest if the place it points at is
  // complete. Every household field must be described on `estimate_federal_tax`,
  // because three other tools now have nothing else to offer a model.
  const full = TOOLS.find((t) => t.name === 'estimate_federal_tax').inputSchema.properties;
  for (const name of HOUSEHOLD_KEYS) {
    if (name === 'year') continue;
    assert.ok(full[name], `estimate_federal_tax is missing the household field ${name}`);
    assert.equal(
      typeof full[name].description,
      'string',
      `estimate_federal_tax.${name} is undescribed, and three tools point here for it`,
    );
    assert.ok(
      full[name].description.length > 30,
      `estimate_federal_tax.${name} is the only description of this field and it is too thin`,
    );
  }
});

test('the authoring key never reaches a client', () => {
  // `x-terse` is how this codebase records a hand-written short form. It is a
  // property of the source, not of the JSON Schema a client receives, and a
  // client that saw it would be paying context for a field it cannot use.
  const payload = JSON.stringify(TOOLS.map((tool) => tool.inputSchema));
  assert.ok(!payload.includes('x-terse'), 'the authoring key leaked into tools/list');
  // And the full schema keeps the long description, not the short one.
  const full = TOOLS.find((t) => t.name === 'estimate_federal_tax').inputSchema.properties;
  assert.ok(
    full.qualifiedOvertimeCompensation.description.includes('not total overtime wages'),
    'the full schema lost the clause the short form exists to protect',
  );
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
    payload.length < 40_000,
    `tools/list is ${payload.length} bytes, which is more context than these ${TOOLS.length} tools are worth`,
  );

  // THE FOURTEENTH PASS CUT THE CEILING AGAIN — 45,000 to 40,000, at 38,707 —
  // and it did the structural fix Day 18, 19, 20 and 21 all named and all
  // deferred. It was not deferrable a fifth time: Utah's three retirement
  // credits took the payload to 44,945 of 45,000, and the ceiling stopped being
  // a warning and became a wall. The next state could not have been added.
  //
  // `state_income_tax` went from 16,500 bytes to 8,710 by moving every
  // per-state field's PROSE into a second tool, `describe_state`, and keeping
  // in the schema only what a client needs to make a legal call: the field, its
  // type, and the states it belongs to. A caller who names Ohio now reads
  // Ohio's fields; a caller who names nothing reads none of them.
  //
  // THIS IS DAY 21'S POINTER RULE WITH THE MISSING PIECE SUPPLIED. That rule —
  // a pointer and a copy do the same job, and only one costs anything — could
  // not reach this tool, because the three tools it fixed could point at
  // `estimate_federal_tax` and `state_income_tax` had nothing to point at. The
  // step it did not take is that A TOOL WITH NOTHING TO POINT AT CAN BE GIVEN
  // SOMETHING: the pointer is only unavailable if you assume the set of tools
  // is fixed. `describe_state` costs 1,561 bytes in the payload and carries
  // 26,000 bytes of documentation that nobody who does not ask for it pays for.
  //
  // What that trades away, and the tests that hold it: a field's state list now
  // appears in a table (`src/state-fields.ts`) rather than twice, once in prose
  // a model reads and once in the validation that refuses the call. Those two
  // copies had already drifted — `county` was ACCEPTED by Alaska and silently
  // ignored, because a state with no income tax has no county tax to be wrong
  // about and nothing objected. `test/state-fields.test.js` now offers every
  // field to a state the table excludes and requires the refusal, and offers it
  // to every state the table includes and requires acceptance. The second
  // direction caught a second error on its first run: `earnedIncome` was
  // documented for CA and GA and is REQUIRED by Ohio's 68 earned-income school
  // districts.
  //
  // THE FIFTEENTH PASS WAS NINE BYTES A FIELD, and it is here because the
  // ceiling stopped a correctness fix. Pennsylvania needs two fields it did not
  // have — there is no separate-return tax-forgiveness table, so a married
  // claimant filing separately takes the $13,000 allowance against the JOINT
  // eligibility income, and the spouse's figure is on no line of that return —
  // and adding them took the payload to 40,101 against a 40,000 ceiling.
  //
  // A context budget that blocks a correctness fix has stopped being a budget
  // and become a bug. The ceiling held anyway, because the alternative was
  // available: the pointer every per-state field carries was
  // "describe_state documents it." and is now "See describe_state.", which is
  // nine bytes times forty fields. Two tests require the pointer to be there and
  // both are right to — a model reading one property in isolation has to be told
  // where the rest is — so this is not Day 21's rule again; it is the smaller
  // observation that a sentence repeated forty times should be the shortest one
  // that does the job.
  //
  // Where the remaining 39,741 bytes are:
  //
  //   estimate_federal_tax  10,359   the primary schema — load-bearing for four
  //                                  tools, so it must NOT be trimmed
  //   state_income_tax       8,710   was 16,500; now the shared fields plus one
  //                                  pointer per per-state field
  //   paycheck_withholding   4,634   its own field set; shares nothing
  //   the three reference tools     11,310 combined
  //   describe_state         1,561   the pointer's target
  //
  // There is no obvious fifteenth pass, and that is the honest report. Two
  // structural moves have now been made and each was worth more than every
  // compression before it; what is left is four schemas that describe fields a
  // caller genuinely has to choose between. The next real saving would come
  // from splitting `estimate_federal_tax` the same way, and it should NOT be
  // done on the strength of this one: that tool is the entry point, its fields
  // are not per-jurisdiction, and a model that has to look up a field before
  // using it will guess instead.
  //
  // The twelfth pass's finding stands and should not be re-derived: `"minimum":0`
  // appeared 164 times for 1,968 bytes, restating what the field names already
  // said, and `readNumber` was the thing actually enforcing it. A schema
  // constraint that restates the field's own name is paid once per field per
  // tool and informs nothing.
});

test('the server, not the schema, is what rejects a negative money field', () => {
  // The twelfth compression pass took `minimum: 0` out of 164 properties on the
  // strength of this. If it ever stops holding, the constraint has to go back in
  // and the 1,968 bytes with it.
  const reply = handleMessage({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'estimate_federal_tax',
      arguments: { filingStatus: 'single', year: 2026, w2Wages: -1 },
    },
  });
  const text = JSON.stringify(reply);
  assert.match(text, /must not be negative/, 'the server must reject a negative money field');
  assert.match(text, /w2Wages/, 'and it must name the field that was wrong');

  // And the other half of why the schema was the looser document: a numeric
  // string is accepted, which a strict `minimum: 0` validator would have
  // rejected before the server ever saw it.
  const coerced = handleMessage({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'estimate_federal_tax',
      arguments: { filingStatus: 'single', year: 2026, w2Wages: '85,000' },
    },
  });
  assert.ok(!coerced.result?.isError, '"85,000" must still be accepted');
});

test('the terse household schema trims nested item descriptions, not just the surface', () => {
  const full = TOOLS.find((t) => t.name === 'estimate_federal_tax').inputSchema.properties;
  const terse = TOOLS.find((t) => t.name === 'compare_tax_years').inputSchema.properties;
  // Same fields, so a caller loses nothing but prose.
  assert.deepEqual(
    Object.keys(terse.qualifiedBusinesses.items.properties),
    Object.keys(full.qualifiedBusinesses.items.properties),
  );
  const sizeOf = (props) => JSON.stringify(props.qualifiedBusinesses).length;
  assert.ok(
    sizeOf(terse) < sizeOf(full) - 500,
    `the terse qualifiedBusinesses schema is ${sizeOf(terse)} bytes against ${sizeOf(full)}; ` +
      'the nested item descriptions are not being trimmed',
  );
  // Every trimmed description is still a complete sentence ending in a full stop.
  for (const schema of Object.values(terse.qualifiedBusinesses.items.properties)) {
    if (typeof schema.description === 'string') {
      assert.match(schema.description, /[.!?]$/, schema.description);
    }
  }
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
