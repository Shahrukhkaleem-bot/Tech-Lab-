import { expect, test } from "@playwright/test"

/**
 * Critical path: browse → add to cart → checkout (COD) → order confirmation.
 * Uses the seeded "Demo Electronics" tenant.
 */
test("customer can browse, add to cart, check out with COD and see the confirmation", async ({ page }) => {
  test.setTimeout(90_000) // several routes compile on first visit under `next dev`
  await page.goto("/")
  await expect(page).toHaveTitle(/Demo Electronics/)
  await expect(page.getByRole("heading", { name: "Shop by Category" })).toBeVisible()

  // Search → product page
  await page.goto("/products?q=voltix")
  const card = page.getByRole("article").filter({ hasText: "20,000 mAh" })
  await card.getByRole("link", { name: /Voltix 20,000 mAh/ }).click()
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Voltix 20,000 mAh")

  // Add two to cart from the PDP (opens the drawer)
  await page.getByRole("button", { name: "Increase quantity" }).click()
  await page.getByRole("button", { name: /Add to cart/ }).first().click()
  const drawer = page.getByRole("dialog", { name: /Your cart/ })
  await expect(drawer).toBeVisible()
  await expect(drawer.getByText("Voltix 20,000 mAh")).toBeVisible()
  await drawer.getByRole("link", { name: "Checkout" }).click()

  // Checkout
  await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible()
  await page.getByLabel("Full name").fill("E2E Buyer")
  await page.getByLabel("Phone").fill("03001234567")
  await page.getByLabel("Email").fill(`e2e+${Date.now()}@example.com`)
  await page.getByLabel("City").fill("Lahore")
  await page.getByLabel("Full address").fill("House 1, Street 2, Model Town")
  await page.getByLabel(/Cash on Delivery/).check()

  const summary = page.getByRole("complementary", { name: "Order summary" })
  await expect(summary.getByText("Total", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Place order" }).click()

  // Confirmation
  // Generous timeout: `next dev` compiles the confirmation route on first visit.
  await expect(page).toHaveURL(/\/order-success\/[0-9a-f-]{36}\?token=/, { timeout: 30_000 })
  await expect(page.getByRole("heading", { name: /Thank you, E2E/ })).toBeVisible()
  await expect(page.getByText(/Your order #\d+ has been received/)).toBeVisible()
  await expect(page.locator("#main").getByText("Cash on Delivery", { exact: true })).toBeVisible()

  // Cart was emptied
  await page.goto("/checkout")
  await expect(page.getByText("Your cart is empty")).toBeVisible()
})

test("URL filters are shareable and applied server-side", async ({ page }) => {
  await page.goto("/products?on_sale=1&sort=price_asc")
  await expect(page.getByRole("heading", { name: "On Sale" })).toBeVisible()
  await expect(page.getByRole("list", { name: "Active filters" })).toContainText("On sale")
  const prices = await page.getByRole("article").count()
  expect(prices).toBeGreaterThan(0)
})

test("out-of-stock products cannot be added", async ({ page }) => {
  await page.goto("/products/pulse-band-2")
  // Scope to the product's own purchase area (related-product cards below have their own buttons).
  const purchase = page.locator("h1").locator("xpath=..")
  await expect(purchase.getByRole("button", { name: "Out of stock" })).toBeDisabled()
  await expect(purchase.getByRole("button", { name: /Add to cart/ })).toHaveCount(0)
})

test("unknown pages render the branded 404", async ({ page }) => {
  const res = await page.goto("/this-page-does-not-exist")
  expect(res?.status()).toBe(404)
  await expect(page.getByRole("heading", { name: /couldn.t find that page/ })).toBeVisible()
})
