"use client"

import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react"
import { AnimatePresence, type PanInfo, type Variants } from "motion/react"
import * as m from "motion/react-m"
import { getImageProps } from "next/image"
import Link from "next/link"
import { useCallback, useRef, useState, type CSSProperties } from "react"

import { Button } from "@/components/ui/button"
import type { Banner } from "@/features/catalog/types"
import { cn } from "@/lib/utils"

const AUTOPLAY_MS = 6000
const SWIPE_PX = 60
const EASE = [0.22, 1, 0.36, 1] as const
// Used only until an image without stored dimensions reports its real size.
const FALLBACK_DESKTOP = 21 / 8
const FALLBACK_MOBILE = 16 / 9

type Size = { width: number; height: number }
const ratio = (s: Size | null | undefined) => (s ? s.width / s.height : null)

/** Art-directed image: separate mobile/desktop sources via <picture>. Always shown whole. */
function SlideImage({ banner, priority, onMeasure }: { banner: Banner; priority: boolean; onMeasure: (s: Size) => void }) {
  const common = { alt: "", fill: true, priority, sizes: "(min-width: 1280px) 1216px, 100vw" } as const
  const desktop = getImageProps({ ...common, src: banner.desktopImageUrl, unoptimized: banner.desktopImageUrl.endsWith(".svg") }).props
  const mobileSrc = banner.mobileImageUrl ?? banner.desktopImageUrl
  const mobile = getImageProps({ ...common, src: mobileSrc, unoptimized: mobileSrc.endsWith(".svg") }).props

  return (
    <picture>
      <source media="(min-width: 640px)" srcSet={desktop.srcSet ?? desktop.src} />
      <source srcSet={mobile.srcSet ?? mobile.src} />
      <img
        {...desktop}
        alt=""
        className="object-contain"
        draggable={false}
        onLoad={(e) => {
          const img = e.currentTarget
          if (img.naturalWidth && img.naturalHeight) onMeasure({ width: img.naturalWidth, height: img.naturalHeight })
        }}
      />
    </picture>
  )
}

const slideVariants: Variants = {
  enter: (dir: number) => ({ x: dir >= 0 ? "12%" : "-12%", opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.8, ease: EASE } },
  exit: (dir: number) => ({ x: dir >= 0 ? "-6%" : "6%", opacity: 0, transition: { duration: 0.5, ease: EASE } }),
}
const textGroup: Variants = { enter: {}, center: { transition: { staggerChildren: 0.12, delayChildren: 0.3 } } }
const textItem: Variants = {
  enter: { opacity: 0, y: 24 },
  center: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
}

function BannerText({ banner, className }: { banner: Banner; className?: string }) {
  return (
    <m.div variants={textGroup} initial="enter" animate="center" className={className}>
      {banner.badge ? (
        <m.span variants={textItem} className="mb-3 inline-block w-fit rounded-full bg-highlight px-3 py-1 text-xs font-bold text-highlight-foreground">
          {banner.badge}
        </m.span>
      ) : null}
      <m.h2 variants={textItem} className="text-2xl leading-tight font-extrabold tracking-tight text-balance sm:text-4xl lg:text-5xl">
        {banner.heading}
      </m.h2>
      {banner.description ? (
        <m.p variants={textItem} className="mt-2 max-w-md text-sm opacity-85 sm:mt-3 sm:text-base">
          {banner.description}
        </m.p>
      ) : null}
      {banner.linkUrl && banner.ctaLabel ? (
        <m.div variants={textItem} className="mt-4 sm:mt-6">
          <Button asChild size="lg" className="h-11 shadow-lg transition-transform hover:scale-[1.03]">
            <Link href={banner.linkUrl} draggable={false}>
              {banner.ctaLabel}
            </Link>
          </Button>
        </m.div>
      ) : null}
    </m.div>
  )
}

type SlideControlsProps = {
  className?: string
  tone: "light" | "dark"
  count: number
  index: number
  userPaused: boolean
  onTogglePause: () => void
  onGo: (i: number) => void
}

