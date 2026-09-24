"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

type CarouselProps = {
  children: ReactNode
  /** Accessible name for the scroll region. */
  label: string
  /** Tailwind width classes for each slide, e.g. "basis-1/2 sm:basis-1/3 lg:basis-1/5". */
  itemClassName?: string
  className?: string
  /** Show arrow buttons (hidden on touch-first small screens). */
  arrows?: boolean
}

/**
 * Lightweight carousel: native scroll-snap (touch/trackpad), mouse drag on desktop,
 * arrow buttons, keyboard-scrollable region. No dependency, no layout thrash.
 */
export function Carousel({ children, label, itemClassName, className, arrows = true }: CarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)
  const drag = useRef<{ x: number; scroll: number; moved: boolean } | null>(null)

  const update = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    setCanPrev(el.scrollLeft > 4)
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    update()
    const el = trackRef.current
    if (!el) return
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [update])

  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" })
  }

  return (
    <div className={cn("group/carousel relative", className)}>
      <div
        ref={trackRef}
        role="region"
        aria-label={label}
        tabIndex={0}
        onScroll={update}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse" || !trackRef.current) return
          drag.current = { x: e.clientX, scroll: trackRef.current.scrollLeft, moved: false }
        }}
        onPointerMove={(e) => {
          const d = drag.current
          const el = trackRef.current
          if (!d || !el) return
          const dx = e.clientX - d.x
          if (Math.abs(dx) > 5) {
            d.moved = true
            el.style.scrollSnapType = "none"
            el.scrollLeft = d.scroll - dx
          }
        }}
        onPointerUp={() => {
          if (trackRef.current) trackRef.current.style.scrollSnapType = ""
          setTimeout(() => (drag.current = null), 0)
        }}
        onPointerLeave={() => {
          if (trackRef.current) trackRef.current.style.scrollSnapType = ""
          drag.current = null
        }}
        onClickCapture={(e) => {
          // Swallow the click that ends a drag so links inside slides don't fire.
          if (drag.current?.moved) {
            e.preventDefault()
            e.stopPropagation()
          }
        }}
        className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:mx-0 sm:scroll-px-0 sm:px-0 sm:gap-4"
      >
        {Array.isArray(children)
          ? children.map((child, i) => (
              <div key={i} className={cn("shrink-0 snap-start", itemClassName)}>
                {child}
              </div>
            ))
          : children}
      </div>

      {arrows ? (
        <>
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            disabled={!canPrev}
            aria-label="Previous"
            className="absolute top-1/2 -left-4 z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border bg-background shadow-md transition-opacity hover:bg-accent disabled:pointer-events-none disabled:opacity-0 md:flex"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            disabled={!canNext}
            aria-label="Next"
            className="absolute top-1/2 -right-4 z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border bg-background shadow-md transition-opacity hover:bg-accent disabled:pointer-events-none disabled:opacity-0 md:flex"
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </>
      ) : null}
    </div>
  )
}
