import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withErrorHandler, withErrorHandlerNoReq } from "../middleware"

// GET /api/settings - Mendapatkan pengaturan sistem
export const GET = withErrorHandlerNoReq(async () => {
  const settings = await prisma.setting.findFirst({
    where: { id: "default" }
  })

  // Jika belum ada pengaturan, buat pengaturan default
  if (!settings) {
    const defaultSettings = await prisma.setting.create({
      data: {
        id: "default",
        dailyQueueLimit: 100,
        startNumber: 1,
        resetQueueDaily: true,
        allowSimultaneous: false,
        videoUrl: "https://www.youtube.com/embed/jAQvxW2l-Pg"
      }
    })
    return NextResponse.json(defaultSettings)
  }

  return NextResponse.json(settings)
})

// PUT /api/settings - Mengupdate pengaturan sistem
export const PUT = withErrorHandler(async (req: NextRequest) => {
  const body = await req.json()
  const {
    dailyQueueLimit,
    startNumber,
    resetQueueDaily,
    allowSimultaneous,
    videoUrl
  } = body

  const settings = await prisma.setting.upsert({
    where: { id: "default" },
    update: {
      ...(dailyQueueLimit !== undefined && { dailyQueueLimit }),
      ...(startNumber !== undefined && { startNumber }),
      ...(resetQueueDaily !== undefined && { resetQueueDaily }),
      ...(allowSimultaneous !== undefined && { allowSimultaneous }),
      ...(videoUrl !== undefined && { videoUrl })
    },
    create: {
      id: "default",
      dailyQueueLimit: dailyQueueLimit ?? 100,
      startNumber: startNumber ?? 1,
      resetQueueDaily: resetQueueDaily ?? true,
      allowSimultaneous: allowSimultaneous ?? false,
      videoUrl: videoUrl ?? "https://www.youtube.com/embed/jAQvxW2l-Pg"
    }
  })

  return NextResponse.json(settings)
})
