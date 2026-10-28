/**
 * Arkansas — the thirty-first taxing state, and the one whose highest marginal
 * rate is nearly four times the rate it advertises.
 *
 * Arkansas's top statutory rate is **3.9%** for tax year 2025 and **3.7%** for
 * 2026. Neither figure is the highest rate an Arkansan pays. Two provisions in
 * this state charge a great deal more than that, both to households nobody
 * describes as high-rate taxpayers, and neither is visible in any table of
 * Arkansas rates.
 *
 * ## One: the bracket adjustment, and a 13.7% marginal rate on a $2,900 band
 *
 * A.C.A. § 26-51-201 writes **two** rate schedules, selected by income rather
 * than by status. A filer whose net taxable income does not *exceed* `$94,700`
 * is taxed on the ordinary graduated table. A filer one dollar above it is taxed
 * under a different table entirely — 2% on the first `$4,700` and 3.7% on
 * **every dollar above it**, applied to the *whole* of their net income and not
 * to the excess over anything.
 *
 * That second table charges much more than the first, and the difference is
 * handed back by a **bracket adjustment** — `$290`, falling by `$10` for every
 * `$100` of further income, reaching zero at `$97,600`.
 *
 * ```text
 *                        2026                           2025
 *   net taxable income   tax          adjustment         tax          reduction
 *      94,700         3,136.70            -           3,273.34          419.96
 *      94,701         3,134.04          290           3,294.04          399.30
 *      94,801         3,147.74          280           3,307.94          389.30
 *       ...
 *      97,601         3,531.34            0           3,793.44           89.30
 * ```
 *
 * A `$10` reduction withdrawn per `$100` earned is **ten percentage points of
 * marginal rate**. Measured rather than asserted, in `test/arkansas.test.js`:
 * **13.70% in 2026 and 13.90% in 2025**, across `$2,900` and `$3,100` of income,
 * in a state whose top rate is 3.7% and 3.9%.
 *
 * **THE RATE IS 13.70% OVER ANY `$100` AND 3.7% OVER ANY ONE DOLLAR, AND BOTH ARE
 * TRUE.** The adjustment's rows are `$100` wide, so within a row the tax rises at
 * the statutory rate and the ten points arrive all at once at the row's edge:
 *
 * ```text
 *   94,750 -> 94,751   one dollar inside a row            3.7 cents
 *   94,800 -> 94,801   one dollar across a boundary       $10.04
 *   94,701 -> 94,801   any hundred dollars in the band    13.70%
 *   94,701 -> 97,601   the whole band                     13.70%, exactly
 * ```
 *
 * So {@link StateIncomeTaxResult.marginalRate}, which measures the next ONE dollar,
 * reports 3.7% for most of this band and `$10.04` at twenty-nine points in it — and
 * neither figure is the one a filer getting a raise experiences. **A provision whose
 * step is wider than the probe is invisible to the probe**, which is why the figure
 * worth publishing is measured over `$100` and why `test/arkansas.test.js` measures
 * it that way rather than through `marginalRate`.
 *
 * > **A STATE'S HIGHEST MARGINAL RATE NEED NOT APPEAR IN ITS RATE SCHEDULE.**
 * > Nothing in Arkansas's published brackets contains the number 13.7. It is
 * > the slope of a relief being withdrawn, and the only way to see it is to
 * > compute the tax at two incomes `$100` apart.
 *
 * ## And the provision written to remove a cliff is a staircase of thirty
 *
 * The adjustment's rows are `$100` wide and its amounts are whole dollars, so
 * the tax does not rise smoothly across the band — it steps. **`$10` of tax
 * arrives on one cent of income, 29 times in 2026 and 31 times in 2025.**
 *
 * {@link RateRule}'s `baseAmountSchedule` comment calls Ohio's schedule *"the
 * only rate structure in this package that is discontinuous"*, on the strength
 * of two discontinuities. Arkansas has thirty in the bracket adjustment alone,
 * and between 28 and 63 more in each of the seven Low Income Tax Tables below.
 * That comment is now wrong and has been corrected; the sentence worth keeping
 * is the general one:
 *
 * > **A PROVISION WRITTEN TO REMOVE A CLIFF CAN BE A STAIRCASE OF SMALLER ONES.**
 *
 * And the 2026 adjustment overshoots. At `$94,700` an Arkansan owes `$3,136.70`
 * and at `$94,701` they owe `$3,134.04` — **one dollar of extra income cuts the
 * bill by `$2.66`**, because `$290` is more than the `$287.34` that would make
 * the two tables meet. The 2025 card undershoots in the same place by `$20.70`.
 * The provision's sign reversed between the two years, and no act changed it:
 * the 2026 amount is Act 1's and the 2025 one is DFA's.
 *
 * ## Two: the Low Income Tax Tables charge the poorest filers up to 12.40%
 *
 * § 26-51-301 and the AR1000F instructions give a second, *tabulated*
 * computation of the whole tax, taken in lieu of the standard deduction, for
 * households below a ceiling that runs from `$17,500` (single) to `$36,100` (a
 * couple with two or more dependents). Below an exempt amount the tax is zero.
 * Above it, the table's own implied marginal rate is:
 *
 * ```text
 *   single                              7.00%    exempt to 14,643, ceiling 17,500
 *   head of household, 0-1 dependent    9.40%    exempt to 20,820, ceiling 25,300
 *   married filing jointly, 0-1        10.40%    exempt to 24,695, ceiling 29,000
 *   married filing jointly, 2 or more  10.77%    exempt to 29,722, ceiling 36,100
 *   head of household, 2 or more       12.40%    exempt to 24,818, ceiling 29,000
 * ```
 *
 * All five measured from the tables in `test/arkansas.test.js` rather than
 * stated. **The steepest rate in the Arkansas income tax is charged to a single
 * parent of two earning between `$24,818` and `$29,000`** — 12.40%, which is
 * 3.35 times the state's 2026 top rate.
 *
 * Massachusetts does the same thing and this package already records it: its
 * Limited Income Credit limits the tax to 10% of the income above No Tax Status,
 * which is **double** the 5% statutory rate, and {@link ZeroTaxThresholdRule}
 * calls that the largest departure from "5%" a Massachusetts wage earner sees.
 * Arkansas's departure is larger, applies to five tables rather than one band,
 * and buys the same thing: no cliff at the exempt amount.
 *
 * > **THE PRICE OF REMOVING A CLIFF IS A RATE, AND IT IS ALWAYS CHARGED TO THE
 * > HOUSEHOLDS JUST ABOVE THE EXEMPTION.**
 *
 * ## The published card and the statute do not agree, by the rate on one dollar
 *
 * For 2025 Arkansas's tax is computed from DFA's *Indexed Tax Brackets* card:
 * the row's rate on all net taxable income, minus the row's reduction. The
 * instructions make it binding — a formula's results *"must match the table"*.
 *
 * The card's reductions are **not** the accumulated tax of the bands beneath
 * them. They are that figure measured **one dollar below each bracket floor**:
 *
 * ```text
 *   floor     card's reduction    accumulated tax of the bands below    rate x $1
 *    5,600          111.98                      112.00                     0.02
 *   11,200          223.97                      224.00                     0.03
 *   16,000          287.97                      288.00                     0.034
 *   26,400          419.96                      420.00                     0.039
 * ```
 *
 * `0.02 x 5,599 = 111.98`. `0.039 x 26,399 - 609.60 = 419.96`. Every figure in
 * the column is the row's rate applied to one dollar less than the row's floor,
 * so **every Arkansan above `$5,600` pays the graduated statutory tax plus their
 * own rate on one dollar** — two to four cents, in the state's favour, on every
 * return filed.
 *
 * It is a trivial amount of money and a non-trivial fact about the state: the
 * card and the statute are two documents that do not compute the same tax, and
 * the one that governs is the one without the brackets in it. The reference
 * model agrees, and the way it agrees is the better evidence: `policyengine-us`
 * carried the round figures `112 / 224 / 288 / 420` as late as version 2.15.3
 * and **replaced them with `111.98 / 223.97 / 287.97 / 419.96` by 2.68.0**,
 * citing the 2025 card. Somebody else read the same two documents and resolved
 * the conflict the same way.
 *
 * ## What a model built from Arkansas's bracket table alone gets wrong
 *
 * Every published account of this state prints the graduated schedule — 0%,
 * 2%, 3%, 3.4%, 3.7% at `$5,600`, `$11,200`, `$16,000` and `$26,400` — and
 * stops. A model built from it, with no high-income table and no bracket
 * adjustment, is too **low** for every Arkansas filer above the adjustment
 * band, by a flat amount that does not depend on income:
 *
 * ```text
 *   2026, every net taxable income above 97,600:       understated by $287.30
 *   2025, net taxable income 97,801 to 100,000:         understated by $330.70
 *   2025, every net taxable income above 100,001:       understated by $329.00
 * ```
 *
 * `$287.30` at `$100,000` and `$287.30` at `$10,000,000`, because both routes
 * are linear with the same slope above the band and the error is the whole
 * bracket adjustment.
 *
 * **2025 needs two figures rather than one, and the reason is the card's own
 * oddity.** For `$100,001` and over DFA prints *"$3,809 plus 3.9% of the excess
 * over $100,000"*, which is a reduction of `$91.00` where the row beneath it
 * carries `$89.30` — so an Arkansan earning one dollar more than `$100,000` pays
 * `$1.70` LESS, and the flat error is `$330.70` below that point and `$329.00`
 * above it. It is the only place in either year where more income means less tax
 * by more than a cent, and it is in the published card.
 * `tools/cross-package/arkansas-bracket-adjustment.mjs` asserts all three
 * figures, the 13.70% slope and the direction on every push.
 *
 * ## The strongest check on this module came from a reference release that has
 * none of the parameters the finding is about
 *
 * `policyengine-us` 2.15.3 — the version this repository pins for its
 * differential grid, many releases old — has **no `high_income` directory at
 * all**: no threshold, no second rate table, no bracket adjustment. It
 * nonetheless computes Arkansas 2026 correctly, because it holds the same
 * schedule in the other form, as `rate x income - reduction` rows. And those
 * rows are **this module's rows, to the cent**:
 *
 * ```text
 *   this module, derived from Act 1's two tables   2.15.3's reduction parameter
 *     5,600         0                                 (5600, 112)
 *    11,200       112                                 (11200, 224)
 *    16,000       224                                 (16000, 288)
 *    26,400       288                                 (26400, 367.2)
 *    94,700       367.20                              (94701, 369.9)
 *    94,800       369.90   ... thirty taper rows ...  (94801, 359.9)
 *     above       79.90                               (97601, 79.9)
 * ```
 *
 * (The threshold columns are offset by one row because the two models key a row
 * on opposite ends of it; the thirty-five amounts are identical.) Two
 * derivations from the same two statutory tables, by different people, agreeing
 * on every figure including the `367.20` and the `79.90`. **That is the best
 * evidence this module has, and it came from a release old enough to predate the
 * act it reproduces.**
 *
 * The same pin is **stale for 2025**, and predictably: it carries the round
 * `112 / 224 / 288 / 420` rather than the card's `111.98 / 223.97 / 287.97 /
 * 419.96`, and it starts the taper at `$95,001` with whole-dollar amounts where
 * the 2025 card starts it at `$94,701` with `399.30`. So this package and the
 * pinned reference disagree about 2025 Arkansas by two to four cents for most
 * filers, by `$2.00` above `$97,901`, and by more inside the taper band — all of
 * it the reference's staleness, all of it predicted before the grid ran, and
 * none of it present in 2026.
 */
