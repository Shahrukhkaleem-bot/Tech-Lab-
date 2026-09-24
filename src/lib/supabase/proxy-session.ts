import { createServerClient } from "@supabase/ssr"
import type { NextRequest, NextResponse } from "next/server"

import type { Database } from "@/types/database"

/**
 * Refreshes the Supabase session inside proxy.ts and copies refreshed cookies onto
 * both the forwarded request (so Server Components see them) and the response.
 * Returns the verified user id, or null.
 */
export async function refreshSession(request: NextRequest, response: NextResponse): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set(name, value)
          response.cookies.set(name, value, options)
        }
        for (const [header, value] of Object.entries(headers)) {
          response.headers.set(header, value)
        }
      },
    },
  })

  // getClaims() verifies the JWT signature (via JWKS) and refreshes an expired session.
  const { data } = await supabase.auth.getClaims()
  return data?.claims?.sub ?? null
}
