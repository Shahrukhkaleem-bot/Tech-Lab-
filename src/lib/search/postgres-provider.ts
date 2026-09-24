import "server-only"

import { mapSearchRow } from "@/features/catalog/mappers"
import type { ProductPage } from "@/features/catalog/types"
import { toAppError } from "@/lib/errors/database"
import { createSupabasePublicClient } from "@/lib/supabase/public"

import type { ProductSearchProvider, ProductSearchQuery } from "./types"

/**
 * Postgres full-text + trigram search via the `search_products` SQL function
 * (SECURITY INVOKER — RLS applies as anon). Good up to ~100k products per tenant;
 * beyond that, add a dedicated provider behind the same interface.
 */
export const postgresSearchProvider: ProductSearchProvider = {
  name: "postgres",

  async search(q: ProductSearchQuery): Promise<ProductPage> {
    const supabase = createSupabasePublicClient()
    const pageSize = Math.min(Math.max(q.pageSize, 1), 60)
    const { data, error } = await supabase.rpc("search_products", {
      p_tenant_id: q.tenantId,
      p_query: q.query ?? null,
      p_category_ids: q.categoryIds?.length ? q.categoryIds : null,
      p_brand_ids: q.brandIds?.length ? q.brandIds : null,
      p_min_price: q.minPrice ?? null,
      p_max_price: q.maxPrice ?? null,
      p_min_rating: q.minRating ?? null,
      p_in_stock: q.inStock ?? false,
      p_on_sale: q.onSale ?? false,
      p_featured: q.featured ?? false,
      p_sort: q.sort,
      p_limit: pageSize,
      p_offset: (Math.max(q.page, 1) - 1) * pageSize,
    })
    if (error) throw toAppError(error, { op: "search_products", tenantId: q.tenantId })

    const rows = data ?? []
    const total = rows.length ? Number(rows[0]!.total_count) : 0
    return {
      items: rows.map(mapSearchRow),
      total,
      page: q.page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    }
  },

  async suggest(tenantId, text, limit) {
    const page = await this.search({ tenantId, query: text, sort: "relevance", page: 1, pageSize: limit })
    return page.items
  },
}
