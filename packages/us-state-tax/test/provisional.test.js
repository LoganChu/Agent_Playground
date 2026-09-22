/**
 * The provisional ledger.
 *
 * Day 8 invented `status: 'provisional'` so this package could say out loud
 * that a figure was carried forward while every competitor carried it forward
 * silently. Day 27 resolved the first one ever — Illinois, nineteen days later
 * — and wrote the rule down: **a provisional flag is a debt, not a
 * disclaimer.**
 *
 * Day 28 found that half the sentence is wrong, and it is the half that decides
 * what a future run should do. Of the eight 2026 state-years flagged, two were
 * one search away and had been for months (Kentucky, Michigan), one was already
 * right and only wanted confirming (Maryland), one was half-resolvable
 * (Michigan's personal exemption is published and its special exemption is
 * not), and one CANNOT BE RESOLVED AT ALL during 2026 because Colorado's rate
 * is fixed by a TABOR calculation that runs after the tax year closes. One word
 * covered a debt somebody owed and a fact about the calendar, and nothing in
 * the data told them apart.
 *
 * So the flag is no longer prose. Every provisional state-year lists the
 * figures at issue, one entry each, saying which kind it is and what document
 * would settle it — and these four assertions keep the list honest:
 *
 *   1. COMPLETENESS   a provisional state-year must list at least one figure,
 *                     and a published one must list none.
 *   2. LIVENESS       every path must resolve, so the list cannot rot into a
 *                     description of a package that no longer exists.
 *   3. NON-VACUITY    a figure said to be carried forward from year Y must
 *                     still EQUAL the year-Y value. This is the one that would
 *                     have caught Illinois: the moment somebody updates a
 *                     figure and leaves the warning up, the suite goes red.
 *   4. ACTIONABILITY  `resolvedBy` must name a document, not a government.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SUPPORTED_STATES,
  SUPPORTED_YEARS,
  getStateDefinition,
} from '../dist/esm/index.js';

/** Walk a dot path, treating numeric segments as array indices. */
const resolve = (root, path) => {
  let node = root;
  for (const segment of path.split('.')) {
    if (node === undefined || node === null) return undefined;
    node = node[segment];
  }
  return node;
};

const everyDefinition = () =>
  SUPPORTED_YEARS.flatMap((year) =>
    SUPPORTED_STATES.map((state) => getStateDefinition(state, year)),
  );

const provisional = () => everyDefinition().filter((d) => d.status === 'provisional');

test('a provisional state-year lists the figures that make it provisional', () => {
  for (const def of provisional()) {
    assert.ok(
      Array.isArray(def.provisionalFigures) && def.provisionalFigures.length > 0,
      `${def.code} ${def.year} is provisional and says nothing about which figure is. ` +
        'Add provisionalFigures, or publish the state-year.',
    );
  }
  // There is no point to the check above if nothing is provisional.
  assert.ok(provisional().length > 0, 'no provisional state-year left to check');
});

test('a published state-year carries no provisional figures', () => {
  for (const def of everyDefinition()) {
    if (def.status === 'published') {
      assert.equal(
        def.provisionalFigures,
        undefined,
        `${def.code} ${def.year} is published and still lists provisional figures`,
      );
    }
  }
});

test('every provisional path resolves to a real figure', () => {
  for (const def of provisional()) {
    for (const figure of def.provisionalFigures) {
      assert.notEqual(
        resolve(def, figure.path),
        undefined,
        `${def.code} ${def.year} flags '${figure.path}', which is not in the definition. ` +
          'A path that stops resolving is a warning about a package that no longer exists.',
      );
    }
  }
});

test('a figure said to be carried forward still equals the year it came from', () => {
  let checked = 0;
  for (const def of provisional()) {
    for (const figure of def.provisionalFigures) {
      if (figure.carriedForwardFrom === undefined) continue;
      const source = getStateDefinition(def.code, figure.carriedForwardFrom);
      assert.deepEqual(
        resolve(def, figure.path),
        resolve(source, figure.path),
        `${def.code} ${def.year} says '${figure.path}' is carried forward from ` +
          `${figure.carriedForwardFrom}, and the two no longer agree. If the ${def.year} ` +
          'figure has been resolved, drop the entry (and the status, if it was the last one). ' +
          'A warning that outlives the thing it warns about is worse than no warning.',
      );
      checked += 1;
    }
  }
  assert.ok(checked > 0, 'no carried-forward figure was actually compared');
});

test('a carried-forward figure names a year this package has', () => {
  for (const def of provisional()) {
    for (const figure of def.provisionalFigures) {
      if (figure.carriedForwardFrom === undefined) continue;
      assert.ok(
        SUPPORTED_YEARS.includes(figure.carriedForwardFrom),
        `${def.code} ${def.year} carries '${figure.path}' from ${figure.carriedForwardFrom}, ` +
          'which this package does not have.',
      );
      assert.ok(
        figure.carriedForwardFrom < def.year,
        `${def.code} ${def.year} carries '${figure.path}' forward from ${figure.carriedForwardFrom}, ` +
          'which is not earlier.',
      );
    }
  }
});

