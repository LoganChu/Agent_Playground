import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  FILING_STATUSES,
  NO_INCOME_TAX_STATES,
  SUPPORTED_STATES,
  SUPPORTED_YEARS,
  UNCOVERED_TAXING_JURISDICTIONS,
  getStateDefinition,
  isSupported,
  stateIncomeTax,
  stateName,
  supportedYears,
} from './strict.mjs';

const federal = (agi, taxableIncome, deduction = agi - taxableIncome) => ({
  adjustedGrossIncome: agi,
  taxableIncome,
  deduction,
  deductionKind: 'standard',
});

test('every supported state resolves for every supported year', () => {
  assert.equal(SUPPORTED_STATES.length, 42);
  for (const state of SUPPORTED_STATES) {
    assert.deepEqual(supportedYears(state), SUPPORTED_YEARS);
    for (const year of SUPPORTED_YEARS) {
      const def = getStateDefinition(state, year);
      assert.equal(def.code, state);
      assert.equal(def.year, year);
      assert.ok(def.citations.length > 0, `${state} has no citation`);
      assert.ok(def.notes.length > 0, `${state} has no notes`);
    }
  }
});

test('an unsupported year is an error, not a silent fallback', () => {
  // Six of these states changed their rate between 2025 and 2026. A fallback to
  // the nearest year would return a number that looks right for all of them.
  assert.throws(() => getStateDefinition('NC', 2024), /tax year 2024 is not/);
  assert.throws(() => getStateDefinition('NC', 2027), /Supported years: 2025, 2026/);
  assert.equal(isSupported('NC', 2024), false);
  assert.equal(isSupported('NC', 2025), true);
});

const getMissingStatesMessage = () => {
  try {
    getStateDefinition('NE', 2026);
  } catch (e) {
    return e.message;
  }
  throw new Error('NE resolved');
};

