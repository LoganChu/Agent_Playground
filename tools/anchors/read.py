#!/usr/bin/env python3
"""
The households whose expected answer came off a FILLED FORM, read out of
`policyengine-us`'s own test fixtures and translated into this package's input.

## Why this instrument is not the differential harness

`tools/differential` compares this engine against `policyengine-us` running
live. Two models can agree because they made the same reading of the same
ambiguous sentence, and a statute cite cannot catch that either, because the
cite is to the sentence both of them read.

`policyengine-us` ships fixtures whose **expected** values were produced by
entering the household into commercial tax software and reading the figure off
the form -- TaxAct's PIT-1, Virginia's own Form 760 Spouse Tax Adjustment
worksheet, a TAXSIM record cross-checked in TaxAct. Those are not a model's
opinion. They are what a filer would have been told to pay. Comparing against
them is the only check in this repository whose right answer was produced
outside it.

## THE RULE THIS FILE EXISTS TO ENFORCE: A DROPPED FIELD IS A WRONG ANSWER
## THAT LOOKS LIKE A DISAGREEMENT

A PolicyEngine situation is a dict of variable names. Translating one means
mapping each name onto a field of `StateIncomeTaxInput`, and the failure mode
is not a crash -- it is a case that silently loses a fact and then reports the
difference as a divergence in the engine. `tools/differential/README.md` warns
about exactly this ("deliberately separate so that a disagreement can never be
a disagreement about the question") and the warning applies with more force
here, because these situations were written by somebody else for a different
model and contain variable names this package has never heard of.

So this reader REFUSES rather than ignores, under three rules:

  1. AN UNMAPPED VARIABLE WITH A NON-ZERO VALUE REFUSES THE CASE. The fact
     exists in the household and the engine is not being told it.

  2. AN UNMAPPED VARIABLE SET TO ZERO OR FALSE IS IGNORABLE, because zero of
     something is the absence of it. Most of the noise in these fixtures is
     this: `ssi: 0`, `wic: 0`, `snap: 0`, `ma_state_supplement: 0` -- benefits
     switched off so a TAXSIM comparison is like for like.

  3. RULE 2 HAS AN EXCEPTION AND IT IS THE WHOLE REASON THIS FILE IS CAREFUL.
     A variable named for the case's OWN state, set to zero, is not an absence
     -- it is an OVERRIDE of a component of the figure under comparison. The
     2021 New Mexico fixture zeroes `nm_2021_income_rebate`; if this package
     computed one, the comparison would be between a tax with a rebate and a
     tax without. Every such override must be declared here by name with a
     written reason, or the case is refused.

A case that is merely out of scope -- a year this package does not support, a
state it does not ship, an asserted variable with no comparand here -- is
SKIPPED and counted, which is a different thing from refused and is reported
separately. A refusal is a statement about this reader. A skip is a statement
about the engine's declared range.

## Run

    python3 -I tools/anchors/read.py --fixtures <dir>   # verify + translate
    python3 -I tools/anchors/read.py --fetch            # download first

`out/anchors.json` is committed; the fixtures are not. They are AGPL-licensed
files from another project and this repository is MIT, so what lands here is
the derived FACTS -- a household, an expected figure, a margin, a short
attributed quotation -- beside the sha256 of the bytes they were read from and
the upstream commit they were read at. Day 68 paid 838 MB for the difference
between reading a file and vendoring it.
"""
import argparse
import hashlib
import json
import os
import sys
import urllib.request

# The pinned upstream. A tag name is not resolvable through
# raw.githubusercontent.com from this sandbox, so the pin is the commit.
UPSTREAM_COMMIT = "210dc5913b930891b6f5325d32db9cea7bdb4d3f"
UPSTREAM_VERSION = "2.93.3"
RAW = (
    "https://raw.githubusercontent.com/PolicyEngine/policyengine-us/"
    f"{UPSTREAM_COMMIT}/policyengine_us/tests/policy/baseline/gov/states/"
)

