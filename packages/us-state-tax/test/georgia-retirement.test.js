// Georgia's retirement income exclusion and its military retirement exclusion.
//
// The interest of the pair is that they are the *opposite* construction from
// Maryland's, which this package already models: Georgia measures the exclusion
// on the character of the income rather than on the plan it came out of, and
// charges nothing against it. So this file asserts the Georgia arithmetic and
// then asserts the sign flip against Maryland on identical inputs, because the
// headline — "$X of retirement income exempt at 65" — is the same in both and
// is the least informative thing about either.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getStateDefinition, stateIncomeTax } from '../dist/esm/index.js';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

const ga = (agi, opts = {}) =>
  stateIncomeTax({
    state: 'GA',
    year: opts.year ?? 2026,
    filingStatus: opts.filingStatus ?? 'single',
    federal: { adjustedGrossIncome: agi },
    ...opts,
  });

const md = (agi, opts = {}) =>
  stateIncomeTax({
    state: 'MD',
    year: opts.year ?? 2026,
    filingStatus: opts.filingStatus ?? 'single',
    federal: { adjustedGrossIncome: agi },
    county: opts.county ?? 'Montgomery',
    ...opts,
  });

const excluded = (result, fragment = 'retirement income exclusion') =>
  result.computedSubtractions
    .filter((s) => s.name.toLowerCase().includes(fragment))
    .reduce((sum, s) => sum + s.amount, 0);

// 2026: 4.99% flat, $15,000 single standard deduction, $30,000 joint.
const RATE_2026 = 0.0499;

// ---------------------------------------------------------------------------
// The parameters, and the one most summaries still print wrong
// ---------------------------------------------------------------------------

test('the exclusion is $35,000 at 62 and $65,000 at 65, per person', () => {
  for (const year of [2025, 2026]) {
    const rule = getStateDefinition('GA', year).retirementIncomeExclusion;
    assert.equal(rule.minimumAge, 62);
    assert.equal(rule.olderAge, 65);
    assert.equal(rule.capUnderOlderAge, 35_000);
    assert.equal(rule.capAtOlderAge, 65_000);
    assert.equal(rule.disabilityQualifies, true);
  }
});

test('the earned income sub-cap is $5,000, not the $4,000 that preceded it', () => {
  // $4,000 through 2023 and $5,000 since 2024. The older figure is still the one
  // in most summaries of the provision, and it is worth $49.90 of tax at the
  // 2026 rate to a filer whose wages reach it.
  for (const year of [2025, 2026]) {
    assert.equal(getStateDefinition('GA', year).retirementIncomeExclusion.earnedIncomeCap, 5_000);
  }
});

test('the exclusion steps on the birthday and nowhere else', () => {
  const at = (age) => ga(80_000, { filerAge: age, retirement: { filer: { iraDistributions: 80_000 } } });
  money(excluded(at(61)), 0, '61');
  money(excluded(at(62)), 35_000, '62');
  money(excluded(at(64)), 35_000, '64');
  money(excluded(at(65)), 65_000, '65');
  // The sixty-fifth birthday is worth 30,000 x 4.99%.
  money(at(64).totalTax - at(65).totalTax, 30_000 * RATE_2026, 'the 65th birthday');
});

test('disability opens the exclusion at any age, and only for the disabled person', () => {
  const disabled = ga(80_000, {
    filerAge: 40,
    retirement: { filer: { iraDistributions: 80_000, totallyDisabled: true } },
  });
  money(excluded(disabled), 35_000, 'disabled at 40');
  // Maryland reads a spouse's total disability across to the healthy spouse.
  // Georgia does not: the healthy spouse here holds all the income and gets
  // nothing, which is the whole difference between the two statutes on this
  // point and the reason the flag is per person rather than per return.
  const spouseDisabled = ga(80_000, {
    filingStatus: 'marriedFilingJointly',
    filerAge: 40,
    spouseAge: 40,
    retirement: {
      filer: { iraDistributions: 80_000 },
      spouse: { totallyDisabled: true },
    },
  });
  money(excluded(spouseDisabled), 0, "the healthy spouse's own income");
});

