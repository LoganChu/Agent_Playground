/**
 * The decomposition driven with fixtures, including the two mistakes the real
 * paragraph made and the one my own first recount made.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decomposeBlockers,
  NEEDS_PUBLICATION,
  AWAITING_DETERMINATION,
  IRS,
  HHS,
  DETERMINATION,
  OWN_DEPARTMENT,
  OWN_STATUTE,
} from './next-year-blockers.mjs';

const HHS_DOC = { document: 'HHS poverty guidelines' };
const plain = { base: 'stateDefined', deduction: { kind: 'table' } };
const takesFederalDeduction = { base: 'stateDefined', deduction: { kind: 'federal' } };

const run = ({ refused, defs, provenance = [], externalDocuments = [HHS_DOC] }) =>
  decomposeBlockers({
    refused,
    getDef: (s) => defs[s] ?? plain,
    lastYearFor: () => 2026,
    provenance,
    externalDocuments,
  });

test('a state with nothing that moves is in no group', () => {
  const r = run({ refused: ['XX'], defs: { XX: plain } });
  assert.deepEqual(r.rows[0].waits, []);
  assert.deepEqual(r.nothingMoves, ['XX']);
  assert.equal(r.closes, true);
});

test('a federal deduction puts a state in the IRS group', () => {
  const r = run({ refused: ['XX'], defs: { XX: takesFederalDeduction } });
  assert.deepEqual(r.groups[IRS], ['XX']);
});

test('an external document puts a state in the HHS group even under a state-sounding key', () => {
  const r = run({
    refused: ['XX'],
    defs: { XX: plain },
    provenance: [{ state: 'XX', path: 'lowIncomeCredit.povertyGuideline.*', kind: 'agency', document: 'HHS poverty guidelines', constant: false }],
  });
  assert.deepEqual(r.groups[HHS], ['XX']);
  // and it is NOT also counted as its own department: the document is external
  assert.deepEqual(r.groups[OWN_DEPARTMENT], []);
});

test('THE RECOUNT ERROR: statute-scheduled is not waiting on a department', () => {
  const scheduled = [{ state: 'XX', path: 'rate.rate', kind: 'statute-scheduled', document: 'HB 1', constant: false }];
  const r = run({ refused: ['XX'], defs: { XX: plain }, provenance: scheduled });
  assert.deepEqual(r.groups[OWN_STATUTE], ['XX'], 'a scheduled figure is a reading of statute');
  assert.deepEqual(r.groups[OWN_DEPARTMENT], [], 'and NOT a publication anybody is waiting for');
  assert.deepEqual(r.noPublicationNeeded, ['XX']);
});

test('an indexed figure IS waiting on a department', () => {
  const indexed = [{ state: 'XX', path: 'deduction.amount', kind: 'indexed', document: 'Form XX-1', constant: false }];
  const r = run({ refused: ['XX'], defs: { XX: plain }, provenance: indexed });
  assert.deepEqual(r.groups[OWN_DEPARTMENT], ['XX']);
  assert.deepEqual(r.groups[OWN_STATUTE], []);
  assert.deepEqual(r.noPublicationNeeded, []);
});

test('CALIFORNIA: waiting recorded only in provisionalFigures is still waiting', () => {
  // A ledger-only screen puts California in "nothing moves", which is false.
  const ca = { ...plain, provisionalFigures: [{ path: 'rate.byStatus.single.0.upTo', reason: 'awaiting-publication', carriedForwardFrom: 2025 }] };
  const r = run({ refused: ['CA'], defs: { CA: ca } });
  assert.deepEqual(r.groups[OWN_DEPARTMENT], ['CA']);
  assert.deepEqual(r.nothingMoves, []);
});

test('a provisional figure for some other reason is not a pending publication', () => {
  const x = { ...plain, provisionalFigures: [{ path: 'a.b', reason: 'derived-bounded', carriedForwardFrom: 2025 }] };
  const r = run({ refused: ['XX'], defs: { XX: x } });
  assert.deepEqual(r.groups[OWN_DEPARTMENT], []);
});

test('THE PARTITION ERROR: a state can be in two groups, and the arithmetic says so', () => {
  const r = run({
    refused: ['MO', 'XX'],
    defs: { MO: takesFederalDeduction, XX: plain },
    provenance: [{ state: 'MO', path: 'd', kind: 'indexed', document: 'Form MO-1040', constant: false }],
  });
  assert.deepEqual(r.rows.find((x) => x.state === 'MO').waits, [IRS, OWN_DEPARTMENT]);
  assert.equal(r.overlaps.length, 1);
  // 1 IRS + 1 own-department + 1 nothing-moves = 3 dependencies, minus 1 overlap = 2 states
  assert.equal(r.dependencies, 3);
  assert.equal(r.closes, true);
});

test('a state in THREE groups breaks "minus the overlaps", and that is detected rather than hidden', () => {
  const r = run({
    refused: ['GA'],
    defs: { GA: takesFederalDeduction },
    provenance: [
      { state: 'GA', path: 'a', kind: 'indexed', document: 'Form 500', constant: false },
      { state: 'GA', path: 'b', kind: 'agency', document: 'HHS poverty guidelines', constant: false },
    ],
  });
  assert.equal(r.rows[0].waits.length, 4, 'IRS + HHS + determination + own department');
  assert.equal(r.threeOrMore.length, 1);
  assert.equal(r.closes, false, 'the subtraction is not valid, and the tool must not claim it is');
});

test('the determination group is exactly Georgia and North Carolina', () => {
  assert.deepEqual([...AWAITING_DETERMINATION].sort(), ['GA', 'NC']);
  const r = run({ refused: ['GA', 'NC', 'XX'], defs: {} });
  assert.deepEqual(r.groups[DETERMINATION], ['GA', 'NC']);
});

test('the publication kinds are the ones that mean somebody must publish', () => {
  for (const kind of ['indexed', 'agency', 'determined-after-year-end', 'carried-forward', 'derived-bounded']) {
    assert.ok(NEEDS_PUBLICATION.has(kind), `${kind} needs a publication`);
  }
  for (const kind of ['statute', 'statute-scheduled', 'derived', 'sentinel', 'federal-conformity']) {
    assert.ok(!NEEDS_PUBLICATION.has(kind), `${kind} does not`);
  }
});

test('an empty refused list closes trivially and claims nothing', () => {
  const r = run({ refused: [], defs: {} });
  assert.equal(r.closes, true);
  assert.equal(r.dependencies, 0);
  assert.deepEqual(r.noPublicationNeeded, []);
});
