import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withErrorHandler } from "@/app/api/middleware"
import { Prisma } from "@prisma/client"

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4010"

async function emitSocketEvent(eventType: string, eventData: object) {
  try {
    const response = await fetch(`${SOCKET_URL}/api/emit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType, eventData })
    })
    return response.ok
  } catch (error) {
    console.error("Error emitting socket event:", error)
    return false
  }
}

// POST /api/counters/[id]/next - Memanggil nomor antrean berikutnya
export const POST = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const { id } = params

    const counter = await prisma.counter.findUnique({
      where: { id },
      include: { currentQueue: true }
    })

    if (!counter) {
      return NextResponse.json(
        { error: "Loket tidak ditemukan" },
        { status: 404 }
      )
    }

    if (!counter.isActive) {
      return NextResponse.json({ error: "Loket tidak aktif" }, { status: 400 })
    }

    if (counter.currentQueue) {
      return NextResponse.json(
        {
          error: "Loket sedang melayani antrean",
          currentQueue: counter.currentQueue
        },
        { status: 400 }
      )
    }

    const settings = (await prisma.setting.findFirst({
      where: { id: "default" }
    })) || { allowSimultaneous: false }

    let updatedQueue = null

    try {
      await prisma.$transaction(
        async (tx) => {
          try {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(${
              parseInt("get-next-queue-lock".replace(/\D/g, "0"), 36) %
              2147483647
            })`
          } catch {
            // Fallback: proceed without advisory lock
          }

          const today = new Date()
          today.setHours(0, 0, 0, 0)

          // Filter antrian berdasarkan tipe loket (OPERATOR atau VERIFIKATOR)
          const nextQueue = await tx.queue.findFirst({
            where: {
              date: { gte: today },
              status: "WAITING",
              queueType: counter.counterType, // Hanya ambil antrean sesuai tipe
              ...(settings.allowSimultaneous ? {} : { counterServingId: null })
            },
            orderBy: { number: "asc" }
          })

          if (!nextQueue) return

          updatedQueue = await tx.queue.update({
            where: { id: nextQueue.id },
            data: { status: "CALLED", counterServingId: counter.id }
          })
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 10000
        }
      )
    } catch (error) {
      console.error("Error in transaction:", error)
      return NextResponse.json(
        { error: "Gagal memproses antrean, silakan coba lagi" },
        { status: 500 }
      )
    }

    if (!updatedQueue) {
      return NextResponse.json(
        {
          error: `Tidak ada antrean ${counter.counterType === "VERIFIKATOR" ? "verifikator" : "operator"} yang menunggu`
        },
        { status: 404 }
      )
    }

    await emitSocketEvent("queue-update", {
      type: "QUEUE_CALLED",
      queue: updatedQueue,
      counter,
      timestamp: Date.now()
    })

    return NextResponse.json(updatedQueue)
  }
)
