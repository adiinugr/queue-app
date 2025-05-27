import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withErrorHandlerNoReq } from "../../middleware"

// POST /api/queues/reset - Mereset semua antrean hari ini
export const POST = withErrorHandlerNoReq(async () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Menghapus semua antrean hari ini
  await prisma.queue.deleteMany({
    where: {
      date: {
        gte: today
      }
    }
  })

  // Memastikan semua loket tidak memiliki antrean aktif
  await prisma.counter.updateMany({
    data: {
      counterServingId: null
    }
  })

  return NextResponse.json({
    success: true,
    message: "Semua antrean berhasil direset"
  })
})
