import { create } from "zustand"

/** Ephemeral UI state (not persisted): drawers and overlays. */
type UiStore = {
  cartOpen: boolean
  mobileNavOpen: boolean
  searchOpen: boolean
  quickViewSlug: string | null
  setCartOpen: (open: boolean) => void
  setMobileNavOpen: (open: boolean) => void
  setSearchOpen: (open: boolean) => void
  openQuickView: (slug: string | null) => void
}

export const useUiStore = create<UiStore>()((set) => ({
  cartOpen: false,
  mobileNavOpen: false,
  searchOpen: false,
  quickViewSlug: null,
  setCartOpen: (cartOpen) => set({ cartOpen }),
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  openQuickView: (quickViewSlug) => set({ quickViewSlug }),
}))
