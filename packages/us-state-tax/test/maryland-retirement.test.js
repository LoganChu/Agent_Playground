// Maryland's retirement subtractions, which are the largest thing this package
// returned as zero before today. Three of them, each claimed by a PERSON rather
// than by a return, and each with its own age test: 65 (or total disability) for
// the pension exclusion, none at all for the military subtraction, 100 for the
// centenarian subtraction.
//
// The tests that matter most here are the two that show a return-level total
// failing to determine the answer, and the one that shows Maryland's exemption
// of Social Security cancelling itself out to the cent.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getStateDefinition, stateIncomeTax } from '../dist/esm/index.js';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

const federal = (agi, deduction) => ({
  adjustedGrossIncome: agi,
  taxableIncome: Math.max(0, agi - deduction),
  deduction,
  deductionKind: 'standard',
});

/** A Montgomery County return — 3.20%, the county the README's figures use. */
const md = (opts) => {
  const joint =
    opts.filingStatus === 'marriedFilingJointly' ||
    opts.filingStatus === 'qualifyingSurvivingSpouse';
  return stateIncomeTax({
    state: 'MD',
    year: opts.year ?? 2025,
    filingStatus: opts.filingStatus ?? 'single',
    county: 'Montgomery County',
    federal: federal(opts.agi, joint ? 31_500 : 15_750),
    ...opts,
  });
};

/** State tax plus county tax — the whole Maryland bill. */
const bill = (result) =>
  result.tax + result.localTaxes.reduce((sum, local) => sum + local.tax, 0);

const excluded = (result, name = 'Pension exclusion (Worksheet 13A)') => {
  const found = result.computedSubtractions.find((s) => s.name.startsWith(name));
  return found === undefined ? 0 : found.amount;
};

// ---------------------------------------------------------------------------
// The finding: the return's totals do not determine the tax.
// ---------------------------------------------------------------------------

// A couple both aged 70 with $80,000 of employer-plan pension and $40,000 of
// Social Security between them. Federal AGI is the same in all three cases:
// 85% of the benefits is the most the federal government taxes, so
// 0.85 x 40,000 + 80,000 = $114,000, and the taxable part is $34,000.
const COUPLE = { filingStatus: 'marriedFilingJointly', agi: 114_000, taxableSocialSecurity: 34_000, filerAge: 70, spouseAge: 70 };

test('one couple, one pair of totals, three taxes $2,541.65 apart', () => {
  // Split evenly: each spouse charges $20,000 of benefits against their own
  // $41,200 cap and excludes $21,200 of their $40,000 pension.
  const even = md({
    ...COUPLE,
    retirement: {
      filer: { employerPlanPension: 40_000, socialSecurityBenefits: 20_000 },
      spouse: { employerPlanPension: 40_000, socialSecurityBenefits: 20_000 },
    },
  });
  money(excluded(even), 42_400, 'evenly split');
  money(bill(even), 720.0, 'evenly split');

  // The pension on one spouse and the benefits on the other. The pension spouse
  // has no benefits to charge, so the cap binds at $41,200; the benefits spouse
  // has no pension to exclude. The larger exclusion for one, and nothing for the
  // other, is WORSE than the even split, because the cap wastes the part of the
  // benefits spouse's allowance that has no pension behind it.
  const separated = md({
    ...COUPLE,
    retirement: {
      filer: { employerPlanPension: 80_000, socialSecurityBenefits: 0 },
      spouse: { employerPlanPension: 0, socialSecurityBenefits: 40_000 },
    },
  });
  money(excluded(separated), 41_200, 'pension and benefits separated');
  money(bill(separated), 758.4, 'pension and benefits separated');

  // Both on one spouse: $40,000 of benefits eats all but $1,200 of that
  // spouse's cap, and the other spouse's whole $41,200 allowance is unused
  // because they have no pension. This is the case the fallback assumes.
  const concentrated = md({
    ...COUPLE,
    retirement: { filer: { employerPlanPension: 80_000, socialSecurityBenefits: 40_000 } },
  });
  money(excluded(concentrated), 1_200, 'both on one spouse');
  money(bill(concentrated), 3_261.65, 'both on one spouse');

  // The whole point, in one number.
  money(bill(concentrated) - bill(even), 2_541.65, 'the spread');
  money(excluded(even) - excluded(concentrated), 41_200, 'the spread in exclusion');
});

