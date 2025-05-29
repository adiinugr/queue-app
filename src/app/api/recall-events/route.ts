import { NextResponse } from "next/server"
// No https import needed if not using custom agent directly with fetch like that

// Define a type for errors that might have a 'cause' property
interface FetchError extends Error {
  cause?: unknown
}

// Function to emit socket event
async function emitSocketEvent(
  eventType: string,
  eventData: Record<string, unknown>
) {
  const socketServerUrl =
    process.env.SOCKET_SERVER_URL || "http://localhost:3001"
  const targetUrl = `${socketServerUrl}/api/emit`

  console.log(
    `[emitSocketEvent] Attempting to POST to: ${targetUrl} for eventType: ${eventType}`
  )

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        eventType,
        eventData
      })
    })

    console.log(
      `[emitSocketEvent] Response status for ${eventType}: ${response.status}, statusText: ${response.statusText}`
    )

    if (!response.ok) {
      let errorBody = "[Could not read error body]"
      try {
        errorBody = await response.text()
      } catch (bodyError: unknown) {
        console.error(
          `[emitSocketEvent] Error trying to read error body for ${eventType}:`,
          bodyError instanceof Error ? bodyError.message : bodyError
        )
      }
      console.error(
        `[emitSocketEvent] Failed to emit socket event ${eventType} to ${targetUrl}: ${response.status} ${response.statusText}. Body: ${errorBody}`
      )
      return false
    }

    console.log(
      `[emitSocketEvent] Successfully emitted socket event ${eventType} via POST to ${targetUrl}.`
    )
    return true
  } catch (error: unknown) {
    const fetchError = error as FetchError
    console.error(
      `[emitSocketEvent] Network or other error emitting socket event ${eventType} to ${targetUrl}:`,
      fetchError.message
    )
    if (fetchError.cause) {
      console.error(
        `[emitSocketEvent] Underlying cause for ${eventType}:`,
        fetchError.cause
      )
    }
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
  } catch (error: unknown) {
    const genericError = error as Error
    console.error("Error fetching recall events:", genericError.message)
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

    const currentRecallEvent = {
      queueNumber,
      counterNumber,
      timestamp: new Date().toISOString()
    }
    lastRecallEvent = currentRecallEvent

    const emitted = await emitSocketEvent("recall-event", currentRecallEvent)
    if (emitted) {
      // Successfully logged within emitSocketEvent
    } else {
      console.error(
        "[recall-events POST] emitSocketEvent returned false. Failed to emit socket recall event. Check logs from emitSocketEvent for details."
      )
      // Consider returning an actual error to the client of this API route
      // return NextResponse.json({ error: "Failed to broadcast recall event" }, { status: 502 }); // Example
    }

    return NextResponse.json({
      success: true,
      message: "Recall event recorded successfully",
      event: currentRecallEvent
    })
  } catch (error: unknown) {
    const postError = error as FetchError
    console.error(
      "[recall-events POST] Error handling recall event (e.g., JSON parsing):",
      postError.message
    )
    if (postError.cause) {
      console.error("[recall-events POST] Underlying cause:", postError.cause)
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
