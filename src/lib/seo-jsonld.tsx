/**
 * Safe JSON-LD serialization helpers.
 *
 * Protects against script-injection by escaping `</script>` sequences
 * and ensuring values are valid JSON types.
 */

/** Escape characters that could break a <script> tag. */
function esc(s: string): string {
  return s.replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

/** Serialize a structured data object to a safe JSON-LD string. */
export function jsonLd(data: Record<string, unknown>): string {
  return esc(JSON.stringify(data));
}

/**
 * Render a <script type="application/ld+json"> element.
 * Safe for SSR — output is escaped.
 */
export function JsonLdScript({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLd(data) }}
    />
  );
}
