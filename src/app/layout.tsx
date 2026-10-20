import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";

// Font di-host sendiri (`app/fonts/`, OFL) — bukan `next/font/google`: Google
// kadang membalas URL `fonts.gstatic.com/l/font?kit=…&skey=…` yang membuat
// Turbopack gagal ("next/font/google queries have exactly one entry"), dan build
// produksi pun tak lagi bergantung pada internet. Berkas = subset latin variabel
// yang sama persis dengan sajian Google Fonts.

// Figtree — keluarga tunggal (bahasa "Cord"): 400 body → 800 display.
// Judul terasa "distempel" berkat bobot berat; tracking negatif di ukuran besar.
const figtree = localFont({
  src: "./fonts/figtree-latin-wght.woff2",
  variable: "--font-figtree",
  weight: "300 900",
});

const geistMono = localFont({
  src: "./fonts/geist-mono-latin-wght.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "AuditTrail RS BOLTIM",
  description:
    "Pelaporan & cetak untuk melengkapi cetakan yang tidak disediakan SIMGOS.",
  icons: { icon: "/logo/logoboltim.png", apple: "/icons/apple-touch-icon.png" },
  // Manifest PWA dari `app/manifest.ts` (ditautkan otomatis oleh Next).
  appleWebApp: { capable: true, title: "AuditTrail", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#0b3658" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${figtree.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
