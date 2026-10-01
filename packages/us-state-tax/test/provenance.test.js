/**
 * The provenance ledger, and the one question it exists to answer.
 *
 * Day 37 walked every numeric parameter of every state-year and compared the
 * two years this package ships:
 *
 *   figures identical in 2025 and 2026            1,016
 *     flagged as carried forward                     169
 *     explained by nothing at all                    847
 *
 * Each of those 847 is one of two unrelated things — a figure the law fixes, or
 * a figure nobody read — and nothing in the package said which. `src/data/
 * provenance.ts` is the answer and this file is what keeps it honest.
 *
 * Six assertions, in the order they would catch a defect:
 *
 *   1. COVERAGE      every figure in every state-year resolves to exactly one
 *                    entry, and every entry is needed by at least one figure.
 *   2. NO TIES       two entries of equal specificity matching one figure is a
 *                    defect in the ledger, not something to resolve at lookup
 *                    time, so the test fails rather than letting the resolver
 *                    pick.
 *   3. CONSTANCY     checked in BOTH directions. An entry claiming its figures
 *                    never move fails if one moves; one claiming they move
 *                    fails if none does. An `indexed` entry claiming constancy
 *                    needs a written reason.
 *   4. EVIDENCE      an entry's `document` must be a substring of a citation
 *                    the state-year already carries. The ledger maps figures to
 *                    evidence this package has; it may not invent evidence.
 *   5. AGREEMENT     `carried-forward` here and `provisionalFigures` there must
 *                    name the same figures, both ways.
 *   6. BACKLOG       the number of `unestablished` figures is pinned and may go
 *                    down, not up.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SUPPORTED_STATES,
  SUPPORTED_YEARS,
  getStateDefinition,
  supportedYears,
} from '../dist/esm/index.js';
import {
  STATE_FIGURE_PROVENANCE,
  documentsBehindFigures,
  isSentinelFigure,
  newYearCost,
  stateFigureProvenance,
  stateFigureProvenanceMatches,
  stateFigureSpecificity,
} from '../dist/esm/data/provenance.js';

/** Every numeric leaf of a definition, as a dot path. `citations` is prose. */
function figurePaths(node, path, out) {
  if (node === null || node === undefined) return out;
  if (typeof node === 'number') {
    out.push(path);
    return out;
  }
  if (Array.isArray(node)) {
    node.forEach((value, index) => figurePaths(value, `${path}.${index}`, out));
    return out;
  }
  if (typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (path === '' && (key === 'citations' || key === 'provisionalFigures')) continue;
      figurePaths(value, path === '' ? key : `${path}.${key}`, out);
    }
  }
  return out;
}

const at = (root, path) => {
  let node = root;
  for (const segment of path.split('.')) {
    if (node === undefined || node === null) return undefined;
    node = node[segment];
  }
  return node;
};

/** Every (state, year, definition) this package has. */
const everyStateYear = () =>
  SUPPORTED_STATES.flatMap((state) =>
    supportedYears(state).map((year) => ({ state, year, definition: getStateDefinition(state, year) })),
  );

/** Figures that are not read from a document: a bracket with no ceiling, and the like. */
const realFigures = (definition) =>
  figurePaths(definition, '', []).filter((path) => !isSentinelFigure(at(definition, path)));

test('every figure in every state-year has exactly one provenance entry', () => {
  const uncovered = [];
  let covered = 0;
  for (const { state, year, definition } of everyStateYear()) {
    for (const path of realFigures(definition)) {
      const entry = stateFigureProvenance(definition, state, year, path);
      if (entry === undefined) uncovered.push(`${state} ${year}  ${path}`);
      else covered += 1;
    }
  }
  assert.deepEqual(
    uncovered.slice(0, 25),
    [],
    `${uncovered.length} figures have no provenance entry (first 25 shown)`,
  );
  // A coverage test that covers nothing passes. This is the figure the README
  // quotes, so it is measured here rather than remembered.
  assert.ok(covered > 2_000, `only ${covered} figures were checked`);
});

