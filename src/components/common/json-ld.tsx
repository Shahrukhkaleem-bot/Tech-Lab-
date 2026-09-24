// Characters that must never appear raw inside an inline <script>:
// < > & (HTML parsing) and U+2028 / U+2029 (JS line terminators).
const UNSAFE_CODES = [0x3c, 0x3e, 0x26, 0x2028, 0x2029]
const UNSAFE_PATTERN = new RegExp(`[${UNSAFE_CODES.map((c) => String.fromCharCode(c)).join("")}]`, "g")

function toUnicodeEscape(ch: string): string {
  return "\\" + "u" + ch.charCodeAt(0).toString(16).padStart(4, "0")
}

/**
 * Serialises JSON-LD so tenant-controlled strings can never close the <script>
 * tag (stored-XSS protection). The escapes are valid JSON, so parsers read the
 * original characters.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(UNSAFE_PATTERN, toUnicodeEscape)
}

export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />
}
