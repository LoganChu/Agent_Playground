"""PolicyEngine-US's answer for every case, in the shared comparison schema.

PolicyEngine-US is an independent microsimulation model of the US tax and
benefit system, maintained by people who are not this project and who read the
same statutes. It is the only executable second opinion available here, and it
costs nothing but CPU: a household is a dict, no data download is involved, and
the whole grid runs offline.

Usage, from the repository root, in a virtualenv with `policyengine-us`:

    python tools/differential/theirs.py tools/differential/out/cases.json \
        > tools/differential/out/theirs.json

The cases file is written by `cases.mjs`, so both sides answer bytes that came
from the same generator rather than two transcriptions of the same idea.
"""

import json
import sys

from policyengine_us import Simulation

STATUS = {
    "single": "SINGLE",
    "marriedFilingJointly": "JOINT",
    "marriedFilingSeparately": "SEPARATE",
    "headOfHousehold": "HEAD_OF_HOUSEHOLD",
}

# Every figure both models are asked for. The federal ones are state-independent
# and are read off whichever simulation ran, which is itself a check: if they
# moved with the state, one of the two models has a leak.
FEDERAL = {
    "adjustedGrossIncome": "adjusted_gross_income",
    "taxableIncome": "taxable_income",
    "incomeTaxBeforeCredits": "income_tax_before_credits",
    "taxableSocialSecurity": "taxable_social_security",
    # `ctc` in PolicyEngine is the credit BEFORE the tax-liability and refundable
    # limits — `ctc_value` is what the household actually receives, which is the
    # figure this package reports.
    "childTaxCredit": "ctc_value",
    "earnedIncomeCredit": "eitc",
}


# Local income taxes that PolicyEngine keeps out of `state_income_tax`.
LOCAL_OUTSIDE_STATE_TAX = {"IN": ("in_county_tax",)}


def situation(case):
    year = str(case["year"])
    people = {}
    members = []

    def add(name, age, **income):
        people[name] = {"age": {year: age}, **{k: {year: v} for k, v in income.items()}}
        members.append(name)

    add(
        "primary",
        case["primaryAge"],
        employment_income=case["wages"],
        taxable_pension_income=case["pension"],
        social_security_retirement=case["socialSecurity"],
        long_term_capital_gains=case["longTermCapitalGains"],
        tax_exempt_interest_income=case["taxExemptInterest"],
    )
    marital_units = {}
    if case["spouseAge"] is not None:
        add("spouse", case["spouseAge"])
        marital_units["primary_marital"] = {"members": ["primary", "spouse"]}
    else:
        marital_units["primary_marital"] = {"members": ["primary"]}
    for i, age in enumerate(case["childAges"]):
        add(f"child{i}", age)
        marital_units[f"child{i}_marital"] = {"members": [f"child{i}"]}

    return {
        "people": people,
        "tax_units": {
            "tax_unit": {
                "members": members,
                "filing_status": {year: STATUS[case["filingStatus"]]},
            }
        },
        "families": {"family": {"members": members}},
        "spm_units": {"spm_unit": {"members": members}},
        "marital_units": marital_units,
        "households": {
            "household": {
                "members": members,
                "state_name": {year: case["state"]},
                # Maryland and Indiana tax every resident locally, so the county
                # is part of the question rather than a refinement of it.
                **(
                    {"county": {year: case["county"]["theirs"]}}
                    if case.get("county")
                    else {}
                ),
            }
        },
    }


def run(case):
    year = case["year"]
    sim = Simulation(situation=situation(case))
    out = {"id": case["id"], "federal": {}, "state": None, "error": None}
    try:
        for key, variable in FEDERAL.items():
            out["federal"][key] = float(sim.calculate(variable, year)[0])
        tax = float(sim.calculate("state_income_tax", year)[0])
        # PolicyEngine draws the line between "state" and "local" in two
        # different places for two taxes of the same kind: Maryland's county
        # income tax is inside `state_income_tax` and Indiana's is not, though
        # both are universal, both are on the state return and both are levied
        # on every resident. This package reports both in `totalTax`, so the
        # county tax is added back here to compare like with like.
        for variable in LOCAL_OUTSIDE_STATE_TAX.get(case["state"], ()):
            tax += float(sim.calculate(variable, year)[0])
        out["state"] = {"tax": tax}
    except Exception as exc:  # noqa: BLE001 - the report wants the message, not a stack
        out["error"] = f"{type(exc).__name__}: {exc}"
    return out


def main():
    with open(sys.argv[1], encoding="utf-8") as handle:
        all_cases = json.load(handle)
    results = {}
    for i, case in enumerate(all_cases):
        results[case["id"]] = run(case)
        if i % 25 == 0:
            print(f"{i}/{len(all_cases)}", file=sys.stderr, flush=True)
    json.dump(results, sys.stdout, indent=1)
    print()


if __name__ == "__main__":
    main()
