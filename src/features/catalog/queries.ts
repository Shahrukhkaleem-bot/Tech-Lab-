import "server-only"

import { unstable_cache } from "next/cache"
import { cache } from "react"

import type { HomepageSection } from "@/features/tenants/types"
import { cacheTags, cacheTtl } from "@/lib/cache/tags"
import { toAppError } from "@/lib/errors/database"
import { getSearchProvider } from "@/lib/search"
import { createSupabasePublicClient } from "@/lib/supabase/public"

import { buildCategoryTree, descendantIds } from "./category-tree"
import { mapBanner, mapBrand, mapProductDetail } from "./mappers"
import type { Banner, Brand, CategoryTree, ProductDetail, ProductFilters, ProductPage, ProductSummary, Review } from "./types"

/**
 * Public catalogue reads. Every function takes the tenant id as its first argument and
 * filters by it explicitly — there is no un-scoped query in this module.
 * All results are cached per tenant and invalidated by admin writes (see cacheTags).
 */

export const PAGE_SIZE = 24

export const getCategoryTree = cache(async (tenantId: string): Promise<CategoryTree> => {
  const rows = await unstable_cache(
    async () => {
      const supabase = createSupabasePublicClient()
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("display_order")
      if (error) throw toAppError(error, { op: "getCategoryTree", tenantId })
      return data ?? []
    },
    ["category-rows", tenantId],
    { tags: [cacheTags.tenant(tenantId), cacheTags.catalog(tenantId)], revalidate: cacheTtl.catalog },
  )()
  return buildCategoryTree(rows)
})

export const getBrands = cache(async (tenantId: string): Promise<Brand[]> => {
  return unstable_cache(
    async () => {
      const supabase = createSupabasePublicClient()
      const { data, error } = await supabase
        .from("brands")
        .select("id, name, slug, logo_url, description, is_featured")
        .eq("tenant_id", tenantId)
        .order("display_order")
        .order("name")
      if (error) throw toAppError(error, { op: "getBrands", tenantId })
      return (data ?? []).map(mapBrand)
    },
    ["brands", tenantId],
    { tags: [cacheTags.tenant(tenantId), cacheTags.catalog(tenantId)], revalidate: cacheTtl.catalog },
  )()
})

export async function getBrandBySlug(tenantId: string, slug: string): Promise<Brand | null> {
  const brands = await getBrands(tenantId)
  return brands.find((b) => b.slug === slug) ?? null
}

/** Listing page: resolves slugs → ids (including sub-categories), then searches. */
export async function listProducts(tenantId: string, filters: ProductFilters, pageSize = PAGE_SIZE): Promise<ProductPage> {
  const [tree, brands] = await Promise.all([getCategoryTree(tenantId), getBrands(tenantId)])

  const category = filters.categorySlug ? tree.bySlug[filters.categorySlug] : undefined
  if (filters.categorySlug && !category) return { items: [], total: 0, page: 1, pageSize, pageCount: 1 }

  const brandIds = filters.brandSlugs.flatMap((slug) => brands.find((b) => b.slug === slug)?.id ?? [])
  if (filters.brandSlugs.length && !brandIds.length) return { items: [], total: 0, page: 1, pageSize, pageCount: 1 }

  const query = {
    tenantId,
    query: filters.q,
    categoryIds: category ? descendantIds(tree, category.id) : undefined,
    brandIds,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    minRating: filters.minRating,
    inStock: filters.inStock,
    onSale: filters.onSale,
    sort: filters.sort,
    page: filters.page,
    pageSize,
  }

  return unstable_cache(() => getSearchProvider().search(query), ["product-list", JSON.stringify(query)], {
    tags: [cacheTags.tenant(tenantId), cacheTags.products(tenantId)],
    revalidate: cacheTtl.products,
  })()
}

/** Homepage rails ("Featured", "Top sellers", …) configured per tenant in store_settings. */
export async function getSectionProducts(tenantId: string, section: HomepageSection): Promise<ProductSummary[]> {
  const base = { page: 1, sort: "newest" as const, brandSlugs: [], inStock: false, onSale: false }
  const filters: ProductFilters =
    section.type === "best_sellers"
      ? { ...base, sort: "best_selling" }
      : section.type === "on_sale"
        ? { ...base, onSale: true, sort: "best_selling" }
        : section.type === "category"
          ? { ...base, categorySlug: section.category_slug }
          : base

  if (section.type === "featured") {
    const query = { tenantId, featured: true, sort: "newest" as const, page: 1, pageSize: section.limit }
    return unstable_cache(async () => (await getSearchProvider().search(query)).items, ["featured", tenantId, String(section.limit)], {
      tags: [cacheTags.tenant(tenantId), cacheTags.products(tenantId)],
      revalidate: cacheTtl.products,
    })()
  }
  return (await listProducts(tenantId, filters, section.limit)).items
}