import type {
  LowIncomeTableRow,
  RateLessReductionRow,
  StateIncomeTaxDefinition,
} from '../definition.js';
import { byStatus, byStatusOf, perPerson } from './helpers.js';
import type { Citation } from '../types.js';

// single — 29 taxed rows, ceiling $17,500.
const AR_SINGLE: readonly LowIncomeTableRow[] = [
  { over: 14_643, tax: 29 }, { over: 14_700, tax: 33 }, { over: 14_800, tax: 40 },
  { over: 14_900, tax: 47 }, { over: 15_000, tax: 54 }, { over: 15_100, tax: 61 },
  { over: 15_200, tax: 68 }, { over: 15_300, tax: 75 }, { over: 15_400, tax: 82 },
  { over: 15_500, tax: 89 }, { over: 15_600, tax: 96 }, { over: 15_700, tax: 103 },
  { over: 15_800, tax: 110 }, { over: 15_900, tax: 117 }, { over: 16_000, tax: 124 },
  { over: 16_100, tax: 131 }, { over: 16_200, tax: 138 }, { over: 16_300, tax: 145 },
  { over: 16_400, tax: 152 }, { over: 16_500, tax: 159 }, { over: 16_600, tax: 166 },
  { over: 16_700, tax: 173 }, { over: 16_800, tax: 180 }, { over: 16_900, tax: 187 },
  { over: 17_000, tax: 194 }, { over: 17_100, tax: 201 }, { over: 17_200, tax: 208 },
  { over: 17_300, tax: 215 }, { over: 17_400, tax: 222 },
];

// joint/no_or_one_dependent — 44 taxed rows, ceiling $29,000.
const AR_JOINT_0_1: readonly LowIncomeTableRow[] = [
  { over: 24_695, tax: 77 }, { over: 24_700, tax: 87 }, { over: 24_800, tax: 98 },
  { over: 24_900, tax: 108 }, { over: 25_000, tax: 118 }, { over: 25_100, tax: 129 },
  { over: 25_200, tax: 139 }, { over: 25_300, tax: 150 }, { over: 25_400, tax: 160 },
  { over: 25_500, tax: 170 }, { over: 25_600, tax: 181 }, { over: 25_700, tax: 191 },
  { over: 25_800, tax: 202 }, { over: 25_900, tax: 212 }, { over: 26_000, tax: 222 },
  { over: 26_100, tax: 233 }, { over: 26_200, tax: 243 }, { over: 26_300, tax: 254 },
  { over: 26_400, tax: 264 }, { over: 26_500, tax: 274 }, { over: 26_600, tax: 285 },
  { over: 26_700, tax: 295 }, { over: 26_800, tax: 306 }, { over: 26_900, tax: 316 },
  { over: 27_000, tax: 326 }, { over: 27_100, tax: 337 }, { over: 27_200, tax: 347 },
  { over: 27_300, tax: 358 }, { over: 27_400, tax: 368 }, { over: 27_500, tax: 378 },
  { over: 27_600, tax: 389 }, { over: 27_700, tax: 399 }, { over: 27_800, tax: 410 },
  { over: 27_900, tax: 420 }, { over: 28_000, tax: 430 }, { over: 28_100, tax: 441 },
  { over: 28_200, tax: 451 }, { over: 28_300, tax: 462 }, { over: 28_400, tax: 472 },
  { over: 28_500, tax: 482 }, { over: 28_600, tax: 493 }, { over: 28_700, tax: 503 },
  { over: 28_800, tax: 514 }, { over: 28_900, tax: 524 },
];

// joint/two_or_more_dependents — 64 taxed rows, ceiling $36,100.
const AR_JOINT_2: readonly LowIncomeTableRow[] = [
  { over: 29_722, tax: 111 }, { over: 29_800, tax: 122 }, { over: 29_900, tax: 132 },
  { over: 30_000, tax: 143 }, { over: 30_100, tax: 153 }, { over: 30_200, tax: 163 },
  { over: 30_300, tax: 174 }, { over: 30_400, tax: 184 }, { over: 30_500, tax: 195 },
  { over: 30_600, tax: 205 }, { over: 30_700, tax: 215 }, { over: 30_800, tax: 226 },
  { over: 30_900, tax: 236 }, { over: 31_000, tax: 247 }, { over: 31_100, tax: 257 },
  { over: 31_200, tax: 267 }, { over: 31_300, tax: 278 }, { over: 31_400, tax: 289 },
  { over: 31_500, tax: 300 }, { over: 31_600, tax: 311 }, { over: 31_700, tax: 322 },
  { over: 31_800, tax: 333 }, { over: 31_900, tax: 343 }, { over: 32_000, tax: 354 },
  { over: 32_100, tax: 365 }, { over: 32_200, tax: 376 }, { over: 32_300, tax: 387 },
  { over: 32_400, tax: 398 }, { over: 32_500, tax: 409 }, { over: 32_600, tax: 420 },
  { over: 32_700, tax: 431 }, { over: 32_800, tax: 442 }, { over: 32_900, tax: 452 },
  { over: 33_000, tax: 463 }, { over: 33_100, tax: 474 }, { over: 33_200, tax: 485 },
  { over: 33_300, tax: 496 }, { over: 33_400, tax: 507 }, { over: 33_500, tax: 518 },
  { over: 33_600, tax: 529 }, { over: 33_700, tax: 540 }, { over: 33_800, tax: 551 },
  { over: 33_900, tax: 561 }, { over: 34_000, tax: 572 }, { over: 34_100, tax: 583 },
  { over: 34_200, tax: 594 }, { over: 34_300, tax: 605 }, { over: 34_400, tax: 616 },
  { over: 34_500, tax: 627 }, { over: 34_600, tax: 638 }, { over: 34_700, tax: 649 },
  { over: 34_800, tax: 660 }, { over: 34_900, tax: 670 }, { over: 35_000, tax: 681 },
  { over: 35_100, tax: 692 }, { over: 35_200, tax: 703 }, { over: 35_300, tax: 714 },
  { over: 35_400, tax: 725 }, { over: 35_500, tax: 736 }, { over: 35_600, tax: 747 },
  { over: 35_700, tax: 758 }, { over: 35_800, tax: 769 }, { over: 35_900, tax: 779 },
  { over: 36_000, tax: 790 },
];

