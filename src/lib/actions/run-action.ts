import "server-only"

import { randomUUID } from "node:crypto"

import { unstable_rethrow } from "next/navigation"
import { z } from "zod"

import { AppError, fail, ok, type ActionResult } from "@/lib/errors/app-error"
import { logger } from "@/lib/logger"

/**
 * Wraps every Server Action body so that:
 *  - Zod errors become VALIDATION with per-field messages,
 *  - AppErrors keep their safe code/message,
 *  - anything else is logged with a reference id and returned as a generic message
 *    (DB internals never reach the browser),
 *  - Next.js control-flow errors (redirect/notFound) are re-thrown untouched.
 */
export async function runAction<T>(name: string, body: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await body())
  } catch (error) {
    unstable_rethrow(error)

    if (error instanceof z.ZodError) {
      const flat = z.flattenError(error)
      return fail("VALIDATION", "Please check the highlighted fields.", {
        fieldErrors: flat.fieldErrors as Record<string, string[]>,
      })
    }
    if (error instanceof AppError) {
      if (error.code === "INTERNAL") logger.error(`action.${name}`, { error })
      return fail(error.code, error.message, { details: error.details })
    }

    const reference = randomUUID().slice(0, 8)
    logger.error(`action.${name}.unhandled`, { reference, error })
    return fail("INTERNAL", `Something went wrong. Please try again. (ref ${reference})`)
  }
}
