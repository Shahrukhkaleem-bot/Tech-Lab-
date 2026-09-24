import "server-only"

import type { User } from "@supabase/supabase-js"
import { redirect } from "next/navigation"
import { cache } from "react"

import type { Tenant } from "@/features/tenants/types"
import { AppError } from "@/lib/errors/app-error"
import { createSupabaseServerClient, type SupabaseServerClient } from "@/lib/supabase/server"
import type { MemberRole } from "@/types/database"

import { can, hasRole, type Capability } from "./roles"

/**
 * Verified current user. `getUser()` validates the JWT with Supabase Auth on every
 * call (unlike `getSession()`, which trusts the cookie). De-duplicated per request.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  return data.user
})

export const getMemberRole = cache(async (tenantId: string): Promise<MemberRole | null> => {
  const user = await getCurrentUser()
  if (!user) return null
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from("tenant_members")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", user.id)
    .maybeSingle()
  return data?.role ?? null
})

export type AdminContext = {
  user: User
  role: MemberRole
  tenant: Tenant
  supabase: SupabaseServerClient
}

/**
 * For admin PAGES/LAYOUTS: redirects to login when signed out and to the store front
 * when the user lacks the role. The DB enforces the same rule again via RLS.
 */
export async function requireAdminPage(tenant: Tenant, min: MemberRole = "staff", nextPath = "/admin"): Promise<AdminContext> {
  const user = await getCurrentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`)
  const role = await getMemberRole(tenant.id)
  // Non-members leave the admin entirely; members lacking this page's role land on Orders.
  if (!role) redirect("/forbidden")
  if (!hasRole(role, min)) redirect("/admin/orders")
  return { user, role, tenant, supabase: await createSupabaseServerClient() }
}

/** For Server ACTIONS: throws AppError instead of redirecting. */
export async function authorize(tenant: Tenant, capability: Capability): Promise<AdminContext> {
  const user = await getCurrentUser()
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.")
  const role = await getMemberRole(tenant.id)
  if (!can(role, capability)) throw new AppError("FORBIDDEN", "You do not have permission to do that.")
  return { user, role: role!, tenant, supabase: await createSupabaseServerClient() }
}
