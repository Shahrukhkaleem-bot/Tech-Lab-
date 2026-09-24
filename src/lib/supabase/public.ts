import "server-only"

import { createClient } from "@supabase/supabase-js"

import { publicEnv } from "@/config/env"
import type { Database } from "@/types/database"

/**
 * Cookie-less ANONYMOUS client for public catalogue reads.
 * Safe to use inside cached functions: its output never depends on who is asking,
 * and RLS still restricts it to active data of active tenants.
 */
export function createSupabasePublicClient() {
  const env = publicEnv()
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
