import { z } from "zod"

import { PAYMENT_METHODS } from "@/features/tenants/schemas"

/**
 * Checkout input. Deliberately contains NO prices, totals, stock or tenant id —
 * those are always computed server-side.
 */

export const cartLineInputSchema = z.object({
  productId: z.uuid(),
  quantity: z.number().int().min(1).max(99),
})

export const cartLinesSchema = z.array(cartLineInputSchema).min(1, "Your cart is empty").max(50)

const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9\s-]{6,18}$/, "Enter a valid phone number")

export const customerDetailsSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(120),
  email: z.email("Enter a valid email address").trim().toLowerCase().max(254),
  phone,
  city: z.string().trim().min(2, "Enter your city").max(80),
  address: z.string().trim().min(5, "Enter your full address").max(500),
  postalCode: z
    .string()
    .trim()
    .max(12)
    .regex(/^[A-Za-z0-9 -]*$/, "Invalid postal code")
    .optional()
    .or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
})

export const couponCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_-]{3,32}$/, "Invalid coupon code")

export const checkoutSchema = z.object({
  customer: customerDetailsSchema,
  paymentMethod: z.enum(PAYMENT_METHODS),
  couponCode: couponCodeSchema.optional().or(z.literal("")),
  items: cartLinesSchema,
  /** Generated once per checkout attempt on the client; makes retries safe. */
  idempotencyKey: z.uuid(),
  /** Subtotal the customer was shown. Used only to detect price changes, never to price. */
  expectedSubtotal: z.number().nonnegative().optional(),
})

export const quoteSchema = z.object({
  items: cartLinesSchema,
  couponCode: couponCodeSchema.optional().or(z.literal("")),
  email: z.email().optional().or(z.literal("")),
  city: z.string().trim().max(80).optional(),
})

export type CheckoutInput = z.infer<typeof checkoutSchema>
export type CustomerDetails = z.infer<typeof customerDetailsSchema>
export type CartLineInput = z.infer<typeof cartLineInputSchema>
