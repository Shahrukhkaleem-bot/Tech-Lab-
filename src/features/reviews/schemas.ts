import { z } from "zod"

export const reviewSchema = z.object({
  productId: z.uuid(),
  rating: z.coerce.number().int().min(1, "Choose a rating").max(5),
  title: z.string().trim().max(120).optional().or(z.literal("")),
  comment: z.string().trim().min(10, "Tell us a little more (at least 10 characters)").max(2000),
})

export type ReviewInput = z.infer<typeof reviewSchema>
