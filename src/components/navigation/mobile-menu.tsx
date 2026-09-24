"use client"

import { Menu, Phone, User } from "lucide-react"
import Link from "next/link"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import type { Category } from "@/features/catalog/types"
import type { NavLink } from "@/features/tenants/types"
import { useUiStore } from "@/stores/ui-store"

type MobileMenuProps = {
  storeName: string
  categories: Category[]
  links: NavLink[]
  phone: string | null
}

/** Off-canvas navigation with accordion sub-categories (mobile/tablet). */
export function MobileMenu({ storeName, categories, links, phone }: MobileMenuProps) {
  const open = useUiStore((s) => s.mobileNavOpen)
  const setOpen = useUiStore((s) => s.setMobileNavOpen)
  const close = () => setOpen(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button type="button" aria-label="Open menu" className="-ml-2 inline-flex size-10 items-center justify-center rounded-md hover:bg-accent lg:hidden">
          <Menu className="size-5" aria-hidden />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[88vw] max-w-sm gap-0 overflow-y-auto p-0">
        <SheetHeader className="border-b">
          <SheetTitle>{storeName}</SheetTitle>
          <SheetDescription className="sr-only">Store navigation</SheetDescription>
        </SheetHeader>

        <nav aria-label="Mobile" className="px-4 py-2">
          <Accordion type="multiple">
            {categories.map((cat) =>
              cat.children.length ? (
                <AccordionItem key={cat.id} value={cat.id}>
                  <AccordionTrigger className="py-3 text-base">{cat.name}</AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-1 pl-3">
                      <li>
                        <Link href={`/categories/${cat.slug}`} onClick={close} className="block py-1.5 text-sm font-medium text-primary">
                          Shop all {cat.name}
                        </Link>
                      </li>
                      {cat.children.map((child) => (
                        <li key={child.id}>
                          <Link href={`/categories/${cat.slug}/${child.slug}`} onClick={close} className="block py-1.5 text-sm">
                            {child.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ) : (
                <div key={cat.id} className="border-b">
                  <Link href={`/categories/${cat.slug}`} onClick={close} className="block py-3 text-base font-medium">
                    {cat.name}
                  </Link>
                </div>
              ),
            )}
          </Accordion>

          <ul className="mt-2 space-y-1">
            <li>
              <Link href="/products" onClick={close} className="block py-2 font-medium">
                All products
              </Link>
            </li>
            {links.map((l) => (
              <li key={l.id}>
                <Link href={l.href} onClick={close} className="block py-2 font-medium">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-auto space-y-2 border-t p-4 text-sm">
          <Link href="/account" onClick={close} className="flex items-center gap-2 font-medium">
            <User className="size-4" aria-hidden /> My account
          </Link>
          {phone ? (
            <a href={`tel:${phone.replace(/\s+/g, "")}`} className="flex items-center gap-2 text-muted-foreground">
              <Phone className="size-4" aria-hidden /> {phone}
            </a>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
