/**
 * Colorado and Idaho — the two supported states that start from **federal taxable
 * income** rather than federal AGI.
 *
 * This is the conformity choice with the largest consequences, and the two states
 * demonstrate opposite halves of it.
 *
 * Starting below the federal standard deduction means a state inherits every
 * federal change to it. Neither legislature acted in 2025, and both states' tax
 * fell anyway when the One Big Beautiful Bill Act raised the federal standard
 * deduction from $14,600 to $15,750 in July of that year. In Colorado that is
 * $50.60 of tax per single filer; in Idaho $60.95. No Colorado or Idaho form
 * changed, and no state announcement was made, because nothing in state law
 * changed.
 *
 * Then they diverge. **Idaho conformed to the OBBBA in full**, passing legislation
 * in 2026 that adopts the four Schedule 1-A deductions retroactively for 2025 —
 * so an Idaho waiter's tip deduction reduces Idaho tax too. **Colorado did not.**
 * It has added the § 199A qualified business income deduction back since 2021, and
 * from 2026 adds back the qualified overtime deduction as well (HB25-1296) — while
 * still allowing the tips deduction directly beside it on the same federal form.
 *
 * "Starts from federal taxable income" is therefore not "passes federal taxable
 * income through", and the difference is a list of statutes that changes annually.
 */
import type { StateIncomeTaxDefinition } from '../definition.js';
import { byStatusOf } from './helpers.js';
import type { Bracket, Citation } from '../types.js';

const CO_CITATIONS: readonly Citation[] = [
  {
    title: 'Colo. Rev. Stat. § 39-22-104 — rate, additions, and the QBI add-back',
    url: 'https://law.justia.com/codes/colorado/title-39/article-22/part-1/section-39-22-104/',
  },
  {
    title: 'Colorado Proposition 121 (2022) — rate reduced to 4.40%',
    url: 'https://leg.colorado.gov/sites/default/files/initiative%2520referendum_proposition%20121%20final%20lc%20packet.pdf',
  },
  {
    title: 'Colorado HB25-1296 (2025) § 6 — overtime compensation add-back, C.R.S. § 39-22-104(3)(u), from tax year 2026',
    url: 'https://content.leg.colorado.gov/sites/default/files/2025a_1296_signed.pdf#page=6',
  },
  {
    title: 'Colorado Individual Income Tax Guide — Part 3, Additions to Taxable Income',
    url: 'https://tax.colorado.gov/individual-income-tax-guide',
  },
];

const CO_NOTES: readonly string[] = [
  'Colorado starts from federal taxable income, so it inherits the federal standard or itemized deduction. The One Big Beautiful Bill Act raised that deduction in July 2025 and thereby cut Colorado tax for tax year 2025 with no Colorado legislation.',
  'Colorado does NOT allow the federal Section 199A qualified business income deduction: it is added back to Colorado taxable income under C.R.S. § 39-22-104(3)(o). This package adds it back automatically when you pass `federalDeductions.qualifiedBusinessIncome`.',
  'From tax year 2026 Colorado also adds back the federal qualified overtime deduction (HB25-1296), but not the qualified tips deduction sitting beside it on Schedule 1-A. Pass `federalDeductions.overtime`.',
  'Not modelled: the Colorado add-back of state income tax deducted federally on Schedule A, and the add-back of federal deductions above $12,000 ($16,000 joint) for filers with AGI of $300,000 or more (C.R.S. § 39-22-104(3)(p.5)). A high-income Colorado itemizer computed here will be too low. Supply both through `additions`.',
  "Colorado's 4.40% rate can be reduced for a single tax year by the TABOR surplus mechanism in C.R.S. § 39-22-627 — it was 4.25% for tax year 2024 on that basis, and returned to 4.40% for 2025. The reduction is determined after the year ends, so any Colorado rate is provisional until the state closes its books.",
];

