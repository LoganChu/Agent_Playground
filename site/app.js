/**
 * The page. All of the tax work is in `src/compute.js`; this file only reads
 * the form, renders, and remembers which state row you clicked.
 */
import { FILING_STATUSES, YEARS, compute } from './src/compute.js';

const $ = (selector) => document.querySelector(selector);
const form = $('#form');

const dollars = (n) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const cents = (n) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
const pct = (n, places = 2) => `${(n * 100).toFixed(places)}%`;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function row(label, value, className = '') {
  const node = el('div', `row ${className}`.trim());
  node.append(el('span', 'k', label), el('span', 'v', value));
  return node;
}

function stat(key, value, alarm = false) {
  const node = el('div', `stat${alarm ? ' alarm' : ''}`);
  node.append(el('span', 'n', value), el('span', 'k', key));
  return node;
}

// --- form -------------------------------------------------------------------

for (const year of YEARS) {
  const option = el('option', null, String(year));
  option.value = String(year);
  $('#year').append(option);
}
for (const [id, label] of FILING_STATUSES) {
  const option = el('option', null, label);
  option.value = id;
  $('#filingStatus').append(option);
}
$('#filingStatus').value = 'marriedFilingJointly';

/** Which state's detail panel is open. Null means "pick one worth reading". */
let selected = null;

/**
 * Eleven states can tie at zero, and a detail panel for the first of them says
 * only that it has no income tax. Default to the cheapest state that actually
 * charges something, which is the row a reader learns from.
 */
function defaultState(model) {
  const interesting = model.states.find((s) => !s.error && s.hasIncomeTax && s.total > 0);
  return (interesting ?? model.states[0]).state;
}

function readForm() {
  return Object.fromEntries(new FormData(form).entries());
}

// --- rendering --------------------------------------------------------------

