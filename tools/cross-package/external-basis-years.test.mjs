/**
 * Every assertion driven with fixtures, in both directions.
 *
 * Assertions A and B can fire on today's tree; C and D cannot, because no state
 * serves 2027 and every shipped state-year reads the edition for its own tax
 * year. A gate that cannot fire is a claim — Day 84's finding — so each one is
 * driven red here with a fixture and then watched to stay green when the only
 * thing that changes is the thing it is for.
 *
 * The test that matters most is `the name-based check misses what this one
 * finds`: it is the defect of Day 86, as an assertion.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  auditExternalBasis,
  sharedDocuments,
  readersOf,
  groupOf,
  at,
  EXTERNAL_PUBLICATIONS,
} from './external-basis-years.mjs';
import { federalKeys } from './federal-basis-years.mjs';

const HHS = 'HHS poverty guidelines';

const hhsPublication = {
  id: 'hhs',
  document: HHS,
  publisher: 'U.S. Department of Health and Human Services',
  host: 'aspe.hhs.gov',
  publishedWhen: 'every January',
  editionYears: [2025, 2026],
  editionYearField: 'year',
  undeclaredEditionIn: {},
};

const prov = (state, path, extra = {}) => ({
  state,
  path,
  kind: 'agency',
  document: HHS,
  cite: 'republished every January',
  constant: false,
  ...extra,
});

/** VA-shaped definition: declares the edition it read. */
const vaDef = (year, { edition = year, status = 'published', provisional = [] } = {}) => ({
  year,
  status,
  lowIncomeCredit: { povertyGuideline: { firstPerson: 15_960, additionalPerson: 5_680, year: edition } },
  provisionalFigures: provisional,
});

const runVA = (defs, { publications = [hhsPublication], provenance } = {}) =>
  auditExternalBasis({
    provenance: provenance ?? [prov('VA', 'lowIncomeCredit.povertyGuideline.*')],
    stateYears: Object.keys(defs).map((y) => ['VA', Number(y)]),
    getDef: (_s, y) => defs[y] ?? null,
    publications,
  });

// ---------------------------------------------------------------- helpers

test('groupOf strips both wildcard forms', () => {
  assert.equal(groupOf('lowIncomeCredit.povertyGuideline.*'), 'lowIncomeCredit.povertyGuideline');
  assert.equal(groupOf('itemizedDeduction.**'), 'itemizedDeduction');
  assert.equal(groupOf('a.b.c'), 'a.b.c');
});

test('at returns undefined rather than throwing through a missing link', () => {
  assert.equal(at({ a: { b: 1 } }, 'a.b'), 1);
  assert.equal(at({ a: null }, 'a.b.c'), undefined);
  assert.equal(at({}, 'nope.nope'), undefined);
});

test('readersOf reports the states and whether anything moves', () => {
  const p = [prov('VA', 'x.*'), prov('MD', 'y.*'), { ...prov('KY', 'z.*'), constant: true }];
  const r = readersOf(p, HHS);
  assert.deepEqual(r.states, ['KY', 'MD', 'VA']);
  assert.equal(r.moves, true);
  assert.equal(readersOf(p, 'nothing').rows.length, 0);
});

// -------------------------------------------- A. the discovery rule

test('A: a document cited by two states is discovered with no list', () => {
  const shared = sharedDocuments([prov('VA', 'a.*'), prov('MD', 'b.*'), { ...prov('CT', 'c.*'), document: 'CT § 12-701' }]);
  assert.deepEqual([...shared.keys()], [HHS]);
  assert.deepEqual([...shared.get(HHS)].sort(), ['MD', 'VA']);
});

test('A: a document cited by one state only is not shared', () => {
  assert.equal(sharedDocuments([prov('VA', 'a.*')]).size, 0);
});

