import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withErrorHandlerNoReq } from "../middleware"

// Function to emit socket event
async function emitSocketEvent(
  eventType: string,
  eventData: {
    type: string
    queue: {
      id: string
      number: number
      status: string
      counterServingId: string | null
      date: Date
    }
    timestamp?: number
  }
) {
  try {
    const socketServerUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001"

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

// GET /api/queues - Mengambil semua antrean untuk hari ini
export const GET = withErrorHandlerNoReq(async () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const queues = await prisma.queue.findMany({
    where: {
      date: {
        gte: today
      }
    },
    orderBy: {
      number: "asc"
    },
    include: {
      servedBy: true
    }
  })

  // Add cache control headers - cache for 1 second to reduce polling impact
  return new NextResponse(JSON.stringify(queues), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=1, s-maxage=1, stale-while-revalidate=5"
    }
  })
})

// POST /api/queues - Membuat antrean baru
export const POST = withErrorHandlerNoReq(async () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Mendapatkan pengaturan untuk batas antrean harian
  const settings = (await prisma.setting.findFirst({
    where: { id: "default" }
  })) || { dailyQueueLimit: 100, startNumber: 1 }

  // Menghitung jumlah antrean yang sudah ada hari ini
  const queueCount = await prisma.queue.count({
    where: {
      date: {
        gte: today
      }
    }
  })

  // Memeriksa apakah sudah mencapai batas
  if (queueCount >= settings.dailyQueueLimit) {
    return NextResponse.json(
      { error: "Antrean hari ini sudah penuh" },
      { status: 400 }
    )
  }

  // Mendapatkan nomor antrean terakhir
  const lastQueue = await prisma.queue.findFirst({
    where: {
      date: {
        gte: today
      }
    },
    orderBy: {
      number: "desc"
    }
  })

  const nextNumber = lastQueue ? lastQueue.number + 1 : settings.startNumber

  // Membuat antrean baru
  const queue = await prisma.queue.create({
    data: {
      number: nextNumber,
      date: today
    }
  })

  console.log("Created new queue:", queue)

  // Emit Socket.io event for queue update
  await emitSocketEvent("queue-update", {
    type: "QUEUE_CREATED",
    queue,
    timestamp: Date.now()
  })

  return NextResponse.json(queue, { status: 201 })
})
