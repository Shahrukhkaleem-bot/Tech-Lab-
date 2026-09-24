import { BadgeCheck } from "lucide-react"
import Link from "next/link"

import { RatingStars } from "@/components/common/rating-stars"
import { SmartImage } from "@/components/common/smart-image"
import type { Review } from "@/features/catalog/types"
import { cn } from "@/lib/utils"
import { formatRelativeTime, initials } from "@/lib/utils/format"

export function ReviewCard({ review, className, showProduct = true }: { review: Review; className?: string; showProduct?: boolean }) {
  return (
    <figure className={cn("flex h-full flex-col gap-3 rounded-xl border bg-card p-5", className)}>
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {initials(review.customerName)}
        </span>
        <div className="min-w-0">
          <figcaption className="flex items-center gap-1.5 text-sm font-semibold">
            <span className="truncate">{review.customerName}</span>
            {review.isVerified ? (
              <span className="inline-flex items-center gap-0.5 text-xs font-medium text-success">
                <BadgeCheck className="size-3.5" aria-hidden /> Verified
              </span>
            ) : null}
          </figcaption>
          <time dateTime={review.createdAt} className="text-xs text-muted-foreground">
            {formatRelativeTime(review.createdAt)}
          </time>
        </div>
      </div>
      <RatingStars rating={review.rating} />
      {review.title ? <p className="text-sm font-semibold">{review.title}</p> : null}
      {review.comment ? <blockquote className="line-clamp-5 text-sm text-muted-foreground">“{review.comment}”</blockquote> : null}
      {showProduct && review.product ? (
        <Link href={`/products/${review.product.slug}`} className="mt-auto flex items-center gap-3 rounded-lg bg-muted/60 p-2 hover:bg-accent">
          <span className="relative size-10 shrink-0 overflow-hidden rounded-md bg-background">
            <SmartImage src={review.product.imageUrl} alt="" fill sizes="40px" className="object-contain p-1" />
          </span>
          <span className="line-clamp-2 text-xs font-medium">{review.product.name}</span>
        </Link>
      ) : null}
    </figure>
  )
}
