// The spouse IRC § 151(b) puts on a SEPARATE return, one level down.
//
// § 151(b) allows the taxpayer an exemption for the spouse "if a separate return
// is made by the taxpayer, and if the spouse ... has no gross income and is not
// the dependent of another taxpayer". It is the one sentence in the Code that
// reaches a separate return and not a joint one — on a joint return both spouses
// are already the taxpayer, so the clause has nothing to do — and `us-federal-tax`
// v0.12.0 implemented it for § 63(f)'s aged and blind amounts.
//
// Every state with a personal exemption faces the same question, and the answers
// run BOTH WAYS. This file is the guard that the answer is a state's own and has
// a citation behind it, rather than an inference from the federal rule or from
// the shape of the word "spouse".
//
// Three rules from Day 30, applied here:
//
//  1. A shared citation launders a claim nobody checked through one somebody did.
//     So no two `claimed` states may share a `cite`, and a state's aged-and-blind
//     claim is a separate string from its exemption claim.
//  2. A parameter the engine can never reach is not tested by anything. So every
//     `claimed` declaration is PROVED to change an answer, and every
//     `noFilerExemption` declaration is PROVED against the table beside it.
//  3. A table that states a RELATION cannot drift from the data it describes. So
//     the spouse's worth is asserted against the state's own joint column rather
//     than restated as a number.
import test from 'node:test';
import assert from 'node:assert/strict';
import { stateIncomeTax, getStateDefinition, SUPPORTED_STATES, FILING_STATUSES } from '../dist/esm/index.js';

const YEAR = 2025;

/** Every supported state that has an exemption rule at all, in code order. */
const WITH_EXEMPTIONS = SUPPORTED_STATES.filter(
  (code) => getStateDefinition(code, YEAR).exemption !== undefined,
).sort();

const declarationOf = (code) => getStateDefinition(code, YEAR).exemption.separateReturnSpouse;

/**
 * A separate filer with a retirement income big enough to be taxed in every one
 * of these states and an age that turns on the aged additions. `spouseAge` is
 * supplied deliberately: on a separate return it describes somebody who is not
 * on the return, and whether the state may read it is exactly what is at issue.
 */
/**
 * Three states define their own base and refuse to guess at a federal figure,
 * so the same household has to be stated in their own terms as well.
 */
const OWN_BASE = {
  NJ: { newJerseyGrossIncome: 55_000 },
  MA: { massachusettsFivePercentIncome: 55_000 },
};

function household(state, extra = {}) {
  return {
    ...OWN_BASE[state],
    state,
    year: YEAR,
    filingStatus: 'marriedFilingSeparately',
    federal: {
      adjustedGrossIncome: 55_000,
      taxableIncome: 38_900,
      deduction: 16_100,
      deductionKind: 'standard',
      earnedIncomeCredit: 0,
    },
    filerAge: 68,
    spouseAge: 68,
    earnedIncome: 55_000,
    ...extra,
  };
}

const withSpouse = (state, extra = {}) =>
  stateIncomeTax(household(state, { ...extra, spouseHasNoGrossIncomeAndIsNotADependent: true }));
const withoutSpouse = (state, extra = {}) => stateIncomeTax(household(state, extra));

test('every state with an exemption declares what it does with a separate filer’s spouse', () => {
  // The point of making the field required rather than optional. A silent
  // default is what kept fourteen states counting a dead spouse for 27 days,
  // and the default here would have been "counts nobody" in all eleven — which
  // is right in seven of them and wrong in four.
  assert.equal(WITH_EXEMPTIONS.length, 11);
  for (const code of WITH_EXEMPTIONS) {
    const rule = declarationOf(code);
    assert.ok(rule, `${code} has an exemption rule and must declare separateReturnSpouse`);
    assert.ok(
      ['claimed', 'notClaimed', 'noFilerExemption', 'unresolved'].includes(rule.spouse),
      `${code}: ${rule.spouse}`,
    );
    assert.ok(
      ['follows', 'doesNotFollow', 'notApplicable', 'unresolved'].includes(rule.agedAndBlind),
      `${code}: ${rule.agedAndBlind}`,
    );
    assert.ok(rule.cite.length > 40, `${code} needs a citation, not a label`);
  }
});

