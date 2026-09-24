import { ExternalLink, Package } from "lucide-react"
import Link from "next/link"

import { SmartImage } from "@/components/common/smart-image"
import { StatusBadge } from "@/components/common/status-badge"
import type { OrderView } from "@/features/orders/types"
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONE,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_TONE,
} from "@/features/orders/status"
import { formatDateTime, formatMoney } from "@/lib/utils/format"

import { OrderProgress } from "./order-progress"

/** Order detail block shared by the confirmation page and the customer account. */
export function OrderDetails({ order, locale, timeZone }: { order: OrderView; locale: string; timeZone: string }) {
  const money = (n: number) => formatMoney(n, order.currency, locale)
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Placed {formatDateTime(order.createdAt, locale, timeZone)}</span>
        <StatusBadge tone={ORDER_STATUS_TONE[order.orderStatus]}>{ORDER_STATUS_LABELS[order.orderStatus]}</StatusBadge>
        <StatusBadge tone={PAYMENT_STATUS_TONE[order.paymentStatus]}>Payment: {PAYMENT_STATUS_LABELS[order.paymentStatus]}</StatusBadge>
      </div>

      <OrderProgress status={order.orderStatus} />

      {order.trackingNumber ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-accent/50 p-4 text-sm">
          <Package className="size-5 text-primary" aria-hidden />
          <span>
            Shipped with <strong>{order.courierName ?? "courier"}</strong> · Tracking <span className="font-mono">{order.trackingNumber}</span>
          </span>
          {order.trackingUrl ? (
            <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              Track parcel <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border p-4">
          <h2 className="mb-2 text-sm font-semibold">Delivery address</h2>
          <address className="text-sm leading-relaxed text-muted-foreground not-italic">
            {order.customerName}
            <br />
            {order.shippingAddress}
            <br />
            {order.city}
            {order.postalCode ? ` ${order.postalCode}` : ""}
            <br />
            {order.customerPhone}
          </address>
        </section>
        <section className="rounded-xl border p-4">
          <h2 className="mb-2 text-sm font-semibold">Payment</h2>
          <p className="text-sm text-muted-foreground">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</p>
          {order.notes ? (
            <>
              <h2 className="mt-3 mb-1 text-sm font-semibold">Notes</h2>
              <p className="text-sm text-muted-foreground">{order.notes}</p>
            </>
          ) : null}
        </section>
      </div>

      <section className="rounded-xl border">
        <h2 className="border-b p-4 text-sm font-semibold">Items</h2>
        <ul className="divide-y">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 p-4">
              <span className="relative size-14 shrink-0 overflow-hidden rounded-md border bg-muted">
                <SmartImage src={item.imageUrl} alt="" fill sizes="56px" className="object-contain p-1" />
              </span>
              <div className="min-w-0 flex-1">
                {item.slug ? (
                  <Link href={`/products/${item.slug}`} className="line-clamp-2 text-sm font-medium hover:text-primary">
                    {item.name}
                  </Link>
                ) : (
                  <p className="line-clamp-2 text-sm font-medium">{item.name}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {item.quantity} × {money(item.unitPrice)}
                  {item.sku ? ` · SKU ${item.sku}` : ""}
                </p>
              </div>
              <span className="text-sm font-medium">{money(item.subtotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-1.5 border-t p-4 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{money(order.subtotal)}</dd>
          </div>
          {order.discountAmount > 0 ? (
            <div className="flex justify-between text-success">
              <dt>Discount {order.couponCode ? `(${order.couponCode})` : ""}</dt>
              <dd>−{money(order.discountAmount)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt>Shipping</dt>
            <dd>{order.shippingFee === 0 ? "Free" : money(order.shippingFee)}</dd>
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-bold">
            <dt>Total</dt>
            <dd>{money(order.total)}</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
