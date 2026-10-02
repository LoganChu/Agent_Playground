// The addition for other states' municipal interest, in the five states that
// make it — and the reason it took eight days to add four booleans.
//
// This is the one addition in the package that makes a federal-AGI base too LOW
// rather than too high. The dollars never reached federal AGI at all, so a state
// that wants them has to legislate an addition, and an engine that starts at AGI
// and stops misses the whole of it. Illinois's has been here since v0.20.0.
//
// The backlog entry read "the out-of-state municipal interest addback beyond
// Illinois — Indiana, Ohio, Virginia, Maryland" and sat at the bottom of eight
// consecutive plans, every time looking like data entry: four booleans, one
// afternoon. **The boolean is what made it look like that.** The five statutes
// reach four different things:
//
//   Illinois   35 ILCS 5/203(a)(2)(A)    the interest, gross
//   Virginia   § 58.1-322.01(1)          interest less expenses not deducted federally
//   Maryland   Tax-Gen. § 10-204(b)      interest AND DIVIDENDS, less related expenses
//   Ohio       R.C. 5747.01(A)(1)        interest AND DIVIDENDS, gross
//   Indiana    IC 6-3-1-3.5(a)(11)       only obligations ACQUIRED after 31 Dec 2011
//
// THE RULE: five states doing "the same thing" are five rules, and a flag that
// records the thing cannot record the differences. The two axes here are
// independent — Ohio is gross and wide, Maryland is net and wide, Virginia is net
// and narrow — which is why they are two fields and not one enum of five states.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stateIncomeTax,
  getStateDefinition,
  SUPPORTED_STATES,
  FILING_STATUSES,
} from './strict.mjs';

const YEAR = 2026;
const COUPON = 20_000;

const ADDING = SUPPORTED_STATES.filter(
  (code) => getStateDefinition(code, YEAR).outOfStateMunicipalInterestAddition !== undefined,
).sort();

const ruleOf = (code) => getStateDefinition(code, YEAR).outOfStateMunicipalInterestAddition;

function household(state, extra = {}) {
  return {
    state,
    year: YEAR,
    filingStatus: 'single',
    federal: {
      adjustedGrossIncome: 80_000,
      taxableIncome: 64_250,
      deduction: 15_750,
      deductionKind: 'standard',
      earnedIncomeCredit: 0,
    },
    earnedIncome: 80_000,
    ...extra,
  };
}

const taxOf = (state, extra = {}) => stateIncomeTax(household(state, extra)).tax;

test('five states make the addition, and each declares its own provision', () => {
  assert.deepEqual(ADDING, ['IL', 'IN', 'MD', 'OH', 'VA']);
  const cites = ADDING.map((code) => ruleOf(code).cite);
  // Day 30's rule: a shared citation launders a claim nobody checked through one
  // somebody did. Four of these five were added on one afternoon, which is
  // exactly when that is easiest to do.
  assert.equal(new Set(cites).size, 5, 'two states share a citation');
  for (const code of ADDING) {
    const rule = ruleOf(code);
    assert.ok(rule.cite.length > 60, `${code}: a label is not a citation`);
    assert.match(rule.cite, /§|ILCS|O\.R\.C/, `${code} cites no provision`);
    assert.ok(['interest', 'interestAndDividends'].includes(rule.measure), `${code}`);
    assert.equal(typeof rule.netOfExpenses, 'boolean', `${code}`);
  }
});

test('the two axes are independent, which is why they are two fields', () => {
  // If every wide state were also net, one enum would do. Ohio is wide and gross,
  // Maryland is wide and net, Virginia is narrow and net, Illinois is narrow and
  // gross: all four corners are occupied by a real state.
  const shape = (code) => `${ruleOf(code).measure}/${ruleOf(code).netOfExpenses}`;
  assert.equal(shape('OH'), 'interestAndDividends/false');
  assert.equal(shape('MD'), 'interestAndDividends/true');
  assert.equal(shape('VA'), 'interest/true');
  assert.equal(shape('IL'), 'interest/false');
  // And Indiana's third axis belongs to Indiana alone.
  assert.deepEqual(
    ADDING.filter((code) => ruleOf(code).acquiredAfterYear !== undefined),
    ['IN'],
  );
  assert.equal(ruleOf('IN').acquiredAfterYear, 2011);
});

