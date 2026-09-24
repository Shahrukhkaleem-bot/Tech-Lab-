import { AdminPageHeader } from "@/components/admin/page-header"
import { BrandingForm } from "@/components/admin/settings/branding-form"
import { PaymentSettingsForm, ShippingSettingsForm } from "@/components/admin/settings/commerce-forms"
import { ContentSettingsForm, StorePagesEditor } from "@/components/admin/settings/content-forms"
import { GeneralSettingsForm } from "@/components/admin/settings/general-form"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { requireAdminPage } from "@/features/auth/session"
import { getTenantFromParams } from "@/features/tenants/current"
import { getStoreSettings } from "@/features/tenants/queries"

export const metadata = { title: "Settings" }

export default async function AdminSettingsPage({ params }: PageProps<"/[domain]/admin/settings">) {
  const tenant = await getTenantFromParams(params)
  const ctx = await requireAdminPage(tenant, "admin", "/admin/settings")
  // Cached settings are safe here: every settings action invalidates the tenant's tags.
  const [settings, { data: pages }] = await Promise.all([
    getStoreSettings(tenant.id),
    ctx.supabase.from("store_pages").select("*").eq("tenant_id", tenant.id).order("title"),
  ])

  return (
    <>
      <AdminPageHeader title="Store settings" description={`${tenant.subdomain}${tenant.customDomain ? ` · ${tenant.customDomain}` : ""}`} />
      <Tabs defaultValue="general" className="max-w-4xl">
        <TabsList className="mb-4 flex h-auto flex-wrap">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="shipping">Shipping</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="content">Homepage & SEO</TabsTrigger>
          <TabsTrigger value="pages">Pages</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <GeneralSettingsForm
            initial={{
              name: tenant.name,
              contactEmail: tenant.contact.email ?? "",
              contactPhone: tenant.contact.phone ?? "",
              whatsappNumber: tenant.contact.whatsapp ?? "",
              address: tenant.contact.address ?? "",
              tagline: settings.tagline ?? "",
              announcement: settings.announcement ?? "",
              social: tenant.social,
            }}
          />
        </TabsContent>
        <TabsContent value="branding">
          <BrandingForm
            initial={{
              primary_color: tenant.brand.primaryColor,
              secondary_color: tenant.brand.secondaryColor,
              accent_color: tenant.brand.accentColor,
              logo_url: tenant.brand.logoUrl,
              favicon_url: tenant.brand.faviconUrl,
              font_family: tenant.brand.font,
              radius: tenant.brand.radius,
            }}
          />
        </TabsContent>
        <TabsContent value="shipping">
          <ShippingSettingsForm initial={{ ...settings.shipping, shippingInfo: settings.shippingInfo ?? "", returnInfo: settings.returnInfo ?? "" }} />
        </TabsContent>
        <TabsContent value="payments">
          <PaymentSettingsForm
            cardConfigured={Boolean(process.env.STRIPE_SECRET_KEY)}
            initial={{
              enabled_methods: settings.payment.enabledMethods,
              bank_accounts: settings.payment.bankAccounts,
              instructions: settings.payment.instructions ?? "",
              stripe_account_id: settings.payment.stripeAccountId ?? "",
            }}
          />
        </TabsContent>
        <TabsContent value="content">
          <ContentSettingsForm
            initial={{
              trustBadges: settings.trustBadges,
              homepageSections: settings.homepageSections,
              priceRanges: settings.priceRanges,
              footerBadges: settings.footerBadges,
              location: settings.location,
              seoTitle: settings.seo.title ?? "",
              seoDescription: settings.seo.description ?? "",
            }}
          />
        </TabsContent>
        <TabsContent value="pages">
          <StorePagesEditor
            pages={(pages ?? []).map((p) => ({
              id: p.id,
              slug: p.slug,
              title: p.title,
              content: p.content,
              seoDescription: p.seo_description ?? "",
              isPublished: p.is_published,
            }))}
          />
        </TabsContent>
      </Tabs>
    </>
  )
}
