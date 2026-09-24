import { Mail, Phone } from "lucide-react"
import { notFound } from "next/navigation"
import { z } from "zod"

import { OrderActions } from "@/components/admin/orders/order-actions"
import { AdminPageHeader } from "@/components/admin/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { OrderDetails } from "@/components/orders/order-details"
import { getAdminOrder } from "@/features/admin/orders/queries"
import { can } from "@/features/auth/roles"
import { requireAdminPage } from "@/features/auth/session"
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE, PAYMENT_STATUS_LABELS } from "@/features/orders/status"
import { getTenantFromParams } from "@/features/tenants/current"
import { formatDateTime, formatMoney } from "@/lib/utils/format"

export const metadata = { title: "Order" }

export default async function AdminOrderPage({ params }: PageProps<"/[domain]/admin/orders/[orderId]">) {
  const tenant = await getTenantFromParams(params)
  const { orderId } = await params
  if (!z.uuid().safeParse(orderId).success) notFound()
  const ctx = await requireAdminPage(tenant, "staff", `/admin/orders/${orderId}`)
  const order = await getAdminOrder(ctx, orderId)
  if (!order) notFound()

  return (
    <>
      <AdminPageHeader
        title={`Order #${order.orderNumber}`}
        description={`Placed ${formatDateTime(order.createdAt, tenant.locale, tenant.timezone)}`}
        actions={<StatusBadge tone={ORDER_STATUS_TONE[order.orderStatus]}>{ORDER_STATUS_LABELS[order.orderStatus]}</StatusBadge>}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="flex flex-wrap gap-4 rounded-xl border bg-card p-4 text-sm">
            <span className="font-semibold">{order.customerName}</span>
            <a href={`tel:${order.customerPhone}`} className="inline-flex items-center gap-1 text-primary hover:underline">
              <Phone className="size-3.5" aria-hidden /> {order.customerPhone}
            </a>
            <a href={`mailto:${order.customerEmail}`} className="inline-flex items-center gap-1 text-primary hover:underline">
              <Mail className="size-3.5" aria-hidden /> {order.customerEmail}
            </a>
            <span className="text-muted-foreground">{order.customerId ? "Registered customer" : "Guest checkout"}</span>
          </section>

          <div className="rounded-xl border bg-card p-5">
            <OrderDetails order={order} locale={tenant.locale} timeZone={tenant.timezone} />
          </div>

          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-3 font-semibold">History</h2>
            <ol className="space-y-3 border-l pl-4 text-sm">
              {order.history.map((h) => (
                <li key={h.id} className="relative">
                  <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full bg-primary" aria-hidden />
                  <p className="font-medium">
                    {ORDER_STATUS_LABELS[h.orderStatus]} · payment {PAYMENT_STATUS_LABELS[h.paymentStatus].toLowerCase()}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(h.createdAt, tenant.locale, tenant.timezone)}</p>
                  {h.note ? <p className="mt-0.5 text-muted-foreground">{h.note}</p> : null}
                </li>
              ))}
            </ol>
          </section>

          {order.transactions.length ? (
            <section className="rounded-xl border bg-card p-5">
              <h2 className="mb-3 font-semibold">Payment transactions</h2>
              <ul className="divide-y text-sm">
                {order.transactions.map((t) => (
                  <li key={t.id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span>
                      {t.provider} {t.reference ? <span className="font-mono text-xs text-muted-foreground">{t.reference}</span> : null}
                    </span>
                    <span>
                      {t.status} · {formatMoney(t.amount, t.currency, tenant.locale)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <OrderActions
          orderId={order.id}
          orderStatus={order.orderStatus}
          paymentStatus={order.paymentStatus}
          courierName={order.courierName}
          trackingNumber={order.trackingNumber}
          trackingUrl={order.trackingUrl}
          internalNotes={order.internalNotes}
          canManage={can(ctx.role, "updatePayment")}
        />
      </div>
    </>
  )
}
