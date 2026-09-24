"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Pencil, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

import { SmartImage } from "@/components/common/smart-image"
import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { deleteBannerAction, saveBannerAction } from "@/features/admin/catalog/actions"
import { bannerFormSchema, type BannerFormInput } from "@/features/admin/catalog/schemas"

import { ConfirmDelete } from "../confirm-delete"
import { Field, SwitchField } from "../form-controls"
import { ImageUpload } from "../uploads/image-upload"

export type BannerRowView = BannerFormInput & { id: string }

const EMPTY: BannerFormInput = {
  heading: "",
  description: "",
  badge: "",
  ctaLabel: "",
  linkUrl: "",
  desktopImageUrl: "",
  mobileImageUrl: null,
  displayOrder: 0,
  isActive: true,
  startsAt: "",
  endsAt: "",
}

export function BannerManager({ rows }: { rows: BannerRowView[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<BannerRowView | null>(null)
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BannerFormInput>({ resolver: zodResolver(bannerFormSchema), values: editing ?? EMPTY })

  const onSubmit = handleSubmit(async (values) => {
    const res = await saveBannerAction(editing?.id ?? null, values)
    if (!res.ok) return void toast.error(res.error.message)
    toast.success("Banner saved")
    setOpen(false)
    router.refresh()
  })

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex justify-end border-b p-4">
        <Button
          onClick={() => {
            setEditing(null)
            setOpen(true)
          }}
        >
          <Plus aria-hidden /> Add banner
        </Button>
      </div>
      {rows.length ? (
        <ul className="divide-y">
          {rows.map((b) => (
            <li key={b.id} className="flex items-center gap-4 p-3 text-sm">
              <span className="relative aspect-[21/9] w-32 shrink-0 overflow-hidden rounded-md bg-muted">
                <SmartImage src={b.desktopImageUrl} alt="" fill sizes="128px" className="object-cover" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{b.heading}</span>
                <span className="text-xs text-muted-foreground">Order {String(b.displayOrder)}</span>
              </span>
              <StatusBadge tone={b.isActive ? "success" : "neutral"}>{b.isActive ? "Live" : "Hidden"}</StatusBadge>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Edit ${b.heading}`}
                onClick={() => {
                  setEditing(b)
                  setOpen(true)
                }}
              >
                <Pencil aria-hidden />
              </Button>
              <ConfirmDelete
                title="Delete banner?"
                description="The banner and its uploaded images will be removed."
                onConfirm={async () => {
                  const res = await deleteBannerAction(b.id)
                  if (!res.ok) return void toast.error(res.error.message)
                  toast.success("Banner deleted")
                  router.refresh()
                }}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="p-6 text-sm text-muted-foreground">No banners yet. The homepage hero is hidden until you add one.</p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit banner" : "New banner"}</DialogTitle>
            <DialogDescription>Homepage hero slide. Recommended desktop size 2100×800, mobile 800×1000.</DialogDescription>
          </DialogHeader>
          <form id="banner-form" onSubmit={onSubmit} noValidate className="space-y-4">
            <Field id="b-heading" label="Heading" error={errors.heading?.message}>
              <Input id="b-heading" {...register("heading")} />
            </Field>
            <Field id="b-desc" label="Description" error={errors.description?.message}>
              <Textarea id="b-desc" rows={2} {...register("description")} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field id="b-badge" label="Badge" error={errors.badge?.message}>
                <Input id="b-badge" placeholder="Sale" {...register("badge")} />
              </Field>
              <Field id="b-cta" label="Button label" error={errors.ctaLabel?.message}>
                <Input id="b-cta" placeholder="Shop now" {...register("ctaLabel")} />
              </Field>
              <Field id="b-link" label="Link" error={errors.linkUrl?.message}>
                <Input id="b-link" placeholder="/products?on_sale=1" {...register("linkUrl")} />
              </Field>
            </div>
            <Controller control={control} name="desktopImageUrl" render={({ field }) => <ImageUpload bucket="tenant-assets" aspect="wide" label="Desktop image" value={field.value || null} onChange={(v) => field.onChange(v ?? "")} />} />
            {errors.desktopImageUrl ? <p className="text-xs text-destructive">{errors.desktopImageUrl.message}</p> : null}
            <Controller control={control} name="mobileImageUrl" render={({ field }) => <ImageUpload bucket="tenant-assets" label="Mobile image (optional)" value={field.value ?? null} onChange={field.onChange} />} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field id="b-order" label="Display order" error={errors.displayOrder?.message}>
                <Input id="b-order" inputMode="numeric" {...register("displayOrder")} />
              </Field>
              <Field id="b-start" label="Starts" error={errors.startsAt?.message}>
                <Input id="b-start" type="datetime-local" {...register("startsAt")} />
              </Field>
              <Field id="b-end" label="Ends" error={errors.endsAt?.message}>
                <Input id="b-end" type="datetime-local" {...register("endsAt")} />
              </Field>
            </div>
            <Controller control={control} name="isActive" render={({ field }) => <SwitchField id="b-active" label="Active" checked={Boolean(field.value)} onCheckedChange={field.onChange} />} />
          </form>
          <DialogFooter>
            <Button type="submit" form="banner-form" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
