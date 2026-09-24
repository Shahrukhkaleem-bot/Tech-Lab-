import type { Metadata } from "next"

import { Breadcrumbs } from "@/components/navigation/breadcrumbs"
import { WishlistView } from "@/components/wishlist/wishlist-view"

export const metadata: Metadata = { title: "Wishlist", robots: { index: false } }

export default function WishlistPage() {
  return (
    <div className="container-page py-6 sm:py-8">
      <Breadcrumbs items={[{ name: "Wishlist" }]} />
      <h1 className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">My wishlist</h1>
      <WishlistView />
    </div>
  )
}
