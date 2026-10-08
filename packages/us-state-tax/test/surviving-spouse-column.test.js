// Which COLUMN of a state's own table a widow is read against — and a ledger
// that forces the question to be asked about every state where the answer is
// observable.
//
// ## The bug this exists because of
//
// `byStatus()` defaults the surviving-spouse column to the JOINT figure. That is
// right wherever a state has the status, because § 63(c)(2)(A) and every state
// that copied it put a surviving spouse on the joint schedule — and it is
// silently wrong wherever the state does NOT have the status, in the flattering
// direction: a widow is handed a married couple's brackets, deduction and
// exemptions on one person's income. It was wrong in four states at once, for
// forty-three days, worth up to $2,861 a return in Wisconsin.
//
// Day 26 found the same assumption in a helper that counted PEOPLE
// (`livingFilerCount`, fixed across fourteen call sites) and
// `surviving-spouse-people.test.js` is the proof of that half. This is the other
// half, and the two are different questions: not how many filers the return has,
// but which column of the state's own table it is read against. No count can
// answer the second one.
//
// ## The deciding words, which are not the ones you would guess
//
// A state with no surviving-spouse status is NOT a state that files her as
// single, and NOT a state that files her as head of household. It is whichever
// its own instruction says, and the instruction turns on one phrase — whether
// the head-of-household box reads
//
//   "if you qualify to file as head of household on your federal return", or
//   "...as head of household OR QUALIFYING SURVIVING SPOUSE on your federal
//    return".
//
// The first DENIES her the box, because 26 U.S.C. § 2(b)(1) admits only an
// individual who "is not married at the close of his taxable year, IS NOT A
// SURVIVING SPOUSE (as defined in subsection (a))" — so a federal qualifying
// surviving spouse does not qualify federally as a head of household, and a
// state that incorporates the federal test by reference has excluded her by
// reference too. The second GRANTS it, because the state named her status as an
// alternative qualification.
//
// Both shapes are in this package and they give opposite answers:
//
//   Wisconsin     "head of household or qualifying surviving spouse"  -> HoH
//   Arizona       "head of household or qualifying widow or widower"  -> HoH
//   Mississippi   its own definition, no federal cross-reference      -> HoF
//   Alabama       head of family IS § 2(b), and nothing is added      -> single
//   Massachusetts head of household, if you qualify federally         -> single
//
// ## What this file asserts, and the line it draws
//
// A declaration is owed where the answer is OBSERVABLE. If no household in the
// battery can tell a state's surviving-spouse column from both its single and
// its head-of-household column, then nothing in the state turns on the question
// and a citation would be decoration. The moment a state acquires a figure that
// distinguishes them — which is the moment it starts to matter — the first test
// below demands either a `survivingSpouseFilesAs` declaration or an entry in the
// ledger of states that offer the status.
//
// **THE RULE: an invariant should fire exactly when the thing it protects
// becomes measurable, which for a by-status column means when some household can
// tell two columns apart.**
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  NO_INCOME_TAX_STATES,
  SUPPORTED_STATES,
  SUPPORTED_YEARS,
  getStateDefinition,
  stateIncomeTax,
} from './strict.mjs';
import { HOUSEHOLDS, household } from './status-households.mjs';

const TAXING = SUPPORTED_STATES.filter((s) => !NO_INCOME_TAX_STATES.includes(s));

/**
 * States whose surviving-spouse column IS the state's own, because the state's
 * return offers the status. Nothing is translated in these, and the joint
 * default that `byStatus()` applies is the state's own published treatment.
 *
 * Every entry names what was read. Three of them say the state's figure for the
 * status is the joint figure IN SO MANY WORDS, which is the strongest form this
 * evidence comes in: it is not an inference from the status existing.
 */
