/**
 * The provenance ledger.
 *
 * ## How this file was found
 *
 * Day 35 pinned the state engine's `notes`, on an argument about what a suite can
 * see: **a suite that watches numbers cannot see the thing you sell if the thing
 * you sell is not a number.** The federal package's first advertised
 * differentiator is not a number either. It is the sentence "every figure cited
 * to the IRS release it came from", and on Day 36 that sentence had:
 *
 *   - 240 numbers and 8 documents in tax year 2024,
 *   - 279 numbers and 25 documents in tax year 2026,
 *   - and nothing anywhere connecting a number to a document.
 *
 * **THE RULE: a list of sources beside a list of figures is not provenance. The
 * mapping is the provenance, and it is the part nobody writes down.** The
 * mapping's absence hid a defect of exactly the shape Day 33 found in the test
 * suite: tax year 2024 reads § 1411, § 199A, § 32, § 86, § 1401, § 1402, § 3101
 * and § 3111 and cited none of them, because a citation list kept per year is
 * three chances to forget the same statute and the newest year is the only one
 * anybody edits.
 *
 * ## What this file asserts, and what each assertion would catch
 *
 *   1. COVERAGE      every number in every year is claimed by exactly one entry.
 *                    A number nobody claims is a number with no stated source,
 *                    which is the state the whole package was in.
 *   2. NO TIES       two entries of equal specificity matching one figure is a
 *                    defect in the ledger, not something for the lookup to pick.
 *   3. LIVENESS      every entry wins for at least one figure in every year it
 *                    names, so the ledger cannot describe a package that no
 *                    longer exists.
 *   4. CONSTANCY     `constant` is checked in BOTH directions. This is the one
 *                    with teeth: an indexed figure that has not moved in three
 *                    years is the exact shape of a silent carry-forward, so it
 *                    must say in writing why it is not one.
 *   5. THE DOCUMENT  every entry's document appears in the `sources` of every
 *                    year it covers — and an indexed figure needs TWO, the
 *                    provision that creates it and the release that sets it.
 *   6. THE YEAR      an indexed figure's Revenue Procedure must name its own tax
 *                    year, so a year file copied from its neighbour fails.
 *   7. NO DEAD CITE  every citation is either behind a figure or listed here as
 *                    something else, with which something else it is.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FEDERAL_FIGURE_PROVENANCE,
  SUPPORTED_YEARS,
  documentsBehindFigures,
  figureProvenance,
  figureProvenanceMatches,
  getYearParameters,
} from '../dist/esm/index.js';

/** Every numeric leaf of a year's parameters, as a dot path. `sources` and `year` are not figures. */
const figurePaths = (year) => {
  const walk = (node, prefix, out) => {
    if (node === null || node === undefined) return out;
    if (typeof node === 'number') {
      out.push(prefix);
      return out;
    }
    if (typeof node !== 'object') return out;
    if (Array.isArray(node)) {
      node.forEach((value, index) => walk(value, `${prefix}.${index}`, out));
      return out;
    }
    for (const [key, value] of Object.entries(node)) {
      walk(value, prefix === '' ? key : `${prefix}.${key}`, out);
    }
    return out;
  };
  const parameters = { ...getYearParameters(year) };
  delete parameters.sources;
  delete parameters.year;
  return walk(parameters, '', []);
};

const at = (root, path) =>
  path
    .split('.')
    .reduce((node, key) => (node === undefined ? undefined : node[/^\d+$/.test(key) ? Number(key) : key]), root);

const INDEXED_OR_AGENCY = new Set(['indexed', 'agency']);

// ---------------------------------------------------------------------------
// 1 and 2 — coverage, and the ties that coverage would otherwise hide
// ---------------------------------------------------------------------------

