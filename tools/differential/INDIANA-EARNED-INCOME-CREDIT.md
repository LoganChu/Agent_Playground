# Indiana's earned income credit, settled

**Status: SETTLED from the other model's own source, entered in
`known-divergences.json`, and guarded by two instruments in CI.** Researched
Day 74, closed Day 75. The three cases it accounts for had been sitting under
*Unexplained* in `REPORT.md` since Day 54.

## The three cases

`tools/audit/against-policyengine.mjs` ran the buyer-facing audit over all 2,904
differential households with `policyengine-us`'s own figures in the buyer's
column. Three of the sixteen differences `REPORT.md` could not account for came
back with the same account, and nothing else in the sixteen did:

```text
  2025-couple-two-children-IN-60000    theirs $2,660.60   ours $2,567.30   $93.30
  2025-couple-no-children-IN-25000     theirs $1,154.60   ours $1,145.32    $9.28
  2025-on-the-boundary-IN-50000        theirs $2,334.30   ours $2,327.37    $6.93
```

In each one PolicyEngine's Indiana figure is **exactly this engine's answer with
the Indiana earned income credit not applied.**

## What Day 74 could not settle, and why

> Whether PolicyEngine models this credit at all, or models it and gets zero.
> **Nothing in the two committed answer files can distinguish them**, because a
> credit modelled to zero and a credit not modelled produce the same number.

The cheapest thing that would settle it was named: read
`policyengine_us/parameters/gov/states/in/tax/income/credits/` out of the pinned
sdist, which `pypi.org` serves to this sandbox.

## The answer, and it is neither of the two things that question allowed for

**It models the credit. The two halves of its implementation are evaluated at
different dates.**

```text
  in_eitc.py           AMOUNT   10% of the CURRENT-YEAR federal credit
  in_eitc_eligible.py  GATE     the FROZEN 2023 federal credit must be positive
```

IC 6-3.1-21-6 gives Indiana 10% of the federal earned income credit and
IC 6-3-1-11 says which one: the credit under the Internal Revenue Code as of
**1 January 2023** for tax years 2023 to 2025, and 1 January 2026 from 2026
(SEA 243 of 2025). `in_eitc.py` reads the current-year credit and multiplies by
the match rate — which is this engine's figure, to the cent. `in_eitc_eligible.py`
rebuilds the **whole** federal credit under the 2023 snapshot, inflation-indexed
dollar amounts included, and requires *that* to be positive.

The three households sit between the two. At $60,000 of joint wages with two
children the 2023 credit is exhausted and the 2025 one is still worth $932.98, so
a credit the formula would have paid in full is refused by the gate.

### It is a defect without reading a word of Indiana law, and the grid holds the proof

**The reading that would exonerate it is that PolicyEngine takes 10% of the
frozen base.** This grid contains the household that rules that out:

```text
  2025-mixed-dependents-IN-40000
    current-year federal credit     $6,038.98
    frozen 2023 federal credit      $4,928.07
    10% of the frozen base would be   $492.81
    10% of the current base is        $603.90
    the two engines agree TO THE CENT, so PolicyEngine paid $603.90
```

So the freeze decides **whether** the credit exists and not **how much** it is
worth. No reading of IC 6-3.1-21-6 produces that, and `in_eitc.py`'s own comment
argues against it in terms:

> the freeze's only operative effect is that Indiana does not automatically adopt
> post-snapshot federal EITC changes -- and those changes are inflation indexing
> only. The current-year federal EITC therefore satisfies the freeze for all
> filers, with or without children.

### And the same codebase answers the same question two better ways

Three states in `policyengine-us` 2.15.3 freeze the federal credit at a date.
They are the three places in the whole model that evaluate a parameter at an
explicit date, which is how they were found.

```text
  OKLAHOMA   2020-01-01   GATE AND AMOUNT BOTH FROZEN. ok_federal_eitc rebuilds
                          the entire 2020 trapezoid — maximum, phase-in,
                          phase-out, reduction — and ok_eitc takes 5% of THAT.
                          Internally consistent, whichever reading you prefer.

  WASHINGTON 2022-06-09   SPLIT ON PURPOSE, AND THE SPLIT IS ARGUED IN THE CODE:
                          "the June 9, 2022 Internal Revenue Code still contains
                          the EITC inflation-adjustment provisions (26 U.S.C.
                          32(j)), so the inflation-indexed dollar amounts [...]
                          track the current tax year, while the structural rules
                          (age band, disabled-dependent waiver, separate-filer
                          rule) stay on the frozen snapshot."

  INDIANA    2023-01-01   gate frozen INCLUDING the indexed dollar amounts,
                          amount current. Neither of the above.
```

Washington's principle is the one Indiana's own amount formula states. Indiana is
the only one of the three that lets a frozen **indexed** figure zero out a credit
it then declines to compute on the frozen base.

## The cliff, which is the part a buyer should care about

A gate that switches off at an income the amount keeps rising through is a
discontinuity. Just below it the filer receives 10% of the full current-year
credit; a cent above it, nothing.

