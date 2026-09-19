// Indiana's exemption is published as "$1,000 per person" and that is the
// smallest of the four figures on Schedule 3. A dependent child is worth
// $2,500, a filer at 65 is worth $2,000, and a filer at 65 under $40,000 of
// federal AGI is worth $2,500 — so the published figure is right for exactly
// one kind of household, a working adult with no children.
//
// Until v0.21.0 this package computed only the published figure, and said so in
// a note that put the cost at "about $44 per qualifying child". That understated
// its own bug by 70%, because $44 is the STATE rate on $1,500 and two fifths of
// an Indiana bill is levied by a county. The real figure in Marion County is
// $74.55 a child.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { stateIncomeTax } from '../dist/esm/index.js';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

const federal = (agi) => ({
  adjustedGrossIncome: agi,
  taxableIncome: Math.max(0, agi - 15_750),
  deduction: 15_750,
  deductionKind: 'standard',
});

/** 2026: the state rate is 2.95% and Marion County's is 2.02%. */
const MARION = 0.0202;
const STATE_2026 = 0.0295;
const COMBINED = STATE_2026 + MARION;

const indiana = (opts = {}) =>
  stateIncomeTax({
    state: 'IN',
    year: opts.year ?? 2026,
    filingStatus: opts.filingStatus ?? 'single',
    county: opts.county ?? 'Marion',
    federal: federal(opts.agi ?? 60_000),
    ...opts,
  });

test('a dependent child is worth $2,500 of exemption and a dependent parent $1,000', () => {
  const child = indiana({
    filingStatus: 'marriedFilingJointly',
    agi: 60_000,
    dependentAges: [8],
  });
  const parent = indiana({
    filingStatus: 'marriedFilingJointly',
    agi: 60_000,
    dependentAges: [78],
  });
  money(child.exemptions, 2_000 + 1_000 + 1_500, 'two filers, one dependent, one child');
  money(parent.exemptions, 2_000 + 1_000, 'a dependent parent is not a child');
  // The same household total, the same number of dependents, and $74.55 apart.
  money(child.totalTax - parent.totalTax, -1_500 * COMBINED);
  money(parent.totalTax - child.totalTax, 74.55);
});

test('the child exemption runs to 18, and to 23 for a full-time student', () => {
  const base = { filingStatus: 'marriedFilingJointly', agi: 80_000 };
  money(indiana({ ...base, dependentAges: [18] }).exemptions, 3_000 + 1_500, '18 qualifies');
  money(indiana({ ...base, dependentAges: [19] }).exemptions, 3_000, '19 does not');
  money(
    indiana({ ...base, dependentAges: [19], dependentsAttendingCollege: 1 }).exemptions,
    3_000 + 1_500,
    '19 qualifies as a full-time student',
  );
  money(
    indiana({ ...base, dependentAges: [23], dependentsAttendingCollege: 1 }).exemptions,
    3_000 + 1_500,
    '23 is the last year',
  );
  money(
    indiana({ ...base, dependentAges: [24], dependentsAttendingCollege: 1 }).exemptions,
    3_000,
    'and 24 is not, student or not',
  );
});

test('the student count is spent on the dependents it can change', () => {
  // One student declared and two dependents, one of whom is inside the band. The
  // younger child already qualifies on age, so the declared student has to be
  // the older one for the answer to mean anything.
  const r = indiana({
    filingStatus: 'marriedFilingJointly',
    agi: 90_000,
    dependentAges: [10, 20],
    dependentsAttendingCollege: 1,
  });
  money(r.exemptions, 2_000 + 2_000 + 1_500 + 1_500, 'both children carry the $1,500');
});

