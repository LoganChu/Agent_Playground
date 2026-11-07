/**
 * What explains a disagreement, decided mechanically, with its evidence class
 * named.
 *
 * `OFFER.md` prices a verification audit at $2,500 and promises that for every
 * disagreement the report names the household, the two figures, the dollar size
 * of the gap and the statute line that settles it. For seventy-three days that
 * was a promise about work a human would do by hand. This file is the part of it
 * that is arithmetic.
 *
 * **THE RULE THIS FILE IS BUILT ON: A DIAGNOSIS IS WORTH WHAT ITS EVIDENCE IS
 * WORTH, SO EVERY DIAGNOSIS CARRIES ITS EVIDENCE CLASS AND THEY ARE NOT
 * INTERCHANGEABLE.** Three classes, strongest first:
 *
 *   `recomputed`     the engine was re-run with one thing changed and returned
 *                    the buyer's figure. This is not a theory about their bug;
 *                    it is their number, produced on demand, from a stated
 *                    change. Nothing weaker should ever be reported as this.
 *   `arithmetic`     the buyer's figure equals a figure THIS result already
 *                    reports, or this result's answer plus or minus exactly one
 *                    named line item of it. Exact to the cent, and the line item
 *                    is named from the engine's own output rather than guessed.
 *
 * And the third outcome, which is the one that keeps the other two honest:
 * `unexplained`. A report that explains every gap is a report with a catch-all
 * in it. The headline counts them.
 *
 * **THERE WAS A THIRD CLASS AND IT WAS DELETED ON THE DAY IT WAS WRITTEN.**
 * `rate-estimate` reported a gap that equalled a named add-back or computed
 * subtraction times this return's marginal rate. It was labelled a candidate
 * rather than a finding, which was honest, and it was still wrong to ship:
 *
 *   - For the one add-back this schema can express — Illinois's addition for
 *     other states' municipal interest — the gap does not need estimating,
 *     because the figure that drives it is a column the buyer filled in. Zero
 *     that column, re-run, and the engine either returns their number or does
 *     not. That is `recomputed`, and it strictly dominates the estimate.
 *   - For the one computed subtraction in the package — New Jersey's pension and
 *     retirement income exclusion — the estimate is unreachable. The exclusion
 *     is all-or-nothing against a total-income test, so on every household it
 *     applies to, the New Jersey tax is `0` and the marginal rate is `0`, and a
 *     rate of zero times anything explains no gap.
 *
 * So its whole domain was either better served or empty, and nothing in the
 * demo exercised it — which is how it was found: a deliberate mislabelling of
 * its evidence class as `recomputed` did not fail a single test. An evidence
 * class no input reaches is a class nobody is checking.
 */
import { stateIncomeTax, supportedYears } from '../../packages/us-state-tax/dist/esm/index.js';
import { engineInput } from './household.mjs';

/** Equal to the cent. Every figure this engine returns is already rounded there. */
export const CENT = 0.005;
export const equalToCent = (a, b) => Math.abs(a - b) < CENT;

/** The five statuses, so "they used the wrong one" can be tested rather than supposed. */
const FILING_STATUSES = [
  'single',
  'marriedFilingJointly',
  'marriedFilingSeparately',
  'headOfHousehold',
  'qualifyingSurvivingSpouse',
];

const run = (household, overrides = {}) => {
  const { base } = engineInput({ ...household, ...overrides });
  return stateIncomeTax(base);
};

/**
 * Re-run the household with one thing changed, and report it only if the engine
 * then returns the buyer's own figure.
 *
 * This is the `recomputed` class and it is the only function here allowed to
 * produce it. Note that it compares against `totalTax`: a diagnosis that matched
 * the state line while the buyer's figure includes a county tax would be a
 * coincidence dressed as a finding.
 */
