import { Globe, Palette, ShieldCheck, Store } from "lucide-react"

/**
 * Platform landing page served on the apex domain. Replace with your SaaS marketing
 * site / tenant sign-up flow. Contains no tenant data.
 */
const FEATURES = [
  { icon: Store, title: "Unlimited stores", body: "Each store gets its own catalogue, orders, customers and settings." },
  { icon: Palette, title: "White-label branding", body: "Logo, colours, typography and content — all configurable per store." },
  { icon: Globe, title: "Your domain", body: "Launch on a subdomain instantly, or connect a custom domain with automatic SSL." },
  { icon: ShieldCheck, title: "Secure by design", body: "Row-level security isolates every store's data at the database layer." },
]

export default function PlatformHome() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-20">
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Launch your online store in minutes.</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
        A production-ready, multi-tenant commerce platform for electronics, fashion, grocery and any other retail category.
      </p>
      <ul className="mt-14 grid gap-6 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <li key={f.title} className="rounded-2xl border p-6">
            <f.icon className="size-6" aria-hidden />
            <h2 className="mt-4 font-semibold">{f.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
          </li>
        ))}
      </ul>
    </main>
  )
}
