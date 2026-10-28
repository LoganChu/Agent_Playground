#!/usr/bin/env node
/**
 * Which of the figures this package ships can the mutation audit NOT perturb?
 *
 * ## Why this exists
 *
 * `scores.json` publishes a mutation score — 99.6% for `us-state-tax` — and a
 * score is a statement about the mutants the harness produced. It says nothing
 * about the parameters it could not produce a mutant for, and for four days
 * this repository has described that gap in prose without measuring it.
 *
 * **Day 63 is the day it cost something.** Iowa's exemption credit is `$40` a
 * head and a head of household claims two of them; this package gave them one.
 * `mutantOf` perturbs a decimal in `(0,1)`, an integer in `[1900,2100]` written
 * without a separator, and an integer at or above `100`. **`40` is none of
 * those, so that figure has no mutant and the audit could not have caught the
 * defect.** The differential grid caught it, in six households, every one wrong
 * by exactly `$40.00`.
 *
 * So the honest thing to publish beside the score is its complement:
 *
 * > A MUTATION SCORE IS A STATEMENT ABOUT THE PARAMETERS THE HARNESS CAN
 * > PERTURB. The ones it cannot are not covered at 99.6%; they are not covered
 * > at all, and the only way to know how many there are is to count them.
 *
 * ## What it measures
 *
 * The denominator is the one the provenance ledger already publishes: every
 * numeric leaf of every supported state-year, `citations` and
 * `provisionalFigures` excluded. Each figure is classified by what `mutantOf`
 * would do with it, and the ones it would refuse fall into four classes:
 *
 *   - **`sentinel`** — `Infinity` or `NaN`. An unbounded bracket ceiling or an
 *     absent cap. These are the honest ones: no document states them, nothing
 *     can read them wrong, and `provenance.ts` already classifies them as
 *     `sentinel` for the same reason. Counted and then set aside.
 *   - **`smallInteger`** — an integer below 100. Ages, step counts, filer
 *     counts — **and real dollar amounts**: Iowa's `$40` exemption credit, New
 *     York's `$75` household credit, Ohio's `$20` and `$50`, New Jersey's `$50`
 *     property tax credit. This is the class with money in it and the class
 *     Day 63's defect was in.
 *   - **`zero`** — the integer zero. A zero bracket, a zero rate, a cap of
 *     nothing. Day 62 recorded this one after Oklahoma's 0% band.
 *   - **`largeDecimal`** — a decimal at or above 1. An indexation multiplier or
 *     a printed figure with cents.
 *
 * ## What `--check` asserts
 *
 * Not the counts — those move whenever a state is added, and a tool that has to
 * be edited for every state gets edited without being read. It asserts the two
 * things that should never change silently:
 *
 *   1. **Every unmutatable figure is in one of the four named classes.** A
 *      fifth class means `mutantOf` changed and this file's account of it is
 *      stale.
 *   2. **Every rule field holding an unmutatable figure is DECLARED below.** A
 *      new field holding a parameter the audit cannot see is a parameter
 *      somebody shipped without saying so, and that is exactly how Day 63's
 *      `$40` got in. Adding a field here is cheap; the point is that it cannot
 *      happen silently.
 *
 * Run with `--check` for CI; without it, it prints the full inventory.
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mutantOf } from './enumerate.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHECK = process.argv.includes('--check');

const fail = (...lines) => {
  for (const l of lines) console.error(l);
  process.exit(1);
};

const entry = join(ROOT, 'packages', 'us-state-tax', 'dist', 'esm', 'index.js');
let pkg;
try {
  pkg = await import(entry);
} catch (err) {
  fail(
    `cannot import us-state-tax: ${err.message}`,
    '',
    'This tool reads the shipped definitions, so the package must be built:',
    '  (cd packages/us-state-tax && npm install && npm run build)',
  );
}
const { getStateDefinition, SUPPORTED_STATES, SUPPORTED_YEARS } = pkg;

/**
 * The rule fields that hold at least one figure the audit cannot perturb.
 *
 * Declared rather than derived, and the reason is the one this whole file is
 * about: a field that appears here is a place where a wrong number would not be
 * caught by the score, so somebody has to have looked at it. Deriving the list
 * would make it complete and meaningless.
 *
 * The comment on each is what the figures ARE, because "an integer below 100"
 * covers an age and a dollar amount and only one of those is alarming.
 */
