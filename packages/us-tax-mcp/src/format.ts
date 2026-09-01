/**
 * Rendering a result into the text an assistant actually reads.
 *
 * Every tool returns both `structuredContent` (the engine's result verbatim,
 * for a program) and a text block (for a model). The text is not decoration:
 * a model that receives only JSON will paraphrase the numbers and frequently
 * paraphrase them wrong, so the text block states the figures that matter in
 * the order a person asks for them, and says out loud the things that are easy
 * to get backwards — that a credit phase-out beats the bracket, that a
 * non-refundable credit cannot touch self-employment tax.
 */
import type {
  AdditionalDeductionsResult,
  EstimateResult,
  PaycheckResult,
  QuarterlyPlan,
  WithholdingPlan,
} from './engine/index.js';

/**
 * Schedule 1-A's four parts, in Form 1040 order.
 *
 * The engine names them rather than listing them, because they are four
 * different statutes with four different phase-out rules — see the § 224 / § 225
 * / § 163(h)(4) note in the engine's README. This table exists only to render
 * them in a fixed order.
 */
const SCHEDULE_ONE_A_PARTS: readonly [
  string,
  keyof Pick<AdditionalDeductionsResult, 'tips' | 'overtime' | 'senior' | 'vehicleLoanInterest'>,
][] = [
  ['qualified tips (§ 224)', 'tips'],
  ['qualified overtime (§ 225)', 'overtime'],
  ['senior deduction', 'senior'],
  ['vehicle loan interest (§ 163(h)(4))', 'vehicleLoanInterest'],
];

export function money(value: number): string {
  const sign = value < 0 ? '-' : '';
  const absolute = Math.abs(value);
  const whole = Math.floor(absolute);
  const cents = Math.round((absolute - whole) * 100);
  const grouped = whole.toLocaleString('en-US');
  return `${sign}$${grouped}.${String(cents).padStart(2, '0')}`;
}

