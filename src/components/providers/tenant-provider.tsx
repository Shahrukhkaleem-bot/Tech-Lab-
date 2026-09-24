"use client"

import { createContext, useContext, type ReactNode } from "react"

import type { StoreSettings, Tenant } from "@/features/tenants/types"

/**
 * Makes the current tenant's PUBLIC config available to Client Components
 * (currency, locale, contact info, shipping rules for the cart estimate …).
 * Theme colours are applied as CSS variables by the server layout, not here,
 * so there is no flash of unbranded content.
 */
export type TenantContextValue = {
  tenant: Tenant
  shipping: StoreSettings["shipping"]
  paymentMethods: StoreSettings["payment"]["enabledMethods"]
}

const TenantContext = createContext<TenantContextValue | null>(null)

export function TenantProvider({ value, children }: { value: TenantContextValue; children: ReactNode }) {
  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext)
  if (!ctx) throw new Error("useTenant must be used inside <TenantProvider>")
  return ctx
}
