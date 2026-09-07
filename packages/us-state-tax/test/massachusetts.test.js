// Massachusetts — the first state in this package whose tax base is split by the
// KIND of income rather than by how much of it there is.
//
// Every assertion here is hand-computed from the statute and shown as arithmetic,
// because the whole claim of this file is that the published "5%" is not the
// answer to any question a Massachusetts filer actually asks.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  getStateDefinition,
  massachusettsSurtaxThreshold,
  stateIncomeTax,
} from '../dist/esm/index.js';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

/**
 * A Massachusetts return. `federal` is carried only because the input type wants
 * it — Massachusetts reads nothing from it except the federal earned income
 * credit, which is the point of the state having no federal starting line.
 */
const ma = (opts = {}) => {
  const income = opts.massachusettsFivePercentIncome ?? 0;
  return stateIncomeTax({
    state: 'MA',
    year: opts.year ?? 2025,
    filingStatus: opts.filingStatus ?? 'single',
    federal: {
      adjustedGrossIncome: income,
      taxableIncome: income,
      deduction: 0,
      deductionKind: 'standard',
      earnedIncomeCredit: opts.earnedIncomeCredit,
    },
    ...opts,
  });
};

const classOf = (result, fragment) =>
  result.incomeClasses.find((c) => c.name.toLowerCase().includes(fragment));
const creditOf = (result, fragment) =>
  result.credits.find((c) => c.name.toLowerCase().includes(fragment))?.amount ?? 0;

test('Massachusetts refuses federal AGI, because its base is a different figure', () => {
  assert.throws(
    () =>
      stateIncomeTax({
        state: 'MA',
        year: 2025,
        filingStatus: 'single',
        federal: {
          adjustedGrossIncome: 100_000,
          taxableIncome: 84_250,
          deduction: 15_750,
          deductionKind: 'standard',
        },
      }),
    /massachusettsFivePercentIncome/,
  );
  // And the message says why, naming the three federal above-the-line deductions
  // Massachusetts disallows — the ones a caller has to add back.
  assert.throws(
    () => stateIncomeTax({ state: 'MA', year: 2026, filingStatus: 'single', federal: { adjustedGrossIncome: 0, taxableIncome: 0, deduction: 0, deductionKind: 'standard' } }),
    /traditional IRA deduction/,
  );
});

test('the plain 5% return, and the deduction with no federal analogue', () => {
  //   5.0% income                                     100,000.00
  //   personal exemption, single                       -4,400.00
  //   taxable                                          95,600.00
  //   at 5%                                             4,780.00
  const plain = ma({ massachusettsFivePercentIncome: 100_000 });
  money(plain.taxableIncome, 95_600);
  money(plain.tax, 4_780);
  money(plain.marginalRate, 0.05);

  // The Social Security/Medicare deduction is up to $2,000 per filer and exists
  // nowhere on a federal return, so no amount of federal data produces it.
  const withFica = ma({ massachusettsFivePercentIncome: 100_000, socialSecurityAndMedicarePaid: 2_000 });
  money(withFica.deduction, 2_000);
  money(withFica.tax, 4_680, 'worth exactly $100 at the 5% rate');

  // A joint return gets two caps, but only up to what was actually paid.
  const joint = ma({
    massachusettsFivePercentIncome: 200_000,
    filingStatus: 'marriedFilingJointly',
    socialSecurityAndMedicarePaid: 9_000,
  });
  money(joint.deduction, 4_000, 'capped at two filers');
});

test('the 5% state has three rates, and the second is 70% higher', () => {
  // The same $100,000, split two ways. This is the whole reason the package
  // needed an income-class rule: no amount of bracket data can express it,
  // because nothing about the answer depends on the amount.
  const salary = ma({ massachusettsFivePercentIncome: 100_000 });
  const trader = ma({ massachusettsFivePercentIncome: 80_000, shortTermCapitalGains: 20_000 });

  //   5.0% income      80,000 - 4,400 = 75,600  at 5%     3,780.00
  //   short-term gain                   20,000  at 8.5%   1,700.00
  money(trader.taxableIncome, 75_600);
  money(classOf(trader, 'short-term').taxableAmount, 20_000);
  money(classOf(trader, 'short-term').tax, 1_700);
  money(trader.tax, 5_480);
  money(trader.tax - salary.tax, 700, '$20,000 held eleven months costs $700 more');
  assert.equal(classOf(trader, 'short-term').rate, 0.085);
});

