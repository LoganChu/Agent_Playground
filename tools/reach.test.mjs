/**
 * The reach ledger's own tests — the pure half, with no network in it.
 *
 * `tools/reach.mjs` exists because two consecutive days read a download counter
 * that this repository's own release job had just reset. The arithmetic that
 * fixes that is the part worth pinning: banking a generation, summing across
 * generations once the live one is gone, and grouping by push.
 *
 * Covered by `preflight`'s `tools/*.test.mjs` glob by arriving, which is the
 * Day 65 rule and the reason that row is a glob rather than a list of files.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bank, cohorts, cumulative, kind, COHORT_MINUTES, MATCH_TOLERANCE } from './reach.mjs';

const empty = () => ({ firstRecorded: null, lastRecorded: null, runs: 0, generations: {} });
const at = (iso) => new Date(iso).toISOString();

test('a page and a tarball are told apart by extension, and nothing else is either', () => {
  assert.equal(kind('state-tax-checks.html'), 'page');
  assert.equal(kind('us-state-tax-0.65.0.tgz'), 'tarball');
  assert.equal(kind('SHA256SUMS'), 'other');
});

test('banking one observation records it, and a second run does not double it', () => {
  const l = empty();
  const a = [{ id: '1', name: 'p.html', tag: 'calculator', downloads: 3, createdAt: at('2026-11-19T20:00:00Z') }];
  bank(l, a, at('2026-11-20T16:00:00Z'));
  bank(l, a, at('2026-11-21T16:00:00Z'));
  assert.equal(Object.keys(l.generations).length, 1);
  assert.equal(l.generations['1'].downloads, 3);
  assert.equal(l.runs, 2);
  assert.equal(l.generations['1'].firstSeen, at('2026-11-20T16:00:00Z'));
  assert.equal(l.generations['1'].lastSeen, at('2026-11-21T16:00:00Z'));
});

test('a counter that goes DOWN within one generation is not believed', () => {
  // GitHub's count is monotonic per asset object, so a fall means a bad read,
  // and a bad read must not erase a figure that is already banked.
  const l = empty();
  bank(l, [{ id: '1', name: 'p.html', tag: 't', downloads: 9, createdAt: at('2026-11-01T00:00:00Z') }], at('2026-11-20T00:00:00Z'));
  bank(l, [{ id: '1', name: 'p.html', tag: 't', downloads: 0, createdAt: at('2026-11-01T00:00:00Z') }], at('2026-11-21T00:00:00Z'));
  assert.equal(l.generations['1'].downloads, 9);
});

test('THE WHOLE POINT: a replaced asset keeps its downloads in the total', () => {
  // This is Day 84 and Day 85's error, in three lines. The asset object that
  // had 1 download was replaced by `--clobber`; the API now reports 0 for a new
  // id and nothing anywhere remembers the 1. The ledger does.
  const l = empty();
  bank(l, [{ id: 'old', name: 'p.html', tag: 'calculator', downloads: 1, createdAt: at('2026-11-18T20:00:00Z') }], at('2026-11-19T16:00:00Z'));
  bank(l, [{ id: 'new', name: 'p.html', tag: 'calculator', downloads: 0, createdAt: at('2026-11-19T20:44:00Z') }], at('2026-11-20T16:00:00Z'));

  const live = new Set(['new']);
  const [page] = cumulative(l, live);
  assert.equal(page.name, 'p.html');
  assert.equal(page.generations, 2);
  assert.equal(page.retired, 1, 'the replaced generation is retired, not deleted');
  assert.equal(page.downloads, 1, 'the retired generation still counts toward the total');
  assert.equal(page.live, 0, 'and the live generation is reported separately, at its own figure');
});

test('a total across generations is a LOWER bound, which the retired count exposes', () => {
  // Nothing here can know about a generation that lived and died between two
  // runs. The test is that the shape makes that visible rather than hiding it:
  // `retired` counts what was seen, so a reader can tell 2 generations from 20.
  const l = empty();
  for (const [id, dl] of [['g1', 4], ['g2', 2]]) {
    bank(l, [{ id, name: 'p.html', tag: 't', downloads: dl, createdAt: at('2026-11-01T00:00:00Z') }], at('2026-11-02T00:00:00Z'));
  }
  const [page] = cumulative(l, new Set(['g2']));
  assert.equal(page.downloads, 6);
  assert.equal(page.generations, 2);
});

test('one push is one cohort, and two pushes two hours apart are not', () => {
  const mk = (id, iso) => ({ id, name: `${id}.tgz`, tag: id, downloads: 0, createdAt: at(iso) });
  const one = cohorts([mk('a', '2026-11-19T18:43:00Z'), mk('b', '2026-11-19T18:45:00Z')]);
  assert.equal(one.length, 1, `${COHORT_MINUTES} minutes apart or less is one push`);
  assert.equal(one[0].assets.length, 2);

  const two = cohorts([mk('a', '2026-11-19T18:43:00Z'), mk('c', '2026-11-19T20:44:00Z')]);
  assert.equal(two.length, 2, 'Day 85 made the tarballs and the pages on different pushes');
});

test('cohorts come back oldest first, whatever order they went in', () => {
  const mk = (id, iso) => ({ id, name: `${id}.tgz`, tag: id, downloads: 0, createdAt: at(iso) });
  const out = cohorts([mk('late', '2026-11-19T20:00:00Z'), mk('early', '2026-11-01T00:00:00Z')]);
  assert.deepEqual(out.map((c) => c.assets[0].id), ['early', 'late']);
});

test('the matching tolerance is wide enough for the gap it exists to span', () => {
  // The pages were 0.82 days old and the tarballs 0.91 when this was written.
  // A tolerance that excluded them would make the headline comparison empty and
  // the tool would report nothing while looking like it had measured something.
  const page = 0.82;
  const tarball = 0.91;
  assert.ok(Math.abs(tarball - page) <= page * MATCH_TOLERANCE);
  // And narrow enough to exclude what Day 84 actually compared against.
  assert.ok(Math.abs(49 - page) > page * MATCH_TOLERANCE, '49-day-old assets are not a control group');
});
