import "server-only"

import { z } from "zod"

/**
 * Server-only environment. Importing this module from a Client Component fails the
 * build (`server-only`), so secrets can never reach the browser bundle.
 */
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  /** Tenant used on hosts that carry no tenant (localhost, *.vercel.app previews). */
  DEV_TENANT: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  STRIPE_SECRET_KEY: z.string().startsWith("sk_").optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
  /** Vercel API token + project for automated custom-domain provisioning (optional). */
  VERCEL_API_TOKEN: z.string().optional(),
  VERCEL_PROJECT_ID: z.string().optional(),
  VERCEL_TEAM_ID: z.string().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
})

export type ServerEnv = z.infer<typeof serverSchema>

let cached: ServerEnv | undefined

export function serverEnv(): ServerEnv {
  if (cached) return cached
  const parsed = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    DEV_TENANT: process.env.DEV_TENANT || undefined,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || undefined,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || undefined,
    VERCEL_API_TOKEN: process.env.VERCEL_API_TOKEN || undefined,
    VERCEL_PROJECT_ID: process.env.VERCEL_PROJECT_ID || undefined,
    VERCEL_TEAM_ID: process.env.VERCEL_TEAM_ID || undefined,
    LOG_LEVEL: process.env.LOG_LEVEL || undefined,
  })
  if (!parsed.success) {
    throw new Error(`Invalid server environment: ${z.prettifyError(parsed.error)}`)
  }
  cached = parsed.data
  return cached
}
