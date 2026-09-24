import "server-only"

import { revalidateTag } from "next/cache"

/**
 * Every cached read is tagged with the tenant it belongs to, so an admin save in one
 * store invalidates exactly that store's cache and nothing else.
 */
export const cacheTags = {
  tenantKey: (key: string) => `tenant-key:${key}`,
  tenant: (tenantId: string) => `tenant:${tenantId}`,
  settings: (tenantId: string) => `tenant:${tenantId}:settings`,
  catalog: (tenantId: string) => `tenant:${tenantId}:catalog`,
  products: (tenantId: string) => `tenant:${tenantId}:products`,
  reviews: (tenantId: string) => `tenant:${tenantId}:reviews`,
  content: (tenantId: string) => `tenant:${tenantId}:content`,
} as const

/** Seconds; used as a safety net on top of on-demand invalidation. */
export const cacheTtl = {
  tenant: 3600,
  catalog: 3600,
  products: 300,
  reviews: 600,
  content: 3600,
} as const

/** Immediate invalidation (read-your-own-writes for admins). */
export function invalidate(...tags: string[]) {
  for (const tag of tags) revalidateTag(tag, { expire: 0 })
}
