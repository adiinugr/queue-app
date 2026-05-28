"use client"

import Link from "next/link"
import Image from "next/image"

export default function HomePage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: "linear-gradient(160deg, #0A1628 0%, #0D1F35 100%)" }}
    >
      {/* Background glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 30% 30%, rgba(26,86,219,0.1) 0%, transparent 60%), radial-gradient(circle at 70% 70%, rgba(13,148,136,0.07) 0%, transparent 60%)"
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-8 px-6">
        {/* Logos */}
        <div className="flex items-center gap-3">
          <div
            className="relative w-14 h-14 rounded-xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <Image
              src="https://www.dbl.id/uploads/school/13138/810-SMAN_10_SURABAYA.png"
              alt="SMAN 10 Surabaya"
              fill
              sizes="56px"
              className="object-contain p-1.5"
            />
          </div>
          <div
            className="relative w-14 h-14 rounded-xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <Image
              src="https://spmbjatim.net/images/logo.png"
              alt="SPMB Jatim"
              fill
              sizes="56px"
              className="object-contain p-1.5"
            />
          </div>
        </div>

        {/* Title */}
        <div className="text-center">
          <h1
            className="text-2xl font-bold text-white mb-1"
            style={{ fontFamily: "var(--font-jakarta)" }}
          >
            Aplikasi Antrian SPMB Jatim 2026
          </h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)", fontFamily: "var(--font-jakarta)" }}>
            SMAN 10 Surabaya
          </p>
        </div>

        {/* Navigation cards */}
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
          <Link
            href="/display"
            className="flex-1 flex flex-col items-center gap-3 px-6 py-7 rounded-2xl transition-all duration-200 hover:scale-[1.03] hover:shadow-2xl"
            style={{
              background: "rgba(26,86,219,0.15)",
              border: "1px solid rgba(59,130,246,0.35)"
            }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(26,86,219,0.3)" }}
            >
              <svg className="w-6 h-6" style={{ color: "#93C5FD" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-white" style={{ fontFamily: "var(--font-jakarta)" }}>
                Display
              </p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-jakarta)" }}>
                Layar antrian publik
              </p>
            </div>
          </Link>

          <Link
            href="/admin"
            className="flex-1 flex flex-col items-center gap-3 px-6 py-7 rounded-2xl transition-all duration-200 hover:scale-[1.03] hover:shadow-2xl"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.12)"
            }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.1)" }}
            >
              <svg className="w-6 h-6" style={{ color: "rgba(255,255,255,0.7)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-white" style={{ fontFamily: "var(--font-jakarta)" }}>
                Admin
              </p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-jakarta)" }}>
                Panel pengelolaan
              </p>
            </div>
          </Link>
        </div>

        <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "var(--font-jakarta)" }} suppressHydrationWarning>
          &copy; {new Date().getFullYear()} Aplikasi Antrian SPMB Jatim 2026 &middot; SMAN 10 Surabaya
        </p>
      </div>
    </div>
  )
}
