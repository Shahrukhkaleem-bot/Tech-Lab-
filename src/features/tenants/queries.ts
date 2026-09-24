import "server-only"

import { unstable_cache } from "next/cache"
import { cache } from "react"

import { cacheTags, cacheTtl } from "@/lib/cache/tags"
import { toAppError } from "@/lib/errors/database"
import { createSupabasePublicClient } from "@/lib/supabase/public"
import { isCustomDomainKey } from "@/lib/tenant/hostname"

import { mapNavigation, mapStoreSettings, mapTenant } from "./mappers"
import type { StoreNavigation, StoreSettings, Tenant } from "./types"

/**
 * Tenant lookup by routing key (subdomain label or verified custom domain).
 * Cached across requests (data cache) and de-duplicated within a request (React cache).
 * Only ACTIVE tenants resolve (RLS for anon), so suspended stores 404 automatically.
 */
class TenantNotFound extends Error {}

export const getTenantByKey = cache(async (key: string): Promise<Tenant | null> => {
  try {
    return await unstable_cache(
      async () => {
        const supabase = createSupabasePublicClient()
        const query = supabase.from("tenants").select("*").limit(1)
        const { data, error } = await (isCustomDomainKey(key)
          ? query.eq("custom_domain", key).not("custom_domain_verified_at", "is", null)
          : query.eq("subdomain", key)
        ).maybeSingle()

        if (error) throw toAppError(error, { op: "getTenantByKey", key })
        // Thrown (not returned) so "not found" is never cached: a newly connected domain or
        // store works immediately, and random Host headers can't fill the cache.
        if (!data) throw new TenantNotFound()
        return mapTenant(data)
      },
      ["tenant-by-key", key],
      { tags: ["tenants", cacheTags.tenantKey(key)], revalidate: cacheTtl.tenant },
    )()
  } catch (error) {
    if (error instanceof TenantNotFound) return null
    throw error
  }
})

export const getStoreSettings = cache(async (tenantId: string): Promise<StoreSettings> => {
  return unstable_cache(
    async () => {
      const supabase = createSupabasePublicClient()
      const { data, error } = await supabase.from("store_settings").select("*").eq("tenant_id", tenantId).maybeSingle()
      if (error) throw toAppError(error, { op: "getStoreSettings", tenantId })
      return mapStoreSettings(data)
    },
    ["store-settings", tenantId],
    { tags: [cacheTags.tenant(tenantId), cacheTags.settings(tenantId)], revalidate: cacheTtl.tenant },
  )()
})

export const getStoreNavigation = cache(async (tenantId: string): Promise<StoreNavigation> => {
  return unstable_cache(
    async () => {
      const supabase = createSupabasePublicClient()
      const { data, error } = await supabase
        .from("navigation_items")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("display_order")
      if (error) throw toAppError(error, { op: "getStoreNavigation", tenantId })
      return mapNavigation(data ?? [])
    },
    ["store-navigation", tenantId],
    { tags: [cacheTags.tenant(tenantId), cacheTags.content(tenantId)], revalidate: cacheTtl.content },
  )()
})

export type StorePage = { slug: string; title: string; content: string; seoDescription: string | null; updatedAt: string }

export const getStorePage = cache(async (tenantId: string, slug: string): Promise<StorePage | null> => {
  return unstable_cache(
    async () => {
      const supabase = createSupabasePublicClient()
      const { data, error } = await supabase
        .from("store_pages")
        .select("slug, title, content, seo_description, updated_at")
        .eq("tenant_id", tenantId)
        .eq("slug", slug)
        .maybeSingle()
      if (error) throw toAppError(error, { op: "getStorePage", tenantId, slug })
      return data
        ? { slug: data.slug, title: data.title, content: data.content, seoDescription: data.seo_description, updatedAt: data.updated_at }
        : null
    },
    ["store-page", tenantId, slug],
    { tags: [cacheTags.tenant(tenantId), cacheTags.content(tenantId)], revalidate: cacheTtl.content },
  )()
})

export const listStorePages = cache(async (tenantId: string) => {
  return unstable_cache(
    async () => {
      const supabase = createSupabasePublicClient()
      const { data, error } = await supabase
        .from("store_pages")
        .select("slug, title, updated_at")
        .eq("tenant_id", tenantId)
        .order("title")
      if (error) throw toAppError(error, { op: "listStorePages", tenantId })
      return data ?? []
    },
    ["store-pages", tenantId],
    { tags: [cacheTags.tenant(tenantId), cacheTags.content(tenantId)], revalidate: cacheTtl.content },
  )()
})