// ---------------------------------------------------------------------------
// The exclusion is a test on the TYPE of a retiree's income, not its amount
// ---------------------------------------------------------------------------

test('$65,000 of dividends is excluded in full and $65,000 of wages is not', () => {
  const dividends = ga(65_000, {
    filerAge: 65,
    retirement: { filer: { investmentIncome: 65_000 } },
  });
  const wages = ga(65_000, { filerAge: 65, retirement: { filer: { earnedIncome: 65_000 } } });
  money(excluded(dividends), 65_000, 'dividends');
  money(excluded(wages), 5_000, 'wages');
  money(dividends.totalTax, 0, 'dividends');
  money(wages.totalTax, 2_245.5, 'wages');
  // Same income, same age, same state, $2,245.50 apart.
  money(wages.totalTax - dividends.totalTax, 2_245.5, 'the spread');
});

test('the $5,000 is a cap on what counts, not a floor under it', () => {
  const at = (wages) =>
    excluded(ga(wages, { filerAge: 65, retirement: { filer: { earnedIncome: wages } } }));
  money(at(3_000), 3_000, 'under the cap');
  money(at(5_000), 5_000, 'at the cap');
  money(at(500_000), 5_000, 'far above it');
});

test('the qualifying pool adds the capped wages to the uncapped rest', () => {
  const r = ga(100_000, {
    filerAge: 65,
    retirement: {
      filer: {
        earnedIncome: 20_000,
        investmentIncome: 30_000,
        iraDistributions: 25_000,
        employerPlanPension: 25_000,
      },
    },
  });
  // 5,000 of the wages + 30,000 + 25,000 + 25,000 = 85,000, capped at 65,000.
  money(excluded(r), 65_000, 'the pool, capped');
});

test('an investment loss cannot eat the wages that also qualify', () => {
  // Georgia's Schedule 1 floors the non-earned sources as a block before adding
  // the earned part, so a rental loss does not reduce the $5,000.
  const r = ga(20_000, {
    filerAge: 65,
    retirement: { filer: { earnedIncome: 20_000, investmentIncome: -40_000 } },
  });
  money(excluded(r), 5_000, 'wages survive the loss');
});

// ---------------------------------------------------------------------------
// It is also a capital gains allowance, and nothing calls it one
// ---------------------------------------------------------------------------

test('a couple both 65 realise $130,000 of gains and owe Georgia nothing', () => {
  const r = ga(130_000, {
    filingStatus: 'marriedFilingJointly',
    filerAge: 65,
    spouseAge: 65,
    retirement: {
      filer: { investmentIncome: 65_000 },
      spouse: { investmentIncome: 65_000 },
    },
  });
  money(excluded(r), 130_000, 'both caps');
  money(r.totalTax, 0, 'the whole gain');
});

test('the cap is per person, so whose name the gain is in decides the tax', () => {
  // The second instance in this package of the Maryland finding: where a
  // subtraction is capped per person, a household total is not imprecise, it is
  // insufficient. Georgia reaches it by a different route — there is no
  // per-person offset here at all, only a per-person cap.
  const opts = { filingStatus: 'marriedFilingJointly', filerAge: 65, spouseAge: 65 };
  const split = ga(130_000, {
    ...opts,
    retirement: { filer: { investmentIncome: 65_000 }, spouse: { investmentIncome: 65_000 } },
  });
  const concentrated = ga(130_000, {
    ...opts,
    retirement: { filer: { investmentIncome: 130_000 } },
  });
  money(split.totalTax, 0, 'split evenly');
  // 130,000 less one $65,000 cap less the $30,000 joint standard deduction.
  money(concentrated.totalTax, 35_000 * RATE_2026, 'all on one spouse');
  money(concentrated.totalTax - split.totalTax, 1_746.5, 'decided by nothing but the name');
});

