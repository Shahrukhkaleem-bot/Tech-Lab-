import { manualShippingProvider } from "./providers/manual"
import type { ShippingProvider } from "./types"

/**
 * Courier integrations register here. A courier API provider typically:
 *  - calculateRate: calls the courier's tariff API (fallback to manual rules on error)
 *  - createShipment: books the parcel, returns tracking number + label PDF URL
 *  - trackShipment: polls the courier API (or is fed by courier webhooks)
 * The provider id is stored on orders.shipping_provider.
 */
const PROVIDERS: Record<string, ShippingProvider> = {
  manual: manualShippingProvider,
}

export function getShippingProvider(id = "manual"): ShippingProvider {
  return PROVIDERS[id] ?? manualShippingProvider
}
