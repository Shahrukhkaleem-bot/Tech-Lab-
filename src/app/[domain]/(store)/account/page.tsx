import { LogOut, Package } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { EmptyState } from "@/components/common/empty-state"
import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { signOutAction } from "@/features/auth/actions"
import { getCurrentUser, getMemberRole } from "@/features/auth/session"
import { listMyOrders } from "@/features/orders/queries"
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE } from "@/features/orders/status"
import { getTenantFromParams } from "@/features/tenants/current"
import { formatDate, formatMoney } from "@/lib/utils/format"

// Per-user content (session cookie / order token): never statically cached.
export const dynamic = "force-dynamic"


export const metadata: Metadata = { title: "My account", robots: { index: false } }

export default async function AccountPage({ params }: PageProps<"/[domain]/account">) {
  const tenant = await getTenantFromParams(params)
  const user = await getCurrentUser()
  if (!user) redirect("/login?next=/account")

  const [orders, role] = await Promise.all([listMyOrders(tenant.id), getMemberRole(tenant.id)])

  return (
    <div className="container-page max-w-4xl py-8 sm:py-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My account</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex gap-2">
          {role ? (
            <Button asChild variant="outline">
              <Link href="/admin">Store admin</Link>
            </Button>
          ) : null}
          <form action={signOutAction}>
            <Button type="submit" variant="ghost">
              <LogOut aria-hidden /> Sign out
            </Button>
          </form>
        </div>
      </div>

      <h2 className="mb-4 text-lg font-semibold">Order history</h2>
      {orders.length ? (
        <ul className="divide-y rounded-xl border">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/account/orders/${o.id}`} className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 hover:bg-accent/50">
                <span className="font-semibold">#{o.orderNumber}</span>
                <span className="text-sm text-muted-foreground">{formatDate(o.createdAt, tenant.locale, tenant.timezone)}</span>
                <StatusBadge tone={ORDER_STATUS_TONE[o.orderStatus]}>{ORDER_STATUS_LABELS[o.orderStatus]}</StatusBadge>
                <span className="text-sm text-muted-foreground">{o.itemCount} items</span>
                <span className="ml-auto font-medium">{formatMoney(o.total, o.currency, tenant.locale)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Package}
          title="No orders yet"
          description="Orders you place while signed in will appear here."
          action={
            <Button asChild>
              <Link href="/products">Start shopping</Link>
            </Button>
          }
        />
      )}
    </div>
  )
}