test('an unsupported state names what is missing rather than returning zero', () => {
  // The example has now moved ELEVEN times — Ohio on Day 16, Virginia on Day 17,
  // Minnesota on Day 45, South Carolina on Day 49, Louisiana on Day 60, North
  // Dakota on Day 61, Oklahoma on Day 62, Iowa on Day 63, Arkansas on Day 64,
  // Kansas on Day 66 and NEW MEXICO ON DAY 67
  // — and each move is the point of the test: a state used here as the stand-in
  // for "absent" has to be replaced the day it ships, or the assertion starts
  // proving something about a state that is present. This is the only assertion
  // in the suite that is GUARANTEED to fail every time coverage grows, which is
  // why it has never once been wrong about what it claims.
  assert.throws(() => getStateDefinition('NE', 2026), /not supported/);
  // The message has to say which states are absent, because the caller is often a
  // language model and a model that cannot see the gap will fill it in.
  assert.throws(() => getStateDefinition('NE', 2026), /Nebraska/);
  // And it must no longer name the state that just shipped.
  assert.equal(isSupported('AR', 2026), true);
  assert.ok(!getMissingStatesMessage().includes('Arkansas'));
  assert.equal(isSupported('IA', 2026), true);
  assert.ok(!getMissingStatesMessage().includes('Iowa'));
  assert.equal(isSupported('OK', 2026), true);
  assert.ok(!getMissingStatesMessage().includes('Oklahoma'));
  assert.equal(isSupported('KS', 2026), true);
  assert.ok(!getMissingStatesMessage().includes('Kansas'));
  assert.equal(isSupported('NM', 2026), true);
  assert.ok(!getMissingStatesMessage().includes('New Mexico'));
  // New York, New Jersey and Massachusetts were all on this list until they were
  // not. When a state moves from the gap list into the registry, this is where
  // the two have to be kept in step — and the message must stop naming it.
  assert.equal(isSupported('NY', 2026), true);
  assert.equal(isSupported('NJ', 2026), true);
  assert.equal(isSupported('MA', 2026), true);
  assert.equal(isSupported('MD', 2026), true);
  assert.equal(isSupported('OH', 2026), true);
  assert.equal(isSupported('VA', 2026), true);
  assert.equal(isSupported('SC', 2026), true);
  assert.doesNotMatch(getMissingStatesMessage(), /Massachusetts/);
  // Maryland and Ohio are now named in that message as states this package DOES
  // cover, so the check is on the list of gaps — the part after the em dash —
  // rather than on the whole sentence. Ohio was the example this test used until
  // Day 16 and Virginia until Day 17, which is the point: the example has to
  // move as the gap closes, and it has now moved twice.
  const gaps = getMissingStatesMessage().split('—')[1] ?? '';
  // Louisiana left this list on Day 60, North Dakota on Day 61, Oklahoma on Day
  // 62, Iowa on Day 63, Arkansas on Day 64, Kansas on Day 66 and NEW MEXICO ON
  // DAY 67; Nebraska is the stand-in now, and it is the largest uncovered
  // jurisdiction left at 2,018,006 — a figure Day 64 checked against Census
  // Vintage 2025, which is why the stand-in could move without a lookup today.
  // AND SINCE DAY 68 IT IS NO LONGER THE LAST ENTRY THE LIST CAN NAME WITH
  // CONFIDENCE: all nine are now ordered against checked Vintage 2025 figures,
  // so the next move of this stand-in is West Virginia at 1,766,147 and needs no
  // lookup. The test below asserts the order rather than trusting the comment
  // that claims it, which is the whole of what Day 64 found wrong here.
  assert.match(gaps, /Nebraska/);
  // Compared as whole list ITEMS and not as substrings, which is the Day 37
  // citation rule in a second place: `/Virginia/` matched this message for a
  // covered state the day West Virginia joined the gap list, and the assertion
  // that was meant to prove Virginia had left the list was being failed by a
  // state that had never been in it.
  const named = gaps
    .replace(/\. Returning zero[\s\S]*$/, '')
    .split(',')
    .map((s) => s.trim());
  for (const covered of [
    'Maryland',
    'Ohio',
    'Virginia',
    'Connecticut',
    'Alabama',
    'Minnesota',
    'South Carolina',
    'Louisiana',
    'Iowa',
    'Kansas',
  ]) {
    assert.ok(!named.includes(covered), `the gap list names ${covered}, which is covered`);
  }
  assert.ok(named.includes('West Virginia'));
});

test('the list of uncovered jurisdictions cannot name a state this package covers', () => {
  // The message above named CONNECTICUT as a state this package does not cover,
  // for the whole of the day Connecticut shipped, because the sentence was a
  // second copy of the registry. This is the check that makes that impossible:
  // the list is declared, the message is built from it, and a name that is also
  // a supported state's name fails here.
  const covered = new Set(SUPPORTED_STATES.map((s) => stateName(s)));
  for (const name of UNCOVERED_TAXING_JURISDICTIONS) {
    assert.ok(!covered.has(name), `${name} is in UNCOVERED_TAXING_JURISDICTIONS and is covered`);
  }
  // Forty-two jurisdictions tax individual income. This package covers
  // THIRTY-THREE of them — forty-two supported states less the nine with no
  // income tax at all — so the uncovered list has the other nine.
  //
  // The three figures are asserted together on purpose: the identity
  // `covered + uncovered = 42` is the only thing that catches a state added to
  // the registry and left in the gap list, which is the defect the list was
  // declared for in the first place. It is also what retired a sentence in
  // `states/index.ts` that said the same thing in prose and had gone stale on
  // both numbers by Day 61 — a count written down beside a count that is
  // measured is a count nothing guards.
  assert.equal(UNCOVERED_TAXING_JURISDICTIONS.length, 9);
  assert.equal(SUPPORTED_STATES.length - NO_INCOME_TAX_STATES.length, 33);
  assert.equal(
    SUPPORTED_STATES.length - NO_INCOME_TAX_STATES.length + UNCOVERED_TAXING_JURISDICTIONS.length,
    42,
    'the covered and uncovered taxing jurisdictions must still add up to forty-two',
  );
  for (const name of UNCOVERED_TAXING_JURISDICTIONS) {
    assert.match(getMissingStatesMessage(), new RegExp(name));
  }
});

