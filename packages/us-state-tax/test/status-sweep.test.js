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
import {
  DIGEST_COLUMNS,
  FIGURE_SWEEP_OPTIONS,
  HOUSEHOLDS,
  digest,
  household,
} from './status-households.mjs';

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
    const actual = digest(
      stateIncomeTax(household(name, state, year, filingStatus), FIGURE_SWEEP_OPTIONS),
    );
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
          const result = stateIncomeTax(
            household(name, state, year, filingStatus),
            FIGURE_SWEEP_OPTIONS,
          );
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
  // IOWA'S JOINT AND SURVIVING-SPOUSE LOW-INCOME THRESHOLDS, AND THIS ENTRY IS
  // THE SECOND DRAFT. THE FIRST ONE CLAIMED THE WHOLE TABLE AND THE GUARD
  // REFUSED IT, WHICH IS THE BETTER FINDING.
  //
  // The claim that failed was that Iowa's non-elderly exemption "cannot change
  // an answer for any status", so no household could witness any cell of it.
  // The first half is true and the second does not follow, because the guard
  // does not ask whether the TRUE value matters — it asks whether a WRONG one
  // would be noticed, and it perturbs by doubling.
  //
  // > A PARAMETER THAT CANNOT CHANGE A CORRECT ANSWER IS NOT THEREBY INVISIBLE
  // > TO THE AUDIT, AND A PARAMETER THAT CHANGES EVERY ANSWER IS NOT THEREBY
  // > VISIBLE. "Does this figure matter?" and "would a wrong value be caught?"
  // > are different questions.
  //
  // Iowa's exemption answers them in opposite directions inside one table. The
  // threshold is tested on net income BEFORE the deduction, so a cell is
  // witnessable exactly where the band (that status's deduction, twice the
  // threshold] is non-empty -- and, once the $40 exemption credit is allowed
  // for, (that deduction + $1,052.63, twice the threshold]:
  //
  //   2025 single / separate   T=9,000   D=15,750   doubled 18,000   band (15,750, 18,000]
  //        head of household   T=13,500  D=23,625   doubled 27,000   band (23,625, 27,000]
  //        joint / surv.sp.    T=13,500  D=31,500   doubled 27,000   EMPTY
  //
  // Three cells are reachable and two are not, and the two that are not are the
  // ones whose DOUBLED threshold is still below the deduction. `wage17k6` was
  // added for the first pair and the battery already reached the third; joint
  // and surviving spouse are what is left, and no household can reach them at
  // any income because 27,000 < 31,500 in 2025 and 27,000 < 32,200 in 2026.
  //
  // THE ELDERLY TABLE IS NOT EXEMPTED AT ALL, and that is the sharpest half:
  // its joint and surviving-spouse cells are just as dead as these — $32,000
  // against a $33,100 deduction, so the provision cannot help those filers
  // either — and they are perfectly visible, because doubling $32,000 to
  // $64,000 does clear the deduction. Equally worthless, oppositely auditable.
  // `working66` witnesses all five of those cells at once.
  // Arkansas publishes no separate-return Low Income Tax Table and bars married
  // filing separately from the other seven, so this cell holds an empty table
  // and a ceiling of zero and the engine never looks at it. Perturbing either
  // cannot move any household's answer, at any income, in any status.
  //
  // IT IS LISTED HERE RATHER THAN SATISFIED BY AN ALIAS, which is the whole
  // reason the entry exists. Giving the cell the single filer's table — the
  // obvious tidy choice — makes `byStatusOf` hand both statuses the SAME ARRAY,
  // and an in-place perturbation of the separate cell is then a perturbation of
  // the single one: the guard goes green on a single filer's household and the
  // separate cell is never witnessed by anything. That is the aliasing the
  // surviving-spouse comment below describes, arriving through a different door.
  '.lowIncomeTaxTable.byStatus': {
    states: ['AR'],
    statuses: ['marriedFilingSeparately'],
    why: 'Arkansas bars married filing separately from the Low Income Tax Tables — the instructions print seven tables and none of them is for a separate return — so `ineligibleFilingStatuses` stops the engine before the table is read and the cell holds an empty table with a ceiling of zero. A separated Arkansan at $14,000 of AGI therefore pays the rate schedule on $14,000 less $2,470 where a single filer at the same income pays nothing at all, which is the provision this cell records the absence of.',
    coveredBy:
      'arkansas.test.js — "a separated filer is barred from the low-income tables and pays the schedule", which asserts the bar by computing the same income in both statuses and showing the separate figure is the schedule\'s',
  },
  '.zeroTaxThreshold.threshold': {
    states: ['IA'],
    statuses: ['marriedFilingJointly', 'qualifyingSurvivingSpouse'],
    why: "Iowa's $13,500 non-elderly threshold is tested on net income BEFORE the deduction, and TWICE it ($27,000) is still below the federal joint and surviving-spouse deduction ($31,500 in 2025, $32,200 in 2026) that Iowa adopts — so neither the true figure nor a doubled one can move any household's answer, at any income. The single, separate and head-of-household cells of the same table ARE reachable and are witnessed by `wage17k6` and the battery's existing households",
    coveredBy:
      'iowa.test.js — "the non-elderly exemption cannot bite in either year, and the elderly one only for single, head of household and separate", which DERIVES the partition from this package\'s own thresholds and the published federal deductions rather than asserting it; tools/cross-package/iowa-frozen-exemption.mjs then checks those federal figures against us-federal-tax\'s own, which this zero-dependency package cannot import',
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
                if (
                  digest(
                    stateIncomeTax(
                      household(name, state, year, filingStatus),
                      FIGURE_SWEEP_OPTIONS,
                    ),
                  ).join(',') !== pinned.get(key)
                ) {
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
          // `statuses`, where present, narrows the exemption to the cells it is
          // actually defended for. Iowa forced it: the SAME by-status table has
          // two cells no household can reach and three a household reaches, and
          // a whole-table exemption would have silently excused the three. An
          // exemption wider than its argument is how an audit starts lying,
          // which is what the comment on this object already says.
          if (
            allowed?.states.includes(state) &&
            (allowed.statuses === undefined || allowed.statuses.includes(status))
          ) {
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
  // 1,043 from Day 49: South Carolina adds 25, which is three bracket rows and
  // their ceilings in 2025, two rows and theirs in 2026, the SCIAD's base and
  // its phase-out start and denominator, and the recognized standard deduction —
  // all five statuses of each, every one of them reached by a pinned household.
  // 1,048 from Day 52: `recognizedStandardDeduction.increase`, five statuses, and
  // NOT ONE OF THEM WAS REACHABLE UNTIL THE BATTERY'S AGED HOUSEHOLDS GOT THEIR
  // § 63(f) ADDITION. The add-back is capped by the increase, and the cap only
  // binds where the federal deduction exceeds the state's recognized amount by
  // more than the increase — which is every filer of 65 and no filer under it.
  // This check is what said so: it asked for a household between the value and
  // twice it and there was none, in a battery with five aged shapes in it.
  // 1,058 from Day 60: Louisiana's ten are its five standard deduction cells in
  // each of two years, and three of the five are DERIVED from the single figure
  // by R.S. 47:294(A)(2)'s 200% rather than stored, so a mutation of the single
  // amount moves three cells at once.
  // 1,068 from Day 61: North Dakota's ten are its two bracket CEILINGS in each
  // of five statuses, in each of two years — twenty cells, of which the ten
  // this check counts are the ones in a `byStatus` table the harness mutates.
  // Unlike Louisiana's, not one of them is derived: every figure is read off a
  // published schedule, which is the finding `test/north-dakota.test.js`
  // establishes by failing to derive them.
  // 1,108 from Day 62: Oklahoma's FORTY is the largest single-state addition
  // this count has taken, and the reason is that two of its three tables are
  // per-status. Its rate schedule contributes its bracket ceilings in five
  // statuses in each of two years; its standard deduction five more a year; and
  // its special-exemption income limit five more a year. Every figure is read
  // off a published document and not one is derived — § 2355(C)(1)(a) and
  // (C)(2)(a) each write their own increments out, which is why the joint
  // column being exactly twice the single one is asserted in
  // `test/oklahoma.test.js` and applied nowhere.
  // 1,128 from Day 63: IOWA'S TWENTY, and they are three tables where a reader
  // of the state would expect four. Its low-income exemption contributes five
  // statuses in each of two years TWICE OVER, because § 422.5(3) writes a whole
  // second table for a return with someone at 65 rather than adding an
  // increment -- so `threshold` and `elderlyThreshold` are ten cells each. The
  // $40 exemption credit's `perFiler` is the other five a year. WHAT IS NOT
  // HERE is the deduction: Iowa's is the federal one, so the largest figure on
  // an Iowa return is not an Iowa parameter and this count cannot see it, and
  // neither can the mutation audit.
  // 1,160 from Day 64: ARKANSAS'S THIRTY-TWO, out of SIXTY cells it actually
  // ships — and the fourteen-a-year shortfall is the most useful thing this
  // count has ever produced, because it names the blind spot by arithmetic
  // instead of by argument.
  //
  // Arkansas has six by-status tables, the most of any state here: the standard
  // deduction, the low-income tables, the personal credits' `perFiler`, and all
  // three of the additional tax credit's (`maximum`, `start`,
  // `withdrawalPerIncrement`). Six times five statuses times two years is
  // sixty. This check sees thirty-two:
  //
  //   deduction.amounts                        5 a year   $2,470 / $4,940
  //   lowIncomeTaxTable.byStatus               5 a year   first row's `over`
  //   additionalTaxCredit.start                5 a year   $26,500
  //   additionalTaxCredit.maximum              1 a year   the JOINT $120 only
  //   exemptionCredit.perFiler                 0          $29 and $58
  //   additionalTaxCredit.withdrawalPerIncrement 0        $5 and $10
  //
  // Every excluded cell holds an integer below 100, which is Day 60's documented
  // blind-spot class and the class Day 63's one real defect landed in. So the
  // whole of Arkansas's personal credit — the figure a filer is most likely to
  // notice on their own return — and four fifths of its additional tax credit
  // are invisible to the harness, and `test/arkansas.test.js` asserts those nine
  // figures by hand for that reason. The low-income tables are worse still and
  // are not in this count at all beyond their first row: 224 whole-dollar
  // amounts, every one below $1,000.
  // 1,158 AND NOT 1,160, AND THE TWO THAT LEFT ARE THE DEFECT THIS DAY FIXED.
  // Arkansas's additional tax credit had no `qualifyingSurvivingSpouse` cell, so
  // `byStatus` defaulted it to the JOINT one — $120 and a $10 step where the
  // statute gives a widow $60 and $5. Writing the cells out explicitly replaced
  // two figures at or above 100 with two below it, which took them out of this
  // count. A guard's own denominator moving is how a fix looks from here.
  assert.equal(checked, 1158, 'byStatus cells with a parameter the harness would mutate');
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
  // The per-state decomposition this message used to carry ("114 of them
  // Wisconsin's") was itself a hand count, which is the defect the note above
  // warns about one level down. It is now computed, so a state's arrival moves
  // it or fails.
  const byState = new Map();
  for (const year of SUPPORTED_YEARS) {
    for (const state of TAXING) {
      const def = getStateDefinition(state, year);
      if (def === undefined) continue;
      let own = 0;
      for (const { table } of byStatusTables(def, '', [], new WeakSet())) {
        for (const status of FILING_STATUSES) own += countLeaves(table[status]);
      }
      byState.set(state, (byState.get(state) ?? 0) + own);
    }
  }
  const largest = [...byState.entries()].sort((a, b) => b[1] - a[1])[0];
  // 3,302 from Day 61: North Dakota's forty are its five statuses x two
  // thresholds x two years, each sitting in a `byStatus` bracket table.
  // 3,437 from Day 63: Iowa's twenty cells hold exactly twenty numbers, because
  // every one of them is a scalar threshold or a scalar credit. Oklahoma's forty
  // cells held more than forty -- a bracket cell is a LIST of rows -- so the gap
  // between this count and `checked` is where the per-status tables that are
  // schedules live, and Iowa adds nothing to it.
  // 4,671 from Day 64, and ARKANSAS ALONE IS 1,232 OF THEM — more than a third of
  // the previous total, from one state, and all but a handful in a single rule.
  // Its seven Low Income Tax Tables hold 224 whole-dollar tax amounts between
  // them, each table appears in the by-status cell of whichever statuses read it,
  // and the whole thing exists twice because 2026 carries 2025 forward. Not one
  // of those amounts is $1,000 or more, so the gap between this number and the
  // 1,160 cells the check above probes is now mostly Arkansas: the state with the
  // most figures in a by-status table is also the state with the fewest of them
  // the harness can perturb.
  assert.equal(inside, 4_669, 'numbers inside those cells');
  // Connecticut held this record from Day 20 to Day 63 with 1,020 — nearly a
  // third of 3,192, because its three staircases and its 2% add-back table are
  // all by-status and all four columns wide. Minnesota's arrival added 170;
  // Arizona's own standard-deduction table, which replaced a one-word federal
  // cross-reference on Day 47, added 10.
  //
  // ARKANSAS TOOK IT ON DAY 64 WITH 1,232, and the two states hold it for
  // opposite reasons. Connecticut's figures are in a by-status table because
  // Connecticut writes a column per status. Arkansas's are there because it
  // writes a TABLE PER FAMILY SHAPE: seven Low Income Tax Tables behind five
  // distinct arrays of 224 rows, each row appearing in the cell of whichever
  // statuses read it, and the whole thing twice because 2026 carries 2025
  // forward. Not one of the 224 amounts reaches $1,000 — though 205 of them do
  // reach $100, which is what the mutation harness needs, so this count being
  // large does NOT mean the audit is blind to it. See `blind-spots.mjs`.
  assert.deepEqual(largest, ['AR', 1232], 'the state contributing most of them');
  // 30 documented in NOT_REACHABLE_BY_ANY_HOUSEHOLD, plus 30 that are the
  // surviving-spouse cells of the four states which have no surviving-spouse
  // status — exempt by construction rather than by a ledger entry, and asserted
  // in the opposite direction. See the branch above. It was 28 until Day 47 gave
  // Arizona a standard-deduction table of its own: one more unreachable
  // surviving-spouse cell per year, in a state that already had no such box.
  // 60 until Day 63 and 64 since: Iowa's joint and surviving-spouse non-elderly
  // thresholds, in each of two years. The narrowest entry in the object and the
  // only one scoped to particular statuses -- see the comment on it for why a
  // whole-table exemption would have been a false claim about three other cells.
  assert.equal(exempt.length, 64, 'cells the engine cannot reach, all of them documented');
});
