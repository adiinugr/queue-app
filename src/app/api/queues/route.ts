import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withErrorHandler, withErrorHandlerNoReq } from "../middleware"

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

// GET /api/queues - Mengambil semua antrean untuk hari ini
export const GET = withErrorHandlerNoReq(async () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const queues = await prisma.queue.findMany({
    where: { date: { gte: today } },
    orderBy: { number: "asc" },
    include: { servedBy: true }
  })

  return new NextResponse(JSON.stringify(queues), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  })
})

// POST /api/queues - Membuat antrean baru
export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}))
  const queueType: string = body.queueType

  // Antrian Operator hanya boleh dibuat otomatis oleh sistem saat verifikator menyetujui berkas.
  // Pembuatan manual antrian Operator dilarang untuk menjaga integritas alur antrian.
  if (queueType !== "VERIFIKATOR") {
    return NextResponse.json(
      { error: "Hanya antrian Verifikator yang dapat dibuat manual. Antrian Operator dibuat otomatis saat verifikator menyetujui berkas." },
      { status: 400 }
    )
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const settings = (await prisma.setting.findFirst({
    where: { id: "default" }
  })) || { dailyQueueLimit: 200, startNumber: 1 }

  // Hitung antrian berdasarkan tipe
  const queueCount = await prisma.queue.count({
    where: { date: { gte: today }, queueType }
  })

  if (queueCount >= settings.dailyQueueLimit) {
    return NextResponse.json(
      {
        error: "Antrean verifikator hari ini sudah penuh"
      },
      { status: 400 }
    )
  }

  // Nomor antrean reset per tipe per hari
  const lastQueue = await prisma.queue.findFirst({
    where: { date: { gte: today }, queueType },
    orderBy: { number: "desc" }
  })

  const nextNumber = lastQueue ? lastQueue.number + 1 : settings.startNumber

  const queue = await prisma.queue.create({
    data: { number: nextNumber, queueType, date: today }
  })

  await emitSocketEvent("queue-update", {
    type: "QUEUE_CREATED",
    queue,
    timestamp: Date.now()
  })

  return NextResponse.json(queue, { status: 201 })
})