test('every ledger entry is needed by at least one figure', () => {
  const unused = [];
  for (const entry of STATE_FIGURE_PROVENANCE) {
    const years = entry.years ?? SUPPORTED_YEARS;
    const used = years.some((year) => {
      const definition = getStateDefinition(entry.state, year);
      if (definition === undefined) return false;
      return realFigures(definition).some(
        (path) =>
          stateFigureProvenanceMatches(entry.path, path) &&
          stateFigureProvenance(definition, entry.state, year, path) === entry,
      );
    });
    if (!used) unused.push(`${entry.state} ${entry.path}${entry.years ? ` ${entry.years}` : ''}`);
  }
  // An entry nothing needs is how a ledger rots into a description of a package
  // that no longer exists — the same defect `provisional.test.js` guards against
  // for the provisional paths.
  assert.deepEqual(unused, [], 'ledger entries matched by no figure, or outranked everywhere');
});

test('no two entries of equal specificity match the same figure', () => {
  const ties = [];
  for (const { state, year, definition } of everyStateYear()) {
    for (const path of realFigures(definition)) {
      const applicable = STATE_FIGURE_PROVENANCE.filter(
        (entry) =>
          entry.state === state &&
          (entry.years === undefined || entry.years.includes(year)) &&
          stateFigureProvenanceMatches(entry.path, path),
      );
      if (applicable.length < 2) continue;
      const ranked = applicable
        .map((entry) => ({ entry, rank: stateFigureSpecificity(entry).join(':') }))
        .sort((a, b) => (a.rank < b.rank ? 1 : -1));
      if (ranked[0].rank === ranked[1].rank) {
        ties.push(`${state} ${year} ${path}: ${ranked[0].entry.path} vs ${ranked[1].entry.path}`);
      }
    }
  }
  assert.deepEqual(ties.slice(0, 10), [], `${ties.length} figures match two equally specific entries`);
});

test('an entry claiming constancy has figures that do not move, and the reverse', () => {
  let checkedBothWays = 0;
  let vacuous = 0;
  for (const entry of STATE_FIGURE_PROVENANCE) {
    const years = (entry.years ?? SUPPORTED_YEARS).filter(
      (year) => getStateDefinition(entry.state, year) !== undefined,
    );
    // Figures this entry actually wins, per year.
    const byYear = years.map((year) => {
      const definition = getStateDefinition(entry.state, year);
      const own = realFigures(definition).filter(
        (path) => stateFigureProvenance(definition, entry.state, year, path) === entry,
      );
      return { year, values: new Map(own.map((path) => [path, at(definition, path)])) };
    });
    if (byYear.length < 2) {
      // Nothing can move inside one year, so `constant: false` is unsatisfiable
      // there and is a defect in the entry rather than a claim about the data.
      assert.equal(
        entry.constant,
        true,
        `${entry.state} ${entry.path} covers one year, so constant: false can never be true`,
      );
      vacuous += 1;
      continue;
    }
    checkedBothWays += 1;
    const moved = [];
    const first = byYear[0];
    for (const later of byYear.slice(1)) {
      for (const [path, value] of later.values) {
        if (first.values.has(path) && first.values.get(path) !== value) moved.push(path);
      }
    }
    if (entry.constant) {
      assert.deepEqual(
        moved,
        [],
        `${entry.state} ${entry.path} claims its figures never move, and these did: ${moved.join(', ')}`,
      );
    } else {
      assert.ok(
        moved.length > 0,
        `${entry.state} ${entry.path} claims its figures move and not one of them did — ` +
          'which is the shape of a silent carry-forward. Either the figures are stale or the claim is.',
      );
    }
  }
  // A ledger of single-year entries would pass the loop above while checking
  // nothing, so the split is asserted rather than hoped for.
  assert.ok(
    checkedBothWays >= vacuous,
    `${vacuous} entries cover one year and only ${checkedBothWays} span two; ` +
      'the constancy check is mostly vacuous',
  );
});

test('an indexed figure that has not moved says why it is not a carry-forward', () => {
  // The Illinois failure in general form. An indexed figure sitting still for a
  // year looks exactly like a figure nobody read, so it may not pass in silence.
  for (const entry of STATE_FIGURE_PROVENANCE) {
    if (entry.kind !== 'indexed' || !entry.constant) continue;
    const years = (entry.years ?? SUPPORTED_YEARS).filter(
      (year) => getStateDefinition(entry.state, year) !== undefined,
    );
    if (years.length < 2) continue;
    assert.ok(
      (entry.why ?? '').length > 40,
      `${entry.state} ${entry.path} is indexed, has not moved across ${years.join('/')}, and gives no reason`,
    );
  }
});

