import { CategoryMegaMenu } from "@/components/navigation/category-mega-menu"
import { HeaderActions } from "@/components/navigation/header-actions"
import { MobileMenu } from "@/components/navigation/mobile-menu"
import { SearchBox } from "@/components/navigation/search-box"
import type { Category } from "@/features/catalog/types"
import type { StoreNavigation, StoreSettings, Tenant } from "@/features/tenants/types"

import { StickyHeader } from "./sticky-header"
import { StoreLogo } from "./store-logo"
import { TopBar } from "./top-bar"

type SiteHeaderProps = {
  tenant: Tenant
  settings: StoreSettings
  navigation: StoreNavigation
  categories: Category[]
}

export function SiteHeader({ tenant, settings, navigation, categories }: SiteHeaderProps) {
  return (
    <>
      <TopBar tenant={tenant} settings={settings} />
      <StickyHeader className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container-page flex h-16 items-center gap-3 sm:h-18 sm:gap-6">
          <MobileMenu storeName={tenant.name} categories={categories} links={navigation.header} phone={tenant.contact.phone} />
          <StoreLogo tenant={tenant} />
          <SearchBox className="mx-auto hidden max-w-xl md:block" />
          <div className="ml-auto md:ml-0">
            <HeaderActions />
          </div>
        </div>
        <CategoryMegaMenu categories={categories} links={navigation.header} />
      </StickyHeader>
    </>
  )
}
