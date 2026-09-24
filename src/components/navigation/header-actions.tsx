"use client"

import { Heart, Search, ShoppingBag, User } from "lucide-react"
import Link from "next/link"

import { useCart, useWishlist } from "@/components/providers/store-providers"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { selectItemCount } from "@/stores/cart-store"
import { useUiStore } from "@/stores/ui-store"

import { SearchBox } from "./search-box"

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="absolute -top-0.5 -right-0.5 flex min-w-4.5 items-center justify-center rounded-full bg-highlight px-1 text-[10px] leading-4.5 font-bold text-highlight-foreground">
      {count > 99 ? "99+" : count}
    </span>
  )
}

const iconBtn = "relative inline-flex size-10 items-center justify-center rounded-full transition-colors hover:bg-accent"

export function HeaderActions() {
  const count = useCart(selectItemCount)
  const hydrated = useCart((s) => s.hydrated)
  const wishCount = useWishlist((s) => s.items.length)
  const setCartOpen = useUiStore((s) => s.setCartOpen)
  const searchOpen = useUiStore((s) => s.searchOpen)
  const setSearchOpen = useUiStore((s) => s.setSearchOpen)

  return (
    <div className="flex items-center gap-0.5 sm:gap-1">
      <button type="button" className={`${iconBtn} md:hidden`} aria-label="Search" onClick={() => setSearchOpen(true)}>
        <Search className="size-5" aria-hidden />
      </button>
      <Link href="/account" className={`${iconBtn} hidden sm:inline-flex`} aria-label="My account">
        <User className="size-5" aria-hidden />
      </Link>
      <Link href="/wishlist" className={iconBtn} aria-label={`Wishlist (${wishCount} items)`}>
        <Heart className="size-5" aria-hidden />
        {hydrated ? <CountBadge count={wishCount} /> : null}
      </Link>
      <button type="button" className={iconBtn} aria-label={`Cart (${count} items)`} onClick={() => setCartOpen(true)}>
        <ShoppingBag className="size-5" aria-hidden />
        {hydrated ? <CountBadge count={count} /> : null}
      </button>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="top-4 translate-y-0 p-4 sm:top-[10%]">
          <DialogTitle className="sr-only">Search</DialogTitle>
          <DialogDescription className="sr-only">Search the store</DialogDescription>
          <SearchBox autoFocus onNavigate={() => setSearchOpen(false)} className="pr-8" />
        </DialogContent>
      </Dialog>
    </div>
  )
}
