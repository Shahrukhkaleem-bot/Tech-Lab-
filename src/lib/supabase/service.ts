import "server-only"

import { createClient } from "@supabase/supabase-js"

import { publicEnv } from "@/config/env"
import { serverEnv } from "@/config/server-env"
import type { Database } from "@/types/database"

/**
 * SERVICE-ROLE client — bypasses RLS. Server-only by construction (`server-only` import).
 *
 * Allowed call sites (keep this list short and reviewed):
 *   - features/checkout/service.ts   quote_order / place_order / consume_rate_limit
 *   - features/orders/queries.ts     getOrderByPublicToken (guest confirmation page)
 *   - lib/payments/*                 record_payment from verified webhooks
 * Every call site must pass a server-derived tenant id, never one from the client.
 */
export function createSupabaseServiceClient() {
  const env = publicEnv()
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
