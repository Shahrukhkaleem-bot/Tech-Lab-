import { z } from "zod"

export const ORDER_STATUSES = ["pending", "confirmed", "processing", "shipped", "out_for_delivery", "delivered", "cancelled", "returned"] as const
export const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded", "partially_refunded", "cancelled"] as const

export const adminOrderFiltersSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["all", ...ORDER_STATUSES]).default("all"),
  payment: z.enum(["all", ...PAYMENT_STATUSES]).default("all"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
})
export type AdminOrderFilters = z.infer<typeof adminOrderFiltersSchema>

export const orderStatusUpdateSchema = z.object({
  orderId: z.uuid(),
  status: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(500).optional(),
  restock: z.boolean().default(true),
})

export const paymentStatusUpdateSchema = z.object({
  orderId: z.uuid(),
  status: z.enum(PAYMENT_STATUSES),
})

export const trackingUpdateSchema = z.object({
  orderId: z.uuid(),
  courierName: z.string().trim().min(1, "Courier is required").max(80),
  trackingNumber: z.string().trim().min(1, "Tracking number is required").max(80),
  trackingUrl: z.url({ protocol: /^https$/, message: "Must be an https:// link" }).optional().or(z.literal("")),
  markShipped: z.boolean().default(true),
})

export const internalNoteSchema = z.object({ orderId: z.uuid(), note: z.string().trim().max(2000) })
