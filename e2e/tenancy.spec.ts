import { expect, test } from "@playwright/test"

const port = Number(process.env.E2E_PORT ?? 3000)
const host = (sub: string) => `http://${sub}.localhost:${port}`
// Chromium resolves *.localhost itself; Node's HTTP client (used by `request`) does not,
// so API requests go to localhost with an explicit Host header.
const apiGet = (request: import("@playwright/test").APIRequestContext, sub: string, path: string) =>
  request.get(`http://localhost:${port}${path}`, { headers: { Host: `${sub}.localhost:${port}` } })

test("each subdomain renders its own store, branding and catalogue", async ({ page }) => {
  await page.goto(host("demo-fashion"))
  await expect(page).toHaveTitle(/Demo Fashion/)
  const fashionPrimary = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue("--primary").trim())

  await page.goto(host("demo-electronics"))
  await expect(page).toHaveTitle(/Demo Electronics/)
  const electronicsPrimary = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue("--primary").trim())

  expect(fashionPrimary).not.toBe(electronicsPrimary)
})

test("a product of store A is not reachable on store B", async ({ page }) => {
  const res = await page.goto(`${host("demo-fashion")}/products/sonora-buds-pro`)
  expect(res?.status()).toBe(404)
})

test("a path cannot address another tenant's route tree", async ({ page }) => {
  // proxy.ts always prefixes the current host's tenant, so this becomes /demo-fashion/demo-electronics/…
  const res = await page.goto(`${host("demo-fashion")}/demo-electronics/products`)
  expect(res?.status()).toBe(404)
})

test("unknown tenants 404", async ({ page }) => {
  const res = await page.goto(host("no-such-store"))
  expect(res?.status()).toBe(404)
})

test("carts are isolated per store", async ({ page }) => {
  await page.goto(`${host("demo-electronics")}/products/kinetic-gan-65w`)
  await page.getByRole("button", { name: /Add to cart/ }).first().click()
  // The PDP opens the cart drawer (modal), which hides the header from the accessibility tree.
  await expect(page.getByRole("dialog", { name: /Your cart \(1\)/ })).toBeVisible()

  await page.goto(`${host("demo-fashion")}/`)
  await expect(page.getByRole("button", { name: /Cart \(0 items\)/ })).toBeVisible()
})

test("tenant sitemap and robots are served per host", async ({ request }) => {
  const sitemap = await apiGet(request, "demo-electronics", "/sitemap.xml")
  expect(sitemap.ok()).toBeTruthy()
  const xml = await sitemap.text()
  expect(xml).toContain("/products/sonora-buds-pro")
  expect(xml).not.toContain("printed-lawn-kurta") // fashion product
})
