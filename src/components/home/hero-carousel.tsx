"use client"

import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react"
import { AnimatePresence, type PanInfo, type Variants } from "motion/react"
import * as m from "motion/react-m"
import { getImageProps } from "next/image"
import Link from "next/link"
import { useCallback, useState } from "react"

import { Button } from "@/components/ui/button"
import type { Banner } from "@/features/catalog/types"
import { cn } from "@/lib/utils"

const AUTOPLAY_MS = 6000
const SWIPE_PX = 60
const EASE = [0.22, 1, 0.36, 1] as const

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
      <img {...desktop} alt="" className="object-cover" draggable={false} />
    </picture>
  )
}

// Direction-aware slide: new slide enters from the side you navigate towards.
const slideVariants: Variants = {
  enter: (dir: number) => ({ x: dir >= 0 ? "12%" : "-12%", opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.9, ease: EASE } },
  exit: (dir: number) => ({ x: dir >= 0 ? "-6%" : "6%", opacity: 0, transition: { duration: 0.6, ease: EASE } }),
}

const textGroup: Variants = {
  enter: {},
  center: { transition: { staggerChildren: 0.12, delayChildren: 0.35 } },
}
const textItem: Variants = {
  enter: { opacity: 0, y: 28 },
  center: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
}

/**
 * Auto-playing hero carousel.
 * - The progress bar drives autoplay: when its CSS animation ends, the next slide shows.
 *   Pausing (hover, keyboard focus, or the pause button) freezes the bar in place.
 * - Swipe on touch, drag with a mouse, arrow keys, dots and prev/next buttons.
 * - Visible pause/play control (WCAG 2.2.2). With OS "reduce motion", slides crossfade
 *   instead of moving (MotionProvider) and autoplay still works but can be paused.
 */
export function HeroCarousel({ banners }: { banners: Banner[] }) {
  const [[index, direction], setSlide] = useState<[number, number]>([0, 0])
  const [userPaused, setUserPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const count = banners.length
  const paused = userPaused || hovered || focused

  const go = useCallback(
    (target: number, dir: number) => setSlide([((target % count) + count) % count, dir]),
    [count],
  )
  const next = useCallback(() => go(index + 1, 1), [go, index])
  const prev = useCallback(() => go(index - 1, -1), [go, index])

  if (!count) return null
  const banner = banners[index]!

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE_PX || info.velocity.x < -500) next()
    else if (info.offset.x > SWIPE_PX || info.velocity.x > 500) prev()
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured promotions"
      className="group/hero relative overflow-hidden rounded-2xl bg-secondary"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false)
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") next()
        if (e.key === "ArrowLeft") prev()
      }}
    >
      <div className="relative aspect-[4/5] sm:aspect-[16/9] lg:aspect-[21/8]">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <m.div
            key={banner.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            drag={count > 1 ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={onDragEnd}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${count}`}
            className="absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing"
          >
            {/* Slow "Ken Burns" zoom while the slide is on screen. */}
            <m.div
              className="absolute inset-0"
              initial={{ scale: 1.12 }}
              animate={{ scale: 1 }}
              transition={{ duration: AUTOPLAY_MS / 1000 + 1.5, ease: "linear" }}
            >
              <SlideImage banner={banner} priority={index === 0} />
            </m.div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent sm:bg-gradient-to-r sm:from-black/65 sm:via-black/25" />

            <m.div
              variants={textGroup}
              className="absolute inset-x-0 bottom-0 p-6 pb-14 text-white sm:inset-y-0 sm:flex sm:max-w-xl sm:flex-col sm:justify-center sm:p-12"
            >
              {banner.badge ? (
                <m.span
                  variants={textItem}
                  className="mb-3 inline-block w-fit rounded-full bg-highlight px-3 py-1 text-xs font-bold text-highlight-foreground"
                >
                  {banner.badge}
                </m.span>
              ) : null}
              <m.h2 variants={textItem} className="text-3xl leading-tight font-extrabold tracking-tight text-balance sm:text-4xl lg:text-5xl">
                {banner.heading}
              </m.h2>
              {banner.description ? (
                <m.p variants={textItem} className="mt-3 max-w-md text-sm text-white/85 sm:text-base">
                  {banner.description}
                </m.p>
              ) : null}
              {banner.linkUrl && banner.ctaLabel ? (
                <m.div variants={textItem} className="mt-6">
                  <Button asChild size="lg" className="shadow-lg transition-transform hover:scale-[1.03]">
                    <Link href={banner.linkUrl} draggable={false}>
                      {banner.ctaLabel}
                    </Link>
                  </Button>
                </m.div>
              ) : null}
            </m.div>
          </m.div>
        </AnimatePresence>
      </div>

      {count > 1 ? (
        <>
          {/* Progress bar = autoplay timer. Keyed by slide so it restarts each time. */}
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/15" aria-hidden>
            <div
              key={`${banner.id}-${index}`}
              className="hero-progress h-full origin-left bg-white/90"
              style={{ animationDuration: `${AUTOPLAY_MS}ms`, animationPlayState: paused ? "paused" : "running" }}
              onAnimationEnd={next}
            />
          </div>

          <div className="absolute right-3 bottom-2 flex items-center sm:right-5 sm:bottom-4">
            <button
              type="button"
              onClick={() => setUserPaused((p) => !p)}
              aria-label={userPaused ? "Play slideshow" : "Pause slideshow"}
              className="mr-1 flex size-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition hover:bg-white/35"
            >
              {userPaused ? <Play className="size-3.5 fill-current" aria-hidden /> : <Pause className="size-3.5 fill-current" aria-hidden />}
            </button>
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                onClick={() => go(i, i > index ? 1 : -1)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                className="group/dot flex h-9 min-w-7 items-center justify-center px-1"
              >
                <span
                  aria-hidden
                  className={cn("block h-2 rounded-full bg-white/50 transition-all duration-300", i === index ? "w-7 bg-white" : "w-2 group-hover/dot:bg-white/80")}
                />
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={prev}
            aria-label="Previous slide"
            className="absolute top-1/2 left-3 hidden size-11 -translate-x-3 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white opacity-0 backdrop-blur transition-all duration-300 group-hover/hero:translate-x-0 group-hover/hero:opacity-100 hover:bg-white/35 focus-visible:translate-x-0 focus-visible:opacity-100 sm:flex"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next slide"
            className="absolute top-1/2 right-3 hidden size-11 translate-x-3 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white opacity-0 backdrop-blur transition-all duration-300 group-hover/hero:translate-x-0 group-hover/hero:opacity-100 hover:bg-white/35 focus-visible:translate-x-0 focus-visible:opacity-100 sm:flex"
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </>
      ) : null}
    </section>
  )
}
