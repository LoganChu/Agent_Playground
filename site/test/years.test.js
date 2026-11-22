/**
 * THE YEARS THIS PAGE OFFERS MUST BE THE YEARS THE ENGINE SERVES.
 *
 * Day 85. `src/compute.js` carried `export const YEARS = [2026, 2025]` as a
 * literal. `us-state-tax` had served tax year 2027 since the day before — for
 * the nine states with no individual income tax, and from this release for
 * Indiana, Mississippi and Pennsylvania too — so **the only surface a person
 * can actually look at could not show the newest year the engine computes.**
 *
 * Nothing failed, and nothing could: a hardcoded list is never wrong about
 * itself. The engine's READMEs are checked against the engine by eleven
 * cross-package tools; this page had no such check, and it is the page
 * `DO-THIS.md` sends a human to.
 *
 * ## AND THE STATE LIST IS THE SAME DEFECT WITH A SOFTER FAILURE
 *
 * `allStates` mapped `SUPPORTED_STATES`, the full forty-two, for whatever year
 * was chosen. `forState` catches, so widening the year list alone would not have
 * crashed — it would have rendered **thirty rows reading "AL is supported but
 * tax year 2027 is not"**, sorted to the bottom of a page headlined "all 42
 * states at once". That is the quiet half of the cross-product defect Day 84
 * found sixteen loud instances of.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { TOTAL_STATES, YEARS, compute } from '../dist/src/compute.js';
import {
  SUPPORTED_STATES,
  SUPPORTED_YEARS,
  statesForYear,
} from '../dist/vendor/us-state-tax/index.js';
import { isPrimaryVerified } from '../dist/vendor/us-federal-tax/index.js';

test('the page offers exactly the years the engine serves, newest first', () => {
  assert.deepEqual([...YEARS], [...SUPPORTED_YEARS].sort((a, b) => b - a));
  assert.equal(YEARS[0], Math.max(...SUPPORTED_YEARS), 'the newest year must be offered first');
  assert.equal(TOTAL_STATES, SUPPORTED_STATES.length);
});

test('every offered year ranks exactly the states that serve it, and no error rows', () => {
  for (const year of YEARS) {
    const model = compute({ year, filingStatus: 'single', wages: '60000' });
    assert.equal(model.input.year, year, `${year} was not accepted by normalise`);
    assert.deepEqual(
      model.states.map((s) => s.state).sort(),
      [...statesForYear(year)].sort(),
      `${year} ranks a different set of states than the registry serves`,
    );
    // The assertion that would have caught the soft failure. An `error` row is
    // the engine's refusal rendered as a table row; the page must never contain
    // one, because the fix is to not ask rather than to display the refusal.
    assert.deepEqual(
      model.states.filter((s) => s.error).map((s) => `${s.state}: ${s.error}`),
      [],
      `${year} produced refusal rows in the ranking`,
    );
  }
});

test('a year the engine does not serve falls back to the newest one it does', () => {
  // The form is a dropdown, but the year also arrives from a shared URL, and a
  // link made before a year was retired must not produce a blank page.
  for (const raw of [2019, 2099, 'banana', undefined, null]) {
    const model = compute({ year: raw, filingStatus: 'single', wages: '60000' });
    assert.ok(
      SUPPORTED_YEARS.includes(model.input.year),
      `year ${String(raw)} resolved to ${model.input.year}, which the engine does not serve`,
    );
    assert.equal(model.input.year, YEARS[0]);
    assert.ok(model.states.length > 0);
  }
});

test('a year served by fewer than every state says so in the rendered page', () => {
  // The page's own title is "all 42 states at once". For any year the engine
  // serves only partly, the heading has to count and the prose has to explain,
  // or the page is quietly ranking a subset under a headline about forty-two. Asserted against the rendered markup rather than against
  // `app.js`'s source, so a refactor that drops the branch fails here.
  const partial = YEARS.filter((y) => statesForYear(y).length < SUPPORTED_STATES.length);
  const whole = YEARS.filter((y) => statesForYear(y).length === SUPPORTED_STATES.length);
  assert.ok(
    partial.length > 0 || whole.length === YEARS.length,
    'the year lists must partition',
  );

  const app = readApp();
  // The count in the heading, and the sentence under it, both conditional on
  // the same comparison — so neither can be shown for a complete year.
  assert.match(app, /model\.states\.length < TOTAL_STATES/);
  assert.match(app, /of \$\{TOTAL_STATES\} states/);
  assert.match(app, /have not published their/);
  assert.match(app, /refuses a year it does not hold rather than reusing the/);
});

/** The BUILT page script, so the assertion is about what a browser receives. */
function readApp() {
  return readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');
}

test('a year whose federal figures are provisional says so, and the earlier ones do not', () => {
  // Day 85. This page began offering tax year 2027 the same day, and the
  // federal 2027 figures are triangulated rather than transcribed — `irs.gov`
  // does not resolve from the machine this engine is built on. The engine has
  // exposed `isPrimaryVerified(year)` since it first shipped such a year and
  // nothing on this page read it, so the page would have handed a person
  // deciding where to retire a reconstruction with no label on it.
  for (const year of YEARS) {
    const model = compute({ year, filingStatus: 'single', wages: '60000' });
    assert.equal(
      model.federalProvisional,
      !isPrimaryVerified(year),
      `${year} disagrees with us-federal-tax about whether it is provisional`,
    );
  }
  // At least one of each, or this test is vacuous in whichever direction is
  // missing — and the direction that matters is the one with no example.
  const flags = YEARS.map((y) => compute({ year: y, filingStatus: 'single', wages: '60000' }).federalProvisional);
  assert.ok(flags.some((f) => f === false), 'no verified year to compare against');

  const app = readApp();
  assert.match(app, /model\.federalProvisional/);
  assert.match(app, /PROVISIONAL/);
  // The heading itself carries it, so the label survives a reader who does not
  // read the paragraph.
  assert.match(app, /provisional' : ''/);
});
