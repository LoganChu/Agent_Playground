# The households whose expected answer came off a FILLED FORM

A survey, not an instrument. Day 67 found one of these by accident and it settled
a reading of a statute that nothing else in this repository could settle; this
file records where the rest of them are, so the next run starts with the looking
already done.

## Why this is a different kind of evidence from everything else here

Four instruments make claims about this package's correctness:

| instrument | what it compares |
| --- | --- |
| the per-state test files | a figure here against a statute or a state release |
| `tools/differential` | this engine against `policyengine-us`, household by household |
| `tools/mutation` | this engine against a deliberately broken copy of itself |
| the provenance ledger | every figure against the document it came from |

**Not one of them compares an answer to a filled return.** The differential grid
compares two models, and two models can agree because they made the same reading
of the same ambiguous sentence — which is exactly the failure mode a statute cite
cannot catch either, because the cite is to the sentence both of them read.

`policyengine-us` ships test fixtures whose **expected** values were produced by
entering the household into commercial tax software and reading the result off
the form. Those are not a model's opinion. They are what a filer would have been
told to pay.

> **"WE AGREE WITH AN OPEN-SOURCE MICROSIMULATION MODEL" IS AN ARGUMENT FOR
> SOMEBODY WHO KNOWS WHAT ONE IS. "WE REPRODUCE TAXACT'S OWN FORM TO EIGHTEEN
> CENTS, AND HERE IS WHERE WE DISAGREE WITH IT" IS AN ARGUMENT FOR EVERYBODY
> ELSE.**

## What Day 67 got out of one of them

`nm/tax/income/integration.yaml` carries three. Two of them decided New Mexico:

```text
  TAXSIM 907, 2025, single, $145,701.33 interest + $754,613.38 long-term gain
    TaxAct PIT-ADJ line 16   $2,500         this package  $2,500
    TaxAct PIT-1  line 17    $882,064       this package  $882,064.71
    TaxAct PIT-1  line 22    $49,400        this package  $49,399.82

  a 2022 household, $200,000 of AGI, $40,000 of federal itemized deduction,
  THREE dependents
    expected NM taxable income  $152,000    this package  $152,000
```

The first exercises every band of the single rate schedule to the top, because
`$882,064` is above the 5.9% threshold — **one household covering six brackets**,
which is more than any hand-written case in the suite reaches.

The second settled NMSA 1978 § 7-2-39, which allows `$4,000` of deduction "for
each dependent in excess of one". `200,000 - 40,000 - 8,000 = 152,000`, and
`$8,000` is two dependents at `$4,000` on a return claiming three. **A model
paying `$4,000` a dependent produces `$148,000` and one paying nothing
`$160,000`, so this one figure discriminates between all three readings.** No
statute text reached this sandbox; three secondary records agreed with the
reading and this fixture proved it.

## The inventory, as of `policyengine-us` 2.87.0

Every fixture file under `policyengine_us/tests/policy/baseline/gov/states`
whose text names TaxAct, TurboTax, FreeTaxUSA or H&R Block. The count is
mentions, not households — an integration file can carry several.

**In states this package ships (13 of them):**

```text
  ar  1   ar/tax/income/integration.yaml
  ca  1   ca/tax/income/credits/earned_income/ca_eitc_integration.yaml
  co  1   co/tax/income/integration.yaml
  ia  1   ia/tax/income/ia_cdcc.yaml
  ky  1   ky/tax/income/integration.yaml
  ma  2   ma/tax/income/adjusted_gross_income/ma_qualified_unemployment_deduction.yaml
  md  1   md/tax/income/credits/eitc/federal_eitc_without_age_minimum.yaml
  md  1   md/tax/income/credits/eitc/md_married_childless_age_disregard.yaml
  mn  1   mn/tax/income/credits/mn_child_and_working_families_credits.yaml
  mo  1   mo/tax/tax_sim/mo_taxable_income.yaml
  nj  1   nj/tax/income/subtractions/nj_social_security_exclusion.yaml
  nm  3   nm/tax/income/integration.yaml          <- used on Day 67
  sc  1   sc/tax/income/integration.yaml
  ut  1   ut/tax/income/credits/ut_refundable_credits.yaml
  va  1   va/tax/income/integration.yaml
```

**In states this package does not ship (6), and therefore an argument for the
order of the next six states as much as anything else:**

```text
  de  3   de/tax/income/de_income_tax.yaml, de/tax/income/integration.yaml
  me  2   me/tax/income/credits/me_eitc.yaml, .../deductions/me_deductions.yaml
  mt  3   mt/tax/income/integration.yaml, .../mt_unemployment_compensation_subtraction.yaml
  ri  1   ri/tax/income/integration.yaml
  vt  1   vt/tax/income/integration.yaml
```

