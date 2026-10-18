/**
 * Does every argument the OTHER NINE TOOLS advertise move the answer?
 *
 * Day 53 asked this of `state_income_tax` and found two Pennsylvania arguments
 * that were in the input schema, in `describe_state`'s Pennsylvania section and
 * in the server's own unknown-argument error message — and that the handler
 * never read. The reason that was findable is that `state_income_tax` has a
 * table to compare the handler against: `STATE_FIELDS` pairs every argument with
 * the states that read it, so a name in the table and not in `tools.ts` is a
 * question a grep can ask.
 *
 * **The other nine tools have no table.** They have input schemas, 205 advertised
 * leaves between them, and nothing that says whether the code underneath reads
 * any of them. `test/schema.test.js` has asked a neighbouring question since
 * Day 10 — *does `readHousehold` copy the key into its output object* — and that
 * is a claim about the COERCION LAYER and about one tool. It cannot see a field
 * the parser keeps and the engine ignores, it cannot see a field
 * `estimate_federal_tax` reads and `compare_tax_years` drops, and it does not
 * look at `paycheck_withholding`, which has its own sixteen-property reader.
 *
 *   THE RULE, from Day 53 and unchanged: A GATE THAT DECIDES WHETHER A FIELD IS
 *   ACCEPTED HAS NOT DECIDED WHETHER IT IS USED, AND THOSE ARE TWO DIFFERENT
 *   QUESTIONS WITH TWO DIFFERENT ANSWERS.
 *
 * So this file asks the answer-level question instead. For every advertised leaf
 * of every tool, find a WITNESS: a pair of calls differing in exactly that one
 * field whose results differ. A field with no witness is either dead or needs a
 * reason in writing.
 *
 * ## The two things that make this a test rather than a ritual
 *
 * **One field apart, exactly.** The first draft of this sweep witnessed all five
 * `qualifiedBusinesses[]` properties — and it was witnessing the ARRAY. Its
 * baseline had no business at all, so adding `[{ qualifiedBusinessIncome:
 * 150000, w2Wages: probe }]` changed the answer whatever the probe did, and
 * `w2Wages`, `name`, `unadjustedBasisOfQualifiedProperty` and both flags would
 * have been reported as live if the handler had dropped every one of them. The
 * baseline now carries the scaffolding and differs from the probe in the leaf
 * under test and nothing else. Day 53 called this *a baseline that is not the
 * caller's*; this is the same mistake one level in, where the baseline is not
 * the PROBE'S.
 *
 * **A refusal is a witness, but only when it names the field.** A required field
 * cannot be witnessed by leaving it out, because leaving it out is refused rather
 * than answered — which is the strongest evidence there is that something reads
 * it. But every missing required field refuses the call, so "the call failed"
 * would witness a dead field just as well. The refusal has to name the field,
 * and where it does not, two supplied values one field apart are the pair left.
 *
 * ## And the self-check, which is the part worth keeping
 *
 * A sweep that reports nothing is indistinguishable from a sweep that cannot
 * see. Day 53's version of this file was validated by running it against the
 * previous release and watching it name all eight findings; there is no previous
 * release to run against here, because nothing is wrong. So the validation is
 * mechanical instead: STRIP EACH ARGUMENT INSIDE THE HANDLER, one at a time, and
 * require the sweep to notice. 205 arguments, 205 deliberate defects, and a
 * single survivor would be a field this instrument is blind to — which is a
 * finding about the instrument and belongs in its own output rather than in a
 * journal.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';

import { TOOLS } from '../dist/index.js';

/**
 * Every leaf of a tool's input schema, as a dot path.
 *
 * An object recurses; an array of objects recurses with `[]` in the path; an
 * array of scalars is a leaf, because the thing a caller supplies is the list.
 */
function leaves(schema, prefix = '') {
  const out = [];
  if (!schema || typeof schema !== 'object') return out;
  if (schema.type === 'object' && schema.properties) {
    for (const [key, child] of Object.entries(schema.properties)) {
      const path = prefix ? `${prefix}.${key}` : key;
      const sub = leaves(child, path);
      if (sub.length === 0) out.push({ path, schema: child });
      else out.push(...sub);
    }
    return out;
  }
  if (schema.type === 'array' && schema.items) {
    const sub = leaves(schema.items, `${prefix}[]`);
    return sub.length > 0 ? sub : out;
  }
  return out;
}

