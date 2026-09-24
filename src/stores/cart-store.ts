import { z } from "zod"
import { createJSONStorage, persist } from "zustand/middleware"
import { createStore } from "zustand/vanilla"

import { itemCount, subtotal } from "@/lib/utils/pricing"

/**
 * Client cart. Prices/stock stored here are DISPLAY SNAPSHOTS ONLY — the server
 * re-prices and re-checks stock (refreshCartAction, quote_order, place_order).
 * One persisted cart per tenant (key includes tenant id).
 */

export const MAX_LINE_QUANTITY = 99

const cartItemSchema = z.object({
  productId: z.uuid(),
  slug: z.string().max(200),
  name: z.string().max(200),
  imageUrl: z.string().max(2048).nullable(),
  unitPrice: z.number().nonnegative(),
  originalPrice: z.number().nonnegative(),
  quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
  /** null = stock not tracked */
  maxQuantity: z.number().int().min(0).nullable(),
})

export type CartItem = z.infer<typeof cartItemSchema>

export type CartState = {
  items: CartItem[]
  hydrated: boolean
}

export type CartActions = {
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => { added: number; limited: boolean }
  remove: (productId: string) => void
  increment: (productId: string) => void
  decrement: (productId: string) => void
  setQuantity: (productId: string, quantity: number) => void
  clear: () => void
  /** Apply authoritative server data (current price, stock, availability). */
  applyServerRefresh: (updates: { productId: string; unitPrice: number; originalPrice: number; maxQuantity: number | null; available: boolean }[]) => void
}

export type CartStore = CartState & CartActions

function clampQuantity(quantity: number, maxQuantity: number | null): number {
  const cap = Math.min(MAX_LINE_QUANTITY, maxQuantity ?? MAX_LINE_QUANTITY)
  return Math.max(0, Math.min(Math.floor(quantity), cap))
}

export function createCartStore(tenantId: string) {
  return createStore<CartStore>()(
    persist(
      (set, get) => ({
        items: [],
        hydrated: false,

        add(item, quantity = 1) {
          const existing = get().items.find((i) => i.productId === item.productId)
          const desired = (existing?.quantity ?? 0) + quantity
          const next = clampQuantity(desired, item.maxQuantity)
          const added = next - (existing?.quantity ?? 0)
          if (next <= 0) return { added: 0, limited: true }
          set({
            items: existing
              ? get().items.map((i) => (i.productId === item.productId ? { ...i, ...item, quantity: next } : i))
              : [...get().items, { ...item, quantity: next }],
          })
          return { added, limited: next < desired }
        },

        remove(productId) {
          set({ items: get().items.filter((i) => i.productId !== productId) })
        },

        increment(productId) {
          const item = get().items.find((i) => i.productId === productId)
          if (item) get().setQuantity(productId, item.quantity + 1)
        },

        decrement(productId) {
          const item = get().items.find((i) => i.productId === productId)
          if (item) get().setQuantity(productId, item.quantity - 1)
        },

        setQuantity(productId, quantity) {
          set({
            items: get()
              .items.map((i) => (i.productId === productId ? { ...i, quantity: clampQuantity(quantity, i.maxQuantity) } : i))
              .filter((i) => i.quantity > 0),
          })
        },

        clear() {
          set({ items: [] })
        },

        applyServerRefresh(updates) {
          const byId = new Map(updates.map((u) => [u.productId, u]))
          set({
            items: get()
              .items.flatMap((i) => {
                const u = byId.get(i.productId)
                if (!u || !u.available) return []
                const quantity = clampQuantity(i.quantity, u.maxQuantity)
                return quantity > 0
                  ? [{ ...i, unitPrice: u.unitPrice, originalPrice: u.originalPrice, maxQuantity: u.maxQuantity, quantity }]
                  : []
              }),
          })
        },
      }),
      {
        name: `cart:${tenantId}`,
        version: 1,
        storage: createJSONStorage(() => localStorage),
        partialize: (s) => ({ items: s.items }),
        // Never trust persisted data blindly: drop malformed/tampered entries.
        merge: (persisted, current) => {
          const parsed = z.object({ items: z.array(cartItemSchema).max(100) }).safeParse(persisted)
          return { ...current, items: parsed.success ? parsed.data.items : [] }
        },
        // Rehydrated after mount by StoreProviders to avoid SSR/client markup mismatch.
        skipHydration: true,
      },
    ),
  )
}

export type CartStoreApi = ReturnType<typeof createCartStore>

// Selectors
export const selectItemCount = (s: CartState) => itemCount(s.items)
export const selectSubtotal = (s: CartState) => subtotal(s.items)
