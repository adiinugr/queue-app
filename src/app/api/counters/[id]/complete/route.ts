import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withErrorHandler } from "@/app/api/middleware"
import { Prisma } from "@prisma/client"

const SOCKET_URL = process.env.SOCKET_SERVER_URL || "http://localhost:4010"

async function emitSocketEvent(eventType: string, eventData: object) {
  try {
    const response = await fetch(`${SOCKET_URL}/api/emit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType, eventData })
    })
    if (!response.ok) {
      console.error(`Failed to emit socket event: ${response.statusText}`)
      return false
    }
    return true
  } catch (error) {
    console.error("Error emitting socket event:", error)
    return false
  }
}

// POST /api/counters/[id]/complete
// Body: { issueOperatorTicket?: boolean }
// Jika issueOperatorTicket=true (hanya untuk VERIFIKATOR), setelah selesai otomatis buat nomor operator baru
export const POST = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const { id } = params
    const body = await req.json().catch(() => ({}))
    const issueOperatorTicket: boolean = body.issueOperatorTicket === true

    const counter = await prisma.counter.findUnique({
      where: { id },
      include: { currentQueue: true }
    })

    if (!counter) {
      return NextResponse.json({ error: "Loket tidak ditemukan" }, { status: 404 })
    }

    if (!counter.currentQueue) {
      return NextResponse.json(
        { error: "Loket tidak sedang melayani antrian" },
        { status: 400 }
      )
    }

    const currentQueueId = counter.currentQueue.id

    // Selesaikan antrian saat ini
    const updatedQueue = await prisma.queue.update({
      where: { id: currentQueueId },
      data: {
        status: "COMPLETED",
        counterServingId: null,
        historyCounters: { connect: { id: counter.id } }
      }
    })

    // Jika verifikator menyetujui berkas: buat nomor operator SEBELUM emit event,
    // agar saat operator page menerima QUEUE_COMPLETED dan langsung fetchQueues(),
    // tiket operator sudah ada di DB (menghindari race condition).
    let operatorQueue = null
    if (issueOperatorTicket && counter.counterType === "VERIFIKATOR") {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      operatorQueue = await prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(2)`
          const last = await tx.queue.findFirst({
            where: { date: { gte: today }, queueType: "OPERATOR" },
            orderBy: { number: "desc" }
          })
          const nextNumber = (last?.number ?? 0) + 1
          return tx.queue.create({
            data: { number: nextNumber, queueType: "OPERATOR", date: today }
          })
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 10000 }
      )
    }

    const counterSnapshot = {
      id: counter.id,
      name: counter.name,
      number: counter.number,
      counterType: counter.counterType,
      isActive: counter.isActive,
      currentQueue: null
    }

    await emitSocketEvent("queue-update", {
      type: "QUEUE_COMPLETED",
      queue: updatedQueue,
      counter: counterSnapshot,
      timestamp: Date.now()
    })

    await emitSocketEvent("counter-update", {
      type: "COUNTER_UPDATED",
      counter: counterSnapshot,
      timestamp: Date.now()
    })

    if (operatorQueue) {
      await emitSocketEvent("queue-update", {
        type: "QUEUE_CREATED",
        queue: operatorQueue,
        timestamp: Date.now()
      })
    }

    return NextResponse.json({ completedQueue: updatedQueue, operatorQueue })
  }
)
