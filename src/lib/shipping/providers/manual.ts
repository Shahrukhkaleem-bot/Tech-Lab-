import { AppError } from "@/lib/errors/app-error"
import { shippingFee } from "@/lib/utils/pricing"

import type { ShippingProvider } from "../types"

/**
 * Manual shipping: rates from the tenant's shipping_config (flat / per-city / free
 * threshold); staff enter the courier + tracking number after booking with the
 * courier themselves. Tracking reflects the order status the store maintains.
 */
export const manualShippingProvider: ShippingProvider = {
  id: "manual",

  async calculateRate({ orderValue, city, currency, config }) {
    const amount = shippingFee(
      { flatRate: config.flat_rate, freeShippingThreshold: config.free_shipping_threshold, cityRates: config.city_rates },
      orderValue,
      city,
    )
    return {
      amount,
      currency,
      label: amount === 0 ? "Free delivery" : "Standard delivery",
      estimatedDays: config.estimated_days ?? null,
      isFree: amount === 0,
    }
  },

  async createShipment(input) {
    if (!input.manual?.courierName || !input.manual.trackingNumber) {
      throw new AppError("VALIDATION", "Courier name and tracking number are required.")
    }
    return {
      provider: "manual",
      courierName: input.manual.courierName,
      trackingNumber: input.manual.trackingNumber,
      trackingUrl: input.manual.trackingUrl,
      labelUrl: null,
    }
  },

  async trackShipment({ trackingNumber, courierName, trackingUrl, orderStatus }) {
    return { status: orderStatus, courierName, trackingNumber, trackingUrl, events: [] }
  },
}