function recomputedMatches(household, theirTax) {
  const found = [];

  // 1. STALE PARAMETERS — their figure is this engine's answer for an earlier
  //    tax year. This is the single most valuable thing the audit can find, and
  //    the reason is commercial rather than technical: it is the one defect a
  //    buyer cannot fix by reading a statute, because the statute is right and
  //    the figure is last year's. It is also exactly what the freshness
  //    subscription sells, demonstrated instead of asserted.
  for (const year of supportedYears(household.state)) {
    if (year === household.year) continue;
    try {
      const other = run(household, { year });
      if (equalToCent(other.totalTax, theirTax)) {
        found.push({
          evidence: 'recomputed',
          kind: 'stale-parameters',
          title: `this engine's answer for tax year ${year}, not ${household.year}`,
          detail:
            `Running the same household at year ${year} returns ${money(other.totalTax)}, ` +
            `which is the figure supplied. The ${household.year} answer is ` +
            `${money(run(household).totalTax)}. A parameter that did not get re-read is ` +
            'not a reading of the law; it is last year\'s reading, and the law moved.',
          amount: theirTax - run(household).totalTax,
        });
      }
    } catch {
      // A year this state does not support is not a diagnosis.
    }
  }

  // 2. FILING STATUS — their figure is this engine's answer for a different one.
  //    Commonest in the two married statuses and in head of household, which a
  //    product that stores a boolean `married` cannot distinguish from
  //    `qualifyingSurvivingSpouse` at all.
  //
  //    **AND THIS CLASS IS STRUCTURALLY CONFUSABLE, WHICH WAS MEASURED RATHER
  //    THAN SUPPOSED.** Day 74 ran this tool over 2,904 households against
  //    `policyengine-us`'s own figures. It fired here 66 times, and on 63 of
  //    them the differential harness's hand-written account says something
  //    else and better: PolicyEngine allows the § 32(d) earned income credit to
  //    EVERY married-filing-separately filer, and this package does not. On a
  //    state return whose only status-sensitive line is a percentage of that
  //    federal credit, **"they used the status `single`" and "they allowed a
  //    separate filer the credit only a single filer gets" are the same number.**
  //    A re-run cannot tell them apart, because both re-runs are the same
  //    re-run.
  //
  //    So the finding carries the discriminator with it: if the tax BEFORE
  //    credits is identical under both statuses, nothing but a credit moved and
  //    the match says nothing about which cause it was. If it differs, the
  //    status changed a bracket, a deduction or an exemption, and the match is
  //    specific to the status. The tool reports which, and does not pretend to
  //    know more than that.
  for (const filingStatus of FILING_STATUSES) {
    if (filingStatus === household.filingStatus) continue;
    try {
      const other = run(household, { filingStatus });
      if (!equalToCent(other.totalTax, theirTax)) continue;
      const base = run(household);
      const onlyCreditsMoved = equalToCent(other.taxBeforeCredits, base.taxBeforeCredits);
      const movedCredits = [...base.credits, ...other.credits]
        .filter((credit) => credit.amount > 0)
        .map((credit) => credit.name);
      found.push({
        evidence: 'recomputed',
        kind: 'filing-status',
        confusable: onlyCreditsMoved,
        title:
          `this engine's answer for ${filingStatus}, not ${household.filingStatus}` +
          (onlyCreditsMoved ? ' — BUT ONLY A CREDIT MOVED, SO THIS IS NOT CONCLUSIVE' : ''),
        detail: onlyCreditsMoved
          ? `The same household filed as ${filingStatus} owes ${money(other.totalTax)}, which ` +
            'is the figure supplied — but the tax BEFORE credits is identical under both ' +
            `statuses at ${money(base.taxBeforeCredits)}, so the only thing the status ` +
            'changed on this return is a credit' +
            (movedCredits.length > 0 ? ` (${[...new Set(movedCredits)].join('; ')})` : '') +
            '. **"They used the wrong status" and "they allowed a status-barred credit" ' +
            'are therefore the same figure here, and this match cannot distinguish them.** ' +
            'The credit is the likelier of the two in a product that knows its own users’ ' +
            'filing statuses.'
          : `The same household filed as ${filingStatus} owes ${money(other.totalTax)}, which ` +
            'is the figure supplied. The status also moves the tax before credits, from ' +
            `${money(base.taxBeforeCredits)} to ${money(other.taxBeforeCredits)} — a bracket, ` +
            'a deduction or an exemption, not just a credit — so the match is specific to ' +
            'the status. Both answers are correct computations; they are answers to ' +
            'different questions.',
        amount: theirTax - base.totalTax,
      });
    } catch {
      // A status a state does not allow is not a diagnosis.
    }
  }

  // 3. A FIGURE THE BUYER SUPPLIED THAT THEIR ENGINE DID NOT SPEND.
  //
  //    Every field below is a column in this tool's own input schema that the
  //    engine turns into a NAMED line item. So the question "did they make this
  //    addition?" does not have to be estimated: set the column to zero, run the
  //    whole return again, and the engine either returns their figure or does
  //    not. The probe is exact where a rate-times-amount estimate is a guess,
  //    because a graduated schedule, a credit phase-out and a deduction limit
  //    are all inside the re-run and none of them is inside the rate.
  //
  //    Illinois is the case that matters and it runs the wrong way from every
  //    other finding here: interest on other states' municipal bonds is in no
  //    federal base at all, so an engine that starts from federal AGI and stops
  //    there returns a figure that is too LOW. A buyer looking only for places
  //    they overcharge will never find it.
  for (const [field, what] of [['taxExemptInterest', 'tax-exempt interest']]) {
    if (!(household[field] > 0)) continue;
    try {
      const without = run(household, { [field]: 0 });
      if (!equalToCent(without.totalTax, theirTax)) continue;
      const base = run(household);
      const named = [...base.addBacks, ...base.computedSubtractions].filter(
        (item) => item.amount > 0,
      );
      found.push({
        evidence: 'recomputed',
        kind: 'supplied-figure-not-spent',
        title:
          named.length > 0
            ? `${named.map((item) => item.name).join('; ')} — not applied`
            : `the ${what} on this return was not applied`,
        detail:
          `Setting ${field} to 0 and running the whole return again returns ` +
          `${money(without.totalTax)}, which is the figure supplied. With the ` +
          `${money(household[field])} of ${what} it is ${money(base.totalTax)}` +
          (named.length > 0
            ? `, and the line item it moves is ${named
                .map((item) => `${item.name} ${money(item.amount)}`)
                .join('; ')}.`
            : '.') +
          ' This is a re-run of the engine rather than a rate times an amount, so a' +
          ' graduated schedule and any credit phase-out underneath it are already in it.',
        amount: theirTax - base.totalTax,
      });
    } catch {
      // A field a state does not read cannot be probed, and that is not a finding.
    }
  }

  return found;
}

