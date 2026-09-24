import Link from "next/link"

import { Price } from "@/components/common/price"
import { RatingStars } from "@/components/common/rating-stars"
import { SmartImage } from "@/components/common/smart-image"
import type { ProductSummary } from "@/features/catalog/types"
import { cn } from "@/lib/utils"

import { AddToCartButton } from "./add-to-cart-button"
import { QuickViewButton } from "./quick-view-button"
import { WishlistButton } from "./wishlist-button"

type ProductCardProps = {
  product: ProductSummary
  currency: string
  locale?: string
  /** Set for above-the-fold cards (LCP). */
  priority?: boolean
  className?: string
}

/**
 * THE product card. Used by every rail, grid, search result and related-products list.
 * Server-renderable; interactive parts (cart, wishlist, quick view) are client islands.
 */
export function ProductCard({ product, currency, locale, priority, className }: ProductCardProps) {
  const lowStock = product.trackInventory && product.inStock && product.stockQuantity <= 5
  const href = `/products/${product.slug}`

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-xl border bg-card transition-shadow duration-200 hover:shadow-lg",
        className,
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        <Link href={href} tabIndex={-1} aria-hidden className="block size-full">
          <SmartImage
            src={product.image?.url}
            alt={product.image?.alt ?? product.name}
            fallbackLabel={product.brand?.name}
            fill
            sizes="(min-width: 1280px) 20vw, (min-width: 768px) 30vw, 50vw"
            priority={priority}
            className="object-contain p-3 transition-transform duration-300 group-hover:scale-105"
          />
        </Link>

        <div className="pointer-events-none absolute top-2 left-2 flex flex-col gap-1">
          {product.discountPercent > 0 ? (
            <span className="rounded-md bg-highlight px-2 py-0.5 text-xs font-bold text-highlight-foreground">
              -{product.discountPercent}%
            </span>
          ) : null}
          {!product.inStock ? (
            <span className="rounded-md bg-foreground/80 px-2 py-0.5 text-xs font-medium text-background">Sold out</span>
          ) : null}
        </div>

        <div className="absolute top-2 right-2 z-10 flex flex-col gap-2 opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
          <WishlistButton product={product} />
          <QuickViewButton slug={product.slug} name={product.name} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3 sm:p-4">
        {product.brand ? (
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{product.brand.name}</p>
        ) : null}
        <h3 className="line-clamp-2 text-sm leading-snug font-medium">
          <Link href={href} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {product.name}
          </Link>
        </h3>
        {product.reviewCount > 0 ? <RatingStars rating={product.rating} count={product.reviewCount} /> : null}
        <Price price={product.price} originalPrice={product.salePrice != null ? product.originalPrice : null} currency={currency} locale={locale} />
        {lowStock ? <p className="text-xs font-medium text-warning">Only {product.stockQuantity} left</p> : null}

        {/* Relative + z-10 so the button sits above the full-card link overlay. */}
        <div className="relative z-10 mt-auto pt-2">
          <AddToCartButton product={product} size="sm" fullWidth />
        </div>
      </div>
    </article>
  )
}