/**
 * What a leaf's own container needs before the leaf can be probed at all.
 *
 * `qualifiedBusinesses[].w2Wages` means nothing without a business, and a
 * business means nothing without its required `qualifiedBusinessIncome`. The
 * BASELINE carries this and so does the probe, which is what leaves the two
 * exactly one field apart.
 */
const SCAFFOLD = {
  'qualifiedBusinesses[]': { qualifiedBusinessIncome: 150_000 },
};

/**
 * The values each argument is probed with.
 *
 * Day 53's five reasons a probe fails to see a rule are all reasons about the
 * VALUE: one above the rule's own limit, one of the wrong type, a maximal one
 * where the rule subtracts something the value contains. So every entry here is
 * a list and the sweep keeps trying until one of them moves the answer. The
 * named ones are the ones a type-derived default gets wrong:
 *
 * - `yearToDate*Wages` default to $1,000, and the Social Security wage base is
 *   where the two year-to-date figures stop being the same number. Below it they
 *   are, and a probe that never crosses it measures the cap switched off against
 *   the cap switched off.
 * - `age` has to reach 65 for § 63(f) and stay under it for the pair that
 *   isolates it.
 * - `qualifiedBusinesses[].w2Wages` has to be large enough for the § 199A(b)(2)
 *   wage limit to bind, and `unadjustedBasisOfQualifiedProperty` large enough for
 *   the 2.5% alternative to beat the 50%-of-wages one.
 * - `figure` is a dot PATH, and a path that resolves to a group rather than a
 *   figure is refused — so the probe has to be a real leaf of the ledger.
 */
const PROBE_VALUES = {
  age: [67, 25, 70],
  year: [2024, 2025, 2026],
  years: [
    [2025, 2026],
    [2024, 2026],
  ],
  filingStatus: [
    'single',
    'marriedFilingJointly',
    'marriedFilingSeparately',
    'headOfHousehold',
    'qualifyingSurvivingSpouse',
  ],
  allowances2019OrEarlier: [2, 4],
  payPeriodsRemaining: [1, 20],
  qualifyingChildren: [1, 3],
  otherDependents: [1, 2],
  eitcQualifyingChildren: [1, 3],
  additionalIncome: [1, 10_000],
  'qualifiedBusinesses[].name': ['Consulting LLC', 'Zebra'],
  'qualifiedBusinesses[].qualifiedBusinessIncome': [60_000, 400_000],
  'qualifiedBusinesses[].w2Wages': [10_000, 300_000],
  'qualifiedBusinesses[].unadjustedBasisOfQualifiedProperty': [50_000, 2_000_000],
  qualifiedBusinessNetLossCarryforward: [50_000, 200_000],
  reitPtpLossCarryforward: [10_000, 60_000],
  yearToDateSocialSecurityWages: [184_000, 250_000],
  yearToDateMedicareWages: [184_000, 250_000],
  withheldToDate: [1_000, 25_000],
  priorYearAdjustedGrossIncome: [100_000, 400_000],
  figure: ['standardDeduction.single', 'socialSecurityWageBase'],
};

function probeValues(path, schema) {
  if (PROBE_VALUES[path]) return PROBE_VALUES[path];
  const key = path.split('.').pop();
  if (PROBE_VALUES[key]) return PROBE_VALUES[key];
  if (schema.enum) return [...schema.enum];
  switch (schema.type) {
    case 'boolean':
      return [true, false];
    case 'integer':
      return [1, 3];
    case 'number':
      return [1_000, 25_000, 120_000];
    case 'string':
      return ['x'];
    case 'array':
      return [[1], [5, 12]];
    default:
      return [1];
  }
}

/**
 * The households the sweep probes from, each one here for a provision that no
 * other shape can reach.
 *
 * Every argument in this server's household schema is some provision's input,
 * and most provisions have a precondition — three children, a separate return, a
 * business, a benefit. A single baseline witnesses the income fields and nothing
 * else, which is how the first draft of this sweep reported six live arguments
 * as dead.
 */
