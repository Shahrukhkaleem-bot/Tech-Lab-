import { PRODUCT_SORTS, type ProductFilters, type ProductSort } from "./types"

/**
 * URL ⇄ filter state. The URL is the single source of truth for listing filters, so
 * every filtered view is shareable and back/forward-navigable. Parsing is lenient:
 * junk values are dropped rather than erroring.
 */

export type SearchParamsRecord = Record<string, string | string[] | undefined>

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

function num(v: string | undefined, min: number, max: number): number | undefined {
  if (v == null || v === "") return undefined
  const n = Number(v)
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function parseProductFilters(params: SearchParamsRecord, defaults: Partial<ProductFilters> = {}): ProductFilters {
  const q = first(params.q)?.trim().slice(0, 100) || undefined
  const sortParam = first(params.sort) as ProductSort | undefined
  const sort: ProductSort = sortParam && PRODUCT_SORTS.includes(sortParam) ? sortParam : q ? "relevance" : (defaults.sort ?? "newest")
  const category = first(params.category)
  const brands = (first(params.brand) ?? "")
    .split(",")
    .map((b) => b.trim())
    .filter((b) => SLUG.test(b))
    .slice(0, 20)

  let minPrice = num(first(params.min), 0, 1e9)
  let maxPrice = num(first(params.max), 0, 1e9)
  if (minPrice != null && maxPrice != null && minPrice > maxPrice) [minPrice, maxPrice] = [maxPrice, minPrice]

  return {
    q,
    categorySlug: category && SLUG.test(category) ? category : defaults.categorySlug,
    brandSlugs: brands.length ? brands : (defaults.brandSlugs ?? []),
    minPrice,
    maxPrice,
    minRating: num(first(params.rating), 1, 5),
    inStock: first(params.in_stock) === "1",
    onSale: first(params.on_sale) === "1" || Boolean(defaults.onSale),
    sort,
    page: Math.floor(num(first(params.page), 1, 10_000) ?? 1),
  }
}

/** Serialises filters back to a query string (omitting defaults). */
export function filtersToSearchParams(filters: Partial<ProductFilters>): URLSearchParams {
  const sp = new URLSearchParams()
  if (filters.q) sp.set("q", filters.q)
  if (filters.categorySlug) sp.set("category", filters.categorySlug)
  if (filters.brandSlugs?.length) sp.set("brand", filters.brandSlugs.join(","))
  if (filters.minPrice != null) sp.set("min", String(filters.minPrice))
  if (filters.maxPrice != null) sp.set("max", String(filters.maxPrice))
  if (filters.minRating != null) sp.set("rating", String(filters.minRating))
  if (filters.inStock) sp.set("in_stock", "1")
  if (filters.onSale) sp.set("on_sale", "1")
  if (filters.sort && filters.sort !== "newest" && !(filters.q && filters.sort === "relevance")) sp.set("sort", filters.sort)
  if (filters.page && filters.page > 1) sp.set("page", String(filters.page))
  return sp
}

export function countActiveFilters(f: ProductFilters): number {
  return (
    (f.categorySlug ? 1 : 0) +
    f.brandSlugs.length +
    (f.minPrice != null || f.maxPrice != null ? 1 : 0) +
    (f.minRating != null ? 1 : 0) +
    (f.inStock ? 1 : 0) +
    (f.onSale ? 1 : 0)
  )
}
