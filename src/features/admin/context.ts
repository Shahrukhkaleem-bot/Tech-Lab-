import "server-only"

import type { Capability } from "@/features/auth/roles"
import { authorize, type AdminContext } from "@/features/auth/session"
import { getRequestTenant } from "@/features/tenants/current"
import { runAction } from "@/lib/actions/run-action"
import type { ActionResult } from "@/lib/errors/app-error"

/**
 * Every admin Server Action goes through this wrapper:
 *   1. tenant from the Host header (never from input),
 *   2. verified user + capability check (roles.ts),
 *   3. uniform error handling (runAction).
 * RLS re-checks membership on every query as the final layer.
 */
export function adminAction<T>(name: string, capability: Capability, body: (ctx: AdminContext) => Promise<T>): Promise<ActionResult<T>> {
  return runAction(`admin.${name}`, async () => {
    const tenant = await getRequestTenant()
    const ctx = await authorize(tenant, capability)
    return body(ctx)
  })
}
