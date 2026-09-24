"use client"

import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { deleteStorePageAction, saveContentSettingsAction, saveStorePageAction } from "@/features/admin/settings/actions"
import { TRUST_ICONS } from "@/features/tenants/schemas"
import type { FooterBadge, HomepageSection, PriceRange, StoreLocation, TrustBadge } from "@/features/tenants/types"
import { slugify } from "@/lib/utils/format"

import { ConfirmDelete } from "../confirm-delete"
import { Field, FormSection, nativeSelectClass, SwitchField } from "../form-controls"
import { useSave } from "./use-save"

export type ContentValues = {
  trustBadges: TrustBadge[]
  homepageSections: HomepageSection[]
  priceRanges: PriceRange[]
  footerBadges: FooterBadge[]
  location: StoreLocation
  seoTitle: string
  seoDescription: string
}

/**
 * Homepage & SEO. Trust badges, location and SEO get dedicated inputs; the more
 * structural lists (sections, price ranges, footer badges) use a validated JSON editor —
 * the server re-validates everything with Zod before saving.
 */
export function ContentSettingsForm({ initial }: { initial: ContentValues }) {
  const [v, setV] = useState(initial)
  const [json, setJson] = useState(() =>
    JSON.stringify({ homepageSections: initial.homepageSections, priceRanges: initial.priceRanges, footerBadges: initial.footerBadges }, null, 2),
  )
  const { pending, save } = useSave()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    let advanced: Pick<ContentValues, "homepageSections" | "priceRanges" | "footerBadges">
    try {
      advanced = JSON.parse(json)
    } catch {
      return void toast.error("Advanced settings are not valid JSON.")
    }
    save(() => saveContentSettingsAction({ ...v, ...advanced }))
  }

  const loc = v.location
  return (
    <form className="space-y-6" onSubmit={submit}>
      <FormSection title="Trust badges" description="Up to 8 value propositions shown below the hero.">
        {v.trustBadges.map((b, i) => (
          <div key={i} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[140px_1fr_1fr_auto]">
            <select
              aria-label="Icon"
              className={nativeSelectClass}
              value={b.icon}
              onChange={(e) => setV({ ...v, trustBadges: v.trustBadges.map((x, j) => (j === i ? { ...x, icon: e.target.value as TrustBadge["icon"] } : x)) })}
            >
              {TRUST_ICONS.map((icon) => (
                <option key={icon} value={icon}>
                  {icon}
                </option>
              ))}
            </select>
            <Input aria-label="Title" value={b.title} onChange={(e) => setV({ ...v, trustBadges: v.trustBadges.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} placeholder="Title" />
            <Input
              aria-label="Description"
              value={b.description ?? ""}
              onChange={(e) => setV({ ...v, trustBadges: v.trustBadges.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)) })}
              placeholder="Description"
            />
            <Button type="button" variant="ghost" size="icon" aria-label="Remove badge" onClick={() => setV({ ...v, trustBadges: v.trustBadges.filter((_, j) => j !== i) })}>
              <Trash2 aria-hidden />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" disabled={v.trustBadges.length >= 8} onClick={() => setV({ ...v, trustBadges: [...v.trustBadges, { icon: "badge-check", title: "", description: "" }] })}>
          <Plus aria-hidden /> Add badge
        </Button>
      </FormSection>

      <FormSection title="Store location">
        <Field id="loc-address" label="Address">
          <Textarea id="loc-address" rows={2} value={loc.address ?? ""} onChange={(e) => setV({ ...v, location: { ...loc, address: e.target.value } })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="loc-lat" label="Latitude">
            <Input id="loc-lat" inputMode="decimal" value={loc.latitude ?? ""} onChange={(e) => setV({ ...v, location: { ...loc, latitude: e.target.value === "" ? undefined : Number(e.target.value) } })} />
          </Field>
          <Field id="loc-lng" label="Longitude">
            <Input id="loc-lng" inputMode="decimal" value={loc.longitude ?? ""} onChange={(e) => setV({ ...v, location: { ...loc, longitude: e.target.value === "" ? undefined : Number(e.target.value) } })} />
          </Field>
          <Field id="loc-phone" label="Phone">
            <Input id="loc-phone" value={loc.phone ?? ""} onChange={(e) => setV({ ...v, location: { ...loc, phone: e.target.value } })} />
          </Field>
        </div>
        <Field id="loc-map" label="Google Maps link">
          <Input id="loc-map" value={loc.map_url ?? ""} onChange={(e) => setV({ ...v, location: { ...loc, map_url: e.target.value || undefined } })} placeholder="https://maps.google.com/…" />
        </Field>
        <Field id="loc-hours" label="Opening hours" hint="One per line: Label | Hours (e.g. Mon – Sat | 11am – 9pm)">
          <Textarea
            id="loc-hours"
            rows={3}
            defaultValue={loc.hours.map((h) => `${h.label} | ${h.value}`).join("\n")}
            onBlur={(e) =>
              setV({
                ...v,
                location: {
                  ...loc,
                  hours: e.target.value
                    .split("\n")
                    .map((line) => line.split("|").map((s) => s.trim()))
                    .filter(([l, val]) => l && val)
                    .map(([label, value]) => ({ label: label!, value: value! })),
                },
              })
            }
          />
        </Field>
      </FormSection>

      <FormSection title="Search engines">
        <Field id="seo-title" label="Homepage title">
          <Input id="seo-title" maxLength={70} value={v.seoTitle} onChange={(e) => setV({ ...v, seoTitle: e.target.value })} />
        </Field>
        <Field id="seo-desc" label="Homepage description">
          <Textarea id="seo-desc" rows={2} maxLength={160} value={v.seoDescription} onChange={(e) => setV({ ...v, seoDescription: e.target.value })} />
        </Field>
      </FormSection>

      <FormSection
        title="Advanced homepage layout (JSON)"
        description='homepageSections: [{ "type": "featured|best_sellers|new_arrivals|on_sale|category", "title", "subtitle?", "category_slug?", "limit" }], priceRanges: [{ "label", "min?", "max?" }], footerBadges: [{ "label" }]'
      >
        <Textarea rows={14} className="font-mono text-xs" value={json} onChange={(e) => setJson(e.target.value)} aria-label="Advanced homepage settings JSON" spellCheck={false} />
      </FormSection>

      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} Save homepage & SEO
      </Button>
    </form>
  )
}

export type PageRow = { id: string; slug: string; title: string; content: string; seoDescription: string; isPublished: boolean }

export function StorePagesEditor({ pages }: { pages: PageRow[] }) {
  const [editing, setEditing] = useState<PageRow | null>(null)
  const { pending, save } = useSave()

  if (editing) {
    return (
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          const { id, ...rest } = editing
          save(async () => {
            const res = await saveStorePageAction(id || null, rest)
            if (res.ok) setEditing(null)
            return res
          }, "Page saved")
        }}
      >
        <FormSection title={editing.id ? `Edit “${editing.title}”` : "New page"}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="pg-title" label="Title">
              <Input id="pg-title" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value, slug: editing.id ? editing.slug : slugify(e.target.value) })} />
            </Field>
            <Field id="pg-slug" label="URL" hint={`/pages/${editing.slug || "…"}`}>
              <Input id="pg-slug" value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} />
            </Field>
          </div>
          <Field id="pg-content" label="Content" hint="Plain text. Blank line = new paragraph.">
            <Textarea id="pg-content" rows={14} value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} />
          </Field>
          <Field id="pg-seo" label="Meta description">
            <Input id="pg-seo" maxLength={160} value={editing.seoDescription} onChange={(e) => setEditing({ ...editing, seoDescription: e.target.value })} />
          </Field>
          <SwitchField id="pg-pub" label="Published" checked={editing.isPublished} onCheckedChange={(c) => setEditing({ ...editing, isPublished: c })} />
        </FormSection>
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} Save page
          </Button>
          <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
            Cancel
          </Button>
        </div>
      </form>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex justify-end border-b p-4">
        <Button onClick={() => setEditing({ id: "", slug: "", title: "", content: "", seoDescription: "", isPublished: true })}>
          <Plus aria-hidden /> New page
        </Button>
      </div>
      <ul className="divide-y">
        {pages.map((p) => (
          <li key={p.id} className="flex items-center gap-3 p-3 text-sm">
            <span className="min-w-0 flex-1">
              <span className="font-medium">{p.title}</span> <span className="text-muted-foreground">/pages/{p.slug}</span>
            </span>
            {!p.isPublished ? <StatusBadge tone="neutral">Draft</StatusBadge> : null}
            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${p.title}`} onClick={() => setEditing(p)}>
              <Pencil aria-hidden />
            </Button>
            <ConfirmDelete
              title={`Delete “${p.title}”?`}
              description="Links to this page in your footer will stop working."
              onConfirm={async () => {
                save(() => deleteStorePageAction(p.id), "Page deleted")
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
