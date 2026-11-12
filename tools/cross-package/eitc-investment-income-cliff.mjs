#!/usr/bin/env node
/**
 * The § 32(i) investment-income cliff, measured in both packages at once.
 *
 * ## Why this exists
 *
 * § 32(i) bars the earned income credit outright above a ceiling on
 * **disqualified income**. Not a phase-out — one cent over and the whole credit
 * is gone. § 32(i)(2) lists five components:
 *
 * ```text
 *   (A)  interest and dividends includible in gross income
 *   (B)  interest exempt from tax                            <- Form 1040 line 2a
 *   (C)  net rent and royalty income
 *   (D)  capital gain net income
 *   (E)  net passive income other than from a trade or business
 * ```
 *
 * `us-federal-tax` holds (B) and (D) by name, as `taxExemptInterest` and
 * `longTermCapitalGains`. **Until Day 78 the default tested (D) alone**, so
 * $500,000 of municipal interest beside a $20,000 wage still paid the full
 * $7,152 two-child credit for 2025 — the credit handed to a filer the statute
 * bars, which is the permissive direction and the one this repository treats as
 * the expensive one. Nineteen state credits computed as a percentage of that
 * figure inherited it.
 *
 * ## Why the state note does not quote the dollar ceiling, and this file does
 *
 * Nineteen states match the federal credit, so nineteen state note lists would
 * otherwise carry a federal parameter. The shipped note therefore describes the
 * mechanism and prices it from the credit the caller passed, and says "a limit
 * near $12,000" rather than a figure. **The figure lives in one package and is
 * checked against the other here**, which is the same arrangement
 * `arizona-deduction.mjs` makes for a number that is right for a reason owned
 * elsewhere.
 *
 * ## What it checks
 *
 * Nothing below is hard-coded except the statutory citations in this prose.
 * Every figure is computed from one of the two packages.
 *
 *   1. The limit is a CLIFF in the federal package: at the limit the credit is
 *      positive, a cent above it the credit is zero and the reason given is
 *      `investmentIncomeTooHigh`.
 *   2. Tax-exempt interest counts, capital gain counts, and what is tested is
 *      their SUM — so a filer at half the limit in each is barred.
 *   3. An explicit `disqualifiedInvestmentIncome` still overrides the default,
 *      in both directions.
 *   4. In every state whose credit is a percentage of the federal one, the
 *      state credit really does go to zero across that one cent, and the size
 *      of the drop is the state's match rate times the federal credit.
 *   5. The shipped state note says so, in the state's own result object, and
 *      the figure in its prose is the figure the engine computed. **That is the
 *      join Day 77 asked for**: a note's body checked against a number rather
 *      than against its own first 72 characters.
 *
 * Run with `--check` for CI; without it, it prints the measurement.
 */

import { estimateFederalTax } from '../../packages/us-federal-tax/dist/esm/index.js';
import { stateIncomeTax } from '../../packages/us-state-tax/dist/esm/index.js';
import { householdInput } from '../differential/ours.mjs';
import { STATES, YEARS } from '../cliffs/shapes.mjs';

const CHECK = process.argv.includes('--check');

const fail = (...lines) => {
  console.error(lines.join('\n'));
  process.exit(1);
};

const problems = [];
const say = (ok, what) => {
  if (!ok) problems.push(what);
  return ok;
};

const money = (n) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** A two-child household on the EITC plateau, which is where the cliff is worst. */
const PLATEAU_WAGES = 25_000;
const base = (year) => ({
  filingStatus: 'single',
  year,
  w2Wages: PLATEAU_WAGES,
  age: 38,
  qualifyingChildren: 2,
  eitcQualifyingChildren: 2,
});

/* ------------------------------------------------------------------ */
/* 1-3. The federal cliff, its components, and the override           */
/* ------------------------------------------------------------------ */

