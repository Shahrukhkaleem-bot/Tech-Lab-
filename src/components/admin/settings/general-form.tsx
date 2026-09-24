"use client"

import { Loader2 } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { saveGeneralSettingsAction } from "@/features/admin/settings/actions"
import { SOCIAL_NETWORKS, type SocialNetwork } from "@/features/tenants/schemas"

import { Field, FormSection } from "../form-controls"
import { useSave } from "./use-save"

export type GeneralValues = {
  name: string
  contactEmail: string
  contactPhone: string
  whatsappNumber: string
  address: string
  tagline: string
  announcement: string
  social: Partial<Record<SocialNetwork, string>>
}

export function GeneralSettingsForm({ initial }: { initial: GeneralValues }) {
  const [v, setV] = useState(initial)
  const { pending, save } = useSave()
  const set = (k: keyof GeneralValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value })

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault()
        const social = Object.fromEntries(Object.entries(v.social).filter(([, url]) => url?.trim()))
        save(() => saveGeneralSettingsAction({ ...v, social }))
      }}
    >
      <FormSection title="Store details">
        <Field id="s-name" label="Store name">
          <Input id="s-name" value={v.name} onChange={set("name")} required maxLength={120} />
        </Field>
        <Field id="s-tagline" label="Tagline" hint="Shown in the footer and used as the default meta description.">
          <Input id="s-tagline" value={v.tagline} onChange={set("tagline")} maxLength={160} />
        </Field>
        <Field id="s-ann" label="Announcement bar" hint="Short message in the top bar (e.g. free delivery offer).">
          <Input id="s-ann" value={v.announcement} onChange={set("announcement")} maxLength={200} />
        </Field>
      </FormSection>
      <FormSection title="Contact">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="s-email" label="Email">
            <Input id="s-email" type="email" value={v.contactEmail} onChange={set("contactEmail")} />
          </Field>
          <Field id="s-phone" label="Phone">
            <Input id="s-phone" value={v.contactPhone} onChange={set("contactPhone")} />
          </Field>
          <Field id="s-wa" label="WhatsApp">
            <Input id="s-wa" value={v.whatsappNumber} onChange={set("whatsappNumber")} placeholder="+92…" />
          </Field>
        </div>
        <Field id="s-address" label="Address">
          <Textarea id="s-address" rows={2} value={v.address} onChange={set("address")} />
        </Field>
      </FormSection>
      <FormSection title="Social links" description="Full https:// links. Leave empty to hide.">
        <div className="grid gap-4 sm:grid-cols-2">
          {SOCIAL_NETWORKS.map((n) => (
            <Field key={n} id={`s-${n}`} label={n[0]!.toUpperCase() + n.slice(1)}>
              <Input id={`s-${n}`} value={v.social[n] ?? ""} onChange={(e) => setV({ ...v, social: { ...v.social, [n]: e.target.value } })} placeholder="https://" />
            </Field>
          ))}
        </div>
      </FormSection>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} Save
      </Button>
    </form>
  )
}
