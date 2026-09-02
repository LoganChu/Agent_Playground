/**
 * States that apply a single rate — or, in Mississippi's case, a zero band and
 * then a single rate — to a base derived from federal adjusted gross income.
 *
 * Five of these eight changed their rate between 2025 and 2026. That is the reason
 * this package refuses to fall back to a neighbouring year: for Georgia, Indiana,
 * Kentucky, Mississippi, North Carolina and Utah, last year's rate is a number
 * that looks right and is wrong by between 1% and 12.5% of the bill.
 */
import type { StateIncomeTaxDefinition } from '../definition.js';
import { byStatus, perPerson, uniform } from './helpers.js';
import type { Citation } from '../types.js';

const AZ_CITATIONS: readonly Citation[] = [
  {
    title: 'Ariz. Rev. Stat. § 43-1011 — 2.5% individual income tax rate',
    url: 'https://www.azleg.gov/ars/43/01011.htm',
  },
  {
    title: 'Ariz. Rev. Stat. § 43-1041 — Arizona standard deduction equals the federal amount',
    url: 'https://www.azleg.gov/ars/43/01041.htm',
  },
];

function arizona(year: number): StateIncomeTaxDefinition {
  return {
    code: 'AZ',
    name: 'Arizona',
    year,
    status: 'published',
    base: 'federalAdjustedGrossIncome',
    rate: { kind: 'flat', rate: 0.025 },
    // The whole point of Arizona. A.R.S. § 43-1041(A) sets the Arizona standard
    // deduction *equal to* the federal one rather than to a number of its own, so
    // the OBBBA increase from $14,600/$29,200 to $15,750/$31,500 cut Arizona tax
    // in 2025 with no Arizona legislation and no Arizona announcement. Storing an
    // Arizona figure here would have been a transcription of the federal figure
    // with a lag.
    deduction: { kind: 'federal' },
    notes: [
      "Arizona's standard deduction is defined as equal to the federal standard deduction (A.R.S. § 43-1041(A)), so it follows federal changes automatically. The One Big Beautiful Bill Act's mid-2025 increase therefore cut Arizona tax for the 2025 tax year without any Arizona legislation.",
      'Arizona repealed its personal and dependent exemptions in 2019 and replaced them with a dependent tax credit, which this package does not compute. An Arizona return with dependents computed here will be too high by $100 per dependent under 17 and $25 per other dependent, subject to a phase-out.',
      'Arizona allows an increased standard deduction of 25% of charitable contributions for filers who do not itemize (A.R.S. § 43-1041(G)). Not modelled — supply it through `subtractions` if it applies.',
      'Arizona itemized deductions differ from federal ones, most importantly by disallowing state income taxes. Passing a federal itemized deduction through unchanged overstates the Arizona deduction.',
    ],
    citations: AZ_CITATIONS,
  };
}

const GA_CITATIONS: readonly Citation[] = [
  {
    title: 'O.C.G.A. § 48-7-20(a.1) — flat rate and its scheduled reductions',
    url: 'https://law.justia.com/codes/georgia/title-48/chapter-7/article-2/section-48-7-20/',
  },
  {
    title: 'Georgia HB 1437 (2022) — the flat tax, standard deduction, and repeal of the personal exemption',
    url: 'https://www.legis.ga.gov/legislation/61207',
  },
  {
    title: 'Georgia Department of Revenue — tax tables and rate schedule',
    url: 'https://dor.georgia.gov/tax-tables-georgia-tax-rate-schedule',
  },
];

const GA_NOTES: readonly string[] = [
  'Georgia repealed the personal exemption for the filer and spouse when it moved to a flat rate in 2024 (HB 1437) and replaced it with a much larger standard deduction. Only the dependent exemption survives. An engine carrying forward a pre-2024 Georgia personal exemption double-counts it.',
  'Georgia has no separate qualifying-surviving-spouse amount: HB 1437 sets the standard deduction at one figure "in the case of a married couple filing a joint return" and another "in the case of any other taxpayer", so a surviving spouse is treated here as any other taxpayer. PolicyEngine-US models the 2026 surviving-spouse standard deduction at the joint amount while modelling the 2025 one at the single amount; that internal inconsistency is why this package follows the statutory pattern instead.',
  'Not modelled: the Georgia retirement income exclusion, which is large ($35,000 at 62-64 and $65,000 at 65+ per taxpayer) and will make a retiree return computed here far too high.',
];

