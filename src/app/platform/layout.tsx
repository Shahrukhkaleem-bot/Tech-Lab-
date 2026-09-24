import "../globals.css"

import type { Metadata } from "next"

import { fontVariables } from "../fonts"

export const metadata: Metadata = {
  title: { default: "Commerce Platform", template: "%s | Commerce Platform" },
  description: "White-label multi-tenant e-commerce platform.",
}

/** Root layout for the platform apex domain (example.com), separate from tenant stores. */
export default function PlatformLayout({ children }: LayoutProps<"/platform">) {
  return (
    <html lang="en" className={fontVariables}>
      <body style={{ ["--font-sans" as string]: "var(--font-inter), ui-sans-serif, system-ui, sans-serif" }} className="min-h-dvh">
        {children}
      </body>
    </html>
  )
}
