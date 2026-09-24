import type { CategoryRow } from "@/types/database"

import type { Category, CategoryTree } from "./types"

/** Builds a nested tree + lookup maps from flat rows (pure, unit-tested). */
export function buildCategoryTree(rows: Pick<CategoryRow, keyof CategoryRow>[]): CategoryTree {
  const byId: Record<string, Category> = {}
  const bySlug: Record<string, Category> = {}

  for (const r of rows) {
    const node: Category = {
      id: r.id,
      parentId: r.parent_id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      imageUrl: r.image_url,
      iconUrl: r.icon_url,
      displayOrder: r.display_order,
      seoTitle: r.seo_title,
      seoDescription: r.seo_description,
      children: [],
    }
    byId[node.id] = node
    bySlug[node.slug] = node
  }

  const roots: Category[] = []
  for (const node of Object.values(byId)) {
    const parent = node.parentId ? byId[node.parentId] : undefined
    if (parent) parent.children.push(node)
    else roots.push(node) // orphans (inactive parent) surface as roots
  }

  const sort = (list: Category[]) => {
    list.sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name))
    list.forEach((c) => sort(c.children))
  }
  sort(roots)

  return { roots, byId, bySlug }
}

/** The category and all of its descendants — used to filter "Audio" to include "Earbuds". */
export function descendantIds(tree: CategoryTree, categoryId: string): string[] {
  const out: string[] = []
  const walk = (c: Category | undefined) => {
    if (!c) return
    out.push(c.id)
    c.children.forEach(walk)
  }
  walk(tree.byId[categoryId])
  return out
}

/** Root → … → category, for breadcrumbs and canonical category URLs. */
export function ancestry(tree: CategoryTree, categoryId: string | null | undefined): Category[] {
  const chain: Category[] = []
  let current = categoryId ? tree.byId[categoryId] : undefined
  const seen = new Set<string>()
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    chain.unshift(current)
    current = current.parentId ? tree.byId[current.parentId] : undefined
  }
  return chain
}

export function categoryPath(tree: CategoryTree, categoryId: string): string {
  return `/categories/${ancestry(tree, categoryId)
    .map((c) => c.slug)
    .join("/")}`
}

/** Resolves /categories/a/b/c, verifying each segment is the parent of the next. */
export function resolveCategoryPath(tree: CategoryTree, segments: string[]): Category | null {
  let parentId: string | null = null
  let current: Category | null = null
  for (const slug of segments) {
    const next: Category | undefined = tree.bySlug[slug]
    if (!next || next.parentId !== parentId) return null
    current = next
    parentId = next.id
  }
  return current
}
