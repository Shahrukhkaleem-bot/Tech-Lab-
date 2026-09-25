import { Clock, Mail, MapPin, Phone } from "lucide-react"
import Link from "next/link"

import { SocialLinks } from "@/components/common/social-icons"
import { developerCredit, type DeveloperCredit } from "@/config/platform"
import type { NavLink, StoreNavigation, StoreSettings, Tenant } from "@/features/tenants/types"

import { StoreLogo } from "./store-logo"

function CreditName({ label, url }: { label: string; url?: string }) {
  const className = "font-semibold text-white opacity-100"
  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className={`${className} hover:underline`}>
      {label}
    </a>
  ) : (
    <span className={className}>{label}</span>
  )
}

/** Platform developer credit (see src/config/platform.ts). */
function DeveloperCreditLine({ credit }: { credit: DeveloperCredit }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2">
      <span className="opacity-70">Developed by</span>
      <CreditName label={credit.name} url={credit.nameUrl} />
      <span aria-hidden className="opacity-40">
        |
      </span>
      <CreditName label={credit.company} url={credit.companyUrl} />
    </p>
  )
}

function LinkColumn({ title, links }: { title: string; links: NavLink[] }) {
  if (!links.length) return null
  return (
    <div>
      <h2 className="mb-4 text-sm font-semibold tracking-wide uppercase">{title}</h2>
      <ul className="space-y-0.5 text-sm">
        {links.map((l) => (
          <li key={l.id}>
            <Link href={l.href} className="inline-block py-2 opacity-80 transition-opacity hover:underline hover:opacity-100 sm:py-1">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Four-column, fully tenant-configured footer. */
export function SiteFooter({ tenant, settings, navigation }: { tenant: Tenant; settings: StoreSettings; navigation: StoreNavigation }) {
  const year = new Date().getFullYear()
  const { phone, email, address } = tenant.contact

  return (
    <footer className="mt-16 bg-secondary text-secondary-foreground">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          <StoreLogo tenant={tenant} inverted />
          {settings.tagline ? <p className="text-sm opacity-80">{settings.tagline}</p> : null}
          <ul className="space-y-2 text-sm opacity-90">
            {address ? (
              <li className="flex gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{address}</span>
              </li>
            ) : null}
            {phone ? (
              <li className="flex gap-2">
                <Phone className="mt-0.5 size-4 shrink-0" aria-hidden />
                <a href={`tel:${phone.replace(/\s+/g, "")}`} className="-my-2 inline-block py-2 hover:underline">
                  {phone}
                </a>
              </li>
            ) : null}
            {email ? (
              <li className="flex gap-2">
                <Mail className="mt-0.5 size-4 shrink-0" aria-hidden />
                <a href={`mailto:${email}`} className="-my-2 inline-block py-2 hover:underline">
                  {email}
                </a>
              </li>
            ) : null}
            {settings.location.hours.map((h) => (
              <li key={h.label} className="flex gap-2">
                <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {h.label}: {h.value}
                </span>
              </li>
            ))}
          </ul>
          <SocialLinks links={tenant.social} className="-ml-2" />
        </div>

        <LinkColumn title="Customer Service" links={navigation.footerHelp} />
        <LinkColumn title="Policies" links={navigation.footerPolicies} />
        <LinkColumn title="Shop" links={navigation.footerCompany} />
      </div>

      {settings.footerBadges.length ? (
        <div className="border-t border-white/10">
          <ul className="container-page flex flex-wrap items-center gap-2 py-4 text-xs" aria-label="Payment and delivery partners">
            {settings.footerBadges.map((b) => (
              <li key={b.label} className="rounded-md bg-white/10 px-2.5 py-1 font-medium">
                {b.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-5 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="opacity-70">
            © {year} {tenant.name}. All rights reserved.
          </p>
          {developerCredit ? <DeveloperCreditLine credit={developerCredit} /> : null}
        </div>
      </div>
    </footer>
  )
}
