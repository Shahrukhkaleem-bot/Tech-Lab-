import { ListFilters } from "@/components/admin/list-filters"
import { AdminPageHeader } from "@/components/admin/page-header"
import { ReviewModeration } from "@/components/admin/reviews/review-moderation"
import { requireAdminPage } from "@/features/auth/session"
import { getTenantFromParams } from "@/features/tenants/current"
import { toAppError } from "@/lib/errors/database"

export const metadata = { title: "Reviews" }

export default async function AdminReviewsPage({ params, searchParams }: PageProps<"/[domain]/admin/reviews">) {
  const tenant = await getTenantFromParams(params)
  const ctx = await requireAdminPage(tenant, "manager", "/admin/reviews")
  const { status } = await searchParams
  const tab = status === "published" || status === "all" ? status : "pending"

  let query = ctx.supabase
    .from("reviews")
    .select("id, customer_name, rating, title, comment, is_approved, is_verified, created_at, product:products!reviews_product_fk(name)")
    .eq("tenant_id", tenant.id)
  if (tab === "pending") query = query.eq("is_approved", false)
  if (tab === "published") query = query.eq("is_approved", true)
  const { data, error } = await query.order("created_at", { ascending: false }).limit(100)
  if (error) throw toAppError(error, { op: "admin.reviews", tenantId: tenant.id })

  return (
    <>
      <AdminPageHeader title="Reviews" description="New reviews stay hidden until approved." />
      <div className="overflow-hidden rounded-xl border bg-card">
        <ListFilters
          action="/admin/reviews"
          activeTab={tab === "pending" ? "all" : tab}
          tabs={[
            { value: "all", label: "Pending" },
            { value: "published", label: "Published" },
          ]}
        />
        <ReviewModeration
          reviews={(data ?? []).map((r) => ({
            id: r.id,
            customerName: r.customer_name,
            rating: r.rating,
            title: r.title,
            comment: r.comment,
            isApproved: r.is_approved,
            isVerified: r.is_verified,
            createdAt: r.created_at,
            productName: r.product?.name ?? null,
          }))}
        />
      </div>
    </>
  )
}