test('omitting the split puts everything on one spouse and says so', () => {
  const r = ga(130_000, {
    filingStatus: 'marriedFilingJointly',
    filerAge: 65,
    spouseAge: 65,
    retirementIncome: 130_000,
  });
  money(excluded(r), 65_000, 'one cap only');
  const name = r.computedSubtractions.find((s) => s.name.includes('retirement income'))?.name ?? '';
  assert.match(name, /assumed/i);
  // And the error runs towards too much tax, never too little.
  assert.ok(r.totalTax > 0);
});

test('a qualifying age with no retirement figures at all is priced in the notes', () => {
  const r = ga(60_000, { filerAge: 70 });
  money(excluded(r), 0, 'nothing supplied, nothing assumed');
  const note = r.notes.find((n) => n.includes('No `retirement` was supplied'));
  assert.ok(note, 'the note is present');
  assert.match(note, /\$2,245\.50/);
  // Below the age there is no such note, because there is nothing to leave out.
  assert.ok(!ga(60_000, { filerAge: 55 }).notes.some((n) => n.includes('No `retirement`')));
});

// ---------------------------------------------------------------------------
// The military exclusion: below 62 only, and a cliff on employment
// ---------------------------------------------------------------------------

test('the military exclusion is available below 62 and vanishes at it', () => {
  const at = (age) =>
    excluded(
      ga(40_000, { filerAge: age, retirement: { filer: { militaryRetirement: 40_000 } } }),
      'military retirement exclusion',
    );
  money(at(40), 17_500, '40');
  money(at(61), 17_500, '61');
  money(at(62), 0, '62');
});

test('one dollar of wages at $17,500 is worth $873.20 to a veteran', () => {
  const at = (wages) =>
    ga(40_000 + wages, {
      filerAge: 55,
      retirement: { filer: { militaryRetirement: 40_000, earnedIncome: wages } },
    });
  money(excluded(at(17_500), 'military'), 17_500, 'at the threshold');
  money(excluded(at(17_501), 'military'), 35_000, 'one dollar over');
  // $17,500 of exclusion less the tax on the extra dollar itself.
  money(at(17_500).totalTax - at(17_501).totalTax, 17_500 * RATE_2026 - RATE_2026, 'the cliff');
  money(at(17_500).totalTax - at(17_501).totalTax, 873.2, 'the cliff, in dollars');
});

test('the second $17,500 cannot exceed the military pay it is an exclusion of', () => {
  const r = ga(37_500, {
    filerAge: 55,
    retirement: { filer: { militaryRetirement: 20_000, earnedIncome: 17_501 } },
  });
  money(excluded(r, 'military'), 20_000, 'capped by the pay');
});

test("an unknown age does not qualify for a rule written as 'below 62'", () => {
  const r = ga(40_000, { retirement: { filer: { militaryRetirement: 40_000 } } });
  money(excluded(r, 'military'), 0, 'no age supplied');
});

// ---------------------------------------------------------------------------
// Composing the two: Georgia's real maximum, and the trough at 62
// ---------------------------------------------------------------------------

test("Georgia's largest exclusion is $70,000 and it is not the one in the tables", () => {
  // A permanently disabled veteran under 62 with earned income above $17,500
  // qualifies for both worksheets: $35,000 of military pay under (a)(5.1) and
  // $35,000 of everything else under (a)(5). That is more than the $65,000 every
  // table prints as Georgia's maximum, and it is available twenty-four years
  // earlier.
  const person = {
    militaryRetirement: 35_000,
    iraDistributions: 40_000,
    earnedIncome: 20_000,
    totallyDisabled: true,
  };
  const at = (age) => ga(95_000, { filerAge: age, retirement: { filer: person } });
  money(excluded(at(61), 'exclusion'), 70_000, 'at 61');
  money(excluded(at(62), 'exclusion'), 35_000, 'at 62');
  money(excluded(at(65), 'exclusion'), 65_000, 'at 65');
  // So the sixty-second birthday — the one every guide to Georgia describes as
  // the birthday the retirement exclusion begins — costs this filer $1,746.50,
  // and it is not recovered until 65.
  money(at(62).totalTax - at(61).totalTax, 1_746.5, 'turning 62');
  assert.ok(at(61).totalTax < at(65).totalTax, '61 beats 65');
});

