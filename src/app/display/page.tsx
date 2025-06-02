"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import Image from "next/image"
import LoadingSpinner from "../components/LoadingSpinner"
import toast, { Toaster } from "react-hot-toast"
import {
  useQueueUpdates,
  useRecallEvents,
  QueueUpdateData,
  RecallEventData,
  useSocketConnection
} from "../../lib/socket-client"
import { Expand, Shrink, Volume2, VolumeX } from "lucide-react"

// Helper function to convert YouTube URL to embed format
const getYouTubeEmbedUrl = (url: string): string => {
  if (!url) return ""
  let videoId = ""

  try {
    const urlObj = new URL(url)
    if (urlObj.hostname === "youtu.be") {
      videoId = urlObj.pathname.slice(1)
    } else if (
      urlObj.hostname === "www.youtube.com" ||
      urlObj.hostname === "youtube.com"
    ) {
      if (urlObj.pathname === "/watch") {
        videoId = urlObj.searchParams.get("v") || ""
      } else if (urlObj.pathname.startsWith("/embed/")) {
        videoId = urlObj.pathname.split("/embed/")[1]
      } else if (urlObj.pathname.startsWith("/v/")) {
        videoId = urlObj.pathname.split("/v/")[1]
      }
    }
  } catch (error) {
    console.error("Error parsing YouTube URL:", error)
    // Fallback for non-URL strings that might just be an ID
    if (!url.includes("/") && !url.includes(".")) {
      videoId = url
    }
  }

  if (!videoId) {
    console.warn("Could not extract YouTube video ID from URL:", url)
    // Fallback to a default video or return empty string to avoid breaking iframe
    return "https://www.youtube.com/embed/jAQvxW2l-Pg" // Default or error video
  }
  return `https://www.youtube.com/embed/${videoId}`
}

// Tipe data untuk antrean
interface Queue {
  id: string
  number: number
  status: "WAITING" | "CALLED" | "SERVING" | "COMPLETED" | "SKIPPED"
  counterServingId: string | null
  servedBy: Counter | null
  updatedAt?: number
}

// Tipe data untuk meja
interface Counter {
  id: string
  name: string
  number: number
  isActive: boolean
}

