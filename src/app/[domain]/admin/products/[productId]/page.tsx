import { ExternalLink } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"

import { AdminPageHeader } from "@/components/admin/page-header"
import { ProductForm } from "@/components/admin/products/product-form"
import { Button } from "@/components/ui/button"
import { getAdminProduct, getCatalogOptions, toCategoryOptions } from "@/features/admin/products/queries"
import { requireAdminPage } from "@/features/auth/session"
import { getTenantFromParams } from "@/features/tenants/current"

export const metadata = { title: "Edit product" }

export default async function EditProductPage({ params }: PageProps<"/[domain]/admin/products/[productId]">) {
  const tenant = await getTenantFromParams(params)
  const { productId } = await params
  if (!z.uuid().safeParse(productId).success) notFound()
  const ctx = await requireAdminPage(tenant, "manager", `/admin/products/${productId}`)
  const [product, { categories, brands }] = await Promise.all([getAdminProduct(ctx, productId), getCatalogOptions(ctx)])
  if (!product) notFound()
  const { id, ...defaults } = product

  return (
    <>
      <AdminPageHeader
        title={product.name}
        actions={
          <Button asChild variant="outline">
            <Link href={`/products/${product.slug}`} target="_blank">
              View in store <ExternalLink aria-hidden />
            </Link>
          </Button>
        }
      />
      <ProductForm productId={id} defaults={defaults} categories={toCategoryOptions(categories)} brands={brands} currency={tenant.currency} />
    </>
  )
}
