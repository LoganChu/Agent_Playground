# Kentucky's family size tax credit — a spec, not an instrument

**The largest single gap in any state `us-state-tax` ships, and it is the one
remaining Kentucky disagreement in `REPORT.md` that is not an open question.**

```text
  tools/anchors 2025-KY-ky-10    expected $0.00    this package $495.20
  a single Kentucky filer on $15,650 of wages owes NOTHING and is charged the
  whole bill
```

Day 71 found it, priced it, declared it in the state's shipped notes and
**deliberately did not ship it**, because KRS 141.066's base — "modified gross
income" — had not been read and a credit computed on a guessed base trades a
declared gap for an undeclared defect. This file is the research that was done
afterwards, so the next run starts with the looking done. It is the same kind of
document as `PREPARER-ANCHORS.md` and was written for the same reason.

> **READ THIS FIRST: everything below is read out of `policyengine-us`, not out
> of a Kentucky document.** `revenue.ky.gov`, `apps.legislature.ky.gov` and
> `taxsim.nber.org` all refuse to resolve from this sandbox, by `curl` and by
> server-side fetch. What makes this shippable anyway is at the bottom, and it is
> not "another model says so".

## The mechanism, in four parts

### 1. The threshold is the federal poverty guideline, and THIS PACKAGE ALREADY SHIPS IT

```python
# policyengine_us/variables/.../ky_family_size_tax_credit_threshold.py
p1    = fpg.first_person[state_group]
padd  = fpg.additional_person[state_group]
capped_family_size = min_(tax_unit_size, p.family_size_cap)   # cap = 4
return p1 + padd * (capped_family_size - 1)
```

`us-state-tax` has that formula already, under the same name and with the same
shape — `povertyGuideline: { firstPerson, additionalPerson }` and
`firstPerson + additionalPerson * (size - 1)` in `engine.ts`, used by Virginia's
Credit for Low Income Individuals and Maryland's poverty level credit. The values
it carries are `$15,650 / $5,500` for 2025 and `$15,960 / $5,680` for 2026.

**AND THAT IS THE CORROBORATION THAT MATTERS, because it closes from the other
side.** Kentucky's own 740 packet publishes the threshold amounts for 2025 as
`$15,650`, `$21,150`, `$26,650` and `$32,150` for family sizes one to four or
more — reached by server-side search, not by opening the document. Run this
package's own guideline through PolicyEngine's formula:

```text
  size 1   15,650                      = 15,650   published 15,650
  size 2   15,650 + 5,500              = 21,150   published 21,150
  size 3   15,650 + 5,500 x 2          = 26,650   published 26,650
  size 4+  15,650 + 5,500 x 3          = 32,150   published 32,150
```

**Four for four, from a table that was already in the tree for two other
states.** So the threshold needs no new figure, no new document and no new
mechanism — only the cap of 4, which is `KRS 141.066(1)(e)4` and is one integer.

### 2. The rate is an eleven-step staircase on a RATIO, and two of its steps are not round

`parameters/gov/states/ky/tax/income/credits/family_size/rate.yaml`, cited there
to **KRS 141.066(3)** and to the 2022, 2023, 2024 and 2025 Schedule ITC. The
bracket is "above this ratio, this rate", evaluated `right=True` — so a boundary
belongs to the step BELOW it.

```text
  modified gross income / threshold        credit, as a share of the tax
  at or below      1                       100%
  above 1,     to  1.04                     90%
  above 1.04,  to  1.08                     80%
  above 1.08,  to  1.12                     70%
  above 1.12,  to  1.16                     60%
  above 1.16,  to  1.20                     50%
  above 1.20,  to  1.24                     40%
  above 1.24,  to  1.270032                 30%
  above 1.270032, to 1.30                   20%
  above 1.30,  to  1.330032                 10%
  above 1.330032                             0%
```

> **THE TWO ODD THRESHOLDS ARE THE PART TO VERIFY AND THE PART WORTH SELLING.**
> `1.270032` and `1.330032` where a reader expects `1.28` and `1.34`. Every
> published summary of this credit says it "phases out to zero at 133% of the
> poverty level"; the figure in the model is `133.0032%`. On a family-of-four
> threshold of `$32,150` that is a difference of `$1.03` of income — which sounds
> like nothing until you remember the step either side of it is **ten percent of
> the whole tax bill**. A model that rounded to `1.33` pays 10% where the table
> pays 0% for incomes in a one-dollar window, and the window exists at four
> family sizes in each year.
>
> It is the same shape as Day 59's New Mexico finding — a band edge a model gets
> wrong by reading the obvious number — and it is the first candidate for the
> findings page this credit would produce.

### 3. The base is the tax AFTER the personal credits, floored at zero

```python
# ky_family_size_tax_credit_potential.py
rate            = ky_family_size_tax_credit_rate
income          = ky_income_tax_before_non_refundable_credits_unit
personal_credits = ky_personal_tax_credits
return rate * max_(income - personal_credits, 0)
```