test('collectibles are taxed at 12% on half the gain, and this is where PolicyEngine-US differs', () => {
  const dealer = ma({ massachusettsFivePercentIncome: 80_000, collectiblesGains: 20_000 });
  const band = classOf(dealer, 'collectibles');

  //   gain                              20,000.00
  //   50% deduction, c.62 s.2(c)(3)    -10,000.00
  //   taxable                           10,000.00
  //   at 12%, c.62 s.4(a)                1,200.00   <- effective 6%
  assert.equal(band.rate, 0.12);
  money(band.income, 20_000);
  money(band.taxableAmount, 10_000);
  money(band.tax, 1_200);
  money(band.tax / band.income, 0.06, 'the effective rate every summary quotes');

  // PolicyEngine-US models the 50% deduction correctly and then applies the Part
  // A *short-term* rate of 8.5% to what is left, for an effective 4.25%. The
  // statute has one rate for short-term gains and another for collectibles —
  // "other Part A taxable income consisting of capital gains shall be taxed at
  // the rate of 12 per cent" — and mass.gov's rate table says 12% as well.
  // Recorded rather than resolved silently: on this filer the gap is $350.
  money(20_000 * 0.5 * 0.085, 850, 'what an 8.5% collectibles rate would give');
  money(band.tax - 850, 350);
});

test('No Tax Status is a generated table, not a stored one', () => {
  const def = getStateDefinition('MA', 2025);
  const nts = def.zeroTaxThreshold;
  const exemption = def.exemption.perFiler;

  // The published thresholds are $8,000 / $16,400 / $14,400 plus $1,000 per
  // dependent. Two of the three are $7,600 plus that status's own personal
  // exemption, and the $1,000 is the dependent exemption itself — so this
  // package stores the $7,600 and regenerates the table.
  money(nts.threshold.marriedFilingJointly + exemption.marriedFilingJointly, 16_400);
  money(nts.threshold.headOfHousehold + exemption.headOfHousehold, 14_400);
  money(nts.perDependent, def.exemption.perDependent);
  // The single row is the exception and is stored whole: $8,000 is not
  // $7,600 + $4,400, and a single filer adds nothing for dependents either.
  money(nts.threshold.single, 8_000);
  assert.equal(nts.addsPersonalExemption.single, false);

  // Driven through the engine rather than read off the rule.
  money(ma({ massachusettsFivePercentIncome: 8_000 }).tax, 0);
  const jointFamily = { filingStatus: 'marriedFilingJointly', dependentAges: [3, 4] };
  money(ma({ ...jointFamily, massachusettsFivePercentIncome: 18_400 }).taxBeforeCredits, 0);
  money(ma({ ...jointFamily, massachusettsFivePercentIncome: 18_401 }).taxBeforeCredits, 380.05);

  // Married filing separately cannot claim it at all, and gets no Limited
  // Income Credit either.
  const separate = ma({ massachusettsFivePercentIncome: 8_000, filingStatus: 'marriedFilingSeparately' });
  money(separate.tax, 180, '(8,000 - 4,400) x 5%');
  assert.equal(separate.credits.some((c) => c.name === 'Limited Income Credit'), false);
});

