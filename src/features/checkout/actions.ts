"use server"

import { headers } from "next/headers"
import { z } from "zod"

import { getCurrentUser } from "@/features/auth/session"
import { getRequestTenant, tenantOrigin } from "@/features/tenants/current"
import { runAction } from "@/lib/actions/run-action"
import { AppError, type ActionResult } from "@/lib/errors/app-error"
import { clientFingerprint, rateLimit } from "@/lib/security/rate-limit"

import { checkoutSchema, quoteSchema } from "./schemas"
import { placeOrder, quoteCart, refreshCart } from "./service"
import type { CartRefreshLine, CheckoutQuote, PlacedOrder } from "./types"

async function requestOrigin(fallback: string): Promise<string> {
  const h = await headers()
  const host = h.get("host")
  if (!host) return fallback
  const proto = h.get("x-forwarded-proto") === "http" || host.includes("localhost") ? "http" : "https"
  return `${proto}://${host}`
}

export async function getCheckoutQuoteAction(input: unknown): Promise<ActionResult<CheckoutQuote>> {
  return runAction("checkout.quote", async () => {
    const data = quoteSchema.parse(input)
    // Coupon brute-forcing protection.
    if (!(await rateLimit("quote", await clientFingerprint(), 60, 60))) {
      throw new AppError("RATE_LIMITED", "Too many requests. Please slow down.")
    }
    const tenant = await getRequestTenant()
    return quoteCart(tenant, {
      items: data.items,
      couponCode: data.couponCode || undefined,
      email: data.email || undefined,
      city: data.city,
    })
  })
}

export async function placeOrderAction(input: unknown): Promise<ActionResult<PlacedOrder>> {
  return runAction("checkout.placeOrder", async () => {
    const data = checkoutSchema.parse(input)
    const fingerprint = await clientFingerprint()
    const [ipOk, emailOk] = await Promise.all([
      rateLimit("order-ip", fingerprint, 10, 600),
      rateLimit("order-email", data.customer.email, 10, 3600),
    ])
    if (!ipOk || !emailOk) throw new AppError("RATE_LIMITED", "Too many orders in a short time. Please try again later.")

    const tenant = await getRequestTenant()
    const user = await getCurrentUser()
    return placeOrder(tenant, data, { userId: user?.id ?? null, origin: await requestOrigin(tenantOrigin(tenant)) })
  })
}

export async function refreshCartAction(productIds: unknown): Promise<ActionResult<CartRefreshLine[]>> {
  return runAction("cart.refresh", async () => {
    const ids = z.array(z.uuid()).max(50).parse(productIds)
    const tenant = await getRequestTenant()
    return refreshCart(tenant, ids)
  })
}
