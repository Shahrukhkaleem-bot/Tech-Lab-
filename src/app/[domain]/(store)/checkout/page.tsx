import type { Metadata } from "next"

import { CheckoutForm } from "@/components/checkout/checkout-form"
import { Breadcrumbs } from "@/components/navigation/breadcrumbs"
import { getCurrentUser } from "@/features/auth/session"
import { getTenantFromParams } from "@/features/tenants/current"
import { getStoreSettings } from "@/features/tenants/queries"
import { availablePaymentMethods } from "@/lib/payments/registry"

// Per-user content (session cookie / order token): never statically cached.
export const dynamic = "force-dynamic"


export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } }

export default async function CheckoutPage({ params, searchParams }: PageProps<"/[domain]/checkout">) {
  const tenant = await getTenantFromParams(params)
  const [settings, user, sp] = await Promise.all([getStoreSettings(tenant.id), getCurrentUser(), searchParams])
  const methods = availablePaymentMethods(settings.payment)

  return (
    <div className="container-page py-6 sm:py-8">
      <Breadcrumbs items={[{ name: "Checkout" }]} />
      <h1 className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">Checkout</h1>
      {sp.cancelled ? (
        <p role="status" className="mb-6 rounded-lg bg-accent p-4 text-sm">
          Payment was cancelled and your order was not completed. You can try again or choose another payment method.
        </p>
      ) : null}
      <CheckoutForm
        methods={methods}
        bankAccounts={settings.payment.bankAccounts}
        defaults={{ email: user?.email ?? undefined, name: (user?.user_metadata?.full_name as string | undefined) ?? undefined }}
      />
    </div>
  )
}
