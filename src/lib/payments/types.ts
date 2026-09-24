import type { PaymentSettings } from "@/features/tenants/types"
import type { PaymentMethod } from "@/types/database"

/**
 * Payment provider contract. Checkout depends only on this interface; adding
 * Stripe, JazzCash, Easypaisa, PayFast… means adding a provider and registering it.
 *
 * Card data NEVER touches our servers: online providers must be redirect/hosted
 * (PCI-DSS SAQ-A scope).
 */

export type PaymentOrder = {
  tenantId: string
  orderId: string
  orderNumber: number
  publicToken: string
  amount: number
  currency: string
  customerEmail: string
  customerName: string
  lines: { name: string; quantity: number; unitPrice: number }[]
  shippingFee: number
  discountAmount: number
  /** Absolute URLs on the tenant's own host. */
  successUrl: string
  cancelUrl: string
}

export type PaymentInstructions = {
  title: string
  body: string
  bankAccounts?: PaymentSettings["bankAccounts"]
}

export type PaymentResult =
  | { kind: "offline"; instructions: PaymentInstructions }
  | { kind: "redirect"; redirectUrl: string; providerReference: string }

export type PaymentVerification = {
  status: "succeeded" | "pending" | "failed"
  provider: string
  providerReference: string
  tenantId: string | null
  orderId: string | null
  amount: number
  currency: string
}

export type RefundResult = { status: "succeeded" | "pending" | "manual"; providerReference?: string }

export type PaymentContext = { settings: PaymentSettings }

export interface PaymentProvider {
  /** Stable id stored in payment_transactions.provider */
  readonly id: string
  readonly method: PaymentMethod
  readonly label: string
  /** Enabled for the tenant AND configured on the platform (keys present). */
  isAvailable(ctx: PaymentContext): boolean
  createPayment(order: PaymentOrder, ctx: PaymentContext): Promise<PaymentResult>
  verifyPayment(providerReference: string, ctx: PaymentContext): Promise<PaymentVerification>
  refundPayment(input: { providerReference: string; amount: number; currency: string }, ctx: PaymentContext): Promise<RefundResult>
}
