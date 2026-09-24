import { notFound } from "next/navigation"

/** Unknown storefront paths render the branded store 404 (inside header/footer). */
export default function CatchAll() {
  notFound()
}
