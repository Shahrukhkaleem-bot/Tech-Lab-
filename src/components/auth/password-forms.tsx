"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"

import { Button } from "@/components/ui/button"
import { requestPasswordResetAction, updatePasswordAction } from "@/features/auth/actions"
import { forgotPasswordSchema, resetPasswordSchema } from "@/features/auth/schemas"

import { FormField } from "./form-field"

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof forgotPasswordSchema>>({ resolver: zodResolver(forgotPasswordSchema) })

  const onSubmit = handleSubmit(async (values) => {
    const res = await requestPasswordResetAction(values)
    if (!res.ok) return toast.error(res.error.message)
    setSent(true)
  })

  if (sent) return <p className="text-sm">If an account exists for that email, you&apos;ll receive a reset link shortly.</p>

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormField id="email" label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Send reset link
      </Button>
    </form>
  )
}

export function ResetPasswordForm() {
  const router = useRouter()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof resetPasswordSchema>>({ resolver: zodResolver(resetPasswordSchema) })

  const onSubmit = handleSubmit(async (values) => {
    const res = await updatePasswordAction(values)
    if (!res.ok) return toast.error(res.error.message)
    toast.success("Password updated")
    router.replace("/account")
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormField id="password" label="New password" type="password" autoComplete="new-password" error={errors.password?.message} {...register("password")} />
      <FormField
        id="confirmPassword"
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Update password
      </Button>
    </form>
  )
}
