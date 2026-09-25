"use client"

import { domAnimation, LazyMotion, MotionConfig } from "motion/react"
import type { ReactNode } from "react"

/**
 * Loads Motion's DOM animation features once (lazy, ~15 kB) for every `m.*` component.
 * `reducedMotion="user"`: when the OS asks for reduced motion, transforms are skipped and
 * only opacity animates, so content still appears but nothing slides or zooms.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  )
}
