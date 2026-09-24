import "server-only"

import type { AdminContext } from "@/features/auth/session"
import { mapImages, mapSpecifications } from "@/features/catalog/mappers"
import { toAppError } from "@/lib/errors/database"

import type { AdminProductFilters, ProductFormInput } from "./schemas"

export const ADMIN_PAGE_SIZE = 25

export type AdminProductRow = {
  id: string
  name: string
  slug: string
  sku: string | null
  price: number
  originalPrice: number
  salePrice: number | null
  stock: number
  trackInventory: boolean
  lowStockThreshold: number
  isActive: boolean
  isFeatured: boolean
  imageUrl: string | null
  categoryName: string | null
  brandName: string | null
  updatedAt: string
}

/** Admin product list (RLS: staff+ of this tenant see drafts too). */
export async function listAdminProducts(ctx: AdminContext, filters: AdminProductFilters) {
  let query = ctx.supabase
    .from("products")
    .select(
      "id, name, slug, sku, price, original_price, sale_price, stock_quantity, track_inventory, low_stock_threshold, is_active, is_featured, updated_at, category:categories!products_category_fk(name), brand:brands!products_brand_fk(name), images:product_images(image_url, is_primary)",
      { count: "exact" },
    )
    .eq("tenant_id", ctx.tenant.id)

  if (filters.q) {
    const term = filters.q.replace(/[%_,()\\]/g, " ").trim()
    if (term) query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%`)
  }
  if (filters.category) query = query.eq("category_id", filters.category)
  if (filters.status === "active") query = query.eq("is_active", true)
  if (filters.status === "draft") query = query.eq("is_active", false)
  if (filters.status === "out_of_stock") query = query.eq("track_inventory", true).eq("stock_quantity", 0)
  if (filters.status === "low_stock") query = query.eq("track_inventory", true).lte("stock_quantity", 5)

  const from = (filters.page - 1) * ADMIN_PAGE_SIZE
  const { data, count, error } = await query.order("updated_at", { ascending: false }).range(from, from + ADMIN_PAGE_SIZE - 1)
  if (error) throw toAppError(error, { op: "listAdminProducts", tenantId: ctx.tenant.id })

  const rows: AdminProductRow[] = (data ?? []).map((p) => {
    const primary = p.images?.find((i) => i.is_primary) ?? p.images?.[0]
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      price: Number(p.price),
      originalPrice: Number(p.original_price),
      salePrice: p.sale_price == null ? null : Number(p.sale_price),
      stock: p.stock_quantity,
      trackInventory: p.track_inventory,
      lowStockThreshold: p.low_stock_threshold,
      isActive: p.is_active,
      isFeatured: p.is_featured,
      imageUrl: primary?.image_url ?? null,
      categoryName: p.category?.name ?? null,
      brandName: p.brand?.name ?? null,
      updatedAt: p.updated_at,
    }
  })
  return { rows, total: count ?? 0, pageCount: Math.max(1, Math.ceil((count ?? 0) / ADMIN_PAGE_SIZE)) }
}

/** Product + images + private cost, shaped as form defaults. */
export async function getAdminProduct(ctx: AdminContext, id: string): Promise<(ProductFormInput & { id: string }) | null> {
  const [{ data: p, error }, { data: cost }] = await Promise.all([
    ctx.supabase
      .from("products")
      .select("*, images:product_images(id, image_url, storage_path, alt_text, is_primary, display_order)")
      .eq("tenant_id", ctx.tenant.id)
      .eq("id", id)
      .maybeSingle(),
    ctx.supabase.from("product_costs").select("cost_price").eq("product_id", id).maybeSingle(),
  ])
  if (error) throw toAppError(error, { op: "getAdminProduct", tenantId: ctx.tenant.id })
  if (!p) return null

  const storagePaths = new Map((p.images ?? []).map((i) => [i.id, i.storage_path]))
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    sku: p.sku ?? "",
    shortDescription: p.short_description ?? "",
    description: p.description ?? "",
    categoryId: p.category_id ?? "",
    brandId: p.brand_id ?? "",
    originalPrice: Number(p.original_price),
    salePrice: p.sale_price == null ? "" : Number(p.sale_price),
    costPrice: cost?.cost_price == null ? "" : Number(cost.cost_price),
    trackInventory: p.track_inventory,
    stockQuantity: p.stock_quantity,
    lowStockThreshold: p.low_stock_threshold,
    isFeatured: p.is_featured,
    isActive: p.is_active,
    specifications: mapSpecifications(p.specifications),
    tags: p.tags ?? [],
    seoTitle: p.seo_title ?? "",
    seoDescription: p.seo_description ?? "",
    images: mapImages(p.images ?? []).map((img) => ({
      id: img.id,
      url: img.url,
      storagePath: storagePaths.get(img.id) ?? null,
      alt: img.alt ?? "",
      isPrimary: img.isPrimary,
    })),
  }
}

/** Options for category/brand selects (all, including inactive). */
export async function getCatalogOptions(ctx: AdminContext) {
  const [{ data: categories }, { data: brands }] = await Promise.all([
    ctx.supabase.from("categories").select("id, name, parent_id, display_order").eq("tenant_id", ctx.tenant.id).order("display_order"),
    ctx.supabase.from("brands").select("id, name").eq("tenant_id", ctx.tenant.id).order("name"),
  ])
  return { categories: categories ?? [], brands: brands ?? [] }
}

/** Depth-first, indented category options for selects. */
export function toCategoryOptions(rows: { id: string; name: string; parent_id: string | null; display_order: number }[]) {
  const children = new Map<string | null, typeof rows>()
  for (const r of rows) {
    const key = r.parent_id && rows.some((x) => x.id === r.parent_id) ? r.parent_id : null
    children.set(key, [...(children.get(key) ?? []), r])
  }
  const out: { id: string; name: string; depth: number }[] = []
  const walk = (parent: string | null, depth: number) => {
    for (const r of (children.get(parent) ?? []).sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name))) {
      out.push({ id: r.id, name: r.name, depth })
      walk(r.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}
