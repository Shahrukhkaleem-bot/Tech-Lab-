import { CartDrawer } from "@/components/cart/cart-drawer"
import { BackToTop } from "@/components/layout/back-to-top"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { QuickViewDialog } from "@/components/products/quick-view-dialog"
import { getCategoryTree } from "@/features/catalog/queries"
import { getTenantFromParams } from "@/features/tenants/current"
import { getStoreNavigation, getStoreSettings } from "@/features/tenants/queries"

/** Storefront chrome: header, footer, cart drawer and quick view (shared by all store pages). */
export default async function StoreLayout({ children, params }: LayoutProps<"/[domain]">) {
  const tenant = await getTenantFromParams(params)
  const [settings, navigation, tree] = await Promise.all([
    getStoreSettings(tenant.id),
    getStoreNavigation(tenant.id),
    getCategoryTree(tenant.id),
  ])

  return (
    <>
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <SiteHeader tenant={tenant} settings={settings} navigation={navigation} categories={tree.roots} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter tenant={tenant} settings={settings} navigation={navigation} />
      <CartDrawer />
      <QuickViewDialog />
      <BackToTop />
    </>
  )
}