const DECLARED = {
  // ARKANSAS, AND IT IS THE LARGEST SINGLE-STATE ENTRY IN THIS OBJECT. Day 64
  // added a state 142 of whose figures the audit cannot touch, which is almost a
  // quarter of the 593 the whole package had before it — and they are not
  // sentinels or ages, they are the rate schedule and the tax tables.
  'rate.rows':
    "ARKANSAS'S REDUCTIONS, AND THEY ARE UNPERTURBABLE FOR THREE DIFFERENT REASONS AT ONCE. (The schedule's RATES and its income boundaries are reachable and are not in this count; what lands here is the reduction column.) Its reductions carry CENTS — $111.98, $223.97, $287.97, $419.96, and $369.90 down to $79.90 across the thirty rows of the bracket adjustment — which is the `largeDecimal` class Day 62 documented, because `mutantOf` perturbs a decimal in (0,1) and an integer at or above 100 and a figure with cents is neither. Three reductions are whole integers BELOW 100 ($91.00, $89.30 rounded, $79.90). And the zero-rate first row's rate and reduction are both zero. So the schedule that produces this package's steepest marginal rate — 13.70% in 2026, 13.90% in 2025 — is almost entirely invisible to the audit. `test/arkansas.test.js` measures the slope, the step count, the $287.30 and the $329.00 by hand, and `test/step-probes.test.js` probes all 35 and 38 rows through a married-filing-separately return, which is the only status Arkansas's low-income tables do not cover",
  'lowIncomeTaxTable.byStatus':
    "ARKANSAS'S LOW INCOME TAX TABLES, AND THIS ENTRY IS MOSTLY GOOD NEWS, WHICH IS WHY ITS NUMBER IS SMALL. The seven published tables are five distinct arrays of 224 rows, each row an income boundary and a whole-dollar tax amount. ALL 224 BOUNDARIES ARE PERTURBABLE and so are 205 of the 224 amounts, because `mutantOf` reaches any integer at or above 100 — so the audit sees nearly all of this rule, and a 240-mutant sample over exactly these figures killed 240 of 240. What lands HERE is the remainder: the 19 tax amounts below $100 (the first row or two of each table, where the tax is $29 to $94), the zero rows, and the empty married-filing-separately cell. THE AMOUNTS ARE THE TAX ITSELF rather than a parameter of it — a single Arkansan at $17,400 of AGI owes $222 because the table says $222 — so an unperturbable one here is an unchecked ANSWER and not an unchecked input, which is why `test/arkansas.test.js` walks every row of all five arrays for monotonicity, whole-dollar steps and slope rather than trusting the score. The tables' implied marginal rates run from 7.00% to 12.40%, against a top statutory rate of 3.7%",
  'lowIncomeTaxTable.secondTableFromDependents':
    "a COUNT: Arkansas's 2, the number of dependents at which the second half of each table takes over. The instructions' own division — \"no dependents or one dependent\" against \"two or more\"",
  'additionalTaxCredit.maximum':
    "DOLLARS: Arkansas's $60 a filer and $120 on a joint return. Only the $120 is at or above 100, so four of the five status cells have no mutant and `test/arkansas.test.js` asserts all five",
  'additionalTaxCredit.withdrawalPerIncrement':
    "DOLLARS: Arkansas's $5 a step, $10 on a joint return — the figure withdrawn \"for each $100 or part of $100\" above the threshold. Both below 100, so neither has a mutant, and the CEILING in the statute's words is what makes this a staircase of twelve $5 steps rather than a 5% phase-out rate",
  // Unbounded ceilings, overwhelmingly. `Infinity` as the top of a schedule.
  'rate.byStatus': 'bracket ceilings of Infinity, and the zero rate of every zero band',
  'rate.brackets': 'the same, for the states whose schedule is not per status',
  'surtax.brackets': 'Infinity ceilings and zero floors',
  'capitalGainsSurtax.brackets': 'Infinity ceilings and zero floors',
  'itemizedDeduction.phaseOutThreshold': 'Infinity where a state has no phase-out',
  'itemizedDeduction.phaseOutRate': 'zero where a state has no phase-out',
  // MONEY BELOW $100. The class with the day's defect in it.
  'exemptionCredit.perFiler': "DOLLARS: Iowa's $40 and $80, Ohio's $20 and $40",
  'exemptionCredit.perDependent': 'DOLLARS: $40 and $20',
  'exemptionCredit.perSeniorFiler': "DOLLARS: Iowa's $20",
  'exemptionCredit.perBlindOrDisabledFiler': "DOLLARS: Iowa's $20",
  'householdCredit.base': "DOLLARS: New York's $75, $60, $50, $45 — 88 figures, the largest single instance in the package",
  'householdCredit.perAdditionalPerson': "DOLLARS: New York's $15, $10, $5",
  'seniorCredit.amount': "DOLLARS: Ohio's $50",
  'propertyTaxRelief.credit': "DOLLARS: New Jersey's $50",
  'retirementIncomeCredit.steps': "DOLLARS: Ohio's $25, $50, $80 credit steps, and zero",
  'personalTaxCredit.steps': 'zero at the bottom of the staircase',
  'steppedRecapture.tiers': "DOLLARS: Connecticut's $25, $50, $40, $90 per step",
  'phaseOutAddBack.staircase': "DOLLARS: Connecticut's $25, $50, $40 per step",
  'federalIncomeTaxDeduction.capSteps': 'zero in the top step',
  'ownEarnedIncomeCredit.byChildCount': "child COUNTS: California's 0, 1, 2, 3",
  'childCredit.amountByAge': 'AGES: the age bounds of a child credit',
  'steppedChildCredit.steps': 'AGES and small amounts',
  'youngChildCredit.maximumAge': 'an AGE',
  // AGES AND COUNTS. Not alarming, and counted so that the class is complete.
  'exemption.seniorAge': 'an AGE: 65 in eighteen state-years',
  'exemption.perFiler': 'zero where a state repealed its exemptions',
  'exemption.filersClaimed': 'a COUNT of people, 1 or 2',
  'exemption.perExemptionSteps': 'Infinity, zero, and a cent below a threshold',
  'exemption.blindAge': 'an AGE',
  'retirementIncomeSubtractions.*': 'AGES: Iowa 55, Louisiana 65, Michigan 80 and 59',
  'retirementSubtractionSchedule.schedule': 'zero and small multipliers',
  'retirementExclusion.minimumAge': 'an AGE',
  'pensionExclusion.minimumAge': 'an AGE',
  'retirementIncomeExclusion.minimumAge': 'an AGE',
  'retirementIncomeExclusion.olderAge': 'an AGE',
  'militaryRetirementExclusion.maximumAge': 'an AGE',
  'zeroTaxThreshold.elderlyAge': "an AGE: Iowa's 65",
  'agedCredit.age': 'an AGE',
  'seniorCredit.age': 'an AGE',
  'jointFilingCredit.minimumRate': 'a small rate step',
  'forgiveness.perDependent': 'small dollar steps',
  'taxpayerCredit.steps': 'zero and small amounts',
  'planTypeRetirement.minimumAge': 'an AGE',
  'stateRetirementDeduction.minimumAge': 'an AGE',
  'socialSecurityBenefitAdjustment.schedule': 'zero and small fractions',
  'reducedBaseRetirementCredit.minimumAge': 'an AGE',
  'exclusiveRetirementCredits.codes': 'CODES, not figures',
  'businessIncome.rate': 'zero where a state has none',
  'recapture.tiers': 'small per-step amounts',
  'surplusCredit.amount': 'small dollar amounts',
  'itemizerCredit.rate': 'a small rate',
  'capitalGainsSubtraction.minimumHoldingYears': 'a COUNT of years',
  'qualifiedDividendSubtraction.rate': 'a small rate',
  'businessIncomeDeduction.rate': 'a small rate',
  'separatelyRatedIncome.*': 'zero floors and Infinity ceilings',
  'limitedTable.*': 'small multipliers',
  'deduction.amounts': 'zero where a state gives none',
  // LARGE DECIMALS, and this is the class with the biggest surprise in it:
  // `mutantOf` refuses any decimal at or above 1, on the reading that such a
  // literal is "usually a multiplier or a printed figure". Three of them are
  // neither, and one is a load-bearing dollar amount.
  'rate.bands': "Ohio's BASE AMOUNTS -- $2,394.32 and $3,123.05, the constant charged whole on entering a band, plus its zero floor and Infinity ceiling. A real figure off a published schedule, and the audit cannot perturb it because it has cents",
  'earnedIncomeCredit.matchRate': "South Carolina's 1.25 -- a 125% match, the only match rate in the package above 1 -- and Wisconsin's 0 in the childless row. Two rate parameters outside (0,1) and therefore outside the audit",
  'earnedIncomeCredit.matchRateByChildCount': "child COUNTS used as keys: Wisconsin's 1, 2, 3",
  'earnedIncomeCredit.childlessMatchRate': "Maryland's 1, which is a 100% match",
  'earnedIncomeCredit.youngChildMaxAge': 'an AGE',
  'deduction.tiers': "Wisconsin's DERIVED deduction tiers, 57210.485021398 and 58826.60960532573 -- the one place in the package where a figure carries fifteen significant digits, because it is computed from the published brackets rather than read",
  'childCredit.phaseOut': "New York's 16.5 and Maryland's 50 -- a phase-out rate above 1 and a small integer",
  'youngChildCredit.phaseOut': "California's 21.71 per increment",
  'zeroTaxThreshold.limitedIncomeCredit': "Massachusetts's 1.75 ceiling multiple and its 10% rate",
  'zeroTaxThreshold.threshold': "Massachusetts's zero for married filing separately, which is how it bars that status",
  // AGES. Complete rather than alarming, and every one is a gate that decides
  // whether a whole rule applies.
  'ageDeduction.minimumAge': "an AGE: Virginia's 65",
  'ageDeduction.reductionRate': "Virginia's 1 -- a DOLLAR-FOR-DOLLAR withdrawal, which is the steepest taper in the package and is stored as the integer 1",
  'agedCredit.minimumAge': 'an AGE',
  'agedCredit.oneAged': "DOLLARS: Indiana's $50 and $40",
  'agedCredit.bothAged': "DOLLARS: Indiana's $90 and $80",
  'agedIncomeSubtraction.minimumAge': 'an AGE',
  'militaryRetirementSubtraction.ageThreshold': "an AGE: Maryland's 55",
  'planTypeRetirement.definedContributionAge': "an AGE: Alabama's 65",
  'retirementIncomeExclusionElection.minimumAge': "an AGE: Wisconsin's 67",
  'stateRetirementDeduction.socialSecurityMinimumAge': "an AGE: Missouri's 62",
  'standardDeductionAgedOrBlindAddition.age': 'an AGE: 65',
  'seniorCredit.minimumAge': 'an AGE',
  'seniorCredit.amountBothSpouses': "DOLLARS: Ohio's $50",
  'exemptionCredit.seniorAge': 'an AGE: 65',
  'exemptionCredit.phaseOut': "California's $6 per increment",
  'exemption.qualifyingChildMaxAge': 'AGES',
  'exemption.qualifyingChildStudentMaxAge': 'an AGE',
  'exemption.perDependent': 'zero where a state repealed its dependent exemption',
  'exemption.perDependentSteps': 'Infinity ceilings',
  'earnedIncomeCreditChildBonus.maxChildAge': 'AGES',
  'ownEarnedIncomeCredit.minimumAgeWithoutChildren': 'an AGE',
  'ownEarnedIncomeCredit.qualifyingChildMaxAge': 'an AGE',
  'youngChildCredit.ineligibleAge': 'an AGE',
  'steppedChildCredit.maxAge': 'an AGE',
  'childCredit.maxChildren': "a COUNT: Oregon's 5",
  'spouseTaxAdjustment.divisor': "Virginia's 2 -- a divisor, not a figure",
  'capitalGainsSubtraction.share': "Missouri's 1, which is a 100% exclusion",
  'deduction.reduction': "Alabama's $25 step and $88 floor",
  'deduction.roundReductionDownTo': "South Carolina's $10 rounding interval",
  'retirementExclusion.tiers': "New Jersey's tier shares and its Infinity ceiling",
  'retirementSubtractionSchedule.iraPhaseInShare': "Connecticut's 1, the final year of a four-year phase-in",
  'federalDeductionSubtractions.*': 'Infinity caps on the four OBBBA Schedule 1-A deductions',
  'federalIncomeTaxDeduction.rateSteps': 'Infinity ceilings and the zero top step',
  'jointFilingCredit.steps': 'Infinity ceilings',
  'federalConformity.conformedTo': 'not a figure',
};

