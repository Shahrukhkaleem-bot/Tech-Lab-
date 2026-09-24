import { CircleCheck } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { ClearCartOnMount } from "@/components/orders/clear-cart-on-mount"
import { OrderDetails } from "@/components/orders/order-details"
import { Button } from "@/components/ui/button"
import { getOrderByPublicToken } from "@/features/orders/queries"
import { getTenantFromParams } from "@/features/tenants/current"
import { getStoreSettings } from "@/features/tenants/queries"

// Per-user content (session cookie / order token): never statically cached.
export const dynamic = "force-dynamic"


export const metadata: Metadata = {
  title: "Order confirmed",
  robots: { index: false, follow: false },
  // The URL contains an access token: never leak it via the Referer header.
  referrer: "no-referrer",
}

export default async function OrderSuccessPage({ params, searchParams }: PageProps<"/[domain]/order-success/[orderId]">) {
  const tenant = await getTenantFromParams(params)
  const { orderId } = await params
  const { token } = await searchParams
  if (typeof token !== "string") notFound()

  const order = await getOrderByPublicToken(tenant.id, orderId, token)
  if (!order) notFound()

  const settings = await getStoreSettings(tenant.id)
  const showBankDetails = order.paymentMethod === "bank_transfer" && order.paymentStatus === "pending"
  const awaitingCard = order.paymentMethod === "card" && order.paymentStatus === "pending"

  return (
    <div className="container-page max-w-4xl py-8 sm:py-12">
      <ClearCartOnMount />
      <div className="mb-8 text-center">
        <CircleCheck className="mx-auto mb-3 size-14 text-success" aria-hidden />
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Thank you, {order.customerName.split(" ")[0]}!</h1>
        <p className="mt-2 text-muted-foreground">
          Your order <strong className="text-foreground">#{order.orderNumber}</strong> has been received. We&apos;ll keep you updated at{" "}
          {order.customerEmail}. Bookmark this page to check your order status.
        </p>
        {awaitingCard ? (
          <p role="status" className="mx-auto mt-4 max-w-md rounded-lg bg-accent p-3 text-sm">
            We&apos;re confirming your card payment. This page will show “Paid” once the payment provider confirms it.
          </p>
        ) : null}
      </div>

      {showBankDetails && settings.payment.bankAccounts.length ? (
        <section className="mb-8 rounded-xl border-2 border-dashed border-primary/40 p-5">
          <h2 className="font-semibold">Complete your bank transfer</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Please use <strong>#{order.orderNumber}</strong> as the payment reference. {settings.payment.instructions}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {settings.payment.bankAccounts.map((a) => (
              <dl key={a.account_number} className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg bg-muted/50 p-4 text-sm">
                <dt className="text-muted-foreground">Bank</dt>
                <dd>{a.bank_name}</dd>
                <dt className="text-muted-foreground">Title</dt>
                <dd>{a.account_title}</dd>
                <dt className="text-muted-foreground">Account</dt>
                <dd className="font-mono">{a.account_number}</dd>
                {a.iban ? (
                  <>
                    <dt className="text-muted-foreground">IBAN</dt>
                    <dd className="font-mono break-all">{a.iban}</dd>
                  </>
                ) : null}
              </dl>
            ))}
          </div>
        </section>
      ) : null}

      <OrderDetails order={order} locale={tenant.locale} timeZone={tenant.timezone} />

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href="/products">Continue shopping</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/account">View my orders</Link>
        </Button>
      </div>
    </div>
  )
}
