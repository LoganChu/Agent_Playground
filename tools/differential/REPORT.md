# Differential test against PolicyEngine-US

437 households, 3059 figures compared, **2803 agree to the dollar** (91.6%).

220 differences are explained by `known-divergences.json`; **36 are not.**

## Unexplained

| case | metric | us-tax | PolicyEngine | difference |
| --- | --- | ---: | ---: | ---: |
| `single-worker-MD-400000-0-0-0-0` | state.tax | $33,885.18 | $33,206.48 | $678.70 |
| `single-worker-GA-400000-0-0-0-0` | state.tax | $19,211.50 | $18,563.95 | $647.55 |
| `single-worker-VA-400000-0-0-0-0` | state.tax | $22,185.90 | $22,689.03 | -$503.13 |
| `couple-two-children-MD-200000-0-0-0-0` | state.tax | $15,198.45 | $14,862.86 | $335.59 |
| `single-worker-MD-150000-0-0-0-0` | state.tax | $11,709.33 | $11,457.24 | $252.09 |
| `investor-MD-50000-0-0-100000-0` | state.tax | $11,709.33 | $11,457.24 | $252.09 |
| `retired-couple-IN-0-0-40000-0-0` | state.tax | $0.00 | -$241.00 | $241.00 |
| `single-worker-MD-15000-0-0-0-0` | state.tax | $160.85 | -$0.79 | $161.64 |
| `couple-two-children-IN-30000-0-0-0-0` | state.tax | $560.60 | $411.50 | $149.10 |
| `couple-two-children-IN-100000-0-0-0-0` | state.tax | $4,771.20 | $4,622.10 | $149.10 |
| `retired-couple-IN-0-20000-40000-0-0` | state.tax | $894.60 | $745.50 | $149.10 |
| `couple-two-children-IN-200000-0-0-0-0` | state.tax | $9,741.20 | $9,592.10 | $149.10 |
| `couple-two-children-IN-60000-0-0-0-0` | state.tax | $2,658.97 | $2,509.87 | $149.10 |
| `couple-two-children-MD-100000-0-0-0-0` | state.tax | $6,347.25 | $6,198.73 | $148.52 |
| `retired-couple-MD-0-90000-40000-0-0` | state.tax | $4,104.35 | $3,966.37 | $137.98 |
| `single-worker-MD-80000-0-0-0-0` | state.tax | $5,786.78 | $5,658.02 | $128.76 |
| `investor-MD-50000-0-0-20000-0` | state.tax | $4,991.78 | $4,880.02 | $111.76 |
| `retired-couple-IN-0-90000-40000-0-0` | state.tax | $4,373.60 | $4,274.20 | $99.40 |
| `muni-retiree-IN-0-60000-40000-0-10000` | state.tax | $2,882.60 | $2,783.20 | $99.40 |
| `retired-couple-IN-0-50000-40000-0-0` | state.tax | $2,385.60 | $2,286.20 | $99.40 |
| `separate-MD-60000-0-0-0-0` | state.tax | $4,196.78 | $4,102.02 | $94.76 |
| `muni-retiree-MD-0-60000-40000-0-10000` | state.tax | $1,719.35 | $1,632.37 | $86.98 |
| `single-worker-MD-50000-0-0-0-0` | state.tax | $3,401.78 | $3,324.02 | $77.76 |
| `single-parent-IN-25000-0-0-0-0` | state.tax | $718.14 | $643.59 | $74.55 |
| `single-parent-IN-45000-0-0-0-0` | state.tax | $2,031.74 | $1,957.19 | $74.55 |
| `single-parent-IN-12000-0-0-0-0` | state.tax | $89.00 | $14.45 | $74.55 |
| `single-retiree-IN-0-10000-24000-0-0` | state.tax | $447.30 | $372.75 | $74.55 |
| `retired-couple-MD-0-50000-40000-0-0` | state.tax | $1,097.60 | $1,034.74 | $62.86 |
| `couple-two-children-MD-60000-0-0-0-0` | state.tax | $2,148.56 | $2,089.17 | $59.39 |
| `single-retiree-IN-0-40000-24000-0-0` | state.tax | $1,938.30 | $1,888.60 | $49.70 |
| `single-parent-MD-45000-0-0-0-0` | state.tax | $1,619.58 | $1,571.59 | $47.99 |
| `single-worker-MD-30000-0-0-0-0` | state.tax | $1,811.78 | $1,768.02 | $43.76 |
| `single-retiree-MD-0-40000-24000-0-0` | state.tax | $507.20 | $478.74 | $28.46 |
| `retired-couple-MD-0-20000-40000-0-0` | state.tax | $137.60 | $125.75 | $11.85 |
| `couple-two-children-MD-30000-0-0-0-0` | state.tax | -$2,845.95 | -$2,853.07 | $7.12 |
| `single-parent-MD-25000-0-0-0-0` | state.tax | -$1,399.58 | -$1,406.70 | $7.12 |

