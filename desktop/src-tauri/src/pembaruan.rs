//! Pembaruan otomatis bertanda tangan (PRD §12.3), disajikan server ReportHub sendiri.
//!
//! Paket diverifikasi dengan kunci publik di `tauri.conf.json` (minisign) SEBELUM
//! dipasang, dan tanda tangannya wajib memuat versi yang diumumkan
//! (`requireSignedVersion`). Selama server masih HTTP (K4), tanda tangan inilah
//! satu-satunya pelindung integritas paket — kunci privat tidak pernah masuk repo.

use std::time::Duration;

use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_updater::{Update, UpdaterExt};

use crate::konfigurasi::Server;

const BATAS_WAKTU: Duration = Duration::from_secs(30);
/// Jeda sebelum memeriksa: jendela utama tampil dulu, server tidak dibebani saat PC menyala.
const JEDA_AWAL: Duration = Duration::from_secs(5);
/// Waktu bagi halaman untuk menyimpan draf form sebelum aplikasi ditutup pemasang.
const JEDA_SIMPAN_DRAF: Duration = Duration::from_secs(3);

fn target() -> &'static str {
    if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "darwin"
    } else {
        "linux"
    }
}

async fn periksa(app: &AppHandle, server: &Server) -> Result<Option<Update>, tauri_plugin_updater::Error> {
    let versi = app.package_info().version.to_string();
    let endpoint = server.endpoint_pembaruan(target(), std::env::consts::ARCH, &versi);
    app.updater_builder()
        .endpoints(vec![endpoint])?
        .timeout(BATAS_WAKTU)
        .build()?
        .check()
        .await
}

/// Minta semua halaman menyimpan draf (event yang sama dengan sebelum keluar idle).
fn minta_simpan_draf(app: &AppHandle) {
    for (_, jendela) in app.webview_windows() {
        let _ = jendela.eval(
            "window.dispatchEvent(new CustomEvent('rh:sebelum-keluar', { detail: { tunggu: function () {} } }))",
        );
    }
}

async fn pasang(app: AppHandle, update: Update) {
    minta_simpan_draf(&app);
    tokio::time::sleep(JEDA_SIMPAN_DRAF).await;
    match update.download_and_install(|_, _| {}, || {}).await {
        // Windows: pemasang mengambil alih & menutup aplikasi; baris ini untuk platform lain.
        Ok(()) => app.restart(),
        Err(e) => {
            app.dialog()
                .message(format!("Pembaruan gagal dipasang: {e}\n\nAplikasi tetap bisa dipakai dengan versi sekarang."))
                .title("Pembaruan gagal")
                .kind(MessageDialogKind::Error)
                .show(|_| {});
        }
    }
}

/// Periksa pembaruan di latar setelah aplikasi dibuka; tawarkan pemasangan bila ada.
pub fn periksa_latar(app: AppHandle, server: Server) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(JEDA_AWAL).await;
        let update = match periksa(&app, &server).await {
            Ok(Some(u)) => u,
            Ok(None) => return,
            // Server lama tanpa endpoint, jaringan putus, dsb. → diam; dicoba lagi saat dibuka berikutnya.
            Err(e) => {
                eprintln!("[pembaruan] pemeriksaan gagal: {e}");
                return;
            }
        };
        let catatan = update.body.clone().filter(|b| !b.trim().is_empty()).map(|b| format!("\n\n{b}")).unwrap_or_default();
        let pesan = format!(
            "Versi baru {} tersedia (terpasang: {}).{catatan}\n\nPasang sekarang? Draf formulir disimpan dulu, lalu aplikasi ditutup sebentar dan dibuka kembali.",
            update.version, update.current_version
        );
        let app2 = app.clone();
        app.dialog()
            .message(pesan)
            .title("Pembaruan AuditTrail RS BOLTIM")
            .kind(MessageDialogKind::Info)
            .buttons(MessageDialogButtons::OkCancelCustom("Pasang sekarang".into(), "Nanti".into()))
            .show(move |ya| {
                if ya {
                    tauri::async_runtime::spawn(pasang(app2, update));
                }
            });
    });
}

/// Mode diagnosis `--cek-pembaruan` (untuk IT & uji): periksa, unduh, dan VERIFIKASI
/// tanda tangan paket tanpa memasangnya; hasil ke stdout, lalu keluar.
/// Kode keluar: 0 = terbaru / tersedia & sah, 2 = gagal.
pub fn cek_lalu_keluar(app: AppHandle, server: Server) {
    tauri::async_runtime::spawn(async move {
        let kode = match periksa(&app, &server).await {
            Ok(None) => {
                println!("TERBARU {}", app.package_info().version);
                0
            }
            Ok(Some(update)) => match update.download(|_, _| {}, || {}).await {
                Ok(bytes) => {
                    println!("TERSEDIA {} TANDA_TANGAN_SAH {} byte", update.version, bytes.len());
                    0
                }
                Err(e) => {
                    println!("GAGAL_VERIFIKASI {}: {e}", update.version);
                    2
                }
            },
            Err(e) => {
                println!("GAGAL_PERIKSA: {e}");
                2
            }
        };
        app.exit(kode);
    });
}
