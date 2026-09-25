"use client"

import { useState } from "react"

import { QuantitySelector } from "@/components/cart/quantity-selector"
import type { ProductDetail } from "@/features/catalog/types"

import { AddToCartButton } from "./add-to-cart-button"
import { WishlistButton } from "./wishlist-button"

export function PurchasePanel({ product }: { product: ProductDetail }) {
  const [quantity, setQuantity] = useState(1)
  const max = product.trackInventory ? Math.max(product.stockQuantity, 1) : 99

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      {product.inStock ? <QuantitySelector value={quantity} onChange={(q) => setQuantity(Math.max(1, Math.min(q, max)))} max={max} /> : null}
      <AddToCartButton product={product} quantity={quantity} size="lg" className="w-full sm:w-auto sm:flex-1" openCartOnAdd />
      <WishlistButton product={product} variant="full" className="h-11 w-full sm:h-10 sm:w-auto" />
    </div>
  )
}
