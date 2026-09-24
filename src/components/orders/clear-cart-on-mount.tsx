"use client"

import { useEffect } from "react"

import { useCart } from "@/components/providers/store-providers"

/** Empties the cart once an order is confirmed (covers the hosted-payment return path). */
export function ClearCartOnMount() {
  const hydrated = useCart((s) => s.hydrated)
  const clear = useCart((s) => s.clear)
  useEffect(() => {
    if (hydrated) clear()
  }, [hydrated, clear])
  return null
}
