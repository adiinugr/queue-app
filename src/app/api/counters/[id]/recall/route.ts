import { NextRequest, NextResponse } from "next/server"
import { withErrorHandler } from "@/app/api/middleware"

export const POST = withErrorHandler(
  async (
    request: NextRequest,
    // `params` is required for the API route pattern but not used in this implementation
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    { params }: { params: { id: string } }
  ) => {
    // Ambil data dari body request
    const { queueNumber, counterNumber } = await request.json()

    // Validasi data
    if (!queueNumber || !counterNumber) {
      return NextResponse.json(
        { error: "Data antrean tidak lengkap" },
        { status: 400 }
      )
    }

    // Kirim data recall ke endpoint recall-events untuk memicu pengumuman suara
    const recallResponse = await fetch(
      `${process.env.CLIENT_URL}/api/recall-events`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ queueNumber, counterNumber })
      }
    )

    if (!recallResponse.ok) {
      throw new Error("Gagal memproses panggilan ulang antrean")
    }

    // Kirim respons sukses
    return NextResponse.json({
      success: true,
      message: "Antrean berhasil dipanggil ulang",
      data: {
        queueNumber,
        counterNumber,
        timestamp: new Date().toISOString()
      }
    })
  }
)
