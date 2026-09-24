import Link from "next/link"

import { Carousel } from "@/components/common/carousel"
import { SectionHeader } from "@/components/common/section-header"
import { SmartImage } from "@/components/common/smart-image"
import type { Category } from "@/features/catalog/types"

/** "Shop by category" row: touch/drag scrolling, arrows on desktop, image fallback. */
export function CategoryCarousel({ categories, title = "Shop by Category" }: { categories: Category[]; title?: string }) {
  if (!categories.length) return null
  return (
    <section aria-labelledby="home-categories">
      <SectionHeader id="home-categories" title={title} viewAllHref="/products" viewAllLabel="All products" />
      <Carousel label="Product categories" itemClassName="basis-[28%] sm:basis-[18%] lg:basis-[12.5%]">
        {categories.map((c) => (
          <Link key={c.id} href={`/categories/${c.slug}`} className="group flex flex-col items-center gap-2 text-center" draggable={false}>
            <span className="relative block aspect-square w-full overflow-hidden rounded-full border-2 border-transparent bg-accent transition-all group-hover:border-primary group-hover:shadow-md">
              <SmartImage
                src={c.imageUrl ?? c.iconUrl}
                alt=""
                fill
                sizes="(min-width: 1024px) 12vw, 28vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                fallbackClassName="text-2xl"
                fallbackLabel={c.name.slice(0, 1)}
              />
            </span>
            <span className="line-clamp-2 text-xs font-medium sm:text-sm">{c.name}</span>
          </Link>
        ))}
      </Carousel>
    </section>
  )
}

export function CategoryCarouselSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden" aria-busy="true" aria-label="Loading categories">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex basis-[28%] shrink-0 flex-col items-center gap-2 sm:basis-[18%] lg:basis-[12.5%]">
          <div className="skeleton-shimmer aspect-square w-full rounded-full" />
          <div className="skeleton-shimmer h-3 w-2/3 rounded" />
        </div>
      ))}
    </div>
  )
}
