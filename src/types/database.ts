/**
 * Supabase database types.
 *
 * Hand-maintained in the exact shape produced by `supabase gen types typescript`.
 * After changing a migration, regenerate with:
 *   npm run db:types      (supabase gen types typescript --local > src/types/database.ts)
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type Timestamps = { created_at: string; updated_at: string }

export type TenantStatus = "pending" | "active" | "suspended" | "archived"
export type MemberRole = "owner" | "admin" | "manager" | "staff"
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "returned"
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded" | "partially_refunded" | "cancelled"
export type PaymentMethod = "cod" | "bank_transfer" | "card" | "wallet"
export type InventoryReason = "initial" | "sale" | "cancellation" | "return" | "restock" | "adjustment"
export type DiscountType = "percentage" | "fixed"
export type TransactionType = "payment" | "refund"
export type TransactionStatus = "pending" | "succeeded" | "failed" | "cancelled"
export type NavLocation = "header" | "footer_help" | "footer_policies" | "footer_company"

/** Row → Insert helper: columns with defaults / nullable become optional. */
type Insertable<Row, Required extends keyof Row> = Pick<Row, Required> & Partial<Omit<Row, Required>>

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------
export type TenantRow = Timestamps & {
  id: string
  name: string
  slug: string
  subdomain: string
  custom_domain: string | null
  custom_domain_verified_at: string | null
  status: TenantStatus
  brand_config: Json
  contact_email: string | null
  contact_phone: string | null
  whatsapp_number: string | null
  address: string | null
  social_links: Json
  currency: string
  locale: string
  timezone: string
  order_number_seq: number
}

export type ProfileRow = Timestamps & {
  id: string
  full_name: string | null
  phone: string | null
  avatar_url: string | null
}

export type TenantMemberRow = Timestamps & {
  tenant_id: string
  user_id: string
  role: MemberRole
}

export type CategoryRow = Timestamps & {
  id: string
  tenant_id: string
  parent_id: string | null
  name: string
  slug: string
  description: string | null
  icon_url: string | null
  image_url: string | null
  display_order: number
  is_active: boolean
  seo_title: string | null
  seo_description: string | null
}

export type BrandRow = Timestamps & {
  id: string
  tenant_id: string
  name: string
  slug: string
  logo_url: string | null
  description: string | null
  display_order: number
  is_featured: boolean
  is_active: boolean
}

export type ProductRow = Timestamps & {
  id: string
  tenant_id: string
  brand_id: string | null
  category_id: string | null
  name: string
  slug: string
  short_description: string | null
  description: string | null
  sku: string | null
  original_price: number
  sale_price: number | null
  price: number
  is_on_sale: boolean
  track_inventory: boolean
  stock_quantity: number
  low_stock_threshold: number
  is_featured: boolean
  is_active: boolean
  rating: number
  review_count: number
  sales_count: number
  specifications: Json
  tags: string[]
  seo_title: string | null
  seo_description: string | null
  search_vector: unknown
}

export type ProductCostRow = {
  product_id: string
  tenant_id: string
  cost_price: number
  supplier: string | null
  updated_at: string
}

export type ProductImageRow = {
  id: string
  tenant_id: string
  product_id: string
  image_url: string
  storage_path: string | null
  alt_text: string | null
  is_primary: boolean
  display_order: number
  created_at: string
}

export type ReviewRow = Timestamps & {
  id: string
  tenant_id: string
  product_id: string
  user_id: string | null
  customer_name: string
  rating: number
  title: string | null
  comment: string | null
  is_verified: boolean
  is_approved: boolean
}

export type InventoryMovementRow = {
  id: number
  tenant_id: string
  product_id: string
  quantity_change: number
  quantity_after: number
  reason: InventoryReason
  order_id: string | null
  note: string | null
  created_by: string | null
  created_at: string
}

export type StoreSettingsRow = {
  tenant_id: string
  tagline: string | null
  announcement: string | null
  trust_badges: Json
  homepage_sections: Json
  price_ranges: Json
  store_location: Json
  shipping_config: Json
  payment_config: Json
  footer_badges: Json
  shipping_info: string | null
  return_info: string | null
  seo: Json
  updated_at: string
}

