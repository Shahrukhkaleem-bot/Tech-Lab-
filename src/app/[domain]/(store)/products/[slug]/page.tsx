import { RotateCcw, Truck } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { JsonLd } from "@/components/common/json-ld"
import { PlainText } from "@/components/common/plain-text"
import { Price } from "@/components/common/price"
import { RatingStars } from "@/components/common/rating-stars"
import { ProductRail, ProductRailSkeleton } from "@/components/home/product-rail"
import { Breadcrumbs } from "@/components/navigation/breadcrumbs"
import { ProductGallery } from "@/components/products/product-gallery"
import { PurchasePanel } from "@/components/products/purchase-panel"
import { StockStatus } from "@/components/products/stock-status"
import { ReviewCard } from "@/components/reviews/review-card"
import { ReviewForm } from "@/components/reviews/review-form"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { ancestry } from "@/features/catalog/category-tree"
import { getCategoryTree, getProductBySlug, getProductReviews, getRelatedProducts } from "@/features/catalog/queries"
import type { ProductDetail } from "@/features/catalog/types"
import { breadcrumbJsonLd, productJsonLd } from "@/features/seo/structured-data"
import { getTenantFromParams, tenantOrigin } from "@/features/tenants/current"
import { getStoreSettings } from "@/features/tenants/queries"
import type { Tenant } from "@/features/tenants/types"

type Props = PageProps<"/[domain]/products/[slug]">

async function load(props: Props) {
  const tenant = await getTenantFromParams(props.params)
  const { slug } = await props.params
  const product = await getProductBySlug(tenant.id, slug)
  if (!product) notFound()
  return { tenant, product }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { product } = await load(props)
  const description = product.seoDescription ?? product.shortDescription ?? product.description?.slice(0, 160) ?? undefined
  const images = product.images.slice(0, 4).map((i) => ({ url: i.url, alt: i.alt ?? product.name }))
  return {
    title: product.seoTitle ?? product.name,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: { type: "website", title: product.name, description, images },
    twitter: { card: images.length ? "summary_large_image" : "summary", title: product.name, description },
  }
}

async function RelatedProducts({ tenant, product }: { tenant: Tenant; product: ProductDetail }) {
  const related = await getRelatedProducts(tenant.id, product)
  return (
    <ProductRail
      id="related-products"
      title="You may also like"
      products={related}
      currency={tenant.currency}
      locale={tenant.locale}
    />
  )
}

