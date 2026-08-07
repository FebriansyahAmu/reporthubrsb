import type { ConsentForm } from "@/server/modules/form-rm/form-rm.types";

/** Jenis form RM (discriminator baris `form_rm`) untuk General Consent. */
export const CONSENT_JENIS = "consent";

/** Identitas RS pada kop cetak RM.03 (sesuai formulir asli). */
export const CONSENT_RS = {
  nama: "RSUD BOLAANG MONGONDOW TIMUR",
  alamat: [
    "Jl. Ratahan-Kotamobagu Desa Sumber Rejo",
    "E-mail : boltimrsd@gmail.com",
    "Modayag - Bolaang Mongondow Timur",
  ],
  namaResmi: "RSUD Pratama Bolaang Mongondow Timur",
  kotaTtd: "Sumber Rejo",
};

export const JK_OPTS = ["Laki-Laki", "Perempuan"];
export const KELAS_OPTS = ["Kelas I", "Kelas II", "Kelas III", "VIP"];
export const IZIN_PRIVASI_OPTS = ["Mengijinkan", "Tidak Mengijinkan"];

/**
 * Teks legal formulir (I–X) — sumber tunggal untuk tampilan form (read-only) &
 * cetak 1:1. Transkrip dari formulir RM.03 asli.
 */
export const CONSENT_TEXT = {
  I: "Saya mengetahui bahwa saya memiliki kondisi yang membutuhkan perawatan medis, saya mengizinkan dokter dan profesional lainnya untuk melakukan prosedur diagnostik dan untuk memberikan pengobatan medis seperti yang diperlukan dalam penilaian profesional mereka. Prosedur diagnostik dan perawatan medis, tidak terbatas pada electrocadiograms, x-ray, tes darah, terapi fisik, pemberian obat dan pemeriksaan lainnya.",
  II: "Saya sadar bahwa praktik kedokteran dan bedah bukanlah ilmu pasti dan saya mengakui bahwa tidak ada jaminan atas hasil apapun, terhadap perawatan prosedur atau pemeriksaan apapun yang dilakukan kepada saya.",
  III_1: "Saya memahami informasi yang ada di dalam diri saya, termasuk diagnostik, hasil laboratorium dan hasil tes diagnostik yang akan digunakan untuk perawatan medis, akan dijamin kerahasiaannya oleh rumah sakit.",
  III_2: "Saya memberi wewenang kepada rumah sakit untuk memberikan informasi tentang rahasia kedokteran saya bila diperlukan untuk memproses klaim asuransi namun tidak terbatas pada BPJS, asuransi kesehatan lainnya, perusahaan dan atau lembaga pemerintah lainnya.",
  III_3: "Saya memberi wewenang kepada RSUD Pratama Bolaang Mongondow Timur untuk memberikan informasi tentang diagnosis, hasil pelayanan dan pengobatan saya kepada anggota keluarga saya dan kepada :",
  IV_1: "Saya mengijinkan/tidak mengijinkan (coret yang tidak perlu) rumah sakit memberi akses bagi keluarga dan handai taulan serta orang-orang yang akan menengok/menemui saya (jumlah orang yang menjenguk).",
  IV_2: "Sebutkan nama/profesi bila ada permintaan khusus :",
  V: "Saya menyatakan setuju, baik sebagai wali atau sebagai pasien, bahwa sesuai pertimbangan yang diberikan kepada pasien, maka saya wajib untuk membayar total biaya perawatan. Biaya pelayanan berdasarkan acuan biaya dan ketentuan RSUD Pratama Bolaang Mongondow Timur.",
  VI: "Saya mengijinkan dokter dan profesional lainnya untuk melakukan tindakan pemasangan alat medis seperti melakukan penyuntikan, pemasangan infus, pemasangan selang urin, pemasangan selang makan, pemeriksaan EKG, pemasangan selang oksigen, dan lain lain.",
  VII: "Saya mengetahui dan menyetujui adanya siswa pendidikan kesehatan di RSUD Pratama Bolaang Mongondow Timur.",
  VIII: [
    "Pasien dan keluarga harus mematuhi peraturan yang berlaku di rumah sakit",
    "Pasien dan keluarga dilarang merokok di lingkungan rumah sakit",
    "Dilarang mencuci dan menjemur pakaian, memasak di ruang perawatan",
    "Tidak membawa alkohol, obat-obatan terlarang dan senjata tajam / api",
    "Memperlakukan staf rumah sakit dan pasien lain dengan bermartabat dan hormat serta tidak melakukan tindakan yang akan mengganggu ketertiban.",
    "Anak-anak dibawah 12 tahun dilarang masuk ruang perawatan",
  ],
  IX: "Saya telah mendapatkan penjelasan tentang tata tertib, hak dan kewajiban pasien dan keluarga di RSUD Pratama Bolaang Mongondow Timur melalui banner yang disediakan petugas.",
  X: "SAYA TELAH MEMBACA dan SEPENUHNYA SETUJU dengan setiap pernyataan yang terdapat pada formulir ini dan menandatangani tanpa paksaan dan kesadaran penuh.",
} as const;

