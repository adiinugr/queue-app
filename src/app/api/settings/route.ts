import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withErrorHandler, withErrorHandlerNoReq } from "../middleware"

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4010"

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

// GET /api/settings - Mendapatkan pengaturan sistem
export const GET = withErrorHandlerNoReq(async () => {
  const settings = await prisma.setting.findFirst({
    where: { id: "default" }
  })

  if (!settings) {
    const defaultSettings = await prisma.setting.create({
      data: {
        id: "default",
        dailyQueueLimit: 200,
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
      dailyQueueLimit: dailyQueueLimit ?? 200,
      startNumber: startNumber ?? 1,
      resetQueueDaily: resetQueueDaily ?? true,
      allowSimultaneous: allowSimultaneous ?? false,
      videoUrl: videoUrl ?? "https://www.youtube.com/embed/jAQvxW2l-Pg"
    }
  })

  // Emit settings-update event for real-time video URL changes on display
  await emitSocketEvent("settings-update", {
    ...settings,
    timestamp: Date.now()
  })

  return NextResponse.json(settings)
})
