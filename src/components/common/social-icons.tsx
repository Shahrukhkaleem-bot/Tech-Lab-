import { Globe, MessageCircle } from "lucide-react"

import type { SocialNetwork } from "@/features/tenants/schemas"
import { cn } from "@/lib/utils"

/**
 * Minimal geometric social glyphs (lucide v1 no longer ships brand icons, and we
 * avoid adding an icon dependency for six logos).
 */
const S = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const

function Glyph({ network, className }: { network: SocialNetwork; className?: string }) {
  const common = { viewBox: "0 0 24 24", className, "aria-hidden": true } as const
  switch (network) {
    case "facebook":
      return (
        <svg {...common} {...S}>
          <path d="M15 3h-2.5A3.5 3.5 0 0 0 9 6.5V10H6.5v3.5H9V21h3.5v-7.5H15l.5-3.5h-3V7a1 1 0 0 1 1-1H15z" />
        </svg>
      )
    case "instagram":
      return (
        <svg {...common} {...S}>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
        </svg>
      )
    case "youtube":
      return (
        <svg {...common} {...S}>
          <rect x="2" y="5" width="20" height="14" rx="4" />
          <path d="m10 9 5 3-5 3z" fill="currentColor" />
        </svg>
      )
    case "tiktok":
      return (
        <svg {...common} {...S}>
          <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5" />
          <path d="M14 3c.5 2.5 2.5 4.5 5 4.5" />
        </svg>
      )
    case "x":
      return (
        <svg {...common} {...S}>
          <path d="M4 4l16 16M20 4 4 20" />
        </svg>
      )
    case "linkedin":
      return (
        <svg {...common} {...S}>
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7" />
        </svg>
      )
    case "whatsapp":
      return <MessageCircle className={className} aria-hidden />
    default:
      return <Globe className={className} aria-hidden />
  }
}

const LABELS: Record<SocialNetwork, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  x: "X (Twitter)",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
}

export function SocialLinks({
  links,
  className,
  itemClassName,
}: {
  links: Partial<Record<SocialNetwork, string>>
  className?: string
  itemClassName?: string
}) {
  const entries = Object.entries(links) as [SocialNetwork, string][]
  if (!entries.length) return null
  return (
    <ul className={cn("flex items-center gap-1", className)}>
      {entries.map(([network, href]) => (
        <li key={network}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={LABELS[network]}
            className={cn("inline-flex size-8 items-center justify-center rounded-full transition-colors hover:bg-white/10", itemClassName)}
          >
            <Glyph network={network} className="size-4" />
          </a>
        </li>
      ))}
    </ul>
  )
}
