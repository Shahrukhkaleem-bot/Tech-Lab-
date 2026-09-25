"use client"

import { createSignedUploadAction } from "@/features/admin/uploads/actions"
import { validateUploadFile, type UploadBucket } from "@/features/admin/uploads/constants"

export type ImageSize = { width: number; height: number }
export type UploadedFile = { publicUrl: string; path: string; bucket: UploadBucket; size: ImageSize | null }

/** Intrinsic pixel size of an image file (null if the browser can't decode it, e.g. .ico). */
async function readImageSize(file: File): Promise<ImageSize | null> {
  try {
    const bitmap = await createImageBitmap(file)
    const size = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return size
  } catch {
    return null
  }
}

/**
 * Uploads a file straight to Supabase Storage through a signed URL (the server never
 * proxies file bytes). XHR is used instead of fetch to report upload progress.
 */
export async function uploadImage(bucket: UploadBucket, file: File, onProgress?: (pct: number) => void): Promise<UploadedFile> {
  const problem = validateUploadFile(bucket, file)
  if (problem) throw new Error(problem)
  const size = await readImageSize(file)

  const res = await createSignedUploadAction({ bucket, contentType: file.type, size: file.size })
  if (!res.ok) throw new Error(res.error.message)
  const { signedUrl, path, publicUrl } = res.data

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", signedUrl)
    xhr.setRequestHeader("x-upsert", "false")
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload was rejected by storage.")))
    xhr.onerror = () => reject(new Error("Network error during upload."))
    const body = new FormData()
    body.append("cacheControl", "31536000")
    body.append("", file)
    xhr.send(body)
  })

  return { publicUrl, path, bucket, size }
}
