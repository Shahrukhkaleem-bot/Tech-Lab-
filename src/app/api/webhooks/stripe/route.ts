import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { logger } from "@/lib/logger"
import { sessionToVerification, verifyStripeWebhook } from "@/lib/payments/providers/stripe"
import { createSupabaseServiceClient } from "@/lib/supabase/service"

/**
 * POST /api/webhooks/stripe — platform-level endpoint (excluded from tenant rewrite).
 *
 * Security: raw-body HMAC verification (Stripe-Signature, 5-min tolerance) BEFORE any
 * processing. The tenant/order come from session metadata that we set server-side;
 * record_payment() re-checks order ↔ tenant ownership and the paid amount, and is
 * idempotent per session id (Stripe retries deliveries).
 */
export const dynamic = "force-dynamic"

const idSchema = z.uuid()

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 501 })

  const payload = await request.text()
  let event: ReturnType<typeof verifyStripeWebhook>
  try {
    event = verifyStripeWebhook(payload, request.headers.get("stripe-signature"), secret)
  } catch (error) {
    logger.warn("stripe.webhook.invalid_signature", { error })
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  const handled = ["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired"]
  if (!handled.includes(event.type)) return NextResponse.json({ received: true })

  const v = sessionToVerification(event.data.object)
  if (!idSchema.safeParse(v.tenantId).success || !idSchema.safeParse(v.orderId).success) {
    logger.warn("stripe.webhook.missing_metadata", { eventId: event.id })
    return NextResponse.json({ received: true })
  }

  const supabase = createSupabaseServiceClient()
  try {
    if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      await supabase.rpc("record_payment", {
        p_tenant_id: v.tenantId!,
        p_order_id: v.orderId!,
        p_provider: "stripe",
        p_provider_reference: v.providerReference,
        p_status: "failed",
        p_amount: v.amount,
        p_currency: v.currency || "USD",
        p_metadata: { event_id: event.id, type: event.type },
      })
      // Release the reserved stock. Ignore "invalid transition" (already paid/cancelled).
      const { error } = await supabase.rpc("cancel_order", { p_order_id: v.orderId!, p_note: `Stripe: ${event.type}` })
      if (error && error.message !== "INVALID_STATUS_TRANSITION") throw error
    } else if (v.status === "succeeded") {
      const { error } = await supabase.rpc("record_payment", {
        p_tenant_id: v.tenantId!,
        p_order_id: v.orderId!,
        p_provider: "stripe",
        p_provider_reference: v.providerReference,
        p_status: "succeeded",
        p_amount: v.amount,
        p_currency: v.currency,
        p_metadata: { event_id: event.id, type: event.type, account: event.account ?? null },
      })
      if (error) throw error
    }
  } catch (error) {
    // 500 → Stripe retries with backoff.
    logger.error("stripe.webhook.processing_failed", { eventId: event.id, type: event.type, orderId: v.orderId, error })
    return NextResponse.json({ error: "Processing failed" }, { status: 500 })
  }

  logger.info("stripe.webhook.processed", { eventId: event.id, type: event.type, orderId: v.orderId })
  return NextResponse.json({ received: true })
}
