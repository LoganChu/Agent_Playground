// What the unread-field probe COSTS, pinned as a count rather than as a clock.
//
// `StateIncomeTaxOptions.reportUnreadFields` is on by default and is not free.
// Until today its price was published as microseconds — "34 microseconds plus
// about 76 for each field the caller supplied" — and nothing in this repository
// checked any of it. Day 56's rule is that a promise in a doc comment is as
// checkable as a promise in a schema, and Day 57 published three wrong rates in
// one afternoon, one of them measured while being the load it was measuring.
//
// A wall-clock assertion would be the wrong fix: it measures the hardware and
// whatever else is running on it, so it is flaky by construction and tells a
// caller on different hardware nothing. What the microseconds were EVIDENCE for
// is structural and exact — the engine computes the whole return once more per
// probed field, and serializes each answer to compare it — so that is what is
// pinned here, in units no machine can move.
//
// ## Why every count below is a DIFFERENCE
//
// The honest expectation is hard to come by. A test that computed "the number of
// fields the engine will probe" from its own copy of the rule — known, and not
// structural, and carrying a figure — would be a second implementation of
// `probableInputFields`, and Day 53 found seven of exactly that kind of second
// opinion wrong, each refusing a field that moves a state's tax. A list of
// expected counts per state-year would be worse: a table that goes stale.
//
// So the central claim — that the price is LINEAR in the number of probed fields
// — is asserted only as a difference. Each step adds ONE field to an input and
// requires the counts to move by exactly what that field is worth: one for a
// figure, zero for a `0`, zero for a key this package does not have.
//
// Absolutes DO appear, and the first draft of this paragraph claimed they did
// not — "the absolute numbers are never named", written three tests before the
// ones that name them. What is true is narrower and is the property that
// actually matters: **no count asserted here can be changed by a state gaining a
// field.** The absolutes are structural constants — one return for a household
// with nothing to probe, two for the three states that refuse without their own
// base field, three for an Ohio return with two probable fields — and each is
// pinned beside the premise that makes it true.
//
// Three of the tests are DISCRIMINATING, and each was run against a deliberately
// weakened engine first and seen to fail:
//
//   - the linearity test fails against an engine that probes PAIRS of fields.
//   - the trivial-value test fails against an engine that probes a caller's `0`.
//   - the perturbation test fails against an engine whose meter is read by the
//     comparison — an instrument that changes what it measures.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { SUPPORTED_STATES, SUPPORTED_YEARS, stateIncomeTax } from '../dist/esm/index.js';

const FEDERAL = {
  adjustedGrossIncome: 62_000,
  taxableIncome: 46_400,
  deduction: 15_600,
  deductionKind: 'standard',
  earnedIncomeCredit: 1_200,
  incomeTaxBeforeRefundableCredits: 4_100,
};

// Three states define their own base and REFUSE a return without it. They are
// part of the floor of every household here, not candidates to add.
const FLOOR = {
  MA: { massachusettsFivePercentIncome: 58_000 },
  NJ: { newJerseyGrossIncome: 62_000 },
  PA: { pennsylvaniaTaxableIncome: 60_000 },
};

const base = (state, year, extra = {}) => ({
  state,
  year,
  filingStatus: 'single',
  federal: FEDERAL,
  ...(FLOOR[state] ?? {}),
  ...extra,
});

const fresh = () => ({ returnsStarted: 0, returnsCompleted: 0, resultsCompared: 0 });

/** The three counts one call ran up, and whether it threw. */
function measure(input, options = {}) {
  const meter = fresh();
  try {
    stateIncomeTax(input, { ...options, meter });
    return { ...meter, threw: false };
  } catch {
    return { ...meter, threw: true };
  }
}

// Six fields that carry a figure, are not structural, and are accepted by every
// state here. Each is worth exactly one probe wherever it is added.
const FIGURES = {
  propertyTaxPaid: 6_400,
  rentPaid: 14_000,
  collectiblesGains: 1_100,
  filerAge: 70,
  taxExemptInterest: 700,
  investmentIncome: 3_000,
};

test('a household with nothing to probe computes exactly one return', () => {
  // Every field a bare return supplies is structural — `state` and `year` select
  // the law, `filingStatus` the column, `federal` the basis — so there is nothing
  // to probe and the engine returns before it takes its first snapshot.
  //
  // MA, NJ and PA are left out: their own base field is a probable field, so
  // their bare return is not bare. That is asserted rather than assumed below.
  for (const year of SUPPORTED_YEARS) {
    for (const state of SUPPORTED_STATES) {
      if (state in FLOOR) continue;
      const m = measure(base(state, year));
      assert.equal(m.returnsStarted, 1, `${state} ${year} returns`);
      assert.equal(m.returnsCompleted, 1, `${state} ${year} completed`);
      assert.equal(m.resultsCompared, 0, `${state} ${year} comparisons`);
    }
  }
  // And the three whose bare return is not bare, which the first draft of this
  // test got wrong in the flattering direction: it expected two completed
  // returns. All three states REFUSE to run without their own base field, so the
  // single probe their bare return runs throws, and the only return that
  // finishes is the caller's own. One probe begun, none finished, one snapshot
  // taken — of the caller's answer, which the probe never got to be compared to.
  for (const year of SUPPORTED_YEARS) {
    for (const state of Object.keys(FLOOR)) {
      const m = measure(base(state, year));
      assert.equal(m.returnsStarted, 2, `${state} ${year} probes its own base field`);
      assert.equal(m.returnsCompleted, 1, `${state} ${year} and the probe refuses`);
      assert.equal(m.resultsCompared, 1, `${state} ${year}`);
    }
  }
});

