import "server-only"

/**
 * Minimal structured logger. Emits one JSON line per event, which Vercel's log
 * drains (Datadog, Axiom, Better Stack…) index without extra config.
 * Swap the `emit` function for an SDK (e.g. Sentry) without touching call sites.
 */

type Level = "debug" | "info" | "warn" | "error"
type Context = Record<string, unknown>

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 }
const REDACT_KEYS = /pass(word)?|secret|token|authorization|cookie|api[-_]?key|card|cvc|iban|account_number/i

function threshold(): number {
  const lvl = (process.env.LOG_LEVEL as Level | undefined) ?? "info"
  return LEVELS[lvl] ?? LEVELS.info
}

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== "object") return value
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack?.split("\n").slice(0, 6).join("\n") }
  }
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1))
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, REDACT_KEYS.test(k) ? "[redacted]" : redact(v, depth + 1)]),
  )
}

function emit(level: Level, message: string, context?: Context) {
  if (LEVELS[level] < threshold()) return
  const line = JSON.stringify({ level, message, time: new Date().toISOString(), ...(redact(context ?? {}) as Context) })
  if (level === "error") console.error(line)
  else if (level === "warn") console.warn(line)
  else console.log(line)
}

export const logger = {
  debug: (message: string, context?: Context) => emit("debug", message, context),
  info: (message: string, context?: Context) => emit("info", message, context),
  warn: (message: string, context?: Context) => emit("warn", message, context),
  error: (message: string, context?: Context) => emit("error", message, context),
}
