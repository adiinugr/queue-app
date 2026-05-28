"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import Image from "next/image"
import LoadingSpinner from "../components/LoadingSpinner"
import toast, { Toaster } from "react-hot-toast"
import {
  useQueueUpdates,
  useRecallEvents,
  useSettingsUpdates,
  QueueUpdateData,
  RecallEventData,
  SettingsUpdateData,
  useSocketConnection
} from "../../lib/socket-client"
import { Expand, Shrink, Volume2, VolumeX } from "lucide-react"

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
  } catch {
    if (!url.includes("/") && !url.includes(".")) videoId = url
  }
  if (!videoId) return "https://www.youtube.com/embed/jAQvxW2l-Pg"
  return `https://www.youtube.com/embed/${videoId}`
}

interface Queue {
  id: string
  number: number
  queueType: "OPERATOR" | "VERIFIKATOR"
  status: "WAITING" | "CALLED" | "SERVING" | "COMPLETED" | "SKIPPED"
  counterServingId: string | null
  servedBy: Counter | null
  updatedAt?: number
}

interface Counter {
  id: string
  name: string
  number: number
  counterType: "OPERATOR" | "VERIFIKATOR"
  isActive: boolean
}

export default function DisplayPage() {
  const [queues, setQueues] = useState<Queue[]>([])
  const [counters, setCounters] = useState<Counter[]>([])
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [speechEnabled, setSpeechEnabled] = useState(false)
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  const [videoUrl, setVideoUrl] = useState("")
  const [isFullscreen, setIsFullscreen] = useState(false)

  const countersRef = useRef<Counter[]>([])
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])
  const announcedQueueIdsRef = useRef<Set<string>>(new Set())
  const processedQueueUpdatesRef = useRef<Set<string>>(new Set())

  // Load voices properly (async in Chrome)
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return
    synthRef.current = window.speechSynthesis

    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices()
    }

    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null
      }
    }
  }, [])

  const memoizedVideoData = useMemo(() => {
    const embedUrl = getYouTubeEmbedUrl(videoUrl)
    let playlistId = ""
    if (embedUrl && embedUrl.includes("/embed/")) {
      playlistId = embedUrl.split("/embed/")[1]?.split("?")[0] || ""
    }
    if (!embedUrl || !playlistId) {
      const defaultId = "jAQvxW2l-Pg"
      return {
        iframeSrc: `https://www.youtube.com/embed/${defaultId}?autoplay=1&mute=1&loop=1&playlist=${defaultId}`,
        iframeTitle: "Video Informasi"
      }
    }
    const sep = embedUrl.includes("?") ? "&" : "?"
    return {
      iframeSrc: `${embedUrl}${sep}autoplay=1&mute=1&loop=1&playlist=${playlistId}`,
      iframeTitle: "Video Informasi"
    }
  }, [videoUrl])

  const speak = useCallback(
    (text: string) => {
      if (!speechEnabled || !audioUnlocked) return
      if (typeof window === "undefined" || !window.speechSynthesis) return
      if (typeof SpeechSynthesisUtterance === "undefined") return

      try {
        window.speechSynthesis.cancel()

        const utterance = new SpeechSynthesisUtterance(text)
        // Selalu set bahasa Indonesia — ini kunci agar pengucapan beraksen Indonesia
        utterance.lang = "id-ID"
        utterance.rate = 0.85
        utterance.pitch = 1.0
        utterance.volume = 1.0

        // Cari suara bahasa Indonesia
        const idVoice =
          voicesRef.current.find((v) => v.lang === "id-ID") ||
          voicesRef.current.find((v) => v.lang.startsWith("id"))

        if (idVoice) {
          utterance.voice = idVoice
        }
        // Jika tidak ada suara id-ID, lang='id-ID' tetap membantu browser
        // menggunakan phonetik Indonesia

        utterance.onerror = (e) => {
          if (e.error !== "canceled") {
            console.error("Speech error:", e.error)
          }
        }

        window.speechSynthesis.speak(utterance)
      } catch (e) {
        console.error("Failed to speak:", e)
      }
    },
    [speechEnabled, audioUnlocked]
  )

  const getQueueUpdateKey = (type: string, queueId: string, ts: number) =>
    `${type}-${queueId}-${Math.floor(ts / 1000)}`

  const handleQueueUpdate = useCallback(
    (data: QueueUpdateData) => {
      const key = getQueueUpdateKey(
        data.type,
        data.queue.id,
        data.timestamp || Date.now()
      )
      if (processedQueueUpdatesRef.current.has(key)) return
      processedQueueUpdatesRef.current.add(key)
      if (processedQueueUpdatesRef.current.size > 50) {
        const entries = Array.from(processedQueueUpdatesRef.current)
        entries.slice(0, 25).forEach((k) => processedQueueUpdatesRef.current.delete(k))
      }

      if (data.type === "QUEUE_CALLED" && !announcedQueueIdsRef.current.has(data.queue.id)) {
        const counter = countersRef.current.find(
          (c) => c.id === data.queue.counterServingId
        )
        if (counter) {
          const tipe = counter.counterType === "VERIFIKATOR" ? "verifikator" : "operator"
          speak(
            `Nomor antrian ${data.queue.number}, silakan menuju meja ${tipe} ${counter.number}`
          )
          announcedQueueIdsRef.current.add(data.queue.id)
          if (announcedQueueIdsRef.current.size > 20) {
            const ids = Array.from(announcedQueueIdsRef.current)
            ids.slice(0, 10).forEach((id) => announcedQueueIdsRef.current.delete(id))
          }
        }
      }

      const updatedCounter: Counter | null = data.counter
        ? {
            id: data.counter.id,
            name: data.counter.name,
            number: data.counter.number,
            counterType: data.counter.counterType,
            isActive: data.counter.isActive
          }
        : null

      setQueues((prev) => {
        const qBase: Queue = {
          id: data.queue.id,
          number: data.queue.number,
          queueType: data.queue.queueType || "OPERATOR",
          status: data.queue.status,
          counterServingId: data.queue.counterServingId,
          servedBy: updatedCounter,
          updatedAt: data.timestamp || Date.now()
        }
        const idx = prev.findIndex((q) => q.id === data.queue.id)
        if (idx !== -1) {
          return prev.map((q) =>
            q.id === data.queue.id
              ? { ...q, ...qBase, servedBy: updatedCounter || q.servedBy }
              : q
          )
        }
        return [...prev, qBase]
      })

      if (updatedCounter) {
        setCounters((prev) => {
          const idx = prev.findIndex((c) => c.id === updatedCounter.id)
          if (idx !== -1) {
            return prev.map((c) => (c.id === updatedCounter.id ? updatedCounter : c))
          }
          return [...prev, updatedCounter]
        })
      }
    },
    [speak]
  )

  const handleRecallEvent = useCallback(
    (data: RecallEventData) => {
      const tipe = data.counterType === "VERIFIKATOR" ? "verifikator" : "operator"
      speak(
        `Pemanggilan ulang, nomor antrian ${data.queueNumber}, silakan menuju meja ${tipe} ${data.counterNumber}`
      )
      toast(`Panggilan ulang nomor ${data.queueNumber}`)
    },
    [speak]
  )

  const handleSettingsUpdate = useCallback((data: SettingsUpdateData) => {
    if (data.videoUrl) {
      setVideoUrl(getYouTubeEmbedUrl(data.videoUrl))
    }
  }, [])

  useSocketConnection()
  useQueueUpdates(handleQueueUpdate)
  useRecallEvents(handleRecallEvent)
  useSettingsUpdates(handleSettingsUpdate)

  const fetchData = useCallback(async () => {
    try {
      const [queuesRes, countersRes, settingsRes] = await Promise.all([
        fetch("/api/queues"),
        fetch("/api/counters"),
        fetch("/api/settings")
      ])
      if (!queuesRes.ok || !countersRes.ok) throw new Error("Failed to fetch")

      const queuesData: Queue[] = await queuesRes.json()
      const countersData: Counter[] = await countersRes.json()
      setQueues(queuesData)
      setCounters(countersData)
      countersRef.current = countersData

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json()
        if (settingsData.videoUrl) {
          setVideoUrl(getYouTubeEmbedUrl(settingsData.videoUrl))
        }
      }
    } catch (err) {
      console.error("Error fetching data:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Don't auto-enable speech — browser requires user gesture each page load.
    // speechEnabled preference is restored after user clicks the unlock overlay.
    fetchData()

    const timeInterval = setInterval(() => setCurrentTime(new Date()), 1000)
    // Always poll as reliable fallback — socket handles instant updates
    const pollInterval = setInterval(fetchData, 5000)
    return () => {
      clearInterval(timeInterval)
      clearInterval(pollInterval)
    }
  // fetchData is stable (empty deps)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    countersRef.current = counters
  }, [counters])

  const calledQueues = queues.filter(
    (q) => q.status === "CALLED" || q.status === "SERVING"
  )

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })

  const formatDate = (d: Date) =>
    d.toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    })

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  // Build display arrays: 10 operators, 5 verifikators
  const operatorCounters = Array.from({ length: 10 }, (_, i) => {
    return (
      counters.find((c) => c.counterType === "OPERATOR" && c.number === i + 1) || {
        id: `op-placeholder-${i + 1}`,
        name: `Operator ${i + 1}`,
        number: i + 1,
        counterType: "OPERATOR" as const,
        isActive: false
      }
    )
  })

  const verifikatorCounters = Array.from({ length: 5 }, (_, i) => {
    return (
      counters.find((c) => c.counterType === "VERIFIKATOR" && c.number === i + 1) || {
        id: `vr-placeholder-${i + 1}`,
        name: `Verifikator ${i + 1}`,
        number: i + 1,
        counterType: "VERIFIKATOR" as const,
        isActive: false
      }
    )
  })

  if (loading) {
    return <LoadingSpinner fullScreen message="Memuat tampilan antrian..." />
  }

  const CounterCard = ({
    counter,
    isVerifikator
  }: {
    counter: (typeof operatorCounters)[0]
    isVerifikator: boolean
  }) => {
    const activeQueue = calledQueues.find((q) => q.counterServingId === counter.id)
    const isPlaceholder = counter.id.startsWith("op-placeholder-") || counter.id.startsWith("vr-placeholder-")
    const isCalled = activeQueue?.status === "CALLED"
    const isServing = activeQueue?.status === "SERVING"

    const blue = {
      header: isCalled
        ? "linear-gradient(135deg, #B45309, #D97706)"
        : isServing
        ? "linear-gradient(135deg, #059669, #10B981)"
        : isPlaceholder
        ? "linear-gradient(135deg, #374151, #4B5563)"
        : "linear-gradient(135deg, #1D4ED8, #2563EB)",
      border: isCalled ? "#F59E0B" : isServing ? "#10B981" : isPlaceholder ? "#374151" : "#3B82F6",
      bg: isCalled ? "#2A1F05" : isServing ? "#052A1A" : "#0D1F35",
      numColor: isCalled ? "#FCD34D" : isServing ? "#6EE7B7" : "#93C5FD"
    }
    const teal = {
      header: isCalled
        ? "linear-gradient(135deg, #B45309, #D97706)"
        : isServing
        ? "linear-gradient(135deg, #059669, #10B981)"
        : isPlaceholder
        ? "linear-gradient(135deg, #374151, #4B5563)"
        : "linear-gradient(135deg, #0F766E, #0D9488)",
      border: isCalled ? "#F59E0B" : isServing ? "#10B981" : isPlaceholder ? "#374151" : "#14B8A6",
      bg: isCalled ? "#2A1F05" : isServing ? "#052A1A" : "#0D1F35",
      numColor: isCalled ? "#FCD34D" : isServing ? "#6EE7B7" : "#5EEAD4"
    }
    const theme = isVerifikator ? teal : blue

    return (
      <div
        className={`rounded-xl overflow-hidden flex flex-col h-full transition-all duration-300 ${isCalled ? "animate-pulse-called" : ""}`}
        style={{
          border: `1.5px solid ${theme.border}`,
          background: theme.bg,
          boxShadow: isCalled
            ? `0 0 20px rgba(245,158,11,0.3)`
            : isServing
            ? `0 0 20px rgba(16,185,129,0.3)`
            : "none"
        }}
      >
        {/* Card header */}
        <div
          className="px-2 py-1.5 text-center"
          style={{ background: theme.header }}
        >
          <span
            className="text-xs font-bold text-white uppercase tracking-wider"
            style={{ fontFamily: "var(--font-jakarta)" }}
          >
            {isVerifikator ? "V" : ""}{counter.number}
          </span>
        </div>

        {/* Card body */}
        <div className="flex-1 flex flex-col items-center justify-center py-2 px-1">
          {activeQueue ? (
            <>
              <div
                className="text-2xl md:text-3xl font-bold leading-none"
                style={{
                  fontFamily: "var(--font-oswald)",
                  color: theme.numColor
                }}
              >
                {String(activeQueue.number).padStart(3, "0")}
              </div>
              <div
                className="text-xs mt-1 font-semibold uppercase tracking-wide"
                style={{
                  color: isCalled ? "#F59E0B" : "#10B981",
                  fontFamily: "var(--font-jakarta)"
                }}
              >
                {isCalled ? "DIPANGGIL" : "MELAYANI"}
              </div>
            </>
          ) : (
            <div
              className="text-xl font-light"
              style={{
                color: isPlaceholder ? "#4B5563" : "rgba(255,255,255,0.2)",
                fontFamily: "var(--font-oswald)"
              }}
            >
              ---
            </div>
          )}
        </div>
      </div>
    )
  }

  const unlockAudio = () => {
    // This click IS the user gesture — unlock browser speech permission
    const savedSpeech = localStorage.getItem("speechEnabled") !== "false"
    setSpeechEnabled(savedSpeech)
    setAudioUnlocked(true)
    if (savedSpeech && window.speechSynthesis) {
      // Speak a silent utterance to fully unlock
      const u = new SpeechSynthesisUtterance(" ")
      u.volume = 0
      window.speechSynthesis.speak(u)
    }
  }

  return (
    <div
      className="h-screen overflow-hidden flex flex-col"
      style={{
        background: "linear-gradient(160deg, #0A1628 0%, #0D1F35 50%, #0A1628 100%)"
      }}
    >
      <Toaster position="top-center" />

      {/* Audio unlock overlay — browser requires user gesture before speech */}
      {!audioUnlocked && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center cursor-pointer"
          style={{ background: "rgba(10,22,40,0.97)", backdropFilter: "blur(4px)" }}
          onClick={unlockAudio}
        >
          <div
            className="rounded-2xl px-12 py-10 text-center max-w-sm"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(59,130,246,0.3)"
            }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: "rgba(26,86,219,0.2)", border: "1px solid rgba(59,130,246,0.4)" }}
            >
              <Volume2 size={28} className="text-blue-400" />
            </div>
            <p
              className="text-xl font-bold text-white mb-2"
              style={{ fontFamily: "var(--font-jakarta)" }}
            >
              Klik untuk Memulai
            </p>
            <p
              className="text-sm"
              style={{ color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-jakarta)" }}
            >
              Klik di mana saja untuk mengaktifkan tampilan antrian dan pengumuman suara
            </p>
            <div
              className="mt-5 w-full py-3 rounded-xl text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #1D4ED8, #1A56DB)", fontFamily: "var(--font-jakarta)" }}
            >
              Aktifkan Tampilan
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div
        className="flex-shrink-0 px-4 py-2 flex items-center justify-between"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8">
            <Image
              src="https://www.dbl.id/uploads/school/13138/810-SMAN_10_SURABAYA.png"
              alt="SMAN 10"
              fill
              sizes="32px"
              className="object-contain"
            />
          </div>
          <div className="relative w-8 h-8">
            <Image
              src="https://spmbjatim.net/images/logo.png"
              alt="SPMB Jatim"
              fill
              sizes="32px"
              className="object-contain"
            />
          </div>
          <div>
            <p
              className="text-white font-bold text-sm leading-none"
              style={{ fontFamily: "var(--font-jakarta)" }}
            >
              Aplikasi Antrian SPMB Jatim Tahun 2026
            </p>
            <p
              className="text-xs"
              style={{ color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-jakarta)" }}
            >
              SMAN 10 Surabaya
            </p>
          </div>
        </div>

        {/* controls moved to floating buttons — no duplicate clock here */}
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-3 p-3">
        {/* Left: Counter sections */}
        <div className="col-span-7 flex flex-col gap-3 min-h-0">
          {/* Operator section — takes 2/3 of available height */}
          <div
            className="rounded-xl overflow-hidden flex flex-col"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(59,130,246,0.3)",
              flex: "2"
            }}
          >
            <div
              className="px-3 py-2 flex items-center gap-2 flex-shrink-0"
              style={{
                background: "linear-gradient(90deg, rgba(26,86,219,0.6), rgba(26,86,219,0.2))",
                borderBottom: "1px solid rgba(59,130,246,0.3)"
              }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: "#3B82F6", boxShadow: "0 0 6px #3B82F6" }}
              />
              <span
                className="text-xs font-bold uppercase tracking-widest text-white"
                style={{ fontFamily: "var(--font-jakarta)" }}
              >
                Operator
              </span>
              <span
                className="ml-auto text-xs"
                style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-jakarta)" }}
              >
                10 Loket
              </span>
            </div>
            <div className="grid grid-cols-5 gap-2 p-2 flex-1 auto-rows-fr">
              {operatorCounters.map((counter) => (
                <CounterCard key={counter.id} counter={counter} isVerifikator={false} />
              ))}
            </div>
          </div>

          {/* Verifikator section — takes 1/3 of available height */}
          <div
            className="rounded-xl overflow-hidden flex flex-col"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(20,184,166,0.3)",
              flex: "1"
            }}
          >
            <div
              className="px-3 py-2 flex items-center gap-2 flex-shrink-0"
              style={{
                background: "linear-gradient(90deg, rgba(13,148,136,0.6), rgba(13,148,136,0.2))",
                borderBottom: "1px solid rgba(20,184,166,0.3)"
              }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: "#14B8A6", boxShadow: "0 0 6px #14B8A6" }}
              />
              <span
                className="text-xs font-bold uppercase tracking-widest text-white"
                style={{ fontFamily: "var(--font-jakarta)" }}
              >
                Verifikator
              </span>
              <span
                className="ml-auto text-xs"
                style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-jakarta)" }}
              >
                5 Loket
              </span>
            </div>
            <div className="grid grid-cols-5 gap-2 p-2 flex-1 auto-rows-fr">
              {verifikatorCounters.map((counter) => (
                <CounterCard key={counter.id} counter={counter} isVerifikator={true} />
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 px-1 flex-shrink-0">
            {[
              { color: "#6B7280", label: "Menunggu" },
              { color: "#F59E0B", label: "Dipanggil" },
              { color: "#10B981", label: "Melayani" }
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: item.color }}
                />
                <span
                  className="text-xs"
                  style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-jakarta)" }}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Info + Video */}
        <div className="col-span-5 flex flex-col gap-3 min-h-0">
          {/* Institution card */}
          <div
            className="rounded-xl p-4 flex-shrink-0"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)"
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="flex gap-2">
                <div className="relative w-10 h-10 bg-white rounded-lg overflow-hidden p-1">
                  <Image
                    src="https://www.dbl.id/uploads/school/13138/810-SMAN_10_SURABAYA.png"
                    alt="SMAN 10"
                    fill
                    sizes="40px"
                    className="object-contain"
                  />
                </div>
                <div className="relative w-10 h-10 bg-white rounded-lg overflow-hidden p-1">
                  <Image
                    src="https://spmbjatim.net/images/logo.png"
                    alt="SPMB Jatim"
                    fill
                    sizes="40px"
                    className="object-contain"
                  />
                </div>
              </div>
              <div>
                <p
                  className="text-white font-bold text-base leading-tight"
                  style={{ fontFamily: "var(--font-jakarta)" }}
                >
                  SPMB Jatim Tahun 2026
                </p>
                <p
                  className="text-sm"
                  style={{ color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-jakarta)" }}
                >
                  SMAN 10 Surabaya
                </p>
              </div>
            </div>
            <div
              className="h-px"
              style={{ background: "rgba(255,255,255,0.08)" }}
            />
            <div className="mt-3 text-center">
              <div
                className="text-3xl font-bold text-white"
                style={{ fontFamily: "var(--font-oswald)" }}
              >
                {formatTime(currentTime)}
              </div>
              <div
                className="text-sm capitalize mt-1"
                style={{ color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-jakarta)" }}
              >
                {formatDate(currentTime)}
              </div>
            </div>
          </div>

          {/* Video */}
          <div
            className="flex-1 min-h-0 rounded-xl overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.1)" }}
          >
            {memoizedVideoData.iframeSrc ? (
              <iframe
                src={memoizedVideoData.iframeSrc}
                className="w-full h-full"
                title={memoizedVideoData.iframeTitle}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : null}
          </div>
        </div>
      </div>

      {/* Floating controls */}
      <div className="fixed top-4 right-4 flex flex-col gap-2 z-50">
        <button
          onClick={toggleFullScreen}
          className="p-2 rounded-full text-white transition-all hover:scale-110"
          style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}
          aria-label="Toggle fullscreen"
        >
          {isFullscreen ? <Shrink size={18} /> : <Expand size={18} />}
        </button>
        <button
          onClick={() => {
            const next = !speechEnabled
            setSpeechEnabled(next)
            localStorage.setItem("speechEnabled", next.toString())
            if (next) {
              toast.success("Suara diaktifkan")
              if (window.speechSynthesis) {
                voicesRef.current = window.speechSynthesis.getVoices()
              }
            } else {
              synthRef.current?.cancel()
              toast.success("Suara dinonaktifkan")
            }
          }}
          className="p-2 rounded-full text-white transition-all hover:scale-110"
          style={{
            background: speechEnabled
              ? "rgba(16,185,129,0.5)"
              : "rgba(255,255,255,0.15)",
            backdropFilter: "blur(8px)"
          }}
          aria-label="Toggle speech"
        >
          {speechEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
      </div>
    </div>
  )
}
