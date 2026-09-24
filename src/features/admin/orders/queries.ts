import "server-only"

import type { AdminContext } from "@/features/auth/session"
import { mapOrder, mapOrderSummary } from "@/features/orders/mappers"
import type { OrderView } from "@/features/orders/types"
import { toAppError } from "@/lib/errors/database"
import type { OrderStatus, PaymentStatus } from "@/types/database"

import type { AdminOrderFilters } from "./schemas"

export const ORDERS_PAGE_SIZE = 25

export async function listAdminOrders(ctx: AdminContext, filters: AdminOrderFilters) {
  let query = ctx.supabase.from("orders").select("*, items:order_items(quantity)", { count: "exact" }).eq("tenant_id", ctx.tenant.id)

  if (filters.status !== "all") query = query.eq("order_status", filters.status)
  if (filters.payment !== "all") query = query.eq("payment_status", filters.payment)
  if (filters.q) {
    const term = filters.q.replace(/[%_,()\\]/g, " ").trim().replace(/^#/, "")
    if (/^\d+$/.test(term)) query = query.eq("order_number", Number(term))
    else if (term) query = query.or(`customer_name.ilike.%${term}%,customer_email.ilike.%${term}%,customer_phone.ilike.%${term}%`)
  }

  const from = (filters.page - 1) * ORDERS_PAGE_SIZE
  const { data, count, error } = await query.order("created_at", { ascending: false }).range(from, from + ORDERS_PAGE_SIZE - 1)
  if (error) throw toAppError(error, { op: "listAdminOrders", tenantId: ctx.tenant.id })
  return {
    rows: (data ?? []).map(mapOrderSummary),
    total: count ?? 0,
    pageCount: Math.max(1, Math.ceil((count ?? 0) / ORDERS_PAGE_SIZE)),
  }
}

export type AdminOrderDetail = OrderView & {
  internalNotes: string | null
  customerId: string | null
  history: { id: number; orderStatus: OrderStatus; paymentStatus: PaymentStatus; note: string | null; createdAt: string }[]
  transactions: { id: string; provider: string; reference: string | null; status: string; amount: number; currency: string; createdAt: string }[]
}

export async function getAdminOrder(ctx: AdminContext, orderId: string): Promise<AdminOrderDetail | null> {
  const { data, error } = await ctx.supabase
    .from("orders")
    .select("*, items:order_items(*), history:order_status_history(id, order_status, payment_status, note, created_at)")
    .eq("tenant_id", ctx.tenant.id)
    .eq("id", orderId)
    .maybeSingle()
  if (error) throw toAppError(error, { op: "getAdminOrder", tenantId: ctx.tenant.id })
  if (!data) return null

  // Payment transactions are manager+ (RLS returns [] for staff).
  const { data: txs } = await ctx.supabase
    .from("payment_transactions")
    .select("id, provider, provider_reference, status, amount, currency, created_at")
    .eq("tenant_id", ctx.tenant.id)
    .eq("order_id", orderId)
    .order("created_at")

  return {
    ...mapOrder(data, data.items ?? []),
    internalNotes: data.internal_notes,
    customerId: data.customer_id,
    history: (data.history ?? [])
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((h) => ({ id: h.id, orderStatus: h.order_status, paymentStatus: h.payment_status, note: h.note, createdAt: h.created_at })),
    transactions: (txs ?? []).map((t) => ({
      id: t.id,
      provider: t.provider,
      reference: t.provider_reference,
      status: t.status,
      amount: Number(t.amount),
      currency: t.currency,
      createdAt: t.created_at,
    })),
  }
}
