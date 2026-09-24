import "server-only"

import { postgresSearchProvider } from "./postgres-provider"
import type { ProductSearchProvider } from "./types"

/**
 * Single switch point for the search backend. To add Algolia/Typesense:
 *  1. implement ProductSearchProvider in ./algolia-provider.ts
 *  2. sync products on write (admin actions or a DB webhook → Edge Function)
 *  3. return it here based on an env flag.
 */
export function getSearchProvider(): ProductSearchProvider {
  return postgresSearchProvider
}

export type { ProductSearchProvider, ProductSearchQuery } from "./types"