test('every number in every year is claimed by exactly one ledger entry', () => {
  let claimed = 0;
  for (const year of SUPPORTED_YEARS) {
    for (const path of figurePaths(year)) {
      const entry = figureProvenance(path, year);
      assert.notEqual(
        entry,
        undefined,
        `${year}: nothing in the ledger says where ${path} came from. Add an entry, ` +
          'or this package ships a number with no stated source — which is the state it ' +
          'was in before this file existed.',
      );
      claimed += 1;
    }
  }
  // Pinned, per Day 35: a walk that silently stops finding things must fail
  // rather than report a clean sweep over nothing. 240 + 277 + 279.
  assert.equal(claimed, 796, 'the number of figures claimed has changed — check what moved before editing this');
});

test('no figure is claimed by two entries of equal specificity', () => {
  const specificity = (entry) => [
    entry.path.split('.').filter((segment) => segment !== '*' && segment !== '**').length,
    entry.years === undefined ? 0 : 1,
  ];
  for (const year of SUPPORTED_YEARS) {
    for (const path of figurePaths(year)) {
      const matching = FEDERAL_FIGURE_PROVENANCE.filter(
        (entry) =>
          (entry.years === undefined || entry.years.includes(year)) &&
          figureProvenanceMatches(entry.path, path),
      );
      const ranks = matching.map((entry) => specificity(entry).join('/'));
      assert.equal(
        new Set(ranks).size,
        ranks.length,
        `${year}: ${path} is claimed by two entries of equal specificity ` +
          `(${matching.map((entry) => entry.path).join(', ')}). One of them must be narrowed.`,
      );
    }
  }
});

test('a path the parameters do not have has no provenance, so the ledger cannot answer for a typo', () => {
  assert.equal(figureProvenance('standardDeduction.singl', 2026), undefined);
  assert.equal(figureProvenance('', 2026), undefined);
  // And the year scope really scopes: Schedule 1-A did not exist in 2024.
  assert.equal(figureProvenance('scheduleOneA.tips.cap', 2024), undefined);
  assert.notEqual(figureProvenance('scheduleOneA.tips.cap', 2025), undefined);
});

// ---------------------------------------------------------------------------
// 3 — liveness
// ---------------------------------------------------------------------------

test('every ledger entry wins for at least one figure in every year it covers', () => {
  const winners = new Map();
  for (const year of SUPPORTED_YEARS) {
    for (const path of figurePaths(year)) {
      const entry = figureProvenance(path, year);
      if (entry === undefined) continue;
      if (!winners.has(entry)) winners.set(entry, new Set());
      winners.get(entry).add(year);
    }
  }
  for (const entry of FEDERAL_FIGURE_PROVENANCE) {
    const years = winners.get(entry);
    assert.notEqual(
      years,
      undefined,
      `the entry for '${entry.path}' accounts for no figure in any year: either the ` +
        'parameter was renamed, or a broader entry shadows this one entirely.',
    );
    for (const year of entry.years ?? []) {
      assert.ok(
        years.has(year),
        `the entry for '${entry.path}' names ${year} and wins nothing there`,
      );
    }
  }
  assert.equal(FEDERAL_FIGURE_PROVENANCE.length, winners.size, 'every entry is live');
});

test('a year an entry names is a year this package ships', () => {
  // The mutation harness rewrites bare years. Without this, a mutated `years`
  // array would quietly narrow a claim instead of failing.
  for (const entry of FEDERAL_FIGURE_PROVENANCE) {
    for (const year of entry.years ?? []) {
      assert.ok(
        SUPPORTED_YEARS.includes(year),
        `the entry for '${entry.path}' names tax year ${year}, which this package does not have`,
      );
    }
    if (entry.carriedForwardFrom !== undefined) {
      assert.ok(SUPPORTED_YEARS.includes(entry.carriedForwardFrom));
    }
  }
});

// ---------------------------------------------------------------------------
// 4 — the constancy claim, in both directions
// ---------------------------------------------------------------------------