test('the Limited Income Credit charges 10% — twice the statutory rate', () => {
  // New Jersey's filing threshold is a wall: $252 of tax on one dollar of income.
  // Massachusetts buys the absence of that wall by charging double the statutory
  // rate across the band above it, which is the most expensive marginal income
  // an ordinary Massachusetts wage earner ever earns.
  money(ma({ massachusettsFivePercentIncome: 8_000 }).tax, 0);
  money(ma({ massachusettsFivePercentIncome: 8_001 }).tax, 0.1, 'ten cents, not $180');
  money(ma({ massachusettsFivePercentIncome: 8_000 }).marginalRate, 0.1);
  money(ma({ massachusettsFivePercentIncome: 10_000 }).marginalRate, 0.1);

  //   at $10,000:  tax 5% x (10,000 - 4,400)  =  280.00
  //                limit 10% x (10,000 - 8,000) = 200.00
  //                credit                          80.00
  const mid = ma({ massachusettsFivePercentIncome: 10_000 });
  money(creditOf(mid, 'limited income'), 80);
  money(mid.tax, 200);

  // The credit runs out where the two lines cross — 0.05(A - 4,400) = 0.10(A - 8,000)
  // gives A = 11,600 — and NOT at the 175% eligibility ceiling of $14,000 that
  // the instructions print. The marginal rate halves at exactly that dollar.
  money(ma({ massachusettsFivePercentIncome: 11_600 }).tax, 360);
  money(creditOf(ma({ massachusettsFivePercentIncome: 11_600 }), 'limited income'), 0);
  money(ma({ massachusettsFivePercentIncome: 11_600 }).marginalRate, 0.05);
  money(ma({ massachusettsFivePercentIncome: 11_599 }).marginalRate, 0.1);
  money(ma({ massachusettsFivePercentIncome: 14_000 }).tax, 480, 'the printed ceiling is $2,400 late');

  // And the ceiling never binds, for anyone. The credit ends where the two lines
  // cross — 0.05(A - E) = 0.10(A - T) gives A = 2T - E — and the 1.75T ceiling
  // arrives first only when E < 0.25T. Massachusetts's exemptions are never that
  // small: $4,400 against a quarter of $8,000, $8,800 against a quarter of
  // $16,400. So the 175% figure printed in the instructions is a test that no
  // Massachusetts filer ever fails first, at any filing status and any number of
  // dependents — the credit has always run out already.
  const def = getStateDefinition('MA', 2025);
  for (const filingStatus of ['single', 'marriedFilingJointly', 'headOfHousehold']) {
    for (let dependents = 0; dependents <= 5; dependents += 1) {
      const adds = def.zeroTaxThreshold.addsPersonalExemption[filingStatus];
      const T =
        def.zeroTaxThreshold.threshold[filingStatus] +
        (adds ? def.exemption.perFiler[filingStatus] : 0) +
        1_000 * dependents;
      const E = def.exemption.perFiler[filingStatus] + 1_000 * dependents;
      const crossover = 2 * T - E;
      assert.ok(
        crossover < 1.75 * T,
        `${filingStatus} with ${dependents}: the ceiling at ${1.75 * T} would bind before ${crossover}`,
      );
      const ages = Array.from({ length: dependents }, () => 8);
      const at = (income) =>
        ma({ filingStatus, dependentAges: ages, massachusettsFivePercentIncome: income });
      money(at(crossover - 1).marginalRate, 0.1, `${filingStatus} ${dependents} below crossover`);
      money(at(crossover).marginalRate, 0.05, `${filingStatus} ${dependents} at crossover`);
    }
  }
});

