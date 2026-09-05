/**
 * The household input surface, shared by every tool that computes tax.
 *
 * Two things live here and they are deliberately kept next to each other:
 * the JSON Schema an MCP client sees, and the coercion that turns a decoded
 * `tools/call` argument bag into an `EstimateInput`. Keeping them in one file
 * is what lets `test/schema.test.js` assert that every advertised property is
 * actually read, and that nothing is read without being advertised — the
 * failure mode for a hand-written tool schema is a field the model is invited
 * to send and the server silently drops.
 */
import { FILING_STATUSES, SUPPORTED_YEARS } from './engine/index.js';
import type { EstimateInput, FilingStatus, QualifiedBusiness } from './engine/index.js';

/** A caller-visible input problem. Reported as a tool error, not a protocol error. */
export class ToolInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolInputError';
  }
}

export type JsonSchema = Record<string, unknown>;

const money = (description: string): JsonSchema => ({ type: 'number', minimum: 0, description });

/**
 * Attach an authored short form to a property.
 *
 * The derived trim keeps the first sentence, which cannot tell an *example* from
 * a *definition* — and in a tax schema the clause after the colon is very often
 * the definition. "The FLSA premium portion of overtime pay under § 225 — the
 * excess over the regular rate, not total overtime wages" loses the whole point
 * of the field to any cut at the dash, and a filer's overtime deduction comes
 * back three times too big. The author can tell them apart; a regular expression
 * cannot. So where a mechanical trim would drop something operative, the short
 * form is written rather than derived, and `test/schema.test.js` asserts that
 * every authored form still names what the derived one would have kept.
 */
const withShortForm = (schema: JsonSchema, short: string): JsonSchema => ({
  ...schema,
  'x-terse': short,
});

const flag = (description: string): JsonSchema => ({ type: 'boolean', description });

const count = (description: string): JsonSchema => ({
  type: 'integer',
  minimum: 0,
  description,
});

export const FILING_STATUS_PROPERTY: JsonSchema = {
  type: 'string',
  enum: [...FILING_STATUSES],
  description:
    'Filing status. "qualifyingSurvivingSpouse" is the status a widow or widower with a dependent child uses for the two years after the year of death; it uses the joint rate schedule.',
};

export const YEAR_PROPERTY: JsonSchema = {
  type: 'integer',
  enum: [...SUPPORTED_YEARS],
  description: `Tax year, one of ${SUPPORTED_YEARS.join(', ')}, defaulting to ${
    SUPPORTED_YEARS[SUPPORTED_YEARS.length - 1]
  }. An unsupported year is an error rather than a silent fallback — computing one year's income with another year's brackets is the kind of mistake that stays invisible until it is expensive.`,
};

const QUALIFIED_BUSINESS_SCHEMA: JsonSchema = {
  type: 'object',
  required: ['qualifiedBusinessIncome'],
  properties: {
    name: { type: 'string', description: 'Label carried through to the result.' },
    qualifiedBusinessIncome: {
      type: 'number',
      description:
        'Qualified business income, which may be negative. Net of the deductions attributable to the business, including the deductible half of self-employment tax. Excludes S-corporation wages paid to the owner, guaranteed payments, capital gain and investment income.',
    },
    w2Wages: money('W-2 wages paid by this business and allocable to its QBI (§ 199A(b)(4)).'),
    unadjustedBasisOfQualifiedProperty: money(
      'UBIA: unadjusted basis of qualified property still inside its depreciable period (§ 199A(b)(2)(B)(ii)).',
    ),
    // The first sentence is deliberately short, because it is the whole
    // description in the three tools that ask for the terse schema. Putting the
    // twenty-item § 199A(d)(2) list in it made the single largest string in the
    // payload survive the trim and be carried four times instead of once: a trim
    // that reaches the biggest object still does nothing if the biggest object is
    // one sentence.
    isSpecifiedServiceTradeOrBusiness: flag(
      'True for a specified service trade or business under § 199A(d)(2). That covers health, law, accounting, actuarial science, performing arts, consulting, athletics, financial services, brokerage, investing, trading, dealing in securities, and any business whose principal asset is the reputation or skill of its owners. Engineering and architecture are excluded. Below the threshold this flag changes nothing.',
    ),
    materiallyParticipates: flag(
      'Whether the taxpayer materially participates (§ 469(h)). Used only by the § 199A(i) $400 minimum deduction. Defaults to true.',
    ),
  },
  additionalProperties: false,
};

