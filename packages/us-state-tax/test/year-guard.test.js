// NO BUILDER MAY ANSWER FOR A YEAR THE PACKAGE DOES NOT SUPPORT.
//
// Day 83. Thirty-two of this package's thirty-three taxing states decline a tax
// year they have no figures for — thirty-one through the same line,
//
//   if (year !== 2025 && year !== 2026) return undefined;
//
// and California through a per-year if/else chain that falls to the same
// `undefined`. Two builders did not guard at all, and between them they cover
// ten of the forty-two states. `arizona()` returned a definition for every integer ever passed
// to it, carrying 2026's standard deduction and a 2.5% rate that did not exist
// before 2023, stamped with the requested year and `status: 'published'`.
// `noIncomeTaxDefinitions()` returned all nine states for every year, which
// describes **New Hampshire as having no individual income tax in 2020** — the
// interest and dividends tax was live at 5% and ran through tax year 2024 — and
// Tennessee the same before its Hall tax was repealed for 2021.
//
// ## NEITHER WAS REACHABLE, AND THAT IS WHY THIS FILE IS A SWEEP
//
// `REGISTRY` is assembled only from `SUPPORTED_YEARS`, the builders are not
// exported from the package's `index.ts`, and `getStateDefinition` throws for
// any year outside the registry. No caller could obtain either wrong answer.
//
// So the defect was a missing guard and not a wrong answer served — and a
// missing guard is invisible to every instrument this package owns. 1,191 tests,
// 2,715 mutants, 2,904 differential households and a provenance ledger all
// examine the two supported years, because those are the years a caller can ask
// for. The mutation audit cannot kill a mutant in a branch no test reaches with
// an argument no caller can supply.
//
// It was armed to fire on the next thing the roadmap calls for. The whole point
// of `SUPPORTED_YEARS` being a list is that adding 2027 is one edit; the day
// that edit happens, `definitionsForYear(2027)` is called for real, and Arizona
// would have shipped 2026's deduction as a published 2027 figure — $500 of
// deduction and $12.50 of Arizona tax per single filer, with a `published`
// status on it — while the other seven flat states correctly declined.
//
// ## WHY IT PROBES 1990 TO 2100 INSTEAD OF max + 1
//
// Because the shape of both defects was a fall-through, and a fall-through has
// no edge. Arizona's was `year === 2025 ? a : b`, which is wrong in BOTH
// directions and most wrong in the past, where the rate itself is anachronistic.
// A probe of `max(SUPPORTED_YEARS) + 1` would have caught Arizona and said
// nothing about 1999. The sweep costs a few milliseconds and has no judgement in
// it about which wrong year somebody will pass.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { definitionsForYear } from '../dist/esm/states/index.js';
import { definitionsForYear as localitiesForYear } from '../dist/esm/localities/index.js';
import {
  SUPPORTED_LOCALITIES,
  SUPPORTED_LOCALITY_YEARS,
  getLocalityDefinition,
  isLocalitySupported,
  supportedLocalityYears,
} from '../dist/esm/index.js';
import { SUPPORTED_STATES, SUPPORTED_YEARS, supportedYears } from './strict.mjs';

const FIRST_PROBE = 1990;
const LAST_PROBE = 2100;

test('no builder returns a definition for an unsupported year, 1990 to 2100', () => {
  const answered = [];
  for (let year = FIRST_PROBE; year <= LAST_PROBE; year += 1) {
    if (SUPPORTED_YEARS.includes(year)) continue;
    const defs = definitionsForYear(year);
    if (defs.length > 0) answered.push(`${year}: ${defs.map((d) => d.code).join(' ')}`);
  }
  assert.deepEqual(
    answered,
    [],
    'a builder answered for a year the registry cannot serve:\n  ' + answered.join('\n  '),
  );
});