const CLASSES = ['sentinel', 'smallInteger', 'zero', 'largeDecimal'];

const classOf = (v) => {
  if (!Number.isFinite(v)) return 'sentinel';
  if (mutantOf(String(v)) !== null) return 'mutated';
  // `mutantOf` reads TEXT, and a figure read off an object has none — so a
  // value like 12400 arrives as "12400" with no separator and in [1900,2100]?
  // No: the year window is checked before the magnitude one, and only a value
  // inside it can be mistaken. Everything else classifies by value alone.
  if (!Number.isInteger(v)) return v > 0 && v < 1 ? 'mutated' : 'largeDecimal';
  if (v === 0) return 'zero';
  if (v >= 100) return 'mutated';
  return 'smallInteger';
};

const walk = (node, path, out) => {
  if (node === null || node === undefined) return out;
  if (typeof node === 'number') {
    out.push([path, node]);
    return out;
  }
  if (Array.isArray(node)) {
    node.forEach((v, i) => walk(v, `${path}.${i}`, out));
    return out;
  }
  if (typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (path === '' && (k === 'citations' || k === 'provisionalFigures')) continue;
      walk(v, path === '' ? k : `${path}.${k}`, out);
    }
  }
  return out;
};

const counts = Object.fromEntries([...CLASSES, 'mutated'].map((c) => [c, 0]));
const byField = new Map();
const problems = [];
let total = 0;

