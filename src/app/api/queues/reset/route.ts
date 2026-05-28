import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withErrorHandlerNoReq } from "../../middleware"

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4010"

// POST /api/queues/reset - Mereset semua antrean hari ini
export const POST = withErrorHandlerNoReq(async () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Deleting queues automatically nullifies Counter.currentQueue (FK is on Queue side)
  await prisma.queue.deleteMany({ where: { date: { gte: today } } })

  // Notify all clients to refresh
  try {
    await fetch(`${SOCKET_URL}/api/emit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: "queue-update",
        eventData: { type: "QUEUES_RESET", timestamp: Date.now() }
      })
    })
    await fetch(`${SOCKET_URL}/api/emit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: "counter-update",
        eventData: { type: "COUNTERS_RESET", timestamp: Date.now() }
      })
    })
  } catch {
    // Non-critical — clients will update via polling
  }

  return NextResponse.json({ success: true, message: "Semua antrean berhasil direset" })
})
