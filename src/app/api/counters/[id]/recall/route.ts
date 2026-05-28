import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withErrorHandler } from "@/app/api/middleware"

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4010"

// POST /api/counters/[id]/recall - Panggil ulang antrean
export const POST = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: { id: string } }
  ) => {
    const { id } = params
    const { queueNumber, counterNumber } = await request.json()

    if (!queueNumber || !counterNumber) {
      return NextResponse.json(
        { error: "Data antrean tidak lengkap" },
        { status: 400 }
      )
    }

    // Ambil tipe loket dari database untuk pengumuman yang tepat
    const counter = await prisma.counter.findUnique({
      where: { id },
      select: { counterType: true, number: true }
    })

    const counterType = counter?.counterType || "OPERATOR"

    // Emit langsung ke socket server
    try {
      const response = await fetch(`${SOCKET_URL}/api/emit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "recall-event",
          eventData: {
            type: "RECALL",
            queueNumber,
            counterNumber,
            counterType,
            timestamp: new Date().toISOString()
          }
        })
      })

      if (!response.ok) {
        throw new Error("Gagal mengirim recall ke socket server")
      }
    } catch (error) {
      console.error("Error emitting recall event:", error)
      return NextResponse.json(
        { error: "Gagal memproses panggilan ulang" },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Antrean berhasil dipanggil ulang",
      data: {
        queueNumber,
        counterNumber,
        counterType,
        timestamp: new Date().toISOString()
      }
    })
  }
)
