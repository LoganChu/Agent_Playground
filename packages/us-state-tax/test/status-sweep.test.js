// Every filing status of every taxing state-year, priced — and a proof that the
// pins are load-bearing.
//
// ## Why this file exists
//
// Day 33's mutation audit set every number in this package wrong one at a time and
// counted which ones no test noticed. 100 of 705 survived, and the largest group
// was one shape:
//
//   California  `separate` in the exemption credit, the renter's credit, the AGI
//               limit and the standard deduction
//   Maryland    `headOfHousehold` in the itemized-deduction limit, the senior
//               credit, the poverty credit's income limit and the exemption
//   Ohio        `headOfHousehold` in the business-income limit and the exemption
//   Utah, Pennsylvania, New Jersey, New York, Georgia — `separate` again
//
// **THE RULE: a `byStatus` table is tested by the statuses somebody filed, and
// nobody files separately.** Married-filing-separately and head-of-household carry
// their own numbers in nearly every state here and are the two statuses a test
// author reaches for last. Massachusetts proves it is about attention and not
// about the statuses: there the *separate* cell is the tested one and the other
// three are not.
//
// So this file removes the choice. Every household runs under all five statuses in
// every state-year, and `status-households.mjs` explains why there are eighteen of
// them and why a doubling ladder is the right shape for a battery that has to catch
// doubling mutations.
//
// ## What the pins are evidence of, and what they are not
//
// Exactly what `bracket-pins.test.js` says of its own: they are a REGRESSION GUARD.
// Every expected figure was computed by this package, so Day 27's rule applies in
// full — a test written from the data can only confirm the data. These pins cannot
// tell you a state parameter is right. The correctness evidence is elsewhere and is
// unaffected by this file: the per-state test files, each citing a statute, and
// `tools/differential`, which compares 779 households against an independently
// built model.
//
// What the pins CAN say is that no parameter moved without somebody saying so.
//
// ## The second test is the one that makes the first one honest
//
// A pin file proves nothing about coverage on its own: 3,420 rows that all happen
// to be zero would pass every day and guard nothing. So the companion test asks the
// mutation harness's question *inside the suite* — it takes every `byStatus` cell
// the package ships, sets it wrong, and requires that some pinned row moves.
//
// That makes the two instruments agree by construction rather than by luck. The
// harness in `tools/mutation` is slow (ten minutes, so it runs weekly); this runs in
// a second on every push, and if it passes then the harness cannot find a surviving
// `byStatus` cell, because a survivor is exactly a cell no assertion notices.
//
// **THE RULE: a fixture of expected values and a proof that the values are
// sensitive are two different tests, and only the second one is about coverage.**
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FILING_STATUSES,
  NO_INCOME_TAX_STATES,
  SUPPORTED_STATES,
  SUPPORTED_YEARS,
  getStateDefinition,
  stateIncomeTax,
} from './strict.mjs';
import { DIGEST_COLUMNS, HOUSEHOLDS, digest, household } from './status-households.mjs';

const PINS = JSON.parse(readFileSync(new URL('./status-sweep.json', import.meta.url), 'utf8'));
const TAXING = SUPPORTED_STATES.filter((s) => !NO_INCOME_TAX_STATES.includes(s));
const STATUSES = new Set(FILING_STATUSES);

const parse = (row) => {
  const [year, state, filingStatus, name, ...figures] = row.split('|');
  return { year: Number(year), state, filingStatus, name, expected: figures.map(Number) };
};

test('every pinned household still owes what it owed', () => {
  assert.equal(PINS.columns.length, 4 + DIGEST_COLUMNS.length);
  assert.ok(PINS.rows.length > 4_000, 'the fixture is present and not truncated');
  for (const row of PINS.rows) {
    const { year, state, filingStatus, name, expected } = parse(row);
    const actual = digest(stateIncomeTax(household(name, state, year, filingStatus)));
    assert.deepEqual(
      actual,
      expected,
      `${state} ${year} ${filingStatus} ${name}: ${DIGEST_COLUMNS.join('/')} was ${expected.join('/')} and is now ${actual.join('/')}`,
    );
  }
});

