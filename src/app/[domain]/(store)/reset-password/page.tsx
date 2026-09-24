import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AuthCard } from "@/components/auth/auth-card"
import { ResetPasswordForm } from "@/components/auth/password-forms"
import { getCurrentUser } from "@/features/auth/session"

// Per-user content (session cookie / order token): never statically cached.
export const dynamic = "force-dynamic"


export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } }

/** Reached from the recovery email via /auth/callback, which establishes a session. */
export default async function ResetPasswordPage() {
  if (!(await getCurrentUser())) redirect("/forgot-password")
  return (
    <AuthCard title="Choose a new password">
      <ResetPasswordForm />
    </AuthCard>
  )
}
