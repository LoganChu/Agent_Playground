// Ohio: the state return, and the 679 municipal income taxes beside it.
//
// The claims this file exists to hold down are the two discontinuities in
// O.R.C. § 5747.02(A)(3). They are not rounding artifacts and they are not
// expressible as marginal brackets, so an engine that models Ohio as
// "0% / 2.75% / 3.125%" is wrong by $342 for every filer above the threshold —
// which is most of them.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  OHIO_MUNICIPALITIES,
  OHIO_MUNICIPAL_RATES,
  OH_BASE_AMOUNT,
  OH_TOP_BASE_AMOUNT_2025,
  OH_TOP_BASE_AMOUNT_CHAINED_2025,
  OH_UNVOTED_RATE_CEILING,
  OH_ZERO_BAND_CEILING,
  applyBaseAmountSchedule,
  getStateDefinition,
  ohioMunicipalities,
  ohioMunicipality,
  stateIncomeTax,
} from '../dist/esm/index.js';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

const federal = (agi) => ({
  adjustedGrossIncome: agi,
  taxableIncome: Math.max(0, agi - 15_750),
  deduction: 15_750,
  deductionKind: 'standard',
});

const oh = (opts = {}) =>
  stateIncomeTax({
    state: 'OH',
    year: opts.year ?? 2025,
    filingStatus: opts.filingStatus ?? 'single',
    federal: federal(opts.agi ?? 60_000),
    ...opts,
  });

test('the $342 constant is charged whole on one cent of income', () => {
  // A single filer with no dependents has $2,400 of exemption, so the zero band
  // runs to $28,450 of Ohio AGI. One cent past it the whole constant arrives.
  money(oh({ agi: 28_450 }).tax, 0);
  money(oh({ agi: 28_450.01 }).tax, 322.0);
  money(oh({ agi: 28_451 }).tax, 322.03);
  // $322 rather than $342 because the $20 exemption credit is still allowed at
  // this income and is worth nothing at all to the filer one cent poorer, whose
  // tax it cannot reduce below zero. The credit makes the cliff smaller; it does
  // not make it a slope.
  const gross = applyBaseAmountSchedule(26_050.01, getStateDefinition('OH', 2025).rate.bands);
  money(gross.tax, 342.000275);
  money(applyBaseAmountSchedule(26_050, getStateDefinition('OH', 2025).rate.bands).tax, 0);
});

test('the second discontinuity: $18.69 at $100,000, and where it came from', () => {
  // $101,900 of Ohio AGI is $100,000 of taxable income after the $1,900 step of
  // the exemption chart, which is the boundary itself.
  money(oh({ agi: 101_900 }).tax, 2_375.63);
  money(oh({ agi: 101_900.01 }).tax, 2_394.32);
  // $18.695 exactly, which is $18.69 once each side is rounded to the cent the
  // return is filed in.
  money(OH_TOP_BASE_AMOUNT_2025 - OH_TOP_BASE_AMOUNT_CHAINED_2025, 18.695);
  money(oh({ agi: 101_900.01 }).tax - oh({ agi: 101_900 }).tax, 18.69);
  // The $100,000 constant is what the OLD $360.69 chained to, which is why it is
  // no longer chained to anything: HB 96 re-based one constant and not the other.
  money(OH_BASE_AMOUNT.get(2024) + 0.0275 * (100_000 - OH_ZERO_BAND_CEILING), 2_394.315);
  money(OH_BASE_AMOUNT.get(2025), 342);
  money(OH_BASE_AMOUNT.get(2026), 332);
});

test('modelling the printed table as marginal brackets loses the whole constant', () => {
  // The error a rate table invites, quantified. 2.75% of the excess alone is what
  // an ordinary bracket walk of the same three rows produces.
  const naive = 0.0275 * (57_850 - OH_ZERO_BAND_CEILING);
  money(oh({ agi: 60_000 }).tax - naive, 342);
});

test('2026 is one rate above the band, and the constant moves with it', () => {
  const def = getStateDefinition('OH', 2026);
  assert.equal(def.rate.kind, 'baseAmountSchedule');
  assert.equal(def.rate.bands.length, 2);
  assert.equal(def.rate.bands[1].upTo, Infinity);
  money(def.rate.bands[1].base, 332);
  assert.equal(def.rate.bands[1].rate, 0.0275);
  // The whole 2026 cut for a $60,000 filer is the $10 the constant fell by; for a
  // filer above $100,000 it is that plus the loss of the 3.125% bracket.
  money(oh({ agi: 60_000, year: 2026 }).tax, 1_206.5);
  money(oh({ agi: 60_000 }).tax - oh({ agi: 60_000, year: 2026 }).tax, 10);
  money(oh({ agi: 250_000 }).tax - oh({ agi: 250_000, year: 2026 }).tax, 584.07);
});

