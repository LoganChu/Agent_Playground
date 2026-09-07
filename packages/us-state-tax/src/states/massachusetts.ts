/**
 * Massachusetts — the state that is in every table of state income tax rates as
 * a single row reading 5%, and has three rates.
 *
 * Every other state in this package splits its tax by **how much** income there
 * is. Massachusetts is the first that splits it by **what kind**:
 *
 * ```text
 * 5.0%   Part B income, and the Part A interest and dividends and Part C
 *        long-term capital gains taxed alongside it
 * 8.5%   short-term capital gains — assets held one year or less
 * 12%    long-term gains on collectibles, on half the gain (effective 6%)
 * +4%    on total taxable income above $1,083,150 (2025) / $1,107,750 (2026)
 * ```
 *
 * A day trader's Massachusetts rate is 70% higher than the rate every summary
 * reports, and no amount of bracket data can express that, because the answer
 * does not depend on the amount.
 *
 * Four more things here are invisible from outside.
 *
 * **1. The statute says 5.95%.** M.G.L. c. 62 § 4(b) still reads "5.95 per cent",
 * with a mechanism that steps the rate down by 0.05 points in any year the
 * commonwealth's baseline revenue growth clears a test. It ran out in tax year
 * 2020 at exactly 5.00% and has not moved since. Reading the statute gets the
 * wrong number; reading the rate table misses the mechanism that produced it.
 *
 * **2. No Tax Status is a generated table.** `$16,400` joint and `$14,400` head
 * of household are `$7,600` plus that status's own personal exemption, and the
 * `$1,000` per dependent is the dependent exemption itself. This file stores the
 * `$7,600` and the exemptions, not the table.
 *
 * **3. The Limited Income Credit charges 10% — double the statutory rate.** Just
 * above No Tax Status the tax is limited to 10% of the income above the
 * threshold, which is how Massachusetts avoids New Jersey's cliff. It is the
 * single most expensive band of income in the Massachusetts return and it sits
 * at the bottom of it.
 *
 * **4. The 4% surtax threshold cannot be doubled by filing separately.** Since
 * tax year 2024, a couple filing a joint federal return must file jointly in
 * Massachusetts — M.G.L. c. 62 § 4(d) — which closed the split-return route two
 * spouses used in 2023 to take two thresholds.
 */
import type { StateIncomeTaxDefinition } from '../definition.js';
import { byStatus, byStatusOf } from './helpers.js';
import type { Citation } from '../types.js';

const CITATIONS: readonly Citation[] = [
  {
    title: 'M.G.L. c. 62 § 4 — rates of tax, including the 8.5% and 12% Part A rates and the 4% surtax',
    url: 'https://malegislature.gov/Laws/GeneralLaws/PartI/TitleIX/Chapter62/Section4',
  },
  {
    title: 'M.G.L. c. 62 § 2 — Massachusetts gross income, Part A/B/C, and the 50% collectibles deduction',
    url: 'https://malegislature.gov/Laws/GeneralLaws/PartI/TitleIX/Chapter62/Section2',
  },
  {
    title: 'M.G.L. c. 62 § 3 — deductions and exemptions, including the FICA and rental deductions',
    url: 'https://malegislature.gov/Laws/GeneralLaws/PartI/TitleIX/Chapter62/Section3',
  },
  {
    title: 'M.G.L. c. 62 § 5 — No Tax Status and the Limited Income Credit',
    url: 'https://malegislature.gov/Laws/GeneralLaws/PartI/TitleIX/Chapter62/Section5',
  },
  {
    title: 'M.G.L. c. 62 § 6(h) and § 6(x) — earned income credit and Child and Family Tax Credit',
    url: 'https://malegislature.gov/Laws/GeneralLaws/PartI/TitleIX/Chapter62/Section6',
  },
  {
    title: 'Massachusetts DOR — 4% surtax on taxable income, and the certified annual thresholds',
    url: 'https://www.mass.gov/info-details/massachusetts-4-surtax-on-taxable-income',
  },
  {
    title: 'Massachusetts DOR — tax rates by class of income',
    url: 'https://www.mass.gov/service-details/massachusetts-tax-rates',
  },
  {
    title: 'Massachusetts DOR — No Tax Status and Limited Income Credit, Schedule NTS-L-NR/PY',
    url: 'https://www.mass.gov/info-details/massachusetts-no-tax-status-and-limited-income-credit',
  },
  {
    title: 'Chapter 50 of the Acts of 2023 — short-term gains to 8.5%, EITC to 40%, CFTC to $440 uncapped',
    url: 'https://malegislature.gov/Laws/SessionLaws/Acts/2023/Chapter50',
  },
];

