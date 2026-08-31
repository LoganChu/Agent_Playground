/**
 * `us-tax-mcp` as a library, for embedding the tools in a server you already
 * run rather than spawning this one.
 *
 * `handleMessage` is a pure function from a decoded JSON-RPC message to a
 * response, so mounting these tools behind HTTP, a worker, or an existing MCP
 * server is a matter of routing — there is no hidden state and no I/O.
 */
export { handleMessage, describeToolError, PREFERRED_PROTOCOL_VERSION, SERVER_INFO, SUPPORTED_PROTOCOL_VERSIONS } from './protocol.js';
export type { HandleOptions } from './protocol.js';

export { createLineHandler, serve } from './stdio.js';
export type { StdioOptions } from './stdio.js';

export { TOOLS, findTool } from './tools.js';
export type { ToolDefinition, ToolResult } from './tools.js';

export { RPC_ERRORS, failure, isRequest, success } from './jsonrpc.js';
export type { RpcFailure, RpcId, RpcRequest, RpcResponse, RpcSuccess } from './jsonrpc.js';

export { ToolInputError, readHousehold } from './schema.js';

/** The whole tax engine, re-exported so an embedder needs only one package. */
export * from './engine/index.js';
