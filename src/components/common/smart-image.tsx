"use client"

import { ImageOff, Package } from "lucide-react"
import Image, { type ImageProps } from "next/image"
import { useState } from "react"

import { cn } from "@/lib/utils"

type SmartImageProps = Omit<ImageProps, "src" | "alt"> & {
  src: string | null | undefined
  alt: string
  /** Text used for the branded placeholder when there is no image. */
  fallbackLabel?: string
  fallbackClassName?: string
}

/**
 * next/image with a branded placeholder for missing or broken images, so catalogue
 * pages never show broken-image icons (common while stores are being set up).
 */
export function SmartImage({ src, alt, fallbackLabel, className, fallbackClassName, ...props }: SmartImageProps) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn(
          "flex size-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-accent to-muted p-4 text-center text-primary/60",
          fallbackClassName,
        )}
      >
        {failed ? <ImageOff className="size-8" aria-hidden /> : <Package className="size-8" aria-hidden />}
        {fallbackLabel ? <span className="line-clamp-2 text-xs font-medium text-muted-foreground">{fallbackLabel}</span> : null}
      </div>
    )
  }

  return <Image src={src} alt={alt} className={className} onError={() => setFailed(true)} {...props} />
}