test('the fixture covers every state, year, status and household this package ships', () => {
  // A pin file gone stale reports on a package that no longer exists. Adding a
  // state, a year or a household without regenerating fails HERE rather than
  // silently narrowing the guard — the same rule `bracket-pins.test.js` applies to
  // itself, and the same rule Day 32 found in the differential harness: a report
  // that cannot see a gap is the last place that will tell you about one.
  const seen = new Set(PINS.rows.map((r) => r.split('|').slice(0, 4).join('|')));
  let expected = 0;
  for (const year of SUPPORTED_YEARS) {
    for (const state of TAXING) {
      for (const filingStatus of FILING_STATUSES) {
        for (const name of HOUSEHOLDS) {
          const key = `${year}|${state}|${filingStatus}|${name}`;
          assert.ok(seen.has(key), `${key} is shipped and not pinned — regenerate the fixture`);
          expected++;
        }
      }
    }
  }
  assert.equal(
    seen.size,
    expected,
    'a pinned row names a state, year, status or household that is no longer shipped — regenerate the fixture',
  );
});

test('a state with no income tax answers zero for every status and household', () => {
  // Not in the fixture, because 1,620 rows of zeros is not a guard, it is weight.
  // The claim is structural and belongs in a loop.
  for (const year of SUPPORTED_YEARS) {
    for (const state of NO_INCOME_TAX_STATES) {
      for (const filingStatus of FILING_STATUSES) {
        for (const name of HOUSEHOLDS) {
          const result = stateIncomeTax(household(name, state, year, filingStatus));
          assert.equal(result.hasIncomeTax, false, `${state} ${year}`);
          assert.equal(result.totalTax, 0, `${state} ${year} ${filingStatus} ${name}`);
        }
      }
    }
  }
});

// ---------------------------------------------------------------------------
// The coverage proof
// ---------------------------------------------------------------------------

/**
 * Every object in a definition whose own keys are exactly the five filing
 * statuses.
 *
 * Found by walking the tree rather than by listing the fields, because a list of
 * fields is a claim about the source and goes stale the day somebody adds a rule —
 * which is Day 33's rule about static analysis, applied to the audit itself. The
 * walk finds `ByStatus` tables nested at any depth, including inside arrays
 * (`retirementIncomeSubtractions[0].cap`) and inside sub-rules
 * (`exclusiveRetirementCredits.socialSecurity.phaseOutThreshold`).
 */
function byStatusTables(node, path, out, seen) {
  if (node === null || typeof node !== 'object' || seen.has(node)) return out;
  seen.add(node);
  if (!Array.isArray(node)) {
    const keys = Object.keys(node);
    if (keys.length === STATUSES.size && keys.every((k) => STATUSES.has(k))) {
      out.push({ path, table: node });
      return out;
    }
  }
  for (const [key, value] of Object.entries(node)) {
    byStatusTables(value, `${path}.${key}`, out, seen);
  }
  return out;
}

/**
 * Whether `tools/mutation/mutate.mjs` would mutate this number.
 *
 * Deliberately the harness's own filter — integers at or above 100 and decimals
 * strictly inside (0, 1) — so that passing this test means the harness finds no
 * surviving `byStatus` cell. A looser filter here would promise coverage the
 * harness does not measure; a tighter one would leave survivors this test called
 * clean. `Infinity` is out because it is an identifier and not a literal, so the
 * harness never mutates it either.
 */
const mutable = (v) =>
  typeof v === 'number' &&
  Number.isFinite(v) &&
  (Math.abs(v) >= 100 || (Math.abs(v) > 0 && Math.abs(v) < 1));

/**
 * The first mutable number inside a cell, which may be an array of steps.
 *
 * **The first, and this is the honest limit of the test below.** The 498 cells hold
 * **1,368** mutable numbers between them, and 100 of the cells hold more than one:
 *
 *   | path | cells with several numbers | what covers the rest |
 *   | --- | --- | --- |
 *   | `rate.byStatus` | 70 | `bracket-pins.test.js`, one probe inside every band |
 *   | `exemption.perExemptionSteps` | 20 | `registry.test.js` for the top step; the middle steps are Group 3 |
 *   | `householdCredit.base` | 10 | the low rungs of the battery; the middle rows are Group 3 |
 *
 * So the claim this file makes is exactly: **one number per table per status, which
 * is the whole of a scalar cell and the first row of a staircase.** A staircase needs
 * a probe inside each of its steps, which is a different instrument — the one
 * `bracket-pins.test.js` already is for rate schedules — and building it over every
 * `steps` / `bands` / `amountByAge` array is the next thing on
 * `tools/mutation/STATE-SURVIVORS.md`.
 *
 * Perturbing all 1,368 here instead would be the wrong trade twice over: it would
 * cost about 7 seconds on every push, and it would need a long allow-list for the
 * rows a general household battery cannot reach — which would be this test quietly
 * turning into the thing it exists to prevent.
 */