# Every fixture file under that tree whose text names a commercial preparer,
# from `tools/differential/PREPARER-ANCHORS.md`'s survey, restricted to states
# this package ships. The survey is the enumeration because `api.github.com`
# answers 403 for repositories outside this session's own and
# `codeload.github.com` refuses tarballs, so the tree cannot be walked from
# here -- only named files can be fetched.
FIXTURE_FILES = [
    "ar/tax/income/integration.yaml",
    "ca/tax/income/credits/earned_income/ca_eitc_integration.yaml",
    "co/tax/income/integration.yaml",
    "ia/tax/income/ia_cdcc.yaml",
    "ky/tax/income/integration.yaml",
    "ma/tax/income/adjusted_gross_income/ma_qualified_unemployment_deduction.yaml",
    "md/tax/income/credits/eitc/federal_eitc_without_age_minimum.yaml",
    "md/tax/income/credits/eitc/md_married_childless_age_disregard.yaml",
    "mn/tax/income/credits/mn_child_and_working_families_credits.yaml",
    "mo/tax/tax_sim/mo_taxable_income.yaml",
    "nj/tax/income/subtractions/nj_social_security_exclusion.yaml",
    "nm/tax/income/integration.yaml",
    "sc/tax/income/integration.yaml",
    "ut/tax/income/credits/ut_refundable_credits.yaml",
    "va/tax/income/integration.yaml",
]

# The years `us-state-tax` declares. A fixture outside them is skipped and not
# refused: the engine says so itself rather than being wrong about it.
YEARS = {2025, 2026}

# The states this package ships with an income tax, by FIPS and by code. Kept
# here as a literal and CHECKED against the registry by `ours.mjs`, which
# refuses an anchor in a state it cannot compute -- so a stale list here
# announces itself instead of quietly dropping a state.
FIPS = {
    1: "AL", 4: "AZ", 5: "AR", 6: "CA", 8: "CO", 9: "CT", 13: "GA", 17: "IL",
    18: "IN", 19: "IA", 20: "KS", 21: "KY", 22: "LA", 24: "MD", 25: "MA",
    26: "MI", 27: "MN", 29: "MO", 31: "NE", 34: "NJ", 35: "NM", 36: "NY",
    37: "NC", 38: "ND", 39: "OH", 40: "OK", 41: "OR", 42: "PA", 45: "SC",
    47: "TN", 49: "UT", 51: "VA", 54: "WV", 55: "WI",
}

# What an asserted PolicyEngine variable is compared against here. The left
# side is a per-state variable name with the state's own prefix stripped; the
# right side is a field of this package's `StateIncomeTaxResult`.
#
# `income_tax` -> `totalTax` and NOT `tax`, for the reason `ours.mjs` in the
# differential harness gives: PolicyEngine's state income tax includes a local
# income tax where one is universal, and so must this one.
COMPARANDS = {
    "income_tax": "totalTax",
    "taxable_income": "taxableIncome",
    "income_tax_before_non_refundable_credits": "taxBeforeCredits",
}

# ---------------------------------------------------------------------------
# The variable map. Everything this reader knows how to translate.
# ---------------------------------------------------------------------------

# Person-level money, by the role it plays in a household here.
PERSON_MONEY = {
    "employment_income": "wages",
    "taxable_interest_income": "interest",
    "tax_exempt_interest_income": "taxExemptInterest",
    "taxable_private_pension_income": "pension",
    "taxable_public_pension_income": "pension",
    "taxable_pension_income": "pension",
    "social_security_retirement": "socialSecurity",
    "social_security": "socialSecurity",
    "long_term_capital_gains": "longTermCapitalGains",
    "short_term_capital_gains": "shortTermCapitalGains",
    "qualified_dividend_income": "qualifiedDividends",
    "non_qualified_dividend_income": "interest",
    "unemployment_compensation": "unemployment",
    "deductible_mortgage_interest": "mortgageInterest",
    "real_estate_taxes": "realEstateTaxes",
    "rent": "rent",
}

