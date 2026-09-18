/**
 * The tool table.
 *
 * Six tools, chosen so that each one answers a question somebody actually asks
 * out loud, rather than exposing the engine's API surface one function at a
 * time. `compare_tax_years` and `effective_marginal_rate` are the two that a
 * single-year bracket lookup cannot answer at all, and they are the reason this
 * server exists rather than a table of rates in a system prompt.
 */
import {
  FILING_STATUSES,
  LATEST_YEAR,
  SUPPORTED_YEARS,
  computePaycheck,
  estimateFederalTax,
  getYearParameters,
  quarterlyEstimatedPayments,
  standardDeduction,
  withholdingPlan,
} from './engine/index.js';
import type {
  EstimateInput,
  EstimateResult,
  FilingStatus,
  PayPeriod,
  W4,
  YearParameters,
} from './engine/index.js';
import {
  FILING_STATUS_PROPERTY,
  ToolInputError,
  YEAR_PROPERTY,
  asRecord,
  householdArgs,
  householdSchema,
  readBoolean,
  readFilingStatus,
  readHousehold,
  readNumber,
  toolOptions,
} from './schema.js';
import type { JsonSchema } from './schema.js';
import { STATE_FIELDS, fieldsForState, stateFieldProperties } from './state-fields.js';
import {
  dollars,
  money,
  percent,
  renderEstimate,
  renderPaycheck,
  renderQuarterly,
  renderStateTax,
  statusLabel,
} from './format.js';
import {
  COUNTY_TAX_STATES,
  getStateDefinition,
  stateName,
  SUPPORTED_LOCALITIES as LOCALITY_CODES,
  SUPPORTED_STATES as STATE_CODES,
  SUPPORTED_YEARS as STATE_YEARS,
  stateIncomeTax,
} from './state-engine/index.js';
import type {
  FilingStatus as StateFilingStatus,
  LocalityCode,
  PersonRetirementIncome,
  RetirementIncomeSplit,
  StateCode,
} from './state-engine/index.js';

/**
 * Maryland's per-person retirement income.
 *
 * Read as an object rather than as six flat fields because the `tools/list`
 * payload is paid for on every session: one nested property costs a fraction of
 * `filerEmployerPlanPension`, `spouseEmployerPlanPension` and the four others,
 * and it is the shape the state actually uses — Worksheet 13A has a "You" column
 * and a "Spouse" column.
 */
function readPersonRetirement(
  source: Record<string, unknown>,
  key: string,
): PersonRetirementIncome | undefined {
  const raw = source[key];
  if (raw === undefined || raw === null) return undefined;
  const person = asRecord(raw, `retirement.${key}`);
  const pension = readNumber(person, 'employerPlanPension');
  const benefits = readNumber(person, 'socialSecurityBenefits');
  const military = readNumber(person, 'militaryRetirement');
  const ira = readNumber(person, 'iraDistributions');
  // Signed: Georgia's worksheet floors the non-earned sources as a block, so a
  // net loss here is a zero rather than an error.
  const investment = readNumber(person, 'investmentIncome', { allowNegative: true });
  const earned = readNumber(person, 'earnedIncome');
  const disabled = readBoolean(person, 'totallyDisabled');
  const govPension = readNumber(person, 'governmentPension');
  const monthsBefore = readNumber(person, 'serviceMonthsBefore1998');
  const monthsAfter = readNumber(person, 'serviceMonthsAfter1997');
  return {
    ...(pension !== undefined ? { employerPlanPension: pension } : {}),
    ...(benefits !== undefined ? { socialSecurityBenefits: benefits } : {}),
    ...(military !== undefined ? { militaryRetirement: military } : {}),
    ...(ira !== undefined ? { iraDistributions: ira } : {}),
    ...(investment !== undefined ? { investmentIncome: investment } : {}),
    ...(earned !== undefined ? { earnedIncome: earned } : {}),
    ...(disabled !== undefined ? { totallyDisabled: disabled } : {}),
    ...(govPension !== undefined ? { governmentPension: govPension } : {}),
    ...(monthsBefore !== undefined ? { serviceMonthsBefore1998: monthsBefore } : {}),
    ...(monthsAfter !== undefined ? { serviceMonthsAfter1997: monthsAfter } : {}),
  };
}

function readRetirementSplit(
  source: Record<string, unknown>,
): RetirementIncomeSplit | undefined {
  const raw = source['retirement'];
  if (raw === undefined || raw === null) return undefined;
  const split = asRecord(raw, 'retirement');
  const filer = readPersonRetirement(split, 'filer');
  const spouse = readPersonRetirement(split, 'spouse');
  if (filer === undefined && spouse === undefined) {
    throw new ToolInputError(
      'retirement must contain a filer and/or a spouse object. Maryland\'s pension exclusion is ' +
        'per person, so there is no household-level figure to fall back on: pass ' +
        'retirement: { filer: { employerPlanPension: 60000, socialSecurityBenefits: 30000 } }. ' +
        'Omitting retirement entirely is allowed and puts retirementIncome on one spouse.',
    );
  }
  return {
    ...(filer !== undefined ? { filer } : {}),
    ...(spouse !== undefined ? { spouse } : {}),
  };
}

export interface ToolResult {
  /** What the model reads. */
  text: string;
  /** What a program reads. Becomes `structuredContent`. */
  structured: Record<string, unknown>;
}

export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  annotations: Record<string, unknown>;
  run(args: unknown): ToolResult;
}

/** Everything is a pure computation over its arguments — nothing here has effects. */
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

function citations(params: YearParameters): { title: string; url: string }[] {
  return params.sources.map((source) => ({ title: source.title, url: source.url }));
}

/**
 * The headline citations, and a pointer to the rest.
 *
 * A year carries around 25 sources — every statute, form and Revenue Procedure
 * behind any figure the engine can produce. Appending all of them to every tool
 * result costs about 3 KB of the model's context per call and buries the answer
 * it is attached to. The first few entries are the year-level releases, which
 * are the ones a reader wants to see named; the complete list is always in
 * `structuredContent.sources`, so nothing is lost for a program that wants to
 * verify a figure.
 */
const HEADLINE_CITATIONS = 3;