test('the answer today: four states count the spouse, one says no, two have nothing to count', () => {
  // Written out so that a state MOVING between these lists is a diff rather than
  // a silent change of behaviour in eleven states at once.
  const by = (kind) => WITH_EXEMPTIONS.filter((c) => declarationOf(c).spouse === kind);
  assert.deepEqual(by('claimed'), ['IL', 'IN', 'MD', 'VA']);
  assert.deepEqual(by('notClaimed'), ['NJ']);
  assert.deepEqual(by('noFilerExemption'), ['GA', 'NY']);
  assert.deepEqual(by('unresolved'), ['MA', 'MI', 'MS', 'OH']);
  // And the second claim is answered in exactly one of the four, because one
  // statute pointed at § 63(f) and three wrote their own words.
  assert.deepEqual(
    WITH_EXEMPTIONS.filter((c) => declarationOf(c).agedAndBlind === 'follows'),
    ['VA'],
  );
});

test('no two states share a citation, and the aged claim is never the exemption claim', () => {
  // Day 30's rule as a test. The four `claimed` states reach the same result by
  // four different routes — Virginia and Illinois by defining their exemption in
  // terms of § 151, Maryland and Indiana by copying § 151(b)'s sentence into
  // their own statutes — and a citation that covered two of them would be
  // exactly the defect of 2026-09-24: the half that was waved at riding into
  // production on the credibility of the half that was read.
  const cites = WITH_EXEMPTIONS.map((c) => declarationOf(c).cite);
  assert.equal(new Set(cites).size, cites.length, 'two states share a separate-return citation');
  for (const code of WITH_EXEMPTIONS) {
    const rule = declarationOf(code);
    if (rule.agedAndBlindCite !== undefined) {
      assert.notEqual(
        rule.agedAndBlindCite,
        rule.cite,
        `${code}: the aged and blind claim must cite its own provision`,
      );
    }
    // A citation names a provision. "Per state guidance" is the tell that
    // nobody read one.
    assert.match(
      rule.cite,
      /§|ILCS|MCL|O\.R\.C|O\.C\.G\.A|N\.J\.S\.A|M\.G\.L/,
      `${code} cites no provision`,
    );
  }
});

test('“no filer exemption” is proved against the table beside it, not asserted', () => {
  // An unreachable figure cannot be wrong, which is why nobody checks whether it
  // is reachable. Georgia and New York are declared out of this question because
  // they give the filer nothing — and if either ever restores a personal
  // exemption, this fails rather than quietly leaving a spouse uncounted.
  for (const code of WITH_EXEMPTIONS) {
    if (declarationOf(code).spouse !== 'noFilerExemption') continue;
    const perFiler = getStateDefinition(code, YEAR).exemption.perFiler;
    for (const status of FILING_STATUSES) {
      assert.equal(perFiler[status], 0, `${code} claims no filer exemption but ${status} has one`);
    }
  }
});

test('every “claimed” declaration is REACHABLE: it changes an answer', () => {
  // The assertion that would have caught 2026-09-24's defect on Day 6. A
  // declaration that no input can reach is decoration, and decoration is never
  // tested by anything.
  for (const code of WITH_EXEMPTIONS) {
    if (declarationOf(code).spouse !== 'claimed') continue;
    const off = withoutSpouse(code);
    const on = withSpouse(code);
    assert.ok(
      on.exemptions > off.exemptions,
      `${code} declares the spouse claimed and no input reaches it`,
    );
    assert.ok(on.tax < off.tax, `${code}: the exemption moved and the tax did not`);
  }
});

test('and every other declaration is reachable the other way: nothing moves', () => {
  for (const code of WITH_EXEMPTIONS) {
    if (declarationOf(code).spouse === 'claimed') continue;
    assert.equal(
      withSpouse(code).totalTax,
      withoutSpouse(code).totalTax,
      `${code} does not claim the spouse and the answer moved anyway`,
    );
  }
});

