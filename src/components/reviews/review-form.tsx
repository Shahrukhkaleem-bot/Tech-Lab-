"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Star } from "lucide-react"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { submitReviewAction } from "@/features/reviews/actions"
import { cn } from "@/lib/utils"

const formSchema = z.object({
  rating: z.number().int().min(1, "Choose a rating").max(5),
  title: z.string().trim().max(120).optional(),
  comment: z.string().trim().min(10, "Tell us a little more (at least 10 characters)").max(2000),
})
type FormValues = z.infer<typeof formSchema>

export function ReviewForm({ productId }: { productId: string }) {
  const [submitted, setSubmitted] = useState(false)
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { rating: 0, title: "", comment: "" } })

  const onSubmit = handleSubmit(async (values) => {
    const res = await submitReviewAction({ productId, ...values })
    if (res.ok) {
      setSubmitted(true)
      toast.success("Thanks! Your review will appear once approved.")
      return
    }
    for (const [field, messages] of Object.entries(res.error.fieldErrors ?? {})) {
      if (field in formSchema.shape) setError(field as keyof FormValues, { message: messages[0] })
    }
    toast.error(res.error.message)
  })

  if (submitted) {
    return <p className="rounded-lg bg-accent p-4 text-sm">Thank you for your review! It will be published after moderation.</p>
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border p-5" noValidate>
      <h3 className="font-semibold">Write a review</h3>
      <Controller
        control={control}
        name="rating"
        render={({ field }) => (
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Your rating</legend>
            <div className="flex gap-1" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={field.value === n}
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                  onClick={() => field.onChange(n)}
                  className="rounded-md p-1.5"
                >
                  <Star className={cn("size-6", n <= field.value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} aria-hidden />
                </button>
              ))}
            </div>
            {errors.rating ? <p className="mt-1 text-xs text-destructive">{errors.rating.message}</p> : null}
          </fieldset>
        )}
      />
      <div className="grid gap-1.5">
        <Label htmlFor="review-title">Title (optional)</Label>
        <Input id="review-title" maxLength={120} {...register("title")} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="review-comment">Your review</Label>
        <Textarea id="review-comment" rows={4} maxLength={2000} aria-invalid={Boolean(errors.comment)} {...register("comment")} />
        {errors.comment ? <p className="text-xs text-destructive">{errors.comment.message}</p> : null}
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Submit review
      </Button>
    </form>
  )
}
