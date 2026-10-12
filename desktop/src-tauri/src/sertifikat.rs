//! Pin sertifikat HTTPS server ReportHub (server memakai sertifikat self-signed yang
//! tidak dipercaya Windows).
//!
//! Aplikasi hanya menerima sertifikat yang SIDIK SHA-256-nya (atas DER sertifikat
//! server) tercantum di konfigurasi — bukan "abaikan galat sertifikat":
//! - WebView2: galat sertifikat diizinkan hanya untuk origin server DAN sidik yang cocok
//!   (`lib.rs`); sertifikat yang memang sah menurut Windows tetap diterima seperti biasa.
//! - Updater: klien rustls dengan pemeriksa sendiri — sertifikat wajib cocok sidik dan
//!   tanda tangan jabat-tangan TLS tetap diverifikasi (server benar memegang kunci privatnya).

use std::sync::Arc;

use base64::Engine;
use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
use rustls::crypto::{verify_tls12_signature, verify_tls13_signature, CryptoProvider};
use rustls::pki_types::{CertificateDer, ServerName, UnixTime};
use rustls::{CertificateError, DigitallySignedStruct, SignatureScheme};
use sha2::{Digest, Sha256};

pub type Sidik = [u8; 32];

/// Sidik SHA-256 dalam hex (64 digit; boleh dipisah `:` atau spasi, huruf besar/kecil).
pub fn urai_sidik(teks: &str) -> Result<Sidik, String> {
    let hex: String = teks.chars().filter(|c| !matches!(c, ':' | ' ')).collect();
    if hex.len() != 64 || !hex.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(format!("Sidik sertifikat tidak sah: \"{}\" (harus SHA-256, 64 digit hex)", teks.trim()));
    }
    let mut hasil = [0u8; 32];
    for (i, b) in hasil.iter_mut().enumerate() {
        *b = u8::from_str_radix(&hex[i * 2..i * 2 + 2], 16).map_err(|_| "Sidik sertifikat tidak sah".to_string())?;
    }
    Ok(hasil)
}

/// Daftar sidik dipisah koma (nilai bawaan build `REPORTHUB_CERT_SHA256`). Kosong → tanpa pin.
pub fn urai_daftar(teks: &str) -> Result<Vec<Sidik>, String> {
    teks.split(',').map(str::trim).filter(|s| !s.is_empty()).map(urai_sidik).collect()
}

pub fn sidik_der(der: &[u8]) -> Sidik {
    Sha256::digest(der).into()
}

/// Sidik dari sertifikat PEM (bentuk yang diberikan WebView2).
pub fn sidik_pem(pem: &str) -> Option<Sidik> {
    let isi: String = pem.lines().map(str::trim).filter(|b| !b.is_empty() && !b.starts_with("-----")).collect();
    base64::engine::general_purpose::STANDARD.decode(isi).ok().map(|der| sidik_der(&der))
}

/// Sertifikat cocok dengan salah satu pin (pembanding waktu-tetap).
pub fn cocok(sidik: &Sidik, pin: &[Sidik]) -> bool {
    pin.iter().any(|p| p.iter().zip(sidik).fold(0u8, |acc, (a, b)| acc | (a ^ b)) == 0)
}

#[derive(Debug)]
struct PemeriksaPin {
    pin: Vec<Sidik>,
    penyedia: Arc<CryptoProvider>,
}