function citationText(years: readonly number[], limit = HEADLINE_CITATIONS): string {
  const seen = new Map<string, string>();
  for (const year of years) {
    for (const source of getYearParameters(year).sources) seen.set(source.title, source.url);
  }
  const all = [...seen];
  const shown = limit === Infinity ? all : all.slice(0, limit);
  const remaining = all.length - shown.length;
  const lines = ['', 'Sources:', ...shown.map(([title, url]) => `- ${title} — ${url}`)];
  if (remaining > 0) {
    lines.push(
      `- and ${remaining} more statutes, forms and Revenue Procedures — the full list is in ` +
        `structuredContent.sources, or call get_tax_parameters.`,
    );
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// estimate_federal_tax
// ---------------------------------------------------------------------------

const estimateTool: ToolDefinition = {
  name: 'estimate_federal_tax',
  title: 'Estimate US federal tax',
  description:
    'Compute a complete US federal tax picture for one household and one tax year: income tax, ' +
    'self-employment tax, FICA, long-term capital gains, the net investment income tax and the ' +
    'Additional Medicare Tax, the standard-versus-itemized decision with the SALT cap, the Section ' +
    '199A deduction, the four OBBBA Schedule 1-A deductions, the child tax credit and the earned ' +
    'income credit, and the resulting balance due or refund. ' +
    'Use this for "what do I owe", "what is my refund", "how much tax on $X". ' +
    'Supported years: ' +
    SUPPORTED_YEARS.join(', ') +
    '. Non-refundable credits are kept separate from refundable ones, and from self-employment tax, ' +
    'which no credit can reduce.',
  inputSchema: householdSchema(),
  annotations: { ...READ_ONLY, title: 'Estimate US federal tax' },
  run(args) {
    const input = readHousehold(args);
    const estimate = estimateFederalTax(input);
    const params = getYearParameters(estimate.year);
    return {
      text: renderEstimate(estimate) + citationText([estimate.year]),
      structured: { estimate: estimate as unknown as Record<string, unknown>, sources: citations(params) },
    };
  },
};

// ---------------------------------------------------------------------------
// compare_tax_years
// ---------------------------------------------------------------------------

function deltaLine(label: string, from: number, to: number): string {
  const change = to - from;
  const arrow = change === 0 ? '  =' : change > 0 ? '  +' : '  -';
  return `${label.padEnd(30)}${money(from).padStart(15)}${money(to).padStart(15)}${arrow}${money(
    Math.abs(change),
  ).padStart(14)}`;
}

const compareTool: ToolDefinition = {
  name: 'compare_tax_years',
  title: 'Compare a household across tax years',
  description:
    'Run the SAME household through two or more tax years and report what changed and why. ' +
    'Answers "how does my tax change from 2025 to 2026", "what did the One Big Beautiful Bill Act do ' +
    'to my return", "should I have amended 2024". ' +
    'This is the question a single-year bracket table cannot answer: 2025 was changed retroactively by ' +
    'OBBBA in July 2025 after the IRS had already published that year, so a 2025 answer built by ' +
    'copying 2024 forward or 2026 backward is wrong in both directions. Defaults to every supported ' +
    'year (' +
    SUPPORTED_YEARS.join(', ') +
    '). The household fields below are listed WITHOUT descriptions on purpose: they are the same fields estimate_federal_tax takes, and its schema documents every one of them in full. Read them there. Duplicating thirty-seven descriptions here cost more context than the whole of that tool.',
  inputSchema: householdSchema(
    {
        years: {
        type: 'array',
        items: { type: 'integer', enum: [...SUPPORTED_YEARS] },
        minItems: 2,
        description: `Tax years to compare, ascending. Defaults to all of ${SUPPORTED_YEARS.join(', ')}.`,
      },
    },
    { verbosity: 'reference', includeYear: false },
  ),
  annotations: { ...READ_ONLY, title: 'Compare a household across tax years' },
  run(args) {
    const options = toolOptions(args);
    const household = householdArgs(args);
    if ('year' in household) {
      throw new ToolInputError('compare_tax_years takes `years` (an array), not `year`.');
    }

    let years = [...SUPPORTED_YEARS];
    if (options['years'] !== undefined) {
      const raw = options['years'];
      if (!Array.isArray(raw) || raw.length < 2) {
        throw new ToolInputError('`years` must be an array of at least two supported tax years.');
      }
      years = raw.map((entry, index) => {
        const value = readNumber({ y: entry }, 'y', { integer: true });
        if (value === undefined || !SUPPORTED_YEARS.includes(value)) {
          throw new ToolInputError(
            `years[${index}] is ${JSON.stringify(entry)}; supported years are ${SUPPORTED_YEARS.join(', ')}.`,
          );
        }
        return value;
      });
      years = [...new Set(years)].sort((a, b) => a - b);
      if (years.length < 2) throw new ToolInputError('`years` must name at least two distinct years.');
    }
    const unknownOptions = Object.keys(options).filter((key) => key !== 'years');
    if (unknownOptions.length > 0) {
      throw new ToolInputError(`Unknown argument(s): ${unknownOptions.join(', ')}.`);
    }

    const estimates = years.map((year) =>
      estimateFederalTax(readHousehold({ ...household, year }) as EstimateInput),
    );

    const rows: string[] = [];
    rows.push(`${statusLabel(estimates[0]!.filingStatus)}, the same inputs in each year.`);
    rows.push('');
    rows.push(`${''.padEnd(30)}${years.map((y) => String(y).padStart(15)).join('')}`);
    const metrics: [string, (e: EstimateResult) => number][] = [
      ['Adjusted gross income', (e) => e.adjustedGrossIncome],
      ['Deduction', (e) => e.deduction],
      ['Taxable income', (e) => e.taxableIncome],
      ['Income tax before credits', (e) => e.incomeTaxBeforeCredits],
      ['Self-employment tax', (e) => e.selfEmployment.total],
      ['Non-refundable credits', (e) => e.credits.totalNonRefundable],
      ['Refundable credits', (e) => e.credits.totalRefundable],
      ['TOTAL TAX', (e) => e.totalTax],
      ['Balance due (+) / refund (-)', (e) => e.balanceDue],
    ];
    for (const [label, get] of metrics) {
      const values = estimates.map((e) => money(get(e)).padStart(15)).join('');
      rows.push(`${label.padEnd(30)}${values}`);
    }

    rows.push('');
    rows.push('Year over year:');
    rows.push(`${''.padEnd(30)}${'from'.padStart(15)}${'to'.padStart(15)}${'change'.padStart(17)}`);
    for (let i = 1; i < estimates.length; i += 1) {
      const from = estimates[i - 1]!;
      const to = estimates[i]!;
      rows.push(`${from.year} -> ${to.year}`);
      rows.push(deltaLine('  Total tax', from.totalTax, to.totalTax));
      rows.push(deltaLine('  Balance due', from.balanceDue, to.balanceDue));
    }

    const changes = describeYearChanges(estimates);
    if (changes.length > 0) {
      rows.push('');
      rows.push('What drove the difference:');
      for (const change of changes) rows.push(`- ${change}`);
    }

    return {
      text: rows.join('\n') + citationText(years),
      structured: {
        years,
        estimates: estimates as unknown as Record<string, unknown>[],
        totalTaxByYear: Object.fromEntries(estimates.map((e) => [e.year, e.totalTax])),
        balanceDueByYear: Object.fromEntries(estimates.map((e) => [e.year, e.balanceDue])),
        sources: [...new Set(years.flatMap((y) => citations(getYearParameters(y))))],
      },
    };
  },
};

/**
 * Attribute the year-over-year movement to the provisions that actually moved.
 *
 * Only reports a driver when the underlying figure genuinely changed for this
 * household, so a household with no children never reads about the child tax
 * credit.
 */
function describeYearChanges(estimates: readonly EstimateResult[]): string[] {
  const notes: string[] = [];
  const first = estimates[0];
  const last = estimates[estimates.length - 1];
  if (!first || !last || first === last) return notes;

  if (first.deduction !== last.deduction) {
    const bothStandard = first.deductionKind === 'standard' && last.deductionKind === 'standard';
    notes.push(
      `The deduction moved from ${money(first.deduction)} to ${money(last.deduction)}.` +
        (bothStandard && first.year <= 2025 && last.year >= 2025
          ? ' OBBBA raised the 2025 standard deduction retroactively in July 2025, above the figure' +
            ' Rev. Proc. 2024-40 had already published for that year ($15,000 / $30,000 / $22,500).'
          : ''),
    );
  }

  const schedFirst = first.additionalDeductions.total;
  const schedLast = last.additionalDeductions.total;
  if (schedFirst !== schedLast) {
    notes.push(
      `Schedule 1-A (tips, overtime, the senior deduction, vehicle loan interest) is worth ` +
        `${money(schedFirst)} in ${first.year} and ${money(schedLast)} in ${last.year}. These four ` +
        `deductions exist only for 2025 through 2028 and did not exist in 2024 at all.`,
    );
  }

  // Only a driver if itemizing actually won somewhere. A household whose SALT
  // cap tripled but who takes the standard deduction in every year did not have
  // its tax changed by the cap at all, and saying so would be noise dressed up
  // as an explanation.
  const saltMattered = estimates.some((e) => e.deductionKind === 'itemized');
  if (
    saltMattered &&
    first.stateAndLocalTax &&
    last.stateAndLocalTax &&
    first.stateAndLocalTax.cap !== last.stateAndLocalTax.cap
  ) {
    notes.push(
      `The SALT cap moved from ${money(first.stateAndLocalTax.cap)} to ` +
        `${money(last.stateAndLocalTax.cap)}. OBBBA raised it from $10,000 to $40,000 for 2025 and ` +
        `indexes it upward through 2029, with a phase-down for high incomes; it reverts to $10,000 after.`,
    );
  }

  const ctcFirst = first.credits.childTaxCredit;
  const ctcLast = last.credits.childTaxCredit;
  if (ctcFirst && ctcLast && ctcFirst.creditAfterPhaseOut !== ctcLast.creditAfterPhaseOut) {
    notes.push(
      `The child tax credit moved from ${money(ctcFirst.creditAfterPhaseOut)} to ` +
        `${money(ctcLast.creditAfterPhaseOut)}. OBBBA raised it from $2,000 to $2,200 per child from ` +
        `2025 and made it permanent.`,
    );
  }

  const eitcFirst = first.credits.earnedIncomeCredit;
  const eitcLast = last.credits.earnedIncomeCredit;
  if (eitcFirst && eitcLast && eitcFirst.credit !== eitcLast.credit) {
    notes.push(
      `The earned income credit moved from ${money(eitcFirst.credit)} to ${money(eitcLast.credit)}, ` +
        `which is ordinary § 1(f) inflation indexing rather than a change of law.`,
    );
  }

  const qbiFirst = first.qualifiedBusinessIncomeDeduction;
  const qbiLast = last.qualifiedBusinessIncomeDeduction;
  if (qbiFirst !== qbiLast) {
    notes.push(
      `The Section 199A deduction moved from ${money(qbiFirst)} to ${money(qbiLast)}. OBBBA § 70105 ` +
        `widened the phase-in range from $50,000/$100,000 to $75,000/$150,000 and added a $400 minimum ` +
        `deduction — but only for years beginning after 31 December 2025, so neither applies to 2025.`,
    );
  }

  return notes;
}

// ---------------------------------------------------------------------------
// effective_marginal_rate
// ---------------------------------------------------------------------------

const MARGINAL_INCOME_TYPES = {
  wages: 'w2Wages',
  selfEmployment: 'selfEmploymentNetProfit',
  otherOrdinary: 'otherOrdinaryIncome',
  longTermCapitalGains: 'longTermCapitalGains',
} as const;

type MarginalIncomeType = keyof typeof MARGINAL_INCOME_TYPES;

const marginalTool: ToolDefinition = {
  name: 'effective_marginal_rate',
  title: 'True marginal rate on the next dollar',
  description:
    'Measure what another dollar of income ACTUALLY costs this household, by running the full ' +
    'estimate twice and differencing it. This is usually not the tax bracket. Credit phase-outs, the ' +
    'SALT phase-down, self-employment tax, the Additional Medicare Tax and the net investment income ' +
    'tax all stack on top of it: a two-child household at $30,000 is in the 10% bracket and faces ' +
    '21.06%, all of it earned-income-credit withdrawal. ' +
    'Use this for "should I take the raise", "what will this bonus cost me", "am I better off ' +
    'converting to a Roth", "what is my real marginal rate". Reports the ordinary bracket alongside ' +
    'the real number so the difference is visible. The household fields below are listed WITHOUT descriptions on purpose: they are the same fields estimate_federal_tax takes, and its schema documents every one of them in full. Read them there. Duplicating thirty-seven descriptions here cost more context than the whole of that tool.',
  inputSchema: householdSchema(
    {
      additionalIncome: {
        type: 'number',
        exclusiveMinimum: 0,
        description:
        'The raise, bonus or extra dollar of income to measure. Defaults to 1000. Note that some ' +
        'phase-outs are step functions rather than slopes — the § 24 child tax credit withdraws $50 ' +
        'per whole $1,000 — so a $1 probe and a $1,000 probe legitimately give different answers, and ' +
          'the $1,000 one is the one that describes a raise.',
      },
      incomeType: {
        type: 'string',
        enum: Object.keys(MARGINAL_INCOME_TYPES),
        description:
        'Where the extra income lands. "wages" adds W-2 wages, "selfEmployment" adds Schedule C ' +
        'profit (and so carries self-employment tax), "otherOrdinary" adds interest or distributions ' +
        'with no payroll tax, "longTermCapitalGains" adds preferential-rate income. Defaults to ' +
        'whichever income the household already has the most of.',
      },
    },
    { verbosity: 'reference' },
  ),
  annotations: { ...READ_ONLY, title: 'True marginal rate on the next dollar' },
  run(args) {
    const options = toolOptions(args);
    const household = householdArgs(args);

    const delta = readNumber(options, 'additionalIncome') ?? 1000;
    if (delta <= 0) throw new ToolInputError('additionalIncome must be greater than zero.');

    const base = estimateFederalTax(readHousehold(household));

    let incomeType: MarginalIncomeType;
    const requested = options['incomeType'];
    if (requested === undefined || requested === null) {
      incomeType = defaultIncomeType(base);
    } else if (typeof requested === 'string' && requested in MARGINAL_INCOME_TYPES) {
      incomeType = requested as MarginalIncomeType;
    } else {
      throw new ToolInputError(
        `incomeType must be one of: ${Object.keys(MARGINAL_INCOME_TYPES).join(', ')}.`,
      );
    }

    const unknownOptions = Object.keys(options).filter(
      (key) => key !== 'additionalIncome' && key !== 'incomeType',
    );
    if (unknownOptions.length > 0) {
      throw new ToolInputError(`Unknown argument(s): ${unknownOptions.join(', ')}.`);
    }

    const field = MARGINAL_INCOME_TYPES[incomeType];
    const bumped = estimateFederalTax(
      readHousehold({
        ...household,
        [field]: (readNumber(household, field) ?? 0) + delta,
      }),
    );

    // `balanceDue` is `totalTax - withholding - refundable credits`, and
    // withholding does not move, so its change is exactly the cost of the extra
    // income — including a refundable credit that is withdrawn, which is a real
    // cost that never appears in "total tax".
    const cost = bumped.balanceDue - base.balanceDue;
    const rate = cost / delta;

    // These components sum to `cost` exactly, and `test/tools.test.js` asserts
    // it. That constraint is what forces the credit terms to be measured on the
    // benefit actually received — non-refundable plus refundable — rather than
    // on the credit before the tax-liability limit. A credit that grows to
    // absorb the new tax is worth exactly as much as the tax it absorbs, and
    // measuring it on `creditAfterPhaseOut` misses that entirely.
    const ctcBenefit = (e: EstimateResult): number =>
      (e.credits.childTaxCredit?.nonRefundableCredit ?? 0) +
      (e.credits.childTaxCredit?.refundableCredit ?? 0);
    const eitcBenefit = (e: EstimateResult): number => e.credits.earnedIncomeCredit?.credit ?? 0;

    const components: [string, number][] = [
      ['Ordinary income tax', bumped.ordinaryIncomeTax - base.ordinaryIncomeTax],
      ['Capital gains tax', bumped.capitalGainsTax - base.capitalGainsTax],
      ['Self-employment tax', bumped.selfEmployment.total - base.selfEmployment.total],
      ['Additional Medicare tax', bumped.additionalMedicareTax - base.additionalMedicareTax],
      ['Net investment income tax', bumped.netInvestmentIncomeTax - base.netInvestmentIncomeTax],
      ['Child tax credit withdrawn', ctcBenefit(base) - ctcBenefit(bumped)],
      ['Earned income credit withdrawn', eitcBenefit(base) - eitcBenefit(bumped)],
    ];

    const rows: string[] = [];
    rows.push(
      `Tax year ${base.year}, ${statusLabel(base.filingStatus)}, adding ${money(delta)} of ` +
        `${incomeType === 'selfEmployment' ? 'self-employment profit' : incomeType === 'wages' ? 'W-2 wages' : incomeType === 'longTermCapitalGains' ? 'long-term capital gain' : 'other ordinary income'}.`,
    );
    rows.push('');
    rows.push(`${'Ordinary tax bracket'.padEnd(38)}${percent(base.marginalRate, 0).padStart(12)}`);
    rows.push(`${'TRUE MARGINAL RATE'.padEnd(38)}${percent(rate).padStart(12)}`);
    rows.push(`${'Cost of the extra income'.padEnd(38)}${money(cost).padStart(12)}`);
    rows.push(`${'You keep'.padEnd(38)}${money(delta - cost).padStart(12)}`);
    rows.push('');
    rows.push('Where it goes:');
    for (const [label, amount] of components) {
      if (Math.abs(amount) >= 0.005) {
        rows.push(`${`  ${label}`.padEnd(38)}${money(amount).padStart(12)}`);
      }
    }

    const saltLost =
      (bumped.stateAndLocalTax?.phaseDownReduction ?? 0) -
      (base.stateAndLocalTax?.phaseDownReduction ?? 0);
    if (saltLost > 0 && bumped.deductionKind === 'itemized') {
      rows.push('');
      rows.push(
        `The § 164(b)(6) phase-down also took ${money(saltLost)} of SALT deduction away over this ` +
          `range, which is why the ordinary income tax line above is larger than the bracket alone ` +
          `would give. That effect ends once the cap reaches its floor, so the marginal rate here goes ` +
          `up and then back down.`,
      );
    }

    rows.push('');
    if (Math.abs(rate - base.marginalRate) < 0.0005) {
      rows.push(
        'The true rate matches the bracket here: no phase-out or payroll tax is active at this income.',
      );
    } else if (rate > base.marginalRate) {
      rows.push(
        `The true rate is ${percent(rate - base.marginalRate)} above the ${percent(
          base.marginalRate,
          0,
        )} bracket. Quoting the bracket alone understates the cost of this income by ` +
          `${money(cost - delta * base.marginalRate)}.`,
      );
    } else {
      rows.push(
        `The true rate is BELOW the ${percent(base.marginalRate, 0)} bracket, because the extra income ` +
          `is taxed at preferential rates or absorbed by a credit that is still phasing in.`,
      );
    }

    return {
      text: rows.join('\n') + citationText([base.year]),
      structured: {
        year: base.year,
        filingStatus: base.filingStatus,
        incomeType,
        additionalIncome: delta,
        ordinaryBracket: base.marginalRate,
        effectiveMarginalRate: rate,
        cost,
        retained: delta - cost,
        components: Object.fromEntries(components.filter(([, v]) => Math.abs(v) >= 0.005)),
        baseline: base as unknown as Record<string, unknown>,
        withAdditionalIncome: bumped as unknown as Record<string, unknown>,
        sources: citations(getYearParameters(base.year)),
      },
    };
  },
};

function defaultIncomeType(estimate: EstimateResult): MarginalIncomeType {
  const se = estimate.selfEmployment.netEarnings;
  const wages = estimate.grossIncome - se - estimate.capitalGainsTaxableIncome;
  if (se > wages) return 'selfEmployment';
  return 'wages';
}

// ---------------------------------------------------------------------------
// quarterly_estimated_payments
// ---------------------------------------------------------------------------

const quarterlyTool: ToolDefinition = {
  name: 'quarterly_estimated_payments',
  title: 'Quarterly estimated tax payments',
  description:
    'Turn a household into an IRC § 6654 quarterly estimated payment plan: the required annual ' +
    'payment, which safe harbor produced it, and the four installments with their statutory due ' +
    'dates. Answers "how much should I send the IRS each quarter", "what are my 1099 estimated ' +
    'taxes", "how do I avoid an underpayment penalty". Supplying priorYearTotalTax usually lowers ' +
    'the required payment, because the safe harbor is the LESSER of 90% of this year and 100% (or ' +
    '110% for higher earners) of last year. The household fields below are listed WITHOUT descriptions on purpose: they are the same fields estimate_federal_tax takes, and its schema documents every one of them in full. Read them there. Duplicating thirty-seven descriptions here cost more context than the whole of that tool.',
  inputSchema: householdSchema(
    {
      priorYearTotalTax: {
        type: 'number',
        description:
          "Total tax from last year's return (Form 1040 line 24). Unlocks the prior-year safe harbor, " +
          'which is usually the cheaper of the two and is the only one that is certain in advance.',
      },
      priorYearAdjustedGrossIncome: {
        type: 'number',
        description:
          "Last year's AGI. Above $150,000 ($75,000 filing separately) the prior-year safe harbor is " +
          '110% rather than 100%.',
      },
    },
    { verbosity: 'reference' },
  ),
  annotations: { ...READ_ONLY, title: 'Quarterly estimated tax payments' },
  run(args) {
    const options = toolOptions(args);
    const household = householdArgs(args);
    const unknownOptions = Object.keys(options).filter(
      (key) => key !== 'priorYearTotalTax' && key !== 'priorYearAdjustedGrossIncome',
    );
    if (unknownOptions.length > 0) {
      throw new ToolInputError(`Unknown argument(s): ${unknownOptions.join(', ')}.`);
    }

    const estimate = estimateFederalTax(readHousehold(household));
    const planOptions: { priorYearTotalTax?: number; priorYearAdjustedGrossIncome?: number } = {};
    const priorTax = readNumber(options, 'priorYearTotalTax');
    if (priorTax !== undefined) planOptions.priorYearTotalTax = priorTax;
    const priorAgi = readNumber(options, 'priorYearAdjustedGrossIncome');
    if (priorAgi !== undefined) planOptions.priorYearAdjustedGrossIncome = priorAgi;

    const plan = quarterlyEstimatedPayments(estimate, planOptions);

    return {
      text: renderQuarterly(plan, estimate) + citationText([estimate.year]),
      structured: {
        plan: plan as unknown as Record<string, unknown>,
        estimate: estimate as unknown as Record<string, unknown>,
        sources: citations(getYearParameters(estimate.year)),
      },
    };
  },
};

// ---------------------------------------------------------------------------
// get_tax_parameters
// ---------------------------------------------------------------------------

/** Narrow every status-keyed record in a parameter set down to one status. */
function forStatus(value: unknown, status: FilingStatus): unknown {
  if (Array.isArray(value)) return value;
  if (value === null || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  const isStatusKeyed =
    keys.length > 0 && keys.every((key) => (FILING_STATUSES as readonly string[]).includes(key));
  if (isStatusKeyed) return record[status];
  return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, forStatus(item, status)]));
}

