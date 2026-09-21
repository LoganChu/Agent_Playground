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
    subtractsTaxableSocialSecurity: true,
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
  {
    // NOT § 48-7-29.23, which is where this package and PolicyEngine-US's own
    // variable file both put it until Day 26. No such section exists; the
    // credit is § 48-7-27.1, "Eligible itemizer defined; tax credits", and
    // PolicyEngine's *parameter* file has it right while its variable does not.
    title:
      'O.C.G.A. § 48-7-27.1 — eligible itemizer defined, and the $300-per-taxpayer credit, for tax years from 2024',
    url: 'https://law.justia.com/codes/georgia/title-48/chapter-7/article-2/section-48-7-27-1/',
  },
  {
    title:
      'Georgia Department of Revenue — IT-511 Individual Income Tax Booklet, the eligible itemizer tax credit at Form 500 line 19',
    url: 'https://dor.georgia.gov/document/document/2025-it-511-individual-income-tax-booklet/download',
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
  'Georgia\'s child tax credit is new for tax year 2026 — HB 136 (2025), $250 for each child under 6, non-refundable, with NO phase-out and no cap on the number of children. Pass `dependentAges`; a Georgia family return that omits them loses it silently. It is worth the same $250 to a household at $40,000 and at $400,000, which is rare: the only other credit in this package with no income test at all is Massachusetts\'s.',
  'The eligible itemizer tax credit of O.C.G.A. \u00a7 48-7-27.1 \u2014 $300 for each taxpayer, $600 on a joint return, non-refundable and with no carryforward \u2014 is allowed to a Georgia resident for tax years from 2024 purely for having elected to ITEMISE federally. It asks nothing about income, age or what the deductions were, so it is worth the same $300 at $50,000 and at $5,000,000, and it is computed here from `federal.deductionKind` alone. A married couple who itemise claim $600; two separate returns claim $300 each, so this credit alone is worth the same either way.',
  'Itemizing is not a choice in Georgia either way: \u00a7 48-7-27(a)(1) ties the state election to the federal one in BOTH directions \u2014 a federal itemiser must itemise here even where the Georgia standard deduction is larger, and a filer who took the federal standard deduction may not itemise here at all. HB 1437 raised the Georgia standard deduction to $15,000/$30,000 while leaving the itemised figure alone, so after 2024 the compulsion usually runs against the filer, and the eligible itemizer credit is what Georgia pays to offset it. At 4.99% the $300 is worth $6,012 of deduction, so a Georgia itemiser whose itemised deductions fall as much as $6,012 short of the standard deduction still comes out ahead \u2014 $12,024 on a joint return. This package applies the compulsion when `stateItemizedDeductions` is supplied and falls back to the standard deduction, with this note, when it is not; the credit is paid either way, because it turns on the federal election and not on the Georgia figure.',
  'Not modelled: the low income credit of O.C.G.A. \u00a7 48-7-29.7, which is at most $26 per exemption and is gone at $20,000 of federal AGI; the $4,000-per-return exclusion for income from a disability retirement; the Georgia 529 (Path2College) contribution subtraction; the child and dependent care credit (30% of the federal credit); the qualified education expense and rural hospital credits; and the surplus tax refund, which is not part of the return. Pass any of these through `subtractions` if you have them.',
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
    // Georgia's election is not its own: § 48-7-27(a)(1) ties it to the federal
    // one in both directions, so a federal itemizer must itemize here and a
    // federal standard-deduction filer may not. Same shape as Virginia's, and
    // without Virginia's mandatory subtraction of the state income tax — the
    // Georgia adjustment is for taxes paid to other states and for investment
    // interest on exempt income, neither of which this package can derive, so
    // `stateItemizedDeductions` is taken as the Georgia figure.
    itemizedDeduction: {
      name: 'Georgia itemized deductions',
      requiresFederalItemizing: true,
      forcedWhenFederalItemizing: true,
      phaseOutRate: 0,
      phaseOutThreshold: byStatus({
        single: Infinity,
        joint: Infinity,
        separate: Infinity,
        headOfHousehold: Infinity,
      }),
    },
    exemption: { perFiler: uniform(0), perDependent: dependent },
    subtractsTaxableSocialSecurity: true,
    // O.C.G.A. § 48-7-27.1, for tax years from 2024. The only rule in this
    // package whose sole test is the standard-versus-itemized election.
    ...(year >= 2024
      ? {
          itemizerCredit: {
            name: 'Georgia eligible itemizer tax credit',
            perTaxpayer: 300,
          } as const,
        }
      : {}),
    // HB 136 (2025) creates a $250 credit for each child under 6, first
    // available for tax year 2026 — the newest provision in this package, and
    // the only per-dependent credit here with no phase-out and no ceiling on
    // the number of children.
    ...(year >= 2026
      ? {
          childCredit: {
            name: 'Georgia child tax credit',
            amountByAge: [{ maxAge: 5, amount: 250 }],
            refundable: false,
          } as const,
        }
      : {}),
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
  {
    title: '35 Ill. Comp. Stat. 5/203(a)(2)(F) — the subtraction for retirement income',
    url: 'https://www.ilga.gov/legislation/ilcs/fulltext.asp?DocName=003500050K203',
  },
  {
    title: 'Illinois Department of Revenue Publication 120 — Retirement Income',
    url: 'https://tax.illinois.gov/research/publications.html',
  },
  {
    title: '35 Ill. Comp. Stat. 5/244 — child tax credit, added by Public Act 103-0592',
    url: 'https://www.ilga.gov/legislation/ilcs/fulltext.asp?DocName=003500050K244',
  },
];

