/**
 * Deteksi koneksi ganda kredensial perangkat (docs/PRD_TTD_Perangkat_Siaga.md
 * §7.6). Satu perangkat = satu aliran; aliran baru menggantikan yang lama.
 *
 * Wi-Fi yang putus-sambung juga memicu penggantian (koneksi lama mati diam-diam),
 * jadi penggantian saja BUKAN bukti penyalinan. Curiga hanya bila dalam satu
 * jendela terjadi ≥ `ambang` penggantian DAN melibatkan ≥ 2 alamat IP berbeda —
 * pola dua salinan kredensial yang saling merebut. MURNI (jam disuntikkan).
 */

export type CatatanGanda = {
  /** Aliran lama & baru dari IP berbeda (dicatat sebagai peringatan). */
  ipBerbeda: boolean;
  /** Pola penyalinan kredensial → perangkat dicabut. */
  curiga: boolean;
};

export function buatPencatatGanda(opsi: { jendelaMs?: number; ambang?: number; maksPerangkat?: number } = {}) {
  const { jendelaMs = 5 * 60_000, ambang = 5, maksPerangkat = 1000 } = opsi;
  const riwayat = new Map<string, { waktu: number; ip: string }[]>();

  return {
    catat(perangkatId: string, ipLama: string | null, ipBaru: string | null, sekarang: number): CatatanGanda {
      const lama = (riwayat.get(perangkatId) ?? []).filter((e) => sekarang - e.waktu < jendelaMs);
      lama.push({ waktu: sekarang, ip: `${ipLama ?? "?"}>${ipBaru ?? "?"}` });
      if (!riwayat.has(perangkatId) && riwayat.size >= maksPerangkat) {
        const tertua = riwayat.keys().next().value;
        if (tertua !== undefined) riwayat.delete(tertua);
      }
      riwayat.set(perangkatId, lama);
      const ip = new Set<string>();
      for (const e of lama) for (const x of e.ip.split(">")) if (x !== "?") ip.add(x);
      return {
        ipBerbeda: !!ipLama && !!ipBaru && ipLama !== ipBaru,
        curiga: lama.length >= ambang && ip.size >= 2,
      };
    },
    lupakan(perangkatId: string) {
      riwayat.delete(perangkatId);
    },
  };
}
