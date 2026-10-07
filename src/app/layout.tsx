import type { Metadata, Viewport } from "next";
import { Figtree, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";

// Figtree — keluarga tunggal (bahasa "Cord"): 400 body → 800 display.
// Judul terasa "distempel" berkat bobot berat; tracking negatif di ukuran besar.
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
