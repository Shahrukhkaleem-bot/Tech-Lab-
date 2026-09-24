/**
 * Pure hostname → tenant-key resolution, shared by proxy.ts and Server Actions.
 *
 *  store-a.example.com      → { kind: "tenant", key: "store-a" }       (subdomain)
 *  shop-a.com / www.shop-a.com → { kind: "tenant", key: "shop-a.com" } (custom domain)
 *  example.com / www.example.com → { kind: "platform" }
 *  store-a.localhost:3000   → { kind: "tenant", key: "store-a" }       (dev)
 *  localhost:3000, *.vercel.app → { kind: "tenant", key: DEV_TENANT } or { kind: "platform" }
 *
 * A key containing a dot is always a custom domain; a subdomain label never contains one.
 */

export type HostResolution = { kind: "tenant"; key: string } | { kind: "platform" } | { kind: "invalid" }

export type HostConfig = {
  /** e.g. "example.com" or "localhost:3000" */
  rootDomain: string
  /** Fallback tenant key for hosts with no tenant (localhost, preview deployments). */
  devTenant?: string
}

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
const DOMAIN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/
const RESERVED_SUBDOMAINS = new Set(["www", "app", "api", "admin", "platform", "mail", "static", "assets", "cdn", "auth"])

export function stripPort(host: string): string {
  return host.replace(/:\d+$/, "")
}

export function normalizeHost(rawHost: string | null | undefined): string {
  return stripPort((rawHost ?? "").trim().toLowerCase()).replace(/\.$/, "")
}

export function resolveHost(rawHost: string | null | undefined, config: HostConfig): HostResolution {
  const host = normalizeHost(rawHost)
  const root = normalizeHost(config.rootDomain)
  if (!host || host.length > 253) return { kind: "invalid" }

  const fallback = (): HostResolution =>
    config.devTenant && LABEL.test(config.devTenant) ? { kind: "tenant", key: config.devTenant } : { kind: "platform" }

  // Local development: localhost, 127.0.0.1 and *.localhost
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return fallback()
  if (host.endsWith(".localhost")) {
    const label = host.slice(0, -".localhost".length)
    return LABEL.test(label) && !RESERVED_SUBDOMAINS.has(label) ? { kind: "tenant", key: label } : { kind: "invalid" }
  }

  // Vercel preview / deployment URLs never carry a tenant.
  if (host.endsWith(".vercel.app")) return fallback()

  // Platform apex
  if (host === root || host === `www.${root}`) return { kind: "platform" }

  // Tenant subdomain: exactly one label in front of the root domain.
  if (host.endsWith(`.${root}`)) {
    const label = host.slice(0, -(root.length + 1))
    if (!LABEL.test(label) || RESERVED_SUBDOMAINS.has(label)) return { kind: "invalid" }
    return { kind: "tenant", key: label }
  }

  // Anything else must be a syntactically valid custom domain.
  if (!DOMAIN.test(host)) return { kind: "invalid" }
  return { kind: "tenant", key: host.startsWith("www.") ? host.slice(4) : host }
}

export function isCustomDomainKey(key: string): boolean {
  return key.includes(".")
}

/** Route segment value for app/[domain]. Custom domains are URL-encoded by Next; decode defensively. */
export function decodeTenantKey(segment: string): string {
  return decodeURIComponent(segment).toLowerCase()
}
