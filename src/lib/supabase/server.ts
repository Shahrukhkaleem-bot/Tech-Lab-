import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { publicEnv } from "@/config/env"
import type { Database } from "@/types/database"

/**
 * Request-scoped client acting AS THE SIGNED-IN USER (anon key + session cookie).
 * RLS applies. Use for admin pages, account pages and Server Actions.
 * Never use inside a cached function: it reads cookies.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  const env = publicEnv()

  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // proxy.ts refreshes sessions, so this is safe to ignore.
        }
      },
    },
  })
}

export type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>
