#!/usr/bin/env node
/**
 * THE ADDRESS, ASSERTED AGAINST EVERY DOCUMENT THAT NAMES A PRICE.
 *
 * ## Why it exists, and the reason is thirty-four days long
 *
 * `OFFER.md` has priced three products since Day 73 — $2,500, $6,000/yr and
 * $12,000/yr — and from Day 73 to Day 85 it carried, in its own words:
 *
 * > a way to be contacted — there is no address anywhere in this repository, so
 * > nobody can buy anything at any price
 *
 * `DO-THIS.md` asked the repository owner for an e-mail address every day from
 * Day 21 to Day 85. **Sixty-five days.** It was item 3, described as *"the only
 * item on the list with no technical content, and the only one without which
 * none of the others produces a dollar."*
 *
 * It was never blocked. `GET /repos/LoganChu/Agent_Playground` answers
 * `has_issues: true` and `open_issues_count: 0`. The channel was open the whole
 * time, e-mailed the owner on every new issue, and was never pointed at.
 *
 * > **THE RULE THIS FILE EXISTS TO STOP RECURRING: AN ASK PHRASED AS A SPECIFIC
 * > REMEDY HIDES EVERY OTHER REMEDY.** *"Reply with an address"* has exactly one
 * > answer and it is the owner's. *"A buyer must be able to start a
 * > conversation"* has two, and the second was a file in this repository on
 * > Day 21.
 *
 * ## What it asserts, and why each one is a separate accident
 *
 * 1. **Every price in `OFFER.md` has a contact link within `NEAR` lines of it.**
 *    The failure this catches is a fourth product being priced and the line
 *    under it being forgotten, which is exactly how the first three got there.
 * 2. **Every document that quotes a price links the address.** A package README
 *    on npm is read by somebody who will never open `OFFER.md`.
 * 3. **The forms `CONTACT.md` advertises exist, and the forms that exist are
 *    advertised** — both directions. A template added and not linked is
 *    invisible; a template linked and not added is a 404 under a price.
 * 4. **Each form's `name:` is the text `CONTACT.md` links it by.** Renaming the
 *    form in GitHub's chooser and not in the document is the quiet half.
 * 5. **`config.yml`'s contact links point at paths that exist here.** They are
 *    absolute `blob/main` URLs, so nothing but this check can see them break.
 * 6. **No e-mail address appears in any shipped document.** This is the guard on
 *    the remedy that was being asked for: an address under a public price list is
 *    handed to every scraper that passes, and the whole point of the channel that
 *    was already open is that it publishes nobody's.
 *
 * ## What it CANNOT check, declared rather than implied
 *
 * **That Issues are still enabled.** That is a live repository setting, not a
 * fact about this tree, and an owner can turn it off in one click — at which
 * point every link this file guards becomes a redirect to a repository with no
 * Issues tab and nothing here would go red. It was `true` when this file was
 * written, measured rather than assumed, and the measurement is recorded in
 * `CONTACT.md` and in the journal with the date on it. The daily run re-reads it;
 * see `JOURNAL.md`.
 *
 *   node tools/cross-package/contact-address.mjs --check
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The tree to check. `CONTACT_ROOT` exists so `contact-address.test.mjs` can
 * point this at a fixture and watch each of the six assertions go red — a gate
 * verified by reintroduction rather than by having passed once, which is the
 * standard every other check in this repository is held to.
 */
const ROOT = process.env.CONTACT_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEMPLATE_DIR = '.github/ISSUE_TEMPLATE';

/** The repository's one contact address, in the two shapes a document may use. */
const ISSUE_URL = 'https://github.com/LoganChu/Agent_Playground/issues/new';

/**
 * How many lines after a price a contact link may be and still count as "beside
 * it". Four is one blank line plus a wrapped sentence, which is what the three
 * in `OFFER.md` are. A larger number makes this check pass on a document where
 * the link is in the next section, which is the thing it is for.
 */
const NEAR = 4;

/**
 * The priced strings, exactly as they are written in prose. A price is a dollar
 * sign and a thousands separator; these three are the ones this project sells
 * and the pattern below finds any fourth one without being told about it.
 */
const PRICE = /\$(?:\d{1,3}(?:,\d{3})+|\d{4,})\b/g;

/**
 * Documents that must carry the address, and why each one is here.
 *
 * `DO-THIS.md` is on the list because it is the page the owner reads, and the
 * first thing a page of asks should say is which of them is already done.
 */
const MUST_LINK = [
  ['CONTACT.md', 'the canonical page'],
  ['OFFER.md', 'the price list'],
  ['README.md', 'the front page'],
  ['DO-THIS.md', "the owner's page of asks"],
  ['packages/us-federal-tax/README.md', 'what npm shows for us-federal-tax'],
  ['packages/us-state-tax/README.md', 'what npm shows for us-state-tax'],
  ['packages/us-tax-mcp/README.md', 'what npm shows for us-tax-mcp'],
];

/**
 * Every document in `MUST_LINK` plus the ones that merely must not leak an
 * address. Kept separate from `MUST_LINK` because "must carry the link" and
 * "must not carry an e-mail" are different assertions over different sets.
 */
const NO_EMAIL = [...MUST_LINK.map(([p]) => p), 'STRATEGY.md', 'NOTES-FOR-HUMAN.md'];

