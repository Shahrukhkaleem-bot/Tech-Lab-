"use client"

import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  updateInternalNoteAction,
  updateOrderStatusAction,
  updatePaymentStatusAction,
  updateTrackingAction,
} from "@/features/admin/orders/actions"
import { PAYMENT_STATUSES } from "@/features/admin/orders/schemas"
import { nextStatuses, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/features/orders/status"
import type { ActionResult } from "@/lib/errors/app-error"
import type { OrderStatus, PaymentStatus } from "@/types/database"

import { FormSection, nativeSelectClass } from "../form-controls"

function useRun() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<ActionResult<unknown>>, success: string) =>
    start(async () => {
      const res = await fn()
      if (!res.ok) return void toast.error(res.error.message)
      toast.success(success)
      router.refresh()
    })
  return { pending, run }
}

type Props = {
  orderId: string
  orderStatus: OrderStatus
  paymentStatus: PaymentStatus
  courierName: string | null
  trackingNumber: string | null
  trackingUrl: string | null
  internalNotes: string | null
  canManage: boolean
}

export function OrderActions(props: Props) {
  const { pending, run } = useRun()
  const options = nextStatuses(props.orderStatus).filter((s) => props.canManage || (s !== "cancelled" && s !== "returned"))
  const [picked, setPicked] = useState<OrderStatus | "">(options[0] ?? "")
  // After a save the next-step options change; fall back to the first valid one.
  const status = picked && options.includes(picked) ? picked : (options[0] ?? "")
  const setStatus = setPicked
  const [note, setNote] = useState("")
  const [restock, setRestock] = useState(true)
  // A pick only counts against the payment status it was made on (status changes can move it too).
  const [paymentPick, setPaymentPick] = useState<{ from: PaymentStatus; to: PaymentStatus } | null>(null)
  const payment = paymentPick?.from === props.paymentStatus ? paymentPick.to : props.paymentStatus
  const setPayment = (to: PaymentStatus) => setPaymentPick({ from: props.paymentStatus, to })
  const [courier, setCourier] = useState(props.courierName ?? "")
  const [tracking, setTracking] = useState(props.trackingNumber ?? "")
  const [trackingUrl, setTrackingUrl] = useState(props.trackingUrl ?? "")
  const [internal, setInternal] = useState(props.internalNotes ?? "")
  const closing = status === "cancelled" || status === "returned"

  return (
    <div className="space-y-6">
      <FormSection title="Order status">
        {options.length ? (
          <>
            <select className={nativeSelectClass} value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)} aria-label="New status">
              {options.map((s) => (
                <option key={s} value={s}>
                  {ORDER_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            {closing ? (
              <>
                <Textarea rows={2} placeholder="Reason (saved to history)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Reason" />
                {status === "returned" ? (
                  <div className="flex items-center gap-2">
                    <Checkbox id="restock" checked={restock} onCheckedChange={(c) => setRestock(c === true)} />
                    <Label htmlFor="restock" className="font-normal">
                      Return items to stock
                    </Label>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Cancelling restores stock and releases any coupon usage.</p>
                )}
              </>
            ) : null}
            <Button
              className="w-full"
              variant={closing ? "destructive" : "default"}
              disabled={pending || !status}
              onClick={() => run(() => updateOrderStatusAction({ orderId: props.orderId, status, note: note || undefined, restock }), "Order updated")}
            >
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Update status
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">This order is closed.</p>
        )}
      </FormSection>

      {props.canManage ? (
        <FormSection title="Payment">
          <select className={nativeSelectClass} value={payment} onChange={(e) => setPayment(e.target.value as PaymentStatus)} aria-label="Payment status">
            {PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PAYMENT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            className="w-full"
            disabled={pending || payment === props.paymentStatus}
            onClick={() => run(() => updatePaymentStatusAction({ orderId: props.orderId, status: payment }), "Payment status updated")}
          >
            Save payment status
          </Button>
        </FormSection>
      ) : null}

      <FormSection title="Shipment" description="Courier details are shown to the customer.">
        <div className="grid gap-1.5">
          <Label htmlFor="courier">Courier</Label>
          <Input id="courier" value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="TCS, Leopards, Trax…" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tracking">Tracking number</Label>
          <Input id="tracking" value={tracking} onChange={(e) => setTracking(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="trackingUrl">Tracking link (optional)</Label>
          <Input id="trackingUrl" value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} placeholder="https://" />
        </div>
        <Button
          variant="outline"
          className="w-full"
          disabled={pending || !courier || !tracking}
          onClick={() =>
            run(() => updateTrackingAction({ orderId: props.orderId, courierName: courier, trackingNumber: tracking, trackingUrl, markShipped: true }), "Tracking saved")
          }
        >
          Save tracking {["confirmed", "processing"].includes(props.orderStatus) ? "& mark shipped" : ""}
        </Button>
      </FormSection>

      <FormSection title="Internal notes" description="Only visible to staff.">
        <Textarea rows={3} value={internal} onChange={(e) => setInternal(e.target.value)} aria-label="Internal notes" />
        <Button variant="outline" className="w-full" disabled={pending} onClick={() => run(() => updateInternalNoteAction({ orderId: props.orderId, note: internal }), "Note saved")}>
          Save note
        </Button>
      </FormSection>
    </div>
  )
}