/**
 * Every household property except `year`, which some tools fix themselves.
 *
 * Order matters only for readability in a client that renders the schema, but
 * the model reads these descriptions, so they are written for the model: each
 * one says what the number is, and where a naive caller would put the wrong
 * thing.
 */
export const HOUSEHOLD_PROPERTIES: Record<string, JsonSchema> = {
  filingStatus: FILING_STATUS_PROPERTY,

  w2Wages: money('Gross W-2 wages, before withholding.'),
  selfEmploymentNetProfit: money(
    'Net profit from self-employment (Schedule C line 31), before the deductible half of self-employment tax. 1099 / freelance / sole-proprietor income goes here, not in w2Wages.',
  ),
  otherOrdinaryIncome: withShortForm(
    money(
      'Income taxed at ordinary rates that is neither wages nor self-employment: interest, non-qualified dividends, retirement distributions, short-term capital gains, taxable social security.',
    ),
    'Income taxed at ordinary rates that is neither wages nor self-employment.',
  ),
  longTermCapitalGains: money(
    'Long-term capital gains and qualified dividends, taxed at preferential rates. These stack on top of ordinary income rather than being taxed in isolation.',
  ),
  netInvestmentIncome: money(
    'Investment income subject to the 3.8% net investment income tax. Defaults to longTermCapitalGains.',
  ),

  itemizedDeductions: money(
    'Total itemized deductions supplied as a finished, already-capped figure. Prefer stateAndLocalTaxesPaid plus otherItemizedDeductions, which apply the § 164(b)(6) cap for you; when those are given this is ignored.',
  ),
  stateAndLocalTaxesPaid: money(
    'State and local income (or sales), real property and personal property tax actually paid, BEFORE the § 164(b)(6) cap. The cap and its 2026 phase-down are applied for you.',
  ),
  otherItemizedDeductions: withShortForm(
    money(
      'Every itemized deduction other than SALT: mortgage interest, charitable contributions, medical expense over the 7.5%-of-AGI floor, investment interest. Not further limited by this server — see the coverage notes from list_supported_years.',
    ),
    'Every itemized deduction other than SALT, not further limited here.',
  ),

  qualifiedBusinesses: withShortForm(
    {
      type: 'array',
      items: QUALIFIED_BUSINESS_SCHEMA,
      description:
        'Each § 199A trade or business separately, so the deduction is computed rather than assumed — SSTB phase-out, W-2 wage and property cap, loss netting and the taxable income limit included. A single Schedule C is one entry. These describe income already reported through selfEmploymentNetProfit or otherOrdinaryIncome; listing a business here does not add income.',
    },
    'Each § 199A trade or business separately; one entry per Schedule C. Adds no income.',
  ),
  qualifiedBusinessIncomeDeduction: money(
    'A § 199A deduction you have already computed elsewhere. Ignored when qualifiedBusinesses is supplied.',
  ),
  qualifiedReitDividends: money('Qualified REIT dividends, deductible at 20% with no wage or property cap.'),
  qualifiedPtpIncome: {
    type: 'number',
    description: 'Qualified publicly traded partnership income, which may be negative.',
  },
  qualifiedBusinessNetLossCarryforward: money('Prior-year § 199A qualified business net loss carryforward.'),
  reitPtpLossCarryforward: money('Prior-year § 199A REIT/PTP loss carryforward.'),

  qualifiedTips: money(
    'Qualified tips under § 224, already filtered to tips that actually qualify (cash tips, a listed occupation, not an SSTB). This money is ALSO part of w2Wages or selfEmploymentNetProfit — the deduction subtracts it back out, it does not exclude it from income. 2025-2028 only.',
  ),
  qualifiedTipsBusinessIncomeLimit: money(
    'Net income of the trade or business in which self-employed tips were earned, which caps the § 224 deduction for a self-employed filer.',
  ),
  qualifiedOvertimeCompensation: withShortForm(
    money(
      'The FLSA PREMIUM PORTION of overtime pay under § 225 — the excess over the regular rate ("the half" in time-and-a-half), not total overtime wages. Also counted in w2Wages. 2025-2028 only.',
    ),
    'The FLSA PREMIUM PORTION of overtime under § 225 — the excess over the regular rate, NOT total overtime wages. 2025-2028.',
  ),
  qualifiedVehicleLoanInterest: money(
    'Interest on a qualifying post-2024 loan for a new US-assembled personal-use vehicle (§ 163(h)(4)). 2025-2028 only.',
  ),
  foreignEarnedIncomeExclusion: withShortForm(
    money(
      'Income excluded under § 911, § 931 or § 933, added back when computing modified AGI for the SALT phase-down, the Schedule 1-A phase-outs and the child tax credit.',
    ),
    'Income excluded under § 911, § 931 or § 933, added back into modified AGI.',
  ),

  age: {
    type: 'integer',
    minimum: 0,
    description:
      "The filer's age at the end of the year. Required for the earned income credit of a household with NO qualifying children, because § 32(c)(1)(A)(ii)(II) allows it only from 25 to 64. Without children and without this, the EITC is reported as null rather than guessed.",
  },
  age65OrOlder: flag('Filer is 65 or older. Adds the extra standard deduction and the OBBBA senior deduction.'),
  blind: flag('Filer is blind. Adds another extra standard deduction amount.'),
  spouseAge65OrOlder: flag('Spouse is 65 or older. Only meaningful on a joint return.'),
  spouseBlind: flag('Spouse is blind. Only meaningful on a joint return.'),

  qualifyingChildren: count(
    'Children under 17 at year end with a social security number valid for employment (§ 24(c), § 24(h)(7)). Supplying this turns on the child tax credit.',
  ),
  otherDependents: withShortForm(
    count(
      'Dependents worth the $500 credit for other dependents rather than the child tax credit: a child who turned 17, a dependent parent, a qualifying relative.',
    ),
    'Dependents worth the $500 credit rather than the child tax credit.',
  ),
  eitcQualifyingChildren: withShortForm(
    count(
      'Children meeting the § 32(c)(3) tests, which genuinely differ from § 24 — no age-17 cut-off for a permanently disabled child, and no requirement to claim the dependency exemption. Defaults to qualifyingChildren.',
    ),
    'Children meeting the § 32(c)(3) tests: no age-17 cut-off if permanently disabled. Defaults to qualifyingChildren.',
  ),
  disqualifiedInvestmentIncome: withShortForm(
    money(
      'Disqualified investment income for the § 32(i) cliff: taxable AND tax-exempt interest, dividends, net capital gain, net rental and royalty income, net passive income. Defaults to longTermCapitalGains, which is the only component that can be identified with certainty. A filer with substantial interest or ordinary dividends inside otherOrdinaryIncome should supply this explicitly.',
    ),
    'Investment income for the § 32(i) cliff: interest (taxable AND tax-exempt), dividends, capital gain, rent, royalties, passive income.',
  ),
  separatedFromSpouse: flag(
    'Whether a married-filing-separately filer meets § 32(d)(2) (living apart for the last six months, or a separation decree). Defaults to false, which bars the earned income credit.',
  ),
  taxpayerHasWorkAuthorizedSocialSecurityNumber: withShortForm(
    flag(
      'Whether the taxpayer, or a spouse on a joint return, has a social security number valid for employment, as OBBBA § 70104(c) requires from 2025 for the child portion of the § 24 credit. Defaults to true.',
    ),
    'Filer or spouse has a work-authorized SSN, required from 2025 for the § 24 child credit. Defaults to true.',
  ),
  employeeSocialSecurityAndMedicareTax: withShortForm(
    money(
      'Employee-share social security and Medicare tax withheld, used only by the § 24(d)(1)(B)(ii) alternative for families with three or more children. Defaults to the FICA implied by w2Wages.',
    ),
    'Employee-share FICA withheld; § 24(d)(1)(B)(ii) only. Defaults to the FICA implied by w2Wages.',
  ),

  federalWithholding: money('Federal income tax already withheld, used to compute the balance due or refund.'),
};

