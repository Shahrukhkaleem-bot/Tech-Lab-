import { getBrands, getCategoryTree, getSitemapProducts } from "@/features/catalog/queries"
import type { Category } from "@/features/catalog/types"
import { tenantOrigin } from "@/features/tenants/current"
import { getTenantByKey, listStorePages } from "@/features/tenants/queries"
import { decodeTenantKey } from "@/lib/tenant/hostname"

/**
 * Per-tenant /sitemap.xml (proxy rewrites /sitemap.xml → /{tenant}/sitemap.xml).
 * Implemented as a Route Handler for full control over params and caching.
 * Up to 50k URLs; split with a sitemap index if a store ever exceeds that.
 */
const xmlEscape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

function categoryPaths(nodes: Category[], prefix = ""): string[] {
  return nodes.flatMap((c) => [`${prefix}/${c.slug}`, ...categoryPaths(c.children, `${prefix}/${c.slug}`)])
}

// Per-host content: rendered at request time, cached at the CDN via Cache-Control.
export const dynamic = "force-dynamic"

export async function GET(_request: Request, ctx: RouteContext<"/[domain]/sitemap.xml">) {
  const { domain } = await ctx.params
  const tenant = await getTenantByKey(decodeTenantKey(domain))
  if (!tenant) return new Response("Not found", { status: 404 })

  const origin = tenantOrigin(tenant)
  const [products, tree, brands, pages] = await Promise.all([
    getSitemapProducts(tenant.id),
    getCategoryTree(tenant.id),
    getBrands(tenant.id),
    listStorePages(tenant.id),
  ])

  const urls: { loc: string; lastmod?: string; priority: string }[] = [
    { loc: `${origin}/`, priority: "1.0" },
    { loc: `${origin}/products`, priority: "0.8" },
    { loc: `${origin}/brands`, priority: "0.5" },
    ...categoryPaths(tree.roots).map((p) => ({ loc: `${origin}/categories${p}`, priority: "0.7" })),
    ...brands.map((b) => ({ loc: `${origin}/brands/${b.slug}`, priority: "0.5" })),
    ...products.map((p) => ({ loc: `${origin}/products/${p.slug}`, lastmod: p.updated_at, priority: "0.9" })),
    ...pages.map((p) => ({ loc: `${origin}/pages/${p.slug}`, lastmod: p.updated_at, priority: "0.3" })),
  ]

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url><loc>${xmlEscape(u.loc)}</loc>${u.lastmod ? `<lastmod>${new Date(u.lastmod).toISOString()}</lastmod>` : ""}<priority>${u.priority}</priority></url>`,
      )
      .join("\n") +
    `\n</urlset>\n`

  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  })
}
