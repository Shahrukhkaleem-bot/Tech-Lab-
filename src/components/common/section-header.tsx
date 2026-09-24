import { ArrowRight } from "lucide-react"
import Link from "next/link"

import { cn } from "@/lib/utils"

type SectionHeaderProps = {
  title: string
  subtitle?: string | null
  viewAllHref?: string
  viewAllLabel?: string
  id?: string
  className?: string
  /** Extra controls on the right (e.g. carousel arrows). */
  actions?: React.ReactNode
}

export function SectionHeader({ title, subtitle, viewAllHref, viewAllLabel = "View all", id, className, actions }: SectionHeaderProps) {
  return (
    <div className={cn("mb-5 flex items-end justify-between gap-4 sm:mb-6", className)}>
      <div className="min-w-0">
        <h2 id={id} className="text-xl font-bold tracking-tight sm:text-2xl">
          {title}
        </h2>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        {viewAllHref ? (
          <Link
            href={viewAllHref}
            className="group inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline underline-offset-4"
          >
            {viewAllLabel}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        ) : null}
      </div>
    </div>
  )
}
