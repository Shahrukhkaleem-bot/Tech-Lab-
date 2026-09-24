import { Search } from "lucide-react"
import Link from "next/link"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/** Server-rendered filter bar: GET search form + status tabs (URL-driven, shareable). */
export function ListFilters({
  action,
  q,
  placeholder,
  tabs,
  activeTab,
  tabParam = "status",
  extraParams = {},
}: {
  action: string
  q?: string
  /** Omit to hide the search box. */
  placeholder?: string
  tabs: { value: string; label: string }[]
  activeTab: string
  tabParam?: string
  extraParams?: Record<string, string>
}) {
  const hrefFor = (value: string) => {
    const sp = new URLSearchParams(extraParams)
    if (q) sp.set("q", q)
    if (value !== "all") sp.set(tabParam, value)
    const qs = sp.toString()
    return qs ? `${action}?${qs}` : action
  }
  return (
    <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
      <nav aria-label="Filter" className="scrollbar-none flex gap-1 overflow-x-auto">
        {tabs.map((t) => (
          <Link
            key={t.value}
            href={hrefFor(t.value)}
            aria-current={activeTab === t.value ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap",
              activeTab === t.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {placeholder ? (
      <form action={action} className="relative md:w-72" role="search">
        {activeTab !== "all" ? <input type="hidden" name={tabParam} value={activeTab} /> : null}
        {Object.entries(extraParams).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input name="q" defaultValue={q} placeholder={placeholder} aria-label={placeholder} className="pl-9" />
      </form>
      ) : null}
    </div>
  )
}
