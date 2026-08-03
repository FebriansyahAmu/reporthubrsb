import "server-only";
import QRCode from "qrcode";

/**
 * QR code sebagai **SVG data-URI** (vektor, mandiri — tanpa panggilan eksternal),
 * cocok untuk dokumen cetak: `<img src={dataUri}>` tampil tajam di berapa pun mm.
 * Meng-encode `text` apa adanya, jadi saat discan HP muncul teks itu (mis. nama
 * petugas). Mengembalikan "" bila teks kosong.
 *
 * `margin` = quiet-zone dalam modul (default 2 sudah cukup karena sel latar putih);
 * error-correction "M" toleran terhadap noda cetak tanpa terlalu memadatkan modul.
 */
export async function qrSvgDataUri(text: string, margin = 2): Promise<string> {
  const t = text.trim();
  if (!t) return "";
  const svg = await QRCode.toString(t, {
    type: "svg",
    margin,
    errorCorrectionLevel: "M",
  });
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

/**
 * Buat banyak QR sekaligus dengan dedup — teks yang sama hanya di-generate satu
 * kali. Mengembalikan `Map<text, dataUri>` (teks kosong tidak dimasukkan).
 */
export async function qrSvgDataUriMap(texts: Iterable<string>): Promise<Map<string, string>> {
  const uniq = new Set<string>();
  for (const t of texts) {
    const s = t.trim();
    if (s) uniq.add(s);
  }
  const entries = await Promise.all(
    [...uniq].map(async (t) => [t, await qrSvgDataUri(t)] as const),
  );
  return new Map(entries);
}
