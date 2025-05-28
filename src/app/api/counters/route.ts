import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withErrorHandler, withErrorHandlerNoReq } from "../middleware"

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

// GET /api/counters - Mendapatkan semua loket
export const GET = withErrorHandlerNoReq(async () => {
  const counters = await prisma.counter.findMany({
    include: {
      currentQueue: true
    },
    orderBy: {
      number: "asc"
    }
  })

  // Add cache control headers - cache for 3 seconds to reduce polling impact
  return new NextResponse(JSON.stringify(counters), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control":
        "public, max-age=3, s-maxage=3, stale-while-revalidate=10"
    }
  })
})

// POST /api/counters - Membuat loket baru
export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = await req.json()
  const { name, number } = body

  if (!name || !number) {
    return NextResponse.json(
      { error: "Nama dan nomor loket harus diisi" },
      { status: 400 }
    )
  }

  // Memeriksa apakah nomor loket sudah digunakan
  const existingCounter = await prisma.counter.findFirst({
    where: {
      number
    }
  })

  if (existingCounter) {
    return NextResponse.json(
      { error: "Nomor loket sudah digunakan" },
      { status: 400 }
    )
  }

  const counter = await prisma.counter.create({
    data: {
      name,
      number
    }
  })

  // Emit socket event for counter creation
  await emitSocketEvent("counter-update", {
    type: "COUNTER_CREATED",
    counter,
    timestamp: Date.now()
  })

  return NextResponse.json(counter, { status: 201 })
})
