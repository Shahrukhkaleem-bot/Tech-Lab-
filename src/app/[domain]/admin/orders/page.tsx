import Link from "next/link"

import { AdminPagination } from "@/components/admin/admin-pagination"
import { ListFilters } from "@/components/admin/list-filters"
import { AdminPageHeader } from "@/components/admin/page-header"
import { EmptyState } from "@/components/common/empty-state"
import { StatusBadge } from "@/components/common/status-badge"
import { listAdminOrders } from "@/features/admin/orders/queries"
import { adminOrderFiltersSchema } from "@/features/admin/orders/schemas"
import { requireAdminPage } from "@/features/auth/session"
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONE,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_TONE,
} from "@/features/orders/status"
import { getTenantFromParams } from "@/features/tenants/current"
import { formatDateTime, formatMoney } from "@/lib/utils/format"

export const metadata = { title: "Orders" }

export default async function AdminOrdersPage({ params, searchParams }: PageProps<"/[domain]/admin/orders">) {
  const tenant = await getTenantFromParams(params)
  const ctx = await requireAdminPage(tenant, "staff", "/admin/orders")
  const parsed = adminOrderFiltersSchema.safeParse(await searchParams)
  const filters = parsed.success ? parsed.data : adminOrderFiltersSchema.parse({})
  const { rows, total, pageCount } = await listAdminOrders(ctx, filters)

  const hrefFor = (page: number) => {
    const sp = new URLSearchParams()
    if (filters.q) sp.set("q", filters.q)
    if (filters.status !== "all") sp.set("status", filters.status)
    sp.set("page", String(page))
    return `/admin/orders?${sp}`
  }

  return (
    <>
      <AdminPageHeader title="Orders" description={`${total.toLocaleString()} orders`} />
      <div className="overflow-hidden rounded-xl border bg-card">
        <ListFilters
          action="/admin/orders"
          q={filters.q}
          placeholder="Order #, name, email or phone"
          activeTab={filters.status}
          tabs={[
            { value: "all", label: "All" },
            { value: "pending", label: "Pending" },
            { value: "confirmed", label: "Confirmed" },
            { value: "processing", label: "Processing" },
            { value: "shipped", label: "Shipped" },
            { value: "delivered", label: "Delivered" },
            { value: "cancelled", label: "Cancelled" },
          ]}
        />
        {rows.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground uppercase">
                  <tr>
                    <th className="p-3">Order</th>
                    <th className="p-3">Customer</th>
                    <th className="hidden p-3 md:table-cell">Date</th>
                    <th className="p-3">Status</th>
                    <th className="hidden p-3 lg:table-cell">Payment</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((o) => (
                    <tr key={o.id} className="hover:bg-accent/30">
                      <td className="p-3">
                        <Link href={`/admin/orders/${o.id}`} className="font-semibold text-primary hover:underline">
                          #{o.orderNumber}
                        </Link>
                        <span className="block text-xs text-muted-foreground">{o.itemCount} items</span>
                      </td>
                      <td className="p-3">
                        <span className="block font-medium">{o.customerName}</span>
                        <span className="block text-xs text-muted-foreground">
                          {o.customerPhone} · {o.city}
                        </span>
                      </td>
                      <td className="hidden p-3 text-muted-foreground md:table-cell">{formatDateTime(o.createdAt, tenant.locale, tenant.timezone)}</td>
                      <td className="p-3">
                        <StatusBadge tone={ORDER_STATUS_TONE[o.orderStatus]}>{ORDER_STATUS_LABELS[o.orderStatus]}</StatusBadge>
                      </td>
                      <td className="hidden p-3 lg:table-cell">
                        <StatusBadge tone={PAYMENT_STATUS_TONE[o.paymentStatus]}>{PAYMENT_STATUS_LABELS[o.paymentStatus]}</StatusBadge>
                        <span className="block text-xs text-muted-foreground">{PAYMENT_METHOD_LABELS[o.paymentMethod]}</span>
                      </td>
                      <td className="p-3 text-right font-medium tabular-nums">{formatMoney(o.total, o.currency, tenant.locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <AdminPagination page={filters.page} pageCount={pageCount} total={total} hrefFor={hrefFor} />
          </>
        ) : (
          <EmptyState className="m-6" title="No orders found" description="Orders placed in your store will appear here." />
        )}
      </div>
    </>
  )
}
