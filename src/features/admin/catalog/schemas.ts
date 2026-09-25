import { z } from "zod"

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens only")
  .max(120)
const imageUrl = z.string().max(2048).regex(/^(https:\/\/|\/)/, "Invalid image URL").nullable().optional()
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""))

export const categoryFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  slug,
  description: optionalText(2000),
  parentId: z.uuid().optional().or(z.literal("")),
  imageUrl,
  displayOrder: z.coerce.number().int().min(0).max(10_000).default(0),
  isActive: z.boolean().default(true),
  seoTitle: optionalText(70),
  seoDescription: optionalText(160),
})
export type CategoryFormInput = z.input<typeof categoryFormSchema>

export const brandFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  slug,
  description: optionalText(2000),
  logoUrl: imageUrl,
  displayOrder: z.coerce.number().int().min(0).max(10_000).default(0),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
})
export type BrandFormInput = z.input<typeof brandFormSchema>

export const bannerFormSchema = z
  .object({
    heading: z.string().trim().min(1, "Heading is required").max(120),
    description: optionalText(300),
    badge: optionalText(40),
    ctaLabel: optionalText(40),
    linkUrl: z
      .string()
      .trim()
      .max(2048)
      .regex(/^(\/(?!\/)|https:\/\/)/, "Use a /path or https:// URL")
      .optional()
      .or(z.literal("")),
    desktopImageUrl: z.string().max(2048).regex(/^(https:\/\/|\/)/, "Upload a desktop image"),
    mobileImageUrl: imageUrl,
    desktopImageWidth: z.number().int().min(1).max(20000).nullable().optional(),
    desktopImageHeight: z.number().int().min(1).max(20000).nullable().optional(),
    mobileImageWidth: z.number().int().min(1).max(20000).nullable().optional(),
    mobileImageHeight: z.number().int().min(1).max(20000).nullable().optional(),
    /** Off when the image already contains its own text: shown as-is, whole banner is the link. */
    showText: z.boolean().default(true),
    displayOrder: z.coerce.number().int().min(0).max(10_000).default(0),
    isActive: z.boolean().default(true),
    startsAt: z.string().optional().or(z.literal("")),
    endsAt: z.string().optional().or(z.literal("")),
  })
  .refine((v) => !v.startsAt || !v.endsAt || new Date(v.startsAt) < new Date(v.endsAt), { message: "End must be after start", path: ["endsAt"] })
export type BannerFormInput = z.input<typeof bannerFormSchema>