test('the uncovered jurisdictions are ordered largest first, against the figures', () => {
  // THE COMMENT ON THAT LIST HAS CLAIMED "LARGEST FIRST" SINCE DAY 59 AND
  // NOTHING HAS EVER CHECKED IT. Day 61 left West Virginia tenth on a list
  // described as ordered, below five jurisdictions every one of which is
  // smaller than it; Day 64 measured three entries and made the SENTENCE less
  // true rather than more, because it was then a measured claim with eight
  // unmeasured entries inside its scope; and Day 68 found the committed tail
  // wrong in exactly one place, Vermont above the District of Columbia.
  //
  // > **A LIST'S ORDER IS A CLAIM ABOUT A FUNCTION OF ITS ENTRIES, SO IT NEEDS
  // > THE VALUES WRITTEN DOWN BESIDE IT OR IT IS NOT CHECKABLE AT ALL.** Eight
  // > days of "largest first" cost nothing to write and could not be falsified
  // > by any test, because the population figures existed nowhere in the
  // > repository. They are here now, which is the only reason this test can
  // > exist.
  //
  // Census Bureau Vintage 2025 population estimates, read off QuickFacts —
  // `census.gov` does not resolve from the sandbox this package is built in, so
  // these are the figures the module comment cites and not a second source.
  // Kansas's 2,977,220 and New Mexico's 2,125,498 were checked on Day 64 and
  // are omitted here because both states are now covered.
  const VINTAGE_2025 = new Map([
    ['Nebraska', 2_018_006],
    ['West Virginia', 1_766_147],
    ['Hawaii', 1_432_820],
    ['Maine', 1_414_874],
    ['Montana', 1_144_694],
    ['Rhode Island', 1_114_521],
    ['Delaware', 1_059_952],
    ['the District of Columbia', 693_645],
    ['Vermont', 644_663],
  ]);

  // EVERY NAME NEEDS A FIGURE AND EVERY FIGURE A NAME, asserted both ways. A
  // one-directional check would let the next state to ship leave a stale figure
  // behind here, which is the same drift the declared list was created to stop.
  assert.deepEqual(
    [...UNCOVERED_TAXING_JURISDICTIONS].sort(),
    [...VINTAGE_2025.keys()].sort(),
    'a jurisdiction in the list has no population figure, or a figure has no jurisdiction',
  );

  const sizes = UNCOVERED_TAXING_JURISDICTIONS.map((name) => VINTAGE_2025.get(name));
  for (let i = 1; i < sizes.length; i += 1) {
    assert.ok(
      sizes[i - 1] > sizes[i],
      `${UNCOVERED_TAXING_JURISDICTIONS[i - 1]} (${sizes[i - 1]}) is listed above ` +
        `${UNCOVERED_TAXING_JURISDICTIONS[i]} (${sizes[i]}) and is smaller`,
    );
  }

  // The pair that was wrong, pinned by name and by the gap, because a sorted
  // check passes for the whole list and says nothing about the one place it
  // actually failed. 48,982 apart — wide enough that the swap was not a
  // rounding question about which estimate to use.
  assert.ok(
    UNCOVERED_TAXING_JURISDICTIONS.indexOf('the District of Columbia') <
      UNCOVERED_TAXING_JURISDICTIONS.indexOf('Vermont'),
  );
  assert.equal(VINTAGE_2025.get('the District of Columbia') - VINTAGE_2025.get('Vermont'), 48_982);

  // Nebraska is the next state to add, and this is the figure a worklist reads.
  assert.equal(UNCOVERED_TAXING_JURISDICTIONS[0], 'Nebraska');
  assert.equal(UNCOVERED_TAXING_JURISDICTIONS[1], 'West Virginia');
});