const OFFERS_THE_STATUS = {
  CA: 'Form 540 filing status 5, "Qualifying surviving spouse/RDP" (the FTB renamed it from "qualifying widow(er)" without changing the rules); Form 540NR lists it as box 5 too.',
  CO: 'DR 0104 instructions: "you must use the same filing status on both your federal and Colorado returns", so the federal status carries across unchanged and Colorado writes no figure against it of its own.',
  CT: 'CT-1040 carries qualifying surviving spouse as one of its five checkboxes, and the instructions set its zero-tax threshold at $24,000 — THE SAME AS MARRIED FILING JOINTLY, which is the joint column this package reads.',
  ID: 'Form 40 instructions: "your Idaho filing status must be the same as your federal filing status."',
  MO: 'Form MO-1040 carries "Qualifying widow(er)" as its own status, and this package stores Missouri figures against it explicitly rather than by default — see `missouri.ts`.',
  NC: 'D-400 carries "Qualifying Widow(er)/Surviving Spouse"; its 2025 standard deduction of $25,500 is the married-filing-jointly figure.',
  NY: 'IT-201 filing status 5; the instructions put its standard deduction at $16,050 for 2025, THE SAME AS MARRIED FILING JOINTLY.',
  OR: 'Form OR-40 carries the status, and this package stores Oregon figures against it explicitly — see `oregon.ts`.',
  UT: 'TC-40 instructions: enter the code matching the federal return, and the code list carries "5 Qualifying surviving spouse" outright.',
};

const cents = (n) => Math.round(n * 100);

/**
 * Every household's tax under the four statuses that bear on the question, WITH
 * THE FEDERAL BASIS HELD FIXED.
 *
 * The fixed basis is the whole method, and the first version of this file did
 * not have it. `household()` builds the federal standard deduction from the
 * filing status it is given — correctly, because that is what a federal return
 * does — so running the battery once per status varies TWO things at once and
 * cannot isolate either. In Arizona, whose state deduction IS the federal one,
 * every difference between the statuses came through the federal basis and none
 * of it through any Arizona figure, and all three tests below reported Arizona
 * as a state whose surviving-spouse column was observable, unexplained and
 * untranslated. It was none of those things.
 *
 * **THE RULE: a sweep that changes the filing status also changes the federal
 * basis, so it measures the two together — and a question about which COLUMN of
 * a state's table is read has to hold everything that is not the column still.**
 *
 * The basis held still here is the surviving spouse's own, which is the joint
 * one under § 63(c)(2)(A). So the comparison is the exact one the question asks:
 * this filer's federal figures, read against four different columns of the
 * state's table.
 */
function battery(state, year) {
  return HOUSEHOLDS.map((name) => {
    const basis = household(name, state, year, 'qualifyingSurvivingSpouse');
    const under = (status) => stateIncomeTax({ ...basis, filingStatus: status }).totalTax;
    return {
      name,
      qss: under('qualifyingSurvivingSpouse'),
      single: under('single'),
      hoh: under('headOfHousehold'),
      joint: under('marriedFilingJointly'),
    };
  });
}

// ---------------------------------------------------------------------------
// 1. The detector. A surviving-spouse column no household can mistake for the
//    single or the head-of-household one is a column somebody chose, and it has
//    to be a column somebody can cite.
// ---------------------------------------------------------------------------

test('every state whose surviving-spouse column is observable has said why', () => {
  const unexplained = [];
  for (const state of TAXING) {
    for (const year of SUPPORTED_YEARS) {
      const def = getStateDefinition(state, year);
      const rows = battery(state, year);
      const observable = rows.filter(
        (r) => cents(r.qss) !== cents(r.single) && cents(r.qss) !== cents(r.hoh),
      );
      if (observable.length === 0) continue;
      const declared = def.survivingSpouseFilesAs !== undefined;
      const offered = Object.hasOwn(OFFERS_THE_STATUS, state);
      if (!declared && !offered) {
        unexplained.push(
          `${state} ${year}: ${observable.length} household(s) can tell the surviving-spouse ` +
            `column from both the single and the head-of-household one — e.g. ` +
            `${observable[0].name}: $${observable[0].qss.toFixed(2)} against ` +
            `$${observable[0].single.toFixed(2)} single and $${observable[0].hoh.toFixed(2)} ` +
            `head of household. Either the state offers the status (add it to ` +
            `OFFERS_THE_STATUS with what you read) or it does not (declare ` +
            `survivingSpouseFilesAs on the definition).`,
        );
      }
      // A DECLARED state must not be observable at all: the whole point of the
      // declaration is that the widow's answer is one of the other two columns.
      if (declared) {
        assert.fail(
          `${state} ${year} declares survivingSpouseFilesAs: ` +
            `'${def.survivingSpouseFilesAs.filesAs}' and yet ${observable.length} household(s) ` +
            `get an answer that is neither its single nor its head-of-household one. The ` +
            `translation is not reaching every table.`,
        );
      }
    }
  }
  assert.deepEqual(unexplained, []);
});