// head_of_household/no_or_one_dependent — 45 taxed rows, ceiling $25,300.
const AR_HOH_0_1: readonly LowIncomeTableRow[] = [
  { over: 20_820, tax: 67 }, { over: 20_900, tax: 77 }, { over: 21_000, tax: 86 },
  { over: 21_100, tax: 95 }, { over: 21_200, tax: 105 }, { over: 21_300, tax: 114 },
  { over: 21_400, tax: 124 }, { over: 21_500, tax: 133 }, { over: 21_600, tax: 142 },
  { over: 21_700, tax: 152 }, { over: 21_800, tax: 161 }, { over: 21_900, tax: 171 },
  { over: 22_000, tax: 180 }, { over: 22_100, tax: 189 }, { over: 22_200, tax: 199 },
  { over: 22_300, tax: 208 }, { over: 22_400, tax: 218 }, { over: 22_500, tax: 227 },
  { over: 22_600, tax: 236 }, { over: 22_700, tax: 246 }, { over: 22_800, tax: 255 },
  { over: 22_900, tax: 265 }, { over: 23_000, tax: 274 }, { over: 23_100, tax: 283 },
  { over: 23_200, tax: 293 }, { over: 23_300, tax: 302 }, { over: 23_400, tax: 312 },
  { over: 23_500, tax: 321 }, { over: 23_600, tax: 330 }, { over: 23_700, tax: 340 },
  { over: 23_800, tax: 349 }, { over: 23_900, tax: 359 }, { over: 24_000, tax: 368 },
  { over: 24_100, tax: 377 }, { over: 24_200, tax: 387 }, { over: 24_300, tax: 396 },
  { over: 24_400, tax: 406 }, { over: 24_500, tax: 415 }, { over: 24_600, tax: 424 },
  { over: 24_700, tax: 434 }, { over: 24_800, tax: 443 }, { over: 24_900, tax: 453 },
  { over: 25_000, tax: 462 }, { over: 25_100, tax: 471 }, { over: 25_200, tax: 481 },
];

// head_of_household/two_or_more_dependents — 42 taxed rows, ceiling $29,000.
const AR_HOH_2: readonly LowIncomeTableRow[] = [
  { over: 24_818, tax: 94 }, { over: 24_900, tax: 107 }, { over: 25_000, tax: 119 },
  { over: 25_100, tax: 132 }, { over: 25_200, tax: 144 }, { over: 25_300, tax: 156 },
  { over: 25_400, tax: 169 }, { over: 25_500, tax: 181 }, { over: 25_600, tax: 194 },
  { over: 25_700, tax: 206 }, { over: 25_800, tax: 218 }, { over: 25_900, tax: 231 },
  { over: 26_000, tax: 243 }, { over: 26_100, tax: 256 }, { over: 26_200, tax: 268 },
  { over: 26_300, tax: 280 }, { over: 26_400, tax: 293 }, { over: 26_500, tax: 305 },
  { over: 26_600, tax: 318 }, { over: 26_700, tax: 330 }, { over: 26_800, tax: 342 },
  { over: 26_900, tax: 355 }, { over: 27_000, tax: 367 }, { over: 27_100, tax: 380 },
  { over: 27_200, tax: 392 }, { over: 27_300, tax: 404 }, { over: 27_400, tax: 417 },
  { over: 27_500, tax: 429 }, { over: 27_600, tax: 442 }, { over: 27_700, tax: 454 },
  { over: 27_800, tax: 466 }, { over: 27_900, tax: 479 }, { over: 28_000, tax: 491 },
  { over: 28_100, tax: 504 }, { over: 28_200, tax: 516 }, { over: 28_300, tax: 528 },
  { over: 28_400, tax: 541 }, { over: 28_500, tax: 553 }, { over: 28_600, tax: 566 },
  { over: 28_700, tax: 578 }, { over: 28_800, tax: 590 }, { over: 28_900, tax: 603 },
];

// surviving_spouse/no_or_one_dependent — 45 taxed rows, ceiling $25,300.
const AR_SURVIVOR_0_1: readonly LowIncomeTableRow[] = [
  { over: 20_820, tax: 67 }, { over: 20_900, tax: 77 }, { over: 21_000, tax: 86 },
  { over: 21_100, tax: 95 }, { over: 21_200, tax: 105 }, { over: 21_300, tax: 114 },
  { over: 21_400, tax: 124 }, { over: 21_500, tax: 133 }, { over: 21_600, tax: 142 },
  { over: 21_700, tax: 152 }, { over: 21_800, tax: 161 }, { over: 21_900, tax: 171 },
  { over: 22_000, tax: 180 }, { over: 22_100, tax: 189 }, { over: 22_200, tax: 199 },
  { over: 22_300, tax: 208 }, { over: 22_400, tax: 218 }, { over: 22_500, tax: 227 },
  { over: 22_600, tax: 236 }, { over: 22_700, tax: 246 }, { over: 22_800, tax: 255 },
  { over: 22_900, tax: 265 }, { over: 23_000, tax: 274 }, { over: 23_100, tax: 283 },
  { over: 23_200, tax: 293 }, { over: 23_300, tax: 302 }, { over: 23_400, tax: 312 },
  { over: 23_500, tax: 321 }, { over: 23_600, tax: 330 }, { over: 23_700, tax: 340 },
  { over: 23_800, tax: 349 }, { over: 23_900, tax: 359 }, { over: 24_000, tax: 368 },
  { over: 24_100, tax: 377 }, { over: 24_200, tax: 387 }, { over: 24_300, tax: 396 },
  { over: 24_400, tax: 406 }, { over: 24_500, tax: 415 }, { over: 24_600, tax: 424 },
  { over: 24_700, tax: 434 }, { over: 24_800, tax: 443 }, { over: 24_900, tax: 453 },
  { over: 25_000, tax: 462 }, { over: 25_100, tax: 471 }, { over: 25_200, tax: 481 },
];

// surviving_spouse/two_or_more_dependents — 42 taxed rows, ceiling $29,000.
const AR_SURVIVOR_2: readonly LowIncomeTableRow[] = [
  { over: 24_818, tax: 94 }, { over: 24_900, tax: 107 }, { over: 25_000, tax: 119 },
  { over: 25_100, tax: 132 }, { over: 25_200, tax: 144 }, { over: 25_300, tax: 156 },
  { over: 25_400, tax: 169 }, { over: 25_500, tax: 181 }, { over: 25_600, tax: 194 },
  { over: 25_700, tax: 206 }, { over: 25_800, tax: 218 }, { over: 25_900, tax: 231 },
  { over: 26_000, tax: 243 }, { over: 26_100, tax: 256 }, { over: 26_200, tax: 268 },
  { over: 26_300, tax: 280 }, { over: 26_400, tax: 293 }, { over: 26_500, tax: 305 },
  { over: 26_600, tax: 318 }, { over: 26_700, tax: 330 }, { over: 26_800, tax: 342 },
  { over: 26_900, tax: 355 }, { over: 27_000, tax: 367 }, { over: 27_100, tax: 380 },
  { over: 27_200, tax: 392 }, { over: 27_300, tax: 404 }, { over: 27_400, tax: 417 },
  { over: 27_500, tax: 429 }, { over: 27_600, tax: 442 }, { over: 27_700, tax: 454 },
  { over: 27_800, tax: 466 }, { over: 27_900, tax: 479 }, { over: 28_000, tax: 491 },
  { over: 28_100, tax: 504 }, { over: 28_200, tax: 516 }, { over: 28_300, tax: 528 },
  { over: 28_400, tax: 541 }, { over: 28_500, tax: 553 }, { over: 28_600, tax: 566 },
  { over: 28_700, tax: 578 }, { over: 28_800, tax: 590 }, { over: 28_900, tax: 603 },
];

/**
 * DFA's 2025 *Indexed Tax Brackets* card, transcribed row for row.
 *
 * Five rows for the regular table, thirty-one for the bracket-adjustment taper,
 * one for the gap between the taper's end and `$100,000`, and one for the top.
 * Nothing here is derived: the reductions are the card's own figures, which is
 * why they carry cents and why they are two to four cents short of the
 * accumulated tax of the bands beneath them. See this module's comment.
 *
 * The `$91.00` on the last row is the odd one and the card explains itself: for
 * `$100,001` and over it prints *"$3,809 plus 3.9% of the excess over
 * $100,000"*, and `0.039 x 100,000 - 3,809 = 91`. So the reduction **rises**
 * from `$89.30` to `$91.00` at `$100,001`, and an Arkansan earning one dollar
 * more than `$100,000` pays `$1.70` less than the row below would have charged
 * them. It is the only place in either year where more income means less tax by
 * more than a cent, and it is in the published card.
 */