test('the 4% surtax is per return, and filing separately no longer escapes it', () => {
  //   5.0% income                                   1,200,000.00
  //   personal exemption                               -4,400.00
  //   taxable                                       1,195,600.00
  //   at 5%                                            59,780.00
  //   surtax 4% x (1,195,600 - 1,083,150)               4,498.00
  const rich = ma({ massachusettsFivePercentIncome: 1_200_000 });
  money(rich.surtaxes[0].amount, 4_498);
  money(rich.tax, 64_278);
  money(rich.marginalRate, 0.09, 'five plus four');

  // The threshold is not doubled for a joint return. Two spouses with $700,000
  // each pay it; the same two people filing separately would not — and since tax
  // year 2024 M.G.L. c. 62 s.4(d) requires a couple who filed a joint federal
  // return to file jointly here, which closes that route.
  const together = ma({ massachusettsFivePercentIncome: 1_400_000, filingStatus: 'marriedFilingJointly' });
  const apart = ma({ massachusettsFivePercentIncome: 700_000, filingStatus: 'marriedFilingSeparately' });
  money(together.surtaxes[0].amount, 12_322);
  assert.equal(apart.surtaxes.length, 0);
  money(together.tax - 2 * apart.tax, 12_322, 'the whole cost of the joint filing requirement');

  // And the surtax base is TOTAL taxable income across every rate class, so a
  // one-time capital gain reaches it for a filer whose salary does not.
  const gain = ma({ massachusettsFivePercentIncome: 200_000, shortTermCapitalGains: 1_000_000 });
  money(gain.surtaxes[0].amount, 4_498, 'the same surtax as the $1.2m salary');
  money(gain.tax, 99_278);
  money(ma({ massachusettsFivePercentIncome: 200_000 }).surtaxes.length, 0);
});

test('the surtax threshold moves with the federal cost of living adjustment', () => {
  money(massachusettsSurtaxThreshold(2025), 1_083_150);
  money(massachusettsSurtaxThreshold(2026), 1_107_750);

  // Article XLIV adjusts the threshold "by the same method used for federal
  // income tax brackets". The federal 32% single bracket ran $250,525 (2025) to
  // $256,225 (2026); applying that factor to the certified 2025 threshold lands
  // within one $50 rounding step of the certified 2026 one.
  //
  // Asserted as a bound rather than as an identity, deliberately. Rounding to the
  // nearest $50 gives $1,107,800 and rounding down gives $1,107,750 — but
  // rounding down does not reproduce 2025 from 2024, so the Department of
  // Revenue's exact method is not recoverable from the four figures it has
  // published. A bound still catches the error that actually threatens a
  // seven-digit number, which is a mistyped digit.
  const federalFactor = 256_225 / 250_525;
  const derived = 1_083_150 * federalFactor;
  assert.ok(
    Math.abs(derived - 1_107_750) <= 50,
    `derived ${derived} is more than one $50 step from the certified 1,107,750`,
  );
  // A mistyped digit is not within one step of anything.
  assert.ok(Math.abs(derived - 1_007_750) > 50);
  assert.ok(Math.abs(derived - 1_170_750) > 50);
});

test('exemptions left over by the 5% schedule cascade into the other rate classes', () => {
  // A filer whose only income is a short-term gain still has a personal
  // exemption, and an engine that applied exemptions only to the main schedule
  // would tax their first $4,400 at 8.5%.
  const trader = ma({ massachusettsFivePercentIncome: 0, shortTermCapitalGains: 20_000 });
  money(trader.taxableIncome, 0);
  money(classOf(trader, 'short-term').taxableAmount, 15_600, '20,000 - the unused 4,400');
  money(trader.tax, 1_326);
  money(20_000 * 0.085 - trader.tax, 374, 'what ignoring the cascade would cost');

  // And the No Tax Status test sees the gain too: $5,000 of wages beside a
  // $60,000 short-term gain is not No Tax Status, though the 5% schedule alone
  // would say it was.
  const mixed = ma({ massachusettsFivePercentIncome: 5_000, shortTermCapitalGains: 60_000 });
  money(mixed.taxableIncome, 600);
  money(mixed.tax, 5_130, '600 x 5% + 60,000 x 8.5%');
  // The effective rate is measured over every class, not over the 5% income.
  money(mixed.effectiveRate, 5_130 / 65_000);
});

