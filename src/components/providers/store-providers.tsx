"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { useStore } from "zustand"

import { createCartStore, type CartStore, type CartStoreApi } from "@/stores/cart-store"
import { createWishlistStore, type WishlistStore, type WishlistStoreApi } from "@/stores/wishlist-store"

/**
 * Per-tenant Zustand stores, created once per browser session and provided via
 * context (the Next.js-recommended pattern: no module-level singletons shared
 * across requests on the server).
 */
const CartContext = createContext<CartStoreApi | null>(null)
const WishlistContext = createContext<WishlistStoreApi | null>(null)

export function StoreProviders({ tenantId, children }: { tenantId: string; children: ReactNode }) {
  const [cart] = useState(() => createCartStore(tenantId))
  const [wishlist] = useState(() => createWishlistStore(tenantId))

  useEffect(() => {
    const hydrate = async () => {
      await Promise.all([cart.persist.rehydrate(), wishlist.persist.rehydrate()])
      cart.setState({ hydrated: true })
    }
    void hydrate()
    // Keep carts in sync across open tabs of the same store.
    const onStorage = (e: StorageEvent) => {
      if (e.key === cart.persist.getOptions().name) void cart.persist.rehydrate()
      if (e.key === wishlist.persist.getOptions().name) void wishlist.persist.rehydrate()
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [cart, wishlist])

  return (
    <CartContext.Provider value={cart}>
      <WishlistContext.Provider value={wishlist}>{children}</WishlistContext.Provider>
    </CartContext.Provider>
  )
}

export function useCart<T>(selector: (state: CartStore) => T): T {
  const store = useContext(CartContext)
  if (!store) throw new Error("useCart must be used inside <StoreProviders>")
  return useStore(store, selector)
}

export function useWishlist<T>(selector: (state: WishlistStore) => T): T {
  const store = useContext(WishlistContext)
  if (!store) throw new Error("useWishlist must be used inside <StoreProviders>")
  return useStore(store, selector)
}