function georgia(year: number): StateIncomeTaxDefinition | undefined {
  if (year !== 2025 && year !== 2026) return undefined;
  const rate = year === 2025 ? 0.0519 : 0.0499;
  const single = year === 2025 ? 12000 : 15000;
  const joint = year === 2025 ? 24000 : 30000;
  const dependent = year === 2025 ? 4000 : 5000;
  return {
    code: 'GA',
    name: 'Georgia',
    year,
    status: 'published',
    base: 'federalAdjustedGrossIncome',
    rate: { kind: 'flat', rate },
    deduction: {
      kind: 'table',
      amounts: byStatus({
        single,
        joint,
        separate: single,
        headOfHousehold: single,
        qualifyingSurvivingSpouse: single,
      }),
    },
    exemption: { perFiler: uniform(0), perDependent: dependent },
    notes: GA_NOTES,
    citations: GA_CITATIONS,
  };
}

const IL_CITATIONS: readonly Citation[] = [
  {
    title: '35 Ill. Comp. Stat. 5/201(b) — 4.95% individual rate',
    url: 'https://www.ilga.gov/legislation/ilcs/fulltext.asp?DocName=003500050K201',
  },
  {
    title: '35 Ill. Comp. Stat. 5/204 — exemption allowance and its income limitation',
    url: 'https://www.ilga.gov/legislation/ilcs/fulltext.asp?DocName=003500050K204',
  },
  {
    title: 'Illinois Department of Revenue — Form IL-1040 instructions',
    url: 'https://tax.illinois.gov/forms/incometax/individual.html',
  },
];

const IL_NOTES: readonly string[] = [
  "Illinois' exemption allowance is not phased out — it is lost entirely at the first dollar of federal AGI above $250,000 ($500,000 on a joint return). One extra dollar of income at the threshold costs a single filer the whole $2,850 exemption, and $141.12 of tax on that single dollar. 35 ILCS 5/204(g).",
  'Illinois has no standard deduction and no itemized deductions. The exemption allowance is the only subtraction from base income that most filers get.',
  'Illinois does not tax retirement income — distributions from qualified plans, IRAs, and Social Security are all subtracted from base income. Supply them through `subtractions`; this package does not detect them.',
];

function illinois(year: number): StateIncomeTaxDefinition | undefined {
  if (year !== 2025 && year !== 2026) return undefined;
  // Indexed to CPI under 35 ILCS 5/204(d-5). $2,775 for 2024, $2,850 for 2025.
  const exemption = 2850;
  return {
    code: 'IL',
    name: 'Illinois',
    year,
    status: year === 2025 ? 'published' : 'provisional',
    base: 'federalAdjustedGrossIncome',
    rate: { kind: 'flat', rate: 0.0495 },
    deduction: { kind: 'none' },
    exemption: {
      perFiler: perPerson(exemption),
      perDependent: exemption,
      cliff: byStatus({
        single: 250_000,
        joint: 500_000,
        separate: 250_000,
        headOfHousehold: 250_000,
      }),
    },
    notes:
      year === 2026
        ? [
            'PROVISIONAL: the $2,850 exemption allowance is the published 2025 figure carried forward. Illinois indexes it annually to the Consumer Price Index under 35 ILCS 5/204(d-5) and had not published the 2026 amount when this was written. The 4.95% rate is fixed by statute and is correct.',
            ...IL_NOTES,
          ]
        : IL_NOTES,
    citations: IL_CITATIONS,
  };
}

const IN_CITATIONS: readonly Citation[] = [
  {
    title: 'Ind. Code § 6-3-2-1(a) — rate schedule, 3.00% in 2025 and 2.95% in 2026',
    url: 'https://iga.in.gov/laws/2024/ic/titles/6#6-3-2-1',
  },
  {
    title: 'Ind. Code § 6-3-1-3.5 — Indiana adjusted gross income and exemptions',
    url: 'https://iga.in.gov/laws/2024/ic/titles/6#6-3-1-3.5',
  },
];

function indiana(year: number): StateIncomeTaxDefinition | undefined {
  if (year !== 2025 && year !== 2026) return undefined;
  return {
    code: 'IN',
    name: 'Indiana',
    year,
    status: 'published',
    base: 'federalAdjustedGrossIncome',
    rate: { kind: 'flat', rate: year === 2025 ? 0.03 : 0.0295 },
    deduction: { kind: 'none' },
    exemption: { perFiler: perPerson(1000), perDependent: 1000 },
    notes: [
      'Every Indiana county levies its own income tax, from about 0.5% to over 3%, on the same base. This package computes the state tax only. For most Indiana filers the county tax is a third to a half again on top, so an Indiana result here is materially incomplete without it.',
      'Not modelled: the additional $1,500 exemption for each qualifying dependent child under 19 (or under 24 and a full-time student), and the additional $3,000 first-year exemption for an adopted child. An Indiana family return computed here is too high by about $44 per qualifying child in 2025.',
      "Indiana's statutory rate steps down each year: 3.05% in 2024, 3.00% in 2025, 2.95% in 2026, and 2.90% from 2027.",
    ],
    citations: IN_CITATIONS,
  };
}

