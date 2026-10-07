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

test('four states charge a different tax on the same household totals', () => {
  // The reason the form asks whose name the retirement income is in. Georgia,
  // Maryland, Kentucky and — from v0.19.0 — New York all claim their retirement
  // exclusion PER PERSON, so a couple's totals do not determine their state tax,
  // and the federal return cannot see the difference at all, which is why
  // nothing warns you.
  //
  // New York joined the list by being MODELLED, not by changing: its $20,000
  // exclusion (Tax Law § 612(c)(3-a)) has been per person since 1981 and this
  // package taxed the whole pension until today. The swing grew by a quarter
  // when one state stopped being wrong.
  const split = { ...COUPLE, socialSecurity: 20_000, pension: 120_000, ira: 0 };
  const even = compute({ ...split, allocation: 'even' });
  const oneName = compute({ ...split, allocation: 'filer' });
  assert.equal(even.federal.totalTax, oneName.federal.totalTax, 'the federal return cannot see it');

  const moved = {};
  for (const state of even.states) {
    const other = oneName.states.find((s) => s.state === state.state);
    if (other.tax !== state.tax) moved[state.state] = [state.tax, other.tax];
  }
  assert.deepEqual(Object.keys(moved).sort(), ['GA', 'KY', 'MD', 'NY']);
  assert.deepEqual(moved.GA, [0, 1_247.5]);
  assert.deepEqual(moved.MD, [273.25, 2_201.75]);
  // $3.15 lower on both sides than before v0.28.0: Kentucky's 2026 standard
  // deduction is $3,360, published by the Department of Revenue, against the
  // $3,270 this package carried forward from 2025. The SWING — which is what
  // this test is about — is $1,088.85 either way, because a deduction both
  // versions of the household take cancels out of the difference.
  assert.deepEqual(moved.KY, [1_904.7, 2_993.55]);
  assert.deepEqual(moved.NY, [3_120.8, 4_200.8]);

  // All four move the same way — concentrating the income wastes the absent
  // spouse's allowance — and together they are worth $5,344.85 on a decision
  // that is usually made for reasons that have nothing to do with tax.
  const swing = Object.values(moved).reduce((total, [a, b]) => total + (b - a), 0);
  assert.equal(Number(swing.toFixed(2)), 5_344.85);
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

test("the page's own state count is the number of states it ranks", () => {
  // Day 8's operating rule — never let the docs contain an unverified number —
  // and `packages/*/test/readme.test.js` has enforced it for every package
  // README since. **This page was the one surface it did not cover**, and it
  // drifted: `index.html` said "30 states" in its title, its meta description
  // and its opening paragraph while the engine had grown to 32 and then 33, and
  // the first two of those are what a search result and a pasted link show.
  //
  // THE RULE: a claim on the one page a visitor actually reads needs the same
  // test as a claim in a README, and it is the page, not the README, that is the
  // product.
  //
  // Read from the SOURCE `index.html` rather than from `dist`, because the
  // source is what a future run edits, and compared against the ranking the
  // model actually produces rather than against `SUPPORTED_STATES` — the page
  // claims to rank states, and a state in the registry that the ranking dropped
  // would make the registry count the wrong number to check.
  const html = readFileSync(join(here, '..', 'index.html'), 'utf8');
  const ranked = compute({ year: 2026, filingStatus: 'single', wages: 60_000 }).states.length;
  const claims = [...html.matchAll(/(\d+) states/g)].map((m) => Number(m[1]));
  assert.ok(claims.length >= 3, `index.html states its coverage ${claims.length} times, expected 3`);
  for (const claimed of claims) {
    assert.equal(claimed, ranked, `index.html claims ${claimed} states and the page ranks ${ranked}`);
  }
  // And the title and the meta description specifically, because those two are
  // the ones a visitor sees before the page loads.
  assert.match(html, new RegExp(`<title>[^<]*${ranked} states`), 'the <title> carries the count');
  assert.match(html, new RegExp(`name="description"[\\s\\S]{0,200}${ranked} states`), 'so does the meta description');
});

test('the ranking moved under Utah again, and Utah still has not moved', () => {
  // The site's whole claim is that it ranks thirty states against each
  // other, and a ranking is only as good as its worst-modelled member.
  //
  // Utah's own figure has not changed since v0.17.0 — $1,388.46, down from
  // $2,801.46 before its retirement credits existed. It has now fallen four
  // times without moving: 16th to 22nd on v0.18.0, when ten states stopped
  // taxing Social Security they exempt; 22nd to 25th on v0.19.0, when Illinois,
  // Michigan and New York stopped taxing pensions they exempt; 25th to 26th on
  // v0.35.0, when Connecticut arrived and charged this couple nothing at all;
  // 26th to 27th on v0.36.0, when Alabama did the same; and 27th to 28th on
  // v0.37.0, when MISSOURI arrived and charged this couple $935.03 — which is
  // not a zero and still beats Utah by $453.43.
  //
  // THIRTEEN states have passed Utah, and the thirteenth is the first to do it
  // BY CHANGING ITS OWN LAW. Wisconsin arrived on Day 43 and charges this couple
  // NOTHING, where the same couple in Wisconsin a year ago paid about $1,507:
  // 2025 Act 15, signed 3 July 2025, created Wis. Stat. § 71.05(6)(b)54m, which
  // subtracts up to $48,000 of retirement income on a joint return where both
  // spouses have reached 67 — and this couple's whole $60,000 pension less that
  // $48,000 leaves $12,000, which Wisconsin's $25,840 standard deduction and
  // $1,900 of exemptions wipe out twice over. Social Security was already
  // exempt.
  //
  // The catch is the one thing no summary of Act 15 says, and the engine models
  // it: claiming the subtraction FORFEITS EVERY CREDIT under § 71.07 — the
  // married couple credit, the school property tax credit, the itemized
  // deduction credit, the earned income credit, the homestead credit. For this
  // couple that is free, because a tax of zero needs no credits. For a couple
  // with a smaller pension it is not, and the engine computes the whole return
  // both ways and keeps the lower answer, as Schedule SB line 16 instructs.
  //
  // So the first twelve rows that passed Utah say something about this table and
  // the thirteenth says something about Wisconsin. The first nine were rows that
  // were WRONG; the next three were rows that did not EXIST, which is the same
  // fact about a ranking from the other side — it is only ever a ranking of what
  // somebody has modelled; and this one is a row that CHANGED, four months ago,
  // in a state legislature.
  //
  // Missouri is the most interesting of the three, because it is the first new
  // row to pass Utah WITHOUT exempting this couple. Missouri is in every list
  // of retiree-friendly states and this couple pays it $935.03, for a reason
  // the page cannot show: their $60,000 is passed as a PRIVATE pension, whose
  // Missouri deduction is $6,000 a person withdrawn dollar for dollar above
  // $32,000 and therefore zero here. The same $60,000 as a PUBLIC pension —
  // a teacher, a police officer, a federal employee — would be deducted up to
  // $47,633, less the $34,000 of Social Security already deducted. One field,
  // two answers, and the page has one box labelled "pension".
  //
  // Alabama's zero is worth one more line, because it is the one row on this
  // page whose answer depends on a question the page does not ask. Alabama
  // exempts a DEFINED BENEFIT pension in full at any age and taxes a DEFINED
  // CONTRIBUTION draw above $6,000 from 65. This page's field is called
  // "pension" and is passed as `employerPlanPension`, which the engine reads as
  // defined benefit — so the $0 is the right answer for a couple with a pension
  // and the wrong one for a couple drawing down a 401(k), and the engine's own
  // note says so on the row.
  //
  // That is the argument for the differential harness in one line: a wrong row
  // is not a wrong row, it is a wrong TABLE, and the only way to find out which
  // rows are wrong is to check every one of them against something.
  const household = {
    year: 2026,
    filingStatus: 'marriedFilingJointly',
    filerAge: 70,
    spouseAge: 70,
    socialSecurity: 40_000,
    pension: 60_000,
  };
  const model = compute(household);
  const utah = model.states.find((row) => row.state === 'UT');
  assert.ok(Math.abs(utah.total - 1_388.46) < 0.005, `Utah is ${utah.total}`);
  const place = model.states.indexOf(utah) + 1;
  assert.equal(place, 29, `Utah ranks ${place}`);
  // The thirteen that passed it: six on v0.18.0, three on v0.19.0, Connecticut
  // on v0.35.0, Alabama on v0.36.0, Missouri on v0.37.0 and WISCONSIN today.
  const ahead = model.states.slice(0, place - 1).map((row) => row.state);
  for (const code of ['ID', 'CA', 'AZ', 'OH', 'MS', 'NC', 'IL', 'MI', 'NY', 'CT', 'AL', 'MO', 'WI']) {
    assert.ok(ahead.includes(code), `${code} should now rank above Utah`);
  }
  // And Wisconsin's is a ZERO that the election produces rather than an
  // exemption. Asserted both ways, because the interesting half is the
  // counterfactual: without § 71.05(6)(b)54m this couple would pay about
  // $1,507, which is what makes the row news rather than another exempting
  // state.
  assert.equal(model.states.find((r) => r.state === 'WI').total, 0, 'Wisconsin is zero');
  // Three of them now charge this couple NOTHING AT ALL, which is the size of
  // what was wrong: Illinois, Michigan and Mississippi exempt every dollar of a
  // $60,000 pension, and the page showed $2,192.85, $1,632 and $936 for them.
  for (const code of ['IL', 'MI', 'MS', 'WI']) {
    const row = model.states.find((r) => r.state === code);
    assert.equal(row.total, 0, `${code} should be zero for a retired couple`);
  }
  // And what it would have been: everything the three Utah credits are worth.
  const credited = utah.result.credits.find((c) => /code A[HJ]|code 18/.test(c.name));
  assert.ok(Math.abs(credited.amount - 1_413) < 0.005, `the credit is ${credited.amount}`);
});

test('a municipal bond is taxed at 2.5% in Utah and nowhere else on the page', () => {
  // The form has asked for tax-exempt interest since the site existed, because
  // § 86 adds it back federally. Utah adds it back a second time, against its
  // own credits, and it is the only state here that does.
  const household = {
    year: 2026,
    filingStatus: 'marriedFilingJointly',
    filerAge: 70,
    spouseAge: 70,
    socialSecurity: 40_000,
    pension: 60_000,
  };
  const plain = compute(household);
  const bonds = compute({ ...household, taxExemptInterest: 10_000 });
  assert.equal(plain.federal.totalTax, bonds.federal.totalTax, 'federal tax is unchanged');
  for (const row of bonds.states) {
    const before = plain.states.find((r) => r.state === row.state);
    const moved = (row.total ?? 0) - (before.total ?? 0);
    if (row.state === 'UT') {
      assert.ok(Math.abs(moved - 250) < 0.005, `Utah moved ${moved}`);
    } else {
      assert.ok(Math.abs(moved) < 0.005, `${row.state} moved ${moved} on exempt interest`);
    }
  }
});

test('the allocation swing is computed and priced without being asked for', () => {
  // Day 21 found this and left it behind a dropdown the reader had to change.
  // It is the one figure on the page that no form, no rate table and no summary
  // of these provisions would give a household, because the federal return
  // cannot see it — so the page states it rather than waiting to be asked.
  const household = {
    year: 2026,
    filingStatus: 'marriedFilingJointly',
    filerAge: 70,
    spouseAge: 70,
    socialSecurity: 20_000,
    pension: 120_000,
    allocation: 'even',
  };
  const model = compute(household);
  assert.ok(model.allocation, 'no swing computed');
  assert.equal(model.allocation.alternative, 'filer');
  assert.deepEqual(
    model.allocation.rows.map((row) => row.state).sort(),
    ['GA', 'KY', 'MD', 'NY'],
    'exactly four states move, and they are the four that cap per person',
  );
  // Widest first, and Maryland's is the widest of the three on these figures.
  assert.equal(model.allocation.widest.state, 'MD');
  assert.ok(Math.abs(model.allocation.widest.difference - 2_842) < 0.005);

  // The federal return is identical both ways. That is the finding, not an
  // implementation detail, so it is asserted rather than assumed.
  const other = compute({ ...household, allocation: 'filer' });
  assert.equal(other.federal.totalTax, model.federal.totalTax);
  // And the swing is symmetric: reading it from the other side names the same
  // three states and the same sizes, with the signs reversed.
  assert.equal(other.allocation.alternative, 'even');
  assert.deepEqual(
    other.allocation.rows.map((row) => row.state).sort(),
    ['GA', 'KY', 'MD', 'NY'],
  );
  assert.ok(Math.abs(other.allocation.widest.difference + 2_842) < 0.005);
  assert.equal(other.allocation.cheaperElsewhere.length, 4, 'every one is cheaper split');
});

test('a single filer has no allocation to swing', () => {
  const model = compute({
    year: 2026,
    filingStatus: 'single',
    filerAge: 70,
    socialSecurity: 20_000,
    pension: 120_000,
  });
  assert.equal(model.allocation, null);
});

test('the single-file build is genuinely single, and is the same code', () => {
  // Day 21's note told the human the Pages artifact "works offline — open
  // index.html". It does not: a <script type="module"> loaded from a file:// URL
  // is blocked by CORS in every Chromium browser and the page comes up blank.
  // The claim was written without opening it that way, which is the exact
  // failure Day 20 and Day 21 exist to record.
  //
  // retirement-tax-calculator.html is the fix: one file, no server, no network,
  // no Pages and no click from anybody. This pins the two things that make it
  // worth having — that it references nothing beside it, and that the code
  // inside it is the code these tests just ran.
  const single = readFileSync(join(dist, 'retirement-tax-calculator.html'), 'utf8');
  for (const external of ['src="app.js"', 'href="style.css"', 'src="vendor/', 'src="src/']) {
    assert.ok(!single.includes(external), `it still loads ${external} from beside itself`);
  }
  // No http(s) SUBRESOURCE either: a font or a script from a CDN would make an
  // offline file quietly worse than the hosted page rather than equal to it.
  // Anchors are fine and there are two of them — a link is not a fetch.
  const remote = [
    ...(single.match(/src="https?:\/\/[^"]+"/g) ?? []),
    ...(single.match(/<link[^>]+href="https?:\/\/[^"]+"/g) ?? []),
  ];
  assert.deepEqual(remote, [], `it fetches ${remote.join(', ')}`);

  // Every module in dist is inside it, byte for byte apart from the import
  // specifiers the loader rewrites.
  const after = single.slice(single.indexOf('const SOURCES = ') + 'const SOURCES = '.length);
  const embedded = JSON.parse(after.slice(0, after.indexOf('\nconst urls')).replace(/;$/, ''));
  const walk = (dir, prefix, into) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path, `${prefix}${entry}/`, into);
      else if (path.endsWith('.js')) into[`${prefix}${entry}`] = readFileSync(path, 'utf8');
    }
  };
  const onDisk = {};
  walk(join(dist, 'vendor'), 'vendor/', onDisk);
  walk(join(dist, 'src'), 'src/', onDisk);
  onDisk['app.js'] = readFileSync(join(dist, 'app.js'), 'utf8');
  assert.deepEqual(Object.keys(embedded).sort(), Object.keys(onDisk).sort(), 'module list');
  for (const [path, source] of Object.entries(onDisk)) {
    assert.equal(embedded[path], source, `${path} differs from the file the suite ran`);
  }

  // And the closing-tag hazard: a "</script" anywhere in the embedded sources
  // would end the tag that carries them.
  const tag = single.slice(single.indexOf('<script type="module">'));
  assert.equal(
    tag.slice(0, tag.indexOf('</script>')).includes('</script'),
    false,
    'an embedded source closes the script tag early',
  );
});
