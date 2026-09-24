import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import { createCartStore, MAX_LINE_QUANTITY, selectItemCount, selectSubtotal } from "./cart-store"

const product = (id: string, price: number, max: number | null = 10) => ({
  productId: id,
  slug: `p-${id.slice(0, 4)}`,
  name: `Product ${id.slice(0, 4)}`,
  imageUrl: null,
  unitPrice: price,
  originalPrice: price,
  maxQuantity: max,
})

const A = "11111111-1111-4111-8111-111111111111"
const B = "22222222-2222-4222-8222-222222222222"

// Minimal in-memory Web Storage (Node has no localStorage).
beforeAll(() => {
  const data = new Map<string, string>()
  globalThis.localStorage = {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
    key: (i) => [...data.keys()][i] ?? null,
    get length() {
      return data.size
    },
  } satisfies Storage
})

describe("cart store", () => {
  let store: ReturnType<typeof createCartStore>
  beforeEach(() => {
    store = createCartStore("tenant-test")
  })

  it("adds, merges and totals items", () => {
    store.getState().add(product(A, 100), 2)
    store.getState().add(product(A, 100), 1)
    store.getState().add(product(B, 49.99))
    expect(store.getState().items).toHaveLength(2)
    expect(selectItemCount(store.getState())).toBe(4)
    expect(selectSubtotal(store.getState())).toBe(349.99)
  })

  it("never exceeds available stock or the per-line cap", () => {
    const r = store.getState().add(product(A, 10, 3), 5)
    expect(r).toEqual({ added: 3, limited: true })
    expect(store.getState().add(product(A, 10, 3), 1)).toEqual({ added: 0, limited: true })
    store.getState().add(product(B, 10, null), 500)
    expect(store.getState().items.find((i) => i.productId === B)!.quantity).toBe(MAX_LINE_QUANTITY)
  })

  it("increments, decrements and removes at zero", () => {
    store.getState().add(product(A, 10))
    store.getState().increment(A)
    expect(store.getState().items[0]!.quantity).toBe(2)
    store.getState().decrement(A)
    store.getState().decrement(A)
    expect(store.getState().items).toHaveLength(0)
  })

  it("applies authoritative server data (price, stock, availability)", () => {
    store.getState().add(product(A, 10), 5)
    store.getState().add(product(B, 10), 1)
    store.getState().applyServerRefresh([
      { productId: A, unitPrice: 12, originalPrice: 15, maxQuantity: 2, available: true },
      { productId: B, unitPrice: 10, originalPrice: 10, maxQuantity: 0, available: false },
    ])
    expect(store.getState().items).toEqual([expect.objectContaining({ productId: A, unitPrice: 12, quantity: 2 })])
  })

  it("drops tampered persisted data on rehydrate and keeps valid data", async () => {
    localStorage.setItem("cart:tenant-test", JSON.stringify({ state: { items: [{ productId: "x", quantity: -1, unitPrice: -5 }] }, version: 1 }))
    await store.persist.rehydrate()
    expect(store.getState().items).toEqual([])

    localStorage.setItem("cart:tenant-test", JSON.stringify({ state: { items: [{ ...product(A, 5), quantity: 2 }] }, version: 1 }))
    await store.persist.rehydrate()
    expect(store.getState().items).toHaveLength(1)
  })

  it("keeps carts separate per tenant", () => {
    store.getState().add(product(A, 10))
    expect(localStorage.getItem("cart:tenant-test")).toContain(A)
    expect(localStorage.getItem("cart:other-tenant")).toBeNull()
  })
})