const parametersTool: ToolDefinition = {
  name: 'get_tax_parameters',
  title: 'Published tax parameters for a year',
  description:
    'Return the published parameters for a tax year: the ordinary and long-term capital gains ' +
    'brackets, the standard deduction and its age/blindness additions, the payroll bases and rates, ' +
    'the Additional Medicare, NIIT and Section 199A thresholds, the SALT cap, the Schedule 1-A caps ' +
    'and phase-outs, and the child tax credit and EITC tables — each cited to its Revenue Procedure. ' +
    'Use this when asked "what are the 2026 brackets", rather than answering from memory: two of ' +
    'these tables have IRS errata against them.',
  inputSchema: {
    type: 'object',
    properties: {
      year: YEAR_PROPERTY,
      filingStatus: {
        ...FILING_STATUS_PROPERTY,
        description:
          'Narrow every status-keyed table to one filing status, which makes the result about five ' +
          'times smaller. Omit to get all five.',
      },
      includeFullParameters: {
        type: 'boolean',
        description:
          'Include the complete parameter object in structuredContent. Defaults to true. Set false ' +
          'for just the rendered summary and the citations.',
      },
    },
    additionalProperties: false,
  },
  annotations: { ...READ_ONLY, title: 'Published tax parameters for a year' },
  run(args) {
    const source = (args ?? {}) as Record<string, unknown>;
    const known = ['year', 'filingStatus', 'includeFullParameters'];
    const unknownOptions = Object.keys(source).filter((key) => !known.includes(key));
    if (unknownOptions.length > 0) {
      throw new ToolInputError(`Unknown argument(s): ${unknownOptions.join(', ')}. Accepted: ${known.join(', ')}.`);
    }

    const year = readNumber(source, 'year', { integer: true }) ?? LATEST_YEAR;
    const params = getYearParameters(year);
    const includeFull = readBoolean(source, 'includeFullParameters') ?? true;

    let status: FilingStatus | null = null;
    if (source['filingStatus'] !== undefined && source['filingStatus'] !== null) {
      const raw = String(source['filingStatus']);
      if (!(FILING_STATUSES as readonly string[]).includes(raw)) {
        throw new ToolInputError(
          `Unknown filingStatus ${JSON.stringify(raw)}. Expected one of: ${FILING_STATUSES.join(', ')}.`,
        );
      }
      status = raw as FilingStatus;
    }

    const statuses = status ? [status] : [...FILING_STATUSES];
    const rows: string[] = [`Published federal tax parameters for ${year}.`];

    for (const each of statuses) {
      rows.push('');
      rows.push(`## ${statusLabel(each)}`);
      rows.push(`Standard deduction: ${dollars(standardDeduction({ filingStatus: each, year }))}`);
      rows.push(
        `Additional standard deduction per qualifying condition (65+, blind): ${dollars(
          params.additionalStandardDeduction[each],
        )}`,
      );
      rows.push('Ordinary rate brackets:');
      let lower = 0;
      for (const bracket of params.ordinaryBrackets[each]) {
        rows.push(
          `  ${percent(bracket.rate, 0).padStart(4)}  ${dollars(lower).padStart(12)} ${
            Number.isFinite(bracket.upTo) ? `to ${dollars(bracket.upTo)}` : 'and above'
          }`,
        );
        lower = bracket.upTo;
      }
      rows.push('Long-term capital gains brackets:');
      lower = 0;
      for (const bracket of params.longTermCapitalGains[each]) {
        rows.push(
          `  ${percent(bracket.rate, 0).padStart(4)}  ${dollars(lower).padStart(12)} ${
            Number.isFinite(bracket.upTo) ? `to ${dollars(bracket.upTo)}` : 'and above'
          }`,
        );
        lower = bracket.upTo;
      }
      rows.push(
        `NIIT threshold: ${dollars(params.niit.thresholds[each])}   ` +
          `Additional Medicare threshold: ${dollars(params.additionalMedicareThreshold[each])}`,
      );
    }

    rows.push('');
    rows.push('## Payroll');
    rows.push(`Social security wage base: ${dollars(params.socialSecurityWageBase)}`);
    rows.push(
      `Employee ${percent(params.rates.socialSecurityEmployee, 2)} OASDI + ` +
        `${percent(params.rates.medicareEmployee, 2)} Medicare; self-employed ` +
        `${percent(params.rates.seSocialSecurity, 2)} + ${percent(params.rates.seMedicare, 2)} on ` +
        `${percent(params.seNetEarningsFactor, 2)} of net profit.`,
    );
    const saltStatus = status ?? 'single';
    rows.push(
      `SALT cap (${statusLabel(saltStatus)}): ${dollars(params.saltCap.cap[saltStatus])}, losing ` +
        `${Math.round(params.saltCap.phaseDownRate * 100)} cents of cap per dollar of MAGI above ` +
        `${dollars(params.saltCap.phaseDownThreshold[saltStatus])} but never falling below ` +
        `${dollars(params.saltCap.floor[saltStatus])}. Reverts to $10,000 after ${params.saltCap.finalYear}.`,
    );
    rows.push(
      `Schedule 1-A (OBBBA tips / overtime / senior / vehicle interest): ` +
        (params.scheduleOneA ? 'in effect' : 'not in effect this year'),
    );

    const narrowed = status
      ? (forStatus(params as unknown as Record<string, unknown>, status) as Record<string, unknown>)
      : (params as unknown as Record<string, unknown>);

    return {
      text: rows.join('\n') + citationText([year], Infinity),
      structured: {
        year,
        filingStatus: status,
        ...(includeFull ? { parameters: narrowed } : {}),
        sources: citations(params),
      },
    };
  },
};

