import { Award, BadgeCheck, Clock, Gift, Headphones, RotateCcw, ShieldCheck, ThumbsUp, Truck, Wallet, type LucideIcon } from "lucide-react"
import Link from "next/link"

import type { TRUST_ICONS } from "@/features/tenants/schemas"
import type { TrustBadge } from "@/features/tenants/types"

const ICONS: Record<(typeof TRUST_ICONS)[number], LucideIcon> = {
  truck: Truck,
  "badge-check": BadgeCheck,
  "rotate-ccw": RotateCcw,
  "shield-check": ShieldCheck,
  headphones: Headphones,
  wallet: Wallet,
  award: Award,
  clock: Clock,
  gift: Gift,
  "thumbs-up": ThumbsUp,
}

/** Value propositions (shipping, returns, warranty…) — fully tenant-configured. */
export function TrustBadges({ badges }: { badges: TrustBadge[] }) {
  if (!badges.length) return null
  return (
    <section aria-label="Why shop with us">
      <ul className="grid grid-cols-2 gap-3 rounded-2xl border bg-card p-3 sm:gap-4 sm:p-5 lg:grid-cols-4">
        {badges.map((b) => {
          const Icon = ICONS[b.icon]
          const content = (
            <>
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{b.title}</span>
                {b.description ? <span className="mt-0.5 block text-xs text-muted-foreground">{b.description}</span> : null}
              </span>
            </>
          )
          return (
            <li key={b.title}>
              {b.href ? (
                <Link href={b.href} className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-accent">
                  {content}
                </Link>
              ) : (
                <div className="flex items-center gap-3 p-2">{content}</div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