# Person-level facts that are not money.
PERSON_FACTS = {"age", "is_blind"}

# Person-level structure. These place a person in the unit and carry no money.
PERSON_STRUCTURE = {
    "is_tax_unit_head",
    "is_tax_unit_spouse",
    "is_tax_unit_dependent",
    "is_tax_unit_dependent_elsewhere",
    "medicare_enrolled",
    "is_full_time_student",
    "is_disabled",
}

# Tax-unit level facts this reader maps.
UNIT_MAPPED = {"filing_status", "members"}

# Household level: where the return is filed.
HOUSEHOLD_MAPPED = {"state_fips", "state_code", "state_name", "members"}

# ---------------------------------------------------------------------------
# Rule 3's declarations: a state-prefixed override that is benign, with why.
#
# Each entry is read as "this package computes nothing for that variable in
# these years, so zeroing it on their side makes the two sides answer the same
# question". Anything not listed refuses the case, and the refusal names it.
# ---------------------------------------------------------------------------
BENIGN_STATE_OVERRIDES = {
    "va_rebate": (
        "This package declares no Virginia rebate for 2025 or 2026 and says so "
        "in writing: the one-time $200/$400 rebates were authorised by the "
        "Appropriation Act for 2022 and 2023 returns and not renewed. Zero on "
        "their side and absent on this one are the same household."
    ),
}


def ignorable_zero(value):
    """Rule 2: zero of something is the absence of it."""
    if value is False or value is None:
        return True
    if isinstance(value, bool):
        return False
    if isinstance(value, (int, float)):
        return value == 0
    return False


