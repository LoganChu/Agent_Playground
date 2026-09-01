/**
 * Protocol conformance.
 *
 * Half of these run against the in-process dispatcher and half against the real
 * built binary over a pipe, because they catch different things. The dispatcher
 * tests cover message shapes; the subprocess tests cover the two ways a stdio
 * MCP server actually fails in the wild — something other than JSON-RPC on
 * stdout, and a message split across chunk boundaries.
 */
import { strict as assert } from 'node:assert';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

import {
  PREFERRED_PROTOCOL_VERSION,
  TOOLS,
  SERVER_INFO,
  SUPPORTED_PROTOCOL_VERSIONS,
  createLineHandler,
  handleMessage,
} from '../dist/index.js';

const CLI = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'cli.js');

/** Drive the real binary with a list of messages and collect every line it writes. */
function runServer(messages, { splitEveryNBytes = 0 } = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [CLI], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', rejectPromise);
    child.on('close', (code) => {
      const lines = stdout.split('\n').filter((line) => line.trim() !== '');
      resolvePromise({ code, stderr, lines, responses: lines.map((line) => JSON.parse(line)) });
    });

    const payload = messages.map((m) => (typeof m === 'string' ? m : JSON.stringify(m))).join('\n') + '\n';
    if (splitEveryNBytes > 0) {
      for (let i = 0; i < payload.length; i += splitEveryNBytes) {
        child.stdin.write(payload.slice(i, i + splitEveryNBytes));
      }
    } else {
      child.stdin.write(payload);
    }
    child.stdin.end();
  });
}

const initialize = (protocolVersion = PREFERRED_PROTOCOL_VERSION, id = 1) => ({
  jsonrpc: '2.0',
  id,
  method: 'initialize',
  params: { protocolVersion, capabilities: {}, clientInfo: { name: 'test', version: '1' } },
});

// ---------------------------------------------------------------------------
// Handshake
// ---------------------------------------------------------------------------

test('initialize returns the negotiated version, capabilities and server info', () => {
  const response = handleMessage(initialize());
  assert.equal(response.jsonrpc, '2.0');
  assert.equal(response.id, 1);
  assert.equal(response.result.protocolVersion, PREFERRED_PROTOCOL_VERSION);
  assert.deepEqual(response.result.capabilities, { tools: { listChanged: false } });
  assert.equal(response.result.serverInfo.name, 'us-tax-mcp');
  assert.equal(typeof response.result.instructions, 'string');
});

test('every supported protocol version is echoed back verbatim', () => {
  for (const version of SUPPORTED_PROTOCOL_VERSIONS) {
    const response = handleMessage(initialize(version));
    assert.equal(
      response.result.protocolVersion,
      version,
      `expected ${version} to be echoed, got ${response.result.protocolVersion}`,
    );
  }
});

test('an unknown protocol version falls back to the preferred one rather than erroring', () => {
  // The spec says the server names the version it wants and the client
  // disconnects if it cannot live with it. Failing the handshake outright would
  // strand a newer client that would otherwise have downgraded happily.
  const response = handleMessage(initialize('1999-01-01'));
  assert.ok(!('error' in response));
  assert.equal(response.result.protocolVersion, PREFERRED_PROTOCOL_VERSION);
});

test('serverInfo.version matches package.json', async () => {
  const { default: pkg } = await import('../package.json', { with: { type: 'json' } });
  assert.equal(SERVER_INFO.version, pkg.version);
});

// ---------------------------------------------------------------------------
// Statelessness — the 2026-07-28 revision removes initialize entirely
// ---------------------------------------------------------------------------

test('tools/list and tools/call work without an initialize handshake', async () => {
  const { responses } = await runServer([
    { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'list_supported_years', arguments: {} },
    },
  ]);
  assert.equal(responses.length, 2);
  assert.ok(Array.isArray(responses[0].result.tools));
  assert.equal(responses[1].result.isError, false);
  assert.ok(responses[1].result.content[0].text.includes('2026'));
});

test('notifications are never answered', () => {
  assert.equal(handleMessage({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  assert.equal(handleMessage({ jsonrpc: '2.0', method: 'notifications/cancelled' }), null);
  assert.equal(handleMessage({ jsonrpc: '2.0', method: 'tools/list' }), null);
  assert.equal(handleMessage({ jsonrpc: '2.0', method: 'something/unknown' }), null);
});

test('an explicit null id is a request, not a notification', () => {
  // JSON-RPC 2.0 defines a notification as a message with no `id` member at
  // all. `id: null` is a request whose id happens to be null, and dropping it
  // would hang a client that sent one.
  const response = handleMessage({ jsonrpc: '2.0', id: null, method: 'ping' });
  assert.notEqual(response, null);
  assert.equal(response.id, null);
  assert.deepEqual(response.result, {});
});

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

test('an unknown method is a JSON-RPC method-not-found error', () => {
  const response = handleMessage({ jsonrpc: '2.0', id: 7, method: 'nope' });
  assert.equal(response.error.code, -32601);
  assert.match(response.error.message, /nope/);
});

test('an unknown tool name is a protocol error, but a bad argument is a tool error', () => {
  const unknownTool = handleMessage({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name: 'no_such_tool', arguments: {} },
  });
  assert.equal(unknownTool.error.code, -32601);
  assert.match(unknownTool.error.message, /estimate_federal_tax/);

  // A model can recover from a bad argument by reading the message and trying
  // again, so it comes back as a result with isError rather than as a protocol
  // failure the client swallows.
  const badArgument = handleMessage({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: 'estimate_federal_tax', arguments: { filingStatus: 'martian' } },
  });
  assert.ok(!('error' in badArgument));
  assert.equal(badArgument.result.isError, true);
  assert.match(badArgument.result.content[0].text, /martian/);
});

test('an unsupported tax year is an error naming the supported ones, not a silent fallback', () => {
  const response = handleMessage({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name: 'estimate_federal_tax', arguments: { filingStatus: 'single', year: 2019 } },
  });
  assert.equal(response.result.isError, true);
  assert.match(response.result.content[0].text, /2019/);
  assert.match(response.result.content[0].text, /2024, 2025, 2026/);
});