test('a figure claimed constant is identical in every year its entry covers', () => {
  let compared = 0;
  for (const entry of FEDERAL_FIGURE_PROVENANCE) {
    if (!entry.constant) continue;
    const years = SUPPORTED_YEARS.filter(
      (year) => entry.years === undefined || entry.years.includes(year),
    );
    if (years.length < 2) continue;
    const paths = new Set(
      years.flatMap((year) =>
        figurePaths(year).filter((path) => figureProvenance(path, year) === entry),
      ),
    );
    for (const path of paths) {
      const values = years.map((year) => at(getYearParameters(year), path));
      const present = values.filter((value) => value !== undefined);
      assert.equal(
        new Set(present).size,
        1,
        `${path} is claimed constant and is ${years.map((y, i) => `${y}: ${values[i]}`).join(', ')}. ` +
          'Either the figure moved and the ledger has not caught up, or a year was typed wrong.',
      );
      compared += 1;
    }
  }
  assert.ok(compared > 100, `only ${compared} figures were actually compared across years`);
});

test('a figure claimed to move really moves, or the ledger is describing a carry-forward', () => {
  for (const entry of FEDERAL_FIGURE_PROVENANCE) {
    if (entry.constant) continue;
    const years = SUPPORTED_YEARS.filter(
      (year) => entry.years === undefined || entry.years.includes(year),
    );
    if (years.length < 2) continue;
    const paths = new Set(
      years.flatMap((year) =>
        figurePaths(year).filter((path) => figureProvenance(path, year) === entry),
      ),
    );
    // Subtree level, deliberately: a bracket's top band is Infinity in every
    // year and a per-leaf version of this assertion would demand that Infinity
    // be indexed. What the claim is about is the group the entry names.
    const moved = [...paths].some((path) => {
      const values = years.map((year) => at(getYearParameters(year), path));
      return new Set(values.filter((value) => value !== undefined)).size > 1;
    });
    assert.ok(
      moved,
      `the entry for '${entry.path}' says its figures move and not one of them differs ` +
        `across ${years.join(', ')}. If they have stopped moving, say so with \`constant: true\` ` +
        'and a `why` — an indexed figure sitting still is the shape a silent carry-forward has.',
    );
  }
});

test('an indexed figure that has not moved says why, and a statutory one that has', () => {
  for (const entry of FEDERAL_FIGURE_PROVENANCE) {
    if (INDEXED_OR_AGENCY.has(entry.kind) && entry.constant) {
      assert.ok(
        typeof entry.why === 'string' && entry.why.length > 60,
        `'${entry.path}' is indexed and claimed constant, which is what a figure carried ` +
          'forward by hand looks like. Say why it is not one.',
      );
    }
    if (entry.kind === 'statute') {
      assert.ok(
        entry.constant,
        `'${entry.path}' cites a statute that fixes it and is not claimed constant. ` +
          'A figure the Code states for every year cannot differ between years; if it does, ' +
          'the kind is `statute-scheduled`.',
      );
    }
  }
});

test('the two kinds of statute are both in use, so the distinction is not decoration', () => {
  const kinds = new Set(FEDERAL_FIGURE_PROVENANCE.map((entry) => entry.kind));
  assert.deepEqual(
    [...kinds].sort(),
    ['agency', 'indexed', 'reconstructed', 'statute', 'statute-scheduled', 'withholding-methods'],
    'every kind must be in use, or an assertion about it passes vacuously for ever',
  );
});

// ---------------------------------------------------------------------------
// 5 and 6 — the document, and whether it is the right year's
// ---------------------------------------------------------------------------

test('every figure’s document is a document its own year carries', () => {
  for (const year of SUPPORTED_YEARS) {
    const titles = getYearParameters(year).sources.map((source) => source.title);
    const covering = new Set(
      figurePaths(year)
        .map((path) => figureProvenance(path, year))
        .filter((entry) => entry !== undefined),
    );
    for (const entry of covering) {
      for (const token of [entry.document, entry.provision].filter((t) => t !== undefined)) {
        assert.ok(
          titles.some((title) => title.includes(token)),
          `${year}: '${entry.path}' comes from ${token} and ${year}'s sources do not mention it. ` +
            'This is the defect the file was written for: a figure whose year cites everything ' +
            'except the document the figure came from.',
        );
      }
    }
  }
});