test('the fallback puts everything on one spouse, and says so', () => {
  const fallback = md({ ...COUPLE, retirementIncome: 80_000 });
  // $41,200 less the TAXABLE $34,000 rather than the $40,000 received — the two
  // halves of the assumption pull in opposite directions, which is why the name
  // states both rather than either.
  money(excluded(fallback), 7_200, 'fallback exclusion');
  const name = fallback.computedSubtractions.find((s) =>
    s.name.startsWith('Pension exclusion'),
  ).name;
  assert.match(name, /assumed: all of it received by one spouse/);
  assert.match(name, /taxable part of the benefits taken as the total received/);
  assert.match(name, /pass `retirement`/);
});

test('supplying `retirement` with nothing in it is not the fallback', () => {
  // An empty split is a statement that neither spouse had retirement income,
  // not an absence of information, so no assumption is reported.
  const empty = md({ ...COUPLE, retirementIncome: 80_000, retirement: { filer: {} } });
  money(excluded(empty), 0, 'empty split');
  assert.equal(
    empty.computedSubtractions.some((s) => s.name.includes('assumed')),
    false,
  );
});

// ---------------------------------------------------------------------------
// The finding: Maryland taxes Social Security and exempts pensions.
// ---------------------------------------------------------------------------

test('the Social Security exemption and the exclusion offset cancel to the cent', () => {
  // $30,000 of benefits and $60,000 of pension. Federal AGI carries 85% of the
  // benefits: 0.85 x 30,000 + 60,000 = $85,500, of which $25,500 is taxable.
  const withBenefits = md({
    agi: 85_500,
    filerAge: 70,
    taxableSocialSecurity: 25_500,
    retirement: { filer: { employerPlanPension: 60_000, socialSecurityBenefits: 30_000 } },
  });
  // The same $90,000 of gross retirement income, all of it pension.
  const allPension = md({
    agi: 90_000,
    filerAge: 70,
    retirement: { filer: { employerPlanPension: 90_000 } },
  });

  money(excluded(withBenefits), 11_200, '41,200 less the 30,000 received');
  money(excluded(allPension), 41_200, 'the cap');
  // Two returns, one with $30,000 of supposedly untaxed benefits in it, and the
  // same Maryland tax to the cent. The exemption is worth nothing.
  money(withBenefits.stateAdjustedGrossIncome, 48_800, 'MD AGI with benefits');
  money(allPension.stateAdjustedGrossIncome, 48_800, 'MD AGI without');
  money(bill(withBenefits), bill(allPension), 'identical bills');
  money(bill(withBenefits), 2_226.88, 'the bill itself');
});

test('a dollar of benefit adds a full dollar to the Maryland base', () => {
  // The mechanism behind the cancellation, isolated. The pension is well above
  // the cap, so the only thing moving is the benefit.
  const at = (benefits) =>
    md({
      agi: 0.85 * benefits + 80_000,
      filerAge: 70,
      taxableSocialSecurity: 0.85 * benefits,
      retirement: { filer: { employerPlanPension: 80_000, socialSecurityBenefits: benefits } },
    }).stateAdjustedGrossIncome;
  // 0.85 arrives through federal AGI and is taken straight back out; 1.00
  // leaves through the lost exclusion. Net: the whole dollar.
  money(at(10_000) - at(0), 10_000, 'the first $10,000 of benefits');
  money(at(20_000) - at(10_000), 10_000, 'the second');
  // Above the cap the offset is exhausted and the benefit becomes genuinely
  // exempt, which is the one band where Maryland's summary is true.
  money(at(50_000) - at(41_200), 0, 'above the cap');
});

// ---------------------------------------------------------------------------
// The finding: an IRA is not an employee retirement system.
// ---------------------------------------------------------------------------

test('the rollover that every adviser recommends costs $3,428.03 a year', () => {
  const inPlan = (agi) =>
    md({ agi, filerAge: 70, retirement: { filer: { employerPlanPension: agi } } });
  // Rolled into an IRA the same distribution qualifies for nothing, so there is
  // no field to put it in: § 10-209(a) excludes § 408, § 408A, a rollover IRA,
  // a § 408(k) SEP and a § 457(f) plan from "employee retirement system".
  const rolled = (agi) => md({ agi, filerAge: 70, retirement: { filer: {} } });

  money(bill(inPlan(50_000)), 40.0, '$50,000 in a 401(k)');
  money(bill(rolled(50_000)), 2_322.28, '$50,000 in an IRA');
  money(bill(rolled(50_000)) - bill(inPlan(50_000)), 2_282.28, 'the cost at $50,000');

  money(bill(inPlan(150_000)), 8_196.8, '$150,000 in a 401(k)');
  money(bill(rolled(150_000)), 11_624.83, '$150,000 in an IRA');
  money(bill(rolled(150_000)) - bill(inPlan(150_000)), 3_428.03, 'the cost at $150,000');
});

