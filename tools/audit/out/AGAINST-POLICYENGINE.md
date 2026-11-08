# The audit, pointed at PolicyEngine-US

Produced by `tools/audit/against-policyengine.mjs`. This is a MEASUREMENT, not a gate: it is not in CI and it pins nothing, because PolicyEngine’s figures move when they release and an assertion over somebody else’s model would fail for their reasons.

## What happened

```text
  households with a figure on both sides       2904
  set aside (no figure, or refused)               0
  agree to the CENT                            1789
  differ by under a dollar                      226
  differ by a dollar or more                    889
    of those, the tool explains                  86
    of those, it does NOT                       803
```

**The 226 sub-dollar differences are a finding about the differential harness, not about the audit.** That harness compares to the dollar and counted every one of them as agreement; this one compares to the cent, because a buyer’s figure is a figure they printed on something. They are set aside from the scoring below — no human ever classified them, so there is nothing to score against — and they are listed at the end.

## Scored against the human classification

`tools/differential/known-divergences.json` is 71 hand-written rules accounting for every difference that harness accepts, each with a reason and a bound; the cases it could NOT account for are listed in `tools/differential/REPORT.md`, and that list — the harness’s own output, not a re-derivation of its matcher — is the human verdict used here. Over the 889 differences of a dollar or more:

| | human explained it | human could not |
| --- | ---: | ---: |
| **tool named something** | 86 | 0 |
| **tool was silent** | 790 | 13 |

**`tool was silent` / `human explained it` is expected and is not a defect.** Most known divergences are about a provision neither engine’s OUTPUT mentions — a different reading of one statute, or a figure PolicyEngine models and this engine does not. The audit only sees what a return reports, by design.

### The class that fires most, and why its count is not a success

`filing-status` produced 91 findings over 66 households — the largest class here by a distance. **On almost all of them the human account says something else and better**: PolicyEngine allows the § 32(d) earned income credit to EVERY married-filing-separately filer and this package does not. On a state return whose only status-sensitive line is a percentage of that federal credit, *"they used the status single"* and *"they allowed a separate filer a single-filer credit"* are the same number, and a re-run cannot separate them because both re-runs are the same re-run.

```text
  findings that move NOTHING BUT A CREDIT      44   inconclusive, and they say so
  findings that move a bracket or deduction    47   specific to the status
```

> **A CLASS THAT FIRES OFTEN AND AGREES WITH A HUMAN’S DIFFERENT ACCOUNT IS NOT CORROBORATED, IT IS CONFUSABLE.** The discriminator exists because of this run.

### What the tool said, by class

| finding | households |
| --- | ---: |
| `filing-status` | 66 |
| `stale-parameters` | 13 |
| `supplied-figure-not-spent` | 7 |
| `credits-not-applied` | 3 |
| `credit-omitted` | 2 |

## Every case the human could not explain and the tool could

This is the bucket that matters, in both directions: a genuine find here is the tool earning its keep on the hardest cases in the repository, and a false positive here is the tool telling a buyer something untrue. **Each one is printed in full so it can be read rather than counted.**

*None.* On every difference the differential harness could not account for, the audit was also silent.

**AND A ZERO HERE IS WHAT SUCCESS LOOKS LIKE ON THE SECOND RUN, WHICH IS WHY THIS PARAGRAPH EXISTS.** On Day 74 this section held three Indiana households and the table above read `3`. Day 75 read PolicyEngine’s source, found that its Indiana earned income credit evaluates its ELIGIBILITY GATE at the frozen 2023 Internal Revenue Code and its AMOUNT at the current year, and entered the divergence in `known-divergences.json`. So the three moved from *the human could not explain this* to *the human explained this* — **using the account this tool produced.**

This count is therefore not a scoreboard to be maximised. It is a queue, and a tool whose queue stays full is a tool nobody acted on. The number worth watching is how many open questions it has CLOSED, which is three, and `tools/differential/INDIANA-EARNED-INCOME-CREDIT.md` is what closing one costs: an afternoon reading the other model’s parameter tree, a bound derived from the provision, and a control year that could have falsified the whole account and did not.

## The largest gaps the tool was silent about

The residue, biggest first. These are where a human has to read the statute, which is the half of the audit that is not arithmetic.

