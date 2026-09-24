"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { getRequestTenant, tenantOrigin } from "@/features/tenants/current"
import { runAction } from "@/lib/actions/run-action"
import { AppError, type ActionResult } from "@/lib/errors/app-error"
import { clientFingerprint, rateLimit } from "@/lib/security/rate-limit"
import { safeNextPath } from "@/lib/security/safe-redirect"
import { createSupabaseServerClient } from "@/lib/supabase/server"

import { forgotPasswordSchema, resetPasswordSchema, signInSchema, signUpSchema } from "./schemas"

/**
 * Auth emails must link back to the host the user is on (session cookies are per host).
 * The host was already validated as a tenant host by getRequestTenant(); Supabase's
 * redirect allow-list (Auth → URL Configuration) is the second line of defence.
 */
async function currentOrigin(): Promise<string> {
  const tenant = await getRequestTenant()
  const h = await headers()
  const host = h.get("host")
  if (!host) return tenantOrigin(tenant)
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https")
  return `${proto === "http" ? "http" : "https"}://${host}`
}

export async function signInAction(input: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction("signIn", async () => {
    const data = signInSchema.parse(input)
    const fingerprint = await clientFingerprint()
    // 10 attempts / 10 min per IP, and per account, to slow credential stuffing.
    const [ipOk, accountOk] = await Promise.all([
      rateLimit("signin-ip", fingerprint, 10, 600),
      rateLimit("signin-email", data.email, 10, 600),
    ])
    if (!ipOk || !accountOk) throw new AppError("RATE_LIMITED", "Too many sign-in attempts. Please wait a few minutes.")

    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password })
    // Same message for unknown email and wrong password (no account enumeration).
    if (error) throw new AppError("UNAUTHENTICATED", "Incorrect email or password.")
    return { redirectTo: safeNextPath(data.next, "/account") }
  })
}

export async function signUpAction(input: unknown): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  return runAction("signUp", async () => {
    const data = signUpSchema.parse(input)
    if (!(await rateLimit("signup-ip", await clientFingerprint(), 5, 3600))) {
      throw new AppError("RATE_LIMITED", "Too many sign-up attempts. Please try again later.")
    }
    const supabase = await createSupabaseServerClient()
    const { data: result, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { full_name: data.fullName },
        emailRedirectTo: `${await currentOrigin()}/auth/callback?next=/account`,
      },
    })
    if (error) {
      if (/already registered/i.test(error.message)) {
        throw new AppError("CONFLICT", "An account with this email already exists. Try signing in.")
      }
      throw new AppError("VALIDATION", "We couldn't create your account. Please check your details.")
    }
    return { needsConfirmation: !result.session }
  })
}

export async function requestPasswordResetAction(input: unknown): Promise<ActionResult<null>> {
  return runAction("requestPasswordReset", async () => {
    const data = forgotPasswordSchema.parse(input)
    if (!(await rateLimit("reset-ip", await clientFingerprint(), 5, 3600))) {
      throw new AppError("RATE_LIMITED", "Too many requests. Please try again later.")
    }
    const supabase = await createSupabaseServerClient()
    await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${await currentOrigin()}/auth/callback?next=/reset-password`,
    })
    // Always succeed (don't reveal whether the email exists).
    return null
  })
}

export async function updatePasswordAction(input: unknown): Promise<ActionResult<null>> {
  return runAction("updatePassword", async () => {
    const data = resetPasswordSchema.parse(input)
    const supabase = await createSupabaseServerClient()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) throw new AppError("UNAUTHENTICATED", "Your reset link has expired. Please request a new one.")
    const { error } = await supabase.auth.updateUser({ password: data.password })
    if (error) throw new AppError("VALIDATION", "Could not update your password. Please try again.")
    return null
  })
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect("/")
}