// ---------------------------------------------------------------------------
// list_supported_years
// ---------------------------------------------------------------------------

/**
 * What this server does and does not model.
 *
 * Stated as a tool rather than buried in a README because the caller is a
 * language model, and a model that cannot see the gaps will confidently fill
 * them in. AMT and state tax in particular are the two a user is most likely to
 * assume are included.
 */
const COVERAGE_GAPS: readonly string[] = [
  'Alternative minimum tax (§ 55) is not modelled. A filer who owes AMT owes more than this reports.',
  'State and local income tax is not modelled at all — only the federal deduction for it.',
  'The new § 68 overall limitation on itemized deductions (OBBBA § 70111, first effective 2026) is not applied. Its formula and the § 199A deduction are mutually dependent and the IRS worksheet that fixes the ordering was not reachable when this was written. Effect is bounded: above $640,600 ($768,700 joint), an itemizer\'s deduction is overstated by at most 2/37 — 5.4% — of it. Everyone below is unaffected.',
  'The 0.5%-of-AGI charitable floor (OBBBA § 70425) and the 7.5%-of-AGI medical floor are not applied; otherItemizedDeductions is taken as given.',
  'Education credits, the § 21 dependent care credit, the saver\'s credit, the premium tax credit and energy credits are not modelled.',
  'Foreign tax credit, AMT credit and business credits are not modelled.',
  'This computes tax. It is not tax advice, and it is not a substitute for a return preparer.',
];

const yearsTool: ToolDefinition = {
  name: 'list_supported_years',
  title: 'Supported tax years and coverage',
  description:
    'List the tax years this server can compute, the IRS releases each one is sourced from, and ' +
    'what is NOT modelled. Call this first if you are unsure whether a question is in ' +
    'scope, or before telling a user a figure is complete: AMT and several credits are ' +
    'deliberately absent, and the § 68 limitation is a documented gap with a stated bound.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  annotations: { ...READ_ONLY, title: 'Supported tax years and coverage' },
  run() {
    const rows: string[] = [];
    rows.push(`Supported tax years: ${SUPPORTED_YEARS.join(', ')} (latest ${LATEST_YEAR}).`);
    rows.push('An unsupported year is an error, never a silent fallback to a neighbouring year.');
    rows.push('');
    for (const year of SUPPORTED_YEARS) {
      const params = getYearParameters(year);
      rows.push(`${year}:`);
      rows.push(
        `  Schedule 1-A (OBBBA deductions): ${params.scheduleOneA ? 'in effect' : 'not in effect'}`,
      );
      rows.push(
        `  § 199A minimum deduction (§ 199A(i)): ${
          params.section199A.minimumDeduction ? 'in effect' : 'not in effect'
        }`,
      );
      for (const source of params.sources) rows.push(`  - ${source.title} — ${source.url}`);
    }
    rows.push('');
    rows.push('Not modelled:');
    for (const gap of COVERAGE_GAPS) rows.push(`- ${gap}`);
    return {
      text: rows.join('\n'),
      structured: {
        supportedYears: [...SUPPORTED_YEARS],
        latestYear: LATEST_YEAR,
        sourcesByYear: Object.fromEntries(
          SUPPORTED_YEARS.map((year) => [year, citations(getYearParameters(year))]),
        ),
        notModelled: [...COVERAGE_GAPS],
      },
    };
  },
};


// ---------------------------------------------------------------------------
// paycheck_withholding
// ---------------------------------------------------------------------------

const PAY_PERIOD_VALUES = [
  'weekly',
  'biweekly',
  'semimonthly',
  'monthly',
  'quarterly',
  'semiannual',
  'annual',
  'daily',
] as const;

/**
 * Deliberately not built on `householdSchema`.
 *
 * A paycheck is a different object from a return: it has a pay period, a Form
 * W-4 and a year-to-date, and it has none of the thirty household fields the
 * other four tools share. Reusing the household schema here would have added
 * about 8 KB to every session's `tools/list` to advertise fields this tool
 * cannot use. `targetAnnualTax` is the one bridge, and the description points
 * at `estimate_federal_tax` to fill it.
 */
