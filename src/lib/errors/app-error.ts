/**
 * Application error model.
 *
 * - `AppError` carries a stable machine code + a message that is SAFE to show users.
 * - Everything else (DB errors, network errors, bugs) is logged server-side and
 *   surfaced to users as a generic message with a reference id.
 */

export type ErrorCode =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INSUFFICIENT_STOCK"
  | "PRICE_CHANGED"
  | "COUPON_INVALID"
  | "PAYMENT_UNAVAILABLE"
  | "PAYMENT_FAILED"
  | "UNAVAILABLE"
  | "INTERNAL"

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = "AppError"
  }
}

/** Uniform result type for Server Actions and Route Handlers (serialisable). */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string; fieldErrors?: Record<string, string[]>; details?: unknown } }

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data }
}

export function fail(
  code: ErrorCode,
  message: string,
  extra?: { fieldErrors?: Record<string, string[]>; details?: unknown },
): ActionResult<never> {
  return { ok: false, error: { code, message, ...extra } }
}
