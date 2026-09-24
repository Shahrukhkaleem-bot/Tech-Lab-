/**
 * Only same-origin, path-relative redirects are allowed after login ("/admin/orders").
 * Blocks open redirects such as "//evil.com", "https://evil.com", "/\\evil.com".
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || typeof next !== "string") return fallback
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback
  if (/[\r\n\t]/.test(next) || next.length > 512) return fallback
  return next
}
