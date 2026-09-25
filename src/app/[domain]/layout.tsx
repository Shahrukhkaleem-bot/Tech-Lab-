import "../globals.css"

import type { Metadata, Viewport } from "next"

import { MotionProvider } from "@/components/motion/motion-provider"
import { StoreProviders } from "@/components/providers/store-providers"
import { TenantProvider } from "@/components/providers/tenant-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { getTenantFromParams, tenantOrigin } from "@/features/tenants/current"
import { getStoreSettings } from "@/features/tenants/queries"
import { buildThemeStyle } from "@/features/tenants/theme"
import { availablePaymentMethods } from "@/lib/payments/registry"

import { fontVariables } from "../fonts"

/**
 * Tenant ROOT layout (renders <html>). Everything under a store host lives here.
 * Theme CSS variables are set on <body> so portals (dialogs, sheets, toasts) inherit them.
 */

// Tenants are unbounded and unknown at build time: render on first request, then
// cache (ISR) until an admin change invalidates the tenant's tags.
export async function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: LayoutProps<"/[domain]">): Promise<Metadata> {
  const tenant = await getTenantFromParams(params)
  const settings = await getStoreSettings(tenant.id)
  const description = settings.seo.description ?? settings.tagline ?? `Shop online at ${tenant.name}.`
  const isPreview = process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV !== "production"

  return {
    metadataBase: new URL(tenantOrigin(tenant)),
    title: { default: settings.seo.title ?? tenant.name, template: `%s | ${tenant.name}` },
    description,
    applicationName: tenant.name,
    icons: tenant.brand.faviconUrl ? { icon: tenant.brand.faviconUrl, apple: tenant.brand.faviconUrl } : undefined,
    openGraph: {
      type: "website",
      siteName: tenant.name,
      locale: tenant.locale.replace("-", "_"),
      description,
      images: settings.seo.ogImageUrl ? [{ url: settings.seo.ogImageUrl }] : undefined,
    },
    twitter: { card: "summary_large_image", description },
    robots: isPreview ? { index: false, follow: false } : undefined,
    formatDetection: { telephone: false },
  }
}

export async function generateViewport({ params }: LayoutProps<"/[domain]">): Promise<Viewport> {
  const tenant = await getTenantFromParams(params)
  return { themeColor: tenant.brand.primaryColor, width: "device-width", initialScale: 1 }
}

export default async function TenantRootLayout({ children, params }: LayoutProps<"/[domain]">) {
  const tenant = await getTenantFromParams(params)
  const settings = await getStoreSettings(tenant.id)

  return (
    <html lang={tenant.locale.split("-")[0]} className={fontVariables}>
      <body style={buildThemeStyle(tenant.brand)} className="flex min-h-dvh flex-col">
        <TenantProvider
          value={{
            tenant,
            shipping: settings.shipping,
            paymentMethods: availablePaymentMethods(settings.payment).map((m) => m.method),
          }}
        >
          <StoreProviders tenantId={tenant.id}>
            <MotionProvider>
              <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
            </MotionProvider>
            <Toaster position="top-center" />
          </StoreProviders>
        </TenantProvider>
      </body>
    </html>
  )
}
