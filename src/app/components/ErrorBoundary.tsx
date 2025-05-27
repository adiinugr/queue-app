"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

interface ErrorBoundaryProps {
  children: React.ReactNode
}

export default function ErrorBoundary({ children }: ErrorBoundaryProps) {
  const [hasError, setHasError] = useState(false)
  const [error, setError] = useState<string>("")

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error("Caught error:", event.error)
      setHasError(true)
      setError(event.error?.message || "An unexpected error occurred")
      event.preventDefault()
    }

    window.addEventListener("error", handleError)
    return () => window.removeEventListener("error", handleError)
  }, [])

  if (hasError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white p-6">
        <div className="mb-10 rounded-full bg-red-100 p-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-10 w-10 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h1 className="mb-4 text-center text-2xl font-playfair font-bold text-gray-900">
          Something went wrong
        </h1>
        <p className="mb-8 text-center font-montserrat text-gray-600">
          {error || "An unexpected error occurred. Please try again later."}
        </p>
        <div className="flex space-x-4">
          <button
            onClick={() => {
              setHasError(false)
              setError("")
              window.location.reload()
            }}
            className="rounded-lg bg-teal-600 px-6 py-3 font-montserrat text-white transition-colors hover:bg-teal-700"
          >
            Refresh Page
          </button>
          <Link
            href="/"
            className="rounded-lg border border-gray-300 bg-white px-6 py-3 font-montserrat text-gray-700 transition-colors hover:bg-gray-50"
          >
            Go Home
          </Link>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
