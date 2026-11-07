/**
 * A buyer's row, turned into a household this engine will answer.
 *
 * The audit's input schema is deliberately the **narrow** one: the fields a
 * payroll, planning or paycheck product already has on hand, under names it
 * would recognise. Everything the engine wants that can be derived from those
 * fields is derived, by the same code the differential grid uses — see
 * `householdInput` in `tools/differential/ours.mjs`, which is imported rather
 * than copied.
 *
 * **WHY THE SCHEMA IS NARROW AND SAYS SO.** A buyer who has to fill in
 * `longTermCapitalGainAfter2011` before they can run an audit will not run the
 * audit. A buyer who fills in six columns and gets a report has learned
 * something. The cost of the narrow schema is that a household with income this
 * schema cannot express is answered on the income it can — so the report names
 * every field it defaulted, per row, rather than letting a default pass for a
 * fact. That is the same contract `StateIncomeTaxResult.notes` has with a
 * caller, one level out.
 */
import { householdInput } from '../differential/ours.mjs';

/** Every column this schema reads, with the type it is read as. */
export const COLUMNS = Object.freeze({
  id: 'text',
  state: 'text',
  year: 'integer',
  filingStatus: 'text',
  wages: 'money',
  pension: 'money',
  socialSecurity: 'money',
  longTermCapitalGains: 'money',
  taxExemptInterest: 'money',
  primaryAge: 'integer',
  spouseAge: 'integer-or-blank',
  blind: 'integer',
  childAges: 'integer-list',
  county: 'text-or-blank',
  locality: 'text-or-blank',
  theirTax: 'money',
});

/** The four a row cannot be answered without. */
export const REQUIRED = Object.freeze(['state', 'year', 'filingStatus', 'theirTax']);

const FILING_STATUSES = new Set([
  'single',
  'marriedFilingJointly',
  'marriedFilingSeparately',
  'headOfHousehold',
  'qualifyingSurvivingSpouse',
]);

/** Spreadsheet money: `$1,234.56`, `(12.00)` for a negative, a bare number, or blank. */
export function readMoney(raw) {
  const text = String(raw ?? '').trim();
  if (text === '') return 0;
  const negated = /^\(.*\)$/.test(text);
  const digits = text.replace(/^\(|\)$/g, '').replace(/[$,\s]/g, '');
  if (!/^-?\d*\.?\d+$/.test(digits)) throw new Error(`not a number: ${JSON.stringify(raw)}`);
  return (negated ? -1 : 1) * Number(digits);
}

function readIntegerList(raw) {
  if (Array.isArray(raw)) return raw.map((value) => Math.trunc(Number(value)));
  const text = String(raw ?? '').trim();
  if (text === '') return [];
  return text
    .split(/[;|]/)
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .map((part) => {
      const value = Number(part);
      if (!Number.isFinite(value)) throw new Error(`not an age: ${JSON.stringify(part)}`);
      return Math.trunc(value);
    });
}

/**
 * One row, normalised — and a list of what was defaulted.
 *
 * The `defaulted` list is the honest half. A missing `earnedIncome` in
 * California computes CalEITC as zero; a missing `childAges` computes New
 * York's Empire State child credit as zero. Both are *this harness's* silence
 * rather than the buyer's engine being wrong, so both are reported on the row
 * they affected instead of being averaged into a headline.
 */
export function normaliseRow(raw, index) {
  const missing = REQUIRED.filter((key) => {
    const value = raw[key];
    return value === undefined || value === null || String(value).trim() === '';
  });
  if (missing.length > 0) {
    throw new Error(`row ${index + 1} is missing ${missing.join(', ')}`);
  }
  const filingStatus = String(raw.filingStatus).trim();
  if (!FILING_STATUSES.has(filingStatus)) {
    throw new Error(
      `row ${index + 1}: filingStatus ${JSON.stringify(filingStatus)} is not one of ` +
        [...FILING_STATUSES].join(', '),
    );
  }
  const unknown = Object.keys(raw).filter((key) => !(key in COLUMNS));

  const defaulted = [];
  const money = (key) => {
    const value = raw[key];
    if (value === undefined || value === null || String(value).trim() === '') {
      defaulted.push(`${key} treated as 0`);
      return 0;
    }
    return readMoney(value);
  };
  const childAges = readIntegerList(raw.childAges);
  const spouseAgeText = String(raw.spouseAge ?? '').trim();
  const joint = filingStatus === 'marriedFilingJointly' || filingStatus === 'marriedFilingSeparately';
  if (spouseAgeText === '' && joint) defaulted.push('spouseAge absent on a married return');
  const primaryAgeText = String(raw.primaryAge ?? '').trim();
  if (primaryAgeText === '') defaulted.push('primaryAge treated as 40');

  const household = {
    id: String(raw.id ?? `row-${index + 1}`),
    state: String(raw.state).trim().toUpperCase(),
    year: Math.trunc(Number(raw.year)),
    filingStatus,
    wages: money('wages'),
    pension: money('pension'),
    socialSecurity: money('socialSecurity'),
    longTermCapitalGains: money('longTermCapitalGains'),
    taxExemptInterest: money('taxExemptInterest'),
    primaryAge: primaryAgeText === '' ? 40 : Math.trunc(Number(primaryAgeText)),
    spouseAge: spouseAgeText === '' ? null : Math.trunc(Number(spouseAgeText)),
    blind: Math.trunc(Number(String(raw.blind ?? '').trim() || 0)),
    childAges,
    county: String(raw.county ?? '').trim() === '' ? null : { ours: String(raw.county).trim() },
    locality: String(raw.locality ?? '').trim() === '' ? null : String(raw.locality).trim(),
    oregonPriorYearTaxBeforeCredits: null,
  };
  if (!Number.isInteger(household.year)) throw new Error(`row ${index + 1}: year is not an integer`);
  return { household, theirTax: readMoney(raw.theirTax), defaulted, unknownColumns: unknown };
}

/**
 * The engine input for a normalised household.
 *
 * `locality` is spread on here rather than inside `householdInput` because the
 * differential grid has no localities and changing what it sends would change a
 * committed golden file for a reason that has nothing to do with the grid.
 */
export function engineInput(household) {
  const { fed, base } = householdInput(household);
  return {
    fed,
    base: { ...base, ...(household.locality ? { locality: household.locality } : {}) },
  };
}

/** A CSV with a header row. Quoted fields with embedded commas are handled. */
export function parseCsv(text) {
  const rows = [];
  let field = '';
  let row = [];
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      field = '';
      row = [];
    } else field += char;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const body = rows.filter((entry) => entry.some((cell) => cell.trim() !== ''));
  if (body.length === 0) throw new Error('the CSV is empty');
  const header = body[0].map((cell) => cell.trim());
  return body.slice(1).map((cells) => {
    const record = {};
    header.forEach((key, index) => {
      if (key !== '') record[key] = cells[index] ?? '';
    });
    return record;
  });
}

/** A `.csv` is a CSV and anything else is JSON — an array, or `{ rows: [...] }`. */
export function readRows(text, filename) {
  if (/\.csv$/i.test(filename)) return parseCsv(text);
  const parsed = JSON.parse(text);
  const rows = Array.isArray(parsed) ? parsed : parsed.rows;
  if (!Array.isArray(rows)) throw new Error('JSON input must be an array, or { "rows": [...] }');
  return rows;
}