/** `-$1,234.56`, not `$-1,234.56`. A gap is signed and the sign has to read. */
const money = (value) => {
  const rounded = Math.round(value * 100) / 100;
  const text = Math.abs(rounded).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${rounded < 0 ? '-' : ''}$${text}`;
};

/**
 * Their figure equals a figure this result already reports, or this result's
 * answer plus or minus exactly one named line item of it.
 *
 * Every branch is exact to the cent and every name comes out of
 * `StateIncomeTaxResult` rather than out of this file, which is what makes the
 * named provision checkable: a reader can find it in the engine's own output.
 */
function arithmeticMatches(result, theirTax) {
  const found = [];
  const ours = result.totalTax;
  const localTotal = result.localTaxes.reduce((sum, local) => sum + local.tax, 0);

  // 3. NO CREDITS AT ALL. Checked against both the state line and the state
  //    line plus local, because a product that drops credits usually drops them
  //    at one level and not the other.
  const creditsWorth = result.credits.reduce((sum, credit) => sum + credit.amount, 0);
  if (creditsWorth > 0) {
    for (const [candidate, what] of [
      [result.taxBeforeCredits, 'the state tax before credits'],
      [result.taxBeforeCredits + localTotal, 'the state tax before credits, plus local tax'],
    ]) {
      if (equalToCent(candidate, theirTax) && !equalToCent(candidate, ours)) {
        found.push({
          evidence: 'arithmetic',
          kind: 'credits-not-applied',
          title: `${what} — every credit on this return was dropped`,
          detail:
            `${money(theirTax)} is exactly ${what} on this return. The ` +
            `${result.credits.filter((c) => c.amount > 0).length} credit(s) worth ` +
            `${money(creditsWorth)} together are: ` +
            result.credits
              .filter((credit) => credit.amount > 0)
              .map((credit) => `${credit.name} ${money(credit.amount)}`)
              .join('; '),
          amount: theirTax - ours,
        });
      }
    }
  }

  // 4. LOCAL INCOME TAX DROPPED. The state return is right and the county,
  //    city or school district on top of it is missing. 1,033 of these ship in
  //    this package and the great majority of state tax tables have none of
  //    them, so this is the likeliest single finding in any real audit.
  if (result.localTaxes.length > 0 && !equalToCent(result.tax, ours)) {
    if (equalToCent(result.tax, theirTax)) {
      found.push({
        evidence: 'arithmetic',
        kind: 'local-tax-omitted',
        title: 'the state tax exactly, with the local income tax missing',
        detail:
          `${money(theirTax)} is this engine's state figure to the cent. What is absent is ` +
          result.localTaxes
            .map(
              (local) =>
                `${local.localityName} (${local.basis}, on ${local.base}) ${money(local.tax)}`,
            )
            .join('; ') +
          `. A state return is not a filer's bill where a locality taxes income too.`,
        amount: theirTax - ours,
      });
    }
  }

  // 5. ONE NAMED CREDIT MISSING, and one only. A buyer whose figure is higher
  //    than this engine's by exactly the amount of one credit is not making a
  //    rounding error.
  for (const credit of result.credits) {
    if (credit.amount <= 0) continue;
    if (equalToCent(ours + credit.amount, theirTax)) {
      found.push({
        evidence: 'arithmetic',
        kind: 'credit-omitted',
        title: `${credit.name} — ${money(credit.amount)}, not taken`,
        detail:
          `${money(theirTax)} is this engine's answer plus exactly ${money(credit.amount)}, ` +
          `which is this return's ${credit.name}. It is ` +
          `${credit.refundable ? 'refundable, so it is not capped at the tax' : 'non-refundable'}.`,
        amount: theirTax - ours,
      });
    }
  }

  // 6. A SURTAX MISSING — California's 1% over $1,000,000, Massachusetts's 4%
  //    over the indexed threshold. Their figure is LOWER by the surtax.
  for (const surtax of result.surtaxes) {
    if (surtax.amount <= 0) continue;
    if (equalToCent(ours - surtax.amount, theirTax)) {
      found.push({
        evidence: 'arithmetic',
        kind: 'surtax-omitted',
        title: `${surtax.name} — ${money(surtax.amount)}, not charged`,
        detail:
          `${money(theirTax)} is this engine's answer less exactly ${money(surtax.amount)}, ` +
          `which is this return's ${surtax.name}. A rate table with one row per state ` +
          'does not have this rate in it.',
        amount: theirTax - ours,
      });
    }
  }

  // 7. A STATE WITH NO INCOME TAX, CHARGED ANYWAY — or the reverse. Nine states
  //    do not tax wage income and a product with a rate table keyed by state
  //    sometimes carries a stale row for one of them.
  if (!result.hasIncomeTax && !equalToCent(theirTax, 0)) {
    found.push({
      evidence: 'arithmetic',
      kind: 'no-income-tax-state',
      title: `${result.stateName} does not tax this income, and ${money(theirTax)} was charged`,
      detail:
        `${result.stateName} levies no individual income tax on wage income for ` +
        `${result.year}. The whole of ${money(theirTax)} is charged to a filer who does ` +
        'not owe it.',
      amount: theirTax - ours,
    });
  }

  // 8. A RATE TABLE RATHER THAN A SCHEDULE — the top rate applied to the whole
  //    of taxable income. This is what "state income tax rates" tables produce
  //    and it overstates every graduated state's bill at every income.
  const topRate = result.brackets.reduce((top, band) => Math.max(top, band.rate), 0);
  if (result.brackets.length > 1) {
    const flat = Math.round(topRate * result.taxableIncome * 100) / 100;
    if (equalToCent(flat, theirTax) && !equalToCent(flat, ours)) {
      found.push({
        evidence: 'arithmetic',
        kind: 'top-rate-on-whole-base',
        title: `the top rate of ${(topRate * 100).toFixed(2)}% applied to all taxable income`,
        detail:
          `${money(theirTax)} is ${(topRate * 100).toFixed(2)}% of the whole ` +
          `${money(result.taxableIncome)} of taxable income. The schedule has ` +
          `${result.brackets.length} bands and charges ${money(result.taxBeforeCredits)} ` +
          'before credits. A single rate per state is the commonest way to be wrong ' +
          'about a graduated state.',
        amount: theirTax - ours,
      });
    }
  }

  // 9. ROUNDING. Under a dollar and not zero. Not a defect in either engine
  //    necessarily — states differ on whether the filer rounds and where — so
  //    it is reported as its own class rather than as an error.
  const gap = theirTax - ours;
  if (found.length === 0 && Math.abs(gap) >= CENT && Math.abs(gap) < 1) {
    found.push({
      evidence: 'arithmetic',
      kind: 'rounding',
      title: `${money(Math.abs(gap))} — a rounding difference, not a reading of the law`,
      detail:
        'The two figures differ by less than a dollar. States differ on whether the ' +
        'filer rounds to the dollar, at which line, and in which direction; New ' +
        "Mexico's Department changed its own rule after 2023. Worth settling once, " +
        'and not worth settling per household.',
      amount: gap,
    });
  }

  return found;
}

/**
 * One household: this engine's answer, the buyer's, and what explains the gap.
 *
 * Returns `agreement: true` and no diagnoses when the two agree to the cent,
 * which is the outcome a buyer should want and the one the headline leads with.
 */
export function diagnose({ household, theirTax, defaulted, unknownColumns }) {
  let result;
  try {
    result = run(household);
  } catch (error) {
    return {
      id: household.id,
      household,
      theirTax,
      error: String(error?.message ?? error),
      diagnoses: [],
      defaulted,
      unknownColumns,
    };
  }
  const ours = result.totalTax;
  const agreement = equalToCent(ours, theirTax);
  const diagnoses = agreement
    ? []
    : [
        ...recomputedMatches(household, theirTax),
        ...arithmeticMatches(result, theirTax),
      ];
  return {
    id: household.id,
    household,
    theirTax,
    ours,
    agreement,
    gap: theirTax - ours,
    result,
    diagnoses,
    defaulted,
    unknownColumns,
    citations: result.citations,
  };
}

export { money };