const paycheckTool: ToolDefinition = {
  name: 'paycheck_withholding',
  title: 'Paycheck withholding and Form W-4',
  description:
    'Compute what an employer withholds from one paycheck — federal income tax by the IRS ' +
    'Publication 15-T percentage method, plus Social Security, Medicare and Additional Medicare — ' +
    'and, given targetAnnualTax, whether it will be enough and what to put on Form W-4 Step 4(c). ' +
    'Answers "what will my take-home pay be", "how should I fill out my W-4", "why do I owe money ' +
    'every April", "should I check the multiple jobs box". ' +
    'This is NOT the same as the tax on a return: a second job, a working spouse or 1099 income is ' +
    'invisible to the tables, and 2025 withholds on the pre-OBBBA standard deduction because the ' +
    'IRS never reissued that year\'s tables. Use estimate_federal_tax for the return itself, and ' +
    'pass its totalTax here as targetAnnualTax.',
  inputSchema: {
    type: 'object',
    required: ['wagesThisPeriod', 'filingStatus', 'payPeriod'],
    additionalProperties: false,
    properties: {
      wagesThisPeriod: {
        type: 'number',
        description:
          'Taxable wages for ONE pay period, not for the year. Gross pay less pre-tax deductions such as a 401(k) deferral or a section 125 premium.',
      },
      filingStatus: FILING_STATUS_PROPERTY,
      payPeriod: {
        type: 'string',
        enum: [...PAY_PERIOD_VALUES],
        description:
          'How often the employee is paid. Required — there is no default, because guessing this scales the answer by a factor of two or more. "daily" is Publication 15-T\'s daily or miscellaneous period and counts 260 days.',
      },
      year: YEAR_PROPERTY,
      multipleJobsCheckbox: {
        type: 'boolean',
        description:
          'Form W-4 Step 2, checkbox (c): this employee holds two jobs, or files jointly with a working spouse, and the box is checked on both W-4s. Switches to the halved schedule. Leaving it unchecked when it applies is the single most common cause of owing money in April.',
      },
      dependentsCredit: {
        type: 'number',
        description: 'Form W-4 Step 3, the ANNUAL credit amount (e.g. 4400 for two children in 2026).',
      },
      otherIncome: {
        type: 'number',
        description: 'Form W-4 Step 4(a), annual income with no withholding of its own — interest, dividends, retirement income.',
      },
      deductions: {
        type: 'number',
        description: 'Form W-4 Step 4(b), annual deductions beyond the standard deduction. The only place to claim the OBBBA tips, overtime, senior or car loan interest deductions, which no withholding table accounts for.',
      },
      extraWithholding: {
        type: 'number',
        description: 'Form W-4 Step 4(c), extra withholding PER PAY PERIOD.',
      },
      allowances2019OrEarlier: {
        type: 'integer',
        description: 'Allowances on a Form W-4 from 2019 or earlier, if the employee has never filed a new one. Switches to Worksheet 1B, where each allowance is worth $4,300 of wages. Mutually exclusive with the Step 2/3/4 fields.',
      },
      ficaWagesThisPeriod: {
        type: 'number',
        description: 'Wages subject to Social Security and Medicare, when they differ from wagesThisPeriod. A 401(k) deferral reduces income tax withholding and not FICA; a section 125 premium reduces both.',
      },
      yearToDateSocialSecurityWages: {
        type: 'number',
        description: 'Social Security wages THIS employer has already paid this calendar year, so the wage base applies. The base is per employer, so two jobs over-withhold and the excess is a credit on the return.',
      },
      yearToDateMedicareWages: {
        type: 'number',
        description: 'Medicare wages paid year to date by this employer. Additional Medicare Tax is withheld above $200,000 from one employer regardless of filing status, which is not the threshold the return uses.',
      },
      targetAnnualTax: {
        type: 'number',
        description: 'The tax expected for the whole year — normally estimate_federal_tax totalTax. Supplying it turns this into a Form W-4 plan: projected withholding, the shortfall, and the Step 4(c) amount that closes it.',
      },
      payPeriodsRemaining: {
        type: 'integer',
        description: 'Pay periods left in the year. Defaults to a full year. Only used with targetAnnualTax.',
      },
      withheldToDate: {
        type: 'number',
        description: 'Federal income tax already withheld this year, from all employers. Only used with targetAnnualTax.',
      },
    },
  },
  annotations: { ...READ_ONLY, title: 'Paycheck withholding and Form W-4' },
  run(args) {
    const source = asRecord(args, 'arguments');
    const allowed = Object.keys(
      (paycheckTool.inputSchema as { properties: Record<string, unknown> }).properties,
    );
    const unknown = Object.keys(source).filter((key) => !allowed.includes(key));
    if (unknown.length > 0) {
      throw new ToolInputError(
        `Unknown argument${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}. Accepted: ${allowed.join(', ')}.`,
      );
    }

    const filingStatus = readFilingStatus(source);
    const payPeriod = source['payPeriod'];
    if (typeof payPeriod !== 'string' || !(PAY_PERIOD_VALUES as readonly string[]).includes(payPeriod)) {
      throw new ToolInputError(
        `payPeriod must be one of ${PAY_PERIOD_VALUES.join(', ')}, received ${JSON.stringify(payPeriod)}.`,
      );
    }
    const wages = readNumber(source, 'wagesThisPeriod');
    if (wages === undefined) throw new ToolInputError('wagesThisPeriod is required.');

    const allowances = readNumber(source, 'allowances2019OrEarlier', { integer: true });
    const modernKeys = ['multipleJobsCheckbox', 'dependentsCredit', 'otherIncome', 'deductions'];
    if (allowances !== undefined) {
      const conflicting = modernKeys.filter((key) => source[key] !== undefined);
      if (conflicting.length > 0) {
        throw new ToolInputError(
          `allowances2019OrEarlier describes a Form W-4 from 2019 or earlier, which has no ${conflicting.join(', ')}. ` +
            'Use one form or the other, not both.',
        );
      }
    }

    const extra = readNumber(source, 'extraWithholding');
    const w4 =
      allowances !== undefined
        ? { revision: '2019OrEarlier' as const, allowances, ...(extra !== undefined ? { extraWithholding: extra } : {}) }
        : {
            ...(readBoolean(source, 'multipleJobsCheckbox') !== undefined
              ? { multipleJobsCheckbox: readBoolean(source, 'multipleJobsCheckbox') }
              : {}),
            ...(readNumber(source, 'dependentsCredit') !== undefined
              ? { dependentsCredit: readNumber(source, 'dependentsCredit') }
              : {}),
            ...(readNumber(source, 'otherIncome') !== undefined
              ? { otherIncome: readNumber(source, 'otherIncome') }
              : {}),
            ...(readNumber(source, 'deductions') !== undefined
              ? { deductions: readNumber(source, 'deductions') }
              : {}),
            ...(extra !== undefined ? { extraWithholding: extra } : {}),
          };

    const year = readNumber(source, 'year', { integer: true });
    const base = {
      wagesThisPeriod: wages,
      filingStatus,
      payPeriod: payPeriod as PayPeriod,
      ...(year !== undefined ? { year } : {}),
      w4: w4 as W4,
    };

    const fica = readNumber(source, 'ficaWagesThisPeriod');
    const ytdSs = readNumber(source, 'yearToDateSocialSecurityWages');
    const ytdMedicare = readNumber(source, 'yearToDateMedicareWages');
    const check = computePaycheck({
      ...base,
      ...(fica !== undefined ? { ficaWagesThisPeriod: fica } : {}),
      ...(ytdSs !== undefined ? { yearToDateSocialSecurityWages: ytdSs } : {}),
      ...(ytdMedicare !== undefined ? { yearToDateMedicareWages: ytdMedicare } : {}),
    });

    const target = readNumber(source, 'targetAnnualTax');
    const remaining = readNumber(source, 'payPeriodsRemaining', { integer: true });
    const withheld = readNumber(source, 'withheldToDate');
    const plan =
      target === undefined
        ? undefined
        : withholdingPlan({
            ...base,
            targetAnnualTax: target,
            ...(remaining !== undefined ? { payPeriodsRemaining: remaining } : {}),
            ...(withheld !== undefined ? { withheldToDate: withheld } : {}),
          });

    return {
      text: renderPaycheck(check, filingStatus, plan) + citationText([check.year]),
      structured: {
        paycheck: check as unknown as Record<string, unknown>,
        ...(plan ? { plan: plan as unknown as Record<string, unknown> } : {}),
        sources: citations(getYearParameters(check.year)),
      },
    };
  },
};

// ---------------------------------------------------------------------------
// state_income_tax
// ---------------------------------------------------------------------------

/**
 * Also deliberately not built on `householdSchema`, and for a sharper reason
 * than `paycheck_withholding`.
 *
 * A state return is a *function of the federal one*. Advertising thirty
 * household fields here would invite the model to describe the household twice,
 * once to this tool and once to `estimate_federal_tax`, and the two descriptions
 * would differ — which is precisely the failure this tool exists to avoid, since
 * every supported state's answer is keyed to a federal figure. Requiring the
 * three federal numbers instead makes the dependency explicit and makes the two
 * tools reconcile by construction.
 */
