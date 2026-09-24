import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { AuthCard } from "@/components/auth/auth-card"
import { SignInForm } from "@/components/auth/sign-in-form"
import { getCurrentUser } from "@/features/auth/session"
import { getTenantFromParams } from "@/features/tenants/current"
import { safeNextPath } from "@/lib/security/safe-redirect"

// Per-user content (session cookie / order token): never statically cached.
export const dynamic = "force-dynamic"


export const metadata: Metadata = { title: "Sign in", robots: { index: false } }

export default async function LoginPage({ params, searchParams }: PageProps<"/[domain]/login">) {
  const tenant = await getTenantFromParams(params)
  const { next, error } = await searchParams
  const nextPath = safeNextPath(typeof next === "string" ? next : undefined, "/account")
  if (await getCurrentUser()) redirect(nextPath)

  return (
    <AuthCard
      title="Welcome back"
      description={`Sign in to your ${tenant.name} account.`}
      footer={
        <>
          New here?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {error ? (
        <p role="alert" className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          That sign-in link is invalid or has expired. Please try again.
        </p>
      ) : null}
      <SignInForm next={nextPath} />
    </AuthCard>
  )
}
