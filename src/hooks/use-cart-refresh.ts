"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"

import { useCart } from "@/components/providers/store-providers"
import { refreshCartAction } from "@/features/checkout/actions"

/**
 * Re-prices the client cart against the server whenever `active` becomes true
 * (cart drawer opened, checkout page loaded) and tells the shopper what changed.
 */
export function useCartRefresh(active: boolean) {
  const items = useCart((s) => s.items)
  const hydrated = useCart((s) => s.hydrated)
  const applyServerRefresh = useCart((s) => s.applyServerRefresh)
  const inFlight = useRef(false)
  const ids = items.map((i) => i.productId).join(",")

  useEffect(() => {
    if (!active || !hydrated || !ids || inFlight.current) return
    inFlight.current = true
    const snapshot = items
    refreshCartAction(ids.split(","))
      .then((res) => {
        if (!res.ok) return
        const changes: string[] = []
        for (const u of res.data) {
          const item = snapshot.find((i) => i.productId === u.productId)
          if (!item) continue
          if (!u.available) changes.push(`${item.name} is no longer available and was removed.`)
          else if (u.unitPrice !== item.unitPrice) changes.push(`The price of ${item.name} has changed.`)
          else if (u.maxQuantity != null && item.quantity > u.maxQuantity) changes.push(`Only ${u.maxQuantity} of ${item.name} available.`)
        }
        applyServerRefresh(res.data)
        if (changes.length) toast.info("Your cart was updated", { description: changes.join(" ") })
      })
      .finally(() => {
        inFlight.current = false
      })
    // Only re-run when the drawer opens or the set of products changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, hydrated, ids])
}