/**
 * The 4% surtax threshold, certified by the Department of Revenue each year.
 *
 * Article XLIV of the Amendments to the Massachusetts Constitution set
 * `$1,000,000` for tax year 2023 and directed that it be adjusted annually "to
 * reflect any increases in the cost of living by the same method used for
 * federal income tax brackets". The certified figures since:
 *
 * ```text
 * 2023  $1,000,000
 * 2024  $1,053,750
 * 2025  $1,083,150
 * 2026  $1,107,750
 * ```
 *
 * The 2025 → 2026 step is a factor of **1.0227094**, and the federal rate
 * schedules moved **1.0227509** over the same pair of years — the same cost of
 * living adjustment, to within `$45` on a seven-figure threshold.
 *
 * It is not, quite, reproducible. Applying the federal factor to the 2025
 * threshold gives `$1,107,795`, which is `$1,107,800` to the nearest `$50` and
 * `$1,107,750` rounded *down* — and rounding down does not reproduce 2025 from
 * 2024, where the federal factor gives `$1,083,116` against a certified
 * `$1,083,150`. So this file stores the certified figures and
 * `test/massachusetts.test.js` checks the derivation as a **bound** rather than
 * as an identity: within one `$50` step of the federal adjustment, which is
 * enough to catch the transcription error that actually threatens a seven-digit
 * number, and honest about the fact that the Department of Revenue's exact
 * method is not recoverable from the four figures it has published.
 */
function surtaxThreshold(year: number): number {
  return year >= 2026 ? 1_107_750 : 1_083_150;
}

