"use server"

import { adminAction } from "@/features/admin/context"
import { can } from "@/features/auth/roles"
import { AppError, type ActionResult } from "@/lib/errors/app-error"
import { toAppError } from "@/lib/errors/database"
import { getShippingProvider } from "@/lib/shipping/registry"

import { internalNoteSchema, orderStatusUpdateSchema, paymentStatusUpdateSchema, trackingUpdateSchema } from "./schemas"

/**
 * Order lifecycle changes. The DB enforces the state machine, immutability of money
 * columns and "payment status is manager+" (orders_guard trigger); these actions add
 * friendly errors and route cancellations/returns through the restocking functions.
 */
export async function updateOrderStatusAction(input: unknown): Promise<ActionResult<null>> {
  return adminAction("orders.status", "updateFulfilment", async (ctx) => {
    const v = orderStatusUpdateSchema.parse(input)

    if (v.status === "cancelled" || v.status === "returned") {
      if (!can(ctx.role, "cancelOrders")) throw new AppError("FORBIDDEN", "Only managers can cancel or return orders.")
      const { error } =
        v.status === "cancelled"
          ? await ctx.supabase.rpc("cancel_order", { p_order_id: v.orderId, p_note: v.note ?? null })
          : await ctx.supabase.rpc("return_order", { p_order_id: v.orderId, p_restock: v.restock, p_note: v.note ?? null })
      if (error) throw toAppError(error, { op: "admin.closeOrder", tenantId: ctx.tenant.id })
      return null
    }

    const { data, error } = await ctx.supabase
      .from("orders")
      .update({ order_status: v.status })
      .eq("tenant_id", ctx.tenant.id)
      .eq("id", v.orderId)
      .select("id")
      .maybeSingle()
    if (error) throw toAppError(error, { op: "admin.orderStatus", tenantId: ctx.tenant.id })
    if (!data) throw new AppError("NOT_FOUND", "Order not found.")
    return null
  })
}

export async function updatePaymentStatusAction(input: unknown): Promise<ActionResult<null>> {
  return adminAction("orders.payment", "updatePayment", async (ctx) => {
    const v = paymentStatusUpdateSchema.parse(input)
    const { data, error } = await ctx.supabase
      .from("orders")
      .update({ payment_status: v.status })
      .eq("tenant_id", ctx.tenant.id)
      .eq("id", v.orderId)
      .select("id")
      .maybeSingle()
    if (error) throw toAppError(error, { op: "admin.paymentStatus", tenantId: ctx.tenant.id })
    if (!data) throw new AppError("NOT_FOUND", "Order not found.")
    return null
  })
}

export async function updateTrackingAction(input: unknown): Promise<ActionResult<null>> {
  return adminAction("orders.tracking", "updateFulfilment", async (ctx) => {
    const v = trackingUpdateSchema.parse(input)

    const { data: order } = await ctx.supabase
      .from("orders")
      .select("id, order_number, order_status, customer_name, customer_phone, shipping_address, city, postal_code, total_amount, payment_method, payment_status, shipping_provider")
      .eq("tenant_id", ctx.tenant.id)
      .eq("id", v.orderId)
      .maybeSingle()
    if (!order) throw new AppError("NOT_FOUND", "Order not found.")

    // Goes through the shipping abstraction so courier APIs can book the parcel later.
    const shipment = await getShippingProvider(order.shipping_provider).createShipment({
      tenantId: ctx.tenant.id,
      orderId: order.id,
      orderNumber: order.order_number,
      recipient: { name: order.customer_name, phone: order.customer_phone, address: order.shipping_address, city: order.city, postalCode: order.postal_code },
      codAmount: order.payment_method === "cod" && order.payment_status !== "paid" ? Number(order.total_amount) : null,
      manual: { courierName: v.courierName, trackingNumber: v.trackingNumber, trackingUrl: v.trackingUrl || null },
    })

    const canShip = ["confirmed", "processing"].includes(order.order_status)
    const { error } = await ctx.supabase
      .from("orders")
      .update({
        courier_name: shipment.courierName,
        tracking_number: shipment.trackingNumber,
        tracking_url: shipment.trackingUrl,
        ...(v.markShipped && canShip ? { order_status: "shipped" as const } : {}),
      })
      .eq("tenant_id", ctx.tenant.id)
      .eq("id", v.orderId)
    if (error) throw toAppError(error, { op: "admin.tracking", tenantId: ctx.tenant.id })
    return null
  })
}

export async function updateInternalNoteAction(input: unknown): Promise<ActionResult<null>> {
  return adminAction("orders.note", "updateFulfilment", async (ctx) => {
    const v = internalNoteSchema.parse(input)
    const { error } = await ctx.supabase
      .from("orders")
      .update({ internal_notes: v.note || null })
      .eq("tenant_id", ctx.tenant.id)
      .eq("id", v.orderId)
    if (error) throw toAppError(error, { op: "admin.note", tenantId: ctx.tenant.id })
    return null
  })
}