// ---------------------------------------------------------------------------
// The eligibility tests, which three different provisions answer differently.
// ---------------------------------------------------------------------------

test('the pension exclusion arrives on the sixty-fifth birthday', () => {
  const at = (age) =>
    md({ agi: 50_000, filerAge: age, retirement: { filer: { employerPlanPension: 50_000 } } });
  money(excluded(at(64)), 0, 'at 64');
  money(bill(at(64)), 3_401.78, 'at 64');
  money(excluded(at(65)), 41_200, 'at 65');
  money(bill(at(65)), 40.0, 'at 65');
  // $3,361.78 on one birthday, which is a larger step than any rate change in
  // the state's schedule.
  money(bill(at(64)) - bill(at(65)), 3_361.78, 'the birthday');
});

test('total disability qualifies at any age — and so does a spouse\'s', () => {
  const disabled = md({
    agi: 50_000,
    filerAge: 45,
    retirement: { filer: { employerPlanPension: 50_000, totallyDisabled: true } },
  });
  money(excluded(disabled), 41_200, 'disabled at 45');

  // § 10-209(b) qualifies a person whose SPOUSE is totally disabled, so the
  // pension of the healthy 45-year-old spouse is excluded too. The disability
  // is a property of the return, not of the person claiming.
  const spouseDisabled = md({
    filingStatus: 'marriedFilingJointly',
    agi: 50_000,
    filerAge: 45,
    spouseAge: 45,
    retirement: { filer: { employerPlanPension: 50_000 }, spouse: { totallyDisabled: true } },
  });
  money(excluded(spouseDisabled), 41_200, 'spouse disabled at 45');

  // And neither of them qualifies with no disability and no age.
  const neither = md({
    agi: 50_000,
    filerAge: 45,
    retirement: { filer: { employerPlanPension: 50_000 } },
  });
  money(excluded(neither), 0, 'neither');
});

test('a single filer gets one cap, not two', () => {
  // The spouse entry is ignored on a single return, which is the whole reason
  // `retirementPeople` counts filers rather than reading both entries always.
  const single = md({
    agi: 120_000,
    filerAge: 70,
    retirement: {
      filer: { employerPlanPension: 60_000 },
      spouse: { employerPlanPension: 60_000 },
    },
  });
  money(excluded(single), 41_200, 'one cap');
});

// ---------------------------------------------------------------------------
// The military subtraction: no age gate at all, and two caps.
// ---------------------------------------------------------------------------

test('a military retiree has a subtraction twenty-five years early', () => {
  const at = (age) =>
    md({ agi: 40_000, filerAge: age, retirement: { filer: { militaryRetirement: 40_000 } } });
  const subtracted = (r) => excluded(r, 'Military retirement income subtraction');
  money(subtracted(at(42)), 12_500, 'at 42 — no other Maryland retiree has anything');
  money(bill(at(42)), 1_613.03, 'at 42');
  money(subtracted(at(54)), 12_500, 'at 54');
  money(subtracted(at(55)), 20_000, 'at 55 the cap rises');
  money(bill(at(55)), 1_016.78, 'at 55');
  // $596.25 on one birthday, nine years before the pension exclusion's.
  money(bill(at(54)) - bill(at(55)), 596.25, 'the fifty-fifth birthday');
});

test('the military and pension routes swap places at $21,200 of benefits', () => {
  // min(pay, 41,200 - benefits) beats a flat $20,000 exactly while benefits are
  // below $21,200, so a 65-or-over military retiree's better field flips there.
  // This package does not make the election; the state's notes say which wins.
  const both = (benefits, field) =>
    md({
      agi: 40_000 + 0.85 * benefits,
      filerAge: 70,
      taxableSocialSecurity: 0.85 * benefits,
      retirement: { filer: { [field]: 40_000, socialSecurityBenefits: benefits } },
    });
  // Below the break-even the pension exclusion is worth more.
  money(bill(both(15_000, 'militaryRetirement')), 398.4, 'military route at $15,000');
  money(bill(both(15_000, 'employerPlanPension')), 200.0, 'pension route at $15,000');
  // Above it the flat $20,000 is.
  money(bill(both(25_000, 'militaryRetirement')), 398.4, 'military route at $25,000');
  money(bill(both(25_000, 'employerPlanPension')), 520.0, 'pension route at $25,000');
});

