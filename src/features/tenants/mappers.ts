import { isFontKey, DEFAULT_FONT } from "@/config/fonts"
import type { NavigationItemRow, PaymentMethod, StoreSettingsRow, TenantRow } from "@/types/database"

import {
  brandConfigSchema,
  footerBadgeSchema,
  homepageSectionSchema,
  parseStoreJson,
  parseStoreJsonArray,
  paymentConfigSchema,
  priceRangeSchema,
  seoConfigSchema,
  shippingConfigSchema,
  socialLinksSchema,
  storeLocationSchema,
  trustBadgeSchema,
} from "./schemas"
import type { StoreNavigation, StoreSettings, Tenant } from "./types"

const DEFAULT_BRAND = brandConfigSchema.parse({})

export function mapTenant(row: TenantRow): Tenant {
  const brand = parseStoreJson(brandConfigSchema, row.brand_config, DEFAULT_BRAND)
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    subdomain: row.subdomain,
    customDomain: row.custom_domain && row.custom_domain_verified_at ? row.custom_domain : null,
    currency: row.currency,
    locale: row.locale,
    timezone: row.timezone,
    brand: {
      primaryColor: brand.primary_color,
      secondaryColor: brand.secondary_color,
      accentColor: brand.accent_color,
      logoUrl: brand.logo_url ?? null,
      faviconUrl: brand.favicon_url ?? null,
      font: isFontKey(brand.font_family) ? brand.font_family : DEFAULT_FONT,
      radius: brand.radius,
    },
    contact: {
      email: row.contact_email,
      phone: row.contact_phone,
      whatsapp: row.whatsapp_number,
      address: row.address,
    },
    social: parseStoreJson(socialLinksSchema, row.social_links, {}),
  }
}

const EMPTY_SHIPPING = shippingConfigSchema.parse({})
const EMPTY_LOCATION = storeLocationSchema.parse({})
const DEFAULT_PAYMENT = paymentConfigSchema.parse({})

export function mapStoreSettings(row: StoreSettingsRow | null): StoreSettings {
  const payment = parseStoreJson(paymentConfigSchema, row?.payment_config, DEFAULT_PAYMENT)
  const seo = parseStoreJson(seoConfigSchema, row?.seo, {})
  return {
    tagline: row?.tagline ?? null,
    announcement: row?.announcement ?? null,
    trustBadges: parseStoreJsonArray(trustBadgeSchema, row?.trust_badges),
    homepageSections: parseStoreJsonArray(homepageSectionSchema, row?.homepage_sections),
    priceRanges: parseStoreJsonArray(priceRangeSchema, row?.price_ranges),
    location: parseStoreJson(storeLocationSchema, row?.store_location, EMPTY_LOCATION),
    shipping: parseStoreJson(shippingConfigSchema, row?.shipping_config, EMPTY_SHIPPING),
    payment: {
      enabledMethods: payment.enabled_methods as PaymentMethod[],
      bankAccounts: payment.bank_accounts,
      instructions: payment.instructions ?? null,
      stripeAccountId: payment.stripe_account_id ?? null,
    },
    footerBadges: parseStoreJsonArray(footerBadgeSchema, row?.footer_badges),
    shippingInfo: row?.shipping_info ?? null,
    returnInfo: row?.return_info ?? null,
    seo: { title: seo.title ?? null, description: seo.description ?? null, ogImageUrl: seo.og_image_url ?? null },
  }
}

export function mapNavigation(rows: NavigationItemRow[]): StoreNavigation {
  const pick = (location: NavigationItemRow["location"]) =>
    rows
      .filter((r) => r.location === location)
      .sort((a, b) => a.display_order - b.display_order)
      .map((r) => ({ id: r.id, label: r.label, href: r.href }))
  return {
    header: pick("header"),
    footerHelp: pick("footer_help"),
    footerPolicies: pick("footer_policies"),
    footerCompany: pick("footer_company"),
  }
}
