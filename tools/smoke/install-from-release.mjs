/**
 * Install the three packages the way a stranger would, from the public release
 * URLs the READMEs advertise, and check that they work.
 *
 * ## Why this exists
 *
 * Day 20 found that the claim "these packages cannot be installed by anyone"
 * had been false for fourteen days, and replaced it with a claim in four
 * READMEs: `npm i <release tarball URL>` for the libraries and `npx -y <release
 * tarball URL>` for the MCP server, with no registry, no account and no token.
 *
 * **Seventeen days later nothing had ever run that line.** Day 37 ran it by hand
 * and it worked — and the first call written against the installed package
 * returned a total tax of `$0` on a household with `$180,000` of wages, because
 * the field is `w2Wages` and the call said `wages`. Everything the repository's
 * own 1,143 tests check was fine. What was not checked was the experience of
 * being a stranger holding the install line.
 *
 * **THE RULE: a suite tests the code; only an install tests the product.** Every
 * test in this repository imports from a relative path inside a checkout that
 * has just been built. None of them can fail because of a missing `files` entry,
 * a broken `exports` map, a `bin` that is not executable, a tarball that was
 * never uploaded, or a README that advertises a version that does not exist.
 *
 * ## What it checks
 *
 * 1. Both libraries install from their release URLs into an empty directory.
 * 2. Each resolves through its `exports` map and computes a known answer.
 * 3. Each declares **zero** runtime dependencies — read from the installed
 *    `package.json`, which is the only copy of that claim a user ever sees.
 * 4. The MCP server runs via `npx -y <url>` and speaks the protocol: it answers
 *    `initialize`, lists its tools, and serves a `tools/call`.
 *
 * ## How it is run
 *
 * ```sh
 * node tools/smoke/install-from-release.mjs            # versions from package.json
 * node tools/smoke/install-from-release.mjs --ref main # a different owner/repo
 * ```
 *
 * It needs the network and it needs the releases to exist, so it is NOT part of
 * `npm test` in any package. It runs in the `Distribute` workflow after the
 * release is created, which is the moment the URLs first resolve.
 */
import { execFileSync } from 'node:child_process';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPO = process.env.SMOKE_REPO ?? 'LoganChu/Agent_Playground';

const version = (name) =>
  JSON.parse(readFileSync(join(ROOT, 'packages', name, 'package.json'), 'utf8')).version;

/** The URL each README advertises, built the same way the release workflow builds it. */
const tarball = (name) =>
  `https://github.com/${REPO}/releases/download/${name}-v${version(name)}/${name}-${version(name)}.tgz`;

const fail = (message) => {
  process.stderr.write(`\n[smoke] FAILED: ${message}\n`);
  process.exit(1);
};

const work = mkdtempSync(join(tmpdir(), 'us-tax-smoke-'));
process.stdout.write(`[smoke] repo ${REPO}\n[smoke] working in ${work}\n`);
writeFileSync(join(work, 'package.json'), JSON.stringify({ name: 'smoke', private: true, type: 'module' }));

