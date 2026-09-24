import { describe, expect, it } from "vitest"

import { amountToFreeShipping, itemCount, lineTotal, roundMoney, shippingFee, subtotal } from "./pricing"

describe("pricing", () => {
  it("sums in minor units to avoid float drift", () => {
    expect(0.1 + 0.2).not.toBe(0.3)
    expect(subtotal([{ unitPrice: 0.1, quantity: 1 }, { unitPrice: 0.2, quantity: 1 }])).toBe(0.3)
    expect(subtotal([{ unitPrice: 19.99, quantity: 3 }])).toBe(59.97)
    expect(lineTotal({ unitPrice: 1199, quantity: 2 })).toBe(2398)
    expect(roundMoney(1.005)).toBe(1.01)
  })

  it("counts items", () => {
    expect(itemCount([{ quantity: 2 }, { quantity: 3 }])).toBe(5)
    expect(itemCount([])).toBe(0)
  })

  const rules = { flatRate: 250, freeShippingThreshold: 5000, cityRates: [{ city: "Lahore", rate: 150 }] }

  it("applies free shipping, then city rate, then flat rate", () => {
    expect(shippingFee(rules, 5000, "Karachi")).toBe(0)
    expect(shippingFee(rules, 1000, "  lahore ")).toBe(150)
    expect(shippingFee(rules, 1000, "Karachi")).toBe(250)
    expect(shippingFee(rules, 1000, null)).toBe(250)
    expect(shippingFee({ flatRate: 99, cityRates: [] }, 1_000_000)).toBe(99)
  })

  it("computes the amount left for free shipping", () => {
    expect(amountToFreeShipping(rules, 4000)).toBe(1000)
    expect(amountToFreeShipping(rules, 6000)).toBeNull()
    expect(amountToFreeShipping({ flatRate: 1, cityRates: [] }, 10)).toBeNull()
  })
})