function renderFederal(model) {
  const { federal: fed, marginal, received } = model;
  const card = $('#federal');
  card.replaceChildren();
  card.append(el('h2', null, `Federal, ${fed.year}`));

  const headline = el('div', 'headline');
  headline.append(
    stat('Received', dollars(received)),
    stat('Federal tax', dollars(fed.totalTax)),
    stat('Bracket', pct(fed.marginalRate, 0)),
    stat(
      'Real rate on the next $1,000',
      pct(marginal.federalRate),
      marginal.federalRate > fed.marginalRate + 0.005,
    ),
  );
  card.append(headline);

  if (marginal.federalRate > fed.marginalRate + 0.005) {
    const excess = marginal.federalRate - fed.marginalRate;
    card.append(
      el(
        'p',
        'prose',
        `A ${dollars(1000)} raise costs ${cents(marginal.federalCost)} of federal tax — ` +
          `${pct(excess)} above the ${pct(fed.marginalRate, 0)} bracket. ` +
          `Quoting the bracket alone understates it by ${cents(
            marginal.federalCost - 1000 * fed.marginalRate,
          )}.`,
      ),
    );
  }

  const rows = el('div', 'rows');
  const ss = fed.socialSecurity;
  if (ss && ss.benefits > 0) {
    rows.append(row('Social Security received', cents(ss.benefits)));
    rows.append(
      row(
        `taxable under § 86 — ${pct(ss.inclusionRate, 1)} of it`,
        cents(ss.taxableBenefits),
        'sub',
      ),
    );
    rows.append(row('never taxed at all', cents(ss.untaxedBenefits), 'sub'));
    rows.append(
      row(
        `§ 86 combined income, against a ${dollars(ss.baseAmount)} threshold last set in 1983`,
        cents(ss.combinedIncome),
        'sub',
      ),
    );
  }
  rows.append(row('Adjusted gross income', cents(fed.adjustedGrossIncome)));
  rows.append(row(`Deduction (${fed.deductionKind})`, cents(fed.deduction)));
  if (fed.additionalDeductions.total > 0) {
    rows.append(row('Schedule 1-A (OBBBA)', cents(fed.additionalDeductions.total), 'sub'));
    if (fed.additionalDeductions.senior.deduction > 0) {
      rows.append(
        row('senior deduction, 2025–2028 only', cents(fed.additionalDeductions.senior.deduction), 'sub'),
      );
    }
  }
  rows.append(row('Taxable income', cents(fed.taxableIncome)));
  rows.append(row('Federal income tax', cents(fed.totalTax), 'total'));
  card.append(rows);

  // The engine's own notes lead, and they are the only ones here that are not
  // derived from figures already on the page: they say what it did with
  // something the visitor told it and it could not use. A separate filer who
  // enters a spouse's age is told why it changed nothing.
  const notes = [...(fed.notes ?? [])];
  if (ss && ss.tier > 0 && !ss.atMaximumInclusion) {
    notes.push(
      `You are inside the § 86 phase-in — "the tax torpedo". Each extra dollar of ordinary ` +
        `income pulls 50 or 85 cents of Social Security into taxable income behind it, which is ` +
        `why the real rate above is not the bracket. It stops once 85% of the benefit is taxable.`,
    );
  }
  if (ss && ss.tier === 0 && ss.benefits > 0) {
    notes.push(
      `None of the benefit is taxable: § 86 combined income of ${cents(
        ss.combinedIncome,
      )} is at or below the ${dollars(ss.baseAmount)} base amount. That threshold was set in ` +
        `1983 and has never been indexed, so ordinary income growth crosses it on its own — ` +
        `there is ${cents(Math.max(0, ss.baseAmount - ss.combinedIncome))} of headroom left.`,
    );
  }
  if (ss && ss.cohabitingSeparate) {
    notes.push(
      `Filing separately while living with a spouse sets both § 86 thresholds to $0, so 85% of ` +
        `the benefit is taxable from the first dollar. A separate filer who lived apart for the ` +
        `whole year uses the single thresholds instead.`,
    );
  }
  const senior = fed.additionalDeductions.senior;
  if (senior.deduction > 0) {
    notes.push(
      `The senior deduction is worth ${cents(senior.deduction)} here and expires after 2028.` +
        (senior.phaseOutReduction > 0
          ? ` It is already phasing out — ${cents(
              senior.phaseOutReduction,
            )} of it has gone — at 6% of the excess income for each person aged 65, which is part ` +
            `of why the real marginal rate above is not the bracket.`
          : ` It withdraws at 6% of the excess income for each person aged 65 once income passes ` +
            `the threshold, which is where the real marginal rate starts to exceed the bracket.`),
    );
  }
  if (notes.length) {
    card.append(el('h3', null, 'Worth knowing'));
    const list = el('ul', 'notes');
    for (const note of notes) list.append(el('li', null, note));
    card.append(list);
  }
}


/**
 * The one thing on this page that nothing else in a household's life would tell
 * them.
 *
 * Three states cap their retirement exclusion PER PERSON, so the same two
 * household totals produce different tax depending only on whose name the
 * income is in — and the federal return cannot see the difference at all, so
 * no form, no adviser's summary and no rate table would flag it. Until now the
 * page computed it and waited to be asked; a visitor had to change a dropdown
 * and notice that numbers moved.
 *
 * Printed as a saving or a cost rather than a difference, because the reader is
 * standing at one of the two allocations and wants to know which way to walk.
 */
