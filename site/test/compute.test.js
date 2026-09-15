// The site has one file that can be wrong in a way a reader cannot see, and this
// pins it. Everything here runs against `dist/`, so it also proves the vendored
// engines are loadable as plain ES modules with no bundler and no dependencies —
// which is the claim the build makes and the one a browser will test in public.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { FILING_STATUSES, YEARS, compute, federal, normalise } from '../dist/src/compute.js';
import { SUPPORTED_STATES } from '../dist/vendor/us-state-tax/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, '..', 'dist');

/** A retired couple squarely inside the § 86 phase-in. */
const COUPLE = {
  year: 2026,
  filingStatus: 'marriedFilingJointly',
  filerAge: 70,
  spouseAge: 70,
  socialSecurity: 90_000,
  pension: 70_000,
  ira: 10_000,
};

test('the build produces a site with no loose ends', () => {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else files.push(path.slice(dist.length + 1));
    }
  };
  walk(dist);

  for (const required of ['index.html', 'app.js', 'style.css', 'src/compute.js', '.nojekyll']) {
    assert.ok(files.includes(required), `dist is missing ${required}`);
  }
  // No declarations, no sourcemaps, no sourcemap comments pointing at files that
  // were deliberately not shipped — each is a 404 in a visitor's console.
  for (const file of files) {
    assert.ok(!file.endsWith('.d.ts'), `${file} is a declaration file and does not belong here`);
    assert.ok(!file.endsWith('.map'), `${file} is a sourcemap and does not belong here`);
  }
  for (const file of files.filter((f) => f.endsWith('.js'))) {
    assert.ok(
      !readFileSync(join(dist, file), 'utf8').includes('sourceMappingURL'),
      `${file} still points at a sourcemap that is not published`,
    );
  }
  // Both engines, whole.
  assert.ok(files.some((f) => f === 'vendor/us-federal-tax/index.js'));
  assert.ok(files.some((f) => f === 'vendor/us-state-tax/index.js'));
});

test('every state either produces a number or says why not', () => {
  const model = compute(COUPLE);
  assert.equal(model.states.length, SUPPORTED_STATES.length);
  for (const state of model.states) {
    assert.equal(
      state.error,
      undefined,
      `${state.state} did not compute: ${state.error}`,
    );
    assert.ok(Number.isFinite(state.total), `${state.state} produced no total`);
    assert.ok(state.total >= 0, `${state.state} produced a negative total`);
  }
});

test('the three states with no federal starting line get one, and say where it came from', () => {
  const model = compute(COUPLE);
  const derived = model.states.filter((s) => s.derived);
  assert.deepEqual(
    derived.map((s) => s.state).sort(),
    ['MA', 'NJ', 'PA'],
    'exactly Massachusetts, New Jersey and Pennsylvania define their own base',
  );
  for (const state of derived) {
    assert.ok(state.derived.note.length > 80, `${state.state} derives a base without explaining it`);
  }

  const by = Object.fromEntries(derived.map((s) => [s.state, s.derived.amount]));
  // Pennsylvania taxes neither Social Security nor retirement plan distributions
  // after retirement age, so this couple's Pennsylvania base is nothing at all.
  assert.equal(by.PA, 0);
  // New Jersey and Massachusetts both tax the pension and the IRA and neither
  // taxes the benefit, so both start from $80,000 — and then diverge entirely.
  assert.equal(by.NJ, 80_000);
  assert.equal(by.MA, 80_000);
  const nj = model.states.find((s) => s.state === 'NJ');
  const ma = model.states.find((s) => s.state === 'MA');
  assert.equal(nj.total, 0, 'New Jersey exempts this couple outright');
  assert.ok(ma.total > 3_000, 'Massachusetts does not');
});

test('a universal local income tax is reported as a range, not left out', () => {
  const model = compute(COUPLE);
  const withRange = model.states.filter((s) => s.localRange).map((s) => s.state).sort();
  // Exactly the two states where every resident owes a county income tax and
  // there is no county-free jurisdiction to move to.
  assert.deepEqual(withRange, ['IN', 'MD']);

  const md = model.states.find((s) => s.state === 'MD');
  assert.ok(md.localRange.low.local > 0);
  assert.ok(md.localRange.high.local > md.localRange.low.local);
  assert.equal(md.localRange.low.name, 'Worcester County');
  // The county tax is a real fraction of the Maryland bill, not a rounding
  // error, which is the reason for showing it at all.
  assert.ok(md.localRange.low.local > md.tax * 0.3);

  // And the ranking is done on the cheapest achievable total, so a state whose
  // local tax is mandatory cannot appear cheaper than it can actually be.
  const totals = model.states.map((s) => (s.localRange ? s.localRange.low.total : s.total));
  for (let i = 1; i < totals.length; i += 1) {
    assert.ok(totals[i] >= totals[i - 1], 'the ranking is not sorted by achievable total');
  }
});

