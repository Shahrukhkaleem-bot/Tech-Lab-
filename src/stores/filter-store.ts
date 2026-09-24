import { create } from "zustand"

import type { ProductFilters } from "@/features/catalog/types"

/**
 * Draft filters for the mobile filter sheet. The URL remains the source of truth:
 * the sheet edits a draft here and only writes the URL on "Apply", so the listing
 * doesn't refetch on every tap.
 */
type FilterDraftStore = {
  draft: ProductFilters | null
  begin: (current: ProductFilters) => void
  update: (patch: Partial<ProductFilters>) => void
  reset: () => void
}

export const useFilterDraftStore = create<FilterDraftStore>()((set, get) => ({
  draft: null,
  begin: (current) => set({ draft: { ...current, brandSlugs: [...current.brandSlugs] } }),
  update: (patch) => {
    const draft = get().draft
    if (draft) set({ draft: { ...draft, ...patch, page: 1 } })
  },
  reset: () => set({ draft: null }),
}))