/**
 * An e-mail address in prose. Deliberately NOT a general address matcher: it
 * must not fire on `noreply@anthropic.com` in a commit trailer, on a package
 * name like `@anthropic-ai/sdk`, or on a bare `@mention`. A local part, an `@`,
 * a dotted domain, and a terminal TLD of two letters or more.
 */
const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+\.?[A-Za-z]{2,}\b/g;
const EMAIL_ALLOWED = [/noreply@anthropic\.com/, /@example\.(com|org)\b/];

const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/** The top-level `name:` of a GitHub issue form, which is its text in the chooser. */
function formName(file) {
  const line = read(join(TEMPLATE_DIR, file))
    .split('\n')
    .find((l) => /^name:\s*\S/.test(l));
  return line === undefined ? null : line.replace(/^name:\s*/, '').replace(/^["']|["']$/g, '').trim();
}

function main() {
  const check = process.argv.includes('--check');
  const failures = [];
  const fail = (what, detail = []) => failures.push({ what, detail });

  // 1. Every price in OFFER.md has the address within NEAR lines.
  const offerLines = read('OFFER.md').split('\n');
  const pricedLines = offerLines
    .map((line, i) => ({ line, i }))
    .filter(({ line }) => PRICE.test((PRICE.lastIndex = 0, line)) && /^#{2,3} /.test(line));
  if (pricedLines.length === 0) fail('OFFER.md has no priced HEADING at all, so this check proved nothing');
  for (const { line, i } of pricedLines) {
    const window = offerLines.slice(i, i + NEAR + 1).join('\n');
    if (!window.includes(ISSUE_URL)) {
      fail(`a price in OFFER.md with no way to act on it within ${NEAR} lines`, [
        `line ${i + 1}: ${line.trim()}`,
      ]);
    }
  }

  // 2. Every document that must carry the address does.
  for (const [p, why] of MUST_LINK) {
    if (!existsSync(join(ROOT, p))) fail(`${p} is missing (${why})`);
    else if (!read(p).includes(ISSUE_URL)) fail(`${p} does not link the address (${why})`);
  }

  // 3 and 4. The forms, both directions, and their names.
  const onDisk = existsSync(join(ROOT, TEMPLATE_DIR))
    ? readdirSync(join(ROOT, TEMPLATE_DIR)).filter((f) => f.endsWith('.yml') && f !== 'config.yml').sort()
    : [];
  if (onDisk.length === 0) fail(`${TEMPLATE_DIR} holds no issue forms`);
  const contact = read('CONTACT.md');
  const linked = [...contact.matchAll(/issues\/new\?template=([A-Za-z0-9._-]+\.yml)/g)].map((m) => m[1]);
  for (const f of onDisk) {
    if (!linked.includes(f)) fail(`${TEMPLATE_DIR}/${f} exists and CONTACT.md never links it`);
    else {
      const name = formName(f);
      if (name === null) fail(`${TEMPLATE_DIR}/${f} has no top-level name:`);
      else if (!contact.includes(name)) {
        fail(`${TEMPLATE_DIR}/${f} is called ${JSON.stringify(name)} in GitHub's chooser and CONTACT.md does not use that text`);
      }
    }
  }
  for (const f of new Set(linked)) {
    if (!onDisk.includes(f)) fail(`CONTACT.md links ${TEMPLATE_DIR}/${f}, which does not exist`);
  }

  // 5. config.yml's absolute contact links resolve to paths in this tree.
  const cfgPath = join(TEMPLATE_DIR, 'config.yml');
  if (!existsSync(join(ROOT, cfgPath))) fail(`${cfgPath} is missing, so the chooser has no side panel`);
  else {
    for (const m of read(cfgPath).matchAll(/https:\/\/github\.com\/LoganChu\/Agent_Playground\/blob\/main\/(\S+)/g)) {
      if (!existsSync(join(ROOT, m[1]))) fail(`${cfgPath} points at ${m[1]}, which does not exist`);
    }
  }

  // 6. No e-mail address anywhere in the shipped documents.
  for (const p of NO_EMAIL) {
    if (!existsSync(join(ROOT, p))) continue;
    const hits = [...read(p).matchAll(EMAIL)]
      .map((m) => m[0])
      .filter((a) => !EMAIL_ALLOWED.some((re) => re.test(a)));
    if (hits.length > 0) {
      fail(`${p} publishes ${hits.length} e-mail address(es)`, [...new Set(hits)].slice(0, 6));
    }
  }

  if (failures.length > 0) {
    console.error('The address is not where a buyer would look for it.\n');
    for (const { what, detail } of failures) {
      console.error(`  ${what}`);
      for (const d of detail) console.error(`      ${d}`);
    }
    console.error(
      '\nThis repository priced three products for thirty-four days above a sentence saying\n' +
        'nobody could buy them, while its own Issues tab was open. See CONTACT.md. Fix the\n' +
        'document, not this check.',
    );
    process.exit(1);
  }

  if (check) {
    console.log(
      `ok — ${pricedLines.length} priced headings in OFFER.md each with the address beside it, ` +
        `${MUST_LINK.length} documents linking it, ${onDisk.length} issue forms all linked by ` +
        `CONTACT.md under their own names, 0 e-mail addresses in ${NO_EMAIL.length} documents`,
    );
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

export { ISSUE_URL, MUST_LINK, NEAR, PRICE, EMAIL, EMAIL_ALLOWED, formName };
