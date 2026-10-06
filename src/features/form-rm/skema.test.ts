import { describe, expect, it } from "vitest";
import {
  bersihkanDataLama,
  consentFormSchema,
  edukasiFormSchema,
  idDariRefTtd,
  pangkasTeksPanjang,
  ringkasanFormSchema,
  srcTtd,
  ttdSchema,
} from "./skema";
import { emptyEdukasiForm } from "./edukasi.constants";
import { emptyRingkasanForm } from "./ringkasan.constants";

describe("ttdSchema", () => {
  it.each([
    ["", true],
    ["data:image/png;base64,iVBORw0KGgo=", true],
    ["ttd:abcdefghijklmnopqrstuvwx", true],
    ["data:image/jpeg;base64,/9j/4AAQ", false],
    ["data:image/svg+xml;base64,PHN2Zz4=", false],
    ["data:image/png;base64,<script>", false],
    ["javascript:alert(1)", false],
    ["ttd:../../etc/passwd", false],
    ["ttd:ABCDEFGHIJKLMNOPQRSTUVWX", false],
    ["https://evil.example/x.png", false],
  ])("%j → %s", (nilai, sah) => {
    expect(ttdSchema.safeParse(nilai).success).toBe(sah);
  });

  it("menolak data-URL di atas batas", () => {
    expect(ttdSchema.safeParse(`data:image/png;base64,${"A".repeat(600_000)}`).success).toBe(false);
  });

  it("idDariRefTtd hanya untuk referensi sah", () => {
    expect(idDariRefTtd("ttd:abcdefghijklmnopqrstuvwx")).toBe("abcdefghijklmnopqrstuvwx");
    expect(idDariRefTtd("ttd:x")).toBeNull();
    expect(idDariRefTtd("data:image/png;base64,AA==")).toBeNull();
  });

  it("srcTtd: referensi → API TTD; data-URL & kosong apa adanya; bukan-referensi tak pernah jadi URL API", () => {
    expect(srcTtd("ttd:abcdefghijklmnopqrstuvwx")).toBe("/api/form-rm/ttd/abcdefghijklmnopqrstuvwx");
    expect(srcTtd("data:image/png;base64,AA==")).toBe("data:image/png;base64,AA==");
    expect(srcTtd("")).toBe("");
    expect(srcTtd("ttd:../../api/auth/logout")).toBe("ttd:../../api/auth/logout");
  });
});

describe("bersihkanDataLama", () => {
  it("membuang kunci yang sudah tidak dikenal di semua tingkat", () => {
    const lama = emptyEdukasiForm() as unknown as Record<string, unknown>;
    lama.kolomUsang = 1;
    (lama.entries as Record<string, unknown>[])[1].edukatorTtd = "data:image/png;base64,AAAA";
    const bersih = bersihkanDataLama(edukasiFormSchema, lama);
    expect(bersih).not.toBeNull();
    expect(bersih).not.toHaveProperty("kolomUsang");
    expect(bersih!.entries[1]).not.toHaveProperty("edukatorTtd");
    expect((lama.entries as Record<string, unknown>[])[1]).toHaveProperty("edukatorTtd"); // input tak dimutasi
  });

  it("pelanggaran selain kunci asing tetap gagal", () => {
    expect(bersihkanDataLama(consentFormSchema, { pjJenisKelamin: "X", kolomUsang: 1 })).toBeNull();
  });
});

describe("pangkasTeksPanjang", () => {
  it("memangkas teks melebihi batas kolom dengan elipsis tepat di batas", () => {
    const data = { ...emptyRingkasanForm(), diagnosaSekunder: "J".repeat(1000) };
    const hasil = pangkasTeksPanjang(ringkasanFormSchema, data);
    expect(hasil?.diagnosaSekunder).toHaveLength(400);
    expect(hasil?.diagnosaSekunder.endsWith("…")).toBe(true);
    expect(data.diagnosaSekunder).toHaveLength(1000);
  });

  it("pelanggaran selain panjang teks tetap gagal", () => {
    expect(pangkasTeksPanjang(ringkasanFormSchema, { ...emptyRingkasanForm(), bangsa: "Mars" })).toBeNull();
  });
});