export default async function ProductPage(props: Props) {
  const { tenant, product } = await load(props)
  const [settings, tree, reviews] = await Promise.all([
    getStoreSettings(tenant.id),
    getCategoryTree(tenant.id),
    getProductReviews(tenant.id, product.id),
  ])
  const origin = tenantOrigin(tenant)
  const chain = ancestry(tree, product.categoryId)
  const crumbs = [
    ...chain.map((c, i) => ({ name: c.name, href: `/categories/${chain.slice(0, i + 1).map((x) => x.slug).join("/")}` })),
    { name: product.name, href: `/products/${product.slug}` },
  ]

  return (
    <div className="container-page py-6 sm:py-8">
      <JsonLd
        data={[
          productJsonLd(product, tenant, origin, reviews),
          breadcrumbJsonLd(origin, [{ name: "Home", path: "/" }, ...crumbs.map((c) => ({ name: c.name, path: c.href }))]),
        ]}
      />
      <Breadcrumbs items={crumbs} />

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductGallery images={product.images} name={product.name} discountPercent={product.discountPercent} />

        <div className="flex flex-col gap-4">
          {product.brand ? (
            <Link href={`/brands/${product.brand.slug}`} className="w-fit text-xs font-semibold tracking-wide text-primary uppercase hover:underline">
              {product.brand.name}
            </Link>
          ) : null}
          <h1 className="text-2xl leading-tight font-bold tracking-tight sm:text-3xl">{product.name}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {product.reviewCount > 0 ? (
              <a href="#reviews" className="hover:underline">
                <RatingStars rating={product.rating} count={product.reviewCount} showValue size="md" />
              </a>
            ) : null}
            {product.sku ? <span>SKU: {product.sku}</span> : null}
          </div>

          <div className="flex items-center gap-3">
            <Price
              price={product.price}
              originalPrice={product.salePrice != null ? product.originalPrice : null}
              currency={tenant.currency}
              locale={tenant.locale}
              size="lg"
            />
            {product.discountPercent > 0 ? (
              <span className="rounded-md bg-highlight/15 px-2 py-0.5 text-sm font-semibold text-foreground">Save {product.discountPercent}%</span>
            ) : null}
          </div>

          <StockStatus product={product} lowStockThreshold={product.lowStockThreshold} />
          {product.shortDescription ? <p className="text-sm text-muted-foreground">{product.shortDescription}</p> : null}

          <PurchasePanel product={product} />

          <ul className="grid gap-3 rounded-xl border p-4 text-sm sm:grid-cols-2">
            <li className="flex gap-3">
              <Truck className="size-5 shrink-0 text-primary" aria-hidden />
              <span>
                {settings.shipping.estimated_days
                  ? `Delivery in ${settings.shipping.estimated_days.min}–${settings.shipping.estimated_days.max} working days`
                  : "Nationwide delivery"}
              </span>
            </li>
            <li className="flex gap-3">
              <RotateCcw className="size-5 shrink-0 text-primary" aria-hidden />
              <span>Easy returns — see our return policy</span>
            </li>
          </ul>

          <Accordion type="multiple" defaultValue={["description"]} className="mt-2">
            {product.description ? (
              <AccordionItem value="description">
                <AccordionTrigger>Description</AccordionTrigger>
                <AccordionContent>
                  <PlainText text={product.description} />
                </AccordionContent>
              </AccordionItem>
            ) : null}
            {product.specifications.length ? (
              <AccordionItem value="specs">
                <AccordionTrigger>Specifications</AccordionTrigger>
                <AccordionContent>
                  <table className="w-full text-sm">
                    <tbody className="divide-y">
                      {product.specifications.map((s) => (
                        <tr key={s.name}>
                          <th scope="row" className="w-2/5 py-2 pr-4 text-left font-medium">
                            {s.name}
                          </th>
                          <td className="py-2 text-muted-foreground">{s.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </AccordionContent>
              </AccordionItem>
            ) : null}
            {settings.shippingInfo ? (
              <AccordionItem value="shipping">
                <AccordionTrigger>Shipping information</AccordionTrigger>
                <AccordionContent>
                  <PlainText text={settings.shippingInfo} />
                </AccordionContent>
              </AccordionItem>
            ) : null}
            {settings.returnInfo ? (
              <AccordionItem value="returns">
                <AccordionTrigger>Returns & warranty</AccordionTrigger>
                <AccordionContent>
                  <PlainText text={settings.returnInfo} />
                </AccordionContent>
              </AccordionItem>
            ) : null}
          </Accordion>
        </div>
      </div>

      <section id="reviews" aria-labelledby="reviews-heading" className="mt-16 scroll-mt-24">
        <h2 id="reviews-heading" className="mb-6 text-xl font-bold tracking-tight sm:text-2xl">
          Customer reviews {product.reviewCount ? `(${product.reviewCount})` : ""}
        </h2>
        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          <div className="grid gap-4 sm:grid-cols-2">
            {reviews.length ? (
              reviews.map((r) => <ReviewCard key={r.id} review={r} showProduct={false} />)
            ) : (
              <p className="text-sm text-muted-foreground">No reviews yet. Be the first to share your thoughts.</p>
            )}
          </div>
          <ReviewFormGate productId={product.id} slug={product.slug} />
        </div>
      </section>

      <div className="mt-16">
        <Suspense fallback={<ProductRailSkeleton />}>
          <RelatedProducts tenant={tenant} product={product} />
        </Suspense>
      </div>
    </div>
  )
}

/** Review form for signed-in users; sign-in prompt otherwise (auth checked client-side for cacheability, enforced server-side on submit). */
function ReviewFormGate({ productId, slug }: { productId: string; slug: string }) {
  return (
    <div className="space-y-3">
      <ReviewForm productId={productId} />
      <p className="text-xs text-muted-foreground">
        You need to be{" "}
        <Link href={`/login?next=/products/${slug}%23reviews`} className="font-medium text-primary hover:underline">
          signed in
        </Link>{" "}
        to post a review. Reviews are moderated before they appear.
      </p>
    </div>
  )
}