const federal = {};
for (const year of YEARS) {
  const clean = estimateFederalTax(base(year));
  const limit = clean.credits.earnedIncomeCredit?.investmentIncomeLimit;
  const credit = clean.credits.earnedIncomeCredit?.credit;
  if (
    !say(
      typeof limit === 'number' && limit > 0,
      `${year}: the federal package reports no § 32(i) investment income limit`,
    ) ||
    !say(typeof credit === 'number' && credit > 0, `${year}: no federal credit at the plateau`)
  ) {
    continue;
  }
  federal[year] = { limit, credit };

  // 1. A cliff, located to the cent, on the component the default used to miss.
  const at = estimateFederalTax({ ...base(year), taxExemptInterest: limit });
  const over = estimateFederalTax({ ...base(year), taxExemptInterest: limit + 0.01 });
  say(
    at.credits.earnedIncomeCredit.credit === credit,
    `${year}: ${money(limit)} of exempt interest — exactly AT the limit — already reduced the ` +
      `credit, from ${money(credit)} to ${money(at.credits.earnedIncomeCredit.credit)}. ` +
      `§ 32(i)(1) bars the credit where disqualified income EXCEEDS the limit.`,
  );
  say(
    over.credits.earnedIncomeCredit.credit === 0 &&
      over.credits.earnedIncomeCredit.ineligibleReason === 'investmentIncomeTooHigh',
    `${year}: one cent over ${money(limit)} of exempt interest did not bar the credit — got ` +
      `${money(over.credits.earnedIncomeCredit.credit)}, reason ` +
      `${over.credits.earnedIncomeCredit.ineligibleReason ?? 'none'}. § 32(i)(2)(B) is ` +
      `"interest received or accrued ... which is exempt from tax", and this input is ` +
      `documented in the package as Form 1040 line 2a.`,
  );

  // 2. The SUM of the two components is what is tested, not either alone.
  const half = Math.round((limit / 2) * 100) / 100;
  const split = estimateFederalTax({
    ...base(year),
    longTermCapitalGains: half,
    taxExemptInterest: limit - half + 0.01,
  });
  say(
    split.credits.earnedIncomeCredit.credit === 0,
    `${year}: ${money(half)} of gains plus ${money(limit - half + 0.01)} of exempt interest is ` +
      `a cent over ${money(limit)} between them and the credit was still paid — the two ` +
      `components are not being added.`,
  );
  const underBoth = estimateFederalTax({
    ...base(year),
    longTermCapitalGains: half,
    taxExemptInterest: limit - half,
  });
  say(
    underBoth.credits.earnedIncomeCredit.investmentIncome === limit &&
      underBoth.credits.earnedIncomeCredit.credit > 0,
    `${year}: the same household exactly AT the limit across both components reported ` +
      `${money(underBoth.credits.earnedIncomeCredit.investmentIncome)} of investment income ` +
      `and ${money(underBoth.credits.earnedIncomeCredit.credit)} of credit.`,
  );

  // 3. An explicit figure wins, in both directions. A caller who has read
  // § 32(i)(2) and knows their filer's exempt interest is, say, a distributive
  // share already counted elsewhere is not overridden by a default.
  const declaredZero = estimateFederalTax({
    ...base(year),
    taxExemptInterest: limit * 100,
    disqualifiedInvestmentIncome: 0,
  });
  const declaredHigh = estimateFederalTax({
    ...base(year),
    disqualifiedInvestmentIncome: limit + 0.01,
  });
  say(
    declaredZero.credits.earnedIncomeCredit.credit === credit,
    `${year}: an explicit disqualifiedInvestmentIncome of 0 did not override the default.`,
  );
  say(
    declaredHigh.credits.earnedIncomeCredit.credit === 0,
    `${year}: an explicit disqualifiedInvestmentIncome over the limit did not bar the credit.`,
  );
}

/* ------------------------------------------------------------------ */
/* 4-5. Every state that matches the federal credit                   */
/* ------------------------------------------------------------------ */

/**
 * The state's answer at a given amount of exempt interest, through the same
 * door the differential grid and the audit use.
 */
function state(code, year, taxExemptInterest, forceFederalCredit, childAges = [6, 11]) {
  const c = {
    state: code,
    year,
    filingStatus: 'single',
    primaryAge: 38,
    spouseAge: null,
    childAges,
    wages: PLATEAU_WAGES,
    pension: 0,
    socialSecurity: 0,
    longTermCapitalGains: 0,
    taxExemptInterest,
    blind: 0,
    oregonPriorYearTaxBeforeCredits: null,
  };
  try {
    const built = householdInput(c).base;
    const base =
      forceFederalCredit === undefined
        ? built
        : { ...built, federal: { ...built.federal, earnedIncomeCredit: forceFederalCredit } };
    return stateIncomeTax(base);
  } catch {
    return null;
  }
}

