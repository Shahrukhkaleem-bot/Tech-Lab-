import { NextResponse, type NextRequest } from "next/server"

import { refreshSession } from "@/lib/supabase/proxy-session"
import { resolveHost } from "@/lib/tenant/hostname"

/**
 * Tenant routing (Next.js 16 `proxy.ts`, formerly `middleware.ts`).
 *
 * 1. Classify the Host header (subdomain / custom domain / platform / dev).
 * 2. Rewrite to the internal route tree:
 *      tenant   → /{tenantKey}{path}   (app/[domain]/...)
 *      platform → /platform{path}      (app/platform/...)
 *    Rewrites always PREFIX the path, so no URL can address another tenant's tree.
 * 3. Refresh the Supabase session only on routes that need auth (keeps catalogue
 *    responses cookie-free and CDN-cacheable).
 * 4. Early-redirect anonymous visitors away from /admin (UX only — real authorisation
 *    happens in layouts, Server Actions and RLS).
 *
 * The tenant row itself is resolved (and 404'd if unknown/inactive) by the cached
 * lookup in app/[domain]/layout.tsx — a DB round-trip here would run on every request,
 * including prefetches, and cannot use the Next data cache.
 */

const AUTH_PATHS = ["/admin", "/account", "/checkout", "/login", "/register", "/auth", "/forgot-password", "/reset-password"]

function needsSession(pathname: string) {
  return AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  const resolution = resolveHost(request.headers.get("host"), {
    rootDomain: process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000",
    devTenant: process.env.DEV_TENANT,
  })

  if (resolution.kind === "invalid") {
    return new NextResponse("Not found", { status: 404 })
  }

  const target = request.nextUrl.clone()
  target.pathname =
    resolution.kind === "platform"
      ? `/platform${pathname === "/" ? "" : pathname}`
      : `/${encodeURIComponent(resolution.key)}${pathname === "/" ? "" : pathname}`
  target.search = search

  const response = NextResponse.rewrite(target, { request: { headers: request.headers } })

  if (resolution.kind === "tenant" && needsSession(pathname)) {
    const userId = await refreshSession(request, response)

    if (!userId && (pathname === "/admin" || pathname.startsWith("/admin/"))) {
      const login = request.nextUrl.clone()
      login.pathname = "/login"
      login.search = `?next=${encodeURIComponent(pathname + search)}`
      const redirect = NextResponse.redirect(login)
      // Keep any cookies the refresh attempt cleared.
      for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie)
      return redirect
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Everything except: Next internals, global webhooks/health endpoints and static
     * files in /public. robots.txt and sitemap.xml ARE matched (they are per tenant).
     */
    "/((?!_next/static|_next/image|api/webhooks|api/health|favicon.ico|demo/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?)$).*)",
  ],
}
