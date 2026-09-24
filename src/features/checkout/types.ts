import type { PaymentInstructions } from "@/lib/payments/types"

export type QuoteLine = {
  productId: string
  name: string
  slug: string | null
  sku: string | null
  imageUrl: string | null
  unitPrice: number
  quantity: number
  lineTotal: number
  availableQuantity: number | null
  problem: "UNAVAILABLE" | "INSUFFICIENT_STOCK" | null
}

export type CheckoutQuote = {
  lines: QuoteLine[]
  subtotal: number
  discountAmount: number
  shippingFee: number
  shippingLabel: string
  total: number
  currency: string
  hasProblems: boolean
  coupon: { code: string; valid: boolean; message: string | null } | null
}

export type PlacedOrder = {
  orderId: string
  orderNumber: number
  publicToken: string
  /** Absolute URL for online payment, or the confirmation page path. */
  redirectTo: string
  instructions: PaymentInstructions | null
}

export type CartRefreshLine = {
  productId: string
  available: boolean
  unitPrice: number
  originalPrice: number
  maxQuantity: number | null
}
