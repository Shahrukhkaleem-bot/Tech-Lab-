import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { Breadcrumbs } from "@/components/navigation/breadcrumbs"
import { ProductListing } from "@/components/products/listing/product-listing"
import { parseProductFilters } from "@/features/catalog/filters"
import { getBrandBySlug, getBrands, getCategoryTree, listProducts } from "@/features/catalog/queries"
import { getTenantFromParams } from "@/features/tenants/current"

type Props = PageProps<"/[domain]/brands/[slug]">

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tenant = await getTenantFromParams(params)
  const { slug } = await params
  const brand = await getBrandBySlug(tenant.id, slug)
  if (!brand) return {}
  return {
    title: brand.name,
    description: brand.description ?? `Shop ${brand.name} products at ${tenant.name}.`,
    alternates: { canonical: `/brands/${brand.slug}` },
  }
}

export default async function BrandPage({ params, searchParams }: Props) {
  const tenant = await getTenantFromParams(params)
  const { slug } = await params
  const brand = await getBrandBySlug(tenant.id, slug)
  if (!brand) notFound()

  const filters = parseProductFilters(await searchParams)
  filters.brandSlugs = [brand.slug]
  const [page, tree, brands] = await Promise.all([listProducts(tenant.id, filters), getCategoryTree(tenant.id), getBrands(tenant.id)])

  return (
    <ProductListing
      tenant={tenant}
      title={brand.name}
      description={brand.description}
      basePath={`/brands/${brand.slug}`}
      filters={filters}
      locked={{ brandSlugs: [brand.slug] }}
      page={page}
      tree={tree}
      brands={brands.map((b) => ({ slug: b.slug, name: b.name }))}
      breadcrumbs={<Breadcrumbs items={[{ name: "Brands", href: "/brands" }, { name: brand.name }]} />}
    />
  )
}