// ---------------------------------------------------------------------------
// 1 and 2: the libraries install and compute.
// ---------------------------------------------------------------------------
const libraries = ['us-federal-tax', 'us-state-tax'];
for (const name of libraries) process.stdout.write(`[smoke] installing ${tarball(name)}\n`);
try {
  execFileSync('npm', ['install', '--no-audit', '--no-fund', ...libraries.map(tarball)], {
    cwd: work,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
} catch (error) {
  fail(`npm install from the release URLs: ${(error.stderr ?? error.message).trim().split('\n').slice(-6).join('\n')}`);
}

// A joint return with wages and two dependents, through both engines, with the
// state engine taking the federal engine's own output as its basis — which is
// the integration the two packages are designed around and the one a relative
// import inside a checkout proves nothing about.
writeFileSync(
  join(work, 'check.mjs'),
  `import { estimateFederalTax } from 'us-federal-tax';
import { stateIncomeTax, stateFigureProvenance, getStateDefinition } from 'us-state-tax';
const federal = estimateFederalTax({
  filingStatus: 'marriedFilingJointly', year: 2026, w2Wages: 180_000, qualifyingChildren: 2,
});
const maryland = stateIncomeTax({
  state: 'MD', year: 2026, filingStatus: 'marriedFilingJointly', county: 'Montgomery', dependents: 2,
  federal: {
    adjustedGrossIncome: federal.adjustedGrossIncome,
    taxableIncome: federal.taxableIncome,
    deduction: federal.deduction,
    deductionKind: federal.deductionKind,
  },
});
const california = getStateDefinition('CA', 2026);
console.log(JSON.stringify({
  federalAgi: federal.adjustedGrossIncome,
  federalTotalTax: federal.totalTax,
  marylandTax: maryland.tax,
  marylandLocal: maryland.localTaxes.reduce((sum, row) => sum + row.tax, 0),
  caRateKind: stateFigureProvenance(california, 'CA', 2026, 'rate.byStatus.single.4.rate').kind,
  caThresholdKind: stateFigureProvenance(california, 'CA', 2026, 'rate.byStatus.single.4.upTo').kind,
}));
`,
);
let computed;
try {
  computed = JSON.parse(
    execFileSync('node', ['check.mjs'], { cwd: work, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }),
  );
} catch (error) {
  fail(`importing the installed packages: ${(error.stderr ?? error.message).trim().split('\n').slice(-8).join('\n')}`);
}

// Levels, not differences — the whole point of a smoke test is to catch an
// engine that returns a complete, internally consistent estimate of nothing.
// `$0` was what Day 37's first external call got back, and every ratio in it
// was self-consistent.
const expected = { federalAgi: 180_000, caRateKind: 'statute', caThresholdKind: 'carried-forward' };
for (const [key, want] of Object.entries(expected)) {
  if (computed[key] !== want) fail(`${key} is ${JSON.stringify(computed[key])}, expected ${JSON.stringify(want)}`);
}
for (const key of ['federalTotalTax', 'marylandTax', 'marylandLocal']) {
  if (!(computed[key] > 0)) fail(`${key} is ${computed[key]} on a $180,000 household`);
}
process.stdout.write(
  `[smoke] computed: federal $${computed.federalTotalTax}, Maryland $${computed.marylandTax}, ` +
    `Montgomery County $${computed.marylandLocal}\n` +
    `[smoke] ledger through the published package: rate=${computed.caRateKind}, ` +
    `threshold=${computed.caThresholdKind}\n`,
);

// ---------------------------------------------------------------------------
// 3: zero runtime dependencies, read from the installed copy.
// ---------------------------------------------------------------------------
for (const name of libraries) {
  const installed = JSON.parse(readFileSync(join(work, 'node_modules', name, 'package.json'), 'utf8'));
  const count = Object.keys(installed.dependencies ?? {}).length;
  if (count !== 0) fail(`${name}@${installed.version} declares ${count} runtime dependencies`);
  if (installed.version !== version(name)) {
    fail(`${name}: installed ${installed.version} from a URL that names ${version(name)}`);
  }
  process.stdout.write(`[smoke] ${name}@${installed.version}: 0 runtime dependencies\n`);
}

// ---------------------------------------------------------------------------
// 4: the MCP server runs from its tarball and speaks the protocol.
// ---------------------------------------------------------------------------
const url = tarball('us-tax-mcp');
process.stdout.write(`[smoke] npx -y ${url}\n`);
const child = spawn('npx', ['-y', url], { cwd: work, stdio: ['pipe', 'pipe', 'pipe'] });
let stderr = '';
child.stderr.on('data', (chunk) => {
  stderr += chunk;
});
const replies = new Map();
let buffer = '';
child.stdout.on('data', (chunk) => {
  buffer += chunk;
  const lines = buffer.split('\n');
  buffer = lines.pop() ?? '';
  for (const line of lines) {
    if (line.trim() === '') continue;
    try {
      const message = JSON.parse(line);
      if (message.id !== undefined) replies.set(message.id, message);
    } catch {
      // A server that prints anything but JSON-RPC on stdout is a defect in
      // itself, and `await reply` below will time out saying which id is
      // missing rather than throwing here.
    }
  }
});

const send = (id, method, params) =>
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);

/** Wait for one reply, or give up and say which one never came. */
const reply = async (id, what) => {
  for (let waited = 0; waited < 120_000; waited += 250) {
    if (replies.has(id)) return replies.get(id);
    if (child.exitCode !== null) {
      fail(`the server exited with ${child.exitCode} before answering ${what}. stderr:\n${stderr.trim()}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  fail(`no reply to ${what} within 120s. stderr:\n${stderr.trim()}`);
  return undefined;
};

send(1, 'initialize', {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'us-tax-smoke', version: '0' },
});
const initialize = await reply(1, 'initialize');
const serverInfo = initialize.result?.serverInfo;
if (serverInfo?.name !== 'us-tax-mcp') fail(`initialize returned ${JSON.stringify(serverInfo)}`);
if (serverInfo.version !== version('us-tax-mcp')) {
  fail(`the server reports ${serverInfo.version} and the URL names ${version('us-tax-mcp')}`);
}
process.stdout.write(`[smoke] ${serverInfo.name}@${serverInfo.version} answered initialize\n`);

send(2, 'tools/list', {});
const list = await reply(2, 'tools/list');
const tools = (list.result?.tools ?? []).map((tool) => tool.name);
if (tools.length === 0) fail('tools/list returned nothing');
process.stdout.write(`[smoke] ${tools.length} tools: ${tools.join(', ')}\n`);

// One call, and deliberately the one that answers from the state provenance
// ledger: it is the newest surface, it reads a vendored copy of the state
// engine, and a vendoring mistake is exactly the class of defect no test inside
// a checkout can see.
send(3, 'tools/call', {
  name: 'figure_provenance',
  arguments: { state: 'CA', year: 2026, figure: 'rate.byStatus.single.4.upTo' },
});
const call = await reply(3, 'tools/call');
const text = call.result?.content?.[0]?.text ?? '';
if (!/carried-forward/.test(text)) {
  fail(`figure_provenance did not report a carry-forward. It said:\n${text || JSON.stringify(call)}`);
}
process.stdout.write(`[smoke] figure_provenance: ${text.split('\n')[0]}\n`);

child.kill();
process.stdout.write('\n[smoke] OK — every install line the READMEs advertise works.\n');
