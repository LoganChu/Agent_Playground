/**
 * This package's answer for every anchor household in `out/anchors.json`.
 *
 * Run from the repository root, after building both packages:
 *
 * ```
 * node tools/anchors/ours.mjs > tools/anchors/out/ours.json
 * ```
 *
 * ## THE SAFETY PROPERTY IS THE SAME ONE `read.py` HAS, FROM THE OTHER SIDE
 *
 * `read.py` refuses a fixture carrying a fact it cannot translate. This file
 * refuses a translated fact it cannot PASS. Both refusals exist because the
 * defect they guard against is identical and silent: a household fact that
 * reaches neither engine turns a correct answer into a disagreement, and a
 * disagreement about the harness is indistinguishable from a disagreement
 * about the tax -- except that the second one is worth money and the first one
 * wastes a day.
 *
 * So `PASSED` below is exhaustive by construction: any key on a person that is
 * not in it throws, by name, with the anchor's id. The two maps are written in
 * two languages in two files and the only thing keeping them in step is that
 * the gap between them is a crash.
 */
import { estimateFederalTax, ficaTax } from '../../packages/us-federal-tax/dist/esm/index.js';
import { stateIncomeTax, SUPPORTED_STATES, getStateDefinition } from '../../packages/us-state-tax/dist/esm/index.js';
import { readFileSync } from 'node:fs';

/**
 * Every key `read.py` can put on a person, and nothing else.
 *
 * `role` and `age` are structure; the rest is money. A key here is handled
 * below; a key not here throws. `qualifiedDividends` is in `read.py`'s map and
 * absent from this one ON PURPOSE: this package's federal engine has no
 * qualified-dividend input, so the only honest things to do with one are to
 * fold it into the long-term gain -- which taxes it at the right rate and
 * misstates the composition that three states read -- or to refuse. It
 * refuses, and no anchor kept so far carries one, so the refusal has cost
 * nothing yet and will announce itself the day it does.
 */
const PASSED = new Set([
  'role', 'age', 'blind',
  'wages', 'interest', 'pension', 'socialSecurity',
  'longTermCapitalGains', 'shortTermCapitalGains',
  'unemployment', 'taxExemptInterest',
  'mortgageInterest', 'realEstateTaxes', 'rent',
]);

function sum(people, key) {
  return people.reduce((t, p) => t + (p[key] ?? 0), 0);
}