test('the exemption chart is a staircase, and it costs a family five times what it costs a single filer', () => {
  // One dollar of Ohio AGI at $40,000 drops every exemption on the return from
  // $2,400 to $2,150.
  money(oh({ agi: 40_001 }).tax - oh({ agi: 40_000 }).tax, 6.9);
  const withThree = (agi) => oh({ agi, dependents: 3 }).tax;
  money(withThree(40_001) - withThree(40_000), 27.52);
  // Four exemptions x $250 x 2.75% is $27.50, and the last three cents is the
  // rate on the dollar itself — $27.5275 before the cent each side rounds to.
  money(4 * 250 * 0.0275 + 0.0275, 27.5275);
});

test('the exemption is read against MODIFIED AGI, so the business income deduction cannot buy it back', () => {
  // Ohio AGI is $30,000 in both, because the deduction removed the business
  // income. Modified AGI is $30,000 and $250,000, and the chart is read against
  // the second — so the second filer gets $1,900 and not $2,400.
  const wage = oh({ agi: 30_000 });
  const owner = oh({ agi: 250_000, businessIncome: 220_000 });
  const bid = owner.computedSubtractions.find((x) => x.name === 'Business income deduction');
  money(bid.amount, 220_000);
  // Ohio AGI is $30,000 on both returns.
  money(owner.conformity.amount - owner.subtractions, 30_000);
  money(wage.conformity.amount - wage.subtractions, 30_000);
  // The exemption chart is not.
  money(wage.exemptions, 2_400);
  money(owner.exemptions, 1_900);
  // Which is worth $500 of exemption, and — because the whole of this filer's
  // Ohio AGI is below the zero band — nothing at all in tax. The staircase bites
  // the owner whose business income is only partly deducted.
  const partly = oh({ agi: 300_000, businessIncome: 260_000 });
  money(partly.exemptions, 1_900);
});

test('$250,000 of business income and $250,000 of wages are not the same return', () => {
  money(oh({ agi: 250_000 }).tax, 7_022.45);
  money(oh({ agi: 250_000, businessIncome: 250_000 }).tax, 0);
  // Above the cap the excess is charged at a flat 3% and nothing else touches it.
  const big = oh({ agi: 400_000, businessIncome: 400_000 });
  money(big.tax, 4_443);
  money(big.tax, 0.03 * 148_100);
  const businessClass = big.incomeClasses.find((c) => c.rate === 0.03);
  money(businessClass.taxableAmount, 148_100);
  // Married filing separately gets half the deduction, which is the only place
  // Ohio halves anything on this return.
  const def = getStateDefinition('OH', 2025);
  assert.equal(def.businessIncome.deductionCap.marriedFilingSeparately, 125_000);
  assert.equal(def.businessIncome.deductionCap.marriedFilingJointly, 250_000);
});

test('the $20 exemption credit is a cliff at $30,000 of modified AGI', () => {
  money(oh({ agi: 29_999 }).tax, 364.6);
  money(oh({ agi: 30_000 }).tax, 384.63);
  // $20.03 on one dollar: the $20 credit and the 2.75% on the dollar itself.
  money(oh({ agi: 30_000 }).tax - oh({ agi: 29_999 }).tax, 20.03);
  const named = (r) => r.credits.find((c) => c.name === 'Exemption credit').amount;
  money(named(oh({ agi: 29_999 })), 20);
  money(named(oh({ agi: 30_000 })), 0);
});