/**
 * The first sentence of a description.
 *
 * Four tools take the same ~30 household fields, and a client pays for every
 * `tools/list` byte in context on every session. The long descriptions are
 * worth their weight once — on `estimate_federal_tax`, which is where a model
 * goes to learn what the fields mean — and are pure repetition on the other
 * three. Deriving the short form from the long one rather than writing it twice
 * is what stops the two drifting apart.
 */
function firstSentence(text: string): string {
  const match = /^.*?[.!?](?=\s|$)/s.exec(text.trim());
  return (match ? match[0] : text).trim();
}

/**
 * Every household property with each description cut to its first sentence,
 * **including the descriptions nested inside an array's `items`**.
 *
 * The recursion is the whole point and it was missing for three releases. Four of
 * the eight tools carry this schema and only one carries it in full, so anything
 * the trimming does not reach is paid for four times in every session. The single
 * fattest object in the payload is `qualifiedBusinesses`, whose weight is entirely
 * in its item schema — which is exactly what a surface-only trim never touched.
 */
export function terseProperties(properties: Record<string, JsonSchema>): Record<string, JsonSchema> {
  return Object.fromEntries(
    Object.entries(properties).map(([key, schema]) => {
      let trimmed: JsonSchema = withoutTerse(schema);
      const items = schema['items'];
      if (items && typeof items === 'object' && !Array.isArray(items)) {
        const itemSchema = items as JsonSchema;
        const itemProperties = itemSchema['properties'];
        if (itemProperties && typeof itemProperties === 'object') {
          trimmed = {
            ...trimmed,
            items: {
              ...itemSchema,
              properties: terseProperties(itemProperties as Record<string, JsonSchema>),
            },
          };
        }
      }
      const authored = schema[TERSE_KEY];
      if (typeof authored === 'string') return [key, { ...trimmed, description: authored }];
      const description = trimmed['description'];
      if (typeof description !== 'string') return [key, trimmed];
      return [key, { ...trimmed, description: firstSentence(description) }];
    }),
  );
}

