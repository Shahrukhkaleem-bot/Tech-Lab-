import { z } from "zod"

import { DEFAULT_FONT, FONT_OPTIONS } from "@/config/fonts"

/**
 * Zod schemas for tenant/store JSON columns.
 * - `*Schema` are STRICT and used when admins save settings.
 * - `parseStoreJson` is LENIENT when reading: malformed stored data degrades to
 *   defaults instead of taking a storefront down.
 */

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour, e.g. #1d4ed8")
const httpsUrl = z.url({ protocol: /^https$/, message: "Must be an https:// URL" }).max(2048)
const imageUrl = z.union([httpsUrl, z.string().regex(/^\/[A-Za-z0-9/_.-]+$/, "Invalid path")])
const internalOrHttpsHref = z
  .string()
  .max(2048)
  .regex(/^(\/(?!\/)[^\s]*|https:\/\/[^\s]+)$/, "Use a /path or https:// URL")
const money = z.coerce.number().min(0).max(100_000_000)

export const brandConfigSchema = z.object({
  primary_color: hexColor.default("#111827"),
  secondary_color: hexColor.default("#1f2937"),
  accent_color: hexColor.default("#f59e0b"),
  logo_url: imageUrl.optional(),
  favicon_url: imageUrl.optional(),
  font_family: z.enum(FONT_OPTIONS.map((f) => f.value) as [string, ...string[]]).default(DEFAULT_FONT),
  radius: z
    .string()
    .regex(/^(0|0?\.\d+|1(\.\d+)?)rem$/)
    .default("0.75rem"),
})

export const SOCIAL_NETWORKS = ["facebook", "instagram", "tiktok", "youtube", "x", "linkedin", "whatsapp"] as const
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number]

export const socialLinksSchema = z.partialRecord(z.enum(SOCIAL_NETWORKS), httpsUrl)

export const TRUST_ICONS = [
  "truck",
  "badge-check",
  "rotate-ccw",
  "shield-check",
  "headphones",
  "wallet",
  "award",
  "clock",
  "gift",
  "thumbs-up",
] as const

export const trustBadgeSchema = z.object({
  icon: z.enum(TRUST_ICONS).default("badge-check"),
  title: z.string().trim().min(1).max(60),
  description: z.string().trim().max(140).optional(),
  href: internalOrHttpsHref.optional(),
})

export const HOMEPAGE_SECTION_TYPES = ["featured", "best_sellers", "new_arrivals", "on_sale", "category"] as const

export const homepageSectionSchema = z.object({
  type: z.enum(HOMEPAGE_SECTION_TYPES),
  title: z.string().trim().min(1).max(80),
  subtitle: z.string().trim().max(160).optional(),
  category_slug: z.string().max(120).optional(),
  limit: z.coerce.number().int().min(2).max(24).default(8),
})

export const priceRangeSchema = z
  .object({
    label: z.string().trim().min(1).max(40),
    min: money.optional(),
    max: money.optional(),
  })
  .refine((r) => r.min === undefined || r.max === undefined || r.min < r.max, "min must be below max")

export const storeLocationSchema = z.object({
  address: z.string().trim().max(500).optional(),
  map_url: httpsUrl.optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  phone: z.string().trim().max(40).optional(),
  hours: z
    .array(z.object({ label: z.string().trim().min(1).max(40), value: z.string().trim().min(1).max(60) }))
    .max(14)
    .default([]),
})

export const shippingConfigSchema = z.object({
  flat_rate: money.default(0),
  free_shipping_threshold: money.optional(),
  city_rates: z
    .array(z.object({ city: z.string().trim().min(1).max(80), rate: money }))
    .max(200)
    .default([]),
  estimated_days: z
    .object({ min: z.coerce.number().int().min(0).max(60), max: z.coerce.number().int().min(0).max(90) })
    .optional(),
  couriers: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
})

export const PAYMENT_METHODS = ["cod", "bank_transfer", "card", "wallet"] as const

export const bankAccountSchema = z.object({
  bank_name: z.string().trim().min(1).max(80),
  account_title: z.string().trim().min(1).max(120),
  account_number: z.string().trim().min(1).max(40),
  iban: z.string().trim().max(40).optional(),
})

export const paymentConfigSchema = z.object({
  enabled_methods: z.array(z.enum(PAYMENT_METHODS)).min(1).default(["cod"]),
  bank_accounts: z.array(bankAccountSchema).max(10).default([]),
  instructions: z.string().trim().max(500).optional(),
  /** Stripe Connect account (acct_...). Not a secret. */
  stripe_account_id: z
    .string()
    .regex(/^acct_[A-Za-z0-9]+$/)
    .optional(),
})

export const footerBadgeSchema = z.object({
  label: z.string().trim().min(1).max(40),
  image_url: imageUrl.optional(),
})

export const seoConfigSchema = z.object({
  title: z.string().trim().max(70).optional(),
  description: z.string().trim().max(160).optional(),
  og_image_url: imageUrl.optional(),
})

/**
 * Lenient read: returns parsed data, or the schema's defaults (or `fallback`) when the
 * stored JSON is malformed. Arrays are filtered item-by-item so one bad entry doesn't
 * hide the rest.
 */
export function parseStoreJson<T>(schema: z.ZodType<T>, value: unknown, fallback: T): T {
  const result = schema.safeParse(value ?? undefined)
  return result.success ? result.data : fallback
}

export function parseStoreJsonArray<T>(itemSchema: z.ZodType<T>, value: unknown): T[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const r = itemSchema.safeParse(item)
    return r.success ? [r.data] : []
  })
}
