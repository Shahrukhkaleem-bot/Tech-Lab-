"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Pencil, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { deleteCategoryAction, saveCategoryAction } from "@/features/admin/catalog/actions"
import { categoryFormSchema, type CategoryFormInput } from "@/features/admin/catalog/schemas"
import { slugify } from "@/lib/utils/format"

import { ConfirmDelete } from "../confirm-delete"
import { Field, nativeSelectClass, SwitchField } from "../form-controls"
import { ImageUpload } from "../uploads/image-upload"

export type CategoryRowView = CategoryFormInput & { id: string; depth: number; productCount: number }

const EMPTY: CategoryFormInput = { name: "", slug: "", description: "", parentId: "", imageUrl: null, displayOrder: 0, isActive: true, seoTitle: "", seoDescription: "" }

function CategoryDialog({ open, onOpenChange, editing, options }: { open: boolean; onOpenChange: (o: boolean) => void; editing: CategoryRowView | null; options: CategoryRowView[] }) {
  const router = useRouter()
  const form = useForm<CategoryFormInput>({ resolver: zodResolver(categoryFormSchema), values: editing ?? EMPTY })
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting, dirtyFields },
  } = form

  const onSubmit = handleSubmit(async (values) => {
    const res = await saveCategoryAction(editing?.id ?? null, values)
    if (!res.ok) return void toast.error(res.error.message)
    toast.success("Category saved")
    onOpenChange(false)
    router.refresh()
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit category" : "New category"}</DialogTitle>
          <DialogDescription>Categories organise the storefront navigation and filters.</DialogDescription>
        </DialogHeader>
        <form id="category-form" onSubmit={onSubmit} noValidate className="space-y-4">
          <Field id="cat-name" label="Name" error={errors.name?.message}>
            <Input id="cat-name" {...register("name", { onChange: (e) => !editing && !dirtyFields.slug && setValue("slug", slugify(e.target.value)) })} />
          </Field>
          <Field id="cat-slug" label="Slug" error={errors.slug?.message}>
            <Input id="cat-slug" {...register("slug")} />
          </Field>
          <Field id="cat-parent" label="Parent category" error={errors.parentId?.message} hint="Up to three levels deep.">
            <select id="cat-parent" className={nativeSelectClass} {...register("parentId")}>
              <option value="">— Top level —</option>
              {options
                .filter((o) => o.id !== editing?.id)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {"— ".repeat(o.depth)}
                    {o.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field id="cat-desc" label="Description" error={errors.description?.message}>
            <Textarea id="cat-desc" rows={3} {...register("description")} />
          </Field>
          <Controller control={control} name="imageUrl" render={({ field }) => <ImageUpload bucket="category-images" label="Image" value={field.value ?? null} onChange={field.onChange} />} />
          <div className="grid grid-cols-2 gap-4">
            <Field id="cat-order" label="Display order" error={errors.displayOrder?.message}>
              <Input id="cat-order" inputMode="numeric" {...register("displayOrder")} />
            </Field>
          </div>
          <Controller control={control} name="isActive" render={({ field }) => <SwitchField id="cat-active" label="Active" checked={Boolean(field.value)} onCheckedChange={field.onChange} />} />
        </form>
        <DialogFooter>
          <Button type="submit" form="category-form" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function CategoryManager({ rows }: { rows: CategoryRowView[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CategoryRowView | null>(null)

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex justify-end border-b p-4">
        <Button
          onClick={() => {
            setEditing(null)
            setOpen(true)
          }}
        >
          <Plus aria-hidden /> Add category
        </Button>
      </div>
      {rows.length ? (
        <ul className="divide-y">
          {rows.map((c) => (
            <li key={c.id} className="flex items-center gap-3 p-3 text-sm" style={{ paddingLeft: 12 + c.depth * 24 }}>
              <span className="min-w-0 flex-1">
                <span className="font-medium">{c.name}</span> <span className="text-muted-foreground">/{c.slug}</span>
              </span>
              <span className="text-xs text-muted-foreground">{c.productCount} products</span>
              <StatusBadge tone={c.isActive ? "success" : "neutral"}>{c.isActive ? "Active" : "Hidden"}</StatusBadge>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Edit ${c.name}`}
                onClick={() => {
                  setEditing(c)
                  setOpen(true)
                }}
              >
                <Pencil aria-hidden />
              </Button>
              <ConfirmDelete
                title={`Delete ${c.name}?`}
                description="Products in this category keep existing but become uncategorised. Sub-categories move to the top level."
                onConfirm={async () => {
                  const res = await deleteCategoryAction(c.id)
                  if (!res.ok) return void toast.error(res.error.message)
                  toast.success("Category deleted")
                  router.refresh()
                }}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="p-6 text-sm text-muted-foreground">No categories yet.</p>
      )}
      <CategoryDialog open={open} onOpenChange={setOpen} editing={editing} options={rows} />
    </div>
  )
}