/**
 * The key an authored short form is written under. Never emitted: it is a
 * property of this codebase, not of the JSON Schema a client receives.
 */
export const TERSE_KEY = 'x-terse';

/** A property schema with the authoring key removed, ready to serialize. */
export function withoutTerse(schema: JsonSchema): JsonSchema {
  if (!(TERSE_KEY in schema)) return schema;
  const { [TERSE_KEY]: _dropped, ...rest } = schema;
  return rest;
}

/** Strip the authoring key from a whole property table. */
export function emitProperties(
  properties: Record<string, JsonSchema>,
): Record<string, JsonSchema> {
  return Object.fromEntries(
    Object.entries(properties).map(([key, schema]) => {
      let out = withoutTerse(schema);
      const items = schema['items'];
      if (items && typeof items === 'object' && !Array.isArray(items)) {
        const itemSchema = items as JsonSchema;
        const itemProperties = itemSchema['properties'];
        if (itemProperties && typeof itemProperties === 'object') {
          out = {
            ...out,
            items: {
              ...itemSchema,
              properties: emitProperties(itemProperties as Record<string, JsonSchema>),
            },
          };
        }
      }
      return [key, out];
    }),
  );
}

/**
 * The household schema as a complete `inputSchema`, plus a `year`.
 *
 * `verbosity: 'terse'` keeps every field but trims the prose — see
 * {@link terseProperties}. The tool's own `extra` properties are never trimmed,
 * since they are what distinguishes that tool.
 */
export interface HouseholdSchemaOptions {
  verbosity?: 'full' | 'terse';
  /**
   * Whether to advertise `year`.
   *
   * `compare_tax_years` takes `years` instead and refuses `year`, so it must not
   * advertise one — a schema that invites a field the tool rejects is worse than
   * no schema, because the model has no way to discover the mismatch except by
   * failing.
   */
  includeYear?: boolean;
}

export function householdSchema(
  extra: Record<string, JsonSchema> = {},
  options: HouseholdSchemaOptions = {},
): JsonSchema {
  const { verbosity = 'full', includeYear = true } = options;
  const terse = verbosity === 'terse';
  const base = terse ? terseProperties(HOUSEHOLD_PROPERTIES) : emitProperties(HOUSEHOLD_PROPERTIES);
  const year = terse ? terseProperties({ year: YEAR_PROPERTY })['year']! : YEAR_PROPERTY;
  return {
    type: 'object',
    required: ['filingStatus'],
    properties: { ...base, ...(includeYear ? { year } : {}), ...extra },
    additionalProperties: false,
  };
}