const stateTool: ToolDefinition = {
  name: 'state_income_tax',
  title: 'State income tax',
  description:
    'Compute a US STATE and LOCAL individual income tax return for 2025 or 2026 — 28 states plus NEW YORK ' +
    'CITY, YONKERS, all 24 MARYLAND jurisdictions, 92 INDIANA counties, 24 MICHIGAN cities, 679 OHIO ' +
    'municipalities and 214 taxing OHIO school districts. Call estimate_federal_tax FIRST and pass its ' +
    'adjustedGrossIncome, taxableIncome, deduction and earned income credit: which federal figure a ' +
    'state starts from decides the answer. Ten states need more. NY: locality. MD and IN: county, plus ' +
    'netCapitalGain and stateItemizedDeductions in MD. MD, GA and KY: retirement for a retiree — all ' +
    'three exclusions are PER PERSON, GA excludes nothing without it, and KY has NO CEILING for ' +
    'pre-1998 government service. UT: filerAge, spouseAge, taxableSocialSecurity, taxExemptInterest ' +
    'and retirement.militaryRetirement — Utah taxes the benefit and hands the tax back as a credit, ' +
    'so a Utah retiree comes back far too high without them. OH: city and ' +
    'qualifyingWages, box 5 of the W-2 and NOT federal AGI, and schoolDistrict. MI: city and cityIncome, ' +
    'which is NOT federal AGI. VA: filerAge, spouseAge, taxableSocialSecurity and ' +
    'bothSpousesHaveQualifyingIncome. CA: earnedIncome and dependentAges. ' +
    'NJ: newJerseyGrossIncome is REQUIRED, plus filerAge and retirementIncome over 62. MA: ' +
    'massachusettsFivePercentIncome is REQUIRED and is NOT federal AGI, plus shortTermCapitalGains and ' +
    'collectiblesGains, taxed at 8.5% and 12%. Reports the ' +
    'true marginal rate by rerunning the whole return a dollar higher, and carries that state\'s own ' +
    'notes and ' +
    'statutes. Does NOT cover a state outside the enum, local tax outside NY, MD, IN, MI and OH, or state ' +
    'withholding. An unlisted state is an error, not a zero.',
  inputSchema: {
    type: 'object',
    required: ['state', 'filingStatus', 'federalAdjustedGrossIncome', 'federalTaxableIncome'],
    additionalProperties: false,
    properties: {
      state: {
        type: 'string',
        enum: [...STATE_CODES],
        description:
          'Two-letter state code. Only these are supported; any other state is an error, not a zero.',
      },
      filingStatus: FILING_STATUS_PROPERTY,
      year: {
        type: 'integer',
        enum: [...STATE_YEARS],
        description:
          'State tax year. Eight states cut their rate for 2026; an unsupported year is an error, not a fallback.',
      },
      federalAdjustedGrossIncome: {
        type: 'number',
        description: 'Form 1040 line 11 — estimate_federal_tax adjustedGrossIncome.',
      },
      federalTaxableIncome: {
        type: 'number',
        description: 'Form 1040 line 15 — estimate_federal_tax taxableIncome. Colorado and Idaho start here.',
      },
      federalDeduction: {
        type: 'number',
        description:
          'The deduction actually taken federally — estimate_federal_tax deduction. Arizona uses it directly, Utah bases its credit on it. Defaults to AGI minus taxable income.',
      },
      dependents: { type: 'integer', description: 'Dependents claimed on the state return. Defaults to the length of dependentAges.' },
      // Every field only some states read. The schema keeps the name, the type
      // and the state list — everything needed to make a legal call — and the
      // prose lives in describe_state, which a caller reaches for exactly one
      // state's worth of. See src/state-fields.ts for why.
      ...stateFieldProperties(),
      federalQualifiedBusinessIncomeDeduction: {
        type: 'number',
        description: 'The Section 199A deduction taken federally. CO adds it back; ID allows it.',
      },
      federalOvertimeDeduction: {
        type: 'number',
        description: 'The OBBBA qualified overtime deduction. CO adds it back from 2026; GA excludes $1,750 of the same pay for 2026-2028.',
      },
      federalTipsDeduction: {
        type: 'number',
        description: 'The OBBBA qualified tips deduction. GA excludes $1,750 of the same tips for 2026-2028.',
      },
      federalEarnedIncomeCredit: {
        type: 'number',
        description:
          'Form 1040 line 27 — estimate_federal_tax credits.earnedIncomeCredit.credit. Nine states match 10-100% of it and each Maryland county another ten times its own rate; omitting it makes a low-income return too high.',
      },
      stateAdditions: {
        type: 'number',
        description:
          'State-specific additions — most often another state\'s municipal bond interest. Not enumerated: a partial list would be worse than none.',
      },
      stateSubtractions: {
        type: 'number',
        description:
          'State-specific subtractions — US government interest, Social Security and retirement income the state exempts, 529 contributions, military pay.',
      },
    },
  },
  annotations: { ...READ_ONLY, title: 'State income tax' },
  run(args) {
    const source = asRecord(args, 'arguments');
    const allowed = Object.keys(
      (stateTool.inputSchema as { properties: Record<string, unknown> }).properties,
    );
    const unknown = Object.keys(source).filter((key) => !allowed.includes(key));
    if (unknown.length > 0) {
      throw new ToolInputError(
        `Unknown argument${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}. Accepted: ${allowed.join(', ')}.`,
      );
    }

    const state = source['state'];
    if (typeof state !== 'string' || !(STATE_CODES as readonly string[]).includes(state)) {
      throw new ToolInputError(
        `state must be one of ${STATE_CODES.join(', ')}, received ${JSON.stringify(state)}. ` +
          'Every other state is unsupported; there is no zero to fall back to.',
      );
    }
    const filingStatus = readFilingStatus(source) as unknown as StateFilingStatus;
    const year = readNumber(source, 'year', { integer: true }) ?? STATE_YEARS[STATE_YEARS.length - 1]!;

    const agi = readNumber(source, 'federalAdjustedGrossIncome');
    const taxable = readNumber(source, 'federalTaxableIncome');
    if (agi === undefined) throw new ToolInputError('federalAdjustedGrossIncome is required.');
    if (taxable === undefined) throw new ToolInputError('federalTaxableIncome is required.');
    if (taxable > agi) {
      throw new ToolInputError(
        `federalTaxableIncome (${taxable}) cannot exceed federalAdjustedGrossIncome (${agi}). ` +
          'Taxable income is AGI less the deduction, not a figure above it.',
      );
    }
    // The default is exact for a filer whose only below-AGI items are the
    // deduction itself, and understates it for one with a § 199A or Schedule 1-A
    // deduction — which is why the schema asks for the real figure.
    const deduction = readNumber(source, 'federalDeduction') ?? agi - taxable;

    const qbi = readNumber(source, 'federalQualifiedBusinessIncomeDeduction');
    const overtime = readNumber(source, 'federalOvertimeDeduction');
    const tips = readNumber(source, 'federalTipsDeduction');
    const federalEitc = readNumber(source, 'federalEarnedIncomeCredit');
    const additions = readNumber(source, 'stateAdditions');
    const subtractions = readNumber(source, 'stateSubtractions');
    const dependents = readNumber(source, 'dependents', { integer: true });
    const rawAges = source['dependentAges'];
    if (rawAges !== undefined && !Array.isArray(rawAges)) {
      throw new ToolInputError('dependentAges must be an array of ages, one per dependent.');
    }
    const dependentAges = rawAges?.map((age, index) => {
      if (typeof age !== 'number' || !Number.isFinite(age) || age < 0 || !Number.isInteger(age)) {
        throw new ToolInputError(
          `dependentAges[${index}] must be a non-negative whole number, received ${JSON.stringify(age)}.`,
        );
      }
      return age;
    });
    const earnedIncome = readNumber(source, 'earnedIncome');
    const investmentIncome = readNumber(source, 'investmentIncome');
    const paIncome = readNumber(source, 'pennsylvaniaTaxableIncome');
    if (paIncome !== undefined && state !== 'PA') {
      throw new ToolInputError(
        `pennsylvaniaTaxableIncome only applies to PA, and ${state} was requested.`,
      );
    }
    const njIncome = readNumber(source, 'newJerseyGrossIncome');
    if (njIncome !== undefined && state !== 'NJ') {
      throw new ToolInputError(
        `newJerseyGrossIncome only applies to NJ, and ${state} was requested.`,
      );
    }
    // Massachusetts is the only state here whose base is split by the KIND of
    // income, so these four are refused elsewhere for the same reason the
    // Pennsylvania and New Jersey figures are: a model that sent a short-term
    // gain to New York would be told nothing and get a wrong answer.
    const maIncome = readNumber(source, 'massachusettsFivePercentIncome');
    const shortTermGains = readNumber(source, 'shortTermCapitalGains');
    const collectibles = readNumber(source, 'collectiblesGains');
    const ficaPaid = readNumber(source, 'socialSecurityAndMedicarePaid');
    for (const [field, value] of [
      ['massachusettsFivePercentIncome', maIncome],
      ['shortTermCapitalGains', shortTermGains],
      ['collectiblesGains', collectibles],
      ['socialSecurityAndMedicarePaid', ficaPaid],
    ] as const) {
      if (value !== undefined && state !== 'MA') {
        throw new ToolInputError(`${field} only applies to MA, and ${state} was requested.`);
      }
    }
    const county = source['county'];
    const itemized = readNumber(source, 'stateItemizedDeductions');
    const capitalGain = readNumber(source, 'netCapitalGain');
    const federalItemized = source['federalItemized'];
    if (federalItemized !== undefined && typeof federalItemized !== 'boolean') {
      throw new ToolInputError('federalItemized must be true or false.');
    }
    for (const [field, value, states] of [
      ['stateItemizedDeductions', itemized, ['MD', 'VA']],
      ['netCapitalGain', capitalGain, ['MD']],
      ['federalItemized', federalItemized, ['MD', 'VA']],
    ] as const) {
      if (value !== undefined && !(states as readonly string[]).includes(state)) {
        throw new ToolInputError(
          `${field} only applies to ${states.join(' and ')}, and ${state} was requested.`,
        );
      }
    }
    // The county itself belongs to two states, and the engine's own message
    // names them and lists that state's jurisdictions — so it is left to throw.
    if (county !== undefined && typeof county !== 'string') {
      throw new ToolInputError(
        `county must be the name of a county in ${COUNTY_TAX_STATES.join(' or ')}.`,
      );
    }
    // Refused rather than ignored. Md. Code, Tax-Gen. § 10-218(b) allows a
    // Maryland itemized deduction only to a filer who itemized federally, so a
    // model that supplies one without saying the filer itemized has either got
    // the federal return wrong or is about to get a Maryland answer that is too
    // low — and silently dropping the figure would hide both.
    if (itemized !== undefined && federalItemized !== true) {
      throw new ToolInputError(
        'stateItemizedDeductions needs federalItemized: true. Maryland allows itemizing only ' +
          'if the filer itemized federally (§ 10-218(b)) — which is why the larger federal ' +
          'standard deduction ended the Maryland itemized deduction for filers whose Maryland ' +
          'deductions never changed — and Virginia COMPELS it (§ 58.1-322.03(1)(a)), barring ' +
          'the state standard deduction outright. Pass the standard-deduction return instead, ' +
          'or set federalItemized.',
      );
    }

    const filerAge = readNumber(source, 'filerAge', { integer: true });
    const spouseAge = readNumber(source, 'spouseAge', { integer: true });
    const blindOrDisabled = readNumber(source, 'blindOrDisabled', { integer: true });
    if (blindOrDisabled !== undefined && blindOrDisabled > 2) {
      throw new ToolInputError(
        `blindOrDisabled counts the filer and spouse only, so it cannot exceed 2; received ${blindOrDisabled}. ` +
          'New Jersey gives no additional exemption for a blind or disabled dependent.',
      );
    }
    const collegeDependents = readNumber(source, 'dependentsAttendingCollege', { integer: true });
    const retirementIncome = readNumber(source, 'retirementIncome');
    const propertyTaxPaid = readNumber(source, 'propertyTaxPaid');
    const rentPaid = readNumber(source, 'rentPaid');

    const city = source['city'];
    const workCity = source['workCity'];
    const workCityEarnings = readNumber(source, 'workCityEarnings');
    const cityIncome = readNumber(source, 'cityIncome');
    const qualifyingWages = readNumber(source, 'qualifyingWages');
    const businessIncome = readNumber(source, 'businessIncome');
    const bothSpouses = source['bothSpousesHaveQualifyingIncome'];
    const taxableSocialSecurity = readNumber(source, 'taxableSocialSecurity');
    const taxExemptInterest = readNumber(source, 'taxExemptInterest');
    const outOfStateMunicipalInterest = readNumber(source, 'outOfStateMunicipalInterest');
    const retirement = readRetirementSplit(source);
    const lesserSpouseIncome = readNumber(source, 'lesserSpouseIncome');
    const federalPovertyGuideline = readNumber(source, 'federalPovertyGuideline');
    const residentCreditRate = readNumber(source, 'residentCreditRate');
    const residentCreditLimitRate = readNumber(source, 'residentCreditLimitRate');
    const schoolDistrict = source['schoolDistrict'];
    if (schoolDistrict !== undefined && typeof schoolDistrict !== 'string') {
      throw new ToolInputError(
        'schoolDistrict must be the four-digit number of an Ohio school district that levies an ' +
          'income tax, as a string — "0203", not 203.',
      );
    }
    // Two city states now, and the fields divide unevenly between them: the base
    // is a different figure in each, so `cityIncome` is Michigan's alone and
    // `qualifyingWages` Ohio's alone, while the city names are shared.
    for (const [field, value, states] of [
      ['city', city, ['MI', 'OH']],
      ['workCity', workCity, ['MI', 'OH']],
      ['workCityEarnings', workCityEarnings, ['MI', 'OH']],
      ['cityIncome', cityIncome, ['MI']],
      ['qualifyingWages', qualifyingWages, ['OH']],
      ['businessIncome', businessIncome, ['OH']],
      ['residentCreditRate', residentCreditRate, ['OH']],
      ['residentCreditLimitRate', residentCreditLimitRate, ['OH']],
      ['schoolDistrict', schoolDistrict, ['OH']],
    ] as const) {
      if (value !== undefined && !(states as readonly string[]).includes(state)) {
        throw new ToolInputError(
          `${field} only applies to ${states.join(' and ')}, and ${state} was requested. ` +
            `Michigan's 24 city income taxes and Ohio's 679 municipal ones are the only local ` +
            `taxes of this kind this server models — Kentucky's occupational taxes and ` +
            `Philadelphia's wage tax are not — and the two do not share a base: Michigan taxes ` +
            `city income and Ohio taxes qualifying wages.`,
        );
      }
    }
    for (const [field, value] of [
      ['city', city],
      ['workCity', workCity],
    ] as const) {
      // The engine's own message names every city, so a bad name is left to it.
      if (value !== undefined && typeof value !== 'string') {
        throw new ToolInputError(
          `${field} must be the name of a Michigan or Ohio city that levies an income tax.`,
        );
      }
    }
    if (bothSpouses !== undefined && typeof bothSpouses !== 'boolean') {
      throw new ToolInputError('bothSpousesHaveQualifyingIncome must be true or false.');
    }
    // Two states ask the same question of a joint return and pay differently for
    // the answer: Ohio's joint filing credit is a percentage of the tax, capped
    // at $650, and Virginia's spouse tax adjustment is a flat $257.50 because
    // Virginia never doubled its brackets.
    if (bothSpouses !== undefined && state !== 'OH' && state !== 'VA') {
      throw new ToolInputError(
        `bothSpousesHaveQualifyingIncome only applies to OH and VA, and ${state} was requested.`,
      );
    }
    for (const [field, value] of [
      ['lesserSpouseIncome', lesserSpouseIncome],
      ['federalPovertyGuideline', federalPovertyGuideline],
    ] as const) {
      if (value !== undefined && state !== 'VA') {
        throw new ToolInputError(
          `${field} only applies to VA, and ${state} was requested. Both belong to the spouse ` +
            `tax adjustment and the Credit for Low Income Individuals, neither of which any ` +
            `other supported state has.`,
        );
      }
    }
    // Two states need the Social Security figure rather than accepting it
    // through subtractions, and they need it for opposite reasons: Virginia
    // tests its age deduction on federal AGI LESS this number, and Maryland
    // subtracts it and then charges the total received against the pension
    // exclusion. Maryland therefore needs two Social Security figures on one
    // return — the taxable part here, the total received in `retirement`.
    //
    // Both lists are READ OFF the table rather than restated here. They used to
    // be literals, and on Day 24 four states were added to `retirement` in the
    // table and the literal here refused them — a test caught it, which is the
    // good case, and the module's own header had already named the bad one: two
    // copies of a fact that must agree is a bug with a waiting period.
    const statesFor = (field: string): readonly string[] =>
      STATE_FIELDS.find((f) => f.name === field)?.states ?? [];
    const TAXABLE_SS_STATES = statesFor('taxableSocialSecurity');
    if (taxableSocialSecurity !== undefined && !TAXABLE_SS_STATES.includes(state)) {
      throw new ToolInputError(
        `taxableSocialSecurity only applies to ${TAXABLE_SS_STATES.join(', ')}, and ${state} ` +
          `was requested. Every other supported state that exempts Social Security takes it ` +
          `through stateSubtractions instead.`,
      );
    }
    const SPLIT_STATES = statesFor('retirement');
    if (retirement !== undefined && !SPLIT_STATES.includes(state)) {
      throw new ToolInputError(
        `retirement only applies to ${SPLIT_STATES.join(', ')}, and ${state} was requested. ` +
          `MD, GA, KY and NY cap a retirement exclusion PER PERSON, so they need the income ` +
          `split between the spouses; IL, MS and MI subtract retirement income without a ` +
          `per-person cap and NC deducts military retired pay; UT needs militaryRetirement ` +
          `for its code AJ credit. New Jersey's exclusion is per return: pass retirementIncome.`,
      );
    }
    // Illinois only, and read off the table rather than restated — see the note
    // on SPLIT_STATES above.
    const MUNI_STATES = statesFor('outOfStateMunicipalInterest');
    if (outOfStateMunicipalInterest !== undefined && !MUNI_STATES.includes(state)) {
      throw new ToolInputError(
        `outOfStateMunicipalInterest only applies to ${MUNI_STATES.join(', ')}, and ${state} ` +
          `was requested. Every other state that adds back another state's municipal interest ` +
          `takes it through stateAdditions.`,
      );
    }
    if (taxExemptInterest !== undefined && state !== 'UT') {
      throw new ToolInputError(
        `taxExemptInterest only applies to UT, and ${state} was requested. Utah is the only ` +
          `supported state that adds tax-exempt interest back into an income test of its own.`,
      );
    }
    // Refused rather than ignored, for the same reason stateItemizedDeductions is:
    // a nonresident city tax with no wage figure is silently zero, and a model
    // that named a work city meant to be charged for it.
    if (workCity !== undefined && workCityEarnings === undefined) {
      throw new ToolInputError(
        'workCity needs workCityEarnings — the wages earned inside that city, apportioned by ' +
          'working days. Without it the nonresident city tax is zero, which is a wrong answer ' +
          'rather than a missing one.',
      );
    }
    if (workCityEarnings !== undefined && workCity === undefined) {
      throw new ToolInputError('workCityEarnings needs workCity: the city those wages were earned in.');
    }
    // Ohio's municipal base has no line on the IT 1040 behind it and nothing on
    // a federal return stands in for it, so this is a refusal rather than a zero.
    if (state === 'OH' && city !== undefined && qualifyingWages === undefined) {
      throw new ToolInputError(
        'city on an Ohio return needs qualifyingWages — O.R.C. 718.01(R) wages, box 5 of the ' +
          'W-2, which a 401(k) deferral does not reduce, plus a resident\'s net business or ' +
          'rental profit. Federal AGI is NOT a substitute: it holds the interest, dividends and ' +
          'capital gains 718.01(S) puts outside the base, and is net of deductions box 5 never saw.',
      );
    }

    const locality = source['locality'];
    if (
      locality !== undefined &&
      (typeof locality !== 'string' || !(LOCALITY_CODES as readonly string[]).includes(locality))
    ) {
      throw new ToolInputError(
        `locality must be one of ${LOCALITY_CODES.join(', ')}, received ${JSON.stringify(locality)}.`,
      );
    }
    const yonkersEarnings = readNumber(source, 'yonkersNonresidentEarnings');
    // Caught here rather than in the engine so the message can name the tool's
    // own field, and so a model that guessed a locality for a non-New-York filer
    // is told which of the two fields to drop.
    if ((locality !== undefined || yonkersEarnings !== undefined) && state !== 'NY') {
      throw new ToolInputError(
        `locality and yonkersNonresidentEarnings apply to NY only, and ${state} was requested. ` +
          'Local income tax outside New York is not modelled here; returning zero for it would be ' +
          'a wrong answer rather than a missing one.',
      );
    }

    // The backstop, and the reason the state lists live in one table.
    //
    // Every check above names its own field and says something a model can act
    // on, and between them they missed `county` — which Alaska accepted and
    // silently ignored, because a state with no income tax has no county tax to
    // be wrong about and nothing objected. A silently ignored field is a wrong
    // answer with no symptom, which is the one failure mode this server is
    // supposed to refuse. So the table that documents a field for a state also
    // decides whether the server takes it from that state, and this loop is the
    // deciding: anything not caught by a better message above is caught here.
    for (const field of STATE_FIELDS) {
      if (source[field.name] === undefined) continue;
      if (field.states.includes(state)) continue;
      throw new ToolInputError(
        `${field.name} applies to ${field.states.join(', ')}, and ${state} was requested. ` +
          (field.refusal ?? `Call describe_state for ${state} to see what it does read.`),
      );
    }

    const result = stateIncomeTax({
      state: state as StateCode,
      year,
      filingStatus,
      federal: {
        adjustedGrossIncome: agi,
        taxableIncome: taxable,
        deduction,
        deductionKind: federalItemized === true ? 'itemized' : 'standard',
        ...(federalEitc !== undefined ? { earnedIncomeCredit: federalEitc } : {}),
      },
      // Ages are authoritative when both are given; the engine refuses a pair that
      // disagrees rather than silently changing a family's credit.
      ...(dependentAges !== undefined ? { dependentAges } : {}),
      ...(dependents !== undefined && dependentAges === undefined ? { dependents } : {}),
      ...(earnedIncome !== undefined ? { earnedIncome } : {}),
      ...(investmentIncome !== undefined ? { investmentIncome } : {}),
      ...(additions !== undefined ? { additions } : {}),
      ...(subtractions !== undefined ? { subtractions } : {}),
      ...(paIncome !== undefined ? { pennsylvaniaTaxableIncome: paIncome } : {}),
      ...(njIncome !== undefined ? { newJerseyGrossIncome: njIncome } : {}),
      ...(maIncome !== undefined ? { massachusettsFivePercentIncome: maIncome } : {}),
      ...(shortTermGains !== undefined ? { shortTermCapitalGains: shortTermGains } : {}),
      ...(collectibles !== undefined ? { collectiblesGains: collectibles } : {}),
      ...(ficaPaid !== undefined ? { socialSecurityAndMedicarePaid: ficaPaid } : {}),
      ...(filerAge !== undefined ? { filerAge } : {}),
      ...(spouseAge !== undefined ? { spouseAge } : {}),
      ...(blindOrDisabled !== undefined ? { blindOrDisabled } : {}),
      ...(collegeDependents !== undefined ? { dependentsAttendingCollege: collegeDependents } : {}),
      ...(retirementIncome !== undefined ? { retirementIncome } : {}),
      ...(propertyTaxPaid !== undefined ? { propertyTaxPaid } : {}),
      ...(rentPaid !== undefined ? { rentPaid } : {}),
      ...(county !== undefined ? { county } : {}),
      ...(city !== undefined ? { city: city as string } : {}),
      ...(cityIncome !== undefined ? { cityIncome } : {}),
      ...(qualifyingWages !== undefined ? { qualifyingWages } : {}),
      ...(businessIncome !== undefined ? { businessIncome } : {}),
      ...(bothSpouses !== undefined
        ? { bothSpousesHaveQualifyingIncome: bothSpouses as boolean }
        : {}),
      ...(residentCreditRate !== undefined ? { residentCreditRate } : {}),
      ...(residentCreditLimitRate !== undefined ? { residentCreditLimitRate } : {}),
      ...(schoolDistrict !== undefined ? { schoolDistrict: schoolDistrict as string } : {}),
      ...(workCity !== undefined ? { workCity: workCity as string } : {}),
      ...(workCityEarnings !== undefined ? { workCityEarnings } : {}),
      ...(itemized !== undefined ? { stateItemizedDeductions: itemized } : {}),
      ...(taxableSocialSecurity !== undefined ? { taxableSocialSecurity } : {}),
      ...(taxExemptInterest !== undefined ? { taxExemptInterest } : {}),
      ...(outOfStateMunicipalInterest !== undefined ? { outOfStateMunicipalInterest } : {}),
      ...(retirement !== undefined ? { retirement } : {}),
      ...(lesserSpouseIncome !== undefined ? { lesserSpouseIncome } : {}),
      ...(federalPovertyGuideline !== undefined ? { federalPovertyGuideline } : {}),
      ...(capitalGain !== undefined ? { netCapitalGain: capitalGain } : {}),
      ...(locality !== undefined ? { locality: locality as LocalityCode } : {}),
      ...(yonkersEarnings !== undefined ? { yonkersNonresidentEarnings: yonkersEarnings } : {}),
      ...(qbi !== undefined || overtime !== undefined || tips !== undefined
        ? {
            federalDeductions: {
              ...(qbi !== undefined ? { qualifiedBusinessIncome: qbi } : {}),
              ...(overtime !== undefined ? { overtime } : {}),
              ...(tips !== undefined ? { tips } : {}),
            },
          }
        : {}),
    });

    // A locality's citations are the statutes behind a tax that can exceed the
    // state's, so they belong in Sources alongside it — de-duplicated, because
    // the Form IT-201 instructions are cited by both.
    const citations = [...result.citations, ...result.localTaxes.flatMap((l) => l.citations)].filter(
      (c, i, all) => all.findIndex((other) => other.url === c.url) === i,
    );
    const sourceLines = citations.map((c) => `- ${c.title} — ${c.url}`);
    return {
      text: `${renderStateTax(result)}\n\nSources:\n${sourceLines.join('\n')}`,
      structured: {
        state: result as unknown as Record<string, unknown>,
        sources: citations.map((c) => ({ title: c.title, url: c.url })),
      },
    };
  },
};

