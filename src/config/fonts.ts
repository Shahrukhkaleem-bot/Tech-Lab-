/**
 * Allow-listed tenant fonts. next/font must be declared statically, so tenants choose
 * from this list (brand_config.font_family) instead of loading arbitrary font URLs.
 * Adding a font = add it here and in src/app/fonts.ts.
 */
export const FONT_OPTIONS = [
  { value: "inter", label: "Inter" },
  { value: "poppins", label: "Poppins" },
  { value: "nunito", label: "Nunito" },
  { value: "montserrat", label: "Montserrat" },
  { value: "lato", label: "Lato" },
] as const

export type FontKey = (typeof FONT_OPTIONS)[number]["value"]

export const DEFAULT_FONT: FontKey = "inter"

export function isFontKey(value: unknown): value is FontKey {
  return FONT_OPTIONS.some((f) => f.value === value)
}
