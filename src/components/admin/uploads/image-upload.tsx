"use client"

import { ImagePlus, Loader2, Trash2 } from "lucide-react"
import { useId, useRef, useState } from "react"
import { toast } from "sonner"

import { SmartImage } from "@/components/common/smart-image"
import { Button } from "@/components/ui/button"
import { UPLOAD_BUCKETS, type UploadBucket } from "@/features/admin/uploads/constants"
import { cn } from "@/lib/utils"

import { uploadImage } from "./upload-client"

type ImageUploadProps = {
  bucket: UploadBucket
  value: string | null
  onChange: (url: string | null) => void
  label: string
  aspect?: "square" | "wide"
  className?: string
}

/** Single-image field (logo, favicon, category/brand image, banner). */
export function ImageUpload({ bucket, value, onChange, label, aspect = "square", className }: ImageUploadProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setProgress(0)
    try {
      const uploaded = await uploadImage(bucket, file, setProgress)
      onChange(uploaded.publicUrl)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setProgress(null)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm font-medium">{label}</p>
      <div className={cn("relative overflow-hidden rounded-lg border bg-muted", aspect === "square" ? "aspect-square w-32" : "aspect-[21/9] w-full max-w-md")}>
        {value ? <SmartImage src={value} alt={label} fill sizes="400px" className="object-contain p-2" /> : null}
        {progress !== null ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80 text-xs font-medium" aria-live="polite">
            <Loader2 className="size-5 animate-spin" aria-hidden />
            {progress}%
          </div>
        ) : null}
      </div>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={UPLOAD_BUCKETS[bucket].mime.join(",")}
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={progress !== null}>
          <ImagePlus aria-hidden /> {value ? "Replace" : "Upload"}
        </Button>
        {value ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)} disabled={progress !== null}>
            <Trash2 aria-hidden /> Remove
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">JPG, PNG, WebP or AVIF · max {UPLOAD_BUCKETS[bucket].maxBytes / 1024 / 1024} MB</p>
    </div>
  )
}
