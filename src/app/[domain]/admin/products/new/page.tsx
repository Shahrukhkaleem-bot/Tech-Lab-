import { AdminPageHeader } from "@/components/admin/page-header"
import { ProductForm } from "@/components/admin/products/product-form"
import { getCatalogOptions, toCategoryOptions } from "@/features/admin/products/queries"
import { requireAdminPage } from "@/features/auth/session"
import { getTenantFromParams } from "@/features/tenants/current"

export const metadata = { title: "New product" }

export default async function NewProductPage({ params }: PageProps<"/[domain]/admin/products/new">) {
  const tenant = await getTenantFromParams(params)
  const ctx = await requireAdminPage(tenant, "manager", "/admin/products/new")
  const { categories, brands } = await getCatalogOptions(ctx)
  return (
    <>
      <AdminPageHeader title="New product" />
      <ProductForm productId={null} categories={toCategoryOptions(categories)} brands={brands} currency={tenant.currency} />
    </>
  )
}
