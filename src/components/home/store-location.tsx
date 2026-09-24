import { Clock, ExternalLink, MapPin, Phone } from "lucide-react"

import { SectionHeader } from "@/components/common/section-header"
import { Button } from "@/components/ui/button"
import type { StoreLocation as StoreLocationConfig } from "@/features/tenants/types"

/** Physical store block (address, hours, phone, map). Renders nothing if unconfigured. */
export function StoreLocation({ location, storeName, title = "Visit Our Store" }: { location: StoreLocationConfig; storeName: string; title?: string }) {
  if (!location.address && location.latitude == null) return null
  const hasCoords = location.latitude != null && location.longitude != null
  const mapQuery = hasCoords ? `${location.latitude},${location.longitude}` : (location.address ?? "")
  const mapsHref = location.map_url ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`

  return (
    <section aria-labelledby="store-location">
      <SectionHeader id="store-location" title={title} />
      <div className="grid overflow-hidden rounded-2xl border bg-card md:grid-cols-5">
        <div className="space-y-5 p-6 sm:p-8 md:col-span-2">
          <h3 className="text-lg font-semibold">{storeName}</h3>
          <ul className="space-y-4 text-sm">
            {location.address ? (
              <li className="flex gap-3">
                <MapPin className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <address className="not-italic">{location.address}</address>
              </li>
            ) : null}
            {location.phone ? (
              <li className="flex gap-3">
                <Phone className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <a href={`tel:${location.phone.replace(/\s+/g, "")}`} className="hover:underline">
                  {location.phone}
                </a>
              </li>
            ) : null}
            {location.hours.length ? (
              <li className="flex gap-3">
                <Clock className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                  {location.hours.map((h) => (
                    <div key={h.label} className="contents">
                      <dt className="font-medium">{h.label}</dt>
                      <dd className="text-muted-foreground">{h.value}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ) : null}
          </ul>
          <Button asChild variant="outline">
            <a href={mapsHref} target="_blank" rel="noopener noreferrer">
              Get directions <ExternalLink aria-hidden />
            </a>
          </Button>
        </div>
        <div className="relative min-h-64 bg-muted md:col-span-3">
          <iframe
            title={`Map showing ${storeName}`}
            src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="absolute inset-0 size-full border-0"
          />
        </div>
      </div>
    </section>
  )
}
