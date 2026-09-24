import "server-only"

import { z } from "zod"

import { getCurrentUser } from "@/features/auth/session"
import { toAppError } from "@/lib/errors/database"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseServiceClient } from "@/lib/supabase/service"

import { mapOrder, mapOrderSummary } from "./mappers"
import type { OrderSummaryView, OrderView } from "./types"

/**
 * Guest order confirmation. Guests have no session, so access is granted by
 * possession of BOTH the order id and its random public_token (122 bits), and only
 * within the current tenant. The service client is required because anon has no
 * RLS access to orders; the triple match below is the authorisation.
 */
export async function getOrderByPublicToken(tenantId: string, orderId: string, token: string): Promise<OrderView | null> {
  if (!z.uuid().safeParse(orderId).success || !z.uuid().safeParse(token).success) return null

  const supabase = createSupabaseServiceClient()
  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("tenant_id", tenantId)
    .eq("public_token", token)
    .maybeSingle()
  if (error) throw toAppError(error, { op: "getOrderByPublicToken", tenantId })
  if (!order) return null

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", order.id)
    .eq("tenant_id", tenantId)
    .order("created_at")
  if (itemsError) throw toAppError(itemsError, { op: "getOrderByPublicToken.items", tenantId })
  return mapOrder(order, items ?? [])
}

/** Signed-in customer's own orders in this store (RLS: customer_id = auth.uid()). */
export async function listMyOrders(tenantId: string): Promise<OrderSummaryView[]> {
  const user = await getCurrentUser()
  if (!user) return []
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("orders")
    .select("*, items:order_items(quantity)")
    .eq("tenant_id", tenantId)
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)
  if (error) throw toAppError(error, { op: "listMyOrders", tenantId })
  return (data ?? []).map(mapOrderSummary)
}

/** Signed-in customer's order detail (RLS enforces ownership). */
export async function getMyOrder(tenantId: string, orderId: string): Promise<OrderView | null> {
  if (!z.uuid().safeParse(orderId).success) return null
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("orders")
    .select("*, items:order_items(*)")
    .eq("tenant_id", tenantId)
    .eq("id", orderId)
    .maybeSingle()
  if (error) throw toAppError(error, { op: "getMyOrder", tenantId })
  return data ? mapOrder(data, data.items ?? []) : null
}