test('every state computes for every filing status without throwing', () => {
  for (const state of SUPPORTED_STATES) {
    for (const year of SUPPORTED_YEARS) {
      for (const filingStatus of FILING_STATUSES) {
        const r = stateIncomeTax({
          state,
          year,
          filingStatus,
          federal: federal(90_000, 74_250, 15_750),
          pennsylvaniaTaxableIncome: 90_000,
          newJerseyGrossIncome: 90_000,
          massachusettsFivePercentIncome: 90_000,
          dependents: 2,
        });
        assert.ok(Number.isFinite(r.tax), `${state} ${year} ${filingStatus} produced ${r.tax}`);
        assert.ok(r.tax >= 0, `${state} ${year} ${filingStatus} produced a negative tax`);
        assert.equal(r.stateName, stateName(state));
      }
    }
  }
});

test('the nine states with no income tax return zero and say why', () => {
  assert.equal(NO_INCOME_TAX_STATES.length, 9);
  for (const state of NO_INCOME_TAX_STATES) {
    const r = stateIncomeTax({
      state,
      year: 2026,
      filingStatus: 'single',
      federal: federal(500_000, 484_250),
    });
    assert.equal(r.hasIncomeTax, false);
    assert.equal(r.tax, 0);
    assert.equal(r.marginalRate, 0);
    assert.equal(r.provisional, false);
  }
});

test('New Hampshire says the interest and dividends tax ended after 2024', () => {
  const r = stateIncomeTax({
    state: 'NH',
    year: 2025,
    filingStatus: 'single',
    federal: federal(100_000, 84_250),
  });
  assert.ok(r.notes.some((n) => n.includes('2025')));
  assert.ok(r.notes.some((n) => n.includes('2024 was the last year')));
});

test('Washington says "no income tax" is incomplete', () => {
  // A Washington filer with a large long-term gain owes Washington tax. Answering
  // "no income tax" and stopping is the failure this note exists to prevent.
  const r = stateIncomeTax({
    state: 'WA',
    year: 2026,
    filingStatus: 'single',
    federal: federal(2_000_000, 1_984_250),
  });
  assert.equal(r.tax, 0);
  assert.ok(r.notes.some((n) => n.includes('capital gains')));
  assert.ok(r.notes.some((n) => n.includes('7%')));
});

test('every provisional state-year says so in its first note', () => {
  for (const state of SUPPORTED_STATES) {
    for (const year of SUPPORTED_YEARS) {
      const def = getStateDefinition(state, year);
      if (def.status !== 'provisional') continue;
      // "PROVISIONAL" and not "PROVISIONAL:" — Day 28 gave four of these a
      // count ("PROVISIONAL, one figure:") and Colorado's says "PROVISIONAL BY
      // LAW", because a state-year is rarely provisional as a whole and the
      // note is where a reader finds out how much of it is.
      assert.ok(
        def.notes[0].startsWith('PROVISIONAL'),
        `${state} ${year} is provisional but does not lead with it`,
      );
      const r = stateIncomeTax({
        state,
        year,
        filingStatus: 'single',
        federal: federal(80_000, 64_250, 15_750),
        pennsylvaniaTaxableIncome: 80_000,
        newJerseyGrossIncome: 80_000,
      });
      assert.equal(r.provisional, true);
    }
  }
});

