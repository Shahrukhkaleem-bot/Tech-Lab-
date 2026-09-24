"use client"

import { Loader2, Search, X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useId, useRef, useState } from "react"

import { SmartImage } from "@/components/common/smart-image"
import { useTenant } from "@/components/providers/tenant-provider"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { cn } from "@/lib/utils"
import { formatMoney } from "@/lib/utils/format"

type Suggestion = { id: string; name: string; slug: string; price: number; originalPrice: number; imageUrl: string | null; brand: string | null }

/**
 * Debounced typeahead (combobox pattern). Enter submits to /products?q=…,
 * arrow keys move through suggestions. Talks only to /api/search/suggest, so the
 * search backend can change without touching this component.
 */
export function SearchBox({ className, autoFocus, onNavigate }: { className?: string; autoFocus?: boolean; onNavigate?: () => void }) {
  const router = useRouter()
  const { tenant } = useTenant()
  const listId = useId()
  const [query, setQuery] = useState("")
  // Results are tagged with the query they belong to; loading is derived, not stored.
  const [result, setResult] = useState<{ query: string; items: Suggestion[] }>({ query: "", items: [] })
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const debounced = useDebouncedValue(query.trim(), 250)
  const boxRef = useRef<HTMLFormElement>(null)

  const searchable = debounced.length >= 2
  const items = searchable && result.query === debounced ? result.items : []
  const loading = searchable && result.query !== debounced

  useEffect(() => {
    if (!searchable) return
    const controller = new AbortController()
    fetch(`/api/search/suggest?q=${encodeURIComponent(debounced)}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data: { items?: Suggestion[] }) => {
        setResult({ query: debounced, items: data.items ?? [] })
        setActive(-1)
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ query: debounced, items: [] })
      })
    return () => controller.abort()
  }, [debounced, searchable])

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", onDown)
    return () => document.removeEventListener("pointerdown", onDown)
  }, [])

  const go = (href: string) => {
    setOpen(false)
    onNavigate?.()
    router.push(href)
  }

  const showList = open && debounced.length >= 2

  return (
    <form
      ref={boxRef}
      role="search"
      className={cn("relative w-full", className)}
      onSubmit={(e) => {
        e.preventDefault()
        if (active >= 0 && items[active]) return go(`/products/${items[active].slug}`)
        if (query.trim()) go(`/products?q=${encodeURIComponent(query.trim())}`)
      }}
    >
      <label htmlFor={`${listId}-input`} className="sr-only">
        Search products
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        id={`${listId}-input`}
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        autoFocus={autoFocus}
        value={query}
        maxLength={80}
        placeholder="Search for products, brands and more"
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault()
            setActive((i) => Math.min(i + 1, items.length - 1))
          } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setActive((i) => Math.max(i - 1, -1))
          } else if (e.key === "Escape") setOpen(false)
        }}
        className="h-11 w-full rounded-full border bg-muted/60 pr-10 pl-10 text-sm outline-none transition focus:border-primary focus:bg-background focus:ring-3 focus:ring-primary/15 [&::-webkit-search-cancel-button]:hidden"
      />
      {loading ? (
        <Loader2 className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
      ) : query ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => setQuery("")}
          className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : null}

      {showList ? (
        <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-xl border bg-popover shadow-xl">
          <ul id={listId} role="listbox" aria-label="Product suggestions">
            {items.map((item, i) => (
              <li key={item.id} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                <Link
                  href={`/products/${item.slug}`}
                  onClick={() => {
                    setOpen(false)
                    onNavigate?.()
                  }}
                  className={cn("flex items-center gap-3 px-3 py-2.5 hover:bg-accent", i === active && "bg-accent")}
                >
                  <span className="relative size-11 shrink-0 overflow-hidden rounded-md bg-muted">
                    <SmartImage src={item.imageUrl} alt="" fill sizes="44px" className="object-contain p-1" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1 text-sm font-medium">{item.name}</span>
                    {item.brand ? <span className="block text-xs text-muted-foreground">{item.brand}</span> : null}
                  </span>
                  <span className="text-sm font-semibold">{formatMoney(item.price, tenant.currency, tenant.locale)}</span>
                </Link>
              </li>
            ))}
          </ul>
          {!loading && items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No products match “{debounced}”.</p>
          ) : null}
          {items.length > 0 ? (
            <button type="submit" className="w-full border-t px-4 py-2.5 text-left text-sm font-medium text-primary hover:bg-accent">
              See all results for “{query.trim()}”
            </button>
          ) : null}
        </div>
      ) : null}
    </form>
  )
}
