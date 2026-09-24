"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { getImageProps } from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import type { Banner } from "@/features/catalog/types"
import { cn } from "@/lib/utils"

const AUTOPLAY_MS = 6000

/** Art-directed slide image: separate mobile/desktop sources via <picture>. */
function SlideImage({ banner, priority }: { banner: Banner; priority: boolean }) {
  const common = { alt: "", fill: true, priority, sizes: "100vw" } as const
  const desktop = getImageProps({ ...common, src: banner.desktopImageUrl, unoptimized: banner.desktopImageUrl.endsWith(".svg") }).props
  const mobileSrc = banner.mobileImageUrl ?? banner.desktopImageUrl
  const mobile = getImageProps({ ...common, src: mobileSrc, unoptimized: mobileSrc.endsWith(".svg") }).props

  return (
    <picture>
      <source media="(min-width: 768px)" srcSet={desktop.srcSet ?? desktop.src} />
      <source srcSet={mobile.srcSet ?? mobile.src} />
      <img {...desktop} alt="" className="object-cover" />
    </picture>
  )
}

export function HeroCarousel({ banners }: { banners: Banner[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const count = banners.length

  const go = useCallback((i: number) => setIndex(((i % count) + count) % count), [count])

  useEffect(() => {
    if (count < 2 || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const id = setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS)
    return () => clearInterval(id)
  }, [count, paused])

  if (!count) return null

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured promotions"
      className="relative overflow-hidden rounded-2xl bg-secondary"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="relative aspect-[4/5] sm:aspect-[16/9] lg:aspect-[21/8]">
        {banners.map((b, i) => (
          <div
            key={b.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            aria-hidden={i !== index}
            className={cn("absolute inset-0 transition-opacity duration-700", i === index ? "opacity-100" : "pointer-events-none opacity-0")}
          >
            <SlideImage banner={b} priority={i === 0} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent sm:bg-gradient-to-r sm:from-black/65 sm:via-black/25" />
            <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:inset-y-0 sm:flex sm:max-w-xl sm:flex-col sm:justify-center sm:p-12">
              {b.badge ? (
                <span className="mb-3 inline-block w-fit rounded-full bg-highlight px-3 py-1 text-xs font-bold text-highlight-foreground">
                  {b.badge}
                </span>
              ) : null}
              <h2 className="text-3xl leading-tight font-extrabold tracking-tight text-balance sm:text-4xl lg:text-5xl">{b.heading}</h2>
              {b.description ? <p className="mt-3 max-w-md text-sm text-white/85 sm:text-base">{b.description}</p> : null}
              {b.linkUrl && b.ctaLabel ? (
                <Button asChild size="lg" className="mt-6 w-fit" tabIndex={i === index ? 0 : -1}>
                  <Link href={b.linkUrl}>{b.ctaLabel}</Link>
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {count > 1 ? (
        <>
          <div className="absolute right-4 bottom-4 flex gap-1.5 sm:right-6 sm:bottom-6">
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                onClick={() => go(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                className={cn("h-2 rounded-full bg-white/50 transition-all", i === index ? "w-6 bg-white" : "w-2 hover:bg-white/80")}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous slide"
            className="absolute top-1/2 left-3 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur hover:bg-white/35 sm:flex"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next slide"
            className="absolute top-1/2 right-3 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur hover:bg-white/35 sm:flex"
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </>
      ) : null}
    </section>
  )
}