const HOUSEHOLDS = [
  { label: 'single-worker', filingStatus: 'single', w2Wages: 90_000, age: 40 },
  {
    label: 'joint-retired',
    filingStatus: 'marriedFilingJointly',
    age: 70,
    spouseAge65OrOlder: true,
    socialSecurityBenefits: 40_000,
    otherOrdinaryIncome: 50_000,
  },
  {
    label: 'parent-eitc',
    filingStatus: 'headOfHousehold',
    w2Wages: 28_000,
    age: 34,
    qualifyingChildren: 2,
    eitcQualifyingChildren: 2,
  },
  // Three children and low earnings. § 24(d)(1)(B)(ii)'s alternative refundable
  // amount — the employee half of FICA — is consulted ONLY from the third child,
  // so `employeeSocialSecurityAndMedicareTax` is dead in every other household
  // and the field's own description says so.
  {
    label: 'three-children',
    filingStatus: 'marriedFilingJointly',
    w2Wages: 26_000,
    age: 35,
    qualifyingChildren: 3,
    eitcQualifyingChildren: 3,
  },
  // A separate return WITH a Social Security benefit: § 86(c)(1)(C) gives a
  // separate filer who did not live with their spouse the $25,000 base amount,
  // which is what `livedWithSpouse` decides.
  {
    label: 'separate-benefit',
    filingStatus: 'marriedFilingSeparately',
    age: 66,
    socialSecurityBenefits: 30_000,
    otherOrdinaryIncome: 20_000,
  },
  // A separate return with a child and earnings, for § 32(d) and
  // `separatedFromSpouse`.
  {
    label: 'separate-parent',
    filingStatus: 'marriedFilingSeparately',
    age: 33,
    w2Wages: 22_000,
    qualifyingChildren: 1,
    eitcQualifyingChildren: 1,
  },
  // The § 63(f) pair, WITH the spouse's age supplied.
  // `spouseHasNoGrossIncomeAndIsNotADependent` is the § 151(b) condition on
  // claiming the spouse's additional standard deduction, and a household that
  // does not say the spouse is 65 has no additional deduction for the condition
  // to unlock — so the answer does not move and the field looks dead. Day 53's
  // sixth reason: a co-input the household does not carry.
  {
    label: 'separate-senior-pair',
    filingStatus: 'marriedFilingSeparately',
    age: 68,
    spouseAge65OrOlder: true,
    otherOrdinaryIncome: 55_000,
  },
  {
    label: 'self-employed-high',
    filingStatus: 'single',
    selfEmploymentNetProfit: 300_000,
    age: 45,
    longTermCapitalGains: 50_000,
    itemizedDeductions: 40_000,
    stateAndLocalTaxesPaid: 30_000,
  },
  // A business, REIT dividends and PTP income, so that the two § 199A
  // carryforwards have something to be carried against. A carryforward with no
  // qualified income to reduce is correctly worth nothing.
  {
    label: 'qbi-business',
    filingStatus: 'single',
    age: 50,
    w2Wages: 20_000,
    qualifiedBusinesses: [{ qualifiedBusinessIncome: 120_000, w2Wages: 40_000 }],
    qualifiedReitDividends: 30_000,
    qualifiedPtpIncome: 10_000,
  },
  { label: 'tips-overtime', filingStatus: 'single', w2Wages: 60_000, qualifiedTips: 12_000, qualifiedOvertimeCompensation: 8_000, age: 30 },
];

const PAYCHECKS = [
  { label: 'weekly', filingStatus: 'single', payPeriod: 'weekly', wagesThisPeriod: 2_000 },
  { label: 'monthly-joint', filingStatus: 'marriedFilingJointly', payPeriod: 'monthly', wagesThisPeriod: 12_000 },
  // Year-to-date wages just under the Social Security wage base, so a probe can
  // cross it. Below the base the two year-to-date figures are the same number
  // and neither moves anything.
  {
    label: 'ytd-near-base',
    filingStatus: 'single',
    payPeriod: 'biweekly',
    wagesThisPeriod: 9_000,
    ficaWagesThisPeriod: 9_000,
    yearToDateSocialSecurityWages: 184_000,
    yearToDateMedicareWages: 184_000,
  },
  // A target and a plan. `payPeriodsRemaining` and `withheldToDate` are the
  // Step 4(c) worksheet's other two inputs and do nothing until the caller has
  // said what the year is supposed to total.
  {
    label: 'plan',
    filingStatus: 'single',
    payPeriod: 'monthly',
    wagesThisPeriod: 8_000,
    targetAnnualTax: 18_000,
    payPeriodsRemaining: 6,
    withheldToDate: 4_000,
  },
];

