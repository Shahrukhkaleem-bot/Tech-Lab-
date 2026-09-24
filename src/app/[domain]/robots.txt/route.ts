import { tenantOrigin } from "@/features/tenants/current"
import { getTenantByKey } from "@/features/tenants/queries"
import { decodeTenantKey } from "@/lib/tenant/hostname"

/** Per-tenant robots.txt. Non-production deployments are never indexed. */
// Per-host content: rendered at request time, cached at the CDN via Cache-Control.
export const dynamic = "force-dynamic"

export async function GET(_request: Request, ctx: RouteContext<"/[domain]/robots.txt">) {
  const { domain } = await ctx.params
  const tenant = await getTenantByKey(decodeTenantKey(domain))
  if (!tenant) return new Response("Not found", { status: 404 })

  const indexable = process.env.VERCEL_ENV ? process.env.VERCEL_ENV === "production" : process.env.NODE_ENV === "production"
  const body = indexable
    ? [
        "User-agent: *",
        "Allow: /",
        "Disallow: /admin",
        "Disallow: /account",
        "Disallow: /checkout",
        "Disallow: /order-success",
        "Disallow: /api/",
        "Disallow: /*?*q=",
        "",
        `Sitemap: ${tenantOrigin(tenant)}/sitemap.xml`,
        "",
      ].join("\n")
    : "User-agent: *\nDisallow: /\n"

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, s-maxage=3600" },
  })
}
