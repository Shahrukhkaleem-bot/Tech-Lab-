"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { saveProductAction } from "@/features/admin/products/actions"
import { productFormSchema, type ProductFormInput } from "@/features/admin/products/schemas"
import { slugify } from "@/lib/utils/format"

import { Field, FormSection, nativeSelectClass, SwitchField } from "../form-controls"
import { ProductImagesField } from "./product-images-field"

type Option = { id: string; name: string; depth?: number }

const EMPTY: ProductFormInput = {
  name: "",
  slug: "",
  sku: "",
  shortDescription: "",
  description: "",
  categoryId: "",
  brandId: "",
  originalPrice: 0,
  salePrice: "",
  costPrice: "",
  trackInventory: true,
  stockQuantity: 0,
  lowStockThreshold: 5,
  isFeatured: false,
  isActive: true,
  specifications: [],
  tags: [],
  seoTitle: "",
  seoDescription: "",
  images: [],
}

export function ProductForm({
  productId,
  defaults,
  categories,
  brands,
  currency,
}: {
  productId: string | null
  defaults?: ProductFormInput
  categories: Option[]
  brands: Option[]
  currency: string
}) {
  const router = useRouter()
  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    setError,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<ProductFormInput>({ resolver: zodResolver(productFormSchema), defaultValues: defaults ?? EMPTY })
  const specs = useFieldArray({ control, name: "specifications" })
  const trackInventory = useWatch({ control, name: "trackInventory" })

  const onSubmit = handleSubmit(async (values) => {
    const res = await saveProductAction(productId, values)
    if (!res.ok) {
      for (const [path, msgs] of Object.entries(res.error.fieldErrors ?? {})) setError(path as keyof ProductFormInput, { message: msgs[0] })
      toast.error(res.error.message)
      return
    }
    toast.success(productId ? "Product saved" : "Product created")
    if (!productId) router.replace(`/admin/products/${res.data.id}`)
    router.refresh()
  })

  const err = (k: keyof ProductFormInput) => (errors[k]?.message as string | undefined) ?? undefined

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <FormSection title="Basics">
          <Field id="name" label="Name" error={err("name")}>
            <Input
              id="name"
              {...register("name", {
                onChange: (e) => {
                  if (!productId && !dirtyFields.slug) setValue("slug", slugify(e.target.value))
                },
              })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="slug" label="URL slug" error={err("slug")} hint="/products/your-slug">
              <Input id="slug" {...register("slug")} />
            </Field>
            <Field id="sku" label="SKU" error={err("sku")}>
              <Input id="sku" {...register("sku")} />
            </Field>
          </div>
          <Field id="shortDescription" label="Short description" error={err("shortDescription")} hint="Shown near the price and in search results.">
            <Textarea id="shortDescription" rows={2} maxLength={500} {...register("shortDescription")} />
          </Field>
          <Field id="description" label="Full description" error={err("description")} hint="Plain text. Leave a blank line between paragraphs.">
            <Textarea id="description" rows={8} {...register("description")} />
          </Field>
        </FormSection>

        <FormSection title="Images">
          <Controller control={control} name="images" render={({ field }) => <ProductImagesField value={(field.value ?? []).map((i) => ({ ...i, isPrimary: i.isPrimary ?? false }))} onChange={field.onChange} />} />
          {errors.images ? <p className="text-xs text-destructive">{errors.images.message}</p> : null}
        </FormSection>

        <FormSection title="Pricing" description={`All prices in ${currency}.`}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="originalPrice" label="Regular price" error={err("originalPrice")}>
              <Input id="originalPrice" inputMode="decimal" {...register("originalPrice")} />
            </Field>
            <Field id="salePrice" label="Sale price" error={err("salePrice")} hint="Leave empty for no discount.">
              <Input id="salePrice" inputMode="decimal" {...register("salePrice")} />
            </Field>
            <Field id="costPrice" label="Cost price" error={err("costPrice")} hint="Private — never shown to customers.">
              <Input id="costPrice" inputMode="decimal" {...register("costPrice")} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Specifications" description="Shown as a table on the product page.">
          <ul className="space-y-2">
            {specs.fields.map((f, i) => (
              <li key={f.id} className="flex gap-2">
                <Input placeholder="Name (e.g. Battery)" aria-label={`Specification ${i + 1} name`} {...register(`specifications.${i}.name`)} />
                <Input placeholder="Value (e.g. 5000 mAh)" aria-label={`Specification ${i + 1} value`} {...register(`specifications.${i}.value`)} />
                <Button type="button" variant="ghost" size="icon" onClick={() => specs.remove(i)} aria-label="Remove specification">
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
          <Button type="button" variant="outline" size="sm" onClick={() => specs.append({ name: "", value: "" })}>
            <Plus aria-hidden /> Add specification
          </Button>
        </FormSection>

        <FormSection title="Search engine listing">
          <Field id="seoTitle" label="SEO title" error={err("seoTitle")} hint="Up to 70 characters. Defaults to the product name.">
            <Input id="seoTitle" maxLength={70} {...register("seoTitle")} />
          </Field>
          <Field id="seoDescription" label="Meta description" error={err("seoDescription")} hint="Up to 160 characters.">
            <Textarea id="seoDescription" rows={2} maxLength={160} {...register("seoDescription")} />
          </Field>
        </FormSection>
      </div>

      <div className="space-y-6">
        <FormSection title="Status">
          <Controller control={control} name="isActive" render={({ field }) => <SwitchField id="isActive" label="Active" description="Visible in the store" checked={Boolean(field.value)} onCheckedChange={field.onChange} />} />
          <Controller control={control} name="isFeatured" render={({ field }) => <SwitchField id="isFeatured" label="Featured" description="Shown in featured sections" checked={Boolean(field.value)} onCheckedChange={field.onChange} />} />
        </FormSection>

        <FormSection title="Organisation">
          <Field id="categoryId" label="Category" error={err("categoryId")}>
            <select id="categoryId" className={nativeSelectClass} {...register("categoryId")}>
              <option value="">— None —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {"  ".repeat(c.depth ?? 0)}
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="brandId" label="Brand" error={err("brandId")}>
            <select id="brandId" className={nativeSelectClass} {...register("brandId")}>
              <option value="">— None —</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="tags" label="Tags" hint="Comma separated. Used by search.">
            <Input
              id="tags"
              defaultValue={(getValues("tags") ?? []).join(", ")}
              onBlur={(e) =>
                setValue(
                  "tags",
                  e.target.value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean)
                    .slice(0, 20),
                  { shouldDirty: true },
                )
              }
            />
          </Field>
        </FormSection>

        <FormSection title="Inventory">
          <Controller control={control} name="trackInventory" render={({ field }) => <SwitchField id="trackInventory" label="Track stock" description="Prevent overselling" checked={Boolean(field.value)} onCheckedChange={field.onChange} />} />
          {trackInventory ? (
            <div className="grid grid-cols-2 gap-4">
              <Field id="stockQuantity" label="In stock" error={err("stockQuantity")}>
                <Input id="stockQuantity" inputMode="numeric" {...register("stockQuantity")} />
              </Field>
              <Field id="lowStockThreshold" label="Low-stock alert" error={err("lowStockThreshold")}>
                <Input id="lowStockThreshold" inputMode="numeric" {...register("lowStockThreshold")} />
              </Field>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">Stock changes are recorded in the inventory log.</p>
        </FormSection>

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {productId ? "Save changes" : "Create product"}
        </Button>
      </div>
    </form>
  )
}
