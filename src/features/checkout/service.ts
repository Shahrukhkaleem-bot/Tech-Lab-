import "server-only"

import { z } from "zod"

import { getStoreSettings } from "@/features/tenants/queries"
import type { Tenant } from "@/features/tenants/types"
import { AppError } from "@/lib/errors/app-error"
import { businessErrorFor, toAppError } from "@/lib/errors/database"
import { logger } from "@/lib/logger"
import { getPaymentProvider } from "@/lib/payments/registry"
import type { PaymentResult } from "@/lib/payments/types"
import { getShippingProvider } from "@/lib/shipping/registry"
import { createSupabasePublicClient } from "@/lib/supabase/public"
import { createSupabaseServiceClient } from "@/lib/supabase/service"
import { roundMoney } from "@/lib/utils/pricing"

import type { CartLineInput, CheckoutInput } from "./schemas"
import type { CartRefreshLine, CheckoutQuote, PlacedOrder } from "./types"

/**
 * Checkout domain service. The ONLY module that creates orders.
 * Trust boundary: `tenant` comes from the Host header, `userId` from the verified
 * session; everything monetary comes from the database.
 */

const quoteResponseSchema = z.object({
  lines: z.array(
    z.object({
      product_id: z.string(),
      quantity: z.number(),
      name: z.string().nullable(),
      sku: z.string().nullable(),
      slug: z.string().nullable(),
      image_url: z.string().nullable(),
      unit_price: z.coerce.number().nullable(),
      line_total: z.coerce.number().nullable(),
      available_quantity: z.number().nullable(),
      problem: z.enum(["UNAVAILABLE", "INSUFFICIENT_STOCK"]).nullable(),
    }),
  ),
  subtotal: z.coerce.number(),
  discount_amount: z.coerce.number(),
  has_problems: z.boolean(),
  coupon: z.object({ code: z.string(), valid: z.boolean(), reason: z.string().nullable() }).nullable(),
})

const placeOrderResponseSchema = z.object({
  order_id: z.uuid(),
  order_number: z.number(),
  public_token: z.uuid(),
  total_amount: z.coerce.number(),
  currency: z.string(),
  duplicate: z.boolean(),
})

const toItemsJson = (items: CartLineInput[]) => items.map((i) => ({ product_id: i.productId, quantity: i.quantity }))

export async function quoteCart(
  tenant: Tenant,
  input: { items: CartLineInput[]; couponCode?: string; email?: string; city?: string },
): Promise<CheckoutQuote> {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase.rpc("quote_order", {
    p_tenant_id: tenant.id,
    p_items: toItemsJson(input.items),
    p_coupon_code: input.couponCode || null,
    p_customer_email: input.email || null,
  })
  if (error) throw toAppError(error, { op: "quote_order", tenantId: tenant.id })
  const quote = quoteResponseSchema.parse(data)

  const settings = await getStoreSettings(tenant.id)
  const orderValue = roundMoney(quote.subtotal - quote.discount_amount)
  const rate = await getShippingProvider().calculateRate({
    orderValue,
    city: input.city ?? null,
    currency: tenant.currency,
    config: settings.shipping,
  })

  return {
    lines: quote.lines.map((l) => ({
      productId: l.product_id,
      name: l.name ?? "Unavailable product",
      slug: l.slug,
      sku: l.sku,
      imageUrl: l.image_url,
      unitPrice: l.unit_price ?? 0,
      quantity: l.quantity,
      lineTotal: l.line_total ?? 0,
      availableQuantity: l.available_quantity,
      problem: l.problem,
    })),
    subtotal: quote.subtotal,
    discountAmount: quote.discount_amount,
    shippingFee: rate.amount,
    shippingLabel: rate.label,
    total: roundMoney(quote.subtotal - quote.discount_amount + rate.amount),
    currency: tenant.currency,
    hasProblems: quote.has_problems,
    coupon: quote.coupon
      ? {
          code: quote.coupon.code,
          valid: quote.coupon.valid,
          message: quote.coupon.reason ? (businessErrorFor(quote.coupon.reason)?.message ?? "Invalid coupon") : null,
        }
      : null,
  }
}

