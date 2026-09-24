"use client"

import { SlidersHorizontal } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { countActiveFilters, filtersToSearchParams } from "@/features/catalog/filters"
import { PRODUCT_SORTS, SORT_LABELS, type ProductFilters, type ProductSort } from "@/features/catalog/types"
import { cn } from "@/lib/utils"
import { useFilterDraftStore } from "@/stores/filter-store"

import { FilterControls, type FilterOptions } from "./filter-controls"

/** Pushes filter changes to the URL (the source of truth). Resets to page 1. */
function useApplyFilters(locked: Partial<ProductFilters>) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()
  const apply = (next: ProductFilters) => {
    // Facets implied by the route (e.g. /brands/acme) are not repeated in the query.
    const sp = filtersToSearchParams({
      ...next,
      categorySlug: locked.categorySlug ? undefined : next.categorySlug,
      brandSlugs: locked.brandSlugs?.length ? [] : next.brandSlugs,
      page: 1,
    })
    const qs = sp.toString()
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
  }
  return { apply, pending }
}

type ToolbarProps = {
  filters: ProductFilters
  options: FilterOptions
  locked: Partial<ProductFilters>
  total: number
}

export function DesktopFilters({ filters, options, locked }: Omit<ToolbarProps, "total">) {
  const { apply, pending } = useApplyFilters(locked)
  return (
    <aside aria-label="Filters" className={cn("hidden lg:block", pending && "pointer-events-none opacity-60")}>
      <FilterControls idPrefix="desktop" value={filters} options={options} onChange={(patch) => apply({ ...filters, ...patch })} />
    </aside>
  )
}

export function ListingToolbar({ filters, options, locked, total }: ToolbarProps) {
  const { apply, pending } = useApplyFilters(locked)
  const { draft, begin, update, reset } = useFilterDraftStore()
  const active = countActiveFilters({ ...filters, categorySlug: locked.categorySlug ? undefined : filters.categorySlug })
  const sortOptions = PRODUCT_SORTS.filter((s) => s !== "relevance" || filters.q)

  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {pending ? "Updating…" : `${total.toLocaleString()} ${total === 1 ? "product" : "products"}`}
      </p>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="lg:hidden" onClick={() => begin(filters)}>
          <SlidersHorizontal aria-hidden />
          Filters{active ? ` (${active})` : ""}
        </Button>

        <Select value={filters.sort} onValueChange={(v) => apply({ ...filters, sort: v as ProductSort })}>
          <SelectTrigger size="sm" className="w-44" aria-label="Sort products">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {sortOptions.map((s) => (
              <SelectItem key={s} value={s}>
                {SORT_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Sheet open={draft !== null} onOpenChange={(open) => !open && reset()}>
        <SheetContent side="left" className="w-[88vw] max-w-sm gap-0 p-0">
          <SheetHeader className="border-b">
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription className="sr-only">Refine the product list</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4">
            {draft ? <FilterControls idPrefix="mobile" value={draft} options={options} onChange={update} /> : null}
          </div>
          <SheetFooter className="flex-row gap-2 border-t p-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() =>
                update({ categorySlug: locked.categorySlug, brandSlugs: locked.brandSlugs ?? [], minPrice: undefined, maxPrice: undefined, minRating: undefined, inStock: false, onSale: false })
              }
            >
              Clear
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                if (draft) apply(draft)
                reset()
              }}
            >
              Show results
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