test('the $20 exemption credit can only ever be claimed by a filer with ONE exemption', () => {
  // § 5747.022 allows $20 per exemption below $30,000 of modified AGI. But
  // § 5747.02(A)(3) charges nothing on the first $26,050 of taxable income, and
  // taxable income IS modified AGI less exemptions for anyone without business
  // income. So a credit is only worth something where
  //
  //     modified AGI - exemptions > $26,050   AND   modified AGI < $30,000
  //
  // and with $2,400 an exemption that needs fewer than two of them. A second
  // exemption pushes the first condition to $30,850 and the two can never both
  // hold again.
  const named = (r) => r.credits.find((c) => c.name === 'Exemption credit').amount;
  const kept = (r) => r.taxBeforeCredits - r.tax;
  // One exemption: a $1,550 window of income in which the credit is real.
  money(oh({ agi: 28_450 }).tax, 0);
  assert.ok(kept(oh({ agi: 29_999 })) >= 20);
  // Two exemptions, either way of getting them, and the credit is computed and
  // then wasted: the tax it would reduce is already zero.
  for (const filer of [
    { filingStatus: 'marriedFilingJointly' },
    { filingStatus: 'single', dependents: 1 },
    { filingStatus: 'headOfHousehold', dependents: 1 },
  ]) {
    const r = oh({ agi: 29_999, ...filer });
    assert.ok(named(r) >= 40, JSON.stringify(filer));
    money(r.taxBeforeCredits, 0, JSON.stringify(filer));
    money(r.tax, 0, JSON.stringify(filer));
  }
  // And one dollar of income later they are over the limit and it is gone.
  money(named(oh({ agi: 30_000, filingStatus: 'marriedFilingJointly' })), 0);
});

test('the joint filing credit is a share of what the OTHER credits left, and it is capped', () => {
  const joint = (agi) =>
    oh({ agi, filingStatus: 'marriedFilingJointly', bothSpousesHaveQualifyingIncome: true });
  const credit = (r) => r.credits.find((c) => c.name === 'Joint filing credit').amount;
  // 20% below $25,000 of modified AGI less exemptions, then 15%, 10% and 5%.
  money(credit(joint(50_000)), 132.36);
  money(credit(joint(80_000)), 85.37);
  // The cap binds at high income, where 5% of a large tax exceeds $650.
  money(credit(joint(500_000)), 650);
  // Ordering: the credits above come out first, so the percentage is taken of
  // what is left rather than of the tax. A retired couple is where that shows —
  // the $200 retirement credit and the $50 senior credit come out before the
  // percentage does.
  const retired = oh({
    agi: 60_000,
    filingStatus: 'marriedFilingJointly',
    bothSpousesHaveQualifyingIncome: true,
    retirementIncome: 20_000,
    filerAge: 70,
  });
  const above = retired.credits
    .filter((c) => c.name !== 'Joint filing credit')
    .reduce((sum, c) => sum + c.amount, 0);
  money(above, 250);
  money(credit(retired), 0.1 * (retired.taxBeforeCredits - above));
  // Applying the percentage to the gross tax instead would overstate it by the
  // rate times the credits above — $25 here, every year.
  money(0.1 * retired.taxBeforeCredits - credit(retired), 25);
  // The 20% row of § 5747.05(E) is dead law for a wage-earning couple. It needs
  // modified AGI less exemptions at or below $25,000 — and with no business
  // income that figure IS Ohio taxable nonbusiness income, which is below the
  // $26,050 zero band, so the tax the 20% would be taken of is zero. Only a
  // couple with business income taxed at the flat 3% can ever reach it.
  money(joint(29_800).tax, 0);
  money(credit(joint(29_800)), 0);
  // Business income cannot rescue it either, and the arithmetic says why: the
  // flat 3% only reaches income above the $250,000 deduction, so any couple with
  // business tax has a modified AGI over $250,000 — ten times the 20% row's
  // ceiling. The row is unreachable, not merely rare.
  const owner = oh({
    agi: 400_000,
    businessIncome: 400_000,
    filingStatus: 'marriedFilingJointly',
    bothSpousesHaveQualifyingIncome: true,
  });
  money(credit(owner), 0.05 * owner.taxBeforeCredits);
  for (const agi of [26_000, 27_000, 28_000, 29_000, 29_800]) {
    for (const businessIncome of [0, 10_000, 25_000]) {
      const r = oh({
        agi,
        businessIncome,
        filingStatus: 'marriedFilingJointly',
        bothSpousesHaveQualifyingIncome: true,
      });
      money(r.taxBeforeCredits, 0, `${agi} / ${businessIncome}`);
    }
  }
  // No spouse with qualifying income, no credit — and the default is to withhold
  // it rather than to assume both spouses work.
  money(credit(oh({ agi: 80_000, filingStatus: 'marriedFilingJointly' })), 0);
  money(credit(oh({ agi: 80_000, filingStatus: 'single' })), 0);
});

