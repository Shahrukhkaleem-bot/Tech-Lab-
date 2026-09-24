import { LogOut } from "lucide-react"
import type { Metadata } from "next"

import { AdminMobileNav, AdminSidebar } from "@/components/admin/admin-nav"
import { Button } from "@/components/ui/button"
import { signOutAction } from "@/features/auth/actions"
import { ROLE_LABELS } from "@/features/auth/roles"
import { requireAdminPage } from "@/features/auth/session"
import { getTenantFromParams } from "@/features/tenants/current"

// Per-user content (session cookie / order token): never statically cached.
export const dynamic = "force-dynamic"


export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } }

/**
 * Admin shell. Membership is checked here (redirect), again in every page/action
 * (capability), and finally by RLS on every query.
 */
export default async function AdminLayout({ children, params }: LayoutProps<"/[domain]/admin">) {
  const tenant = await getTenantFromParams(params)
  const { user, role } = await requireAdminPage(tenant, "staff", "/admin")

  return (
    <div className="flex min-h-dvh bg-muted/30">
      <AdminSidebar role={role} storeName={tenant.name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b bg-background px-4 sm:px-6">
          <AdminMobileNav role={role} storeName={tenant.name} />
          <span className="ml-auto hidden text-sm text-muted-foreground sm:block">
            {user.email} · {ROLE_LABELS[role]}
          </span>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm">
              <LogOut aria-hidden /> Sign out
            </Button>
          </form>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