**THE ORDERING IS LOAD-BEARING AND IT IS THE OPPOSITE OF THE CHEAP GUESS.** The
family size credit applies to what is left after the `$40` personal credits, not
to the tax before credits. For a filer at 65 inside the taper the difference is
`rate x $40`, and at the 100% step the two readings differ by the whole `$40`:
a 70-year-old at the threshold owes nothing either way, but a model that applies
the rate first and the `$40` second produces a NEGATIVE tax, and this credit is
not refundable.

This also means the `agedFilerCredit` shipped on Day 71 has to be computed
**before** this one, and `engine.ts`'s credit assembly currently pushes credits
in declaration order — so the order has to be asserted rather than assumed.

### 4. Modified gross income is `max(federal AGI, Kentucky AGI)`, plus two additions

```python
# ky_modified_agi_if_joint.py
total_fed_agi = adjusted_gross_income + form_4972_lumpsum_distributions
total_ky_agi  = ky_agi                + form_4972_lumpsum_distributions
return max_(total_fed_agi, total_ky_agi)
```

So the base is the **larger** of the two AGIs, which is the whole reason it is a
base of its own: Kentucky AGI is normally the smaller figure, because the pension
exclusion and the Social Security subtraction come out of it, and the credit
refuses to let a Kentucky subtraction buy eligibility for it.

Two additions, and `policyengine-us` models one of them:

```text
  Form 4972 lump-sum distributions, not in federal AGI    modelled there, NO
                                                          input here -- declare it
  tax-exempt interest on NON-KENTUCKY municipal bonds     "also added but excluded
                                                          in this calculation"
                                                          -- their own comment
```

> **THE SECOND ONE IS A PLACE THIS PACKAGE CAN BE *BETTER* THAN THE REFERENCE
> MODEL RATHER THAN MERELY EQUAL TO IT.** `ky_modified_agi_if_joint.py`'s own
> comment says out-of-state municipal interest belongs in modified gross income
> and is not modelled. `us-state-tax` already takes
> `outOfStateMunicipalInterest` — Illinois and Ohio read it — so the figure is
> already on the input. **What is NOT known is which side of the `max` it is
> added to**, and the honest reading is both, because tax-exempt interest is in
> neither AGI. That is one line of the worksheet (line (c), lines (a)-(j) on page
> 26 of the 740 packet) and it is the one thing here that still wants a document.
>
> Shipping it on both sides and saying so in a note is defensible. Shipping it
> silently is not, and shipping it on ONE side without reading the worksheet is
> the guess this file exists to avoid.

### And the separate path treats a negative column as zero

```python
# ky_modified_agi_if_separate.py -- worksheet lines (a)-(b) and (f)-(g)
fed_agi = sum over people of max_(ky_federal_agi, 0)
ky_agi  = sum over people of max_(ky_agi, 0)
```

A spouse with a loss contributes zero rather than reducing the other column —
which is the same asymmetry the combined-separate election has elsewhere, and it
is **not reachable from this package at all** until the election is modelled. So
the joint path is the whole of what can be built now, and the note already
shipped for the election covers the rest.

## What this would cost, and what it would be worth

```text
  new figures      11 rate steps + 11 thresholds + 1 family size cap = 23
                   NO new threshold amounts: the poverty guideline is already here
  new mechanism    none for the threshold; a ratio-indexed step table for the rate,
                   which `fractionAbove` in engine.ts may already serve
                   (Connecticut's personalTaxCredit is a tax-fraction staircase)
  blind spots      the cap (4) is a smallInteger the audit cannot perturb; the
                   rate steps are decimals below 1 and SHOULD be perturbable
  what it buys     tools/anchors 10/14 -> 11/14
                   the differential's Kentucky entry 20 -> near zero, which is what
                   finally lets that unbounded catch-all be scoped or deleted
                   a finding of the 1.330032 shape for the findings page
```

## THE TEST THAT DECIDES WHETHER TO SHIP IT, AND IT IS NOT "POLICYENGINE SAYS SO"

Day 71 shipped the `$40` age credit on three secondary records **plus an external
anchor that re-checks it on every push**, and refused to ship this one on a
parameter file alone. The bar is the anchor, and this credit has one:

```text
  2025-KY-ky-10   a single filer on $15,650 -- EXACTLY 100% of the threshold,
                  so the rate is the first step and the credit is the whole tax
                  expected $0.00, from a policyengine-us fixture
```

**One anchor at one point on an eleven-step staircase is not enough**, and that is
the honest limit: it pins the 100% step and says nothing about the other ten, nor
about `1.330032`. So the thing to do before shipping is to look for more anchors
at other steps — `ky/tax/income/integration.yaml` has 2021 and 2022 cases that
assert `ky_family_size_tax_credit` directly, and they are outside this engine's
years but their ARITHMETIC is checkable by hand against the 2021 and 2022
guidelines. A step the fixture set cannot reach should be shipped with the step
named in a note as untested, which is this package's existing habit.

If no Kentucky document ever becomes reachable, the defensible package is: ship
it, cite the parameter file and KRS 141.066(3) as `agency` rather than `statute`
the way the `$40` is cited, name the two odd thresholds and the municipal-interest
placement in the notes as unverified against the worksheet, and let the anchors
hold the 100% step. That is strictly better than charging the poorest filers in
Kentucky their entire bill, which is what happens today.
