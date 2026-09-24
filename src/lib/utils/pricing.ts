/**
 * Client-side DISPLAY estimates only. The authoritative prices, discounts and totals
 * are computed by the database (quote_order / place_order) at checkout.
 */

export type PricedLine = { unitPrice: number; quantity: number }

/** Rounds to 2 decimals using integer minor units to avoid float drift. */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function lineTotal(line: PricedLine): number {
  return roundMoney(line.unitPrice * line.quantity)
}

export function subtotal(lines: PricedLine[]): number {
  return roundMoney(lines.reduce((sum, l) => sum + Math.round(l.unitPrice * 100) * l.quantity, 0) / 100)
}

export function itemCount(lines: { quantity: number }[]): number {
  return lines.reduce((n, l) => n + l.quantity, 0)
}

export type ShippingRules = {
  flatRate: number
  freeShippingThreshold?: number
  cityRates: { city: string; rate: number }[]
}

/**
 * Same rule the ManualShippingProvider applies on the server:
 * free above threshold → city-specific rate → flat rate.
 */
export function shippingFee(rules: ShippingRules, orderValue: number, city?: string | null): number {
  if (rules.freeShippingThreshold != null && orderValue >= rules.freeShippingThreshold) return 0
  if (city) {
    const normalized = city.trim().toLowerCase()
    const match = rules.cityRates.find((r) => r.city.trim().toLowerCase() === normalized)
    if (match) return match.rate
  }
  return rules.flatRate
}

/** Remaining amount to unlock free shipping, or null when not applicable / already free. */
export function amountToFreeShipping(rules: ShippingRules, orderValue: number): number | null {
  if (rules.freeShippingThreshold == null) return null
  const remaining = roundMoney(rules.freeShippingThreshold - orderValue)
  return remaining > 0 ? remaining : null
}