test('every declaration is REACHABLE: the figure moves the tax in all five', () => {
  // A declaration no input can reach is decoration. Four of these were added
  // together, so proving each one separately is the difference between five rules
  // and one rule copied five times.
  for (const code of ADDING) {
    const without = taxOf(code);
    const with_ = taxOf(code, { outOfStateMunicipalInterest: COUPON });
    assert.ok(with_ > without, `${code} declares the addition and no input reaches it`);
    // The relation that is true in all five: the addition moves the BASE by
    // exactly the coupon. Asserting the TAX against a rate would be wrong in Ohio
    // — its schedule is a constant plus a rate charged whole on the first dollar
    // of a band, so $20,000 of extra base is not $20,000 at any one rate — and a
    // test that asserted five tax figures would go stale on the next rate cut.
    const base = (extra) => stateIncomeTax(household(code, extra)).stateAdjustedGrossIncome;
    assert.equal(
      base({ outOfStateMunicipalInterest: COUPON }) - base({}),
      COUPON,
      `${code}: the coupon did not reach the base`,
    );
    const detail = stateIncomeTax(
      household(code, { outOfStateMunicipalInterest: COUPON }),
    ).additions;
    assert.equal(detail, COUPON, `${code}: the addition is not reported as an addition`);
  }
});

test('and the twenty-three others ignore the field entirely', () => {
  // The list is a claim about five states, not a claim about twenty-eight. A
  // state that has not been read takes its additions through `additions`, and
  // silently adding this figure there would be asserting a statute nobody read.
  for (const code of SUPPORTED_STATES) {
    if (ADDING.includes(code)) continue;
    const def = getStateDefinition(code, YEAR);
    if (!def.hasIncomeTax) continue;
    const base =
      def.stateDefinedBase?.field === undefined
        ? {}
        : { [def.stateDefinedBase.field]: 80_000 };
    assert.equal(
      stateIncomeTax(household(code, { ...base, outOfStateMunicipalInterest: COUPON })).tax,
      stateIncomeTax(household(code, base)).tax,
      `${code} taxed an out-of-state coupon without a declaration saying it may`,
    );
  }
});

test('Indiana says what it assumed about a trade date it cannot see', () => {
  // The condition no return carries. IC 6-3-1-3.5(a)(11) reaches an obligation
  // "acquired by the taxpayer after December 31, 2011", and the Department makes
  // that the trade date — so an Indiana resident holding an Illinois bond bought
  // in 2010 owes Indiana nothing on it, permanently, and nothing on the return
  // distinguishes that bond from one bought in 2012.
  //
  // The engine adds back what it is given. That is an unanswerable question
  // answered by a default, which in this package is the condition for a note.
  const note = stateIncomeTax(
    household('IN', { outOfStateMunicipalInterest: COUPON }),
  ).notes.find((n) => n.includes('ACQUIRED after'));
  assert.ok(note, 'Indiana assumed a trade date in silence');
  assert.match(note, /31 December 2011/);
  assert.match(note, /\$20,000/);
  assert.match(note, /6-3-1-3\.5\(a\)\(11\)/);
  // And nothing is said to a caller who supplied no coupon, because nothing of
  // theirs was assumed.
  assert.equal(
    stateIncomeTax(household('IN')).notes.filter((n) => n.includes('ACQUIRED after')).length,
    0,
  );
  // Nor to the other four, whose additions do not turn on a date.
  for (const code of ['IL', 'OH', 'VA', 'MD']) {
    assert.equal(
      stateIncomeTax(household(code, { outOfStateMunicipalInterest: COUPON })).notes.filter((n) =>
        n.includes('ACQUIRED after'),
      ).length,
      0,
      `${code} claimed a date condition it does not have`,
    );
  }
});

test('the net-of-expenses states and the wide ones each say which they are', () => {
  const notes = (code) => stateIncomeTax(household(code, { outOfStateMunicipalInterest: COUPON })).notes;
  for (const code of ADDING) {
    const rule = ruleOf(code);
    const net = notes(code).filter((n) => n.includes('LESS the related expenses'));
    const wide = notes(code).filter((n) => n.includes('interest AND DIVIDENDS'));
    assert.equal(net.length, rule.netOfExpenses ? 1 : 0, `${code}: net-of-expenses note`);
    assert.equal(
      wide.length,
      rule.measure === 'interestAndDividends' ? 1 : 0,
      `${code}: interest-and-dividends note`,
    );
  }
  // Illinois is the state that says nothing, because its sentence asks for the
  // figure as it stands. A note per state per rule would be wallpaper; a note
  // where something was assumed is information.
  assert.equal(notes('IL').filter((n) => n.includes("other states' obligations")).length, 0);
});

test('the addition is read on every filing status, because it is about a bond', () => {
  // Unlike the § 151(b) spouse next door, nothing here turns on the return's
  // shape — so a test that only ever filed single would not have noticed a status
  // check nobody meant to write.
  for (const status of FILING_STATUSES) {
    for (const code of ADDING) {
      const plain = taxOf(code, { filingStatus: status });
      const withCoupon = taxOf(code, { filingStatus: status, outOfStateMunicipalInterest: COUPON });
      assert.ok(withCoupon > plain, `${code}/${status} dropped the addition`);
    }
  }
});