/** Whole dollars, for figures where cents are noise (brackets, thresholds). */
export function dollars(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.round(Math.abs(value)).toLocaleString('en-US')}`;
}

export function percent(rate: number, decimals = 2): string {
  return `${(rate * 100).toFixed(decimals)}%`;
}

const STATUS_LABELS: Record<string, string> = {
  single: 'single',
  marriedFilingJointly: 'married filing jointly',
  marriedFilingSeparately: 'married filing separately',
  headOfHousehold: 'head of household',
  qualifyingSurvivingSpouse: 'qualifying surviving spouse',
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function line(label: string, value: string): string {
  return `${label.padEnd(34)}${value.padStart(16)}`;
}

/** The full estimate, as a model wants to read it. */
export function renderEstimate(estimate: EstimateResult): string {
  const rows: string[] = [];

  rows.push(`Tax year ${estimate.year}, ${statusLabel(estimate.filingStatus)}`);
  rows.push('');
  rows.push(line('Gross income', money(estimate.grossIncome)));
  rows.push(line('Adjusted gross income', money(estimate.adjustedGrossIncome)));
  rows.push(
    line(
      `Deduction (${estimate.deductionKind})`,
      money(estimate.deduction),
    ),
  );

  if (estimate.stateAndLocalTax) {
    const salt = estimate.stateAndLocalTax;
    rows.push(
      line(
        '  state and local tax',
        `${money(salt.deduction)} of ${money(salt.stateAndLocalTaxesPaid)}`,
      ),
    );
    if (salt.deduction < salt.stateAndLocalTaxesPaid) {
      rows.push(line('  SALT cap after phase-down', money(salt.cap)));
    }
  }

  const sched = estimate.additionalDeductions;
  if (sched.total > 0) {
    rows.push(line('Schedule 1-A (OBBBA)', money(sched.total)));
    for (const [label, part] of SCHEDULE_ONE_A_PARTS) {
      const detail = sched[part];
      if (detail.deduction > 0) {
        rows.push(line(`  ${label}`, money(detail.deduction)));
      }
    }
  }

  if (estimate.qualifiedBusinessIncomeDeduction > 0) {
    rows.push(line('Section 199A (QBI)', money(estimate.qualifiedBusinessIncomeDeduction)));
  }

  rows.push(line('Taxable income', money(estimate.taxableIncome)));
  rows.push('');
  rows.push(line('Ordinary income tax', money(estimate.ordinaryIncomeTax)));
  if (estimate.capitalGainsTax > 0) {
    rows.push(line('Long-term capital gains tax', money(estimate.capitalGainsTax)));
  }
  if (estimate.selfEmployment.total > 0) {
    rows.push(line('Self-employment tax', money(estimate.selfEmployment.total)));
  }
  if (estimate.additionalMedicareTax > 0) {
    rows.push(line('Additional Medicare tax', money(estimate.additionalMedicareTax)));
  }
  if (estimate.netInvestmentIncomeTax > 0) {
    rows.push(line('Net investment income tax', money(estimate.netInvestmentIncomeTax)));
  }

  const ctc = estimate.credits.childTaxCredit;
  const eitc = estimate.credits.earnedIncomeCredit;
  const nonRefundable = estimate.credits.totalNonRefundable;
  const refundable = estimate.credits.totalRefundable;

  if (ctc !== null || (eitc !== null && eitc.credit > 0)) {
    rows.push('');
    if (ctc) {
      rows.push(line('Child tax credit (§ 24)', money(ctc.creditAfterPhaseOut)));
      if (ctc.nonRefundableCredit > 0) {
        rows.push(line('  applied against income tax', money(ctc.nonRefundableCredit)));
      }
      if (ctc.refundableCredit > 0) {
        rows.push(line('  refundable (ACTC)', money(ctc.refundableCredit)));
      }
      if (ctc.phaseOutReduction > 0) {
        rows.push(line('  lost to the phase-out', money(ctc.phaseOutReduction)));
      }
      if (ctc.unusedCredit > 0) {
        rows.push(line('  unused (neither offset nor paid)', money(ctc.unusedCredit)));
      }
    }
    if (eitc && eitc.credit > 0) {
      rows.push(line('Earned income credit (§ 32)', money(eitc.credit)));
    }
    rows.push(line('  total non-refundable', money(nonRefundable)));
    rows.push(line('  total refundable', money(refundable)));
  }

  rows.push('');
  rows.push(line('Total tax', money(estimate.totalTax)));
  if (estimate.totalTaxBeforeCredits !== estimate.totalTax) {
    rows.push(line('  (before credits)', money(estimate.totalTaxBeforeCredits)));
  }
  rows.push(line('Withholding', money(estimate.withholding)));
  rows.push(
    line(
      estimate.balanceDue >= 0 ? 'BALANCE DUE' : 'REFUND',
      money(Math.abs(estimate.balanceDue)),
    ),
  );
  rows.push('');
  rows.push(line('Marginal ordinary rate (bracket)', percent(estimate.marginalRate, 0)));
  rows.push(line('Effective rate on gross income', percent(estimate.effectiveRate)));

  const notes = estimateNotes(estimate);
  if (notes.length > 0) {
    rows.push('');
    rows.push('Notes:');
    for (const note of notes) rows.push(`- ${note}`);
  }

  return rows.join('\n');
}

/** § 32's four disqualifications, in words rather than in enum. */
const EITC_INELIGIBLE_REASONS: Record<string, string> = {
  investmentIncomeTooHigh:
    'disqualified investment income exceeds the § 32(i) limit, which is a hard cliff rather than a phase-out',
  filingSeparately:
    'a married filer filing separately needs a qualifying child and either six months apart or a separation decree (§ 32(d)(2)); set separatedFromSpouse if that is the case',
  ageOutsideChildlessRange:
    'with no qualifying children § 32(c)(1)(A)(ii)(II) allows the credit only from age 25 to 64',
  noEarnedIncome: 'there is no earned income for the credit to phase in on',
};

/**
 * The handful of statements that are true of this particular estimate and are
 * commonly got wrong. Only emitted when they actually apply.
 */
export function estimateNotes(estimate: EstimateResult): string[] {
  const notes: string[] = [];
  const ctc = estimate.credits.childTaxCredit;
  const eitc = estimate.credits.earnedIncomeCredit;

  const nonRefundable = estimate.credits.totalNonRefundable;
  if (nonRefundable > 0 && estimate.selfEmployment.total > 0) {
    notes.push(
      `Non-refundable credits reduced income tax by ${money(nonRefundable)} but cannot touch the ` +
        `${money(estimate.selfEmployment.total)} of self-employment tax — SE tax is not a chapter 1 ` +
        `subchapter A liability, so it survives the credit in full.`,
    );
  }

  if (eitc && eitc.credit > 0 && eitc.phaseOutReduction > 0) {
    notes.push(
      `The earned income credit is in its phase-out: ${money(eitc.phaseOutReduction)} of it has already ` +
        `been withdrawn at ${percent(eitc.phaseOutRate)} per additional dollar. The real cost of another ` +
        `dollar of income is well above the ${percent(estimate.marginalRate, 0)} bracket — call ` +
        `effective_marginal_rate to measure it.`,
    );
  }

  if (ctc && ctc.phaseOutReduction > 0) {
    notes.push(
      `The § 24 phase-out has taken ${money(ctc.phaseOutReduction)}. It rounds UP: one dollar over the ` +
        `threshold costs a full $50, not five cents (§ 24(b)(1), "or fraction thereof").`,
    );
  }

  if (
    estimate.stateAndLocalTax &&
    estimate.stateAndLocalTax.phaseDownReduction > 0
  ) {
    notes.push(
      `The § 164(b)(6) cap is phasing down: it has fallen ${money(
        estimate.stateAndLocalTax.phaseDownReduction,
      )} from ${money(estimate.stateAndLocalTax.statutoryCap)} to ${money(
        estimate.stateAndLocalTax.cap,
      )}. Inside the phase-down band the marginal rate is above the bracket, and it drops back once the ` +
        `cap reaches its floor.`,
    );
  }

  if (eitc !== null && eitc.ineligibleReason !== null) {
    notes.push(`Earned income credit is zero: ${EITC_INELIGIBLE_REASONS[eitc.ineligibleReason]}`);
  }

  if (eitc === null) {
    notes.push(
      'Earned income credit was not computed. With no qualifying children the § 32(c)(1)(A)(ii)(II) ' +
        'age test (25 to 64) decides eligibility, and no `age` was supplied — so the credit is reported ' +
        'as null rather than guessed at. Supply `age` to get a figure.',
    );
  }

  if (estimate.deductionKind === 'standard' && estimate.stateAndLocalTax) {
    notes.push(
      `The standard deduction (${money(estimate.deduction)}) beat itemizing, so the SALT figure above is ` +
        `shown for comparison only and did not affect the tax.`,
    );
  }

  return notes;
}

export function renderQuarterly(plan: QuarterlyPlan, estimate: EstimateResult): string {
  const rows: string[] = [];
  rows.push(`Quarterly estimated payments for ${estimate.year}, ${statusLabel(estimate.filingStatus)}`);
  rows.push('');
  rows.push(line('Projected total tax', money(estimate.totalTax)));
  rows.push(line('90% of this year (§ 6654(d)(1)(B)(i))', money(plan.currentYearTarget)));
  if (plan.priorYearTarget !== null) {
    rows.push(
      line(
        `Prior-year safe harbor (${plan.usedHigherPriorYearRate ? '110%' : '100%'})`,
        money(plan.priorYearTarget),
      ),
    );
  }
  rows.push(
    line(
      'Required annual payment',
      `${money(plan.requiredAnnualPayment)}`,
    ),
  );
  rows.push(
    line(
      '  chosen basis',
      plan.basis === 'priorYearSafeHarbor' ? 'prior year' : '90% of current year',
    ),
  );
  rows.push(line('Less withholding', money(estimate.withholding)));
  rows.push(line('To pay in four installments', money(plan.totalEstimatedPayments)));
  rows.push('');
  for (const installment of plan.installments) {
    rows.push(line(`  Q${installment.period} due ${installment.dueDate}`, money(installment.amount)));
  }
  rows.push('');
  rows.push(
    'Due dates are the statutory ones and are not shifted for weekends or holidays. Paying the ' +
      'required annual payment avoids the § 6654 underpayment penalty; it is not the same as paying ' +
      'the tax in full, and any remainder is due with the return.',
  );
  if (plan.priorYearTarget === null) {
    rows.push(
      'No prior-year figure was supplied, so only the 90%-of-current-year target was available. ' +
        'Supplying priorYearTotalTax often produces a materially smaller required payment.',
    );
  }
  return rows.join('\n');
}

/**
 * A paycheck, in the order a person reads a pay stub.
 *
 * The withholding figure alone is not the useful part — what a caller wants to
 * know is whether it will be enough, and the tables cannot see the income that
 * decides. So the plan, when there is one, comes first.
 */
export function renderPaycheck(
  check: PaycheckResult,
  status: string,
  plan?: WithholdingPlan,
): string {
  const w = check.federalIncomeTax;
  const rows: string[] = [];

  rows.push(
    `${statusLabel(status)}, ${w.payPeriod} (${w.payPeriodsPerYear} periods), tax year ${check.year}`,
  );
  rows.push(`Gross pay this period: ${money(check.grossPay)}`);
  rows.push('');
  rows.push(`Federal income tax withheld  ${money(w.withholding)}`);
  rows.push(`Social Security (6.2%)       ${money(check.socialSecurity)}`);
  rows.push(`Medicare (1.45%)             ${money(check.medicare)}`);
  if (check.additionalMedicare > 0) {
    rows.push(`Additional Medicare (0.9%)   ${money(check.additionalMedicare)}`);
  }
  rows.push(`Total withheld               ${money(check.totalWithheld)}`);
  rows.push(
    `Take-home after federal      ${money(check.takeHomeAfterFederal)}  (before state, local and benefits)`,
  );
  rows.push('');
  rows.push(
    `Annualised, that is ${money(w.annualizedWithholding)} of federal income tax withholding.`,
  );
  rows.push(
    `The next dollar of pay this period is withheld at ${percent(w.marginalRate)}.`,
  );

  rows.push('');
  rows.push('How Publication 15-T got there:');
  rows.push(
    `  ${w.column === 'marriedFilingJointly' ? 'Married filing jointly' : w.column === 'headOfHousehold' ? 'Head of household' : 'Single or married filing separately'} column, ${
      w.schedule === 'multipleJobsCheckbox'
        ? 'Step 2 checkbox schedule (the halved, two-job one)'
        : 'standard schedule'
    }`,
  );
  rows.push(`  Adjusted annual wage         ${dollars(w.adjustedAnnualWage)}`);
  rows.push(`  Tentative annual withholding ${money(w.tentativeAnnualWithholding)}`);
  if (w.annualCreditsApplied > 0) {
    rows.push(`  Less Step 3 credits          ${money(w.annualCreditsApplied)}`);
  }
  if (w.extraWithholding > 0) {
    rows.push(`  Plus Step 4(c) each period   ${money(w.extraWithholding)}`);
  }

  if (plan) {
    rows.push('');
    rows.push('Will it be enough?');
    rows.push(`  Tax expected for the year    ${money(plan.targetAnnualTax)}`);
    rows.push(`  Projected withholding        ${money(plan.projectedAnnualWithholding)}`);
    if (plan.shortfall > 0) {
      rows.push(`  Short by                     ${money(plan.shortfall)}`);
      if (plan.extraWithholdingPerPeriod > 0) {
        rows.push(
          `  Put ${money(plan.extraWithholdingPerPeriod)} on Form W-4 Step 4(c) for each of the ${plan.payPeriodsRemaining} remaining periods.`,
        );
      }
    } else {
      rows.push(`  Over-withheld by             ${money(-plan.shortfall)} — a refund, not a problem.`);
    }
    for (const note of plan.notes) rows.push(`  Note: ${note}`);
  }

  const notes = [...check.notes, ...check.federalIncomeTax.notes];
  if (notes.length > 0) {
    rows.push('');
    for (const note of notes) rows.push(`Note: ${note}`);
  }

  return rows.join('\n');
}
