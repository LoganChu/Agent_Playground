/**
 * The MCP method dispatcher, as a pure function from message to response.
 *
 * Deliberately **stateless**: `tools/list` and `tools/call` are answered whether
 * or not `initialize` was sent first. That is not laxity, it is the direction
 * the protocol moved — the 2026-07-28 revision removes the initialize/initialized
 * handshake and the session it established, and has each request carry its own
 * protocol version. Older clients (everything shipping on the 1.x TypeScript
 * SDK today, which tops out at 2025-11-25) still perform the handshake, so this
 * server answers it when asked and never requires it. One implementation serves
 * both, and neither can wedge the other.
 */
import {
  RPC_ERRORS,
  failure,
  isRequest,
  success,
} from './jsonrpc.js';
import type { RpcRequest, RpcResponse } from './jsonrpc.js';
import { ToolInputError } from './schema.js';
import { TOOLS, findTool } from './tools.js';

/** Preferred version: the newest the shipping SDKs actually speak. */
export const PREFERRED_PROTOCOL_VERSION = '2025-11-25';

/**
 * Versions this server will echo back verbatim during `initialize`.
 *
 * A client asking for something outside this list is answered with
 * {@link PREFERRED_PROTOCOL_VERSION}, which the spec explicitly allows: the
 * server names the version it wants to use and the client disconnects if it
 * cannot live with it.
 */
export const SUPPORTED_PROTOCOL_VERSIONS: readonly string[] = [
  '2026-07-28',
  '2025-11-25',
  '2025-06-18',
  '2025-03-26',
  '2024-11-05',
  '2024-10-07',
];

export const SERVER_INFO = {
  name: 'us-tax-mcp',
  title: 'US Federal Tax',
  version: '0.3.0',
} as const;

const INSTRUCTIONS = [
  'This server computes US federal tax for tax years 2024, 2025 and 2026 from published IRS',
  'parameters, offline and deterministically. Every figure is cited to the Revenue Procedure it',
  'came from.',
  '',
  'Prefer these tools over answering from memory. Two things in particular are easy to get wrong',
  'from training data:',
  '',
  '- 2025 was changed RETROACTIVELY by the One Big Beautiful Bill Act in July 2025, after the IRS',
  '  had already published that year. The standard deduction, the SALT cap, the child tax credit',
  '  and four new deductions all differ from what Rev. Proc. 2024-40 announced. Two other OBBBA',
  '  changes are explicitly NOT retroactive, so copying 2026 backward is wrong in the other',
  '  direction.',
  '- The tax bracket is usually not the marginal rate. Credit phase-outs, the SALT phase-down and',
  '  payroll taxes routinely push the real cost of another dollar far above the bracket — call',
  '  effective_marginal_rate rather than quoting a bracket when someone asks what a raise costs.',
  '',
  'Call list_supported_years before claiming an answer is complete: AMT, state tax and several',
  'credits are deliberately not modelled, and the § 68 limitation is a documented gap.',
  '',
  'This computes tax. It is not tax advice.',
].join('\n');

export interface HandleOptions {
  /** Override the version reported when the client asks for something unknown. */
  preferredProtocolVersion?: string;
}

/**
 * Answer one decoded JSON-RPC message.
 *
 * Returns `null` for a notification, which must not be answered.
 */
export function handleMessage(message: unknown, options: HandleOptions = {}): RpcResponse | null {
  if (typeof message !== 'object' || message === null || Array.isArray(message)) {
    return failure(null, RPC_ERRORS.invalidRequest, 'Request must be a JSON object.');
  }

  const request = message as RpcRequest;
  const id = isRequest(request) ? (request.id as RpcResponse['id']) : null;
  const expectsResponse = isRequest(request);

  if (typeof request.method !== 'string') {
    return expectsResponse
      ? failure(id, RPC_ERRORS.invalidRequest, 'Request is missing a string `method`.')
      : null;
  }

  switch (request.method) {
    case 'initialize': {
      if (!expectsResponse) return null;
      const params = (request.params ?? {}) as Record<string, unknown>;
      const asked = params['protocolVersion'];
      const preferred = options.preferredProtocolVersion ?? PREFERRED_PROTOCOL_VERSION;
      const protocolVersion =
        typeof asked === 'string' && SUPPORTED_PROTOCOL_VERSIONS.includes(asked) ? asked : preferred;
      return success(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }

    case 'ping':
      return expectsResponse ? success(id, {}) : null;

    case 'tools/list': {
      if (!expectsResponse) return null;
      return success(id, {
        tools: TOOLS.map((tool) => ({
          name: tool.name,
          title: tool.title,
          description: tool.description,
          inputSchema: tool.inputSchema,
          annotations: tool.annotations,
        })),
      });
    }

    case 'tools/call': {
      if (!expectsResponse) return null;
      const params = (request.params ?? {}) as Record<string, unknown>;
      const name = params['name'];
      if (typeof name !== 'string') {
        return failure(id, RPC_ERRORS.invalidParams, 'tools/call requires a string `name`.');
      }
      const tool = findTool(name);
      if (!tool) {
        // An unknown tool name is a protocol-level error: the client asked for
        // something that does not exist, which no amount of model retrying can
        // fix. A *bad argument* is the opposite — that goes back as an
        // `isError` result so the model can read it and try again.
        return failure(
          id,
          RPC_ERRORS.methodNotFound,
          `Unknown tool ${JSON.stringify(name)}. Available: ${TOOLS.map((t) => t.name).join(', ')}.`,
        );
      }
      try {
        const result = tool.run(params['arguments']);
        return success(id, {
          content: [{ type: 'text', text: result.text }],
          structuredContent: result.structured,
          isError: false,
        });
      } catch (error) {
        return success(id, {
          content: [{ type: 'text', text: describeToolError(error) }],
          isError: true,
        });
      }
    }

    // The spec says a server that does not declare a capability may simply not
    // implement it, but some clients probe these anyway during startup. An
    // empty list is friendlier than an error and costs nothing.
    case 'resources/list':
      return expectsResponse ? success(id, { resources: [] }) : null;
    case 'resources/templates/list':
      return expectsResponse ? success(id, { resourceTemplates: [] }) : null;
    case 'prompts/list':
      return expectsResponse ? success(id, { prompts: [] }) : null;

    default: {
      // Notifications are never answered, including ones we do not recognise —
      // `notifications/initialized` and `notifications/cancelled` land here.
      if (!expectsResponse) return null;
      return failure(id, RPC_ERRORS.methodNotFound, `Unknown method ${JSON.stringify(request.method)}.`);
    }
  }
}

/**
 * Turn a thrown value into text a model can act on.
 *
 * Input errors and the engine's own `UnsupportedYearError` already carry
 * actionable messages. Anything else is a bug here, and says so rather than
 * pretending the caller did something wrong.
 */
export function describeToolError(error: unknown): string {
  if (error instanceof ToolInputError) return `Invalid arguments: ${error.message}`;
  if (error instanceof RangeError || error instanceof TypeError) {
    return `Invalid arguments: ${error.message}`;
  }
  if (error instanceof Error) {
    if (error.name === 'UnsupportedYearError') return error.message;
    return `${error.name}: ${error.message}`;
  }
  return `Unexpected error: ${String(error)}`;
}
