import type { Metadata } from "next"
import "./globals.css"
import { inter, nunito, plusJakarta, oswald } from "./fonts"
import ErrorBoundary from "./components/ErrorBoundary"

export const metadata: Metadata = {
  title: {
    template: "%s | Antrian SPMB Jatim 2026",
    default: "Aplikasi Antrian SPMB Jatim Tahun 2026 SMAN 10 Surabaya"
  },
  description:
    "Sistem manajemen antrian digital untuk SPMB Jatim Tahun 2026 di SMAN 10 Surabaya",
  keywords: [
    "antrian",
    "SPMB",
    "Jatim",
    "SMAN 10 Surabaya",
    "queue system",
    "antrean digital"
  ],
  authors: [{ name: "SMAN 10 Surabaya" }],
  icons: {
    icon: "https://www.dbl.id/uploads/school/13138/810-SMAN_10_SURABAYA.png",
    apple: "https://www.dbl.id/uploads/school/13138/810-SMAN_10_SURABAYA.png"
  }
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id">
      <body
        className={`${inter.variable} ${nunito.variable} ${plusJakarta.variable} ${oswald.variable} antialiased`}
      >
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  )
}
