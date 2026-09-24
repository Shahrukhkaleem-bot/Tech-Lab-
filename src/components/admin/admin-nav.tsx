"use client"

import { Boxes, Image as ImageIcon, LayoutDashboard, Menu, MessageSquare, Package, Receipt, Settings, Tags, Store } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { can, type Capability } from "@/features/auth/roles"
import { cn } from "@/lib/utils"
import type { MemberRole } from "@/types/database"

const NAV: { href: string; label: string; icon: typeof Package; capability: Capability }[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, capability: "viewDashboard" },
  { href: "/admin/orders", label: "Orders", icon: Receipt, capability: "viewOrders" },
  { href: "/admin/products", label: "Products", icon: Package, capability: "manageCatalog" },
  { href: "/admin/categories", label: "Categories", icon: Boxes, capability: "manageCatalog" },
  { href: "/admin/brands", label: "Brands", icon: Tags, capability: "manageCatalog" },
  { href: "/admin/reviews", label: "Reviews", icon: MessageSquare, capability: "moderateReviews" },
  { href: "/admin/banners", label: "Banners", icon: ImageIcon, capability: "manageContent" },
  { href: "/admin/settings", label: "Settings", icon: Settings, capability: "manageSettings" },
]

function NavList({ role, onNavigate }: { role: MemberRole; onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Admin">
      <ul className="space-y-1">
        {NAV.filter((n) => can(role, n.capability)).map((n) => {
          const active = n.href === "/admin" ? pathname.endsWith("/admin") : pathname.includes(n.href)
          return (
            <li key={n.href}>
              <Link
                href={n.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <n.icon className="size-4" aria-hidden />
                {n.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function AdminSidebar({ role, storeName }: { role: MemberRole; storeName: string }) {
  return (
    <aside className="hidden w-60 shrink-0 border-r bg-background p-4 lg:block">
      <p className="mb-6 truncate px-3 text-sm font-bold">{storeName}</p>
      <NavList role={role} />
      <Link href="/" className="mt-6 flex items-center gap-3 px-3 text-sm text-muted-foreground hover:text-foreground">
        <Store className="size-4" aria-hidden /> View store
      </Link>
    </aside>
  )
}

export function AdminMobileNav({ role, storeName }: { role: MemberRole; storeName: string }) {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button type="button" aria-label="Open admin menu" className="inline-flex size-9 items-center justify-center rounded-md hover:bg-accent lg:hidden">
          <Menu className="size-5" aria-hidden />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-4">
        <SheetHeader className="px-0">
          <SheetTitle>{storeName}</SheetTitle>
          <SheetDescription className="sr-only">Admin navigation</SheetDescription>
        </SheetHeader>
        <NavList role={role} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}