| case | PolicyEngine | this engine | gap | human had a reason |
| --- | ---: | ---: | ---: | --- |
| `2026-mixed-dependents-CO-40000-0-0-0-0` | -$8,381.98 | -$1,249.12 | -$7,132.86 | yes |
| `2025-mixed-dependents-CO-40000-0-0-0-0` | -$9,778.35 | -$2,645.49 | -$7,132.86 | yes |
| `2025-couple-two-children-CO-30000-0-0-0-0` | -$10,147.97 | -$3,576.00 | -$6,571.97 | yes |
| `2026-couple-two-children-CO-30000-0-0-0-0` | -$8,400.97 | -$1,829.00 | -$6,571.97 | yes |
| `2026-mixed-dependents-MN-40000-0-0-0-0` | -$5,640.00 | $0.00 | -$5,640.00 | yes |
| `2025-mixed-dependents-MN-40000-0-0-0-0` | -$5,378.40 | $0.00 | -$5,378.40 | yes |
| `2025-single-parent-CO-12000-0-0-0-0` | -$6,532.00 | -$2,040.00 | -$4,492.00 | yes |
| `2026-single-parent-CO-12000-0-0-0-0` | -$5,512.00 | -$1,020.00 | -$4,492.00 | yes |
| `2026-single-parent-CO-25000-0-0-0-0` | -$5,066.97 | -$1,025.00 | -$4,041.97 | yes |
| `2025-single-parent-CO-25000-0-0-0-0` | -$6,013.63 | -$1,971.66 | -$4,041.97 | yes |
| `2026-couple-two-children-MN-30000-0-0-0-0` | -$3,987.60 | $0.00 | -$3,987.60 | yes |
| `2025-couple-two-children-MN-30000-0-0-0-0` | -$3,879.20 | $0.00 | -$3,879.20 | yes |
| `2025-couple-two-children-CO-60000-0-0-0-0` | -$2,833.76 | $787.51 | -$3,621.27 | yes |
| `2026-couple-two-children-CO-60000-0-0-0-0` | -$2,708.64 | $912.62 | -$3,621.26 | yes |
| `2026-retired-couple-AL-0-90000-40000-0-0` | $3,285.80 | $0.00 | $3,285.80 | yes |
| `2025-retired-couple-AL-0-90000-40000-0-0` | $3,280.05 | $0.00 | $3,280.05 | yes |
| `2026-early-retired-couple-AL-0-70000-0-0-0` | $2,818.00 | $0.00 | $2,818.00 | yes |
| `2025-early-retired-couple-AL-0-70000-0-0-0` | $2,812.85 | $0.00 | $2,812.85 | yes |
| `2026-surviving-spouse-high-WI-450000-0-0-0-0` | $23,087.90 | $25,895.44 | -$2,807.54 | yes |
| `2025-surviving-spouse-high-WI-450000-0-0-0-0` | $23,398.24 | $26,134.15 | -$2,735.91 | yes |
| `2026-single-parent-CO-45000-0-0-0-0` | -$1,887.89 | $654.00 | -$2,541.89 | yes |
| `2025-single-parent-CO-45000-0-0-0-0` | -$2,035.55 | $506.34 | -$2,541.89 | yes |
| `2026-muni-retiree-AL-0-60000-40000-0-10000` | $2,465.80 | $0.00 | $2,465.80 | yes |
| `2025-muni-retiree-AL-0-60000-40000-0-10000` | $2,460.05 | $0.00 | $2,460.05 | yes |
| `2025-surviving-spouse-low-CO-18000-0-0-0-0` | -$4,468.99 | -$2,164.00 | -$2,304.99 | yes |

## The sub-dollar differences the differential harness calls agreement

All 226 of them, because the count is the point: two engines that "agree to the dollar" on a state tax bill disagree about the cents this often. Whether that matters is the buyer’s call and not this tool’s, which is why it is a `rounding` class and not an error.

