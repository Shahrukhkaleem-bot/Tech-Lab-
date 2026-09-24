"use client"

import "./globals.css"

/** Last-resort boundary (errors in root layouts). Must render its own <html>. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh items-center justify-center bg-background p-6 text-foreground">
        <main className="max-w-md text-center" role="alert">
          <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            An unexpected error occurred. Please try again.
            {error.digest ? <span className="mt-1 block text-xs">Reference: {error.digest}</span> : null}
          </p>
          <button type="button" onClick={reset} className="mt-6 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background">
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
