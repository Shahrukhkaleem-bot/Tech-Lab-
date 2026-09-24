import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

import { AppError } from "@/lib/errors/app-error"
import { logger } from "@/lib/logger"

import type { PaymentContext, PaymentProvider, PaymentVerification } from "../types"

/**
 * Stripe Checkout (hosted page) via the REST API — no SDK dependency.
 *
 * Multi-tenant model: platform account + optional Stripe Connect account per tenant
 * (payment_config.stripe_account_id). With Connect, requests carry `Stripe-Account`
 * so funds settle to the store. Requires STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET.
 *
 * Stripe does not support every local currency/market; for PKR card acquiring use a
 * local gateway provider (see local-gateway.ts) behind the same interface.
 */

const API = "https://api.stripe.com/v1"
const ZERO_DECIMAL = new Set(["BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"])

export function toMinorUnits(amount: number, currency: string): number {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? Math.round(amount) : Math.round(amount * 100)
}

export function fromMinorUnits(amount: number, currency: string): number {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? amount : amount / 100
}

function secretKey(): string | undefined {
  return process.env.STRIPE_SECRET_KEY || undefined
}

async function stripeRequest<T>(path: string, init: { method: "GET" | "POST"; body?: URLSearchParams; account?: string | null; idempotencyKey?: string }): Promise<T> {
  const key = secretKey()
  if (!key) throw new AppError("PAYMENT_UNAVAILABLE", "Card payments are not configured.")
  const res = await fetch(`${API}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": "2024-06-20",
      ...(init.account ? { "Stripe-Account": init.account } : {}),
      ...(init.idempotencyKey ? { "Idempotency-Key": init.idempotencyKey } : {}),
    },
    body: init.body,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  })
  const json = (await res.json()) as T & { error?: { message?: string; type?: string } }
  if (!res.ok) {
    logger.error("stripe.request_failed", { path, status: res.status, type: json.error?.type, message: json.error?.message })
    throw new AppError("PAYMENT_FAILED", "The payment provider could not process this request.")
  }
  return json
}

type CheckoutSession = {
  id: string
  url: string | null
  payment_status: "paid" | "unpaid" | "no_payment_required"
  status: "open" | "complete" | "expired"
  amount_total: number | null
  currency: string | null
  payment_intent: string | null
  metadata: Record<string, string> | null
}

export function sessionToVerification(session: CheckoutSession): PaymentVerification {
  const currency = (session.currency ?? "").toUpperCase()
  return {
    status: session.payment_status === "paid" ? "succeeded" : session.status === "expired" ? "failed" : "pending",
    provider: "stripe",
    providerReference: session.id,
    tenantId: session.metadata?.tenant_id ?? null,
    orderId: session.metadata?.order_id ?? null,
    amount: fromMinorUnits(session.amount_total ?? 0, currency),
    currency,
  }
}

export const stripeProvider: PaymentProvider = {
  id: "stripe",
  method: "card",
  label: "Credit / Debit Card",

  isAvailable: ({ settings }) => settings.enabledMethods.includes("card") && Boolean(secretKey()),

  async createPayment(order, { settings }: PaymentContext) {
    const currency = order.currency.toLowerCase()
    const body = new URLSearchParams({
      mode: "payment",
      success_url: order.successUrl,
      cancel_url: order.cancelUrl,
      customer_email: order.customerEmail,
      client_reference_id: order.orderId,
      "metadata[tenant_id]": order.tenantId,
      "metadata[order_id]": order.orderId,
      "payment_intent_data[metadata][tenant_id]": order.tenantId,
      "payment_intent_data[metadata][order_id]": order.orderId,
      // Unpaid sessions expire after 30 min → webhook cancels the order and restores stock.
      expires_at: String(Math.floor(Date.now() / 1000) + 30 * 60),
    })
    // A single line for the exact server-computed total avoids rounding drift between
    // our totals (incl. shipping/discount) and Stripe's line-item arithmetic.
    body.set("line_items[0][quantity]", "1")
    body.set("line_items[0][price_data][currency]", currency)
    body.set("line_items[0][price_data][unit_amount]", String(toMinorUnits(order.amount, order.currency)))
    body.set("line_items[0][price_data][product_data][name]", `Order #${order.orderNumber}`)
    body.set(
      "line_items[0][price_data][product_data][description]",
      order.lines.map((l) => `${l.quantity} × ${l.name}`).join(", ").slice(0, 500),
    )

    const session = await stripeRequest<CheckoutSession>("/checkout/sessions", {
      method: "POST",
      body,
      account: settings.stripeAccountId,
      idempotencyKey: `checkout-${order.orderId}`,
    })
    if (!session.url) throw new AppError("PAYMENT_FAILED", "Could not start card payment.")
    return { kind: "redirect", redirectUrl: session.url, providerReference: session.id }
  },

  async verifyPayment(providerReference, { settings }) {
    const session = await stripeRequest<CheckoutSession>(`/checkout/sessions/${encodeURIComponent(providerReference)}`, {
      method: "GET",
      account: settings.stripeAccountId,
    })
    return sessionToVerification(session)
  },

  async refundPayment({ providerReference, amount, currency }, { settings }) {
    const session = await stripeRequest<CheckoutSession>(`/checkout/sessions/${encodeURIComponent(providerReference)}`, {
      method: "GET",
      account: settings.stripeAccountId,
    })
    if (!session.payment_intent) throw new AppError("PAYMENT_FAILED", "No captured payment to refund.")
    const refund = await stripeRequest<{ id: string; status: string }>("/refunds", {
      method: "POST",
      account: settings.stripeAccountId,
      body: new URLSearchParams({ payment_intent: session.payment_intent, amount: String(toMinorUnits(amount, currency)) }),
    })
    return { status: refund.status === "succeeded" ? "succeeded" : "pending", providerReference: refund.id }
  },
}

/**
 * Verifies a Stripe webhook signature (v1 scheme, HMAC-SHA256, 5-minute tolerance)
 * and returns the parsed event. Throws on any mismatch.
 */
export function verifyStripeWebhook(payload: string, signatureHeader: string | null, secret: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!signatureHeader) throw new Error("Missing Stripe-Signature header")
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((kv) => {
      const [k, ...v] = kv.split("=")
      return [k!.trim(), v.join("=")]
    }),
  )
  const timestamp = Number(parts.t)
  const signatures = signatureHeader
    .split(",")
    .filter((p) => p.trim().startsWith("v1="))
    .map((p) => p.trim().slice(3))
  if (!Number.isFinite(timestamp) || signatures.length === 0) throw new Error("Malformed Stripe-Signature header")
  if (Math.abs(nowSeconds - timestamp) > 300) throw new Error("Stripe webhook timestamp outside tolerance")

  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest()
  const valid = signatures.some((sig) => {
    const given = Buffer.from(sig, "hex")
    return given.length === expected.length && timingSafeEqual(given, expected)
  })
  if (!valid) throw new Error("Invalid Stripe webhook signature")

  return JSON.parse(payload) as { id: string; type: string; account?: string; data: { object: CheckoutSession } }
}
