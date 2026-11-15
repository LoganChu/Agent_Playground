// The condition classifier, on sentences written out by hand.
//
// ## Why this file and not just the tool's own green
//
// `tools/note-conditions.mjs` runs 66,528 returns and prints a defect list. A
// defect list's expensive failure is the one that INVENTS — `tools/cliffs/
// classify.mjs` got that wrong four times in a row, 555 notches then 187 then
// 52 then 46 — and a tool that reports nothing today looks identical to a tool
// whose classifier has stopped working. The tool cannot test itself on prose it
// does not have, so every sentence that has ever fooled a version of this
// classifier is written out here.
//
// All five of the rejection cases below are REAL SENTENCES from this package
// that an earlier version of the classifier reported as findings.
import test from 'node:test';
import assert from 'node:assert/strict';
import { claimsIn, sentences, PROBED_FIELDS, WINDOW } from './note-conditions.mjs';

const FIELDS = ['stateItemizedDeductions', 'retirementIncome', 'dependents', 'earnedIncome', 'federalPovertyGuideline'];

test('the two conditions this instrument was built for are classified', () => {
  const virginia =
    'This package applies the compulsion when stateItemizedDeductions is supplied and falls ' +
    'back to the standard deduction, with this note, when it is not.';
  const [claim] = claimsIn(virginia, FIELDS);
  assert.equal(claim.field, 'stateItemizedDeductions');
  assert.equal(claim.claim, 'supplied');

  const positive =
    'The compulsion applies where `stateItemizedDeductions` is positive, and not merely where ' +
    'it was supplied.';
  // `was supplied` is NOT in the affirmative vocabulary — only the present
  // tense is — so this sentence states one condition and is classified as one.
  assert.equal(claimsIn(positive, FIELDS)[0].claim, 'positive');

  // Both vocabularies in one sentence is what `both` is for: a sentence that
  // states two conditions states neither unambiguously, and the tool's verdict
  // for it is `ambiguous` rather than a finding.
  const two = 'It applies when `stateItemizedDeductions` is supplied and is positive.';
  assert.equal(claimsIn(two, FIELDS)[0].claim, 'both');
});

test('a condition far from the field name is not a condition on that field', () => {
  // Iowa, `states/iowa.ts`. `retirementIncome` and "is passed" are in one
  // sentence 190 characters apart, and the condition is about `retirement.spouse`.
  const iowa =
    'It is claimed PER PERSON on the recipient\'s own income, so pass `retirement.filer` and ' +
    '`retirement.spouse` separately; a single `retirementIncome` figure is attributed entirely ' +
    'to the filer by the household fallback, and a 53-year-old filer with a 57-year-old spouse ' +
    'excludes nothing unless the income is passed in the spouse\'s name.';
  assert.deepEqual(claimsIn(iowa, FIELDS), []);
});

test('a common verb beside a field name is not a condition', () => {
  // Kentucky, `states/flat-states.ts`. "is given dependents" is a sentence
  // about what the package receives, not a condition on whether it was.
  const kentucky =
    "KRS 141.066(1)(d) counts the taxpayer, the spouse and the taxpayer's QUALIFYING CHILDREN; " +
    'this package is given `dependents` and nothing finer, so a dependent parent counts here ' +
    'and does not count in Kentucky.';
  assert.deepEqual(claimsIn(kentucky, FIELDS), []);
});

test('a NEGATED supply phrase is not evidence about the supplied branch', () => {
  // The engine's own omission note. "X was not supplied, so it was computed as
  // zero" describes the ABSENT branch, which both readings share — reading it
  // as a claim that the engine distinguishes a supplied zero is backwards, and
  // it reported California disagreeing with a note that agreed with it.
  const generated =
    "California's CalEITC is computed on earned income, and earnedIncome was not supplied, so " +
    'it was computed as zero.';
  assert.deepEqual(claimsIn(generated, FIELDS), []);
});

test('the window is a window and both sides of it are checked', () => {
  const near = `pass ${'x'.repeat(0)}earnedIncome${' '.repeat(WINDOW - 12)} is supplied`;
  assert.equal(claimsIn(near, FIELDS).length, 1);
  const far = `pass earnedIncome${' '.repeat(WINDOW + 20)} is supplied`;
  assert.equal(claimsIn(far, FIELDS).length, 0);
  // Before as well as after: "when supplied, earnedIncome is read" is the same
  // claim with the clause the other way round.
  const before = 'when supplied, earnedIncome is read as the Ohio municipal base';
  assert.equal(claimsIn(before, FIELDS).length, 1);
});

test('backticks around a field name do not hide it', () => {
  const ticked = 'This package applies the compulsion when `stateItemizedDeductions` is supplied.';
  assert.equal(claimsIn(ticked, FIELDS)[0]?.field, 'stateItemizedDeductions');
});

test('sentence splitting keeps a statute cite and a figure whole', () => {
  const note =
    '§ 58.1-322.03(1)(a) compels a filer who itemized federally to itemize here too. The two ' +
    'answers were $503.12 apart across a cent. 2026 is unchanged.';
  const parts = sentences(note);
  assert.equal(parts.length, 3);
  assert.ok(parts[0].includes('58.1-322.03(1)(a)'), 'the cite is not split at its dots');
  assert.ok(parts[1].includes('$503.12'), 'the figure is not split at its decimal point');
});

test('the probed field list comes from the engine and is not a copy', () => {
  // A field added to `StateIncomeTaxInput` must be probed without anybody
  // editing the tool, which is the same argument `unread-input.ts` makes
  // against keeping a table: there is nowhere for it to go stale.
  assert.ok(PROBED_FIELDS.includes('stateItemizedDeductions'));
  assert.ok(PROBED_FIELDS.includes('kentuckyModifiedGrossIncome'));
  assert.ok(!PROBED_FIELDS.includes('state'), 'the four structural fields have no absent case');
  assert.ok(!PROBED_FIELDS.includes('retirement'), 'an object has no zero');
  assert.ok(PROBED_FIELDS.length > 40);
});
