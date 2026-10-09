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
import { stateIncomeTax, getStateDefinition, SUPPORTED_STATES, FILING_STATUSES } from './strict.mjs';

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
  // and the default here would have been "counts nobody" in all twelve — which
  // is right in eight of them and wrong in four.
  assert.equal(WITH_EXEMPTIONS.length, 16);
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

test('the answer today: four states count the spouse, four say no, three have nothing to count', () => {
  // Written out so that a state MOVING between these lists is a diff rather than
  // a silent change of behaviour in twelve states at once.
  const by = (kind) => WITH_EXEMPTIONS.filter((c) => declarationOf(c).spouse === kind);
  assert.deepEqual(by('claimed'), ['IL', 'IN', 'MD', 'VA']);
  assert.deepEqual(by('notClaimed'), ['AL', 'CT', 'MO', 'NJ']);
  assert.deepEqual(by('noFilerExemption'), ['GA', 'MN', 'NY']);
  assert.deepEqual(by('unresolved'), ['MA', 'MI', 'MS', 'OH', 'WI']);
  // And the second claim is now answered in all four, by THREE different
  // mechanisms and in two directions. Written out for the same reason as the
  // first list: a state moving between them is a diff.
  const aged = (kind) => WITH_EXEMPTIONS.filter((c) => declarationOf(c).agedAndBlind === kind);
  assert.deepEqual(aged('follows'), ['IL', 'IN', 'VA']);
  assert.deepEqual(aged('doesNotFollow'), ['MD']);
  assert.deepEqual(aged('unresolved'), ['MA', 'MI', 'MS']);
  assert.deepEqual(aged('notApplicable'), ['AL', 'CT', 'GA', 'MN', 'MO', 'NJ', 'NY', 'OH', 'WI']);
  // No state is `unresolved` on the aged half while being resolved on the first:
  // the four that are left are the four nobody has read at all. An aged claim
  // that outlived its exemption claim would be the harder gap to see, because the
  // exemption's citation would be sitting next to it looking like evidence.
  for (const code of aged('unresolved')) {
    assert.equal(declarationOf(code).spouse, 'unresolved', `${code}: half-read`);
  }
  // Wisconsin is the first state to be `unresolved` on the first half and
  // `notApplicable` on the second, and the combination is a real answer rather
  // than a half-read one: Wisconsin's $250 age addition is part of the
  // EXEMPTION and its aged-or-blind question therefore does not exist
  // separately — there is no § 63(f)-shaped second provision to read. The
  // invariant above runs the other way (unresolved-aged implies
  // unresolved-spouse) and is unaffected.
  assert.equal(declarationOf('WI').spouse, 'unresolved');
  assert.equal(declarationOf('WI').agedAndBlind, 'notApplicable');
  // Minnesota joins Georgia and New York on `noFilerExemption`, and it is the
  // STRONGEST of the three: Georgia and New York stopped giving the filer an
  // exemption; Minnesota never replaced the one it repealed with anything but a
  // dependent allowance, so § 290.0121 has no sentence about a taxpayer or a
  // spouse to read either way. Its aged-and-blind answer is `notApplicable`
  // for a different reason from the other eight — the addition exists, but it
  // is on the standard DEDUCTION rather than on the exemption, so there is no
  // exemption addition for a spouse to follow. Whether the deduction addition
  // follows one is a separate unread question and is in the state's notes.
  assert.equal(declarationOf('MN').spouse, 'noFilerExemption');
  assert.equal(declarationOf('MN').agedAndBlind, 'notApplicable');
  assert.ok(getStateDefinition('MN', 2026).standardDeductionAgedOrBlindAddition !== undefined);
});

test('the means-tested figure is declared where it exists, and only there', () => {
  // Day 30's rule at its finest grain. Indiana's $500 shares a subsection, a
  // dollar sign and an age test with two $1,000s whose answer is settled — and it
  // references § 63(f)(1) alone, carries its own AGI test, and Indiana's own
  // bulletin glosses it with "if filing a joint return", which it does not say of
  // the $1,000s. One field for both would have swept it along.
  for (const code of WITH_EXEMPTIONS) {
    const rule = declarationOf(code);
    const hasFigure = getStateDefinition(code, YEAR).exemption.perLowIncomeSeniorFiler !== undefined;
    assert.equal(
      rule.lowIncomeSenior !== undefined,
      hasFigure,
      `${code}: a means-tested age figure and its declaration must exist together`,
    );
    if (rule.lowIncomeSenior === undefined) continue;
    assert.ok(rule.lowIncomeSeniorCite.length > 40, `${code}: a label is not a citation`);
    assert.notEqual(rule.lowIncomeSeniorCite, rule.agedAndBlindCite);
    assert.notEqual(rule.lowIncomeSeniorCite, rule.cite);
  }
  // Indiana is the only state with one, and the two claims disagree — which is
  // the whole reason the field exists.
  assert.deepEqual(
    WITH_EXEMPTIONS.filter((c) => declarationOf(c).lowIncomeSenior !== undefined),
    ['IN'],
  );
  assert.equal(declarationOf('IN').agedAndBlind, 'follows');
  assert.equal(declarationOf('IN').lowIncomeSenior, 'unresolved');
});

