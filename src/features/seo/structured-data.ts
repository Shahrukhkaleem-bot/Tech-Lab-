import type { ProductDetail, Review } from "@/features/catalog/types"
import type { StoreSettings, Tenant } from "@/features/tenants/types"

/** schema.org builders. Output is rendered through <JsonLd>, which escapes `<`. */

export function storeJsonLd(tenant: Tenant, settings: StoreSettings, origin: string) {
  const loc = settings.location
  return {
    "@context": "https://schema.org",
    "@type": loc.address ? "Store" : "Organization",
    "@id": `${origin}/#organization`,
    name: tenant.name,
    url: origin,
    logo: tenant.brand.logoUrl ? new URL(tenant.brand.logoUrl, origin).toString() : undefined,
    description: settings.tagline ?? undefined,
    email: tenant.contact.email ?? undefined,
    telephone: tenant.contact.phone ?? undefined,
    sameAs: Object.values(tenant.social),
    address: loc.address ? { "@type": "PostalAddress", streetAddress: loc.address } : undefined,
    geo:
      loc.latitude != null && loc.longitude != null
        ? { "@type": "GeoCoordinates", latitude: loc.latitude, longitude: loc.longitude }
        : undefined,
  }
}

export function websiteJsonLd(tenant: Tenant, origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: tenant.name,
    url: origin,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${origin}/products?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  }
}

export function productJsonLd(product: ProductDetail, tenant: Tenant, origin: string, reviews: Review[]) {
  const url = `${origin}/products/${product.slug}`
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": url,
    name: product.name,
    description: product.shortDescription ?? product.description?.slice(0, 500) ?? undefined,
    sku: product.sku ?? undefined,
    image: product.images.map((i) => new URL(i.url, origin).toString()),
    brand: product.brand ? { "@type": "Brand", name: product.brand.name } : undefined,
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: tenant.currency,
      price: product.price.toFixed(2),
      availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@id": `${origin}/#organization` },
    },
    aggregateRating:
      product.reviewCount > 0
        ? { "@type": "AggregateRating", ratingValue: product.rating.toFixed(2), reviewCount: product.reviewCount }
        : undefined,
    review: reviews.slice(0, 5).map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.customerName },
      datePublished: r.createdAt.slice(0, 10),
      reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
      reviewBody: r.comment ?? undefined,
    })),
  }
}

export function breadcrumbJsonLd(origin: string, items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${origin}${item.path}`,
    })),
  }
}
