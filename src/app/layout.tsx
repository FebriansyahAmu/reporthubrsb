import type { Metadata } from "next";
import { Figtree, Geist_Mono } from "next/font/google";
import "./globals.css";

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
  icons: { icon: "/logo/logoboltim.png" },
};

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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