const NOTES: readonly string[] = [
  'Massachusetts is not a 5% flat tax state. M.G.L. c. 62 § 4(a) taxes short-term capital gains at 8.5% and long-term gains on collectibles at 12% on half the gain, beside the 5% that applies to everything else — so the rate depends on the KIND of income, not only on the amount. Pass shortTermCapitalGains and collectiblesGains separately; folding them into the 5.0% income understates a short-term gain by 3.5 points and a collectibles gain by 1 point.',
  'The statute still reads 5.95%. M.G.L. c. 62 § 4(b) steps the rate down by 0.05 points in any year the commonwealth\'s baseline revenue growth clears a statutory test; the steps ran out in tax year 2020 at 5.00% and the rate has not moved since. A model built from the statutory text alone is 19% too high.',
  'Massachusetts does not start from federal AGI. It excludes Social Security and railroad retirement benefits entirely — not 15% of them — along with contributory United States and Massachusetts public pensions and Massachusetts municipal bond interest. It also disallows three federal above-the-line deductions under M.G.L. c. 62 § 2(d)(1)(A): the traditional IRA deduction, the deductible half of self-employment tax, and the early-withdrawal penalty. Each has to be added back. Pass massachusettsFivePercentIncome; federal AGI is a different figure.',
  'Interest and dividends are Part A income and long-term capital gains are Part C, but since 2020 both are taxed at the same 5% as Part B, and Form 1 line 21 adds them together. They belong in massachusettsFivePercentIncome, not in the separately rated fields.',
  'No Tax Status is not a stored table. $16,400 (joint) and $14,400 (head of household) are $7,600 plus that status\'s own personal exemption, and the $1,000 per dependent is the dependent exemption. Only the single filer\'s $8,000 is a figure of its own, and a single filer adds nothing for dependents. Married filing separately cannot claim No Tax Status at all.',
  'The Limited Income Credit limits the tax to 10% of Massachusetts AGI above the No Tax Status threshold — which is DOUBLE the 5% statutory rate, not a reduction of it. It is the most expensive band of income in the Massachusetts return, and it sits immediately above No Tax Status. The published 175%-of-threshold eligibility ceiling is not where the credit runs out: the credit is the excess of the tax over that 10%, so for a single filer with no dependents it reaches zero at $11,600 of Massachusetts AGI, against a printed ceiling of $14,000.',
  'The 4% surtax threshold is per RETURN and is not doubled for a joint return, and since tax year 2024 a couple who file a joint federal return must file jointly in Massachusetts (M.G.L. c. 62 § 4(d)) — so the split-return route two spouses could use in 2023 to claim two thresholds is closed. The surtax base is TOTAL taxable income across all three rate classes, which is why a single large capital gain reaches it even for a filer whose salary does not.',
  'Massachusetts has no qualifying surviving spouse filing status. Form 1 offers single, married filing jointly, married filing separately and head of household only, and a federal qualifying surviving spouse files here as head of household in almost every case (they have a dependent child by definition). This package maps the status to the SINGLE exemption of $4,400 and the single $8,000 No Tax Status threshold, which is what a filer who does not qualify as head of household would get. Pass headOfHousehold if they do.',
  'The Child and Family Tax Credit is $440 per dependent with NO phase-out and NO cap on the number of dependents — worth the same to a household at $400,000 as at $40,000, which no other credit in this package is. It covers a dependent under 13 OR aged 65 or over, and also a dependent of any age who is permanently and totally disabled and a spouse unable to care for themselves; this package can see ages but not disability, so a return claiming a disabled dependent is too high by $440 per such dependent.',
  'The Massachusetts earned income credit is 40% of the federal credit and refundable — the joint largest state match in the country, alongside New Jersey\'s.',
  'The Social Security/Medicare deduction is up to $2,000 PER FILER and has no federal analogue, so it cannot be recovered from any federal figure. It binds at $26,144 of wages. Medicare premiums withheld from a Social Security payment are not deductible. Omitting socialSecurityAndMedicarePaid overstates the tax by up to $100 per working filer.',
  'The rental deduction is half the rent up to $4,000 per return ($2,000 married filing separately), so the cap binds at $8,000 of annual rent and in practice every Massachusetts tenant gets the full $200 of tax relief and no owner gets any. Pass rentPaid.',
  'A Massachusetts return is required when Massachusetts gross income exceeds $8,000 — the same figure as the single filer\'s No Tax Status threshold, but a different test: gross income rather than adjusted gross income, and it applies to every filing status rather than to single filers only.',
  'Not modelled: the senior circuit breaker credit (refundable, worth up to about $2,730 for a filer aged 65 or over whose property tax exceeds 10% of income — the largest credit on many Massachusetts retirees\' returns); the $2,000 limit on net capital losses deductible against interest and dividend income and the order in which short-term and long-term losses are applied; the septic system, lead paint, solar and residential energy credits; the commuter deduction; the student loan interest and college tuition deductions; the $10,000 (single) / $20,000 (joint) 529 contribution deduction; and the Schedule Y deductions generally. Pass any of these through `subtractions` if you have them.',
  'Not modelled: the composite treatment of a nonresident or part-year resident, whose exemptions and No Tax Status thresholds are prorated by Massachusetts-source income on Schedule NTS-L-NR/PY. This package computes a full-year resident return.',
];

