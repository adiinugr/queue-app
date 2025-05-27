import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Queue System - Home",
  description:
    "Modern queue management system for businesses with digital interfaces and real-time updates"
}

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Airbnb-style Header */}
      <header className="border-b border-gray-100 py-4 sticky top-0 bg-white z-10 shadow-sm">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between">
            {/* Logo - centered on mobile, left on desktop */}
            <div className="flex-1 flex md:justify-start justify-center md:order-1 order-2">
              <div className="text-2xl font-nunito font-semibold text-gray-800">
                <span className="text-rose-500">Q</span>ueue
              </div>
            </div>

            {/* Navigation - hidden on mobile */}
            <nav className="hidden md:flex justify-center flex-1 md:order-2 order-1">
              <ul className="flex space-x-8 font-inter text-sm">
                <li>
                  <Link href="/" className="text-gray-800 hover:text-rose-500">
                    Home
                  </Link>
                </li>
                <li>
                  <Link
                    href="/admin"
                    className="text-gray-800 hover:text-rose-500"
                  >
                    Admin
                  </Link>
                </li>
                <li>
                  <Link
                    href="/display"
                    className="text-gray-800 hover:text-rose-500"
                  >
                    Display
                  </Link>
                </li>
              </ul>
            </nav>

            {/* Right section - Sign up/Profile */}
            <div className="flex-1 flex justify-end md:order-3 order-3">
              <Link
                href="/admin"
                className="flex items-center space-x-2 border border-gray-200 rounded-full px-4 py-2 hover:shadow-md transition-all duration-200"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-gray-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
                <div className="h-6 w-6 bg-rose-500 rounded-full flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section - Airbnb style */}
        <section className="relative">
          {/* Background image with overlay */}
          <div className="relative h-[700px] w-full overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-black/20 z-10"></div>
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage:
                  'url("https://images.unsplash.com/photo-1639548538099-6f7f9aec3b92?q=80&w=2586&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D")'
              }}
            >
              {/* Fallback for browsers with style issues */}
              <div className="absolute inset-0 bg-gray-900/30"></div>
            </div>
            <div className="container mx-auto px-6 relative z-20 h-full flex flex-col justify-center">
              <div className="max-w-2xl">
                <h1 className="text-5xl md:text-6xl font-bold text-white font-inter mb-6 tracking-tight">
                  Queue management,
                  <span className="block"> reimagined.</span>
                </h1>
                <p className="text-xl text-white/90 font-inter font-light mb-10 max-w-lg">
                  Modern queue system for businesses with real-time updates and
                  digital interfaces.
                </p>
                <div className="flex flex-wrap gap-4">
                  <Link
                    href="/admin"
                    className="rounded-lg bg-rose-500 px-7 py-3.5 font-inter font-medium text-white hover:bg-rose-600 transition-all duration-200"
                  >
                    Mulai
                  </Link>
                  <Link
                    href="/display"
                    className="rounded-lg border border-white px-7 py-3.5 font-inter font-medium text-white hover:bg-white/10 transition-all duration-200"
                  >
                    Lihat Antrian
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Simplified Footer */}
      <footer className="bg-gray-50 border-t border-gray-100 py-6">
        <div className="container mx-auto px-6 text-center">
          <p className="text-gray-500 text-sm font-inter">
            &copy; {new Date().getFullYear()} Queue System. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
