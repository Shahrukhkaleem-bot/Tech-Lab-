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
import { deleteBrandAction, saveBrandAction } from "@/features/admin/catalog/actions"
import { brandFormSchema, type BrandFormInput } from "@/features/admin/catalog/schemas"
import { slugify } from "@/lib/utils/format"

import { ConfirmDelete } from "../confirm-delete"
import { Field, SwitchField } from "../form-controls"
import { ImageUpload } from "../uploads/image-upload"

export type BrandRowView = BrandFormInput & { id: string }

const EMPTY: BrandFormInput = { name: "", slug: "", description: "", logoUrl: null, displayOrder: 0, isFeatured: false, isActive: true }

export function BrandManager({ rows }: { rows: BrandRowView[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<BrandRowView | null>(null)
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<BrandFormInput>({ resolver: zodResolver(brandFormSchema), values: editing ?? EMPTY })

  const onSubmit = handleSubmit(async (values) => {
    const res = await saveBrandAction(editing?.id ?? null, values)
    if (!res.ok) return void toast.error(res.error.message)
    toast.success("Brand saved")
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
          <Plus aria-hidden /> Add brand
        </Button>
      </div>
      {rows.length ? (
        <ul className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((b) => (
            <li key={b.id} className="flex items-center gap-3 bg-card p-3 text-sm">
              <span className="relative size-12 shrink-0 overflow-hidden rounded-md border bg-muted">
                <SmartImage src={b.logoUrl} alt="" fill sizes="48px" className="object-contain p-1" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{b.name}</span>
                <span className="flex gap-1">
                  {!b.isActive ? <StatusBadge tone="neutral">Hidden</StatusBadge> : null}
                  {b.isFeatured ? <StatusBadge tone="info">Featured</StatusBadge> : null}
                </span>
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Edit ${b.name}`}
                onClick={() => {
                  setEditing(b)
                  setOpen(true)
                }}
              >
                <Pencil aria-hidden />
              </Button>
              <ConfirmDelete
                title={`Delete ${b.name}?`}
                description="Products of this brand keep existing without a brand."
                onConfirm={async () => {
                  const res = await deleteBrandAction(b.id)
                  if (!res.ok) return void toast.error(res.error.message)
                  toast.success("Brand deleted")
                  router.refresh()
                }}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="p-6 text-sm text-muted-foreground">No brands yet.</p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit brand" : "New brand"}</DialogTitle>
            <DialogDescription>Brands appear on product cards, filters and the brands page.</DialogDescription>
          </DialogHeader>
          <form id="brand-form" onSubmit={onSubmit} noValidate className="space-y-4">
            <Field id="brand-name" label="Name" error={errors.name?.message}>
              <Input id="brand-name" {...register("name", { onChange: (e) => !editing && !dirtyFields.slug && setValue("slug", slugify(e.target.value)) })} />
            </Field>
            <Field id="brand-slug" label="Slug" error={errors.slug?.message}>
              <Input id="brand-slug" {...register("slug")} />
            </Field>
            <Field id="brand-desc" label="Description" error={errors.description?.message}>
              <Textarea id="brand-desc" rows={3} {...register("description")} />
            </Field>
            <Controller control={control} name="logoUrl" render={({ field }) => <ImageUpload bucket="brand-images" label="Logo" value={field.value ?? null} onChange={field.onChange} />} />
            <Field id="brand-order" label="Display order" error={errors.displayOrder?.message}>
              <Input id="brand-order" inputMode="numeric" {...register("displayOrder")} />
            </Field>
            <Controller control={control} name="isFeatured" render={({ field }) => <SwitchField id="brand-featured" label="Featured on homepage" checked={Boolean(field.value)} onCheckedChange={field.onChange} />} />
            <Controller control={control} name="isActive" render={({ field }) => <SwitchField id="brand-active" label="Active" checked={Boolean(field.value)} onCheckedChange={field.onChange} />} />
          </form>
          <DialogFooter>
            <Button type="submit" form="brand-form" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
