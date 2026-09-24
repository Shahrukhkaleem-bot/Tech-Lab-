import { describe, expect, it } from "vitest"

import { contrastRatio, hexToRgb, readableForeground } from "./color"

describe("color", () => {
  it("parses hex", () => {
    expect(hexToRgb("#1d4ed8")).toEqual({ r: 29, g: 78, b: 216 })
    expect(hexToRgb("nope")).toBeNull()
  })

  it("computes WCAG contrast", () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 0)
  })

  it("picks a readable foreground for any brand colour", () => {
    expect(readableForeground("#1d4ed8")).toBe("#ffffff") // dark blue
    expect(readableForeground("#f59e0b")).toBe("#111827") // amber
    expect(readableForeground("#ffffff")).toBe("#111827")
    expect(readableForeground("#000000")).toBe("#ffffff")
    for (const bg of ["#1d4ed8", "#be123c", "#15803d", "#f59e0b", "#fde047", "#0f172a"]) {
      const fg = hexToRgb(readableForeground(bg))!
      expect(contrastRatio(hexToRgb(bg)!, fg)).toBeGreaterThanOrEqual(4.5)
    }
  })
})