const IL_NOTES: readonly string[] = [
  "Illinois' exemption allowance is not phased out — it is lost entirely at the first dollar of federal AGI above $250,000 ($500,000 on a joint return). One extra dollar of income at the threshold costs a single filer the whole $2,850 exemption, and $141.12 of tax on that single dollar. 35 ILCS 5/204(g).",
  'Illinois has no standard deduction and no itemized deductions. The exemption allowance is the only subtraction from base income that most filers get.',
  'Illinois adds $1,000 to the exemption allowance for each filer aged 65 or over and another $1,000 for each who is blind — 35 ILCS 5/204(b). It is NOT indexed: the $2,850 beside it moves with the CPI every year and this figure has been $1,000 since 2004, so it is worth $49.50 of tax and falls in real terms annually. It needs `filerAge` and `spouseAge`, and the blind exemption needs `blindOrDisabled`.',
  'Illinois adds back interest on the obligations of OTHER states and their municipalities — 35 ILCS 5/203(a)(2)(A) — while exempting its own, so a retiree holding out-of-state municipal bonds owes Illinois tax on income the FEDERAL RETURN NEVER SAW. Pass `outOfStateMunicipalInterest`: the Illinois/elsewhere split exists on no federal form and cannot be derived from anything else here, so `taxExemptInterest` is the wrong figure for it and taking that total would tax an Illinois resident on Illinois bonds. Omitted, an Illinois bondholder is too LOW by 4.95% of the out-of-state part — the only place in this package where the answer errs downwards, and it only became visible when the retirement subtraction took a retiree base to zero. PolicyEngine-US adds back the whole of tax-exempt interest with no in-state carve-out, so the two engines disagree for an Illinois resident holding Illinois bonds.',
  'The Illinois earned income credit is 20% of the federal credit and is refundable — raised from 18% for tax year 2023 by Public Act 102-0700. Illinois also extends it to filers aged 18 to 24 and 65 and over who are barred from the federal childless credit by age, and to filers with an ITIN rather than a Social Security number; this package cannot see either, so an Illinois filer in one of those groups is understated.',
  'The Illinois child tax credit — 35 ILCS 5/244, new for tax year 2024 — is 40% of the Illinois earned income credit for a filer with at least one qualifying child under 12, refundable. It is a percentage of a CREDIT, not an amount per child, so one child and four children are worth exactly the same and the child does nothing but switch it on. Pass `dependentAges`; a count cannot tell an 11-year-old from a 12-year-old, and the two are worth $600 and nothing. It was 20% for 2024 and is 40% from 2025.',
  'Because it is a percentage of a percentage, the Illinois child tax credit is withdrawn faster than any credit here that has a phase-out of its own: 40% of 20% of the federal § 32 taper of 21.06% is 1.68 cents per dollar, on top of the 4.21 cents the Illinois earned income credit already withdraws. A working Illinois parent of two in the § 32 phase-out band faces 10.85% — the 4.95% flat rate plus 5.90 points of withdrawal — in the state whose entire tax policy is that the rate is the same for everyone. With one child the federal taper is 15.98% rather than 21.06% and the Illinois rate is 9.42%, so how flat Illinois is depends on how many children a household has, in a state with no per-child anything.',
  'Illinois does not tax retirement income at all — 35 ILCS 5/203(a)(2)(F) — and from v0.19.0 this package applies that itself. Pass `retirement` (or `retirementIncome`) and pensions, IRA distributions, 401(k) and 403(b) distributions and government retired pay are all subtracted, with the taxable Social Security inside federal AGI coming off separately from `taxableSocialSecurity`. DO NOT ALSO PUT THEM IN `subtractions`: a caller who followed the old note and does both now subtracts twice.',
  'Illinois is the largest exemption of retirement income in the United States and it has NO AGE TEST AT ANY POINT. A 40-year-old drawing a $200,000 pension pays Illinois nothing on it. Every table that groups Illinois with Mississippi as a state that "does not tax retirement income" is hiding that difference: Mississippi\'s exemption is for distributions taken at retirement age and an early one is fully taxed, so of the two states only Illinois is any use to someone who retired at 52.',
];

