import "server-only"

import type { PostgrestError } from "@supabase/supabase-js"

import { logger } from "@/lib/logger"

import { AppError, type ErrorCode } from "./app-error"

/**
 * Translates Postgres / PostgREST errors into safe AppErrors.
 * Business errors raised by our SQL functions use a stable code in MESSAGE
 * (see supabase/migrations/*_functions.sql); everything unknown becomes INTERNAL
 * and the raw error is logged, never returned.
 */
const BUSINESS_ERRORS: Record<string, { code: ErrorCode; message: string }> = {
  INSUFFICIENT_STOCK: { code: "INSUFFICIENT_STOCK", message: "Some items in your cart are no longer available in the requested quantity." },
  PRICE_CHANGED: { code: "PRICE_CHANGED", message: "Prices changed while you were checking out. Please review your order." },
  INVALID_ITEMS: { code: "VALIDATION", message: "Your cart contains invalid items." },
  INVALID_REQUEST: { code: "VALIDATION", message: "The request was invalid." },
  TENANT_NOT_FOUND: { code: "NOT_FOUND", message: "This store is not available." },
  NOT_FOUND: { code: "NOT_FOUND", message: "Not found." },
  ORDER_NOT_FOUND: { code: "NOT_FOUND", message: "Order not found." },
  PAYMENT_METHOD_UNAVAILABLE: { code: "PAYMENT_UNAVAILABLE", message: "That payment method is not available for this store." },
  PAYMENT_AMOUNT_MISMATCH: { code: "PAYMENT_FAILED", message: "Payment amount did not match the order total." },
  COUPON_INVALID: { code: "COUPON_INVALID", message: "This coupon code is not valid." },
  COUPON_NOT_STARTED: { code: "COUPON_INVALID", message: "This coupon is not active yet." },
  COUPON_EXPIRED: { code: "COUPON_INVALID", message: "This coupon has expired." },
  COUPON_EXHAUSTED: { code: "COUPON_INVALID", message: "This coupon has reached its usage limit." },
  COUPON_MIN_ORDER: { code: "COUPON_INVALID", message: "Your order does not meet the minimum amount for this coupon." },
  COUPON_CUSTOMER_LIMIT: { code: "COUPON_INVALID", message: "You have already used this coupon." },
  INVALID_STATUS_TRANSITION: { code: "CONFLICT", message: "The order cannot move to that status from its current status." },
  USE_CANCEL_FUNCTION: { code: "CONFLICT", message: "Use the cancel action to cancel an order." },
  ORDER_IMMUTABLE_FIELD: { code: "FORBIDDEN", message: "Order amounts cannot be changed after the order is placed." },
  PAYMENT_STATUS_FORBIDDEN: { code: "FORBIDDEN", message: "Only managers can change payment status." },
  CUSTOMER_EDIT_FORBIDDEN: { code: "FORBIDDEN", message: "Only managers can edit customer details." },
  PROTECTED_COLUMN: { code: "FORBIDDEN", message: "This setting is managed by the platform." },
  ONLY_OWNER_CAN_MANAGE_OWNERS: { code: "FORBIDDEN", message: "Only an owner can manage owners." },
  LAST_OWNER: { code: "CONFLICT", message: "A store must keep at least one owner." },
  CATEGORY_CYCLE: { code: "VALIDATION", message: "A category cannot be placed inside itself." },
  CATEGORY_TOO_DEEP: { code: "VALIDATION", message: "Categories can be nested at most three levels deep." },
  FORBIDDEN: { code: "FORBIDDEN", message: "You do not have permission to do that." },
}

export function businessErrorFor(code: string) {
  return BUSINESS_ERRORS[code]
}

type PgLikeError = Pick<PostgrestError, "message" | "code" | "details" | "hint">

/** Converts a Supabase error into an AppError (safe message), logging the original. */
export function toAppError(error: PgLikeError, context: Record<string, unknown> = {}): AppError {
  const business = BUSINESS_ERRORS[error.message]
  if (business) {
    let details: unknown
    try {
      details = error.details ? JSON.parse(error.details) : undefined
    } catch {
      details = undefined
    }
    return new AppError(business.code, business.message, details)
  }

  switch (error.code) {
    case "23505":
      return new AppError("CONFLICT", "An item with the same unique value (slug, SKU or code) already exists.")
    case "23503":
      return new AppError("VALIDATION", "A referenced record does not exist or belongs to another store.")
    case "23514":
    case "22P02":
    case "23502":
      logger.warn("db.constraint_violation", { ...context, code: error.code, message: error.message })
      return new AppError("VALIDATION", "Some values are invalid. Please check the form and try again.")
    case "42501":
    case "PGRST301":
      return new AppError("FORBIDDEN", "You do not have permission to do that.")
    case "PGRST116":
      return new AppError("NOT_FOUND", "Not found.")
  }

  logger.error("db.unexpected_error", { ...context, code: error.code, message: error.message, hint: error.hint })
  return new AppError("INTERNAL", "Something went wrong. Please try again.")
}
