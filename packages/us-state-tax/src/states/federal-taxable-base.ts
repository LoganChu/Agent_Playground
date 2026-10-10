/**
 * Colorado and Idaho — the two supported states that start from **federal taxable
 * income** rather than federal AGI.
 *
 * This is the conformity choice with the largest consequences, and the two states
 * demonstrate opposite halves of it.
 *
 * Starting below the federal standard deduction means a state inherits every
 * federal change to it. The One Big Beautiful Bill Act raised that deduction from
 * $15,000 to $15,750 for a single filer in July 2025 — an increase of **$750**,
 * which is $33.00 of Colorado tax and $39.75 of Idaho tax. (Until Day 46 this
 * comment said $14,600 to $15,750 and quoted $50.60 and $60.95. $14,600 is the
 * **2024** figure; Rev. Proc. 2024-40 had already indexed 2025 to $15,000 before
 * OBBBA touched it, so a third of the increase this file claimed for the Act was
 * ordinary indexation. The engine was never wrong — only this sentence, four test
 * files that asserted it, and five states' notes.)
 *
 * **And the two states got there by opposite routes, which this comment also had
 * wrong.** Colorado's conformity is ROLLING: § 39-22-103(5.3) reads the Code as
 * amended from time to time, so the increase arrived with no Colorado act and no
 * Colorado announcement. Idaho's is a STATIC DATE, and on the day OBBBA passed
 * Idaho was frozen at 1 January 2025 — so Idaho's 2025 answer was NOT this one
 * until HB 559 was signed on 10 February 2026 and moved the date to 1 January
 * 2026 retroactively. For seven months the right Idaho 2025 answer was the
 * pre-OBBBA one. "Neither legislature acted and both states' tax fell anyway",
 * which is what this comment used to say, is true of Colorado and false of Idaho.
 *
 * Then they diverge again, on WHICH OBBBA provisions. Idaho adopted the four
 * Schedule 1-A deductions retroactively for 2025 — so an Idaho waiter's tip
 * deduction reduces Idaho tax too — while **decoupling** from § 168(k) and
 * § 168(n) bonus depreciation and from the OBBBA § 70302 transition rules for
 * 2022-2024 domestic research expenditures. So "conformed to the OBBBA in full",
 * which is what this comment used to say, is also too strong; it conformed in
 * full for every provision an individual wage return can reach. **Colorado did not.**
 * It has added the § 199A qualified business income deduction back since 2021, and
 * from 2026 adds back the qualified overtime deduction as well (HB25-1296) — while
 * still allowing the tips deduction directly beside it on the same federal form.
 *
 * "Starts from federal taxable income" is therefore not "passes federal taxable
 * income through", and the difference is a list of statutes that changes annually.
 */