```text
  children  return     frozen credit reaches $0 at   Indiana credit lost
         0  single                     $17,643.14                 $11.17
         0  joint                      $24,213.14                 $15.30
         1  single                     $46,560.00                 $61.90
         1  joint                      $53,120.00                 $70.85
         2  single                     $52,918.02                 $92.50
         2  joint                      $59,478.02                $104.29
        3+  single                     $56,840.15                 $99.30
        3+  joint                      $63,400.15                $111.09
```

**One cent of extra earnings costs a joint filer with three children $111.09 of
Indiana credit.** That is a defect no household-by-household comparison finds,
because finding it needs two households a cent apart, and both this grid and
PolicyEngine's own test suite sample incomes in round thousands.

## The control year, which could have falsified all of this and did not

SEA 243 of 2025 advances the snapshot to **1 January 2026.** So from tax year
2026 the frozen table *is* the current table, the gate cannot bind, and the
account above predicts the divergence vanishes entirely.

```text
  case                            2025 gap   2026 gap
  couple-two-children-IN-60000     -$93.30      $0.00
  couple-no-children-IN-25000       -$9.28      $0.00
  on-the-boundary-IN-50000          -$6.93      $0.00
```

Same households, same incomes, one year apart. **Nothing changed but the date in
the statute.** Had any of the three still disagreed in 2026, the frozen-gate
account would be wrong and this document would say so.

## What is still genuinely open, and it is not who is inconsistent

**Whether the snapshot reaches § 32's inflation adjustments or only its text.**

- If it does **not** — Washington's reading, and Indiana's own form, which says
  *"Enter the earned income credit from your federal income tax return"* — then
  this engine's figure is right and PolicyEngine withholds a credit the filer is
  owed.
- If it **does**, the correct Indiana credit for these three is `$0` — which is
  PolicyEngine's number, reached by a route PolicyEngine does not take — and this
  engine overstates, exactly as the caveat shipped in `flat-states.ts` warns.

Either way PolicyEngine's mechanism is wrong, because it is neither reading. That
is why the entry went in without the statutory question closed: **the entry's
`reason` names a mechanism, not a winner.**

## This engine's own exposure, now priced rather than described

`tools/cross-package/indiana-frozen-eitc.mjs` prices the other side of the same
provision on this engine's figures, and the arithmetic has a surprise in it:

```text
  on the PLATEAU      10% x (max2025 - max2023)
                      $4.90 / $33.30 / $54.80 / $61.60 by child count

  in the PHASE-OUT    a CONSTANT, because both years fall at the same statutory
                      rate: 10% x [(max25 - max23) + rate x (start25 - start23)]
                      $15.30 / $70.85 / $104.29 / $111.09 on a joint return
```

**The phase-out constant is the same number as PolicyEngine's cliff**, and that is
not a coincidence: the most their gate can withhold and the most this engine can
overstate are the same quantity measured from opposite sides. One model stops
paying where the other keeps paying, and the gap between the two readings is what
each of them is wrong by. Both are priced at `$111.09` and the figures are now in
the shipped note.

**And the shape is the opposite of Oklahoma's**, which is why this repository
ships Indiana's rule and refuses Oklahoma's: 68 O.S. § 2357.43's date does not
move, so its error widens every year forever. Indiana's does, so from 2026 the
exposure is **exactly zero**. A rule that is wrong in 2025 and exactly right in
2026 is worth shipping with a note.

## The bound, and why it is $112

`requireEveryReasonBounded` refuses an entry without a bound derived from the
provision. The most this gate can withhold is 10% of the current-year credit at
the income where the frozen one hits zero, which is the phase-out constant above,
maximised at `$111.09` for a joint return with three or more children. **$112.**

Not `$93.30`, which is the largest difference observed — a bound set to the last
measurement is the ratchet `maxAbs` exists to prevent. And
`in-eitc-conformity.mjs` fails if the published bound drifts more than `$10`
either side of what the provision can produce, in both directions, so the bound
cannot quietly grow into slack an unrelated difference walks into.

**A 2027 grid would need its own bound.** The snapshot stops moving again after
2026, so the gap reopens and widens from the 2026-to-2027 parameter movement.

## What this cost, and what it changed

```text
  REPORT.md unexplained           16 -> 13   (this finding; 2026 remains 0)
                                  13 -> 3    (Wisconsin, found the same afternoon)
  explained by known divergences  1181 -> 1194
  the audit's score against the human verdict, on cases the human could not
  explain:                        3 -> 0
```

**That last line is the one worth reading twice.** The audit's headline finding
went to zero because the human acted on it. A tool whose queue of open cases
stays full is a tool nobody read. `AGAINST-POLICYENGINE.md` now says so where the
zero appears, so a buyer meeting that report does not read a zero as a failure.

## The one thing a human could do with this that an agent cannot

This is a specific, reproducible defect in an actively maintained open-source
model with a research team behind it, and **nobody there has been told.** An
agent that cannot contact people cannot file it. `NOTES-FOR-HUMAN.md` carries the
report ready to send, with the two file paths, the control case, the cliff table
and the 2026 control, because the finding is worth more to them than it is to
this repository — and a repository that finds a defect in a competitor and keeps
it as a sales asset is not the kind of repository `OFFER.md` claims this is.
