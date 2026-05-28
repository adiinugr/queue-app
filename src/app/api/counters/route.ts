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

// GET /api/counters - Mendapatkan semua loket
export const GET = withErrorHandlerNoReq(async () => {
  const counters = await prisma.counter.findMany({
    include: { currentQueue: true },
    orderBy: [{ counterType: "asc" }, { number: "asc" }]
  })

  return new NextResponse(JSON.stringify(counters), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  })
})

// POST /api/counters - Membuat loket baru
export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = await req.json()
  const { name, number, counterType = "OPERATOR" } = body

  if (!name || !number) {
    return NextResponse.json(
      { error: "Nama dan nomor loket harus diisi" },
      { status: 400 }
    )
  }

  if (counterType !== "OPERATOR" && counterType !== "VERIFIKATOR") {
    return NextResponse.json(
      { error: "Tipe loket tidak valid" },
      { status: 400 }
    )
  }

  // Cek duplikasi nomor dalam tipe yang sama
  const existingCounter = await prisma.counter.findFirst({
    where: { number, counterType }
  })

  if (existingCounter) {
    return NextResponse.json(
      { error: `Nomor ${counterType === "VERIFIKATOR" ? "verifikator" : "operator"} ${number} sudah digunakan` },
      { status: 400 }
    )
  }

  const counter = await prisma.counter.create({
    data: { name, number, counterType }
  })

  await emitSocketEvent("counter-update", {
    type: "COUNTER_CREATED",
    counter,
    timestamp: Date.now()
  })

  return NextResponse.json(counter, { status: 201 })
})
