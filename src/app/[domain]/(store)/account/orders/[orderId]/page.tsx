import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { Breadcrumbs } from "@/components/navigation/breadcrumbs"
import { OrderDetails } from "@/components/orders/order-details"
import { getCurrentUser } from "@/features/auth/session"
import { getMyOrder } from "@/features/orders/queries"
import { getTenantFromParams } from "@/features/tenants/current"

// Per-user content (session cookie / order token): never statically cached.
export const dynamic = "force-dynamic"


export const metadata: Metadata = { title: "Order details", robots: { index: false } }

export default async function MyOrderPage({ params }: PageProps<"/[domain]/account/orders/[orderId]">) {
  const tenant = await getTenantFromParams(params)
  const { orderId } = await params
  if (!(await getCurrentUser())) redirect(`/login?next=/account/orders/${orderId}`)

  const order = await getMyOrder(tenant.id, orderId)
  if (!order) notFound()

  return (
    <div className="container-page max-w-4xl py-8">
      <Breadcrumbs items={[{ name: "My account", href: "/account" }, { name: `Order #${order.orderNumber}` }]} />
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Order #{order.orderNumber}</h1>
      <OrderDetails order={order} locale={tenant.locale} timeZone={tenant.timezone} />
    </div>
  )
}
