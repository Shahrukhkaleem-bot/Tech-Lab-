import type { PaymentMethod } from "@/types/database"

/**
 * Platform-level (not tenant) settings. The developer credit appears in the footer of every
 * store; set `developerCredit` to null for a client who needs a fully unbranded storefront.
 */
export type DeveloperCredit = {
  name: string
  nameUrl?: string
  company: string
  companyUrl?: string
}

export const developerCredit: DeveloperCredit | null = {
  name: "Shahrukh Kaleem",
  company: "Elevix Digital",
}

/**
 * Payment methods this platform offers at all. Anything not listed is hidden everywhere
 * (checkout, admin settings) and rejected by the payment settings save, whatever a store
 * has enabled. Add "bank_transfer", "card" or "wallet" back here to switch them on again.
 */
export const offeredPaymentMethods: readonly PaymentMethod[] = ["cod"]
