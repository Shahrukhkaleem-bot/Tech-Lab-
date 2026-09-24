import { z } from "zod"

import {
  bankAccountSchema,
  brandConfigSchema,
  footerBadgeSchema,
  homepageSectionSchema,
  PAYMENT_METHODS,
  priceRangeSchema,
  shippingConfigSchema,
  socialLinksSchema,
  storeLocationSchema,
  trustBadgeSchema,
} from "@/features/tenants/schemas"

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""))

export const generalSettingsSchema = z.object({
  name: z.string().trim().min(1, "Store name is required").max(120),
  contactEmail: z.email("Enter a valid email").optional().or(z.literal("")),
  contactPhone: optionalText(40),
  whatsappNumber: optionalText(40),
  address: optionalText(500),
  social: socialLinksSchema,
  tagline: optionalText(160),
  announcement: optionalText(200),
})

export const brandingSettingsSchema = brandConfigSchema

export const shippingSettingsSchema = shippingConfigSchema.extend({
  shippingInfo: optionalText(2000),
  returnInfo: optionalText(2000),
})

export const paymentSettingsSchema = z.object({
  enabled_methods: z.array(z.enum(PAYMENT_METHODS)).min(1, "Enable at least one payment method"),
  bank_accounts: z.array(bankAccountSchema).max(10),
  instructions: optionalText(500),
  stripe_account_id: z
    .string()
    .trim()
    .regex(/^acct_[A-Za-z0-9]+$/, "Must start with acct_")
    .optional()
    .or(z.literal("")),
})

export const contentSettingsSchema = z.object({
  trustBadges: z.array(trustBadgeSchema).max(8),
  homepageSections: z.array(homepageSectionSchema).max(10),
  priceRanges: z.array(priceRangeSchema).max(8),
  footerBadges: z.array(footerBadgeSchema).max(12),
  location: storeLocationSchema,
  seoTitle: optionalText(70),
  seoDescription: optionalText(160),
})

export const storePageSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens only")
    .max(120),
  title: z.string().trim().min(1).max(120),
  content: z.string().max(50000),
  seoDescription: optionalText(160),
  isPublished: z.boolean().default(true),
})