| case | PolicyEngine | this engine | gap |
| --- | ---: | ---: | ---: |
| `2026-single-worker-MD-15000-0-0-0-0` | -$0.79 | $0.00 | -$0.79 |
| `2026-single-parent-high-MO-90000-0-0-0-0` | $2,811.52 | $2,810.81 | $0.71 |
| `2026-surviving-spouse-MO-45000-0-0-0-0` | $145.15 | $144.44 | $0.71 |
| `2026-single-parent-MO-45000-0-0-0-0` | $523.50 | $522.79 | $0.71 |
| `2026-blind-worker-MO-40000-0-0-0-0` | $819.13 | $818.42 | $0.71 |
| `2026-single-worker-MO-30000-0-0-0-0` | $456.69 | $455.98 | $0.71 |
| `2026-separate-with-child-MO-45000-0-0-0-0` | $1,166.39 | $1,165.68 | $0.71 |
| `2026-retired-couple-MO-0-90000-40000-0-0` | $2,361.16 | $2,360.46 | $0.70 |
| `2026-single-worker-MO-80000-0-0-0-0` | $2,761.54 | $2,760.84 | $0.70 |
| `2026-couple-two-children-MO-60000-0-0-0-0` | $878.21 | $877.51 | $0.70 |
| `2026-separate-with-spouse-MO-0-55000-0-0-0` | $1,464.90 | $1,464.20 | $0.70 |
| `2026-surviving-spouse-high-MO-450000-0-0-0-0` | $19,390.87 | $19,390.17 | $0.70 |
| `2026-surviving-spouse-high-MO-250000-0-0-0-0` | $9,990.87 | $9,990.17 | $0.70 |
| `2026-surviving-spouse-high-MO-300000-0-0-0-0` | $12,340.87 | $12,340.17 | $0.70 |
| `2026-mixed-dependents-MO-90000-0-0-0-0` | $2,536.67 | $2,535.97 | $0.70 |
| `2026-single-worker-MO-150000-0-0-0-0` | $6,113.37 | $6,112.67 | $0.70 |
| `2026-couple-two-children-MO-200000-0-0-0-0` | $7,706.67 | $7,705.97 | $0.70 |
| `2026-retired-couple-MO-0-50000-40000-0-0` | $479.18 | $478.48 | $0.70 |
| `2026-separate-MO-60000-0-0-0-0` | $1,847.98 | $1,847.28 | $0.70 |
| `2026-separate-with-spouse-young-MO-0-55000-0-0-0` | $1,617.21 | $1,616.51 | $0.70 |
| `2026-single-retiree-MO-0-40000-24000-0-0` | $818.61 | $817.91 | $0.70 |
| `2026-couple-no-children-MO-75000-0-0-0-0` | $1,798.96 | $1,798.26 | $0.70 |
| `2026-early-retired-couple-MO-0-70000-0-0-0` | $1,568.19 | $1,567.49 | $0.70 |
| `2026-muni-retiree-MO-0-60000-40000-0-10000` | $935.73 | $935.03 | $0.70 |
| `2026-surviving-spouse-high-NM-450000-0-0-0-0` | $20,662.61 | $20,663.20 | -$0.59 |
| `2026-single-worker-KY-400000-0-0-0-0` | $13,882.96 | $13,882.40 | $0.56 |
| `2026-surviving-spouse-high-KY-300000-0-0-0-0` | $10,382.96 | $10,382.40 | $0.56 |
| `2026-surviving-spouse-high-KY-450000-0-0-0-0` | $15,632.96 | $15,632.40 | $0.56 |
| `2026-single-worker-KY-80000-0-0-0-0` | $2,682.96 | $2,682.40 | $0.56 |
| `2026-couple-two-children-KY-100000-0-0-0-0` | $3,382.96 | $3,382.40 | $0.56 |
| `2026-investor-KY-50000-0-0-20000-0` | $2,332.96 | $2,332.40 | $0.56 |
| `2026-couple-no-children-KY-75000-0-0-0-0` | $2,507.96 | $2,507.40 | $0.56 |
| `2026-mixed-dependents-KY-90000-0-0-0-0` | $3,032.96 | $3,032.40 | $0.56 |
| `2026-single-parent-high-KY-90000-0-0-0-0` | $3,032.96 | $3,032.40 | $0.56 |
| `2026-single-parent-teen-KY-35000-0-0-0-0` | $1,107.96 | $1,107.40 | $0.56 |
| `2026-on-the-boundary-KY-100000-0-0-0-0` | $3,382.96 | $3,382.40 | $0.56 |
| `2026-muni-retiree-KY-0-60000-40000-0-10000` | $814.11 | $813.55 | $0.56 |
| `2026-separate-with-spouse-young-KY-0-55000-0-0-0` | $719.11 | $718.55 | $0.56 |
| `2026-early-retiree-KY-0-50000-0-0-0` | $544.11 | $543.55 | $0.56 |
| `2026-retired-couple-KY-0-50000-40000-0-0` | $464.11 | $463.55 | $0.56 |

*…and 186 more.*

