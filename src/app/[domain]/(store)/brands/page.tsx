import type { Metadata } from "next"

import { EmptyState } from "@/components/common/empty-state"
import { BrandGrid } from "@/components/home/brand-grid"
import { Breadcrumbs } from "@/components/navigation/breadcrumbs"
import { getBrands } from "@/features/catalog/queries"
import { getTenantFromParams } from "@/features/tenants/current"

export async function generateMetadata({ params }: PageProps<"/[domain]/brands">): Promise<Metadata> {
  const tenant = await getTenantFromParams(params)
  return { title: "Brands", description: `All brands available at ${tenant.name}.`, alternates: { canonical: "/brands" } }
}

export default async function BrandsPage({ params }: PageProps<"/[domain]/brands">) {
  const tenant = await getTenantFromParams(params)
  const brands = await getBrands(tenant.id)
  return (
    <div className="container-page py-6 sm:py-8">
      <Breadcrumbs items={[{ name: "Brands" }]} />
      <h1 className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">Brands</h1>
      {brands.length ? <BrandGrid brands={brands} showHeader={false} /> : <EmptyState title="No brands yet" description="Check back soon." />}
    </div>
  )
}