const AR_CARD_2025: readonly RateLessReductionRow[] = [
    { upTo: 5599, rate: 0, reduction: 0 }, { upTo: 11_199, rate: 0.02, reduction: 111.98 },
    { upTo: 15_999, rate: 0.03, reduction: 223.97 }, { upTo: 26_399, rate: 0.034, reduction: 287.97 },
    { upTo: 94_700, rate: 0.039, reduction: 419.96 }, { upTo: 94_800, rate: 0.039, reduction: 399.3 },
    { upTo: 94_900, rate: 0.039, reduction: 389.3 }, { upTo: 95_000, rate: 0.039, reduction: 379.3 },
    { upTo: 95_100, rate: 0.039, reduction: 369.3 }, { upTo: 95_200, rate: 0.039, reduction: 359.3 },
    { upTo: 95_300, rate: 0.039, reduction: 349.3 }, { upTo: 95_400, rate: 0.039, reduction: 339.3 },
    { upTo: 95_500, rate: 0.039, reduction: 329.3 }, { upTo: 95_600, rate: 0.039, reduction: 319.3 },
    { upTo: 95_700, rate: 0.039, reduction: 309.3 }, { upTo: 95_800, rate: 0.039, reduction: 299.3 },
    { upTo: 95_900, rate: 0.039, reduction: 289.3 }, { upTo: 96_000, rate: 0.039, reduction: 279.3 },
    { upTo: 96_100, rate: 0.039, reduction: 269.3 }, { upTo: 96_200, rate: 0.039, reduction: 259.3 },
    { upTo: 96_300, rate: 0.039, reduction: 249.3 }, { upTo: 96_400, rate: 0.039, reduction: 239.3 },
    { upTo: 96_500, rate: 0.039, reduction: 229.3 }, { upTo: 96_600, rate: 0.039, reduction: 219.3 },
    { upTo: 96_700, rate: 0.039, reduction: 209.3 }, { upTo: 96_800, rate: 0.039, reduction: 199.3 },
    { upTo: 96_900, rate: 0.039, reduction: 189.3 }, { upTo: 97_000, rate: 0.039, reduction: 179.3 },
    { upTo: 97_100, rate: 0.039, reduction: 169.3 }, { upTo: 97_200, rate: 0.039, reduction: 159.3 },
    { upTo: 97_300, rate: 0.039, reduction: 149.3 }, { upTo: 97_400, rate: 0.039, reduction: 139.3 },
    { upTo: 97_500, rate: 0.039, reduction: 129.3 }, { upTo: 97_600, rate: 0.039, reduction: 119.3 },
    { upTo: 97_700, rate: 0.039, reduction: 109.3 }, { upTo: 97_800, rate: 0.039, reduction: 99.3 },
    { upTo: 100_000, rate: 0.039, reduction: 89.3 }, { upTo: Infinity, rate: 0.039, reduction: 91 },];

/**
 * Tax year 2026, from Act 1 of the 2026 First Extraordinary Session.
 *
 * **These rows are DERIVED and the derivation is the only one in this module.**
 * No *Indexed Tax Brackets* card has been published for 2026, so there is no
 * document to transcribe; what exists is § 26-51-201(a)(4)'s graduated table,
 * (a)(5)'s high-income table and the stepped bracket adjustment. Each row's
 * `reduction` is `rate x (the row's floor) - (the tax accumulated below it)`,
 * which is the identity that makes `rate x income - reduction` equal to the
 * statutory computation at every income.
 *
 * Because it is derived, it is checked two ways rather than asserted:
 *
 * - `test/arkansas.test.js` recomputes the statutory route independently — the
 *   graduated walk below `$94,700`, and 2% on `$4,700` plus 3.7% on the rest of
 *   the whole income less the adjustment above it — and compares the two at
 *   every dollar from `$0` to `$120,000`. They agree everywhere except where the
 *   product lands exactly on a half-cent, where the two forms of the same real
 *   number round apart by `$0.01`.
 * - and `policyengine-us` 2.15.3 holds the same thirty-five amounts, derived
 *   independently. See this module's comment.
 *
 * The thresholds did **not** move between the two years — `$5,600`, `$11,200`,
 * `$16,000`, `$26,400` are the 2025 figures unchanged, and § 26-51-201(d)(1)
 * indexes them. That is Act 1 setting them rather than this package carrying a
 * year forward, and it is why only the top rate and the reductions differ.
 */
const AR_ROWS_2026: readonly RateLessReductionRow[] = [
    { upTo: 5599, rate: 0, reduction: 0 }, { upTo: 11_199, rate: 0.02, reduction: 112 },
    { upTo: 15_999, rate: 0.03, reduction: 224 }, { upTo: 26_399, rate: 0.034, reduction: 288 },
    { upTo: 94_700, rate: 0.037, reduction: 367.2 }, { upTo: 94_800, rate: 0.037, reduction: 369.9 },
    { upTo: 94_900, rate: 0.037, reduction: 359.9 }, { upTo: 95_000, rate: 0.037, reduction: 349.9 },
    { upTo: 95_100, rate: 0.037, reduction: 339.9 }, { upTo: 95_200, rate: 0.037, reduction: 329.9 },
    { upTo: 95_300, rate: 0.037, reduction: 319.9 }, { upTo: 95_400, rate: 0.037, reduction: 309.9 },
    { upTo: 95_500, rate: 0.037, reduction: 299.9 }, { upTo: 95_600, rate: 0.037, reduction: 289.9 },
    { upTo: 95_700, rate: 0.037, reduction: 279.9 }, { upTo: 95_800, rate: 0.037, reduction: 269.9 },
    { upTo: 95_900, rate: 0.037, reduction: 259.9 }, { upTo: 96_000, rate: 0.037, reduction: 249.9 },
    { upTo: 96_100, rate: 0.037, reduction: 239.9 }, { upTo: 96_200, rate: 0.037, reduction: 229.9 },
    { upTo: 96_300, rate: 0.037, reduction: 219.9 }, { upTo: 96_400, rate: 0.037, reduction: 209.9 },
    { upTo: 96_500, rate: 0.037, reduction: 199.9 }, { upTo: 96_600, rate: 0.037, reduction: 189.9 },
    { upTo: 96_700, rate: 0.037, reduction: 179.9 }, { upTo: 96_800, rate: 0.037, reduction: 169.9 },
    { upTo: 96_900, rate: 0.037, reduction: 159.9 }, { upTo: 97_000, rate: 0.037, reduction: 149.9 },
    { upTo: 97_100, rate: 0.037, reduction: 139.9 }, { upTo: 97_200, rate: 0.037, reduction: 129.9 },
    { upTo: 97_300, rate: 0.037, reduction: 119.9 }, { upTo: 97_400, rate: 0.037, reduction: 109.9 },
    { upTo: 97_500, rate: 0.037, reduction: 99.9 }, { upTo: 97_600, rate: 0.037, reduction: 89.9 },
    // AND THIS IS WHERE THE TAPER ENDS — THIRTY-FIVE ROWS AND NOT THIRTY-SIX.
    //
    // The first draft of this schedule had one more row, `{ upTo: 97_700,
    // reduction: 79.9 }`, on the reasoning that § 26-51-201(a)(5)'s adjustment
    // table has thirty rows and the thirtieth is `$0` at `$97,600`. It does, and
    // that thirtieth row is not a row of the taper: an adjustment of ZERO is
    // the state of affairs for every income above `$97,600`, so it already
    // extends to infinity and a further unbounded row with the same reduction
    // merely duplicates it.
    //
    //   A REDUNDANT ROW IS A ROW NO PROBE CAN WITNESS, AND THAT IS HOW THIS ONE
    //   WAS FOUND — `test/step-probes.test.js` reported `rate.rows[34.upTo]` as
    //   a figure no pinned answer moves, because the boundary it marked lay
    //   between two rows charging the identical tax.
    //
    // `policyengine-us` 2.15.3 agrees and is the second reading: its 2026
    // reduction schedule ends at a threshold of `$97,601` with `79.9` and has
    // thirty-five rows, not thirty-six.
    { upTo: Infinity, rate: 0.037, reduction: 79.9 },
];