test('A: a shared document nobody registered is RED', () => {
  const provenance = [
    { ...prov('VA', 'a.*'), document: 'Some Interstate Compact' },
    { ...prov('MD', 'b.*'), document: 'Some Interstate Compact' },
  ];
  const { failures } = auditExternalBasis({
    provenance,
    stateYears: [],
    getDef: () => null,
    publications: [],
  });
  assert.equal(failures.length, 1);
  assert.match(failures[0], /Some Interstate Compact/);
  assert.match(failures[0], /MD, VA/);
  assert.match(failures[0], /not any one state's own document/);
});

test('A: the same shared document, registered, is green', () => {
  const provenance = [prov('VA', 'lowIncomeCredit.povertyGuideline.*'), prov('MD', 'povertyLevelCredit.povertyGuideline.*')];
  const { failures } = auditExternalBasis({
    provenance,
    stateYears: [
      ['VA', 2025],
      ['VA', 2026],
    ],
    getDef: (_s, y) => vaDef(y),
    publications: [hhsPublication],
  });
  assert.deepEqual(failures, []);
});

// ------------------------------------- B. the declaration matches the data

test('B: a registry that claims an edition the tree never reads is RED', () => {
  const { failures } = runVA({ 2025: vaDef(2025), 2026: vaDef(2026) }, {
    publications: [{ ...hhsPublication, editionYears: [2025, 2026, 2027] }],
  });
  assert.equal(failures.length, 1);
  assert.match(failures[0], /declares editionYears 2025, 2026, 2027 and the tree reads edition\(s\) 2025, 2026/);
});

test('B: a registry missing an edition the tree does read is RED', () => {
  const { failures } = runVA({ 2025: vaDef(2025), 2026: vaDef(2026) }, {
    publications: [{ ...hhsPublication, editionYears: [2025] }],
  });
  assert.ok(failures.some((f) => /declares editionYears 2025 and the tree reads edition\(s\) 2025, 2026/.test(f)));
});

test('B: a publication registered that nothing cites is RED', () => {
  const { failures } = auditExternalBasis({
    provenance: [],
    stateYears: [],
    getDef: () => null,
    publications: [hhsPublication],
  });
  assert.equal(failures.length, 1);
  assert.match(failures[0], /no provenance record cites it/);
});

// ------------------------------------------ C. no silent carry-forward

test('C: a 2027 built on the 2026 edition, not marked provisional, is RED', () => {
  const { failures } = runVA(
    { 2025: vaDef(2025), 2026: vaDef(2026), 2027: vaDef(2027, { edition: 2026 }) },
    { publications: [{ ...hhsPublication, editionYears: [2025, 2026, 2027] }] },
  );
  assert.ok(failures.some((f) => /reads the 2026 edition .* for tax year 2027 .* not marked provisional/s.test(f)));
});

test('C: the same carry-forward, marked provisional, is green — and the registry still claims only the editions actually read', () => {
  const provisionalTree = {
    2025: vaDef(2025),
    2026: vaDef(2026),
    2027: vaDef(2027, {
      edition: 2026,
      status: 'provisional',
      provisional: [{ path: 'lowIncomeCredit.povertyGuideline.firstPerson', reason: 'awaiting-publication', carriedForwardFrom: 2026 }],
    }),
  };
  // The 2027 definition reads the 2026 EDITION, so editionYears stays [2025, 2026].
  const { failures } = runVA(provisionalTree, { publications: [hhsPublication] });
  assert.deepEqual(failures, []);

  // And claiming a 2027 edition was read, when none was, is RED.
  const overclaim = runVA(provisionalTree, {
    publications: [{ ...hhsPublication, editionYears: [2025, 2026, 2027] }],
  });
  assert.ok(overclaim.failures.some((f) => /declares editionYears 2025, 2026, 2027 and the tree reads edition\(s\) 2025, 2026/.test(f)));
});

test('C: a state that declares no edition at all is RED unless declared as such', () => {
  const kyDef = (year) => ({
    year,
    status: 'published',
    familySizeTaxCredit: { povertyGuideline: { firstPerson: 15_960, additionalPerson: 5_680 } },
  });
  const base = {
    provenance: [prov('KY', 'familySizeTaxCredit.povertyGuideline.*')],
    stateYears: [['KY', 2025], ['KY', 2026]],
    getDef: (_s, y) => kyDef(y),
  };
  const red = auditExternalBasis({ ...base, publications: [hhsPublication] });
  assert.ok(red.failures.some((f) => /does not declare which edition/.test(f)));

  const green = auditExternalBasis({
    ...base,
    publications: [{ ...hhsPublication, undeclaredEditionIn: { KY: 'no `year` field; closing it is a source change' } }],
  });
  assert.deepEqual(green.failures, []);
});

// -------------------------------------------- D. verification parity

test('D: publishing a year whose edition was never carried is RED', () => {
  const { failures } = runVA({ 2025: vaDef(2025), 2026: vaDef(2026), 2027: vaDef(2027) }, {
    publications: [{ ...hhsPublication, editionYears: [2025, 2026] }],
  });
  assert.ok(failures.some((f) => /claims status 'published'.*whose 2027 edition this project has never carried/s.test(f)));
});

test('D: the identical tree with the edition carried is green — only that changed', () => {
  const defs = { 2025: vaDef(2025), 2026: vaDef(2026), 2027: vaDef(2027) };
  const red = runVA(defs, { publications: [{ ...hhsPublication, editionYears: [2025, 2026] }] });
  const green = runVA(defs, { publications: [{ ...hhsPublication, editionYears: [2025, 2026, 2027] }] });
  assert.ok(red.failures.length > 0);
  assert.deepEqual(green.failures, []);
});

test('D: a provisional 2027 is not required to have the edition carried', () => {
  const { failures } = runVA(
    { 2025: vaDef(2025), 2026: vaDef(2026), 2027: vaDef(2027, { status: 'provisional' }) },
    { publications: [{ ...hhsPublication, editionYears: [2025, 2026] }] },
  );
  assert.ok(!failures.some((f) => /never carried/.test(f)));
});

// ------------------------------------------------------- the whole point

test('the name-based check misses exactly what this one finds', () => {
  // The three real key paths, as they are spelled in the engine.
  for (const def of [
    { familySizeTaxCredit: { povertyGuideline: { firstPerson: 15_960, additionalPerson: 5_680 } } },
    { povertyLevelCredit: { povertyGuideline: { firstPerson: 15_960, additionalPerson: 5_680, year: 2026 } } },
    { lowIncomeCredit: { povertyGuideline: { firstPerson: 15_960, additionalPerson: 5_680, year: 2026 } } },
  ]) {
    assert.deepEqual([...federalKeys(def)], [], 'no key in a poverty-guideline group matches /federal/i');
  }

  // And the ledger says what the key names do not.
  const { dependents } = runVA({ 2025: vaDef(2025), 2026: vaDef(2026) });
  assert.equal(dependents.length, 2);
  assert.equal(dependents[0].document, HHS);
});

test('the shipped registry names a host and a month for every publication', () => {
  assert.ok(EXTERNAL_PUBLICATIONS.length > 0);
  for (const p of EXTERNAL_PUBLICATIONS) {
    assert.match(p.host, /^[a-z0-9.-]+\.[a-z]{2,}$/, `${p.id} needs a bare hostname`);
    assert.ok(p.publishedWhen && p.publishedWhen.length > 3, `${p.id} needs a publication month`);
    assert.ok(Array.isArray(p.editionYears) && p.editionYears.length > 0, `${p.id} needs editions`);
    assert.ok(p.publisher && p.document, `${p.id} needs a publisher and a document`);
  }
});