test('an indexed figure’s Revenue Procedure names its own tax year', () => {
  // A year file copied from its neighbour keeps the neighbour's Revenue
  // Procedure, and every figure in it then cites the wrong document while every
  // other assertion in this file still passes.
  const REVENUE_PROCEDURE = { 2024: 'Rev. Proc. 2023-34', 2025: 'Rev. Proc. 2024-40', 2026: 'Rev. Proc. 2025-32' };
  for (const year of SUPPORTED_YEARS) {
    const titles = getYearParameters(year).sources.map((source) => source.title);
    const named = titles.filter((title) => title.includes('Rev. Proc.'));
    assert.ok(named.length > 0, `${year} has indexed figures and cites no Revenue Procedure`);
    for (const title of named) {
      assert.ok(
        title.includes(REVENUE_PROCEDURE[year]),
        `${year} cites "${title}", which is not ${REVENUE_PROCEDURE[year]}`,
      );
    }
    assert.ok(
      titles.some((title) => title.includes(`tax year ${year}`)),
      `${year}'s Revenue Procedure citation must say which tax year it adjusts`,
    );
  }
});

// ---------------------------------------------------------------------------
// 7 — the other direction: a citation nothing is read from
// ---------------------------------------------------------------------------

/**
 * Citations that publish no figure this package stores, with what they are for
 * instead. A form shows how a figure is applied; a correction says what an
 * earlier document got wrong; a cross-check repeats a figure published
 * elsewhere, which is how several of these were verified in the first place.
 *
 * This list is the reason the assertion below is two-sided. Without it the test
 * could only say "every figure has a document", and a citation added to a year
 * for no reason — or left behind when the figure it supported was removed —
 * would sit there for ever looking like evidence.
 */
const NOT_BEHIND_A_FIGURE = [
  { token: '§ 1(f)(7)', purpose: 'rule: how the adjustments are rounded, which explains figures rather than setting them' },
  { token: 'correction to the tax rate schedules', purpose: 'correction: the 2024 Form 1040 instructions printed one bracket wrong' },
  { token: 'earned income tax credit income limits', purpose: 'cross-check: the IRS repeats the Revenue Procedure’s EITC figures on a page that is easier to read' },
  { token: 'no change to 2025 withholding tables', purpose: 'rule: why 2025 withholding and the 2025 return disagree' },
  { token: 'IRS newsroom — 2026 inflation adjustments', purpose: 'cross-check: the newsroom summary of Rev. Proc. 2025-32' },
  { token: 'Schedule 1-A (Form 1040)', purpose: 'form: where the four deductions are reported' },
  { token: 'what to know about the new form', purpose: 'guidance: the IRS’s own explanation of the new form' },
  { token: 'Form 8995 —', purpose: 'form: the simplified QBI computation' },
  { token: 'Form 8995-A and Schedule A', purpose: 'form: the QBI computation with the wage/UBIA cap' },
  { token: 'corrections to the 2025 Form 8995-A instructions', purpose: 'correction: which line the QBI limitation is measured against' },
  { token: 'C.F.R. § 1.199A-1', purpose: 'regulation: netting negative QBI, which is an algorithm and not a figure' },
  { token: 'Schedule 8812', purpose: 'form: where the child credit and its refundable portion are computed' },
];

