"use client"

import { TriangleAlert } from "lucide-react"

import { SmartImage } from "@/components/common/smart-image"
import type { CheckoutQuote } from "@/features/checkout/types"
import { cn } from "@/lib/utils"
import { formatMoney } from "@/lib/utils/format"

/** Server-quoted order summary. Every number here came from the database. */
export function OrderSummary({ quote, loading, locale }: { quote: CheckoutQuote | null; loading: boolean; locale: string }) {
  if (!quote) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Calculating totals">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="skeleton-shimmer h-14 rounded-lg" />
        ))}
      </div>
    )
  }
  const money = (n: number) => formatMoney(n, quote.currency, locale)

  return (
    <div className={cn("space-y-4 transition-opacity", loading && "opacity-60")} aria-busy={loading}>
      <ul className="divide-y">
        {quote.lines.map((l) => (
          <li key={l.productId} className="flex gap-3 py-3">
            <span className="relative size-14 shrink-0 overflow-hidden rounded-md border bg-muted">
              <SmartImage src={l.imageUrl} alt="" fill sizes="56px" className="object-cover" />
              <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">
                {l.quantity}
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-medium">{l.name}</p>
              {l.problem ? (
                <p className="mt-1 flex items-center gap-1 text-xs font-medium text-destructive">
                  <TriangleAlert className="size-3.5" aria-hidden />
                  {l.problem === "UNAVAILABLE" ? "No longer available" : `Only ${l.availableQuantity ?? 0} in stock`}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {l.quantity} × {money(l.unitPrice)}
                </p>
              )}
            </div>
            <span className="text-sm font-medium">{money(l.lineTotal)}</span>
          </li>
        ))}
      </ul>

      <dl className="space-y-2 border-t pt-4 text-sm">
        <div className="flex justify-between">
          <dt>Subtotal</dt>
          <dd>{money(quote.subtotal)}</dd>
        </div>
        {quote.discountAmount > 0 ? (
          <div className="flex justify-between text-success">
            <dt>Discount {quote.coupon?.valid ? `(${quote.coupon.code})` : ""}</dt>
            <dd>−{money(quote.discountAmount)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between">
          <dt>Shipping</dt>
          <dd>{quote.shippingFee === 0 ? "Free" : money(quote.shippingFee)}</dd>
        </div>
        <div className="flex justify-between border-t pt-3 text-base font-bold">
          <dt>Total</dt>
          <dd>{money(quote.total)}</dd>
        </div>
      </dl>
    </div>
  )
}
