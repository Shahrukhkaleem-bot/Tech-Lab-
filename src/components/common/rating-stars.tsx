import { Star } from "lucide-react"

import { cn } from "@/lib/utils"

type RatingStarsProps = {
  rating: number
  count?: number
  size?: "sm" | "md"
  className?: string
  showValue?: boolean
}

/** Accessible star rating (announced as "4.5 out of 5"). Supports fractional fill. */
export function RatingStars({ rating, count, size = "sm", className, showValue = false }: RatingStarsProps) {
  const value = Math.max(0, Math.min(5, rating))
  const iconSize = size === "sm" ? "size-3.5" : "size-4.5"

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className="relative flex" role="img" aria-label={`Rated ${value.toFixed(1)} out of 5`}>
        <div className="flex text-muted-foreground/30">
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} className={cn(iconSize, "fill-current")} aria-hidden />
          ))}
        </div>
        <div className="absolute inset-0 flex overflow-hidden text-amber-400" style={{ width: `${(value / 5) * 100}%` }}>
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} className={cn(iconSize, "shrink-0 fill-current")} aria-hidden />
          ))}
        </div>
      </div>
      {showValue ? <span className="text-xs font-medium">{value.toFixed(1)}</span> : null}
      {count != null ? <span className="text-xs text-muted-foreground">({count})</span> : null}
    </div>
  )
}