test('the Child and Family Tax Credit has no phase-out, no cap, and a band at both ends of life', () => {
  // $440 per dependent, and it is worth exactly the same at $400,000 as at
  // $40,000 — the only credit in this package of which that is true.
  const rich = ma({
    massachusettsFivePercentIncome: 400_000,
    filingStatus: 'marriedFilingJointly',
    dependentAges: [5, 70],
  });
  money(creditOf(rich, 'child and family'), 880);
  const poor = ma({
    massachusettsFivePercentIncome: 40_000,
    filingStatus: 'marriedFilingJointly',
    dependentAges: [5, 70],
  });
  money(creditOf(poor, 'child and family'), 880);
  assert.equal(getStateDefinition('MA', 2025).childCredit.phaseOut, undefined);

  // A dependent aged 65 or over qualifies exactly as a child under 13 does, and
  // a 30-year-old dependent qualifies as neither — the credit is banded at both
  // ends of life, which no other credit here is.
  money(creditOf(ma({ massachusettsFivePercentIncome: 60_000, dependentAges: [12] }), 'child and family'), 440);
  money(creditOf(ma({ massachusettsFivePercentIncome: 60_000, dependentAges: [13] }), 'child and family'), 0);
  money(creditOf(ma({ massachusettsFivePercentIncome: 60_000, dependentAges: [64] }), 'child and family'), 0);
  money(creditOf(ma({ massachusettsFivePercentIncome: 60_000, dependentAges: [65] }), 'child and family'), 440);

  // Uncapped since 2024, where the credits it replaced stopped at two.
  money(
    creditOf(
      ma({ massachusettsFivePercentIncome: 60_000, filingStatus: 'marriedFilingJointly', dependentAges: [1, 3, 5, 7, 9] }),
      'child and family',
    ),
    2_200,
  );
});

test('the earned income credit is 40% of the federal one, and refundable', () => {
  const parent = ma({
    massachusettsFivePercentIncome: 20_000,
    filingStatus: 'headOfHousehold',
    dependentAges: [4],
    earnedIncomeCredit: 4_000,
  });
  money(creditOf(parent, 'earned income'), 1_600);
  assert.equal(parent.credits.find((c) => c.name.includes('earned income')).refundable, true);

  //   5.0% income                                      20,000.00
  //   exemptions, 6,800 + 1,000                        -7,800.00
  //   taxable                                          12,200.00
  //   at 5%                                               610.00
  //   No Tax Status threshold 7,600 + 6,800 + 1,000    15,400.00  <- above it
  //   Limited Income Credit  610 - 10% x 4,600           -150.00
  //   earned income credit, 40% x 4,000                -1,600.00
  //   Child and Family Tax Credit                        -440.00
  money(creditOf(parent, 'limited income'), 150);
  money(parent.tax, -1_580, 'a refund, where a rate table returns 610');
});

test('the rental deduction is the flat $200 every Massachusetts tenant gets', () => {
  const tenant = ma({ massachusettsFivePercentIncome: 50_000, rentPaid: 24_000 });
  money(tenant.deduction, 4_000, 'half of 24,000, capped');
  money(tenant.tax, 2_080);
  money(ma({ massachusettsFivePercentIncome: 50_000 }).tax - tenant.tax, 200);

  // The cap binds at $8,000 of annual rent — $667 a month — which is below the
  // rent of anywhere in Massachusetts, so in practice this is a flat deduction
  // rather than a function of the rent.
  money(ma({ massachusettsFivePercentIncome: 50_000, rentPaid: 8_000 }).deduction, 4_000);
  money(ma({ massachusettsFivePercentIncome: 50_000, rentPaid: 7_000 }).deduction, 3_500);
  money(
    ma({ massachusettsFivePercentIncome: 50_000, rentPaid: 24_000, filingStatus: 'marriedFilingSeparately' }).deduction,
    2_000,
  );
});

test('a qualifying surviving spouse is a status Massachusetts does not have', () => {
  // Form 1 offers single, joint, separate and head of household — no more. This
  // package's usual default sends a surviving spouse to the joint figures, which
  // here would invent an $8,800 exemption and a $16,400 No Tax Status threshold
  // that the form does not offer.
  const qss = ma({ massachusettsFivePercentIncome: 60_000, filingStatus: 'qualifyingSurvivingSpouse' });
  money(qss.exemptions, 4_400, 'the single amount');
  money(qss.tax, 2_780);
  const def = getStateDefinition('MA', 2026);
  money(def.exemption.perFiler.qualifyingSurvivingSpouse, def.exemption.perFiler.single);
  money(def.zeroTaxThreshold.threshold.qualifyingSurvivingSpouse, 8_000);
  assert.equal(def.zeroTaxThreshold.addsPersonalExemption.qualifyingSurvivingSpouse, false);
  assert.ok(def.notes.some((n) => n.includes('no qualifying surviving spouse filing status')));
});

