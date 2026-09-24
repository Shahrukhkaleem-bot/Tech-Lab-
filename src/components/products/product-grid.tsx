import type { ProductSummary } from "@/features/catalog/types"
import { cn } from "@/lib/utils"

import { ProductCard } from "./product-card"

export function ProductGrid({
  products,
  currency,
  locale,
  className,
  priorityCount = 0,
}: {
  products: ProductSummary[]
  currency: string
  locale?: string
  className?: string
  priorityCount?: number
}) {
  return (
    <ul className={cn("grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4", className)}>
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} currency={currency} locale={locale} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  )
}

export function ProductGridSkeleton({ count = 8, className }: { count?: number; className?: string }) {
  return (
    <ul className={cn("grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4", className)} aria-busy="true" aria-label="Loading products">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="overflow-hidden rounded-xl border">
          <div className="skeleton-shimmer aspect-square" />
          <div className="space-y-2 p-4">
            <div className="skeleton-shimmer h-3 w-1/3 rounded" />
            <div className="skeleton-shimmer h-4 w-full rounded" />
            <div className="skeleton-shimmer h-4 w-2/3 rounded" />
            <div className="skeleton-shimmer mt-3 h-8 w-full rounded-md" />
          </div>
        </li>
      ))}
    </ul>
  )
}