/** HAK PASIEN — UU No. 44 tahun 2009 (halaman 2). */
export const HAK_PASIEN: string[] = [
  "Memperoleh informasi mengenai tata tertib dan peraturan yang berlaku di Rumah Sakit.",
  "Memperoleh informasi tentang hak dan kewajiban pasien.",
  "Memperoleh layanan yang manusiawi, adil, jujur, dan tanpa diskriminasi.",
  "Memperoleh layanan kesehatan yang bermutu sesuai dengan standar profesi dan standar prosedur operasional.",
  "Memperoleh layanan yang efektif dan efisien sehingga pasien terhindar dari kerugian fisik dan materi.",
  "Mengajukan pengaduan atas kualitas pelayanan yang didapatkan.",
  "Memilih dokter dan kelas perawatan sesuai dengan keinginannya dan peraturan yang berlaku di Rumah Sakit.",
  "Meminta konsultasi tentang penyakit yang dideritanya kepada dokter lain yang mempunyai Surat Izin Praktik (SIP) baik di dalam maupun di luar Rumah Sakit.",
  "Mendapatkan privasi dan kerahasiaan penyakit yang diderita termasuk data-data medisnya.",
  "Memberikan persetujuan atau menolak atas tindakan yang akan dilakukan oleh tenaga kesehatan terhadap penyakit yang dideritanya.",
  "Mendapat informasi yang meliputi diagnosis dan tata cara tindakan medis, tujuan tindakan medis, alternative tindakan, resiko dan komplikasi yang mungkin terjadi, dan prognosis terhadap tindakan yang dilakukan serta perkiraan biaya pengobatan.",
  "Didampingi keluarganya dalam keadaan kritis.",
  "Menjalankan ibadah sesuai dengan agama atau kepercayaan yang dianutnya selama hal itu tidak mengganggu pasien lainnya.",
  "Memperoleh keamanan dan keselamatan dirinya selama dalam perawatan di Rumah Sakit.",
  "Mengajukan usul, saran, perbaikan atas perlakuan Rumah Sakit terhadap dirinya.",
  "Menolak pelayanan bimbingan rohani yang tidak sesuai dengan agama dan kepercayaan yang dianutnya.",
  "Menggugat dan/atau menuntut Rumah Sakit apabila Rumah Sakit diduga memberikan pelayanan yang tidak sesuai dengan standar baik secara perdata ataupun pidana, dan",
  "Mengeluhkan pelayanan Rumah Sakit yang tidak sesuai dengan standar pelayanan melalui media cetak dan elektronik sesuai dengan ketentuan perundang-undangan.",
];

/** KEWAJIBAN PASIEN — UU No. 29 tahun 2004 (halaman 2). */
export const KEWAJIBAN_PASIEN: string[] = [
  "Memberikan informasi yang lengkap dan jujur tentang masalah kesehatannya;",
  "Mematuhi nasihat dan petunjuk dokter atau dokter gigi;",
  "Mematuhi ketentuan yang berlaku di sarana pelayanan kesehatan;",
  "Memberikan imbalan atas pelayanan yang diterima.",
];

/** Form General Consent kosong. */
export function emptyConsentForm(): ConsentForm {
  return {
    waktuPendaftaran: "",
    ruanganRawat: "",
    kelas: "",
    nik: "",
    pjNama: "",
    pjJenisKelamin: "",
    pjUmur: "",
    pjHubungan: "",
    pjAlamat: "",
    pjTelepon: "",
    pelepasanInfo: ["", "", ""],
    izinPrivasi: "",
    permintaanKhusus: ["", ""],
    pasienNama: "",
    pasienTtd: "",
    petugasNama: "",
    petugasTtd: "",
    tanggalTtd: "",
  };
}
