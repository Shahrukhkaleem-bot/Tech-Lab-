import { describe, expect, it } from "vitest"

import { discountPercent, formatMoney, formatRelativeTime, initials, slugify } from "./format"

describe("format", () => {
  it("formats money with whole numbers compactly", () => {
    expect(formatMoney(1234, "USD", "en-US")).toBe("$1,234")
    expect(formatMoney(1234.5, "USD", "en-US")).toBe("$1,234.50")
    expect(formatMoney(2499, "PKR", "en-PK")).toMatch(/2,499/)
  })

  it("computes discount percentages", () => {
    expect(discountPercent(1000, 750)).toBe(25)
    expect(discountPercent(1000, null)).toBe(0)
    expect(discountPercent(1000, 1200)).toBe(0)
    expect(discountPercent(0, 0)).toBe(0)
  })

  it("formats relative time", () => {
    const now = new Date("2026-01-10T12:00:00Z")
    expect(formatRelativeTime("2026-01-09T12:00:00Z", now)).toBe("yesterday")
    expect(formatRelativeTime("2026-01-03T12:00:00Z", now)).toBe("last week")
  })

  it("slugifies and builds initials", () => {
    expect(slugify("  Café Crème — 2 Pack!  ")).toBe("cafe-creme-2-pack")
    expect(slugify("---")).toBe("")
    expect(initials("Demo Electronics Store")).toBe("DE")
  })
})
