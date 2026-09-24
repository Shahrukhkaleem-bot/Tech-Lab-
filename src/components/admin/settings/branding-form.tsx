"use client"

import { Loader2 } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FONT_OPTIONS } from "@/config/fonts"
import { saveBrandingAction } from "@/features/admin/settings/actions"
import { readableForeground } from "@/lib/utils/color"

import { Field, FormSection, nativeSelectClass } from "../form-controls"
import { ImageUpload } from "../uploads/image-upload"
import { useSave } from "./use-save"

export type BrandingValues = {
  primary_color: string
  secondary_color: string
  accent_color: string
  logo_url: string | null
  favicon_url: string | null
  font_family: string
  radius: string
}

function ColorField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field id={id} label={label}>
      <div className="flex gap-2">
        <input type="color" aria-label={`${label} picker`} value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 cursor-pointer rounded-md border" />
        <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} pattern="#[0-9a-fA-F]{6}" className="font-mono" />
      </div>
    </Field>
  )
}

export function BrandingForm({ initial }: { initial: BrandingValues }) {
  const [v, setV] = useState(initial)
  const { pending, save } = useSave()

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault()
        save(() => saveBrandingAction({ ...v, logo_url: v.logo_url ?? undefined, favicon_url: v.favicon_url ?? undefined }), "Branding updated")
      }}
    >
      <FormSection title="Logo & icon">
        <div className="flex flex-wrap gap-8">
          <ImageUpload bucket="tenant-assets" label="Logo" value={v.logo_url} onChange={(url) => setV({ ...v, logo_url: url })} />
          <ImageUpload bucket="tenant-assets" label="Favicon" value={v.favicon_url} onChange={(url) => setV({ ...v, favicon_url: url })} />
        </div>
      </FormSection>
      <FormSection title="Colours" description="Text colour on each is picked automatically for contrast.">
        <div className="grid gap-4 sm:grid-cols-3">
          <ColorField id="c-primary" label="Primary" value={v.primary_color} onChange={(c) => setV({ ...v, primary_color: c })} />
          <ColorField id="c-secondary" label="Secondary (top bar & footer)" value={v.secondary_color} onChange={(c) => setV({ ...v, secondary_color: c })} />
          <ColorField id="c-accent" label="Accent (badges)" value={v.accent_color} onChange={(c) => setV({ ...v, accent_color: c })} />
        </div>
        <div className="flex flex-wrap gap-3" aria-label="Preview">
          {[
            ["Button", v.primary_color],
            ["Footer", v.secondary_color],
            ["-20%", v.accent_color],
          ].map(([label, bg]) => (
            <span key={label} className="rounded-md px-4 py-2 text-sm font-semibold" style={{ background: bg, color: readableForeground(bg!) }}>
              {label}
            </span>
          ))}
        </div>
      </FormSection>
      <FormSection title="Typography & shape">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="font" label="Font">
            <select id="font" className={nativeSelectClass} value={v.font_family} onChange={(e) => setV({ ...v, font_family: e.target.value })}>
              {FONT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </Field>
          <Field id="radius" label="Corner radius">
            <select id="radius" className={nativeSelectClass} value={v.radius} onChange={(e) => setV({ ...v, radius: e.target.value })}>
              {["0rem", "0.25rem", "0.5rem", "0.75rem", "1rem"].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </FormSection>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} Save branding
      </Button>
    </form>
  )
}
