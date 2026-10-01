/**
 * How a provenance answer prints the figure it is about.
 *
 * `figure_provenance` is the only tool that reaches EVERY numeric leaf of the
 * parameters rather than a known set of them, so it cannot know from the call
 * whether the number it was handed is dollars. Its first version ran every
 * figure through `money()`, and so reported a California bracket rate of 0.08
 * as **$0.08** — eight cents, for a figure that means eight per cent — in the
 * state branch AND in the federal one, where it had been doing it since the
 * tool was built on Day 36.
 *
 * Day 35's rule: a rule's NAME travels in the result, so a number printed in
 * one is a claim. A unit is part of a number.
 *
 * The sweep below is the assertion that matters, and it works because of one
 * fact about both packages rather than because of a list: **no dollar amount
 * anywhere in either engine lies strictly between zero and one.** So a figure
 * that renders as a sub-dollar money amount is a misclassified proportion, and
 * the check needs no allowlist to maintain.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { figureValue } from '../dist/format.js';
import { YEARS } from '../dist/engine/core.js';
import {
  SUPPORTED_STATES,
  getStateDefinition,
  supportedYears,
} from '../dist/state-engine/index.js';

/** Every numeric leaf of an object, as [path, value]. */
function leaves(node, path, out) {
  if (node === null || node === undefined) return out;
  if (typeof node === 'number') {
    out.push([path, node]);
    return out;
  }
  if (Array.isArray(node)) {
    node.forEach((value, index) => leaves(value, `${path}.${index}`, out));
    return out;
  }
  if (typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (path === '' && (key === 'citations' || key === 'sources' || key === 'provisionalFigures')) continue;
      leaves(value, path === '' ? key : `${path}.${key}`, out);
    }
  }
  return out;
}

/** Every figure in both engines, federal and state, across every year. */
function everyFigure() {
  const out = [];
  for (const [year, params] of Object.entries(YEARS)) {
    for (const [path, value] of leaves(params, '', [])) out.push([`federal ${year}`, path, value]);
  }
  for (const state of SUPPORTED_STATES) {
    for (const year of supportedYears(state)) {
      const definition = getStateDefinition(state, year);
      for (const [path, value] of leaves(definition, '', [])) out.push([`${state} ${year}`, path, value]);
    }
  }
  return out;
}

test('no figure in either engine prints as a sub-dollar money amount', () => {
  const wrong = [];
  const all = everyFigure();
  // The number the READMEs quote, measured here rather than remembered: 799
  // federal figures over three years and 2,293 state figures over 56
  // state-years. `year` is counted in both, which is why the federal total is
  // 799 and not the 796 the provenance ledger covers.
  assert.ok(all.length > 3_000, `only ${all.length} figures swept`);
  for (const [where, path, value] of all) {
    const rendered = figureValue(path, value);
    if (/^-?\$0\.(?!00$)\d\d$/.test(rendered)) wrong.push(`${where} ${path} = ${value} printed as ${rendered}`);
  }
  assert.deepEqual(
    wrong.slice(0, 20),
    [],
    `${wrong.length} figures printed as cents. No dollar amount in either engine is between $0 and $1, ` +
      'so each of these is a proportion being reported as money.',
  );
});

test('every figure whose path names a rate prints as a percentage', () => {
  let checked = 0;
  for (const [where, path, value] of everyFigure()) {
    if (!/\.rate$|^rate$|Rate$/.test(path)) continue;
    checked += 1;
    assert.match(
      figureValue(path, value),
      /%$/,
      `${where} ${path} = ${value} should print as a percentage`,
    );
  }
  assert.ok(checked > 100, `only ${checked} rate figures found`);
});

test('every bracket ceiling or amount of a dollar or more prints as money', () => {
  // "or more" because `CreditStep.amount` is NOT always dollars: Ohio's joint
  // filing credit stores its 20% / 15% / 10% / 5% shares in the same field six
  // other charts use for a dollar amount. The magnitude rule gets that right
  // without being told, which is the argument for leaning on magnitude rather
  // than on a list of field names — and this assertion has to allow for it or
  // it would be asserting the bug.
  let checked = 0;
  for (const [where, path, value] of everyFigure()) {
    if (!/\.upTo$|\.amount$/.test(path)) continue;
    if (!Number.isFinite(value)) continue;
    if (value !== 0 && Math.abs(value) < 1) continue;
    checked += 1;
    assert.match(
      figureValue(path, value),
      /^-?\$/,
      `${where} ${path} = ${value} should print as money`,
    );
  }
  assert.ok(checked > 400, `only ${checked} ceiling and amount figures found`);
});

test('the specimens that made this file necessary', () => {
  // A proportion below 1, a proportion at 1, and a proportion above 1 — the
  // three magnitudes a naive money formatter gets wrong in three ways.
  assert.equal(figureValue('rate.byStatus.single.4.rate', 0.08), '8.00%');
  assert.equal(figureValue('retirementExclusion.tiers.0.jointPercentage', 1), '100.00%');
  assert.equal(figureValue('zeroTaxThreshold.limitedIncomeCredit.ceilingMultiple', 1.75), '175.00%');
  // Counts, ages and years, none of which is money.
  assert.equal(figureValue('exclusiveRetirementCredits.retirement.bornOnOrBefore', 1952), '1952');
  assert.equal(figureValue('exemption.seniorAge', 65), '65');
  assert.equal(figureValue('exemption.filersClaimed.marriedFilingJointly', 2), '2');
  assert.equal(figureValue('outOfStateMunicipalInterestAddition.acquiredAfterYear', 2011), '2011');
  // And money, which is most of them.
  assert.equal(figureValue('deduction.amounts.single', 3_350), '$3,350.00');
  assert.equal(figureValue('rate.byStatus.single.4.upTo', 72_724), '$72,724.00');
  // A zero rate is 0%, and a zero amount is $0.00 — the same number, two units.
  assert.equal(figureValue('rate.bands.0.rate', 0), '0.00%');
  assert.equal(figureValue('exemption.perExemptionSteps.single.3.amount', 0), '$0.00');
});