const AR_CITATIONS: readonly Citation[] = [
  {
    title:
      "A.C.A. § 26-51-201(a) — the individual income tax rate schedules. (a)(4) is the regular graduated table and (a)(5), added by Act 1 of the 2026 First Extraordinary Session, is the HIGH-INCOME table: for a filer whose net income exceeds the threshold, 2% on the first $4,700 and the top rate on every dollar above it, applied to the WHOLE net income, less a stepped bracket adjustment. Two schedules selected by income rather than by filing status, which is the structural fact about this state. (d)(1) indexes the bracket bounds for cost of living and does NOT index the adjustment's dollar amounts",
    url: 'https://law.justia.com/codes/arkansas/title-26/subtitle-5/chapter-51/subchapter-2/section-26-51-201/',
  },
  {
    title:
      'Arkansas Act 1 of 2026, First Extraordinary Session, § 1 — amends § 26-51-201(a)(4) and adds (a)(5), cutting the top individual rate from 3.9% to 3.7% retroactive to 1 January 2026 and printing the high-income table and the thirty-row bracket adjustment ($290 at $94,701 falling by $10 per $100 to $0 at $97,600). NOT OPENED FROM THIS SANDBOX: arkleg.state.ar.us does not resolve here. Established from the reference model\'s parameter files, which cite this act by name and reproduce its tables',
    url: 'https://www.arkleg.state.ar.us/Home/FTPDocument?path=%2FACTS%2F2026S1%2FPublic%2FACT1.pdf',
  },
  {
    title:
      "Arkansas Department of Finance and Administration, 2025 Indexed Tax Brackets — the card that governs tax year 2025: five rows of rate and \"minus adjustment\", the thirty-one-row taper from $94,701, and \"$3,809 plus 3.9% of the excess over $100,000\" at the top. Its reductions are the accumulated tax of the bands beneath measured ONE DOLLAR BELOW each bracket floor, so the card and the statute do not compute the same tax; the AR1000F instructions make the card binding — a formula's results \"must match the table\". NOT OPENED FROM THIS SANDBOX: dfa.arkansas.gov does not resolve here",
    url: 'https://www.dfa.arkansas.gov/wp-content/uploads/2025_TaxBrackets.pdf',
  },
  {
    title:
      'A.C.A. § 26-51-301 and the 2025 AR1000F and AR1000NR instructions, Low Income Tax Tables — seven tables of tax by state AGI and family size, taken IN LIEU of the standard or itemized deduction when they come out lower, with married filing separately barred from all of them. The exempt amounts are $14,643 single, $20,820 head of household or surviving spouse with no or one dependent, $24,695 joint with no or one, $24,818 head of household or surviving spouse with two or more and $29,722 joint with two or more; the ceilings are $17,500, $25,300, $29,000, $29,000 and $36,100. The implied marginal rates inside them are 7.00% to 12.40%',
    url: 'https://www.dfa.arkansas.gov/wp-content/uploads/2025_AR1000F_and_AR1000NR_Instructions.pdf',
  },
  {
    title:
      'A.C.A. § 26-51-430 — the standard deduction, $2,200 single and $4,400 joint as enacted in 2015 and indexed to CPI-U with the result ROUNDED DOWN to the nearest $10 since. $2,470 and $4,940 for 2025. Head of household, married filing separately and a qualifying surviving spouse all take the single figure, so Arkansas is a state where a single parent gets no larger deduction than a single filer',
    url: 'https://law.justia.com/codes/arkansas/title-26/subtitle-5/chapter-51/subchapter-4/section-26-51-430/',
  },
  {
    title:
      'A.C.A. § 26-51-501 — the personal tax credits: $29 for each filer, $29 for each dependent, an ADDITIONAL $29 for each filer 65 or over and for each who is blind or deaf, and $500 for each dependent with a developmental disability. CREDITS and not exemptions, and nonrefundable. $29 is below the mutation harness\'s perturbation floor and therefore has no mutant at all, which is why this module\'s test asserts it by hand',
    url: 'https://law.justia.com/codes/arkansas/title-26/subtitle-5/chapter-51/subchapter-5/section-26-51-501/',
  },
  {
    title:
      'A.C.A. § 26-51-307 — the retirement and disability benefits exemption, $6,000 per recipient of employment-related pension and IRA distribution income, at ANY AGE. Not indexed since 1997. Act 141 of 2017 exempts military retired pay in full from tax year 2018, outside the $6,000',
    url: 'https://law.justia.com/codes/arkansas/title-26/subtitle-5/chapter-51/subchapter-3/section-26-51-307/',
  },
  {
    title:
      'A.C.A. § 26-51-815(a) — 50% of net long-term capital gain is exempt from Arkansas income tax, and gain above $10,000,000 on a single transaction is exempt in full. The 50% share is the highest flat capital-gains exclusion in this package and it is NOT modelled here: `netCapitalGain` cannot tell a long-term gain from a short-term one',
    url: 'https://law.justia.com/codes/arkansas/title-26/subtitle-5/chapter-51/subchapter-8/section-26-51-815/',
  },
  {
    title:
      'The Additional Tax Credit for Qualified Individuals — $60 a filer ($120 on a joint return) where net taxable income is at or below $26,500, reduced by $5 for each $100 above it and gone at $27,700. A fourth staircase on an Arkansas return, and the successor to the 2022 and 2023 inflationary relief credit',
    url: 'https://www.dfa.arkansas.gov/wp-content/uploads/2025_AR1000F_and_AR1000NR_Instructions.pdf',
  },
];

/**
 * The 2026 lead note. Arkansas's RATE side is published law for 2026 — Act 1 of
 * the 2026 First Extraordinary Session prints the schedule, the high-income
 * table and all thirty rows of the bracket adjustment — and its INDEXED side is
 * not, because DFA publishes that on a card and in the AR1000F instructions and
 * neither has appeared for 2026.
 */
const AR_PROVISIONAL_2026 =
  'PROVISIONAL, and the division is unusually clean: every RATE figure for 2026 is published law and every INDEXED figure is carried forward from 2025. Act 1 of the 2026 First Extraordinary Session prints the graduated schedule (0%, 2%, 3%, 3.4%, 3.7% at $5,600, $11,200, $16,000 and $26,400), the high-income table (2% on the first $4,700 and 3.7% above, on the whole net income) and all thirty rows of the bracket adjustment, so nothing on the rate side is a guess. What has not been published is the standard deduction, which § 26-51-430 indexes to CPI-U rounded DOWN to $10, the seven Low Income Tax Tables and their exempt amounts, which § 26-51-301 indexes, and the $26,500 threshold of the additional tax credit. The deduction exposure is the smallest in this package — one indexation step is $60 to $80 of deduction and $2.22 to $2.96 of tax — and the low-income tables are the larger one, in the other direction: an unindexed table charges a 2026 household whose income rose with inflation more rows than the real table will, so an Arkansas answer here is TOO HIGH for a low-income 2026 return by up to about $60.';

