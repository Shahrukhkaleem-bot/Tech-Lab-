import "server-only"

import { headers } from "next/headers"
import { notFound } from "next/navigation"

import { AppError } from "@/lib/errors/app-error"
import { decodeTenantKey, resolveHost } from "@/lib/tenant/hostname"

import { getTenantByKey } from "./queries"
import type { Tenant } from "./types"

/**
 * Tenant for a page/layout under app/[domain]. The segment was produced by proxy.ts
 * from the Host header, so it cannot be spoofed by the URL path.
 */
export async function getTenantFromParams(params: Promise<{ domain: string }>): Promise<Tenant> {
  const { domain } = await params
  const tenant = await getTenantByKey(decodeTenantKey(domain))
  if (!tenant) notFound()
  return tenant
}

/**
 * Tenant for Server Actions / Route Handlers. Re-derived from the Host header on every
 * call — never accept a tenant id from the client.
 */
export async function getRequestTenant(): Promise<Tenant> {
  const host = (await headers()).get("host")
  const resolution = resolveHost(host, {
    rootDomain: process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000",
    devTenant: process.env.DEV_TENANT,
  })
  if (resolution.kind !== "tenant") throw new AppError("NOT_FOUND", "This store is not available.")
  const tenant = await getTenantByKey(resolution.key)
  if (!tenant) throw new AppError("NOT_FOUND", "This store is not available.")
  return tenant
}

/** Canonical origin for a tenant (custom domain wins), used for SEO and emails. */
export function tenantOrigin(tenant: Tenant): string {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000"
  const isLocal = root.startsWith("localhost")
  if (tenant.customDomain) return `https://${tenant.customDomain}`
  // Before a real domain is attached, the app runs on a single *.vercel.app host that serves
  // DEV_TENANT (vercel.app does not allow per-tenant subdomains), so links use that host as-is.
  if (root.endsWith(".vercel.app")) return `https://${root}`
  return `${isLocal ? "http" : "https"}://${tenant.subdomain}.${root}`
}
