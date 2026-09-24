"use client"

import { Eye } from "lucide-react"

import { cn } from "@/lib/utils"
import { useUiStore } from "@/stores/ui-store"

export function QuickViewButton({ slug, name, className }: { slug: string; name: string; className?: string }) {
  const open = useUiStore((s) => s.openQuickView)
  return (
    <button
      type="button"
      onClick={() => open(slug)}
      aria-label={`Quick view: ${name}`}
      className={cn(
        "hidden size-9 items-center justify-center rounded-full bg-background/90 shadow-sm backdrop-blur transition-colors hover:bg-background md:inline-flex",
        className,
      )}
    >
      <Eye className="size-4.5" aria-hidden />
    </button>
  )
}
