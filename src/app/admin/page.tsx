"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import toast, { Toaster } from "react-hot-toast"
import LoadingSpinner from "../components/LoadingSpinner"
import {
  useQueueUpdates,
  QueueUpdateData,
  useCounterUpdates
} from "../../lib/socket-client"

// Tipe data untuk pengaturan
interface Settings {
  id: string
  dailyQueueLimit: number
  startNumber: number
  resetQueueDaily: boolean
  allowSimultaneous: boolean
  videoUrl?: string
}

// Tipe data untuk meja
interface Counter {
  id: string
  name: string
  number: number
  isActive: boolean
  currentQueue: Queue | null
}

// Tipe data untuk antrean
interface Queue {
  id: string
  number: number
  status: string
  counterServingId: string | null
}

// Tipe data untuk counter update events
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

export default function AdminPage() {
  // State untuk pengaturan
  const [settings, setSettings] = useState<Settings | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [counters, setCounters] = useState<Counter[]>([])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [queues, setQueues] = useState<Queue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newCounter, setNewCounter] = useState({ name: "", number: 0 })
  const [editingCounter, setEditingCounter] = useState<Counter | null>(null)

  // Pengaturan yang diubah
  const [editedSettings, setEditedSettings] = useState<Partial<Settings>>({})

  // Fungsi untuk mengambil data pengaturan
  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/settings")
      if (response.ok) {
        const data = await response.json()
        setSettings(data)
        setEditedSettings({})
      }
    } catch (err) {
      console.error("Error fetching settings:", err)
      setError("Gagal memuat pengaturan")
    }
  }

  // Define fetchCounters and fetchQueues with useCallback
  const fetchCountersCallback = useCallback(async () => {
    try {
      const response = await fetch("/api/counters")
      if (response.ok) {
        const data = await response.json()
        setCounters(data)
      }
    } catch (err) {
      console.error("Error fetching counters:", err)
      setError("Gagal memuat data operator")
    }
  }, [])

  const fetchQueuesCallback = useCallback(async () => {
    try {
      const response = await fetch("/api/queues")
      if (response.ok) {
        const data = await response.json()
        setQueues(data)
      }
    } catch (err) {
      console.error("Error fetching queues:", err)
      setError("Gagal memuat data antrian")
    } finally {
      setLoading(false)
    }
  }, [])

  // Use the callbacks in the handlers
  const handleQueueUpdateStable = useCallback(
    (data: QueueUpdateData) => {
      console.log("Received queue update in admin page:", data)
      fetchQueuesCallback()
    },
    [fetchQueuesCallback]
  )

  const handleCounterUpdateStable = useCallback(
    (data: CounterUpdateData) => {
      console.log("Received counter update in admin page:", data)
      fetchCountersCallback()
    },
    [fetchCountersCallback]
  )

  // Use Socket.io for real-time updates
  const queueSocketConnected = useQueueUpdates(handleQueueUpdateStable)
  const counterSocketConnected = useCounterUpdates(handleCounterUpdateStable)

  // Combined connection status
  const socketConnected = queueSocketConnected || counterSocketConnected

  // Mengambil data saat komponen dimuat
  useEffect(() => {
    fetchSettings()
    fetchCountersCallback()
    fetchQueuesCallback()

    // Setup polling interval as fallback but reduce frequency significantly
    // Only poll if Socket.io is not connected
    const dataInterval = setInterval(() => {
      if (!socketConnected) {
        console.log("💡 Fallback: Polling data (Socket not connected)")
        fetchCountersCallback()
        fetchQueuesCallback()
      }
    }, 30000) // Poll every 30 seconds if Socket.io is not connected

    // Cleanup when component unmounts
    return () => {
      clearInterval(dataInterval)
    }
  }, [socketConnected, fetchCountersCallback, fetchQueuesCallback])

  // Replace the original functions with callbacks for other components to use
  const fetchCounters = fetchCountersCallback
  const fetchQueues = fetchQueuesCallback

  // Menyimpan perubahan pengaturan
  const saveSettings = async () => {
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(editedSettings)
      })

      if (response.ok) {
        await fetchSettings()
        setError(null)
        toast.success("Pengaturan berhasil disimpan")
      } else {
        const data = await response.json()
        throw new Error(data.error || "Gagal menyimpan pengaturan")
      }
    } catch (err: unknown) {
      console.error("Error saving settings:", err)
      const errorMessage =
        err instanceof Error ? err.message : "Gagal menyimpan pengaturan"
      setError(errorMessage)
      toast.error(errorMessage)
    }
  }

  // Membuat operator baru
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const createCounter = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newCounter.name.trim()) {
      toast.error("Nama operator tidak boleh kosong")
      return
    }

    try {
      const response = await fetch("/api/counters", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(newCounter)
      })

      if (response.ok) {
        setNewCounter({ name: "", number: 0 })
        await fetchCounters()
        setError(null)
        toast.success("Operator berhasil ditambahkan")
      } else {
        const data = await response.json()
        throw new Error(data.error || "Gagal membuat operator")
      }
    } catch (err: unknown) {
      console.error("Error creating counter:", err)
      const errorMessage =
        err instanceof Error ? err.message : "Gagal membuat operator"
      setError(errorMessage)
      toast.error(errorMessage)
    }
  }

  // Membuat antrean baru
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const createQueue = async () => {
    try {
      const response = await fetch("/api/queues", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      })

      if (response.ok) {
        await fetchQueues()
        setError(null)
        toast.success("Nomor antrean berhasil diambil")
      } else {
        const data = await response.json()
        throw new Error(data.error || "Gagal membuat antrean")
      }
    } catch (err: unknown) {
      console.error("Error creating queue:", err)
      const errorMessage =
        err instanceof Error ? err.message : "Gagal membuat antrean"
      setError(errorMessage)
      toast.error(errorMessage)
    }
  }

  // Mereset semua antrean
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const resetQueues = async () => {
    if (!confirm("Anda yakin ingin mereset semua antrean?")) return

    try {
      const response = await fetch("/api/queues/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      })

      if (response.ok) {
        await fetchQueues()
        await fetchCounters()
        setError(null)
        toast.success("Semua antrean berhasil direset")
      } else {
        const data = await response.json()
        throw new Error(data.error || "Gagal mereset antrean")
      }
    } catch (err: unknown) {
      console.error("Error resetting queues:", err)
      const errorMessage =
        err instanceof Error ? err.message : "Gagal mereset antrean"
      setError(errorMessage)
      toast.error(errorMessage)
    }
  }

  // Edit operator
  const updateCounter = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!editingCounter) return

    if (!editingCounter.name.trim()) {
      toast.error("Nama operator tidak boleh kosong")
      return
    }

    try {
      const response = await fetch(`/api/counters/${editingCounter.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: editingCounter.name,
          number: editingCounter.number
        })
      })

      if (response.ok) {
        await fetchCounters()
        setEditingCounter(null)
        toast.success("Operator berhasil diperbarui")
      } else {
        const data = await response.json()
        throw new Error(data.error || "Gagal memperbarui operator")
      }
    } catch (err: unknown) {
      console.error("Error updating counter:", err)
      const errorMessage =
        err instanceof Error ? err.message : "Gagal memperbarui operator"
      setError(errorMessage)
      toast.error(errorMessage)
    }
  }

  // Hapus operator
  const deleteCounter = async (id: string) => {
    if (!confirm("Anda yakin ingin menghapus operator ini?")) return

    try {
      const response = await fetch(`/api/counters/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        }
      })

      if (response.ok) {
        await fetchCounters()
        toast.success("Operator berhasil dihapus")
      } else {
        const data = await response.json()
        throw new Error(data.error || "Gagal menghapus operator")
      }
    } catch (err: unknown) {
      console.error("Error deleting counter:", err)
      const errorMessage =
        err instanceof Error ? err.message : "Gagal menghapus operator"
      setError(errorMessage)
      toast.error(errorMessage)
    }
  }

  if (loading) {
    return <LoadingSpinner fullScreen message="Memuat panel admin..." />
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
                <span className="text-rose-500 ml-1">Admin</span>
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
                    className="text-rose-500 border-b-2 border-rose-500 pb-1"
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
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="mb-10">
            <div className="mb-3 inline-block rounded bg-rose-50 px-3 py-1 text-sm font-inter font-medium text-rose-600 tracking-wide">
              PANEL ADMINISTRATOR
            </div>
            <h1 className="font-inter text-3xl font-bold text-gray-900 md:text-4xl">
              Pengaturan Sistem
            </h1>
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
            <div className="lg:col-span-12">
              <div className="mb-8 rounded-xl bg-white p-8 shadow-sm border border-gray-200 transition-all hover:shadow-md">
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
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </div>
                  Pengaturan Sistem
                </h2>

                {settings ? (
                  <div className="space-y-6 font-inter">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Batas Antrean per Hari
                        </label>
                        <input
                          type="number"
                          value={
                            editedSettings.dailyQueueLimit !== undefined
                              ? editedSettings.dailyQueueLimit
                              : settings?.dailyQueueLimit || ""
                          }
                          onChange={(e) => {
                            const value = e.target.value

                            if (value === "") {
                              toast.error("Batas antrean tidak boleh kosong")
                              setEditedSettings({
                                ...editedSettings,
                                dailyQueueLimit: 0
                              })
                              return
                            }

                            const parsedValue = parseInt(value)
                            if (isNaN(parsedValue)) {
                              toast.error("Batas antrean harus berupa angka")
                              return
                            }

                            setEditedSettings({
                              ...editedSettings,
                              dailyQueueLimit: parsedValue
                            })
                          }}
                          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 shadow-sm focus:border-rose-600 focus:outline-none focus:ring-rose-600 sm:text-sm text-gray-900 placeholder-gray-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Nomor Antrean Awal
                        </label>
                        <input
                          type="number"
                          value={
                            editedSettings.startNumber !== undefined
                              ? editedSettings.startNumber
                              : settings?.startNumber || ""
                          }
                          onChange={(e) => {
                            const value = e.target.value

                            if (value === "") {
                              toast.error(
                                "Nomor awal antrean tidak boleh kosong"
                              )
                              setEditedSettings({
                                ...editedSettings,
                                startNumber: 0
                              })
                              return
                            }

                            const parsedValue = parseInt(value)
                            if (isNaN(parsedValue)) {
                              toast.error(
                                "Nomor awal antrean harus berupa angka"
                              )
                              return
                            }

                            setEditedSettings({
                              ...editedSettings,
                              startNumber: parsedValue
                            })
                          }}
                          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 shadow-sm focus:border-rose-600 focus:outline-none focus:ring-rose-600 sm:text-sm text-gray-900 placeholder-gray-500"
                        />
                      </div>
                    </div>

                    {/* Video URL Configuration */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        URL Video YouTube untuk Display
                      </label>
                      <input
                        type="url"
                        value={
                          editedSettings.videoUrl !== undefined
                            ? editedSettings.videoUrl
                            : settings?.videoUrl || ""
                        }
                        onChange={(e) => {
                          setEditedSettings({
                            ...editedSettings,
                            videoUrl: e.target.value
                          })
                        }}
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 shadow-sm focus:border-rose-600 focus:outline-none focus:ring-rose-600 sm:text-sm text-gray-900 placeholder-gray-500"
                        placeholder="https://www.youtube.com/embed/VIDEO_ID"
                      />
                      <p className="mt-2 text-sm text-gray-500">
                        Masukkan URL YouTube dalam format embed. Contoh:
                        https://www.youtube.com/embed/jAQvxW2l-Pg
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="resetQueueDaily"
                          checked={
                            editedSettings.resetQueueDaily ??
                            settings.resetQueueDaily
                          }
                          onChange={(e) =>
                            setEditedSettings({
                              ...editedSettings,
                              resetQueueDaily: e.target.checked
                            })
                          }
                          className="h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-600"
                        />
                        <label
                          htmlFor="resetQueueDaily"
                          className="ml-3 block text-sm text-gray-700"
                        >
                          Reset antrean otomatis setiap hari
                        </label>
                      </div>

                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="allowSimultaneous"
                          checked={
                            editedSettings.allowSimultaneous ??
                            settings.allowSimultaneous
                          }
                          onChange={(e) =>
                            setEditedSettings({
                              ...editedSettings,
                              allowSimultaneous: e.target.checked
                            })
                          }
                          className="h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-600"
                        />
                        <label
                          htmlFor="allowSimultaneous"
                          className="ml-3 block text-sm text-gray-700"
                        >
                          Izinkan operator memanggil antrian bersamaan
                        </label>
                      </div>
                    </div>

                    <div className="pt-4">
                      <button
                        onClick={saveSettings}
                        className="rounded-lg bg-rose-600 px-5 py-2.5 font-medium text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-600 focus:ring-offset-2 transition-all duration-200"
                      >
                        Simpan Pengaturan
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 font-inter">
                    Tidak dapat memuat pengaturan
                  </p>
                )}
              </div>
            </div>

            <div className="lg:col-span-12">
              <div className="mb-8 rounded-xl bg-white p-8 shadow-sm border border-gray-200 transition-all hover:shadow-md">
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
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                  </div>
                  Manajemen Operator
                </h2>

                <div className="space-y-6 font-inter">
                  <form
                    onSubmit={createCounter}
                    className="space-y-4 border-b border-gray-100 pb-6"
                  >
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Nama Operator
                      </label>
                      <input
                        type="text"
                        value={newCounter.name}
                        onChange={(e) =>
                          setNewCounter({
                            ...newCounter,
                            name: e.target.value
                          })
                        }
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 shadow-sm focus:border-rose-600 focus:outline-none focus:ring-rose-600 sm:text-sm text-gray-900 placeholder-gray-500"
                        placeholder="Masukkan nama operator"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Nomor Operator
                      </label>
                      <input
                        type="number"
                        value={newCounter.number || ""}
                        onChange={(e) => {
                          const value = e.target.value

                          if (value === "") {
                            toast.error("Nomor operator tidak boleh kosong")
                            setNewCounter({
                              ...newCounter,
                              number: 0
                            })
                            return
                          }

                          const parsedValue = parseInt(value)
                          if (isNaN(parsedValue)) {
                            toast.error("Nomor operator harus berupa angka")
                            return
                          }

                          setNewCounter({
                            ...newCounter,
                            number: parsedValue
                          })
                        }}
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 shadow-sm focus:border-rose-600 focus:outline-none focus:ring-rose-600 sm:text-sm text-gray-900 placeholder-gray-500"
                        placeholder="Masukkan nomor operator"
                      />
                    </div>
                    <div>
                      <button
                        type="submit"
                        className="rounded-lg bg-rose-600 px-5 py-2.5 font-medium text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-600 focus:ring-offset-2 transition-all duration-200"
                      >
                        Tambah Operator
                      </button>
                    </div>
                  </form>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      Daftar Operator
                    </h3>

                    {editingCounter ? (
                      <div className="border border-rose-200 bg-rose-50 p-4 rounded-lg mb-4">
                        <h4 className="font-medium text-gray-900 mb-3">
                          Edit Operator
                        </h4>
                        <form onSubmit={updateCounter} className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Nama Operator
                            </label>
                            <input
                              type="text"
                              value={editingCounter.name}
                              onChange={(e) =>
                                setEditingCounter({
                                  ...editingCounter,
                                  name: e.target.value
                                })
                              }
                              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 shadow-sm focus:border-rose-600 focus:outline-none focus:ring-rose-600 sm:text-sm text-gray-900 placeholder-gray-500"
                              placeholder="Masukkan nama operator"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Nomor Operator
                            </label>
                            <input
                              type="number"
                              value={editingCounter.number || ""}
                              onChange={(e) => {
                                const value = e.target.value

                                if (value === "") {
                                  toast.error(
                                    "Nomor operator tidak boleh kosong"
                                  )
                                  setEditingCounter({
                                    ...editingCounter,
                                    number: 0
                                  })
                                  return
                                }

                                const parsedValue = parseInt(value)
                                if (isNaN(parsedValue)) {
                                  toast.error(
                                    "Nomor operator harus berupa angka"
                                  )
                                  return
                                }

                                setEditingCounter({
                                  ...editingCounter,
                                  number: parsedValue
                                })
                              }}
                              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 shadow-sm focus:border-rose-600 focus:outline-none focus:ring-rose-600 sm:text-sm text-gray-900 placeholder-gray-500"
                              placeholder="Masukkan nomor operator"
                            />
                          </div>
                          <div className="flex space-x-2">
                            <button
                              type="submit"
                              className="rounded-lg bg-rose-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-600 focus:ring-offset-2 transition-all duration-200"
                            >
                              Simpan
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCounter(null)}
                              className="rounded-lg bg-white border border-gray-300 px-4 py-2 font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-600 focus:ring-offset-2 transition-all duration-200"
                            >
                              Batal
                            </button>
                          </div>
                        </form>
                      </div>
                    ) : null}

                    {counters.length > 0 ? (
                      <div className="space-y-4">
                        {counters.map((counter) => (
                          <div
                            key={counter.id}
                            className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-all duration-200"
                          >
                            <div className="flex items-start space-x-4">
                              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 font-semibold">
                                {counter.number}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 text-base">
                                  {counter.name}
                                </p>
                                <p className="text-sm text-gray-500 mt-1">
                                  Status:{" "}
                                  {counter.isActive ? (
                                    <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded-full text-xs font-medium">
                                      Aktif
                                    </span>
                                  ) : (
                                    <span className="text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full text-xs font-medium">
                                      Tidak Aktif
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              {counter.currentQueue && (
                                <div className="bg-rose-50 px-3 py-1.5 rounded-lg text-rose-800 text-sm font-medium mr-2 flex items-center">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-4 w-4 mr-1"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
                                    />
                                  </svg>
                                  <span>
                                    Antrian: {counter.currentQueue.number}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center space-x-2">
                                <Link
                                  target="_blank"
                                  href={`/loket/${counter.id}`}
                                  className="inline-flex items-center rounded-lg border border-rose-300 bg-rose-50 p-2 text-sm font-medium text-rose-700 shadow-sm hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-600 focus:ring-offset-2 transition-all duration-200"
                                  title="Buka Halaman Operator"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-4 w-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                    />
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                    />
                                  </svg>
                                </Link>
                                <button
                                  onClick={() => setEditingCounter(counter)}
                                  className="inline-flex items-center rounded-lg border border-gray-300 bg-white p-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-600 focus:ring-offset-2 transition-all duration-200"
                                  title="Edit"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-4 w-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                    />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => deleteCounter(counter.id)}
                                  className="inline-flex items-center rounded-lg border border-gray-300 bg-white p-2 text-sm font-medium text-red-600 shadow-sm hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-200"
                                  title="Hapus"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-4 w-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                  </svg>
                                </button>
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
                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                          />
                        </svg>
                        <p className="text-gray-500 font-inter">
                          Belum ada operator
                        </p>
                        <p className="text-sm text-gray-400 mt-1">
                          Tambahkan operator baru menggunakan form di atas
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-12">
              <div className="mb-8 rounded-xl bg-white p-8 shadow-sm border border-gray-200 transition-all hover:shadow-md">
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
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                  </div>
                  Manajemen Antrean
                </h2>

                <div className="space-y-6 font-inter">
                  <div className="flex space-x-4 pb-6 border-b border-gray-100">
                    <button
                      onClick={createQueue}
                      className="rounded-lg bg-rose-600 px-5 py-2.5 font-medium text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-600 focus:ring-offset-2 transition-all duration-200"
                    >
                      Ambil Nomor
                    </button>
                    <button
                      onClick={resetQueues}
                      className="rounded-lg bg-white border border-gray-300 px-5 py-2.5 font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-600 focus:ring-offset-2 transition-all duration-200"
                    >
                      Reset Antrean
                    </button>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      Daftar Antrean
                    </h3>

                    {queues.length > 0 ? (
                      <div className="overflow-y-auto max-h-[500px] space-y-4 pr-1">
                        {[...queues]
                          .sort((a, b) => b.number - a.number)
                          .map((queue) => (
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
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                                        queue.status === "WAITING"
                                          ? "bg-gray-100 text-gray-700"
                                          : queue.status === "CALLED"
                                          ? "bg-yellow-100 text-yellow-700"
                                          : queue.status === "SERVING"
                                          ? "bg-rose-100 text-rose-700"
                                          : queue.status === "COMPLETED"
                                          ? "bg-green-100 text-green-700"
                                          : "bg-red-100 text-red-700"
                                      }`}
                                    >
                                      {queue.status === "WAITING" && "Menunggu"}
                                      {queue.status === "CALLED" && "Dipanggil"}
                                      {queue.status === "SERVING" && "Dilayani"}
                                      {queue.status === "COMPLETED" &&
                                        "Selesai"}
                                      {queue.status === "SKIPPED" &&
                                        "Lewat/Batal"}
                                    </span>
                                  </p>
                                </div>
                              </div>
                              {queue.counterServingId && (
                                <div className="flex items-center space-x-2">
                                  <span className="inline-flex items-center rounded-full bg-rose-100 px-3 py-0.5 text-sm font-medium text-rose-800">
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="h-4 w-4 mr-1"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                                      />
                                    </svg>
                                    Operator{" "}
                                    {
                                      counters.find(
                                        (c) => c.id === queue.counterServingId
                                      )?.number
                                    }
                                  </span>
                                </div>
                              )}
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
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                          />
                        </svg>
                        <p className="text-gray-500 font-inter">
                          Belum ada antrean
                        </p>
                        <p className="text-sm text-gray-400 mt-1">
                          Klik tombol &ldquo;Ambil Nomor&rdquo; untuk membuat
                          antrean baru
                        </p>
                      </div>
                    )}
                  </div>
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
