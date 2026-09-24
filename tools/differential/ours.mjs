/**
 * This project's answer for every case, in the shared comparison schema.
 *
 * Run from the repository root after building both packages:
 *
 * ```
 * node tools/differential/ours.mjs > tools/differential/out/ours.json
 * ```
 */
import { estimateFederalTax } from '../../packages/us-federal-tax/dist/esm/index.js';
import { stateIncomeTax } from '../../packages/us-state-tax/dist/esm/index.js';
import { cases } from './cases.mjs';

/** Federal child tax credit counts. § 24 is under 17; § 32 is under 19. */
function childCounts(childAges) {
  return {
    qualifyingChildren: childAges.filter((a) => a < 17).length,
    otherDependents: childAges.filter((a) => a >= 17).length,
    eitcQualifyingChildren: childAges.filter((a) => a < 19).length,
  };
}

/**
 * Pennsylvania and New Jersey do not start from a federal figure, so the
 * harness has to state their base itself. Both are stated the way the statute
 * reads for these households and the reasoning is in the README: a disagreement
 * here is a disagreement about the harness, and is reported as its own class.
 */
function stateDefinedBase(state, c) {
  if (state === 'PA') {
    // 72 Pa. Stat. § 7303: compensation and net gains are taxed; distributions
    // from a qualified plan after retirement age and Social Security are not.
    const retired = c.primaryAge >= 59.5;
    const pension = retired ? 0 : c.pension;
    return { pennsylvaniaTaxableIncome: c.wages + pension + c.longTermCapitalGains };
  }
  if (state === 'MA') {
    // Form 1 line 21: wages, a private employer pension, interest, dividends
    // and long-term gains. Social Security is excluded entirely.
    return { massachusettsFivePercentIncome: c.wages + c.pension + c.longTermCapitalGains };
  }
  if (state === 'NJ') {
    // N.J.S.A. 54A:5-1: wages, net gains and pension distributions are gross
    // income; Social Security is not. The pension exclusion is the engine's.
    return { newJerseyGrossIncome: c.wages + c.pension + c.longTermCapitalGains };
  }
  return {};
}

function one(c) {
  const counts = childCounts(c.childAges);
  const fed = estimateFederalTax({
    filingStatus: c.filingStatus,
    year: c.year,
    w2Wages: c.wages,
    otherOrdinaryIncome: c.pension,
    longTermCapitalGains: c.longTermCapitalGains,
    socialSecurityBenefits: c.socialSecurity,
    taxExemptInterest: c.taxExemptInterest,
    age: c.primaryAge,
    spouseAge65OrOlder: c.spouseAge !== null && c.spouseAge >= 65,
    // § 151(b), which § 63(f)(1)(B) makes the condition for a SEPARATE return
    // claiming the spouse's age and blindness amounts. The engine cannot infer
    // it, because a return does not say what the other return holds — but this
    // harness can, because it BUILT the household: every case puts all of its
    // income on the primary, and `theirs.py` adds the spouse with none, so a
    // spouse in this grid always has no gross income and is nobody's dependent.
    // Leaving it off would make the two sides answer different questions and
    // then report the difference as a divergence.
    spouseHasNoGrossIncomeAndIsNotADependent: c.spouseAge !== null,
    blind: c.blind >= 1,
    spouseBlind: c.blind >= 2,
    ...counts,
  });

  const person = {
    employerPlanPension: c.pension,
    socialSecurityBenefits: c.socialSecurity,
    investmentIncome: c.longTermCapitalGains,
    earnedIncome: c.wages,
  };
  const base = {
    state: c.state,
    year: c.year,
    filingStatus: c.filingStatus,
    federal: {
      adjustedGrossIncome: fed.adjustedGrossIncome,
      taxableIncome: fed.taxableIncome,
      deduction: fed.deduction,
      deductionKind: fed.deductionKind,
      earnedIncomeCredit: fed.credits.earnedIncomeCredit?.credit ?? 0,
    },
    filerAge: c.primaryAge,
    spouseAge: c.spouseAge ?? undefined,
    blindOrDisabled: c.blind || undefined,
    taxableSocialSecurity: fed.socialSecurity?.taxableBenefits ?? 0,
    taxExemptInterest: c.taxExemptInterest,
    // The same dollars again, under the name Illinois's addition asks for.
    //
    // A case says "$10,000 of municipal bond interest" and does not say whose
    // bonds, because nothing in either model's input schema distinguishes them:
    // PolicyEngine treats the whole of `tax_exempt_interest_income` as an
    // Illinois addition with no in-state carve-out. Passing it here as entirely
    // out-of-state is what makes the two sides answer the SAME question. This
    // package's own answer for an Illinois resident holding Illinois bonds is
    // different and better, and no case in this grid asks it.
    outOfStateMunicipalInterest: c.taxExemptInterest,
    dependents: c.childAges.length || undefined,
    dependentAges: c.childAges.length ? c.childAges : undefined,
    earnedIncome: c.wages,
    investmentIncome: c.longTermCapitalGains,
    retirement: { filer: person },
    ...(c.county ? { county: c.county.ours } : {}),
    ...stateDefinedBase(c.state, c),
  };

  let state = null;
  let error = null;
  try {
    const result = stateIncomeTax(base);
    state = {
      // `totalTax`, not `tax`: PolicyEngine's `state_income_tax` includes the
      // local income tax where one is universal, and so must this. Comparing
      // `tax` made every Maryland household look like a $700-$12,000
      // disagreement about Maryland when it was a county tax on one side only.
      tax: result.totalTax,
      credits: (result.credits ?? []).map((cr) => ({ name: cr.name, amount: cr.amount })),
    };
  } catch (e) {
    error = String(e?.message ?? e);
  }

  return {
    id: c.id,
    federal: {
      adjustedGrossIncome: fed.adjustedGrossIncome,
      taxableIncome: fed.taxableIncome,
      incomeTaxBeforeCredits: fed.incomeTaxBeforeCredits,
      taxableSocialSecurity: fed.socialSecurity?.taxableBenefits ?? 0,
      childTaxCredit:
        (fed.credits.childTaxCredit?.nonRefundableCredit ?? 0) +
        (fed.credits.childTaxCredit?.refundableCredit ?? 0),
      earnedIncomeCredit: fed.credits.earnedIncomeCredit?.credit ?? 0,
    },
    state,
    error,
  };
}

const results = {};
for (const c of cases()) results[c.id] = one(c);
process.stdout.write(`${JSON.stringify(results, null, 1)}\n`);
