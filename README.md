# Agent_Playground

A repository worked on by an autonomous agent that runs once a day in a fresh
sandbox. Nothing survives a run except what gets committed here.

## What is in here

| Path | What it is |
| --- | --- |
| [`packages/us-federal-tax`](packages/us-federal-tax) | A zero-dependency US federal tax engine for JavaScript. Income tax, self-employment tax, FICA, capital gains, NIIT, the Section 199A QBI deduction, the SALT cap, the OBBBA Schedule 1-A deductions, quarterly estimated payments, and Publication 15-T paycheck withholding — every figure cited to the IRS release it came from. |
| [`packages/us-state-tax`](packages/us-state-tax) | A zero-dependency US **state** income tax engine for 23 states including New York, 2025 and 2026. Built around the part a table of state rates cannot hold: New York's supplemental tax, which claws back the benefit of the lower brackets so a high earner pays their top rate on their whole income; which federal figure each state starts from; which federal deductions it adds back; and the credit phase-outs that make Utah's and Pennsylvania's flat taxes anything but flat. |
| [`packages/us-tax-mcp`](packages/us-tax-mcp) | Both engines as an MCP server, so an AI assistant can compute tax rather than recall it. Eight tools, zero dependencies, `npx -y us-tax-mcp`. |
| [`STRATEGY.md`](STRATEGY.md) | Why this work and not something else, what was rejected, and the conditions under which the current bet should be abandoned. |
| [`JOURNAL.md`](JOURNAL.md) | Daily log: what was done, what was learned, what to do next. |
| [`NOTES-FOR-HUMAN.md`](NOTES-FOR-HUMAN.md) | The short list of things the agent cannot do itself. |

## us-federal-tax

```bash
cd packages/us-federal-tax
npm install
npm test
```

```js
import { estimateFederalTax, quarterlyEstimatedPayments } from 'us-federal-tax';

const estimate = estimateFederalTax({
  filingStatus: 'single',
  year: 2026,
  selfEmploymentNetProfit: 120_000,
});

estimate.totalTax;             // 32660.36
estimate.selfEmployment.total; // 16955.46
quarterlyEstimatedPayments(estimate).installments;
```

```js
import { computePaycheck } from 'us-federal-tax';

const check = computePaycheck({
  wagesThisPeriod: 3_000,
  filingStatus: 'single',
  payPeriod: 'biweekly',
  year: 2026,
});

check.federalIncomeTax.withholding; // 320.38
check.takeHomeAfterFederal;         // 2450.12
```

See the [package README](packages/us-federal-tax/README.md) for the full API, the
correctness details it handles that most implementations miss, and an explicit list
of what it does *not* cover.

## us-state-tax

```bash
cd packages/us-state-tax
npm install
npm test
```

```js
import { stateIncomeTax } from 'us-state-tax';

// One single filer, $100,000 of wages, 2025. Three states, three different taxes.
const federal = {
  adjustedGrossIncome: 100_000,
  taxableIncome: 84_250,
  deduction: 15_750,
  deductionKind: 'standard',
};

stateIncomeTax({ state: 'CA', year: 2025, filingStatus: 'single', federal }).tax; // 5054.98
stateIncomeTax({ state: 'NY', year: 2025, filingStatus: 'single', federal }).tax; // 4951.75
stateIncomeTax({ state: 'CO', year: 2025, filingStatus: 'single', federal }).tax; // 3707.00
stateIncomeTax({ state: 'AZ', year: 2025, filingStatus: 'single', federal }).tax; // 2106.25
```

Colorado taxes federal *taxable* income and Arizona defines its standard deduction as the
federal one, so the One Big Beautiful Bill Act cut both states' 2025 tax with no state
legislation. Illinois, on federal AGI, got nothing. That difference is invisible in a table
of state rates, and it is what this package exists to model.

New York is the sharpest case of the same idea. Above $107,650 of AGI it adds a
supplemental tax that recaptures the benefit of every bracket below the filer's top one, so
walking the rate schedule is not merely incomplete — it is the wrong computation, short by
$2,399 for a single filer at $300,000 and $65,071 at $6,000,000. The statute prints forty
dollar amounts a year for that recapture; this package stores none of them and derives every
one from the rate schedule.

It takes the output of `estimateFederalTax()` directly, but neither package depends on the
other. See the [package README](packages/us-state-tax/README.md) for the full list of what
is and is not covered.

## us-tax-mcp

Both engines, exposed over the Model Context Protocol so an assistant can compute a
tax figure instead of recalling one. Add it to any MCP client:

```jsonc
{
  "mcpServers": {
    "us-tax": { "command": "npx", "args": ["-y", "us-tax-mcp"] }
  }
}
```

Eight tools: `estimate_federal_tax`, `compare_tax_years`, `effective_marginal_rate`,
`quarterly_estimated_payments`, `paycheck_withholding`, `state_income_tax`,
`get_tax_parameters` and `list_supported_years`. Four of them answer questions a bracket
table cannot — 2025 was amended *retroactively* after the IRS had published it, the
marginal rate on the next dollar is routinely double the bracket once credit phase-outs
are counted, what an employer withholds is a different number from what the return owes,
and a state's answer depends on which federal figure it starts from.

```bash
cd packages/us-tax-mcp
npm install
npm test
```

See the [package README](packages/us-tax-mcp/README.md) for the tool list, worked
examples, and the same explicit list of what is not covered.

## License

MIT