function colorado(year: number): StateIncomeTaxDefinition | undefined {
  if (year !== 2025 && year !== 2026) return undefined;
  return {
    code: 'CO',
    name: 'Colorado',
    year,
    // 2026 is provisional for the same reason 2024 turned out not to be 4.40%:
    // the TABOR mechanism can reduce the rate retroactively.
    status: year === 2025 ? 'published' : 'provisional',
    base: 'federalTaxableIncome',
    rate: { kind: 'flat', rate: 0.044 },
    // Colorado has no deduction of its own; the federal one is already inside the
    // starting point.
    deduction: { kind: 'none' },
    addBacks: year === 2026 ? ['qualifiedBusinessIncome', 'overtime'] : ['qualifiedBusinessIncome'],
    notes:
      year === 2026
        ? [
            'PROVISIONAL: the 4.40% rate is the statutory figure. Colorado can reduce it for a single year under the TABOR surplus mechanism (C.R.S. § 39-22-627), which is determined after the tax year ends — it produced 4.25% for tax year 2024. Treat 2026 as an upper bound until Colorado closes its books.',
            ...CO_NOTES,
          ]
        : CO_NOTES,
    citations: CO_CITATIONS,
  };
}

const ID_CITATIONS: readonly Citation[] = [
  {
    title: 'Idaho Code § 63-3024 — individual income tax rate and zero bracket',
    url: 'https://legislature.idaho.gov/statutesrules/idstat/Title63/T63CH30/SECT63-3024/',
  },
  {
    title: 'Idaho HB 40 (2025) — rate reduced from 5.695% to 5.3%, retroactive to 1 January 2025',
    url: 'https://legislature.idaho.gov/sessioninfo/2025/legislation/H0040/',
  },
  {
    title: 'Idaho State Tax Commission — filing 2025 Idaho income taxes now that conformity is law',
    url: 'https://tax.idaho.gov/pressrelease/update-on-filing-2025-idaho-income-taxes-now-that-conformity-is-law/',
  },
];

const ID_NOTES: readonly string[] = [
  'Idaho starts from federal taxable income, so it inherits the federal standard or itemized deduction, the Section 199A qualified business income deduction, and — for 2025 through 2028 — all four OBBBA Schedule 1-A deductions. Idaho adopted the OBBBA by conformity legislation after the federal act passed, so the adoption is retroactive to tax year 2025.',
  'Idaho cut its rate from 5.695% to 5.3% retroactively for 2025 under HB 40 (2025). A 2025 Idaho return computed on the pre-HB 40 rate is 7.5% too high.',
  'The Idaho zero bracket is $4,811 of taxable income for single and married-filing-separately filers and $9,622 for joint, head of household and surviving spouse filers — head of household gets the doubled amount, which is unusual.',
  'Not modelled: the Idaho grocery credit, the child tax credit, and the deduction for retirement benefits. An Idaho return computed here will be too high for filers who qualify for any of them.',
];

/** Idaho's zero bracket is doubled for joint filers *and* for head of household. */
function idahoBrackets(zeroBracket: number, rate: number) {
  const single: readonly Bracket[] = [
    { rate: 0, upTo: zeroBracket },
    { rate, upTo: Infinity },
  ];
  const doubled: readonly Bracket[] = [
    { rate: 0, upTo: zeroBracket * 2 },
    { rate, upTo: Infinity },
  ];
  return byStatusOf<readonly Bracket[]>({
    single,
    separate: single,
    joint: doubled,
    headOfHousehold: doubled,
  });
}

function idaho(year: number): StateIncomeTaxDefinition | undefined {
  if (year !== 2025 && year !== 2026) return undefined;
  return {
    code: 'ID',
    name: 'Idaho',
    year,
    status: year === 2025 ? 'published' : 'provisional',
    base: 'federalTaxableIncome',
    rate: { kind: 'brackets', byStatus: idahoBrackets(4811, 0.053) },
    deduction: { kind: 'none' },
    notes:
      year === 2026
        ? [
            'PROVISIONAL: the $4,811 zero bracket is the published 2025 figure carried forward. Idaho indexes it annually and had not published the 2026 amount when this was written. The 5.3% rate is set by HB 40 (2025) and is correct.',
            ...ID_NOTES,
          ]
        : ID_NOTES,
    citations: ID_CITATIONS,
  };
}

export function federalTaxableBaseStates(year: number): StateIncomeTaxDefinition[] {
  return [colorado(year), idaho(year)].filter(
    (d): d is StateIncomeTaxDefinition => d !== undefined,
  );
}
