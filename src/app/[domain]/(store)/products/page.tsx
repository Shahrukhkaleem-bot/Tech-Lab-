import type { Metadata } from "next"

import { ProductListing } from "@/components/products/listing/product-listing"
import { Breadcrumbs } from "@/components/navigation/breadcrumbs"
import { parseProductFilters } from "@/features/catalog/filters"
import { getBrands, getCategoryTree, listProducts } from "@/features/catalog/queries"
import { getTenantFromParams } from "@/features/tenants/current"

export async function generateMetadata({ params, searchParams }: PageProps<"/[domain]/products">): Promise<Metadata> {
  const tenant = await getTenantFromParams(params)
  const filters = parseProductFilters(await searchParams)
  const title = filters.q ? `Search results for “${filters.q}”` : filters.onSale ? "On Sale" : "All Products"
  return {
    title,
    description: `Browse ${filters.onSale ? "discounted " : ""}products at ${tenant.name}.`,
    alternates: { canonical: "/products" },
    // Filtered/search permutations are crawlable but not indexed (avoid thin duplicates).
    robots: filters.q || filters.page > 1 ? { index: false, follow: true } : undefined,
  }
}

export default async function ProductsPage({ params, searchParams }: PageProps<"/[domain]/products">) {
  const tenant = await getTenantFromParams(params)
  const filters = parseProductFilters(await searchParams)
  const [page, tree, brands] = await Promise.all([listProducts(tenant.id, filters), getCategoryTree(tenant.id), getBrands(tenant.id)])

  const title = filters.q ? `Results for “${filters.q}”` : filters.onSale ? "On Sale" : "All Products"
  return (
    <ProductListing
      tenant={tenant}
      title={title}
      basePath="/products"
      filters={filters}
      locked={{}}
      page={page}
      tree={tree}
      brands={brands.map((b) => ({ slug: b.slug, name: b.name }))}
      breadcrumbs={<Breadcrumbs items={[{ name: "Products" }]} />}
    />
  )
}