/** Pause/play + slide dots. Light tone floats over images; dark tone sits on the page background. */
function SlideControls({ className, tone, count, index, userPaused, onTogglePause, onGo }: SlideControlsProps) {
  const light = tone === "light"
  return (
    <div className={cn("items-center", className)}>
      <button
        type="button"
        onClick={onTogglePause}
        aria-label={userPaused ? "Play slideshow" : "Pause slideshow"}
        className={cn("flex size-9 items-center justify-center rounded-full transition", light ? "text-white hover:bg-white/20" : "text-foreground hover:bg-accent")}
      >
        {userPaused ? <Play className="size-3.5 fill-current" aria-hidden /> : <Pause className="size-3.5 fill-current" aria-hidden />}
      </button>
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onGo(i)}
          aria-label={`Go to slide ${i + 1}`}
          aria-current={i === index}
          className="group/dot flex h-9 min-w-7 items-center justify-center px-1"
        >
          <span
            aria-hidden
            className={cn(
              "block h-2 rounded-full transition-all duration-300",
              i === index ? "w-6" : "w-2",
              light ? (i === index ? "bg-white" : "bg-white/60 group-hover/dot:bg-white/90") : i === index ? "bg-primary" : "bg-muted-foreground/35 group-hover/dot:bg-muted-foreground/60",
            )}
          />
        </button>
      ))}
    </div>
  )
}

/**
 * Auto-playing hero carousel.
 * - Every slide keeps its image's real aspect ratio (nothing is cropped on phones). Sizes
 *   come from the database (captured at upload) or are measured once the image loads.
 * - Banners whose image already contains text (showText=false) render as-is and link as a whole.
 * - Banners with text: overlay on tablet/desktop, text panel BELOW the image on phones.
 * - The progress bar drives autoplay; hover/focus/pause button freeze it (WCAG 2.2.2).
 * - Swipe, mouse drag, arrow keys, dots and prev/next.
 */