test('no LOCALITY builder answers for an unsupported year either, 1990 to 2100', () => {
  // The locality registry is built the same way, over the same year list, from
  // builders that carry their own year check. Both of the two were clean when
  // this gate was written. They are swept anyway: 1,033 local income taxes are
  // reached through two builders, and the Ohio and Maryland tables behind them
  // are the largest parameter sets in the package.
  const answered = [];
  for (let year = FIRST_PROBE; year <= LAST_PROBE; year += 1) {
    if (SUPPORTED_YEARS.includes(year)) continue;
    const defs = localitiesForYear(year);
    if (defs.length > 0) answered.push(`${year}: ${defs.map((d) => d.code).join(' ')}`);
  }
  assert.deepEqual(answered, [], 'a locality builder answered for an unsupported year:\n  ' + answered.join('\n  '));

  // Counted against the years localities actually serve, not against the
  // package-wide list. The first draft asserted `localitiesForYear(year).length > 0`
  // for every `SUPPORTED_YEARS` entry, and it failed on the first non-uniform
  // year for a reason that has nothing to do with the defect this file guards:
  // tax year 2027 is served by the nine states with no income tax and by NO
  // locality, because every local income tax here has a rate or a bracket the
  // jurisdiction publishes separately. That is the same uniformity assumption
  // the eight derived lists had, written into the gate that was supposed to be
  // about non-uniformity — one level out, and by me, on the day after.
  assert.ok(SUPPORTED_LOCALITY_YEARS.length > 0, 'no year serves any locality at all');
  for (const year of SUPPORTED_LOCALITY_YEARS) {
    assert.ok(localitiesForYear(year).length > 0, `year ${year}`);
  }
  for (const year of SUPPORTED_YEARS) {
    const served = localitiesForYear(year).length > 0;
    assert.equal(
      served,
      SUPPORTED_LOCALITY_YEARS.includes(year),
      `SUPPORTED_LOCALITY_YEARS disagrees with the builders about ${year}`,
    );
  }
});

test('a locality refuses a year it does not serve, and names the years it does', () => {
  // The state refusal has quoted `supportedYears(state)` since Day 83; the
  // locality refusal quoted the package-wide `SUPPORTED_YEARS` until today, so
  // the first year served by states and not by localities would have told a New
  // York City caller that 2027 was a supported year in the same sentence that
  // refused it. That is Day 83's "a guard that cannot run answers the question
  // for the next reader" in its other form: a message that cannot be wrong until
  // the grid stops being square, and is wrong the moment it does.
  const unserved = SUPPORTED_YEARS.filter((y) => !SUPPORTED_LOCALITY_YEARS.includes(y));
  for (const locality of SUPPORTED_LOCALITIES) {
    assert.deepEqual(
      [...supportedLocalityYears(locality)],
      [...SUPPORTED_LOCALITY_YEARS].filter((y) => isLocalitySupported(locality, y)),
    );
    for (const year of unserved) {
      assert.throws(
        () => getLocalityDefinition(locality, year),
        (err) => {
          assert.ok(err instanceof RangeError);
          assert.match(err.message, new RegExp(`tax year ${year} is not`));
          assert.ok(
            !new RegExp(`Supported years:[^.]*\\b${year}\\b`).test(err.message),
            `the refusal for ${locality} ${year} lists ${year} as supported: ${err.message}`,
          );
          return true;
        },
      );
    }
  }
});

test('the probe actually exercises the builders rather than an empty loop', () => {
  // A sweep that asserts emptiness passes trivially if `definitionsForYear` is
  // broken, renamed or returns nothing at all. This is the companion assertion
  // that the instrument is pointed at something: every supported year must build
  // all forty-two states, and the probe range must contain the supported years
  // so that the loop above is skipping them rather than never reaching them.
  assert.ok(SUPPORTED_YEARS.length >= 1);
  for (const year of SUPPORTED_YEARS) {
    assert.ok(year >= FIRST_PROBE && year <= LAST_PROBE, `${year} is outside the probe range`);
    // Counted against the states that serve THIS year rather than against all
    // forty-two. The first draft of this assertion compared to
    // `SUPPORTED_STATES.length`, and it failed the moment a non-uniform year was
    // tried — correctly, and for a reason that has nothing to do with the defect
    // this file guards. A gate that assumes uniformity is one more place
    // December has to edit.
    const serving = SUPPORTED_STATES.filter((s) => supportedYears(s).includes(year));
    assert.equal(definitionsForYear(year).length, serving.length, `year ${year}`);
    assert.ok(serving.length > 0, `year ${year} is served by no state`);
  }
  assert.equal(SUPPORTED_STATES.length, 42);
});

