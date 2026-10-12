//! Jendela desktop AuditTrail RS BOLTIM (PRD Form RM Terpadu §12).
//!
//! Aplikasi ini HANYA jendela WebView2 yang membuka server ReportHub — server
//! Next.js, kredensial SIMGOS, dan secret JWT tidak pernah ada di PC.
//! - Origin dikunci ke satu server (`konfigurasi`); situs lain → browser sistem.
//! - Tanpa IPC: konten remote tidak diberi capability apa pun (lihat
//!   `tauri.conf.json` → `app.security.capabilities: []`).
//! - DevTools mati di build rilis, satu instance saja, pembaruan bertanda tangan.

mod konfigurasi;
mod navigasi;
mod pembaruan;

use std::sync::atomic::{AtomicU32, Ordering};

use tauri::webview::{NewWindowFeatures, NewWindowResponse};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};
use url::Url;

use konfigurasi::Server;
use navigasi::Keputusan;

const LABEL_UTAMA: &str = "utama";
const JUDUL: &str = "AuditTrail RS BOLTIM";

static NOMOR_JENDELA: AtomicU32 = AtomicU32::new(1);

/// Buka di browser sistem (hanya http/https/mailto/tel — sudah disaring `navigasi`).
fn buka_di_browser(url: &Url) {
    if let Err(e) = tauri_plugin_opener::open_url(url.as_str(), None::<&str>) {
        eprintln!("[navigasi] gagal membuka di browser sistem: {e}");
    }
}

/// Satu resep jendela untuk jendela utama maupun jendela baru (`target="_blank"`,
/// mis. halaman cetak): penguncian origin, izin, dan pembukaan jendela yang sama.
fn bangun_jendela(
    app: &AppHandle,
    label: &str,
    url: WebviewUrl,
    server: &Server,
    fitur: Option<NewWindowFeatures>,
) -> tauri::Result<WebviewWindow> {
    let srv_navigasi = server.clone();
    let srv_izin = server.clone();
    let srv_jendela = server.clone();
    let app_jendela = app.clone();
    // Penanda tampilan bagi halaman (mis. sembunyikan menu "Unduh aplikasi desktop") — bukan IPC.
    let penanda = format!(
        "Object.defineProperty(window, '__AUDITTRAIL_DESKTOP__', {{ value: '{}', writable: false, configurable: false }});",
        app.package_info().version
    );

    let mut pembangun = WebviewWindowBuilder::new(app, label, url)
        .title(JUDUL)
        .initialization_script(penanda)
        .inner_size(1366.0, 860.0)
        .min_inner_size(1024.0, 640.0)
        .center()
        .devtools(cfg!(debug_assertions))
        .browser_extensions_enabled(false)
        // Data pasien tidak boleh terisi ulang dari riwayat isian browser.
        .general_autofill_enabled(false)
        .zoom_hotkeys_enabled(true)
        .additional_browser_args(&server.argumen_browser())
        .on_document_title_changed(|jendela, judul| {
            let _ = jendela.set_title(if judul.trim().is_empty() { JUDUL } else { judul.as_str() });
        })
        .on_navigation(move |url| match navigasi::putuskan_navigasi(url, &srv_navigasi) {
            Keputusan::Izinkan => true,
            Keputusan::BukaDiBrowser => {
                buka_di_browser(url);
                false
            }
            Keputusan::Tolak => false,
        })
        .on_permission_request(move |webview, jenis| {
            let dari_server = webview.url().map(|u| srv_izin.cocok(&u)).unwrap_or(false);
            navigasi::putuskan_izin(&jenis, dari_server)
        })
        .on_new_window(move |url, fitur| match navigasi::putuskan_jendela_baru(&url, &srv_jendela) {
            Keputusan::Izinkan => {
                let label = format!("jendela-{}", NOMOR_JENDELA.fetch_add(1, Ordering::Relaxed));
                let kosong = WebviewUrl::External("about:blank".parse().expect("about:blank sah"));
                match bangun_jendela(&app_jendela, &label, kosong, &srv_jendela, Some(fitur)) {
                    Ok(window) => NewWindowResponse::Create { window },
                    Err(e) => {
                        eprintln!("[jendela] gagal membuka jendela baru: {e}");
                        NewWindowResponse::Deny
                    }
                }
            }
            Keputusan::BukaDiBrowser => {
                buka_di_browser(&url);
                NewWindowResponse::Deny
            }
            Keputusan::Tolak => NewWindowResponse::Deny,
        });

    if let Some(fitur) = fitur {
        // Windows: jendela baru wajib memakai lingkungan WebView2 pembukanya (cookie sesi sama).
        pembangun = pembangun.window_features(fitur);
    }
    pembangun.build()
}

