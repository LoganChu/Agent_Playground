/**
 * States that apply a single rate — or, in Mississippi's case, a zero band and
 * then a single rate — to a base derived from federal adjusted gross income.
 *
 * Five of these eight changed their rate between 2025 and 2026. That is the reason
 * this package refuses to fall back to a neighbouring year: for Georgia, Indiana,
 * Kentucky, Mississippi, North Carolina and Utah, last year's rate is a number
 * that looks right and is wrong by between 1% and 12.5% of the bill.
 */
import type { ConditionalNote, StateIncomeTaxDefinition } from '../definition.js';
import { byStatus, perPerson, uniform, whenMilitaryRetirement } from './helpers.js';
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
  {
    title:
      'O.C.G.A. § 48-7-27(a)(5) and (a)(5.1) — the retirement income exclusion and the military retirement exclusion',
    url: 'https://law.justia.com/codes/georgia/title-48/chapter-7/article-2/section-48-7-27/',
  },
  {
    title:
      'Georgia Department of Revenue — Retirement Income Exclusion, and the IT-511 Schedule 1 worksheets',
    url: 'https://dor.georgia.gov/retirement-income-exclusion',
  },
  {
    title:
      'Georgia HB 463 (2026) — 4.99% for 2026 and annual cuts to 3.99%, the $70,000 exclusion from 2027, and the 2026-2028 overtime and cash tip exclusions',
    url: 'https://www.legis.ga.gov/legislation/70350',
  },
];

const GA_NOTES: readonly string[] = [
  'Georgia repealed the personal exemption for the filer and spouse when it moved to a flat rate in 2024 (HB 1437) and replaced it with a much larger standard deduction. Only the dependent exemption survives. An engine carrying forward a pre-2024 Georgia personal exemption double-counts it. The additional $1,300 standard deduction for a filer or spouse aged 65 or over or blind went the same way and is not available from 2024 either, so age buys nothing on the deduction line in Georgia — it buys the retirement income exclusion instead.',
  'Georgia has no separate qualifying-surviving-spouse amount: HB 1437 sets the standard deduction at one figure "in the case of a married couple filing a joint return" and another "in the case of any other taxpayer", so a surviving spouse is treated here as any other taxpayer. PolicyEngine-US models the 2026 surviving-spouse standard deduction at the joint amount while modelling the 2025 one at the single amount; that internal inconsistency is why this package follows the statutory pattern instead.',
  'The retirement income exclusion of O.C.G.A. § 48-7-27(a)(5) is PER PERSON and is measured on the CHARACTER of the income, not on the plan it came from: interest, dividends, net capital gain, net rents, royalties, alimony received, taxable pensions and taxable IRA distributions all qualify in full. Pass `retirement` with a `filer` and a `spouse`. It is $35,000 for a person aged 62 to 64 — or permanently and totally disabled at any age — and $65,000 at 65 or over, rising to $70,000 at 65 from 2027 under HB 463.',
  'At most $5,000 of one person\'s EARNED income may enter the exclusion, so Georgia\'s exclusion is a test on the type of a retiree\'s income and not on its amount. In 2026 a single 65-year-old with $65,000 of dividends excludes all of it and owes nothing, while one with $65,000 of wages excludes $5,000 and owes $2,245.50 — the whole bill, on identical income at an identical age. Georgia treats partnership and S corporation income as earned for this purpose, so an active owner\'s distributive share is inside the $5,000 cap and a passive investor\'s interest and dividends are not. The $5,000 figure has applied since 2024; most summaries still print the $4,000 that preceded it.',
  'Because net capital gain is in the qualifying pool and the allowance is annual, per person and use-it-or-lose-it, Georgia\'s "retirement income exclusion" is also a capital gains allowance: a couple both 65 with no other income may realise $130,000 of gain every year and owe Georgia nothing on it. No guide to the provision says so, because of what it is called.',
  'Georgia and Maryland use the same words for opposite constructions, and the difference decides the commonest question in retirement planning. Georgia counts taxable IRA distributions in full, so rolling a 401(k) into an IRA costs a Georgia retiree nothing; Maryland\'s § 10-209(a) writes an IRA out of its exclusion by name, so the same rollover costs a Montgomery County retiree $3,378.83 a year at $150,000, for life. And Georgia subtracts taxable Social Security separately without charging it against the exclusion, where Maryland reduces the exclusion by the whole benefit received. Put IRA money in `retirement.filer.iraDistributions`, not in `employerPlanPension`.',
  'Georgia does not tax Social Security or Tier 1 railroad retirement benefits. Pass the taxable part — Form 1040 line 6b — as `taxableSocialSecurity` and it comes off the base; do NOT also put it in `subtractions`, or it will be subtracted twice.',
  'Not modelled: the low income credit of O.C.G.A. § 48-7-29.7, which is at most $26 per exemption and is gone at $20,000 of federal AGI; the $4,000-per-return exclusion for income from a disability retirement; the Georgia 529 (Path2College) contribution subtraction; the child and dependent care credit (30% of the federal credit); the qualified education expense and rural hospital credits; and the surplus tax refund, which is not part of the return. Pass any of these through `subtractions` if you have them.',
];

