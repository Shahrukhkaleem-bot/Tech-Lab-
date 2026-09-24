import { describe, expect, it } from "vitest"

import type { CategoryRow } from "@/types/database"

import { ancestry, buildCategoryTree, categoryPath, descendantIds, resolveCategoryPath } from "./category-tree"

const row = (id: string, slug: string, parent: string | null, order = 0): CategoryRow => ({
  id,
  tenant_id: "t",
  parent_id: parent,
  name: slug.toUpperCase(),
  slug,
  description: null,
  icon_url: null,
  image_url: null,
  display_order: order,
  is_active: true,
  seo_title: null,
  seo_description: null,
  created_at: "",
  updated_at: "",
})

const tree = buildCategoryTree([
  row("1", "audio", null, 2),
  row("2", "earbuds", "1"),
  row("3", "anc", "2"),
  row("4", "phones", null, 1),
  row("5", "orphan", "missing"),
])

describe("category tree", () => {
  it("nests and sorts", () => {
    expect(tree.roots.map((c) => c.slug)).toEqual(["orphan", "phones", "audio"])
    expect(tree.bySlug.audio!.children.map((c) => c.slug)).toEqual(["earbuds"])
  })

  it("collects descendants and ancestry", () => {
    expect(descendantIds(tree, "1").sort()).toEqual(["1", "2", "3"])
    expect(ancestry(tree, "3").map((c) => c.slug)).toEqual(["audio", "earbuds", "anc"])
    expect(categoryPath(tree, "3")).toBe("/categories/audio/earbuds/anc")
  })

  it("resolves only valid parent chains", () => {
    expect(resolveCategoryPath(tree, ["audio", "earbuds", "anc"])?.id).toBe("3")
    expect(resolveCategoryPath(tree, ["earbuds"])).toBeNull() // not a root
    expect(resolveCategoryPath(tree, ["phones", "earbuds"])).toBeNull() // wrong parent
    expect(resolveCategoryPath(tree, ["nope"])).toBeNull()
  })
})