test('the spouse is worth one separate filer’s exemption, checked against the joint column', () => {
  // A table of figures agrees with itself; a table of RELATIONS argues. The
  // engine derives the spouse's worth from the separate column of `perFiler`,
  // so the relation that makes that derivation sound is asserted here rather
  // than left implicit: in each of these four the joint figure is exactly twice
  // the separate one, which is the state saying that its exemption is an amount
  // per person and not an amount per status.
  for (const code of WITH_EXEMPTIONS) {
    if (declarationOf(code).spouse !== 'claimed') continue;
    const perFiler = getStateDefinition(code, YEAR).exemption.perFiler;
    assert.equal(
      perFiler.marriedFilingJointly,
      perFiler.marriedFilingSeparately * 2,
      `${code}: the spouse's worth is derived from a column whose joint figure is not twice it`,
    );
  }
});

test('Virginia: $930 of exemption AND $800 of aged exemption, because § 63(f) reaches the spouse', () => {
  // The one state that settles both halves, and it settles the second by
  // cross-reference: § 58.1-322.03(2)(b) gives the $800 to "each blind or aged
  // taxpayer as defined under § 63(f)", and § 63(f)(1)(B) is the subparagraph
  // that reaches a separate return's spouse through § 151(b). The same sentence
  // us-federal-tax v0.12.0 implemented federally.
  const off = withoutSpouse('VA');
  const on = withSpouse('VA');
  assert.equal(off.exemptions, 930 + 800);
  assert.equal(on.exemptions, 930 + 800 + 930 + 800);
  // Virginia's top rate begins at $17,000 of taxable income, so both figures
  // come off at 5.75% for this filer. The difference is $99.47 and not the
  // $99.475 the multiplication gives, because each return is rounded to the cent
  // before the two are compared — which is right: they are two returns, not one
  // subtraction, and $1,730 of exemption at 5.75% lands exactly on a half cent.
  assert.equal(Number((off.tax - on.tax).toFixed(2)), 99.47);
  assert.equal(Math.abs((930 + 800) * 0.0575 - 99.47) < 0.01, true);
});

test('Virginia at 61: the aged half does not fire, and the exemption half still does', () => {
  // The pair that isolates the two claims. Without it, a single case at 68 could
  // not tell "the state counts the spouse" from "the state counts an aged
  // spouse", which is exactly the conflation this file exists to prevent.
  const young = { filerAge: 61, spouseAge: 61 };
  assert.equal(withoutSpouse('VA', young).exemptions, 930);
  assert.equal(withSpouse('VA', young).exemptions, 1860);
});

test('Maryland: the spouse is stepped by federal AGI like every other exemption', () => {
  // The most expensive of the four and the only one whose worth depends on a
  // figure that has nothing to do with the spouse. § 10-211(c)'s staircase
  // multiplies EVERY exemption on the return, so the same spouse is worth
  // $3,200, $1,600, $800 or nothing at four different incomes.
  const at = (agi) =>
    withSpouse('MD', { federal: { adjustedGrossIncome: agi, taxableIncome: agi - 16_100, deduction: 16_100, deductionKind: 'standard', earnedIncomeCredit: 0 } }).exemptions -
    withoutSpouse('MD', { federal: { adjustedGrossIncome: agi, taxableIncome: agi - 16_100, deduction: 16_100, deductionKind: 'standard', earnedIncomeCredit: 0 } }).exemptions;
  assert.equal(at(90_000), 3_200);
  assert.equal(at(110_000), 1_600);
  assert.equal(at(130_000), 800);
  assert.equal(at(160_000), 0);
});

test('Indiana and Illinois: the base exemption moves and the age additions do not', () => {
  // Three of the four wrote their own words for the age and blindness additions
  // rather than pointing at § 63(f), and nobody has read whose spouse those
  // words reach. So the engine counts the spouse once and says so, and this test
  // pins the CURRENT answer rather than a belief about the right one — if
  // somebody reads Ind. Code § 6-3-1-3.5(a) or 35 ILCS 5/204(c) and finds that
  // the additions follow, this fails and asks to be updated deliberately.
  assert.equal(withSpouse('IN').exemptions - withoutSpouse('IN').exemptions, 1_000);
  assert.equal(withSpouse('IL').exemptions - withoutSpouse('IL').exemptions, 2_850);
});

