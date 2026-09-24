import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { AuthCard } from "@/components/auth/auth-card"
import { SignUpForm } from "@/components/auth/sign-up-form"
import { getCurrentUser } from "@/features/auth/session"
import { getTenantFromParams } from "@/features/tenants/current"

// Per-user content (session cookie / order token): never statically cached.
export const dynamic = "force-dynamic"


export const metadata: Metadata = { title: "Create account", robots: { index: false } }

export default async function RegisterPage({ params }: PageProps<"/[domain]/register">) {
  const tenant = await getTenantFromParams(params)
  if (await getCurrentUser()) redirect("/account")
  return (
    <AuthCard
      title="Create your account"
      description={`Track orders and save favourites at ${tenant.name}.`}
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <SignUpForm />
    </AuthCard>
  )
}