/** Every property name a household tool accepts, `year` included. */
export const HOUSEHOLD_KEYS: readonly string[] = [...Object.keys(HOUSEHOLD_PROPERTIES), 'year'];

export function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new ToolInputError(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function readNumber(
  source: Record<string, unknown>,
  key: string,
  options: { allowNegative?: boolean; integer?: boolean } = {},
): number | undefined {
  const raw = source[key];
  if (raw === undefined || raw === null) return undefined;
  // Models routinely send "85000" or "85,000" for a number field. Accepting a
  // clean numeric string is a kindness; accepting "a lot" is not.
  const value =
    typeof raw === 'string' && raw.trim() !== '' ? Number(raw.replace(/[$,\s]/g, '')) : raw;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ToolInputError(`${key} must be a finite number, received ${JSON.stringify(raw)}.`);
  }
  if (!options.allowNegative && value < 0) {
    throw new ToolInputError(`${key} must not be negative, received ${value}.`);
  }
  if (options.integer && !Number.isInteger(value)) {
    throw new ToolInputError(`${key} must be a whole number, received ${value}.`);
  }
  return value;
}

function readBoolean(source: Record<string, unknown>, key: string): boolean | undefined {
  const raw = source[key];
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === 'boolean') return raw;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new ToolInputError(`${key} must be true or false, received ${JSON.stringify(raw)}.`);
}

export function readFilingStatus(source: Record<string, unknown>): FilingStatus {
  const raw = source['filingStatus'];
  if (typeof raw !== 'string') {
    throw new ToolInputError(
      `filingStatus is required and must be one of: ${FILING_STATUSES.join(', ')}.`,
    );
  }
  if ((FILING_STATUSES as readonly string[]).includes(raw)) return raw as FilingStatus;
  // The four common ways a model spells these, mapped rather than rejected.
  const normalized = raw.toLowerCase().replace(/[^a-z]/g, '');
  const aliases: Record<string, FilingStatus> = {
    single: 'single',
    marriedfilingjointly: 'marriedFilingJointly',
    marriedjointly: 'marriedFilingJointly',
    joint: 'marriedFilingJointly',
    mfj: 'marriedFilingJointly',
    marriedfilingseparately: 'marriedFilingSeparately',
    marriedseparately: 'marriedFilingSeparately',
    separate: 'marriedFilingSeparately',
    mfs: 'marriedFilingSeparately',
    headofhousehold: 'headOfHousehold',
    hoh: 'headOfHousehold',
    qualifyingsurvivingspouse: 'qualifyingSurvivingSpouse',
    survivingspouse: 'qualifyingSurvivingSpouse',
    widow: 'qualifyingSurvivingSpouse',
    qss: 'qualifyingSurvivingSpouse',
  };
  const match = aliases[normalized];
  if (match) return match;
  throw new ToolInputError(
    `Unknown filingStatus ${JSON.stringify(raw)}. Expected one of: ${FILING_STATUSES.join(', ')}.`,
  );
}

function readBusinesses(source: Record<string, unknown>): QualifiedBusiness[] | undefined {
  const raw = source['qualifiedBusinesses'];
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw)) throw new ToolInputError('qualifiedBusinesses must be an array.');
  return raw.map((entry, index) => {
    const item = asRecord(entry, `qualifiedBusinesses[${index}]`);
    const qbi = readNumber(item, 'qualifiedBusinessIncome', { allowNegative: true });
    if (qbi === undefined) {
      throw new ToolInputError(
        `qualifiedBusinesses[${index}].qualifiedBusinessIncome is required.`,
      );
    }
    const business: Record<string, unknown> = { qualifiedBusinessIncome: qbi };
    if (typeof item['name'] === 'string') business['name'] = item['name'];
    const wages = readNumber(item, 'w2Wages');
    if (wages !== undefined) business['w2Wages'] = wages;
    const ubia = readNumber(item, 'unadjustedBasisOfQualifiedProperty');
    if (ubia !== undefined) business['unadjustedBasisOfQualifiedProperty'] = ubia;
    const sstb = readBoolean(item, 'isSpecifiedServiceTradeOrBusiness');
    if (sstb !== undefined) business['isSpecifiedServiceTradeOrBusiness'] = sstb;
    const active = readBoolean(item, 'materiallyParticipates');
    if (active !== undefined) business['materiallyParticipates'] = active;
    return business as unknown as QualifiedBusiness;
  });
}

