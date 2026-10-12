//! Alamat server ReportHub yang dibuka aplikasi (PRD Form RM Terpadu §12.3: origin dikunci).
//!
//! Urutan sumber: berkas `reporthub.json` di folder aplikasi (diatur IT tanpa build
//! ulang, mis. saat pindah ke domain HTTPS), lalu alamat bawaan yang ditanam saat
//! build (`REPORTHUB_URL`). Nilainya WAJIB origin http(s) murni — tanpa path,
//! query, atau kredensial — karena seluruh penguncian navigasi bertumpu padanya.

use std::path::{Path, PathBuf};

use serde::Deserialize;
use url::{Origin, Url};

/// Nama berkas konfigurasi di samping berkas exe.
pub const NAMA_BERKAS: &str = "reporthub.json";
/// Batas ukuran berkas konfigurasi (cegah berkas aneh dibaca utuh).
const MAKS_BYTES: u64 = 4 * 1024;
/// Halaman pertama setelah aplikasi dibuka: pintu desktop di server, yang memilih
/// modulnya (Form RM bila berizin, selain itu dasbor) — `JALUR_AWAL_DESKTOP` di `src/lib/desktop.ts`.
const JALUR_AWAL: &str = "/desktop";
/// Argumen bawaan Tauri untuk WebView2 — ditulis ulang karena `additional_browser_args`
/// menggantikannya (bukan menambah).
const ARGUMEN_BAWAAN_TAURI: &str = "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection";

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct BerkasKonfigurasi {
    server: String,
    /// `false` untuk PC bersama (satu akun Windows dipakai banyak petugas): WebView2
    /// tidak lagi menawarkan menyimpan kata sandi. Bawaan `true`.
    #[serde(rename = "simpanKataSandi", default = "bawaan_simpan_kata_sandi")]
    simpan_kata_sandi: bool,
}

fn bawaan_simpan_kata_sandi() -> bool {
    true
}

/// Server ReportHub tujuan aplikasi; hanya origin ini yang boleh dibuka di jendela.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Server {
    asal: Url,
    simpan_kata_sandi: bool,
}

impl Server {
    /// Pengelola kata sandi WebView2 menawarkan "Simpan kata sandi" setelah masuk dan
    /// menampilkan akun tersimpan di kolom username. Kata sandi disimpan WebView2 di profil
    /// Windows pengguna (terenkripsi DPAPI), bukan oleh aplikasi ini maupun server.
    pub fn simpan_kata_sandi(&self) -> bool {
        self.simpan_kata_sandi
    }

    /// Origin `scheme://host[:port]`, mis. untuk pesan dan argumen browser.
    pub fn asal(&self) -> String {
        self.asal.origin().ascii_serialization()
    }

    pub fn url_awal(&self) -> Url {
        self.asal.join(JALUR_AWAL).expect("jalur awal tetap sah")
    }

    /// URL ini berada di origin server (termasuk `blob:` buatan halaman server).
    pub fn cocok(&self, url: &Url) -> bool {
        let asal = url.origin();
        matches!(asal, Origin::Tuple(..)) && asal == self.asal.origin()
    }

    pub fn https(&self) -> bool {
        self.asal.scheme() == "https"
    }

    /// Argumen tambahan WebView2. Selama server masih HTTP (PRD K4 ditunda), HANYA
    /// origin ReportHub diperlakukan sebagai konteks aman agar kamera (TTD foto,
    /// foto barang) dan service worker berjalan; izin kamera tetap ditanyakan.
    pub fn argumen_browser(&self) -> String {
        if self.https() {
            ARGUMEN_BAWAAN_TAURI.to_string()
        } else {
            format!("{ARGUMEN_BAWAAN_TAURI} --unsafely-treat-insecure-origin-as-secure={}", self.asal())
        }
    }

    /// Endpoint pemeriksaan pembaruan yang disajikan server ReportHub sendiri.
    pub fn endpoint_pembaruan(&self, target: &str, arsitektur: &str, versi: &str) -> Url {
        self.asal
            .join(&format!("/api/desktop/pembaruan/{target}/{arsitektur}/{versi}"))
            .expect("endpoint pembaruan tetap sah")
    }
}

/// Validasi alamat server → hanya origin http(s) murni yang diterima.
pub fn urai_alamat(mentah: &str) -> Result<Server, String> {
    let teks = mentah.trim();
    let url = Url::parse(teks).map_err(|_| format!("Alamat server tidak sah: \"{teks}\""))?;
    if url.scheme() != "http" && url.scheme() != "https" {
        return Err("Alamat server harus diawali http:// atau https://".into());
    }
    if url.host_str().unwrap_or("").is_empty() {
        return Err("Alamat server tidak memuat nama host".into());
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err("Alamat server tidak boleh memuat nama pengguna/kata sandi".into());
    }
    if url.path() != "/" || url.query().is_some() || url.fragment().is_some() {
        return Err("Alamat server harus origin saja, mis. http://10.0.0.5:3000 (tanpa path)".into());
    }
    Ok(Server { asal: url, simpan_kata_sandi: bawaan_simpan_kata_sandi() })
}

/// Isi `reporthub.json` → server.
pub fn urai_berkas(isi: &str) -> Result<Server, String> {
    let berkas: BerkasKonfigurasi = serde_json::from_str(isi).map_err(|e| {
        format!(
            "{NAMA_BERKAS} tidak sah ({e}). Format: {{\"server\": \"http://alamat:port\"}} \
             (opsional \"simpanKataSandi\": false)"
        )
    })?;
    Ok(Server { simpan_kata_sandi: berkas.simpan_kata_sandi, ..urai_alamat(&berkas.server)? })
}

