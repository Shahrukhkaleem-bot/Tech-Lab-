"use client"

import { useState } from "react"

import { SmartImage } from "@/components/common/smart-image"
import type { ProductImage } from "@/features/catalog/types"
import { cn } from "@/lib/utils"

/** Main image + thumbnail strip. Thumbnails are buttons (keyboard + screen-reader friendly). */
export function ProductGallery({ images, name, discountPercent }: { images: ProductImage[]; name: string; discountPercent: number }) {
  const [active, setActive] = useState(0)
  const current = images[active]

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square overflow-hidden rounded-2xl border bg-muted">
        <SmartImage
          src={current?.url}
          alt={current?.alt ?? name}
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-contain p-6"
          fallbackLabel={name}
        />
        {discountPercent > 0 ? (
          <span className="absolute top-4 left-4 rounded-md bg-highlight px-2.5 py-1 text-sm font-bold text-highlight-foreground">
            -{discountPercent}%
          </span>
        ) : null}
      </div>

      {images.length > 1 ? (
        <ul className="scrollbar-none flex gap-2 overflow-x-auto" aria-label="Product images">
          {images.map((img, i) => (
            <li key={img.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show image ${i + 1} of ${images.length}`}
                aria-current={i === active}
                className={cn(
                  "relative block size-18 overflow-hidden rounded-lg border-2 bg-muted transition-colors sm:size-20",
                  i === active ? "border-primary" : "border-transparent hover:border-border",
                )}
              >
                <SmartImage src={img.url} alt="" fill sizes="80px" className="object-contain p-1" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