test("an entry's document is a citation the state-year already carries", () => {
  const missing = [];
  for (const entry of STATE_FIGURE_PROVENANCE) {
    if (entry.document === undefined) continue;
    for (const year of entry.years ?? SUPPORTED_YEARS) {
      const definition = getStateDefinition(entry.state, year);
      if (definition === undefined) continue;
      if (!definition.citations.some((citation) => citation.title.includes(entry.document))) {
        missing.push(`${entry.state} ${year}: '${entry.document}' for ${entry.path}`);
      }
    }
  }
  assert.deepEqual(
    missing,
    [],
    'a figure cites a document its state-year does not list. Either the citation is missing from ' +
      'the definition or the ledger invented it, and the second is worse than a missing citation.',
  );
});

test('every kind that asserts a document has one, and the two that cannot do not', () => {
  for (const entry of STATE_FIGURE_PROVENANCE) {
    const needsDocument = !['sentinel', 'unestablished', 'derived'].includes(entry.kind);
    if (needsDocument) {
      assert.ok(
        entry.document !== undefined,
        `${entry.state} ${entry.path} is '${entry.kind}' and names no document`,
      );
    }
    assert.ok(entry.cite.length > 20, `${entry.state} ${entry.path} has no usable cite`);
  }
});

test('carried-forward here and provisionalFigures there name the same figures', () => {
  const ledgerSays = [];
  const definitionSays = [];
  for (const { state, year, definition } of everyStateYear()) {
    const flagged = new Set();
    for (const figure of definition.provisionalFigures ?? []) {
      for (const path of realFigures(definition)) {
        if (path === figure.path || path.startsWith(`${figure.path}.`)) flagged.add(path);
      }
    }
    for (const path of realFigures(definition)) {
      const entry = stateFigureProvenance(definition, state, year, path);
      const carried = entry?.kind === 'carried-forward';
      if (carried && !flagged.has(path)) ledgerSays.push(`${state} ${year} ${path}`);
      if (!carried && flagged.has(path) && entry?.kind !== 'determined-after-year-end') {
        definitionSays.push(`${state} ${year} ${path} (ledger says '${entry?.kind}')`);
      }
    }
  }
  assert.deepEqual(
    ledgerSays.slice(0, 15),
    [],
    `${ledgerSays.length} figures the ledger calls carried forward are not flagged provisional`,
  );
  assert.deepEqual(
    definitionSays.slice(0, 15),
    [],
    `${definitionSays.length} figures flagged provisional are not carried-forward in the ledger`,
  );

  // And the YEAR they agree on. Two ledgers saying a figure is carried forward
  // from different years is worse than one of them not saying it at all, and
  // the mutation harness sets every bare year in a built package wrong on
  // purpose — so without this, a ledger entry claiming 2025 could become one
  // claiming 4051 with nothing to notice.
  let compared = 0;
  for (const { state, year, definition } of everyStateYear()) {
    for (const figure of definition.provisionalFigures ?? []) {
      if (figure.carriedForwardFrom === undefined) continue;
      const entry = stateFigureProvenance(definition, state, year, figure.path);
      if (entry === undefined || entry.kind !== 'carried-forward') continue;
      compared += 1;
      assert.equal(
        entry.carriedForwardFrom,
        figure.carriedForwardFrom,
        `${state} ${year} ${figure.path}: the ledger says it came from ` +
          `${entry.carriedForwardFrom} and provisionalFigures says ${figure.carriedForwardFrom}`,
      );
      assert.ok(
        SUPPORTED_YEARS.includes(entry.carriedForwardFrom),
        `${state} ${year} ${figure.path} is carried forward from ${entry.carriedForwardFrom}, ` +
          'which is not a year this package has',
      );
    }
  }
  assert.ok(compared > 20, `only ${compared} carried-forward years were compared`);
});

