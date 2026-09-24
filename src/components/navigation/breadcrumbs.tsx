import { ChevronRight } from "lucide-react"
import Link from "next/link"

export type Crumb = { name: string; href?: string }

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground sm:text-sm">
        <li>
          <Link href="/" className="hover:text-foreground">
            Home
          </Link>
        </li>
        {items.map((c, i) => (
          <li key={`${c.name}-${i}`} className="flex items-center gap-1">
            <ChevronRight className="size-3.5" aria-hidden />
            {c.href && i < items.length - 1 ? (
              <Link href={c.href} className="hover:text-foreground">
                {c.name}
              </Link>
            ) : (
              <span aria-current="page" className="font-medium text-foreground">
                {c.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