test('2025 has no provisional state and 2026 has twelve', () => {
  const count = (year) =>
    SUPPORTED_STATES.filter((s) => getStateDefinition(s, year).status === 'provisional').length;
  // Everything published for 2025; for 2026 the states whose indexed figures had
  // not been released — plus Colorado, whose rate can still be cut retroactively.
  //
  // ILLINOIS came off this list in v0.25.0, and KENTUCKY and MARYLAND on Day 28
  // (v0.26.0). Kentucky's 2026 standard deduction is $3,360, announced by the
  // Department of Revenue and carried in the 2026 withholding formula; Maryland's
  // is $3,350, unchanged, and confirmed by the Comptroller's own 2026 withholding
  // guide. **That is what the provisional flag is FOR** — a debt to be paid, not
  // a permanent disclaimer.
  //
  // OREGON joined on Day 42 for TWO figures out of forty-odd, which is the
  // narrowest provisional flag in the package: the Oregon Kids Credit amount and
  // its phase-out threshold, both indexed and both published in the January
  // after the year. Everything else in Oregon's 2026 is published, because the
  // Department of Revenue's 2026 withholding formula carries the brackets, the
  // standard deduction, the federal tax subtraction ceiling and its whole
  // phase-out table — an agency does not publish a withholding formula for a
  // figure it has not settled. A per-STATE flag is therefore a blunter
  // instrument than `provisionalFigures`, which is why both exist.
  //
  // WISCONSIN joined on Day 43 for THREE figures out of a seven-figure standard
  // deduction schedule, which is narrower still than Oregon's in a different
  // sense: the other four are not published either, and they are KNOWN, because
  // the published 2026 rate schedules pin the indexation factor tightly enough
  // to determine them. Wisconsin is therefore the first state-year here whose
  // provisional flag covers figures that interval ARITHMETIC could not settle
  // rather than figures no document carries — see
  // test/wisconsin-indexation.test.js.
  //
  // The seven that remain are NOT one more afternoon's work, which is the thing
  // Day 27 got wrong and Day 28 corrected. Five are waiting on a document that
  // does not exist until January 2027 (Utah's TC-40 instructions, Ohio's IT 1040
  // booklet, Michigan's MI-1040 instructions, California's FTB release and
  // MISSOURI's Form MO-A, whose Part 3 Section A line 7 carries the maximum
  // Social Security benefit), and
  // COLORADO can never be resolved during the tax year at all: its rate is set
  // by a TABOR surplus calculation that runs after the year closes. Which kind
  // each figure is now lives in `provisionalFigures`, not in prose — see
  // test/provisional.test.js.
  //
  // SOUTH CAROLINA joined on Day 49 and is a kind this list had not held. The
  // other nine are provisional because a state did not publish an INDEXED
  // figure. South Carolina's 2026 figures are mostly published and are STATUTE —
  // Act 110 of 2026 fixed the rates, the SCIAD and the earned income credit cap
  // in March 2026 — and what is missing is the indexed dependent exemption and,
  // behind it, the 2026 SC1040 instructions that would confirm which of the
  // § 12-6-1140 and § 12-6-1170 subtractions the reform left standing. So it is
  // the first state-year here whose provisional flag covers a question about
  // which PROVISIONS survive rather than only about what a figure indexed to.
  // ARKANSAS IS THE ELEVENTH, AND ITS SPLIT IS THE CLEANEST HERE. Every RATE
  // figure for 2026 is published law — Act 1 of the 2026 First Extraordinary
  // Session prints the schedule, the high-income table and all thirty rows of
  // the bracket adjustment — and every INDEXED figure is carried forward,
  // because DFA publishes those on a card and in the AR1000F instructions and
  // neither has appeared. No other state-year here divides so exactly along the
  // line between what a legislature writes and what an agency publishes.
  assert.equal(count(2025), 0);
  // TWELVE SINCE DAY 68, AND NEW MEXICO IS THE FIRST STATE TO JOIN THIS LIST
  // RATHER THAN LEAVE IT. Every previous movement has been a debt paid —
  // Illinois, Kentucky, Maryland. New Mexico moved the other way without a
  // single New Mexico figure changing: § 7-2-18.34's child income tax credit
  // was modelled, and its seven per-child amounts are the only indexed figures
  // in the state. A `published` 2026 column had been true only because the one
  // figure that moves was not computed.
  assert.equal(count(2026), 12);
  const provisional2026 = SUPPORTED_STATES.filter(
    (s) => getStateDefinition(s, 2026).status === 'provisional',
  );
  assert.deepEqual(provisional2026, ['AR', 'CA', 'CO', 'ID', 'MI', 'MO', 'NM', 'OH', 'OR', 'SC', 'UT', 'WI']);
});

