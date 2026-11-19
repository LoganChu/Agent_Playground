/**
 * EVERY YEAR A TOOL DESCRIPTION CLAIMS MUST BE A YEAR AN ENGINE SERVES.
 *
 * Day 85. `state_income_tax`'s description opened with *"for 2025 or 2026"*
 * from the day it was written, and the server's own `initialize` instructions
 * said it computed federal tax *"for tax years 2024, 2025 and 2026"*. Both were
 * wrong when this file was written: tax year 2027 shipped for the nine states
 * with no individual income tax one release earlier, and the federal package
 * shipped a provisional 2027 three releases before that.
 *
 * ## WHY NOTHING CAUGHT IT, AND WHY THAT IS THE WORST CASE AVAILABLE HERE
 *
 * Every other year claim on this server is computed — the `year` enum is
 * `[...STATE_YEARS]`, the refusal names `supportedYears(state)`, the default is
 * `latestYearFor(state)`. These two sentences were the only ones that were
 * prose, and prose does not fail.
 *
 * **An UNDER-claim in a tool description is invisible from the server side, by
 * construction.** An over-claim produces a refused call, which is at least an
 * event: Day 84's whole entry is about one. An under-claim produces NO call.
 * The model reads "2025 or 2026", never asks for 2027, and nothing on this side
 * can distinguish that from a world where nobody wanted 2027. There is no log
 * line for the question that was not asked.
 *
 * A tool description is not documentation; it is the entire contract a language
 * model has before it decides whether to call at all. So the rule this file
 * enforces is the same one `us-state-tax`'s README tests enforce on a page —
 * **a number in a sentence is a claim, and a claim is checked** — applied to
 * the sentences a model reads instead of the ones a person reads.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { TOOLS } from '../dist/tools.js';
import { handleMessage } from '../dist/protocol.js';
import {
  SUPPORTED_YEARS as FEDERAL_YEARS,
  PRIMARY_VERIFIED_YEARS,
} from '../dist/engine/index.js';
import {
  NO_INCOME_TAX_STATES,
  SUPPORTED_STATES,
  SUPPORTED_YEARS as STATE_YEARS,
  statesForYear,
  supportedYears as supportedStateYears,
} from '../dist/state-engine/index.js';

const stateTool = TOOLS.find((t) => t.name === 'state_income_tax');
const latest = Math.max(...STATE_YEARS);

/** Every four-digit year that looks like a tax year, in document order. */
const yearsIn = (text) => [...text.matchAll(/\b(20\d\d)\b/g)].map((m) => Number(m[1]));

test('the state tool description claims no year the state engine does not serve', () => {
  assert.ok(stateTool, 'state_income_tax is registered');
  const claimed = new Set(yearsIn(stateTool.description));
  for (const year of claimed) {
    assert.ok(
      STATE_YEARS.includes(year),
      `state_income_tax's description names ${year} and the engine serves ${STATE_YEARS.join(', ')}`,
    );
  }
  // And the other direction, which is the one that was broken: the newest year
  // the engine serves has to appear. This is the assertion that fails on
  // "2025 or 2026" after 2027 ships, and it is the only one that can, because
  // an unclaimed year produces no call and therefore no other symptom.
  assert.ok(
    claimed.has(latest),
    `the engine serves ${latest} and the description does not mention it — an under-claim is silent`,
  );
});

test('the year enum description explains its own count, and the explanation is derived', () => {
  const schema = stateTool.inputSchema.properties.year;
  assert.deepEqual([...schema.enum], [...STATE_YEARS]);

  const noTax = statesForYear(latest).filter((s) => NO_INCOME_TAX_STATES.includes(s)).length;
  const taxing = statesForYear(latest).length - noTax;

  // The count was derived and the clause beside it was a literal: it read
  // "N of 42 states serve 2027 — THE ONES WITH NO INDIVIDUAL INCOME TAX", which
  // stopped being true the day a taxing state served the latest year while the
  // number stayed right. A correct number with a false reason attached is worse
  // than a wrong number, because a model cannot check a reason.
  if (statesForYear(latest).length === SUPPORTED_STATES.length) {
    // Every state serves the newest year — there is nothing left to explain,
    // and in particular nothing that may be described as "already in statute".
    assert.match(schema.description, new RegExp(`All ${SUPPORTED_STATES.length} states serve ${latest}`));
    assert.doesNotMatch(schema.description, /already written into statute/);
    return;
  }
  assert.match(
    schema.description,
    new RegExp(`${statesForYear(latest).length} of ${SUPPORTED_STATES.length} states serve ${latest}`),
  );
  assert.match(schema.description, new RegExp(`${noTax} with no individual income tax`));

  // ## AND THE EXPLANATION MUST EXPIRE WITH THE CONDITION THAT MADE IT TRUE
  //
  // The clause "N whose whole computation for that year is already written into
  // statute" is true of Indiana, Mississippi and Pennsylvania and will be FALSE
  // of the thirty that publish between December and February — they will have
  // published, which is a different and stronger thing. It must therefore be
  // present exactly when there is a taxing state it describes, and absent when
  // there is not: with none, the first draft of this description read "and 0
  // whose whole computation...", which is where it sat yesterday and where it
  // returns the next time a year is added.
  if (taxing > 0) {
    assert.match(
      schema.description,
      new RegExp(`and ${taxing} whose whole computation for that year is already written into statute`),
      'taxing states serve the latest year and the description does not account for them',
    );
  } else {
    assert.doesNotMatch(
      schema.description,
      /whose whole computation/,
      'no taxing state serves the latest year, so the clause describing them must not be printed',
    );
  }
});