const AR_NOTES: readonly string[] = [
  "ARKANSAS'S HIGHEST MARGINAL RATE IS 13.70%, AND IT IS NOT IN ARKANSAS'S RATE SCHEDULE. A.C.A. § 26-51-201 has TWO schedules selected by income: a filer whose net taxable income does not exceed $94,700 pays the graduated table, and a filer one dollar above it pays 2% on the first $4,700 plus the top rate on every dollar above that, applied to their WHOLE net income, less a bracket adjustment of $290 that falls by $10 for each further $100 of income. A $10 relief withdrawn per $100 earned is ten percentage points of marginal rate, so the band from $94,701 to $97,600 is taxed at 13.70% in 2026 and the 2025 band from $94,701 to $97,800 at 13.90% — against top statutory rates of 3.7% and 3.9%. Nothing in any published Arkansas bracket table contains either figure.",
  'AND THE BRACKET ADJUSTMENT IS A STAIRCASE OF THIRTY CLIFFS RATHER THAN A SLOPE. Its rows are $100 wide and its amounts are whole dollars, so the tax steps rather than rises: $10 of Arkansas tax arrives on one cent of income, 29 times in 2026 and 31 times in 2025. A provision written to stop a cliff at $94,700 is itself thirty smaller cliffs. In 2026 it also OVERSHOOTS: the tax at $94,700 is $3,136.70 and at $94,701 it is $3,134.04, so one dollar of extra income CUTS the bill by $2.66, where the 2025 card undershoots the same join by $20.70. The provision changed sign between the two years and no act changed it — the 2026 amount is Act 1 of 2026\'s and the 2025 one is the Department of Finance and Administration\'s.',
  'A MODEL BUILT FROM ARKANSAS\'S PUBLISHED BRACKET TABLE ALONE IS TOO LOW BY A FLAT $287.30 FOR EVERY FILER ABOVE THE ADJUSTMENT BAND. Every account of this state prints the graduated schedule — 0%, 2%, 3%, 3.4%, 3.7% at $5,600, $11,200, $16,000 and $26,400 — and stops there. Above $97,600 the high-income table has taken over and the bracket adjustment has reached zero, so the two routes differ by the whole adjustment and the error does not depend on income: it is $287.30 at $100,000 and $287.30 at $10,000,000. The 2025 card needs TWO figures rather than one — $330.70 from $97,801 to $100,000 and $329.00 above $100,001 — because for $100,001 and over DFA prints "$3,809 plus 3.9% of the excess over $100,000", a reduction of $91.00 where the row beneath carries $89.30, so an Arkansan earning one dollar more than $100,000 pays $1.70 LESS. `tools/cross-package/arkansas-bracket-adjustment.mjs` asserts all three figures, the 13.70% slope and the direction on every push.',
  "THE LOW INCOME TAX TABLES CHARGE THE POOREST ARKANSANS UP TO 12.40%, WHICH IS 3.37 TIMES THE STATE'S TOP RATE. § 26-51-301 and the AR1000F instructions give seven tables of tax by state AGI and family size, taken IN LIEU of the standard or itemized deduction whenever they come out lower. Below an exempt amount the tax is nothing — $14,643 for a single filer, $29,722 for a couple with two or more dependents — and above it the table's own implied marginal rate is 7.00% single, 9.40% head of household with no or one dependent, 10.40% joint with no or one, 10.77% joint with two or more and 12.40% HEAD OF HOUSEHOLD WITH TWO OR MORE. The steepest rate in the Arkansas income tax is charged to a single parent of two earning between $24,818 and $29,000. All five figures are measured from the tables in `test/arkansas.test.js` rather than stated.",
  'AND THE TABLES ARE READ ON STATE AGI, NOT ON TAXABLE INCOME, BECAUSE THEY REPLACE THE DEDUCTION. A model that looks the table up on income after the standard deduction understates every household that uses it: $2,470 of deduction is 24 of a single filer\'s 29 taxed rows. This package computes both routes and takes the lower, which is what the reference model does; the instructions phrase it as an eligibility test instead, and the two agree because the table is below the schedule wherever it reaches. MARRIED FILING SEPARATELY IS BARRED FROM ALL SEVEN TABLES, so a separated Arkansan at $14,000 of AGI pays tax on $14,000 less $2,470 where a single filer at the same income pays nothing at all.',
  "THE TABLES ARE STAIRCASES TOO, AND SO IS THE ADDITIONAL TAX CREDIT, WHICH MAKES FOUR ON ONE RETURN. The low-income rows are $100 wide with whole-dollar amounts, so $4 to $13 of tax arrives on one dollar of income between 28 and 63 times per table. The Additional Tax Credit for Qualified Individuals is $60 ($120 joint) at or below $26,500 of net taxable income, withdrawn by $5 for each $100 \"OR PART OF\" $100 above it — the ceiling, not the quotient, so it is twelve steps of $5 rather than a 5% phase-out, and gone at $27,700. Counting the 2025 rate card's own thirty-one-row reduction taper, an Arkansas return has something over three hundred incomes at which one more dollar costs between $4 and $13.",
  "ARKANSAS'S PUBLISHED RATE CARD AND ARKANSAS'S STATUTE DO NOT COMPUTE THE SAME TAX, AND THE DIFFERENCE IS THE ROW'S RATE ON ONE DOLLAR. For 2025 the tax is the row's rate on all net taxable income minus the row's \"minus adjustment\", and those adjustments are $111.98, $223.97, $287.97 and $419.96 where the accumulated tax of the bands beneath is $112.00, $224.00, $288.00 and $420.00. Each shortfall is exactly the row's rate applied to one dollar: 0.02 x 5,599 = 111.98 and 0.039 x 26,399 - 609.60 = 419.96. The card is anchored one dollar below each bracket floor, so EVERY Arkansan above $5,600 pays the graduated statutory tax plus two to four cents. The instructions settle which governs — a formula's results \"must match the table\" — so the cents are real, and the reference model agrees: policyengine-us carried the round figures as late as 2.15.3 and replaced them with the card's by 2.68.0.",
  'THE RETIREMENT EXEMPTION HAS NO AGE TEST AND HAS NOT MOVED SINCE 1997. § 26-51-307 exempts $6,000 per recipient of employment-related pension and IRA distribution income at ANY age, and nothing indexes it; a 45-year-old Arkansan with a $20,000 pension exempts $6,000 of it. It is claimed PER PERSON on the recipient\'s own income, so pass `retirement.filer` and `retirement.spouse` separately — a couple whose $12,000 of pension is all in one name exempts $6,000 and the same couple with $6,000 each exempts the lot. Military retired pay is exempt IN FULL from tax year 2018 under Act 141 of 2017 and does NOT consume the $6,000, which is Oklahoma\'s treatment and not South Carolina\'s.',
  'NOT MODELLED — THE "65 SPECIAL" SECOND AGED CREDIT, AND IT IS AN ELECTION RATHER THAN AN OMISSION. § 26-51-501 gives a filer of 65 or over a second $29 personal credit ONLY IF they did not use the $6,000 retirement exemption, which the AR1000F prints as a box of its own. So an elderly Arkansan with a pension chooses between $6,000 of exemption and $29 of credit, and the choice turns at $783.78 of pension income: below it the credit is worth more. This package allows the credit only where no retirement exemption is claimed, which is what the reference model does and which does NOT optimise the election — so an Arkansas figure from here is TOO HIGH by up to $28.96, for a filer of 65 with a trivial pension, and by nothing for anybody else. Supplying the pension through `subtractions` rather than `retirement` elects the credit.',
  'FIFTY PER CENT OF NET LONG-TERM CAPITAL GAIN IS EXEMPT, WHICH IS THE LARGEST FLAT CAPITAL-GAINS EXCLUSION IN THIS PACKAGE — North Dakota excludes 40%, South Carolina 44%, Wisconsin 30%. § 26-51-815(a) and the AR1000D worksheet exempt half the excess of net long-term capital gain over net short-term capital LOSS, and add short-term GAIN back in full, so the exclusion reaches the long-term half only: pass `netCapitalGain` and `shortTermCapitalGains` separately or a short-term gain is exempted that Arkansas taxes. $100,000 of long-term gain is $50,000 of exemption and $1,850.00 of 2026 tax. WHAT IS NOT MODELLED ALONGSIDE IT: gain above $10,000,000 on a SINGLE TRANSACTION is exempt in full under the same subsection, which needs a per-transaction figure rather than an annual total, and the statutory cap on a deductible net capital LOSS.',
  'ALSO NOT MODELLED, and each would REDUCE an Arkansas return computed here: the child and dependent care credit of 20% of the federal credit; the $29 credit for a DEAF filer, which no field here carries; the $500 credit for a dependent with a developmental disability, likewise; the post-secondary tuition deduction; and the credit for taxes paid to another state. Supply deductions through `subtractions`.',
  "ARKANSAS ITEMIZED DEDUCTIONS ARE NOT MODELLED AND THE ELECTION IS NOT LOCKED TO THE FEDERAL ONE. Arkansas allows itemizing independently of the federal return — unlike Oklahoma, which forces the two to match — and its own Schedule AR3 disallows state income taxes and limits several categories differently from Schedule A. `stateItemizedDeductions` is not read for Arkansas, so a filer who would itemize is computed here on the $2,470 or $4,940 standard deduction instead, and their Arkansas figure from here is TOO HIGH by the excess at their marginal rate.",
  'THE STANDARD DEDUCTION IS $2,470 FOR EVERY STATUS BUT JOINT, WHICH GETS $4,940 — AND A SINGLE PARENT GETS NO MORE THAN A SINGLE FILER. § 26-51-430 set $2,200 and $4,400 in 2015 and indexes them to CPI-U with the result ROUNDED DOWN to the nearest $10, which is why the figures are $2,470 and $4,940 and not a round number. Head of household, married filing separately and a qualifying surviving spouse all take the single amount. It is the second smallest standard deduction among the states in this package that HAVE one — Mississippi\'s $2,300 is smaller and thirteen states allow none at all — and roughly a sixth of the federal one, which is the arithmetic that makes Arkansas\'s own low-income tables matter: they are worth more than the deduction to every household they reach.',
  "ARKANSAS TAXES INTEREST ON OTHER STATES' MUNICIPAL BONDS AND EXEMPTS ITS OWN, so an Arkansan holding out-of-state bonds owes Arkansas tax on income THE FEDERAL RETURN NEVER SAW. Pass `outOfStateMunicipalInterest` rather than `taxExemptInterest`: the Arkansas/elsewhere split exists on no federal form and cannot be derived from anything else here, and taking the whole of tax-exempt interest would tax an Arkansan on Arkansas bonds. Omitted, an Arkansas bondholder is too LOW by 3.7% of the out-of-state part — $370.00 on $10,000 — which is the direction this package errs in almost nowhere else. The AR1000ADJ line number for an individual return could not be read from this sandbox; what is established is the rule, from Arkansas's own taxpayer guidance and from the corporate schedule AR1100ADJ, which carries the addition as a line of its own.",
  'NO CITY, COUNTY OR SCHOOL DISTRICT IN ARKANSAS LEVIES AN INCOME TAX. The state figure is the whole of an Arkansas resident\'s income tax, so `locality` is never required and `SUPPORTED_LOCALITIES` names none here.',
  'ARKANSAS TAXES TIPS AND OVERTIME THAT THE FEDERAL GOVERNMENT NOW EXEMPTS. AR1000F starts from federal gross income rather than federal AGI and Arkansas has legislated no subtraction for the four OBBBA Schedule 1-A deductions — § 224 tips, § 225 overtime, § 151(d)(5) senior and § 163(h)(4) vehicle loan interest — so none of them reaches an Arkansas return. A tipped Arkansas worker with $8,000 of qualified tips pays Arkansas $296.00 in 2026 on income the federal return exempted entirely.',
  "ARKANSAS'S RATE COULD FALL AGAIN AND NOTHING HERE PROJECTS IT. The top individual rate has been cut in each of 2022, 2023, 2024 and 2026 — 5.9% to 4.9% to 4.7% to 3.9% to 3.7% — by four separate acts, two of them in extraordinary sessions called for the purpose. This package ships the schedule Act 1 of 2026 prints. A 2027 Arkansas figure is an act that has not passed, not an indexation that can be computed.",
];

