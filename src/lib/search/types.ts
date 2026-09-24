import type { ProductPage, ProductSort, ProductSummary } from "@/features/catalog/types"

/**
 * Search provider boundary. The UI and route handlers only talk to this interface,
 * so Postgres FTS can be swapped for Algolia / Typesense / Elasticsearch by adding an
 * implementation and changing `getSearchProvider()` — no UI changes.
 */
export type ProductSearchQuery = {
  tenantId: string
  query?: string
  categoryIds?: string[]
  brandIds?: string[]
  minPrice?: number
  maxPrice?: number
  minRating?: number
  inStock?: boolean
  onSale?: boolean
  featured?: boolean
  sort: ProductSort
  page: number
  pageSize: number
}

export interface ProductSearchProvider {
  readonly name: string
  search(query: ProductSearchQuery): Promise<ProductPage>
  suggest(tenantId: string, text: string, limit: number): Promise<ProductSummary[]>
}
