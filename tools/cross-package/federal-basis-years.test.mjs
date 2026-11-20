/**
 * VERIFIED BY REINTRODUCTION, BECAUSE ON TODAY'S TREE THE MAIN ASSERTION CANNOT
 * FIRE.
 *
 * `federal-basis-years.mjs` asserts that no state-year reading a federal figure
 * may claim `status: 'published'` while the federal year it borrows is
 * unverified. No state serves 2027 yet and every shipped state-year borrows a
 * verified federal year, so the check passes over thirteen rows and zero of them
 * can test it. A gate in that condition is a claim, which is Day 84's finding
 * about the registry's own "support is per state AND per year" — decorative for
 * as long as the grid stayed square.
 *
 * So every assertion here drives the pure function with fixtures and watches it
 * go red, and then watches each near-miss stay green.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  auditFederalBasisYears,
  federalDependency,
  federalKeys,
  CLASSIFIED_AS_DEPENDENCY,
  UNMODELLED_FEDERAL_KEYS,
  FEDERAL_BASE,
  FEDERAL_DEDUCTION,
  FEDERAL_TAX,
} from './federal-basis-years.mjs';

const stateDefined = { base: 'stateDefined', deduction: { kind: 'table' }, status: 'published' };
const takesFederal = { base: 'federalAdjustedGrossIncome', deduction: { kind: 'federal' }, status: 'published' };
const federalBase = { base: 'federalTaxableIncome', deduction: { kind: 'none' }, status: 'published' };
const deductsFederalTax = {
  base: 'stateDefined',
  deduction: { kind: 'table' },
  federalIncomeTaxDeduction: { name: 'federal income tax paid' },
  status: 'published',
};

const run = (defs, { verified = [2025, 2026], federalYears = [2025, 2026, 2027] } = {}) =>
  auditFederalBasisYears({
    stateYears: Object.keys(defs).map((k) => k.split(':')).map(([s, y]) => [s, Number(y)]),
    getDef: (s, y) => defs[`${s}:${y}`],
    isPrimaryVerified: (y) => verified.includes(y),
    federalYears,
  });

test('the two dependencies are told apart, and a state with its own deduction has neither', () => {
  assert.equal(federalDependency(takesFederal), FEDERAL_DEDUCTION);
  assert.equal(federalDependency(federalBase), FEDERAL_BASE);
  assert.equal(federalDependency(stateDefined), null);
  // A state that has no `deduction` key at all must not throw.
  assert.equal(federalDependency({ base: 'stateDefined', status: 'published' }), null);
});

test('a state with its own deduction is not a dependent at all, in any year', () => {
  const { dependents, failures } = run({ 'VA:2027': stateDefined });
  assert.deepEqual(dependents, []);
  assert.deepEqual(failures, []);
});

test('a federal-reading state in a VERIFIED federal year is fine, which is today', () => {
  const { dependents, failures } = run({ 'IA:2026': takesFederal, 'CO:2026': federalBase });
  assert.equal(dependents.length, 2);
  assert.deepEqual(failures, []);
});

test("THE DEFECT: Iowa publishes 2027 off a federal 2027 nobody read", () => {
  const { failures } = run({ 'IA:2027': takesFederal });
  assert.equal(failures.length, 1);
  assert.match(failures[0], /IA 2027 takes the federal standard deduction whole/);
  assert.match(failures[0], /NOT verified/);
  assert.match(failures[0], /still says status: 'published'/);
  assert.match(failures[0], /provisionalFigures entry naming the federal dependency/);
});

test('and the same defect through the other door — a federal taxable-income base', () => {
  const { failures } = run({ 'CO:2027': federalBase });
  assert.equal(failures.length, 1);
  assert.match(failures[0], /CO 2027 starts from federal taxable income/);
});

test('disclosing it is the fix, and the gate accepts the fix', () => {
  const { dependents, failures } = run({ 'IA:2027': { ...takesFederal, status: 'provisional' } });
  assert.deepEqual(failures, []);
  assert.equal(dependents.length, 1);
  assert.equal(dependents[0].verified, false, 'still reported as a dependent on an unverified year');
  assert.equal(dependents[0].status, 'provisional');
});

test('a state-year borrowing a federal year that does not exist is a crash, reported as one', () => {
  const { failures } = run({ 'IA:2028': takesFederal }, { federalYears: [2025, 2026, 2027] });
  assert.equal(failures.length, 1);
  assert.match(failures[0], /does not serve 2028 at all/);
  assert.match(failures[0], /crash, not a wrong figure/);
});

test('the missing-year failure is reported INSTEAD of the disclosure one, not as well', () => {
  // Both conditions hold for IA 2028 — unverified and absent — and reporting
  // two failures for one row would make the count useless as a measurement.
  const { failures } = run({ 'IA:2028': takesFederal }, { verified: [2025], federalYears: [2025] });
  assert.equal(failures.length, 1);
});

test('the day www.irs.gov is reachable, every one of the six is free to publish', () => {
  // The whole point of DO-THIS.md item 0, as an assertion: the same tree that
  // fails above passes with nothing changed except the federal year's provenance.
  const defs = { 'IA:2027': takesFederal, 'CO:2027': federalBase, 'NM:2027': takesFederal };
  assert.equal(run(defs).failures.length, 3);
  assert.equal(run(defs, { verified: [2025, 2026, 2027] }).failures.length, 0);
});


test('DAY 86, THE GAP IN MY OWN FIRST VERSION: deducting the federal TAX is a dependency', () => {
  // Alabama, Missouri and Oregon deduct federal income tax paid. This check
  // shipped with two tests, both about the standard deduction, and reported six
  // states instead of eight. The hole was found by asking about Alabama, not by
  // re-reading the check.
  assert.equal(federalDependency(deductsFederalTax), FEDERAL_TAX);
  const { dependents, failures } = run({ 'AL:2026': deductsFederalTax });
  assert.equal(dependents.length, 1);
  assert.equal(dependents[0].why, FEDERAL_TAX);
  assert.deepEqual(failures, []);
});

test('and a state that deducts the federal tax may not publish an unverified year', () => {
  const { failures } = run({ 'AL:2027': deductsFederalTax });
  assert.equal(failures.length, 1);
  assert.match(failures[0], /borrows the whole federal answer/);
});

test('the deepest dependency wins when a state has two, so the reason is the binding one', () => {
  // Missouri takes the federal standard deduction AND deducts federal tax paid.
  // Reporting the shallower reason would understate what settles it.
  const both = { ...deductsFederalTax, deduction: { kind: 'federal' } };
  assert.equal(federalDependency(both), FEDERAL_TAX);
});

test('THE GENERALISATION: an unclassified federal-named field is red, not ignored', () => {
  const novel = { base: 'stateDefined', deduction: { kind: 'table' }, status: 'published', federalBonusDepreciationAddback: 0.5 };
  const { failures, unclassified } = run({ 'XX:2026': novel });
  assert.deepEqual(unclassified, ['federalBonusDepreciationAddback']);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /nothing in[\s\S]*says whether it makes/);
  assert.match(failures[0], /Classify it/);
});

test('a field declared as a non-dependency is accepted silently, with its reason on file', () => {
  const conforming = { base: 'stateDefined', deduction: { kind: 'table' }, status: 'published', federalConformity: { kind: 'rolling' } };
  const { failures, unclassified } = run({ 'XX:2026': conforming });
  assert.deepEqual(unclassified, []);
  assert.deepEqual(failures, []);
  assert.ok(UNMODELLED_FEDERAL_KEYS.federalConformity.length > 0, 'and the reason is written down');
});

test('every declared non-dependency has a reason, and none of them is also a dependency', () => {
  for (const [key, reason] of Object.entries(UNMODELLED_FEDERAL_KEYS)) {
    assert.equal(typeof reason, 'string');
    assert.ok(reason.length > 10, `${key}'s reason is too short to be one`);
    assert.ok(!CLASSIFIED_AS_DEPENDENCY.includes(key), `${key} is on both lists`);
  }
});

test('federal-named keys are found at any depth, and prose is not scanned', () => {
  const nested = { a: { b: [{ federalThing: 1 }] }, notes: ['this note mentions a federalWidget'], citations: [{ federalCite: 1 }] };
  assert.deepEqual([...federalKeys(nested)], ['federalThing'], 'notes and citations are prose, not fields');
});
