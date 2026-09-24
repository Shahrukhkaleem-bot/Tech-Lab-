import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { getTenantByKey } from "@/features/tenants/queries"
import { logger } from "@/lib/logger"
import { getSearchProvider } from "@/lib/search"
import { decodeTenantKey } from "@/lib/tenant/hostname"

/**
 * GET /api/search/suggest?q=… (rewritten by proxy.ts to /{tenant}/api/search/suggest)
 * Public, read-only, CDN-cacheable per tenant host + query.
 */
const querySchema = z.string().trim().min(2).max(80)

export async function GET(request: NextRequest, ctx: RouteContext<"/[domain]/api/search/suggest">) {
  const { domain } = await ctx.params
  const parsed = querySchema.safeParse(request.nextUrl.searchParams.get("q") ?? "")
  if (!parsed.success) return NextResponse.json({ items: [] })

  const tenant = await getTenantByKey(decodeTenantKey(domain))
  if (!tenant) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Store not found" } }, { status: 404 })

  try {
    const items = await getSearchProvider().suggest(tenant.id, parsed.data, 6)
    return NextResponse.json(
      {
        items: items.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: p.price,
          originalPrice: p.originalPrice,
          imageUrl: p.image?.url ?? null,
          brand: p.brand?.name ?? null,
        })),
      },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    )
  } catch (error) {
    logger.error("search.suggest_failed", { tenantId: tenant.id, error })
    return NextResponse.json({ error: { code: "INTERNAL", message: "Search is temporarily unavailable." } }, { status: 500 })
  }
}
