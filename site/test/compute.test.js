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

test('five states charge a different tax on the same household totals', () => {
  // The reason the form asks whose name the retirement income is in. Georgia,
  // Maryland, Kentucky, New York from v0.19.0 and LOUISIANA from v0.52.0 all
  // claim their retirement
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
  // LOUISIANA joined the list the day it shipped, not by changing: R.S. 47:44.1
  // gives its exemption to "the individual who received" the income, so the
  // couple's $12,324 of 2026 exemption is bought twice when the pension is split
  // and once when it is not — $369.72 either way, which is the whole cap at 3%.
  // OKLAHOMA IS THE SIXTH, and it joined on Day 62 the same way Louisiana and
  // New York did — by being modelled, not by changing. 68 O.S. § 2358(A)(8)
  // gives "each individual" up to $10,000 of retirement benefits and unused
  // room is lost, so this couple's $120,000 of pension buys the cap twice when
  // it is split and once when it is not: $450.00 either way, which is the whole
  // $10,000 at the 2026 top rate of 4.5%. And Oklahoma's is the only one of the
  // six available to a filer of ANY AGE — the other five all gate on 62, 65 or
  // 67 — so it is the one row on this page where a couple in their forties can
  // be charged for whose name the pension is in.
  assert.deepEqual(Object.keys(moved).sort(), ['GA', 'KY', 'LA', 'MD', 'NY', 'OK']);
  assert.deepEqual(moved.OK, [3_409, 3_859]);
  assert.deepEqual(moved.LA, [2_090.28, 2_460]);
  assert.deepEqual(moved.GA, [0, 1_247.5]);
  assert.deepEqual(moved.MD, [273.25, 2_201.75]);
  // $3.15 lower on both sides than before v0.28.0: Kentucky's 2026 standard
  // deduction is $3,360, published by the Department of Revenue, against the
  // $3,270 this package carried forward from 2025. The SWING — which is what
  // this test is about — is $1,088.85 either way, because a deduction both
  // versions of the household take cancels out of the difference.
  assert.deepEqual(moved.KY, [1_904.7, 2_993.55]);
  assert.deepEqual(moved.NY, [3_120.8, 4_200.8]);

  // All six move the same way — concentrating the income wastes the absent
  // spouse's allowance — and together they are worth $6,164.57 on a decision
  // that is usually made for reasons that have nothing to do with tax. It was
  // $5,344.85 before Louisiana, $5,714.57 before Oklahoma, and the $450.00
  // Oklahoma added is the whole of its $10,000 per-person cap at the 2026 top
  // rate of 4.5%.
  const swing = Object.values(moved).reduce((total, [a, b]) => total + (b - a), 0);
  assert.equal(Number(swing.toFixed(2)), 6_164.57);
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
  // 32 from Day 61, because NORTH DAKOTA charges this couple NOTHING AT ALL and
  // joins the twenty states tied at zero. The three reasons compose and none of
  // them is a pension exclusion: the base is federal TAXABLE income, so the
  // couple's federal standard deduction is already spent before North Dakota
  // starts; the taxable part of their Social Security comes straight back out
  // at line 15; and what is left is far inside an $82,800 zero bracket. A state
  // with no retirement provision worth the name reaches $0 by having a wide
  // enough first band.
  //
  // 31 from Day 60, because LOUISIANA slotted in above Utah at $290.28 for this
  // couple — twenty-fifth of thirty-six — on a flat 3% with $25,676 of standard
  // deduction, the whole taxable Social Security benefit exempt and $12,324 of
  // pension exempt for each spouse over 65. It was 30 from Day 49, when SOUTH
  // CAROLINA slotted in at $75.82 for the same reasons under § 12-6-1170(B).
  // The ranking is the point of the page and Utah's PLACE moving while its tax
  // does not is exactly what this test is for.
  // 33 from Day 62, because OKLAHOMA slotted in above Utah at $709.00 for this
  // couple — twenty-ninth of thirty-eight — and it is the FOURTEENTH state to
  // pass Utah. Its route is a third one again: not a row that was wrong, not a
  // row that did not exist and was generous, and not a legislature changing its
  // mind, but a state that charges this couple a real figure and still beats
  // Utah by $679.46. The whole taxable Social Security benefit comes out under
  // Schedule 511-A, $10,000 of the pension comes out for each spouse with no
  // age test at all, and what is left meets a top rate of 4.5%. Oklahoma is in
  // no list of retiree-friendly states and it is cheaper here than Utah, which
  // is in several.
  // 34 from Day 63, because IOWA charges this couple NOTHING and joins the
  // states tied at zero, making twenty-two of them. Iowa is the FIFTEENTH state
  // to pass Utah and its route is one no earlier row took: not a wide first
  // band (North Dakota), not a capped exclusion this couple happens to fit
  // inside, but an exclusion with NO CAP AT ALL — Iowa Code § 422.7(19) from
  // tax year 2023 excludes all retirement income of anyone 55 or over.
  //
  // The size of that is worth recording, because no row on the page shows it:
  // raise this couple's pension to $600,000 and Iowa still charges ZERO. Only
  // fourteen states do, nine of which have no income tax at all; the other five
  // are Alabama, Illinois, Iowa, Mississippi and Pennsylvania. AND IOWA IS THE
  // ONLY ONE OF THE FIVE WITH AN AGE TEST — Illinois, Pennsylvania and
  // Mississippi exempt retirement income whatever the filer's age, Alabama's
  // defined-benefit exemption has none either, and Iowa's $600,000 is free at 70
  // and taxed in full at 54. So the largest exemption in this package is also
  // the one most sensitive to a field the page does ask for.
  assert.equal(place, 34, `Utah ranks ${place}`);
  // The thirteen that passed it: six on v0.18.0, three on v0.19.0, Connecticut
  // on v0.35.0, Alabama on v0.36.0, Missouri on v0.37.0 and WISCONSIN today.
  const ahead = model.states.slice(0, place - 1).map((row) => row.state);
  for (const code of ['ID', 'CA', 'AZ', 'OH', 'MS', 'NC', 'IL', 'MI', 'NY', 'CT', 'AL', 'MO', 'WI', 'LA', 'ND', 'OK', 'IA']) {
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
    ['GA', 'KY', 'LA', 'MD', 'NY', 'OK'],
    'exactly six states move, and they are the six that cap per person',
  );
  // Widest first, and Maryland's is the widest of the three on these figures.
  assert.equal(model.allocation.widest.state, 'MD');
  assert.ok(Math.abs(model.allocation.widest.difference - 2_842) < 0.005);

  // The federal return is identical both ways. That is the finding, not an
  // implementation detail, so it is asserted rather than assumed.
  const other = compute({ ...household, allocation: 'filer' });
  assert.equal(other.federal.totalTax, model.federal.totalTax);
  // And the swing is symmetric: reading it from the other side names the same
  // SIX states and the same sizes, with the signs reversed. (This comment said
  // "three" from the day there were three until Day 62, through two states
  // joining the list — a count in a comment beside a list that is asserted.)
  assert.equal(other.allocation.alternative, 'even');
  assert.deepEqual(
    other.allocation.rows.map((row) => row.state).sort(),
    ['GA', 'KY', 'LA', 'MD', 'NY', 'OK'],
  );
  assert.ok(Math.abs(other.allocation.widest.difference + 2_842) < 0.005);
  assert.equal(other.allocation.cheaperElsewhere.length, 6, 'every one is cheaper split');
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

// ---------------------------------------------------------------------------
// The surviving spouse, Day 52
// ---------------------------------------------------------------------------

/**
 * The widow of `packages/us-state-tax/test/south-carolina.test.js`, entered as
 * RECEIPTS rather than as a completed return.
 *
 * A single filer of 65 whose husband would have been 70: her own $20,000
 * civilian pension, his $30,000 of military retired pay, his $15,000 pension and
 * $85,000 of wages. That is $150,000 received, and with no Social Security in it
 * the federal AGI is $150,000 too — the same household the engine's own test
 * pins, reached through the site's plumbing instead of through a hand-written
 * `federal` block.
 */
const WIDOW = {
  year: 2025,
  filingStatus: 'single',
  filerAge: 65,
  wages: 85_000,
  pension: 20_000,
  survivorPension: 15_000,
  survivorMilitaryRetirement: 30_000,
  deceasedSpouseAge: 70,
  socialSecurity: 0,
  ira: 0,
  interestDividends: 0,
};
/** The same dollars with no field to put them in, which is what the site had. */
const AS_HER_OWN = {
  ...WIDOW,
  pension: 35_000,
  militaryRetirement: 30_000,
  survivorPension: 0,
  survivorMilitaryRetirement: 0,
  deceasedSpouseAge: 0,
};

test('the survivor fields reach South Carolina and change nothing else', () => {
  const survivor = compute(WIDOW);
  const asHerOwn = compute(AS_HER_OWN);

  // 1. The same money came in. If this moves, `received` has lost a field.
  assert.equal(survivor.received, 150_000);
  assert.equal(asHerOwn.received, 150_000);

  // 2. THE FEDERAL RETURN CANNOT SEE THE DIFFERENCE. § 72 taxes the annuitant
  //    whoever they are, so every federal figure has to be identical to the cent
  //    — and if it is not, the survivor dollars are missing from
  //    `otherOrdinaryIncome` and the whole comparison below is measuring that
  //    instead of South Carolina.
  assert.equal(survivor.federal.adjustedGrossIncome, 150_000);
  assert.equal(survivor.federal.adjustedGrossIncome, asHerOwn.federal.adjustedGrossIncome);
  assert.equal(survivor.federal.taxableIncome, asHerOwn.federal.taxableIncome);
  assert.equal(survivor.federal.totalTax, asHerOwn.federal.totalTax);

  // 3. EXACTLY ONE STATE MOVES, and it is the one with the statute. This is the
  //    engine's own claim — the other thirty-four states pool these dollars into
  //    the filer's own pension — but it is NOT inherited here, because the site
  //    has three states whose base it computes itself. Pennsylvania, New Jersey
  //    and Massachusetts each had to be told what a survivor annuity is, and a
  //    wrong answer there would show up in this list rather than in the engine's.
  const moved = [];
  for (const here of survivor.states) {
    const there = asHerOwn.states.find((row) => row.state === here.state);
    const total = (row) => (row.localRange ? row.localRange.low.total : row.total);
    if (Math.abs(total(here) - total(there)) >= 0.005) moved.push(here.state);
  }
  assert.deepEqual(moved, ['SC']);

  // 4. And what it is worth. $25,000 of deduction — her own $10,000 cap, his
  //    $30,000 of military pay in full, his own $10,000 cap keyed to HIS age, and
  //    the senior deduction reduced by her own claim alone — at South Carolina's
  //    top rate: 6% in 2025 and 5.21% in 2026.
  const sc = (model) => model.states.find((row) => row.state === 'SC').total;
  assert.equal(Number((sc(asHerOwn) - sc(survivor)).toFixed(2)), 1_500);

  const survivor2026 = compute({ ...WIDOW, year: 2026 });
  const asHerOwn2026 = compute({ ...AS_HER_OWN, year: 2026 });
  assert.equal(Number((sc(asHerOwn2026) - sc(survivor2026)).toFixed(2)), 1_302.5);
});

test('the deceased spouse keeps ageing, and the form asks for the right age', () => {
  const sc = (raw) => compute(raw).states.find((row) => row.state === 'SC').total;
  // $10,000 cap at 70, $3,000 at 60 — $7,000 of deduction at the 6% top rate.
  const at70 = sc(WIDOW);
  const at60 = sc({ ...WIDOW, deceasedSpouseAge: 60 });
  assert.equal(Number((at60 - at70).toFixed(2)), 420);

  // Left at 0, the field is passed as ABSENT rather than as an age of zero, and
  // the engine then takes the lowest band — the cap no age test can fail. Equal
  // to the 60-year-old decedent and NOT to the 70-year-old one, which is the
  // direction that matters: an unsupplied age must not buy the larger figure.
  assert.equal(sc({ ...WIDOW, deceasedSpouseAge: 0 }), at60);

  // AND THE SUBSTITUTION THIS HOUSEHOLD CANNOT DETECT. She is 65 and he would
  // have been 70, so her own age and his are in the SAME cap band, and a widow's
  // return computed from the claimant's age is identical here — $0 of error, from
  // the input the engine's own docs call "the one substitution that looks right
  // and is wrong in both directions".
  assert.equal(sc({ ...WIDOW, deceasedSpouseAge: 65 }), at70);

  // So the mirror household is the test: a widow of 70 whose husband would have
  // been 60. Her own cap is $10,000 and HIS is $3,000, and reading her age for
  // his buys $7,000 of deduction she cannot have — $420 at the 6% top rate, the
  // same figure as above and in the opposite direction.
  const mirror = { ...WIDOW, filerAge: 70, deceasedSpouseAge: 60 };
  assert.equal(Number((sc(mirror) - sc({ ...mirror, deceasedSpouseAge: 70 })).toFixed(2)), 420);
  // A pair of households that differ only in which person's age is read, and
  // neither of them alone can see it: the first pair above moves $420 when the
  // DECEDENT ages and the second moves $420 when the CLAIMANT does.
});

// ---------------------------------------------------------------------------
// The form and the computation, which are two copies of one list
// ---------------------------------------------------------------------------

/**
 * Every control on the form is read, and everything read can be supplied.
 *
 * This is Day 38's defect class in the one place the project had not instrumented
 * it: an input key nothing reads. The engine has `PersonRetirementIncome`'s
 * closed key set and a "did you mean" suggester; the MCP server refuses an
 * argument no state reads; the SITE had neither, so a `name` on an input and a
 * key in `normalise` were two copies of one fact with nothing between them. A
 * misspelt `name` would have been a field a visitor fills in that is silently
 * discarded — and discarded INPUT is the symptomless wrong answer this whole
 * repository is organised against.
 *
 * It is written against the source `index.html` rather than `dist`, for the same
 * reason the coverage-claim test above is: the form a visitor fills in is the
 * source file, and a build step that dropped a field should fail somewhere else.
 */
test('every field on the form is read, and every field read is on the form', () => {
  const html = readFileSync(join(here, '..', 'index.html'), 'utf8');
  const form = html.slice(html.indexOf('<form'), html.indexOf('</form>'));
  const names = [...form.matchAll(/name="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(names).size, names.length, 'a name appears twice on the form');

  // Everything `normalise` produces, less the one figure it derives rather than
  // reads: `joint` is a function of the filing status and no control supplies it.
  const read = Object.keys(normalise({})).filter((key) => key !== 'joint');

  assert.deepEqual(
    [...names].sort(),
    [...read].sort(),
    'the form and normalise() disagree about which inputs exist',
  );
});

test('every money field on the form reaches the figure that is supposed to total them', () => {
  // `received` is the one output that must contain every dollar a visitor
  // enters — it is what the page prints as "Received" and what the effective
  // rate is quoted against. A money field left out of it is understated income
  // on the page, and the field list comes from the form rather than from a
  // literal so that a new one is in this test the day it is added.
  const html = readFileSync(join(here, '..', 'index.html'), 'utf8');
  const money = [
    ...html.matchAll(/name="([^"]+)"[^>]*inputmode="decimal"/g),
  ].map((m) => m[1]);
  assert.ok(money.length >= 10, `found only ${money.length} money fields, expected at least 10`);

  const base = compute({ year: 2026, filingStatus: 'single', filerAge: 67 });
  for (const field of money) {
    const bumped = compute({ year: 2026, filingStatus: 'single', filerAge: 67, [field]: 1_234 });
    assert.equal(
      bumped.received - base.received,
      1_234,
      `${field} does not reach model.received`,
    );
  }
});

test('the federal deductions below the line reach the states that add them back', () => {
  // THE TWO DEFECTS DAY 52 FOUND, AND THEY RAN IN OPPOSITE DIRECTIONS ON THE SAME
  // RETURN, which is why neither showed up as an implausible number.
  //
  //   the engine  South Carolina's 2025 add-back against its frozen § 63(c) was
  //               `federal.deduction - $15,000`, uncapped, which cancels to
  //               `AGI - $15,000` and takes § 63(f)'s additional $2,000 for a
  //               filer of 65 with it. $120 too HIGH.
  //   the site    `federalDeductions` was never passed, so the OBBBA senior
  //               deduction — up to $6,000, and this page's whole audience is
  //               eligible for it — was inherited by a state that adds it back.
  //               Up to $360 too LOW.
  //
  // The widow's $1,500 of senior deduction against her $2,000 of § 63(f) left a
  // net error of $30 on a $4,000 bill. A household is not a test of a provision
  // unless the provision is the only thing moving in it, so both are pinned here
  // by their own add-back lines and not by the total.
  const sc = compute(WIDOW).states.find((row) => row.state === 'SC');
  assert.deepEqual(
    sc.result.addBacks.map((a) => [a.name.slice(0, 24), a.amount]),
    [
      ['Additional senior deduct', 1_500],
      ['Federal standard deducti', 750],
    ],
    'both 2025 add-backs, and the standard one capped at the increase',
  );

  // $150,000 of AGI, a $17,750 federal deduction (the basic $15,750 and
  // § 63(f)'s $2,000), $1,500 of senior deduction, both OBBBA items added back,
  // $55,000 of South Carolina subtractions:
  //   150,000 - 17,750 - 1,500 + 750 + 1,500 - 55,000 = 78,000
  // and the schedule charges 0.03 x 14,270 + 0.06 x 60,170 = 4,038.30.
  assert.equal(sc.result.taxableIncome, 78_000);
  assert.equal(sc.total, 4_038.3);
  // The identity the add-back exists for: the senior deduction comes straight
  // back out, so the base is the same as if the federal return had never allowed
  // it — and § 63(f), which the frozen Code DOES allow, survives.
  assert.equal(
    sc.result.taxableIncome,
    150_000 - 17_750 + 750 - 55_000,
    'the senior deduction is neutral and § 63(f) is not',
  );
});

test('the federal figures the state engine is handed are keys the federal engine still has', () => {
  // `federalDeductions` is assembled by reaching into `fed.additionalDeductions`
  // by name. Every field of it is OPTIONAL on the state engine's side and a
  // missing field is treated as zero — which is the right default for the filers
  // who took none of these and the reason the whole object was missing for
  // thirty days without a symptom.
  //
  // So a RENAME in `us-federal-tax` would not throw here. It would make one of
  // these read `undefined`, the state engine would read it as zero, and South
  // Carolina's senior add-back would quietly vanish again. This is the only guard
  // against that, and it is cheap: the shape is asserted rather than the figures.
  const fed = federal(
    normalise({ year: 2025, filingStatus: 'single', filerAge: 67, pension: 80_000 }),
  );
  assert.equal(typeof fed.qualifiedBusinessIncomeDeduction, 'number');
  for (const key of ['tips', 'overtime', 'senior', 'vehicleLoanInterest']) {
    assert.equal(
      typeof fed.additionalDeductions[key]?.deduction,
      'number',
      `fed.additionalDeductions.${key}.deduction is not a number — a rename would be silent`,
    );
  }
  // And the one that is non-zero for this page's audience, so the assertion is
  // not satisfied by four zeros: $80,000 of pension at 67 is under the $75,000
  // threshold plus the deduction, so the senior deduction is partly withdrawn
  // and partly allowed.
  assert.ok(
    fed.additionalDeductions.senior.deduction > 0,
    'a filer of 67 on $80,000 takes some of the OBBBA senior deduction',
  );
});