const KY_CITATIONS: readonly Citation[] = [
  {
    title: 'Ky. Rev. Stat. § 141.020 — individual income tax rate',
    url: 'https://apps.legislature.ky.gov/law/statutes/statute.aspx?id=54585',
  },
  {
    title: 'Kentucky HB 1 (2025) — rate reduction to 3.5% for 2026',
    url: 'https://apps.legislature.ky.gov/record/25rs/hb1.html',
  },
  {
    title: 'Kentucky Department of Revenue — Form 740 instructions',
    url: 'https://revenue.ky.gov/Forms/Pages/Individual-Income-Tax-Forms.aspx',
  },
];

const KY_NOTES: readonly string[] = [
  "Kentucky's rate falls from 4.0% in 2025 to 3.5% in 2026 under HB 1 (2025), a 12.5% cut in the bill. Further reductions are conditional on revenue triggers in KRS 141.020(4) and are not scheduled.",
  'This package applies one standard deduction per return. Kentucky couples commonly file "married filing separately on a combined return" (Form 740 filing status 2), which claims two standard deductions on one form; that is worth $3,270 of deduction, about $131 of tax in 2025, and this package does not model it.',
  'Kentucky exempts all Social Security benefits and up to $31,110 per person of other pension income. Supply those through `subtractions`.',
];

function kentucky(year: number): StateIncomeTaxDefinition | undefined {
  if (year !== 2025 && year !== 2026) return undefined;
  return {
    code: 'KY',
    name: 'Kentucky',
    year,
    status: year === 2025 ? 'published' : 'provisional',
    base: 'federalAdjustedGrossIncome',
    rate: { kind: 'flat', rate: year === 2025 ? 0.04 : 0.035 },
    // Indexed annually. $3,160 for 2024, $3,270 for 2025.
    deduction: { kind: 'table', amounts: uniform(3270) },
    notes:
      year === 2026
        ? [
            'PROVISIONAL: the $3,270 standard deduction is the published 2025 figure carried forward. Kentucky indexes it annually under KRS 141.081 and had not published the 2026 amount when this was written. The 3.5% rate is set by HB 1 (2025) and is correct.',
            ...KY_NOTES,
          ]
        : KY_NOTES,
    citations: KY_CITATIONS,
  };
}

const MI_CITATIONS: readonly Citation[] = [
  {
    title: 'Mich. Comp. Laws § 206.51 — 4.25% individual income tax rate',
    url: 'https://www.legislature.mi.gov/Laws/MCL?objectName=MCL-206-51',
  },
  {
    title: 'Mich. Comp. Laws § 206.30(2) — personal exemption, indexed',
    url: 'https://www.legislature.mi.gov/Laws/MCL?objectName=MCL-206-30',
  },
];

const MI_NOTES: readonly string[] = [
  "Michigan's rate briefly fell to 4.05% for tax year 2023 under the MCL 206.51(1)(c) revenue trigger and returned to 4.25% for 2024. The trigger is a one-year reduction, not a permanent one, and the Michigan Supreme Court declined to make it permanent — a 2023 figure carried forward is 4.7% too low.",
  'Michigan cities levy their own income taxes — Detroit at 2.4% for residents, and 23 other cities. This package computes the state tax only.',
  'Michigan is phasing back in a deduction for retirement and pension income through 2026 (the "retirement tax" repeal). Not modelled; supply it through `subtractions`.',
];

function michigan(year: number): StateIncomeTaxDefinition | undefined {
  if (year !== 2025 && year !== 2026) return undefined;
  // Indexed. $5,600 for 2024, $5,800 for 2025.
  const exemption = 5800;
  return {
    code: 'MI',
    name: 'Michigan',
    year,
    status: year === 2025 ? 'published' : 'provisional',
    base: 'federalAdjustedGrossIncome',
    rate: { kind: 'flat', rate: 0.0425 },
    deduction: { kind: 'none' },
    exemption: { perFiler: perPerson(exemption), perDependent: exemption },
    notes:
      year === 2026
        ? [
            'PROVISIONAL: the $5,800 personal exemption is the published 2025 figure carried forward. Michigan indexes it annually under MCL 206.30(2) and had not published the 2026 amount when this was written. The 4.25% rate is set by statute and is correct.',
            ...MI_NOTES,
          ]
        : MI_NOTES,
    citations: MI_CITATIONS,
  };
}

const NC_CITATIONS: readonly Citation[] = [
  {
    title: 'N.C. Gen. Stat. § 105-153.7 — rate schedule',
    url: 'https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_105/GS_105-153.7.html',
  },
  {
    title: 'N.C. Gen. Stat. § 105-153.5 — standard deduction and child deduction',
    url: 'https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_105/GS_105-153.5.html',
  },
  {
    title: 'North Carolina Department of Revenue — tax rate schedules',
    url: 'https://www.ncdor.gov/taxes-forms/individual-income-tax/tax-rate-schedules',
  },
];