export function massachusetts(year: number): StateIncomeTaxDefinition | undefined {
  if (year !== 2025 && year !== 2026) return undefined;
  return {
    code: 'MA',
    name: 'Massachusetts',
    // Nothing in the Massachusetts computation is indexed except the surtax
    // threshold, and the Department of Revenue has certified that for 2026. The
    // 5% rate, the exemptions, the No Tax Status constants, the deduction caps
    // and both credits are fixed dollar figures in statute, so the 2026 column
    // is the 2025 one as a matter of law rather than as a carry-forward. That
    // makes Massachusetts one of the few states here that is `published` for a
    // year the state has barely begun.
    status: 'published',
    year,
    base: 'stateDefined',
    stateDefinedBase: {
      field: 'massachusettsFivePercentIncome',
      why:
        'Massachusetts starts from its own gross income, not from federal AGI. It excludes ' +
        'Social Security and railroad retirement benefits entirely and contributory US and ' +
        'Massachusetts public pensions, and it disallows the federal traditional IRA deduction, ' +
        'the deductible half of self-employment tax and the early-withdrawal penalty, all of ' +
        'which have to be added back. Supply Form 1 line 21 — total 5.0% income, which includes ' +
        'interest, dividends and long-term capital gains and excludes the short-term and ' +
        'collectibles gains that have rates of their own.',
    },
    rate: { kind: 'flat', rate: 0.05 },
    separatelyRatedIncome: [
      {
        name: 'Short-term capital gains (8.5%)',
        field: 'shortTermCapitalGains',
        rate: 0.085,
      },
      {
        // The 12% is the statutory rate and the 50% is a deduction reaching Part
        // A adjusted gross income, so they are stored apart rather than as a
        // single effective 6%: the surtax applies to taxable income, which is
        // the figure after the deduction.
        name: 'Long-term gains on collectibles (12% on half the gain)',
        field: 'collectiblesGains',
        rate: 0.12,
        deductionShare: 0.5,
      },
    ],
    deduction: { kind: 'none' },
    payrollTaxDeduction: {
      name: 'Social Security, Medicare and public retirement contributions',
      perFilerCap: 2_000,
    },
    rentDeduction: {
      name: 'Rental deduction',
      share: 0.5,
      cap: byStatus({ single: 4_000, joint: 4_000, separate: 2_000, headOfHousehold: 4_000 }),
    },
    exemption: {
      perFiler: byStatus({
        single: 4_400,
        joint: 8_800,
        separate: 4_400,
        headOfHousehold: 6_800,
        // Massachusetts has no qualifying surviving spouse status at all, so the
        // usual default of "surviving spouse follows joint" would invent an
        // $8,800 exemption the Form 1 does not offer.
        qualifyingSurvivingSpouse: 4_400,
      }),
      perDependent: 1_000,
      perSeniorFiler: 700,
      seniorAge: 65,
      perBlindOrDisabledFiler: 2_200,
    },
    zeroTaxThreshold: {
      name: 'No Tax Status',
      threshold: byStatus({
        single: 8_000,
        // $7,600 plus the joint personal exemption of $8,800 is the published
        // $16,400; plus the head of household's $6,800 is the published $14,400.
        joint: 7_600,
        separate: 0,
        headOfHousehold: 7_600,
        qualifyingSurvivingSpouse: 8_000,
      }),
      perDependent: 1_000,
      addsPersonalExemption: byStatusOf<boolean>({
        single: false,
        joint: true,
        separate: false,
        headOfHousehold: true,
        qualifyingSurvivingSpouse: false,
      }),
      ineligibleFilingStatuses: ['marriedFilingSeparately'],
      limitedIncomeCredit: {
        name: 'Limited Income Credit',
        rate: 0.1,
        ceilingMultiple: 1.75,
      },
    },
    surtax: {
      name: '4% surtax on taxable income',
      brackets: [
        { upTo: surtaxThreshold(year), rate: 0 },
        { upTo: Infinity, rate: 0.04 },
      ],
      thresholdNotDoubledForJoint: true,
    },
    earnedIncomeCredit: {
      name: 'Massachusetts earned income credit',
      matchRate: 0.4,
      refundable: true,
    },
    childCredit: {
      name: 'Child and Family Tax Credit',
      amountByAge: [
        { maxAge: 12, amount: 440 },
        { minAge: 65, amount: 440 },
      ],
      refundable: true,
    },
    notes: NOTES,
    citations: CITATIONS,
  };
}

export { surtaxThreshold as massachusettsSurtaxThreshold };
