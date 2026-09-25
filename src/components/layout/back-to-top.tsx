"use client"

import { ArrowUp } from "lucide-react"
import { AnimatePresence } from "motion/react"
import * as m from "motion/react-m"
import { useEffect, useState } from "react"

/** Floating "back to top" button, shown after scrolling past the first screen. */
export function BackToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.9)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <AnimatePresence>
      {visible ? (
        <m.button
          type="button"
          aria-label="Back to top"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          initial={{ opacity: 0, y: 16, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.8 }}
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.9 }}
          className="fixed right-4 bottom-4 z-40 flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg sm:right-6 sm:bottom-6"
        >
          <ArrowUp className="size-5" aria-hidden />
        </m.button>
      ) : null}
    </AnimatePresence>
  )
}