test('every non-finite figure is Infinity, which is what a missing ceiling means', () => {
  // Stronger than an exclusion list, and the reason sentinels are identified by
  // value rather than by path: a NaN or a negative infinity anywhere in the
  // parameters would be a bug that no amount of path-matching would find.
  let sentinels = 0;
  for (const { state, year, definition } of everyStateYear()) {
    for (const path of figurePaths(definition, '', [])) {
      const value = at(definition, path);
      if (Number.isFinite(value)) continue;
      sentinels += 1;
      assert.equal(value, Infinity, `${state} ${year} ${path} is ${value}`);
    }
  }
  assert.ok(sentinels > 100, `only ${sentinels} sentinel figures found`);
});

test('the unestablished backlog is this size and no larger', () => {
  const open = [];
  for (const { state, year, definition } of everyStateYear()) {
    for (const path of realFigures(definition)) {
      const entry = stateFigureProvenance(definition, state, year, path);
      if (entry?.kind === 'unestablished') open.push(`${state} ${year} ${path}`);
    }
  }
  // Day 37's measurement. The point of pinning it is that it may go DOWN: a
  // future run that reads one state's statute closes a block of these and
  // lowers the number, and one that guesses a kind to make the number smaller
  // has broken the only thing the ledger is for.
  assert.ok(
    open.length <= 0,
    `${open.length} figures are 'unestablished', above the pinned 0:\n  ${open.slice(0, 20).join('\n  ')}`,
  );
  for (const entry of STATE_FIGURE_PROVENANCE) {
    if (entry.kind !== 'unestablished') continue;
    assert.ok(
      (entry.resolvedBy ?? '').length > 25,
      `${entry.state} ${entry.path} is unestablished and does not say what would settle it`,
    );
  }
});

test('what a new tax year costs is derived from the data, not listed by hand', () => {
  // The operational payload. For one state it must add up to every figure the
  // state has, and the kinds that cost nothing must be distinguishable from the
  // ones that cost a document.
  for (const state of ['NJ', 'MD', 'CA']) {
    const definition = getStateDefinition(state, 2026);
    const paths = figurePaths(definition, '', []);
    const counts = newYearCost(definition, state, 2026, paths);
    const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
    assert.equal(total, paths.length, `${state}: ${total} figures classified of ${paths.length}`);
  }
  // New Jersey indexes nothing, so a new tax year costs it no release at all.
  const nj = getStateDefinition('NJ', 2026);
  const njCounts = newYearCost(nj, 'NJ', 2026, figurePaths(nj, '', []));
  assert.equal(njCounts.get('indexed'), undefined, 'New Jersey indexes nothing');
  assert.equal(njCounts.get('carried-forward'), undefined, 'nothing in New Jersey is carried forward');
  // California is the other end of the range: it indexes nearly everything, so
  // nearly everything in 2026 is a carry-forward — but NOT the rates, and that
  // is the distinction the whole field exists to draw. § 17041 prints the nine
  // rates and no indexing provision moves them, so a California caller can
  // rely on the rate completely while the thresholds it applies to are unread.
  const ca = getStateDefinition('CA', 2026);
  const caCounts = newYearCost(ca, 'CA', 2026, figurePaths(ca, '', []));
  assert.ok(
    (caCounts.get('carried-forward') ?? 0) > 70,
    `California 2026 should be mostly carried forward, got ${caCounts.get('carried-forward')}`,
  );
  assert.ok(
    (caCounts.get('statute') ?? 0) >= 45,
    'the 45 statutory California rates must come back as statute, not as carried forward',
  );
  // The two numbers must disagree, which is the whole point: a ledger in which
  // every California figure had the same kind would be the subtree flag again.
  assert.notEqual(caCounts.get('statute'), caCounts.get('carried-forward'));
});

test('the documents behind a state-year are a subset of its citations', () => {
  let found = 0;
  for (const { state, year, definition } of everyStateYear()) {
    const behind = documentsBehindFigures(definition.citations, state, year);
    for (const citation of behind) {
      assert.ok(definition.citations.includes(citation), `${state} ${year}: citation not from the list`);
    }
    found += behind.length;
    if (realFigures(definition).length > 1) {
      assert.ok(
        behind.length > 0,
        `${state} ${year} has figures and no document behind any of them`,
      );
    }
  }
  assert.ok(found > 60, `only ${found} documents are behind a figure`);
});