test('malformed JSON gets a parse error with a null id', () => {
  const handle = createLineHandler();
  const response = JSON.parse(handle('{not json'));
  assert.equal(response.error.code, -32700);
  assert.equal(response.id, null);
});

test('a non-object message is an invalid request', () => {
  assert.equal(handleMessage(42).error.code, -32600);
  assert.equal(handleMessage('hello').error.code, -32600);
  assert.equal(handleMessage(null).error.code, -32600);
});

test('blank lines produce no output at all', () => {
  const handle = createLineHandler();
  assert.equal(handle(''), null);
  assert.equal(handle('   '), null);
  assert.equal(handle('\t'), null);
});

// ---------------------------------------------------------------------------
// Optional methods a client may probe during startup
// ---------------------------------------------------------------------------

test('resources and prompts return empty lists rather than errors', () => {
  for (const [method, key] of [
    ['resources/list', 'resources'],
    ['resources/templates/list', 'resourceTemplates'],
    ['prompts/list', 'prompts'],
  ]) {
    const response = handleMessage({ jsonrpc: '2.0', id: 1, method });
    assert.ok(!('error' in response), `${method} should not error`);
    assert.deepEqual(response.result[key], []);
  }
});

// ---------------------------------------------------------------------------
// Batches
// ---------------------------------------------------------------------------

test('a batch returns an array of only the responses that were requested', () => {
  const handle = createLineHandler();
  const output = handle(
    JSON.stringify([
      { jsonrpc: '2.0', id: 1, method: 'ping' },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 2, method: 'ping' },
    ]),
  );
  const responses = JSON.parse(output);
  assert.equal(responses.length, 2);
  assert.deepEqual(
    responses.map((r) => r.id),
    [1, 2],
  );
});

test('a batch of only notifications produces no response', () => {
  const handle = createLineHandler();
  assert.equal(handle(JSON.stringify([{ jsonrpc: '2.0', method: 'notifications/initialized' }])), null);
});

test('an empty batch is an invalid request', () => {
  const handle = createLineHandler();
  assert.equal(JSON.parse(handle('[]')).error.code, -32600);
});

// ---------------------------------------------------------------------------
// The transport itself
// ---------------------------------------------------------------------------

test('stdout carries JSON-RPC and nothing else', async () => {
  const { lines, code } = await runServer([initialize(), { jsonrpc: '2.0', id: 2, method: 'tools/list' }]);
  assert.equal(code, 0);
  for (const line of lines) {
    // Anything non-JSON on stdout corrupts the stream and disconnects the
    // client with an unhelpful parse error, so this is the single most
    // important property of a stdio server.
    assert.doesNotThrow(() => JSON.parse(line), `stdout line was not JSON: ${line}`);
  }
});

test('a message split across chunk boundaries is reassembled', async () => {
  // A one-byte-at-a-time write is the pathological case for framing by chunk
  // rather than by line.
  const { responses } = await runServer([initialize(), { jsonrpc: '2.0', id: 2, method: 'tools/list' }], {
    splitEveryNBytes: 1,
  });
  assert.equal(responses.length, 2);
  assert.equal(responses[0].result.protocolVersion, PREFERRED_PROTOCOL_VERSION);
  assert.equal(responses[1].result.tools.length, TOOLS.length);
});

test('a final message with no trailing newline is still answered', async () => {
  const child = spawn(process.execPath, [CLI], { stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }));
  child.stdin.end();
  await new Promise((r) => child.on('close', r));
  assert.deepEqual(JSON.parse(stdout.trim()).result, {});
});

test('the server exits cleanly when stdin closes', async () => {
  const { code } = await runServer([{ jsonrpc: '2.0', id: 1, method: 'ping' }]);
  assert.equal(code, 0);
});

test('--help writes to stderr, never to stdout', async () => {
  const child = spawn(process.execPath, [CLI, '--help'], { stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (c) => {
    stdout += c;
  });
  child.stderr.on('data', (c) => {
    stderr += c;
  });
  const code = await new Promise((r) => child.on('close', r));
  assert.equal(code, 0);
  assert.equal(stdout, '');
  assert.match(stderr, /estimate_federal_tax/);
});
