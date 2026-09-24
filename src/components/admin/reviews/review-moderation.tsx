"use client"

import { BadgeCheck, Check, EyeOff, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"

import { RatingStars } from "@/components/common/rating-stars"
import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { moderateReviewsAction } from "@/features/admin/reviews/actions"

export type ModerationReview = {
  id: string
  customerName: string
  rating: number
  title: string | null
  comment: string | null
  isApproved: boolean
  isVerified: boolean
  createdAt: string
  productName: string | null
}

export function ReviewModeration({ reviews }: { reviews: ModerationReview[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const act = (id: string, action: "approve" | "unapprove" | "delete") =>
    start(async () => {
      const res = await moderateReviewsAction({ ids: [id], action })
      if (!res.ok) return void toast.error(res.error.message)
      toast.success(action === "approve" ? "Review published" : action === "unapprove" ? "Review hidden" : "Review deleted")
      router.refresh()
    })

  if (!reviews.length) return <p className="p-6 text-sm text-muted-foreground">No reviews here.</p>
  return (
    <ul className="divide-y">
      {reviews.map((r) => (
        <li key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1 space-y-1 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{r.customerName}</span>
              {r.isVerified ? (
                <span className="inline-flex items-center gap-0.5 text-xs text-success">
                  <BadgeCheck className="size-3.5" aria-hidden /> Verified buyer
                </span>
              ) : null}
              <StatusBadge tone={r.isApproved ? "success" : "warning"}>{r.isApproved ? "Published" : "Pending"}</StatusBadge>
            </div>
            <RatingStars rating={r.rating} />
            {r.productName ? <p className="text-xs text-muted-foreground">on {r.productName}</p> : null}
            {r.title ? <p className="font-medium">{r.title}</p> : null}
            {r.comment ? <p className="text-muted-foreground">{r.comment}</p> : null}
          </div>
          <div className="flex gap-2">
            {r.isApproved ? (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => act(r.id, "unapprove")}>
                <EyeOff aria-hidden /> Hide
              </Button>
            ) : (
              <Button size="sm" disabled={pending} onClick={() => act(r.id, "approve")}>
                <Check aria-hidden /> Approve
              </Button>
            )}
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(r.id, "delete")} aria-label="Delete review">
              <Trash2 aria-hidden />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