export default function DisplayPage() {
  const [queues, setQueues] = useState<Queue[]>([])
  const [counters, setCounters] = useState<Counter[]>([])
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())

  const countersRef = useRef<Counter[]>(counters) // Ref for counters

  const [speechEnabled, setSpeechEnabled] = useState(false)
  const [announcementToMake, setAnnouncementToMake] = useState<string | null>(
    null
  )
  const [videoUrl, setVideoUrl] = useState<string>(() =>
    getYouTubeEmbedUrl("https://www.youtube.com/embed/jAQvxW2l-Pg")
  ) // Default video, processed
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Use useRef instead of useState for tracking previous queues

  const synthRef = useRef<SpeechSynthesis | null>(null)

  // Track announced queue IDs to prevent double speak
  const announcedQueueIdsRef = useRef<Set<string>>(new Set())

  // Track already processed queues to prevent double-processing
  const processedQueueUpdatesRef = useRef<Set<string>>(new Set())

  // Memoize iframe source and title calculation
  const memoizedVideoData = useMemo(() => {
    console.log(
      "[DisplayPage:useMemo] Recalculating video data for videoUrl:",
      videoUrl
    )
    const currentEmbedUrl = getYouTubeEmbedUrl(videoUrl)
    console.log(
      "[DisplayPage:useMemo] Processed currentEmbedUrl:",
      currentEmbedUrl
    )

    let playlistId = ""
    if (currentEmbedUrl && currentEmbedUrl.includes("/embed/")) {
      playlistId = currentEmbedUrl.split("/embed/")[1]?.split("?")[0] || ""
    }
    console.log("[DisplayPage:useMemo] Extracted playlistId:", playlistId)

    let iframeSrc = ""
    let iframeTitle = "Information Video (Default)"

    if (!currentEmbedUrl || !playlistId) {
      console.log(
        "[DisplayPage:useMemo] Fallback condition met. currentEmbedUrl:",
        currentEmbedUrl,
        "playlistId:",
        playlistId
      )
      const defaultVideoId = "jAQvxW2l-Pg" // Default video ID
      iframeSrc = `https://www.youtube.com/embed/${defaultVideoId}?autoplay=1&mute=1&loop=1&playlist=${defaultVideoId}`
    } else {
      console.log(
        "[DisplayPage:useMemo] Using processed URL. currentEmbedUrl:",
        currentEmbedUrl,
        "playlistId:",
        playlistId
      )
      iframeSrc = `${currentEmbedUrl}${
        currentEmbedUrl.includes("?") ? "&" : "?"
      }autoplay=1&mute=1&loop=1&playlist=${playlistId}`
      iframeTitle = "Information Video"
    }

    console.log(
      "[DisplayPage:useMemo] Final iframeSrc to be rendered:",
      iframeSrc
    )
    return { iframeSrc, iframeTitle }
  }, [videoUrl]) // Dependency: only re-calculate when videoUrl changes

  // Generate a unique key for a queue update to track duplicates
  const getQueueUpdateKey = (
    type: string,
    queueId: string,
    timestamp: number = Date.now()
  ) => {
    return `${type}-${queueId}-${Math.floor(timestamp / 1000)}`
  }

  // Fungsi untuk mengucapkan teks - wrapped in useCallback
  const speak = useCallback(
    (text: string) => {
      let currentSpeechEnabled = speechEnabled
      // If internal state says false, check localStorage as a fallback
      // This helps if speak() is called before the state re-render fully propagates
      if (!currentSpeechEnabled) {
        const storedState = localStorage.getItem("speechEnabled")
        if (storedState === "true") {
          console.log(
            "🎤 [DisplayPage] speak(): Overriding speechEnabled from localStorage"
          )
          currentSpeechEnabled = true
        }
      }

      console.log(
        "🎤 [DisplayPage] speak() called with text:",
        text,
        "Effective Speech enabled:", // Changed log to reflect effective state
        currentSpeechEnabled
      )
      try {
        // Check if speech is enabled by user first
        if (!currentSpeechEnabled) {
          // Use currentSpeechEnabled here
          console.log(
            "⚠️ Speech not enabled by user yet. Skipping announcement."
          )
          toast.error("Aktifkan suara dengan klik tombol 'Aktifkan Suara'")
          return
        }

        // Safety check for browser environment
        if (typeof window === "undefined") {
          console.error("❌ Not in browser environment")
          return
        }

        // Check if speech synthesis is available
        if (!window.speechSynthesis) {
          console.error("❌ Speech synthesis not supported in this browser")
          toast.error("Browser Anda tidak mendukung pengumuman suara")
          return
        }

        if (!synthRef.current) {
          synthRef.current = window.speechSynthesis
        }

        // Cek apakah browser mendukung speech synthesis
        if (typeof SpeechSynthesisUtterance === "undefined") {
          console.error(
            "❌ SpeechSynthesisUtterance not supported in this browser"
          )
          toast.error("Browser Anda tidak mendukung pengumuman suara")
          return
        }

        // Hentikan pengucapan sebelumnya jika ada
        try {
          window.speechSynthesis.cancel()
        } catch (e) {
          console.error("Error canceling previous speech:", e)
        }

        // Buat utterance baru
        const utterance = new SpeechSynthesisUtterance(text)

        // Gunakan en-US sebagai default, karena lebih banyak didukung browser
        utterance.lang = "en-US"
        utterance.rate = 0.9
        utterance.volume = 1.0

        // Get available voices safely
        let voices: SpeechSynthesisVoice[] = []
        if (typeof window !== "undefined" && window.speechSynthesis) {
          console.log("🎤 [DisplayPage] speak(): Attempting to get voices...")
          voices = window.speechSynthesis.getVoices()
          console.log(
            `🔊 [DisplayPage] speak(): Initial voices.length: ${voices.length}`
          )

          if (voices.length === 0) {
            console.warn(
              "⚠️ [DisplayPage] speak(): No voices loaded on first call to getVoices(). This might result in default (English) voice if id-ID is not found among zero voices."
            )
            // Some browsers load voices asynchronously. A robust solution uses 'onvoiceschanged' event.
            // For this attempt, we'll log and proceed, relying on subsequent calls to have voices.
          }
        } else {
          console.error(
            "❌ [DisplayPage] speak(): Speech synthesis not available for getting voices."
          )
        }

        console.log(
          `🎤 [DisplayPage] speak(): Total voices found for selection: ${voices.length}`
        )

        // Gunakan suara default browser jika tidak ada yang cocok
        // Coba berbagai suara jika tersedia
        if (voices.length > 0) {
          // Ambil voice default
          const defaultVoice =
            voices.find((voice) => voice.default) || voices[0]
          utterance.voice = defaultVoice // Start with default

          console.log(
            `🎤 [DisplayPage] speak(): Default voice set to: ${defaultVoice?.name} (lang: ${defaultVoice?.lang})`
          )

          // Coba cari suara yang cocok (tapi tetap gunakan default jika gagal)
          const indonesianVoice = voices.find((voice) => voice.lang === "id-ID")
          if (indonesianVoice) {
            utterance.voice = indonesianVoice
            utterance.lang = "id-ID"
            console.log(
              "👍 [DisplayPage] speak(): Indonesian voice selected:",
              indonesianVoice.name
            )
          } else {
            console.warn(
              "⚠️ [DisplayPage] speak(): Indonesian (id-ID) voice not found. Current lang is 'en-US'. Trying female voice."
            )
            // Coba cari voice female
            const femaleVoice = voices.find((voice) =>
              voice.name.toLowerCase().includes("female")
            )
            if (femaleVoice) {
              utterance.voice = femaleVoice
              console.log(
                "👍 [DisplayPage] speak(): Female voice selected as fallback:",
                femaleVoice.name
              )
            } else {
              console.warn(
                "⚠️ [DisplayPage] speak(): Female voice not found. Using previously set default voice:",
                utterance.voice?.name
              )
            }
          }
        } else {
          console.warn(
            "⚠️ [DisplayPage] speak(): No voices available in the list. Utterance will use browser's default mechanism for lang 'en-US'."
          )
        }

        // Debug
        console.log(
          `🔊 Will speak using voice: ${
            utterance.voice?.name || "default browser voice"
          }`
        )

        // Add event handlers for debugging - and prevent them from throwing errors
        utterance.onstart = () => {
          try {
            console.log("🔊 Speech started")
          } catch (e) {
            console.error("Error in onstart handler:", e)
          }
        }

        utterance.onend = () => {
          try {
            console.log("🔊 Speech ended")
          } catch (e) {
            console.error("Error in onend handler:", e)
          }
        }

        utterance.onerror = (event) => {
          try {
            // Safely log error object
            console.error(
              "❌ Speech error:",
              event
                ? JSON.stringify(event, Object.getOwnPropertyNames(event))
                : "Empty error object"
            )

            // Check for common speech errors and provide more specific messages
            let errorMessage = "Gagal mengucapkan pengumuman"

            // Some browsers return empty error objects
            if (event && event.error) {
              // Add specific error handling based on error type if present
              switch (event.error) {
                case "not-allowed":
                  errorMessage =
                    "Browser tidak mengizinkan penggunaan suara, periksa izin"
                  break
                case "canceled":
                  // This is often not an actual error, so we may want to skip the toast
                  return
                case "audio-busy":
                  errorMessage = "Sistem audio sedang digunakan"
                  break
                default:
                  errorMessage = `Error: ${event.error}`
              }
            }

            toast.error(errorMessage)
          } catch (e) {
            console.error("Error in onerror handler:", e)
          }
        }

        // Speak the text
        try {
          console.log(`🔊 Speaking: "${text}"`)
          window.speechSynthesis.speak(utterance)
        } catch (e) {
          console.error("❌ Failed to speak:", e)
          toast.error("Gagal mengucapkan pengumuman")
        }
      } catch (e) {
        console.error("❌ Unexpected error in speak function:", e)
        toast.error("Terjadi error saat mengucapkan pengumuman")
      }
    },
    [speechEnabled]
  )

  // Add the useEffect for deferred announcement
  useEffect(() => {
    if (announcementToMake && speechEnabled) {
      speak(announcementToMake)
      setAnnouncementToMake(null) // Clear after speaking
    }
  }, [announcementToMake, speechEnabled, speak]) // Dependencies for the effect

  // Menangani pembaruan antrean dari server
  const handleQueueUpdate = useCallback(
    (data: QueueUpdateData) => {
      // console.log(
      //   "📡 [DisplayPage] Received raw queue update event from socket-client:",
      //   JSON.stringify(data)
      // );

      const updateKey = getQueueUpdateKey(
        data.type,
        data.queue.id,
        data.timestamp || Date.now()
      )
      // console.log(`[DisplayPage] Generated updateKey: ${updateKey}`);

      if (processedQueueUpdatesRef.current.has(updateKey)) {
        // console.log(
        //   "⏩ [DisplayPage] Skipping duplicate queue update:",
        //   updateKey
        // );
        return
      }
      // console.log("[DisplayPage] New update, processing...");

      processedQueueUpdatesRef.current.add(updateKey)

      if (processedQueueUpdatesRef.current.size > 50) {
        const entries = Array.from(processedQueueUpdatesRef.current)
        entries.slice(0, 25).forEach((key) => {
          processedQueueUpdatesRef.current.delete(key)
        })
      }

      if (data.type === "QUEUE_CALLED") {
        console.log(
          "🎤 [DisplayPage] handleQueueUpdate: Event type is QUEUE_CALLED.",
          data
        )
        if (!announcedQueueIdsRef.current.has(data.queue.id)) {
          console.log(
            `🎤 [DisplayPage] handleQueueUpdate: Queue ${data.queue.id} not announced yet. Attempting to find counter.`
          )
          const counter = countersRef.current.find(
            (c) => c.id === data.queue.counterServingId
          )
          if (counter) {
            const announcement = `Nomor antrean ${data.queue.number} silakan menuju operator ${counter.number}`
            console.log(
              "🎤 [DisplayPage] handleQueueUpdate: Announcing:",
              announcement
            )
            speak(announcement)
            announcedQueueIdsRef.current.add(data.queue.id)
            if (announcedQueueIdsRef.current.size > 20) {
              const ids = Array.from(announcedQueueIdsRef.current)
              ids.slice(0, 10).forEach((id) => {
                announcedQueueIdsRef.current.delete(id)
              })
            }
          } else {
            console.warn(
              "🎤 [DisplayPage] handleQueueUpdate: Operator not found for QUEUE_CALLED queue:",
              data.queue.counterServingId,
              "Available operators:",
              countersRef.current
            )
          }
        } else {
          console.log(
            "🎤 [DisplayPage] handleQueueUpdate: Queue already announced:",
            data.queue.id
          )
        }
      }

      // Update queues state
      setQueues((prevQueues) => {
        console.log(
          "[DisplayPage] setQueues: prevQueues:",
          JSON.stringify(prevQueues)
        )
        const existingQueueIndex = prevQueues.findIndex(
          (q) => q.id === data.queue.id
        )
        let updatedQueues

        if (existingQueueIndex !== -1) {
          console.log(
            "[DisplayPage] setQueues: Updating existing queue:",
            data.queue.id
          )
          updatedQueues = prevQueues.map((queue) =>
            queue.id === data.queue.id
              ? {
                  ...queue,
                  ...data.queue,
                  servedBy: data.counter ? { ...data.counter } : queue.servedBy,
                  updatedAt: data.timestamp || Date.now()
                }
              : queue
          )
        } else {
          console.log(
            "[DisplayPage] setQueues: Adding new queue:",
            data.queue.id
          )
          updatedQueues = [
            ...prevQueues,
            {
              ...data.queue,
              servedBy: data.counter ? { ...data.counter } : null,
              updatedAt: data.timestamp || Date.now()
            }
          ]
        }
        console.log(
          "[DisplayPage] setQueues: nextQueues:",
          JSON.stringify(updatedQueues)
        )
        return updatedQueues
      })

      // Update counters if provided
      if (data.counter) {
        console.log(
          "[DisplayPage] data.counter exists. Updating counters state.",
          JSON.stringify(data.counter)
        )
        setCounters((prevCounters) => {
          console.log(
            "[DisplayPage] setCounters: prevCounters:",
            JSON.stringify(prevCounters)
          )
          const existingCounterIndex = prevCounters.findIndex(
            (c) => c.id === data.counter!.id
          )
          let updatedCounters
          if (existingCounterIndex !== -1) {
            updatedCounters = prevCounters.map((counter) =>
              counter.id === data.counter!.id ? { ...data.counter! } : counter
            )
          } else {
            updatedCounters = [...prevCounters, { ...data.counter! }]
          }
          console.log(
            "[DisplayPage] setCounters: nextCounters:",
            JSON.stringify(updatedCounters)
          )
          return updatedCounters
        })
      }

      console.log(
        "✅ [DisplayPage] Queue update processed successfully for:",
        data.type,
        data.queue.number
      )
    },
    [speak, getQueueUpdateKey]
  )

  // Menangani pemanggilan ulang dari server
  const handleRecallEvent = useCallback(
    (data: RecallEventData) => {
      console.log("🎤 [DisplayPage] handleRecallEvent received:", data)

      // Speak the recall announcement
      const recallAnnouncement = `Pemanggilan ulang, nomor antrean ${data.queueNumber} silakan menuju operator ${data.counterNumber}`
      console.log(
        "🎤 [DisplayPage] handleRecallEvent: Announcing:",
        recallAnnouncement
      )
      speak(recallAnnouncement)

      // Show toast notification
      toast(`Pemanggilan ulang untuk nomor ${data.queueNumber}`)
    },
    [speak]
  )

  // Socket connection
  useSocketConnection()

  // Subscribe to socket events
  useQueueUpdates(handleQueueUpdate)
  useRecallEvents(handleRecallEvent)

  // Untuk mengambil data awal dan mengatur auto-refresh
  const loadInitialData = async () => {
    try {
      await fetchData()
    } catch (error) {
      console.error("Error loading initial data:", error)
      toast.error("Gagal memuat data awal")
    } finally {
      setLoading(false)
    }
  }

  // Fungsi untuk mengambil data dari API
  const fetchData = async () => {
    try {
      const [queuesResponse, countersResponse, settingsResponse] =
        await Promise.all([
          fetch("/api/queues"),
          fetch("/api/counters"),
          fetch("/api/settings")
        ])

      if (!queuesResponse.ok || !countersResponse.ok) {
        throw new Error("Failed to fetch data")
      }

      const queuesData = await queuesResponse.json()
      const countersData = await countersResponse.json()

      console.log("📊 Fetched queues:", queuesData?.length || 0)
      console.log("📊 Fetched counters:", countersData?.length || 0)

      // Process queues data to ensure consistent format
      const processedQueues = queuesData.map((newQueue: Queue) => {
        const existingQueue = queues.find((q) => q.id === newQueue.id)
        return existingQueue ? existingQueue : newQueue
      })

      setQueues(processedQueues)
      setCounters(countersData)

      // Fetch and set video URL from settings
      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json()
        if (settingsData.videoUrl) {
          setVideoUrl(getYouTubeEmbedUrl(settingsData.videoUrl)) // Process URL
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error)
      if (!queues.length && !counters.length) {
        toast.error("Gagal memuat data")
      }
    }
  }

  // Fungsi untuk memformat waktu
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    })
  }

  // Fungsi untuk memformat tanggal
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    })
  }

  // Function to toggle fullscreen
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
        setIsFullscreen(false)
      }
    }
  }

  // useEffect untuk mengatur timer dan data awal
  useEffect(() => {
    // Set initial speech state from localStorage
    const savedSpeechEnabled = localStorage.getItem("speechEnabled")
    if (savedSpeechEnabled) {
      setSpeechEnabled(savedSpeechEnabled === "true")
    }

    loadInitialData()

    // Set up timer for current time
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    // Effect to keep countersRef updated
    countersRef.current = counters

    return () => {
      clearInterval(timeInterval)
    }
  }, [])

  // Update countersRef whenever counters state changes
  useEffect(() => {
    countersRef.current = counters
  }, [counters])

  // Get queues that are currently called or being served
  const calledQueues = queues.filter(
    (queue) => queue.status === "CALLED" || queue.status === "SERVING"
  )

  if (loading) {
    return <LoadingSpinner fullScreen message="Memuat tampilan antrean..." />
  }

  // Ensure we have exactly 8 operators for display
  const displayCounters = Array.from({ length: 8 }, (_, index) => {
    const existingCounter = counters.find((c) => c.number === index + 1)
    return (
      existingCounter || {
        id: `placeholder-${index + 1}`,
        name: `Operator ${index + 1}`,
        number: index + 1,
        isActive: false
      }
    )
  })

  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 overflow-hidden">
      <Toaster position="top-right" />

      {/* Main Container */}
      <div className="h-full p-3 md:p-4 lg:p-6">
        {/* Main Layout - Left: Operator Cards, Right: Institution Info & Video */}
        <div className="h-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4 lg:gap-6 h-full">
            {/* Left - Operator Cards */}
            <div className="lg:col-span-6 order-2 lg:order-1">
              <div className="bg-white rounded-xl lg:rounded-2xl shadow-xl border border-gray-100 h-full">
                {/* Operator Grid - Always 2 columns, 4 rows */}
                <div className="grid grid-cols-2 grid-rows-4 gap-2 md:gap-3 lg:gap-4 p-4 h-full">
                  {displayCounters.map((counter) => {
                    const activeQueue = calledQueues.find(
                      (q) => q.counterServingId === counter.id
                    )

                    const isPlaceholder = counter.id.startsWith("placeholder-")

                    return (
                      <div
                        key={counter.id}
                        className={`rounded-lg lg:rounded-xl shadow-lg overflow-hidden border-2 transition-all duration-300 transform hover:scale-105 flex flex-col h-full ${
                          activeQueue
                            ? activeQueue.status === "CALLED"
                              ? "border-yellow-400 bg-gradient-to-br from-yellow-50 to-yellow-100 shadow-yellow-200"
                              : "border-green-400 bg-gradient-to-br from-green-50 to-green-100 shadow-green-200"
                            : isPlaceholder
                            ? "border-gray-300 bg-gradient-to-br from-gray-50 to-gray-100"
                            : "border-blue-300 bg-gradient-to-br from-blue-50 to-blue-100 shadow-blue-200"
                        }`}
                      >
                        {/* Header */}
                        <div
                          className={`py-2 md:py-2.5 px-3 md:px-4 text-center font-bold text-white text-sm md:text-base relative flex-shrink-0 ${
                            activeQueue
                              ? activeQueue.status === "CALLED"
                                ? "bg-gradient-to-r from-yellow-500 to-yellow-600"
                                : "bg-gradient-to-r from-green-500 to-green-600"
                              : isPlaceholder
                              ? "bg-gradient-to-r from-gray-400 to-gray-500"
                              : "bg-gradient-to-r from-blue-500 to-blue-600"
                          }`}
                        >
                          <div className="absolute inset-0 bg-white opacity-10 rounded-t-lg lg:rounded-t-xl"></div>
                          <span className="relative">
                            OPERATOR {counter.number}
                          </span>
                        </div>

                        {/* Content */}
                        <div className="flex-1 flex flex-col justify-center items-center p-2 md:p-3">
                          {activeQueue ? (
                            <>
                              <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide text-center">
                                Nomor Antrian
                              </div>
                              <div
                                className={`text-xl md:text-2xl lg:text-3xl font-bold mb-1 ${
                                  activeQueue.status === "CALLED"
                                    ? "text-yellow-600"
                                    : "text-green-600"
                                }`}
                              >
                                {activeQueue.number}
                              </div>
                              <div
                                className={`px-2 md:px-3 py-1 rounded-full text-xs font-bold text-white shadow-md ${
                                  activeQueue.status === "CALLED"
                                    ? "bg-yellow-500"
                                    : "bg-green-500"
                                }`}
                              >
                                {activeQueue.status === "CALLED"
                                  ? "DIPANGGIL"
                                  : "MELAYANI"}
                              </div>
                            </>
                          ) : (
                            <div className="text-center">
                              <div className="text-xl md:text-2xl text-gray-400 mb-1 font-light">
                                --
                              </div>
                              <div className="text-xs md:text-sm text-gray-500 font-medium">
                                {isPlaceholder ? "TIDAK AKTIF" : "MENUNGGU"}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Right - Institution Info and Video */}
            <div className="lg:col-span-6 order-1 lg:order-2">
              <div className="h-full flex flex-col gap-3 md:gap-4 lg:gap-6">
                {/* Institution Information */}
                <div className="h-fit min-h-0">
                  <div className="bg-white rounded-xl lg:rounded-2xl p-4 shadow-xl border border-gray-100 h-full flex flex-col justify-between gap-10">
                    {/* Institution Header */}
                    <div>
                      <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4 mb-2 lg:mb-3">
                        {/* Logos */}
                        <div className="flex items-center space-x-3">
                          {/* SMAN 10 Surabaya Logo */}
                          <div className="relative w-12 h-12 md:w-16 md:h-16 flex items-center justify-center bg-white rounded-lg shadow-md p-1.5">
                            <Image
                              src="https://www.dbl.id/uploads/school/13138/810-SMAN_10_SURABAYA.png"
                              alt="SMAN 10 Surabaya"
                              fill
                              sizes="(max-width: 768px) 48px, 64px"
                              className="object-contain"
                            />
                          </div>
                          {/* Dinas Pendidikan Jatim Logo */}
                          <div className="relative w-12 h-12 md:w-16 md:h-16 flex items-center justify-center bg-white rounded-lg shadow-md p-1.5">
                            <Image
                              src="https://spmbjatim.net/images/logo.png"
                              alt="Dinas Pendidikan Jatim"
                              fill
                              sizes="(max-width: 768px) 48px, 64px"
                              className="object-contain"
                            />
                          </div>
                        </div>

                        {/* Institution Text */}
                        <div className="flex-1 text-center sm:text-left">
                          <h1 className="text-lg md:text-xl lg:text-2xl font-bold text-gray-800 mb-1 font-inter">
                            SPMB Jatim 2025
                          </h1>
                          <p className="text-base md:text-lg text-gray-600 font-medium">
                            SMAN 10 Surabaya
                          </p>
                          <div className="w-16 h-1 bg-gradient-to-r from-blue-500 to-green-500 rounded-full mt-1 mx-auto sm:mx-0"></div>
                        </div>
                      </div>
                    </div>

                    {/* Date and Time */}
                    <div className="text-center bg-gray-50 rounded-lg p-3 md:p-4 border border-gray-100">
                      <div className="text-xl md:text-2xl font-bold text-gray-800 mb-1 font-mono">
                        {formatTime(currentTime)}
                      </div>
                      <div className="text-sm md:text-base text-gray-600 capitalize">
                        {formatDate(currentTime)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Video */}
                <div className="flex-1 min-h-0">
                  <div className="bg-white rounded-xl lg:rounded-2xl shadow-xl overflow-hidden border border-gray-100 h-full">
                    <div className="h-full p-4">
                      {memoizedVideoData.iframeSrc ? (
                        <iframe
                          src={memoizedVideoData.iframeSrc}
                          className="w-full h-full rounded-lg"
                          title={memoizedVideoData.iframeTitle}
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      ) : (
                        (console.error(
                          "[DisplayPage] iframeSrc is empty. Not rendering iframe."
                        ),
                        null) // Render nothing if src is empty after memoization
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Control Button */}
      <button
        onClick={toggleFullScreen}
        className="fixed top-4 right-4 bg-gray-800/30 hover:bg-opacity-40 text-white p-2 rounded-full shadow-lg z-50 text-2xl"
        aria-label="Toggle fullscreen"
      >
        {isFullscreen ? <Shrink size={20} /> : <Expand size={20} />}
      </button>

      {/* Speech Control Button - Styled with icon and positioned below fullscreen button */}
      <button
        onClick={() => {
          const newSpeechEnabled = !speechEnabled
          setSpeechEnabled(newSpeechEnabled)
          localStorage.setItem("speechEnabled", newSpeechEnabled.toString())
          if (newSpeechEnabled) {
            // If turning on speech
            console.log("🎤 [DisplayPage] Speech explicitly enabled by user.")
            setAnnouncementToMake("Pengumuman suara diaktifkan") // Defer announcement
          } else {
            if (synthRef.current) synthRef.current.cancel() // Stop any ongoing speech
            toast.success("Suara dinonaktifkan")
            setAnnouncementToMake(null) // Clear any pending announcement if disabling
          }
        }}
        className="fixed top-16 right-4 bg-gray-800/30 hover:bg-opacity-40 text-white p-2 rounded-full shadow-lg z-50 text-2xl"
        aria-label="Toggle speech"
      >
        {speechEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
      </button>
    </div>
  )
}
