import type { ShippingConfig } from "@/features/tenants/types"
import type { OrderStatus } from "@/types/database"

/**
 * Shipping provider contract. Starts with manual courier entry; courier APIs
 * (TCS, Leopards, Trax, PostEx, DHL…) implement the same interface.
 */

export type RateInput = {
  /** Order value used for free-shipping thresholds (subtotal − discount). */
  orderValue: number
  city: string | null
  currency: string
  config: ShippingConfig
}

export type ShippingRate = {
  amount: number
  currency: string
  label: string
  estimatedDays: { min: number; max: number } | null
  isFree: boolean
}

export type ShipmentInput = {
  tenantId: string
  orderId: string
  orderNumber: number
  recipient: { name: string; phone: string; address: string; city: string; postalCode: string | null }
  codAmount: number | null
  /** Manual provider: what staff typed in the admin. */
  manual?: { courierName: string; trackingNumber: string; trackingUrl: string | null }
}

export type ShipmentResult = {
  provider: string
  courierName: string
  trackingNumber: string
  trackingUrl: string | null
  labelUrl: string | null
}

export type TrackingEvent = { status: string; description: string; at: string; location: string | null }

export type TrackingResult = {
  status: OrderStatus | "unknown"
  courierName: string | null
  trackingNumber: string | null
  trackingUrl: string | null
  events: TrackingEvent[]
}

export interface ShippingProvider {
  readonly id: string
  calculateRate(input: RateInput): Promise<ShippingRate>
  createShipment(input: ShipmentInput): Promise<ShipmentResult>
  trackShipment(input: {
    trackingNumber: string | null
    courierName: string | null
    trackingUrl: string | null
    orderStatus: OrderStatus
  }): Promise<TrackingResult>
}
