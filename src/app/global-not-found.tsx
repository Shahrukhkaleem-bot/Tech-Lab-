import "./globals.css"

import type { Metadata } from "next"

export const metadata: Metadata = { title: "Not found", robots: { index: false } }

/**
 * Rendered for URLs that match no route at all, and for hosts whose tenant does not
 * exist or is not active (the tenant root layout calls notFound()). Deliberately
 * unbranded: we don't know which store (if any) the visitor wanted.
 */
export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body className="flex min-h-dvh items-center justify-center bg-background p-6 text-foreground">
        <main className="max-w-md text-center">
          <p className="text-sm font-semibold text-muted-foreground">404</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">This page or store could not be found</h1>
          <p className="mt-2 text-sm text-muted-foreground">Check the address and try again. If you own this store, make sure it is active.</p>
        </main>
      </body>
    </html>
  )
}
