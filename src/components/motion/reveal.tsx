"use client"

import type { Variants } from "motion/react"
import * as m from "motion/react-m"
import type { ReactNode } from "react"

/**
 * Scroll-reveal primitives (Motion `whileInView`). They wrap Server Component children
 * without turning them into client code. Each element animates once, when ~15% of it
 * enters the viewport.
 */

const EASE = [0.22, 1, 0.36, 1] as const
const VIEWPORT = { once: true, amount: 0.15 } as const

type Direction = "up" | "down" | "left" | "right" | "none"

function offset(direction: Direction, distance: number) {
  switch (direction) {
    case "up":
      return { y: distance }
    case "down":
      return { y: -distance }
    case "left":
      return { x: distance }
    case "right":
      return { x: -distance }
    default:
      return {}
  }
}

type RevealProps = {
  children: ReactNode
  className?: string
  direction?: Direction
  distance?: number
  delay?: number
  duration?: number
  as?: "div" | "section" | "li"
}

/** Fades (and slides) a block into view once. */
export function Reveal({ children, className, direction = "up", distance = 32, delay = 0, duration = 0.7, as = "div" }: RevealProps) {
  const Tag = m[as]
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, ...offset(direction, distance) }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={VIEWPORT}
      transition={{ duration, delay, ease: EASE }}
    >
      {children}
    </Tag>
  )
}

const groupVariants = (stagger: number): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: stagger, delayChildren: 0.05 } },
})

export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.55, ease: EASE } },
}

/** Container whose RevealItem children animate in one after another. */
export function RevealGroup({
  children,
  className,
  stagger = 0.08,
  as = "div",
  ...rest
}: {
  children: ReactNode
  className?: string
  stagger?: number
  as?: "div" | "ul"
} & Record<`aria-${string}`, string>) {
  const Tag = m[as]
  return (
    <Tag className={className} variants={groupVariants(stagger)} initial="hidden" whileInView="visible" viewport={VIEWPORT} {...rest}>
      {children}
    </Tag>
  )
}

export function RevealItem({ children, className, as = "div" }: { children: ReactNode; className?: string; as?: "div" | "li" }) {
  const Tag = m[as]
  return (
    <Tag className={className} variants={itemVariants}>
      {children}
    </Tag>
  )
}