test('the package has no runtime dependencies', () => {
  // An engine that ships a dependency tree is a supply chain the caller did not
  // choose. This is a claim in the README, so it is a test.
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.peerDependencies, undefined);
});

test("a stepped exemption's stored top step agrees with the chart", () => {
  // Maryland and Ohio state their personal exemption twice: once as a `perFiler`
  // table and once as the `perExemptionSteps` staircase the engine actually
  // reads. Both files' comments say the duplicate is "kept so a test can check
  // it against the chart". Maryland's test existed. Ohio's did not, and the two
  // copies disagreed: Ohio's unread table gave a qualifying surviving spouse the
  // JOINT `$4,800`, two exemptions for a return with one person on it, which is
  // the v0.27.0 defect surviving in the one place the engine cannot see it.
  //
  // **THE RULE: a duplicate kept to be cross-checked is only worth keeping if
  // something makes the cross-check exist, and a comment saying a test checks
  // this is not the test.** So the check is here, over every state that has a
  // chart, instead of in the per-state file of whoever remembered — because the
  // per-state file of whoever remembered is exactly what was missing.
  let checked = 0;
  for (const year of SUPPORTED_YEARS) {
    for (const state of SUPPORTED_STATES) {
      const rule = getStateDefinition(state, year).exemption;
      if (!rule?.perExemptionSteps) continue;
      for (const status of FILING_STATUSES) {
        // How many filer exemptions this status claims — `filersClaimed` where the
        // state has said, and the form's own count otherwise. The stored figure is
        // per RETURN and the chart is per EXEMPTION, so the count is the whole of
        // the conversion between them, and getting it wrong is how a widow was
        // given two.
        const filers =
          rule.filersClaimed?.[status] ??
          (status === 'marriedFilingJointly' || status === 'qualifyingSurvivingSpouse' ? 2 : 1);
        assert.equal(
          rule.perFiler[status],
          rule.perExemptionSteps[status][0].amount * filers,
          `${state} ${year} ${status}: stored $${rule.perFiler[status]} against ${filers} x $${rule.perExemptionSteps[status][0].amount} from the chart`,
        );
        checked++;
      }
      assert.equal(
        rule.perDependent,
        rule.perExemptionSteps.single[0].amount,
        `${state} ${year}: a dependent is one exemption at the top step`,
      );
    }
  }
  // Two states, five statuses, two years. If a third stepped state arrives it is
  // covered without an edit; if the last one leaves, this fails rather than
  // quietly testing nothing, which is the failure mode of every loop like it.
  assert.equal(checked, 20, 'every stepped state-year-status is checked');
});

