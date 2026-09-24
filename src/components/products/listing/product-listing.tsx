import { X } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/components/common/empty-state"
import { ProductGrid } from "@/components/products/product-grid"
import { Button } from "@/components/ui/button"
import type { Category, CategoryTree, ProductFilters, ProductPage } from "@/features/catalog/types"
import { filtersToSearchParams } from "@/features/catalog/filters"
import type { Tenant } from "@/features/tenants/types"
import { formatMoney } from "@/lib/utils/format"

import type { FilterOptions } from "./filter-controls"
import { DesktopFilters, ListingToolbar } from "./listing-toolbar"
import { Pagination } from "./pagination"

type ProductListingProps = {
  tenant: Tenant
  title: string
  description?: string | null
  basePath: string
  filters: ProductFilters
  locked: Partial<ProductFilters>
  page: ProductPage
  tree: CategoryTree
  brands: { slug: string; name: string }[]
  /** Sub-categories shown as quick links on category pages. */
  subcategories?: Category[]
  breadcrumbs?: React.ReactNode
}

function flattenCategories(roots: Category[], depth = 0): FilterOptions["categories"] {
  return roots.flatMap((c) => [{ slug: c.slug, name: c.name, depth }, ...flattenCategories(c.children, depth + 1)])
}

/** Shared listing layout for /products, /categories/…, /brands/[slug]. */
export function ProductListing({ tenant, title, description, basePath, filters, locked, page, tree, brands, subcategories, breadcrumbs }: ProductListingProps) {
  const options: FilterOptions = {
    categories: flattenCategories(tree.roots),
    brands,
    lockCategory: Boolean(locked.categorySlug),
    lockBrand: Boolean(locked.brandSlugs?.length),
  }

  const urlFor = (patch: Partial<ProductFilters>) => {
    const next = { ...filters, ...patch }
    const sp = filtersToSearchParams({
      ...next,
      categorySlug: locked.categorySlug ? undefined : next.categorySlug,
      brandSlugs: locked.brandSlugs?.length ? [] : next.brandSlugs,
    })
    const qs = sp.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }

  const chips: { label: string; href: string }[] = []
  if (filters.q) chips.push({ label: `“${filters.q}”`, href: urlFor({ q: undefined, page: 1 }) })
  if (!locked.categorySlug && filters.categorySlug)
    chips.push({ label: tree.bySlug[filters.categorySlug]?.name ?? filters.categorySlug, href: urlFor({ categorySlug: undefined, page: 1 }) })
  if (!locked.brandSlugs?.length)
    for (const slug of filters.brandSlugs)
      chips.push({ label: brands.find((b) => b.slug === slug)?.name ?? slug, href: urlFor({ brandSlugs: filters.brandSlugs.filter((s) => s !== slug), page: 1 }) })
  if (filters.minPrice != null || filters.maxPrice != null) {
    const fmt = (n: number) => formatMoney(n, tenant.currency, tenant.locale)
    const label = filters.minPrice != null && filters.maxPrice != null ? `${fmt(filters.minPrice)} – ${fmt(filters.maxPrice)}` : filters.minPrice != null ? `From ${fmt(filters.minPrice)}` : `Up to ${fmt(filters.maxPrice!)}`
    chips.push({ label, href: urlFor({ minPrice: undefined, maxPrice: undefined, page: 1 }) })
  }
  if (filters.minRating) chips.push({ label: `${filters.minRating}★ & up`, href: urlFor({ minRating: undefined, page: 1 }) })
  if (filters.inStock) chips.push({ label: "In stock", href: urlFor({ inStock: false, page: 1 }) })
  if (filters.onSale && !locked.onSale) chips.push({ label: "On sale", href: urlFor({ onSale: false, page: 1 }) })

  return (
    <div className="container-page py-6 sm:py-8">
      {breadcrumbs}
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
        {subcategories?.length ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {subcategories.map((c) => (
              <li key={c.id}>
                <Link href={`${basePath}/${c.slug}`} className="inline-flex h-9 items-center rounded-full border px-4 text-sm hover:border-primary hover:text-primary">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <DesktopFilters filters={filters} options={options} locked={locked} />

        <div className="min-w-0">
          <ListingToolbar filters={filters} options={options} locked={locked} total={page.total} />

          {chips.length ? (
            <ul className="mb-5 flex flex-wrap items-center gap-2" aria-label="Active filters">
              {chips.map((c) => (
                <li key={c.label}>
                  <Link href={c.href} className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-medium hover:bg-accent/70" aria-label={`Remove filter ${c.label}`}>
                    {c.label}
                    <X className="size-3" aria-hidden />
                  </Link>
                </li>
              ))}
              <li>
                <Link href={basePath} className="text-xs font-medium text-primary hover:underline">
                  Clear all
                </Link>
              </li>
            </ul>
          ) : null}

          {page.items.length ? (
            <>
              <ProductGrid products={page.items} currency={tenant.currency} locale={tenant.locale} priorityCount={4} className="xl:grid-cols-3 2xl:grid-cols-4" />
              <Pagination page={page.page} pageCount={page.pageCount} hrefFor={(p) => urlFor({ page: p })} />
            </>
          ) : (
            <EmptyState
              title="No products found"
              description={filters.q ? `We couldn't find anything for “${filters.q}”. Try a different search or fewer filters.` : "Try removing some filters to see more products."}
              action={
                <Button asChild variant="outline">
                  <Link href={basePath}>Clear filters</Link>
                </Button>
              }
            />
          )}
        </div>
      </div>
    </div>
  )
}
