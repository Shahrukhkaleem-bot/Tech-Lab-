"use client"

import { Check, ShoppingCart } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { useCart } from "@/components/providers/store-providers"
import { Button } from "@/components/ui/button"
import type { ProductSummary } from "@/features/catalog/types"
import { cn } from "@/lib/utils"
import { useUiStore } from "@/stores/ui-store"

type AddToCartButtonProps = {
  product: Pick<ProductSummary, "id" | "slug" | "name" | "price" | "originalPrice" | "inStock" | "trackInventory" | "stockQuantity" | "image">
  quantity?: number
  size?: "sm" | "default" | "lg"
  className?: string
  openCartOnAdd?: boolean
  fullWidth?: boolean
}

export function AddToCartButton({ product, quantity = 1, size = "default", className, openCartOnAdd = false, fullWidth }: AddToCartButtonProps) {
  const add = useCart((s) => s.add)
  const setCartOpen = useUiStore((s) => s.setCartOpen)
  const [justAdded, setJustAdded] = useState(false)

  if (!product.inStock) {
    return (
      <Button size={size} variant="outline" disabled className={cn(fullWidth && "w-full", className)}>
        Out of stock
      </Button>
    )
  }

  const onAdd = () => {
    const { added, limited } = add(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        imageUrl: product.image?.url ?? null,
        unitPrice: product.price,
        originalPrice: product.originalPrice,
        maxQuantity: product.trackInventory ? product.stockQuantity : null,
      },
      quantity,
    )
    if (added <= 0) {
      toast.warning("You already have the maximum available quantity in your cart.")
      return
    }
    if (limited) toast.info(`Only ${added} more could be added — that's all we have in stock.`)
    else
      toast.success("Added to cart", {
        description: product.name,
        action: { label: "View cart", onClick: () => setCartOpen(true) },
      })
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 1500)
    if (openCartOnAdd) setCartOpen(true)
  }

  return (
    <Button size={size} onClick={onAdd} className={cn(fullWidth && "w-full", className)} aria-live="polite">
      {justAdded ? <Check aria-hidden /> : <ShoppingCart aria-hidden />}
      {justAdded ? "Added" : "Add to cart"}
    </Button>
  )
}
