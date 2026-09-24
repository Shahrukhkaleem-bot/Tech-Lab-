"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, MailCheck } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { signUpAction } from "@/features/auth/actions"
import { signUpSchema, type SignUpInput } from "@/features/auth/schemas"

import { FormField } from "./form-field"

export function SignUpForm() {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const [checkEmail, setCheckEmail] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({ resolver: zodResolver(signUpSchema), defaultValues: { fullName: "", email: "", password: "" } })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const res = await signUpAction(values)
    if (!res.ok) return setFormError(res.error.message)
    if (res.data.needsConfirmation) return setCheckEmail(true)
    router.replace("/account")
    router.refresh()
  })

  if (checkEmail) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <MailCheck className="size-10 text-primary" aria-hidden />
        <p className="font-medium">Check your inbox</p>
        <p className="text-sm text-muted-foreground">We sent you a link to confirm your email address.</p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError ? (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      <FormField id="fullName" label="Full name" autoComplete="name" error={errors.fullName?.message} {...register("fullName")} />
      <FormField id="email" label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
      <FormField
        id="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters, including a letter and a number."
        error={errors.password?.message}
        {...register("password")}
      />
      <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Create account
      </Button>
    </form>
  )
}
