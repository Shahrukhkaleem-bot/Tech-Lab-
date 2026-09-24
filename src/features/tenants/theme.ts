import type { CSSProperties } from "react"

import { readableForeground } from "@/lib/utils/color"

import type { Tenant } from "./types"

/**
 * Tenant brand → CSS custom properties, applied on <body> by the tenant root layout.
 * Every shadcn/Tailwind colour utility reads these variables, so re-theming a store
 * is data-only.
 *
 *   --primary / --primary-foreground      buttons, links, focus rings
 *   --secondary / --secondary-foreground  dark surfaces (top bar, footer)
 *   --highlight / --highlight-foreground  tenant accent: sale badges, callouts
 *   --accent / --accent-foreground        subtle hover surfaces (tint of primary)
 *   --radius, --font-sans                 shape + typography
 *
 * Note: shadcn uses `--accent` for hover backgrounds, so the tenant's accent colour is
 * exposed as `--highlight` to keep hover states legible for any brand colour.
 */
export function buildThemeStyle(brand: Tenant["brand"]): CSSProperties {
  const vars: Record<string, string> = {
    "--primary": brand.primaryColor,
    "--primary-foreground": readableForeground(brand.primaryColor),
    "--secondary": brand.secondaryColor,
    "--secondary-foreground": readableForeground(brand.secondaryColor),
    "--highlight": brand.accentColor,
    "--highlight-foreground": readableForeground(brand.accentColor),
    "--accent": `color-mix(in oklab, ${brand.primaryColor} 8%, white)`,
    "--accent-foreground": "#111827",
    "--ring": brand.primaryColor,
    "--radius": brand.radius,
    "--font-sans": `var(--font-${brand.font}), ui-sans-serif, system-ui, sans-serif`,
  }
  return vars as CSSProperties
}
