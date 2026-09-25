import { discountPercent } from "@/lib/utils/format"
import type { BannerRow, BrandRow, Json, ProductImageRow, ProductRow, SearchProductsRow } from "@/types/database"

import type { Banner, Brand, ProductDetail, ProductImage, ProductSummary, Specification } from "./types"

const num = (v: number | string | null | undefined) => (v == null ? 0 : Number(v))

function inStock(trackInventory: boolean, stock: number) {
  return !trackInventory || stock > 0
}

export function mapSearchRow(row: SearchProductsRow): ProductSummary {
  const originalPrice = num(row.original_price)
  const salePrice = row.sale_price == null ? null : num(row.sale_price)
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    sku: row.sku,
    shortDescription: row.short_description,
    originalPrice,
    salePrice,
    price: num(row.price),
    isOnSale: row.is_on_sale,
    discountPercent: discountPercent(originalPrice, salePrice),
    trackInventory: row.track_inventory,
    stockQuantity: row.stock_quantity,
    inStock: inStock(row.track_inventory, row.stock_quantity),
    rating: num(row.rating),
    reviewCount: row.review_count,
    isFeatured: row.is_featured,
    categoryId: row.category_id,
    brand: row.brand_id && row.brand_name && row.brand_slug ? { id: row.brand_id, name: row.brand_name, slug: row.brand_slug } : null,
    image: row.image_url ? { url: row.image_url, alt: row.image_alt } : null,
    createdAt: row.created_at,
  }
}

export function mapImages(rows: Pick<ProductImageRow, "id" | "image_url" | "alt_text" | "is_primary" | "display_order">[]): ProductImage[] {
  return [...rows]
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.display_order - b.display_order)
    .map((r) => ({ id: r.id, url: r.image_url, alt: r.alt_text, isPrimary: r.is_primary }))
}

export function mapSpecifications(value: Json): Specification[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const name = typeof item.name === "string" ? item.name : null
      const val = typeof item.value === "string" ? item.value : null
      if (name && val) return [{ name, value: val }]
    }
    return []
  })
}

type ProductWithRelations = ProductRow & {
  brand: Pick<BrandRow, "id" | "name" | "slug"> | null
  images: Pick<ProductImageRow, "id" | "image_url" | "alt_text" | "is_primary" | "display_order">[]
}

export function mapProductDetail(row: ProductWithRelations): ProductDetail {
  const originalPrice = num(row.original_price)
  const salePrice = row.sale_price == null ? null : num(row.sale_price)
  const images = mapImages(row.images ?? [])
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    sku: row.sku,
    shortDescription: row.short_description,
    description: row.description,
    originalPrice,
    salePrice,
    price: num(row.price),
    isOnSale: row.is_on_sale,
    discountPercent: discountPercent(originalPrice, salePrice),
    trackInventory: row.track_inventory,
    stockQuantity: row.stock_quantity,
    lowStockThreshold: row.low_stock_threshold,
    inStock: inStock(row.track_inventory, row.stock_quantity),
    rating: num(row.rating),
    reviewCount: row.review_count,
    isFeatured: row.is_featured,
    categoryId: row.category_id,
    brand: row.brand ? { id: row.brand.id, name: row.brand.name, slug: row.brand.slug } : null,
    image: images[0] ? { url: images[0].url, alt: images[0].alt } : null,
    images,
    specifications: mapSpecifications(row.specifications),
    tags: row.tags ?? [],
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapBrand(row: Pick<BrandRow, "id" | "name" | "slug" | "logo_url" | "description" | "is_featured">): Brand {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logo_url,
    description: row.description,
    isFeatured: row.is_featured,
  }
}

export function mapBanner(row: BannerRow): Banner {
  return {
    id: row.id,
    heading: row.heading,
    description: row.description,
    badge: row.badge,
    ctaLabel: row.cta_label,
    linkUrl: row.link_url,
    desktopImageUrl: row.desktop_image_url,
    mobileImageUrl: row.mobile_image_url,
    desktopSize:
      row.desktop_image_width && row.desktop_image_height ? { width: row.desktop_image_width, height: row.desktop_image_height } : null,
    mobileSize: row.mobile_image_width && row.mobile_image_height ? { width: row.mobile_image_width, height: row.mobile_image_height } : null,
    showText: row.show_text,
  }
}