export const getProductBySlug = cache(async (tenantId: string, slug: string): Promise<ProductDetail | null> => {
  return unstable_cache(
    async () => {
      const supabase = createSupabasePublicClient()
      const { data, error } = await supabase
        .from("products")
        .select(
          "*, brand:brands!products_brand_fk(id, name, slug), images:product_images(id, image_url, alt_text, is_primary, display_order)",
        )
        .eq("tenant_id", tenantId)
        .eq("slug", slug)
        .maybeSingle()
      if (error) throw toAppError(error, { op: "getProductBySlug", tenantId, slug })
      return data ? mapProductDetail(data) : null
    },
    ["product", tenantId, slug],
    { tags: [cacheTags.tenant(tenantId), cacheTags.products(tenantId)], revalidate: cacheTtl.products },
  )()
})

export async function getRelatedProducts(tenantId: string, product: ProductDetail, limit = 8): Promise<ProductSummary[]> {
  if (!product.categoryId) return []
  const tree = await getCategoryTree(tenantId)
  const category = tree.byId[product.categoryId]
  if (!category) return []
  const page = await listProducts(
    tenantId,
    { categorySlug: category.slug, brandSlugs: [], inStock: false, onSale: false, sort: "best_selling", page: 1 },
    limit + 1,
  )
  return page.items.filter((p) => p.id !== product.id).slice(0, limit)
}

export const getActiveBanners = cache(async (tenantId: string): Promise<Banner[]> => {
  return unstable_cache(
    async () => {
      const supabase = createSupabasePublicClient()
      const { data, error } = await supabase
        .from("banners")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("display_order")
        .limit(8)
      if (error) throw toAppError(error, { op: "getActiveBanners", tenantId })
      return (data ?? []).map(mapBanner)
    },
    ["banners", tenantId],
    // Short TTL: banners have start/end schedules evaluated by RLS at query time.
    { tags: [cacheTags.tenant(tenantId), cacheTags.content(tenantId)], revalidate: 300 },
  )()
})

type ReviewWithProduct = {
  id: string
  customer_name: string
  rating: number
  title: string | null
  comment: string | null
  is_verified: boolean
  created_at: string
  product: { name: string; slug: string; images: { image_url: string; is_primary: boolean }[] } | null
}

function mapReview(r: ReviewWithProduct): Review {
  const img = r.product?.images?.find((i) => i.is_primary) ?? r.product?.images?.[0]
  return {
    id: r.id,
    customerName: r.customer_name,
    rating: r.rating,
    title: r.title,
    comment: r.comment,
    isVerified: r.is_verified,
    createdAt: r.created_at,
    product: r.product ? { name: r.product.name, slug: r.product.slug, imageUrl: img?.image_url ?? null } : null,
  }
}

const REVIEW_SELECT =
  "id, customer_name, rating, title, comment, is_verified, created_at, product:products!reviews_product_fk(name, slug, images:product_images(image_url, is_primary))"

export const getLatestReviews = cache(async (tenantId: string, limit = 12): Promise<Review[]> => {
  return unstable_cache(
    async () => {
      const supabase = createSupabasePublicClient()
      const { data, error } = await supabase
        .from("reviews")
        .select(REVIEW_SELECT)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(limit)
      if (error) throw toAppError(error, { op: "getLatestReviews", tenantId })
      return ((data ?? []) as unknown as ReviewWithProduct[]).map(mapReview)
    },
    ["latest-reviews", tenantId, String(limit)],
    { tags: [cacheTags.tenant(tenantId), cacheTags.reviews(tenantId)], revalidate: cacheTtl.reviews },
  )()
})

export const getProductReviews = cache(async (tenantId: string, productId: string, limit = 20): Promise<Review[]> => {
  return unstable_cache(
    async () => {
      const supabase = createSupabasePublicClient()
      const { data, error } = await supabase
        .from("reviews")
        .select("id, customer_name, rating, title, comment, is_verified, created_at")
        .eq("tenant_id", tenantId)
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
        .limit(limit)
      if (error) throw toAppError(error, { op: "getProductReviews", tenantId, productId })
      return (data ?? []).map((r) => mapReview({ ...r, product: null }))
    },
    ["product-reviews", tenantId, productId, String(limit)],
    { tags: [cacheTags.tenant(tenantId), cacheTags.reviews(tenantId)], revalidate: cacheTtl.reviews },
  )()
})

/** Minimal rows for sitemap.xml. */
export async function getSitemapProducts(tenantId: string) {
  return unstable_cache(
    async () => {
      const supabase = createSupabasePublicClient()
      const { data, error } = await supabase
        .from("products")
        .select("slug, updated_at")
        .eq("tenant_id", tenantId)
        .order("updated_at", { ascending: false })
        .limit(50_000)
      if (error) throw toAppError(error, { op: "getSitemapProducts", tenantId })
      return data ?? []
    },
    ["sitemap-products", tenantId],
    { tags: [cacheTags.tenant(tenantId), cacheTags.products(tenantId)], revalidate: 3600 },
  )()
}
