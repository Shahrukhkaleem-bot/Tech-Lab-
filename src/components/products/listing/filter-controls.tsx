"use client"

import { useState } from "react"

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { ProductFilters } from "@/features/catalog/types"

export type FilterOptions = {
  categories: { slug: string; name: string; depth: number }[]
  brands: { slug: string; name: string }[]
  /** Facets fixed by the page (e.g. /brands/acme locks brand). */
  lockCategory?: boolean
  lockBrand?: boolean
}

function PriceInputs({
  idPrefix,
  initialMin,
  initialMax,
  onCommit,
}: {
  idPrefix: string
  initialMin?: number
  initialMax?: number
  onCommit: (min: number | undefined, max: number | undefined) => void
}) {
  const [min, setMin] = useState(initialMin?.toString() ?? "")
  const [max, setMax] = useState(initialMax?.toString() ?? "")
  const toNum = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) ? undefined : Math.max(0, Number(v)))
  const commit = () => onCommit(toNum(min), toNum(max))

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        commit()
      }}
    >
      <div className="grid flex-1 gap-1">
        <Label htmlFor={`${idPrefix}-min`} className="text-xs text-muted-foreground">
          Min
        </Label>
        <Input id={`${idPrefix}-min`} inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} onBlur={commit} placeholder="0" />
      </div>
      <span className="pb-2 text-muted-foreground">-</span>
      <div className="grid flex-1 gap-1">
        <Label htmlFor={`${idPrefix}-max`} className="text-xs text-muted-foreground">
          Max
        </Label>
        <Input id={`${idPrefix}-max`} inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} onBlur={commit} placeholder="Any" />
      </div>
    </form>
  )
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-b pb-5">
      <legend className="mb-3 text-sm font-semibold">{title}</legend>
      {children}
    </fieldset>
  )
}

/** Controlled filter form — used by both the desktop sidebar and the mobile sheet. */
export function FilterControls({
  value,
  onChange,
  options,
  idPrefix,
}: {
  value: ProductFilters
  onChange: (patch: Partial<ProductFilters>) => void
  options: FilterOptions
  idPrefix: string
}) {
  return (
    <div className="space-y-5">
      {!options.lockCategory && options.categories.length ? (
        <FilterGroup title="Category">
          <RadioGroup
            value={value.categorySlug ?? ""}
            onValueChange={(v) => onChange({ categorySlug: v || undefined })}
            className="max-h-64 gap-2 overflow-y-auto pr-1"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="" id={`${idPrefix}-cat-all`} />
              <Label htmlFor={`${idPrefix}-cat-all`} className="font-normal">
                All categories
              </Label>
            </div>
            {options.categories.map((c) => (
              <div key={c.slug} className="flex items-center gap-2" style={{ paddingLeft: c.depth * 14 }}>
                <RadioGroupItem value={c.slug} id={`${idPrefix}-cat-${c.slug}`} />
                <Label htmlFor={`${idPrefix}-cat-${c.slug}`} className="font-normal">
                  {c.name}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </FilterGroup>
      ) : null}

      {!options.lockBrand && options.brands.length ? (
        <FilterGroup title="Brand">
          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {options.brands.map((b) => {
              const checked = value.brandSlugs.includes(b.slug)
              return (
                <div key={b.slug} className="flex items-center gap-2">
                  <Checkbox
                    id={`${idPrefix}-brand-${b.slug}`}
                    checked={checked}
                    onCheckedChange={(c) =>
                      onChange({ brandSlugs: c ? [...value.brandSlugs, b.slug] : value.brandSlugs.filter((s) => s !== b.slug) })
                    }
                  />
                  <Label htmlFor={`${idPrefix}-brand-${b.slug}`} className="font-normal">
                    {b.name}
                  </Label>
                </div>
              )
            })}
          </div>
        </FilterGroup>
      ) : null}

      <FilterGroup title="Price">
        {/* Keyed on the applied values: remounts (resets the draft inputs) when the URL changes. */}
        <PriceInputs
          key={`${value.minPrice ?? ""}-${value.maxPrice ?? ""}`}
          idPrefix={idPrefix}
          initialMin={value.minPrice}
          initialMax={value.maxPrice}
          onCommit={(minPrice, maxPrice) => onChange({ minPrice, maxPrice })}
        />
      </FilterGroup>

      <FilterGroup title="Customer rating">
        <RadioGroup
          value={value.minRating?.toString() ?? ""}
          onValueChange={(v) => onChange({ minRating: v ? Number(v) : undefined })}
          className="gap-2"
        >
          {[
            ["", "Any rating"],
            ["4", "4★ & up"],
            ["3", "3★ & up"],
          ].map(([v, label]) => (
            <div key={v} className="flex items-center gap-2">
              <RadioGroupItem value={v!} id={`${idPrefix}-rating-${v || "any"}`} />
              <Label htmlFor={`${idPrefix}-rating-${v || "any"}`} className="font-normal">
                {label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </FilterGroup>

      <FilterGroup title="Availability">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox id={`${idPrefix}-instock`} checked={value.inStock} onCheckedChange={(c) => onChange({ inStock: c === true })} />
            <Label htmlFor={`${idPrefix}-instock`} className="font-normal">
              In stock only
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id={`${idPrefix}-onsale`} checked={value.onSale} onCheckedChange={(c) => onChange({ onSale: c === true })} />
            <Label htmlFor={`${idPrefix}-onsale`} className="font-normal">
              On sale
            </Label>
          </div>
        </div>
      </FilterGroup>
    </div>
  )
}