function illinois(year: number): StateIncomeTaxDefinition | undefined {
  if (year !== 2025 && year !== 2026) return undefined;
  // Indexed to CPI under 35 ILCS 5/204(d-5). $2,775 for 2024, $2,850 for 2025,
  // and $2,925 for 2026 — PUBLISHED, in Informational Bulletin FY 2026-15 of
  // December 2025 and in the Comptroller's own 2026 payroll bulletin. Carried
  // as the 2025 figure and flagged provisional here until Day 27.
  const exemption = year === 2026 ? 2925 : 2850;
  return {
    code: 'IL',
    subtractsTaxableSocialSecurity: true,
    name: 'Illinois',
    year,
    status: 'published',
    base: 'federalAdjustedGrossIncome',
    rate: { kind: 'flat', rate: 0.0495 },
    deduction: { kind: 'none' },
    // 35 ILCS 5/203(a)(2)(A): interest on the obligations of other states and
    // their political subdivisions is added to Illinois base income, while
    // Illinois's own are exempt. The only addition in this package that makes a
    // federal-AGI base too LOW, and the only place a comparison against
    // PolicyEngine-US has found this package understating a bill.
    addsOutOfStateMunicipalInterest: true,
    earnedIncomeCredit: {
      name: 'Illinois earned income credit',
      matchRate: 0.2,
      refundable: true,
    },
    // 35 ILCS 5/244, Public Act 103-0592. 20% of the Illinois earned income
    // credit for 2024 and 40% from 2025 — a credit defined as a percentage of a
    // credit, so it inherits the whole of § 32's phase-out and the child does
    // nothing but switch it on.
    ...(year >= 2025
      ? {
          earnedIncomeCreditChildBonus: {
            name: 'Illinois child tax credit',
            rate: 0.4,
            maxChildAge: 11,
            refundable: true,
          } as const,
        }
      : {}),
    exemption: {
      perFiler: perPerson(exemption),
      perDependent: exemption,
      // 35 ILCS 5/204(b): a further $1,000 for each filer aged 65 or over and
      // another $1,000 for each who is blind. Unlike the $2,850 it sits beside,
      // this figure is NOT indexed — it has been $1,000 since 2004 and is worth
      // $49.50 of tax.
      perSeniorFiler: 1_000,
      seniorAge: 65,
      perBlindOrDisabledFiler: 1_000,
      // 35 ILCS 5/204(g). The exemption allowance is DISALLOWED ENTIRELY above
      // the figure, not tapered — one dollar of AGI over it costs the whole
      // allowance. The Department states the split on the face of the IL-1040
      // instructions: "$500,000 for returns with a federal filing status of
      // married filing jointly, or $250,000 for all other returns."
      //
      // A QUALIFYING SURVIVING SPOUSE IS AN OTHER RETURN, and this entry did
      // not say so until v0.25.0 — `byStatus()` defaults that status to joint,
      // so a widow at $300,000 kept an allowance Illinois takes away. $282.15 a
      // year with one child. Found by the differential the day the grid first
      // filed this status above $250,000; twenty-six days of grids had filed it
      // only at $45,000, where the cliff cannot be reached.
      cliff: byStatus({
        single: 250_000,
        joint: 500_000,
        separate: 250_000,
        headOfHousehold: 250_000,
        qualifyingSurvivingSpouse: 250_000,
      }),
    },
    // 35 ILCS 5/203(a)(2)(F). No cap, no age, no test on the form of the
    // account: the whole of a federally taxed retirement distribution comes out
    // of Illinois base income.
    retirementIncomeSubtractions: [
      {
        name: 'Illinois retirement income subtraction',
        scope: 'perPerson',
      },
    ],
    notes: IL_NOTES,
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
  {
    title: 'Indiana IT-40 instruction booklet — Schedule 3, the exemptions',
    url: 'https://forms.in.gov/Download.aspx?id=16915',
  },
  {
    title:
      'Ind. Code § 6-3-3-9 — unified tax credit for the elderly, and Form SC-40, the standalone claim',
    url: 'https://iga.in.gov/laws/2024/ic/titles/6#6-3-3-9',
  },
];

function indiana(year: number): StateIncomeTaxDefinition | undefined {
  if (year !== 2025 && year !== 2026) return undefined;
  return {
    code: 'IN',
    subtractsTaxableSocialSecurity: true,
    name: 'Indiana',
    year,
    status: 'published',
    base: 'federalAdjustedGrossIncome',
    rate: { kind: 'flat', rate: year === 2025 ? 0.03 : 0.0295 },
    deduction: { kind: 'none' },
    exemption: {
      perFiler: perPerson(1000),
      perDependent: 1000,
      // The four additions Schedule 3 carries under the $1,000 line, none of
      // which this package had until v0.21.0. Together they are the difference
      // between an Indiana family return and an Indiana adult return.
      perQualifyingChild: 1500,
      qualifyingChildMaxAge: 18,
      qualifyingChildStudentMaxAge: 23,
      perSeniorFiler: 1000,
      seniorAge: 65,
      perBlindOrDisabledFiler: 1000,
      perLowIncomeSeniorFiler: 500,
      lowIncomeSeniorThreshold: byStatus({
        single: 40_000,
        joint: 40_000,
        separate: 20_000,
        headOfHousehold: 40_000,
      }),
    },
    earnedIncomeCredit: {
      name: 'Indiana earned income credit',
      matchRate: 0.1,
      refundable: true,
    },
    // IC 6-3-3-9. Banded on FEDERAL AGI, refundable, and the whole answer for a
    // household whose income is Social Security: Indiana exempts the benefit, so
    // the tax is zero and this is the only figure on the return that moves.
    agedCredit: {
      name: 'Indiana unified tax credit for the elderly',
      minimumAge: 65,
      oneAged: [
        { under: 1_000, amount: 100 },
        { under: 3_000, amount: 50 },
        { under: 10_000, amount: 40 },
      ],
      bothAged: [
        { under: 1_000, amount: 140 },
        { under: 3_000, amount: 90 },
        { under: 10_000, amount: 80 },
      ],
      refundable: true,
      requiresJointReturnWhenMarried: true,
    },
    notes: [
      'Every Indiana county levies its own income tax on the SAME figure — IT-40 line 7, after the deductions and the $1,000 exemptions — from 0.5% (Porter) to 3.00% (Randolph, the statutory maximum). The average is 1.914% against a state rate of 3.00% in 2025 and 2.95% in 2026, so the county tax is about 39% of a typical Indiana bill, and a Randolph County filer pays their county MORE than their state in 2026. Pass `county`; without it this is the state half of the return, and the result says what the cheapest and dearest counties would have cost.',
      'The county is the one the filer lived in on 1 JANUARY, for the whole year, and a county rate can change on 1 October as well as on 1 January — so the rate an employer withholds and the rate the return settles at can differ for part of a year. This package stores the 1 January rate, which is what the annual return uses.',
      'Indiana\'s $1,000 exemption is the SMALLEST of the four on Schedule 3 and the only one a household total can find. On top of it: $1,500 more for each dependent CHILD — under 19, or under 24 and a full-time student — $1,000 for each filer at 65, $1,000 for each blind filer, and $500 MORE for each filer at 65 whose federal AGI is under $40,000 ($20,000 filing separately). All four are computed here from v0.21.0; before that a family with two children was $149.10 too high in Marion County and a retired couple under $40,000 was $149.10 too high as well.',
      'The child exemption needs `dependentAges`, not `dependents`: an Indiana dependent child is worth $2,500 of exemption and a dependent parent $1,000, and a count cannot tell them apart. Supply `dependentsAttendingCollege` as well for a dependent aged 19 to 23, who qualifies only as a full-time student.',
      'The $500 is the only means-tested exemption in this package and it is a CLIFF. A joint return with both spouses at 65 claims $3,000 of age exemption at $39,999 of federal AGI and $2,000 at $40,000 — one dollar of income costs $1,000 of exemption, which is $49.70 of tax in Marion County and $59.50 in a county at the 3.00% statutory maximum. The test is on FEDERAL AGI, so an Indiana deduction that takes a retiree under the line does not buy it back.',
      'The unified tax credit for the elderly (IC 6-3-3-9) is REFUNDABLE and is banded on FEDERAL AGI: $100/$50/$40 for one filer at 65 and $140/$90/$80 for two, under $1,000, $3,000 and $10,000 respectively. Pass `filerAge` and `spouseAge`. For a couple whose income is Social Security it is the whole return — Indiana exempts the benefit, the $5,000 of exemptions takes Indiana AGI below zero, the tax is nothing, and the $140 is the only figure that moves. Note that neither of those Indiana provisions buys a dollar of room under the $10,000 ceiling, because the ceiling is measured on the federal figure before Indiana starts.',
      'Every edge of that credit is a CLIFF and there are three: one dollar of federal AGI at $1,000 costs $50, at $3,000 costs $10, and at $10,000 costs the remaining $80. Nothing phases. And the second aged filer is worth $40 rather than $100, which makes it the only per-person amount in this package worth less than half again for the second person.',
      'The elderly credit is computed here only for a joint return, a single filer or a head of household. IC 6-3-3-9(b) requires spouses who RESIDE TOGETHER to claim it jointly, and residence is a fact no figure on a return carries, so a married-filing-separately return gets nothing rather than risking two claims for one household. A married filer who genuinely lived apart all year is understated by up to $100.',
      'Not modelled: the additional $3,000 first-year exemption for an adopted child, which needs a fact no other rule here asks for; and the renter\'s, homeowner\'s property tax and nonpublic school deductions.',
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
  'Michigan\'s SPECIAL exemption (MCL 206.30(3)(a), MI-1040 line 9) is $3,400 for 2025 — the largest allowance for blindness in this package, worth $144.50 of Michigan tax against Illinois\'s $49.50 and Indiana\'s $29.50. It is allowed for a filer or spouse who is blind, DEAF, hemiplegic, paraplegic, quadriplegic, or totally and permanently disabled under 66, and this package computes it from `blindOrDisabled`, which covers all of those. Two gaps: it is also allowed for a qualifying DEPENDENT, which `blindOrDisabled` counts only the filer and spouse for; and MCL 206.30(3)(b) allows a further exemption for a qualified disabled VETERAN, which this package does not model. Neither was computed before v0.23.0, and nor was the filer\'s own.',
  "Michigan's rate briefly fell to 4.05% for tax year 2023 under the MCL 206.51(1)(c) revenue trigger and returned to 4.25% for 2024. The trigger is a one-year reduction, not a permanent one, and the Michigan Supreme Court declined to make it permanent — a 2023 figure carried forward is 4.7% too low.",
  'Michigan cities levy their own income taxes on a base of their own — Detroit at 2.4% for residents and 23 other cities, all computed here: pass `city`, and `workCity` for a city the filer works in but does not live in. The city base is NOT the MI-1040\'s: the Uniform City Income Tax Ordinance excludes pensions, IRA distributions, Social Security, unemployment compensation and military pay entirely, and its personal exemption is the $600 fixed in 1964 rather than the indexed state one.',
  'Michigan\'s deduction for retirement and pension income is computed here from v0.19.0 — pass `retirement` (or `retirementIncome`) and do NOT also put the pension in `subtractions`, which is what this note said to do before. Public Act 4 of 2023 is restoring the deduction Michigan repealed in 2011 a quarter at a time: 25% for 2023, 50% for 2024, 75% for 2025 and the whole of it from 2026. A model that stores the 2026 rule and runs it on a 2025 return overstates the deduction by a third.',
  "Michigan's cap is ONE FIGURE FOR THE RETURN and it is keyed to the OLDER spouse, which is the opposite of every other per-person retirement rule in this package. A couple share $135,220 in 2026 however the pension is split, and a 66-year-old married to a 58-year-old qualifies the whole return including the younger spouse's pension. New York's $20,000, by contrast, is per person and unused room is lost.",
  'Military retired pay is subtracted in full — and it comes OFF the shared cap (Form 4884 Worksheet 3.3 line 3, before the phase-in percentage on line 4). So a Michigan couple with $135,220 of military retired pay have no room left for an IRA, while a couple with $135,220 of private pension are in the same place: the difference only appears above the cap. Pass it as `retirement.filer.militaryRetirement`.',
  'For tax year 2025 the phased-in deduction is available only to a filer born in 1946 or later and before 1967 — ages 59 to 79 at the end of 2025 — because someone born before 1946 already has the tier one deduction the phase-in is catching up to. This package tests AGE, and Michigan tests BIRTH YEAR, so a filer whose birthday falls late in the year can be one year either side of the band here. For 2026 the question does not arise: every birth year from 1946 qualifies at 100%.',
  'NOT MODELLED — the Michigan standard deduction for filers born 1946-1952 (MCL 206.30(9)), worth $20,000 single and $40,000 joint against ALL income rather than against pension income, and the tier three variants for a filer with no Social Security coverage. Where one of those is worth more than the deduction computed here, a Michigan return is overstated.',
  'NOT MODELLED — the Michigan home heating credit (MCL 206.527a), refundable and claimed on Form MI-1040CR-7. It pays a standard allowance by household size below an income ceiling, so it reaches a low-income household that has no heating bill on its return at all, and it is worth more than the entire Michigan income tax of the households it reaches. Also not modelled: the homestead property tax credit.',
  'NOT MODELLED — the qualified tips and qualified overtime deductions added by Public Act 24 of 2025 for tax years 2026 through 2028, which are Michigan\'s answer to the federal § 224 and § 225 deductions the state\'s federal-AGI base never saw. Georgia\'s equivalents ARE modelled; supply Michigan\'s through `subtractions`.',
  'The Michigan earned income tax credit for working families is 30% of the federal credit and is refundable. It was 6% through tax year 2022 and was raised fivefold retroactively by Public Act 4 of 2023 — a Michigan return computed on the old 6% understates a family with two children by about $1,700.',
];

function michigan(year: number): StateIncomeTaxDefinition | undefined {
  if (year !== 2025 && year !== 2026) return undefined;
  // Indexed. $5,600 for 2024, $5,800 for 2025.
  const exemption = 5800;
  // MCL 206.30(1)(f). Indexed to the same figure the state publishes for
  // withholding: $65,897/$131,794 for 2025 and $67,610/$135,220 for 2026.
  // A surviving spouse takes the SINGLE amount here — one of the few places in
  // this package where the usual "a surviving spouse files on the joint
  // schedule" default is wrong, because MCL 206.30(1)(f) sets the larger figure
  // for "a husband and wife filing a joint return" and there is only one person
  // on this one.
  const tierOneCap = byStatus(
    year === 2025
      ? {
          single: 65_897,
          joint: 131_794,
          separate: 65_897,
          headOfHousehold: 65_897,
          qualifyingSurvivingSpouse: 65_897,
        }
      : {
          single: 67_610,
          joint: 135_220,
          separate: 67_610,
          headOfHousehold: 67_610,
          qualifyingSurvivingSpouse: 67_610,
        },
  );
  return {
    code: 'MI',
    subtractsTaxableSocialSecurity: true,
    name: 'Michigan',
    year,
    status: year === 2025 ? 'published' : 'provisional',
    base: 'federalAdjustedGrossIncome',
    rate: { kind: 'flat', rate: 0.0425 },
    deduction: { kind: 'none' },
    exemption: {
      perFiler: perPerson(exemption),
      perDependent: exemption,
      // MCL 206.30(3)(a) — the 'special exemption', MI-1040 line 9. $3,400 for
      // 2025, indexed, and the largest exemption for blindness in this package
      // by a factor of three: $144.50 of Michigan tax against Illinois's and
      // Indiana's $42.50 and $29.50. Carried forward for 2026 with the
      // personal exemption beside it, for the same reason.
      perBlindOrDisabledFiler: 3_400,
    },
    earnedIncomeCredit: {
      name: 'Michigan earned income tax credit for working families',
      matchRate: 0.3,
      refundable: true,
    },
    // Two rules and at most one of them applies, which is Michigan's structure
    // and not a convenience: the pre-1946 cohort takes the tier one deduction of
    // MCL 206.30(1)(f), everyone else the phased-in one of § 206.30(9). Tier one
    // is listed first because it is the more generous of the two at every point
    // of the phase-in — it exempts public pensions over and above the cap, where
    // the phased-in deduction puts every source inside it.
    retirementIncomeSubtractions: [
      {
        name: 'Michigan retirement and pension benefits deduction (born before 1946)',
        scope: 'return',
        // Born before 1946: 80 or over at the end of 2025, 81 or over in 2026.
        minimumAge: year === 2025 ? 80 : 81,
        cap: tierOneCap,
        governmentPensionExemptInFull: true,
        militaryReducesCap: true,
      },
      {
        name:
          year === 2025
            ? 'Michigan retirement and pension benefits deduction (phased in, 75% for 2025)'
            : 'Michigan retirement and pension benefits deduction',
        scope: 'return',
        // Born in 1946 or later and, for 2025 only, before 1967. From 2026 the
        // upper bound is gone and the deduction is universal.
        ...(year === 2025 ? { minimumAge: 59, maximumAge: 80 } : {}),
        cap: tierOneCap,
        capMultiplier: year === 2025 ? 0.75 : 1,
        militaryReducesCap: true,
      },
    ],
    notes:
      year === 2026
        ? [
            'PROVISIONAL: the $5,800 personal exemption and the $3,400 special exemption are the published 2025 figures carried forward. Michigan indexes it annually under MCL 206.30(2) and no 2026 amount was reachable when this was written; one published dataset carries $5,900, which would be $4.25 less tax per exemption. The 4.25% rate is set by statute and is correct, and the CITY income taxes computed alongside it are not affected either way — a city exemption is $600 by ordinance and does not index.',
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
    subtractsTaxableSocialSecurity: true,
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
    // G.S. § 105-153.5(b)(11). Uncapped, no age test, and the only retirement
    // income North Carolina lets go: `cap` is absent and the pool is military
    // pay alone, which the `militaryReducesCap` flag arranges by exempting it in
    // full and leaving nothing else in.
    retirementIncomeSubtractions: [
      {
        name: 'North Carolina military retirement deduction',
        scope: 'perPerson',
        cap: 0,
        militaryReducesCap: true,
      },
    ],
    notes: [
      "North Carolina's rate steps down by statute: 4.50% in 2024, 4.25% in 2025, 3.99% in 2026, and lower still from 2027 if revenue triggers in G.S. 105-153.7(a2) are met.",
      'Not modelled: the North Carolina child deduction, worth up to $3,000 per qualifying child and phasing to zero as AGI rises (G.S. 105-153.5(a1)). A North Carolina family return computed here is too high — by up to $120 per child in 2026.',
      'NORTH CAROLINA TAXES RETIREMENT INCOME IN FULL. It is grouped in most summaries with Illinois and Mississippi as a state that is kind to retirees, and it is not one: a pension, an IRA distribution and a 401(k) distribution are all fully taxable at 3.99% in 2026. The only three exceptions are Social Security, military retired pay and the Bailey cohort, all below. This package deliberately has no general retirement subtraction for North Carolina, and that is a finding rather than a gap.',
      'North Carolina does not tax Social Security benefits — G.S. § 105-153.5(b)(5) — and the taxable part is subtracted here from `taxableSocialSecurity`.',
      'Military retired pay is deducted IN FULL under G.S. § 105-153.5(b)(11), with no cap and no age test, and from v0.19.0 this package applies it: pass `retirement.filer.militaryRetirement`. The statute requires 20 years of service or a medical retirement, which this package cannot see, so a veteran who separated earlier is overstated in their favour here — and a surviving spouse receiving Survivor Benefit Plan payments qualifies too. Against a state that taxes every other pension in full, this is the largest military retirement preference in this package: $2,193 a year on a $55,000 pension in 2026, where Maryland\'s equivalent caps out at $20,000 of income.',
      'NOT MODELLED — the Bailey exemption (Bailey v. State, 348 N.C. 130), which exempts in full the retirement pay of state, local and federal employees who were vested in a qualifying plan on 12 August 1989. It is a fact about a service record thirty-seven years ago that no figure on a return carries, so it cannot be derived; supply it through `subtractions`. Like Kentucky\'s pre-1998 cohort and Virginia\'s pre-1939 birth date, it is a provision emptying by attrition.',
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
    subtractsTaxableSocialSecurity: true,
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
      // § 27-7-21(f) and (g). Form 80-105 counts them on the same line as the
      // dependents and multiplies the lot by $1,500 — which is why an engine
      // that reads the dependent figure off a rate table and stops misses both.
      perSeniorFiler: 1500,
      seniorAge: 65,
      perBlindOrDisabledFiler: 1500,
    },
    // § 27-7-15(4)(k). Uncapped, like Illinois — and unlike Illinois, gated on
    // retirement age, because (l) leaves a premature distribution fully taxable.
    retirementIncomeSubtractions: [
      {
        name: 'Mississippi retirement income exemption',
        scope: 'perPerson',
        minimumAge: 59.5,
      },
    ],
    notes: [
      'Mississippi allows an additional $1,500 exemption for each filer at 65 (§ 27-7-21(f)) and another $1,500 for each who is blind (§ 27-7-21(g)), and Form 80-105 counts them on the SAME line as the dependents before multiplying by $1,500 — so a table that reports Mississippi\'s exemption as $6,000/$12,000 plus $1,500 a dependent has described three of the four boxes. They stack on one person. Pass `filerAge`, `spouseAge` and `blindOrDisabled`; worth $60 a box in 2026 and $66 in 2025, and $120 to a couple both 65 with wage income. Neither was computed here before v0.23.0.',
      'The first $10,000 of Mississippi taxable income is taxed at 0%, and that bracket is per return: it is not doubled on a joint return, even though the exemption and the standard deduction both are.',
      "Mississippi's rate falls from 4.7% in 2024 to 4.4% in 2025 and 4.0% in 2026 under the Build Up Mississippi Act, with further reductions toward zero conditional on revenue triggers.",
      'Mississippi does not tax qualified retirement income — § 27-7-15(4)(k) — and from v0.19.0 this package applies that itself from `retirement` or `retirementIncome`. Social Security is subtracted separately from `taxableSocialSecurity`. DO NOT ALSO PUT THE PENSION IN `subtractions`, which is what the note here said to do before v0.19.0: doing both subtracts it twice.',
      'The exemption is for income received AT retirement age. § 27-7-15(4)(l) leaves a premature distribution — one the federal § 72(t) penalty would reach — fully taxable, so this package requires an age of 59.5 or over. Ages are supplied as whole numbers, so a filer who turns 59½ during the year is treated here as not qualifying and their Mississippi tax is overstated for that one year. PolicyEngine-US models the exemption with no age test at all and says so in its own parameter file; the two disagree for exactly this filer.',
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