test('Ohio matches 30% of the federal earned income credit and pays almost none of it', () => {
  // A head of household with two children and a $6,000 federal credit. Ohio's
  // 30% is $1,800 and the filer keeps nothing, because $26,050 of the base is
  // untaxed and their Ohio tax was already zero.
  const r = stateIncomeTax({
    state: 'OH',
    year: 2025,
    filingStatus: 'headOfHousehold',
    dependents: 2,
    federal: {
      adjustedGrossIncome: 25_000,
      taxableIncome: 2_000,
      deduction: 23_000,
      deductionKind: 'standard',
      earnedIncomeCredit: 6_000,
    },
  });
  money(r.credits.find((c) => c.name === 'Ohio earned income credit').amount, 1_800);
  money(r.tax, 0);
  assert.equal(getStateDefinition('OH', 2025).earnedIncomeCredit.refundable, false);
});

test('the retirement and senior credits, and the limits that switch them off', () => {
  const retiree = (agi) => oh({ agi, retirementIncome: agi, filerAge: 70 });
  const named = (r, name) => r.credits.find((c) => c.name === name).amount;
  money(named(retiree(40_000), 'Retirement income credit'), 200);
  money(named(retiree(40_000), 'Senior citizen credit'), 50);
  money(retiree(40_000).tax, 409.63);
  // Both limits are on modified AGI LESS exemptions, so they bite above about
  // $101,900 of income rather than at $100,000 of it.
  money(named(retiree(101_899), 'Senior citizen credit'), 50);
  money(named(retiree(101_901), 'Senior citizen credit'), 0);
  money(named(retiree(101_901), 'Retirement income credit'), 0);
  // The retirement credit is a step function of the retirement income itself.
  money(named(oh({ agi: 40_000, retirementIncome: 1_499 }), 'Retirement income credit'), 25);
  money(named(oh({ agi: 40_000, retirementIncome: 1_501 }), 'Retirement income credit'), 50);
  money(named(oh({ agi: 40_000, retirementIncome: 499 }), 'Retirement income credit'), 0);
});

//
// The municipalities.
//

test('679 municipalities, and the packed table round-trips to the rates it came from', () => {
  assert.equal(OHIO_MUNICIPALITIES.length, 679);
  assert.equal(OHIO_MUNICIPAL_RATES.size, 679);
  assert.equal(ohioMunicipalities(2025).length, 679);
  assert.equal(ohioMunicipalities(2026).length, 679);
  // Every rate is an exact multiple of a hundred-thousandth, which is what makes
  // the integer packing lossless rather than merely compact.
  for (const [name, rate] of OHIO_MUNICIPAL_RATES) {
    assert.ok(Number.isInteger(Math.round(rate * 100_000)), name);
    assert.ok(Math.abs(rate * 100_000 - Math.round(rate * 100_000)) < 1e-9, name);
    assert.ok(rate >= 0 && rate <= 0.03, `${name} rate out of range: ${rate}`);
  }
  // Sorted by name, which is the order the error message lists them in.
  assert.deepEqual([...OHIO_MUNICIPALITIES], [...OHIO_MUNICIPALITIES].sort());
});

test('the six largest municipalities, cross-checked against two independent transcriptions', () => {
  const rate = (name) => OHIO_MUNICIPAL_RATES.get(name);
  assert.equal(rate('Columbus'), 0.025);
  assert.equal(rate('Cleveland'), 0.025);
  assert.equal(rate('Cincinnati'), 0.018);
  assert.equal(rate('Toledo'), 0.025);
  assert.equal(rate('Akron'), 0.025);
  assert.equal(rate('Dayton'), 0.025);
  // The extremes.
  assert.equal(rate('Indian Hill'), 0.0045);
  assert.equal(rate('Bedford'), 0.03);
  assert.equal(rate('Parma Heights'), 0.03);
  assert.equal(rate('Euclid'), 0.0285);
  // Beavercreek is the reason the Finder-sourced table was preferred to the
  // widely copied secondary one that gives it 1%: it levies no municipal income
  // tax at all, and never has.
  assert.equal(rate('Beavercreek'), undefined);
  assert.throws(() => ohioMunicipality('Beavercreek', 2025), /not a OH taxing jurisdiction/);
});

