import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { JsonLd } from "@/components/common/json-ld"
import { Breadcrumbs } from "@/components/navigation/breadcrumbs"
import { ProductListing } from "@/components/products/listing/product-listing"
import { ancestry, resolveCategoryPath } from "@/features/catalog/category-tree"
import { parseProductFilters } from "@/features/catalog/filters"
import { getBrands, getCategoryTree, listProducts } from "@/features/catalog/queries"
import { breadcrumbJsonLd } from "@/features/seo/structured-data"
import { getTenantFromParams, tenantOrigin } from "@/features/tenants/current"

// Reads URL search params (filters/search/sort): render per request. Data stays cached underneath.
export const dynamic = "force-dynamic"

type Props = PageProps<"/[domain]/categories/[...path]">

async function resolve(props: Props) {
  const tenant = await getTenantFromParams(props.params)
  const { path } = await props.params
  const tree = await getCategoryTree(tenant.id)
  const category = resolveCategoryPath(tree, path)
  if (!category) notFound()
  return { tenant, tree, category, path }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { tenant, category, path } = await resolve(props)
  return {
    title: category.seoTitle ?? category.name,
    description: category.seoDescription ?? category.description ?? `Shop ${category.name} at ${tenant.name}.`,
    alternates: { canonical: `/categories/${path.join("/")}` },
    openGraph: { title: category.name, images: category.imageUrl ? [{ url: category.imageUrl }] : undefined },
  }
}

export default async function CategoryPage(props: Props) {
  const { tenant, tree, category, path } = await resolve(props)
  const basePath = `/categories/${path.join("/")}`
  const filters = parseProductFilters(await props.searchParams, { categorySlug: category.slug })
  filters.categorySlug = category.slug // the route decides the category, never the query string

  const [page, brands] = await Promise.all([listProducts(tenant.id, filters), getBrands(tenant.id)])
  const chain = ancestry(tree, category.id)
  const crumbs = chain.map((c, i) => ({
    name: c.name,
    href: `/categories/${chain
      .slice(0, i + 1)
      .map((x) => x.slug)
      .join("/")}`,
  }))

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(tenantOrigin(tenant), [{ name: "Home", path: "/" }, ...crumbs.map((c) => ({ name: c.name, path: c.href }))])} />
      <ProductListing
        tenant={tenant}
        title={category.name}
        description={category.description}
        basePath={basePath}
        filters={filters}
        locked={{ categorySlug: category.slug }}
        page={page}
        tree={tree}
        brands={brands.map((b) => ({ slug: b.slug, name: b.name }))}
        subcategories={category.children}
        breadcrumbs={<Breadcrumbs items={crumbs} />}
      />
    </>
  )
}