test('the real marginal rate is measured, and it is not the bracket', () => {
  const model = compute(COUPLE);
  // § 86 puts $1.85 of taxable income behind each dollar; the OBBBA senior
  // deduction withdraws 6% of the excess for each of the two people aged 65.
  assert.equal(model.federal.marginalRate, 0.22);
  assert.equal(Number((model.marginal.federalRate * 100).toFixed(2)), 45.58);
  assert.ok(model.marginal.federalRate > 0.37, 'above the top federal rate, in the 22% bracket');
});

test('what a household receives is not what the return calls income', () => {
  const model = compute(COUPLE);
  assert.equal(model.received, 170_000);
  // $15,150 of the benefit never enters gross income at all, so quoting an
  // effective rate against `grossIncome` overstates it.
  assert.equal(model.federal.grossIncome, 154_850);
  assert.equal(model.federal.socialSecurity.untaxedBenefits, 15_150);
  assert.equal(model.received - model.federal.grossIncome, 15_150);
});

test('three states charge a different tax on the same household totals', () => {
  // The reason the form asks whose name the retirement income is in. Georgia,
  // Maryland and Kentucky all claim their retirement exclusion PER PERSON, so a
  // couple's totals do not determine their state tax — and the federal return
  // cannot see the difference at all, which is why nothing warns you.
  const split = { ...COUPLE, socialSecurity: 20_000, pension: 120_000, ira: 0 };
  const even = compute({ ...split, allocation: 'even' });
  const oneName = compute({ ...split, allocation: 'filer' });
  assert.equal(even.federal.totalTax, oneName.federal.totalTax, 'the federal return cannot see it');

  const moved = {};
  for (const state of even.states) {
    const other = oneName.states.find((s) => s.state === state.state);
    if (other.tax !== state.tax) moved[state.state] = [state.tax, other.tax];
  }
  assert.deepEqual(Object.keys(moved).sort(), ['GA', 'KY', 'MD']);
  assert.deepEqual(moved.GA, [0, 1_247.5]);
  assert.deepEqual(moved.MD, [273.25, 2_201.75]);
  assert.deepEqual(moved.KY, [1_907.85, 2_996.7]);

  // All three move the same way — concentrating the income wastes the absent
  // spouse's allowance — and together they are worth $4,264.85 on a decision
  // that is usually made for reasons that have nothing to do with tax.
  const swing = Object.values(moved).reduce((total, [a, b]) => total + (b - a), 0);
  assert.equal(Number(swing.toFixed(2)), 4_264.85);
});

test('the form cannot be made to throw', () => {
  // Every field arrives as a string from a text input, and people paste
  // anything into them. None of it should reach the engines.
  const junk = {
    year: 'nineteen',
    filingStatus: 'martian',
    filerAge: '-4',
    spouseAge: 'abc',
    wages: '$1,200.50',
    pension: '',
    ira: null,
    socialSecurity: 'lots',
    interestDividends: '  2,000  ',
    longTermCapitalGains: '1e3',
    taxExemptInterest: undefined,
    allocation: 'whatever',
  };
  const input = normalise(junk);
  assert.equal(input.year, YEARS[0]);
  assert.equal(input.filingStatus, 'single');
  assert.equal(input.filerAge, 0);
  assert.equal(input.spouseAge, 0);
  assert.equal(input.wages, 1_200.5);
  assert.equal(input.socialSecurity, 0);
  assert.equal(input.interestDividends, 2_000);
  assert.equal(input.longTermCapitalGains, 1_000);
  assert.equal(input.allocation, 'even');
  assert.doesNotThrow(() => compute(junk));
});

test('an empty form is a valid form', () => {
  const model = compute({});
  assert.equal(model.received, 0);
  assert.equal(model.federal.totalTax, 0);
  for (const state of model.states) {
    assert.equal(state.error, undefined, `${state.state}: ${state.error}`);
    assert.equal(state.total, 0, `${state.state} taxes a household with no income`);
  }
});

test('every year and filing status the form offers actually works', () => {
  for (const year of YEARS) {
    for (const [status] of FILING_STATUSES) {
      const model = compute({ ...COUPLE, year, filingStatus: status });
      assert.ok(Number.isFinite(model.federal.totalTax), `${year} ${status} federal`);
      for (const state of model.states) {
        assert.equal(state.error, undefined, `${year} ${status} ${state.state}: ${state.error}`);
      }
    }
  }
});

test('a separate filer living with their spouse loses the § 86 thresholds', () => {
  // The page does not ask about cohabitation, so it takes the engine's default,
  // which is the expensive reading. If that ever changes silently, a separate
  // filer's answer moves by thousands and nothing on the page would say so.
  const apart = federal(normalise({ ...COUPLE, filingStatus: 'single' }));
  const separate = federal(normalise({ ...COUPLE, filingStatus: 'marriedFilingSeparately' }));
  assert.equal(separate.socialSecurity.cohabitingSeparate, true);
  assert.equal(separate.socialSecurity.baseAmount, 0);
  assert.ok(separate.socialSecurity.taxableBenefits >= apart.socialSecurity.taxableBenefits);
});