test('the age and blindness exemptions are per filer, and need the ages', () => {
  const base = ma({ massachusettsFivePercentIncome: 60_000, filingStatus: 'marriedFilingJointly' });
  money(base.exemptions, 8_800);
  money(ma({ massachusettsFivePercentIncome: 60_000, filingStatus: 'marriedFilingJointly', filerAge: 65, spouseAge: 66 }).exemptions, 10_200);
  money(ma({ massachusettsFivePercentIncome: 60_000, filingStatus: 'marriedFilingJointly', filerAge: 65 }).exemptions, 9_500);
  money(ma({ massachusettsFivePercentIncome: 60_000, filingStatus: 'marriedFilingJointly', blindOrDisabled: 2 }).exemptions, 13_200);
  // A blind dependent gets nothing extra: the exemption is claimed by a filer.
  money(ma({ massachusettsFivePercentIncome: 60_000, filingStatus: 'marriedFilingJointly', blindOrDisabled: 5 }).exemptions, 13_200);
});

test('2026 is published rather than provisional, and only one figure moved', () => {
  const a = getStateDefinition('MA', 2025);
  const b = getStateDefinition('MA', 2026);
  assert.equal(a.status, 'published');
  assert.equal(b.status, 'published');

  // Everything in the Massachusetts computation but the surtax threshold is a
  // fixed dollar figure in statute, so the 2026 column is the 2025 one as a
  // matter of law rather than as a carry-forward. That is what lets this state
  // be `published` for a year most of this package is provisional about.
  assert.deepEqual(a.exemption, b.exemption);
  assert.deepEqual(a.zeroTaxThreshold, b.zeroTaxThreshold);
  assert.deepEqual(a.rate, b.rate);
  assert.deepEqual(a.separatelyRatedIncome, b.separatelyRatedIncome);
  assert.deepEqual(a.childCredit, b.childCredit);
  assert.deepEqual(a.earnedIncomeCredit, b.earnedIncomeCredit);
  assert.notDeepEqual(a.surtax, b.surtax);

  // A filer below the surtax threshold owes the same in both years, to the cent.
  money(
    ma({ massachusettsFivePercentIncome: 250_000, year: 2026 }).tax,
    ma({ massachusettsFivePercentIncome: 250_000, year: 2025 }).tax,
  );
  // A filer above it owes $984 less in 2026, which is 4% of the $24,600 the
  // threshold moved — the entire year-over-year change in Massachusetts tax law
  // for anyone.
  money(
    ma({ massachusettsFivePercentIncome: 2_000_000, year: 2025 }).tax -
      ma({ massachusettsFivePercentIncome: 2_000_000, year: 2026 }).tax,
    984,
  );
  money((1_107_750 - 1_083_150) * 0.04, 984);
});

test('the result says which inputs it did not get, with what they were worth', () => {
  const silent = ma({ massachusettsFivePercentIncome: 60_000 });
  const note = silent.notes.find((n) => n.includes('socialSecurityAndMedicarePaid was not supplied'));
  assert.ok(note, 'the missing FICA deduction is named');
  assert.ok(note.includes('$2,000'), 'and quantified');
  assert.ok(note.includes('26,144'), 'and says where the cap binds');
  // Supplying it removes the note rather than leaving a permanent warning.
  const supplied = ma({ massachusettsFivePercentIncome: 60_000, socialSecurityAndMedicarePaid: 4_590 });
  assert.equal(
    supplied.notes.some((n) => n.includes('socialSecurityAndMedicarePaid was not supplied')),
    false,
  );
});
