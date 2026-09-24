import type { MemberRole } from "@/types/database"

/**
 * Role model (mirrors app_private.role_rank in SQL). Customers are any signed-in user
 * and are NOT tenant members.
 *
 * | Capability                              | owner | admin | manager | staff |
 * |-----------------------------------------|:-----:|:-----:|:-------:|:-----:|
 * | View dashboard revenue                  |   ✓   |   ✓   |    ✓    |       |
 * | View orders, update fulfilment/tracking |   ✓   |   ✓   |    ✓    |   ✓   |
 * | Change payment status, cancel/return    |   ✓   |   ✓   |    ✓    |       |
 * | Products / categories / brands CRUD     |   ✓   |   ✓   |    ✓    |       |
 * | Moderate reviews, banners, coupons      |   ✓   |   ✓   |    ✓    |       |
 * | Store settings, branding, pages, nav    |   ✓   |   ✓   |         |       |
 * | Manage members (non-owner)              |   ✓   |   ✓   |         |       |
 * | Manage owners, transfer ownership       |   ✓   |       |         |       |
 */
export const ROLE_RANK: Record<MemberRole, number> = { owner: 4, admin: 3, manager: 2, staff: 1 }

export function hasRole(role: MemberRole | null | undefined, min: MemberRole): boolean {
  return role != null && ROLE_RANK[role] >= ROLE_RANK[min]
}

export const CAPABILITIES = {
  viewDashboard: "manager",
  viewOrders: "staff",
  updateFulfilment: "staff",
  updatePayment: "manager",
  cancelOrders: "manager",
  manageCatalog: "manager",
  moderateReviews: "manager",
  manageContent: "manager",
  manageSettings: "admin",
  manageMembers: "admin",
} as const satisfies Record<string, MemberRole>

export type Capability = keyof typeof CAPABILITIES

export function can(role: MemberRole | null | undefined, capability: Capability): boolean {
  return hasRole(role, CAPABILITIES[capability])
}

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  staff: "Staff",
}
