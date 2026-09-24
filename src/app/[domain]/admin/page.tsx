import Link from "next/link"

import { AdminPageHeader, StatCard } from "@/components/admin/page-header"
import { SalesChart } from "@/components/admin/sales-chart"
import { StatusBadge } from "@/components/common/status-badge"
import { getDashboard } from "@/features/admin/dashboard/queries"
import { requireAdminPage } from "@/features/auth/session"
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE } from "@/features/orders/status"
import { getTenantFromParams } from "@/features/tenants/current"
import { formatDateTime, formatMoney } from "@/lib/utils/format"

export const metadata = { title: "Dashboard" }

export default async function AdminDashboardPage({ params }: PageProps<"/[domain]/admin">) {
  const tenant = await getTenantFromParams(params)
  const ctx = await requireAdminPage(tenant, "manager", "/admin")
  const { stats, recentOrders, lowStock } = await getDashboard(ctx, 30)
  const money = (n: number) => formatMoney(n, tenant.currency, tenant.locale)

  return (
    <>
      <AdminPageHeader title="Dashboard" description="Last 30 days" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue" value={money(stats.revenue)} hint="Excludes cancelled & returned" />
        <StatCard label="Orders" value={stats.orders.toLocaleString()} hint={`${stats.pending_orders} pending`} />
        <StatCard label="Average order value" value={money(stats.average_order_value)} />
        <StatCard label="Products" value={stats.products.toLocaleString()} hint={`${stats.low_stock} low on stock`} />
      </div>

      <section className="mt-6 rounded-xl border bg-card p-5">
        <h2 className="mb-6 text-sm font-semibold">Daily revenue</h2>
        <SalesChart data={stats.series} currency={tenant.currency} locale={tenant.locale} />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="rounded-xl border bg-card xl:col-span-2">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="text-sm font-semibold">Recent orders</h2>
            <Link href="/admin/orders" className="text-sm font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          {recentOrders.length ? (
            <ul className="divide-y">
              {recentOrders.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/orders/${o.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 text-sm hover:bg-accent/50">
                    <span className="font-semibold">#{o.orderNumber}</span>
                    <span className="min-w-0 flex-1 truncate">{o.customerName}</span>
                    <StatusBadge tone={ORDER_STATUS_TONE[o.orderStatus]}>{ORDER_STATUS_LABELS[o.orderStatus]}</StatusBadge>
                    <span className="text-muted-foreground">{formatDateTime(o.createdAt, tenant.locale, tenant.timezone)}</span>
                    <span className="font-medium tabular-nums">{money(o.total)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-sm text-muted-foreground">No orders yet.</p>
          )}
        </section>

        <section className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="text-sm font-semibold">Low stock</h2>
            <Link href="/admin/products?status=low_stock" className="text-sm font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          {lowStock.length ? (
            <ul className="divide-y text-sm">
              {lowStock.map((p) => (
                <li key={p.id}>
                  <Link href={`/admin/products/${p.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-accent/50">
                    <span className="min-w-0 truncate">{p.name}</span>
                    <StatusBadge tone={p.stock_quantity === 0 ? "danger" : "warning"}>{p.stock_quantity} left</StatusBadge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-sm text-muted-foreground">All products are well stocked.</p>
          )}
        </section>
      </div>
    </>
  )
}
