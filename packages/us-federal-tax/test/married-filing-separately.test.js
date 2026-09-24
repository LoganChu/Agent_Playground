import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FILING_STATUSES,
  YEARS,
  estimateFederalTax,
  qualifiedOvertimeDeduction,
  qualifiedTipsDeduction,
  seniorDeduction,
  standardDeduction,
  vehicleLoanInterestDeduction,
} from '../dist/esm/index.js';

// ---------------------------------------------------------------------------
// Where a married individual filing a separate return sits, parameter by
// parameter — the companion to `surviving-spouse.test.js`, and written after it
// for the same reason: the defects in this status are single figures and single
// missing branches, not features, so twenty-nine days of tests aimed at features
// never touched them.
//
// The Code has no single convention here. It has four, and they sit within a
// few sections of each other:
//
//   HALVED        § 164(b)(6)(B)  the SALT cap, its threshold and its floor
//   NOT HALVED    § 24(b)(2)      "$200,000 in any other case" — the same as single
//   ITS OWN WORD  § 3101(b)(2)    "$125,000 in the case of a married taxpayer
//                                  filing a separate return"
//   BARRED        § 32(d), § 224(f), § 225(e), § 151(d)(5)(C)(v)
//
// and one more that belongs to neither column and is the reason this file cannot
// be written as "MFS is half of joint":
//
//   MORE THAN     § 63(f)(1)(B) via § 151(b) gives a separate filer the spouse's
//   A JOINT       age and blindness amounts when the spouse has no gross income.
//   RETURN GETS   On a JOINT return § 151(b) never fires, because both spouses
//                 are the taxpayer. The sentence reaches a separate return only.
//
// Three defects lived behind the absence of this table, and unlike the surviving
// spouse's they do not all run the same way:
//
//   § 163(h)(4)   vehicle loan interest denied outright      up to $10,000 of
//                                                            deduction, TOO HIGH
//                                                            a bill
//   § 63(f)(1)(B) the spouse's age/blind amounts never       $1,650 a flag,
//                 allowed                                    TOO HIGH a bill
//   § 63(c)(6)(A) the standard deduction not zeroed when     up to $16,100 of
//                 the other spouse itemizes                  deduction, TOO LOW
//
// The first two are the expensive ones for the filer, which is the direction
// nobody complains about from the other side: a package that overcharges a
// separate filer will never hear about it from the IRS.
// ---------------------------------------------------------------------------

const MFS = 'marriedFilingSeparately';

/**
 * Each entry states a claim about the separate-return column that can be checked
 * against the OTHER columns of the same table, so the table is not restated here
 * and cannot drift from itself.
 *
 * `holds(separate, single, joint)` is the claim. `phrase` is the sentence that
 * makes it true, and it is the part worth reading: two parameters can hold the
 * same relation for completely different reasons, and the reason is what decides
 * what happens when a figure moves.
 */