for (const state of SUPPORTED_STATES) {
  for (const year of SUPPORTED_YEARS) {
    const def = getStateDefinition(state, year);
    if (!def) continue;
    for (const [path, v] of walk(def, '', [])) {
      total += 1;
      const c = classOf(v);
      if (counts[c] === undefined) {
        problems.push(
          `${state} ${year} ${path} = ${v} classifies as '${c}', which is not one of ` +
            `${CLASSES.join(', ')} or 'mutated'. mutantOf has changed and this tool's ` +
            "account of it is stale -- re-read enumerate.mjs's operator table.",
        );
        continue;
      }
      counts[c] += 1;
      if (c === 'mutated') continue;
      // The field a figure sits in, with array indices collapsed.
      const field = path.replace(/\.\d+/g, '.*').split('.').slice(0, 2).join('.');
      if (!byField.has(field)) byField.set(field, { n: 0, classes: new Set(), examples: new Set() });
      const rec = byField.get(field);
      rec.n += 1;
      rec.classes.add(c);
      if (rec.examples.size < 5) rec.examples.add(`${state}:${v}`);
    }
  }
}

for (const field of byField.keys()) {
  if (!(field in DECLARED)) {
    problems.push(
      `'${field}' holds ${byField.get(field).n} figure(s) the mutation audit CANNOT ` +
        `perturb (${[...byField.get(field).classes].join(', ')}; e.g. ` +
        `${[...byField.get(field).examples].join(' ')}) and is not declared in this tool.`,
    );
  }
}
const stale = Object.keys(DECLARED).filter((f) => !byField.has(f));

