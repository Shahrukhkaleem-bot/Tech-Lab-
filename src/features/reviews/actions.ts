"use server"

import { getCurrentUser } from "@/features/auth/session"
import { getRequestTenant } from "@/features/tenants/current"
import { runAction } from "@/lib/actions/run-action"
import { AppError, type ActionResult } from "@/lib/errors/app-error"
import { toAppError } from "@/lib/errors/database"
import { rateLimit } from "@/lib/security/rate-limit"
import { createSupabaseServerClient } from "@/lib/supabase/server"

import { reviewSchema } from "./schemas"


/**
 * Signed-in customers only. The DB trigger forces user_id = auth.uid(),
 * is_approved = false and derives is_verified from a delivered order, so this action
 * cannot be used to publish or self-verify reviews.
 */
export async function submitReviewAction(input: unknown): Promise<ActionResult<{ pending: true }>> {
  return runAction("reviews.submit", async () => {
    const data = reviewSchema.parse(input)
    const user = await getCurrentUser()
    if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in to write a review.")
    if (!(await rateLimit("review", user.id, 5, 3600))) throw new AppError("RATE_LIMITED", "You're posting reviews too quickly.")

    const tenant = await getRequestTenant()
    const supabase = await createSupabaseServerClient()
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
    const displayName = (profile?.full_name || user.email?.split("@")[0] || "Customer").slice(0, 80)

    const { error } = await supabase.from("reviews").insert({
      tenant_id: tenant.id,
      product_id: data.productId,
      user_id: user.id,
      customer_name: displayName,
      rating: data.rating,
      title: data.title || null,
      comment: data.comment,
    })
    if (error) {
      if (error.code === "23505") throw new AppError("CONFLICT", "You have already reviewed this product.")
      throw toAppError(error, { op: "reviews.submit", tenantId: tenant.id })
    }
    return { pending: true as const }
  })
}
