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

/** The whole federal tax engine, re-exported so an embedder needs only one package. */
export * from './engine/index.js';

/**
 * The state engine, exported by name rather than with `export *`.
 *
 * The two engines share several type names — `FilingStatus`, `Bracket`,
 * `Citation`, `SUPPORTED_YEARS` — because they model the same concepts, and a
 * blanket re-export would silently pick one. Naming each export makes which one
 * a consumer gets a decision rather than an accident.
 */
export {
  stateIncomeTax,
  getStateDefinition,
  stateName,
  SUPPORTED_STATES,
  NO_INCOME_TAX_STATES,
  supportedYears as supportedStateYears,
  isSupported as isStateYearSupported,
  SUPPORTED_YEARS as STATE_TAX_YEARS,
  // Both directions, because from tax year 2027 they are different questions:
  // `supportedStateYears('CA')` is two years and `statesForYear(2027)` is nine
  // states. An embedder crossing `SUPPORTED_STATES` with `STATE_TAX_YEARS`
  // builds thirty-three pairs `getStateDefinition` throws on — which is exactly
  // what this package's own `state-fields.ts` did until Day 83.
  statesForYear,
  SUPPORTED_STATE_YEARS,
} from './state-engine/index.js';
export type {
  ConformityBase,
  FederalBasis,
  FederalDeductionsTaken,
  StateCode,
  StateIncomeTaxInput,
  StateIncomeTaxResult,
} from './state-engine/index.js';
