import { ShieldX } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { Button } from "@/components/ui/button"

export const metadata: Metadata = { title: "Access denied", robots: { index: false } }

export default function ForbiddenPage() {
  return (
    <div className="container-page flex flex-col items-center py-20 text-center">
      <ShieldX className="mb-4 size-12 text-destructive" aria-hidden />
      <h1 className="text-2xl font-bold tracking-tight">You don&apos;t have access to this area</h1>
      <p className="mt-2 max-w-md text-muted-foreground">Ask the store owner to add you as a team member, or sign in with a different account.</p>
      <Button asChild className="mt-6">
        <Link href="/account">Go to my account</Link>
      </Button>
    </div>
  )
}