import type { StateIncomeTaxDefinition } from '../definition.js';
import { byStatusOf } from './helpers.js';
import { FILING_STATUSES } from '../types.js';
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
  'The Colorado earned income tax credit is refundable and its match rate is legislated year by year, not indexed: 10% through 2021, 20% in 2022, 25% in 2023, 50% for 2024 and 2025 (HB24-1134), and 25% in 2026 on the statutory baseline. That halving is worth $886 to a Colorado family with two children and appears in no rate table. Colorado has raised the match by legislation in each of the last four years, so treat the 2026 figure as a floor rather than a forecast.',
  'NOT MODELLED, and it is the largest gap in Colorado here: the subtraction for Social Security benefits, C.R.S. § 39-22-104(4)(f). Colorado is one of the few states that taxes the benefit at all, and it then subtracts ALL of the federally taxable amount for a filer aged 65 or over — and, from 2025, for a filer aged 55 to 64 whose AGI is at or below $75,000 ($95,000 joint). It interacts with the $24,000 pension and annuity subtraction rather than adding to it, which is why it is not a flag. A Colorado retiree computed here is TOO HIGH by 4.4% of their taxable benefit; supply it through `subtractions` until this is modelled.',
  'Also not modelled: the Colorado child tax credit and the family affordability tax credit, both refundable and both large at low incomes — PolicyEngine-US puts a couple with two young children at $30,000 of wages $6,572 further into refund than this package does, and nearly all of the difference is those two credits.',
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
    federalConformity: {
      kind: 'rolling',
      cite:
        'Colo. Rev. Stat. § 39-22-103(5.3) — the IRC "as amended at any time or from time to time". The Department of Revenue repealed its contrary prospective-only rule on 8 November 2023 after the Court of Appeals allowed refunds based on retroactive federal changes.',
      primaryTextUnread:
        'law.justia.com and Colorado state sites are refused by this sandbox\u2019s egress policy. Rolling status is established from the statutory phrase as three independent practitioner write-ups reproduce it, plus the 2023 rule repeal. The limit worth knowing: the definition does not reach federal changes enacted AFTER the last day of a taxable year, and OBBBA was enacted 4 July 2025 \u2014 inside tax year 2025 \u2014 so 2025 is covered.',
    },
    rate: { kind: 'flat', rate: 0.044 },
    // Colorado has no deduction of its own; the federal one is already inside the
    // starting point.
    deduction: { kind: 'none' },
    addBacks: year === 2026 ? ['qualifiedBusinessIncome', 'overtime'] : ['qualifiedBusinessIncome'],
    earnedIncomeCredit: {
      name: 'Colorado earned income tax credit',
      // Legislated, not indexed, and it moves in whole steps: 25% in 2023, 50%
      // for 2024 and 2025 under HB24-1134, and back to the statutory 25% in 2026
      // unless the legislature acts again or a TABOR surplus raises it.
      matchRate: year === 2025 ? 0.5 : 0.25,
      refundable: true,
    },
    provisionalFigures:
      year === 2026
        ? [
            {
              path: 'rate.rate',
              reason: 'determined-after-year-end' as const,
              resolvedBy:
                "Colorado's TABOR surplus calculation for fiscal 2026-27, which the state completes after the tax year closes — the DR 0104 filing guide published in late 2026 is the first document that can carry it",
            },
            {
              path: 'earnedIncomeCredit.matchRate',
              reason: 'determined-after-year-end' as const,
              resolvedBy:
                'the same surplus calculation, plus any act of the 2026 General Assembly raising the match as it did for 2023, 2024 and 2025',
            },
          ]
        : undefined,
    notes:
      year === 2026
        ? [
            'PROVISIONAL BY LAW, not by neglect: both figures below are fixed only AFTER tax year 2026 closes, so no search during 2026 can settle them and nothing is owed here until Colorado publishes its DR 0104 filing guide. This is a different thing from the carried-forward figures elsewhere in this package, and the reason `provisionalFigures` records which kind each one is.',
            'The 2026 earned income tax credit match of 25% is the statutory baseline after the temporary 50% match for 2024 and 2025 expires (HB24-1134). Colorado has legislated a higher match in each of the last four years and the TABOR surplus mechanism can raise it further, so 25% is a FLOOR — the computed credit is the smallest Colorado can pay.',
            'The 4.40% rate is the statutory figure and is an UPPER BOUND. Colorado reduces it for a single year when there is a TABOR surplus (C.R.S. § 39-22-627), determined after the tax year ends — that produced 4.25% for tax year 2024 and again for 2025. Current forecasts project no surplus for 2026, so 4.40% is the likeliest outcome as well as the ceiling, but a Colorado return filed in 2027 should be recomputed against the published rate.',
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
  {
    title:
      'Idaho HB 559 (2026) — IRC conformity date moved to January 1, 2026, signed 10 February 2026 and retroactive to 1 January 2025; decouples from § 168(k) and § 168(n) bonus depreciation and from the OBBBA § 70302 transition rules for 2022-2024 domestic R&E',
    url: 'https://legislature.idaho.gov/statutesrules/idstat/title63/t63ch30/sect63-3004/',
  },
];