test('a builder stamps the year it was asked for, not the year it has figures for', () => {
  // Arizona's `year` field was the requested year while its figures were 2026's,
  // so the definition was internally consistent about the one thing that cannot
  // reveal the defect. This asserts the field is right for the supported years —
  // a builder that hard-coded `year: 2026` would serve 2025 a 2026 label.
  for (const year of SUPPORTED_YEARS) {
    for (const def of definitionsForYear(year)) {
      assert.equal(def.year, year, `${def.code} stamped ${def.year} when asked for ${year}`);
    }
  }
});

test('every supported year is supported by at least one state', () => {
  // The December failure mode, in one assertion. `SUPPORTED_YEARS` is the list
  // the package advertises and `supportedYears(state)` is what each state
  // actually answers for; the forty-two states publish their 2027 figures
  // between December and February, so the two lists are about to stop being
  // equal state by state. What must never happen is a year in the advertised
  // list that NO state serves: `getStateDefinition`'s refusal message prints
  // `supportedYears(state)`, so a dangling year would be advertised at the top
  // of the README and absent from every error message that quotes it.
  const served = new Set(SUPPORTED_STATES.flatMap((s) => supportedYears(s)));
  for (const year of SUPPORTED_YEARS) {
    assert.ok(served.has(year), `${year} is in SUPPORTED_YEARS and no state serves it`);
  }
  for (const year of served) {
    assert.ok(SUPPORTED_YEARS.includes(year), `${year} is served and not advertised`);
  }
  for (const state of SUPPORTED_STATES) {
    assert.ok(supportedYears(state).length > 0, `${state} serves no year`);
  }
});

// ## THE NON-UNIFORM YEAR, BUILT AND IMPORTED RATHER THAN REASONED ABOUT
//
// Two module-level `const`s in `states/index.ts` derived their lists by calling
// `getStateDefinition(state, year)` for the whole cross product of
// `SUPPORTED_STATES` and `SUPPORTED_YEARS`. `getStateDefinition` throws on a
// state-year the registry does not hold, so the first year that some states
// served and others did not made `import 'us-state-tax'` raise a `RangeError`
// before any caller reached a function. They now ask `supportedYears(code)`.
//
// **That fix is invisible to every other test in this suite**, because both
// supported years are served by all forty-two states: `supportedYears(code)` and
// `SUPPORTED_YEARS` are the same array today, so the old code and the new code
// are indistinguishable until the day the package stops being square. A fix
// nothing exercises is a comment.
//
// So this builds the non-uniform case. It copies the ESM build, adds a probe
// year to `SUPPORTED_YEARS` and to the nine no-income-tax states only, and
// imports the copy. The nine are the right states to extend because they are the
// only nine that can answer for a tax year before any state publishes anything:
// a state with no income tax has no figure that can arrive later.
//
// It is the shape of every month from December. Forty-two states publish their
// 2027 figures between December and February, one at a time.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const PROBE_YEAR = 2031;

// ONE COPY PER FILE, DELETED AS SOON AS IT IS IMPORTED, AND THAT IS NOT A
// TIDINESS NOTE.
//
// The first version of this file called `buildNonUniform()` inside each test and
// never removed the directory, so every run of this suite left two full copies
// of `dist/esm` in the OS temp directory. **The mutation audit runs this suite
// once per mutant.** Today's audit ran it about 766 times and left **1,532
// directories and roughly 1.5 GB** behind — on a sandbox with a fixed writable
// allowance, which is how a leak becomes a wrong answer rather than a mess: the
// first symptom was one unreproducible failure in `us-tax-mcp`'s suite during
// `test-counts.mjs`, with the disk the only thing that had changed.
//
// So the copy is built once, lazily, imported, and deleted. Deleting after the
// `import()` is safe because the module is already resolved and held in memory;
// nothing reads the files again.
//
// THE RULE: A TEST THAT WRITES TO DISK IS RUN BY EVERY INSTRUMENT THAT RUNS THE
// SUITE, and the mutation audit runs it thousands of times. The cost of a
// fixture is its cost times the number of times something else decides to run it.
let nonUniform;