test('a rule NAME that depends on the year must still depend on it', () => {
  // The companion to the test below, and the gap it was found through.
  //
  // That one reads `%` and `$` tokens out of a name and checks them against the
  // numbers the rule holds, which is what kills Michigan's "75% for 2025". It
  // deliberately ignores a bare number, because a name may carry a LABEL —
  // "Worksheet 13A", "code 18", "born before 1946" — and reading those would
  // demand that a worksheet number be a tax parameter.
  //
  // **A YEAR IN A NAME IS NEITHER, and Day 65's mutation audit found it.**
  // Arkansas names its rate schedule for the document it came from: the DFA's
  // 2025 card for 2025, "A.C.A. § 26-51-201(a)(4) and (a)(5), Act 1 of 2026" for
  // 2026. Those years are claims and not labels — but they are bare, so the test
  // below cannot read them, and setting the selector that chooses between the two
  // names to the wrong year survived the whole suite. A 2025 Arkansas return
  // would have carried the 2026 citation as the name of the schedule it was taxed
  // under, in the result object, where a caller and a caller's model read it.
  //
  // So this asserts the property the mutation breaks rather than the contents of
  // the names: a name that is chosen BY the year must still differ between the
  // years. Pinned as a list and not a count, so that a state arriving with a
  // year-dependent name has to be looked at rather than absorbed.
  const namesFor = (state, year) => {
    const out = new Map();
    const walk = (node, path, seen) => {
      if (node === null || typeof node !== 'object' || seen.has(node)) return;
      seen.add(node);
      if (typeof node.name === 'string') out.set(path, node.name);
      for (const [key, value] of Object.entries(node)) walk(value, `${path}.${key}`, seen);
    };
    walk(getStateDefinition(state, year), '', new WeakSet());
    return out;
  };
  const [first, second] = SUPPORTED_YEARS;
  const varying = [];
  for (const state of SUPPORTED_STATES) {
    const a = namesFor(state, first);
    const b = namesFor(state, second);
    for (const [path, name] of a) {
      if (b.has(path) && b.get(path) !== name) varying.push(`${state}${path}`);
    }
  }
  assert.deepEqual(
    varying.sort(),
    [
      // Arkansas's rate schedule: the DFA's indexed card for 2025, Act 1 of 2026
      // for 2026. Two documents, so two names.
      'AR.rate',
      // Michigan's retirement deduction, whose 2025 name carries the phase-in
      // share. The test below checks that the 75% in it is a share the rule
      // holds; this one checks that it is only said for 2025.
      'MI.retirementIncomeSubtractions.1',
    ],
    'a rule name stopped varying by year, or a new one started — if a state arrived with one, add it here',
  );
});

test('a rate or a threshold printed in a rule NAME is a figure that rule actually holds', () => {
  // A rule's `name` is not a comment. It travels in the result object — a credit's
  // name, a subtraction's name — so a caller and a caller's model read it, and a
  // name that says "75% for 2025" beside a rule that applies 50% is a wrong answer
  // with a correct number in it.
  //
  // Day 8's operating rule is that a number in a code comment is a claim and needs
  // the same test a README number needs. `readme.test.js` enforces that for the
  // documentation; this is the same rule for the one piece of prose that reaches
  // the caller. It also closes the rule-name half of Day 34's group B: the Michigan
  // phase-in's name is the only place in the package where a percentage is written
  // out in words beside the parameter that sets it, and nothing checked the two
  // against each other.
  //
  // Only `%` and `$` tokens are read. A name may hold a bare number that is a LABEL
  // and not a claim — "Worksheet 13A", "code 18", "born before 1946" — and reading
  // those would make this test demand that a worksheet number be a tax parameter.
  const numbersIn = (rule) => {
    const out = new Set();
    const walk = (node, seen) => {
      if (node === null || typeof node !== 'object' || seen.has(node)) return;
      seen.add(node);
      for (const value of Object.values(node)) {
        if (typeof value === 'number' && Number.isFinite(value)) out.add(value);
        else walk(value, seen);
      }
    };
    walk(rule, new WeakSet());
    return out;
  };

  let checked = 0;
  for (const year of SUPPORTED_YEARS) {
    for (const state of SUPPORTED_STATES) {
      const walk = (node, path, seen) => {
        if (node === null || typeof node !== 'object' || seen.has(node)) return;
        seen.add(node);
        if (!Array.isArray(node) && typeof node.name === 'string') {
          const where = `${state} ${year} ${path}: "${node.name}"`;
          const held = numbersIn(node);
          for (const [, percent] of node.name.matchAll(/(\d+(?:\.\d+)?)%/g)) {
            checked++;
            const rate = Number(percent) / 100;
            assert.ok(
              [...held].some((v) => Math.abs(v - rate) < 1e-9),
              `${where} prints ${percent}% and the rule holds no rate of ${rate}`,
            );
          }
          for (const [, dollars] of node.name.matchAll(/\$([\d,]+)/g)) {
            checked++;
            const figure = Number(dollars.replace(/,/g, ''));
            assert.ok(
              held.has(figure),
              `${where} prints $${dollars} and the rule holds no figure of ${figure}`,
            );
          }
        }
        for (const [key, value] of Object.entries(node)) walk(value, path ? `${path}.${key}` : key, seen);
      };
      walk(getStateDefinition(state, year), '', new WeakSet());
    }
  }
  // Pinned so that a walk which stops finding names — a renamed field, a rule moved
  // behind a function — fails instead of reporting a clean sweep over nothing.
  // 21 from Day 49: South Carolina's 'Net capital gain deduction (44%)' is read in
  // both years and its 0.44 share is what the name is checked against. The
  // state's other printed label, 'Senior deduction (age 65)', holds no % or $
  // token and is deliberately not counted — an age is a LABEL and this test
  // reads money and rates.
  //
  // 25 from Day 61: North Dakota prints '(40%)' in BOTH of its 40% rules, in
  // both years, and each is checked against its own `share`. The pair is the
  // most useful thing this test has ever been pointed at, because the two names
  // differ only in the words around an identical number — a transposition that
  // put the capital-gain share on the dividend rule would leave both names
  // true, and only the engine's answer would move.
  assert.equal(checked, 27, 'rates and thresholds printed in rule names');
});