const ID_NOTES: readonly string[] = [
  'Idaho starts from federal taxable income, so it inherits the federal standard or itemized deduction, the Section 199A qualified business income deduction, and — for 2025 through 2028 — all four OBBBA Schedule 1-A deductions. Idaho adopted the OBBBA by conformity legislation after the federal act passed: HB 559, signed 10 February 2026, moved the conformity date to 1 January 2026 retroactively to 1 January 2025. Idaho DID decouple from § 168(k) and § 168(n) bonus depreciation and from the transition rules for 2022-2024 domestic research expenditures, so “conformed in full” is only true of the provisions an individual wage return can reach.',
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
    subtractsTaxableSocialSecurity: true,
    name: 'Idaho',
    year,
    status: year === 2025 ? 'published' : 'provisional',
    // Idaho's conformity is a STATIC DATE, and that is the whole reason its 2025
    // answer is the one below rather than the pre-OBBBA one. HB 559 (signed
    // 10 February 2026) moved § 63-3004's date to 1 January 2026 and made it
    // retroactive to 1 January 2025, so for the seven months between OBBBA's
    // enactment and that signature the correct Idaho 2025 answer was DIFFERENT
    // from the one this package ships. 2026 needs no retroactivity.
    federalConformity: {
      kind: 'staticDate',
      conformedTo: '2026-01-01',
      cite:
        'Idaho Code § 63-3004 as amended by HB 559 (2026) — the IRC as amended and in effect on 1 January 2026',
      ...(year === 2025
        ? {
            reachedAnyway: {
              route: 'retroactiveLegislation' as const,
              cite:
                'Idaho HB 559, signed 10 February 2026, retroactive to 1 January 2025; Idaho State Tax Commission press release on filing 2025 returns "now that conformity is law"',
              why:
                'Before HB 559, § 63-3004 was frozen at 1 January 2025 and OBBBA was enacted 4 July 2025, so a 2025 Idaho return took the superseded $15,000 standard deduction and none of the four Schedule 1-A deductions. The answer this package ships became the right one on 10 February 2026 and was the wrong one for the seven months before it.',
            },
          }
        : {}),
      primaryTextUnread:
        'legislature.idaho.gov is refused by this sandbox\u2019s egress policy. The date, the signature, the retroactivity and the two decouplings are established from the statute page and three practitioner write-ups as WebSearch reported them, which agree on every one of those four facts.',
    },
    provisionalFigures:
      year === 2026
        ? [
            // One indexed figure, FIVE paths. Until Day 37 this entry named
            // `single` alone, and the other four filing statuses carried the
            // same unread 2026 amount with nothing saying so — $4,811 again
            // under `marriedFilingSeparately`, and twice it under the three
            // doubled statuses.
            //
            // **THE RULE: a `byStatus` table holds one figure per status, so a
            // provisional entry written for one status flags one fifth of the
            // carry-forward.** `provisional-coverage.test.js` now fails on a
            // flag that stops at one status, so this list cannot shrink back to
            // the figure its author happened to be looking at.
            ...FILING_STATUSES.map((status) => ({
              path: `rate.byStatus.${status}.0.upTo`,
              reason: 'awaiting-publication' as const,
              carriedForwardFrom: 2025,
              resolvedBy:
                "the Idaho State Tax Commission's individual income tax rate schedule for 2026, published with the Form 40 instructions",
            })),
          ]
        : undefined,
    base: 'federalTaxableIncome',
    rate: { kind: 'brackets', byStatus: idahoBrackets(4811, 0.053) },
    deduction: { kind: 'none' },
    notes:
      year === 2026
        ? [
            'PROVISIONAL, one figure: the $4,811 zero bracket is the published 2025 figure carried forward. It is not a round number because it is not a legislated one — Idaho Code § 63-3024 fixes a base of $2,500 single / $5,000 joint and directs the Tax Commission to multiply it by an annual indexing factor, so the operative amount is $2,500 x 1.9244 for 2025 and $2,500 x (a 2026 factor this package could not reach). The 5.3% rate is set by HB 40 (2025) and is correct. Carrying the 2025 figure forward taxes a little income that the indexed bracket would exempt: the error is at most 5.3% of the movement in the bracket, about $8 a filer.',
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
