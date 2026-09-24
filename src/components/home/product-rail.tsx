import { Carousel } from "@/components/common/carousel"
import { SectionHeader } from "@/components/common/section-header"
import { ProductCard } from "@/components/products/product-card"
import type { ProductSummary } from "@/features/catalog/types"

type ProductRailProps = {
  id: string
  title: string
  subtitle?: string | null
  viewAllHref?: string
  products: ProductSummary[]
  currency: string
  locale?: string
}

/** Horizontal product section ("Top sellers", "New arrivals", …). Reuses ProductCard. */
export function ProductRail({ id, title, subtitle, viewAllHref, products, currency, locale }: ProductRailProps) {
  if (!products.length) return null
  return (
    <section aria-labelledby={id}>
      <SectionHeader id={id} title={title} subtitle={subtitle} viewAllHref={viewAllHref} />
      <Carousel label={title} itemClassName="basis-[70%] sm:basis-[40%] md:basis-[31%] lg:basis-[23.5%] xl:basis-[19%]">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} currency={currency} locale={locale} />
        ))}
      </Carousel>
    </section>
  )
}

export function ProductRailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading products">
      <div className="skeleton-shimmer mb-6 h-7 w-48 rounded" />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="basis-[70%] shrink-0 overflow-hidden rounded-xl border sm:basis-[40%] md:basis-[31%] lg:basis-[23.5%] xl:basis-[19%]">
            <div className="skeleton-shimmer aspect-square" />
            <div className="space-y-2 p-4">
              <div className="skeleton-shimmer h-4 w-full rounded" />
              <div className="skeleton-shimmer h-4 w-1/2 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