function one(anchor) {
  const { id, year, state, filingStatus, people } = anchor;

  for (const person of people) {
    for (const key of Object.keys(person)) {
      if (!PASSED.has(key)) {
        throw new Error(
          `${id}: person carries \`${key}\` and tools/anchors/ours.mjs cannot pass it. ` +
            'Add it to PASSED and to the input below, or remove it from read.py\'s ' +
            'PERSON_MONEY so the case is refused rather than answered wrongly.',
        );
      }
    }
  }

  if (!SUPPORTED_STATES.includes(state)) throw new Error(`${id}: ${state} is not shipped`);
  if (getStateDefinition(state, year) === undefined) throw new Error(`${id}: no ${state} rule for ${year}`);

  const filer = people.find((p) => p.role === 'primary');
  const spouse = people.find((p) => p.role === 'spouse') ?? null;
  const dependents = people.filter((p) => p.role === 'dependent');
  if (filer === undefined) throw new Error(`${id}: no primary filer`);

  const wages = sum(people, 'wages');
  const interest = sum(people, 'interest');
  const pension = sum(people, 'pension');
  const socialSecurity = sum(people, 'socialSecurity');
  const longTermCapitalGains = sum(people, 'longTermCapitalGains');
  const shortTermCapitalGains = sum(people, 'shortTermCapitalGains');
  const unemployment = sum(people, 'unemployment');
  const taxExemptInterest = sum(people, 'taxExemptInterest');
  const mortgageInterest = sum(people, 'mortgageInterest');
  const realEstateTaxes = sum(people, 'realEstateTaxes');
  const rent = sum(people, 'rent');
  const childAges = dependents.map((d) => d.age ?? 0);
  const blind = people.filter((p) => p.role !== 'dependent' && p.blind).length;

  const fed = estimateFederalTax({
    filingStatus,
    year,
    w2Wages: wages,
    // Interest, a pension distribution and unemployment compensation are all
    // ordinary income on a federal return and this engine takes them in one
    // field. The STATE side below keeps them apart, because several states
    // exclude a pension and none of them excludes interest.
    otherOrdinaryIncome: interest + pension + unemployment,
    longTermCapitalGains,
    socialSecurityBenefits: socialSecurity,
    taxExemptInterest,
    age: filer.age ?? undefined,
    spouseAge65OrOlder: spouse !== null && (spouse.age ?? 0) >= 65,
    spouseHasNoGrossIncomeAndIsNotADependent:
      spouse !== null && !(spouse.wages || spouse.interest || spouse.pension || spouse.unemployment),
    blind: blind >= 1,
    spouseBlind: blind >= 2,
    ...(realEstateTaxes ? { stateAndLocalTaxesPaid: realEstateTaxes } : {}),
    ...(mortgageInterest ? { otherItemizedDeductions: mortgageInterest } : {}),
    qualifyingChildren: childAges.filter((a) => a < 17).length,
    otherDependents: childAges.filter((a) => a >= 17).length,
    eitcQualifyingChildren: childAges.filter((a) => a < 19).length,
  });

  const input = {
    state,
    year,
    filingStatus,
    federal: {
      adjustedGrossIncome: fed.adjustedGrossIncome,
      taxableIncome: fed.taxableIncome,
      deduction: fed.deduction,
      deductionKind: fed.deductionKind,
      earnedIncomeCredit: fed.credits.earnedIncomeCredit?.credit ?? 0,
      incomeTaxBeforeRefundableCredits:
        Math.max(0, fed.incomeTaxBeforeCredits - fed.credits.totalNonRefundable) +
        fed.netInvestmentIncomeTax,
      additionalChildTaxCredit: fed.credits.childTaxCredit?.refundableCredit ?? 0,
    },
    federalDeductions: {
      tips: fed.additionalDeductions.tips.deduction,
      overtime: fed.additionalDeductions.overtime.deduction,
      senior: fed.additionalDeductions.senior.deduction,
      carLoanInterest: fed.additionalDeductions.vehicleLoanInterest.deduction,
    },
    filerAge: filer.age ?? undefined,
    spouseAge: spouse?.age ?? undefined,
    spouseHasNoGrossIncomeAndIsNotADependent:
      spouse !== null && !(spouse.wages || spouse.interest || spouse.pension || spouse.unemployment),
    spouseAdjustedFederalAdjustedGrossIncome: spouse !== null ? undefined : undefined,
    blindOrDisabled: blind || undefined,
    socialSecurityAndMedicarePaid:
      wages > 0 ? ficaTax({ year, wages, filingStatus }).employee.total : undefined,
    taxableSocialSecurity: fed.socialSecurity?.taxableBenefits ?? 0,
    taxExemptInterest,
    outOfStateMunicipalInterest: taxExemptInterest,
    dependents: childAges.length || undefined,
    dependentAges: childAges.length ? childAges : undefined,
    earnedIncome: wages,
    investmentIncome: longTermCapitalGains + shortTermCapitalGains,
    netCapitalGain: longTermCapitalGains || undefined,
    longTermCapitalGainAfter2011: longTermCapitalGains || undefined,
    shortTermCapitalGains: shortTermCapitalGains || undefined,
    retirementIncome: pension || undefined,
    // The pension split, which the differential harness also supplies: left
    // out, the engine puts the whole of it on one spouse, which is the worst
    // of the three readings for a state with a per-person exclusion.
    retirement: {
      filer: { employerPlanPension: filer.pension ?? 0 },
      ...(spouse === null ? {} : { spouse: { employerPlanPension: spouse.pension ?? 0 } }),
    },
    ...(realEstateTaxes ? { propertyTaxPaid: realEstateTaxes } : {}),
    ...(rent && !realEstateTaxes ? { rentPaid: rent } : {}),
    // VIRGINIA'S SPOUSE TAX ADJUSTMENT IS DELIBERATELY NOT ASSERTED HERE, AND
    // THE FIRST VERSION OF THIS FILE ASSERTED IT AND WAS WRONG BY $9.58.
    //
    // `bothSpousesHaveQualifyingIncome` and `lesserSpouseIncome` are a pair and
    // the second one is documented as **line 5 of the worksheet**: the lesser
    // spouse's Virginia adjusted gross income LESS THE EXEMPTIONS CLAIMED FOR
    // THAT SPOUSE. The first version passed the lesser spouse's own gross
    // non-Social-Security income instead -- $255.50 of interest on the anchored
    // household -- and wrote a comment saying it was not computing line 5, as
    // though naming the shortcut excused it. The engine did what it was told,
    // produced a $9.58 adjustment, and the anchor said TaxAct, TAXSIM-35 and
    // Virginia's own Form 760 worksheet all give zero.
    //
    //   A FIELD DOCUMENTED AS A WORKSHEET LINE TAKES THAT LINE OR NOTHING.
    //   Passing a DIFFERENT figure into it is not an approximation of the rule,
    //   it is a different rule -- and here it invented eligibility for a spouse
    //   whose income is below her own exemptions.
    //
    // Line 5 is a Virginia computation on Virginia figures, so the harness
    // cannot supply it without reimplementing the state inside the instrument
    // that is supposed to be checking the state. It therefore supplies NEITHER,
    // which leaves the adjustment unclaimed -- and that is reported as a
    // LIMITATION of this harness rather than as agreement, because a Virginia
    // two-earner couple who genuinely qualify would be overstated by up to
    // $257.50 here. `compare.mjs` carries the limitation by name so no
    // Virginia joint agreement is read as evidence about the adjustment.
  };

  try {
    const r = stateIncomeTax(input);
    return {
      id,
      ours: {
        totalTax: r.totalTax,
        tax: r.tax,
        taxableIncome: r.taxableIncome,
        taxBeforeCredits: r.taxBeforeCredits,
      },
      federal: {
        adjustedGrossIncome: fed.adjustedGrossIncome,
        taxableIncome: fed.taxableIncome,
        deductionKind: fed.deductionKind,
        deduction: fed.deduction,
      },
      credits: (r.credits ?? []).map((c) => ({ name: c.name, amount: c.amount })),
      notes: r.notes ?? [],
      error: null,
    };
  } catch (e) {
    return { id, ours: null, federal: null, credits: [], notes: [], error: String(e?.message ?? e) };
  }
}

const url = new URL('./out/anchors.json', import.meta.url);
const { anchors } = JSON.parse(readFileSync(url, 'utf8'));
const out = {};
for (const anchor of anchors) out[anchor.id] = one(anchor);
process.stdout.write(`${JSON.stringify(out, null, 1)}\n`);
