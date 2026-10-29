/**
 * The findings page. All of the tax work is in `src/checks.js`; this file only
 * renders what that module computes.
 *
 * Kept deliberately thin for the reason `app.js` is: the figures have to be
 * produced by a module `node --test` can import, or the page is the only place
 * they exist and nothing checks them. `test/checks.test.js` asserts every row.
 */
import { runChecks } from './src/checks.js';

const money = (value) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const percent = (value) => `${(value * 100).toFixed(2)}%`;

const format = (check, value) => (check.unit === 'rate' ? percent(value) : money(value));

/** The gap, in the units the row is measured in, always as a magnitude. */
const gap = (check) => {
  const size = Math.abs(check.difference);
  return check.unit === 'rate' ? `${(size * 100).toFixed(2)} points` : money(size);
};

const render = () => {
  const host = document.getElementById('checks');
  const checks = runChecks();

  for (const check of checks) {
    const section = document.createElement('section');
    section.className = 'check';
    section.id = check.id;

    const heading = document.createElement('h2');
    heading.textContent = check.headline;
    section.append(heading);

    const where = document.createElement('p');
    where.className = 'hint';
    where.textContent = `${check.stateName} · tax year ${check.year} · ${check.household}`;
    section.append(where);

    const table = document.createElement('table');
    table.innerHTML = `
      <thead>
        <tr><th>reading</th><th class="n">state tax</th></tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row">${check.oursLabel ?? 'What the statute gives'}</th>
          <td class="n">${format(check, check.ours)}</td>
        </tr>
        <tr>
          <th scope="row">${check.wrongLabel}</th>
          <td class="n">${format(check, check.theirs)}</td>
        </tr>
        <tr class="gap">
          <th scope="row">${check.kind === 'error' ? 'Wrong by' : 'Apart by'}</th>
          <td class="n">${gap(check)}</td>
        </tr>
      </tbody>
    `;
    section.append(table);

    const says = document.createElement('p');
    says.textContent = check.says;
    section.append(says);

    const cite = document.createElement('p');
    cite.className = 'hint';
    cite.textContent = check.cite;
    section.append(cite);

    host.append(section);
  }
};

render();
