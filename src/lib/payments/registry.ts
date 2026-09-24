import "server-only"

import type { PaymentSettings } from "@/features/tenants/types"
import type { PaymentMethod } from "@/types/database"

import { bankTransferProvider } from "./providers/bank-transfer"
import { cashOnDeliveryProvider } from "./providers/cash-on-delivery"
import { localGatewayProvider } from "./providers/local-gateway"
import { stripeProvider } from "./providers/stripe"
import type { PaymentProvider } from "./types"

/** One provider per payment method. Swap e.g. card → local gateway here. */
const PROVIDERS: Record<PaymentMethod, PaymentProvider> = {
  cod: cashOnDeliveryProvider,
  bank_transfer: bankTransferProvider,
  card: stripeProvider,
  wallet: localGatewayProvider,
}

export function getPaymentProvider(method: PaymentMethod): PaymentProvider {
  return PROVIDERS[method]
}

export function getProviderById(id: string): PaymentProvider | undefined {
  return Object.values(PROVIDERS).find((p) => p.id === id)
}

export type AvailablePaymentMethod = { method: PaymentMethod; label: string }

/** Methods shown at checkout: enabled by the tenant AND usable on this deployment. */
export function availablePaymentMethods(settings: PaymentSettings): AvailablePaymentMethod[] {
  return settings.enabledMethods
    .map((m) => PROVIDERS[m])
    .filter((p) => p.isAvailable({ settings }))
    .map((p) => ({ method: p.method, label: p.label }))
}
