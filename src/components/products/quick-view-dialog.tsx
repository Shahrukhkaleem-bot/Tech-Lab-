"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { Price } from "@/components/common/price"
import { RatingStars } from "@/components/common/rating-stars"
import { SmartImage } from "@/components/common/smart-image"
import { useTenant } from "@/components/providers/tenant-provider"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { getQuickViewAction } from "@/features/catalog/actions"
import type { ProductDetail } from "@/features/catalog/types"
import { useUiStore } from "@/stores/ui-store"

import { AddToCartButton } from "./add-to-cart-button"
import { StockStatus } from "./stock-status"
import { WishlistButton } from "./wishlist-button"

type Loaded = { slug: string } & ({ status: "error"; message: string } | { status: "ready"; product: ProductDetail })
type State = { status: "loading" } | Loaded

/** Single, lazily-populated quick-view dialog mounted once per store layout. */
export function QuickViewDialog() {
  const slug = useUiStore((s) => s.quickViewSlug)
  const close = useUiStore((s) => s.openQuickView)
  const { tenant } = useTenant()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  // Results for a previous slug are ignored, so "loading" needs no extra state.
  const state: State = loaded && loaded.slug === slug ? loaded : { status: "loading" }

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    getQuickViewAction(slug).then((res) => {
      if (cancelled) return
      setLoaded(res.ok ? { slug, status: "ready", product: res.data } : { slug, status: "error", message: res.error.message })
    })
    return () => {
      cancelled = true
    }
  }, [slug])

  return (
    <Dialog open={Boolean(slug)} onOpenChange={(open) => !open && close(null)}>
      <DialogContent className="max-w-3xl p-0 sm:max-w-3xl">
        {state.status === "ready" ? (
          <div className="grid gap-0 sm:grid-cols-2">
            <div className="relative aspect-square bg-muted sm:rounded-l-lg">
              <SmartImage
                src={state.product.image?.url}
                alt={state.product.image?.alt ?? state.product.name}
                fill
                sizes="(min-width: 640px) 380px, 100vw"
                className="object-cover"
              />
            </div>
            <div className="flex flex-col gap-3 p-6">
              {state.product.brand ? (
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{state.product.brand.name}</p>
              ) : null}
              <DialogTitle className="text-xl leading-tight">{state.product.name}</DialogTitle>
              {state.product.reviewCount > 0 ? <RatingStars rating={state.product.rating} count={state.product.reviewCount} /> : null}
              <Price
                price={state.product.price}
                originalPrice={state.product.salePrice != null ? state.product.originalPrice : null}
                currency={tenant.currency}
                locale={tenant.locale}
                size="lg"
              />
              <StockStatus product={state.product} />
              {state.product.shortDescription ? (
                <DialogDescription className="text-sm text-muted-foreground">{state.product.shortDescription}</DialogDescription>
              ) : (
                <DialogDescription className="sr-only">Product quick view</DialogDescription>
              )}
              <div className="mt-auto flex gap-2 pt-4">
                <AddToCartButton product={state.product} fullWidth openCartOnAdd />
                <WishlistButton product={state.product} className="shrink-0 border" />
              </div>
              <Link
                href={`/products/${state.product.slug}`}
                onClick={() => close(null)}
                className="text-center text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                View full details
              </Link>
            </div>
          </div>
        ) : (
          <div className="p-8">
            <DialogTitle className="sr-only">Product quick view</DialogTitle>
            <DialogDescription className="sr-only">Loading product details</DialogDescription>
            {state.status === "error" ? (
              <p className="text-center text-sm text-destructive">{state.message}</p>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2" aria-busy="true">
                <div className="skeleton-shimmer aspect-square rounded-lg" />
                <div className="space-y-3">
                  <div className="skeleton-shimmer h-4 w-1/3 rounded" />
                  <div className="skeleton-shimmer h-6 w-full rounded" />
                  <div className="skeleton-shimmer h-6 w-1/2 rounded" />
                  <div className="skeleton-shimmer h-10 w-full rounded" />
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
