import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withErrorHandler } from "@/app/api/middleware"
import { Prisma } from "@prisma/client"

// Function to emit socket event
async function emitSocketEvent(
  eventType: string,
  eventData: Record<string, unknown>
) {
  try {
    const socketServerUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4010"

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

// POST /api/counters/[id]/next - Memanggil nomor antrean berikutnya untuk loket tertentu
export const POST = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const { id } = params

    // Gunakan mutex untuk proses serempak
    // Lock ID yang unik untuk operasi "Get Next Queue"
    const NEXT_QUEUE_LOCK_ID = "get-next-queue-lock"

    // Memeriksa apakah loket ada
    const counter = await prisma.counter.findUnique({
      where: { id },
      include: { currentQueue: true }
    })

    if (!counter) {
      return NextResponse.json(
        { error: "Loket tidak ditemukan" },
        { status: 404 }
      )
    }

    // Memeriksa apakah loket aktif
    if (!counter.isActive) {
      return NextResponse.json({ error: "Loket tidak aktif" }, { status: 400 })
    }

    // Memeriksa apakah loket sedang melayani antrean
    if (counter.currentQueue) {
      return NextResponse.json(
        {
          error: "Loket sedang melayani antrean",
          currentQueue: counter.currentQueue
        },
        { status: 400 }
      )
    }

    // Mendapatkan pengaturan
    const settings = (await prisma.setting.findFirst({
      where: { id: "default" }
    })) || { allowSimultaneous: false }

    // Mencoba mendapatkan antrean berikutnya dalam transaksi yang benar-benar atomic
    let updatedQueue = null

    try {
      // Menggunakan transaksi dengan maximum isolation level
      await prisma.$transaction(
        async (tx) => {
          // Advisory lock implementation
          // Different approach based on database type (PostgreSQL or MySQL)
          try {
            // Try PostgreSQL advisory lock
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(${
              parseInt(NEXT_QUEUE_LOCK_ID.replace(/\D/g, ""), 36) % 2147483647
            })`
          } catch {
            // Fallback for MySQL/other databases - use a lock table
            // Create a temporary lock record
            await tx.$executeRaw`
            INSERT INTO lock_table (id, locked_at)
            VALUES (${NEXT_QUEUE_LOCK_ID}, NOW())
            ON CONFLICT (id) DO UPDATE
            SET locked_at = NOW()
          `.catch(async (err) => {
              // If lock_table doesn't exist, create it
              if (err.message.includes("lock_table")) {
                await tx.$executeRaw`
                CREATE TABLE IF NOT EXISTS lock_table (
                  id TEXT PRIMARY KEY,
                  locked_at TIMESTAMP NOT NULL
                )
              `
                // Try insert again
                await tx.$executeRaw`
                INSERT INTO lock_table (id, locked_at)
                VALUES (${NEXT_QUEUE_LOCK_ID}, NOW())
              `
              } else {
                throw err
              }
            })
          }

          // Get the next queue with most up-to-date state
          const today = new Date()
          today.setHours(0, 0, 0, 0)

          // Mendapatkan antrean berikutnya dengan keadaan terbaru
          const nextQueue = await tx.queue.findFirst({
            where: {
              date: {
                gte: today
              },
              status: "WAITING",
              ...(settings.allowSimultaneous
                ? {}
                : {
                    counterServingId: null // Hanya jika simultaneous tidak diizinkan
                  })
            },
            orderBy: {
              number: "asc"
            }
          })

          if (!nextQueue) return

          // Update antrean menjadi dipanggil
          updatedQueue = await tx.queue.update({
            where: { id: nextQueue.id },
            data: {
              status: "CALLED",
              counterServingId: counter.id
            }
          })
        },
        {
          // Maximum isolation level
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          // Longer timeout for this critical operation
          timeout: 10000 // 10 seconds
        }
      )
    } catch (error) {
      console.error("Error in transaction:", error)
      return NextResponse.json(
        { error: "Gagal memproses antrean, silakan coba lagi" },
        { status: 500 }
      )
    }

    if (!updatedQueue) {
      return NextResponse.json(
        { error: "Tidak ada antrean yang menunggu" },
        { status: 404 }
      )
    }

    // Emit socket event for WebSocket clients
    await emitSocketEvent("queue-update", {
      type: "QUEUE_CALLED",
      queue: updatedQueue,
      counter,
      timestamp: Date.now()
    })

    return NextResponse.json(updatedQueue)
  }
)
