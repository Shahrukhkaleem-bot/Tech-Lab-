import Link from "next/link"

import { SectionHeader } from "@/components/common/section-header"
import { RevealGroup, RevealItem } from "@/components/motion/reveal"
import { SmartImage } from "@/components/common/smart-image"
import type { Brand } from "@/features/catalog/types"
import { cn } from "@/lib/utils"

/** Responsive brand logo grid with hover state; each tile opens the brand page. */
export function BrandGrid({ brands, title = "Shop by Brand", showHeader = true, className }: { brands: Brand[]; title?: string; showHeader?: boolean; className?: string }) {
  if (!brands.length) return null
  return (
    <section aria-labelledby={showHeader ? "brands-heading" : undefined} className={className}>
      {showHeader ? <SectionHeader id="brands-heading" title={title} viewAllHref="/brands" viewAllLabel="All brands" /> : null}
      <RevealGroup as="ul" stagger={0.05} className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {brands.map((b) => (
          <RevealItem as="li" key={b.id}>
            <Link
              href={`/brands/${b.slug}`}
              className={cn(
                "group flex aspect-[3/2] items-center justify-center rounded-xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md",
              )}
              aria-label={b.name}
            >
              {b.logoUrl ? (
                <span className="relative size-full">
                  <SmartImage
                    src={b.logoUrl}
                    alt={b.name}
                    fill
                    sizes="(min-width: 1024px) 15vw, 30vw"
                    className="object-contain grayscale transition-all group-hover:grayscale-0"
                  />
                </span>
              ) : (
                <span className="text-center text-sm font-bold tracking-wide text-muted-foreground uppercase transition-colors group-hover:text-primary sm:text-base">
                  {b.name}
                </span>
              )}
            </Link>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  )
}
