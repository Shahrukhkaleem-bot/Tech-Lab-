import Link from "next/link"

import { SectionHeader } from "@/components/common/section-header"
import type { PriceRange } from "@/features/tenants/types"

export function ShopByPrice({ ranges }: { ranges: PriceRange[] }) {
  if (!ranges.length) return null
  return (
    <section aria-labelledby="shop-by-price">
      <SectionHeader id="shop-by-price" title="Shop by Price" />
      <ul className="flex flex-wrap gap-2 sm:gap-3">
        {ranges.map((r) => {
          const sp = new URLSearchParams()
          if (r.min != null) sp.set("min", String(r.min))
          if (r.max != null) sp.set("max", String(r.max))
          return (
            <li key={r.label}>
              <Link
                href={`/products?${sp.toString()}`}
                className="inline-flex h-11 items-center rounded-full border bg-card px-5 text-sm font-medium transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
              >
                {r.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
