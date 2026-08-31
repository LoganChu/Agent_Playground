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
  estimateFederalTax,
  getYearParameters,
  quarterlyEstimatedPayments,
  standardDeduction,
} from './engine/index.js';
import type { EstimateInput, EstimateResult, FilingStatus, YearParameters } from './engine/index.js';
import {
  FILING_STATUS_PROPERTY,
  ToolInputError,
  YEAR_PROPERTY,
  householdArgs,
  householdSchema,
  readBoolean,
  readHousehold,
  readNumber,
  toolOptions,
} from './schema.js';
import type { JsonSchema } from './schema.js';
import {
  dollars,
  money,
  percent,
  renderEstimate,
  renderQuarterly,
  statusLabel,
} from './format.js';

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
    '). Household fields are the same as estimate_federal_tax, which documents each one in full.',
  inputSchema: householdSchema(
    {
        years: {
        type: 'array',
        items: { type: 'integer', enum: [...SUPPORTED_YEARS] },
        minItems: 2,
        description: `Tax years to compare, ascending. Defaults to all of ${SUPPORTED_YEARS.join(', ')}.`,
      },
    },
    { verbosity: 'terse', includeYear: false },
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
    'tax all stack on top of it: a head-of-household filer with two children at $30,000 is in the 10% ' +
    'bracket and faces 21.06%, because the whole cost is earned-income-credit withdrawal. ' +
    'Use this for "should I take the raise", "what will this bonus cost me", "am I better off ' +
    'converting to a Roth", "what is my real marginal rate". Reports the ordinary bracket alongside ' +
    'the real number so the difference is visible. Household fields are the same as estimate_federal_tax, which documents each one in full.',
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
    { verbosity: 'terse' },
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
    '110% for higher earners) of last year. Household fields are the same as estimate_federal_tax, which documents each one in full.',
  inputSchema: householdSchema(
    {
      priorYearTotalTax: {
        type: 'number',
        minimum: 0,
        description:
          "Total tax from last year's return (Form 1040 line 24). Unlocks the prior-year safe harbor, " +
          'which is usually the cheaper of the two and is the only one that is certain in advance.',
      },
      priorYearAdjustedGrossIncome: {
        type: 'number',
        minimum: 0,
        description:
          "Last year's AGI. Above $150,000 ($75,000 filing separately) the prior-year safe harbor is " +
          '110% rather than 100%.',
      },
    },
    { verbosity: 'terse' },
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
    'Return the published parameters for a tax year: the ordinary rate brackets, the long-term ' +
    'capital gains brackets, the standard deduction and its age/blindness additions, the social ' +
    'security wage base and payroll rates, the Additional Medicare and NIIT thresholds, the SALT cap, ' +
    'the Section 199A thresholds, the Schedule 1-A caps and phase-outs, and the child tax credit and ' +
    'EITC tables — each cited to the IRS Revenue Procedure it came from. ' +
    'Use this when asked "what are the 2026 brackets", rather than answering from memory: the ' +
    'figures here are cross-checked against two independent sources, and the IRS has issued errata ' +
    'to two of these tables since first publication.',
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
        const upper = Number.isFinite(bracket.upTo) ? dollars(bracket.upTo) : 'and above';
        rows.push(
          `  ${percent(bracket.rate, 0).padStart(4)}  ${dollars(lower).padStart(12)} to ${upper}`,
        );
        lower = bracket.upTo;
      }
      rows.push('Long-term capital gains brackets:');
      lower = 0;
      for (const bracket of params.longTermCapitalGains[each]) {
        const upper = Number.isFinite(bracket.upTo) ? dollars(bracket.upTo) : 'and above';
        rows.push(
          `  ${percent(bracket.rate, 0).padStart(4)}  ${dollars(lower).padStart(12)} to ${upper}`,
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
      `SALT cap (${statusLabel(saltStatus)}): ${dollars(params.saltCap.cap[saltStatus])}, phasing down ` +
        `at ${percent(params.saltCap.phaseDownRate, 0)} of MAGI above ` +
        `${dollars(params.saltCap.phaseDownThreshold[saltStatus])} but never below ` +
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
    'List the tax years this server can compute, the IRS releases each one is sourced from, and — ' +
    'importantly — what is NOT modelled. Call this first if you are unsure whether a question is in ' +
    'scope, or before telling a user a figure is complete: AMT, state tax and several credits are ' +
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

export const TOOLS: readonly ToolDefinition[] = [
  estimateTool,
  compareTool,
  marginalTool,
  quarterlyTool,
  parametersTool,
  yearsTool,
];

export function findTool(name: string): ToolDefinition | undefined {
  return TOOLS.find((tool) => tool.name === name);
}
