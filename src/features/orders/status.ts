import type { OrderStatus, PaymentMethod, PaymentStatus } from "@/types/database"

/** Mirror of app_private.order_transition_allowed (SQL is authoritative). */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "shipped", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["out_for_delivery", "delivered", "returned"],
  out_for_delivery: ["delivered", "returned"],
  delivered: ["returned"],
  cancelled: [],
  returned: [],
}

export function nextStatuses(current: OrderStatus): OrderStatus[] {
  return ORDER_TRANSITIONS[current]
}

/** Statuses that restore stock and must use cancel_order / return_order. */
export const CLOSING_STATUSES: OrderStatus[] = ["cancelled", "returned"]

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
  cancelled: "Cancelled",
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cod: "Cash on Delivery",
  bank_transfer: "Bank Transfer",
  card: "Card",
  wallet: "Mobile Wallet",
}

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger"

export const ORDER_STATUS_TONE: Record<OrderStatus, StatusTone> = {
  pending: "warning",
  confirmed: "info",
  processing: "info",
  shipped: "info",
  out_for_delivery: "info",
  delivered: "success",
  cancelled: "danger",
  returned: "neutral",
}

export const PAYMENT_STATUS_TONE: Record<PaymentStatus, StatusTone> = {
  pending: "warning",
  paid: "success",
  failed: "danger",
  refunded: "neutral",
  partially_refunded: "neutral",
  cancelled: "neutral",
}

/** Customer-facing progress steps (cancel/return shown separately). */
export const FULFILMENT_STEPS: OrderStatus[] = ["pending", "confirmed", "processing", "shipped", "out_for_delivery", "delivered"]