const GA_MILITARY_NOTES: readonly ConditionalNote[] = [
  { text: 'The military retirement exclusion of § 48-7-27(a)(5.1) is available only BELOW age 62 — $17,500, plus a second $17,500 for a veteran whose earned income EXCEEDS $17,500. The second half is a cliff on employment: for a veteran with at least $35,000 of military retired pay, one dollar of wages at $17,500 is worth $873.20 of Georgia tax in 2026, the largest single-dollar step in the state. A veteran too disabled to work cannot meet the test — what saves them is the ordinary exclusion, which disability opens at any age.', relevantWhen: whenMilitaryRetirement },
  { text: 'Composing the two exclusions gives Georgia\'s true maximum, and it is not the $65,000 every table prints. A permanently disabled veteran under 62 with earned income above $17,500 may claim both, up to $70,000 — and it falls to $35,000 on their sixty-second birthday, the birthday every guide describes as the one where Georgia\'s retirement exclusion begins. On $35,000 of military retired pay, $40,000 of IRA distributions and $20,000 of wages that is $1,746.50 of extra Georgia tax for turning 62, and it is not recovered until 65.', relevantWhen: whenMilitaryRetirement },
  { text: 'This package counts military retired pay left over after the military exclusion as ordinary taxable pension income for the retirement income exclusion, which is what it is on a 1099-R. PolicyEngine-US keeps military pay out of Georgia\'s qualifying pool altogether, so in that model a 65-year-old Georgia military retiree gets no exclusion at all on a pension the state plainly exempts — worth knowing if you are comparing the two.', relevantWhen: whenMilitaryRetirement },
];

