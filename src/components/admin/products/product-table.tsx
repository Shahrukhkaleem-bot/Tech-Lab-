"use client"

import { Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { SmartImage } from "@/components/common/smart-image"
import { StatusBadge } from "@/components/common/status-badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { bulkProductAction } from "@/features/admin/products/actions"
import type { AdminProductRow } from "@/features/admin/products/queries"
import { formatMoney } from "@/lib/utils/format"

type BulkAction = "activate" | "deactivate" | "feature" | "unfeature" | "delete"

export function ProductTable({ rows, currency, locale }: { rows: AdminProductRow[]; currency: string; locale: string }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, startTransition] = useTransition()

  const allSelected = rows.length > 0 && selected.size === rows.length
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const run = (action: BulkAction) =>
    startTransition(async () => {
      const res = await bulkProductAction({ ids: [...selected], action })
      if (!res.ok) return void toast.error(res.error.message)
      toast.success(`${res.data.affected} product(s) updated`)
      setSelected(new Set())
      router.refresh()
    })

  return (
    <>
      {selected.size ? (
        <div className="flex flex-wrap items-center gap-2 border-b bg-accent/50 p-3 text-sm" role="toolbar" aria-label="Bulk actions">
          <span className="mr-2 font-medium">{selected.size} selected</span>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run("activate")}>
            Activate
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run("deactivate")}>
            Deactivate
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run("feature")}>
            Feature
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run("unfeature")}>
            Unfeature
          </Button>
          <Button size="sm" variant="destructive" disabled={pending} onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground uppercase">
            <tr>
              <th className="w-10 p-3">
                <Checkbox
                  aria-label="Select all"
                  checked={allSelected}
                  onCheckedChange={(c) => setSelected(c ? new Set(rows.map((r) => r.id)) : new Set())}
                />
              </th>
              <th className="p-3">Product</th>
              <th className="p-3">Price</th>
              <th className="p-3">Stock</th>
              <th className="p-3">Status</th>
              <th className="hidden p-3 md:table-cell">Category</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-accent/30">
                <td className="p-3">
                  <Checkbox aria-label={`Select ${p.name}`} checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} />
                </td>
                <td className="p-3">
                  <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3">
                    <span className="relative size-10 shrink-0 overflow-hidden rounded-md border bg-muted">
                      <SmartImage src={p.imageUrl} alt="" fill sizes="40px" className="object-contain p-0.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium hover:text-primary">{p.name}</span>
                      <span className="block text-xs text-muted-foreground">{p.sku ?? "—"}</span>
                    </span>
                  </Link>
                </td>
                <td className="p-3 tabular-nums">
                  {formatMoney(p.price, currency, locale)}
                  {p.salePrice != null ? <span className="block text-xs text-muted-foreground line-through">{formatMoney(p.originalPrice, currency, locale)}</span> : null}
                </td>
                <td className="p-3 tabular-nums">
                  {!p.trackInventory ? (
                    <span className="text-muted-foreground">Not tracked</span>
                  ) : p.stock === 0 ? (
                    <StatusBadge tone="danger">Out</StatusBadge>
                  ) : p.stock <= p.lowStockThreshold ? (
                    <StatusBadge tone="warning">{p.stock}</StatusBadge>
                  ) : (
                    p.stock
                  )}
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    <StatusBadge tone={p.isActive ? "success" : "neutral"}>{p.isActive ? "Active" : "Draft"}</StatusBadge>
                    {p.isFeatured ? <StatusBadge tone="info">Featured</StatusBadge> : null}
                  </div>
                </td>
                <td className="hidden p-3 text-muted-foreground md:table-cell">{p.categoryName ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} product(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the products and their images. Past orders keep their item snapshots. Consider deactivating instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => run("delete")} className="bg-destructive text-white hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
