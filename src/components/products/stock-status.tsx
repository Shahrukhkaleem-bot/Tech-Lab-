import { CircleCheck, CircleX, TriangleAlert } from "lucide-react"

import type { ProductSummary } from "@/features/catalog/types"

export function StockStatus({
  product,
  lowStockThreshold = 5,
}: {
  product: Pick<ProductSummary, "inStock" | "trackInventory" | "stockQuantity">
  lowStockThreshold?: number
}) {
  if (!product.inStock) {
    return (
      <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
        <CircleX className="size-4" aria-hidden /> Out of stock
      </p>
    )
  }
  if (product.trackInventory && product.stockQuantity <= lowStockThreshold) {
    return (
      <p className="flex items-center gap-1.5 text-sm font-medium text-warning">
        <TriangleAlert className="size-4" aria-hidden /> Only {product.stockQuantity} left in stock
      </p>
    )
  }
  return (
    <p className="flex items-center gap-1.5 text-sm font-medium text-success">
      <CircleCheck className="size-4" aria-hidden /> In stock
    </p>
  )
}