function firstMutableLeaf(value, path = '') {
  if (mutable(value)) return { path, value };
  if (value === null || typeof value !== 'object') return undefined;
  for (const [key, inner] of Object.entries(value)) {
    const hit = firstMutableLeaf(inner, `${path}.${key}`);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

function setAt(root, path, value) {
  const parts = path.split('.').filter(Boolean);
  let node = root;
  for (const part of parts.slice(0, -1)) node = node[Array.isArray(node) ? Number(part) : part];
  const last = parts[parts.length - 1];
  node[Array.isArray(node) ? Number(last) : last] = value;
}

/**
 * The cells the engine cannot reach, with the reason, and what covers them
 * instead.
 *
 * Day 29's rule: an unreachable figure cannot be wrong, which is why nobody checks
 * reachability. Writing a household for a parameter nothing reads would be worse
 * than leaving it, because it would assert that something matters when it does not.
 * So an entry here is a claim that has to be defended, and the test fails if one
 * becomes reachable — a stale exemption is how an audit starts lying.
 */
const NOT_REACHABLE_BY_ANY_HOUSEHOLD = {
  '.exemption.perFiler': {
    states: ['MD', 'OH'],
    why: 'a stored duplicate of the `perExemptionSteps` chart top step, which is what the engine reads',
    coveredBy: "registry.test.js — \"a stepped exemption's stored top step agrees with the chart\"",
  },
  // Missouri's $5,000 / $10,000 ceiling on the federal income tax deduction,
  // and the reason it is here is the most interesting thing about it: the
  // percentage chart ABOVE it makes it unreachable by any ordinary return.
  // 35% of a federal bill reaches $5,000 only at $14,286 of federal tax, which
  // nobody with $25,000 or less of Missouri AGI pays, and the three steps
  // below it need $40,000, $66,667 and $200,000 of federal tax against
  // Missouri AGI that is lower still.
  //
  // It became reachable in 2025, when HB 594 took capital gains out of the
  // very figure the chart is read against — so the household that reaches it
  // has an enormous gain and almost no other income, which is a tax-planning
  // case rather than a household this battery is for. `missouri.test.js`
  // builds it directly and also measures the most the cap can ever be worth.
  '.federalIncomeTaxDeduction.cap': {
    states: ['MO'],
    why: 'unreachable without a capital gain large enough to put a six-figure federal bill behind a five-figure Missouri AGI — the step chart above the cap bounds the income that could use it',
    coveredBy:
      'missouri.test.js — "the $5,000 cap could not bind before 2025 and binds now, for at most $181.68"',
  },
};

test('every byStatus cell the package ships moves a pinned answer', () => {
  const pinned = new Map(
    PINS.rows.map((row) => {
      const { year, state, filingStatus, name, expected } = parse(row);
      return [`${year}|${state}|${filingStatus}|${name}`, expected.join(',')];
    }),
  );
  const exempt = [];
  let checked = 0;
  for (const year of SUPPORTED_YEARS) {
    for (const state of TAXING) {
      const def = getStateDefinition(state, year);
      for (const { path, table } of byStatusTables(def, '', [], new WeakSet())) {
        for (const status of FILING_STATUSES) {
          const leaf = firstMutableLeaf(table[status]);
          if (leaf === undefined) continue;
          const where = `${state} ${year} ${path}.${status} = ${leaf.value}`;
          const at = `${status}${leaf.path}`;
          // A doubling, plus one so that a parameter of zero also changes. The
          // registry hands out the same object every call, so the perturbation is
          // an in-place write and the restore is a `finally` — a definition left
          // wrong by a thrown assertion would corrupt every test after this one.
          let moved = false;
          // Tracked separately from `moved`, and the reason is ALIASING rather
          // than anything about widows. `byStatus()` writes
          // `qualifyingSurvivingSpouse: v.qualifyingSurvivingSpouse ?? v.joint`,
          // so where the cell is an array or an object the two statuses hold the
          // SAME REFERENCE and an in-place write to one is a write to both. The
          // perturbation below therefore moves the JOINT column's answer, which
          // says nothing about whether the surviving-spouse column was read.
          // Only a household filed as a surviving spouse can answer that.
          let movedForWidow = false;
          try {
            setAt(table, at, leaf.value * 2 + 1);
            for (const filingStatus of FILING_STATUSES) {
              for (const name of HOUSEHOLDS) {
                const key = `${year}|${state}|${filingStatus}|${name}`;
                if (digest(stateIncomeTax(household(name, state, year, filingStatus))).join(',') !== pinned.get(key)) {
                  moved = true;
                  if (filingStatus === 'qualifyingSurvivingSpouse') movedForWidow = true;
                }
                if (moved && movedForWidow) break;
              }
              if (moved && movedForWidow) break;
            }
          } finally {
            setAt(table, at, leaf.value);
          }
          checked++;
          // The surviving-spouse cell of a state that HAS NO SUCH STATUS, which is
          // unreachable by construction rather than by a hand-written exemption:
          // `byStatus()` derives the cell from the joint one and the engine
          // translates the status before any table is read, so nothing can reach
          // it. Four states, both years — Alabama, Arizona, Mississippi and
          // Wisconsin; see `surviving-spouse-column.test.js`.
          //
          // Asserted the other way round from the ledger below, and that is the
          // point of putting it here: a cell that MOVED would mean the translation
          // missed a table, so this is a second and independent proof that it
          // reaches all of them. The first is that the widow's answer equals the
          // answer in the column the state sends her to, household by household.
          if (status === 'qualifyingSurvivingSpouse' && def.survivingSpouseFilesAs !== undefined) {
            exempt.push(where);
            assert.equal(
              movedForWidow,
              false,
              `${where}: ${state} files a surviving spouse as ` +
                `${def.survivingSpouseFilesAs.filesAs}, so nothing should read this cell — and ` +
                `a household's answer moved when it changed, which means the status translation ` +
                `is not reaching every by-status table`,
            );
            continue;
          }
          const allowed = NOT_REACHABLE_BY_ANY_HOUSEHOLD[path];
          if (allowed?.states.includes(state)) {
            exempt.push(where);
            assert.equal(
              moved,
              false,
              `${where} is listed as unreachable and a household now reaches it — delete the entry in NOT_REACHABLE_BY_ANY_HOUSEHOLD and let the pins cover it`,
            );
            continue;
          }
          assert.ok(
            moved,
            `${where} could be wrong and no pinned household would notice. Add a household to status-households.mjs that sits between the value and twice it — or, if nothing can reach it, say why in NOT_REACHABLE_BY_ANY_HOUSEHOLD.`,
          );
        }
      }
    }
  }
  // The counts are pinned so that a walk which silently stops finding tables — a
  // renamed field, a rule moved behind a function — fails instead of reporting a
  // clean sweep over nothing. That is the failure mode the mutation harness had on
  // its first run, and it printed 100%.
  assert.equal(checked, 928, 'byStatus cells with a parameter the harness would mutate');
  // And the number those cells CONTAIN, pinned beside the number probed so the gap
  // between them cannot widen unnoticed. See `firstMutableLeaf` for what covers it.
  let inside = 0;
  const countLeaves = (v) =>
    mutable(v) ? 1 : v === null || typeof v !== 'object' ? 0 : Object.values(v).reduce((a, b) => a + countLeaves(b), 0);
  for (const year of SUPPORTED_YEARS) {
    for (const state of TAXING) {
      for (const { table } of byStatusTables(getStateDefinition(state, year), '', [], new WeakSet())) {
        for (const status of FILING_STATUSES) inside += countLeaves(table[status]);
      }
    }
  }
  // The decomposition this message used to carry — "1,820 of them in 130
  // staircases" — was a figure nothing here computes, so Alabama's arrival could
  // not falsify it and it would have gone on being quoted while it drifted. The
  // two numbers now are both measured by the two assertions above and below.
  assert.equal(inside, 3_012, 'numbers inside those cells, 114 of them Wisconsin\'s');
  // 30 documented in NOT_REACHABLE_BY_ANY_HOUSEHOLD, plus 28 that are the
  // surviving-spouse cells of the four states which have no surviving-spouse
  // status — exempt by construction rather than by a ledger entry, and asserted
  // in the opposite direction. See the branch above.
  assert.equal(exempt.length, 58, 'cells the engine cannot reach, all of them documented');
});
