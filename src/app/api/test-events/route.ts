import { NextRequest, NextResponse } from "next/server"

// Function to emit socket event
async function emitSocketEvent(
  eventType: string,
  eventData: Record<string, unknown>
) {
  try {
    const socketServerUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001"

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

// Socket event types
enum SOCKET_EVENTS {
  QUEUE_UPDATE = "queue-update",
  RECALL_EVENT = "recall-event",
  TEST_EVENT = "test-event",
  COUNTER_UPDATE = "counter-update"
}

// Test endpoint to send Socket.io events for testing
export async function GET(req: NextRequest) {
  try {
    // Get the event type from query parameters
    const searchParams = req.nextUrl.searchParams
    const eventType = searchParams.get("event") || "test"
    const clientId = searchParams.get("clientId") || "unknown"

    // Create different test data based on the requested event type
    if (eventType === "queue-call") {
      // Simulate a queue being called
      const testQueueEvent = {
        type: "QUEUE_CALLED",
        queue: {
          id: `test-${Date.now()}`,
          number: Math.floor(Math.random() * 100) + 1,
          status: "CALLED",
          counterServingId: "test-counter-1"
        },
        counter: {
          id: "test-counter-1",
          name: "Test Counter",
          number: 1,
          isActive: true,
          currentQueue: null
        },
        timestamp: Date.now()
      }

      console.log(
        `🔔 Emitting test QUEUE_CALLED event (requested by ${clientId}):`,
        testQueueEvent
      )
      await emitSocketEvent(SOCKET_EVENTS.QUEUE_UPDATE, testQueueEvent)

      return NextResponse.json({
        success: true,
        message: "Test queue call event sent successfully",
        data: testQueueEvent
      })
    } else if (eventType === "recall") {
      // Simulate a recall event
      const testRecallEvent = {
        queueNumber: Math.floor(Math.random() * 100) + 1,
        counterNumber: 1,
        timestamp: new Date().toISOString()
      }

      console.log(
        `📣 Emitting test RECALL_EVENT (requested by ${clientId}):`,
        testRecallEvent
      )
      await emitSocketEvent(SOCKET_EVENTS.RECALL_EVENT, testRecallEvent)

      return NextResponse.json({
        success: true,
        message: "Test recall event sent successfully",
        data: testRecallEvent
      })
    } else {
      // Default test message
      const testMessage = {
        message: `This is a test message from the Socket.io API (to ${clientId})`,
        timestamp: new Date().toISOString()
      }

      console.log(
        `🧪 Emitting default TEST_EVENT (requested by ${clientId}):`,
        testMessage
      )
      await emitSocketEvent(SOCKET_EVENTS.TEST_EVENT, testMessage)

      return NextResponse.json({
        success: true,
        message: "Test event sent successfully",
        data: testMessage
      })
    }
  } catch (error) {
    console.error("Error sending test event:", error)
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"

    return NextResponse.json(
      {
        success: false,
        error: errorMessage
      },
      { status: 500 }
    )
  }
}

// POST method to allow specific test event data
export async function POST(req: NextRequest) {
  try {
    const data = await req.json()
    const { eventType, eventData, clientId = "unknown" } = data

    if (!eventType || !eventData) {
      return NextResponse.json(
        { error: "Event type and data are required" },
        { status: 400 }
      )
    }

    // Validate event type
    if (!Object.values(SOCKET_EVENTS).includes(eventType as SOCKET_EVENTS)) {
      return NextResponse.json({ error: "Invalid event type" }, { status: 400 })
    }

    // Emit the event
    console.log(
      `📤 Emitting custom test ${eventType} event (requested by ${clientId}):`,
      eventData
    )
    await emitSocketEvent(eventType, eventData)

    return NextResponse.json({
      success: true,
      message: `Test ${eventType} event sent successfully`,
      data: eventData
    })
  } catch (error) {
    console.error("Error sending custom test event:", error)
    return NextResponse.json({ error: "Failed to emit event" }, { status: 500 })
  }
}