test('the fact is read on a separate return and nowhere else', () => {
  // § 151(b) has nothing to do on a joint return, because there both spouses are
  // already the taxpayer. A caller who passes the flag on every return must not
  // move a joint, single, head-of-household or widow's answer by a cent.
  for (const status of FILING_STATUSES) {
    if (status === 'marriedFilingSeparately') continue;
    for (const code of WITH_EXEMPTIONS) {
      const plain = stateIncomeTax(household(code, { filingStatus: status }));
      const flagged = stateIncomeTax(
        household(code, { filingStatus: status, spouseHasNoGrossIncomeAndIsNotADependent: true }),
      );
      assert.equal(flagged.totalTax, plain.totalTax, `${code}/${status} read the flag`);
    }
  }
});

test('an unanswerable question answered by a default is reported; a rule that exists is not', () => {
  // The federal package's discipline, which is what keeps a notes array from
  // becoming wallpaper: **a note is owed when an input was DISCARDED, or an
  // unanswerable question was answered by a default — not merely when a rule
  // exists.** So the four `claimed` states speak to a caller who said nothing,
  // and go quiet the moment the caller answers.
  const mentions = (result) =>
    result.notes.filter((n) => n.includes('spouseHasNoGrossIncomeAndIsNotADependent'));
  for (const code of WITH_EXEMPTIONS) {
    const rule = declarationOf(code);
    const silent = withoutSpouse(code);
    if (rule.spouse === 'claimed') {
      assert.equal(mentions(silent).length, 1, `${code} answered by default and said nothing`);
      assert.match(mentions(silent)[0], /worth \$\d/, `${code}'s note does not price the default`);
      assert.equal(mentions(withSpouse(code)).length, 0, `${code} still speaks after being told`);
    } else {
      // Nothing was discarded and no question was answered, so nothing is said.
      assert.equal(mentions(silent).length, 0, `${code} spoke about a question it does not have`);
      // ...until a caller supplies a fact this state throws away.
      assert.equal(mentions(withSpouse(code)).length, 1, `${code} discarded an input in silence`);
    }
  }
});

test('an “unresolved” note says nobody read it, not that the state said no', () => {
  // The distinction that makes the backlog honest. Four states count nobody
  // because their statutes have not been read, and a caller is entitled to know
  // that this package's answer there may be too much tax rather than the law.
  const unread = withSpouse('OH').notes.find((n) =>
    n.includes('spouseHasNoGrossIncomeAndIsNotADependent'),
  );
  assert.match(unread, /NOBODY HAS READ THE PROVISION/);
  assert.match(unread, /does not flatter the filer/);
  const refused = withSpouse('NJ').notes.find((n) =>
    n.includes('spouseHasNoGrossIncomeAndIsNotADependent'),
  );
  assert.match(refused, /does not allow it/);
  assert.match(refused, /54A:3-1\(b\)/);
  const nothing = withSpouse('NY').notes.find((n) =>
    n.includes('spouseHasNoGrossIncomeAndIsNotADependent'),
  );
  assert.match(nothing, /no personal exemption/);
});

test('the open half of a resolved state is reported too, and only when it is load-bearing', () => {
  // Maryland, Indiana and Illinois count the spouse and do not know whether
  // their age and blindness additions follow. A caller who supplied `spouseAge`
  // has told this package something it then threw away, and that is the
  // condition for a note.
  for (const code of ['MD', 'IN', 'IL']) {
    const note = withSpouse(code).notes.find((n) => n.includes('SEPARATE question'));
    assert.ok(note, `${code} discarded spouseAge without saying so`);
    assert.match(note, /open/);
  }
  // Virginia has read it, so it has nothing to report.
  assert.equal(
    withSpouse('VA').notes.filter((n) => n.includes('SEPARATE question')).length,
    0,
  );
  // And a caller who supplied no spouse age is told nothing, because nothing of
  // theirs was discarded.
  assert.equal(
    withSpouse('MD', { spouseAge: undefined }).notes.filter((n) => n.includes('SEPARATE question'))
      .length,
    0,
  );
});