impl ServerCertVerifier for PemeriksaPin {
    fn verify_server_cert(
        &self,
        sertifikat: &CertificateDer<'_>,
        _perantara: &[CertificateDer<'_>],
        _nama: &ServerName<'_>,
        _ocsp: &[u8],
        _sekarang: UnixTime,
    ) -> Result<ServerCertVerified, rustls::Error> {
        if cocok(&sidik_der(sertifikat.as_ref()), &self.pin) {
            Ok(ServerCertVerified::assertion())
        } else {
            Err(rustls::Error::InvalidCertificate(CertificateError::ApplicationVerificationFailure))
        }
    }

    fn verify_tls12_signature(
        &self,
        pesan: &[u8],
        sertifikat: &CertificateDer<'_>,
        ttd: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        verify_tls12_signature(pesan, sertifikat, ttd, &self.penyedia.signature_verification_algorithms)
    }

    fn verify_tls13_signature(
        &self,
        pesan: &[u8],
        sertifikat: &CertificateDer<'_>,
        ttd: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        verify_tls13_signature(pesan, sertifikat, ttd, &self.penyedia.signature_verification_algorithms)
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        self.penyedia.signature_verification_algorithms.supported_schemes()
    }
}

/// Konfigurasi TLS klien yang HANYA mempercayai sertifikat ber-sidik `pin`.
pub fn konfigurasi_tls(pin: Vec<Sidik>) -> Result<rustls::ClientConfig, String> {
    let penyedia = Arc::new(rustls::crypto::ring::default_provider());
    let config = rustls::ClientConfig::builder_with_provider(penyedia.clone())
        .with_safe_default_protocol_versions()
        .map_err(|e| format!("TLS: {e}"))?
        .dangerous()
        .with_custom_certificate_verifier(Arc::new(PemeriksaPin { pin, penyedia }))
        .with_no_client_auth();
    Ok(config)
}

#[cfg(test)]
mod uji {
    use super::*;

    const HEX: &str = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"; // sha256("test")

    #[test]
    fn urai_sidik_menerima_hex_dengan_pemisah() {
        let a = urai_sidik(HEX).unwrap();
        assert_eq!(a, sidik_der(b"test"));
        let titik_dua: String = HEX.as_bytes().chunks(2).map(|c| std::str::from_utf8(c).unwrap().to_uppercase()).collect::<Vec<_>>().join(":");
        assert_eq!(urai_sidik(&titik_dua).unwrap(), a);
        for salah in ["", "abc", &HEX[..62], &format!("{HEX}00"), &HEX.replace('9', "g")] {
            assert!(urai_sidik(salah).is_err(), "harus ditolak: {salah:?}");
        }
    }

    #[test]
    fn daftar_dipisah_koma_dan_kosong_berarti_tanpa_pin() {
        assert!(urai_daftar("").unwrap().is_empty());
        assert!(urai_daftar("  ,  ").unwrap().is_empty());
        assert_eq!(urai_daftar(&format!("{HEX}, {HEX}")).unwrap().len(), 2);
        assert!(urai_daftar(&format!("{HEX},bukan")).is_err());
    }

    #[test]
    fn sidik_pem_sama_dengan_sidik_der() {
        let der = b"isi-der-uji-sertifikat";
        let b64 = base64::engine::general_purpose::STANDARD.encode(der);
        let pem = format!("-----BEGIN CERTIFICATE-----\r\n{}\r\n{}\r\n-----END CERTIFICATE-----\r\n", &b64[..10], &b64[10..]);
        assert_eq!(sidik_pem(&pem), Some(sidik_der(der)));
        assert_eq!(sidik_pem("-----BEGIN CERTIFICATE-----\n@@@\n-----END CERTIFICATE-----"), None);
    }

    #[test]
    fn cocok_hanya_bila_sidik_tercantum() {
        let a = sidik_der(b"a");
        let b = sidik_der(b"b");
        assert!(cocok(&a, &[b, a]));
        assert!(!cocok(&a, &[b]));
        assert!(!cocok(&a, &[]));
    }

    #[test]
    fn pemeriksa_menolak_sertifikat_lain() {
        let pin = sidik_der(b"sertifikat-server");
        let p = PemeriksaPin { pin: vec![pin], penyedia: Arc::new(rustls::crypto::ring::default_provider()) };
        let nama = ServerName::try_from("10.202.1.103").unwrap();
        let ok = CertificateDer::from(b"sertifikat-server".to_vec());
        let lain = CertificateDer::from(b"sertifikat-penyerang".to_vec());
        assert!(p.verify_server_cert(&ok, &[], &nama, &[], UnixTime::now()).is_ok());
        assert!(p.verify_server_cert(&lain, &[], &nama, &[], UnixTime::now()).is_err());
        assert!(konfigurasi_tls(vec![pin]).is_ok());
    }
}
