/** Colour helpers for tenant theming (pure, unit-tested). */

export type Rgb = { r: number; g: number; b: number }

export function hexToRgb(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = Number.parseInt(m[1]!, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

/** WCAG 2.x relative luminance (0 = black, 1 = white). */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [number, number]
  return (l1 + 0.05) / (l2 + 0.05)
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 }
const NEAR_BLACK: Rgb = { r: 17, g: 24, b: 39 }

/** Picks white or near-black text, whichever has the higher contrast on `background`. */
export function readableForeground(background: string): "#ffffff" | "#111827" {
  const bg = hexToRgb(background)
  if (!bg) return "#ffffff"
  return contrastRatio(bg, WHITE) >= contrastRatio(bg, NEAR_BLACK) ? "#ffffff" : "#111827"
}
