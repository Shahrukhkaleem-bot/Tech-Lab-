import { Mail, MapPin, Phone } from "lucide-react"

import { SocialLinks } from "@/components/common/social-icons"
import type { StoreSettings, Tenant } from "@/features/tenants/types"

/** Thin contact bar above the header (all values tenant-configured, all optional). */
export function TopBar({ tenant, settings }: { tenant: Tenant; settings: StoreSettings }) {
  const { phone, email, address } = tenant.contact
  const hasAny = phone || email || address || settings.announcement || Object.keys(tenant.social).length
  if (!hasAny) return null

  return (
    <div className="bg-secondary text-xs text-secondary-foreground">
      <div className="container-page flex h-9 items-center justify-between gap-4">
        <ul className="flex min-w-0 items-center gap-4 sm:gap-5">
          {phone ? (
            <li>
              <a href={`tel:${phone.replace(/\s+/g, "")}`} className="flex items-center gap-1.5 hover:underline">
                <Phone className="size-3.5" aria-hidden />
                <span>{phone}</span>
              </a>
            </li>
          ) : null}
          {email ? (
            <li className="hidden sm:block">
              <a href={`mailto:${email}`} className="flex items-center gap-1.5 hover:underline">
                <Mail className="size-3.5" aria-hidden />
                <span>{email}</span>
              </a>
            </li>
          ) : null}
          {address ? (
            <li className="hidden min-w-0 lg:block">
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{address}</span>
              </span>
            </li>
          ) : null}
        </ul>
        {settings.announcement ? <p className="hidden truncate font-medium md:block">{settings.announcement}</p> : null}
        <SocialLinks links={tenant.social} className="-mr-2 shrink-0" itemClassName="size-7" />
      </div>
    </div>
  )
}