// ---------------------------------------------------------------------------
// 2. The declarations, checked against the engine rather than trusted.
// ---------------------------------------------------------------------------

test('a declared surviving-spouse status is the one the engine actually uses', () => {
  const declared = [];
  for (const state of TAXING) {
    for (const year of SUPPORTED_YEARS) {
      const def = getStateDefinition(state, year);
      const rule = def.survivingSpouseFilesAs;
      if (rule === undefined) continue;
      declared.push(`${state} ${year}`);

      // A translation to a MARRIED status would put two filers on a one-filer
      // return, which is the Day 26 bug coming back through this door. Neither
      // of the two statuses allowed here changes `livingFilerCount`.
      assert.ok(
        rule.filesAs === 'single' || rule.filesAs === 'headOfHousehold',
        `${state} translates a surviving spouse to '${rule.filesAs}', which is not a one-filer status`,
      );
      assert.ok(rule.cite.length > 80, `${state}'s surviving-spouse citation is too short to be one`);

      // The state cannot both offer the status and send her somewhere else.
      assert.ok(
        !Object.hasOwn(OFFERS_THE_STATUS, state),
        `${state} is in OFFERS_THE_STATUS and also declares survivingSpouseFilesAs`,
      );

      for (const row of battery(state, year)) {
        const target = row[rule.filesAs === 'single' ? 'single' : 'hoh'];
        assert.equal(
          cents(row.qss),
          cents(target),
          `${state} ${year} ${row.name}: a surviving spouse pays $${row.qss.toFixed(2)} where ` +
            `${rule.filesAs} pays $${target.toFixed(2)}`,
        );
      }
    }
  }
  // The four states, both years. A fifth would be a new finding and should break
  // this line on its way in.
  assert.deepEqual(declared, [
    'AL 2025',
    'AL 2026',
    'AZ 2025',
    'AZ 2026',
    'MS 2025',
    'MS 2026',
    'WI 2025',
    'WI 2026',
  ]);
});

// ---------------------------------------------------------------------------
// 3. The declaration has to be LOAD-BEARING — or the state has to be the one
//    where it provably cannot be.
//
//    This is the test that found Arizona. A declaration that moves no answer is
//    decoration, and three of the four move plenty. Arizona's moves NOTHING,
//    and the reason is not that Arizona agrees with the default: it is that
//    Arizona's standard deduction is defined as the FEDERAL one, so the figure
//    was chosen by the federal filing status before Arizona saw the return, and
//    no status this engine substitutes afterwards can reach it.
//
//    THE RULE: a column swap reaches every figure the state CHOSE and none of
//    the figures it BORROWED.
// ---------------------------------------------------------------------------

test('a declared surviving-spouse status moves an answer, or the state has nothing of its own to move', () => {
  for (const state of TAXING) {
    for (const year of SUPPORTED_YEARS) {
      const def = getStateDefinition(state, year);
      if (def.survivingSpouseFilesAs === undefined) continue;
      const rows = battery(state, year);
      const moved = rows.filter((r) => cents(r.qss) !== cents(r.joint));
      if (moved.length > 0) continue;
      // Nothing moved. The only acceptable reason is that the state has no
      // figure of its own that depends on the filing status at all, which for a
      // state whose deduction is the federal one means its whole return does
      // not: same flat rate, no exemption, no by-status credit.
      assert.equal(
        def.deduction.kind,
        'federal',
        `${state} ${year} declares survivingSpouseFilesAs and no household's answer differs ` +
          `from the joint column, so the declaration is decoration`,
      );
      // And the reason has to be checkable rather than asserted: on ONE fixed
      // federal basis, a state with nothing of its own by status gives the same
      // answer in every column. Arizona does, which is the proof that the
      // declaration is unreachable rather than unnecessary.
      for (const row of rows) {
        assert.equal(
          cents(row.single),
          cents(row.joint),
          `${state} ${year} ${row.name}: on one fixed federal basis a single filer pays ` +
            `$${row.single.toFixed(2)} and a joint return $${row.joint.toFixed(2)}, so ${state} ` +
            `DOES have a figure of its own by filing status and the translation ought to have ` +
            `moved it`,
        );
      }
    }
  }
});