const SEPARATE_RETURN = [
  {
    path: 'ordinaryBrackets',
    relation: 'exactly half the joint schedule, band for band',
    holds: (sep, _single, joint) => bandsAreHalf(sep, joint),
    cite: '§ 1(j)(2)(C), (D)',
    phrase:
      'the separate-return table is the joint table halved at every breakpoint, and it has stayed exactly halved through three years of indexing. That is what makes the 35% band the tell: a separate filer reaches 37% at half the joint figure, $384,350 in 2026, while a SINGLE filer does not until $640,600.',
  },
  {
    path: 'standardDeduction',
    relation: 'the single figure',
    holds: (sep, single) => sep === single,
    cite: '§ 63(c)(2)(C)',
    phrase:
      '"$3,000 in any other case" — the subparagraph the joint amount is 200 percent OF. So the separate figure equals the single one because both are the base, not because anything was halved. The identity with half the joint figure is a consequence and must not be mistaken for the rule; § 63(c)(6)(A) can take the whole thing to zero, which no halving would.',
  },
  {
    path: 'additionalStandardDeduction',
    relation: 'the joint figure — the MARRIED amount, which is the smaller one',
    holds: (sep, _single, joint) => sep === joint,
    cite: '§ 63(f)(3)',
    phrase:
      '"in the case of an individual who is not married and is not a surviving spouse" the $600 becomes $750. A separate filer IS married, so they take the smaller married amount. One of the two places in this package where following the married column costs the filer money.',
  },
  {
    path: 'additionalMedicareThreshold',
    relation: 'half the joint figure, and the statute prints it',
    holds: (sep, _single, joint) => sep === joint / 2,
    cite: '§ 3101(b)(2), § 1401(b)(2)(A)',
    phrase:
      '"$250,000 in the case of a joint return, $125,000 in the case of a married taxpayer filing a separate return, and $200,000 in any other case." Three figures in one sentence, none of them derived — which is why this threshold has never moved while everything around it indexed.',
  },
  {
    path: 'longTermCapitalGains',
    relation: 'half the joint breakpoints, rounded to a multiple of $25',
    holds: (sep, _single, joint) => bandsAreHalfWithinRounding(sep, joint),
    cite: '§ 1(j)(5)(B)(iv), § 1(f)(7)(B)',
    phrase:
      'the statute prints "$239,500 in the case of a married individual filing a separate return" against $479,000 for a joint return — exactly half at enactment, and then indexed SEPARATELY. § 1(f)(7)(B) rounds a separate return\'s adjustment to a multiple of $25 where everything else rounds to $50, so the two drift apart by up to $25 and back again: the 15% breakpoint is $25 below half the joint figure in 2024 ($291,850 against $291,875) and in 2025 ($300,000 against $300,025), and exactly half in 2026. A model that derives this by halving is wrong in two years out of three.',
  },
  {
    path: 'niit.thresholds',
    relation: 'half the joint figure, and the statute prints it',
    holds: (sep, _single, joint) => sep === joint / 2,
    cite: '§ 1411(b)(2)',
    phrase:
      '"$125,000 in the case of a married taxpayer filing a separate return." Never indexed, same as § 3101(b)(2) — and note the two agree here while disagreeing about a surviving spouse, so neither can be derived from the other.',
  },
  {
    path: 'scheduleOneA.tips.phaseOut.thresholds',
    relation: 'the single figure, and UNREACHABLE',
    holds: (sep, single) => sep === single,
    cite: '§ 224(b)(2), barred by § 224(f)',
    phrase:
      '"$150,000 ($300,000 in the case of a joint return)" puts a separate return in the first case, and then § 224(f) says the section applies to a married individual only on a joint return. The figure is real and can never be used.',
    reachable: false,
  },
  {
    path: 'scheduleOneA.overtime.cap',
    relation: 'the single figure, and UNREACHABLE',
    holds: (sep, single) => sep === single,
    cite: '§ 225(b)(1), barred by § 225(e)',
    phrase: '"$12,500 ($25,000 in the case of a joint return)", then barred outright.',
    reachable: false,
  },
  {
    path: 'scheduleOneA.overtime.phaseOut.thresholds',
    relation: 'the single figure, and UNREACHABLE',
    holds: (sep, single) => sep === single,
    cite: '§ 225(b)(2), barred by § 225(e)',
    phrase: '"$150,000 ($300,000 in the case of a joint return)", then barred outright.',
    reachable: false,
  },
  {
    path: 'scheduleOneA.senior.phaseOutThreshold',
    relation: 'the single figure, and UNREACHABLE',
    holds: (sep, single) => sep === single,
    cite: '§ 151(d)(5), barred by § 151(d)(5)(C)(v)',
    phrase:
      '"$75,000 ($150,000 in the case of a joint return)", then barred: the enhanced deduction for seniors is allowed to a married individual only on a joint return.',
    reachable: false,
  },
  {
    path: 'scheduleOneA.vehicleLoanInterest.phaseOut.thresholds',
    relation: 'the single figure, and LIVE — the one Schedule 1-A figure a separate return uses',
    holds: (sep, single) => sep === single,
    cite: '§ 163(h)(4)(C)(ii); NOTHING bars it',
    phrase:
      '"$100,000 ($200,000 in the case of a joint return)" — and § 163(h)(4) contains no married-individuals clause, unlike the three sections above it in this table. This figure sat here looking exactly like the four dead ones for seventeen days. An unreachable figure cannot be wrong, which is precisely why nobody checks whether it is reachable.',
    reachable: true,
  },
  {
    path: 'section199A.thresholdAmount',
    relation: 'the single figure, or $25 above it',
    holds: (sep, single) => sep === single || sep === single + 25,
    cite: '§ 199A(e)(2), § 1(f)(7)(B)',
    phrase:
      '"$157,500 (200 percent of such amount in the case of a joint return)" makes a separate return a non-joint return, so it starts from the single figure. § 1(f)(7)(B) then rounds a separate return to $25 rather than $50, so in a year when the unrounded amount lands between the two the separate figure is $25 HIGHER than single — $201,775 against $201,750 in 2026, and equal in 2024 and 2025. The same $25 appears in Rev. Proc. 2020-45 for 2021, so it is the rule working, not a typo.',
  },
  {
    path: 'section199A.phaseInRange',
    relation: 'the single figure, with no $25 rounding',
    holds: (sep, single) => sep === single,
    cite: '§ 199A(b)(3)(B)(i)(I), (d)(3)(A)',
    phrase:
      '"$75,000 ($150,000 in the case of a joint return)". Not indexed at all — § 199A(e)(2)(B) adjusts the threshold amount and says nothing about the phase-in range — so the $25 rounding that splits the threshold above can never touch this. Two figures in the same provision, one indexed and one not, is the cheapest way to get a separate return wrong by $25.',
  },
  {
    path: 'saltCap.cap',
    relation: 'half the joint figure',
    holds: (sep, _single, joint) => sep === joint / 2,
    cite: '§ 164(b)(6)(B)',
    phrase:
      '"in the case of a married individual filing a separate return" the cap is halved. This is the only provision in this package that halves for a separate return AND leaves joint and single equal, so it is the one place where "half of joint" and "half of single" are the same claim.',
  },
  {
    path: 'saltCap.phaseDownThreshold',
    relation: 'half the joint figure',
    holds: (sep, _single, joint) => sep === joint / 2,
    cite: '§ 164(b)(6)(B)(ii)',
    phrase:
      'halved with the cap. In 2024 every status is Infinity because there was no phase-down; Infinity halves to itself, so the claim holds without asserting anything, which is what the vacuity test below is for.',
  },
  {
    path: 'saltCap.floor',
    relation: 'half the joint figure',
    holds: (sep, _single, joint) => sep === joint / 2,
    cite: '§ 164(b)(6)(B)',
    phrase: 'halved with the cap — $5,000 against $10,000, in every year including 2024.',
  },
  {
    path: 'childTaxCredit.phaseOut.thresholds',
    relation: 'the single figure — NOT halved',
    holds: (sep, single) => sep === single,
    cite: '§ 24(b)(2)',
    phrase:
      '"$400,000 in the case of a joint return, and $200,000 in any other case." One of the few places the Code declines to halve a joint figure for a separate return, and it is worth the whole credit to a separate filer between $100,000 and $200,000 — a band that a model built by halving would phase out entirely.',
  },
  {
    path: 'earnedIncomeCredit.table[].phaseOutStart',
    relation: 'the single figure',
    holds: (sep, single) => sep === single,
    cite: '§ 32(b)(2)(B), reachable only through § 32(d)(2)',
    phrase:
      'the phaseout amount is increased "in the case of a joint return", and a separate return is not one. Not a dead figure, unlike the four above: § 32(d)(2) lets a separate filer who lived apart from their spouse for the last six months and has a qualifying child claim the credit, and this is the figure they use.',
  },
  {
    path: 'socialSecurity.baseAmount',
    relation: 'the single figure — but usually overridden to $0',
    holds: (sep, single) => sep === single,
    cite: '§ 86(c)(1), overridden by § 86(c)(1)(C)',
    phrase:
      'the table figure is the "any other case" $25,000, and it applies only to a separate filer who lived apart from their spouse for the WHOLE year. Anyone who lived with their spouse for one day gets $0 under § 86(c)(1)(C), so 85% of the benefit is taxable from the first dollar. The stored figure is therefore the exception rather than the rule, which is the reverse of how it reads.',
  },
  {
    path: 'socialSecurity.adjustedBaseAmount',
    relation: 'the single figure — but usually overridden to $0',
    holds: (sep, single) => sep === single,
    cite: '§ 86(c)(2), overridden by § 86(c)(2)(C)',
    phrase: '"$44,000, in the case of a joint return" against $34,000 otherwise, then $0 if they cohabited.',
  },
];