test('DISCRIMINATING: the price is LINEAR — one more return per field, in every state-year', () => {
  // The claim the microseconds were evidence for, and the one a caller deciding
  // whether to switch the option off for a batch actually needs.
  //
  // Asserted as a difference six times over rather than as a total once, so the
  // test never holds a number that a new field could falsify. An engine that
  // probed PAIRS of fields — which Day 57 built, measured and threw away — would
  // pass the first step of this and fail the second, because the second field
  // costs it two more returns and not one.
  for (const year of SUPPORTED_YEARS) {
    for (const state of SUPPORTED_STATES) {
      let input = base(state, year);
      let previous = measure(input);
      assert.equal(previous.threw, false, `${state} ${year} premise: the floor runs`);
      for (const [field, value] of Object.entries(FIGURES)) {
        input = { ...input, [field]: value };
        const now = measure(input);
        assert.equal(now.threw, false, `${state} ${year} ${field} premise: still runs`);
        assert.equal(
          now.returnsStarted - previous.returnsStarted,
          1,
          `${state} ${year}: adding ${field} should cost exactly one more return`,
        );
        previous = now;
      }
    }
  }
});

test('DISCRIMINATING: a trivial value is probed at no cost, because it is not probed', () => {
  // `src/unread-input.ts`'s deliberate silence, priced. A `0`, `false`, `''` or
  // empty collection is the CALLER answering no, so there is no figure to have
  // lost and no probe to run — and the published price therefore does NOT read
  // "for each field the caller supplied", which is how it was written until
  // today.
  const input = base('VA', 2025, { propertyTaxPaid: 6_400 });
  const before = measure(input);
  const after = measure({
    ...input,
    rentPaid: 0,
    separatedFromSpouse: false,
    dependents: 0,
    dependentAges: [],
    federalDeductions: {},
  });
  assert.equal(after.returnsStarted, before.returnsStarted, 'five answers of no cost nothing');
  assert.equal(after.resultsCompared, before.resultsCompared);
  // And the control, so the test is not passing because nothing is counted at
  // all: the same five fields with figures in them cost five more returns.
  const paid = measure({
    ...input,
    rentPaid: 14_000,
    separatedFromSpouse: true,
    dependents: 2,
    dependentAges: [8, 14],
    federalDeductions: { qualifiedBusinessIncome: 4_000 },
  });
  assert.equal(paid.returnsStarted - before.returnsStarted, 5);
});

test('a key this package does not have costs no probe either', () => {
  // It is reported by `unknownInputNotes`, which has a better answer for it than
  // a probe does: there is no field to remove, so there is nothing to recompute.
  const input = base('VA', 2025, { propertyTaxPaid: 6_400 });
  const before = measure(input);
  const after = measure({ ...input, propertyTaxPayed: 6_400, wages: 62_000 });
  assert.equal(after.returnsStarted, before.returnsStarted);
  assert.equal(after.resultsCompared, before.resultsCompared);
});

test('one serialization per completed return, and none at all when nothing is probed', () => {
  // The half of the price whose mechanism went unpublished. The engine snapshots
  // the caller's own answer once and each probe's answer once, so the comparisons
  // equal the COMPLETED returns exactly — and are zero when the engine returned
  // before taking the first snapshot.
  for (const year of SUPPORTED_YEARS) {
    for (const state of SUPPORTED_STATES) {
      const m = measure(base(state, year, { propertyTaxPaid: 6_400, filerAge: 70 }));
      assert.equal(m.resultsCompared, m.returnsCompleted, `${state} ${year}`);
      const bare = measure(base(state, year));
      if (bare.resultsCompared === 0) assert.equal(bare.returnsStarted, 1, `${state} ${year}`);
    }
  }
});

test('the returns that did not finish are exactly the fields the return refuses without', () => {
  // `returnsStarted - returnsCompleted` is the count of supplied fields this
  // return will not RUN without, which is the loudest form of being read there
  // is and the form the first pairwise probe of the unread-field feature threw
  // away. Ohio reads `earnedIncome` only once `city` is supplied, and `city`
  // refuses to run without it — so removing `earnedIncome` throws and removing
  // `city` does not.
  const m = measure(base('OH', 2025, { city: 'COLUMBUS', earnedIncome: 60_000 }));
  assert.equal(m.returnsStarted, 3, 'the caller\'s own return and two probes');
  assert.equal(m.returnsCompleted, 2);
  assert.equal(m.returnsStarted - m.returnsCompleted, 1, 'exactly one field it will not run without');
  // The premise, so the test cannot pass because Ohio stopped reading the field:
  // that one is `earnedIncome`, and it is worth over a thousand dollars.
  assert.throws(
    () => stateIncomeTax(base('OH', 2025, { city: 'COLUMBUS' })),
    /neither qualifyingWages nor earnedIncome was supplied/,
  );
  const rich = stateIncomeTax(base('OH', 2025, { city: 'COLUMBUS', earnedIncome: 60_000 }));
  const lean = stateIncomeTax(base('OH', 2025, { city: 'COLUMBUS', earnedIncome: 1 }));
  assert.ok(rich.totalTax - lean.totalTax > 1_000);
  // And a return with nothing it refuses without loses nothing between the two
  // counts, so the difference is a measurement and not a constant.
  const plain = measure(base('VA', 2025, { propertyTaxPaid: 6_400, filerAge: 70 }));
  assert.equal(plain.returnsStarted, plain.returnsCompleted);
});

