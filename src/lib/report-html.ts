/**
 * Sanitasi ringan untuk field HTML yang datang dari SIMGOS (mis. FISIK yang
 * berisi <br/>, <div>, &nbsp;). Whitelist tag + buang SEMUA atribut, script, style.
 *
 * ⚠️ Untuk produksi dengan input DB nyata, ganti dengan DOMPurify /
 * `sanitize-html`. Versi ini cukup untuk simulasi mock yang datanya kita kontrol.
 */
const ALLOWED_TAGS = new Set([
  "br", "div", "p", "span", "b", "strong", "i", "em", "u", "sub", "sup",
  "ul", "ol", "li", "table", "thead", "tbody", "tr", "td", "th", "h4",
]);

export function sanitizeReportHtml(input: string | null | undefined): string {
  if (!input) return "";
  return input
    // buang blok script/style beserta isinya
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    // buang komentar HTML
    .replace(/<!--[\s\S]*?-->/g, "")
    // proses tiap tag: simpan bila di-whitelist (tanpa atribut), selain itu buang markup-nya
    .replace(/<\s*(\/?)\s*([a-zA-Z0-9]+)[^>]*>/g, (_m, slash: string, tag: string) => {
      const t = tag.toLowerCase();
      if (!ALLOWED_TAGS.has(t)) return "";
      return `<${slash ? "/" : ""}${t}>`;
    })
    .trim();
}

/** True bila string HTML/teks punya konten kasat mata (bukan hanya tag/spasi). */
export function hasVisibleContent(html: string | null | undefined): boolean {
  if (!html) return false;
  const text = html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, "")
    .trim();
  return text.length > 0;
}
