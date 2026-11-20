/**
 * THE ADDRESS CHECK, VERIFIED BY REINTRODUCING EACH DEFECT IT EXISTS TO CATCH.
 *
 * `contact-address.mjs` was green on its second run and caught one real gap on
 * its first. That is not evidence that it would catch the next one. Day 85's
 * entry has the reason stated twice: a gate is checked by putting the defect
 * back and watching it go red, and on that day one of three reintroductions
 * silently failed to match and the gate looked stronger than it was.
 *
 * So each test here builds a minimal tree in a temp directory, runs the checker
 * against it with `CONTACT_ROOT`, and asserts on the exit code AND on which
 * failure it named — because a check that fails for the wrong reason is a check
 * that will pass for the wrong reason.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MUST_LINK, ISSUE_URL, EMAIL, EMAIL_ALLOWED } from './contact-address.mjs';

const TOOL = resolve(dirname(fileURLToPath(import.meta.url)), 'contact-address.mjs');

const FORM = (name) => `name: ${name}\ndescription: d\nbody:\n  - type: markdown\n    attributes:\n      value: hi\n`;

/** A tree that passes, which every test below then breaks in exactly one way. */
function goodTree(overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'contact-'));
  const files = {
    'OFFER.md': `# prices\n\n## 1. The audit — $2,500, one-off\n\nBuy it at ${ISSUE_URL}/choose.\n`,
    'CONTACT.md':
      `# address\n\n${ISSUE_URL}/choose\n\n` +
      `[Licensing or commercial enquiry](${ISSUE_URL}?template=01-commercial.yml)\n`,
    '.github/ISSUE_TEMPLATE/01-commercial.yml': FORM('Licensing or commercial enquiry'),
    '.github/ISSUE_TEMPLATE/config.yml':
      'blank_issues_enabled: true\ncontact_links:\n  - name: n\n    url: https://github.com/LoganChu/Agent_Playground/blob/main/OFFER.md\n    about: a\n',
  };
  for (const [p] of MUST_LINK) files[p] ??= `# ${p}\n\nsee ${ISSUE_URL}/choose\n`;
  for (const [p, body] of Object.entries({ ...files, ...overrides })) {
    if (body === null) continue;
    mkdirSync(join(root, dirname(p)), { recursive: true });
    writeFileSync(join(root, p), body);
  }
  return root;
}

function run(root) {
  try {
    return { code: 0, out: execFileSync(process.execPath, [TOOL, '--check'], { env: { ...process.env, CONTACT_ROOT: root }, encoding: 'utf8' }) };
  } catch (err) {
    return { code: err.status, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

const withTree = (overrides, fn) => {
  const root = goodTree(overrides);
  try {
    fn(run(root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

test('the fixture itself passes, or every test below proves nothing', () => {
  withTree({}, ({ code, out }) => {
    assert.equal(code, 0, out);
    assert.match(out, /^ok — 1 priced heading/);
  });
});

test('a price with no address beside it is caught', () => {
  withTree(
    { 'OFFER.md': '# prices\n\n## 1. The audit — $2,500, one-off\n\nNo way to act on it at all.\n' },
    ({ code, out }) => {
      assert.equal(code, 1);
      assert.match(out, /a price in OFFER\.md with no way to act on it/);
      assert.match(out, /\$2,500/);
    },
  );
});

test('an address five lines below a price does NOT count as beside it', () => {
  withTree(
    {
      'OFFER.md':
        `# prices\n\n## 1. The audit — $2,500, one-off\n\na\n\nb\n\nc\n\n${ISSUE_URL}/choose\n`,
    },
    ({ code, out }) => {
      assert.equal(code, 1, 'the window is deliberately narrow; a link in the next section is not a link under the price');
      assert.match(out, /within 4 lines/);
    },
  );
});

test('a package README that drops the address is caught, one per document', () => {
  withTree({ 'packages/us-state-tax/README.md': '# us-state-tax\n\nno address here\n' }, ({ code, out }) => {
    assert.equal(code, 1);
    assert.match(out, /packages\/us-state-tax\/README\.md does not link the address/);
    assert.match(out, /what npm shows for us-state-tax/, 'the failure says why that document is on the list');
  });
});

test('a form on disk that CONTACT.md never links is caught', () => {
  withTree({ '.github/ISSUE_TEMPLATE/09-orphan.yml': FORM('Orphan') }, ({ code, out }) => {
    assert.equal(code, 1);
    assert.match(out, /09-orphan\.yml exists and CONTACT\.md never links it/);
  });
});

test('a form CONTACT.md links that is not on disk is caught — the 404 under a price', () => {
  withTree(
    {
      'CONTACT.md':
        `# address\n\n${ISSUE_URL}/choose\n\n[Licensing or commercial enquiry](${ISSUE_URL}?template=01-commercial.yml)\n` +
        `[Gone](${ISSUE_URL}?template=99-missing.yml)\n`,
    },
    ({ code, out }) => {
      assert.equal(code, 1);
      assert.match(out, /links .*99-missing\.yml, which does not exist/);
    },
  );
});

test("a form renamed in GitHub's chooser and not in the document is caught", () => {
  withTree({ '.github/ISSUE_TEMPLATE/01-commercial.yml': FORM('Commercial enquiries (new name)') }, ({ code, out }) => {
    assert.equal(code, 1);
    assert.match(out, /is called "Commercial enquiries \(new name\)" in GitHub's chooser/);
  });
});

test('a config.yml contact link pointing at a path that is gone is caught', () => {
  withTree(
    {
      '.github/ISSUE_TEMPLATE/config.yml':
        'blank_issues_enabled: true\ncontact_links:\n  - name: n\n    url: https://github.com/LoganChu/Agent_Playground/blob/main/NOPE.md\n    about: a\n',
    },
    ({ code, out }) => {
      assert.equal(code, 1);
      assert.match(out, /points at NOPE\.md, which does not exist/);
    },
  );
});

test('an e-mail address published under a price is caught — the remedy that was being asked for', () => {
  withTree(
    {
      'OFFER.md': `# prices\n\n## 1. The audit — $2,500, one-off\n\nBuy it at ${ISSUE_URL}/choose or mail someone@example.net.\n`,
    },
    ({ code, out }) => {
      assert.equal(code, 1);
      assert.match(out, /OFFER\.md publishes 1 e-mail address/);
      assert.match(out, /someone@example\.net/);
    },
  );
});

test('and the e-mail matcher does not fire on the things that look like one', () => {
  const notEmails = ['@anthropic-ai/sdk', 'a @mention in prose', 'us-state-tax@0.65.0', '§ 63(c) at 2026'];
  for (const s of notEmails) {
    assert.deepEqual([...s.matchAll(EMAIL)].map((m) => m[0]), [], `fired on ${JSON.stringify(s)}`);
  }
  // The commit trailer this project signs every commit with must stay allowed,
  // or the gate goes red on a file that quotes its own history.
  assert.ok(EMAIL_ALLOWED.some((re) => re.test('noreply@anthropic.com')));
});

test('an OFFER.md with no priced heading fails rather than reporting success over nothing', () => {
  withTree({ 'OFFER.md': `# prices\n\nnothing is priced here\n\n${ISSUE_URL}/choose\n` }, ({ code, out }) => {
    assert.equal(code, 1, 'zero prices checked is a broken check, not a clean tree');
    assert.match(out, /no priced HEADING at all/);
  });
});
