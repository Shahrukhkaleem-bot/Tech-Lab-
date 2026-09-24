import type { z } from "zod"

import type { FontKey } from "@/config/fonts"
import type { MemberRole, PaymentMethod } from "@/types/database"

import type {
  bankAccountSchema,
  footerBadgeSchema,
  homepageSectionSchema,
  priceRangeSchema,
  shippingConfigSchema,
  SocialNetwork,
  storeLocationSchema,
  trustBadgeSchema,
} from "./schemas"

/** Public, serialisable tenant view used across the app (safe to send to the browser). */
export type Tenant = {
  id: string
  name: string
  slug: string
  subdomain: string
  /** Only set when the domain is verified. */
  customDomain: string | null
  currency: string
  locale: string
  timezone: string
  brand: {
    primaryColor: string
    secondaryColor: string
    accentColor: string
    logoUrl: string | null
    faviconUrl: string | null
    font: FontKey
    radius: string
  }
  contact: {
    email: string | null
    phone: string | null
    whatsapp: string | null
    address: string | null
  }
  social: Partial<Record<SocialNetwork, string>>
}

export type TrustBadge = z.infer<typeof trustBadgeSchema>
export type HomepageSection = z.infer<typeof homepageSectionSchema>
export type PriceRange = z.infer<typeof priceRangeSchema>
export type StoreLocation = z.infer<typeof storeLocationSchema>
export type ShippingConfig = z.infer<typeof shippingConfigSchema>
export type BankAccount = z.infer<typeof bankAccountSchema>
export type FooterBadge = z.infer<typeof footerBadgeSchema>

export type PaymentSettings = {
  enabledMethods: PaymentMethod[]
  bankAccounts: BankAccount[]
  instructions: string | null
  stripeAccountId: string | null
}

export type StoreSettings = {
  tagline: string | null
  announcement: string | null
  trustBadges: TrustBadge[]
  homepageSections: HomepageSection[]
  priceRanges: PriceRange[]
  location: StoreLocation
  shipping: ShippingConfig
  payment: PaymentSettings
  footerBadges: FooterBadge[]
  shippingInfo: string | null
  returnInfo: string | null
  seo: { title: string | null; description: string | null; ogImageUrl: string | null }
}

export type NavLink = { id: string; label: string; href: string }

export type StoreNavigation = {
  header: NavLink[]
  footerHelp: NavLink[]
  footerPolicies: NavLink[]
  footerCompany: NavLink[]
}

export type TenantMembership = { tenantId: string; role: MemberRole }