def fetch(dest):
    os.makedirs(dest, exist_ok=True)
    for rel in FIXTURE_FILES:
        out = os.path.join(dest, rel.replace("/", "_"))
        with urllib.request.urlopen(RAW + rel, timeout=120) as r:
            body = r.read()
        with open(out, "wb") as fh:
            fh.write(body)
        print(f"  fetched {len(body):>7} bytes  {rel}", file=sys.stderr)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fixtures", default=None, help="directory holding the fetched fixtures")
    ap.add_argument("--fetch", action="store_true")
    ap.add_argument("-o", "--out", default=os.path.join(os.path.dirname(__file__), "out", "anchors.json"))
    args = ap.parse_args()

    import yaml  # late, so --help works without it

    fixtures = args.fixtures or os.path.join(os.path.dirname(__file__), "out", "fixtures")
    if args.fetch:
        fetch(fixtures)

    files, anchors, refused, skipped = [], [], [], []
    counts = {
        "cases": 0, "keptCases": 0,
        "skippedYear": 0, "skippedState": 0, "skippedNoComparand": 0,
        "refused": 0, "assertions": 0,
    }

    for rel in FIXTURE_FILES:
        path = os.path.join(fixtures, rel.replace("/", "_"))
        if not os.path.exists(path):
            print(f"missing fixture {path} -- run with --fetch", file=sys.stderr)
            return 2
        raw = open(path, "rb").read()
        cases = yaml.safe_load(raw.decode("utf-8"))
        files.append({
            "path": rel,
            "sha256": hashlib.sha256(raw).hexdigest(),
            "bytes": len(raw),
            "cases": len(cases),
        })
        state_prefix = rel.split("/")[0]

        for index, case in enumerate(cases):
            counts["cases"] += 1
            ref = f"{rel}[{index}]"
            name = str(case.get("name", "")).strip()
            try:
                year = int(case.get("period"))
            except (TypeError, ValueError):
                skipped.append({"ref": ref, "why": "no period"})
                counts["skippedYear"] += 1
                continue
            if year not in YEARS:
                skipped.append({"ref": ref, "why": f"period {year} outside the engine's declared {sorted(YEARS)}"})
                counts["skippedYear"] += 1
                continue

            situation = case.get("input") or {}
            household = next(iter((situation.get("households") or {}).values()), {})
            state = None
            if "state_fips" in household:
                state = FIPS.get(int(household["state_fips"]))
            elif "state_code" in household:
                state = str(household["state_code"]).upper()
            elif "state_name" in household:
                state = str(household["state_name"]).upper()
            if state is None:
                skipped.append({"ref": ref, "why": "no state on the household"})
                counts["skippedState"] += 1
                continue

            # Which asserted variables can be compared at all.
            expect = []
            for variable, value in (case.get("output") or {}).items():
                low = variable.lower()
                if not low.startswith(state.lower() + "_"):
                    continue
                suffix = low[len(state) + 1:]
                if suffix in COMPARANDS and isinstance(value, (int, float)) and not isinstance(value, bool):
                    expect.append({
                        "variable": variable,
                        "comparand": COMPARANDS[suffix],
                        "value": float(value),
                    })
            if not expect:
                asserted = sorted((case.get("output") or {}).keys())
                skipped.append({
                    "ref": ref,
                    "why": "no asserted variable has a comparand here",
                    "asserted": asserted,
                })
                counts["skippedNoComparand"] += 1
                continue

            # ---- translate, refusing on anything unmapped -------------------
            problems = []
            people = []
            for person_name, person in (situation.get("people") or {}).items():
                rec = {"name": person_name, "age": None, "role": None, "blind": False}
                for key, value in (person or {}).items():
                    if key in PERSON_FACTS:
                        if key == "age":
                            rec["age"] = value
                        elif key == "is_blind":
                            rec["blind"] = bool(value)
                        continue
                    if key in PERSON_STRUCTURE:
                        if key == "is_tax_unit_head" and value:
                            rec["role"] = "primary"
                        elif key == "is_tax_unit_spouse" and value:
                            rec["role"] = "spouse"
                        elif key == "is_tax_unit_dependent" and value:
                            rec["role"] = "dependent"
                        continue
                    if key in PERSON_MONEY:
                        if value:
                            rec[PERSON_MONEY[key]] = rec.get(PERSON_MONEY[key], 0) + float(value)
                        continue
                    if key.lower().startswith(state.lower() + "_"):
                        if key.lower() in BENIGN_STATE_OVERRIDES:
                            continue
                        problems.append(f"{person_name}.{key}={value!r}: own-state override, rule 3")
                        continue
                    if ignorable_zero(value):
                        continue
                    problems.append(f"{person_name}.{key}={value!r}: unmapped and non-zero, rule 1")
                people.append(rec)

            unit = next(iter((situation.get("tax_units") or {}).values()), {}) or {}
            declared_status = None
            for key, value in unit.items():
                if key in UNIT_MAPPED:
                    if key == "filing_status":
                        declared_status = str(value).upper()
                    continue
                if key.lower().startswith(state.lower() + "_"):
                    if key.lower() in BENIGN_STATE_OVERRIDES:
                        continue
                    problems.append(f"tax_unit.{key}={value!r}: own-state override, rule 3")
                    continue
                if ignorable_zero(value):
                    continue
                problems.append(f"tax_unit.{key}={value!r}: unmapped and non-zero, rule 1")

            for level in ("spm_units", "households"):
                for group_name, group in (situation.get(level) or {}).items():
                    for key, value in (group or {}).items():
                        if level == "households" and key in HOUSEHOLD_MAPPED:
                            continue
                        if key == "members":
                            continue
                        if key.lower().startswith(state.lower() + "_"):
                            if key.lower() in BENIGN_STATE_OVERRIDES:
                                continue
                            problems.append(f"{level}.{group_name}.{key}={value!r}: own-state override, rule 3")
                            continue
                        if ignorable_zero(value):
                            continue
                        problems.append(f"{level}.{group_name}.{key}={value!r}: unmapped and non-zero, rule 1")

            if problems:
                refused.append({"ref": ref, "name": name, "state": state, "year": year, "problems": problems})
                counts["refused"] += 1
                continue

            # ---- roles, where the fixture did not state them ---------------
            #
            # PolicyEngine fills these in from the unit's shape. So does this,
            # by the same rule, and the record SAYS it inferred them -- an
            # inference that is wrong makes the comparison fail loudly, which
            # is the only acceptable way for it to be wrong.
            members = unit.get("members") or list((situation.get("people") or {}).keys())
            order = {n: i for i, n in enumerate(members)}
            people.sort(key=lambda p: order.get(p["name"], 99))
            inferred = []
            unroled = [p for p in people if p["role"] is None]
            if unroled:
                inferred.append("role")
                for i, person in enumerate(people):
                    if person["role"] is not None:
                        continue
                    if person["age"] is not None and person["age"] < 19 and i > 0:
                        person["role"] = "dependent"
                    elif not any(q["role"] == "primary" for q in people):
                        person["role"] = "primary"
                    elif not any(q["role"] == "spouse" for q in people) and (person["age"] or 0) >= 19:
                        person["role"] = "spouse"
                    else:
                        person["role"] = "dependent"

            has_spouse = any(p["role"] == "spouse" for p in people)
            dependents = [p for p in people if p["role"] == "dependent"]
            if declared_status:
                status = {
                    "JOINT": "marriedFilingJointly",
                    "SEPARATE": "marriedFilingSeparately",
                    "SINGLE": "single",
                    "HEAD_OF_HOUSEHOLD": "headOfHousehold",
                    "SURVIVING_SPOUSE": "qualifyingSurvivingSpouse",
                }.get(declared_status)
                if status is None:
                    refused.append({"ref": ref, "name": name, "state": state, "year": year,
                                    "problems": [f"filing_status={declared_status!r} is not mapped"]})
                    counts["refused"] += 1
                    continue
            else:
                inferred.append("filingStatus")
                status = ("marriedFilingJointly" if has_spouse
                          else "headOfHousehold" if dependents
                          else "single")

            counts["keptCases"] += 1
            counts["assertions"] += len(expect)
            anchors.append({
                "id": f"{year}-{state}-{rel.split('/')[0]}-{index}",
                "source": {"file": rel, "index": index, "name": name},
                "year": year,
                "state": state,
                "filingStatus": status,
                "margin": case.get("absolute_error_margin"),
                "inferred": inferred,
                "people": [
                    {k: v for k, v in p.items() if k != "name" and v not in (None, False, 0)}
                    | {"role": p["role"], "age": p["age"]}
                    for p in people
                ],
                "expect": expect,
            })

    report = {
        "upstream": {
            "project": "policyengine-us",
            "version": UPSTREAM_VERSION,
            "commit": UPSTREAM_COMMIT,
            "tree": "policyengine_us/tests/policy/baseline/gov/states",
            "licence": "AGPL-3.0 -- the fixtures are READ, never committed here",
        },
        "counts": counts,
        "files": files,
        "anchors": anchors,
        "refused": refused,
        "skipped": skipped,
    }
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w") as fh:
        json.dump(report, fh, indent=1, sort_keys=False)
        fh.write("\n")

    c = counts
    print(
        f"{c['cases']} cases read from {len(files)} files\n"
        f"  kept      {c['keptCases']:>4}  ({c['assertions']} assertions)\n"
        f"  refused   {c['refused']:>4}  (in scope, untranslatable -- rules 1 and 3)\n"
        f"  skipped   {c['skippedYear'] + c['skippedState'] + c['skippedNoComparand']:>4}"
        f"  ({c['skippedYear']} out-of-year, {c['skippedState']} no state,"
        f" {c['skippedNoComparand']} nothing comparable asserted)",
        file=sys.stderr,
    )
    for r in refused:
        print(f"  REFUSED {r['ref']} {r['state']} {r['year']}", file=sys.stderr)
        for p in r["problems"]:
            print(f"            {p}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
