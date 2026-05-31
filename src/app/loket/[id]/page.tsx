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

interface Queue {
  id: string
  number: number
  queueType: "OPERATOR" | "VERIFIKATOR"
  status: "WAITING" | "CALLED" | "SERVING" | "COMPLETED" | "SKIPPED"
}

interface Counter {
  id: string
  name: string
  number: number
  counterType: "OPERATOR" | "VERIFIKATOR"
  isActive: boolean
  currentQueue: Queue | null
}

interface CounterUpdateData {
  type: string
  counter?: Counter
  counterId?: string
  timestamp?: number
}

export default function CounterPage() {
  const params = useParams()
  const router = useRouter()
  const counterId = (params?.id as string) || ""

  const [counter, setCounter] = useState<Counter | null>(null)
  const [waitingQueues, setWaitingQueues] = useState<Queue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [nextQueueLoading, setNextQueueLoading] = useState(false)
  const [pendingAction, setPendingAction] = useState<"complete" | "reject" | null>(null)
  const [recallQueueLoading, setRecallQueueLoading] = useState(false)
  const [justCalledQueueId, setJustCalledQueueId] = useState<string | null>(null)
  const [completedQueueId, setCompletedQueueId] = useState<string | null>(null)
  const [issuedOperatorNumber, setIssuedOperatorNumber] = useState<number | null>(null)

  // Ref to avoid stale closure for counterType in polling interval
  const counterRef = useRef<Counter | null>(null)

  const isVerifikator = counter?.counterType === "VERIFIKATOR"
  const themeColor = isVerifikator ? "#0D9488" : "#1A56DB"
  const themeBg = isVerifikator ? "bg-teal-600 hover:bg-teal-700" : "bg-blue-600 hover:bg-blue-700"
  const typeLabel = isVerifikator ? "Verifikator" : "Operator"

  const fetchCounter = useCallback(async () => {
    try {
      const response = await fetch("/api/counters")
      if (response.ok) {
        const data = await response.json()
        const found = data.find((c: Counter) => c.id === counterId)
        if (found) {
          if (completedQueueId && found.currentQueue?.id === completedQueueId) {
            found.currentQueue = null
          }
          setCounter(found)
        } else {
          router.push("/")
        }
      }
    } catch (err) {
      console.error("Error fetching counter:", err)
      setError("Gagal memuat data loket")
    }
  }, [counterId, completedQueueId, router])

  // Always points to latest fetchCounter — used in polling interval to avoid stale closure
  const fetchCounterRef = useRef(fetchCounter)
  useEffect(() => { fetchCounterRef.current = fetchCounter }, [fetchCounter])

  const fetchQueues = useCallback(async (queueType?: "OPERATOR" | "VERIFIKATOR") => {
    const type = queueType ?? counterRef.current?.counterType
    if (!type) return
    try {
      const response = await fetch("/api/queues")
      if (response.ok) {
        const data: Queue[] = await response.json()
        setWaitingQueues(data.filter((q) => q.status === "WAITING" && q.queueType === type))
      }
    } catch (err) {
      console.error("Error fetching queues:", err)
    } finally {
      setLoading(false)
    }
  }, []) // stable — uses counterRef, no state deps

  const callNextQueue = async () => {
    if (nextQueueLoading) return
    setNextQueueLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/counters/${counterId}/next`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal memanggil antrian")
      setCounter((prev) => (prev ? { ...prev, currentQueue: data } : prev))
      setJustCalledQueueId(data.id)
      toast.success(`Nomor antrian ${data.number} berhasil dipanggil!`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal memanggil antrian"
      setError(msg)
      toast.error(msg)
    } finally {
      setNextQueueLoading(false)
    }
  }

  // Selesaikan antrian. issueOperatorTicket=true → terbitkan nomor operator (verifikator lolos)
  const completeCurrentQueue = async (issueOperatorTicket = false) => {
    if (pendingAction || !counter?.currentQueue) {
      if (!counter?.currentQueue) toast.error("Tidak ada antrian aktif")
      return
    }
    const action = issueOperatorTicket ? "complete" : "reject"
    const qNum = counter.currentQueue.number
    const qId = counter.currentQueue.id
    setCompletedQueueId(qId)
    setIssuedOperatorNumber(null)
    setPendingAction(action)
    setCounter((prev) => (prev ? { ...prev, currentQueue: null } : prev))
    try {
      const res = await fetch(`/api/counters/${counterId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueOperatorTicket })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal menyelesaikan antrian")

      if (issueOperatorTicket && data.operatorQueue) {
        setIssuedOperatorNumber(data.operatorQueue.number)
        toast.success(`Antrian ${qNum} lolos verifikasi · No. Operator: ${data.operatorQueue.number}`)
      } else if (!issueOperatorTicket && isVerifikator) {
        toast.error(`Berkas nomor ${qNum} ditolak`)
      } else {
        toast.success(`Antrian nomor ${qNum} selesai dilayani`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menyelesaikan antrian"
      setError(msg)
      toast.error(msg)
      await fetchCounter()
      setCompletedQueueId(null)
    } finally {
      setPendingAction(null)
    }
  }

  const recallCurrentQueue = async () => {
    if (recallQueueLoading || !counter?.currentQueue) return
    setRecallQueueLoading(true)
    try {
      const res = await fetch(`/api/counters/${counterId}/recall`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queueNumber: counter.currentQueue.number,
          counterNumber: counter.number
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal memanggil ulang")
      toast.success("Panggilan ulang berhasil dikirim")
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal memanggil ulang"
      setError(msg)
      toast.error(msg)
    } finally {
      setRecallQueueLoading(false)
    }
  }

  const handleQueueUpdate = useCallback(
    (data: QueueUpdateData) => {
      if (data.type === "QUEUE_CALLED" && data.counter?.id === counterId && data.queue) {
        const q = data.queue
        setJustCalledQueueId(q.id)
        setCounter((prev) =>
          prev
            ? {
                ...prev,
                currentQueue: {
                  id: q.id,
                  number: q.number,
                  queueType: (q as unknown as Queue).queueType || "OPERATOR",
                  status: q.status
                } as Queue
              }
            : prev
        )
        setWaitingQueues((prev) => prev.filter((item) => item.id !== q.id))
      } else if (data.type === "QUEUE_COMPLETED" && data.counter?.id === counterId) {
        setCounter((prev) => (prev ? { ...prev, currentQueue: null } : prev))
      } else if (data.type === "QUEUE_CREATED" && data.queue) {
        const newQ = data.queue as unknown as Queue
        const myType = counterRef.current?.counterType
        if (myType && newQ.queueType === myType && newQ.status === "WAITING") {
          setWaitingQueues((prev) =>
            prev.some((item) => item.id === newQ.id) ? prev : [...prev, newQ]
          )
        } else if (!myType) {
          fetchQueues()
        }
      } else if (data.type === "QUEUES_RESET") {
        fetchCounterRef.current()
        fetchQueues()
      } else {
        fetchQueues()
      }
    },
    [counterId, fetchQueues]
  )

  const handleCounterUpdate = useCallback(
    (data: CounterUpdateData) => {
      if (data.counter?.id === counterId) fetchCounter()
    },
    [counterId, fetchCounter]
  )

  const queueSocketConnected = useQueueUpdates(handleQueueUpdate)
  const counterSocketConnected = useCounterUpdates(handleCounterUpdate)
  const socketConnected = queueSocketConnected || counterSocketConnected
  useSocketConnection()

  useEffect(() => {
    counterRef.current = counter
  }, [counter])

  useEffect(() => {
    fetchCounter()
  }, [fetchCounter])

  useEffect(() => {
    if (counter?.counterType) fetchQueues(counter.counterType)
  // fetchQueues is stable (empty deps), counter.counterType is primitive — safe
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counter?.counterType])

  useEffect(() => {
    // Always poll as reliable fallback — socket events handle instant updates
    const interval = setInterval(() => {
      fetchCounterRef.current()
      if (counterRef.current?.counterType) {
        fetchQueues(counterRef.current.counterType)
      }
    }, 5000)
    return () => clearInterval(interval)
  // fetchCounter and fetchQueues are stable (useCallback with empty/stable deps)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) return <LoadingSpinner fullScreen message="Memuat data loket..." />

  if (!counter) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center"
        style={{ background: "linear-gradient(135deg, #0D1F35, #1A3A5C)" }}
      >
        <div className="text-center text-white">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: "rgba(239,68,68,0.2)" }}
          >
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-jakarta)" }}>
            Loket tidak ditemukan
          </h1>
          <Link
            href="/"
            className="mt-4 inline-block px-6 py-2 rounded-lg text-white"
            style={{ background: "#1A56DB", fontFamily: "var(--font-jakarta)" }}
          >
            Kembali
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: "linear-gradient(160deg, #0A1628 0%, #0D1F35 100%)"
      }}
    >
      <Toaster position="top-right" />

      {/* Header */}
      <header
        className="flex-shrink-0 px-6 py-4"
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(13,31,53,0.9)",
          backdropFilter: "blur(12px)"
        }}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-sm transition-colors"
              style={{ color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-jakarta)" }}
            >
              ← Beranda
            </Link>
            <span style={{ color: "rgba(255,255,255,0.2)" }}>/</span>
            <span
              className="text-sm text-white"
              style={{ fontFamily: "var(--font-jakarta)" }}
            >
              Panel {typeLabel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${socketConnected ? "bg-green-400" : "bg-red-400"}`}
              style={{ boxShadow: socketConnected ? "0 0 6px #4ADE80" : "0 0 6px #F87171" }}
            />
            <span
              className="text-xs"
              style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-jakarta)" }}
            >
              {socketConnected ? "Terhubung" : "Terputus"}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Counter title */}
          <div className="mb-8 text-center">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-3"
              style={{
                background: `${themeColor}22`,
                border: `1px solid ${themeColor}66`
              }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: themeColor }}
              />
              <span
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: themeColor, fontFamily: "var(--font-jakarta)" }}
              >
                Panel {typeLabel}
              </span>
            </div>
            <h1
              className="text-3xl font-bold text-white"
              style={{ fontFamily: "var(--font-jakarta)" }}
            >
              {counter.name}
            </h1>
            <p
              className="text-sm mt-1"
              style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-jakarta)" }}
            >
              {typeLabel} #{counter.number} · Aplikasi Antrian SPMB Jatim 2026
            </p>
          </div>

          {error && (
            <div
              className="rounded-xl px-4 py-3 mb-6 flex items-center gap-3"
              style={{
                background: "rgba(239,68,68,0.15)",
                border: "1px solid rgba(239,68,68,0.4)"
              }}
            >
              <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm text-red-300" style={{ fontFamily: "var(--font-jakarta)" }}>
                {error}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Current queue card */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)"
              }}
            >
              <div
                className="px-6 py-4"
                style={{
                  background: `linear-gradient(90deg, ${themeColor}33, ${themeColor}11)`,
                  borderBottom: "1px solid rgba(255,255,255,0.08)"
                }}
              >
                <h2
                  className="text-base font-bold text-white"
                  style={{ fontFamily: "var(--font-jakarta)" }}
                >
                  Antrian Saat Ini
                </h2>
              </div>

              <div className="p-6">
                {counter.currentQueue && completedQueueId !== counter.currentQueue.id ? (
                  <div>
                    <div
                      className={`rounded-2xl p-6 text-center mb-5 ${justCalledQueueId === counter.currentQueue.id ? "animate-pulse-called" : ""}`}
                      style={{
                        background: `${themeColor}11`,
                        border: `1px solid ${themeColor}44`
                      }}
                    >
                      <p
                        className="text-xs uppercase tracking-widest mb-2"
                        style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-jakarta)" }}
                      >
                        Nomor Antrian
                      </p>
                      <div
                        className="text-7xl font-bold mb-3"
                        style={{
                          fontFamily: "var(--font-oswald)",
                          color: themeColor
                        }}
                      >
                        {String(counter.currentQueue.number).padStart(3, "0")}
                      </div>
                      <span
                        className="inline-block px-3 py-1 rounded-full text-xs font-bold"
                        style={{
                          background: counter.currentQueue.status === "CALLED" ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.2)",
                          color: counter.currentQueue.status === "CALLED" ? "#F59E0B" : "#10B981",
                          fontFamily: "var(--font-jakarta)"
                        }}
                      >
                        {counter.currentQueue.status === "CALLED" ? "Dipanggil" : "Sedang Dilayani"}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        {/* Panggil ulang */}
                        <button
                          onClick={recallCurrentQueue}
                          disabled={recallQueueLoading || !!pendingAction}
                          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-80 disabled:opacity-50"
                          style={{
                            background: "rgba(245,158,11,0.3)",
                            border: "1px solid rgba(245,158,11,0.5)",
                            fontFamily: "var(--font-jakarta)"
                          }}
                        >
                          {recallQueueLoading ? (
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                          )}
                          Panggil Ulang
                        </button>

                        {/* Selesai / Lolos Verifikasi */}
                        <button
                          onClick={() => completeCurrentQueue(isVerifikator)}
                          disabled={!!pendingAction}
                          className={`px-4 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-80 disabled:opacity-50 ${themeBg}`}
                          style={{ fontFamily: "var(--font-jakarta)" }}
                        >
                          {pendingAction === "complete" ? (
                            <span className="flex items-center justify-center gap-2">
                              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Memproses...
                            </span>
                          ) : isVerifikator ? "Lolos Verifikasi ✓" : "Selesai"}
                        </button>
                      </div>

                      {/* Tolak Berkas — hanya untuk verifikator */}
                      {isVerifikator && (
                        <button
                          onClick={() => completeCurrentQueue(false)}
                          disabled={!!pendingAction}
                          className="w-full px-4 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-80 disabled:opacity-50"
                          style={{
                            background: "rgba(239,68,68,0.25)",
                            border: "1px solid rgba(239,68,68,0.5)",
                            fontFamily: "var(--font-jakarta)"
                          }}
                        >
                          {pendingAction === "reject" ? (
                            <span className="flex items-center justify-center gap-2">
                              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Memproses...
                            </span>
                          ) : "Tolak Berkas ✗"}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-4 space-y-4">
                    {/* Issued operator number — shown here because currentQueue is cleared optimistically */}
                    {issuedOperatorNumber && (
                      <div
                        className="rounded-xl p-4 text-center animate-slide-in"
                        style={{
                          background: "rgba(26,86,219,0.2)",
                          border: "1px solid rgba(59,130,246,0.5)"
                        }}
                      >
                        <p
                          className="text-xs uppercase tracking-widest mb-1"
                          style={{ color: "#93C5FD", fontFamily: "var(--font-jakarta)" }}
                        >
                          No. Antrian Operator Diterbitkan
                        </p>
                        <p
                          className="text-5xl font-bold"
                          style={{ fontFamily: "var(--font-oswald)", color: "#3B82F6" }}
                        >
                          {String(issuedOperatorNumber).padStart(3, "0")}
                        </p>
                        <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-jakarta)" }}>
                          Berikan nomor ini kepada pengunjung
                        </p>
                        <button
                          onClick={() => setIssuedOperatorNumber(null)}
                          className="mt-2 text-xs underline"
                          style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-jakarta)" }}
                        >
                          Tutup
                        </button>
                      </div>
                    )}

                    <div className="text-center py-2">
                      <div
                        className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
                        style={{ background: "rgba(255,255,255,0.05)" }}
                      >
                        <svg className="w-7 h-7" style={{ color: "rgba(255,255,255,0.2)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-jakarta)" }}>
                        Belum ada antrian aktif
                      </p>
                      <button
                        onClick={callNextQueue}
                        disabled={nextQueueLoading || waitingQueues.length === 0}
                        className={`px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-80 disabled:opacity-50 ${themeBg}`}
                        style={{ fontFamily: "var(--font-jakarta)" }}
                      >
                        {nextQueueLoading ? (
                          <span className="flex items-center gap-2">
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Memproses...
                          </span>
                        ) : (
                          "Panggil Berikutnya"
                        )}
                      </button>
                      {waitingQueues.length === 0 && (
                        <p className="text-xs mt-3" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-jakarta)" }}>
                          Tidak ada antrian {typeLabel.toLowerCase()} yang menunggu
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Waiting queues */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)"
              }}
            >
              <div
                className="px-6 py-4 flex items-center justify-between"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  borderBottom: "1px solid rgba(255,255,255,0.08)"
                }}
              >
                <h2
                  className="text-base font-bold text-white"
                  style={{ fontFamily: "var(--font-jakarta)" }}
                >
                  Antrian Menunggu
                </h2>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: `${themeColor}33`,
                    color: themeColor,
                    fontFamily: "var(--font-jakarta)"
                  }}
                >
                  {waitingQueues.length}
                </span>
              </div>

              <div className="p-4 max-h-80 overflow-y-auto">
                {waitingQueues.length > 0 ? (
                  <div className="space-y-2">
                    {waitingQueues.slice(0, 20).map((q) => (
                      <div
                        key={q.id}
                        className="flex items-center gap-3 rounded-xl px-4 py-3"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.07)"
                        }}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
                          style={{
                            background: `${themeColor}22`,
                            color: themeColor,
                            fontFamily: "var(--font-oswald)"
                          }}
                        >
                          {q.number}
                        </div>
                        <div>
                          <p
                            className="text-sm font-medium text-white"
                            style={{ fontFamily: "var(--font-jakarta)" }}
                          >
                            Antrian #{String(q.number).padStart(3, "0")}
                          </p>
                          <p
                            className="text-xs"
                            style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-jakarta)" }}
                          >
                            Menunggu
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <svg
                      className="w-10 h-10 mx-auto mb-3"
                      style={{ color: "rgba(255,255,255,0.15)" }}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p
                      className="text-sm"
                      style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-jakarta)" }}
                    >
                      Tidak ada antrian menunggu
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Call next button (when counter has active queue) */}
          {counter.currentQueue && completedQueueId !== counter.currentQueue.id && (
            <div className="mt-6 text-center">
              <button
                onClick={callNextQueue}
                disabled={nextQueueLoading || waitingQueues.length === 0}
                className={`px-8 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-80 disabled:opacity-50 ${themeBg}`}
                style={{ fontFamily: "var(--font-jakarta)" }}
              >
                Selesaikan dulu untuk memanggil berikutnya
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