/// Pengelola kata sandi WebView2 (tak diekspos Tauri/wry): tawarkan "Simpan kata sandi"
/// setelah masuk dan tampilkan akun tersimpan di kolom username. Isian otomatis umum tetap
/// mati (`general_autofill_enabled(false)`) — data pasien tak pernah diisi ulang; yang
/// disimpan hanya pasangan username/kata sandi, di profil WebView2 pengguna Windows.
#[cfg(windows)]
fn atur_simpan_kata_sandi(webview: &tauri::webview::PlatformWebview, aktif: bool) {
    use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings4;
    use windows_core::Interface;
    // SAFETY: panggilan COM WebView2 di thread UI (closure `with_webview` dijalankan event loop).
    let hasil = unsafe {
        webview
            .controller()
            .CoreWebView2()
            .and_then(|w| w.Settings())
            .and_then(|s| s.cast::<ICoreWebView2Settings4>())
            .and_then(|s| s.SetIsPasswordAutosaveEnabled(aktif))
    };
    if let Err(e) = hasil {
        eprintln!("[kata sandi] gagal mengatur penyimpanan kata sandi WebView2: {e}");
    }
}

fn fokus_jendela_utama(app: &AppHandle) {
    if let Some(jendela) = app.get_webview_window(LABEL_UTAMA) {
        let _ = jendela.unminimize();
        let _ = jendela.show();
        let _ = jendela.set_focus();
    }
}

fn tampilkan_galat_lalu_keluar(app: &AppHandle, pesan: String) {
    let app2 = app.clone();
    app.dialog()
        .message(pesan)
        .title(JUDUL)
        .kind(MessageDialogKind::Error)
        .show(move |_| app2.exit(1));
}

pub fn run() {
    let cek_pembaruan = std::env::args().any(|a| a == "--cek-pembaruan");

    tauri::Builder::default()
        // Wajib didaftarkan pertama: instance kedua langsung keluar & memfokuskan yang pertama.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| fokus_jendela_utama(app)))
        .plugin(tauri_plugin_dialog::init())
        // Plugin opener SENGAJA tidak didaftarkan: skrip suntikannya mencegat klik tautan
        // `_blank` (mis. tombol Cetak) lalu memanggil IPC yang ditolak untuk halaman remote →
        // tautan mati. Tautan luar dibuka lewat `tauri_plugin_opener::open_url` dari Rust.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(move |app| {
            let handle = app.handle().clone();
            let server = match konfigurasi::muat() {
                Ok(s) => s,
                Err(pesan) => {
                    if cek_pembaruan {
                        println!("GAGAL_KONFIGURASI: {pesan}");
                        handle.exit(2);
                    } else {
                        tampilkan_galat_lalu_keluar(&handle, pesan);
                    }
                    return Ok(());
                }
            };
            if cek_pembaruan {
                pembaruan::cek_lalu_keluar(handle, server);
                return Ok(());
            }
            // Dibuka kosong dulu: pengaturan WebView2 diterapkan sebelum navigasi pertama.
            let kosong = WebviewUrl::External("about:blank".parse().expect("about:blank sah"));
            let jendela = bangun_jendela(&handle, LABEL_UTAMA, kosong, &server, None)?;
            #[cfg(windows)]
            {
                let aktif = server.simpan_kata_sandi();
                jendela.with_webview(move |w| atur_simpan_kata_sandi(&w, aktif))?;
            }
            // Perintah jendela diproses berurutan di event loop → navigasi setelah pengaturan.
            jendela.navigate(server.url_awal())?;
            pembaruan::periksa_latar(handle, server);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("gagal menjalankan aplikasi");
}
