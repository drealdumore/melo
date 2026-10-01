/**
 * Logging.
 *
 * One funnel for every diagnostic, so a failure is greppable instead of a bare
 * `console.warn` that says what broke but not why.
 *
 *   debug  tracing detail; off in production
 *   info   a lifecycle milestone worth having a record of
 *   warn   degraded, but handled
 *   error  something failed that the user is going to notice
 *
 * Two things this buys, and the second is the point:
 *
 *   1. Errors are *formatted*, not stringified. An `Error` keeps its stack and a
 *      PostgREST error keeps its `code` / `details` / `hint`. Those fields are
 *      the part that actually explains the failure, and `String(error)` throws
 *      all of it away.
 *   2. `warn` and `error` go to `console.warn` / `console.error`, which React
 *      Native's LogBox surfaces *on the device*. A translation failure leaves no
 *      trace on either phone, so this is the only place it can be seen at all
 *      when Metro is not attached. That is deliberate, not a side effect.
 *
 * In the Metro console, filter on `[melo]` to see only these lines.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/** `debug` in development, `info` in release bundles. */
const currentLevel: LogLevel = typeof __DEV__ !== "undefined" && __DEV__ ? "debug" : "info";

export interface Logger {
  debug(message: string, ...data: unknown[]): void;
  info(message: string, ...data: unknown[]): void;
  warn(message: string, ...data: unknown[]): void;
  error(message: string, ...data: unknown[]): void;
}

/** Anything with a `message` is treated as a structured service error. */
interface ServiceErrorLike {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

function isServiceErrorLike(value: unknown): value is ServiceErrorLike {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { message?: unknown }).message === "string"
  );
}

function isErrorLike(value: unknown): boolean {
  return value instanceof Error || isServiceErrorLike(value);
}

const MAX_CAPTION = 240;

function truncate(value: string, max = MAX_CAPTION): string {
  return value.length > max ? `${value.slice(0, max)}… (+${value.length - max} chars)` : value;
}

function preview(value: unknown): string {
  if (typeof value === "string") return truncate(value);
  try {
    return truncate(JSON.stringify(value) ?? String(value));
  } catch {
    // Circular, BigInt, or a getter that throws. The type is still worth having.
    return Object.prototype.toString.call(value);
  }
}

/**
 * Turns anything throwable into something worth reading in a terminal.
 *
 * Hermes does give `error.stack`, but it is absent on some non-`Error` rejects
 * (a thrown string, a rejected promise reason), so the message is always carried
 * separately and the stack is appended when there is one.
 */
export function describeError(error: unknown): string {
  if (error instanceof Error) {
    const head = `${error.name}: ${error.message}`;
    return error.stack ? error.stack : head;
  }
  if (isServiceErrorLike(error)) {
    // PostgREST puts the useful part in code/details/hint, and `message` alone
    // is often just "insert into messages failed".
    const parts = [error.message];
    if (error.code) parts.push(`code=${error.code}`);
    if (error.details) parts.push(`details=${truncate(error.details)}`);
    if (error.hint) parts.push(`hint=${truncate(error.hint)}`);
    return parts.join(" | ");
  }
  return preview(error);
}

function pad(value: number, width = 2): string {
  return String(value).padStart(width, "0");
}

function stamp(): string {
  const now = new Date();
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(
    now.getMilliseconds(),
    3
  )}`;
}

/**
 * Milliseconds since an arbitrary start point, for latency lines.
 * `performance` is preferred because `Date.now()` is coarse enough to report a
 * 4ms translation as 0ms.
 */
export function since(start: number): string {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  return `${Math.round(now - start)}ms`;
}

export function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function emit(level: LogLevel, scope: string, message: string, data: unknown[]): void {
  if (RANK[level] < RANK[currentLevel]) return;

  // Errors go in the line itself: a collapsed Metro row should still say why it
  // failed. Everything else is passed through so it can be expanded in place.
  const errors = data.filter(isErrorLike);
  const rest = data.filter((value) => !isErrorLike(value));

  const reason = errors.length > 0 ? ` — ${errors.map(describeError).join("; ")}` : "";
  const line = `[melo] ${stamp()} ${level.toUpperCase().padEnd(5)} ${scope} · ${message}${reason}`;

  // warn/error must reach console.warn/console.error for LogBox to show them.
  switch (level) {
    case "error":
      console.error(line, ...rest);
      break;
    case "warn":
      console.warn(line, ...rest);
      break;
    case "debug":
      console.log(line, ...rest);
      break;
    default:
      console.info(line, ...rest);
      break;
  }
}

/**
 * Creates a logger bound to a scope. Call once per module:
 *
 *   const log = createLogger("translation");
 *   log.error("Request failed", error);
 */
export function createLogger(scope: string): Logger {
  return {
    debug: (message, ...data) => emit("debug", scope, message, data),
    info: (message, ...data) => emit("info", scope, message, data),
    warn: (message, ...data) => emit("warn", scope, message, data),
    error: (message, ...data) => emit("error", scope, message, data),
  };
}

/** The app-wide logger, for things with no better home than `app`. */
export const log = createLogger("app");
