import { ChevronDown } from "lucide-react"
import Link from "next/link"

import type { Category } from "@/features/catalog/types"
import type { NavLink } from "@/features/tenants/types"

/**
 * Desktop category bar with mega menus. Pure CSS (group-hover + focus-within), so it
 * works before hydration and is keyboard accessible: tabbing into a top-level item
 * reveals its panel.
 */
export function CategoryMegaMenu({ categories, links }: { categories: Category[]; links: NavLink[] }) {
  if (!categories.length && !links.length) return null

  return (
    <nav aria-label="Categories" className="hidden border-t lg:block">
      <ul className="container-page flex h-12 items-center gap-1">
        {categories.slice(0, 9).map((cat) => (
          <li key={cat.id} className="group relative">
            <Link
              href={`/categories/${cat.slug}`}
              className="flex h-12 items-center gap-1 rounded-md px-3 text-sm font-medium transition-colors hover:text-primary group-focus-within:text-primary"
              aria-haspopup={cat.children.length ? "true" : undefined}
            >
              {cat.name}
              {cat.children.length ? (
                <ChevronDown className="size-3.5 transition-transform group-hover:rotate-180" aria-hidden />
              ) : null}
            </Link>

            {cat.children.length ? (
              <div className="invisible absolute top-full left-0 z-40 min-w-[18rem] translate-y-1 opacity-0 transition-all duration-150 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                <div className="mt-px grid gap-x-8 gap-y-5 rounded-b-xl border bg-popover p-5 shadow-xl sm:grid-cols-2">
                  {cat.children.map((child) => (
                    <div key={child.id}>
                      <Link href={`/categories/${cat.slug}/${child.slug}`} className="text-sm font-semibold hover:text-primary">
                        {child.name}
                      </Link>
                      {child.children.length ? (
                        <ul className="mt-2 space-y-1.5">
                          {child.children.map((g) => (
                            <li key={g.id}>
                              <Link
                                href={`/categories/${cat.slug}/${child.slug}/${g.slug}`}
                                className="text-sm text-muted-foreground hover:text-primary"
                              >
                                {g.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                  <Link
                    href={`/categories/${cat.slug}`}
                    className="text-sm font-medium text-primary hover:underline sm:col-span-2"
                  >
                    Shop all {cat.name} →
                  </Link>
                </div>
              </div>
            ) : null}
          </li>
        ))}
        {links.map((link) => (
          <li key={link.id}>
            <Link href={link.href} className="flex h-12 items-center rounded-md px-3 text-sm font-medium hover:text-primary">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