const EITC_NAME = /earned income/i;
const rows = [];
const ownCredit = [];
const ownCliff = [];

for (const year of YEARS) {
  const f = federal[year];
  if (!f) continue;
  for (const code of STATES) {
    const at = state(code, year, f.limit);
    const over = state(code, year, f.limit + 0.01);
    if (!at || !over) continue;

    const creditsOf = (r) => (r.credits ?? []).filter((x) => EITC_NAME.test(x.name));
    const sumOf = (r) => creditsOf(r).reduce((n, x) => n + x.amount, 0);
    const before = sumOf(at);
    if (before <= 0) continue; // no state credit here, or none on this household

    // A STATE WHOSE CREDIT IS ITS OWN IS NOT A STATE THAT INHERITS THIS CLIFF,
    // and California is the one. CalEITC is computed on California earned
    // income from R&TC § 17052's own schedule, so the federal credit going to
    // zero is nothing to it — and it has an investment-income cliff of its
    // OWN, $4,814 under § 17052(i), which this package already declares and
    // prices twice in California's notes. Asserting the federal rule against it
    // would be asserting the wrong statute; what IS owed is a check that its
    // own cliff still works and still takes the Young Child Tax Credit with it,
    // and the block after this loop does that.
    //
    // The test is structural rather than a list of state codes: a credit that
    // moved when the FEDERAL credit was zeroed is a match, and one that did not
    // is the state's own.
    const matchesFederal = sumOf(state(code, year, f.limit, 0)) !== before;
    if (!matchesFederal) {
      ownCredit.push({ code, year, before });
      continue;
    }

    const after = sumOf(over);

    // WHAT THE CLIFF TOOK, measured as every credit that was positive below it
    // and zero above it — not as a name match. Illinois is why: 35 ILCS 5/244
    // gives it a CHILD tax credit that is 40% of its earned income credit, and
    // this package models it as that credit's `earnedIncomeCreditChildBonus`,
    // so it goes at the same cent under a name with no "earned income" in it.
    // A guard that filtered on the name priced Illinois at $1,360.90 and the
    // engine took $1,905.26 — and the note, which sums structurally, was right.
    const amounts = (r) => new Map((r.credits ?? []).map((c) => [c.name, c.amount]));
    const was = amounts(at);
    const now = amounts(over);
    let drop = 0;
    const zeroed = [];
    for (const [name, amount] of was) {
      if (amount > 0 && (now.get(name) ?? 0) === 0) {
        drop += amount;
        zeroed.push(name);
      }
    }
    drop = Math.round(drop * 100) / 100;
    const taxJump = Math.round((over.totalTax - at.totalTax) * 100) / 100;

    // 4. The credit really is taken away, in full, across one cent.
    say(
      after === 0,
      `${code} ${year}: a cent of exempt interest over the federal limit left ` +
        `${money(after)} of state earned income credit standing. The federal credit it is a ` +
        `percentage of is zero there, so the state credit cannot be positive.`,
    );

    // 5. The shipped note says so, and the figure in its prose is the figure
    // the engine computed. The note is read at the point BELOW the cliff,
    // because that is the filer who needs the warning.
    const notes = at.notes ?? [];
    const cliffNote = notes.find((n) => /§ 32\(i\)/.test(n) && /CLIFF/.test(n));
    if (
      say(
        cliffNote !== undefined,
        `${code} ${year}: has a state earned income credit worth ${money(before)} that one cent ` +
          `of investment income takes away, and no shipped note mentions § 32(i) as a cliff.`,
      )
    ) {
      const quoted = cliffNote.match(/\$([\d,]+\.\d\d) of /);
      say(
        quoted !== null,
        `${code} ${year}: the § 32(i) note quotes no priced figure.`,
      );
      if (quoted) {
        const stated = Number(quoted[1].replace(/,/g, ''));
        // EXACT, not a floor. The note sums the credits this one carries from
        // the result object it is attached to, so it is claiming the whole of
        // what the cliff zeroes, and the two sides are computed by different
        // routes: the note by name from the definition, this by comparing two
        // returns a cent apart.
        say(
          Math.abs(stated - drop) < 0.01,
          `${code} ${year}: the note prices the loss at ${money(stated)} and the engine takes ` +
            `${money(drop)} away (${zeroed.join(', ') || 'nothing'}). A priced figure in a note ` +
            `is a claim about this engine's own answer and has to equal it.`,
        );
        // A NON-REFUNDABLE CREDIT CAN BE LOST WITHOUT ANYBODY PAYING MORE TAX,
        // and South Carolina is the case: its match is non-refundable, this
        // household's liability is already nil, so $8,505.64 of credit goes and
        // the tax bill moves by nothing. The note says "credit lost" rather
        // than "tax owed" for exactly that reason, so the tax movement is
        // recorded here as a separate column rather than asserted equal.
        say(
          taxJump <= drop + 0.01,
          `${code} ${year}: the tax moved ${money(taxJump)} across the cent and only ` +
            `${money(drop)} of credit was zeroed, so something other than this credit moved.`,
        );
        rows.push({ code, year, before, drop, stated, taxJump });
      }
    }
  }
}