export function HeroCarousel({ banners }: { banners: Banner[] }) {
  const [[index, direction], setSlide] = useState<[number, number]>([0, 0])
  const [userPaused, setUserPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [measured, setMeasured] = useState<Record<string, Size>>({})
  const dragged = useRef(false)
  const count = banners.length
  const paused = userPaused || hovered || focused

  const go = useCallback((target: number, dir: number) => setSlide([((target % count) + count) % count, dir]), [count])
  const next = useCallback(() => go(index + 1, 1), [go, index])
  const prev = useCallback(() => go(index - 1, -1), [go, index])

  if (!count) return null
  const banner = banners[index]!
  const seen = measured[banner.id]
  const desktopRatio = ratio(banner.desktopSize) ?? ratio(seen) ?? FALLBACK_DESKTOP
  const mobileRatio =
    ratio(banner.mobileSize) ?? (banner.mobileImageUrl ? ratio(seen) : null) ?? ratio(banner.desktopSize) ?? ratio(seen) ?? FALLBACK_MOBILE
  const imageOnly = !banner.showText
  const linkLabel = banner.heading.trim().length > 1 ? banner.heading : "View offer"

  const onDragEnd = (_: unknown, info: PanInfo) => {
    dragged.current = Math.abs(info.offset.x) > 8
    if (info.offset.x < -SWIPE_PX || info.velocity.x < -500) next()
    else if (info.offset.x > SWIPE_PX || info.velocity.x > 500) prev()
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured promotions"
      className="group/hero relative overflow-hidden rounded-2xl border bg-card"
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
      {/* Box takes the current image's shape; its height animates between slides of different shapes. */}
      <div
        className="relative aspect-[var(--hero-ar-m)] max-h-[75vh] w-full transition-[aspect-ratio] duration-500 ease-out sm:aspect-[var(--hero-ar-d)]"
        style={{ "--hero-ar-m": mobileRatio, "--hero-ar-d": desktopRatio } as CSSProperties}
      >
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
            onDragStart={() => (dragged.current = false)}
            onDragEnd={onDragEnd}
            onClickCapture={(e) => {
              // A swipe must not also follow the banner link.
              if (dragged.current) {
                e.preventDefault()
                e.stopPropagation()
                dragged.current = false
              }
            }}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${count}`}
            className={cn("absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing", imageOnly ? "bg-card" : "bg-secondary")}
          >
            {/* Photo banners get a gentle zoom; image-only banners (text inside) never move or crop. */}
            <m.div
              className="absolute inset-0"
              initial={imageOnly ? false : { scale: 1.06 }}
              animate={{ scale: 1 }}
              transition={{ duration: AUTOPLAY_MS / 1000 + 1.5, ease: "linear" }}
            >
              <SlideImage
                banner={banner}
                priority={index === 0}
                onMeasure={(s) => setMeasured((prev) => (prev[banner.id] ? prev : { ...prev, [banner.id]: s }))}
              />
            </m.div>

            {imageOnly ? (
              banner.linkUrl ? <Link href={banner.linkUrl} aria-label={linkLabel} className="absolute inset-0" draggable={false} /> : null
            ) : (
              <>
                {/* Text overlay: tablet/desktop only (phones show it below the image). */}
                <div className="absolute inset-0 hidden bg-gradient-to-r from-black/65 via-black/25 to-transparent sm:block" />
                <BannerText banner={banner} className="absolute inset-y-0 left-0 hidden max-w-xl flex-col justify-center p-12 text-white sm:flex" />
                {banner.linkUrl && !banner.ctaLabel ? (
                  <Link href={banner.linkUrl} aria-label={linkLabel} className="absolute inset-0" draggable={false} />
                ) : null}
              </>
            )}
          </m.div>
        </AnimatePresence>

        {count > 1 ? (
          <>
            <div className="absolute inset-x-0 bottom-0 z-10 h-1 bg-black/10" aria-hidden>
              <div
                key={`${banner.id}-${index}`}
                className="hero-progress h-full origin-left bg-primary"
                style={{ animationDuration: `${AUTOPLAY_MS}ms`, animationPlayState: paused ? "paused" : "running" }}
                onAnimationEnd={next}
              />
            </div>

            {/* Tablet/desktop: controls float over the image. */}
            <SlideControls
              className="absolute right-4 bottom-3 z-10 hidden rounded-full bg-black/35 px-1 backdrop-blur-sm sm:flex"
              tone="light"
              count={count}
              index={index}
              userPaused={userPaused}
              onTogglePause={() => setUserPaused((p) => !p)}
              onGo={(i) => go(i, i > index ? 1 : -1)}
            />

            <button
              type="button"
              onClick={prev}
              aria-label="Previous slide"
              className="absolute top-1/2 left-3 z-10 hidden size-11 -translate-x-3 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white opacity-0 backdrop-blur transition-all duration-300 group-hover/hero:translate-x-0 group-hover/hero:opacity-100 hover:bg-black/50 focus-visible:translate-x-0 focus-visible:opacity-100 sm:flex"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next slide"
              className="absolute top-1/2 right-3 z-10 hidden size-11 translate-x-3 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white opacity-0 backdrop-blur transition-all duration-300 group-hover/hero:translate-x-0 group-hover/hero:opacity-100 hover:bg-black/50 focus-visible:translate-x-0 focus-visible:opacity-100 sm:flex"
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </>
        ) : null}
      </div>

      {/* Phones: controls sit below the image (a short wide banner has no room for them on top). */}
      {count > 1 ? (
        <SlideControls
          className="flex justify-center border-t bg-card sm:hidden"
          tone="dark"
          count={count}
          index={index}
          userPaused={userPaused}
          onTogglePause={() => setUserPaused((p) => !p)}
          onGo={(i) => go(i, i > index ? 1 : -1)}
        />
      ) : null}

      {/* Phones: banner text sits below the image so it never covers it. */}
      {!imageOnly ? <BannerText key={`text-${banner.id}`} banner={banner} className="bg-secondary p-5 text-secondary-foreground sm:hidden" /> : null}
    </section>
  )
}