function renderAllocation(card, model) {
  const swing = model.allocation;
  if (!swing) return;
  const other =
    swing.alternative === 'even' ? 'split evenly between you' : 'all in one name';
  const cheaper = swing.cheaperElsewhere;
  const box = el('div', 'callout');
  const names = swing.rows.map((row) => row.stateName);
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  box.append(
    el(
      'p',
      null,
      `Whose name the income is in changes the tax in ${list}, because all three cap ` +
        `their retirement exclusion per person. Filing it ${other} would ` +
        (cheaper.length > 0
          ? `SAVE ${dollars(Math.abs(cheaper[0].difference))} in ${cheaper[0].stateName}`
          : `COST ${dollars(swing.widest.difference)} more in ${swing.widest.stateName}`) +
        ` on identical household totals. Your federal tax does not move by a cent, ` +
        `so nothing on a federal return would tell you.`,
    ),
  );
  const rows = el('div', 'rows');
  for (const moved of swing.rows) {
    rows.append(row(`${moved.stateName}, ${other}`, cents(moved.there)));
    rows.append(row(`${moved.stateName}, as entered`, cents(moved.here), 'sub'));
  }
  box.append(rows);
  card.append(box);
}

function renderRanking(model) {
  const card = $('#ranking');
  card.replaceChildren();
  card.append(el('h2', null, `State income tax, cheapest first — ${model.input.year}`));
  card.append(
    el(
      'p',
      'prose',
      'On top of the federal figure above. Click a state for the working. Where a local income ' +
        'tax is levied on every resident with no opt-out, the range across that state’s own ' +
        'jurisdictions is shown — leaving it out would not be a smaller number, it would be a ' +
        'wrong one.',
    ),
  );

  renderAllocation(card, model);

  const table = el('table');
  const head = el('thead');
  const headRow = el('tr');
  for (const heading of ['State', 'State tax', 'Local tax', 'Total', 'On what you receive']) {
    headRow.append(el('th', null, heading));
  }
  head.append(headRow);
  table.append(head);

  const body = el('tbody');
  for (const state of model.states) {
    const tr = el('tr');
    tr.tabIndex = 0;
    tr.dataset.state = state.state;
    if (state.state === (selected ?? defaultState(model))) tr.setAttribute('aria-selected', 'true');

    const name = el('td', null, state.stateName);
    if (!state.error && !state.hasIncomeTax) name.append(el('span', 'flag', 'no income tax'));
    if (state.derived) name.append(el('span', 'flag', 'derived base'));
    tr.append(name);

    if (state.error) {
      const cell = el('td', 'n', 'not computed');
      cell.colSpan = 4;
      tr.append(cell);
    } else {
      const total = state.localRange ? state.localRange.low.total : state.total;
      tr.append(el('td', `n${state.tax === 0 ? ' zero' : ''}`, dollars(state.tax)));
      tr.append(
        el(
          'td',
          'n',
          state.localRange
            ? `${dollars(state.localRange.low.local)}–${dollars(state.localRange.high.local)}`
            : state.localNote
              ? 'varies'
              : '—',
        ),
      );
      tr.append(
        el(
          'td',
          `n${total === 0 ? ' zero' : ''}`,
          state.localRange
            ? `${dollars(total)}–${dollars(state.localRange.high.total)}`
            : dollars(total),
        ),
      );
      tr.append(el('td', 'n', model.received > 0 ? pct(total / model.received, 2) : '—'));
    }
    body.append(tr);
  }
  table.append(body);

  const scroller = el('div', 'scroller');
  scroller.append(table);
  card.append(scroller);

  body.addEventListener('click', (event) => {
    const tr = event.target.closest('tr');
    if (tr) select(tr.dataset.state);
  });
  body.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const tr = event.target.closest('tr');
    if (!tr) return;
    event.preventDefault();
    select(tr.dataset.state);
  });
}

