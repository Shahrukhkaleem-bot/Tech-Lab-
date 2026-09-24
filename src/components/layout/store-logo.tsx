import Image from "next/image"
import Link from "next/link"

import type { Tenant } from "@/features/tenants/types"
import { cn } from "@/lib/utils"

/** Tenant logo, or a typographic wordmark when no logo is uploaded. */
export function StoreLogo({ tenant, className, inverted }: { tenant: Tenant; className?: string; inverted?: boolean }) {
  return (
    <Link href="/" className={cn("inline-flex shrink-0 items-center gap-2", className)} aria-label={`${tenant.name} — home`}>
      {tenant.brand.logoUrl ? (
        <Image
          src={tenant.brand.logoUrl}
          alt={tenant.name}
          width={160}
          height={48}
          priority
          className="h-9 w-auto object-contain sm:h-10"
          unoptimized={tenant.brand.logoUrl.endsWith(".svg")}
        />
      ) : (
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className={cn(
              "flex size-9 items-center justify-center rounded-lg text-sm font-black",
              inverted ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground",
            )}
          >
            {tenant.name
              .split(/\s+/)
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </span>
          <span className="text-lg leading-none font-extrabold tracking-tight">{tenant.name}</span>
        </span>
      )}
    </Link>
  )
}
