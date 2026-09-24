import { z } from "zod"

/**
 * Public (browser-safe) environment. Only NEXT_PUBLIC_* variables may appear here;
 * Next.js inlines them into client bundles at build time.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  /** Apex domain that tenant subdomains hang off, e.g. "example.com" (no protocol). */
  NEXT_PUBLIC_ROOT_DOMAIN: z
    .string()
    .min(3)
    .regex(/^[a-z0-9.-]+(:\d+)?$/, "Hostname only, e.g. example.com or localhost:3000"),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
})

export type PublicEnv = z.infer<typeof publicSchema>

let cachedPublicEnv: PublicEnv | undefined

export function publicEnv(): PublicEnv {
  if (cachedPublicEnv) return cachedPublicEnv
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || undefined,
  })
  if (!parsed.success) {
    throw new Error(`Invalid public environment: ${z.prettifyError(parsed.error)}`)
  }
  cachedPublicEnv = parsed.data
  return cachedPublicEnv
}
