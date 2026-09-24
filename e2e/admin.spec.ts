import { expect, test } from "@playwright/test"

/**
 * Admin workflows. Requires a store owner account:
 *   1. Sign up at http://demo-electronics.localhost:3000/register
 *   2. psql: select public.seed_grant_demo_owner('<email>');
 *   3. E2E_ADMIN_EMAIL=… E2E_ADMIN_PASSWORD=… npm run test:e2e
 */
const email = process.env.E2E_ADMIN_EMAIL
const password = process.env.E2E_ADMIN_PASSWORD

test("anonymous visitors are redirected away from /admin", async ({ page }) => {
  await page.goto("/admin")
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin/)
})

test("admin server actions reject unauthenticated calls", async ({ request }) => {
  // Posting to the admin route without a session must never succeed.
  const port = Number(process.env.E2E_PORT ?? 3000)
  const res = await request.post(`http://localhost:${port}/admin/products`, {
    headers: { Host: `demo-electronics.localhost:${port}` },
    data: {},
    maxRedirects: 0,
  })
  expect(res.status()).not.toBe(200)
})

test.describe("signed-in owner", () => {
  test.skip(!email || !password, "Set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD")

  test.beforeEach(async ({ page }) => {
    await page.goto("/login?next=/admin")
    await page.getByLabel("Email").fill(email!)
    await page.getByLabel("Password").fill(password!)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible()
  })

  test("creates a product and sees it in the store", async ({ page }) => {
    const name = `E2E Product ${Date.now()}`
    await page.goto("/admin/products/new")
    await page.getByLabel("Name").fill(name)
    await page.getByLabel("Regular price").fill("1999")
    await page.getByLabel("In stock").fill("5")
    await page.getByRole("button", { name: "Create product" }).click()
    await expect(page.getByRole("heading", { name })).toBeVisible()

    await page.goto(`/products?q=${encodeURIComponent(name)}`)
    await expect(page.getByRole("article").filter({ hasText: name })).toBeVisible()
  })

  test("moves an order through fulfilment and adds tracking", async ({ page }) => {
    await page.goto("/admin/orders?status=pending")
    const first = page.getByRole("link", { name: /^#\d+$/ }).first()
    test.skip((await first.count()) === 0, "No pending orders (run the storefront spec first)")
    await first.click()

    await page.getByRole("combobox", { name: "New status" }).selectOption("confirmed")
    await page.getByRole("button", { name: "Update status" }).click()
    await expect(page.getByText("Order updated")).toBeVisible()

    await page.getByLabel("Courier").fill("TCS")
    await page.getByLabel("Tracking number").fill(`TCS${Date.now()}`)
    await page.getByRole("button", { name: /Save tracking/ }).click()
    await expect(page.getByText("Tracking saved")).toBeVisible()
    await expect(page.getByText("Shipped").first()).toBeVisible()
  })

  test("updates branding colours", async ({ page }) => {
    await page.goto("/admin/settings")
    await page.getByRole("tab", { name: "Branding" }).click()
    await page.getByLabel("Primary", { exact: true }).fill("#7c3aed")
    await page.getByRole("button", { name: "Save branding" }).click()
    await expect(page.getByText("Branding updated")).toBeVisible()

    await page.goto("/")
    const primary = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue("--primary").trim())
    expect(primary).toBe("#7c3aed")
  })
})
