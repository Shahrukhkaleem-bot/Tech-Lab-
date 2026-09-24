import { describe, expect, it } from "vitest"

import { countActiveFilters, filtersToSearchParams, parseProductFilters } from "./filters"

describe("product filters (URL <-> state)", () => {
  it("parses valid params", () => {
    const f = parseProductFilters({ q: " earbuds ", brand: "sonora,voltix", min: "1000", max: "5000", rating: "4", in_stock: "1", sort: "price_asc", page: "2" })
    expect(f).toMatchObject({ q: "earbuds", brandSlugs: ["sonora", "voltix"], minPrice: 1000, maxPrice: 5000, minRating: 4, inStock: true, sort: "price_asc", page: 2 })
  })

  it("drops junk and injection attempts", () => {
    const f = parseProductFilters({ brand: "ok,<script>,Bad Slug", min: "-5", rating: "9", sort: "drop table", page: "abc", category: "../x" })
    expect(f.brandSlugs).toEqual(["ok"])
    expect(f.minPrice).toBeUndefined()
    expect(f.minRating).toBeUndefined()
    expect(f.sort).toBe("newest")
    expect(f.page).toBe(1)
    expect(f.categorySlug).toBeUndefined()
  })

  it("swaps inverted price ranges and defaults to relevance when searching", () => {
    const f = parseProductFilters({ min: "900", max: "100", q: "x" })
    expect([f.minPrice, f.maxPrice]).toEqual([100, 900])
    expect(f.sort).toBe("relevance")
  })

  it("round-trips through the URL, omitting defaults", () => {
    const f = parseProductFilters({ brand: "a,b", on_sale: "1", sort: "rating", page: "3" })
    const sp = filtersToSearchParams(f)
    expect(sp.toString()).toBe("brand=a%2Cb&on_sale=1&sort=rating&page=3")
    expect(parseProductFilters(Object.fromEntries(sp))).toEqual(f)
    expect(filtersToSearchParams(parseProductFilters({})).toString()).toBe("")
  })

  it("counts active filters", () => {
    expect(countActiveFilters(parseProductFilters({ brand: "a,b", min: "1", in_stock: "1" }))).toBe(4)
  })
})
