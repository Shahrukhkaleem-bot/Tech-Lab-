import { createHmac } from "node:crypto"

import { describe, expect, it } from "vitest"

import { fromMinorUnits, sessionToVerification, toMinorUnits, verifyStripeWebhook } from "./stripe"

const secret = "whsec_test_secret"
const payload = JSON.stringify({ id: "evt_1", type: "checkout.session.completed", data: { object: { id: "cs_1" } } })
const sign = (body: string, t: number, key = secret) => `t=${t},v1=${createHmac("sha256", key).update(`${t}.${body}`).digest("hex")}`

describe("stripe webhook verification", () => {
  const now = 1_800_000_000

  it("accepts a valid signature", () => {
    expect(verifyStripeWebhook(payload, sign(payload, now), secret, now).id).toBe("evt_1")
  })

  it("rejects tampered payloads, wrong secrets, stale timestamps and missing headers", () => {
    expect(() => verifyStripeWebhook(payload.replace("evt_1", "evt_2"), sign(payload, now), secret, now)).toThrow()
    expect(() => verifyStripeWebhook(payload, sign(payload, now, "whsec_other"), secret, now)).toThrow()
    expect(() => verifyStripeWebhook(payload, sign(payload, now - 3600), secret, now)).toThrow(/tolerance/)
    expect(() => verifyStripeWebhook(payload, null, secret, now)).toThrow()
    expect(() => verifyStripeWebhook(payload, "t=abc", secret, now)).toThrow()
  })
})

describe("stripe amounts", () => {
  it("converts minor units, including zero-decimal currencies", () => {
    expect(toMinorUnits(1499.5, "PKR")).toBe(149950)
    expect(toMinorUnits(1000, "JPY")).toBe(1000)
    expect(fromMinorUnits(149950, "pkr")).toBe(1499.5)
  })

  it("maps sessions to verifications", () => {
    const v = sessionToVerification({
      id: "cs_1",
      url: null,
      payment_status: "paid",
      status: "complete",
      amount_total: 624900,
      currency: "pkr",
      payment_intent: "pi_1",
      metadata: { tenant_id: "t", order_id: "o" },
    })
    expect(v).toMatchObject({ status: "succeeded", amount: 6249, currency: "PKR", tenantId: "t", orderId: "o" })
  })
})
