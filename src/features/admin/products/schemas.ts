import { z } from "zod"

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""))
const money = z.coerce.number({ message: "Enter a number" }).min(0).max(100_000_000)
const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens only")
  .max(120)

export const productImageInputSchema = z.object({
  /** Client-generated for new images so primary selection survives the save. */
  id: z.uuid(),
  url: z.string().max(2048).regex(/^(https:\/\/|\/)/, "Invalid image URL"),
  storagePath: z.string().max(200).nullable().optional(),
  alt: z.string().trim().max(200).optional().or(z.literal("")),
  isPrimary: z.boolean().default(false),
})

export const productFormSchema = z
  .object({
    name: z.string().trim().min(2, "Name is required").max(200),
    slug,
    sku: z
      .string()
      .trim()
      .max(64)
      .regex(/^[A-Za-z0-9._/-]*$/, "Letters, numbers and . _ / - only")
      .optional()
      .or(z.literal("")),
    shortDescription: optionalText(500),
    description: optionalText(20000),
    categoryId: z.uuid().optional().or(z.literal("")),
    brandId: z.uuid().optional().or(z.literal("")),
    originalPrice: money,
    salePrice: z.union([money, z.literal("")]).optional(),
    costPrice: z.union([money, z.literal("")]).optional(),
    trackInventory: z.boolean().default(true),
    stockQuantity: z.coerce.number().int().min(0).max(1_000_000),
    lowStockThreshold: z.coerce.number().int().min(0).max(100_000).default(5),
    isFeatured: z.boolean().default(false),
    isActive: z.boolean().default(true),
    specifications: z
      .array(z.object({ name: z.string().trim().min(1).max(80), value: z.string().trim().min(1).max(300) }))
      .max(50)
      .default([]),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
    seoTitle: optionalText(70),
    seoDescription: optionalText(160),
    images: z.array(productImageInputSchema).max(12).default([]),
  })
  .refine((v) => v.salePrice === undefined || v.salePrice === "" || Number(v.salePrice) < Number(v.originalPrice), {
    message: "Sale price must be lower than the regular price",
    path: ["salePrice"],
  })
  .refine((v) => v.images.filter((i) => i.isPrimary).length <= 1, { message: "Only one primary image", path: ["images"] })

export type ProductFormInput = z.input<typeof productFormSchema>
export type ProductFormValues = z.output<typeof productFormSchema>

export const bulkProductActionSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(200),
  action: z.enum(["activate", "deactivate", "feature", "unfeature", "delete"]),
})

export const adminProductFiltersSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["all", "active", "draft", "low_stock", "out_of_stock"]).default("all"),
  category: z.uuid().optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
})
export type AdminProductFilters = z.infer<typeof adminProductFiltersSchema>
