"use server"

import { z } from "zod"

import { adminAction } from "@/features/admin/context"
import { cacheTags, invalidate } from "@/lib/cache/tags"
import type { ActionResult } from "@/lib/errors/app-error"
import { toAppError } from "@/lib/errors/database"

const moderateSchema = z.object({ ids: z.array(z.uuid()).min(1).max(100), action: z.enum(["approve", "unapprove", "delete"]) })

/** Approve / hide / delete reviews (manager+). Rating aggregates update via DB trigger. */
export async function moderateReviewsAction(input: unknown): Promise<ActionResult<{ affected: number }>> {
  return adminAction("reviews.moderate", "moderateReviews", async (ctx) => {
    const { ids, action } = moderateSchema.parse(input)
    const table = ctx.supabase.from("reviews")
    const { data, error } =
      action === "delete"
        ? await table.delete().eq("tenant_id", ctx.tenant.id).in("id", ids).select("id")
        : await table.update({ is_approved: action === "approve" }).eq("tenant_id", ctx.tenant.id).in("id", ids).select("id")
    if (error) throw toAppError(error, { op: "admin.moderateReviews", tenantId: ctx.tenant.id })
    invalidate(cacheTags.reviews(ctx.tenant.id), cacheTags.products(ctx.tenant.id))
    return { affected: data?.length ?? 0 }
  })
}
