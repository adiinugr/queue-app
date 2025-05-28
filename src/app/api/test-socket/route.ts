import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Test endpoint to emit a socket event via API
    const socketServerUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001"

    const testData = {
      type: "TEST_EVENT",
      queue: {
        id: `test-${Date.now()}`,
        number: 999,
        status: "WAITING",
        counterServingId: null
      },
      timestamp: Date.now()
    }

    console.log(`🧪 Emitting test event to socket server at ${socketServerUrl}`)

    const response = await fetch(`${socketServerUrl}/api/emit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        eventType: "queue-update",
        eventData: testData
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to emit test event: ${response.statusText}`)
    }

    const result = await response.json()

    return NextResponse.json({
      success: true,
      message: "Test event emitted via socket server",
      result
    })
  } catch (error) {
    console.error("Error emitting test event:", error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
        error: error
      },
      { status: 500 }
    )
  }
}
