"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"

import type { ActionResult } from "@/lib/errors/app-error"

/** Runs a settings save action with toast feedback + refresh. */
export function useSave() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const save = (fn: () => Promise<ActionResult<unknown>>, message = "Settings saved") =>
    start(async () => {
      const res = await fn()
      if (!res.ok) {
        const first = Object.entries(res.error.fieldErrors ?? {})[0]
        return void toast.error(first ? `${first[0]}: ${first[1]?.[0]}` : res.error.message)
      }
      toast.success(message)
      router.refresh()
    })
  return { pending, save }
}