// ---------------------------------------------------------------------------
// 4. The result reports the status the CALLER asked about.
//
//    The translation is an implementation of the state's instruction, not a
//    correction of the caller. A caller who asked about a widow and got back
//    `filingStatus: 'headOfHousehold'` would have to read a note to find out
//    that the question had been changed.
// ---------------------------------------------------------------------------

test('a translated return still reports the filing status it was asked about', () => {
  for (const state of ['AL', 'AZ', 'MS', 'WI']) {
    const result = stateIncomeTax(household('wage62k', state, 2026, 'qualifyingSurvivingSpouse'));
    assert.equal(result.filingStatus, 'qualifyingSurvivingSpouse');
    const said = result.notes.filter((n) => n.includes('NO QUALIFYING SURVIVING SPOUSE FILING STATUS'));
    assert.equal(said.length, 1, `${state} should say once that it has no such status`);
    assert.match(said[0], /was computed as a (single filer|head of household)/);
  }
});

test('a state that offers the status says nothing about translating one', () => {
  for (const state of Object.keys(OFFERS_THE_STATUS)) {
    const result = stateIncomeTax(household('wage62k', state, 2026, 'qualifyingSurvivingSpouse'));
    assert.equal(
      result.notes.filter((n) => n.includes('NO QUALIFYING SURVIVING SPOUSE FILING STATUS')).length,
      0,
      `${state} offers the status and should not claim otherwise`,
    );
  }
});

// ---------------------------------------------------------------------------
// 6. The note Day 26 built, which this file's own change silenced for an hour.
//
//    `surviving-spouse-people.test.js` proves the engine DROPS every
//    spouse-shaped field on a widow's return. The engine also SAYS so, and the
//    saying-so is the point: v0.27.0 found fourteen places that had been reading
//    those fields, and every one of them took a caller who supplied them.
//
//    The v0.40.0 translation rewrites `input.filingStatus` before anything reads
//    it, so the gate on that note stopped matching in exactly the four states
//    that have no surviving-spouse status — which are exactly the states where a
//    caller is most likely to believe the status means two filers, because their
//    own forms have no box for her. The computation never changed;
//    `livingFilerCount` is 1 for single and for head of household alike.
//
//    THE RULE: the TRANSLATED status is for COMPUTING and the ASKED status is for
//    anything the caller is TOLD. Both halves need a test, because only one of
//    them is typed.
// ---------------------------------------------------------------------------

test('a translated return still says a widow has no spouse', () => {
  const withSpouseFields = (state) =>
    stateIncomeTax({
      ...household('retired70', state, 2026, 'qualifyingSurvivingSpouse'),
      filerAge: 70,
      spouseAge: 70,
    });
  // The four that translate, and four that do not, so a fix that broke the other
  // branch would fail here too.
  for (const state of ['AL', 'AZ', 'MS', 'WI', 'CT', 'NY', 'VA', 'MA']) {
    const said = withSpouseFields(state).notes.filter((n) => n.includes('ONE-PERSON return'));
    assert.equal(said.length, 1, `${state} should say once that a widow has no spouse`);
    assert.match(said[0], /spouseAge/);
    // And it names the status the CALLER gave, not the column the state uses.
    assert.match(said[0], /Filing status is qualifyingSurvivingSpouse/);
  }
  // The dropping itself, which is the thing the note is about: her answer does
  // not move when a dead spouse's age is supplied.
  for (const state of ['AL', 'AZ', 'MS', 'WI']) {
    const base = household('retired70', state, 2026, 'qualifyingSurvivingSpouse');
    assert.equal(
      stateIncomeTax({ ...base, filerAge: 70, spouseAge: 70 }).totalTax,
      stateIncomeTax({ ...base, filerAge: 70 }).totalTax,
      `${state}: a dead spouse's age moved a widow's answer`,
    );
  }
});