say(rows.length > 0, 'no state was reached at all — are both packages built?');

/* ------------------------------------------------------------------ */
/* 6. The state that has a cliff of its own                           */
/* ------------------------------------------------------------------ */

/**
 * California, and the reason it is here rather than excluded.
 *
 * CalEITC does not inherit § 32(i), so none of the assertions above apply to
 * it. What DOES apply is that it has its own limit, that the limit is tested
 * against the same components — § 17052(i) conforms to § 32(i), and the field
 * this package reads for it is documented as "taxable and tax-exempt interest,
 * dividends, capital gain net income and net rent and royalty income" — and
 * that it takes the Young Child Tax Credit with it.
 *
 * **Until Day 78 the shared harness fed that field from capital gain alone**,
 * so a household holding nothing but municipal bonds kept the whole of both
 * credits here and loses both on a real return. This is the assertion that
 * would have caught it.
 */
const CA_CREDIT = /CalEITC|Young Child/i;
// A CHILD UNDER 6, because the Young Child Tax Credit requires one and the
// household the rest of this file uses has children of 6 and 11. The first
// version of this block asserted the YCTC's dependence on CalEITC against a
// household that could never claim it, and failed on the household rather than
// on the engine. R&TC § 17052.1 is the credit; California's own note prices
// the pair at $4,528.82 for a single parent of two young children.
const CA_CHILDREN = [2, 4];
for (const year of YEARS) {
  const limit = 4_814; // a starting bracket only; the real figure is bisected below
  const withNone = state('CA', year, 0, undefined, CA_CHILDREN);
  if (!withNone) continue;
  const owed = (withNone.credits ?? [])
    .filter((c) => CA_CREDIT.test(c.name))
    .reduce((n, c) => n + c.amount, 0);
  if (!say(owed > 0, `CA ${year}: no CalEITC or Young Child credit on this household at all`)) {
    continue;
  }
  // The limit is California's and belongs to the state package. It is located
  // by bisection on the engine's own answer rather than quoted, so this file
  // carries no copy of it: the only figure above is a starting bracket.
  let lo = 0;
  let hi = limit * 4;
  for (let i = 0; i < 40 && hi - lo > 0.01; i += 1) {
    const mid = Math.round(((lo + hi) / 2) * 100) / 100;
    const r = state('CA', year, mid, undefined, CA_CHILDREN);
    const got = (r?.credits ?? [])
      .filter((c) => CA_CREDIT.test(c.name))
      .reduce((n, c) => n + c.amount, 0);
    if (got > 0) lo = mid;
    else hi = mid;
  }
  const lost = state('CA', year, hi, undefined, CA_CHILDREN);
  const kept = state('CA', year, lo, undefined, CA_CHILDREN);
  const keptAmount = (kept?.credits ?? [])
    .filter((c) => CA_CREDIT.test(c.name))
    .reduce((n, c) => n + c.amount, 0);
  const lostAmount = (lost?.credits ?? [])
    .filter((c) => CA_CREDIT.test(c.name))
    .reduce((n, c) => n + c.amount, 0);
  say(
    hi < limit * 4 - 0.02,
    `CA ${year}: no amount of tax-exempt interest up to ${money(limit * 4)} switched CalEITC ` +
      `off. § 17052(i)'s limit is tested on investment income, and exempt interest is one of ` +
      `its components — if nothing happens here, the field is not reaching the engine.`,
  );
  say(
    lostAmount === 0 && keptAmount > 0,
    `CA ${year}: CalEITC did not go to zero across the cent at ${money(hi)} — kept ` +
      `${money(keptAmount)}, lost side ${money(lostAmount)}.`,
  );
  const names = new Set((kept?.credits ?? []).filter((c) => CA_CREDIT.test(c.name) && c.amount > 0).map((c) => c.name));
  say(
    names.size >= 2,
    `CA ${year}: only ${[...names].join(', ') || 'nothing'} is positive below the limit, so the ` +
      `Young Child Tax Credit's dependence on CalEITC is not being exercised here.`,
  );
  ownCliff.push({ year, at: lo, next: hi, lost: keptAmount, names: [...names] });
}