test('every citation is either behind a figure or says what else it is for', () => {
  let accounted = 0;
  for (const year of SUPPORTED_YEARS) {
    const sources = getYearParameters(year).sources;
    const behindFigures = new Set(documentsBehindFigures(sources, year).map((source) => source.title));
    for (const source of sources) {
      if (behindFigures.has(source.title)) {
        accounted += 1;
        continue;
      }
      const listed = NOT_BEHIND_A_FIGURE.find((row) => source.title.includes(row.token));
      assert.notEqual(
        listed,
        undefined,
        `${year} cites "${source.title}" and no figure comes from it. Either a ledger entry ` +
          'should name it, or it belongs in NOT_BEHIND_A_FIGURE with what it is for.',
      );
      accounted += 1;
    }
  }
  assert.equal(accounted, 91, 'the number of citations has changed — 23 + 31 + 37');
});

test('every row of NOT_BEHIND_A_FIGURE matches a citation that is really not behind a figure', () => {
  const used = new Set();
  for (const year of SUPPORTED_YEARS) {
    const sources = getYearParameters(year).sources;
    const behindFigures = new Set(documentsBehindFigures(sources, year).map((source) => source.title));
    for (const source of sources) {
      if (behindFigures.has(source.title)) continue;
      for (const row of NOT_BEHIND_A_FIGURE) if (source.title.includes(row.token)) used.add(row.token);
    }
  }
  for (const row of NOT_BEHIND_A_FIGURE) {
    assert.ok(
      used.has(row.token),
      `NOT_BEHIND_A_FIGURE lists '${row.token}', which either no year cites any more or is ` +
        'now behind a figure. An allowlist nobody prunes is how a real gap gets excused.',
    );
    assert.match(row.purpose, /^(form|rule|correction|cross-check|guidance|regulation): /);
  }
});

// ---------------------------------------------------------------------------
// The one reconstructed figure, which is this package's `provisional`
// ---------------------------------------------------------------------------

test('a reconstructed figure names the document that would settle it', () => {
  const reconstructed = FEDERAL_FIGURE_PROVENANCE.filter((entry) => entry.kind === 'reconstructed');
  assert.ok(reconstructed.length > 0, 'nothing is reconstructed, so this assertion checks nothing');
  for (const entry of reconstructed) {
    // Long enough to be a document and not a shrug, per the state package's
    // rule for `resolvedBy`.
    assert.ok(
      typeof entry.resolvedBy === 'string' && entry.resolvedBy.length > 40,
      `'${entry.path}' is reconstructed and does not name what would settle it`,
    );
    assert.ok(typeof entry.why === 'string' && entry.why.length > 60);
    assert.ok(
      Array.isArray(entry.years) && entry.years.length > 0,
      'a reconstruction is about particular years; an unscoped one would claim every year',
    );
  }
});

test('the 2026 withholding deduction is the reconstruction it claims to be, and 2025 is not', () => {
  // Day 27's non-vacuity rule, applied to a reconstruction: the claim is that
  // 2026's withholding standard deduction IS the Revenue Procedure's figure,
  // reached by the identity that reproduces 2024 and 2025. So assert it — and
  // assert that the same equality FAILS in 2025, because that is the year the
  // tables were never reissued and the reason this entry has to be year-scoped.
  const equalToReturn = (year) => {
    const p = getYearParameters(year);
    return (
      p.withholding.standardDeduction.singleOrMarriedFilingSeparately === p.standardDeduction.single &&
      p.withholding.standardDeduction.marriedFilingJointly === p.standardDeduction.marriedFilingJointly &&
      p.withholding.standardDeduction.headOfHousehold === p.standardDeduction.headOfHousehold
    );
  };
  assert.ok(equalToReturn(2026), '2026 withholding must equal the Revenue Procedure deduction it was derived from');
  assert.ok(equalToReturn(2024), '2024 is the year the derivation was checked against a published Publication 15-T');
  assert.ok(
    !equalToReturn(2025),
    '2025 withholding must NOT equal the 2025 return deduction: Publication 15-T (2025) predates OBBBA. ' +
      'If this now passes, either the figure was changed or OBBBA was backed out.',
  );
  assert.equal(figureProvenance('withholding.standardDeduction.marriedFilingJointly', 2026).kind, 'reconstructed');
  assert.equal(
    figureProvenance('withholding.standardDeduction.marriedFilingJointly', 2025).kind,
    'withholding-methods',
  );
});

