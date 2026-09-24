"use server"

import { z } from "zod"

import { getCurrentUser } from "@/features/auth/session"
import { getRequestTenant } from "@/features/tenants/current"
import { runAction } from "@/lib/actions/run-action"
import type { ActionResult } from "@/lib/errors/app-error"
import { toAppError } from "@/lib/errors/database"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const toggleSchema = z.object({ productId: z.uuid(), saved: z.boolean() })

/** Mirrors a local wishlist toggle to the server for signed-in users (RLS: own rows only). */
export async function toggleWishlistAction(input: unknown): Promise<ActionResult<{ synced: boolean }>> {
  return runAction("wishlist.toggle", async () => {
    const { productId, saved } = toggleSchema.parse(input)
    const user = await getCurrentUser()
    if (!user) return { synced: false }
    const tenant = await getRequestTenant()
    const supabase = await createSupabaseServerClient()
    const { error } = saved
      ? await supabase
          .from("wishlist_items")
          .upsert({ user_id: user.id, tenant_id: tenant.id, product_id: productId }, { onConflict: "user_id,product_id", ignoreDuplicates: true })
      : await supabase.from("wishlist_items").delete().eq("user_id", user.id).eq("product_id", productId)
    if (error) throw toAppError(error, { op: "wishlist.toggle", tenantId: tenant.id })
    return { synced: true }
  })
}

/** Server-side wishlist product ids for the signed-in user in this store. */
export async function getServerWishlistAction(): Promise<ActionResult<string[]>> {
  return runAction("wishlist.list", async () => {
    const user = await getCurrentUser()
    if (!user) return []
    const tenant = await getRequestTenant()
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase
      .from("wishlist_items")
      .select("product_id")
      .eq("user_id", user.id)
      .eq("tenant_id", tenant.id)
      .limit(200)
    if (error) throw toAppError(error, { op: "wishlist.list", tenantId: tenant.id })
    return (data ?? []).map((r) => r.product_id)
  })
}
