import { Mail, MessageCircle, Phone } from "lucide-react"
import type { Metadata } from "next"

import { StoreLocation } from "@/components/home/store-location"
import { Breadcrumbs } from "@/components/navigation/breadcrumbs"
import { getTenantFromParams } from "@/features/tenants/current"
import { getStoreSettings } from "@/features/tenants/queries"

export async function generateMetadata({ params }: PageProps<"/[domain]/contact">): Promise<Metadata> {
  const tenant = await getTenantFromParams(params)
  return { title: "Contact us", description: `Get in touch with ${tenant.name}.`, alternates: { canonical: "/contact" } }
}

export default async function ContactPage({ params }: PageProps<"/[domain]/contact">) {
  const tenant = await getTenantFromParams(params)
  const settings = await getStoreSettings(tenant.id)
  const { phone, email, whatsapp } = tenant.contact

  const channels = [
    phone ? { icon: Phone, label: "Call us", value: phone, href: `tel:${phone.replace(/\s+/g, "")}` } : null,
    whatsapp ? { icon: MessageCircle, label: "WhatsApp", value: whatsapp, href: `https://wa.me/${whatsapp.replace(/[^0-9]/g, "")}` } : null,
    email ? { icon: Mail, label: "Email", value: email, href: `mailto:${email}` } : null,
  ].filter((c) => c !== null)

  return (
    <div className="container-page space-y-10 py-8 sm:py-12">
      <div>
        <Breadcrumbs items={[{ name: "Contact" }]} />
        <h1 className="text-3xl font-bold tracking-tight">Contact us</h1>
        <p className="mt-2 text-muted-foreground">We&apos;re happy to help with orders, products and returns.</p>
      </div>
      {channels.length ? (
        <ul className="grid gap-4 sm:grid-cols-3">
          {channels.map((c) => (
            <li key={c.label}>
              <a
                href={c.href}
                target={c.href.startsWith("https") ? "_blank" : undefined}
                rel={c.href.startsWith("https") ? "noopener noreferrer" : undefined}
                className="flex items-center gap-4 rounded-xl border p-5 transition-colors hover:border-primary"
              >
                <span className="flex size-11 items-center justify-center rounded-full bg-accent text-primary">
                  <c.icon className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{c.label}</span>
                  <span className="block text-sm text-muted-foreground">{c.value}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      <StoreLocation location={settings.location} storeName={tenant.name} title="Find us" />
    </div>
  )
}
