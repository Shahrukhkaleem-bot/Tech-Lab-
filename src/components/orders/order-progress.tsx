import { Check } from "lucide-react"

import { FULFILMENT_STEPS, ORDER_STATUS_LABELS } from "@/features/orders/status"
import { cn } from "@/lib/utils"
import type { OrderStatus } from "@/types/database"

/** Customer-facing order timeline. */
export function OrderProgress({ status }: { status: OrderStatus }) {
  if (status === "cancelled" || status === "returned") {
    return <p className="rounded-lg bg-muted p-3 text-sm font-medium">This order was {ORDER_STATUS_LABELS[status].toLowerCase()}.</p>
  }
  const current = FULFILMENT_STEPS.indexOf(status)
  return (
    <ol className="grid grid-cols-3 gap-y-4 sm:grid-cols-6" aria-label="Order progress">
      {FULFILMENT_STEPS.map((step, i) => {
        const done = i <= current
        return (
          <li key={step} className="flex flex-col items-center gap-1.5 text-center" aria-current={i === current ? "step" : undefined}>
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full border-2 text-xs font-bold",
                done ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground",
              )}
            >
              {done ? <Check className="size-3.5" aria-hidden /> : i + 1}
            </span>
            <span className={cn("text-xs", done ? "font-medium" : "text-muted-foreground")}>{ORDER_STATUS_LABELS[step]}</span>
          </li>
        )
      })}
    </ol>
  )
}