fn baca_berkas(jalur: &Path) -> Result<Option<String>, String> {
    let meta = match std::fs::metadata(jalur) {
        Ok(m) => m,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(format!("Tidak dapat membaca {}: {e}", jalur.display())),
    };
    if !meta.is_file() || meta.len() > MAKS_BYTES {
        return Err(format!("{} bukan berkas konfigurasi yang sah", jalur.display()));
    }
    std::fs::read_to_string(jalur)
        .map(Some)
        .map_err(|e| format!("Tidak dapat membaca {}: {e}", jalur.display()))
}

/// Lokasi berkas konfigurasi: folder tempat exe dipasang.
pub fn jalur_berkas() -> Option<PathBuf> {
    std::env::current_exe().ok()?.parent().map(|d| d.join(NAMA_BERKAS))
}

/// Muat server: berkas konfigurasi bila ada, selain itu alamat bawaan build.
pub fn muat() -> Result<Server, String> {
    if let Some(jalur) = jalur_berkas() {
        if let Some(isi) = baca_berkas(&jalur)? {
            return urai_berkas(&isi);
        }
    }
    match option_env!("REPORTHUB_URL") {
        Some(bawaan) if !bawaan.trim().is_empty() => urai_alamat(bawaan),
        _ => Err(format!(
            "Alamat server ReportHub belum diatur. Buat berkas {NAMA_BERKAS} di folder aplikasi berisi \
             {{\"server\": \"http://alamat-server:port\"}}."
        )),
    }
}

#[cfg(test)]
mod uji {
    use super::*;

    #[test]
    fn menerima_origin_http_dan_https() {
        let s = urai_alamat("http://10.202.100.127:3000").unwrap();
        assert_eq!(s.asal(), "http://10.202.100.127:3000");
        assert_eq!(s.url_awal().as_str(), "http://10.202.100.127:3000/desktop");
        assert!(!s.https());
        let h = urai_alamat(" https://reporthub.rsudboltim.go.id/ ").unwrap();
        assert_eq!(h.asal(), "https://reporthub.rsudboltim.go.id");
        assert!(h.https());
    }

    #[test]
    fn menolak_selain_origin_murni() {
        for v in [
            "",
            "10.0.0.5:3000",
            "ftp://10.0.0.5",
            "file:///C:/x",
            "javascript:alert(1)",
            "http://10.0.0.5:3000/dashboard",
            "http://10.0.0.5:3000/?x=1",
            "http://10.0.0.5:3000/#a",
            "http://admin:rahasia@10.0.0.5:3000",
            "http://",
        ] {
            assert!(urai_alamat(v).is_err(), "harus ditolak: {v:?}");
        }
    }

    #[test]
    fn berkas_konfigurasi_ketat() {
        assert_eq!(urai_berkas(r#"{"server":"http://10.0.0.5:3000"}"#).unwrap().asal(), "http://10.0.0.5:3000");
        assert!(urai_berkas(r#"{"server":"http://10.0.0.5:3000","lain":1}"#).is_err());
        assert!(urai_berkas(r#"{"alamat":"http://10.0.0.5:3000"}"#).is_err());
        assert!(urai_berkas("bukan json").is_err());
    }

    #[test]
    fn simpan_kata_sandi_bawaan_aktif_dan_bisa_dimatikan_it() {
        assert!(urai_alamat("http://10.0.0.5:3000").unwrap().simpan_kata_sandi());
        assert!(urai_berkas(r#"{"server":"http://10.0.0.5:3000"}"#).unwrap().simpan_kata_sandi());
        let mati = urai_berkas(r#"{"server":"http://10.0.0.5:3000","simpanKataSandi":false}"#).unwrap();
        assert!(!mati.simpan_kata_sandi());
        assert_eq!(mati.asal(), "http://10.0.0.5:3000");
        assert!(urai_berkas(r#"{"server":"http://10.0.0.5:3000","simpanKataSandi":"tidak"}"#).is_err());
        assert!(urai_berkas(r#"{"server":"bukan-url","simpanKataSandi":false}"#).is_err());
    }

    #[test]
    fn origin_dicocokkan_lengkap_termasuk_port_dan_skema() {
        let s = urai_alamat("http://10.0.0.5:3000").unwrap();
        assert!(s.cocok(&Url::parse("http://10.0.0.5:3000/form-rm/isian/abc?x=1").unwrap()));
        assert!(s.cocok(&Url::parse("blob:http://10.0.0.5:3000/1b4e28ba-2fa1-11d2").unwrap()));
        for v in [
            "http://10.0.0.5:3001/",
            "https://10.0.0.5:3000/",
            "http://10.0.0.6:3000/",
            "http://10.0.0.5.evil.com:3000/",
            "about:blank",
            "data:text/html,hai",
            "blob:http://evil.com/x",
        ] {
            assert!(!s.cocok(&Url::parse(v).unwrap()), "bukan origin server: {v}");
        }
    }

    #[test]
    fn argumen_browser_hanya_melonggarkan_origin_server_saat_http() {
        let http = urai_alamat("http://10.0.0.5:3000").unwrap();
        assert_eq!(
            http.argumen_browser(),
            "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --unsafely-treat-insecure-origin-as-secure=http://10.0.0.5:3000"
        );
        let https = urai_alamat("https://rs.example").unwrap();
        assert!(!https.argumen_browser().contains("unsafely"));
    }

    #[test]
    fn endpoint_pembaruan_di_server_sendiri() {
        let s = urai_alamat("http://10.0.0.5:3000").unwrap();
        assert_eq!(
            s.endpoint_pembaruan("windows", "x86_64", "1.0.0").as_str(),
            "http://10.0.0.5:3000/api/desktop/pembaruan/windows/x86_64/1.0.0"
        );
    }
}
