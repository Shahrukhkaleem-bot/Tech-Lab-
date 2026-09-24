"use client"

import { Minus, Plus } from "lucide-react"

import { cn } from "@/lib/utils"

type QuantitySelectorProps = {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number | null
  size?: "sm" | "md"
  label?: string
  className?: string
}

export function QuantitySelector({ value, onChange, min = 1, max, size = "md", label = "Quantity", className }: QuantitySelectorProps) {
  const upper = max ?? 99
  const btn = cn(
    "inline-flex items-center justify-center transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40",
    size === "sm" ? "size-8" : "size-10",
  )
  return (
    <div className={cn("inline-flex items-center rounded-lg border", className)} role="group" aria-label={label}>
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={value <= min} aria-label="Decrease quantity">
        <Minus className="size-3.5" aria-hidden />
      </button>
      <output aria-live="polite" className={cn("min-w-8 text-center font-medium tabular-nums", size === "sm" ? "text-sm" : "text-base")}>
        {value}
      </output>
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={value >= upper} aria-label="Increase quantity">
        <Plus className="size-3.5" aria-hidden />
      </button>
    </div>
  )
}
