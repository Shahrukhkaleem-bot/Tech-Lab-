import { cn } from "@/lib/utils"

/**
 * Renders tenant-authored plain text as paragraphs. Never interprets HTML, so stored
 * content cannot inject markup or scripts (stored-XSS safe by construction).
 */
export function PlainText({ text, className }: { text: string | null | undefined; className?: string }) {
  if (!text) return null
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  return (
    <div className={cn("space-y-3 text-sm leading-relaxed text-muted-foreground", className)}>
      {paragraphs.map((p, i) => (
        <p key={i} className="whitespace-pre-line">
          {p}
        </p>
      ))}
    </div>
  )
}