// ---------------------------------------------------------------------------
// The measurement the README quotes, kept recomputable
// ---------------------------------------------------------------------------

/**
 * The citation lists exactly as v0.13.0 shipped them, frozen so that the
 * headline number in the README is a computation over committed data rather
 * than something a past run remembers.
 *
 * If a future run adds a parameter whose document none of these lists carried,
 * this fails and the README's table moves by one — which is the intended
 * behaviour of every pinned number in this repository, and the reason to pin the
 * INPUT beside the claim instead of only the claim.
 */
import { readFileSync } from 'node:fs';

const CITATIONS_BEFORE = JSON.parse(
  readFileSync(new URL('./citations-v0.13.0.json', import.meta.url), 'utf8'),
);

test('the citation gap the README quotes is the gap the ledger measures', () => {
  const missingBefore = {};
  for (const year of SUPPORTED_YEARS) {
    const needed = new Set();
    for (const path of figurePaths(year)) {
      const entry = figureProvenance(path, year);
      if (entry === undefined) continue;
      needed.add(entry.document);
      if (entry.provision !== undefined) needed.add(entry.provision);
    }
    const before = CITATIONS_BEFORE[year];
    assert.ok(Array.isArray(before) && before.length > 0, `no v0.13.0 citation list for ${year}`);
    missingBefore[year] = [...needed].filter(
      (token) => !before.some((title) => title.includes(token)),
    ).length;
    // And the same tokens are all present NOW, which is the other half of the
    // claim and is asserted generically above; here it is asserted about the
    // numbers the README prints.
    const titles = getYearParameters(year).sources.map((source) => source.title);
    assert.equal(
      [...needed].filter((token) => !titles.some((title) => title.includes(token))).length,
      0,
      `${year} still does not carry every document its figures come from`,
    );
    assert.equal(before.length, { 2024: 8, 2025: 10, 2026: 25 }[year], `${year}'s v0.13.0 citation count`);
  }
  assert.deepEqual(
    missingBefore,
    { 2024: 13, 2025: 17, 2026: 11 },
    'the README states 13, 17 and 11 missing documents, and 41 in total',
  );
  assert.equal(Object.values(missingBefore).reduce((a, b) => a + b, 0), 41);
});

test('the figure counts the README quotes are the ones the ledger claims', () => {
  const documented = { 2024: 19, 2025: 24, 2026: 24 };
  for (const year of SUPPORTED_YEARS) {
    const needed = new Set();
    for (const path of figurePaths(year)) {
      const entry = figureProvenance(path, year);
      if (entry === undefined) continue;
      needed.add(entry.document);
      if (entry.provision !== undefined) needed.add(entry.provision);
    }
    assert.equal(needed.size, documented[year], `${year}: documents its figures come from`);
  }
  assert.equal(
    SUPPORTED_YEARS.reduce((total, year) => total + figurePaths(year).length, 0),
    796,
    'the README says 796 numbers across the three years',
  );
});

test('the README prints the numbers this file computes', () => {
  // The federal suite recomputes the README's examples rather than reading it,
  // which works for a worked example and not for a table: nothing recomputes a
  // row. So the three rows are matched as text, because a table edited without
  // its measurement being rerun is how a correctness package ends up quoting a
  // figure it no longer has.
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  for (const row of ['| 2024 | 8 | 19 | **13** |', '| 2025 | 10 | 24 | **17** |', '| 2026 | 25 | 24 | **11** |']) {
    assert.ok(readme.includes(row), `the README no longer prints the row ${row}`);
  }
  assert.ok(readme.includes('**796 numbers**'), 'the README no longer states the number of figures claimed');
  assert.ok(readme.includes('41 times'), 'the README no longer states the total gap');
});
