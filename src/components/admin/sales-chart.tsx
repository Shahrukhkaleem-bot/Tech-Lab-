"use client"

import { useState } from "react"

import { formatMoney } from "@/lib/utils/format"

type Point = { date: string; revenue: number; orders: number }

/**
 * Daily revenue bars (single series → no legend; the heading names it).
 * Bars use the tenant --primary, 4px rounded data-ends anchored to the baseline,
 * 2px gaps, recessive gridlines, per-bar hover/focus tooltip, and an sr-only table.
 */
export function SalesChart({ data, currency, locale }: { data: Point[]; currency: string; locale: string }) {
  const [active, setActive] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => d.revenue))
  const niceMax = niceCeil(max)
  const ticks = [0, niceMax / 2, niceMax]
  const money = (n: number) => formatMoney(n, currency, locale)
  const shortDate = (d: string) => new Date(d).toLocaleDateString(locale, { month: "short", day: "numeric" })
  const current = active != null ? data[active] : null

  return (
    <figure className="relative">
      <div className="flex gap-3">
        <div className="flex h-48 flex-col justify-between py-0 text-right text-[11px] text-muted-foreground tabular-nums" aria-hidden>
          {[...ticks].reverse().map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {compact(t, locale)}
            </span>
          ))}
        </div>
        <div className="relative h-48 flex-1">
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-border/60" style={{ bottom: `${(t / niceMax) * 100}%` }} aria-hidden />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]" onMouseLeave={() => setActive(null)}>
            {data.map((d, i) => (
              <button
                key={d.date}
                type="button"
                className="group relative flex h-full flex-1 items-end outline-none"
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                aria-label={`${shortDate(d.date)}: ${money(d.revenue)}, ${d.orders} orders`}
              >
                <span
                  className="block w-full rounded-t-[4px] bg-primary transition-opacity group-focus-visible:ring-2 group-focus-visible:ring-ring"
                  style={{ height: `${Math.max((d.revenue / niceMax) * 100, d.revenue > 0 ? 1.5 : 0)}%`, opacity: active == null || active === i ? 1 : 0.45 }}
                />
              </button>
            ))}
          </div>
          {current ? (
            <div
              role="status"
              className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md"
              style={{ left: `${((active! + 0.5) / data.length) * 100}%` }}
            >
              <p className="font-medium">{shortDate(current.date)}</p>
              <p className="tabular-nums">{money(current.revenue)}</p>
              <p className="text-muted-foreground">{current.orders} orders</p>
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-2 flex justify-between pl-10 text-[11px] text-muted-foreground" aria-hidden>
        <span>{data[0] ? shortDate(data[0].date) : ""}</span>
        <span>{data.at(-1) ? shortDate(data.at(-1)!.date) : ""}</span>
      </div>
      <table className="sr-only">
        <caption>Daily revenue</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Revenue</th>
            <th>Orders</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{d.date}</td>
              <td>{money(d.revenue)}</td>
              <td>{d.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

function niceCeil(n: number) {
  const pow = 10 ** Math.floor(Math.log10(n))
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= n) ?? 10
  return step * pow
}

function compact(n: number, locale: string) {
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(n)
}
