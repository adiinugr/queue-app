import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withErrorHandler, withErrorHandlerNoReq } from "../middleware"
import { Prisma } from "@prisma/client"

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

// POST /api/queues - Membuat antrean baru (VERIFIKATOR atau OPERATOR manual dari admin)
export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}))
  const queueType: string = body.queueType

  if (queueType !== "VERIFIKATOR" && queueType !== "OPERATOR") {
    return NextResponse.json(
      { error: "queueType harus VERIFIKATOR atau OPERATOR" },
      { status: 400 }
    )
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const settings = (await prisma.setting.findFirst({
    where: { id: "default" }
  })) || { dailyQueueLimit: 200, startNumber: 1 }

  // Advisory lock key berbeda per tipe agar tidak saling blokir
  const lockKey = queueType === "OPERATOR" ? 2 : 3

  let queue
  try {
    queue = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`

        const queueCount = await tx.queue.count({
          where: { date: { gte: today }, queueType }
        })

        if (queueCount >= settings.dailyQueueLimit) {
          throw new Error(`Antrian ${queueType === "OPERATOR" ? "operator" : "verifikator"} hari ini sudah penuh`)
        }

        const last = await tx.queue.findFirst({
          where: { date: { gte: today }, queueType },
          orderBy: { number: "desc" }
        })

        const nextNumber = last ? last.number + 1 : settings.startNumber

        return tx.queue.create({
          data: { number: nextNumber, queueType, date: today }
        })
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 10000 }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal membuat antrian"
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  await emitSocketEvent("queue-update", {
    type: "QUEUE_CREATED",
    queue,
    timestamp: Date.now()
  })

  return NextResponse.json(queue, { status: 201 })
})