function northCarolina(year: number): StateIncomeTaxDefinition | undefined {
  if (year !== 2025 && year !== 2026) return undefined;
  return {
    code: 'NC',
    name: 'North Carolina',
    year,
    // The standard deduction is a fixed statutory figure rather than an indexed
    // one, so unlike Illinois or Michigan there is nothing here waiting on a
    // release: the 2026 amounts are already law.
    status: 'published',
    base: 'federalAdjustedGrossIncome',
    rate: { kind: 'flat', rate: year === 2025 ? 0.0425 : 0.0399 },
    deduction: {
      kind: 'table',
      amounts: byStatus({
        single: 12750,
        joint: 25500,
        separate: 12750,
        headOfHousehold: 19125,
      }),
    },
    notes: [
      "North Carolina's rate steps down by statute: 4.50% in 2024, 4.25% in 2025, 3.99% in 2026, and lower still from 2027 if revenue triggers in G.S. 105-153.7(a2) are met.",
      'Not modelled: the North Carolina child deduction, worth up to $3,000 per qualifying child and phasing to zero as AGI rises (G.S. 105-153.5(a1)). A North Carolina family return computed here is too high — by up to $120 per child in 2026.',
      'North Carolina does not tax Social Security benefits and exempts certain military retirement pay. Supply those through `subtractions`.',
    ],
    citations: NC_CITATIONS,
  };
}

const MS_CITATIONS: readonly Citation[] = [
  {
    title: 'Miss. Code Ann. § 27-7-5 — rates, and the zero bracket on the first $10,000',
    url: 'https://law.justia.com/codes/mississippi/title-27/chapter-7/article-1/section-27-7-5/',
  },
  {
    title: 'Mississippi HB 1 (2025) — Build Up Mississippi Act rate schedule',
    url: 'https://billstatus.ls.state.ms.us/2025/pdf/history/HB/HB0001.xml',
  },
  {
    title: 'Mississippi Department of Revenue — tax rates, exemptions and deductions',
    url: 'https://www.dor.ms.gov/individual/tax-rates',
  },
];

function mississippi(year: number): StateIncomeTaxDefinition | undefined {
  if (year !== 2025 && year !== 2026) return undefined;
  return {
    code: 'MS',
    name: 'Mississippi',
    year,
    status: 'published',
    base: 'federalAdjustedGrossIncome',
    rate: {
      kind: 'brackets',
      byStatus: {
        // The $10,000 zero bracket is per return and is NOT doubled on a joint
        // return, which is the opposite of the Mississippi exemption immediately
        // below it. Same schedule for every filing status.
        single: [
          { rate: 0, upTo: 10_000 },
          { rate: year === 2025 ? 0.044 : 0.04, upTo: Infinity },
        ],
        marriedFilingJointly: [
          { rate: 0, upTo: 10_000 },
          { rate: year === 2025 ? 0.044 : 0.04, upTo: Infinity },
        ],
        marriedFilingSeparately: [
          { rate: 0, upTo: 10_000 },
          { rate: year === 2025 ? 0.044 : 0.04, upTo: Infinity },
        ],
        headOfHousehold: [
          { rate: 0, upTo: 10_000 },
          { rate: year === 2025 ? 0.044 : 0.04, upTo: Infinity },
        ],
        qualifyingSurvivingSpouse: [
          { rate: 0, upTo: 10_000 },
          { rate: year === 2025 ? 0.044 : 0.04, upTo: Infinity },
        ],
      },
    },
    deduction: {
      kind: 'table',
      amounts: byStatus({ single: 2300, joint: 4600, separate: 2300, headOfHousehold: 3400 }),
    },
    exemption: {
      perFiler: byStatus({ single: 6000, joint: 12000, separate: 6000, headOfHousehold: 8000 }),
      perDependent: 1500,
    },
    notes: [
      'The first $10,000 of Mississippi taxable income is taxed at 0%, and that bracket is per return: it is not doubled on a joint return, even though the exemption and the standard deduction both are.',
      "Mississippi's rate falls from 4.7% in 2024 to 4.4% in 2025 and 4.0% in 2026 under the Build Up Mississippi Act, with further reductions toward zero conditional on revenue triggers.",
      'Mississippi does not tax qualified retirement income, including Social Security, IRA and 401(k) distributions taken at retirement age. Supply those through `subtractions`.',
    ],
    citations: MS_CITATIONS,
  };
}

export function flatStates(year: number): StateIncomeTaxDefinition[] {
  return [
    arizona(year),
    georgia(year),
    illinois(year),
    indiana(year),
    kentucky(year),
    michigan(year),
    northCarolina(year),
    mississippi(year),
  ].filter((d): d is StateIncomeTaxDefinition => d !== undefined);
}
