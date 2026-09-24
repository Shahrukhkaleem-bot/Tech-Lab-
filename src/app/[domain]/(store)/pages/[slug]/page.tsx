import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PlainText } from "@/components/common/plain-text"
import { Breadcrumbs } from "@/components/navigation/breadcrumbs"
import { getTenantFromParams } from "@/features/tenants/current"
import { getStorePage } from "@/features/tenants/queries"
import { formatDate } from "@/lib/utils/format"

type Props = PageProps<"/[domain]/pages/[slug]">

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tenant = await getTenantFromParams(params)
  const { slug } = await params
  const page = await getStorePage(tenant.id, slug)
  if (!page) return {}
  return { title: page.title, description: page.seoDescription ?? undefined, alternates: { canonical: `/pages/${page.slug}` } }
}

/** Tenant policy / content pages (shipping, returns, privacy, FAQ …). */
export default async function StoreContentPage({ params }: Props) {
  const tenant = await getTenantFromParams(params)
  const { slug } = await params
  const page = await getStorePage(tenant.id, slug)
  if (!page) notFound()

  return (
    <article className="container-page max-w-3xl py-8 sm:py-12">
      <Breadcrumbs items={[{ name: page.title }]} />
      <h1 className="text-3xl font-bold tracking-tight">{page.title}</h1>
      <p className="mt-2 mb-8 text-xs text-muted-foreground">Last updated {formatDate(page.updatedAt, tenant.locale, tenant.timezone)}</p>
      <PlainText text={page.content} className="text-base" />
    </article>
  )
}
