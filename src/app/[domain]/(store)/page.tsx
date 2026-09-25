import { Suspense } from "react"

import { JsonLd } from "@/components/common/json-ld"
import { Reveal } from "@/components/motion/reveal"
import { BrandGrid } from "@/components/home/brand-grid"
import { CategoryCarousel } from "@/components/home/category-carousel"
import { HeroCarousel } from "@/components/home/hero-carousel"
import { ProductRail, ProductRailSkeleton } from "@/components/home/product-rail"
import { ReviewsCarousel } from "@/components/home/reviews-carousel"
import { ShopByPrice } from "@/components/home/shop-by-price"
import { StoreLocation } from "@/components/home/store-location"
import { TrustBadges } from "@/components/home/trust-badges"
import { getActiveBanners, getBrands, getCategoryTree, getLatestReviews, getSectionProducts } from "@/features/catalog/queries"
import { storeJsonLd, websiteJsonLd } from "@/features/seo/structured-data"
import { getTenantFromParams, tenantOrigin } from "@/features/tenants/current"
import { getStoreSettings } from "@/features/tenants/queries"
import type { HomepageSection, Tenant } from "@/features/tenants/types"

const SECTION_LINKS: Record<HomepageSection["type"], (s: HomepageSection) => string> = {
  featured: () => "/products",
  best_sellers: () => "/products?sort=best_selling",
  new_arrivals: () => "/products?sort=newest",
  on_sale: () => "/products?on_sale=1",
  category: (s) => (s.category_slug ? `/categories/${s.category_slug}` : "/products"),
}

async function HomeSection({ tenant, section, index }: { tenant: Tenant; section: HomepageSection; index: number }) {
  const products = await getSectionProducts(tenant.id, section)
  return (
    <ProductRail
      id={`home-section-${index}`}
      title={section.title}
      subtitle={section.subtitle}
      viewAllHref={SECTION_LINKS[section.type](section)}
      products={products}
      currency={tenant.currency}
      locale={tenant.locale}
    />
  )
}

export default async function HomePage({ params }: PageProps<"/[domain]">) {
  const tenant = await getTenantFromParams(params)
  const [settings, banners, tree, brands, reviews] = await Promise.all([
    getStoreSettings(tenant.id),
    getActiveBanners(tenant.id),
    getCategoryTree(tenant.id),
    getBrands(tenant.id),
    getLatestReviews(tenant.id, 12),
  ])
  const origin = tenantOrigin(tenant)
  const sections = settings.homepageSections.length
    ? settings.homepageSections
    : ([
        { type: "featured", title: "Featured Products", limit: 8 },
        { type: "new_arrivals", title: "New Arrivals", limit: 8 },
      ] satisfies HomepageSection[])

  return (
    <div className="container-page space-y-12 py-6 sm:space-y-16 sm:py-8">
      <JsonLd data={[storeJsonLd(tenant, settings, origin), websiteJsonLd(tenant, origin)]} />
      <h1 className="sr-only">{tenant.name}</h1>

      {/* No reveal wrapper: the hero is the LCP element and must paint immediately. */}
      <HeroCarousel banners={banners} />
      <Reveal>
        <CategoryCarousel categories={tree.roots} />
      </Reveal>
      <TrustBadges badges={settings.trustBadges} />

      {sections.map((section, i) => (
        <Reveal key={`${section.type}-${i}`}>
          <Suspense fallback={<ProductRailSkeleton />}>
            <HomeSection tenant={tenant} section={section} index={i} />
          </Suspense>
        </Reveal>
      ))}

      <Reveal>
        <ShopByPrice ranges={settings.priceRanges} />
      </Reveal>
      <BrandGrid brands={brands.filter((b) => b.isFeatured).slice(0, 12)} />
      <Reveal>
        <ReviewsCarousel reviews={reviews} />
      </Reveal>
      <Reveal>
        <StoreLocation location={settings.location} storeName={tenant.name} />
      </Reveal>
    </div>
  )
}
