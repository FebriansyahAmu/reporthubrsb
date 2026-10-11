import { describe, expect, it } from "vitest";
import { ambilPath, PATH_RE, SUMBER_SIMRS } from "./asal";
import { DAFTAR_KATEGORI } from "./kategori";
import { DEFINISI_FORM, definisiDariJenisLama, definisiForm, JENIS_KUNJUNGAN, KATEGORI_FORM, KODE_FORM, labelSasaran } from "./registry";
import { TAMPILAN_FORM } from "./tampilan";

describe("registri form RM", () => {
  it("kode & jenis lama unik, sesuai KODE_FORM, kategori dikenal", () => {
    const kode = DEFINISI_FORM.map((d) => d.kode);
    expect(new Set(kode).size).toBe(kode.length);
    expect([...kode].sort()).toEqual([...KODE_FORM].sort());
    // jenisLama hanya pada 4 form awal; form baru tanpa data tabel lama.
    const lama = DEFINISI_FORM.flatMap((d) => (d.jenisLama ? [d.jenisLama] : []));
    expect(new Set(lama).size).toBe(lama.length);
    expect(lama).toHaveLength(4);
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
    expect(slot("RM.22")).toEqual(["pemberiTtd", "penerimaTtd", "pernyataTtd", "saksi1Ttd", "saksi2Ttd"]);
    expect(slot("RM.33")).toEqual(["pemberiTtd", "penerimaTtd", "pernyataTtd", "dokterTtd", "saksi1Ttd", "saksi2Ttd"]);
    expect(slot("RM.41")).toEqual(["petugasTtd", "saksiTtd", "pernyataTtd"]);
    expect(slot("RM.50")).toEqual([]);
    const rm50 = definisiForm("RM.50")!;
    const hasil: string[] = [];
    rm50.petaTtd({ ...(rm50.kosong() as object), kantong: [{ paraf: "" }, { paraf: "" }] }, (v, s) => (hasil.push(s), v));
    expect(hasil).toEqual(["kantong.0.paraf", "kantong.1.paraf"]);
  });

  it("form berulang punya pembeda isian (ringkasIsian); form tak berulang tidak memerlukannya", () => {
    for (const d of DEFINISI_FORM) if (d.berulang) expect(d.ringkasIsian, d.kode).toBeTypeOf("function");
    for (const kode of ["RM.22", "RM.33"]) {
      expect(definisiForm(kode)?.berulang, kode).toBe(true);
      expect(definisiForm(kode)?.wajibUntuk, kode).toEqual([]);
      expect(definisiForm(kode)?.cekPerubahan, kode).toBeTypeOf("function");
    }
    // Rujukan keluar SIMGOS dibuat dari rawat jalan, IGD, dan rawat inap.
    expect(definisiForm("RM.33")?.sasaran.jenis).toEqual([1, 2, 3]);
    // Pulang APS: sekali per episode, dari IGD & rawat inap, hanya bila terjadi (tidak wajib); TTD terikat slot & "selaku".
    const rm41 = definisiForm("RM.41")!;
    expect([rm41.berulang, rm41.wajibUntuk, rm41.sasaran.jenis, rm41.kategori]).toEqual([false, [], [2, 3], "ringkasan-pemulangan"]);
    expect(rm41.cekPerubahan).toBeTypeOf("function");
    // Transfusi: satu isian per pemberian transfusi, IGD & rawat inap, kertas F4 lanskap.
    const rm50 = definisiForm("RM.50")!;
    expect([rm50.berulang, rm50.wajibUntuk, rm50.sasaran.jenis, rm50.kategori, rm50.kertas.orientasi]).toEqual([true, [], [2, 3], "asesmen-keperawatan", "lanskap"]);
    // Form berulang menyebut satuan isiannya di profil pasien & pemilih ("Satu isian per rujukan").
    for (const d of DEFINISI_FORM) if (d.berulang) expect(TAMPILAN_FORM[d.kode].berulang?.satuan, d.kode).toBeTruthy();
  });

  it("label sasaran: daftar jenis kunjungan dibaca wajar", () => {
    expect(labelSasaran({ jenis: [2], jendelaJam: 24 })).toBe("Pasien IGD");
    expect(labelSasaran({ jenis: [2, 3], jendelaJam: 24 })).toBe("Pasien IGD & Rawat Inap");
    expect(labelSasaran({ jenis: [1, 2, 3], jendelaJam: 24 })).toBe("Pasien Rawat Jalan, IGD & Rawat Inap");
  });

  it("petaTtd mengganti nilai tanpa mengubah kolom lain", () => {
    const d = definisiForm("RM.03")!;
    const awal = { ...(d.kosong() as object), pjNama: "Budi" };
    const hasil = d.petaTtd(awal, () => "ttd:abcdefghijklmnopqrstuvwx") as Record<string, string>;
    expect(hasil.pasienTtd).toBe("ttd:abcdefghijklmnopqrstuvwx");
    expect(hasil.pjNama).toBe("Budi");
    expect((awal as Record<string, string>).pasienTtd).toBe("");
  });

  it.each(DEFINISI_FORM.map((d) => [d.kode, d] as const))("%s: kolom SIMRS unik, sah, dan ada di isian kosong", (_k, d) => {
    const paths = d.simrs.flatMap((b) => b.kolom.map((k) => k.path));
    expect(paths.length).toBeGreaterThan(0);
    expect(new Set(paths).size).toBe(paths.length);
    expect(new Set(d.simrs.map((b) => b.id)).size).toBe(d.simrs.length);
    const kosong = d.kosong();
    for (const p of paths) {
      expect(PATH_RE.test(p), p).toBe(true);
      expect(ambilPath(kosong, p), p).not.toBeUndefined();
    }
    for (const k of d.simrs.flatMap((b) => b.kolom)) expect(SUMBER_SIMRS).toContain(k.sumber);
  });

  it("kolom tanda tangan tak pernah diisi dari SIMRS", () => {
    for (const d of DEFINISI_FORM) {
      const slot: string[] = [];
      d.petaTtd(d.kosong(), (v, s) => (slot.push(s), v));
      for (const b of d.simrs) for (const k of b.kolom) expect(slot).not.toContain(k.path);
    }
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

    const rm22 = definisiForm("RM.22")!;
    const r = rm22.kosong() as Record<string, unknown> & { informasi: Record<string, { isi: string; tanda: boolean }> };
    for (const id of Object.keys(r.informasi)) r.informasi[id] = { isi: id === "lainLain" ? "" : "-", tanda: id !== "lainLain" };
    Object.assign(r, {
      lembar: "persetujuan", dokterPelaksana: "dr. A", pemberiInformasi: "dr. A", penerimaInformasi: "B",
      pemberiTtd: ttd, penerimaTtd: ttd, pernyataNama: "B", pernyataUmur: "40", pernyataJk: "Perempuan",
      pernyataAlamat: "Modayag", tindakan: "Appendektomi", terhadap: "diri", tanggal: "2026-10-09",
      pernyataTtd: ttd, saksi1Nama: "Ns. C", saksi1Ttd: ttd,
    });
    expect(rm22.skema.safeParse(r).success).toBe(true);
    expect(rm22.syaratFinal(r)).toEqual([]);

    const rm33 = definisiForm("RM.33")!;
    const r33 = rm33.kosong() as Record<string, unknown> & { informasi: Record<string, { isi: string; tanda: boolean }> };
    for (const id of Object.keys(r33.informasi)) r33.informasi[id] = { isi: id === "lainLain" ? "" : "-", tanda: id !== "lainLain" };
    Object.assign(r33, {
      keputusan: "menunda", tujuanRujukan: "RSUD Kotamobagu", tanggalRujuk: "2026-10-10",
      dokterPelaksana: "dr. A", pemberiInformasi: "dr. A", penerimaInformasi: "B",
      pemberiTtd: ttd, penerimaTtd: ttd, pernyataNama: "B", pernyataUmur: "40", pernyataJk: "Perempuan",
      pernyataAlamat: "Sumber Rejo", terhadap: "diri", tanggal: "2026-10-09",
      pernyataTtd: ttd, dokterNama: "dr. A", dokterTtd: ttd, saksi1Nama: "Ns. C", saksi1Ttd: ttd,
    });
    expect(rm33.skema.safeParse(r33).success).toBe(true);
    expect(rm33.syaratFinal(r33)).toEqual([]);

    const rm41 = definisiForm("RM.41")!;
    const r41 = {
      ...(rm41.kosong() as object),
      selaku: "anak", pernyataNama: "B", pernyataUmur: "40", pernyataAlamat: "Modayag",
      pasienNama: "P", pasienJk: "Laki-laki", pasienTglLahir: "1950-02-03", pasienNorm: "12345",
      alasan: "Ingin dirawat di rumah", waktu: "2026-10-09T14:05",
      petugasNama: "Ns. C", petugasTtd: ttd, saksiNama: "D", saksiTtd: ttd, pernyataTtd: ttd,
    };
    expect(rm41.skema.safeParse(r41).success).toBe(true);
    expect(rm41.syaratFinal(r41)).toEqual([]);

    const rm50 = definisiForm("RM.50")!;
    const ttv = { td: "120/80", n: "88", r: "20", s: "36,5" };
    const r50 = {
      ...(rm50.kosong() as object),
      waktu: "2026-10-12T09:00", ruangRawat: "Interna", dokter: "dr. A", alergi: "tidak", pernahTransfusi: "ya", transfusiTahun: "2024",
      golonganDarah: "O+", kantongKeadaan: "utuh", diterimaWaktu: "2026-10-12T08:30",
      kantong: [{ id: "abc123def", waktu: "2026-10-12T09:00", jenis: "PRC", noSeri: "S-1", kadaluarsa: "2026-11-01", isi: "250",
        ttv: { sebelum: ttv, awal: ttv, saat: ttv, setelah: { ...ttv, td: "-" } }, reaksi: "Tidak ada", parafNama: "Ns. C", paraf: ttd }],
    };
    expect(rm50.skema.safeParse(r50).success).toBe(true);
    expect(rm50.syaratFinal(r50)).toEqual([]);
  });
});
