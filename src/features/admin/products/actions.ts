"use server"

import { z } from "zod"

import { adminAction } from "@/features/admin/context"
import type { AdminContext } from "@/features/auth/session"
import { cacheTags, invalidate } from "@/lib/cache/tags"
import type { ActionResult } from "@/lib/errors/app-error"
import { toAppError } from "@/lib/errors/database"
import { logger } from "@/lib/logger"

import { bulkProductActionSchema, productFormSchema } from "./schemas"

function invalidateCatalog(tenantId: string) {
  invalidate(cacheTags.products(tenantId), cacheTags.reviews(tenantId))
}

/** Best-effort storage cleanup after the DB commit (orphans are harmless, never the reverse). */
async function removeProductFiles(ctx: AdminContext, paths: string[]) {
  const own = paths.filter((p) => p.startsWith(`${ctx.tenant.id}/`))
  if (!own.length) return
  const { error } = await ctx.supabase.storage.from("product-images").remove(own)
  if (error) logger.warn("admin.products.storage_cleanup_failed", { tenantId: ctx.tenant.id, count: own.length, error })
}

export async function saveProductAction(productId: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  return adminAction("products.save", "manageCatalog", async (ctx) => {
    const id = productId ? z.uuid().parse(productId) : null
    const v = productFormSchema.parse(input)

    const { data, error } = await ctx.supabase.rpc("admin_save_product", {
      p_tenant_id: ctx.tenant.id,
      p_product_id: id,
      p_data: {
        name: v.name,
        slug: v.slug,
        sku: v.sku || null,
        short_description: v.shortDescription || null,
        description: v.description || null,
        category_id: v.categoryId || null,
        brand_id: v.brandId || null,
        original_price: v.originalPrice,
        sale_price: v.salePrice === "" || v.salePrice === undefined ? null : v.salePrice,
        track_inventory: v.trackInventory,
        stock_quantity: v.stockQuantity,
        low_stock_threshold: v.lowStockThreshold,
        is_featured: v.isFeatured,
        is_active: v.isActive,
        specifications: v.specifications,
        tags: v.tags,
        seo_title: v.seoTitle || null,
        seo_description: v.seoDescription || null,
      },
      p_images: v.images.map((img) => ({
        id: img.id,
        url: img.url,
        storage_path: img.storagePath ?? null,
        alt: img.alt || null,
        is_primary: img.isPrimary,
      })),
      p_cost_price: v.costPrice === "" || v.costPrice === undefined ? null : v.costPrice,
    })
    if (error) throw toAppError(error, { op: "admin.saveProduct", tenantId: ctx.tenant.id })

    const result = z.object({ id: z.uuid(), removed_paths: z.array(z.string()).default([]) }).parse(data)
    await removeProductFiles(ctx, result.removed_paths)
    invalidateCatalog(ctx.tenant.id)
    return { id: result.id }
  })
}

export async function bulkProductAction(input: unknown): Promise<ActionResult<{ affected: number }>> {
  return adminAction("products.bulk", "manageCatalog", async (ctx) => {
    const { ids, action } = bulkProductActionSchema.parse(input)
    const base = () => ctx.supabase.from("products")

    if (action === "delete") {
      // Collect storage files first; rows cascade (order items keep their snapshots).
      const { data: images } = await ctx.supabase.from("product_images").select("storage_path").eq("tenant_id", ctx.tenant.id).in("product_id", ids)
      const { data, error } = await base().delete().eq("tenant_id", ctx.tenant.id).in("id", ids).select("id")
      if (error) throw toAppError(error, { op: "admin.bulkDelete", tenantId: ctx.tenant.id })
      await removeProductFiles(ctx, (images ?? []).flatMap((i) => (i.storage_path ? [i.storage_path] : [])))
      invalidateCatalog(ctx.tenant.id)
      return { affected: data?.length ?? 0 }
    }

    const patch =
      action === "activate" ? { is_active: true } : action === "deactivate" ? { is_active: false } : { is_featured: action === "feature" }
    const { data, error } = await base().update(patch).eq("tenant_id", ctx.tenant.id).in("id", ids).select("id")
    if (error) throw toAppError(error, { op: "admin.bulkUpdate", tenantId: ctx.tenant.id })
    invalidateCatalog(ctx.tenant.id)
    return { affected: data?.length ?? 0 }
  })
}
