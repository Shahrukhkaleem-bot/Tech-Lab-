import { cn } from "@/lib/utils"
import { formatMoney } from "@/lib/utils/format"

type PriceProps = {
  price: number
  originalPrice?: number | null
  currency: string
  locale?: string
  size?: "sm" | "md" | "lg"
  className?: string
}

/** Current price with struck-through original when discounted. Pure/server-safe. */
export function Price({ price, originalPrice, currency, locale, size = "md", className }: PriceProps) {
  const discounted = originalPrice != null && originalPrice > price
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2", className)}>
      <span
        className={cn(
          "font-semibold tracking-tight",
          size === "sm" && "text-sm",
          size === "md" && "text-base",
          size === "lg" && "text-2xl",
          discounted && "text-destructive",
        )}
      >
        {formatMoney(price, currency, locale)}
      </span>
      {discounted ? (
        <span className={cn("text-muted-foreground line-through", size === "lg" ? "text-base" : "text-xs")}>
          <span className="sr-only">Original price: </span>
          {formatMoney(originalPrice, currency, locale)}
        </span>
      ) : null}
    </div>
  )
}