async function nonUniformModule() {
  if (nonUniform) return nonUniform;
  const dir = buildNonUniform();
  try {
    nonUniform = await import(pathToFileURL(join(dir, 'index.js')).href);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return nonUniform;
}

function buildNonUniform() {
  const dir = mkdtempSync(join(tmpdir(), 'us-state-tax-nonuniform-'));
  cpSync(new URL('../dist/esm/', import.meta.url), dir, { recursive: true });

  // The year lists are DERIVED from the build rather than written here. The
  // first draft of this helper matched the literal string
  // `[2025, 2026]`, which is a gate about adding a tax year that breaks on the
  // day a tax year is added — the same defect as Day 82's
  // `an unsupported year throws` using 2027 as its probe.
  const bump = (rel, decl) => {
    const file = join(dir, rel);
    const before = readFileSync(file, 'utf8');
    const found = [...before.matchAll(new RegExp(`${decl} = \\[([\\d, ]+)\\];`, 'g'))];
    assert.equal(found.length, 1, `expected exactly one \`${decl} = [...]\` in ${rel}, found ${found.length}`);
    const years = found[0][1].split(',').map((n) => Number(n.trim()));
    assert.ok(!years.includes(PROBE_YEAR), `${PROBE_YEAR} is already in ${decl}; pick another probe year`);
    writeFileSync(file, before.replace(found[0][0], `${decl} = [${[...years, PROBE_YEAR].join(', ')}];`));
    return years;
  };

  // The advertised list gains the probe year; only the nine with no income tax serve it.
  const advertised = bump('states/index.js', 'export const SUPPORTED_YEARS');
  const nine = bump('states/no-income-tax.js', 'const YEARS');
  assert.deepEqual(advertised, nine, 'the nine no-income-tax states no longer serve exactly the advertised years, so this probe would not be a NON-uniform year');

  return dir;
}

test('the package imports when a year is served by some states and not others', async () => {
  const mod = await nonUniformModule();

  assert.ok(mod.SUPPORTED_YEARS.includes(PROBE_YEAR));
  // The nine answer for the probe year; the thirty-three taxing states do not.
  for (const state of mod.NO_INCOME_TAX_STATES) {
    assert.ok(
      mod.supportedYears(state).includes(PROBE_YEAR),
      `${state} should serve ${PROBE_YEAR}`,
    );
    assert.equal(mod.isSupported(state, PROBE_YEAR), true);
    assert.equal(mod.getStateDefinition(state, PROBE_YEAR).year, PROBE_YEAR);
  }
  const taxing = mod.SUPPORTED_STATES.filter((s) => !mod.NO_INCOME_TAX_STATES.includes(s));
  assert.equal(taxing.length, 33);
  for (const state of taxing) {
    assert.equal(mod.isSupported(state, PROBE_YEAR), false, `${state} should refuse`);
    assert.deepEqual(mod.supportedYears(state), [2025, 2026]);
    assert.throws(() => mod.getStateDefinition(state, PROBE_YEAR), /tax year/);
  }
});

test('a non-uniform year does not move a list derived across years', async () => {
  // The import surviving is not enough: a `.some()` that swallowed the throw
  // would also import, and would quietly drop every state whose first
  // `getStateDefinition` call missed. Adding a year in which nine states have no
  // tax rule at all must change neither list — both are about which states read
  // an INPUT, and the nine read nothing in any year.
  const mod = await nonUniformModule();
  const live = await import('./strict.mjs');

  assert.deepEqual(mod.STATES_READING_RETIREMENT, [...live.STATES_READING_RETIREMENT]);
  assert.deepEqual(
    mod.STATES_READING_TAXABLE_SOCIAL_SECURITY,
    [...live.STATES_READING_TAXABLE_SOCIAL_SECURITY],
  );
  assert.ok(mod.STATES_READING_RETIREMENT.length > 0);
  assert.ok(mod.STATES_READING_TAXABLE_SOCIAL_SECURITY.length > 0);
  // And the probe year must not have crept into either state's year list.
  assert.equal(mod.supportedYears(mod.STATES_READING_RETIREMENT[0]).includes(PROBE_YEAR), false);
});