test('the server instructions name every federal year, and mark the unverified ones', async () => {
  const reply = await handleMessage({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } },
  });
  const instructions = reply.result.instructions;
  const opening = instructions.split('\n').slice(0, 2).join(' ');

  for (const year of FEDERAL_YEARS) {
    assert.ok(
      opening.includes(String(year)),
      `the engine computes federal ${year} and the instructions do not say so`,
    );
  }
  const provisional = FEDERAL_YEARS.filter((y) => !PRIMARY_VERIFIED_YEARS.includes(y));
  if (provisional.length > 0) {
    // Naming them is not enough. 2027's federal figures were triangulated from
    // secondary sources because `irs.gov` does not resolve from this sandbox,
    // and an instruction that lists 2027 beside three transcribed years invites
    // a model to treat them alike.
    assert.match(opening, /PROVISIONALLY/, 'a provisional federal year is listed as though verified');
    for (const year of provisional) {
      assert.ok(
        opening.indexOf('PROVISIONALLY') < opening.indexOf(String(year)),
        `${year} is provisional and is named before the word that says so`,
      );
    }
  }
});

test('no tool description names a tax year outside what the two engines serve', () => {
  // The general form, so that the next description written by hand is caught by
  // the class rather than by a test named after this one. Years that are not
  // tax years at all — a Revenue Procedure number, a statute's effective date,
  // a cohort cutoff like Kentucky's 1998 or North Carolina's Bailey 1989 — are
  // everywhere in these descriptions and are not claims about coverage, so the
  // gate is scoped to the sentence a year span is written in.
  const served = new Set([...FEDERAL_YEARS, ...STATE_YEARS]);
  const offenders = [];
  for (const tool of TOOLS) {
    for (const match of tool.description.matchAll(/for (?:tax years? )?(20\d\d)(?: (?:or|to|and|through) (20\d\d))?/g)) {
      for (const raw of [match[1], match[2]]) {
        if (raw === undefined) continue;
        const year = Number(raw);
        if (!served.has(year)) offenders.push(`${tool.name}: "${match[0]}" — no engine serves ${year}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test('list_supported_years answers for the states too, in both directions', () => {
  // Day 84's closing item 5: *"`list_supported_years` and `describe_state`
  // should say which states have which year ... `statesForYear` is shipped; the
  // tool that should return it is `list_supported_years`, which today answers
  // for the federal package only."*
  //
  // That was harmless while every state served every state year, and stopped
  // being harmless the hour the grid went non-square. A model that wants to
  // PLAN — can I answer this for 2027? — otherwise has to call a tool per state
  // and collect refusals one at a time, or build the cross product and be wrong
  // about thirty states.
  const tool = TOOLS.find((t) => t.name === 'list_supported_years');
  assert.ok(tool, 'list_supported_years is registered');
  const { text, structured } = tool.run({});

  // Both directions of the grid, because "what can I ask about 2027" and "what
  // can I ask about Indiana" are one lookup transposed and neither caller
  // should rebuild it.
  assert.deepEqual(structured.state.years, [...STATE_YEARS]);
  assert.deepEqual(structured.state.states, [...SUPPORTED_STATES]);
  for (const year of STATE_YEARS) {
    assert.deepEqual(
      structured.state.statesByYear[year],
      [...statesForYear(year)],
      `statesByYear disagrees with the registry for ${year}`,
    );
  }
  for (const state of SUPPORTED_STATES) {
    assert.deepEqual(
      structured.state.yearsByState[state],
      [...supportedStateYears(state)],
      `yearsByState disagrees with the registry for ${state}`,
    );
  }
  // The transpose has to be consistent with itself, which is the property a
  // caller actually relies on and which neither map proves alone.
  for (const year of STATE_YEARS) {
    for (const state of structured.state.statesByYear[year]) {
      assert.ok(
        structured.state.yearsByState[state].includes(year),
        `${state} is listed under ${year} but ${year} is not listed under ${state}`,
      );
    }
  }

  // And the text, because a model reads that and not the structured block in
  // most clients. Every year must be named, and any year not served by every
  // state must say which states are missing — a count alone sends the caller
  // back to guessing.
  assert.match(text, /State tax years:/);
  for (const year of STATE_YEARS) {
    assert.ok(text.includes(String(year)), `${year} is missing from the text`);
    if (statesForYear(year).length === SUPPORTED_STATES.length) continue;
    const missing = SUPPORTED_STATES.filter((s) => !statesForYear(year).includes(s));
    assert.match(text, new RegExp(`NOT yet served for ${year}`));
    for (const state of missing) {
      assert.ok(text.includes(state), `${state} lacks ${year} and the text does not say so`);
    }
  }
  // The locality years are a separate axis and a locality can lag its state.
  assert.match(text, /Local income taxes/);
  // NOT a locality COUNT: `SUPPORTED_LOCALITIES` holds two entries, the named
  // enum, while this package advertises 1,033 local income taxes reached through
  // `county`, `municipality` and `schoolDistrict`. "2 localities" would be a
  // number that is accurate about the wrong thing.
  assert.doesNotMatch(text, /Localities \(\d+ of them\)/);
});
