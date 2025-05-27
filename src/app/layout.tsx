import type { Metadata } from "next"
import "./globals.css"
import { inter, nunito } from "./fonts"
import ErrorBoundary from "./components/ErrorBoundary"

export const metadata: Metadata = {
  title: {
    template: "%s | Queue System",
    default: "Queue System - Modern Queue Management"
  },
  description:
    "Effective queue management system with digital interfaces, real-time updates, and voice announcements",
  keywords: [
    "queue system",
    "queue management",
    "digital queue",
    "antrean digital",
    "loket management"
  ],
  authors: [{ name: "Queue System Team" }],
  creator: "Queue System",
  publisher: "Queue System"
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${nunito.variable} antialiased`}>
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  )
}
