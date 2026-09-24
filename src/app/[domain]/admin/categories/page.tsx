import { CategoryManager, type CategoryRowView } from "@/components/admin/catalog/category-manager"
import { AdminPageHeader } from "@/components/admin/page-header"
import { toCategoryOptions } from "@/features/admin/products/queries"
import { requireAdminPage } from "@/features/auth/session"
import { getTenantFromParams } from "@/features/tenants/current"
import { toAppError } from "@/lib/errors/database"

export const metadata = { title: "Categories" }

export default async function AdminCategoriesPage({ params }: PageProps<"/[domain]/admin/categories">) {
  const tenant = await getTenantFromParams(params)
  const ctx = await requireAdminPage(tenant, "manager", "/admin/categories")
  const [{ data, error }, { data: counts }] = await Promise.all([
    ctx.supabase.from("categories").select("*").eq("tenant_id", tenant.id).order("display_order"),
    ctx.supabase.from("products").select("category_id").eq("tenant_id", tenant.id),
  ])
  if (error) throw toAppError(error, { op: "admin.categories", tenantId: tenant.id })

  const countBy = new Map<string, number>()
  for (const p of counts ?? []) if (p.category_id) countBy.set(p.category_id, (countBy.get(p.category_id) ?? 0) + 1)
  const byId = new Map((data ?? []).map((c) => [c.id, c]))

  const rows: CategoryRowView[] = toCategoryOptions(data ?? []).map((o) => {
    const c = byId.get(o.id)!
    return {
      id: c.id,
      depth: o.depth,
      productCount: countBy.get(c.id) ?? 0,
      name: c.name,
      slug: c.slug,
      description: c.description ?? "",
      parentId: c.parent_id ?? "",
      imageUrl: c.image_url,
      displayOrder: c.display_order,
      isActive: c.is_active,
      seoTitle: c.seo_title ?? "",
      seoDescription: c.seo_description ?? "",
    }
  })

  return (
    <>
      <AdminPageHeader title="Categories" description="Nested up to three levels. Drives the mega menu and filters." />
      <CategoryManager rows={rows} />
    </>
  )
}
