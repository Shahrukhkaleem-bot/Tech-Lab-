import Link from "next/link"

import { Button } from "@/components/ui/button"

export function AdminPagination({ page, pageCount, total, hrefFor }: { page: number; pageCount: number; total: number; hrefFor: (p: number) => string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t p-4 text-sm text-muted-foreground">
      <span>
        Page {page} of {pageCount} · {total.toLocaleString()} total
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button asChild size="sm" variant="outline">
            <Link href={hrefFor(page - 1)}>Previous</Link>
          </Button>
        ) : null}
        {page < pageCount ? (
          <Button asChild size="sm" variant="outline">
            <Link href={hrefFor(page + 1)}>Next</Link>
          </Button>
        ) : null}
      </div>
    </div>
  )
}
