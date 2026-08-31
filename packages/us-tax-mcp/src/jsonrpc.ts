/**
 * The JSON-RPC 2.0 subset that MCP uses.
 *
 * MCP has no framing beyond "one JSON value per line" on stdio, and the message
 * shapes are plain JSON-RPC. That is small enough to implement directly, which
 * is why this package has no dependencies at all — see the README for why that
 * is worth something for a server that gets spawned once per conversation.
 */

/** A JSON-RPC id. Notifications have none. */
export type RpcId = string | number | null;

export interface RpcRequest {
  jsonrpc: '2.0';
  id?: RpcId;
  method: string;
  params?: unknown;
}

export interface RpcSuccess {
  jsonrpc: '2.0';
  id: RpcId;
  result: unknown;
}

export interface RpcFailure {
  jsonrpc: '2.0';
  id: RpcId;
  error: { code: number; message: string; data?: unknown };
}

export type RpcResponse = RpcSuccess | RpcFailure;

/** The standard JSON-RPC 2.0 error codes, which MCP reuses unchanged. */
export const RPC_ERRORS = {
  parseError: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internalError: -32603,
} as const;

export function success(id: RpcId, result: unknown): RpcSuccess {
  return { jsonrpc: '2.0', id, result };
}

export function failure(id: RpcId, code: number, message: string, data?: unknown): RpcFailure {
  const error: RpcFailure['error'] = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: '2.0', id, error };
}

/**
 * Whether a decoded message is a request (expects a response) rather than a
 * notification (must not be answered).
 *
 * JSON-RPC 2.0 says a notification is a message with *no* `id` member. An
 * explicit `id: null` is a request with a null id, and answering it is correct —
 * so this tests for the member's presence, not its truthiness.
 */
export function isRequest(message: RpcRequest): boolean {
  return 'id' in message && message.id !== undefined;
}
