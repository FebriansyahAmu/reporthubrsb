fn main() {
    // Alamat bawaan server ikut ditanam ke biner; build ulang bila berubah.
    println!("cargo:rerun-if-env-changed=REPORTHUB_URL");
    tauri_build::build()
}
