import { describe, expect, it } from "vitest"

import { serializeJsonLd } from "@/components/common/json-ld"
import { checkoutSchema } from "@/features/checkout/schemas"

import { safeNextPath } from "./safe-redirect"

describe("safeNextPath (open-redirect protection)", () => {
  it("allows same-origin paths", () => {
    expect(safeNextPath("/admin/orders?x=1")).toBe("/admin/orders?x=1")
  })
  it.each(["//evil.com", "https://evil.com", "/\\evil.com", "javascript:alert(1)", "admin", "/ok\r\nSet-Cookie: x"])("rejects %s", (bad) => {
    expect(safeNextPath(bad, "/fallback")).toBe("/fallback")
  })
})

describe("serializeJsonLd (script-breakout protection)", () => {
  it("escapes characters that could close the script tag", () => {
    const out = serializeJsonLd({ name: "</script><script>alert(1)</script>", x: "a & b" })
    expect(out).not.toContain("<")
    expect(out).not.toContain(">")
    expect(JSON.parse(out).name).toBe("</script><script>alert(1)</script>")
  })
})

describe("checkout input (price/tenant manipulation)", () => {
  const valid = {
    customer: { name: "Ali Khan", email: "ALI@Example.com", phone: "0300 1234567", city: "Lahore", address: "House 1, Street 2" },
    paymentMethod: "cod",
    items: [{ productId: "11111111-1111-4111-8111-111111111111", quantity: 2 }],
    idempotencyKey: "22222222-2222-4222-8222-222222222222",
  }

  it("accepts valid input and normalises email", () => {
    const parsed = checkoutSchema.parse(valid)
    expect(parsed.customer.email).toBe("ali@example.com")
  })

  it("strips client-supplied prices, totals and tenant ids", () => {
    const parsed = checkoutSchema.parse({ ...valid, tenantId: "evil", total: 1, items: [{ ...valid.items[0], price: 1 }] }) as Record<string, unknown>
    expect(parsed.tenantId).toBeUndefined()
    expect(parsed.total).toBeUndefined()
    expect((parsed.items as Record<string, unknown>[])[0]!.price).toBeUndefined()
  })

  it("rejects bad quantities, empty carts and unknown payment methods", () => {
    expect(checkoutSchema.safeParse({ ...valid, items: [{ ...valid.items[0], quantity: 0 }] }).success).toBe(false)
    expect(checkoutSchema.safeParse({ ...valid, items: [{ ...valid.items[0], quantity: 1.5 }] }).success).toBe(false)
    expect(checkoutSchema.safeParse({ ...valid, items: [] }).success).toBe(false)
    expect(checkoutSchema.safeParse({ ...valid, paymentMethod: "free" }).success).toBe(false)
    expect(checkoutSchema.safeParse({ ...valid, customer: { ...valid.customer, phone: "abc" } }).success).toBe(false)
  })
})
