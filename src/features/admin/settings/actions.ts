"use server"

import { z } from "zod"

import { adminAction } from "@/features/admin/context"
import type { AdminContext } from "@/features/auth/session"
import { cacheTags, invalidate } from "@/lib/cache/tags"
import type { ActionResult } from "@/lib/errors/app-error"
import { toAppError } from "@/lib/errors/database"
import { parseStoragePublicUrl } from "@/lib/storage/paths"
import type { Json, StoreSettingsRow } from "@/types/database"

import {
  brandingSettingsSchema,
  contentSettingsSchema,
  generalSettingsSchema,
  paymentSettingsSchema,
  shippingSettingsSchema,
  storePageSchema,
} from "./schemas"

/** Tenant config is cached by routing key AND tenant id — invalidate both. */
function invalidateTenant(ctx: AdminContext) {
  const keys = [ctx.tenant.subdomain, ctx.tenant.customDomain].filter((k): k is string => Boolean(k))
  invalidate(...keys.map(cacheTags.tenantKey), cacheTags.tenant(ctx.tenant.id))
}

async function updateSettings(ctx: AdminContext, patch: Partial<Omit<StoreSettingsRow, "tenant_id" | "updated_at">>) {
  const { error } = await ctx.supabase.from("store_settings").update(patch).eq("tenant_id", ctx.tenant.id)
  if (error) throw toAppError(error, { op: "admin.updateSettings", tenantId: ctx.tenant.id })
}

export async function saveGeneralSettingsAction(input: unknown): Promise<ActionResult<null>> {
  return adminAction("settings.general", "manageSettings", async (ctx) => {
    const v = generalSettingsSchema.parse(input)
    const { error } = await ctx.supabase
      .from("tenants")
      .update({
        name: v.name,
        contact_email: v.contactEmail || null,
        contact_phone: v.contactPhone || null,
        whatsapp_number: v.whatsappNumber || null,
        address: v.address || null,
        social_links: v.social as Json,
      })
      .eq("id", ctx.tenant.id)
    if (error) throw toAppError(error, { op: "admin.general", tenantId: ctx.tenant.id })
    await updateSettings(ctx, { tagline: v.tagline || null, announcement: v.announcement || null })
    invalidateTenant(ctx)
    return null
  })
}

export async function saveBrandingAction(input: unknown): Promise<ActionResult<null>> {
  return adminAction("settings.branding", "manageSettings", async (ctx) => {
    const v = brandingSettingsSchema.parse(input)
    const { error } = await ctx.supabase.from("tenants").update({ brand_config: v as Json }).eq("id", ctx.tenant.id)
    if (error) throw toAppError(error, { op: "admin.branding", tenantId: ctx.tenant.id })

    // Remove replaced logo/favicon files from our storage.
    for (const [oldUrl, newUrl] of [
      [ctx.tenant.brand.logoUrl, v.logo_url],
      [ctx.tenant.brand.faviconUrl, v.favicon_url],
    ] as const) {
      const ref = oldUrl && oldUrl !== newUrl ? parseStoragePublicUrl(oldUrl, process.env.NEXT_PUBLIC_SUPABASE_URL) : null
      if (ref && ref.path.startsWith(`${ctx.tenant.id}/`)) await ctx.supabase.storage.from(ref.bucket).remove([ref.path])
    }
    invalidateTenant(ctx)
    return null
  })
}

export async function saveShippingSettingsAction(input: unknown): Promise<ActionResult<null>> {
  return adminAction("settings.shipping", "manageSettings", async (ctx) => {
    const { shippingInfo, returnInfo, ...shipping } = shippingSettingsSchema.parse(input)
    await updateSettings(ctx, { shipping_config: shipping as Json, shipping_info: shippingInfo || null, return_info: returnInfo || null })
    invalidateTenant(ctx)
    return null
  })
}

export async function savePaymentSettingsAction(input: unknown): Promise<ActionResult<null>> {
  return adminAction("settings.payment", "manageSettings", async (ctx) => {
    const v = paymentSettingsSchema.parse(input)
    await updateSettings(ctx, {
      payment_config: {
        enabled_methods: v.enabled_methods,
        bank_accounts: v.bank_accounts,
        ...(v.instructions ? { instructions: v.instructions } : {}),
        ...(v.stripe_account_id ? { stripe_account_id: v.stripe_account_id } : {}),
      } as Json,
    })
    invalidateTenant(ctx)
    return null
  })
}

export async function saveContentSettingsAction(input: unknown): Promise<ActionResult<null>> {
  return adminAction("settings.content", "manageSettings", async (ctx) => {
    const v = contentSettingsSchema.parse(input)
    await updateSettings(ctx, {
      trust_badges: v.trustBadges as Json,
      homepage_sections: v.homepageSections as Json,
      price_ranges: v.priceRanges as Json,
      footer_badges: v.footerBadges as Json,
      store_location: v.location as Json,
      seo: { ...(v.seoTitle ? { title: v.seoTitle } : {}), ...(v.seoDescription ? { description: v.seoDescription } : {}) } as Json,
    })
    invalidateTenant(ctx)
    return null
  })
}

export async function saveStorePageAction(pageId: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  return adminAction("settings.page", "manageSettings", async (ctx) => {
    const v = storePageSchema.parse(input)
    const row = {
      tenant_id: ctx.tenant.id,
      slug: v.slug,
      title: v.title,
      content: v.content,
      seo_description: v.seoDescription || null,
      is_published: v.isPublished,
    }
    const { data, error } = pageId
      ? await ctx.supabase.from("store_pages").update(row).eq("tenant_id", ctx.tenant.id).eq("id", z.uuid().parse(pageId)).select("id").single()
      : await ctx.supabase.from("store_pages").insert(row).select("id").single()
    if (error) throw toAppError(error, { op: "admin.savePage", tenantId: ctx.tenant.id })
    invalidate(cacheTags.content(ctx.tenant.id))
    return { id: data.id }
  })
}

export async function deleteStorePageAction(pageId: string): Promise<ActionResult<null>> {
  return adminAction("settings.deletePage", "manageSettings", async (ctx) => {
    const { error } = await ctx.supabase.from("store_pages").delete().eq("tenant_id", ctx.tenant.id).eq("id", z.uuid().parse(pageId))
    if (error) throw toAppError(error, { op: "admin.deletePage", tenantId: ctx.tenant.id })
    invalidate(cacheTags.content(ctx.tenant.id))
    return null
  })
}
