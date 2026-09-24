/**
 * Extracts `{bucket, path}` from a Supabase public object URL
 * (…/storage/v1/object/public/{bucket}/{path}) so old files can be deleted when
 * replaced. Returns null for external URLs (never deleted).
 */
export function parseStoragePublicUrl(url: string | null | undefined, supabaseUrl: string | undefined): { bucket: string; path: string } | null {
  if (!url || !supabaseUrl) return null
  try {
    const u = new URL(url)
    const base = new URL(supabaseUrl)
    if (u.host !== base.host) return null
    const m = /^\/storage\/v1\/object\/public\/([a-z0-9-]+)\/(.+)$/.exec(u.pathname)
    return m ? { bucket: m[1]!, path: decodeURIComponent(m[2]!) } : null
  } catch {
    return null
  }
}
