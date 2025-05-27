import { NextResponse } from "next/server"

// Function to emit socket event
async function emitSocketEvent(
  eventType: string,
  eventData: Record<string, unknown>
) {
  try {
    const socketServerUrl =
      process.env.SOCKET_SERVER_URL || "http://localhost:3001"

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

// Store the last recall event in memory
let lastRecallEvent = {
  queueNumber: 0,
  counterNumber: 0,
  timestamp: ""
}

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      event: lastRecallEvent.timestamp ? lastRecallEvent : null
    })
  } catch (error) {
    console.error("Error fetching recall events:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const { queueNumber, counterNumber } = data

    if (!queueNumber || !counterNumber) {
      return NextResponse.json(
        { error: "Queue number and counter number are required" },
        { status: 400 }
      )
    }

    // Update the last recall event
    lastRecallEvent = {
      queueNumber,
      counterNumber,
      timestamp: new Date().toISOString()
    }

    // Emit socket event
    await emitSocketEvent("recall-event", lastRecallEvent)
    console.log("Successfully emitted socket recall event")

    return NextResponse.json({
      success: true,
      message: "Recall event recorded successfully",
      event: lastRecallEvent
    })
  } catch (error) {
    console.error("Error handling recall event:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