## Explained

- **23** — NOT MODELLED HERE. Colorado's Social Security subtraction (C.R.S. § 39-22-104(4)(f)), its child tax credit and its family affordability tax credit. The credits are large and refundable at low incomes; the subtraction makes a Colorado retiree too high. Recorded in the state's notes and in test/social-security.test.js. (largest: `couple-two-children-CO-30000-0-0-0-0`, $6,571.97)
- **22** — CALLER-SUPPLIED. Michigan's retirement and pension deduction, fully phased in for 2026, is not detected — pass it through `subtractions`. (largest: `retired-couple-MI-0-90000-40000-0-0`, $3,332.00)
- **21** — CALLER-SUPPLIED. Illinois exempts all retirement income (35 ILCS 5/203(a)(2)(F)); Social Security is subtracted automatically from taxableSocialSecurity, and qualified plan and IRA distributions must be passed through `subtractions`. The harness passes none, so an Illinois retiree here is high by the pension. (largest: `retired-couple-IL-0-90000-40000-0-0`, $4,172.85)
- **21** — NOT MODELLED HERE. Arizona's family income tax credit (A.R.S. § 43-1073), $25 a person to $100 a return, and its $100 dependent tax credit. (largest: `investor-AZ-50000-0-0-100000-0`, $616.25)
- **20** — NOT MODELLED HERE. Idaho's grocery credit ($155 a head, $155 more at 65) and its child tax credit, both named in the state's notes. (largest: `couple-two-children-ID-60000-0-0-0-0`, $631.55)
- **20** — NOT MODELLED HERE. Kentucky's family size tax credit, which forgives the whole tax below the federal poverty guideline for the household's size and phases out over the next 33%. (largest: `couple-two-children-KY-30000-0-0-0-0`, $935.55)
- **18** — PROVISIONAL FIGURES. California's 2026 brackets, standard deduction and exemption credits are the 2025 published amounts carried forward; the FTB indexes them to the CCPI after this was written. PolicyEngine projects them. (largest: `retired-couple-CA-0-90000-40000-0-0`, $359.05)
- **15** — HARNESS. Massachusetts taxes its own gross income and the harness states it directly, so any difference is a difference about what belongs on Form 1 line 21 rather than about the tax. Massachusetts also has a No Tax Status and a Limited Income Credit that this package does not model. (largest: `couple-two-children-MA-30000-0-0-0-0`, $100.00)
- **12** — HARNESS. PolicyEngine computes the household's state and local tax and itemises when that beats the standard deduction; the harness supplies no itemised deductions, so this package takes the standard one. Above about $300,000 in a high-tax state the two diverge by the SALT deduction. Feeding a state tax back into the federal return is circular and the harness refuses to guess at it. (largest: `single-worker-MD-400000-0-0-0-0`, $17,159.16)
- **12** — HARNESS. Follows the taxable-income difference above. (largest: `single-worker-MD-400000-0-0-0-0`, $6,005.70)
- **11** — PROVISIONAL FIGURES. Utah indexes the Taxpayer Tax Credit's phase-out threshold and its per-dependent exemption annually and had not published the 2026 amounts when this was written, so this package carries 2025's forward and says so. PolicyEngine has indexed values. The gap is 1.3 cents per dollar of threshold - $5.36 for a single filer, $10.73 joint - and will close when Utah publishes. (largest: `couple-two-children-UT-200000-0-0-0-0`, $16.47)
- **9** — CALLER-SUPPLIED. New York's $20,000 pension and annuity exclusion at 59 1/2 is not modelled; pass it through `subtractions`. (largest: `retired-couple-NY-0-90000-40000-0-0`, $1,080.00)
- **6** — HARNESS. Pennsylvania has no federal starting line, so the harness states the eight-class base itself. (largest: `couple-two-children-PA-30000-0-0-0-0`, $731.60)
- **5** — CALLER-SUPPLIED. North Carolina's Bailey exemption and military retirement deduction are not detected. (largest: `couple-two-children-NC-60000-0-0-0-0`, $199.50)
- **4** — CALLER-SUPPLIED. Mississippi exempts qualified retirement income taken at retirement age; only the Social Security part is automatic. (largest: `retired-couple-MS-0-90000-40000-0-0`, $2,536.00)
- **1** — NOT MODELLED HERE. Ohio's $20-per-exemption credit for a filer with Ohio AGI of $30,000 or less (R.C. 5747.022). (largest: `single-worker-OH-30000-0-0-0-0`, $20.00)

