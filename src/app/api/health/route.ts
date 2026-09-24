import { NextResponse } from "next/server"

import { createSupabasePublicClient } from "@/lib/supabase/public"

export const dynamic = "force-dynamic"

/** Liveness + database reachability for uptime monitors. Reveals no internals. */
export async function GET() {
  const started = Date.now()
  try {
    const { error } = await createSupabasePublicClient().from("tenants").select("id", { head: true, count: "exact" }).limit(1)
    if (error) throw error
    return NextResponse.json({ status: "ok", db: "ok", latencyMs: Date.now() - started }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ status: "degraded", db: "unreachable" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
}
