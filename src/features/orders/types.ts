import type { OrderStatus, PaymentMethod, PaymentStatus } from "@/types/database"

export type OrderItemView = {
  id: string
  productId: string | null
  name: string
  sku: string | null
  slug: string | null
  imageUrl: string | null
  unitPrice: number
  quantity: number
  subtotal: number
}

export type OrderView = {
  id: string
  orderNumber: number
  createdAt: string
  customerName: string
  customerEmail: string
  customerPhone: string
  shippingAddress: string
  city: string
  postalCode: string | null
  notes: string | null
  subtotal: number
  shippingFee: number
  discountAmount: number
  total: number
  currency: string
  couponCode: string | null
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  orderStatus: OrderStatus
  courierName: string | null
  trackingNumber: string | null
  trackingUrl: string | null
  shippedAt: string | null
  deliveredAt: string | null
  items: OrderItemView[]
}

export type OrderSummaryView = Pick<
  OrderView,
  "id" | "orderNumber" | "createdAt" | "customerName" | "total" | "currency" | "paymentMethod" | "paymentStatus" | "orderStatus"
> & { itemCount: number; customerEmail: string; customerPhone: string; city: string }
