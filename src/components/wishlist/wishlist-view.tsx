"use client"

import { Heart, Trash2 } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/components/common/empty-state"
import { Price } from "@/components/common/price"
import { SmartImage } from "@/components/common/smart-image"
import { useWishlist } from "@/components/providers/store-providers"
import { useTenant } from "@/components/providers/tenant-provider"
import { Button } from "@/components/ui/button"

export function WishlistView() {
  const { tenant } = useTenant()
  const items = useWishlist((s) => s.items)
  const remove = useWishlist((s) => s.remove)

  if (!items.length) {
    return (
      <EmptyState
        icon={Heart}
        title="Your wishlist is empty"
        description="Tap the heart on any product to save it for later."
        action={
          <Button asChild>
            <Link href="/products">Discover products</Link>
          </Button>
        }
      />
    )
  }

  return (
    <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <li key={item.productId} className="group relative overflow-hidden rounded-xl border">
          <Link href={`/products/${item.slug}`} className="block">
            <span className="relative block aspect-square bg-muted">
              <SmartImage src={item.imageUrl} alt={item.name} fill sizes="25vw" className="object-contain p-3" />
            </span>
            <span className="block space-y-1 p-3">
              <span className="line-clamp-2 text-sm font-medium">{item.name}</span>
              <Price price={item.price} originalPrice={item.originalPrice > item.price ? item.originalPrice : null} currency={tenant.currency} locale={tenant.locale} size="sm" />
            </span>
          </Link>
          <button
            type="button"
            onClick={() => remove(item.productId)}
            aria-label={`Remove ${item.name} from wishlist`}
            className="absolute top-2 right-2 rounded-full bg-background/90 p-2 shadow-sm hover:text-destructive"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  )
}
