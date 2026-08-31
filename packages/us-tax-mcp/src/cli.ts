#!/usr/bin/env node
/**
 * `us-tax-mcp` — the executable entry point.
 *
 * Configure it in an MCP client as:
 *
 *     { "mcpServers": { "us-tax": { "command": "npx", "args": ["-y", "us-tax-mcp"] } } }
 *
 * `--help` and `--version` are answered on stderr and exit, so that neither can
 * ever be mistaken for a protocol message on stdout.
 */
import { SERVER_INFO, PREFERRED_PROTOCOL_VERSION } from './protocol.js';
import { serve } from './stdio.js';
import { TOOLS } from './tools.js';

const argv = process.argv.slice(2);

if (argv.includes('--help') || argv.includes('-h')) {
  process.stderr.write(
    [
      `${SERVER_INFO.name} ${SERVER_INFO.version} — US federal tax as an MCP server.`,
      '',
      'Speaks the Model Context Protocol over stdio. It is not an interactive CLI:',
      'run it from an MCP client, not from a terminal.',
      '',
      `Protocol version: ${PREFERRED_PROTOCOL_VERSION} (older revisions are negotiated).`,
      '',
      'Tools:',
      ...TOOLS.map((tool) => `  ${tool.name.padEnd(30)} ${tool.title}`),
      '',
      'Client configuration:',
      '  { "mcpServers": { "us-tax": { "command": "npx", "args": ["-y", "us-tax-mcp"] } } }',
      '',
    ].join('\n'),
  );
  process.exit(0);
}

if (argv.includes('--version') || argv.includes('-v')) {
  process.stderr.write(`${SERVER_INFO.version}\n`);
  process.exit(0);
}

process.stdin.setEncoding('utf8');

serve().then(
  () => process.exit(0),
  (error: unknown) => {
    process.stderr.write(`us-tax-mcp: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  },
);
