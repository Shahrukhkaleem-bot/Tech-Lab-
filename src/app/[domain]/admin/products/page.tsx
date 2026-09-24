import { Plus } from "lucide-react"
import Link from "next/link"

import { AdminPagination } from "@/components/admin/admin-pagination"
import { ListFilters } from "@/components/admin/list-filters"
import { AdminPageHeader } from "@/components/admin/page-header"
import { ProductTable } from "@/components/admin/products/product-table"
import { EmptyState } from "@/components/common/empty-state"
import { Button } from "@/components/ui/button"
import { listAdminProducts } from "@/features/admin/products/queries"
import { adminProductFiltersSchema } from "@/features/admin/products/schemas"
import { requireAdminPage } from "@/features/auth/session"
import { getTenantFromParams } from "@/features/tenants/current"

export const metadata = { title: "Products" }

export default async function AdminProductsPage({ params, searchParams }: PageProps<"/[domain]/admin/products">) {
  const tenant = await getTenantFromParams(params)
  const ctx = await requireAdminPage(tenant, "manager", "/admin/products")
  const parsed = adminProductFiltersSchema.safeParse(await searchParams)
  const filters = parsed.success ? parsed.data : adminProductFiltersSchema.parse({})
  const { rows, total, pageCount } = await listAdminProducts(ctx, filters)

  const hrefFor = (page: number) => {
    const sp = new URLSearchParams()
    if (filters.q) sp.set("q", filters.q)
    if (filters.status !== "all") sp.set("status", filters.status)
    sp.set("page", String(page))
    return `/admin/products?${sp}`
  }

  return (
    <>
      <AdminPageHeader
        title="Products"
        description={`${total.toLocaleString()} products`}
        actions={
          <Button asChild>
            <Link href="/admin/products/new">
              <Plus aria-hidden /> Add product
            </Link>
          </Button>
        }
      />
      <div className="overflow-hidden rounded-xl border bg-card">
        <ListFilters
          action="/admin/products"
          q={filters.q}
          placeholder="Search name or SKU"
          activeTab={filters.status}
          tabs={[
            { value: "all", label: "All" },
            { value: "active", label: "Active" },
            { value: "draft", label: "Drafts" },
            { value: "low_stock", label: "Low stock" },
            { value: "out_of_stock", label: "Out of stock" },
          ]}
        />
        {rows.length ? (
          <>
            <ProductTable rows={rows} currency={tenant.currency} locale={tenant.locale} />
            <AdminPagination page={filters.page} pageCount={pageCount} total={total} hrefFor={hrefFor} />
          </>
        ) : (
          <EmptyState className="m-6" title="No products found" description={filters.q ? "Try a different search." : "Add your first product to start selling."} />
        )}
      </div>
    </>
  )
}