Four of those five are on `UNCOVERED_TAXING_JURISDICTIONS`.

## Four anchors read, with what each one asserts

```text
  AR  "TaxAct reference: $86 (from TAXSIM issue #493)" against a computed
      $85.44 of ar_income_tax — a $236 non-refundable credit against $321.44
      of tax, so the anchor is on the CREDIT ORDERING rather than on a rate
  CO  "co_income_tax matches TaxAct (-$4,397) within ~$65, residual is a
      separate CO add-back issue" — a joint 2025 return with property tax and
      mortgage interest, ITEMIZING. The $65 residual is the interesting half:
      an anchor with a stated unexplained remainder is a finding somebody
      wrote down and did not chase
  KY  "(31,429 - 2,770) x 5% - 40 = 1,392.95 (externally cross-checked in
      TaxAct)" — a 2022 household electing joint over separate to preserve the
      age-65 credit, which is a rule about an ELECTION and not about a figure
  SC  "TaxAct adds back $7,500 on SC1040 line 2e: $1,500 OBBBA standard
      deduction increase + $6,000 OBBBA senior deduction" — the single most
      load-bearing anchor on this list for this package, because South
      Carolina's add-back is the one rule here whose correctness the
      differential grid CANNOT see (the movement cancels, which is why
      `federal-conformity.test.js` backs the claim with the add-back machinery
      instead)
  VA  "Confirmed against the Virginia Form 760 Spouse Tax Adjustment
      worksheet, TaxAct, and TAXSIM-35" — three sources on one household, and
      the Spouse Tax Adjustment is Virginia's hardest rule
```

## READ THIS BEFORE STARTING: it must be built at the START of a run

Day 67 began building it and stopped, for a reason that is about scheduling and
not about tax.

**The anchors need a wider case vocabulary than the differential grid has.** New
Mexico's two carry `taxable_interest_income`, and the only ordinary-income field
in `out/cases.json` is `pension` — which `ours.mjs` passes as
`employerPlanPension` and which the state engine therefore reads as a
defined-benefit pension. Several states exclude one. So interest cannot be put in
that field without making the two sides answer different questions, and it cannot
be left out without dropping the case.

Adding a field means editing `cases.mjs`, which regenerates `cases.json`, which
changes the fingerprint `compare.mjs` requires `theirs.json` to match — **and the
PolicyEngine pass takes about an hour.** Day 67's was forty minutes from done.

> **A HARNESS THAT NEEDS A WIDER GRID MUST BE BUILT BEFORE THE POLICYENGINE PASS
> STARTS, NOT ALONGSIDE IT.** This is Day 54's finding from the other side — that
> one said start the slow pass first and do the engine work while it runs, and it
> is right about engine work and wrong about anything that touches the grid's
> shape. Widen `cases.mjs` first, regenerate, then start the pass once.

## What building this would take, honestly

Each fixture is a `policyengine-us` situation dict — people, tax units, SPM
units, households, with variables named that package's way. Running one here
means translating it into a `StateIncomeTaxInput`, and the translation is where
a harness of this kind goes wrong: **a case that fails because the translation
dropped a field is indistinguishable from a case that fails because this engine
is wrong**, which is the exact defect `tools/differential/README.md` warns about
in its own first section ("deliberately separate so that a disagreement can never
be a disagreement about the question").

So the shape is the differential harness's and not a new one:

1. **A reader** that pulls the named fixtures out of an installed
   `policyengine-us` and emits them in `out/cases.json`'s format, refusing any
   case whose situation contains a variable the reader does not map — refusing,
   not ignoring, because an ignored field is a silent wrong answer.
2. **The existing `ours.mjs`** over those cases, unchanged.
3. **A comparator** that checks the fixture's own `output:` block rather than
   `theirs.json`, within the fixture's own `absolute_error_margin`.

The margins matter and vary: New Mexico's two are `5` and `2`, Virginia's and
Kentucky's are `0.01`, South Carolina's is `5`, Colorado's is `1` with a stated
`$65` residual. **A harness that imposed one margin would either reject a
correct answer or accept a wrong one**, so the fixture's own margin is the
tolerance and a case with no margin is a case that must match to the cent.

The prize is a sentence this repository cannot say today: *N households across M
states, computed by this engine and by commercial tax software, agreeing to the
cent.* Every one that disagrees is either a defect here or a finding, and both
are worth more than the agreement.

