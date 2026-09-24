"use client"

import { createBrowserClient } from "@supabase/ssr"

import type { Database } from "@/types/database"

let client: ReturnType<typeof createBrowserClient<Database>> | undefined

/**
 * Browser client (anon key + user session). RLS applies; the service role is never
 * available here. Used for auth forms and direct-to-storage uploads.
 */
export function getSupabaseBrowserClient() {
  client ??= createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  return client
}
