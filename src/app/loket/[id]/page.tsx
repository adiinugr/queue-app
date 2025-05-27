"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import LoadingSpinner from "../../components/LoadingSpinner"
import toast, { Toaster } from "react-hot-toast"
import {
  useQueueUpdates,
  QueueUpdateData,
  useCounterUpdates,
  useSocketConnection
} from "../../../lib/socket-client"

// Tipe data untuk antrean
interface Queue {
  id: string
  number: number
  status: "WAITING" | "CALLED" | "SERVING" | "COMPLETED" | "SKIPPED"
}

// Tipe data untuk loket
interface Counter {
  id: string
  name: string
  number: number
  isActive: boolean
  currentQueue: Queue | null
}

// Type for counter update data
interface CounterUpdateData {
  type: string
  counter?: {
    id: string
    name: string
    number: number
    isActive: boolean
    currentQueue: Queue | null
  }
  counterId?: string
  timestamp?: number
}

export default function CounterPage() {
  const params = useParams()
  const router = useRouter()
  const counterId = params.id as string

  const [counter, setCounter] = useState<Counter | null>(null)
  const [waitingQueues, setWaitingQueues] = useState<Queue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Separate loading states for different actions
  const [nextQueueLoading, setNextQueueLoading] = useState(false)
  const [completeQueueLoading, setCompleteQueueLoading] = useState(false)
  const [recallQueueLoading, setRecallQueueLoading] = useState(false)

  const [justCalledQueueId, setJustCalledQueueId] = useState<string | null>(
    null
  )

  const [completedQueueId, setCompletedQueueId] = useState<string | null>(null)

  const [speechEnabled, setSpeechEnabled] = useState(true)
  const synthRef = useRef<SpeechSynthesis | null>(null)

  // Fungsi untuk mengambil data loket
  const fetchCounter = useCallback(async () => {
    try {
      const response = await fetch(`/api/counters`)
      if (response.ok) {
        const data = await response.json()
        const foundCounter = data.find((c: Counter) => c.id === counterId)

        if (foundCounter) {
          // Prevent completed queue from reappearing
          if (
            completedQueueId &&
            foundCounter.currentQueue &&
            foundCounter.currentQueue.id === completedQueueId
          ) {
            foundCounter.currentQueue = null
          }
          setCounter(foundCounter)
        } else {
          // Loket tidak ditemukan, kembali ke halaman utama
          router.push("/")
        }
      }
    } catch (err) {
      console.error("Error fetching counter:", err)
      setError("Gagal memuat data loket")
    }
  }, [counterId, completedQueueId, router])

  // Fungsi untuk mengambil data antrean
  const fetchQueues = useCallback(async () => {
    try {
      const response = await fetch("/api/queues")
      if (response.ok) {
        const data = await response.json()
        setWaitingQueues(data.filter((q: Queue) => q.status === "WAITING"))
      }
    } catch (err) {
      console.error("Error fetching queues:", err)
      setError("Gagal memuat data antrean")
    } finally {
      setLoading(false)
    }
  }, [])

  // Memanggil nomor antrean berikutnya
  const callNextQueue = async () => {
    if (nextQueueLoading) return
    setNextQueueLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/counters/${counterId}/next`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Gagal memanggil antrean")
      // Optimistic: update current queue and highlight
      setCounter((prev) => (prev ? { ...prev, currentQueue: data } : prev))
      setJustCalledQueueId(data.id)

      // Announce the queue number
      if (counter) {
        const announcement = `Nomor antrian ${data.number}, silakan ke meja ${counter.number}`
        speak(announcement)
      }

      toast.success(`Nomor antrean ${data.number} berhasil dipanggil!`)
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Gagal memanggil antrean"
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setNextQueueLoading(false)
    }
  }

  // Menyelesaikan antrean saat ini
  const completeCurrentQueue = async () => {
    if (completeQueueLoading) return

    if (!counter?.currentQueue) {
      setError("Loket tidak sedang melayani antrean")
      toast.error("Loket tidak sedang melayani antrean")
      return
    }

    // Capture current queue before operation
    const currentQueueNumber = counter.currentQueue.number
    const currentQueueId = counter.currentQueue.id

    console.log("🔄 Starting queue completion process for:", currentQueueNumber)

    // Track this queue as completed to prevent it from reappearing
    setCompletedQueueId(currentQueueId)

    setCompleteQueueLoading(true)
    setError(null)

    // Optimistic update - show queue as completed immediately
    setCounter((prevCounter) => {
      if (!prevCounter) return prevCounter
      return {
        ...prevCounter,
        currentQueue: null
      }
    })

    try {
      console.log(
        `📤 Sending completion request for queue: ${currentQueueNumber}`
      )
      const response = await fetch(`/api/counters/${counterId}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Gagal menyelesaikan antrean")
      }

      console.log(
        `✅ Queue ${currentQueueNumber} completed successfully, response:`,
        data
      )
      toast.success(`Antrean nomor ${currentQueueNumber} berhasil diselesaikan`)
    } catch (err: unknown) {
      console.error("Error completing queue:", err)
      const errorMessage =
        err instanceof Error ? err.message : "Gagal menyelesaikan antrean"
      setError(errorMessage)
      toast.error(errorMessage)

      // Revert optimistic update on error by fetching current state
      await fetchCounter()
      // Clear completed queue ID on error
      setCompletedQueueId(null)
    } finally {
      setCompleteQueueLoading(false)
    }
  }

  // Memanggil ulang antrean saat ini
  const recallCurrentQueue = async () => {
    if (recallQueueLoading) return

    if (!counter?.currentQueue) {
      setError("Tidak ada antrean yang sedang dipanggil untuk dipanggil ulang")
      return
    }

    setRecallQueueLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/counters/${counterId}/recall`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          queueNumber: counter.currentQueue.number,
          counterNumber: counter.number
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Gagal memanggil ulang antrean")
      }

      // Announce the recall
      const announcement = `Panggilan ulang untuk nomor antrian ${counter.currentQueue.number}, silakan ke meja ${counter.number}`
      speak(announcement)

      // Tidak perlu refresh data karena status antrean tidak berubah
    } catch (err: unknown) {
      console.error("Error recalling queue:", err)
      setError(
        err instanceof Error ? err.message : "Gagal memanggil ulang antrean"
      )
    } finally {
      setRecallQueueLoading(false)
    }
  }

  // Handle queue updates via Socket.io
  const handleQueueUpdate = useCallback(
    (data: QueueUpdateData) => {
      console.log("Queue update received:", data)

      if (
        data.type === "QUEUE_CALLED" &&
        data.counter &&
        data.counter.id === counterId
      ) {
        // If this counter called a queue, highlight it
        setJustCalledQueueId(data.queue.id)

        // Update local state without refetching
        setCounter((prev) =>
          prev
            ? {
                ...prev,
                currentQueue: {
                  id: data.queue.id,
                  number: data.queue.number,
                  status: data.queue.status
                } as Queue
              }
            : prev
        )

        // Remove from waiting queues
        setWaitingQueues((prev) => prev.filter((q) => q.id !== data.queue.id))
      } else if (
        data.type === "QUEUE_COMPLETED" &&
        data.counter &&
        data.counter.id === counterId
      ) {
        // If this counter completed a queue, update state
        setCounter((prev) =>
          prev
            ? {
                ...prev,
                currentQueue: null
              }
            : prev
        )
      } else if (data.type === "QUEUE_CREATED") {
        // A new queue was created, refresh waiting queues
        console.log("New queue created, refreshing waiting queues")
        fetchQueues()
      } else {
        // For queue updates not specific to this counter, update waiting queues
        fetchQueues()
      }
    },
    [counterId, fetchQueues]
  )

  // Handle counter updates specifically for this counter
  const handleCounterUpdate = useCallback(
    (data: CounterUpdateData) => {
      console.log("Counter update received:", data)

      if (data.counter && data.counter.id === counterId) {
        // Update for this specific counter
        console.log("Counter update for this loket:", data)
        fetchCounter()
      }
      // We don't need to update other counters in this view
    },
    [counterId, fetchCounter]
  )

  // Use socket.io for real-time updates
  const queueSocketConnected = useQueueUpdates(handleQueueUpdate)
  const counterSocketConnected = useCounterUpdates(handleCounterUpdate)
  const globalSocketConnected = useSocketConnection()

  // Combined connection status
  const socketConnected =
    queueSocketConnected || counterSocketConnected || globalSocketConnected

  // Fetch initial data and set up real-time updates
  useEffect(() => {
    fetchCounter()
    fetchQueues()

    // Fallback polling if socket disconnects
    const pollingInterval = setInterval(() => {
      if (!socketConnected) {
        console.log("Socket disconnected, using polling fallback")
        fetchCounter()
        fetchQueues()
      }
    }, 10000)

    return () => {
      clearInterval(pollingInterval)
    }
  }, [socketConnected, fetchCounter, fetchQueues])

  // Initialize speech synthesis
  useEffect(() => {
    if (typeof window !== "undefined") {
      synthRef.current = window.speechSynthesis

      // Force load voices
      if (synthRef.current) {
        // Hack to make sure voices are loaded in Safari/Chrome
        speechSynthesis.onvoiceschanged = () => {
          const voices = synthRef.current?.getVoices() || []
          console.log("Voices loaded:", voices.length, "voices available")
        }

        // Try to trigger voices load
        synthRef.current.getVoices()
      }

      // Load speech preference from localStorage
      const savedSpeechEnabled = localStorage.getItem("loketSpeechEnabled")
      if (savedSpeechEnabled === "false") {
        setSpeechEnabled(false)
      }

      return () => {
        if (synthRef.current) {
          synthRef.current.cancel()
        }
      }
    }
  }, [])

  // Function to speak text
  const speak = (text: string) => {
    try {
      // Check if speech is enabled
      if (!speechEnabled) {
        console.log("⚠️ Speech not enabled. Skipping announcement.")
        return
      }

      if (!synthRef.current) {
        console.error("❌ Speech synthesis not available")
        toast.error("Pengumuman suara tidak tersedia")
        return
      }

      // Check if browser supports speech synthesis
      if (typeof SpeechSynthesisUtterance === "undefined") {
        console.error(
          "❌ SpeechSynthesisUtterance not supported in this browser"
        )
        toast.error("Browser Anda tidak mendukung pengumuman suara")
        return
      }

      // Check available voices
      const voices = synthRef.current.getVoices()
      console.log(`🔊 Available voices: ${voices.length}`)

      // Cancel previous speech if any
      try {
        synthRef.current.cancel()
      } catch {}

      // Create new utterance
      const utterance = new SpeechSynthesisUtterance(text)

      // Use en-US as default, as it's widely supported
      utterance.lang = "en-US"
      utterance.rate = 0.9
      utterance.volume = 1.0

      // Try to find appropriate voice
      if (voices.length > 0) {
        // Get default voice
        const defaultVoice = voices.find((voice) => voice.default) || voices[0]
        utterance.voice = defaultVoice

        // Try to find a matching voice (but still use default if unsuccessful)
        const indonesianVoice = voices.find((voice) => voice.lang === "id-ID")
        if (indonesianVoice) {
          utterance.voice = indonesianVoice
          utterance.lang = "id-ID"
        } else {
          // Try to find a female voice
          const femaleVoice = voices.find((voice) =>
            voice.name.toLowerCase().includes("female")
          )
          if (femaleVoice) {
            utterance.voice = femaleVoice
          }
        }
      }

      // Debug
      console.log(
        `🔊 Will speak using voice: ${
          utterance.voice?.name || "default browser voice"
        }`
      )

      // Add event handlers for debugging
      utterance.onstart = () => {
        try {
          console.log("🔊 Speech started")
        } catch {}
      }

      utterance.onend = () => {
        try {
          console.log("🔊 Speech ended")
        } catch {}
      }

      utterance.onerror = (event) => {
        try {
          console.error("❌ Speech error:", event || "Empty error object")
          // Only show toast for certain errors
          if (event && event.error && event.error !== "canceled") {
            toast.error(`Gagal mengucapkan pengumuman: ${event.error}`)
          }
        } catch {}
      }

      // Speak the text with error handling
      try {
        // Safari fix: cancel any ongoing speech first
        if (synthRef.current) {
          synthRef.current.cancel()

          // Small delay to ensure cancel completes
          setTimeout(() => {
            try {
              synthRef.current?.speak(utterance)
            } catch (e) {
              console.error("Error during speech synthesis:", e)
              toast.error("Terjadi kesalahan saat pengumuman")
            }
          }, 100)
        }
      } catch (e) {
        console.error("Error during speech synthesis:", e)
        toast.error("Terjadi kesalahan saat pengumuman")
      }
    } catch (error) {
      // Catch any other errors
      console.error("❌ Global error in speak function:", error)
      toast.error("Terjadi kesalahan dalam sistem pengumuman suara")
    }
  }

  if (loading) {
    return <LoadingSpinner fullScreen message="Memuat data loket..." />
  }

  if (!counter) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white p-6">
        <div className="mb-10 rounded-full bg-rose-100 p-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-10 w-10 text-rose-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
        <h1 className="mb-4 text-2xl font-inter font-bold text-gray-900">
          Loket tidak ditemukan
        </h1>
        <p className="mb-8 text-center font-inter text-gray-600">
          Loket yang Anda cari tidak tersedia atau telah dihapus
        </p>
        <Link
          href="/"
          className="rounded-lg bg-rose-600 px-6 py-3 font-inter text-white transition-colors hover:bg-rose-700"
        >
          Kembali ke Beranda
        </Link>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Toaster position="top-right" />

      {/* Airbnb-style Header */}
      <header className="border-b border-gray-100 py-4 sticky top-0 bg-white z-10 shadow-sm">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between">
            {/* Logo - centered on mobile, left on desktop */}
            <div className="flex-1 flex md:justify-start justify-center md:order-1 order-2">
              <div className="text-2xl font-nunito font-semibold text-gray-800">
                <span className="text-rose-500">Q</span>ueue
                <span className="text-rose-500 ml-1">Loket</span>
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
              <div className="flex items-center space-x-2 border border-gray-200 rounded-full px-4 py-2 hover:shadow-md transition-all duration-200">
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
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 bg-gray-50 py-12">
        <div className="container mx-auto px-6">
          <div className="mb-8">
            <div className="mb-3 inline-block rounded bg-rose-50 px-3 py-1 text-sm font-inter font-medium text-rose-600 tracking-wide">
              PANEL OPERATOR
            </div>
            <h1 className="font-inter text-3xl font-bold text-gray-900">
              Loket <span className="text-rose-600">{counter.number}</span>:{" "}
              {counter.name}
            </h1>
            <div className="mt-2">
              <button
                onClick={() => {
                  setSpeechEnabled(!speechEnabled)
                  localStorage.setItem(
                    "loketSpeechEnabled",
                    (!speechEnabled).toString()
                  )
                  toast.success(
                    speechEnabled ? "Suara dinonaktifkan" : "Suara diaktifkan"
                  )
                }}
                className={`inline-flex items-center rounded-md px-3 py-1.5 text-sm font-inter ${
                  speechEnabled
                    ? "bg-rose-100 text-rose-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-4 w-4 mr-1 ${
                    speechEnabled ? "text-rose-600" : "text-gray-600"
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {speechEnabled ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                    />
                  )}
                </svg>
                {speechEnabled ? "Suara Aktif" : "Suara Nonaktif"}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-6 rounded-xl bg-red-50 p-4 text-red-800 border border-red-200 font-inter">
              <div className="flex">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2 text-red-500"
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
                <p>{error}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Current Queue */}
            <div className="lg:col-span-6">
              <div className="rounded-xl bg-white p-8 shadow-sm border border-gray-200 transition-all hover:shadow-md h-full">
                <h2 className="mb-6 font-inter text-2xl font-bold text-gray-900 flex items-center">
                  <div className="mr-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-rose-100">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6 text-rose-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </div>
                  Antrean Saat Ini
                </h2>

                <div className="font-inter">
                  {counter.currentQueue &&
                  completedQueueId !== counter.currentQueue.id ? (
                    <div className="text-center">
                      <div
                        className={`mb-4 p-6 rounded-2xl border ${
                          justCalledQueueId === counter.currentQueue?.id
                            ? "bg-yellow-100 border-yellow-300 animate-pulse"
                            : "bg-rose-50 border-rose-100"
                        }`}
                      >
                        <p className="text-gray-600 mb-2">Nomor Antrean</p>
                        <div className="text-8xl font-bold text-rose-600 mb-2">
                          {counter.currentQueue.number}
                        </div>
                        <div
                          className={`inline-flex items-center rounded px-3 py-1 text-xs font-medium 
                          ${
                            counter.currentQueue.status === "CALLED"
                              ? "bg-yellow-100 text-yellow-800"
                              : ""
                          }
                          ${
                            counter.currentQueue.status === "SERVING"
                              ? "bg-rose-100 text-rose-800"
                              : ""
                          }
                          ${
                            counter.currentQueue.status === "COMPLETED"
                              ? "bg-green-100 text-green-800"
                              : ""
                          }
                          ${
                            counter.currentQueue.status === "SKIPPED"
                              ? "bg-red-100 text-red-800"
                              : ""
                          }
                        `}
                        >
                          {counter.currentQueue.status === "CALLED" &&
                            "Dipanggil"}
                          {counter.currentQueue.status === "SERVING" &&
                            "Sedang Dilayani"}
                          {counter.currentQueue.status === "COMPLETED" &&
                            "Selesai"}
                          {counter.currentQueue.status === "SKIPPED" &&
                            "Lewat/Batal"}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <button
                          onClick={recallCurrentQueue}
                          className="rounded-lg bg-yellow-500 px-4 py-3 font-medium text-white shadow-sm hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 flex items-center justify-center"
                          disabled={recallQueueLoading}
                        >
                          {recallQueueLoading ? (
                            <span className="flex items-center justify-center">
                              <svg
                                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                ></circle>
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                              </svg>
                              Memproses...
                            </span>
                          ) : (
                            <>
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5 mr-2"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
                                />
                              </svg>
                              Panggil Kembali
                            </>
                          )}
                        </button>
                        <button
                          onClick={completeCurrentQueue}
                          className="rounded-lg bg-rose-600 px-4 py-3 font-medium text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-600 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50"
                          disabled={completeQueueLoading}
                        >
                          {completeQueueLoading ? (
                            <span className="flex items-center justify-center">
                              <svg
                                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                ></circle>
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                              </svg>
                              Memproses...
                            </span>
                          ) : (
                            "Selesaikan Antrean"
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center p-8">
                      <div className="mx-auto mb-4 h-16 w-16 text-gray-400">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <p className="text-gray-500">Belum ada antrean aktif</p>
                      <div className="mt-6">
                        <button
                          onClick={callNextQueue}
                          className="rounded-lg bg-rose-600 px-5 py-3 font-medium text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-600 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50"
                          disabled={nextQueueLoading || !waitingQueues.length}
                        >
                          {nextQueueLoading ? (
                            <span className="flex items-center justify-center">
                              <svg
                                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                ></circle>
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                              </svg>
                              Memproses...
                            </span>
                          ) : (
                            "Panggil Antrean Berikutnya"
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Waiting Queues */}
            <div className="lg:col-span-6">
              <div className="rounded-xl bg-white p-8 shadow-sm border border-gray-200 transition-all hover:shadow-md h-full">
                <h2 className="mb-6 font-inter text-2xl font-bold text-gray-900 flex items-center">
                  <div className="mr-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-rose-100">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6 text-rose-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                  </div>
                  Daftar Antrean Menunggu
                </h2>

                <div className="font-inter">
                  {waitingQueues.length > 0 ? (
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                      {waitingQueues.map((queue) => (
                        <div
                          key={queue.id}
                          className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-all duration-200"
                        >
                          <div className="flex items-start space-x-4">
                            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 font-semibold">
                              {queue.number}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 text-base">
                                Antrean #{queue.number}
                              </p>
                              <p className="text-sm text-gray-500 mt-1">
                                Status:{" "}
                                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                  Menunggu
                                </span>
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-xl p-8 text-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-12 w-12 text-gray-400 mx-auto mb-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1}
                          d="M5 10l7-7m0 0l7 7m-7-7v18"
                        />
                      </svg>
                      <p className="text-gray-500 font-inter">
                        Tidak ada antrean yang menunggu
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        Semua nomor antrean sudah dilayani
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

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
