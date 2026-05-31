"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import toast, { Toaster } from "react-hot-toast"
import LoadingSpinner from "../components/LoadingSpinner"
import { useQueueUpdates, useCounterUpdates, QueueUpdateData } from "../../lib/socket-client"

interface Settings {
  id: string
  dailyQueueLimit: number
  startNumber: number
  resetQueueDaily: boolean
  allowSimultaneous: boolean
  videoUrl?: string
}

interface Counter {
  id: string
  name: string
  number: number
  counterType: "OPERATOR" | "VERIFIKATOR"
  isActive: boolean
  currentQueue: Queue | null
}

interface Queue {
  id: string
  number: number
  queueType: "OPERATOR" | "VERIFIKATOR"
  status: string
  counterServingId: string | null
}

type ActiveTab = "dashboard" | "counters" | "settings"

export default function AdminPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [counters, setCounters] = useState<Counter[]>([])
  const [queues, setQueues] = useState<Queue[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard")

  // Settings form
  const [editedSettings, setEditedSettings] = useState<Partial<Settings>>({})
  const [savingSettings, setSavingSettings] = useState(false)

  // Issue verifikator queue
  const [issuingQueue, setIssuingQueue] = useState(false)
  // Issue operator queue manual
  const [issuingOperatorQueue, setIssuingOperatorQueue] = useState(false)

  // Counter form
  const [newCounterName, setNewCounterName] = useState("")
  const [newCounterNumber, setNewCounterNumber] = useState("")
  const [newCounterType, setNewCounterType] = useState<"OPERATOR" | "VERIFIKATOR">("OPERATOR")
  const [addingCounter, setAddingCounter] = useState(false)

  // Edit counter
  const [editingCounter, setEditingCounter] = useState<Counter | null>(null)
  const [editCounterName, setEditCounterName] = useState("")
  const [editCounterNumber, setEditCounterNumber] = useState("")
  const [savingCounter, setSavingCounter] = useState(false)

  const fetchAll = useCallback(async () => {
    try {
      const [sRes, cRes, qRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/counters"),
        fetch("/api/queues")
      ])
      if (sRes.ok) setSettings(await sRes.json())
      if (cRes.ok) setCounters(await cRes.json())
      if (qRes.ok) setQueues(await qRes.json())
    } catch (err) {
      console.error("Error fetching data:", err)
      toast.error("Gagal memuat data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 5000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleQueueUpdate = useCallback((data: QueueUpdateData) => {
    if (data.type === "QUEUES_RESET") {
      setQueues([])
      setCounters((prev) => prev.map((c) => ({ ...c, currentQueue: null })))
      return
    }
    if (!data.queue) return
    const q = data.queue
    setQueues((prev) => {
      const idx = prev.findIndex((item) => item.id === q.id)
      const updated = { ...q, queueType: (q as Queue).queueType || "OPERATOR" } as Queue
      if (idx !== -1) return prev.map((item) => item.id === q.id ? updated : item)
      if (data.type === "QUEUE_CREATED") return [...prev, updated]
      return prev
    })
    if (data.counter) {
      setCounters((prev) =>
        prev.map((c) =>
          c.id === data.counter!.id
            ? { ...c, currentQueue: data.type === "QUEUE_COMPLETED" ? null : (q as Queue) }
            : c
        )
      )
    }
  }, [])

  const handleCounterUpdate = useCallback(() => {
    fetchAll()
  }, [fetchAll])

  useQueueUpdates(handleQueueUpdate)
  useCounterUpdates(handleCounterUpdate)

  const issueOperatorQueue = async () => {
    setIssuingOperatorQueue(true)
    try {
      const res = await fetch("/api/queues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueType: "OPERATOR" })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal menambahkan antrian")
      setQueues((prev) => prev.some((q) => q.id === data.id) ? prev : [...prev, data])
      toast.success(`Nomor antrian Operator ${data.number} berhasil diterbitkan`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menambahkan antrian")
    } finally {
      setIssuingOperatorQueue(false)
    }
  }

  const issueVerifikatorQueue = async () => {
    setIssuingQueue(true)
    try {
      const res = await fetch("/api/queues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueType: "VERIFIKATOR" })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal menambahkan antrian")
      // Tambahkan ke state hanya jika belum ada (socket event mungkin sudah menambahkan lebih cepat)
      setQueues((prev) => prev.some((q) => q.id === data.id) ? prev : [...prev, data])
      toast.success(`Nomor antrian Verifikator ${data.number} berhasil diterbitkan`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menambahkan antrian")
    } finally {
      setIssuingQueue(false)
    }
  }

  const saveSettings = async () => {
    if (!settings) return
    setSavingSettings(true)
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          ...editedSettings
        })
      })
      if (!res.ok) throw new Error("Gagal menyimpan pengaturan")
      const updated = await res.json()
      setSettings(updated)
      setEditedSettings({})
      toast.success("Pengaturan berhasil disimpan")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan")
    } finally {
      setSavingSettings(false)
    }
  }

  const addCounter = async () => {
    if (!newCounterName.trim() || !newCounterNumber) {
      toast.error("Nama dan nomor loket harus diisi")
      return
    }
    setAddingCounter(true)
    try {
      const res = await fetch("/api/counters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCounterName.trim(),
          number: parseInt(newCounterNumber),
          counterType: newCounterType
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal menambahkan loket")
      setCounters((prev) => [...prev, data])
      setNewCounterName("")
      setNewCounterNumber("")
      toast.success(`Loket ${newCounterType === "VERIFIKATOR" ? "Verifikator" : "Operator"} berhasil ditambahkan`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menambahkan loket")
    } finally {
      setAddingCounter(false)
    }
  }

  const saveCounter = async () => {
    if (!editingCounter || !editCounterName.trim() || !editCounterNumber) return
    setSavingCounter(true)
    try {
      const res = await fetch(`/api/counters/${editingCounter.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editCounterName.trim(),
          number: parseInt(editCounterNumber),
          counterType: editingCounter.counterType
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan")
      setCounters((prev) => prev.map((c) => c.id === editingCounter.id ? { ...c, ...data } : c))
      setEditingCounter(null)
      toast.success("Loket berhasil diperbarui")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan")
    } finally {
      setSavingCounter(false)
    }
  }

  const setupDefault = async () => {
    if (!confirm("Buat 10 loket Operator + 5 loket Verifikator secara otomatis? Loket yang sudah ada akan dilewati.")) return
    const tasks: Array<{ name: string; number: number; counterType: "OPERATOR" | "VERIFIKATOR" }> = [
      ...Array.from({ length: 10 }, (_, i) => ({ name: `Operator ${i + 1}`, number: i + 1, counterType: "OPERATOR" as const })),
      ...Array.from({ length: 5 }, (_, i) => ({ name: `Verifikator ${i + 1}`, number: i + 1, counterType: "VERIFIKATOR" as const }))
    ]
    let created = 0
    let skipped = 0
    for (const task of tasks) {
      const res = await fetch("/api/counters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(task)
      })
      if (res.ok) created++
      else skipped++
    }
    await fetchAll()
    toast.success(`Setup selesai: ${created} loket dibuat, ${skipped} dilewati`)
  }

  const deleteCounter = async (id: string, name: string) => {
    if (!confirm(`Hapus loket "${name}"?`)) return
    try {
      const res = await fetch(`/api/counters/${id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal menghapus")
      setCounters((prev) => prev.filter((c) => c.id !== id))
      toast.success("Loket berhasil dihapus")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus")
    }
  }

  const resetQueues = async () => {
    if (!confirm("Reset semua antrian hari ini? Tindakan ini tidak dapat dibatalkan.")) return
    try {
      const res = await fetch("/api/queues/reset", { method: "POST" })
      if (!res.ok) throw new Error("Gagal reset antrian")
      setQueues([])
      toast.success("Antrian berhasil direset")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal reset")
    }
  }

  if (loading) return <LoadingSpinner fullScreen message="Memuat panel admin..." />

  const operatorCounters = counters.filter((c) => c.counterType === "OPERATOR")
  const verifikatorCounters = counters.filter((c) => c.counterType === "VERIFIKATOR")
  const waitingOp = queues.filter((q) => q.status === "WAITING" && q.queueType === "OPERATOR").length
  const waitingVr = queues.filter((q) => q.status === "WAITING" && q.queueType === "VERIFIKATOR").length
  const activeOp = queues.filter((q) => (q.status === "CALLED" || q.status === "SERVING") && q.queueType === "OPERATOR").length
  const activeVr = queues.filter((q) => (q.status === "CALLED" || q.status === "SERVING") && q.queueType === "VERIFIKATOR").length
  const completedOp = queues.filter((q) => q.status === "COMPLETED" && q.queueType === "OPERATOR").length
  const completedVr = queues.filter((q) => q.status === "COMPLETED" && q.queueType === "VERIFIKATOR").length

  // Nomor verifikator terakhir diterbitkan — diambil dari data queues (otomatis benar setelah refresh)
  const lastIssuedVerifikator = queues
    .filter((q) => q.queueType === "VERIFIKATOR")
    .reduce<number | null>((max, q) => (max === null || q.number > max ? q.number : max), null)

  // Nomor operator terakhir diterbitkan
  const lastIssuedOperator = queues
    .filter((q) => q.queueType === "OPERATOR")
    .reduce<number | null>((max, q) => (max === null || q.number > max ? q.number : max), null)

  const inputStyle = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.15)",
    color: "white",
    fontFamily: "var(--font-jakarta)"
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(160deg, #0A1628 0%, #0D1F35 100%)" }}
    >
      <Toaster position="top-right" />

      {/* Header */}
      <header
        className="sticky top-0 z-30 px-6 py-3"
        style={{
          background: "rgba(10,22,40,0.95)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.08)"
        }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #1A56DB, #3B82F6)" }}
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </div>
            <div>
              <p className="text-white font-bold text-sm" style={{ fontFamily: "var(--font-jakarta)" }}>
                Admin Panel
              </p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-jakarta)" }}>
                SPMB Jatim 2026 · SMAN 10 Surabaya
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/display"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
              style={{
                background: "rgba(59,130,246,0.2)",
                border: "1px solid rgba(59,130,246,0.4)",
                color: "#93C5FD",
                fontFamily: "var(--font-jakarta)"
              }}
            >
              Display Antrian
            </Link>
            <Link
              href="/"
              className="text-xs transition-colors"
              style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-jakarta)" }}
            >
              Beranda
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 pb-12">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl overflow-x-auto" style={{ background: "rgba(255,255,255,0.05)" }}>
          {(["dashboard", "counters", "settings"] as ActiveTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-5 py-2 rounded-lg text-sm font-semibold capitalize transition-all"
              style={{
                background: activeTab === tab ? "rgba(26,86,219,0.8)" : "transparent",
                color: activeTab === tab ? "white" : "rgba(255,255,255,0.5)",
                fontFamily: "var(--font-jakarta)"
              }}
            >
              {tab === "dashboard" ? "Dashboard" : tab === "counters" ? "Kelola Loket" : "Pengaturan"}
            </button>
          ))}
        </div>

        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: "Menunggu (Op)", value: waitingOp, color: "#3B82F6" },
                { label: "Aktif (Op)", value: activeOp, color: "#F59E0B" },
                { label: "Selesai (Op)", value: completedOp, color: "#10B981" },
                { label: "Menunggu (Vr)", value: waitingVr, color: "#14B8A6" },
                { label: "Aktif (Vr)", value: activeVr, color: "#F59E0B" },
                { label: "Selesai (Vr)", value: completedVr, color: "#10B981" }
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl p-4"
                  style={{
                    background: `${stat.color}11`,
                    border: `1px solid ${stat.color}33`
                  }}
                >
                  <div
                    className="text-3xl font-bold mb-1"
                    style={{ fontFamily: "var(--font-oswald)", color: stat.color }}
                  >
                    {stat.value}
                  </div>
                  <div
                    className="text-xs"
                    style={{ color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-jakarta)" }}
                  >
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Issue verifikator queue */}
            <div
              className="rounded-2xl p-6"
              style={{
                background: "rgba(13,148,136,0.08)",
                border: "1px solid rgba(20,184,166,0.3)"
              }}
            >
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#14B8A6" }} />
                    <span
                      className="text-xs font-bold uppercase tracking-widest"
                      style={{ color: "#5EEAD4", fontFamily: "var(--font-jakarta)" }}
                    >
                      Antrian Verifikator
                    </span>
                  </div>
                  <h3
                    className="text-lg font-bold text-white mb-1"
                    style={{ fontFamily: "var(--font-jakarta)" }}
                  >
                    Tambah Nomor Antrian
                  </h3>
                  <p
                    className="text-sm"
                    style={{ color: "rgba(255,255,255,0.45)", fontFamily: "var(--font-jakarta)" }}
                  >
                    Klik setiap kali memberikan kartu antrian kepada pengunjung. Antrian operator akan otomatis bertambah saat verifikator selesai melayani.
                  </p>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  {lastIssuedVerifikator && (
                    <div className="text-center">
                      <p
                        className="text-xs uppercase tracking-widest mb-1"
                        style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-jakarta)" }}
                      >
                        Terakhir
                      </p>
                      <div
                        className="text-4xl font-bold"
                        style={{ fontFamily: "var(--font-oswald)", color: "#5EEAD4" }}
                      >
                        {String(lastIssuedVerifikator).padStart(3, "0")}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={issueVerifikatorQueue}
                    disabled={issuingQueue}
                    className="flex flex-col items-center justify-center gap-1 w-28 h-28 rounded-2xl text-white font-bold transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                    style={{
                      background: issuingQueue
                        ? "rgba(13,148,136,0.3)"
                        : "linear-gradient(135deg, #0F766E, #0D9488)",
                      border: "1px solid rgba(20,184,166,0.5)",
                      boxShadow: "0 0 30px rgba(13,148,136,0.3)",
                      fontFamily: "var(--font-jakarta)"
                    }}
                  >
                    {issuingQueue ? (
                      <svg className="w-7 h-7 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <>
                        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span className="text-sm">Tambah</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Issue operator queue manual */}
            <div
              className="rounded-2xl p-6"
              style={{
                background: "rgba(26,86,219,0.08)",
                border: "1px solid rgba(59,130,246,0.3)"
              }}
            >
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#3B82F6" }} />
                    <span
                      className="text-xs font-bold uppercase tracking-widest"
                      style={{ color: "#93C5FD", fontFamily: "var(--font-jakarta)" }}
                    >
                      Antrian Operator — Manual
                    </span>
                  </div>
                  <h3
                    className="text-lg font-bold text-white mb-1"
                    style={{ fontFamily: "var(--font-jakarta)" }}
                  >
                    Tambah Nomor Antrian Operator
                  </h3>
                  <p
                    className="text-sm"
                    style={{ color: "rgba(255,255,255,0.45)", fontFamily: "var(--font-jakarta)" }}
                  >
                    Gunakan jika ada pengunjung yang perlu langsung masuk antrian operator tanpa melewati verifikator, atau sebagai koreksi manual.
                  </p>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  {lastIssuedOperator && (
                    <div className="text-center">
                      <p
                        className="text-xs uppercase tracking-widest mb-1"
                        style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-jakarta)" }}
                      >
                        Terakhir
                      </p>
                      <div
                        className="text-4xl font-bold"
                        style={{ fontFamily: "var(--font-oswald)", color: "#93C5FD" }}
                      >
                        {String(lastIssuedOperator).padStart(3, "0")}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={issueOperatorQueue}
                    disabled={issuingOperatorQueue}
                    className="flex flex-col items-center justify-center gap-1 w-28 h-28 rounded-2xl text-white font-bold transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                    style={{
                      background: issuingOperatorQueue
                        ? "rgba(26,86,219,0.3)"
                        : "linear-gradient(135deg, #1D4ED8, #1A56DB)",
                      border: "1px solid rgba(59,130,246,0.5)",
                      boxShadow: "0 0 30px rgba(26,86,219,0.3)",
                      fontFamily: "var(--font-jakarta)"
                    }}
                  >
                    {issuingOperatorQueue ? (
                      <svg className="w-7 h-7 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <>
                        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span className="text-sm">Tambah</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Counter status */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Operators */}
              <div
                className="rounded-2xl overflow-hidden"
                style={{ border: "1px solid rgba(59,130,246,0.3)" }}
              >
                <div
                  className="px-5 py-3 flex items-center gap-2"
                  style={{
                    background: "linear-gradient(90deg, rgba(26,86,219,0.5), rgba(26,86,219,0.15))",
                    borderBottom: "1px solid rgba(59,130,246,0.3)"
                  }}
                >
                  <div className="w-2 h-2 rounded-full" style={{ background: "#3B82F6", boxShadow: "0 0 6px #3B82F6" }} />
                  <span className="text-sm font-bold text-white" style={{ fontFamily: "var(--font-jakarta)" }}>
                    Status Operator ({operatorCounters.length}/10)
                  </span>
                </div>
                <div className="p-4 space-y-2">
                  {operatorCounters.length === 0 ? (
                    <p className="text-sm text-center py-4" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-jakarta)" }}>
                      Belum ada loket operator
                    </p>
                  ) : (
                    operatorCounters.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between rounded-lg px-3 py-2"
                        style={{ background: "rgba(255,255,255,0.04)" }}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold"
                            style={{ background: "rgba(59,130,246,0.2)", color: "#93C5FD", fontFamily: "var(--font-oswald)" }}
                          >
                            {c.number}
                          </span>
                          <span className="text-sm text-white" style={{ fontFamily: "var(--font-jakarta)" }}>
                            {c.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {c.currentQueue && (
                            <span
                              className="text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{ background: "rgba(245,158,11,0.2)", color: "#F59E0B", fontFamily: "var(--font-jakarta)" }}
                            >
                              #{c.currentQueue.number}
                            </span>
                          )}
                          <Link
                            href={`/loket/${c.id}`}
                            className="text-xs px-2 py-1 rounded-lg transition-all hover:opacity-80"
                            style={{
                              background: "rgba(26,86,219,0.3)",
                              color: "#93C5FD",
                              fontFamily: "var(--font-jakarta)"
                            }}
                          >
                            Buka
                          </Link>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Verifikators */}
              <div
                className="rounded-2xl overflow-hidden"
                style={{ border: "1px solid rgba(20,184,166,0.3)" }}
              >
                <div
                  className="px-5 py-3 flex items-center gap-2"
                  style={{
                    background: "linear-gradient(90deg, rgba(13,148,136,0.5), rgba(13,148,136,0.15))",
                    borderBottom: "1px solid rgba(20,184,166,0.3)"
                  }}
                >
                  <div className="w-2 h-2 rounded-full" style={{ background: "#14B8A6", boxShadow: "0 0 6px #14B8A6" }} />
                  <span className="text-sm font-bold text-white" style={{ fontFamily: "var(--font-jakarta)" }}>
                    Status Verifikator ({verifikatorCounters.length}/5)
                  </span>
                </div>
                <div className="p-4 space-y-2">
                  {verifikatorCounters.length === 0 ? (
                    <p className="text-sm text-center py-4" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-jakarta)" }}>
                      Belum ada loket verifikator
                    </p>
                  ) : (
                    verifikatorCounters.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between rounded-lg px-3 py-2"
                        style={{ background: "rgba(255,255,255,0.04)" }}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold"
                            style={{ background: "rgba(20,184,166,0.2)", color: "#5EEAD4", fontFamily: "var(--font-oswald)" }}
                          >
                            V{c.number}
                          </span>
                          <span className="text-sm text-white" style={{ fontFamily: "var(--font-jakarta)" }}>
                            {c.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {c.currentQueue && (
                            <span
                              className="text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{ background: "rgba(245,158,11,0.2)", color: "#F59E0B", fontFamily: "var(--font-jakarta)" }}
                            >
                              #{c.currentQueue.number}
                            </span>
                          )}
                          <Link
                            href={`/loket/${c.id}`}
                            className="text-xs px-2 py-1 rounded-lg transition-all hover:opacity-80"
                            style={{
                              background: "rgba(13,148,136,0.3)",
                              color: "#5EEAD4",
                              fontFamily: "var(--font-jakarta)"
                            }}
                          >
                            Buka
                          </Link>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Reset button */}
            <div className="flex justify-end">
              <button
                onClick={resetQueues}
                className="px-5 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
                style={{
                  background: "rgba(239,68,68,0.2)",
                  border: "1px solid rgba(239,68,68,0.4)",
                  color: "#FCA5A5",
                  fontFamily: "var(--font-jakarta)"
                }}
              >
                Reset Semua Antrian Hari Ini
              </button>
            </div>
          </div>
        )}

        {/* Counters Tab */}
        {activeTab === "counters" && (
          <div className="space-y-6">
            {/* Add counter form */}
            <div
              className="rounded-2xl p-6"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)"
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2
                  className="text-base font-bold text-white"
                  style={{ fontFamily: "var(--font-jakarta)" }}
                >
                  Tambah Loket Baru
                </h2>
                <button
                  onClick={setupDefault}
                  className="px-4 py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                  style={{
                    background: "rgba(245,158,11,0.2)",
                    border: "1px solid rgba(245,158,11,0.4)",
                    color: "#FCD34D",
                    fontFamily: "var(--font-jakarta)"
                  }}
                >
                  Setup Default (10 Op + 5 Vr)
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <select
                  value={newCounterType}
                  onChange={(e) => setNewCounterType(e.target.value as "OPERATOR" | "VERIFIKATOR")}
                  className="px-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle}
                >
                  <option value="OPERATOR" style={{ background: "#0D1F35" }}>Operator</option>
                  <option value="VERIFIKATOR" style={{ background: "#0D1F35" }}>Verifikator</option>
                </select>
                <input
                  type="number"
                  min="1"
                  value={newCounterNumber}
                  onChange={(e) => setNewCounterNumber(e.target.value)}
                  placeholder={newCounterType === "VERIFIKATOR" ? "Nomor (1-5)" : "Nomor (1-10)"}
                  className="px-3 py-2 rounded-lg text-sm outline-none placeholder-gray-500"
                  style={inputStyle}
                />
                <input
                  type="text"
                  value={newCounterName}
                  onChange={(e) => setNewCounterName(e.target.value)}
                  placeholder={`Nama loket (e.g. ${newCounterType === "VERIFIKATOR" ? "Verifikator 1" : "Operator 1"})`}
                  className="px-3 py-2 rounded-lg text-sm outline-none placeholder-gray-500"
                  style={inputStyle}
                />
                <button
                  onClick={addCounter}
                  disabled={addingCounter}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-80 disabled:opacity-50"
                  style={{
                    background: newCounterType === "VERIFIKATOR"
                      ? "linear-gradient(135deg, #0F766E, #0D9488)"
                      : "linear-gradient(135deg, #1D4ED8, #1A56DB)",
                    fontFamily: "var(--font-jakarta)"
                  }}
                >
                  {addingCounter ? "Menambahkan..." : "Tambah"}
                </button>
              </div>
            </div>

            {/* Operator list */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ border: "1px solid rgba(59,130,246,0.3)" }}
            >
              <div
                className="px-5 py-3"
                style={{
                  background: "linear-gradient(90deg, rgba(26,86,219,0.4), rgba(26,86,219,0.1))",
                  borderBottom: "1px solid rgba(59,130,246,0.3)"
                }}
              >
                <span className="text-sm font-bold text-white" style={{ fontFamily: "var(--font-jakarta)" }}>
                  Loket Operator ({operatorCounters.length}/10)
                </span>
              </div>
              <div className="p-4 space-y-2">
                {operatorCounters.length === 0 ? (
                  <p className="text-sm text-center py-6" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-jakarta)" }}>
                    Belum ada loket operator. Tambahkan di atas.
                  </p>
                ) : (
                  operatorCounters.map((c) => (
                    <div key={c.id}>
                      {editingCounter?.id === c.id ? (
                        <div
                          className="flex items-center gap-2 rounded-xl p-3"
                          style={{ background: "rgba(26,86,219,0.15)", border: "1px solid rgba(59,130,246,0.4)" }}
                        >
                          <input
                            type="number"
                            value={editCounterNumber}
                            onChange={(e) => setEditCounterNumber(e.target.value)}
                            className="w-16 px-2 py-1.5 rounded-lg text-sm outline-none"
                            style={inputStyle}
                          />
                          <input
                            type="text"
                            value={editCounterName}
                            onChange={(e) => setEditCounterName(e.target.value)}
                            className="flex-1 px-2 py-1.5 rounded-lg text-sm outline-none"
                            style={inputStyle}
                          />
                          <button
                            onClick={saveCounter}
                            disabled={savingCounter}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                            style={{ background: "#1A56DB", fontFamily: "var(--font-jakarta)" }}
                          >
                            {savingCounter ? "..." : "Simpan"}
                          </button>
                          <button
                            onClick={() => setEditingCounter(null)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                            style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", fontFamily: "var(--font-jakarta)" }}
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <div
                          className="flex items-center justify-between rounded-xl px-4 py-3"
                          style={{ background: "rgba(255,255,255,0.04)" }}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                              style={{ background: "rgba(59,130,246,0.2)", color: "#93C5FD", fontFamily: "var(--font-oswald)" }}
                            >
                              {c.number}
                            </span>
                            <div>
                              <p className="text-sm font-medium text-white" style={{ fontFamily: "var(--font-jakarta)" }}>
                                {c.name}
                              </p>
                              <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-jakarta)" }}>
                                {c.currentQueue ? `Melayani #${c.currentQueue.number}` : "Menunggu"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/loket/${c.id}`}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                              style={{ background: "rgba(26,86,219,0.3)", color: "#93C5FD", fontFamily: "var(--font-jakarta)" }}
                            >
                              Buka
                            </Link>
                            <button
                              onClick={() => { setEditingCounter(c); setEditCounterName(c.name); setEditCounterNumber(String(c.number)) }}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                              style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", fontFamily: "var(--font-jakarta)" }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteCounter(c.id, c.name)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                              style={{ background: "rgba(239,68,68,0.2)", color: "#FCA5A5", fontFamily: "var(--font-jakarta)" }}
                            >
                              Hapus
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Verifikator list */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ border: "1px solid rgba(20,184,166,0.3)" }}
            >
              <div
                className="px-5 py-3"
                style={{
                  background: "linear-gradient(90deg, rgba(13,148,136,0.4), rgba(13,148,136,0.1))",
                  borderBottom: "1px solid rgba(20,184,166,0.3)"
                }}
              >
                <span className="text-sm font-bold text-white" style={{ fontFamily: "var(--font-jakarta)" }}>
                  Loket Verifikator ({verifikatorCounters.length}/5)
                </span>
              </div>
              <div className="p-4 space-y-2">
                {verifikatorCounters.length === 0 ? (
                  <p className="text-sm text-center py-6" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-jakarta)" }}>
                    Belum ada loket verifikator. Tambahkan di atas.
                  </p>
                ) : (
                  verifikatorCounters.map((c) => (
                    <div key={c.id}>
                      {editingCounter?.id === c.id ? (
                        <div
                          className="flex items-center gap-2 rounded-xl p-3"
                          style={{ background: "rgba(13,148,136,0.15)", border: "1px solid rgba(20,184,166,0.4)" }}
                        >
                          <input
                            type="number"
                            value={editCounterNumber}
                            onChange={(e) => setEditCounterNumber(e.target.value)}
                            className="w-16 px-2 py-1.5 rounded-lg text-sm outline-none"
                            style={inputStyle}
                          />
                          <input
                            type="text"
                            value={editCounterName}
                            onChange={(e) => setEditCounterName(e.target.value)}
                            className="flex-1 px-2 py-1.5 rounded-lg text-sm outline-none"
                            style={inputStyle}
                          />
                          <button
                            onClick={saveCounter}
                            disabled={savingCounter}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                            style={{ background: "#0D9488", fontFamily: "var(--font-jakarta)" }}
                          >
                            {savingCounter ? "..." : "Simpan"}
                          </button>
                          <button
                            onClick={() => setEditingCounter(null)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                            style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", fontFamily: "var(--font-jakarta)" }}
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <div
                          className="flex items-center justify-between rounded-xl px-4 py-3"
                          style={{ background: "rgba(255,255,255,0.04)" }}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                              style={{ background: "rgba(20,184,166,0.2)", color: "#5EEAD4", fontFamily: "var(--font-oswald)" }}
                            >
                              V{c.number}
                            </span>
                            <div>
                              <p className="text-sm font-medium text-white" style={{ fontFamily: "var(--font-jakarta)" }}>
                                {c.name}
                              </p>
                              <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-jakarta)" }}>
                                {c.currentQueue ? `Melayani #${c.currentQueue.number}` : "Menunggu"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/loket/${c.id}`}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                              style={{ background: "rgba(13,148,136,0.3)", color: "#5EEAD4", fontFamily: "var(--font-jakarta)" }}
                            >
                              Buka
                            </Link>
                            <button
                              onClick={() => { setEditingCounter(c); setEditCounterName(c.name); setEditCounterNumber(String(c.number)) }}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                              style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", fontFamily: "var(--font-jakarta)" }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteCounter(c.id, c.name)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                              style={{ background: "rgba(239,68,68,0.2)", color: "#FCA5A5", fontFamily: "var(--font-jakarta)" }}
                            >
                              Hapus
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && settings && (
          <div
            className="rounded-2xl p-6 max-w-2xl"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)"
            }}
          >
            <h2
              className="text-base font-bold text-white mb-6"
              style={{ fontFamily: "var(--font-jakarta)" }}
            >
              Pengaturan Sistem
            </h2>

            <div className="space-y-5">
              {/* Video URL */}
              <div>
                <label
                  className="block text-sm font-semibold mb-2"
                  style={{ color: "rgba(255,255,255,0.7)", fontFamily: "var(--font-jakarta)" }}
                >
                  URL Video YouTube (tampil di Display)
                </label>
                <input
                  type="text"
                  value={
                    editedSettings.videoUrl !== undefined
                      ? editedSettings.videoUrl
                      : settings.videoUrl || ""
                  }
                  onChange={(e) =>
                    setEditedSettings((prev) => ({ ...prev, videoUrl: e.target.value }))
                  }
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none placeholder-gray-600"
                  style={inputStyle}
                />
                <p
                  className="text-xs mt-1"
                  style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-jakarta)" }}
                >
                  Masukkan URL YouTube (watch, youtu.be, atau embed). Perubahan langsung tampil di display.
                </p>
              </div>

              {/* Daily queue limit */}
              <div>
                <label
                  className="block text-sm font-semibold mb-2"
                  style={{ color: "rgba(255,255,255,0.7)", fontFamily: "var(--font-jakarta)" }}
                >
                  Batas Antrian Harian (per tipe)
                </label>
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={
                    editedSettings.dailyQueueLimit !== undefined
                      ? editedSettings.dailyQueueLimit
                      : settings.dailyQueueLimit
                  }
                  onChange={(e) =>
                    setEditedSettings((prev) => ({
                      ...prev,
                      dailyQueueLimit: parseInt(e.target.value) || 200
                    }))
                  }
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={inputStyle}
                />
              </div>

              {/* Start number */}
              <div>
                <label
                  className="block text-sm font-semibold mb-2"
                  style={{ color: "rgba(255,255,255,0.7)", fontFamily: "var(--font-jakarta)" }}
                >
                  Nomor Antrian Awal
                </label>
                <input
                  type="number"
                  min="1"
                  value={
                    editedSettings.startNumber !== undefined
                      ? editedSettings.startNumber
                      : settings.startNumber
                  }
                  onChange={(e) =>
                    setEditedSettings((prev) => ({
                      ...prev,
                      startNumber: parseInt(e.target.value) || 1
                    }))
                  }
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={inputStyle}
                />
              </div>

              {/* Toggles */}
              {[
                { key: "resetQueueDaily" as keyof Settings, label: "Reset antrian otomatis setiap hari" },
                { key: "allowSimultaneous" as keyof Settings, label: "Izinkan loket memanggil bersamaan" }
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <label
                    className="text-sm font-semibold"
                    style={{ color: "rgba(255,255,255,0.7)", fontFamily: "var(--font-jakarta)" }}
                  >
                    {label}
                  </label>
                  <button
                    onClick={() =>
                      setEditedSettings((prev) => ({
                        ...prev,
                        [key]: !(editedSettings[key] !== undefined
                          ? editedSettings[key]
                          : settings[key])
                      }))
                    }
                    className="relative w-12 h-6 rounded-full transition-all"
                    style={{
                      background: (editedSettings[key] !== undefined ? editedSettings[key] : settings[key])
                        ? "#1A56DB"
                        : "rgba(255,255,255,0.15)"
                    }}
                  >
                    <div
                      className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                      style={{
                        left: (editedSettings[key] !== undefined ? editedSettings[key] : settings[key])
                          ? "calc(100% - 1.375rem)"
                          : "0.125rem"
                      }}
                    />
                  </button>
                </div>
              ))}

              {/* Save button */}
              <div className="pt-2">
                <button
                  onClick={saveSettings}
                  disabled={savingSettings || Object.keys(editedSettings).length === 0}
                  className="w-full px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                  style={{
                    background: "linear-gradient(135deg, #1D4ED8, #1A56DB)",
                    fontFamily: "var(--font-jakarta)"
                  }}
                >
                  {savingSettings ? "Menyimpan..." : "Simpan Pengaturan"}
                </button>
                {Object.keys(editedSettings).length === 0 && (
                  <p
                    className="text-xs text-center mt-2"
                    style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-jakarta)" }}
                  >
                    Tidak ada perubahan
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