export type BannerRow = Timestamps & {
  id: string
  tenant_id: string
  heading: string
  description: string | null
  badge: string | null
  cta_label: string | null
  link_url: string | null
  desktop_image_url: string
  mobile_image_url: string | null
  desktop_image_width: number | null
  desktop_image_height: number | null
  mobile_image_width: number | null
  mobile_image_height: number | null
  show_text: boolean
  display_order: number
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
}

export type StorePageRow = Timestamps & {
  id: string
  tenant_id: string
  slug: string
  title: string
  content: string
  seo_description: string | null
  is_published: boolean
}

export type NavigationItemRow = Timestamps & {
  id: string
  tenant_id: string
  location: NavLocation
  label: string
  href: string
  display_order: number
  is_active: boolean
}

export type CouponRow = Timestamps & {
  id: string
  tenant_id: string
  code: string
  description: string | null
  discount_type: DiscountType
  discount_value: number
  min_order_amount: number
  max_discount_amount: number | null
  starts_at: string | null
  ends_at: string | null
  usage_limit: number | null
  usage_limit_per_customer: number | null
  used_count: number
  is_active: boolean
}

export type OrderRow = Timestamps & {
  id: string
  tenant_id: string
  order_number: number
  customer_id: string | null
  customer_name: string
  customer_email: string
  customer_phone: string
  shipping_address: string
  city: string
  postal_code: string | null
  country: string
  order_notes: string | null
  subtotal: number
  shipping_fee: number
  discount_amount: number
  total_amount: number
  currency: string
  coupon_id: string | null
  coupon_code: string | null
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  order_status: OrderStatus
  courier_name: string | null
  tracking_number: string | null
  tracking_url: string | null
  shipping_provider: string
  shipped_at: string | null
  delivered_at: string | null
  cancelled_at: string | null
  internal_notes: string | null
  idempotency_key: string
  public_token: string
}

export type OrderItemRow = {
  id: string
  tenant_id: string
  order_id: string
  product_id: string | null
  product_name_snapshot: string
  product_sku_snapshot: string | null
  product_slug_snapshot: string | null
  product_image_snapshot: string | null
  unit_price: number
  quantity: number
  subtotal: number
  created_at: string
}

export type OrderStatusHistoryRow = {
  id: number
  tenant_id: string
  order_id: string
  order_status: OrderStatus
  payment_status: PaymentStatus
  note: string | null
  changed_by: string | null
  created_at: string
}

export type PaymentTransactionRow = Timestamps & {
  id: string
  tenant_id: string
  order_id: string
  provider: string
  provider_reference: string | null
  type: TransactionType
  status: TransactionStatus
  amount: number
  currency: string
  metadata: Json
}

export type CouponRedemptionRow = {
  id: string
  tenant_id: string
  coupon_id: string
  order_id: string
  customer_email: string
  customer_id: string | null
  discount_amount: number
  created_at: string
}

export type WishlistItemRow = {
  user_id: string
  tenant_id: string
  product_id: string
  created_at: string
}

export type RateLimitRow = { key: string; window_start: string; hits: number }

// Generated columns can never be written.
type ProductWritable = Omit<ProductRow, "price" | "is_on_sale" | "search_vector" | "rating" | "review_count" | "sales_count">

export type SearchProductsRow = {
  id: string
  name: string
  slug: string
  sku: string | null
  short_description: string | null
  original_price: number
  sale_price: number | null
  price: number
  is_on_sale: boolean
  track_inventory: boolean
  stock_quantity: number
  rating: number
  review_count: number
  is_featured: boolean
  created_at: string
  brand_id: string | null
  brand_name: string | null
  brand_slug: string | null
  category_id: string | null
  image_url: string | null
  image_alt: string | null
  total_count: number
}

type Rel<FK extends string, Cols extends string[], Ref extends string, RefCols extends string[]> = {
  foreignKeyName: FK
  columns: Cols
  isOneToOne: false
  referencedRelation: Ref
  referencedColumns: RefCols
}

