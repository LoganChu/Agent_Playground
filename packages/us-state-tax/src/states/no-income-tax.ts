/**
 * The nine states with no individual income tax on wages, for 2025 and 2026.
 *
 * These are not filler. Getting them right means saying *why* each one is zero and
 * what is still taxed, because two of the nine changed inside the last two years
 * and one of them still taxes something:
 *
 * - **New Hampshire** taxed interest and dividends until 2024. The repeal was
 *   accelerated to tax years beginning on or after 1 January 2025, so a package
 *   whose New Hampshire rules were written in 2023 taxes income that no longer
 *   exists — the 2023 legislation had the repeal landing in 2027.
 * - **Washington** has no income tax and a 7% excise tax on long-term capital
 *   gains above an indexed standard deduction, plus a further 2.9 point surcharge
 *   on gains above $1,000,000 enacted in 2025. "No income tax" is true and
 *   incomplete, and the difference is worth tens of thousands of dollars to the
 *   people who ask.
 * - **Tennessee's** Hall income tax on interest and dividends was fully repealed
 *   for tax years beginning on or after 1 January 2021.
 */
import type { StateIncomeTaxDefinition } from '../definition.js';
import type { Citation, StateCode } from '../types.js';

interface NoTaxState {
  readonly code: StateCode;
  readonly name: string;
  readonly notes: readonly string[];
  readonly citations: readonly Citation[];
}

const STATES: readonly NoTaxState[] = [
  {
    code: 'AK',
    name: 'Alaska',
    notes: [
      'Alaska has no individual income tax and no state sales tax. It is the only state with neither.',
      'The Permanent Fund Dividend is not taxed by Alaska, but it is federally taxable income and belongs in federal AGI.',
    ],
    citations: [
      {
        title: 'Alaska Stat. § 43.20.012 — repeal of the individual income tax',
        url: 'https://www.akleg.gov/basis/statutes.asp#43.20.012',
      },
    ],
  },
  {
    code: 'FL',
    name: 'Florida',
    notes: [
      'Florida has no individual income tax; the state constitution forbids one without an amendment.',
    ],
    citations: [
      {
        title: 'Fla. Const. art. VII, § 5(a)',
        url: 'https://www.flsenate.gov/Laws/Constitution#A7S05',
      },
    ],
  },
  {
    code: 'NV',
    name: 'Nevada',
    notes: [
      'Nevada has no individual income tax; the state constitution forbids one.',
      'Nevada levies a Modified Business Tax on employer payroll. It is an employer tax and never appears on an employee paycheck.',
    ],
    citations: [
      {
        title: 'Nev. Const. art. 10, § 1(9)',
        url: 'https://www.leg.state.nv.us/const/nvconst.html#Art10Sec1',
      },
    ],
  },
  {
    code: 'NH',
    name: 'New Hampshire',
    notes: [
      'New Hampshire has never taxed wages, and its tax on interest and dividends was repealed for tax years beginning on or after 1 January 2025. Tax year 2024 was the last year any New Hampshire individual income tax applied.',
      'The repeal was accelerated: 2021 legislation phased the tax out through 2026, and the 2023 budget moved the final year forward to 2024. A rule written from the earlier schedule taxes 2025 and 2026 interest and dividends that are not taxable.',
    ],
    citations: [
      {
        title: 'N.H. Rev. Stat. Ann. ch. 77 — Taxation of Incomes',
        url: 'https://www.gencourt.state.nh.us/rsa/html/V/77/77-mrg.htm',
      },
      {
        title: 'N.H. Laws of 2023, ch. 79 (HB 2), repealing RSA 77 effective for taxable periods beginning after 31 December 2024',
        url: 'https://www.gencourt.state.nh.us/bill_status/billinfo.aspx?id=1074&inflect=2',
      },
    ],
  },
  {
    code: 'SD',
    name: 'South Dakota',
    notes: ['South Dakota has no individual income tax.'],
    citations: [
      {
        title: 'South Dakota Department of Revenue — Individual taxes',
        url: 'https://dor.sd.gov/individuals/taxes/',
      },
    ],
  },
  {
    code: 'TN',
    name: 'Tennessee',
    notes: [
      'Tennessee has no tax on wages. The Hall income tax on interest and dividends was fully repealed for tax years beginning on or after 1 January 2021.',
    ],
    citations: [
      {
        title: 'Tenn. Code Ann. § 67-2-102 (Hall income tax, repealed)',
        url: 'https://www.tn.gov/revenue/taxes/hall-income-tax.html',
      },
    ],
  },
  {
    code: 'TX',
    name: 'Texas',
    notes: [
      'Texas has no individual income tax. A 2019 constitutional amendment requires a further amendment to impose one.',
    ],
    citations: [
      {
        title: 'Tex. Const. art. VIII, § 24-a',
        url: 'https://statutes.capitol.texas.gov/Docs/CN/htm/CN.8.htm',
      },
    ],
  },
  {
    code: 'WA',
    name: 'Washington',
    notes: [
      'Washington has no individual income tax on wages.',
      'Washington does levy a 7% excise tax on long-term capital gains above an annually indexed standard deduction, with an additional 2.9 percentage points on gains above $1,000,000 enacted in 2025 (SB 5813). This package does not compute it. A Washington filer with a large long-term gain owes Washington tax even though Washington has no income tax, and "no income tax" is the answer that gets that wrong.',
      'Real estate sales, retirement account distributions and most business asset sales are excluded from the capital gains excise tax.',
    ],
    citations: [
      {
        title: 'Wash. Rev. Code ch. 82.87 — Capital gains excise tax',
        url: 'https://app.leg.wa.gov/RCW/default.aspx?cite=82.87',
      },
      {
        title: 'Washington SB 5813 (2025) — additional rate on gains above $1,000,000',
        url: 'https://app.leg.wa.gov/billsummary?BillNumber=5813&Year=2025',
      },
    ],
  },
  {
    code: 'WY',
    name: 'Wyoming',
    notes: ['Wyoming has no individual income tax.'],
    citations: [
      {
        title: 'Wyoming Department of Revenue',
        url: 'https://revenue.wyo.gov/',
      },
    ],
  },
];

export const NO_INCOME_TAX_STATES: readonly StateCode[] = STATES.map((s) => s.code);

export const NO_INCOME_TAX_NAMES: Readonly<Record<string, string>> = Object.fromEntries(
  STATES.map((s) => [s.code, s.name]),
);

export function noIncomeTaxDefinitions(year: number): StateIncomeTaxDefinition[] {
  return STATES.map((s) => ({
    code: s.code,
    name: s.name,
    year,
    // Nothing here is indexed, and nothing here is pending a release: a state with
    // no income tax has no figure that can arrive later.
    status: 'published' as const,
    base: 'stateDefined' as const,
    rate: { kind: 'none' as const },
    deduction: { kind: 'none' as const },
    notes: s.notes,
    citations: s.citations,
  }));
}
