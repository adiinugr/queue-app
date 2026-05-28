import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withErrorHandler } from "../../middleware"

const SOCKET_URL = process.env.SOCKET_SERVER_URL || "http://localhost:4010"

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

interface RouteParams {
  params: { id: string }
}

// PUT /api/counters/[id] - Update counter
export const PUT = withErrorHandler(
  async (req: NextRequest, { params }: RouteParams) => {
    const { id } = params
    const body = await req.json()
    const { name, number, counterType, isActive } = body

    if (!name || number === undefined) {
      return NextResponse.json(
        { error: "Nama dan nomor loket harus diisi" },
        { status: 400 }
      )
    }

    // Cek duplikasi nomor dalam tipe yang sama
    const existingCounter = await prisma.counter.findFirst({
      where: { number, counterType: counterType ?? undefined, id: { not: id } }
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
        number,
        ...(counterType && { counterType }),
        ...(isActive !== undefined && { isActive })
      }
    })

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

    const counter = await prisma.counter.findUnique({
      where: { id },
      include: { currentQueue: true }
    })

    if (counter?.currentQueue) {
      return NextResponse.json(
        {
          error:
            "Loket sedang melayani antrean. Selesaikan antrean terlebih dahulu."
        },
        { status: 400 }
      )
    }

    await prisma.counter.delete({ where: { id } })

    await emitSocketEvent("counter-update", {
      type: "COUNTER_DELETED",
      counterId: id,
      timestamp: Date.now()
    })

    return NextResponse.json({ success: true })
  }
)
