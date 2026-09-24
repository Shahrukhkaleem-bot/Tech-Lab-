"use server"

import { z } from "zod"

import { adminAction } from "@/features/admin/context"
import type { AdminContext } from "@/features/auth/session"
import { cacheTags, invalidate } from "@/lib/cache/tags"
import type { ActionResult } from "@/lib/errors/app-error"
import { toAppError } from "@/lib/errors/database"
import { parseStoragePublicUrl } from "@/lib/storage/paths"

import { bannerFormSchema, brandFormSchema, categoryFormSchema } from "./schemas"

/** Deletes a replaced/removed image if it lives in this tenant's storage folder. */
async function cleanupReplacedImage(ctx: AdminContext, oldUrl: string | null | undefined, newUrl: string | null | undefined) {
  if (!oldUrl || oldUrl === newUrl) return
  const ref = parseStoragePublicUrl(oldUrl, process.env.NEXT_PUBLIC_SUPABASE_URL)
  if (ref && ref.path.startsWith(`${ctx.tenant.id}/`)) await ctx.supabase.storage.from(ref.bucket).remove([ref.path])
}

const id = z.uuid()

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
export async function saveCategoryAction(categoryId: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  return adminAction("categories.save", "manageCatalog", async (ctx) => {
    const v = categoryFormSchema.parse(input)
    const row = {
      tenant_id: ctx.tenant.id,
      name: v.name,
      slug: v.slug,
      description: v.description || null,
      parent_id: v.parentId || null,
      image_url: v.imageUrl ?? null,
      display_order: v.displayOrder,
      is_active: v.isActive,
      seo_title: v.seoTitle || null,
      seo_description: v.seoDescription || null,
    }
    let previousImage: string | null = null
    if (categoryId) {
      const { data: prev } = await ctx.supabase.from("categories").select("image_url").eq("tenant_id", ctx.tenant.id).eq("id", id.parse(categoryId)).maybeSingle()
      previousImage = prev?.image_url ?? null
    }
    const { data, error } = categoryId
      ? await ctx.supabase.from("categories").update(row).eq("tenant_id", ctx.tenant.id).eq("id", categoryId).select("id").single()
      : await ctx.supabase.from("categories").insert(row).select("id").single()
    if (error) throw toAppError(error, { op: "admin.saveCategory", tenantId: ctx.tenant.id })
    await cleanupReplacedImage(ctx, previousImage, row.image_url)
    invalidate(cacheTags.catalog(ctx.tenant.id), cacheTags.products(ctx.tenant.id))
    return { id: data.id }
  })
}

export async function deleteCategoryAction(categoryId: string): Promise<ActionResult<null>> {
  return adminAction("categories.delete", "manageCatalog", async (ctx) => {
    const { data, error } = await ctx.supabase.from("categories").delete().eq("tenant_id", ctx.tenant.id).eq("id", id.parse(categoryId)).select("image_url").maybeSingle()
    if (error) throw toAppError(error, { op: "admin.deleteCategory", tenantId: ctx.tenant.id })
    await cleanupReplacedImage(ctx, data?.image_url, null)
    invalidate(cacheTags.catalog(ctx.tenant.id), cacheTags.products(ctx.tenant.id))
    return null
  })
}

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------
export async function saveBrandAction(brandId: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  return adminAction("brands.save", "manageCatalog", async (ctx) => {
    const v = brandFormSchema.parse(input)
    const row = {
      tenant_id: ctx.tenant.id,
      name: v.name,
      slug: v.slug,
      description: v.description || null,
      logo_url: v.logoUrl ?? null,
      display_order: v.displayOrder,
      is_featured: v.isFeatured,
      is_active: v.isActive,
    }
    let previousLogo: string | null = null
    if (brandId) {
      const { data: prev } = await ctx.supabase.from("brands").select("logo_url").eq("tenant_id", ctx.tenant.id).eq("id", id.parse(brandId)).maybeSingle()
      previousLogo = prev?.logo_url ?? null
    }
    const { data, error } = brandId
      ? await ctx.supabase.from("brands").update(row).eq("tenant_id", ctx.tenant.id).eq("id", brandId).select("id").single()
      : await ctx.supabase.from("brands").insert(row).select("id").single()
    if (error) throw toAppError(error, { op: "admin.saveBrand", tenantId: ctx.tenant.id })
    await cleanupReplacedImage(ctx, previousLogo, row.logo_url)
    invalidate(cacheTags.catalog(ctx.tenant.id), cacheTags.products(ctx.tenant.id))
    return { id: data.id }
  })
}

export async function deleteBrandAction(brandId: string): Promise<ActionResult<null>> {
  return adminAction("brands.delete", "manageCatalog", async (ctx) => {
    const { data, error } = await ctx.supabase.from("brands").delete().eq("tenant_id", ctx.tenant.id).eq("id", id.parse(brandId)).select("logo_url").maybeSingle()
    if (error) throw toAppError(error, { op: "admin.deleteBrand", tenantId: ctx.tenant.id })
    await cleanupReplacedImage(ctx, data?.logo_url, null)
    invalidate(cacheTags.catalog(ctx.tenant.id), cacheTags.products(ctx.tenant.id))
    return null
  })
}

// ---------------------------------------------------------------------------
// Banners
// ---------------------------------------------------------------------------
export async function saveBannerAction(bannerId: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  return adminAction("banners.save", "manageContent", async (ctx) => {
    const v = bannerFormSchema.parse(input)
    const row = {
      tenant_id: ctx.tenant.id,
      heading: v.heading,
      description: v.description || null,
      badge: v.badge || null,
      cta_label: v.ctaLabel || null,
      link_url: v.linkUrl || null,
      desktop_image_url: v.desktopImageUrl,
      mobile_image_url: v.mobileImageUrl ?? null,
      display_order: v.displayOrder,
      is_active: v.isActive,
      starts_at: v.startsAt ? new Date(v.startsAt).toISOString() : null,
      ends_at: v.endsAt ? new Date(v.endsAt).toISOString() : null,
    }
    const { data, error } = bannerId
      ? await ctx.supabase.from("banners").update(row).eq("tenant_id", ctx.tenant.id).eq("id", id.parse(bannerId)).select("id").single()
      : await ctx.supabase.from("banners").insert(row).select("id").single()
    if (error) throw toAppError(error, { op: "admin.saveBanner", tenantId: ctx.tenant.id })
    invalidate(cacheTags.content(ctx.tenant.id))
    return { id: data.id }
  })
}

export async function deleteBannerAction(bannerId: string): Promise<ActionResult<null>> {
  return adminAction("banners.delete", "manageContent", async (ctx) => {
    const { data, error } = await ctx.supabase
      .from("banners")
      .delete()
      .eq("tenant_id", ctx.tenant.id)
      .eq("id", id.parse(bannerId))
      .select("desktop_image_url, mobile_image_url")
      .maybeSingle()
    if (error) throw toAppError(error, { op: "admin.deleteBanner", tenantId: ctx.tenant.id })
    await cleanupReplacedImage(ctx, data?.desktop_image_url, null)
    await cleanupReplacedImage(ctx, data?.mobile_image_url, null)
    invalidate(cacheTags.content(ctx.tenant.id))
    return null
  })
}
