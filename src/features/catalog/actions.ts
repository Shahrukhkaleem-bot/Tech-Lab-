"use server"

import { z } from "zod"

import { getRequestTenant } from "@/features/tenants/current"
import { runAction } from "@/lib/actions/run-action"
import { AppError, type ActionResult } from "@/lib/errors/app-error"

import { getProductBySlug } from "./queries"
import type { ProductDetail } from "./types"

/** Quick view data (cached query; tenant from Host header). */
export async function getQuickViewAction(slug: unknown): Promise<ActionResult<ProductDetail>> {
  return runAction("catalog.quickView", async () => {
    const parsed = z.string().regex(/^[a-z0-9-]{1,120}$/).parse(slug)
    const tenant = await getRequestTenant()
    const product = await getProductBySlug(tenant.id, parsed)
    if (!product) throw new AppError("NOT_FOUND", "This product is no longer available.")
    return product
  })
}
