"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Banknote, CreditCard, Loader2, Lock, ShoppingBag, Smartphone, Truck } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { EmptyState } from "@/components/common/empty-state"
import { useCart } from "@/components/providers/store-providers"
import { useTenant } from "@/components/providers/tenant-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { getCheckoutQuoteAction, placeOrderAction } from "@/features/checkout/actions"
import { customerDetailsSchema } from "@/features/checkout/schemas"
import type { CheckoutQuote } from "@/features/checkout/types"
import type { BankAccount } from "@/features/tenants/types"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { cn } from "@/lib/utils"
import type { PaymentMethod } from "@/types/database"

import { OrderSummary } from "./order-summary"

const formSchema = z.object({
  customer: customerDetailsSchema,
  paymentMethod: z.enum(["cod", "bank_transfer", "card", "wallet"], { message: "Choose a payment method" }),
})
type FormValues = z.input<typeof formSchema>

const METHOD_ICONS: Record<PaymentMethod, typeof Banknote> = { cod: Truck, bank_transfer: Banknote, card: CreditCard, wallet: Smartphone }
const METHOD_HINTS: Record<PaymentMethod, string> = {
  cod: "Pay in cash when your order arrives.",
  bank_transfer: "Transfer to our bank account. We ship once payment is confirmed.",
  card: "You'll be redirected to a secure payment page.",
  wallet: "Pay with your mobile wallet.",
}

type CheckoutFormProps = {
  methods: { method: PaymentMethod; label: string }[]
  bankAccounts: BankAccount[]
  defaults: { name?: string; email?: string }
}

