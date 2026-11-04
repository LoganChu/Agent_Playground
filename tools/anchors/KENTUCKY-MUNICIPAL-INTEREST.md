# Kentucky taxes another state's municipal bonds and this package does not — a spec, not an instrument

**Written on Day 72 for the next run, in the same shape and for the same reason
as `KENTUCKY-FAMILY-SIZE-CREDIT.md`: the looking is done, so the next run starts
from a measured gap rather than from a hunch.** That file was Day 71's handoff
and it worked — the credit it spec'd shipped the following day — which is the
only evidence this format has and is the reason there is a second one.

```text
  a Kentucky single filer, $60,000 of wages        tax $2,269.20
  the same filer, plus $20,000 of OTHER states'
  municipal bond interest                          tax $2,269.20   <- unchanged
```

**The second figure should be `$3,069.20`.** The gap is 4.0% of the out-of-state
interest in 2025 and 3.5% in 2026 — `$800.00` on `$20,000`, `$400.00` on
`$10,000` — and it runs the undertaxing way, which is the direction a tax
estimate must not run silently.

## Why this is cheap, and the cheapness is the whole argument for doing it next

Nothing new has to be built. **Seven states already declare the rule and the
input is already on the interface.**

```text
  AR  measure interest             netOfExpenses false
  IL  measure interest             netOfExpenses false
  IN  measure interest             netOfExpenses false   acquiredAfterYear 2011
  MD  measure interestAndDividends netOfExpenses TRUE
  OH  measure interestAndDividends netOfExpenses false
  VA  measure interest             netOfExpenses TRUE
  WI  measure interest             netOfExpenses false
```

So the work is one `outOfStateMunicipalInterestAddition` block in `kentucky()`
in `states/flat-states.ts`, a cite, a note, a ledger entry if the block carries a
figure, and the two answers below settled. Kentucky is the eighth state of a
pattern this package has run seven times.

## What is established, and by what

**Established: Kentucky taxes it and exempts its own.** Kentucky's Schedule M
Part I carries the addition on its first line, and the Department's own
instructions say interest from another state's securities is taxed by Kentucky
and must be reported, while interest on Kentucky's own obligations and those of
its political subdivisions is excluded from the addition. Reached by server-side
search; `revenue.ky.gov` does not resolve from this sandbox, by `curl` or by
server-side fetch, and was tried again on Day 72.

**Established: the reference model does not do this either.** `ky_additions`
adds exactly one thing, `ky_other_additions`, and that variable has **no
formula** — it is an input, documented as "Schedule M, Part I, Line 5 (Other
additions), entered as a positive amount". So `policyengine-us` has the same gap,
which means:

> **THE DIFFERENTIAL GRID CANNOT FIND THIS AND NEVER WILL.** Both models return
> the same answer for a Kentucky bondholder and both are wrong. It is the exact
> failure mode `STRATEGY.md` has described since Day 66 — two models agreeing
> because neither implements a rule — and it is worth noticing that the
> instrument which *did* find it was neither of the five: it was reading another
> model's source to settle a different question and seeing what was not there.

**Not established, and it is one line of a form:** whether the measure is
`interest` or `interestAndDividends`. The search result that confirmed the
addition also said that "dividends from regulated investment companies that are
taxable for Kentucky purposes are reported in the same section", which is the
shape of Ohio's and Maryland's `interestAndDividends` rather than Virginia's
`interest`. **Shipping the narrower one understates; shipping the wider one
overstates.** The seven precedents split 5–2 and the split is not geographic, so
it cannot be inferred — it has to be read off Schedule M, or declared.

**Not established:** whether related expenses are deducted (`netOfExpenses`).
Maryland's and Virginia's statutes say so in terms and Kentucky's instructions
were not read. Two of seven, so again not inferable.

## AND IT CONNECTS TO THE CREDIT THAT SHIPPED TODAY, WHICH IS WHY IT IS HERE

`KENTUCKY-FAMILY-SIZE-CREDIT.md` left one gap unclosed on purpose: **worksheet
line (c)** adds tax-exempt interest on other states' municipal bonds to modified
gross income, the base the family size tax credit's taper is measured on. This
package does not add it, declares that it does not, and names
`kentuckyModifiedGrossIncome` as the way to supply the right figure.

**The two gaps are the same figure used twice, and that is the argument for doing
them together rather than separately.** If Kentucky's AGI gains the addition,
then `max(federal AGI, Kentucky AGI)` picks the interest up on the Kentucky side
automatically — the engine's derived modified gross income stops being a floor
and becomes exact for that household, with no second rule and no second input.

```text
  before   fed AGI 60,000   KY AGI 60,000   MGI 60,000   (interest invisible)
  after    fed AGI 60,000   KY AGI 80,000   MGI 80,000   (line (c), via the max)
```

> **THAT IS ALSO THE ANSWER TO THE QUESTION DAY 71 COULD NOT SETTLE: WHICH SIDE
> OF THE `max` LINE (c) BELONGS ON.** It does not need settling. Add the interest
> where the statute puts it — in Kentucky's AGI — and the `max` carries it into
> modified gross income on its own. Day 72 reasoned about "both sides, which is
> the same as adding it to the result", and that reasoning was sound and
> unnecessary: a rule in the right place needs no special case in the thing that
> reads it.

One caution, and it is why this was not done on Day 72 in passing: Kentucky's
tax would then move with `outOfStateMunicipalInterest`, so the MCP server's
derived per-state field list needs the path, and its own guard will say so within
the hour the way it did twice today. That is a feature of the guard and a cost of
the change, not a reason against it.

## The order to do it in

1. **Try once more for Schedule M**, which settles both open questions at once.
   Do not spend long: `revenue.ky.gov` has refused on Day 71 and Day 72.
   `taxsim.nber.org` mirrors Kentucky's historical forms and also refuses. What
   *does* answer is `pypi.org` and `files.pythonhosted.org` — but the reference
   model does not model this line, so its source holds nothing here. This is the
   first Kentucky question in a while that another model cannot answer.
2. **Ship `measure: 'interest'` and `netOfExpenses: false`** if it cannot be
   read, declaring both choices by name in the state's notes with the price of
   each being wrong. `interest` is the narrower reading and the 5–2 majority of
   the precedents; it understates a filer with out-of-state fund dividends, which
   is the same direction as today's gap and strictly smaller than it.
3. **Then re-check the family size credit's modified gross income note**, which
   currently says line (c) is not added. It would become true that it *is*,
   through the Kentucky AGI side of the `max`, and that note has to stop saying
   otherwise. `test/kentucky-family-size-credit.test.js` has the household that
   proves it: a retiree whose Kentucky AGI is emptied by the pension exclusion is
   measured on the larger federal figure, and a bondholder is now the mirror
   image — measured on the larger *Kentucky* figure.
4. **Price it on the differential grid before and after.** It should move
   **nothing**, because the reference model has the same gap, and a change that
   moves no agreement while fixing a real defect is the most useful thing this
   project can show a buyer: it is the whole of the argument that agreeing with
   another model is not the same as being right.
