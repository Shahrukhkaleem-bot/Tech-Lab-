"use client"

import { ShoppingBag, Trash2, Truck } from "lucide-react"
import Link from "next/link"

import { Price } from "@/components/common/price"
import { SmartImage } from "@/components/common/smart-image"
import { useCart } from "@/components/providers/store-providers"
import { useTenant } from "@/components/providers/tenant-provider"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useCartRefresh } from "@/hooks/use-cart-refresh"
import { formatMoney } from "@/lib/utils/format"
import { amountToFreeShipping, shippingFee } from "@/lib/utils/pricing"
import { selectItemCount, selectSubtotal } from "@/stores/cart-store"
import { useUiStore } from "@/stores/ui-store"

import { QuantitySelector } from "./quantity-selector"

export function CartDrawer() {
  const open = useUiStore((s) => s.cartOpen)
  const setOpen = useUiStore((s) => s.setCartOpen)
  const { tenant, shipping } = useTenant()
  const items = useCart((s) => s.items)
  const count = useCart(selectItemCount)
  const subtotal = useCart(selectSubtotal)
  const setQuantity = useCart((s) => s.setQuantity)
  const remove = useCart((s) => s.remove)

  useCartRefresh(open)

  const rules = { flatRate: shipping.flat_rate, freeShippingThreshold: shipping.free_shipping_threshold, cityRates: shipping.city_rates }
  const estimate = shippingFee(rules, subtotal)
  const remaining = amountToFreeShipping(rules, subtotal)
  const money = (n: number) => formatMoney(n, tenant.currency, tenant.locale)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Your cart {count ? `(${count})` : ""}</SheetTitle>
          <SheetDescription className="sr-only">Review items in your cart</SheetDescription>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="rounded-full bg-accent p-4 text-primary">
              <ShoppingBag className="size-7" aria-hidden />
            </div>
            <div>
              <p className="font-semibold">Your cart is empty</p>
              <p className="mt-1 text-sm text-muted-foreground">Browse the store and add something you love.</p>
            </div>
            <Button asChild onClick={() => setOpen(false)}>
              <Link href="/products">Start shopping</Link>
            </Button>
          </div>
        ) : (
          <>
            {remaining != null ? (
              <div className="border-b bg-accent px-4 py-3 text-sm">
                <p className="flex items-center gap-2">
                  <Truck className="size-4 text-primary" aria-hidden />
                  Add <strong>{money(remaining)}</strong> more for free delivery
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background" aria-hidden>
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, (subtotal / (shipping.free_shipping_threshold ?? 1)) * 100)}%` }}
                  />
                </div>
              </div>
            ) : null}

            <ul className="flex-1 divide-y overflow-y-auto px-4">
              {items.map((item) => (
                <li key={item.productId} className="flex gap-3 py-4">
                  <Link
                    href={`/products/${item.slug}`}
                    onClick={() => setOpen(false)}
                    className="relative size-20 shrink-0 overflow-hidden rounded-lg border bg-muted"
                  >
                    <SmartImage src={item.imageUrl} alt={item.name} fill sizes="80px" className="object-contain p-1.5" />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/products/${item.slug}`}
                        onClick={() => setOpen(false)}
                        className="line-clamp-2 text-sm font-medium hover:text-primary"
                      >
                        {item.name}
                      </Link>
                      <button
                        type="button"
                        onClick={() => remove(item.productId)}
                        aria-label={`Remove ${item.name}`}
                        className="-mt-1 -mr-1 rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-destructive"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>
                    <Price
                      price={item.unitPrice}
                      originalPrice={item.originalPrice > item.unitPrice ? item.originalPrice : null}
                      currency={tenant.currency}
                      locale={tenant.locale}
                      size="sm"
                    />
                    <div className="mt-auto flex items-center justify-between">
                      <QuantitySelector
                        size="sm"
                        value={item.quantity}
                        max={item.maxQuantity}
                        min={1}
                        onChange={(q) => setQuantity(item.productId, q)}
                        label={`Quantity of ${item.name}`}
                      />
                      <span className="text-sm font-semibold">{money(item.unitPrice * item.quantity)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <SheetFooter className="gap-3 border-t bg-muted/40 p-4">
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt>Subtotal</dt>
                  <dd className="font-semibold">{money(subtotal)}</dd>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <dt>Estimated delivery</dt>
                  <dd>{estimate === 0 ? "Free" : money(estimate)}</dd>
                </div>
              </dl>
              <p className="text-xs text-muted-foreground">Final prices, delivery and discounts are confirmed at checkout.</p>
              <Button asChild size="lg" className="w-full" onClick={() => setOpen(false)}>
                <Link href="/checkout">Checkout</Link>
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setOpen(false)}>
                Continue shopping
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