export function arkansas(year: number): StateIncomeTaxDefinition | undefined {
  if (year !== 2025 && year !== 2026) return undefined;
  return {
    code: 'AR',
    name: 'Arkansas',
    year,
    // 2026 IS PROVISIONAL AND 2025 IS NOT, and the reason is one figure. Act 1
    // of 2026 printed the rate schedule, the high-income table and the bracket
    // adjustment, so the whole of the rate side is published law for both
    // years. What is not published is the INDEXED side: § 26-51-430 ties the
    // standard deduction to CPI-U rounded down to $10 and § 26-51-301 indexes
    // the low-income tables and their exempt amounts, and no 2026 figures for
    // either have been released. They are carried forward from 2025 and
    // declared below.
    status: year === 2026 ? 'provisional' : 'published',
    provisionalFigures:
      year === 2026
        ? [
            {
              path: 'deduction.amounts',
              reason: 'awaiting-publication',
              carriedForwardFrom: 2025,
              resolvedBy:
                "Arkansas DFA's 2026 Indexed Tax Brackets card, or the 2026 AR1000F instructions. § 26-51-430 indexes the $2,200/$4,400 of 2015 to CPI-U and rounds the result DOWN to the nearest $10, which gave $2,470/$4,940 for 2025. One indexation step is $60 to $80 of deduction here, which is $2.22 to $2.96 of tax — the smallest provisional exposure of any state in this package, because the deduction itself is the second smallest.",
            },
            {
              path: 'lowIncomeTaxTable.byStatus',
              reason: 'awaiting-publication',
              carriedForwardFrom: 2025,
              resolvedBy:
                "Arkansas DFA's 2026 AR1000F instructions, Low Income Tax Tables. All seven tables and their exempt amounts are indexed to CPI-U under § 26-51-301 and the 2025 tables are carried forward here. The exposure is larger than the deduction's and runs the other way: an unindexed table charges a household whose income rose with inflation more rows than the real 2026 table would, so an Arkansas answer from here is TOO HIGH for a low-income 2026 household by up to roughly one indexation step of rows — about $60 of tax on a joint return with two or more dependents.",
            },
            {
              path: 'additionalTaxCredit.start',
              reason: 'awaiting-publication',
              carriedForwardFrom: 2025,
              resolvedBy:
                "Arkansas DFA's 2026 AR1000F instructions. The $26,500 threshold of the Additional Tax Credit for Qualified Individuals is carried forward from 2025; the $60 and the $5 step are not indexed by anything and are statutory.",
            },
          ]
        : undefined,
    // ARKANSAS DOES NOT ACTUALLY START FROM FEDERAL AGI, AND THE NOTE BELOW SAYS
    // SO AND PRICES IT. AR1000F builds Arkansas gross income from its own lines
    // — eleven of them — rather than importing line 11 of the 1040, and the
    // state's own adjustments follow on AR1000ADJ. Federal AGI less the
    // federally taxable part of a Social Security benefit is the same figure for
    // a household whose only above-the-line items Arkansas also allows, which is
    // every household in this package's differential grid and the great
    // majority of returns. It is declared as the federal base rather than
    // `stateDefined` because the alternative is a required input field that no
    // federal return carries and that would make the state uncallable from one.
    base: 'federalAdjustedGrossIncome',
    // Arkansas does not tax a Social Security benefit at all, and the
    // distinction from "subtracts it" is worth keeping: the benefit is not on
    // the AR1000F's list of gross income sources, so it was never in the base
    // to be taken out. The flag reaches the same figure from the other side.
    subtractsTaxableSocialSecurity: true,
    rate: {
      kind: 'rateLessReduction',
      name:
        year === 2025
          ? 'Arkansas regular income tax (DFA 2025 Indexed Tax Brackets card)'
          : 'Arkansas income tax (A.C.A. § 26-51-201(a)(4) and (a)(5), Act 1 of 2026)',
      rows: year === 2025 ? AR_CARD_2025 : AR_ROWS_2026,
    },
    // § 26-51-430. $2,200/$4,400 of 2015, indexed to CPI-U and ROUNDED DOWN to
    // the nearest $10 — which is why the figures are not round. Head of
    // household, married filing separately and a qualifying surviving spouse all
    // take the SINGLE amount: Arkansas gives a single parent no more deduction
    // than a single filer, and hands them the larger figure through the
    // low-income tables and the personal credits instead.
    deduction: {
      kind: 'table',
      // `qualifyingSurvivingSpouse` IS PASSED EXPLICITLY AND HAS TO BE.
      // `byStatus` defaults the cell to the JOINT value, and the first draft of
      // this module left it out — so a surviving spouse got $4,940 where
      // § 26-51-430 gives them the single filer's $2,470, worth $91.39 of 2026
      // tax. It is the Day 63 Iowa defect in a different field: a per-status
      // figure whose statute does not follow the obvious default, in a cell
      // nothing but a hand-written assertion reads.
      amounts: byStatus({
        single: 2_470,
        joint: 4_940,
        separate: 2_470,
        headOfHousehold: 2_470,
        qualifyingSurvivingSpouse: 2_470,
      }),
    },
    lowIncomeTaxTable: {
      name: 'Arkansas Low Income Tax Table (§ 26-51-301, AR1000F line 30)',
      // MARRIED FILING SEPARATELY IS BARRED FROM ALL SEVEN TABLES. There is no
      // separate-return low-income table in the instructions at all, which is
      // not an omission: the exempt amounts are per return and a couple that
      // split one would claim two of them.
      ineligibleFilingStatuses: ['marriedFilingSeparately'],
      secondTableFromDependents: 2,
      byStatus: byStatusOf({
        // A single filer's table has no second half, because a single filer
        // with a dependent is a head of household in Arkansas.
        single: { rows: AR_SINGLE, ceiling: 17_500 },
        joint: {
          rows: AR_JOINT_0_1,
          ceiling: 29_000,
          withDependents: AR_JOINT_2,
          ceilingWithDependents: 36_100,
        },
        // EMPTY, AND NOT THE SINGLE TABLE. Arkansas publishes no
        // separate-return low-income table at all and bars the status from the
        // other seven, so there is nothing to store. The first draft of this
        // module gave the cell `AR_SINGLE` for tidiness and that was worse than
        // wrong, it was invisible: `byStatusOf` would have handed the single and
        // separate cells THE SAME ARRAY, so the witness guard's perturbation of
        // one was a perturbation of both and a single filer's household
        // "witnessed" a cell no separate filer can reach. An empty table makes
        // the unreachability explicit and sends it to
        // NOT_REACHABLE_BY_ANY_HOUSEHOLD, where it can be argued with.
        separate: { rows: [], ceiling: 0 },
        headOfHousehold: {
          rows: AR_HOH_0_1,
          ceiling: 25_300,
          withDependents: AR_HOH_2,
          ceilingWithDependents: 29_000,
        },
        // Byte for byte the head-of-household pair. The instructions print four
        // tables and this package stores four: a relation visible in a table is
        // not a relation the instructions state, and `test/arkansas.test.js`
        // asserts the identity as an observation rather than using it to halve
        // the data.
        qualifyingSurvivingSpouse: {
          rows: AR_SURVIVOR_0_1,
          ceiling: 25_300,
          withDependents: AR_SURVIVOR_2,
          ceilingWithDependents: 29_000,
        },
      }),
    },
    exemptionCredit: {
      name: 'Arkansas personal tax credits (§ 26-51-501, AR1000F line 31)',
      // $29 A HEAD, PLUS ONE MORE FOR A HEAD OF HOUSEHOLD OR A SURVIVING
      // SPOUSE. The additional credit is a property of the FILING STATUS and
      // not of a person, so a single parent claims two credits with one person
      // on the return — Iowa's shape rather than Oklahoma's, and for the same
      // reason stored `byStatus` rather than `perPerson`: the figure is not a
      // count of people.
      perFiler: byStatus({
        single: 29,
        joint: 58,
        separate: 29,
        headOfHousehold: 58,
        qualifyingSurvivingSpouse: 58,
      }),
      perDependent: 29,
      // A SECOND whole credit at 65, not an increment of a different size.
      perSeniorFiler: 29,
      seniorAge: 65,
      // And a third for a blind filer, which stacks with the age one. Arkansas
      // also gives one for a DEAF filer and no field here carries deafness; see
      // the notes for the price.
      perBlindOrDisabledFiler: 29,
    },
    additionalTaxCredit: {
      name: 'Arkansas additional tax credit for qualified individuals (AR1000F line 32)',
      // EVERY CELL EXPLICIT, INCLUDING THE SURVIVING SPOUSE, AND THE REASON IS
      // THAT THE DEFAULT WAS WRONG HERE TWICE.
      //
      // `byStatus` writes `qualifyingSurvivingSpouse: v.qualifyingSurvivingSpouse
      // ?? v.joint`, so leaving the cell out gives a surviving spouse the JOINT
      // figure. The instructions double this credit for a joint return and for
      // nothing else — the reference model gates it on `filing_status == JOINT`
      // by name — so the default handed a widow $120 and a $10 withdrawal step
      // where Arkansas gives her $60 and $5. THE DIFFERENTIAL GRID CAUGHT IT:
      // two households off by exactly $59.97 and $58.30, both of them surviving
      // spouses at $26,000.
      //
      //   `byStatus` DEFAULTS THE SURVIVING-SPOUSE CELL TO THE JOINT ONE, AND
      //   THAT DEFAULT WAS WRONG THREE TIMES IN THIS ONE MODULE — here, in the
      //   withdrawal step below, and in the standard deduction above.
      //
      // Three instances in one state is not three slips; it is a default that
      // suits most states and suits Arkansas in none of its by-status tables,
      // because Arkansas's statutes single out the JOINT return rather than the
      // married couple. So every cell in this module is written out.
      maximum: byStatus({
        single: 60,
        joint: 120,
        separate: 60,
        headOfHousehold: 60,
        qualifyingSurvivingSpouse: 60,
      }),
      start: byStatus({
        single: 26_500,
        joint: 26_500,
        separate: 26_500,
        headOfHousehold: 26_500,
        qualifyingSurvivingSpouse: 26_500,
      }),
      increment: 100,
      withdrawalPerIncrement: byStatus({
        single: 5,
        joint: 10,
        separate: 5,
        headOfHousehold: 5,
        qualifyingSurvivingSpouse: 5,
      }),
    },
    // ARKANSAS TAXES OTHER STATES' MUNICIPAL BOND INTEREST AND EXEMPTS ITS OWN,
    // and this was a real gap rather than a declared one.
    //
    // The first draft of this module had no add-back at all, and the
    // differential grid is what found it: `muni-retiree-AR` differed from the
    // reference by $360.96, which is $10,000 of bond interest at 3.9% less the
    // $29 credit it displaced, and the arithmetic reconciled to the cent once
    // the addition and the 65-Special credit were both accounted for. A missing
    // ADDITION is the one class of gap this package's own notes cannot catch,
    // because an unmodelled addition makes the answer too LOW and the notes are
    // written to warn about answers that are too high.
    outOfStateMunicipalInterestAddition: {
      cite:
        "Arkansas's own taxpayer guidance: interest on obligations of the United States and of Arkansas and its municipalities is exempt, and interest on ANOTHER state's municipal bonds is taxable to an Arkansas resident. The corporate schedule AR1100ADJ carries the same addition on a line of its own — \"Non-Arkansas municipal bond interest income\" — which is the clearest printed statement of the rule available from here. NOT OPENED FROM THIS SANDBOX: dfa.arkansas.gov does not resolve, so the AR1000ADJ LINE NUMBER for an individual return is unread and is deliberately not cited; what is established is the rule and not the line. The reference model reaches the same answer by including the whole of tax-exempt interest in Arkansas gross income with no in-state carve-out. Pass `outOfStateMunicipalInterest` and not `taxExemptInterest`: the Arkansas/elsewhere split exists on no federal form, and taking the whole of tax-exempt interest would tax an Arkansan on Arkansas bonds. Omitted, an Arkansas bondholder is too LOW by 3.7% of the out-of-state part — $370.00 on $10,000.",
      measure: 'interest',
      netOfExpenses: false,
    },
    // § 26-51-815(a) — 50% OF NET LONG-TERM CAPITAL GAIN, and the largest flat
    // capital-gains exclusion in this package.
    //
    // The first draft of this module declared it NOT MODELLED, on the grounds
    // that `netCapitalGain` cannot tell a long-term gain from a short-term one.
    // That was true of the field and false of the package: `longTermNetted` is
    // a basis this rule already has, North Dakota and South Carolina already
    // reach it, and the engine computes it from the two gain fields rather than
    // from one. THE DIFFERENTIAL GRID IS WHAT REFUSED THE DECLARATION —
    // `investor-AR` differed from the reference by $1,978.00, which is half of
    // $100,000 at 3.9% plus the credits it displaced, and a gap that size is
    // not a gap, it is a missing rule.
    //
    //   A PROVISION DECLARED UNMODELLABLE BECAUSE OF AN INPUT CAN BE MODELLABLE
    //   THROUGH A DIFFERENT INPUT, AND THE ONLY INSTRUMENT THAT ARGUES THE
    //   POINT IS THE ONE THAT COMPUTES THE WHOLE RETURN.
    capitalGainsSubtraction: {
      name: 'Arkansas net long-term capital gain exclusion (50%)',
      share: 0.5,
      // THE FIFTH STATE IN THIS RULE AND THE THIRD TO REACH THIS BASIS BY ITS
      // OWN WORDS, after North Dakota's § 57-38-30.3(2)(d)(1). The AR1000D
      // worksheet writes the arithmetic out line by line — long-term gain on
      // lines 1 to 3, net short-term LOSS on lines 4 to 6, their difference on
      // line 7a — which is IRC § 1222(11) spelled out rather than
      // cross-referenced, so an amendment to § 1222(11) would move South
      // Carolina's base and leave Arkansas's and North Dakota's where they are.
      basis: { kind: 'longTermNetted' },
      cite:
        'A.C.A. § 26-51-815(a) and the AR1000D worksheet — 50% of the excess of net long-term capital gain over net short-term capital loss is exempt, and SHORT-TERM gain is added back in full on lines 9 to 11, so the exclusion reaches the long-term half only. The highest flat capital-gains exclusion in this package: North Dakota excludes 40%, Wisconsin 30%, South Carolina 44%. NOT MODELLED ALONGSIDE IT: gain above $10,000,000 on a single transaction is exempt IN FULL under the same subsection, which no household in this package\'s differential grid reaches and which would need a per-transaction field rather than an annual total; and the statute caps a deductible net capital LOSS, which this package does not model either.',
    },
    retirementIncomeSubtractions: [
      {
        name: 'Arkansas retirement and disability benefits exemption (§ 26-51-307)',
        exemptInFullName: 'Arkansas military retirement exclusion (100%, Act 141 of 2017)',
        // Per recipient and unused room is lost: a couple's $12,000 is two
        // claims of $6,000 and not one of $12,000.
        scope: 'perPerson',
        // NO AGE TEST, which Arkansas shares with Oklahoma alone in this
        // package and which published guides most often get wrong about it.
        // Neither `minimumAge` nor `cappedMinimumAge` is set.
        cap: 6_000,
        // Act 141 of 2017 exempts military retired pay in full from tax year
        // 2018 and nothing reduces the $6,000 by it — Oklahoma's construction,
        // and the one South Carolina's § 12-6-1170(C)(1) forbids.
        militaryExemptOutsideCap: true,
      },
    ],
    notes: year === 2026 ? [AR_PROVISIONAL_2026, ...AR_NOTES] : AR_NOTES,
    citations: AR_CITATIONS,
  };
}