export async function placeOrder(
  tenant: Tenant,
  input: CheckoutInput,
  ctx: { userId: string | null; origin: string },
): Promise<PlacedOrder> {
  const settings = await getStoreSettings(tenant.id)
  const provider = getPaymentProvider(input.paymentMethod)
  if (!provider.isAvailable({ settings: settings.payment })) {
    throw new AppError("PAYMENT_UNAVAILABLE", "That payment method is not available for this store.")
  }

  // 1. Authoritative quote (DB prices, stock, coupon) → shipping on the discounted value.
  const quote = await quoteCart(tenant, {
    items: input.items,
    couponCode: input.couponCode || undefined,
    email: input.customer.email,
    city: input.customer.city,
  })
  if (quote.hasProblems) {
    throw new AppError(
      "INSUFFICIENT_STOCK",
      "Some items in your cart are no longer available in the requested quantity.",
      quote.lines.filter((l) => l.problem),
    )
  }
  if (quote.coupon && !quote.coupon.valid) {
    throw new AppError("COUPON_INVALID", quote.coupon.message ?? "This coupon code is not valid.")
  }

  // 2. Atomic order creation (locks, stock, coupon, idempotency) in Postgres.
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase.rpc("place_order", {
    p_tenant_id: tenant.id,
    p_items: toItemsJson(input.items),
    p_customer: {
      name: input.customer.name,
      email: input.customer.email,
      phone: input.customer.phone,
      address: input.customer.address,
      city: input.customer.city,
      postal_code: input.customer.postalCode || null,
      notes: input.customer.notes || null,
    },
    p_payment_method: input.paymentMethod,
    p_shipping_fee: quote.shippingFee,
    // Guard against prices changing between what the customer saw and now.
    p_expected_subtotal: input.expectedSubtotal ?? quote.subtotal,
    p_idempotency_key: input.idempotencyKey,
    p_coupon_code: input.couponCode || null,
    p_customer_id: ctx.userId,
  })
  if (error) throw toAppError(error, { op: "place_order", tenantId: tenant.id })
  const placed = placeOrderResponseSchema.parse(data)

  const confirmationPath = `/order-success/${placed.order_id}?token=${placed.public_token}`
  logger.info("order.placed", {
    tenantId: tenant.id,
    orderId: placed.order_id,
    orderNumber: placed.order_number,
    method: input.paymentMethod,
    duplicate: placed.duplicate,
  })

  // 3. Payment step (offline instructions or hosted redirect).
  let payment: PaymentResult
  try {
    payment = await provider.createPayment(
      {
        tenantId: tenant.id,
        orderId: placed.order_id,
        orderNumber: placed.order_number,
        publicToken: placed.public_token,
        amount: placed.total_amount,
        currency: placed.currency,
        customerEmail: input.customer.email,
        customerName: input.customer.name,
        lines: quote.lines.map((l) => ({ name: l.name, quantity: l.quantity, unitPrice: l.unitPrice })),
        shippingFee: quote.shippingFee,
        discountAmount: quote.discountAmount,
        successUrl: `${ctx.origin}${confirmationPath}`,
        cancelUrl: `${ctx.origin}/checkout?cancelled=${placed.order_id}`,
      },
      { settings: settings.payment },
    )
  } catch (paymentError) {
    // Online payment could not start: release the stock immediately.
    logger.error("order.payment_start_failed", { orderId: placed.order_id, error: paymentError })
    await supabase.rpc("cancel_order", { p_order_id: placed.order_id, p_note: "Payment could not be started" })
    throw paymentError instanceof AppError
      ? paymentError
      : new AppError("PAYMENT_FAILED", "We couldn't start the payment. Your order was not placed.")
  }

  if (payment.kind === "redirect") {
    const { error: refError } = await supabase
      .from("payment_transactions")
      .update({ provider: provider.id, provider_reference: payment.providerReference })
      .eq("tenant_id", tenant.id)
      .eq("order_id", placed.order_id)
      .eq("status", "pending")
    if (refError) logger.error("order.attach_payment_reference_failed", { orderId: placed.order_id, error: refError })
    return {
      orderId: placed.order_id,
      orderNumber: placed.order_number,
      publicToken: placed.public_token,
      redirectTo: payment.redirectUrl,
      instructions: null,
    }
  }

  return {
    orderId: placed.order_id,
    orderNumber: placed.order_number,
    publicToken: placed.public_token,
    redirectTo: confirmationPath,
    instructions: payment.instructions,
  }
}

/**
 * Re-prices a client cart against current public data (drawer open / page load).
 * Uses the anonymous client: only active products of this tenant are visible.
 */
export async function refreshCart(tenant: Tenant, productIds: string[]): Promise<CartRefreshLine[]> {
  if (productIds.length === 0) return []
  const supabase = createSupabasePublicClient()
  const { data, error } = await supabase
    .from("products")
    .select("id, price, original_price, track_inventory, stock_quantity")
    .eq("tenant_id", tenant.id)
    .in("id", productIds.slice(0, 50))
  if (error) throw toAppError(error, { op: "refreshCart", tenantId: tenant.id })

  const byId = new Map((data ?? []).map((p) => [p.id, p]))
  return productIds.map((id) => {
    const p = byId.get(id)
    if (!p) return { productId: id, available: false, unitPrice: 0, originalPrice: 0, maxQuantity: 0 }
    return {
      productId: id,
      available: !p.track_inventory || p.stock_quantity > 0,
      unitPrice: Number(p.price),
      originalPrice: Number(p.original_price),
      maxQuantity: p.track_inventory ? p.stock_quantity : null,
    }
  })
}
