import type { OrderItemRow, OrderRow } from "@/types/database"

import type { OrderItemView, OrderSummaryView, OrderView } from "./types"

export function mapOrderItem(r: OrderItemRow): OrderItemView {
  return {
    id: r.id,
    productId: r.product_id,
    name: r.product_name_snapshot,
    sku: r.product_sku_snapshot,
    slug: r.product_slug_snapshot,
    imageUrl: r.product_image_snapshot,
    unitPrice: Number(r.unit_price),
    quantity: r.quantity,
    subtotal: Number(r.subtotal),
  }
}

export function mapOrder(o: OrderRow, items: OrderItemRow[]): OrderView {
  return {
    id: o.id,
    orderNumber: o.order_number,
    createdAt: o.created_at,
    customerName: o.customer_name,
    customerEmail: o.customer_email,
    customerPhone: o.customer_phone,
    shippingAddress: o.shipping_address,
    city: o.city,
    postalCode: o.postal_code,
    notes: o.order_notes,
    subtotal: Number(o.subtotal),
    shippingFee: Number(o.shipping_fee),
    discountAmount: Number(o.discount_amount),
    total: Number(o.total_amount),
    currency: o.currency,
    couponCode: o.coupon_code,
    paymentMethod: o.payment_method,
    paymentStatus: o.payment_status,
    orderStatus: o.order_status,
    courierName: o.courier_name,
    trackingNumber: o.tracking_number,
    trackingUrl: o.tracking_url,
    shippedAt: o.shipped_at,
    deliveredAt: o.delivered_at,
    items: items.map(mapOrderItem),
  }
}

export function mapOrderSummary(o: OrderRow & { items?: { quantity: number }[] }): OrderSummaryView {
  return {
    id: o.id,
    orderNumber: o.order_number,
    createdAt: o.created_at,
    customerName: o.customer_name,
    customerEmail: o.customer_email,
    customerPhone: o.customer_phone,
    city: o.city,
    total: Number(o.total_amount),
    currency: o.currency,
    paymentMethod: o.payment_method,
    paymentStatus: o.payment_status,
    orderStatus: o.order_status,
    itemCount: (o.items ?? []).reduce((n, i) => n + i.quantity, 0),
  }
}
