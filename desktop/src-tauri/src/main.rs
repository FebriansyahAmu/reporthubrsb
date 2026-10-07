// Build rilis: tanpa jendela konsol di Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    audittrail_desktop_lib::run()
}
