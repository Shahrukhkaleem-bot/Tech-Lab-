import { SearchX } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function StoreNotFound() {
  return (
    <div className="container-page flex flex-col items-center py-20 text-center">
      <SearchX className="mb-4 size-12 text-primary" aria-hidden />
      <h1 className="text-2xl font-bold tracking-tight">We couldn&apos;t find that page</h1>
      <p className="mt-2 max-w-md text-muted-foreground">The product or page you&apos;re looking for may have moved or is no longer available.</p>
      <div className="mt-6 flex gap-3">
        <Button asChild>
          <Link href="/">Go to homepage</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/products">Browse products</Link>
        </Button>
      </div>
    </div>
  )
}
