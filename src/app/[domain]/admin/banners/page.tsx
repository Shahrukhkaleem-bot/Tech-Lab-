import { BannerManager } from "@/components/admin/catalog/banner-manager"
import { AdminPageHeader } from "@/components/admin/page-header"
import { requireAdminPage } from "@/features/auth/session"
import { getTenantFromParams } from "@/features/tenants/current"
import { toAppError } from "@/lib/errors/database"

export const metadata = { title: "Banners" }

/** ISO → value for <input type="datetime-local"> (UTC; admins see times in UTC). */
const toLocalInput = (iso: string | null) => (iso ? iso.slice(0, 16) : "")

export default async function AdminBannersPage({ params }: PageProps<"/[domain]/admin/banners">) {
  const tenant = await getTenantFromParams(params)
  const ctx = await requireAdminPage(tenant, "manager", "/admin/banners")
  const { data, error } = await ctx.supabase.from("banners").select("*").eq("tenant_id", tenant.id).order("display_order")
  if (error) throw toAppError(error, { op: "admin.banners", tenantId: tenant.id })

  return (
    <>
      <AdminPageHeader title="Homepage banners" description="Hero slides shown at the top of the storefront." />
      <BannerManager
        rows={(data ?? []).map((b) => ({
          id: b.id,
          heading: b.heading,
          description: b.description ?? "",
          badge: b.badge ?? "",
          ctaLabel: b.cta_label ?? "",
          linkUrl: b.link_url ?? "",
          desktopImageUrl: b.desktop_image_url,
          mobileImageUrl: b.mobile_image_url,
          displayOrder: b.display_order,
          isActive: b.is_active,
          startsAt: toLocalInput(b.starts_at),
          endsAt: toLocalInput(b.ends_at),
        }))}
      />
    </>
  )
}
