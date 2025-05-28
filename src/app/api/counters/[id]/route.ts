import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withErrorHandler } from "../../middleware"

// Function to emit socket event
async function emitSocketEvent(eventType: string, eventData: any) {
  try {
    const socketServerUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001"

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

interface RouteParams {
  params: {
    id: string
  }
}

// PUT /api/counters/[id] - Update counter
export const PUT = withErrorHandler(
  async (req: NextRequest, { params }: RouteParams) => {
    const { id } = params
    const body = await req.json()
    const { name, number } = body

    if (!name || number === undefined) {
      return NextResponse.json(
        { error: "Nama dan nomor loket harus diisi" },
        { status: 400 }
      )
    }

    // Check if another counter with the same number exists
    const existingCounter = await prisma.counter.findFirst({
      where: {
        number: number,
        id: {
          not: id
        }
      }
    })

    if (existingCounter) {
      return NextResponse.json(
        { error: "Nomor loket sudah digunakan" },
        { status: 400 }
      )
    }

    const counter = await prisma.counter.update({
      where: { id },
      data: {
        name,
        number
      }
    })

    // Emit socket event for counter update
    await emitSocketEvent("counter-update", {
      type: "COUNTER_UPDATED",
      counter,
      timestamp: Date.now()
    })

    return NextResponse.json(counter)
  }
)

// DELETE /api/counters/[id] - Delete counter
export const DELETE = withErrorHandler(
  async (_req: NextRequest, { params }: RouteParams) => {
    const { id } = params

    // Check if counter is serving a queue
    const counter = await prisma.counter.findUnique({
      where: { id },
      include: { currentQueue: true }
    })

    if (counter?.currentQueue) {
      return NextResponse.json(
        {
          error:
            "Loket sedang melayani antrean. Selesaikan atau pindahkan antrean terlebih dahulu."
        },
        { status: 400 }
      )
    }

    await prisma.counter.delete({
      where: { id }
    })

    // Emit socket event for counter deletion
    await emitSocketEvent("counter-update", {
      type: "COUNTER_DELETED",
      counterId: id,
      timestamp: Date.now()
    })

    return NextResponse.json({ success: true })
  }
)