const GA_2026_NOTES: readonly string[] = [
  'New for 2026 and gone after 2028: HB 463 excludes up to $1,750 of qualified overtime compensation (§ 48-7-27(a)(16)) and up to $1,750 of cash tips (§ 48-7-27(a)(17)), each per employee. Both are read here off `federalDeductions.overtime` and `federalDeductions.tips`, because the federal § 224 and § 225 deductions are below the line and the compensation they exempt is still inside Georgia\'s federal-AGI base — which is the reason a state has to legislate its own subtraction at all. Two limits: the figure is understated for a filer whose federal deduction was cut by the federal phase-out, and the caps are per employee, so a joint return with two tipped workers is entitled to $3,500 and gets $1,750 here.',
  'HB 463 also set the rate at 4.99% for 2026 and directed further cuts of 0.125 points a year from 2027 until the rate reaches 3.99%, subject to revenue conditions. A model that carries 2026\'s rate forward will be wrong in the expensive direction every year until then; this package refuses years it has not transcribed.',
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
    subtractsTaxableSocialSecurity: true,
    retirementIncomeExclusion: {
      name: 'Georgia retirement income exclusion',
      minimumAge: 62,
      olderAge: 65,
      capUnderOlderAge: 35_000,
      // $70,000 from 2027 under HB 463 § 2-3, which adds § 48-7-27(a)(5)(A)(xiv)
      // and is not subject to the revenue triggers the rate cuts are.
      capAtOlderAge: 65_000,
      // $4,000 through 2023. Most summaries still print that figure.
      earnedIncomeCap: 5_000,
      disabilityQualifies: true,
    },
    militaryRetirementExclusion: {
      name: 'Georgia military retirement exclusion',
      maximumAge: 62,
      base: 17_500,
      additional: 17_500,
      additionalEarnedIncomeThreshold: 17_500,
    },
    ...(year >= 2026
      ? {
          compensationExclusions: [
            { name: 'Georgia qualified overtime exclusion', source: 'overtime', cap: 1_750 },
            { name: 'Georgia cash tip exclusion', source: 'tips', cap: 1_750 },
          ] as const,
        }
      : {}),
    notes: year >= 2026 ? [...GA_2026_NOTES, ...GA_NOTES] : GA_NOTES,
    // Three notes about a veterans' exclusion, on a state where almost no return
    // has military pay on it. The first use of the mechanism, and the argument
    // for it: they are 1,900 characters that most Georgia callers pay for and
    // none of them can use.
    conditionalNotes: GA_MILITARY_NOTES,
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
  'The Illinois earned income credit is 20% of the federal credit and is refundable — raised from 18% for tax year 2023 by Public Act 102-0700. Illinois also extends it to filers aged 18 to 24 and 65 and over who are barred from the federal childless credit by age, and to filers with an ITIN rather than a Social Security number; this package cannot see either, so an Illinois filer in one of those groups is understated.',
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
    earnedIncomeCredit: {
      name: 'Illinois earned income credit',
      matchRate: 0.2,
      refundable: true,
    },
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
    earnedIncomeCredit: {
      name: 'Indiana earned income credit',
      matchRate: 0.1,
      refundable: true,
    },
    notes: [
      'Every Indiana county levies its own income tax on the SAME figure — IT-40 line 7, after the deductions and the $1,000 exemptions — from 0.5% (Porter) to 3.00% (Randolph, the statutory maximum). The average is 1.914% against a state rate of 3.00% in 2025 and 2.95% in 2026, so the county tax is about 39% of a typical Indiana bill, and a Randolph County filer pays their county MORE than their state in 2026. Pass `county`; without it this is the state half of the return, and the result says what the cheapest and dearest counties would have cost.',
      'The county is the one the filer lived in on 1 JANUARY, for the whole year, and a county rate can change on 1 October as well as on 1 January — so the rate an employer withholds and the rate the return settles at can differ for part of a year. This package stores the 1 January rate, which is what the annual return uses.',
      'Not modelled: the additional $1,500 exemption for each qualifying dependent child under 19 (or under 24 and a full-time student), and the additional $3,000 first-year exemption for an adopted child. An Indiana family return computed here is too high by about $44 per qualifying child in 2025.',
      "Indiana's statutory rate steps down each year: 3.05% in 2024, 3.00% in 2025, 2.95% in 2026, and 2.90% from 2027.",
      'The Indiana earned income credit is 10% of a federal credit the filer never claimed. IC 6-3.1-21-6 computes it under the Internal Revenue Code as of a FROZEN date — 1 January 2023 for tax years 2023 to 2025, and 1 January 2026 from tax year 2026 (SEA 243 of 2025) — and substitutes Indiana\'s own investment income limit of $3,800, which has not moved since 2022 and is now about a third of the federal one. A filer with $5,000 of interest income gets the federal credit and no Indiana credit at all. This package applies the 10% match to whatever federal credit you pass, so an Indiana filer near either limit is overstated.',
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
  {
    title:
      'KRS 141.019(1) — the pension income exclusion, and the exemption for service performed before 1 January 1998',
    url: 'https://apps.legislature.ky.gov/law/statutes/statute.aspx?id=53498',
  },
  {
    title: 'Kentucky Schedule P (42A740-P) — Kentucky Pension Income Exclusion',
    url: 'https://revenue.ky.gov/Forms/Schedule%20P%20(2025).pdf',
  },
];

const KY_NOTES: readonly string[] = [
  "Kentucky's rate falls from 4.0% in 2025 to 3.5% in 2026 under HB 1 (2025), a 12.5% cut in the bill. Further reductions are conditional on revenue triggers in KRS 141.020(4) and are not scheduled.",
  'This package applies one standard deduction per return. Kentucky couples commonly file "married filing separately on a combined return" (Form 740 filing status 2), which claims two standard deductions on one form; that is worth $3,270 of deduction, about $131 of tax in 2025, and this package does not model it.',
  'Kentucky does not tax Social Security or Tier 1 railroad retirement benefits. Pass the taxable part — Form 1040 line 6b — as `taxableSocialSecurity` and it comes off the base; do NOT also put it in `subtractions`, or it will be subtracted twice.',
  'The pension income exclusion of KRS 141.019(1) is PER PERSON and is claimed on Schedule P. It covers pensions, annuities, IRA and 401(k) distributions and other written retirement plans alike — Kentucky asks nothing about the character of the income or the form of the account — and it has NO AGE TEST AT ALL. Pass `retirement` with a `filer` and a `spouse`. Of the three states here that exempt retirement income, Kentucky has the smallest headline figure and is the only one a 55-year-old retiree can use: Georgia\'s exclusion begins at 62 and Maryland\'s at 65, so a couple who both retire at 55 with $70,000 of pension exclude $62,220 in Kentucky and nothing in either of the others.',
  'The $31,110 is NOT Kentucky\'s maximum. Retired pay from the federal government, the Commonwealth or a Kentucky local government is exempt IN FULL to the extent it is attributable to service performed before 1 January 1998, with no ceiling — and that exempt amount is not charged against the $31,110, which stays available against everything else. Pass it as `retirement.filer.governmentPension` with `serviceMonthsBefore1998` and `serviceMonthsAfter1997`. A Kentucky teacher who served 1975-2005 with a $70,000 pension and $40,000 of IRA distributions excludes $84,776.67 on a return whose published exclusion is $31,110.',
  'Military retired pay is federal service, so it belongs in `governmentPension` with the months: a Kentucky military retiree who served before 1998 has the same uncapped exemption as a state employee. Do not put it in `militaryRetirement`, which is Maryland\'s and Georgia\'s field and is not read here.',
  'The 1 January 1998 cutoff has never moved, which makes the uncapped exemption a closed cohort emptying by retirement — the same shape as Virginia\'s untested age deduction for filers born before 1939. It also means every further month of service DILUTES the exempt percentage, because the denominator grows and the numerator cannot: a Kentucky employee hired in 1988 was 100% exempt if they retired in 1997 and is 25% exempt if they retire in 2027. The exempt DOLLARS are roughly unchanged, because a pension earned over more months is larger; it is the taxable remainder that grows.',
  'The $31,110 is the only figure in this package other than Maryland\'s exclusion that has ever gone DOWN, and it fell much further. It was indexed from $35,700 in 1999 to $41,110 in 2005, frozen there for thirteen years, cut by 24% to $31,110 by the 2018 reform, and frozen again. It is not indexed, so it has lost roughly half its real value since it was last set — and the rate cut from 4.0% to 3.5% cuts what is left of it by a further 12.5%.',
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
    subtractsTaxableSocialSecurity: true,
    pensionIncomeExclusion: {
      name: 'Kentucky pension income exclusion (Schedule P)',
      // $41,110 from 2005 until the 2018 reform cut it. Not indexed since.
      cap: 31_110,
      uncappedServiceBefore: 1998,
    },
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
  'Michigan cities levy their own income taxes on a base of their own — Detroit at 2.4% for residents and 23 other cities, all computed here: pass `city`, and `workCity` for a city the filer works in but does not live in. The city base is NOT the MI-1040\'s: the Uniform City Income Tax Ordinance excludes pensions, IRA distributions, Social Security, unemployment compensation and military pay entirely, and its personal exemption is the $600 fixed in 1964 rather than the indexed state one.',
  'Michigan is phasing back in a deduction for retirement and pension income through 2026 (the "retirement tax" repeal). Not modelled; supply it through `subtractions`.',
  'The Michigan earned income tax credit for working families is 30% of the federal credit and is refundable. It was 6% through tax year 2022 and was raised fivefold retroactively by Public Act 4 of 2023 — a Michigan return computed on the old 6% understates a family with two children by about $1,700.',
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
    earnedIncomeCredit: {
      name: 'Michigan earned income tax credit for working families',
      matchRate: 0.3,
      refundable: true,
    },
    notes:
      year === 2026
        ? [
            'PROVISIONAL: the $5,800 personal exemption is the published 2025 figure carried forward. Michigan indexes it annually under MCL 206.30(2) and no 2026 amount was reachable when this was written; one published dataset carries $5,900, which would be $4.25 less tax per exemption. The 4.25% rate is set by statute and is correct, and the CITY income taxes computed alongside it are not affected either way — a city exemption is $600 by ordinance and does not index.',
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