export type Database = {
  public: {
    Tables: {
      tenants: {
        Row: TenantRow
        Insert: Insertable<TenantRow, "name" | "slug" | "subdomain">
        Update: Partial<TenantRow>
        Relationships: []
      }
      profiles: {
        Row: ProfileRow
        Insert: Insertable<ProfileRow, "id">
        Update: Partial<ProfileRow>
        Relationships: []
      }
      tenant_members: {
        Row: TenantMemberRow
        Insert: Insertable<TenantMemberRow, "tenant_id" | "user_id" | "role">
        Update: Partial<TenantMemberRow>
        Relationships: [Rel<"tenant_members_tenant_id_fkey", ["tenant_id"], "tenants", ["id"]>]
      }
      categories: {
        Row: CategoryRow
        Insert: Insertable<CategoryRow, "tenant_id" | "name" | "slug">
        Update: Partial<CategoryRow>
        Relationships: [Rel<"categories_parent_fk", ["tenant_id", "parent_id"], "categories", ["tenant_id", "id"]>]
      }
      brands: {
        Row: BrandRow
        Insert: Insertable<BrandRow, "tenant_id" | "name" | "slug">
        Update: Partial<BrandRow>
        Relationships: []
      }
      products: {
        Row: ProductRow
        Insert: Insertable<ProductWritable, "tenant_id" | "name" | "slug" | "original_price">
        Update: Partial<ProductWritable>
        Relationships: [
          Rel<"products_brand_fk", ["tenant_id", "brand_id"], "brands", ["tenant_id", "id"]>,
          Rel<"products_category_fk", ["tenant_id", "category_id"], "categories", ["tenant_id", "id"]>,
        ]
      }
      product_costs: {
        Row: ProductCostRow
        Insert: Insertable<ProductCostRow, "product_id" | "tenant_id" | "cost_price">
        Update: Partial<ProductCostRow>
        Relationships: [Rel<"product_costs_product_fk", ["tenant_id", "product_id"], "products", ["tenant_id", "id"]>]
      }
      product_images: {
        Row: ProductImageRow
        Insert: Insertable<ProductImageRow, "tenant_id" | "product_id" | "image_url">
        Update: Partial<ProductImageRow>
        Relationships: [Rel<"product_images_product_fk", ["tenant_id", "product_id"], "products", ["tenant_id", "id"]>]
      }
      reviews: {
        Row: ReviewRow
        Insert: Insertable<ReviewRow, "tenant_id" | "product_id" | "customer_name" | "rating">
        Update: Partial<ReviewRow>
        Relationships: [Rel<"reviews_product_fk", ["tenant_id", "product_id"], "products", ["tenant_id", "id"]>]
      }
      inventory_movements: {
        Row: InventoryMovementRow
        Insert: never
        Update: never
        Relationships: [Rel<"inventory_movements_product_fk", ["tenant_id", "product_id"], "products", ["tenant_id", "id"]>]
      }
      store_settings: {
        Row: StoreSettingsRow
        Insert: Insertable<StoreSettingsRow, "tenant_id">
        Update: Partial<StoreSettingsRow>
        Relationships: []
      }
      banners: {
        Row: BannerRow
        Insert: Insertable<BannerRow, "tenant_id" | "heading" | "desktop_image_url">
        Update: Partial<BannerRow>
        Relationships: []
      }
      store_pages: {
        Row: StorePageRow
        Insert: Insertable<StorePageRow, "tenant_id" | "slug" | "title">
        Update: Partial<StorePageRow>
        Relationships: []
      }
      navigation_items: {
        Row: NavigationItemRow
        Insert: Insertable<NavigationItemRow, "tenant_id" | "location" | "label" | "href">
        Update: Partial<NavigationItemRow>
        Relationships: []
      }
      coupons: {
        Row: CouponRow
        Insert: Insertable<CouponRow, "tenant_id" | "code" | "discount_type" | "discount_value">
        Update: Partial<CouponRow>
        Relationships: []
      }
      orders: {
        Row: OrderRow
        Insert: never
        Update: Partial<
          Pick<
            OrderRow,
            | "order_status"
            | "payment_status"
            | "courier_name"
            | "tracking_number"
            | "tracking_url"
            | "internal_notes"
            | "customer_name"
            | "customer_email"
            | "customer_phone"
            | "shipping_address"
            | "city"
            | "postal_code"
          >
        >
        Relationships: []
      }
      order_items: {
        Row: OrderItemRow
        Insert: never
        Update: never
        Relationships: [Rel<"order_items_order_fk", ["tenant_id", "order_id"], "orders", ["tenant_id", "id"]>]
      }
      order_status_history: {
        Row: OrderStatusHistoryRow
        Insert: never
        Update: never
        Relationships: [Rel<"order_status_history_order_fk", ["tenant_id", "order_id"], "orders", ["tenant_id", "id"]>]
      }
      payment_transactions: {
        Row: PaymentTransactionRow
        Insert: never
        Update: Partial<Pick<PaymentTransactionRow, "provider" | "provider_reference" | "metadata">>
        Relationships: []
      }
      coupon_redemptions: {
        Row: CouponRedemptionRow
        Insert: never
        Update: never
        Relationships: []
      }
      wishlist_items: {
        Row: WishlistItemRow
        Insert: Insertable<WishlistItemRow, "user_id" | "tenant_id" | "product_id">
        Update: never
        Relationships: [Rel<"wishlist_items_product_fk", ["tenant_id", "product_id"], "products", ["tenant_id", "id"]>]
      }
      rate_limits: {
        Row: RateLimitRow
        Insert: never
        Update: never
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      quote_order: {
        Args: { p_tenant_id: string; p_items: Json; p_coupon_code?: string | null; p_customer_email?: string | null }
        Returns: Json
      }
      place_order: {
        Args: {
          p_tenant_id: string
          p_items: Json
          p_customer: Json
          p_payment_method: PaymentMethod
          p_shipping_fee: number
          p_expected_subtotal: number | null
          p_idempotency_key: string
          p_coupon_code?: string | null
          p_customer_id?: string | null
        }
        Returns: Json
      }
      cancel_order: { Args: { p_order_id: string; p_note?: string | null }; Returns: Json }
      return_order: { Args: { p_order_id: string; p_restock?: boolean; p_note?: string | null }; Returns: Json }
      record_payment: {
        Args: {
          p_tenant_id: string
          p_order_id: string
          p_provider: string
          p_provider_reference: string
          p_status: TransactionStatus
          p_amount: number
          p_currency: string
          p_metadata?: Json
        }
        Returns: Json
      }
      consume_rate_limit: { Args: { p_key: string; p_limit: number; p_window_seconds: number }; Returns: boolean }
      search_products: {
        Args: {
          p_tenant_id: string
          p_query?: string | null
          p_category_ids?: string[] | null
          p_brand_ids?: string[] | null
          p_min_price?: number | null
          p_max_price?: number | null
          p_min_rating?: number | null
          p_in_stock?: boolean
          p_on_sale?: boolean
          p_featured?: boolean
          p_sort?: string
          p_limit?: number
          p_offset?: number
        }
        Returns: SearchProductsRow[]
      }
      get_dashboard_stats: { Args: { p_tenant_id: string; p_days?: number }; Returns: Json }
      admin_save_product: {
        Args: { p_tenant_id: string; p_product_id: string | null; p_data: Json; p_images: Json; p_cost_price?: number | null }
        Returns: Json
      }
      provision_tenant: {
        Args: { p_name: string; p_subdomain: string; p_owner_user_id: string; p_currency?: string; p_locale?: string }
        Returns: string
      }
    }
    Enums: {
      tenant_status: TenantStatus
      member_role: MemberRole
      order_status: OrderStatus
      payment_status: PaymentStatus
      payment_method: PaymentMethod
      inventory_reason: InventoryReason
      discount_type: DiscountType
      transaction_type: TransactionType
      transaction_status: TransactionStatus
      nav_location: NavLocation
    }
    CompositeTypes: { [_ in never]: never }
  }
}
