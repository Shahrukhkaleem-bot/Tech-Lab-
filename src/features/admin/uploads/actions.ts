"use server"

import { randomUUID } from "node:crypto"

import { z } from "zod"

import { adminAction } from "@/features/admin/context"
import { AppError, type ActionResult } from "@/lib/errors/app-error"
import { logger } from "@/lib/logger"

import { MIME_EXTENSION, UPLOAD_BUCKETS, validateUploadFile, type UploadBucket } from "./constants"

const requestSchema = z.object({
  bucket: z.enum(Object.keys(UPLOAD_BUCKETS) as [UploadBucket, ...UploadBucket[]]),
  contentType: z.string().max(100),
  size: z.number().int().positive(),
})

export type SignedUpload = { signedUrl: string; path: string; publicUrl: string; bucket: UploadBucket }

/**
 * Issues a short-lived signed upload URL for `{tenantId}/{uuid}.{ext}`.
 * - Tenant comes from the Host header; the client cannot choose the folder.
 * - The file name is server-generated (no path traversal, no overwrite).
 * - Created with the USER's session: Storage RLS re-checks role/tenant for the path.
 * - Bucket-level MIME + size limits are enforced again by Storage on upload.
 */
export async function createSignedUploadAction(input: unknown): Promise<ActionResult<SignedUpload>> {
  return adminAction("uploads.sign", "manageContent", async ({ tenant, supabase }) => {
    const data = requestSchema.parse(input)
    const problem = validateUploadFile(data.bucket, { type: data.contentType, size: data.size })
    if (problem) throw new AppError("VALIDATION", problem)

    const path = `${tenant.id}/${randomUUID()}.${MIME_EXTENSION[data.contentType]}`
    const { data: signed, error } = await supabase.storage.from(data.bucket).createSignedUploadUrl(path)
    if (error || !signed) {
      logger.error("uploads.sign_failed", { tenantId: tenant.id, bucket: data.bucket, error })
      throw new AppError("FORBIDDEN", "You are not allowed to upload files here.")
    }
    const { data: pub } = supabase.storage.from(data.bucket).getPublicUrl(path)
    return { signedUrl: signed.signedUrl, path, publicUrl: pub.publicUrl, bucket: data.bucket }
  })
}

/** Deletes an object in this tenant's folder (RLS re-checks). Used when images are replaced/removed. */
export async function deleteUploadAction(input: unknown): Promise<ActionResult<null>> {
  const schema = z.object({ bucket: requestSchema.shape.bucket, path: z.string().regex(/^[0-9a-f-]{36}\/[A-Za-z0-9_-]{1,80}\.(png|jpe?g|webp|avif|ico)$/) })
  return adminAction("uploads.delete", "manageContent", async ({ tenant, supabase }) => {
    const data = schema.parse(input)
    if (!data.path.startsWith(`${tenant.id}/`)) throw new AppError("FORBIDDEN", "You cannot delete this file.")
    const { error } = await supabase.storage.from(data.bucket).remove([data.path])
    if (error) logger.warn("uploads.delete_failed", { tenantId: tenant.id, path: data.path, error })
    return null
  })
}
