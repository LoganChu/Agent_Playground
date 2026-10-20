// The figures printed INSIDE the dynamic notes, which nothing pinned.
//
// ## Why this file exists, and it is a finding about an instrument
//
// Day 34 built `notes.test.js` on the argument that the notes are the thing this
// package sells, and that a suite watching numbers cannot see a product that is
// not a number. It pins the FIRST 72 CHARACTERS of every note a state-year emits,
// in order, which catches a note appearing, vanishing, moving or swapping years.
//
// Day 56 found the hole in that, and found it sideways. Fixing the mutation
// harness's masker — it had no notion of `${...}` interpolation and had been
// blanking real code inside template literals — recovered ten mutable literals in
// `engine.ts`, and SIX OF THE TEN SURVIVED. Every one of the six is a `× 100` that
// turns a stored rate into the percentage a note PRINTS:
//
//   engine.ts  Maryland's poverty level credit     "is 5% of EARNED income"
//   engine.ts  Oregon's surplus kicker             "it is 9.863% of the filer's OWN"
//   engine.ts  a state earned income credit        "worth 50% of the federal one"
//   engine.ts  the marginalRate caveat             "by 50% of the federal phase-out rate"
//   engine.ts  Ohio with no city and no wages      "at 0.45% to 3.00%"  (two mutants)
//
// Doubling any of those `100`s makes the package print a percentage that is twice
// the rate it actually used, in prose a language model reads and acts on, and
// every test in this package stayed green.
//
// **Two reasons the 72-character pin could never have caught them, and the second
// is the one worth keeping.** The figures sit mid-sentence, past character 72. And
// more fundamentally, these are DYNAMIC notes: they fire only when the caller
// OMITS a particular field, and `notes.test.js` runs a standard household that
// supplies a consistent set. A fixture built to enumerate a state's standing notes
// cannot reach a note whose whole trigger is an absence.
//
//   THE RULE: A PIN OVER THE PREFIX OF A NOTE CHECKS WHICH NOTES EXIST AND NOT
//   WHAT THEY SAY, AND A FIXTURE OVER ONE HOUSEHOLD CANNOT REACH A NOTE THAT
//   FIRES ON WHAT THAT HOUSEHOLD HAPPENS TO SUPPLY.
//
// ## What is asserted, and what deliberately is not
//
// The rendered PERCENTAGE STRING, exactly as a caller reads it. This file does not
// re-derive the underlying rate from the statute — that is done where the rate
// lives (`maryland.test.js`, `oregon.test.js`, `earned-income-credit.test.js`,
// `localities.test.js`), and duplicating it here would be two copies of one fact.
// What is unchecked anywhere else, and is checked here, is the step BETWEEN the
// stored rate and the sentence: the conversion to percent, the number of decimal
// places, and the fact that the sentence is about this rate at all.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { stateIncomeTax } from './strict.mjs';

const federal = (agi, extra = {}) => ({
  adjustedGrossIncome: agi,
  deduction: 15_750,
  deductionKind: 'standard',
  taxableIncome: Math.max(0, agi - 15_750),
  incomeTaxBeforeRefundableCredits: 9_000,
  ...extra,
});

test("Maryland's poverty level credit note prints the share as a percentage", () => {
  // Fires because `earnedIncome` is absent, which is the whole subject of the
  // note. 5% of earned income, so the sentence must read 5% and not 10%.
  const r = stateIncomeTax({
    state: 'MD',
    year: 2025,
    filingStatus: 'single',
    federal: federal(20_000),
    filerAge: 40,
    county: 'Allegany County',
  });
  const note = r.notes.find((n) => n.includes('poverty level credit'));
  assert.ok(note, 'the poverty level credit note is emitted when earnedIncome is absent');
  assert.match(note, /poverty level credit is 5% of EARNED income/);
});

test("Oregon's kicker note prints the certified rate to three decimals", () => {
  // Fires because the prior-year base is absent. The rate is 0.09863, so the
  // sentence must read 9.863% — three decimal places, because a kicker rate is
  // certified to that precision and 9.86% would be a different claim.
  const r = stateIncomeTax({
    state: 'OR',
    year: 2025,
    filingStatus: 'single',
    federal: federal(80_000),
    filerAge: 40,
    earnedIncome: 80_000,
  });
  const note = r.notes.find((n) => n.includes('IS REFUNDABLE AND WAS COMPUTED AS ZERO'));
  assert.ok(note, 'the kicker note is emitted when the prior-year base is absent');
  assert.match(note, /it is 9\.863% of the filer's OWN/);
});

test('a state earned income credit note prints its match rate as a percentage', () => {
  // Fires because no federal earned income credit was supplied. Maryland matches
  // at 50%, so the sentence must read 50% and not 100%.
  const r = stateIncomeTax({
    state: 'MD',
    year: 2025,
    filingStatus: 'single',
    federal: federal(20_000),
    filerAge: 40,
    county: 'Allegany County',
  });
  const note = r.notes.find((n) => n.includes('earned income credit worth'));
  assert.ok(note, 'the earned income credit note is emitted when the federal credit is absent');
  assert.match(note, /earned income credit worth 50% of the federal one/);
});

test('the marginalRate caveat prints the match rate it is about', () => {
  // The opposite trigger from the test above: this one fires when the federal
  // credit IS supplied, because then the reported marginal rate holds it fixed.
  const r = stateIncomeTax({
    state: 'MD',
    year: 2025,
    filingStatus: 'single',
    federal: federal(20_000, { earnedIncomeCredit: 500 }),
    filerAge: 40,
    earnedIncome: 20_000,
    county: 'Allegany County',
  });
  const note = r.notes.find((n) => n.includes('federal phase-out rate'));
  assert.ok(note, 'the marginal-rate caveat is emitted when the federal credit is supplied');
  assert.match(note, /higher than the figure reported here by 50% of the federal phase-out rate/);
});

test("Ohio's no-city note prints the municipal rate range, on a filer with NO wages", () => {
  // Two mutants on one sentence, and the household matters. This note has two
  // branches — one for a filer with wages, which quotes the range AND prices it,
  // and one for a filer without, which quotes the range alone. Every Ohio test in
  // this package gave the filer wages, so the second branch's two percentages had
  // never been read by anything. A pension-only retiree is the household that
  // reaches it.
  const r = stateIncomeTax({
    state: 'OH',
    year: 2025,
    filingStatus: 'single',
    federal: federal(40_000),
    filerAge: 70,
    retirement: { filer: { employerPlanPension: 40_000 } },
  });
  const note = r.notes.find((n) => n.includes('municipalities levy an income tax of their own at'));
  assert.ok(note, 'the no-city note takes its no-wages branch for a filer with no wages');
  assert.match(note, /at 0\.45% to 3\.00% of qualifying wages/);
});