const MONEY_KEYS = [
  'w2Wages',
  'selfEmploymentNetProfit',
  'otherOrdinaryIncome',
  'longTermCapitalGains',
  'netInvestmentIncome',
  'itemizedDeductions',
  'stateAndLocalTaxesPaid',
  'otherItemizedDeductions',
  'qualifiedBusinessIncomeDeduction',
  'qualifiedReitDividends',
  'qualifiedBusinessNetLossCarryforward',
  'reitPtpLossCarryforward',
  'qualifiedTips',
  'qualifiedTipsBusinessIncomeLimit',
  'qualifiedOvertimeCompensation',
  'qualifiedVehicleLoanInterest',
  'foreignEarnedIncomeExclusion',
  'disqualifiedInvestmentIncome',
  'employeeSocialSecurityAndMedicareTax',
  'federalWithholding',
] as const;

const COUNT_KEYS = ['qualifyingChildren', 'otherDependents', 'eitcQualifyingChildren', 'age'] as const;

const FLAG_KEYS = [
  'age65OrOlder',
  'blind',
  'spouseAge65OrOlder',
  'spouseBlind',
  'separatedFromSpouse',
  'taxpayerHasWorkAuthorizedSocialSecurityNumber',
] as const;

/**
 * Turn a `tools/call` argument bag into an `EstimateInput`.
 *
 * Absent keys are left absent rather than defaulted to zero, because the engine
 * distinguishes "no dependents supplied" from "zero dependents" in one place
 * that matters — an EITC that cannot be evaluated is reported as null, not as
 * zero.
 */
export function readHousehold(args: unknown): EstimateInput {
  const source = asRecord(args, 'arguments');

  const unknownKeys = Object.keys(source).filter((key) => !HOUSEHOLD_KEYS.includes(key));
  if (unknownKeys.length > 0) {
    throw new ToolInputError(
      `Unknown argument${unknownKeys.length > 1 ? 's' : ''}: ${unknownKeys.join(', ')}. ` +
        `Accepted: ${HOUSEHOLD_KEYS.join(', ')}.`,
    );
  }

  const input: Record<string, unknown> = { filingStatus: readFilingStatus(source) };

  const year = readNumber(source, 'year', { integer: true });
  if (year !== undefined) input['year'] = year;

  for (const key of MONEY_KEYS) {
    const value = readNumber(source, key);
    if (value !== undefined) input[key] = value;
  }
  for (const key of COUNT_KEYS) {
    const value = readNumber(source, key, { integer: true });
    if (value !== undefined) input[key] = value;
  }
  for (const key of FLAG_KEYS) {
    const value = readBoolean(source, key);
    if (value !== undefined) input[key] = value;
  }

  const ptp = readNumber(source, 'qualifiedPtpIncome', { allowNegative: true });
  if (ptp !== undefined) input['qualifiedPtpIncome'] = ptp;

  const businesses = readBusinesses(source);
  if (businesses !== undefined) input['qualifiedBusinesses'] = businesses;

  return input as unknown as EstimateInput;
}

/** Strip the household keys out of an argument bag, leaving a tool's own options. */
export function toolOptions(args: unknown): Record<string, unknown> {
  const source = asRecord(args, 'arguments');
  const options: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (!HOUSEHOLD_KEYS.includes(key)) options[key] = value;
  }
  return options;
}

/** The household half of an argument bag, for tools that add options of their own. */
export function householdArgs(args: unknown): Record<string, unknown> {
  const source = asRecord(args, 'arguments');
  const household: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (HOUSEHOLD_KEYS.includes(key)) household[key] = value;
  }
  return household;
}

export { readBoolean, readNumber };