// --- helpers ---------------------------------------------------------------

function bandsAreHalf(separate, joint) {
  if (!Array.isArray(separate) || !Array.isArray(joint)) return false;
  if (separate.length !== joint.length) return false;
  return separate.every((band, i) => band.rate === joint[i].rate && band.upTo === joint[i].upTo / 2);
}

function bandsAreHalfWithinRounding(separate, joint) {
  if (!Array.isArray(separate) || !Array.isArray(joint)) return false;
  if (separate.length !== joint.length) return false;
  return separate.every((band, i) => {
    if (band.rate !== joint[i].rate) return false;
    const half = joint[i].upTo / 2;
    if (!Number.isFinite(half)) return band.upTo === half;
    // Within one § 1(f)(7)(B) rounding step of half, and landing on one.
    return Math.abs(band.upTo - half) <= 25 && band.upTo % 25 === 0;
  });
}

const BY_PATH = new Map(SEPARATE_RETURN.map((entry) => [entry.path, entry]));
const STATUS_KEYS = new Set(FILING_STATUSES);

function isStatusTable(node) {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) return false;
  const keys = Object.keys(node);
  return keys.length === STATUS_KEYS.size && keys.every((key) => STATUS_KEYS.has(key));
}

/** Every status-keyed table in a year's parameters, as `[path, table]`. */
function statusTables(node, path = '', found = []) {
  if (node === null || typeof node !== 'object') return found;
  if (isStatusTable(node)) {
    found.push([path, node]);
    return found;
  }
  for (const [key, value] of Object.entries(node)) {
    const step = Array.isArray(node) ? '[]' : path ? `.${key}` : key;
    statusTables(value, `${path}${step}`, found);
  }
  return found;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// --- the table's own guards ------------------------------------------------

test('every status-keyed parameter in every year appears in SEPARATE_RETURN', () => {
  for (const [year, parameters] of Object.entries(YEARS)) {
    for (const [path] of statusTables(parameters)) {
      assert.ok(
        BY_PATH.has(path),
        `${year}: ${path} is keyed by filing status and is not in SEPARATE_RETURN. ` +
          'Read the operative sentence, decide whether a separate return is halved, ' +
          'takes the single figure, gets its own printed figure, or is barred, and ' +
          'add a line saying which phrase settled it.',
      );
    }
  }
});

test('no SEPARATE_RETURN entry describes a parameter that no longer exists', () => {
  const live = new Set();
  for (const parameters of Object.values(YEARS)) {
    for (const [path] of statusTables(parameters)) live.add(path);
  }
  for (const { path } of SEPARATE_RETURN) {
    assert.ok(live.has(path), `SEPARATE_RETURN names ${path}, which is in no year's parameters.`);
  }
});

test('a separate return holds the relation its statute puts it in', () => {
  for (const [year, parameters] of Object.entries(YEARS)) {
    for (const [path, table] of statusTables(parameters)) {
      const entry = BY_PATH.get(path);
      assert.ok(
        entry.holds(table[MFS], table.single, table.marriedFilingJointly),
        `${year} ${path}: a separate return should be ${entry.relation}. ` +
          `${entry.cite}: ${entry.phrase}`,
      );
    }
  }
});

test('no entry is vacuous: in some year the separate figure differs from single or joint', () => {
  // Per ENTRY rather than per year, on purpose. `saltCap.phaseDownThreshold` is
  // Infinity for every status in 2024 because the phase-down did not exist, and
  // an entry that says nothing in one year is not decoration if it says
  // something in another. An entry that never discriminates in ANY year is.
  for (const { path, cite } of SEPARATE_RETURN) {
    let discriminates = false;
    for (const parameters of Object.values(YEARS)) {
      for (const [p, table] of statusTables(parameters)) {
        if (p !== path) continue;
        if (!same(table[MFS], table.single) || !same(table[MFS], table.marriedFilingJointly)) {
          discriminates = true;
        }
      }
    }
    assert.ok(
      discriminates,
      `${path} holds the same value for a separate return, a single return and a ` +
        `joint return in every year, so its entry asserts nothing. Either ${cite} ` +
        'stopped distinguishing them and the entry should say so, or this table is ' +
        'no longer keyed by filing status at all.',
    );
  }
});

// ---------------------------------------------------------------------------
// Reachability — the part that actually found the defect.
//
// Four Schedule 1-A thresholds hold a separate-return figure that the engine can
// never use, because the deduction is barred. The fifth looks identical and is
// live. The whole cost of getting that wrong is that a dead figure is never
// checked against behaviour, so a live one filed next to it is not either.
// ---------------------------------------------------------------------------

test('exactly one Schedule 1-A deduction reaches a separate return, and the table says which', () => {
  const declared = SEPARATE_RETURN.filter((e) => e.reachable !== undefined);
  assert.equal(declared.length, 5, 'all five Schedule 1-A status tables must declare reachability');
  assert.equal(declared.filter((e) => e.reachable).length, 1);

  for (const year of [2025, 2026]) {
    const magi = 60_000; // under every threshold in the table
    assert.equal(
      qualifiedTipsDeduction({
        qualifiedTips: 9_000,
        modifiedAdjustedGrossIncome: magi,
        filingStatus: MFS,
        year,
      }).deduction,
      0,
      `${year}: § 224(f) bars tips on a separate return`,
    );
    assert.equal(
      qualifiedOvertimeDeduction({
        qualifiedOvertimeCompensation: 9_000,
        modifiedAdjustedGrossIncome: magi,
        filingStatus: MFS,
        year,
      }).deduction,
      0,
      `${year}: § 225(e) bars overtime on a separate return`,
    );
    assert.equal(
      seniorDeduction({
        modifiedAdjustedGrossIncome: magi,
        filingStatus: MFS,
        year,
        age65OrOlder: true,
      }).deduction,
      0,
      `${year}: § 151(d)(5)(C)(v) bars the senior deduction on a separate return`,
    );
    assert.equal(
      vehicleLoanInterestDeduction({
        qualifiedInterest: 9_000,
        modifiedAdjustedGrossIncome: magi,
        filingStatus: MFS,
        year,
      }).deduction,
      9_000,
      `${year}: nothing in § 163(h)(4) bars a separate return`,
    );
  }
});

test('the four barred deductions report why, rather than returning a quiet zero', () => {
  const at = (fn, extra) =>
    fn({ modifiedAdjustedGrossIncome: 50_000, filingStatus: MFS, year: 2026, ...extra });
  assert.equal(at(qualifiedTipsDeduction, { qualifiedTips: 5_000 }).ineligible, true);
  assert.equal(
    at(qualifiedOvertimeDeduction, { qualifiedOvertimeCompensation: 5_000 }).ineligible,
    true,
  );
  assert.equal(at(seniorDeduction, { age65OrOlder: true }).ineligible, true);
  assert.equal(at(vehicleLoanInterestDeduction, { qualifiedInterest: 5_000 }).ineligible, false);
});

test('each Schedule 1-A deduction cites its OWN provision for the separate-return rule', () => {
  // The defect was not a wrong boolean. It was one `ineligibleFilingStatuses`
  // list whose docstring named § 224(f) and § 225(e) and then said "the senior
  // deduction and the vehicle loan interest deduction carry the same restriction
  // per IRS guidance" — two provisions read, two waved at, and one of the two
  // waved at was wrong. A shared citation is the shape of that defect, so the
  // four cites must be distinct.
  for (const parameters of Object.values(YEARS)) {
    const schedule = parameters.scheduleOneA;
    if (!schedule) continue;
    const rules = [
      schedule.tips.separateReturn,
      schedule.overtime.separateReturn,
      schedule.senior.separateReturn,
      schedule.vehicleLoanInterest.separateReturn,
    ];
    for (const rule of rules) {
      assert.equal(typeof rule.allowed, 'boolean');
      assert.ok(rule.cite.length > 20, 'a separate-return rule must name its provision');
    }
    assert.equal(
      new Set(rules.map((r) => r.cite)).size,
      4,
      'two Schedule 1-A deductions share a citation for the separate-return rule. ' +
        'That is how § 163(h)(4) came to be read as § 224(f): name the provision ' +
        'for each, or say in the cite that there is none.',
    );
  }
});

// ---------------------------------------------------------------------------
// § 63, on whole returns. Both defects are in one function and they run in
// opposite directions, which is why neither showed up as an implausible total.
// ---------------------------------------------------------------------------

const separate = (input) => estimateFederalTax({ ...input, filingStatus: MFS });

test('§ 63(f)(1)(B): a separate filer gets the spouse amounts when § 151(b) allows them', () => {
  // The spouse is 65 and blind and has no income of their own — a household on
  // one pension, filing separately, which is common enough to have a name at the
  // IRS and rare enough that no test here had ever built one.
  const household = {
    year: 2026,
    otherOrdinaryIncome: 90_000,
    age65OrOlder: true,
    spouseAge65OrOlder: true,
    spouseBlind: true,
  };

  const withoutTheFact = separate(household);
  const withTheFact = separate({
    ...household,
    spouseHasNoGrossIncomeAndIsNotADependent: true,
  });

  // $16,100 base + one filer condition at $1,650.
  assert.equal(withoutTheFact.deduction, 17_750); // v0.11.0: the same, for the wrong reason
  // Plus the spouse's age and blindness at $1,650 each.
  assert.equal(withTheFact.deduction, 21_050); // v0.11.0: $17,750 — $3,300 too little
  assert.equal(withoutTheFact.totalTax, 10_607); // v0.11.0: the same
  assert.equal(withTheFact.totalTax, 9_881); // v0.11.0: $10,607.00 — $726.00 too much
  assert.equal(
    +(withoutTheFact.totalTax - withTheFact.totalTax).toFixed(2),
    726, // $3,300 at 22%
  );
});

test('§ 63(f): the fact has to be asked for, and the result says when it was not', () => {
  const r = separate({
    year: 2026,
    otherOrdinaryIncome: 90_000,
    spouseAge65OrOlder: true,
  });
  // Nothing on a return implies whether a spouse had gross income, so the engine
  // withholds the amount — and then says so, rather than letting the caller
  // believe a flag they supplied was used.
  assert.match(r.notes.join('\n'), /§ 63\(f\)\(1\)\(B\)/);
  assert.match(r.notes.join('\n'), /spouseHasNoGrossIncomeAndIsNotADependent/);
  assert.match(r.notes.join('\n'), /\$1,650/);
});

test('§ 63(f): a joint return never needs the fact, because § 151(b) never fires on one', () => {
  // The asymmetry that makes this rule easy to miss: the same sentence gives a
  // separate return something a joint return gets by a different route entirely.
  const joint = (extra) =>
    estimateFederalTax({
      year: 2026,
      filingStatus: 'marriedFilingJointly',
      otherOrdinaryIncome: 60_000,
      spouseAge65OrOlder: true,
      ...extra,
    });
  assert.equal(joint({}).deduction, joint({ spouseHasNoGrossIncomeAndIsNotADependent: true }).deduction);
  assert.equal(joint({}).notes.length, 0);
});

test('§ 63(c)(6)(A): the standard deduction is zero when the other spouse itemizes', () => {
  const household = { year: 2026, w2Wages: 80_000, itemizedDeductions: 6_000 };

  const assumed = separate(household);
  assert.equal(assumed.deduction, 16_100);
  assert.equal(assumed.deductionKind, 'standard');

  const told = separate({ ...household, spouseItemizes: true });
  // $6,000 of itemized deductions, against no standard deduction at all.
  assert.equal(told.deduction, 6_000); // v0.11.0: $16,100
  assert.equal(told.deductionKind, 'itemized');
  assert.equal(+(told.totalTax - assumed.totalTax).toFixed(2), 2_222); // $10,100 at 22%
});

test('§ 63(c)(6)(A): with nothing to itemize the deduction is zero, not the standard amount', () => {
  const r = separate({ year: 2026, w2Wages: 80_000, spouseItemizes: true });
  assert.equal(r.deduction, 0);
  // Reporting `standard` for a standard deduction the statute forbids would be
  // the wrong kind of true: the filer has no choice left to make.
  assert.equal(r.deductionKind, 'itemized');
});

test('§ 63(c)(6)(A): the assumption is stated, because it is the one that favours the filer', () => {
  const r = separate({ year: 2026, w2Wages: 80_000 });
  assert.match(r.notes.join('\n'), /§ 63\(c\)\(6\)\(A\)/);
  assert.match(r.notes.join('\n'), /spouseItemizes/);
  // Answering it either way removes the note; only silence earns one.
  assert.equal(separate({ year: 2026, w2Wages: 80_000, spouseItemizes: false }).notes.length, 0);
});

test('§ 63(c)(6)(A) and § 63(f): the NOTE says which section took the flag, not just that one did', () => {
  // Two returns that both ignore a spouse's age, for two different reasons. A
  // note that gave the § 151(b) reason on the second would be priced at $1,650
  // a flag when the right answer is that there is nothing to add it to — a note
  // that is itself a wrong answer, which is the failure mode of a notes array.
  const under151b = separate({
    year: 2026,
    w2Wages: 80_000,
    spouseAge65OrOlder: true,
    spouseItemizes: false,
  });
  assert.match(under151b.notes.join('\n'), /§ 151\(b\)/);
  assert.match(under151b.notes.join('\n'), /\$1,650/);

  const under63c6 = separate({
    year: 2026,
    w2Wages: 80_000,
    spouseAge65OrOlder: true,
    spouseItemizes: true,
  });
  assert.match(under63c6.notes.join('\n'), /§ 63\(c\)\(6\)\(A\) leaves this return none/);
  assert.doesNotMatch(under63c6.notes.join('\n'), /\$1,650/);
});

test('§ 63(c)(6)(A) and § 63(f) compose: no standard deduction means no additions to it', () => {
  const r = separate({
    year: 2026,
    otherOrdinaryIncome: 60_000,
    age65OrOlder: true,
    blind: true,
    spouseAge65OrOlder: true,
    spouseHasNoGrossIncomeAndIsNotADependent: true,
    spouseItemizes: true,
  });
  // Four § 63(f) conditions at $1,650 each, and every one of them gone: the
  // additional amounts are additions TO a standard deduction, and § 63(c)(6)(A)
  // says there is not one.
  assert.equal(standardDeduction({
    filingStatus: MFS,
    year: 2026,
    age65OrOlder: true,
    blind: true,
    spouseAge65OrOlder: true,
    spouseHasNoGrossIncomeAndIsNotADependent: true,
  }), 16_100 + 3 * 1_650);
  assert.equal(r.deduction, 0);
});

// ---------------------------------------------------------------------------
// What the vehicle loan interest defect was worth, on a whole return.
// ---------------------------------------------------------------------------

test('§ 163(h)(4): a separate filer with a car loan was overcharged $2,200', () => {
  const household = {
    year: 2026,
    w2Wages: 90_000,
    qualifiedVehicleLoanInterest: 10_000,
  };
  const r = separate(household);

  assert.equal(r.additionalDeductions.vehicleLoanInterest.deduction, 10_000);
  assert.equal(r.additionalDeductions.total, 10_000);
  assert.equal(r.totalTax, 8_770); // v0.11.0: $10,970.00 — $2,200.00 too much
  assert.equal(separate({ year: 2026, w2Wages: 90_000 }).totalTax, 10_970);

  // And the other three stay barred on the same return, so this is not "the
  // separate filer was let in" — it is one section out of four.
  const withEverything = separate({
    ...household,
    qualifiedTips: 9_000,
    qualifiedOvertimeCompensation: 5_000,
    age65OrOlder: true,
  });
  assert.equal(withEverything.additionalDeductions.tips.deduction, 0);
  assert.equal(withEverything.additionalDeductions.overtime.deduction, 0);
  assert.equal(withEverything.additionalDeductions.senior.deduction, 0);
  assert.equal(withEverything.additionalDeductions.vehicleLoanInterest.deduction, 10_000);
});

test('§ 163(h)(4): the discarded inputs are reported, not silently dropped', () => {
  const r = separate({
    year: 2026,
    w2Wages: 90_000,
    qualifiedTips: 9_000,
    qualifiedOvertimeCompensation: 5_000,
    age65OrOlder: true,
    spouseItemizes: false,
  });
  const notes = r.notes.join('\n');
  assert.match(notes, /qualifiedTips` was ignored/);
  assert.match(notes, /§ 224\(f\)/);
  assert.match(notes, /qualifiedOvertimeCompensation` was ignored/);
  assert.match(notes, /§ 225\(e\)/);
  assert.match(notes, /§ 151\(d\)\(5\)\(C\)\(v\)/);
  // The vehicle loan interest was used, so nothing is said about it.
  assert.doesNotMatch(notes, /163\(h\)\(4\)/);
});

// ---------------------------------------------------------------------------
// The invariants. These are the durable half: they have no right answer unless
// a belief is false, so they cannot be written by accident by someone who holds
// the belief. (Day 29's rule, applied to the status it was not found in.)
// ---------------------------------------------------------------------------

test('a fact about a spouse changes nothing on a separate return unless a provision names it', () => {
  // Four spouse facts, three statuses' worth of belief that a spouse is half a
  // household, and exactly two provisions that actually read them here:
  // § 63(f) via § 151(b), and § 86(c)(1)(C) via `livedWithSpouse`.
  const base = { year: 2026, w2Wages: 70_000, qualifiedVehicleLoanInterest: 3_000 };
  const plain = separate(base).totalTax;

  // A spouse's age and blindness, without the § 151(b) fact: ignored.
  assert.equal(separate({ ...base, spouseAge65OrOlder: true, spouseBlind: true }).totalTax, plain);
  // A spouse who itemizes nothing: no change either.
  assert.equal(separate({ ...base, spouseItemizes: false }).totalTax, plain);
});

test('two separate returns equal one joint return where nothing but § 1 and § 63(c) is in range', () => {
  // The invariant the halved bracket table exists to produce, and the one that
  // fails the moment any figure in SEPARATE_RETURN is typed into the wrong
  // column: two spouses earning $120,000 each pay, between them, exactly what
  // they would pay on a joint return of $240,000. Nothing else is in range at
  // this income — no credit, no Schedule 1-A, no § 86, no NIIT.
  const sep = separate({ year: 2026, w2Wages: 120_000 });
  const joint = estimateFederalTax({
    year: 2026,
    filingStatus: 'marriedFilingJointly',
    w2Wages: 240_000,
  });

  assert.equal(joint.taxableIncome, 2 * sep.taxableIncome);
  assert.equal(joint.totalTax, 2 * sep.totalTax);

  // And the separate filer pays what a SINGLE filer on the same income pays,
  // which is the other half of the same fact: § 63(c)(2)(C) and the halved
  // bracket table agree at every income below the 35% band.
  const single = estimateFederalTax({ year: 2026, filingStatus: 'single', w2Wages: 120_000 });
  assert.equal(sep.deduction, single.deduction);
  assert.equal(sep.ordinaryIncomeTax, single.ordinaryIncomeTax);

  // They stop agreeing at $384,350, where § 1(j)(2)(D) sends a separate return
  // into 37% and a single filer has another $256,250 of 35% band left.
  const highSep = separate({ year: 2026, w2Wages: 500_000 });
  const highSingle = estimateFederalTax({ year: 2026, filingStatus: 'single', w2Wages: 500_000 });
  assert.equal(highSep.marginalRate, 0.37);
  assert.equal(highSingle.marginalRate, 0.35);
});
