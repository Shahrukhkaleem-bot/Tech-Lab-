import "server-only"

import { z } from "zod"

import type { AdminContext } from "@/features/auth/session"
import { mapOrderSummary } from "@/features/orders/mappers"
import { toAppError } from "@/lib/errors/database"

const statsSchema = z.object({
  revenue: z.coerce.number(),
  orders: z.coerce.number(),
  average_order_value: z.coerce.number(),
  pending_orders: z.coerce.number(),
  products: z.coerce.number(),
  low_stock: z.coerce.number(),
  series: z.array(z.object({ date: z.string(), revenue: z.coerce.number(), orders: z.coerce.number() })),
})

export type DashboardStats = z.infer<typeof statsSchema>

export async function getDashboard(ctx: AdminContext, days = 30) {
  const [statsRes, recentRes, lowStockRes] = await Promise.all([
    ctx.supabase.rpc("get_dashboard_stats", { p_tenant_id: ctx.tenant.id, p_days: days }),
    ctx.supabase.from("orders").select("*, items:order_items(quantity)").eq("tenant_id", ctx.tenant.id).order("created_at", { ascending: false }).limit(8),
    ctx.supabase
      .from("products")
      .select("id, name, sku, stock_quantity, low_stock_threshold")
      .eq("tenant_id", ctx.tenant.id)
      .eq("is_active", true)
      .eq("track_inventory", true)
      .lte("stock_quantity", 5)
      .order("stock_quantity")
      .limit(8),
  ])
  if (statsRes.error) throw toAppError(statsRes.error, { op: "dashboard.stats", tenantId: ctx.tenant.id })
  return {
    stats: statsSchema.parse(statsRes.data),
    recentOrders: (recentRes.data ?? []).map(mapOrderSummary),
    lowStock: lowStockRes.data ?? [],
  }
}