if (!CHECK) {
  console.log('');
  console.log('THE § 32(i) CLIFF, FROM BOTH SIDES');
  console.log('');
  for (const year of YEARS) {
    if (!federal[year]) continue;
    console.log(
      `  ${year}  limit ${money(federal[year].limit)}   federal credit at the plateau ` +
        `${money(federal[year].credit)}  (single, two children, ${money(PLATEAU_WAGES)} of wages)`,
    );
  }
  console.log('');
  console.log('  What one cent of investment income costs in state credit:');
  console.log('');
  console.log('    state year    credit    taken away   note says   state tax moves');
  for (const r of rows.sort((a, b) => b.drop - a.drop || a.code.localeCompare(b.code))) {
    console.log(
      `    ${r.code.padEnd(5)} ${r.year}  ${money(r.before).padStart(9)}  ` +
        `${money(r.drop).padStart(11)}  ${money(r.stated).padStart(10)}  ` +
        `${(r.taxJump >= 0 ? '+' : '') + money(r.taxJump)}`,
    );
  }
  console.log('');
  const worst = rows.reduce((p, q) => (q.drop > p.drop ? q : p));
  console.log(
    `  Worst on this household: ${worst.code} ${worst.year}, ${money(worst.drop)} of state ` +
      `credit on one cent — on top of the ${money(federal[worst.year].credit)} federal credit ` +
      `that goes at the same cent.`,
  );
  console.log('');
  if (ownCredit.length) {
    console.log(
      `  Not inheriting it, because the credit is the state's own: ` +
        `${[...new Set(ownCredit.map((r) => r.code))].join(', ')}`,
    );
    console.log('');
  }
  for (const c of ownCliff) {
    console.log(
      `  CA ${c.year}: its OWN limit bites between ${money(c.at)} and ${money(c.next)} of ` +
        `tax-exempt interest, and takes ${money(c.lost)} with it — ${c.names.join(' + ')}.`,
    );
  }
  console.log('');
}

if (problems.length > 0) {
  fail(
    'The § 32(i) investment-income cliff is not what this repository ships:',
    '',
    ...problems.map((p) => `  - ${p}`),
    '',
    'See tools/cross-package/eitc-investment-income-cliff.mjs for what each assertion is for.',
  );
}

const states = new Set(rows.map((r) => r.code)).size;
const worst = rows.reduce((p, q) => (q.drop > p.drop ? q : p));
console.log(
  `ok — § 32(i) is a cliff in the federal package on the SUM of capital gain and exempt ` +
    `interest, an explicit figure still overrides it, and in all ${states} states whose credit ` +
    `matches the federal one the state credit goes to zero across the same cent, is disclosed ` +
    `in a shipped note as a cliff, and the note's priced figure equals, to the cent, what the ` +
    `cliff zeroes in the engine's own answer — worst ${worst.code} ${worst.year} at ${money(worst.drop)}. ` +
    `California's credit is its own and keeps its own cliff, which tax-exempt interest ` +
    `reaches and which takes the Young Child Tax Credit with it.`,
);