export function CheckoutForm({ methods, bankAccounts, defaults }: CheckoutFormProps) {
  const router = useRouter()
  const { tenant } = useTenant()
  const items = useCart((s) => s.items)
  const hydrated = useCart((s) => s.hydrated)
  const applyServerRefresh = useCart((s) => s.applyServerRefresh)

  const [quote, setQuote] = useState<CheckoutQuote | null>(null)
  const [quoting, startQuoting] = useTransition()
  const [couponInput, setCouponInput] = useState("")
  const [appliedCoupon, setAppliedCoupon] = useState<string | undefined>()
  // One key per checkout attempt: double-clicks / retries can never create two orders.
  const [idempotencyKey] = useState(() => crypto.randomUUID())

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customer: { name: defaults.name ?? "", email: defaults.email ?? "", phone: "", city: "", address: "", postalCode: "", notes: "" },
      paymentMethod: methods[0]?.method ?? "cod",
    },
  })

  const city = useDebouncedValue(useWatch({ control, name: "customer.city" }) ?? "", 500)
  const email = useDebouncedValue(useWatch({ control, name: "customer.email" }) ?? "", 800)
  const paymentMethod = useWatch({ control, name: "paymentMethod" })
  const lines = useMemo(() => items.map((i) => ({ productId: i.productId, quantity: i.quantity })), [items])

  /** Server quote (DB prices, stock, coupon, shipping). Pending state comes from the transition. */
  const requestQuote = useCallback(
    (coupon?: string, onQuote?: (q: CheckoutQuote) => void) => {
      if (!lines.length) return
      startQuoting(async () => {
        const res = await getCheckoutQuoteAction({ items: lines, couponCode: coupon ?? "", email: email.includes("@") ? email : "", city })
        if (!res.ok) return void toast.error(res.error.message)
        setQuote(res.data)
        onQuote?.(res.data)
      })
    },
    [lines, email, city],
  )

  useEffect(() => {
    if (hydrated) requestQuote(appliedCoupon)
  }, [hydrated, requestQuote, appliedCoupon])

  const applyCoupon = () => {
    const code = couponInput.trim().toUpperCase()
    if (!code) return
    requestQuote(code, (q) => {
      if (q.coupon?.valid) {
        setAppliedCoupon(code)
        toast.success(`Coupon ${code} applied`)
      } else if (q.coupon) {
        toast.error(q.coupon.message ?? "This coupon is not valid.")
        setAppliedCoupon(undefined)
      }
    })
  }

  const fixCart = () => {
    if (!quote) return
    applyServerRefresh(
      quote.lines.map((l) => ({
        productId: l.productId,
        available: l.problem !== "UNAVAILABLE" && (l.availableQuantity ?? 1) > 0,
        unitPrice: l.unitPrice,
        originalPrice: l.unitPrice,
        maxQuantity: l.availableQuantity,
      })),
    )
  }

  const onSubmit = handleSubmit(async (values) => {
    if (!quote) return
    const res = await placeOrderAction({
      customer: values.customer,
      paymentMethod: values.paymentMethod,
      couponCode: appliedCoupon ?? "",
      items: lines,
      idempotencyKey,
      expectedSubtotal: quote.subtotal,
    })

    if (res.ok) {
      if (/^https?:\/\//.test(res.data.redirectTo)) {
        // Hosted payment page; the cart is cleared on the confirmation page.
        window.location.assign(res.data.redirectTo)
        return
      }
      // The confirmation page clears the cart (ClearCartOnMount); clearing here would
      // flash the "cart is empty" state before navigation.
      router.push(res.data.redirectTo)
      return
    }

    const { code, message, fieldErrors } = res.error
    if (code === "PRICE_CHANGED" || code === "INSUFFICIENT_STOCK") {
      requestQuote(appliedCoupon)
      toast.warning(message)
      return
    }
    if (fieldErrors) {
      for (const [path, msgs] of Object.entries(fieldErrors)) {
        setError(path as keyof FormValues, { message: msgs[0] })
      }
    }
    toast.error(message)
  })

  if (hydrated && items.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="Your cart is empty"
        description="Add some products to your cart before checking out."
        action={
          <Button asChild>
            <Link href="/products">Browse products</Link>
          </Button>
        }
      />
    )
  }

  const field = (name: keyof FormValues["customer"], label: string, props: React.ComponentProps<typeof Input> = {}) => {
    const error = errors.customer?.[name]?.message
    return (
      <div className="grid gap-1.5">
        <Label htmlFor={`checkout-${name}`}>{label}</Label>
        <Input id={`checkout-${name}`} aria-invalid={Boolean(error)} aria-describedby={error ? `checkout-${name}-error` : undefined} {...props} {...register(`customer.${name}`)} />
        {error ? (
          <p id={`checkout-${name}-error`} className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-8 lg:grid-cols-[1fr_420px]">
      <div className="space-y-8">
        <section aria-labelledby="checkout-contact" className="space-y-4">
          <h2 id="checkout-contact" className="text-lg font-semibold">
            Contact & delivery
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("name", "Full name", { autoComplete: "name" })}
            {field("phone", "Phone", { autoComplete: "tel", inputMode: "tel", placeholder: "03XX XXXXXXX" })}
            <div className="sm:col-span-2">{field("email", "Email", { type: "email", autoComplete: "email" })}</div>
            {field("city", "City", { autoComplete: "address-level2" })}
            {field("postalCode", "Postal code (optional)", { autoComplete: "postal-code" })}
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="checkout-address">Full address</Label>
              <Textarea id="checkout-address" rows={3} autoComplete="street-address" aria-invalid={Boolean(errors.customer?.address)} {...register("customer.address")} />
              {errors.customer?.address ? <p className="text-xs text-destructive">{errors.customer.address.message}</p> : null}
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="checkout-notes">Order notes (optional)</Label>
              <Textarea id="checkout-notes" rows={2} placeholder="Delivery instructions, landmark…" {...register("customer.notes")} />
            </div>
          </div>
        </section>

        <section aria-labelledby="checkout-payment" className="space-y-4">
          <h2 id="checkout-payment" className="text-lg font-semibold">
            Payment method
          </h2>
          {methods.length === 0 ? (
            <p className="text-sm text-destructive">This store has no payment methods configured yet.</p>
          ) : (
            <Controller
              control={control}
              name="paymentMethod"
              render={({ field: f }) => (
                <RadioGroup value={f.value} onValueChange={f.onChange} className="gap-3">
                  {methods.map((m) => {
                    const Icon = METHOD_ICONS[m.method]
                    return (
                      <Label
                        key={m.method}
                        htmlFor={`pay-${m.method}`}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-xl border p-4 font-normal transition-colors hover:bg-accent/60",
                          f.value === m.method && "border-primary bg-accent",
                        )}
                      >
                        <RadioGroupItem id={`pay-${m.method}`} value={m.method} className="mt-0.5" />
                        <Icon className="size-5 shrink-0 text-primary" aria-hidden />
                        <span>
                          <span className="block font-medium">{m.label}</span>
                          <span className="block text-xs text-muted-foreground">{METHOD_HINTS[m.method]}</span>
                        </span>
                      </Label>
                    )
                  })}
                </RadioGroup>
              )}
            />
          )}
          {paymentMethod === "bank_transfer" && bankAccounts.length ? (
            <div className="rounded-xl border bg-muted/40 p-4 text-sm">
              <p className="mb-2 font-medium">Bank details (also shown after you place the order)</p>
              {bankAccounts.map((a) => (
                <dl key={a.account_number} className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                  <dt className="text-muted-foreground">Bank</dt>
                  <dd>{a.bank_name}</dd>
                  <dt className="text-muted-foreground">Title</dt>
                  <dd>{a.account_title}</dd>
                  <dt className="text-muted-foreground">Account</dt>
                  <dd className="font-mono">{a.account_number}</dd>
                  {a.iban ? (
                    <>
                      <dt className="text-muted-foreground">IBAN</dt>
                      <dd className="font-mono">{a.iban}</dd>
                    </>
                  ) : null}
                </dl>
              ))}
            </div>
          ) : null}
        </section>
      </div>

      <aside className="h-fit space-y-5 rounded-2xl border bg-card p-5 lg:sticky lg:top-28" aria-labelledby="checkout-summary">
        <h2 id="checkout-summary" className="text-lg font-semibold">
          Order summary
        </h2>
        <OrderSummary quote={quote} loading={quoting} locale={tenant.locale} />

        {quote?.hasProblems ? (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            Some items are unavailable in the requested quantity.{" "}
            <button type="button" onClick={fixCart} className="font-semibold underline">
              Update my cart
            </button>
          </div>
        ) : null}

        <div className="flex gap-2">
          <Input
            aria-label="Coupon code"
            placeholder="Coupon code"
            value={couponInput}
            onChange={(e) => setCouponInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                applyCoupon()
              }
            }}
            className="uppercase"
            maxLength={32}
          />
          <Button type="button" variant="outline" onClick={applyCoupon} disabled={!couponInput.trim() || quoting}>
            Apply
          </Button>
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting || !quote || quote.hasProblems || methods.length === 0}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : <Lock aria-hidden />}
          {isSubmitting ? "Placing order…" : paymentMethod === "card" ? "Continue to payment" : "Place order"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          By placing your order you agree to our{" "}
          <Link href="/pages/terms" className="underline">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/pages/privacy-policy" className="underline">
            privacy policy
          </Link>
          .
        </p>
      </aside>
    </form>
  )
}