const blind = total - counts.mutated;
const money = counts.smallInteger + counts.zero + counts.largeDecimal;

if (!CHECK) {
  console.log('What the mutation score does not cover\n');
  console.log(`  numeric figures shipped        ${String(total).padStart(6)}`);
  console.log(`  the audit can perturb          ${String(counts.mutated).padStart(6)}  ${(100 * counts.mutated / total).toFixed(1)}%`);
  console.log(`  the audit CANNOT               ${String(blind).padStart(6)}  ${(100 * blind / total).toFixed(1)}%`);
  console.log(`    of which sentinels           ${String(counts.sentinel).padStart(6)}  Infinity or NaN; no document states them`);
  console.log(`    LEAVING REAL PARAMETERS      ${String(money).padStart(6)}  ${(100 * money / total).toFixed(1)}% of everything shipped\n`);
  for (const c of CLASSES) {
    console.log(`  ${c.padEnd(14)} ${String(counts[c]).padStart(5)}`);
  }
  console.log('\n  by the rule field they sit in:\n');
  for (const [field, rec] of [...byField.entries()].sort((a, b) => b[1].n - a[1].n)) {
    console.log(`  ${String(rec.n).padStart(4)}  ${field.padEnd(42)} ${DECLARED[field] ?? 'NOT DECLARED'}`);
  }
  if (stale.length > 0) {
    console.log(`\n  declared and no longer present (harmless, worth tidying): ${stale.join(', ')}`);
  }
}

if (problems.length > 0) {
  fail(
    'The mutation audit has a blind spot nobody declared:',
    '',
    ...problems.map((p) => `  - ${p}`),
    '',
    'A parameter the audit cannot perturb is not covered at 99.6%; it is not covered at',
    'all, and the only thing standing behind it is a hand-written test. Declare the field',
    "in tools/mutation/blind-spots.mjs with what its figures ARE -- an age and a dollar",
    'amount are both integers below 100 and only one of them is alarming -- and make sure',
    'something tests it. Day 63 shipped a $40 credit in this class and got it wrong.',
  );
}

console.log(
  `ok — ${total} figures shipped, ${counts.mutated} the audit can perturb and ${blind} it ` +
    `cannot (${counts.sentinel} of those sentinels, leaving ${money} real parameters), ` +
    `every one in a declared field and in one of ${CLASSES.length} known classes`,
);