// ---------------------------------------------------------------------------
// The centenarian subtraction.
// ---------------------------------------------------------------------------

test('one birthday at 100 takes $9,049.60 down to $1,064.48', () => {
  const at = (age) => md({ agi: 120_000, filerAge: age });
  money(at(99).totalTax, 9_049.6, 'at 99');
  money(at(100).totalTax, 1_064.48, 'at 100');
  // This is the case that caught `totalTax` disagreeing with the sum of the
  // figures the result reports: the state tax at 100 is $614.875 exactly, a
  // half cent, and rounding the sum of the unrounded parts gave $1,064.47 while
  // the two reported lines add to $1,064.48. The parts now add up.
  money(at(100).totalTax, bill(at(100)), 'the parts add up');
  money(at(99).totalTax - at(100).totalTax, 7_985.12, 'the hundredth birthday');
  // $100,000 of income, with no test of where the income came from — the only
  // Maryland subtraction here that a wrong choice of retirement account cannot
  // destroy.
  money(
    at(100).computedSubtractions.find((s) => s.name === 'Centenarian subtraction').amount,
    100_000,
  );
});

// ---------------------------------------------------------------------------
// The parameter that goes down.
// ---------------------------------------------------------------------------

test('the maximum exclusion falls in 2026, and the definition says so', () => {
  assert.equal(getStateDefinition('MD', 2025).pensionExclusion.maximum, 41_200);
  assert.equal(getStateDefinition('MD', 2026).pensionExclusion.maximum, 40_600);
  const y = (year) =>
    md({ year, agi: 150_000, filerAge: 70, retirement: { filer: { employerPlanPension: 150_000 } } });
  money(excluded(y(2025)), 41_200, '2025');
  money(excluded(y(2026)), 40_600, '2026');
  // $600 of lost exclusion, at a marginal 5.25% state plus 3.20% county.
  money(bill(y(2026)) - bill(y(2025)), 49.2, 'the cost of the decrease');
  // Every other year-over-year parameter in this package rises or holds. This
  // one is the exception, and a model that indexes it upward is wrong in the
  // expensive direction.
  assert.ok(
    getStateDefinition('MD', 2026).pensionExclusion.maximum <
      getStateDefinition('MD', 2025).pensionExclusion.maximum,
  );
});

// ---------------------------------------------------------------------------
// The provisions this package still does not model, asserted as absences so a
// future day cannot quietly believe they are handled.
// ---------------------------------------------------------------------------

test('the unmodelled retirement provisions are named in the notes', () => {
  const notes = getStateDefinition('MD', 2025).notes.join(' ');
  assert.match(notes, /Form 502SU code letter v/);
  assert.match(notes, /HB 792 of the 2025 session/);
  assert.match(notes, /Worksheet 13E/);
  assert.match(notes, /two-income subtraction/);
});

test('all three per-person rules can fire on one return', () => {
  // A couple both aged 100, one of them a military retiree: three subtractions,
  // three different age tests, one return. Nothing about the return's structure
  // prevents it and the engine should not either.
  const r = md({
    filingStatus: 'marriedFilingJointly',
    agi: 300_000,
    filerAge: 100,
    spouseAge: 100,
    retirement: {
      filer: { employerPlanPension: 60_000, militaryRetirement: 30_000 },
      spouse: { employerPlanPension: 60_000 },
    },
  });
  const names = r.computedSubtractions.map((s) => s.name);
  assert.deepEqual(names, [
    'Pension exclusion (Worksheet 13A)',
    'Military retirement income subtraction',
    'Centenarian subtraction',
  ]);
  // Two caps, both binding: $41,200 each against $60,000 of pension each.
  money(excluded(r), 82_400, 'two caps');
  money(excluded(r, 'Military'), 20_000, 'the age-55 cap');
  money(excluded(r, 'Centenarian'), 200_000, 'two centenarians');
});
