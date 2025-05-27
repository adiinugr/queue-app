import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withErrorHandler } from "@/app/api/middleware"

// Define type for socket event data
interface SocketEventData {
  type: string
  queue?: {
    id: string
    number: number
    status: string
    counterServingId: string | null
  }
  counter?: {
    id: string
    name: string
    number: number
    isActive: boolean
    currentQueue: null | {
      id: string
      number: number
      status: string
    }
  }
  counterId?: string
  timestamp?: number
}

// Function to emit socket event
async function emitSocketEvent(eventType: string, eventData: SocketEventData) {
  try {
    const socketServerUrl =
      process.env.SOCKET_SERVER_URL || "http://localhost:3001"

    console.log(`Emitting ${eventType} event:`, eventData)

    const response = await fetch(`${socketServerUrl}/api/emit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        eventType,
        eventData
      })
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

// POST /api/counters/[id]/complete - Menyelesaikan layanan untuk antrean saat ini
export const POST = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const { id } = params

    // Memeriksa apakah loket ada
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

    // Memeriksa apakah loket memiliki antrean yang sedang dilayani
    if (!counter.currentQueue) {
      return NextResponse.json(
        { error: "Loket tidak sedang melayani antrean" },
        { status: 400 }
      )
    }

    // Menyimpan ID antrean saat ini
    const currentQueueId = counter.currentQueue.id

    // Update antrean menjadi selesai dan menambahkan ke riwayat loket
    const updatedQueue = await prisma.queue.update({
      where: { id: currentQueueId },
      data: {
        status: "COMPLETED",
        counterServingId: null, // Melepaskan dari loket saat ini
        historyCounters: {
          connect: {
            id: counter.id
          }
        }
      }
    })

    console.log("Queue completed in API:", updatedQueue)

    // Emit Socket.io event for queue update
    await emitSocketEvent("queue-update", {
      type: "QUEUE_COMPLETED",
      queue: updatedQueue,
      counter: {
        id: counter.id,
        name: counter.name,
        number: counter.number,
        isActive: counter.isActive,
        currentQueue: null
      },
      timestamp: Date.now()
    })

    // Also emit a counter-update event
    await emitSocketEvent("counter-update", {
      type: "COUNTER_UPDATED",
      counter: {
        id: counter.id,
        name: counter.name,
        number: counter.number,
        isActive: counter.isActive,
        currentQueue: null
      },
      timestamp: Date.now()
    })

    return NextResponse.json(updatedQueue)
  }
)
