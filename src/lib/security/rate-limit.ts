import "server-only"

import { createHash } from "node:crypto"

import { headers } from "next/headers"

import { logger } from "@/lib/logger"
import { createSupabaseServiceClient } from "@/lib/supabase/service"

/**
 * Fixed-window rate limiter backed by Postgres (`consume_rate_limit`).
 * No extra infrastructure; for very high traffic swap in Upstash/Redis behind the
 * same function signature.
 *
 * Fails OPEN on infrastructure errors (logged) so a limiter outage cannot take
 * checkout down; Vercel's platform-level DDoS protection is the outer layer.
 */
export async function rateLimit(bucket: string, identifier: string, limit: number, windowSeconds: number): Promise<boolean> {
  const key = `${bucket}:${identifier}`.slice(0, 200)
  try {
    const { data, error } = await createSupabaseServiceClient().rpc("consume_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    })
    if (error) throw error
    return data === true
  } catch (error) {
    logger.error("rate_limit.unavailable", { bucket, error })
    return true
  }
}

/**
 * Stable, privacy-preserving client identifier: SHA-256 of the first X-Forwarded-For
 * hop (set by Vercel's edge, not spoofable past it). Raw IPs are never stored.
 */
export async function clientFingerprint(): Promise<string> {
  const h = await headers()
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown"
  return createHash("sha256").update(ip).digest("hex").slice(0, 32)
}
