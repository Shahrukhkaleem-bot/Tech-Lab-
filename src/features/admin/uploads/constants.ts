/** Upload rules — mirrored by the bucket config in 20260924000008_storage.sql. */
export const UPLOAD_BUCKETS = {
  "product-images": { maxBytes: 5 * 1024 * 1024, mime: ["image/jpeg", "image/png", "image/webp", "image/avif"] },
  "category-images": { maxBytes: 2 * 1024 * 1024, mime: ["image/jpeg", "image/png", "image/webp", "image/avif"] },
  "brand-images": { maxBytes: 2 * 1024 * 1024, mime: ["image/jpeg", "image/png", "image/webp", "image/avif"] },
  "tenant-assets": {
    maxBytes: 2 * 1024 * 1024,
    mime: ["image/jpeg", "image/png", "image/webp", "image/avif", "image/x-icon", "image/vnd.microsoft.icon"],
  },
} as const

export type UploadBucket = keyof typeof UPLOAD_BUCKETS

export const MIME_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
}

export function validateUploadFile(bucket: UploadBucket, file: { type: string; size: number }): string | null {
  const rules = UPLOAD_BUCKETS[bucket]
  if (!(rules.mime as readonly string[]).includes(file.type)) return "Unsupported file type. Use JPG, PNG, WebP or AVIF."
  if (file.size > rules.maxBytes) return `File is too large (max ${Math.round(rules.maxBytes / 1024 / 1024)} MB).`
  if (file.size === 0) return "File is empty."
  return null
}
