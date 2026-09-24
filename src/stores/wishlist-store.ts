import { z } from "zod"
import { createJSONStorage, persist } from "zustand/middleware"
import { createStore } from "zustand/vanilla"

/**
 * Wishlist: local-first for everyone (guests included), per tenant.
 * Signed-in users are additionally synced to `wishlist_items` (see WishlistSync).
 */

const wishlistItemSchema = z.object({
  productId: z.uuid(),
  slug: z.string().max(200),
  name: z.string().max(200),
  imageUrl: z.string().max(2048).nullable(),
  price: z.number().nonnegative(),
  originalPrice: z.number().nonnegative(),
})

export type WishlistItem = z.infer<typeof wishlistItemSchema>

export type WishlistStore = {
  items: WishlistItem[]
  has: (productId: string) => boolean
  toggle: (item: WishlistItem) => boolean
  remove: (productId: string) => void
  replaceAll: (items: WishlistItem[]) => void
}

export function createWishlistStore(tenantId: string) {
  return createStore<WishlistStore>()(
    persist(
      (set, get) => ({
        items: [],
        has: (productId) => get().items.some((i) => i.productId === productId),
        toggle(item) {
          const exists = get().has(item.productId)
          set({ items: exists ? get().items.filter((i) => i.productId !== item.productId) : [item, ...get().items].slice(0, 200) })
          return !exists
        },
        remove(productId) {
          set({ items: get().items.filter((i) => i.productId !== productId) })
        },
        replaceAll(items) {
          set({ items })
        },
      }),
      {
        name: `wishlist:${tenantId}`,
        version: 1,
        storage: createJSONStorage(() => localStorage),
        partialize: (s) => ({ items: s.items }),
        merge: (persisted, current) => {
          const parsed = z.object({ items: z.array(wishlistItemSchema).max(200) }).safeParse(persisted)
          return { ...current, items: parsed.success ? parsed.data.items : [] }
        },
        skipHydration: true,
      },
    ),
  )
}

export type WishlistStoreApi = ReturnType<typeof createWishlistStore>
