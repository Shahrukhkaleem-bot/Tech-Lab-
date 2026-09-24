"use client"

import { Loader2, Plus, Trash2 } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { savePaymentSettingsAction, saveShippingSettingsAction } from "@/features/admin/settings/actions"
import { PAYMENT_METHOD_LABELS } from "@/features/orders/status"
import type { BankAccount, ShippingConfig } from "@/features/tenants/types"
import type { PaymentMethod } from "@/types/database"

import { Field, FormSection } from "../form-controls"
import { useSave } from "./use-save"

export function ShippingSettingsForm({ initial }: { initial: ShippingConfig & { shippingInfo: string; returnInfo: string } }) {
  const [v, setV] = useState(initial)
  const { pending, save } = useSave()

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault()
        save(() => saveShippingSettingsAction(v))
      }}
    >
      <FormSection title="Rates" description="Applied at checkout: free above threshold → city rate → flat rate.">
        <div className="grid gap-4 sm:grid-cols-4">
          <Field id="flat" label="Flat rate">
            <Input id="flat" inputMode="decimal" value={v.flat_rate} onChange={(e) => setV({ ...v, flat_rate: Number(e.target.value) || 0 })} />
          </Field>
          <Field id="free" label="Free shipping above">
            <Input
              id="free"
              inputMode="decimal"
              value={v.free_shipping_threshold ?? ""}
              onChange={(e) => setV({ ...v, free_shipping_threshold: e.target.value === "" ? undefined : Number(e.target.value) })}
              placeholder="No free shipping"
            />
          </Field>
          <Field id="dmin" label="Delivery days (min)">
            <Input id="dmin" inputMode="numeric" value={v.estimated_days?.min ?? ""} onChange={(e) => setV({ ...v, estimated_days: { min: Number(e.target.value) || 0, max: v.estimated_days?.max ?? 0 } })} />
          </Field>
          <Field id="dmax" label="Delivery days (max)">
            <Input id="dmax" inputMode="numeric" value={v.estimated_days?.max ?? ""} onChange={(e) => setV({ ...v, estimated_days: { min: v.estimated_days?.min ?? 0, max: Number(e.target.value) || 0 } })} />
          </Field>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">City-specific rates</p>
          {v.city_rates.map((r, i) => (
            <div key={i} className="flex gap-2">
              <Input aria-label="City" value={r.city} onChange={(e) => setV({ ...v, city_rates: v.city_rates.map((x, j) => (j === i ? { ...x, city: e.target.value } : x)) })} placeholder="City" />
              <Input aria-label="Rate" inputMode="decimal" value={r.rate} onChange={(e) => setV({ ...v, city_rates: v.city_rates.map((x, j) => (j === i ? { ...x, rate: Number(e.target.value) || 0 } : x)) })} />
              <Button type="button" variant="ghost" size="icon" aria-label="Remove city rate" onClick={() => setV({ ...v, city_rates: v.city_rates.filter((_, j) => j !== i) })}>
                <Trash2 aria-hidden />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setV({ ...v, city_rates: [...v.city_rates, { city: "", rate: 0 }] })}>
            <Plus aria-hidden /> Add city
          </Button>
        </div>
        <Field id="couriers" label="Couriers" hint="Comma separated. Suggested when adding tracking.">
          <Input id="couriers" value={v.couriers.join(", ")} onChange={(e) => setV({ ...v, couriers: e.target.value.split(",").map((c) => c.trim()).filter(Boolean) })} />
        </Field>
      </FormSection>
      <FormSection title="Policies shown on product pages">
        <Field id="ship-info" label="Shipping information">
          <Textarea id="ship-info" rows={3} value={v.shippingInfo} onChange={(e) => setV({ ...v, shippingInfo: e.target.value })} />
        </Field>
        <Field id="return-info" label="Returns & warranty">
          <Textarea id="return-info" rows={3} value={v.returnInfo} onChange={(e) => setV({ ...v, returnInfo: e.target.value })} />
        </Field>
      </FormSection>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} Save shipping
      </Button>
    </form>
  )
}

const METHODS: PaymentMethod[] = ["cod", "bank_transfer", "card", "wallet"]

export function PaymentSettingsForm({
  initial,
  cardConfigured,
}: {
  initial: { enabled_methods: PaymentMethod[]; bank_accounts: BankAccount[]; instructions: string; stripe_account_id: string }
  cardConfigured: boolean
}) {
  const [v, setV] = useState(initial)
  const { pending, save } = useSave()
  const emptyAccount: BankAccount = { bank_name: "", account_title: "", account_number: "", iban: "" }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault()
        save(() => savePaymentSettingsAction(v))
      }}
    >
      <FormSection title="Payment methods">
        {METHODS.map((m) => {
          const unavailable = (m === "card" && !cardConfigured) || m === "wallet"
          return (
            <div key={m} className="flex items-start gap-2">
              <Checkbox
                id={`pm-${m}`}
                checked={v.enabled_methods.includes(m)}
                disabled={unavailable && !v.enabled_methods.includes(m)}
                onCheckedChange={(c) => setV({ ...v, enabled_methods: c ? [...v.enabled_methods, m] : v.enabled_methods.filter((x) => x !== m) })}
              />
              <Label htmlFor={`pm-${m}`} className="flex-col items-start gap-0.5 font-normal">
                <span className="font-medium">{PAYMENT_METHOD_LABELS[m]}</span>
                {m === "card" && !cardConfigured ? <span className="text-xs text-muted-foreground">Requires platform Stripe keys (STRIPE_SECRET_KEY).</span> : null}
                {m === "wallet" ? <span className="text-xs text-muted-foreground">Local gateway integration not configured yet.</span> : null}
                {m === "bank_transfer" ? <span className="text-xs text-muted-foreground">Requires at least one bank account below.</span> : null}
              </Label>
            </div>
          )
        })}
      </FormSection>
      <FormSection title="Bank accounts" description="Shown to customers who choose bank transfer.">
        {v.bank_accounts.map((a, i) => (
          <div key={i} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
            {(["bank_name", "account_title", "account_number", "iban"] as const).map((k) => (
              <Input
                key={k}
                aria-label={k.replace("_", " ")}
                placeholder={k.replace("_", " ")}
                value={a[k] ?? ""}
                onChange={(e) => setV({ ...v, bank_accounts: v.bank_accounts.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)) })}
              />
            ))}
            <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => setV({ ...v, bank_accounts: v.bank_accounts.filter((_, j) => j !== i) })}>
              <Trash2 aria-hidden /> Remove
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setV({ ...v, bank_accounts: [...v.bank_accounts, emptyAccount] })}>
          <Plus aria-hidden /> Add bank account
        </Button>
        <Field id="pay-instr" label="Payment instructions">
          <Textarea id="pay-instr" rows={2} value={v.instructions} onChange={(e) => setV({ ...v, instructions: e.target.value })} />
        </Field>
      </FormSection>
      {cardConfigured ? (
        <FormSection title="Stripe Connect" description="Optional: route card payments to this store's connected Stripe account.">
          <Field id="acct" label="Connected account ID">
            <Input id="acct" value={v.stripe_account_id} onChange={(e) => setV({ ...v, stripe_account_id: e.target.value })} placeholder="acct_…" />
          </Field>
        </FormSection>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} Save payments
      </Button>
    </form>
  )
}
