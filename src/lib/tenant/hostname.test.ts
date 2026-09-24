import { describe, expect, it } from "vitest"

import { isCustomDomainKey, resolveHost } from "./hostname"

const prod = { rootDomain: "example.com" }
const dev = { rootDomain: "localhost:3000", devTenant: "demo-electronics" }

describe("resolveHost", () => {
  it("resolves tenant subdomains of the root domain", () => {
    expect(resolveHost("store-a.example.com", prod)).toEqual({ kind: "tenant", key: "store-a" })
    expect(resolveHost("Store-A.Example.com:443", prod)).toEqual({ kind: "tenant", key: "store-a" })
  })

  it("treats the apex and www as the platform", () => {
    expect(resolveHost("example.com", prod)).toEqual({ kind: "platform" })
    expect(resolveHost("www.example.com", prod)).toEqual({ kind: "platform" })
  })

  it("resolves custom domains (with or without www) to the bare domain", () => {
    expect(resolveHost("shop-a.com", prod)).toEqual({ kind: "tenant", key: "shop-a.com" })
    expect(resolveHost("www.shop-a.com", prod)).toEqual({ kind: "tenant", key: "shop-a.com" })
    expect(isCustomDomainKey("shop-a.com")).toBe(true)
    expect(isCustomDomainKey("store-a")).toBe(false)
  })

  it("rejects nested subdomains, reserved labels and garbage hosts", () => {
    expect(resolveHost("a.b.example.com", prod)).toEqual({ kind: "invalid" })
    expect(resolveHost("admin.example.com", prod)).toEqual({ kind: "invalid" })
    expect(resolveHost("api.example.com", prod)).toEqual({ kind: "invalid" })
    expect(resolveHost("-bad-.example.com", prod)).toEqual({ kind: "invalid" })
    expect(resolveHost("", prod)).toEqual({ kind: "invalid" })
    expect(resolveHost(null, prod)).toEqual({ kind: "invalid" })
    expect(resolveHost("evil_host", prod)).toEqual({ kind: "invalid" })
    expect(resolveHost("x".repeat(300) + ".com", prod)).toEqual({ kind: "invalid" })
  })

  it("supports *.localhost and falls back to DEV_TENANT on bare localhost / previews", () => {
    expect(resolveHost("store-b.localhost:3000", dev)).toEqual({ kind: "tenant", key: "store-b" })
    expect(resolveHost("localhost:3000", dev)).toEqual({ kind: "tenant", key: "demo-electronics" })
    expect(resolveHost("my-app-git-feature.vercel.app", dev)).toEqual({ kind: "tenant", key: "demo-electronics" })
    expect(resolveHost("localhost:3000", { rootDomain: "localhost:3000" })).toEqual({ kind: "platform" })
  })

  it("ignores an invalid DEV_TENANT value", () => {
    expect(resolveHost("localhost", { rootDomain: "localhost", devTenant: "../etc" })).toEqual({ kind: "platform" })
  })
})
