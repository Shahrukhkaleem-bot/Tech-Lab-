import { NextResponse, type NextRequest } from "next/server"

import { logger } from "@/lib/logger"
import { safeNextPath } from "@/lib/security/safe-redirect"
import { createSupabaseServerClient } from "@/lib/supabase/server"

/**
 * GET /auth/callback — email confirmation, password recovery and OAuth (PKCE) return
 * URL. Exchanges the one-time code for a session cookie on THIS host, then redirects
 * to a same-origin path only.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const code = url.searchParams.get("code")
  const next = safeNextPath(url.searchParams.get("next"), "/account")
  // Build redirects from the public host, not the internal rewritten URL.
  const host = request.headers.get("host") ?? url.host
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "")
  const origin = `${proto}://${host}`

  if (code) {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
    logger.warn("auth.callback.exchange_failed", { message: error.message })
  }
  return NextResponse.redirect(`${origin}/login?error=link`)
}
