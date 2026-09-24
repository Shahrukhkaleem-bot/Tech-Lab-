"use client"

import { Heart } from "lucide-react"
import { toast } from "sonner"

import { useWishlist } from "@/components/providers/store-providers"
import type { ProductSummary } from "@/features/catalog/types"
import { toggleWishlistAction } from "@/features/wishlist/actions"
import { cn } from "@/lib/utils"

type WishlistButtonProps = {
  product: Pick<ProductSummary, "id" | "slug" | "name" | "price" | "originalPrice" | "image">
  className?: string
  variant?: "icon" | "full"
}

export function WishlistButton({ product, className, variant = "icon" }: WishlistButtonProps) {
  const active = useWishlist((s) => s.items.some((i) => i.productId === product.id))
  const toggle = useWishlist((s) => s.toggle)

  const onClick = () => {
    const added = toggle({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      imageUrl: product.image?.url ?? null,
      price: product.price,
      originalPrice: product.originalPrice,
    })
    toast(added ? "Saved to wishlist" : "Removed from wishlist", { description: product.name })
    // Best-effort server sync for signed-in customers (no-op for guests).
    void toggleWishlistAction({ productId: product.id, saved: added })
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full transition-colors",
        variant === "icon" && "size-9 bg-background/90 shadow-sm backdrop-blur hover:bg-background",
        variant === "full" && "h-10 border px-4 text-sm font-medium hover:bg-accent",
        className,
      )}
    >
      <Heart className={cn("size-4.5", active && "fill-destructive text-destructive")} aria-hidden />
      {variant === "full" ? (active ? "Saved" : "Add to wishlist") : null}
    </button>
  )
}