/** A figure, and a whole ledger, federal and state. */
const PROVENANCE = [
  { label: 'federal-figure', year: 2026, figure: 'standardDeduction.single' },
  { label: 'federal-ledger', year: 2026 },
  { label: 'state-figure', year: 2026, state: 'CA', figure: 'standardDeduction.single' },
  { label: 'state-ledger', year: 2026, state: 'CA' },
];

function baselinesFor(tool) {
  switch (tool.name) {
    case 'estimate_federal_tax':
      return HOUSEHOLDS;
    case 'compare_tax_years':
      return HOUSEHOLDS.map((household) => ({ ...household, years: [2025, 2026] }));
    case 'effective_marginal_rate':
      return HOUSEHOLDS;
    case 'quarterly_estimated_payments':
      // § 6654(d)(1)(C)(i) picks 100% or 110% of the prior year's tax by the
      // prior year's AGI, so `priorYearAdjustedGrossIncome` is dead without
      // `priorYearTotalTax` beside it.
      return [
        ...HOUSEHOLDS,
        {
          label: 'prior-year',
          filingStatus: 'single',
          age: 45,
          selfEmploymentNetProfit: 220_000,
          priorYearTotalTax: 40_000,
          priorYearAdjustedGrossIncome: 100_000,
        },
      ];
    case 'paycheck_withholding':
      return PAYCHECKS;
    case 'describe_state':
      // One state with notes, one whose conformity machinery differs by year,
      // and one that charges no income tax at all.
      return [{ label: 'CA', state: 'CA' }, { label: 'SC', state: 'SC' }, { label: 'TX', state: 'TX' }];
    case 'get_tax_parameters':
      return [{ label: 'default' }, { label: '2025', year: 2025 }];
    case 'list_supported_years':
      return [{ label: 'default' }];
    case 'figure_provenance':
      return PROVENANCE;
    default:
      return [];
  }
}

function setPath(args, path, value) {
  if (path.includes('[].')) {
    const [head, rest] = path.split('[].');
    const existing = Array.isArray(args[head]) && args[head].length > 0 ? args[head][0] : SCAFFOLD[`${head}[]`];
    args[head] = [{ ...existing, [rest]: value }];
    return;
  }
  const parts = path.split('.');
  let node = args;
  for (const part of parts.slice(0, -1)) {
    node[part] = { ...(node[part] ?? {}) };
    node = node[part];
  }
  node[parts[parts.length - 1]] = value;
}

function deletePath(args, path) {
  if (path.includes('[].')) {
    const [head, rest] = path.split('[].');
    if (Array.isArray(args[head])) {
      args[head] = args[head].map((element) => {
        const copy = { ...element };
        delete copy[rest];
        return copy;
      });
    }
    return;
  }
  const parts = path.split('.');
  let node = args;
  for (const part of parts.slice(0, -1)) {
    if (!node[part]) return;
    node[part] = { ...node[part] };
    node = node[part];
  }
  delete node[parts[parts.length - 1]];
}

/** The pair: identical arguments but for the one leaf under test. */
function pair(baseline, leaf, value) {
  const probe = structuredClone(baseline);
  delete probe.label;
  if (leaf.path.includes('[].')) {
    const [head] = leaf.path.split('[].');
    const scaffold = SCAFFOLD[`${head}[]`];
    if (scaffold && (!Array.isArray(probe[head]) || probe[head].length === 0)) probe[head] = [{ ...scaffold }];
  }
  setPath(probe, leaf.path, value);
  const without = structuredClone(probe);
  deletePath(without, leaf.path);
  return { without, probe };
}

function answer(run, args) {
  try {
    const result = run(args);
    return JSON.stringify({ text: result.text, structured: result.structured });
  } catch (error) {
    return `ERR:${String(error?.message ?? error)}`;
  }
}