test("a threshold the engine cannot apply is quoted in the note that asks the caller to apply it", () => {
  // Day 35's audit left `jointFilingCredit.perSpouseIncomeThreshold: 500` alive,
  // and the reason is not a missing household. **Nothing reads it.**
  //
  // Ohio allows the joint filing credit only where EACH spouse has at least $500
  // of qualifying income — Ohio AGI less interest, dividends, capital gains and
  // rent, per spouse — and no federal figure splits a joint return between the two
  // people on it. So the engine cannot decide the question and does not pretend
  // to: it asks the caller for `bothSpousesHaveQualifyingIncome` and computes zero
  // when it is absent. The `$500` is the caller's test to apply, not the engine's.
  //
  // That is the right design and it leaves the figure in Day 34's worst category:
  // **a value nothing reads is not harmless, it is unconstrained.** It is free to
  // drift away from the number the caller is actually told, which is the one in the
  // note — and the note holds `$500` as literal prose, so the two can disagree in
  // silence exactly as Ohio's exemption table did.
  //
  // **THE RULE: a parameter the engine cannot apply is a parameter the CALLER has
  // to apply, so it earns its place only if it reaches them. The test is that the
  // note quotes it.** If a future engine learns to read this field, delete the
  // entry — the check will have become a household's job.
  const CALLER_APPLIES = [
    {
      read: (def) => def.jointFilingCredit?.perSpouseIncomeThreshold,
      states: ['OH'],
      what: 'the per-spouse qualifying income the joint filing credit requires',
      asks: 'bothSpousesHaveQualifyingIncome',
    },
  ];
  let checked = 0;
  for (const year of SUPPORTED_YEARS) {
    for (const state of SUPPORTED_STATES) {
      const def = getStateDefinition(state, year);
      for (const entry of CALLER_APPLIES) {
        const value = entry.read(def);
        if (value === undefined) {
          assert.ok(
            !entry.states.includes(state),
            `${state} ${year} is listed as carrying ${entry.what} and no longer does`,
          );
          continue;
        }
        assert.ok(entry.states.includes(state), `${state} ${year} carries ${entry.what} and is not listed`);
        const quoted = `$${value.toLocaleString('en-US')}`;
        const notes = [...(def.notes ?? []), ...(def.conditionalNotes ?? []).map((n) => n.text)];
        const carrier = notes.find((n) => n.includes(entry.asks));
        assert.ok(carrier, `${state} ${year}: no note tells the caller to pass ${entry.asks}`);
        assert.ok(
          carrier.includes(quoted),
          `${state} ${year}: ${entry.what} is ${quoted} and the note that asks for ${entry.asks} does not say so — ` +
            'the figure the caller applies and the figure the package stores have drifted apart',
        );
        checked++;
      }
    }
  }
  assert.equal(checked, 2, 'thresholds the caller applies, both years');
});
