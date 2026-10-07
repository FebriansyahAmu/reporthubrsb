//! Keputusan navigasi, jendela baru, dan izin webview (murni, diuji unit).
//!
//! Jendela aplikasi hanya menampilkan origin server ReportHub. Tautan ke situs
//! lain dibuka di browser sistem (bukan di jendela yang memegang sesi pasien);
//! skema lain (`file:`, `javascript:`, `data:`, protokol aplikasi lain) ditolak.

use tauri::webview::{PermissionKind, PermissionResponse};
use url::Url;

use crate::konfigurasi::Server;

#[derive(Debug, PartialEq, Eq)]
pub enum Keputusan {
    /// Tetap di jendela aplikasi.
    Izinkan,
    /// Batalkan di jendela; buka di browser sistem.
    BukaDiBrowser,
    /// Batalkan tanpa membuka apa pun.
    Tolak,
}

fn about_blank(url: &Url) -> bool {
    url.scheme() == "about" && url.path() == "blank"
}

/// Navigasi di dalam jendela (klik tautan, pengalihan, `location = …`).
pub fn putuskan_navigasi(url: &Url, server: &Server) -> Keputusan {
    if server.cocok(url) || about_blank(url) {
        return Keputusan::Izinkan;
    }
    match url.scheme() {
        "http" | "https" | "mailto" | "tel" => Keputusan::BukaDiBrowser,
        _ => Keputusan::Tolak,
    }
}

/// `window.open` / `target="_blank"` (mis. halaman cetak): origin server → jendela
/// aplikasi baru dengan penguncian yang sama; selain itu seperti navigasi.
pub fn putuskan_jendela_baru(url: &Url, server: &Server) -> Keputusan {
    if server.cocok(url) || about_blank(url) {
        Keputusan::Izinkan
    } else {
        putuskan_navigasi(url, server)
    }
}

/// Izin webview: hanya halaman server ReportHub yang boleh MEMINTA kamera
/// (TTD foto, foto barang) dan unduhan beruntun; pengguna tetap ditanya
/// (`Default` = dialog izin WebView2). Selain itu ditolak tanpa bertanya —
/// aplikasi tidak memakai mikrofon, lokasi, notifikasi sistem, clipboard
/// baca, akses berkas, MIDI, maupun sensor.
pub fn putuskan_izin(jenis: &PermissionKind, dari_server: bool) -> PermissionResponse {
    match jenis {
        PermissionKind::Camera | PermissionKind::AutomaticDownloads if dari_server => PermissionResponse::Default,
        _ => PermissionResponse::Deny,
    }
}

#[cfg(test)]
mod uji {
    use super::*;
    use crate::konfigurasi::urai_alamat;

    fn server() -> Server {
        urai_alamat("http://10.0.0.5:3000").unwrap()
    }
    fn u(v: &str) -> Url {
        Url::parse(v).unwrap()
    }

    #[test]
    fn origin_server_tetap_di_jendela() {
        for v in [
            "http://10.0.0.5:3000/",
            "http://10.0.0.5:3000/form-rm/isian/abc",
            "http://10.0.0.5:3000/print/form-rm/isian/abc",
            "http://10.0.0.5:3000/?callbackUrl=%2Fdashboard&alasan=idle",
            "about:blank",
        ] {
            assert_eq!(putuskan_navigasi(&u(v), &server()), Keputusan::Izinkan, "{v}");
        }
    }

    #[test]
    fn situs_lain_dibuka_di_browser_sistem() {
        for v in [
            "https://www.google.com/",
            "http://10.0.0.5:3001/",
            "https://10.0.0.5:3000/",
            "http://10.0.0.6:3000/dashboard",
            "mailto:rm@rsud.example",
        ] {
            assert_eq!(putuskan_navigasi(&u(v), &server()), Keputusan::BukaDiBrowser, "{v}");
        }
    }

    #[test]
    fn skema_berbahaya_ditolak() {
        for v in ["file:///C:/Windows/win.ini", "javascript:alert(1)", "data:text/html,hai", "ms-settings:privacy", "ftp://10.0.0.5/"] {
            assert_eq!(putuskan_navigasi(&u(v), &server()), Keputusan::Tolak, "{v}");
        }
    }

    #[test]
    fn jendela_baru_mengikuti_aturan_yang_sama() {
        assert_eq!(putuskan_jendela_baru(&u("http://10.0.0.5:3000/print/x"), &server()), Keputusan::Izinkan);
        assert_eq!(putuskan_jendela_baru(&u("https://evil.example/"), &server()), Keputusan::BukaDiBrowser);
        assert_eq!(putuskan_jendela_baru(&u("file:///C:/x"), &server()), Keputusan::Tolak);
    }

    #[test]
    fn izin_minimal() {
        assert!(matches!(putuskan_izin(&PermissionKind::Camera, true), PermissionResponse::Default));
        assert!(matches!(putuskan_izin(&PermissionKind::AutomaticDownloads, true), PermissionResponse::Default));
        assert!(matches!(putuskan_izin(&PermissionKind::Camera, false), PermissionResponse::Deny));
        for k in [
            PermissionKind::Microphone,
            PermissionKind::Geolocation,
            PermissionKind::Notifications,
            PermissionKind::ClipboardRead,
            PermissionKind::DisplayCapture,
            PermissionKind::FileSystemAccess,
            PermissionKind::Midi,
            PermissionKind::Sensors,
        ] {
            assert!(matches!(putuskan_izin(&k, true), PermissionResponse::Deny), "{k:?}");
        }
    }
}
