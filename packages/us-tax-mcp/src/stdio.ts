/**
 * The stdio transport: newline-delimited JSON-RPC on stdin and stdout.
 *
 * Two rules matter and both are easy to break:
 *
 * 1. **Nothing but JSON-RPC may ever reach stdout.** A stray `console.log`
 *    corrupts the stream and the client disconnects with an unhelpful parse
 *    error. Diagnostics go to stderr, which the spec reserves for exactly that.
 * 2. **A message may arrive split across chunks, or several may arrive in one.**
 *    Buffering by line rather than by chunk is the whole of the framing.
 */
import { RPC_ERRORS, failure } from './jsonrpc.js';
import { handleMessage } from './protocol.js';
import type { HandleOptions } from './protocol.js';

export interface StdioOptions extends HandleOptions {
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
}

/**
 * Feed decoded lines through the dispatcher.
 *
 * Exposed separately from {@link serve} so the line framing can be tested
 * without a process: {@link createLineHandler} is a pure function from one line
 * of text to zero or one lines of output.
 */
export function createLineHandler(options: HandleOptions = {}): (line: string) => string | null {
  return (line: string): string | null => {
    const trimmed = line.trim();
    if (trimmed === '') return null;

    let decoded: unknown;
    try {
      decoded = JSON.parse(trimmed);
    } catch {
      // A parse error has no id to attach to, so JSON-RPC says to answer with a
      // null id rather than staying silent.
      return JSON.stringify(failure(null, RPC_ERRORS.parseError, 'Message was not valid JSON.'));
    }

    // A batch is a JSON array of messages. Supported because 2024-11-05 and
    // 2025-03-26 clients may send them; responses to notifications are dropped,
    // and an all-notification batch produces no response at all.
    if (Array.isArray(decoded)) {
      if (decoded.length === 0) {
        return JSON.stringify(failure(null, RPC_ERRORS.invalidRequest, 'Batch must not be empty.'));
      }
      const responses = decoded
        .map((entry) => handleMessage(entry, options))
        .filter((entry) => entry !== null);
      return responses.length > 0 ? JSON.stringify(responses) : null;
    }

    let response;
    try {
      response = handleMessage(decoded, options);
    } catch (error) {
      // handleMessage catches tool errors itself, so reaching here means a bug
      // in the dispatcher. Report it rather than killing the process — a server
      // that dies takes the whole conversation's tool access with it.
      const id =
        typeof decoded === 'object' && decoded !== null && 'id' in decoded
          ? ((decoded as { id: string | number | null }).id ?? null)
          : null;
      response = failure(
        id,
        RPC_ERRORS.internalError,
        error instanceof Error ? error.message : String(error),
      );
    }
    return response === null ? null : JSON.stringify(response);
  };
}

/**
 * Run the server until stdin closes.
 *
 * Resolves when the input stream ends, which is how an MCP client shuts a stdio
 * server down.
 */
export function serve(options: StdioOptions = {}): Promise<void> {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  const handle = createLineHandler(options);

  return new Promise<void>((resolve, reject) => {
    let buffer = '';

    const write = (payload: string): void => {
      output.write(`${payload}\n`);
    };

    input.on('data', (chunk: Buffer | string) => {
      buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        const response = handle(line);
        if (response !== null) write(response);
        newline = buffer.indexOf('\n');
      }
    });

    input.on('error', reject);

    input.on('end', () => {
      // A final line with no trailing newline is still a message.
      if (buffer.trim() !== '') {
        const response = handle(buffer);
        if (response !== null) write(response);
      }
      resolve();
    });
  });
}
