import { BrandManager } from "@/components/admin/catalog/brand-manager"
import { AdminPageHeader } from "@/components/admin/page-header"
import { requireAdminPage } from "@/features/auth/session"
import { getTenantFromParams } from "@/features/tenants/current"
import { toAppError } from "@/lib/errors/database"

export const metadata = { title: "Brands" }

export default async function AdminBrandsPage({ params }: PageProps<"/[domain]/admin/brands">) {
  const tenant = await getTenantFromParams(params)
  const ctx = await requireAdminPage(tenant, "manager", "/admin/brands")
  const { data, error } = await ctx.supabase.from("brands").select("*").eq("tenant_id", tenant.id).order("display_order").order("name")
  if (error) throw toAppError(error, { op: "admin.brands", tenantId: tenant.id })

  return (
    <>
      <AdminPageHeader title="Brands" />
      <BrandManager
        rows={(data ?? []).map((b) => ({
          id: b.id,
          name: b.name,
          slug: b.slug,
          description: b.description ?? "",
          logoUrl: b.logo_url,
          displayOrder: b.display_order,
          isFeatured: b.is_featured,
          isActive: b.is_active,
        }))}
      />
    </>
  )
}