function renderDetail(model) {
  const card = $('#detail');
  card.replaceChildren();
  const state = model.states.find((s) => s.state === (selected ?? defaultState(model)));
  if (!state) return;

  card.append(el('h2', null, state.stateName));

  if (state.error) {
    card.append(el('p', 'prose', state.error));
    return;
  }

  const result = state.result;
  if (!state.hasIncomeTax) {
    card.append(
      el(
        'p',
        'prose',
        `${state.stateName} levies no individual income tax, so the federal figure above is the ` +
          `whole income tax bill. It is not the whole tax bill: states without an income tax ` +
          `raise the money somewhere else, most often through property and sales taxes, and ` +
          `neither is modelled here.`,
      ),
    );
  } else {
    const rows = el('div', 'rows');
    rows.append(row(`Starting point (${result.conformity.base})`, cents(result.conformity.amount)));
    for (const subtraction of result.computedSubtractions ?? []) {
      if (subtraction.amount > 0) rows.append(row(`less ${subtraction.name}`, `−${cents(subtraction.amount)}`, 'sub'));
    }
    for (const addBack of result.addBacks ?? []) {
      if (addBack.amount > 0) rows.append(row(`plus ${addBack.name}`, cents(addBack.amount), 'sub'));
    }
    rows.append(row('State taxable income', cents(result.taxableIncome)));
    rows.append(row('Tax before credits', cents(result.taxBeforeCredits)));
    for (const credit of result.credits ?? []) {
      if (credit.amount !== 0) rows.append(row(`less ${credit.name}`, `−${cents(credit.amount)}`, 'sub'));
    }
    rows.append(row('State income tax', cents(result.tax), 'total'));
    card.append(rows);
  }

  if (state.localRange) {
    card.append(el('h3', null, 'Local income tax, which every resident owes'));
    const rows = el('div', 'rows');
    rows.append(
      row(`cheapest — ${state.localRange.low.name}`, cents(state.localRange.low.local)),
    );
    rows.append(
      row(`dearest — ${state.localRange.high.name}`, cents(state.localRange.high.local)),
    );
    rows.append(
      row(
        'the difference, for moving',
        cents(state.localRange.high.local - state.localRange.low.local),
        'total',
      ),
    );
    card.append(rows);
  }

  const notes = [];
  if (state.derived) notes.push(state.derived.note);
  if (state.localNote && !state.localRange) notes.push(state.localNote);
  for (const note of result.notes ?? []) notes.push(note);

  if (notes.length) {
    card.append(el('h3', null, 'What this state does, and what is missing'));
    card.append(noteList(notes, 3));
  }
}

/**
 * The notes are the most valuable thing on the page and the easiest to make
 * unreadable. Maryland alone emits twenty, several of them a paragraph long, so
 * showing them all unprompted turns the detail panel into a wall nobody reads
 * and buries the three that apply to the number just computed. The first few
 * stay open; the rest go behind a disclosure that says how many there are, so
 * nothing is hidden and nothing has to be scrolled past.
 */
function noteList(notes, visible) {
  const wrapper = document.createDocumentFragment();
  const list = el('ul', 'notes');
  for (const note of notes.slice(0, visible)) list.append(el('li', null, note));
  wrapper.append(list);
  if (notes.length > visible) {
    const details = el('details');
    details.append(
      el('summary', null, `${notes.length - visible} more notes on this state`),
    );
    const rest = el('ul', 'notes');
    for (const note of notes.slice(visible)) rest.append(el('li', null, note));
    details.append(rest);
    wrapper.append(details);
  }
  return wrapper;
}

// --- wiring -----------------------------------------------------------------

let latest = null;

function render() {
  try {
    latest = compute(readForm());
  } catch (error) {
    $('#federal').replaceChildren(el('h2', null, 'Could not compute'), el('p', 'prose', String(error.message ?? error)));
    $('#ranking').replaceChildren();
    $('#detail').replaceChildren();
    return;
  }
  for (const node of document.querySelectorAll('.spouse-only')) {
    node.classList.toggle('hidden', !latest.input.joint);
  }
  renderFederal(latest);
  renderRanking(latest);
  renderDetail(latest);
}

function select(state) {
  selected = state;
  renderRanking(latest);
  renderDetail(latest);
}

form.addEventListener('input', () => {
  selected = null;
  render();
});
form.addEventListener('change', () => {
  selected = null;
  render();
});
form.addEventListener('submit', (event) => event.preventDefault());

render();
