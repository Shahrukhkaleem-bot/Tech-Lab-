/** Serialisable catalogue view models (safe to pass to Client Components). */

export type ProductImage = { id: string; url: string; alt: string | null; isPrimary: boolean }

export type ProductSummary = {
  id: string
  name: string
  slug: string
  sku: string | null
  shortDescription: string | null
  originalPrice: number
  salePrice: number | null
  price: number
  isOnSale: boolean
  discountPercent: number
  trackInventory: boolean
  stockQuantity: number
  inStock: boolean
  rating: number
  reviewCount: number
  isFeatured: boolean
  categoryId: string | null
  brand: { id: string; name: string; slug: string } | null
  image: { url: string; alt: string | null } | null
  createdAt: string
}

export type Specification = { name: string; value: string }

export type ProductDetail = ProductSummary & {
  description: string | null
  specifications: Specification[]
  images: ProductImage[]
  lowStockThreshold: number
  tags: string[]
  seoTitle: string | null
  seoDescription: string | null
  updatedAt: string
}

export type Category = {
  id: string
  parentId: string | null
  name: string
  slug: string
  description: string | null
  imageUrl: string | null
  iconUrl: string | null
  displayOrder: number
  seoTitle: string | null
  seoDescription: string | null
  children: Category[]
}

export type CategoryTree = {
  roots: Category[]
  byId: Record<string, Category>
  bySlug: Record<string, Category>
}

export type Brand = {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  description: string | null
  isFeatured: boolean
}

export type Review = {
  id: string
  customerName: string
  rating: number
  title: string | null
  comment: string | null
  isVerified: boolean
  createdAt: string
  product: { name: string; slug: string; imageUrl: string | null } | null
}

export type Banner = {
  id: string
  heading: string
  description: string | null
  badge: string | null
  ctaLabel: string | null
  linkUrl: string | null
  desktopImageUrl: string
  mobileImageUrl: string | null
  /** Intrinsic sizes (null = unknown, measured in the browser). */
  desktopSize: { width: number; height: number } | null
  mobileSize: { width: number; height: number } | null
  /** false = the image already contains its own text; render it without overlay/heading. */
  showText: boolean
}

export const PRODUCT_SORTS = ["relevance", "newest", "price_asc", "price_desc", "rating", "best_selling", "name"] as const
export type ProductSort = (typeof PRODUCT_SORTS)[number]

export const SORT_LABELS: Record<ProductSort, string> = {
  relevance: "Most relevant",
  newest: "Newest",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  rating: "Top rated",
  best_selling: "Best selling",
  name: "Name: A–Z",
}

/** Normalised listing filters (parsed from URL search params). */
export type ProductFilters = {
  q?: string
  categorySlug?: string
  brandSlugs: string[]
  minPrice?: number
  maxPrice?: number
  minRating?: number
  inStock: boolean
  onSale: boolean
  sort: ProductSort
  page: number
}

export type ProductPage = {
  items: ProductSummary[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}