// ---------------------------------------------------------------------------
// describe_state
// ---------------------------------------------------------------------------

const describeStateTool: ToolDefinition = {
  name: 'describe_state',
  title: 'What a state needs, and what it does',
  description:
    'Say what state_income_tax needs for ONE state and what that state does that a rate table ' +
    'cannot hold. Returns the fields that state reads — required ones first — each with the form ' +
    'line it comes off and what happens if it is omitted, plus the state\'s conformity base, its ' +
    'local income taxes, its own notes and its statutes. Call it before state_income_tax for any ' +
    'state you have not computed before: an omitted per-state field is usually a WRONG answer ' +
    'rather than a missing one, because the engine falls back to a federal figure the state does ' +
    'not use. The documentation lives here and not in state_income_tax\'s schema, so that a caller ' +
    'pays for one state rather than twenty-eight.',
  inputSchema: {
    type: 'object',
    required: ['state'],
    additionalProperties: false,
    properties: {
      state: { type: 'string', enum: [...STATE_CODES], description: 'Two-letter state code.' },
      year: YEAR_PROPERTY,
      includeNotes: {
        type: 'boolean',
        description:
          "Include the state's own notes — what it taxes that others do not, and what this server " +
          'does not model. Defaults to true.',
      },
    },
  },
  annotations: { ...READ_ONLY, title: 'What a state needs, and what it does' },
  run(args) {
    const source = asRecord(args ?? {}, 'arguments');
    const known = ['state', 'year', 'includeNotes'];
    const unknown = Object.keys(source).filter((key) => !known.includes(key));
    if (unknown.length > 0) {
      throw new ToolInputError(
        `Unknown argument(s): ${unknown.join(', ')}. Accepted: ${known.join(', ')}.`,
      );
    }
    const state = source['state'];
    if (typeof state !== 'string' || !(STATE_CODES as readonly string[]).includes(state)) {
      throw new ToolInputError(
        `state must be one of ${STATE_CODES.join(', ')}, received ${JSON.stringify(state)}.`,
      );
    }
    const year =
      readNumber(source, 'year', { integer: true }) ?? STATE_YEARS[STATE_YEARS.length - 1]!;
    if (!(STATE_YEARS as readonly number[]).includes(year)) {
      throw new ToolInputError(
        `year must be one of ${STATE_YEARS.join(', ')}, received ${year}.`,
      );
    }
    const includeNotes = readBoolean(source, 'includeNotes') ?? true;

    const code = state as StateCode;
    const def = getStateDefinition(code, year);
    const fields = fieldsForState(state);
    const required = fields.filter((f) => (f.requiredIn ?? []).includes(state));
    const optional = fields.filter((f) => !(f.requiredIn ?? []).includes(state));

    const lines: string[] = [`# ${stateName(code)} (${code}), ${year}`];
    if (!def) {
      lines.push('');
      lines.push(
        `${stateName(code)} levies no individual income tax, so state_income_tax needs nothing ` +
          `beyond state, filingStatus and the federal figures, and returns zero.`,
      );
      return { text: lines.join('\n'), structured: { state: code, year, hasIncomeTax: false, fields: [] } };
    }

    lines.push('');
    lines.push(`Starts from: ${def.base}. Rate: ${def.rate.kind}.`);
    const counties = (COUNTY_TAX_STATES as readonly string[]).includes(state);
    if (counties) {
      lines.push(
        'EVERY resident owes a county income tax on the same taxable income, so `county` is ' +
          'effectively required: there is no county-free jurisdiction in this state.',
      );
    }

    const render = (field: (typeof fields)[number]) =>
      `### ${field.name} (${String((field.schema as { type?: string }).type ?? 'object')})\n${field.doc}`;

    if (required.length > 0) {
      lines.push('');
      lines.push('## Required');
      for (const field of required) lines.push(render(field));
    }
    if (optional.length > 0) {
      lines.push('');
      lines.push('## Read when supplied');
      for (const field of optional) lines.push(render(field));
    }
    if (required.length === 0 && optional.length === 0) {
      lines.push('');
      lines.push(
        'No per-state fields: this state is computed from the federal figures, dependents and ' +
          'the generic stateAdditions and stateSubtractions alone.',
      );
    }

    if (includeNotes && def.notes.length > 0) {
      lines.push('');
      lines.push('## Notes');
      for (const note of def.notes) lines.push(`- ${note}`);
    }
    lines.push('');
    lines.push('Sources:');
    for (const citation of def.citations) lines.push(`- ${citation.title} — ${citation.url}`);

    return {
      text: lines.join('\n'),
      structured: {
        state: code,
        stateName: stateName(code),
        year,
        hasIncomeTax: true,
        conformityBase: def.base,
        provisional: def.status === 'provisional',
        fields: fields.map((field) => ({
          name: field.name,
          type: String((field.schema as { type?: string }).type ?? 'object'),
          required: (field.requiredIn ?? []).includes(state),
          documentation: field.doc,
        })),
        notes: includeNotes ? [...def.notes] : [],
        sources: def.citations.map((c) => ({ title: c.title, url: c.url })),
      },
    };
  },
};

export const TOOLS: readonly ToolDefinition[] = [
  estimateTool,
  compareTool,
  marginalTool,
  quarterlyTool,
  paycheckTool,
  stateTool,
  describeStateTool,
  parametersTool,
  yearsTool,
];

export function findTool(name: string): ToolDefinition | undefined {
  return TOOLS.find((tool) => tool.name === name);
}
