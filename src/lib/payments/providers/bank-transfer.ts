import type { PaymentProvider } from "../types"

/**
 * Direct bank transfer. Shows the tenant's bank accounts; staff confirm receipt and
 * mark the order paid from the admin (manager+). Only available when at least one
 * bank account is configured.
 */
export const bankTransferProvider: PaymentProvider = {
  id: "bank_transfer",
  method: "bank_transfer",
  label: "Bank Transfer",

  isAvailable: ({ settings }) => settings.enabledMethods.includes("bank_transfer") && settings.bankAccounts.length > 0,

  async createPayment(order, { settings }) {
    return {
      kind: "offline",
      instructions: {
        title: "Complete your bank transfer",
        body:
          `Transfer ${order.currency} ${order.amount.toLocaleString("en-US")} using order #${order.orderNumber} as the reference. ` +
          (settings.instructions ?? "Your order will be processed once the payment is confirmed."),
        bankAccounts: settings.bankAccounts,
      },
    }
  },

  async verifyPayment(providerReference) {
    return { status: "pending", provider: "bank_transfer", providerReference, tenantId: null, orderId: null, amount: 0, currency: "" }
  },

  async refundPayment() {
    return { status: "manual" }
  },
}
