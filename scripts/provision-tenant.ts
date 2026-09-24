/**
 * Platform operator script: create a store and its owner account.
 *
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
 *   npm run tenant:provision -- --name "Acme Gadgets" --subdomain acme --owner owner@acme.com [--currency PKR]
 *
 * - Runs locally / in a trusted CI job with the service-role key. Never expose it.
 * - Invites the owner by email if they don't have an account yet.
 * - Tenant + owner membership are created atomically by public.provision_tenant().
 */
import { parseArgs } from "node:util"

import { createClient } from "@supabase/supabase-js"

const { values } = parseArgs({
  options: {
    name: { type: "string" },
    subdomain: { type: "string" },
    owner: { type: "string" },
    currency: { type: "string", default: "PKR" },
    locale: { type: "string", default: "en-PK" },
  },
})

function fail(message: string): never {
  console.error(`✖ ${message}`)
  process.exit(1)
}

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) fail("Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.")
if (!values.name || !values.subdomain || !values.owner) fail("Required: --name, --subdomain, --owner")
if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(values.subdomain)) fail("Subdomain must be lowercase letters, numbers and hyphens.")

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

async function findOrInviteOwner(email: string): Promise<string> {
  // listUsers is paginated; fine for operator use. For large projects, look up via your own admin index.
  for (let page = 1; page < 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) fail(`Could not list users: ${error.message}`)
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (match) return match.id
    if (data.users.length < 200) break
  }
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email)
  if (error || !data.user) fail(`Could not invite ${email}: ${error?.message}`)
  console.log(`✉ Invitation sent to ${email}`)
  return data.user.id
}

const ownerId = await findOrInviteOwner(values.owner)
const { data: tenantId, error } = await supabase.rpc("provision_tenant", {
  p_name: values.name,
  p_subdomain: values.subdomain,
  p_owner_user_id: ownerId,
  p_currency: values.currency,
  p_locale: values.locale,
})
if (error) fail(`Could not create store: ${error.message}`)

console.log(`✔ Store "${values.name}" created (${tenantId}).`)
console.log(`  Storefront: https://${values.subdomain}.<your root domain>`)
console.log(`  Admin:      https://${values.subdomain}.<your root domain>/admin`)