test('the distribution is shaped by the ceiling a levy needs a vote to cross', () => {
  const counts = new Map();
  for (const rate of OHIO_MUNICIPAL_RATES.values()) {
    counts.set(rate, (counts.get(rate) ?? 0) + 1);
  }
  assert.equal(OH_UNVOTED_RATE_CEILING, 0.01);
  assert.equal(counts.get(0.01), 266);
  assert.equal(counts.get(0.015), 122);
  assert.equal(counts.get(0.02), 122);
  assert.equal(counts.get(0.025), 41);
  assert.equal(counts.get(0), 12);
  // More sit exactly on the un-voted ceiling than on any other rate, and more
  // than twice as many as on the next one down.
  const modal = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  assert.equal(modal[0], OH_UNVOTED_RATE_CEILING);
});

test('a municipality that repealed its levy answers with a zero, not an error', () => {
  const amelia = ohioMunicipality('Amelia', 2025);
  assert.equal(amelia.rate.rate, 0);
  const r = oh({ agi: 60_000, city: 'Amelia', qualifyingWages: 60_000 });
  money(r.localTaxes[0].tax, 0);
  money(r.totalTax, r.tax);
});

test('Columbus at $60,000: the municipal tax is the larger half of the bill', () => {
  const r = oh({ agi: 60_000, city: 'Columbus', qualifyingWages: 60_000 });
  money(r.tax, 1_216.5);
  money(r.localTaxes[0].tax, 1_500);
  money(r.totalTax, 2_716.5);
  assert.equal(r.localTaxes[0].base, 'qualifyingWages');
  // The state tax overtakes 2.5% of wages only above $126,408.32 — everyone
  // below that pays their municipality more than they pay Ohio.
  const at = (agi) => oh({ agi }).tax - 0.025 * agi;
  assert.ok(at(126_000) < 0);
  assert.ok(at(127_000) > 0);
  // And a dollar more of wages costs the municipality's rate, which the marginal
  // rate has to show.
  money(r.totalMarginalRate, 0.0525);
});

test('a 401(k) deferral does not reduce the municipal base, and that is $612.50 a year', () => {
  // Two Columbus filers with the same salary, one deferring the 2026 maximum.
  // Box 1 falls; box 5 — which is what § 718.01(R) reaches — does not.
  const salary = 100_000;
  const deferral = 24_500;
  const deferring = stateIncomeTax({
    state: 'OH',
    year: 2026,
    filingStatus: 'single',
    federal: federal(salary - deferral),
    city: 'Columbus',
    qualifyingWages: salary,
  });
  const notDeferring = stateIncomeTax({
    state: 'OH',
    year: 2026,
    filingStatus: 'single',
    federal: federal(salary),
    city: 'Columbus',
    qualifyingWages: salary,
  });
  money(deferring.localTaxes[0].tax, notDeferring.localTaxes[0].tax);
  money(deferring.localTaxes[0].tax, 2_500);
  // What a model reading box 1 or federal AGI would have charged instead.
  money(0.025 * (salary - deferral), 1_887.5);
  money(deferring.localTaxes[0].tax - 0.025 * (salary - deferral), 612.5);
});

test('an Ohio retiree owes their municipality nothing and Ohio the whole pension', () => {
  const r = oh({
    agi: 60_000,
    city: 'Cleveland',
    qualifyingWages: 0,
    retirementIncome: 60_000,
    filerAge: 70,
  });
  money(r.localTaxes[0].tax, 0);
  money(r.tax, 966.5);
  // The mirror of Michigan, where the CITY excludes the pension and the state
  // taxes it through a four-tier deduction. Here the municipality excludes it
  // and Ohio taxes it in full.
  money(r.totalTax, r.tax);
});

test('a commuter pays the higher of the two rates, whichever way they commute', () => {
  const wages = 60_000;
  const both = (home, work) =>
    oh({ agi: wages, city: home, workCity: work, workCityEarnings: wages, qualifyingWages: wages });
  const outbound = both('Westerville', 'Columbus'); // 2.0% home, 2.5% work
  const inbound = both('Columbus', 'Westerville');
  const local = (r) => r.localTaxes.reduce((s, l) => s + l.tax, 0);
  money(local(outbound), 1_500);
  money(local(inbound), 1_500);
  money(local(outbound), 0.025 * wages);
  // Michigan's cap makes the direction matter by up to 70%; Ohio's ordinary
  // ordinance makes it not matter at all. Where the money goes still does.
  money(outbound.localTaxes[0].tax, 1_500); // Columbus, as the workplace
  money(outbound.localTaxes[1].tax, 0); // Westerville, fully credited
  money(inbound.localTaxes[0].tax, 1_200); // Westerville, as the workplace
  money(inbound.localTaxes[1].tax, 300); // Columbus, credited only to 2.0%
});

