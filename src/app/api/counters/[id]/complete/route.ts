import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withErrorHandler } from "@/app/api/middleware"

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

    await emitSocketEvent("queue-update", {
      type: "QUEUE_COMPLETED",
      queue: updatedQueue,
      counter: {
        id: counter.id,
        name: counter.name,
        number: counter.number,
        counterType: counter.counterType,
        isActive: counter.isActive,
        currentQueue: null
      },
      timestamp: Date.now()
    })

    await emitSocketEvent("counter-update", {
      type: "COUNTER_UPDATED",
      counter: {
        id: counter.id,
        name: counter.name,
        number: counter.number,
        counterType: counter.counterType,
        isActive: counter.isActive,
        currentQueue: null
      },
      timestamp: Date.now()
    })

    // Jika verifikator meminta terbitkan nomor operator
    // Gunakan nomor yang sama dengan nomor verifikator agar konsisten
    let operatorQueue = null
    if (issueOperatorTicket && counter.counterType === "VERIFIKATOR") {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const verifikatorNumber = counter.currentQueue.number

      // Cek apakah nomor operator dengan angka yang sama sudah ada hari ini
      const existing = await prisma.queue.findFirst({
        where: { date: { gte: today }, queueType: "OPERATOR", number: verifikatorNumber }
      })

      if (!existing) {
        operatorQueue = await prisma.queue.create({
          data: { number: verifikatorNumber, queueType: "OPERATOR", date: today }
        })

        await emitSocketEvent("queue-update", {
          type: "QUEUE_CREATED",
          queue: operatorQueue,
          timestamp: Date.now()
        })
      }
    }

    return NextResponse.json({ completedQueue: updatedQueue, operatorQueue })
  }
)
