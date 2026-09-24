import type { PaymentProvider } from "../types"

/**
 * Cash on Delivery. No online step: the order is created with payment_status=pending
 * and staff mark it paid when the courier remits the cash.
 */
export const cashOnDeliveryProvider: PaymentProvider = {
  id: "cod",
  method: "cod",
  label: "Cash on Delivery",

  isAvailable: ({ settings }) => settings.enabledMethods.includes("cod"),

  async createPayment() {
    return {
      kind: "offline",
      instructions: {
        title: "Pay on delivery",
        body: "Please keep the exact amount ready. You'll pay the courier in cash when your order arrives.",
      },
    }
  },

  async verifyPayment(providerReference) {
    // Offline method: verification is a manual admin action (mark as paid).
    return { status: "pending", provider: "cod", providerReference, tenantId: null, orderId: null, amount: 0, currency: "" }
  },

  async refundPayment() {
    return { status: "manual" }
  },
}