test('military pay the military exclusion did not reach is ordinary pension income', () => {
  // At 65 the military exclusion is gone, so a military retiree's pension has to
  // reach the ordinary exclusion or the state taxes a pension it plainly exempts.
  const r = ga(50_000, { filerAge: 65, retirement: { filer: { militaryRetirement: 50_000 } } });
  money(excluded(r), 50_000, 'the whole pension');
  money(r.totalTax, 0, 'at 65');
  // And below 62 the same dollars are never excluded twice: $35,000 by the
  // military worksheet, the remaining $15,000 by the ordinary one for a filer
  // whose disability opens it.
  const under = ga(50_000, {
    filerAge: 55,
    retirement: {
      filer: { militaryRetirement: 50_000, earnedIncome: 20_000, totallyDisabled: true },
    },
  });
  money(excluded(under, 'military retirement exclusion'), 35_000, 'the military half');
  money(excluded(under, 'retirement income exclusion'), 15_000 + 5_000, 'what is left, plus wages');
});

// ---------------------------------------------------------------------------
// Georgia against Maryland on identical inputs — the sign flips twice
// ---------------------------------------------------------------------------

test('the rollover that costs $3,378.83 in Maryland costs nothing in Georgia', () => {
  const plan = { filerAge: 70, retirement: { filer: { employerPlanPension: 150_000 } } };
  const ira = { filerAge: 70, retirement: { filer: { iraDistributions: 150_000 } } };
  money(ga(150_000, ira).totalTax - ga(150_000, plan).totalTax, 0, 'Georgia');
  money(md(150_000, ira).totalTax - md(150_000, plan).totalTax, 3_378.83, 'Maryland');
});

test('a third of a retirement moved into Social Security saves in GA and costs in MD', () => {
  // $120,000 of income at 70, once as pension alone and once as $94,500 of
  // pension plus $30,000 of benefits of which $25,500 reached federal AGI.
  // Both states say they do not tax Social Security.
  const withBenefits = {
    filerAge: 70,
    taxableSocialSecurity: 25_500,
    retirement: { filer: { employerPlanPension: 94_500, socialSecurityBenefits: 30_000 } },
  };
  const pensionOnly = { filerAge: 70, retirement: { filer: { employerPlanPension: 120_000 } } };
  money(
    ga(120_000, withBenefits).totalTax - ga(120_000, pensionOnly).totalTax,
    -1_272.45,
    'Georgia saves',
  );
  money(
    md(120_000, withBenefits).totalTax - md(120_000, pensionOnly).totalTax,
    357.75,
    'Maryland charges',
  );
});

test('Georgia subtracts taxable Social Security and charges nothing against the exclusion', () => {
  const r = ga(55_000, {
    filerAge: 68,
    taxableSocialSecurity: 25_000,
    retirement: { filer: { employerPlanPension: 30_000, socialSecurityBenefits: 40_000 } },
  });
  money(
    excluded(r, 'social security'),
    25_000,
    'the taxable part comes off the base',
  );
  // $40,000 of benefits received, and the $30,000 pension is excluded in full
  // anyway. In Maryland that same $40,000 would have wiped the exclusion out.
  money(excluded(r), 30_000, 'the exclusion is untouched');
  money(r.totalTax, 0, 'nothing left to tax');
});

// ---------------------------------------------------------------------------
// HB 463's 2026-2028 compensation exclusions
// ---------------------------------------------------------------------------

test('Georgia excludes $1,750 each of overtime and tips, from 2026 and not before', () => {
  const fed = { federalDeductions: { overtime: 3_000, tips: 3_000 } };
  const y2025 = ga(60_000, { ...fed, year: 2025 });
  const y2026 = ga(60_000, { ...fed, year: 2026 });
  assert.deepEqual(y2025.computedSubtractions, []);
  money(excluded(y2026, 'overtime'), 1_750, 'overtime');
  money(excluded(y2026, 'tip'), 1_750, 'tips');
  // Both caps together, at the 2026 rate.
  money(
    ga(60_000, { year: 2026 }).totalTax - y2026.totalTax,
    3_500 * RATE_2026,
    'what the two are worth',
  );
});