test('every provisional figure says what would settle it, and names a document', () => {
  for (const def of provisional()) {
    for (const figure of def.provisionalFigures) {
      assert.ok(
        ['awaiting-publication', 'determined-after-year-end'].includes(figure.reason),
        `${def.code} ${def.year} '${figure.path}' has reason '${figure.reason}'`,
      );
      // Long enough to be a document and not a shrug. "the state" is 9.
      assert.ok(
        typeof figure.resolvedBy === 'string' && figure.resolvedBy.length > 30,
        `${def.code} ${def.year} '${figure.path}' does not name what would resolve it. ` +
          'Name the form, booklet or release a future run should go and read.',
      );
    }
  }
});

test('a figure the law fixes after the year ends is never a carry-forward', () => {
  // The two kinds are not degrees of the same thing. `awaiting-publication` is
  // last year's number standing in for one that exists somewhere; Colorado's
  // rate is the statutory figure standing in for one that does not exist
  // anywhere yet, and calling it a carry-forward would invite a future run to
  // go looking for a document that cannot be written until 2027.
  for (const def of provisional()) {
    for (const figure of def.provisionalFigures) {
      if (figure.reason !== 'determined-after-year-end') continue;
      assert.equal(
        figure.carriedForwardFrom,
        undefined,
        `${def.code} ${def.year} '${figure.path}' is determined after the year ends and is ` +
          'also marked a carry-forward. It is one or the other.',
      );
    }
  }
});

test('the two kinds are both in use, so neither assertion is vacuous', () => {
  const reasons = new Set(
    provisional().flatMap((d) => d.provisionalFigures.map((f) => f.reason)),
  );
  // Day 27's non-vacuity rule, applied to the ledger itself: if every entry
  // were one kind, the distinction this file exists to draw would be untested
  // and would go on passing for ever.
  assert.deepEqual(
    [...reasons].sort(),
    ['awaiting-publication', 'determined-after-year-end'],
    'both provisional reasons must be in use for the distinction to be tested',
  );
});

test('the 2026 figures resolved on Day 28 are in force and no longer flagged', () => {
  // Written from the SOURCE rather than from the parameter file, per Day 27:
  // each of these is the figure a named state document carries for 2026, and
  // the assertion is that this package agrees with the document.
  const kentucky = getStateDefinition('KY', 2026);
  assert.equal(kentucky.status, 'published');
  // Kentucky DOR press release, "Kentucky DOR Announces 2026 Standard
  // Deduction": $3,360, an increase of $90 over 2025's $3,270.
  assert.equal(kentucky.deduction.amounts.single, 3360);
  assert.equal(getStateDefinition('KY', 2025).deduction.amounts.single, 3270);

  const michigan = getStateDefinition('MI', 2026);
  // 2026 Michigan Income Tax Withholding Guide (Form 446, Rev. 02-26): the
  // annual amount per exemption is $5,900, up from $5,800.
  assert.equal(michigan.exemption.perDependent, 5900);
  assert.equal(getStateDefinition('MI', 2025).exemption.perDependent, 5800);
  // But Michigan is still provisional, on one figure, and that is the point of
  // the whole file: the special exemption appears on the MI-1040 and on no
  // withholding document, so nothing published in 2026 carries it.
  assert.equal(michigan.status, 'provisional');
  assert.deepEqual(
    michigan.provisionalFigures.map((f) => f.path),
    ['exemption.perBlindOrDisabledFiler'],
  );

  const maryland = getStateDefinition('MD', 2026);
  // 2026 Maryland Employer Withholding Guide and 2026 Form MW507, plus the HB
  // 411 (2026) fiscal note, which prices a rise to $4,100 against current law.
  // The figure never moved; only this package's confidence in it did.
  assert.equal(maryland.status, 'published');
  assert.equal(maryland.deduction.amounts.single, 3350);
  assert.equal(maryland.deduction.amounts.marriedFilingJointly, 6700);
});

test("Ohio's zero band is settled and only its exemption chart is not", () => {
  const ohio = getStateDefinition('OH', 2026);
  // HB 96 wrote "$332.00 plus 2.75% of the amount in excess of $26,050" into
  // R.C. 5747.02(A)(3), so the band is statutory for 2026 rather than indexed —
  // and the $332.00 constant exists only to keep the schedule continuous with
  // the band below it, which pins the two to each other.
  assert.deepEqual(ohio.rate.bands, [
    { upTo: 26_050, base: 0, rate: 0 },
    { upTo: Infinity, base: 332, rate: 0.0275 },
  ]);
  assert.deepEqual(
    ohio.provisionalFigures.map((f) => f.path),
    [
      'exemption.perExemptionSteps.single.0.amount',
      'exemption.perExemptionSteps.single.1.amount',
      'exemption.perExemptionSteps.single.2.amount',
    ],
  );
});

test('Colorado is provisional in a way no amount of looking can fix', () => {
  const colorado = getStateDefinition('CO', 2026);
  assert.equal(colorado.status, 'provisional');
  for (const figure of colorado.provisionalFigures) {
    assert.equal(figure.reason, 'determined-after-year-end');
  }
  // The direction matters and is asserted, not just described: 4.40% is the
  // statutory ceiling TABOR can only reduce, and 25% is the statutory floor the
  // legislature has raised in each of the last four years. So a Colorado 2026
  // return computed here is the most tax and the least credit Colorado can ask
  // for — which is the safe direction to be wrong in for a filer planning, and
  // the unsafe one for a state forecasting revenue.
  assert.equal(colorado.rate.rate, 0.044);
  assert.equal(colorado.earnedIncomeCredit.matchRate, 0.25);
  assert.ok(getStateDefinition('CO', 2025).rate.rate <= 0.044);
});
