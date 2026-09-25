"use client"

import { useEffect, useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

/** Sticky header that gains a shadow and stronger backdrop once the page is scrolled. */
export function StickyHeader({ children, className }: { children: ReactNode; className?: string }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header
      data-scrolled={scrolled || undefined}
      className={cn("transition-[box-shadow,background-color] duration-300 data-[scrolled]:bg-background/95 data-[scrolled]:shadow-[0_8px_24px_-12px_rgb(0_0_0/0.18)]", className)}
    >
      {children}
    </header>
  )
}
