import type { NextConfig } from "next"

/**
 * Security headers + image allow-list.
 *
 * CSP trade-off: script-src allows 'unsafe-inline' because nonce-based CSP forces
 * every page to render dynamically, defeating per-tenant ISR/CDN caching. XSS is
 * mitigated at the source instead (no raw-HTML rendering of tenant content, escaped
 * JSON-LD, SVG uploads rejected). All other directives are strict.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null
const supabaseOrigin = supabaseUrl?.origin ?? ""
const supabaseWs = supabaseUrl ? `wss://${supabaseUrl.host}` : ""
const isDev = process.env.NODE_ENV !== "production"

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // Tenant logos/banners may live on any https CDN; catalogue images on Supabase Storage.
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseWs}`.trim(),
  "frame-src https://www.google.com https://maps.google.com",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ")

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Required with multiple root layouts ([domain] and platform).
    globalNotFound: true,
  },
  images: {
    remotePatterns: [
      ...(supabaseUrl
        ? [{ protocol: "https" as const, hostname: supabaseUrl.hostname, pathname: "/storage/v1/object/public/**" }]
        : []),
      // Local Supabase (supabase start) serves storage over http://127.0.0.1:54321
      ...(isDev ? [{ protocol: "http" as const, hostname: "127.0.0.1", port: "54321", pathname: "/storage/v1/object/public/**" }] : []),
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

export default nextConfig
