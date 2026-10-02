/**
 * A provisional flag has to cover the whole carry-forward, not the column its
 * author was looking at.
 *
 * Day 8 built `status: 'provisional'`; Day 28 split it into per-figure entries
 * so the flag said *which* figure; Day 37 found that two of those entries said
 * which figure and still under-reported it by four fifths.
 *
 * Idaho's 2026 zero bracket is one indexed amount that Idaho Code § 63-3024
 * applies at `$4,811` for single and separate filers and at twice that for
 * joint, head-of-household and surviving-spouse filers. The ledger named
 * `rate.byStatus.single.0.upTo` and stopped, so a caller inspecting
 * `provisionalFigures` to decide which numbers to check was told about one of
 * the five. Ohio was the same shape and worse: three indexed exemption amounts,
 * identical in all five columns because Ohio's exemption does not vary by
 * status, flagged in the `single` column alone — three of fifteen.
 *
 * **THE RULE: a `byStatus` table holds one figure per status, so a provisional
 * entry written for one status flags one fifth of the carry-forward.**
 *
 * This is Day 33's finding in the ledger rather than in the suite — there, a
 * `byStatus` table was *tested* by the statuses somebody had filed as; here it
 * is *described* by the status somebody happened to be reading. Both times the
 * missing four were invisible because the one that was there looked right.
 *
 * The file asserts the general rule rather than the two states, so the next
 * state-year to carry an indexed per-status figure cannot repeat it. It also
 * asserts the rule is not vacuous: if no provisional path mentioned a filing
 * status at all, everything below would pass while checking nothing.
 *
 * Note what is deliberately NOT asserted. Sibling ARRAY entries are not
 * co-carried: Ohio's exemption chart has a fourth step whose amount is `0`,
 * which is not an indexed figure and is correctly unflagged. "Published in the
 * same table" is a fact about filing statuses and not about array indices, so
 * only the first is a rule.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  FILING_STATUSES,
  SUPPORTED_STATES,
  SUPPORTED_YEARS,
  getStateDefinition,
} from './strict.mjs';

/** Walk a dot path, treating numeric segments as array indices. */
const resolve = (root, path) => {
  let node = root;
  for (const segment of path.split('.')) {
    if (node === undefined || node === null) return undefined;
    node = node[segment];
  }
  return node;
};

/** Every (definition, provisional figure) pair in the package. */
const entries = () =>
  SUPPORTED_YEARS.flatMap((year) =>
    SUPPORTED_STATES.flatMap((state) => {
      const definition = getStateDefinition(state, year);
      return (definition?.provisionalFigures ?? []).map((figure) => ({ definition, figure }));
    }),
  );

/** The positions in a dot path that name a filing status. */
const statusPositions = (path) =>
  path.split('.').flatMap((segment, index) => (FILING_STATUSES.includes(segment) ? [index] : []));

const withStatusAt = (path, index, status) => {
  const segments = path.split('.');
  segments[index] = status;
  return segments.join('.');
};

test('a provisional figure under a filing status is flagged under every filing status', () => {
  let checked = 0;
  for (const { definition, figure } of entries()) {
    for (const position of statusPositions(figure.path)) {
      for (const status of FILING_STATUSES) {
        const sibling = withStatusAt(figure.path, position, status);
        if (typeof resolve(definition, sibling) !== 'number') continue;
        checked += 1;
        assert.ok(
          (definition.provisionalFigures ?? []).some((other) => other.path === sibling),
          `${definition.code} ${definition.year}: '${figure.path}' is flagged provisional but ` +
            `'${sibling}' is the same figure for another filing status and is not. A state ` +
            `publishes every column of a table at once, so either both are carried forward or ` +
            `neither is — flag the sibling, or flag the subtree above them as California does.`,
        );
      }
    }
  }
  // Without this the assertion above passes on a package that has no per-status
  // provisional figure at all, which is the state it was in before Day 37
  // counted them. Day 27's non-vacuity rule, applied to a structural check.
  assert.ok(
    checked > 0,
    'no provisional figure names a filing status, so the rule above checked nothing',
  );
});

test('the two state-years Day 37 corrected still carry every column', () => {
  // Written from the structure rather than from the count, so it cannot be
  // satisfied by a list that happens to be the right length.
  const idaho = getStateDefinition('ID', 2026);
  assert.deepEqual(
    [...FILING_STATUSES]
      .map((status) => `rate.byStatus.${status}.0.upTo`)
      .filter((path) => idaho.provisionalFigures.some((f) => f.path === path)).length,
    FILING_STATUSES.length,
    "Idaho's zero bracket is one indexed figure in five columns",
  );

  const ohio = getStateDefinition('OH', 2026);
  for (const status of FILING_STATUSES) {
    for (const step of [0, 1, 2]) {
      const path = `exemption.perExemptionSteps.${status}.${step}.amount`;
      assert.ok(
        ohio.provisionalFigures.some((f) => f.path === path),
        `Ohio 2026 should flag ${path}`,
      );
    }
  }
  // And the fourth step, which is $0 and is not an indexed figure, must NOT be
  // flagged — otherwise the fix above is just "flag everything", which tells a
  // caller as little as flagging one column did.
  assert.ok(
    !ohio.provisionalFigures.some((f) => f.path.endsWith('.3.amount')),
    "Ohio's fourth exemption step is $0 by statute and is not awaiting publication",
  );
});
