import { describe, expect, it } from "vitest";
import { DAFTAR_KATEGORI } from "./kategori";
import { DEFINISI_FORM, definisiDariJenisLama, definisiForm, JENIS_KUNJUNGAN, KATEGORI_FORM, KODE_FORM } from "./registry";

describe("registri form RM", () => {
  it("kode & jenis lama unik, sesuai KODE_FORM, kategori dikenal", () => {
    const kode = DEFINISI_FORM.map((d) => d.kode);
    expect(new Set(kode).size).toBe(kode.length);
    expect([...kode].sort()).toEqual([...KODE_FORM].sort());
    expect(new Set(DEFINISI_FORM.map((d) => d.jenisLama)).size).toBe(DEFINISI_FORM.length);
    for (const d of DEFINISI_FORM) expect(Object.keys(KATEGORI_FORM)).toContain(d.kategori);
  });

  it("setiap kategori punya minimal satu form (kategori kosong tak membuat modul RBAC mubazir)", () => {
    for (const k of DAFTAR_KATEGORI) expect(DEFINISI_FORM.some((d) => d.kategori === k), k).toBe(true);
  });

  it.each(DEFINISI_FORM.map((d) => [d.kode, d] as const))("%s: sasaran & wajibUntuk sah", (_k, d) => {
    expect(d.sasaran.jenis.length).toBeGreaterThan(0);
    for (const j of [...d.sasaran.jenis, ...d.wajibUntuk]) expect(JENIS_KUNJUNGAN).toContain(j);
    // Form wajib harus bisa ditemukan di pemilih pasiennya.
    for (const j of d.wajibUntuk) expect(d.sasaran.jenis).toContain(j);
    expect(d.sasaran.jendelaJam).toBeGreaterThanOrEqual(1);
    expect(d.sasaran.jendelaJam).toBeLessThanOrEqual(24 * 90);
  });

  it("pencarian per kode & jenis lama", () => {
    expect(definisiForm("RM.04")?.jenisLama).toBe("triase");
    expect(definisiDariJenisLama("consent")?.kode).toBe("RM.03");
    expect(definisiForm("RM.99")).toBeUndefined();
    expect(definisiForm("__proto__")).toBeUndefined();
  });

  it.each(DEFINISI_FORM.map((d) => [d.kode, d] as const))("%s: kosong() lolos skema strict", (_k, d) => {
    expect(d.skema.safeParse(d.kosong()).success).toBe(true);
  });

  it.each(DEFINISI_FORM.map((d) => [d.kode, d] as const))("%s: kunci asing ditolak", (_k, d) => {
    expect(d.skema.safeParse({ ...d.kosong(), kolomLiar: "x" }).success).toBe(false);
  });

  it.each(DEFINISI_FORM.map((d) => [d.kode, d] as const))("%s: `__proto__` tak pernah ikut ke hasil (anti prototype pollution)", (_k, d) => {
    const masuk = { ...(d.kosong() as object), ...JSON.parse(`{"__proto__":{"admin":true}}`) };
    const r = d.skema.safeParse(masuk);
    if (r.success) {
      expect(Object.prototype.hasOwnProperty.call(r.data, "__proto__")).toBe(false);
      expect(Object.getPrototypeOf(r.data)).toBe(Object.prototype);
      expect(JSON.stringify(r.data)).not.toContain("admin");
    }
    expect(({} as Record<string, unknown>).admin).toBeUndefined();
  });

  it("kunci asing di objek bersarang juga ditolak (entri edukasi)", () => {
    const d = definisiForm("RM.21")!;
    const data = d.kosong() as { entries: object[] };
    data.entries[0] = { ...data.entries[0], edukatorTtd: "data:image/png;base64,AAAA" };
    expect(d.skema.safeParse(data).success).toBe(false);
  });

  it("petaTtd mengunjungi setiap slot tanda tangan dengan path stabil", () => {
    const slot = (kode: string) => {
      const d = definisiForm(kode)!;
      const hasil: string[] = [];
      d.petaTtd(d.kosong(), (v, s) => (hasil.push(s), v));
      return hasil;
    };
    expect(slot("RM.04")).toEqual(["petugasTtd"]);
    expect(slot("RM.03")).toEqual(["pasienTtd", "petugasTtd"]);
    expect(slot("RM.01")).toEqual(["dokterMerawatTtd", "dokterKematianTtd"]);
    expect(slot("RM.21")).toEqual([0, 1, 2, 3, 4].map((i) => `entries.${i}.sasaranTtd`));
  });

  it("petaTtd mengganti nilai tanpa mengubah kolom lain", () => {
    const d = definisiForm("RM.03")!;
    const awal = { ...(d.kosong() as object), pjNama: "Budi" };
    const hasil = d.petaTtd(awal, () => "ttd:abcdefghijklmnopqrstuvwx") as Record<string, string>;
    expect(hasil.pasienTtd).toBe("ttd:abcdefghijklmnopqrstuvwx");
    expect(hasil.pjNama).toBe("Budi");
    expect((awal as Record<string, string>).pasienTtd).toBe("");
  });

  it.each(DEFINISI_FORM.map((d) => [d.kode, d] as const))("%s: isian kosong belum boleh FINAL", (_k, d) => {
    expect(d.syaratFinal(d.kosong()).length).toBeGreaterThan(0);
  });

  it("syarat FINAL terpenuhi bila kolom wajib diisi", () => {
    const ttd = "ttd:abcdefghijklmnopqrstuvwx";
    const triase = definisiForm("RM.04")!;
    expect(
      triase.syaratFinal({ ...(triase.kosong() as object), kriteria: ["3d2"], waktuTriase: "2026-10-06T08:00", petugasNama: "Ns. A", petugasTtd: ttd }),
    ).toEqual([]);

    const consent = definisiForm("RM.03")!;
    expect(
      consent.syaratFinal({ ...(consent.kosong() as object), pasienNama: "P", pasienTtd: ttd, petugasNama: "Q", petugasTtd: ttd, tanggalTtd: "2026-10-06" }),
    ).toEqual([]);

    const ringkasan = definisiForm("RM.01")!;
    const rk = { ...(ringkasan.kosong() as object), dokterMerawatNama: "dr. A", dokterMerawatTtd: ttd };
    expect(ringkasan.syaratFinal(rk)).toEqual([]);
    expect(ringkasan.syaratFinal({ ...rk, sebabKematianAktif: true })).toHaveLength(3);

    const edukasi = definisiForm("RM.21")!;
    const ed = edukasi.kosong() as { entries: Record<string, unknown>[] };
    ed.entries[0] = { ...ed.entries[0], aktif: true, edukatorNama: "Ns. B", tanggalJam: "2026-10-06T09:00" };
    expect(edukasi.syaratFinal(ed)).toEqual(["Keperawatan: tanda tangan sasaran edukasi"]);
    ed.entries[0].sasaranTtd = ttd;
    expect(edukasi.syaratFinal(ed)).toEqual([]);
  });
});