test('a count without ages claims nothing, and the result says what it cost', () => {
  const counted = indiana({
    filingStatus: 'marriedFilingJointly',
    agi: 60_000,
    dependents: 2,
  });
  const aged = indiana({
    filingStatus: 'marriedFilingJointly',
    agi: 60_000,
    dependentAges: [3, 8],
  });
  money(counted.exemptions, 2_000 + 2_000, 'the $1,000 dependent exemption only');
  money(aged.exemptions, 2_000 + 2_000 + 3_000);
  money(counted.totalTax - aged.totalTax, 3_000 * COMBINED, '$149.10 on two children');
  money(counted.totalTax - aged.totalTax, 149.1);

  const notes = counted.notes.join(' ');
  assert.match(notes, /dependentAges was not supplied/);
  // Priced, not hedged: the caller learns what the field is worth on this return.
  assert.match(notes, /\$149\.10/);
  assert.ok(
    !aged.notes.join(' ').includes('dependentAges was not supplied'),
    'and the note is gone once the ages are there',
  );
});

test('age 65 is worth $1,000, and $1,500 under $40,000 of federal AGI', () => {
  const at = (agi) =>
    indiana({ filingStatus: 'marriedFilingJointly', agi, filerAge: 70, spouseAge: 70 });
  money(at(39_999).exemptions, 2_000 + 2_000 + 1_000, 'two at 65, both under the line');
  money(at(40_000).exemptions, 2_000 + 2_000, 'and one dollar higher');
  // The only means-tested exemption in this package, and it is a cliff: $1,000
  // of exemption gone on one dollar of income. That dollar costs $49.75 in
  // Marion County — $49.70 of lost exemption and five cents of tax on itself —
  // a marginal rate of 4,975% in a state whose published rate is 2.95%.
  const cost = at(40_000).totalTax - at(39_999).totalTax;
  money(cost, 1_001 * COMBINED);
  money(cost, 49.75);
  money(at(40_000).marginalRate + at(40_000).localTaxes[0].marginalRate, COMBINED, 'and the next dollar after it is ordinary again');
});

test('the $500 is per person and the $40,000 is not halved for a couple', () => {
  const one = indiana({ filingStatus: 'marriedFilingJointly', agi: 30_000, filerAge: 70 });
  const two = indiana({
    filingStatus: 'marriedFilingJointly',
    agi: 30_000,
    filerAge: 70,
    spouseAge: 70,
  });
  money(one.exemptions, 2_000 + 1_000 + 500);
  money(two.exemptions, 2_000 + 2_000 + 1_000);
});

test('a separate return keeps the $500 but the threshold is halved', () => {
  const at = (agi) => indiana({ filingStatus: 'marriedFilingSeparately', agi, filerAge: 70 });
  money(at(19_999).exemptions, 1_000 + 1_000 + 500);
  money(at(20_000).exemptions, 1_000 + 1_000);
});

test('blindness stacks on age rather than replacing it', () => {
  const r = indiana({
    filingStatus: 'marriedFilingJointly',
    agi: 60_000,
    filerAge: 70,
    spouseAge: 70,
    blindOrDisabled: 1,
  });
  money(r.exemptions, 2_000 + 2_000 + 1_000, 'two aged, one blind, no $500 at $60,000');
});

test('a retired Indiana couple at $24,000 of AGI, against PolicyEngine-US', () => {
  // `retired-couple-IN-0-20000-40000` in tools/differential: $40,000 of Social
  // Security, $20,000 of pension, both 70. Indiana exempts the benefit, so
  // federal AGI is $24,000 and every one of the four exemptions is in play.
  const r = indiana({
    filingStatus: 'marriedFilingJointly',
    agi: 24_000,
    filerAge: 70,
    spouseAge: 70,
    taxableSocialSecurity: 4_000,
  });
  money(r.exemptions, 5_000, '$2,000 base, $2,000 at 65, $1,000 under $40,000');
  money(r.taxableIncome, 15_000);
  money(r.totalTax, 745.5, 'and PolicyEngine-US says $745.50');
});

test('the four exemptions are unchanged in 2025 and only the rate moves', () => {
  const shape = {
    filingStatus: 'marriedFilingJointly',
    agi: 60_000,
    dependentAges: [3, 8],
    filerAge: 70,
    spouseAge: 70,
  };
  const a = indiana({ ...shape, year: 2025 });
  const b = indiana({ ...shape, year: 2026 });
  money(a.exemptions, b.exemptions, 'none of the four figures is indexed');
  money(a.taxableIncome, b.taxableIncome);
  money(a.tax, b.tax * (0.03 / STATE_2026), 'the rate is the only thing that moved');
});
