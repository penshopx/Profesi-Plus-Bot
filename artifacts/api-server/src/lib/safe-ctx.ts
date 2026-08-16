/**
 * Shared error-catching wrapper for context builders.
 *
 * Both the chat message handler and the Exum generator wrap every context
 * builder so a single DB/network failure cannot kill the whole request:
 * failures are logged, recorded in a shared `errors` array (so the client can
 * be warned that personalisation blocks failed), and replaced with an empty
 * string. Extracting the factory here guarantees both paths always share the
 * exact same behavior — a fix applied here reaches chat and Exum alike.
 */

/** Minimal logger shape (matches pino / pino-http `req.log`). */
export interface SafeCtxLogger {
  warn(obj: Record<string, unknown>, msg: string): void;
}

export type SafeCtx = (name: string, fn: () => Promise<string>) => Promise<string>;

/**
 * Build a safeCtx wrapper bound to a logger and a shared error-name sink.
 *
 * @param log    request logger; failures are logged at warn level
 * @param errors array that collects the `name` of every failed block
 */
export function makeSafeCtx(log: SafeCtxLogger, errors: string[]): SafeCtx {
  return async (name, fn) => {
    try {
      return await fn();
    } catch (err) {
      log.warn(
        { err, contextBlock: name, context_block_failed: name.replace(/^exum:/, "") },
        "Context builder failed — falling back to empty string",
      );
      errors.push(name);
      return "";
    }
  };
}