test('the compensation exclusions are capped by the deduction as well as by statute', () => {
  const r = ga(60_000, { year: 2026, federalDeductions: { overtime: 400, tips: 0 } });
  money(excluded(r, 'overtime'), 400, 'less than the cap');
  money(excluded(r, 'tip'), 0, 'no tips, no line');
});

// ---------------------------------------------------------------------------
// Nothing above changed a return that says nothing about retirement
// ---------------------------------------------------------------------------

test('a working-age Georgia return is exactly what it was', () => {
  const r = ga(60_000, { filerAge: 40 });
  money(r.taxableIncome, 45_000, 'taxable income');
  money(r.totalTax, 45_000 * RATE_2026, 'tax');
  assert.deepEqual(r.computedSubtractions, []);
  const y2025 = ga(60_000, { filerAge: 40, year: 2025 });
  money(y2025.taxableIncome, 48_000, '2025 taxable income');
  money(y2025.totalTax, 48_000 * 0.0519, '2025 tax');
});

// ---------------------------------------------------------------------------
// Notes carried only by the returns they could change
// ---------------------------------------------------------------------------

test('a Georgia return with no military pay does not carry the military notes', () => {
  const plain = ga(80_000, { filerAge: 70, retirement: { filer: { iraDistributions: 80_000 } } });
  const veteran = ga(60_000, {
    filerAge: 55,
    retirement: { filer: { militaryRetirement: 40_000, earnedIncome: 20_000 } },
  });
  const has = (r) => r.notes.some((n) => n.includes('§ 48-7-27(a)(5.1)'));
  assert.equal(has(plain), false, 'the exclusion the filer cannot claim');
  assert.equal(has(veteran), true, 'the one they can');
  // Three notes and about 1,500 characters of a caller's context, spent only
  // where they buy something.
  assert.equal(veteran.notes.length - plain.notes.length, 3);
  assert.ok(plain.notes.join(' ').length + 1_000 < veteran.notes.join(' ').length);
  // And the state's definition still holds them, so nothing is lost — only the
  // decision about who pays for them has moved.
  const def = getStateDefinition('GA', 2026);
  assert.equal(def.conditionalNotes.length, 3);
  for (const note of def.conditionalNotes) assert.equal(typeof note.text, 'string');
});

test('Maryland spends its military and centenarian notes the same way', () => {
  const mdAt = (opts) =>
    stateIncomeTax({
      state: 'MD',
      year: 2026,
      filingStatus: 'single',
      county: 'Montgomery',
      federal: { adjustedGrossIncome: 80_000 },
      ...opts,
    });
  const plain = mdAt({ filerAge: 70, retirement: { filer: { employerPlanPension: 80_000 } } });
  const veteran = mdAt({ filerAge: 70, retirement: { filer: { militaryRetirement: 20_000 } } });
  const centenarian = mdAt({ filerAge: 100 });
  const carries = (r, fragment) => r.notes.some((n) => n.includes(fragment));
  assert.equal(carries(plain, '§ 10-207(q)'), false);
  assert.equal(carries(veteran, '§ 10-207(q)'), true);
  assert.equal(carries(plain, '§ 10-207(nn)'), false);
  assert.equal(carries(centenarian, '§ 10-207(nn)'), true);
});

test('a state with no conditional notes is untouched', () => {
  const def = getStateDefinition('IL', 2026);
  assert.equal(def.conditionalNotes, undefined);
  const r = stateIncomeTax({
    state: 'IL',
    year: 2026,
    filingStatus: 'single',
    federal: { adjustedGrossIncome: 60_000, earnedIncomeCredit: 0 },
  });
  assert.deepEqual(r.notes, def.notes);
});
