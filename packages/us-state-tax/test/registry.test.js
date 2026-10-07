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
  assert.equal(SUPPORTED_STATES.length, 33);
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
    getStateDefinition('MN', 2026);
  } catch (e) {
    return e.message;
  }
  throw new Error('MN resolved');
};

test('an unsupported state names what is missing rather than returning zero', () => {
  assert.throws(() => getStateDefinition('MN', 2026), /not supported/);
  // The message has to say which states are absent, because the caller is often a
  // language model and a model that cannot see the gap will fill it in.
  assert.throws(() => getStateDefinition('MN', 2026), /Minnesota/);
  // New York, New Jersey and Massachusetts were all on this list until they were
  // not. When a state moves from the gap list into the registry, this is where
  // the two have to be kept in step — and the message must stop naming it.
  assert.equal(isSupported('NY', 2026), true);
  assert.equal(isSupported('NJ', 2026), true);
  assert.equal(isSupported('MA', 2026), true);
  assert.equal(isSupported('MD', 2026), true);
  assert.equal(isSupported('OH', 2026), true);
  assert.equal(isSupported('VA', 2026), true);
  assert.doesNotMatch(getMissingStatesMessage(), /Massachusetts/);
  // Maryland and Ohio are now named in that message as states this package DOES
  // cover, so the check is on the list of gaps — the part after the em dash —
  // rather than on the whole sentence. Ohio was the example this test used until
  // Day 16 and Virginia until Day 17, which is the point: the example has to
  // move as the gap closes, and it has now moved twice.
  const gaps = getMissingStatesMessage().split('—')[1] ?? '';
  assert.match(gaps, /Minnesota/);
  // Compared as whole list ITEMS and not as substrings, which is the Day 37
  // citation rule in a second place: `/Virginia/` matched this message for a
  // covered state the day West Virginia joined the gap list, and the assertion
  // that was meant to prove Virginia had left the list was being failed by a
  // state that had never been in it.
  const named = gaps
    .replace(/\. Returning zero[\s\S]*$/, '')
    .split(',')
    .map((s) => s.trim());
  for (const covered of ['Maryland', 'Ohio', 'Virginia', 'Connecticut', 'Alabama']) {
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
  // twenty-four of them — thirty-three supported states less the nine with no
  // income tax at all — so the uncovered list has the other eighteen.
  assert.equal(UNCOVERED_TAXING_JURISDICTIONS.length, 18);
  assert.equal(SUPPORTED_STATES.length - NO_INCOME_TAX_STATES.length, 24);
  for (const name of UNCOVERED_TAXING_JURISDICTIONS) {
    assert.match(getMissingStatesMessage(), new RegExp(name));
  }
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

test('2025 has no provisional state and 2026 has nine', () => {
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
  assert.equal(count(2025), 0);
  assert.equal(count(2026), 9);
  const provisional2026 = SUPPORTED_STATES.filter(
    (s) => getStateDefinition(s, 2026).status === 'provisional',
  );
  assert.deepEqual(provisional2026, ['CA', 'CO', 'ID', 'MI', 'MO', 'OH', 'OR', 'UT', 'WI']);
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
  assert.equal(checked, 17, 'rates and thresholds printed in rule names');
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