test('reportUnreadFields: false costs exactly one return and no comparison, in every state-year', () => {
  // What a batch caller buys by switching it off, stated as the only number that
  // survives a change of hardware: one return per household, whatever the
  // household holds.
  for (const year of SUPPORTED_YEARS) {
    for (const state of SUPPORTED_STATES) {
      const input = base(state, year, {
        propertyTaxPaid: 6_400,
        rentPaid: 14_000,
        collectiblesGains: 1_100,
        filerAge: 70,
        earnedIncome: 62_000,
      });
      const off = measure(input, { reportUnreadFields: false });
      assert.equal(off.returnsStarted, 1, `${state} ${year}`);
      assert.equal(off.resultsCompared, 0, `${state} ${year}`);
      // And it was worth switching off here, so the assertion is not passing on
      // a household that had nothing to probe anyway.
      const on = measure(input);
      assert.ok(on.returnsStarted > off.returnsStarted, `${state} ${year} premise`);
    }
  }
});

test('DISCRIMINATING: the meter moves no figure and no note, in every state-year', () => {
  // An instrument that perturbs what it measures is the defect this project
  // spent Day 57 finding, and a meter threaded through `options` is exactly the
  // shape that could do it: `options` is passed to every probe, and the
  // comparison that decides the unread-field note is over the RESULT. If a count
  // ever reached the result, the note would depend on how many fields were
  // probed, and the engine would answer a different question when watched.
  for (const year of SUPPORTED_YEARS) {
    for (const state of SUPPORTED_STATES) {
      const input = base(state, year, {
        propertyTaxPaid: 6_400,
        filerAge: 70,
        collectiblesGains: 1_100,
      });
      const watched = stateIncomeTax(input, { meter: fresh() });
      assert.deepEqual(watched, stateIncomeTax(input), `${state} ${year}`);
    }
  }
});

test('a meter accumulates across calls, so a caller can price a batch', () => {
  // The reason this is a caller's object and not a module-level counter: two
  // callers in one process do not share a bill, and a batch is priced by passing
  // the same meter to every household in it.
  const meter = fresh();
  const input = base('VA', 2025, { propertyTaxPaid: 6_400, filerAge: 70 });
  const one = measure(input);
  for (let i = 0; i < 10; i++) stateIncomeTax(input, { meter });
  assert.equal(meter.returnsStarted, one.returnsStarted * 10);
  assert.equal(meter.resultsCompared, one.resultsCompared * 10);
});

test('every whole return goes through the counter, so the count cannot undercount', () => {
  // The one claim in this file that no household can establish, and the reason
  // it is worth a test: `stateIncomeTaxWithoutUnreadNotes` is a thin wrapper that
  // counts, and `computeWholeReturn` does the work. A future edit that called
  // `computeWholeReturn` directly would compute a return nothing counted, and
  // every assertion above would still pass — a meter reading LOWER than the truth
  // is the flattering direction, and a caller pricing a batch off it would
  // underbid.
  //
  // So the property is pinned where it lives: in the compiled module, which is
  // also what `module-graph.test.js` reads and for the same reason — the shipped
  // bytes are the artefact, not the TypeScript.
  const engine = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'esm', 'engine.js');
  const src = readFileSync(engine, 'utf8');

  // The call form, which excludes the `{@link computeWholeReturn}` in the doc
  // comment — comments are emitted into the `.js` here, because both packages
  // set `removeComments: false`.
  const sites = [...src.matchAll(/computeWholeReturn\(/g)].map((m) => m.index);
  assert.equal(sites.length, 3, 'one definition and two calls');

  const definition = src.indexOf('function computeWholeReturn(');
  assert.ok(definition >= 0, 'the premise: the worker function is still named this');
  assert.equal(sites[0], definition + 'function '.length, 'the first site is the definition');

  const wrapper = src.indexOf('function stateIncomeTaxWithoutUnreadNotes(');
  assert.ok(wrapper >= 0, 'the premise: the counting wrapper is still named this');
  const wrapperEnd = src.indexOf('\n}', wrapper);
  assert.ok(wrapperEnd > wrapper, 'the premise: the wrapper has an end');
  for (const site of sites.slice(1))
    assert.ok(
      site > wrapper && site < wrapperEnd,
      'a whole return is computed outside the counting wrapper, so a meter would undercount it',
    );
});
