import "server-only"

import { AppError } from "@/lib/errors/app-error"

import type { PaymentProvider } from "../types"

/**
 * ⚠️ NOT IMPLEMENTED — integration template for a local hosted-checkout gateway
 * (e.g. JazzCash, Easypaisa, PayFast, a bank IPG). `isAvailable` returns false,
 * so it never appears at checkout until implemented and configured.
 *
 * To implement:
 *  1. Add server-only env vars (merchant id, integrity salt/secret, endpoint URLs).
 *  2. createPayment: build the gateway's signed request (usually HMAC-SHA256 over
 *     sorted fields) and return { kind: "redirect", redirectUrl, providerReference }.
 *     For form-POST gateways, redirect to an internal route that renders an
 *     auto-submitting form.
 *  3. Add a callback Route Handler under src/app/api/webhooks/<gateway>/route.ts that
 *     verifies the response signature, then calls record_payment via the service
 *     client (same flow as the Stripe webhook).
 *  4. verifyPayment: call the gateway's status-inquiry API (never trust the redirect alone).
 *  5. Register it in ../registry.ts under method "wallet" (or "card").
 */
export const localGatewayProvider: PaymentProvider = {
  id: "local_gateway",
  method: "wallet",
  label: "Mobile Wallet",
  isAvailable: () => false,
  async createPayment() {
    throw new AppError("PAYMENT_UNAVAILABLE", "This payment method is not available yet.")
  },
  async verifyPayment() {
    throw new AppError("PAYMENT_UNAVAILABLE", "This payment method is not available yet.")
  },
  async refundPayment() {
    throw new AppError("PAYMENT_UNAVAILABLE", "This payment method is not available yet.")
  },
}
