"use client"

import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Star, Trash2 } from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"

import { SmartImage } from "@/components/common/smart-image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { UPLOAD_BUCKETS } from "@/features/admin/uploads/constants"
import { cn } from "@/lib/utils"

import { uploadImage } from "../uploads/upload-client"

export type ProductImageValue = { id: string; url: string; storagePath?: string | null; alt?: string; isPrimary: boolean }

const MAX_IMAGES = 12

/**
 * Multi-image manager: parallel uploads with per-file progress, primary selection,
 * reordering and alt text. Removed images are deleted from storage by the save action
 * (after the DB commit), so cancelling the form never loses files that are still in use.
 */
export function ProductImagesField({ value, onChange }: { value: ProductImageValue[]; onChange: (next: ProductImageValue[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploads, setUploads] = useState<{ key: string; name: string; progress: number }[]>([])

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const room = MAX_IMAGES - value.length - uploads.length
    const list = Array.from(files).slice(0, Math.max(room, 0))
    if (list.length < files.length) toast.warning(`A product can have at most ${MAX_IMAGES} images.`)

    let current = value
    await Promise.all(
      list.map(async (file) => {
        const key = crypto.randomUUID()
        setUploads((u) => [...u, { key, name: file.name, progress: 0 }])
        try {
          const up = await uploadImage("product-images", file, (p) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, progress: p } : x))))
          current = [...current, { id: crypto.randomUUID(), url: up.publicUrl, storagePath: up.path, alt: "", isPrimary: current.length === 0 }]
          onChange(current)
        } catch (e) {
          toast.error(`${file.name}: ${e instanceof Error ? e.message : "upload failed"}`)
        } finally {
          setUploads((u) => u.filter((x) => x.key !== key))
        }
      }),
    )
    if (inputRef.current) inputRef.current.value = ""
  }

  const move = (index: number, dir: -1 | 1) => {
    const next = [...value]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target]!, next[index]!]
    onChange(next)
  }

  const setPrimary = (id: string) => onChange(value.map((img) => ({ ...img, isPrimary: img.id === id })))
  const remove = (id: string) => {
    const next = value.filter((img) => img.id !== id)
    if (next.length && !next.some((i) => i.isPrimary)) next[0] = { ...next[0]!, isPrimary: true }
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {value.map((img, i) => (
          <li key={img.id} className={cn("space-y-2 rounded-lg border p-2", img.isPrimary && "border-primary ring-1 ring-primary")}>
            <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
              <SmartImage src={img.url} alt={img.alt || "Product image"} fill sizes="200px" className="object-contain p-1" />
              {img.isPrimary ? (
                <span className="absolute top-1 left-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">PRIMARY</span>
              ) : null}
            </div>
            <Input
              value={img.alt ?? ""}
              onChange={(e) => onChange(value.map((x) => (x.id === img.id ? { ...x, alt: e.target.value } : x)))}
              placeholder="Alt text"
              aria-label={`Alt text for image ${i + 1}`}
              className="h-8 text-xs"
              maxLength={200}
            />
            <div className="flex justify-between">
              <div className="flex">
                <Button type="button" size="icon-sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move left">
                  <ArrowLeft aria-hidden />
                </Button>
                <Button type="button" size="icon-sm" variant="ghost" onClick={() => move(i, 1)} disabled={i === value.length - 1} aria-label="Move right">
                  <ArrowRight aria-hidden />
                </Button>
              </div>
              <div className="flex">
                <Button type="button" size="icon-sm" variant="ghost" onClick={() => setPrimary(img.id)} disabled={img.isPrimary} aria-label="Set as primary image">
                  <Star aria-hidden />
                </Button>
                <Button type="button" size="icon-sm" variant="ghost" onClick={() => remove(img.id)} aria-label="Remove image">
                  <Trash2 aria-hidden />
                </Button>
              </div>
            </div>
          </li>
        ))}
        {uploads.map((u) => (
          <li key={u.key} className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-2 text-center text-xs" aria-live="polite">
            <Loader2 className="size-5 animate-spin" aria-hidden />
            <span className="line-clamp-1">{u.name}</span>
            <span className="font-medium">{u.progress}%</span>
          </li>
        ))}
      </ul>
      <input ref={inputRef} type="file" multiple accept={UPLOAD_BUCKETS["product-images"].mime.join(",")} className="sr-only" onChange={(e) => onFiles(e.target.files)} aria-label="Upload product images" />
      <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={value.length + uploads.length >= MAX_IMAGES}>
        <ImagePlus aria-hidden /> Add images
      </Button>
      <p className="text-xs text-muted-foreground">Up to {MAX_IMAGES} images · JPG, PNG, WebP or AVIF · max 5 MB each. The primary image is shown on product cards.</p>
    </div>
  )
}