/**
 * Every advertised leaf of one tool that no pair of calls could distinguish.
 *
 * `run` is taken rather than read off the tool so that the self-check below can
 * hand in a handler with one argument stripped.
 */
function unwitnessed(run, tool, onlyPath = null) {
  const found = [];
  for (const leaf of leaves(tool.inputSchema)) {
    if (onlyPath !== null && leaf.path !== onlyPath) continue;
    const values = probeValues(leaf.path, leaf.schema);
    const notes = new Set();
    let witness = null;
    search: for (const baseline of baselinesFor(tool)) {
      for (const value of values) {
        const { without, probe } = pair(baseline, leaf, value);
        const absent = answer(run, without);
        const supplied = answer(run, probe);
        const key = leaf.path.split('.').pop();
        if (absent.startsWith('ERR:')) {
          // A refusal that NAMES the field is a witness; one that does not is a
          // baseline this pair cannot use. See the header.
          if (!supplied.startsWith('ERR:') && absent.includes(key)) {
            witness = { baseline: baseline.label, value, via: 'refused when absent' };
            break search;
          }
          notes.add(`baseline ${baseline.label}: ${absent.slice(4, 80)}`);
          continue;
        }
        if (supplied.startsWith('ERR:')) {
          notes.add(`probe ${JSON.stringify(value)}: ${supplied.slice(4, 80)}`);
          continue;
        }
        if (supplied !== absent) {
          witness = { baseline: baseline.label, value };
          break search;
        }
      }
      // Where omission is refused without naming the field, two SUPPLIED values
      // one field apart are the only pair left.
      if (values.length > 1) {
        const first = answer(run, pair(baseline, leaf, values[0]).probe);
        for (const value of values.slice(1)) {
          const other = answer(run, pair(baseline, leaf, value).probe);
          if (first.startsWith('ERR:') || other.startsWith('ERR:')) continue;
          if (first !== other) {
            witness = { baseline: baseline.label, value, via: 'two values' };
            break search;
          }
        }
      }
    }
    if (witness === null) found.push({ path: leaf.path, type: leaf.schema.type, notes: [...notes].slice(0, 2) });
  }
  return found;
}

/** Every tool but `state_income_tax`, which has `state-field-witnesses.test.js`. */
const SWEPT = TOOLS.filter((tool) => tool.name !== 'state_income_tax');

test('every advertised argument of every other tool moves the answer', () => {
  const dead = [];
  for (const tool of SWEPT) {
    for (const row of unwitnessed((args) => tool.run(args), tool)) {
      dead.push(`${tool.name}.${row.path} (${row.type})${row.notes.length ? ` — ${row.notes.join(' ; ')}` : ''}`);
    }
  }
  assert.deepEqual(
    dead,
    [],
    `${dead.length} advertised argument(s) could not be witnessed by any pair of calls:\n  ${dead.join(
      '\n  ',
    )}\n\nEach one is either dropped by the handler — the Pennsylvania defect of Day 53 — or needs a ` +
      'household in HOUSEHOLDS, a probe value in PROBE_VALUES, or a co-input that lets the provision ' +
      'reading it do something. Decide which, in writing, and do not delete the row.',
  );
});

test('the sweep is a sweep: stripping any one argument is reported', () => {
  // Every advertised leaf, deliberately dropped inside the handler. A survivor
  // is an argument this file cannot see, which makes its silence about that
  // argument worth nothing.
  const blind = [];
  let checked = 0;
  for (const tool of SWEPT) {
    for (const leaf of leaves(tool.inputSchema)) {
      checked += 1;
      const stripped = (args) => {
        const copy = structuredClone(args);
        deletePath(copy, leaf.path);
        return tool.run(copy);
      };
      if (unwitnessed(stripped, tool, leaf.path).length === 0) blind.push(`${tool.name}.${leaf.path}`);
    }
  }
  assert.ok(checked >= 200, `expected the nine tools to advertise at least 200 leaves, found ${checked}`);
  assert.deepEqual(
    blind,
    [],
    `${blind.length} of ${checked} arguments survive being stripped from the handler, so this ` +
      `instrument is blind to them:\n  ${blind.join('\n  ')}`,
  );
});