test('the means-tested $500 does NOT follow the spouse, and the engine proves it', () => {
  // Reachability, per rule 2 of this file: a declaration no input can reach is
  // decoration. Indiana's threshold on a separate return is $20,000 of federal
  // AGI, so the household this file uses is far above it — a case that could not
  // tell the two claims apart at all. This one sits below it.
  const poor = {
    federal: {
      adjustedGrossIncome: 19_000,
      taxableIncome: 2_900,
      deduction: 16_100,
      deductionKind: 'standard',
      earnedIncomeCredit: 0,
    },
    earnedIncome: 19_000,
  };
  const off = withoutSpouse('IN', poor);
  const on = withSpouse('IN', poor);
  // $1,000 of base exemption and $1,000 of age addition follow the spouse; the
  // $500 does not. $2,000 and not $2,500 is the whole finding.
  assert.equal(on.exemptions - off.exemptions, 2_000);
  // And the filer's OWN $500 is in there, so the figure is live rather than
  // switched off by the income test: $1,000 + $1,000 + $500 for one person.
  assert.equal(off.exemptions, 2_500);
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

test('Indiana and Illinois: the age addition follows the spouse too, by two different routes', () => {
  // The successor to a test that asserted the opposite for five days, and the
  // pair is worth keeping together because the two states get to the same answer
  // from opposite drafting choices. Indiana points at § 63(f) — "each additional
  // amount allowable under Section 63(f)" — the way Virginia does. Illinois
  // writes the spouse's own two $1,000s out in 204(d) with § 151(b)'s conditions
  // copied onto them. A package that had generalised from either one would have
  // been right here and wrong in Maryland.
  assert.equal(withSpouse('IN').exemptions - withoutSpouse('IN').exemptions, 1_000 + 1_000);
  assert.equal(withSpouse('IL').exemptions - withoutSpouse('IL').exemptions, 2_850 + 1_000);
  // Maryland is the state that says no, and it says no in the same shape: the
  // $3,200 follows and the $1,000 does not.
  assert.equal(withSpouse('MD').exemptions - withoutSpouse('MD').exemptions, 3_200);
  // And at 61 none of the three gets an age addition for anybody, which is the
  // pair that isolates the two claims from each other in each state.
  const young = { filerAge: 61, spouseAge: 61 };
  assert.equal(withSpouse('IN', young).exemptions - withoutSpouse('IN', young).exemptions, 1_000);
  assert.equal(withSpouse('IL', young).exemptions - withoutSpouse('IL', young).exemptions, 2_850);
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

test('a REFUSED aged half reads differently from an UNREAD one', () => {
  // The distinction this field exists for, one level down from the exemption's.
  // Maryland has been read and says no; a caller is entitled to know that the
  // $1,000 is missing because Maryland wrote "the individual" and not because
  // nobody looked.
  const refused = withSpouse('MD').notes.find((n) => n.includes('SEPARATE question'));
  assert.ok(refused, 'MD discarded spouseAge without saying so');
  assert.match(refused, /THE STATE HAS BEEN READ AND THE ANSWER IS NO/);
  assert.match(refused, /10-211\(b\)\(3\)/);
  assert.doesNotMatch(refused, /may be too high/);
  // The three states nobody has read say the other thing, and they are the three
  // that do not count the spouse at all — so the note they carry is the
  // exemption's, not this one. Proving there is no aged note here is the point:
  // a state that has not been read on the first question cannot have a
  // second-question note that looks like progress.
  for (const code of ['MA', 'MI', 'MS']) {
    assert.equal(
      withSpouse(code).notes.filter((n) => n.includes('SEPARATE question')).length,
      0,
      `${code} reported a second-question gap while the first is unread`,
    );
  }
  // Virginia, Illinois and Indiana have read it and it follows, so none of them
  // has anything to report.
  for (const code of ['VA', 'IL', 'IN']) {
    assert.equal(
      withSpouse(code).notes.filter((n) => n.includes('SEPARATE question')).length,
      0,
      `${code} reported a question it has answered`,
    );
  }
  // Indiana's THIRD claim is the one it still owes a caller, and only when the
  // caller supplied a spouse age for it to discard.
  const hasThird = (r) => r.notes.filter((n) => n.includes('a third claim with its own')).length;
  const third = withSpouse('IN').notes.find((n) => n.includes('a third claim with its own'));
  assert.ok(third, 'IN swept its $500 along with its $1,000s');
  assert.match(third, /means-tested age exemption does NOT/);
  assert.match(third, /63\(f\)\(1\)/);
  assert.equal(hasThird(withSpouse('IN', { spouseAge: undefined })), 0);
  // And a caller who supplied no spouse age is told nothing, because nothing of
  // theirs was discarded.
  assert.equal(
    withSpouse('MD', { spouseAge: undefined }).notes.filter((n) => n.includes('SEPARATE question'))
      .length,
    0,
  );
});