test('the resident credit is an assumption, it says so, and it can be overridden', () => {
  const wages = 60_000;
  const base = {
    agi: wages,
    city: 'Columbus',
    workCity: 'Westerville',
    workCityEarnings: wages,
    qualifyingWages: wages,
  };
  const assumed = oh(base);
  const credit = assumed.localTaxes[1].credits.find((c) => c.name.startsWith('Credit for income'));
  assert.match(credit.name, /assumed/);
  assert.match(credit.name, /no statutory credit/);
  assert.ok(
    assumed.notes.some((n) => n.includes('Ohio has NO statutory resident credit')),
    'the result must say the credit was assumed',
  );
  // A municipality that credits only half: the home tax rises by half the credit.
  const half = oh({ ...base, residentCreditRate: 0.5, residentCreditLimitRate: 0.025 });
  const halfCredit = half.localTaxes[1].credits.find((c) => c.name.startsWith('Credit for income'));
  assert.doesNotMatch(halfCredit.name, /assumed/);
  money(halfCredit.amount, 600);
  money(half.localTaxes[1].tax, 900);
  // And one that credits nothing at all.
  const none = oh({ ...base, residentCreditRate: 0, residentCreditLimitRate: 0 });
  money(none.localTaxes[1].tax, 1_500);
});

test('the ambiguous names are refused with all of the alternatives', () => {
  assert.throws(
    () => ohioMunicipality('Oakwood', 2025),
    /Oakwood \(Cuyahoga\), Oakwood \(Montgomery\) and Oakwood \(Paulding\)/,
  );
  assert.throws(() => ohioMunicipality('Shawnee Hills', 2025), /ambiguous/);
  // Named in full they resolve, and they do not share a rate.
  assert.equal(ohioMunicipality('Oakwood (Cuyahoga)', 2025).rate.rate, 0.025);
  assert.equal(ohioMunicipality('oakwood (paulding)', 2025).rate.rate, 0.01);
});

test('an Ohio municipality without a wage figure is refused rather than charged on AGI', () => {
  assert.throws(
    () => oh({ agi: 60_000, city: 'Columbus' }),
    /neither qualifyingWages nor earnedIncome/,
  );
  // earnedIncome stands in, and the result says which way that errs.
  const r = oh({ agi: 60_000, city: 'Columbus', earnedIncome: 60_000 });
  money(r.localTaxes[0].tax, 1_500);
  assert.ok(r.notes.some((n) => n.includes('qualifyingWages was not supplied')));
});

test('an Ohio return without a city says what the municipal tax would be', () => {
  const r = oh({ agi: 60_000, earnedIncome: 60_000 });
  const note = r.notes.find((n) => n.includes('No city was supplied'));
  assert.ok(note, 'the result must name the omission');
  assert.match(note, /679 Ohio/);
  assert.match(note, /\$1,500\.00/); // 2.5% of this filer's own wages
  assert.match(note, /0\.45% to 3\.00%/);
});

test('a city on a state with no city income tax names the two that have one', () => {
  assert.throws(
    () => stateIncomeTax({ state: 'IL', year: 2025, filingStatus: 'single', federal: federal(60_000), city: 'Chicago' }),
    /city applies to a Michigan or Ohio return/,
  );
  // And a Michigan city on an Ohio return is a name error, not a state error.
  assert.throws(
    () => oh({ agi: 60_000, city: 'Detroit', qualifyingWages: 60_000 }),
    /not a OH taxing jurisdiction/,
  );
});

test('both years are published for every municipality and identical', () => {
  for (const year of [2025, 2026]) {
    for (const def of ohioMunicipalities(year)) {
      assert.equal(def.status, 'published', `${def.name} ${year}`);
      assert.equal(def.base, 'qualifyingWages');
      // Ohio halves nothing: the commuter rate IS the resident rate.
      assert.equal(def.nonresidentEarningsRate, def.rate.rate, def.name);
      assert.equal(def.residentCreditByOrdinance, true);
    }
  }
  for (const name of OHIO_MUNICIPALITIES) {
    assert.equal(
      ohioMunicipality(name, 2025).rate.rate,
      ohioMunicipality(name, 2026).rate.rate,
      name,
    );
  }
});
